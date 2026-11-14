/**
 * Offline-First Sync Manager for Notes App
 * Handles offline note creation/editing and syncs with Supabase when online
 * 
 * Features:
 * - Some of them are not working in native app because of the way it handles local storage and background processes.
 * - Notes work completely offline
 * - Auto-sync when connection restored
 * - Conflict resolution (local vs server)
 * - Queue management for offline actions
 * - Persistent storage with IndexedDB
 * - Works with encrypted content
 * - Only Works when App was opened at least once with internet connection to initialize the database and get user info. After that, it can work offline until the user logs out or clears data.
 * 
 * The app encrypts online saves, and this module encrypts locally queued plaintext before upload.
 */

// =====================================================
// 1. INDEXEDDB SETUP (With Stores for Notes, Sync Queue, and Metadata)
// =====================================================

const DB_NAME = 'notozApp';
const DB_VERSION = 2;

// Store names
const STORES = {
  notes: 'notes',
  syncQueue: 'syncQueue',
  metadata: 'metadata'
};

let db = null;

/**
 * Initialize IndexedDB database
 */
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      console.log('[Offline] ✓ IndexedDB initialized');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Notes store
      if (!database.objectStoreNames.contains(STORES.notes)) {
        const notesStore = database.createObjectStore(STORES.notes, { keyPath: 'id' });
        notesStore.createIndex('user_id', 'user_id', { unique: false });
        notesStore.createIndex('updated_at', 'updated_at', { unique: false });
      }

      // Sync queue store
      if (!database.objectStoreNames.contains(STORES.syncQueue)) {
        const queueStore = database.createObjectStore(STORES.syncQueue, { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('action', 'action', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('user_id', 'user_id', { unique: false });
      } else if (event.oldVersion < 2) {
        const queueStore = event.target.transaction.objectStore(STORES.syncQueue);
        if (!queueStore.indexNames.contains('user_id')) {
          queueStore.createIndex('user_id', 'user_id', { unique: false });
        }
        queueStore.openCursor().onsuccess = (cursorEvent) => {
          const cursor = cursorEvent.target.result;
          if (!cursor) return;
          const item = cursor.value;
          if (!item.user_id && item.data?.user_id) {
            cursor.update({ ...item, user_id: item.data.user_id });
          }
          cursor.continue();
        };
      }

      // Metadata store (last sync time, etc)
      if (!database.objectStoreNames.contains(STORES.metadata)) {
        database.createObjectStore(STORES.metadata, { keyPath: 'key' });
      }

      console.log('[Offline] ✓ Database schema created');
    };
  });
}

// =====================================================
// 2. OFFLINE NOTE OPERATIONS (With Local Saving, Deletion, and Retrieval)
// =====================================================

/**
 * Save a note locally (works offline)
 */
async function saveNoteOffline(noteData, { preserveUpdatedAt = false } = {}) {
  if (!db) await initializeDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.notes, STORES.syncQueue], 'readwrite');
    const notesStore = transaction.objectStore(STORES.notes);
    const queueStore = transaction.objectStore(STORES.syncQueue);

    // Generate ID if not present
    const noteId = noteData.id || generateUUID();
    const timestamp = new Date().toISOString();

    const note = {
      ...noteData,
      id: noteId,
      user_id: noteData.user_id,
      created_at: noteData.created_at || timestamp,
      updated_at: preserveUpdatedAt ? noteData.updated_at || timestamp : timestamp,
      synced: false,
      offline: true
    };

    if (!note.user_id) {
      reject(new Error('Cannot save an offline note without an authenticated user.'));
      return;
    }

    // Save note locally
    const noteSaveRequest = notesStore.put(note);

    // Add to sync queue
    const queueItem = {
      action: 'upsert',
      user_id: note.user_id,
      noteId: noteId,
      data: note,
      timestamp: timestamp,
      retries: 0,
      maxRetries: 3
    };

    const queueSaveRequest = queueStore.add(queueItem);

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      console.log('[Offline] ✓ Note saved locally:', noteId);
      resolve(note);
    };
  });
}

/**
 * Delete a note locally (offline-safe)
 */
async function deleteNoteOffline(noteId, queueForSync = true) {
  if (!db) await initializeDatabase();
  const user = queueForSync ? await getCurrentUser() : null;
  if (queueForSync && !user?.id) throw new Error('Cannot delete an offline note without an authenticated user.');

  return new Promise((resolve, reject) => {
    const storeNames = queueForSync ? [STORES.notes, STORES.syncQueue] : [STORES.notes];
    const transaction = db.transaction(storeNames, 'readwrite');
    const notesStore = transaction.objectStore(STORES.notes);
    const queueStore = queueForSync ? transaction.objectStore(STORES.syncQueue) : null;

    notesStore.delete(noteId);

    if (queueStore) {
      queueStore.add({
        action: 'delete',
        user_id: user.id,
        noteId: noteId,
        timestamp: new Date().toISOString(),
        retries: 0,
        maxRetries: 3
      });
    }

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      console.log('[Offline] ✓ Note marked for deletion:', noteId);
      resolve();
    };
  });
}

/**
 * Get all notes from local storage (works offline)
 */
async function getNotesOffline(userId) {
  if (!db) await initializeDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.notes], 'readonly');
    const store = transaction.objectStore(STORES.notes);
    const index = store.index('user_id');

    const request = index.getAll(userId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const notes = request.result.sort((a, b) => 
        new Date(b.updated_at) - new Date(a.updated_at)
      );
      console.log('[Offline] ✓ Retrieved', notes.length, 'notes from local storage');
      resolve(notes);
    };
  });
}

/**
 * Get a single note from local storage
 */
async function getNoteOffline(noteId, userId) {
  if (!db) await initializeDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.notes], 'readonly');
    const store = transaction.objectStore(STORES.notes);
    const request = store.get(noteId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const note = request.result || null;
      resolve(note && (!userId || note.user_id === userId) ? note : null);
    };
  });
}

// =====================================================
// 3. SYNC MANAGEMENT (With Online/Offline Detection, Sync Logic, and Conflict Resolution)
// =====================================================

let isSyncing = false;

/**
 * Check if user is online
 */
function isOnline() {
  return navigator.onLine;
}

/**
 * Listen for online/offline events
 */
window.addEventListener('online', () => {
  console.log('[Offline] ✓ Connection restored');
  if (typeof showNotification === 'function') {
    showNotification('Back Online', 'Syncing your changes...', 'success');
  }
  syncWithSupabase();
});

window.addEventListener('offline', () => {
  console.log('[Offline] ⚠️  Connection lost');
  if (typeof showNotification === 'function') {
    showNotification('Offline Mode', 'Changes will sync when you\'re back online', 'info');
  }
});

/**
 * Main sync function - syncs all queued actions with Supabase
 */
async function syncWithSupabase() {
  if (isSyncing || !isOnline()) {
    console.log('[Sync] Sync skipped - already syncing or offline');
    return;
  }

  isSyncing = true;

  try {
    if (!db) await initializeDatabase();
    await setMetadata('lastSyncTime', new Date().toISOString());

    // Get all pending sync operations
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      console.error('[Sync] ❌ No user logged in');
      isSyncing = false;
      return;
    }

    // Only process operations belonging to the active account.
    await recoverUnqueuedOfflineNotes(user.id);
    const queueItems = await getQueueItems(user.id);
    console.log('[Sync] Found', queueItems.length, 'items to sync');

    if (queueItems.length === 0) {
      await setMetadata('lastSyncSuccessAt', new Date().toISOString());
      isSyncing = false;
      return;
    }

    let hasSyncErrors = false;

    // Process each queued item
    for (const queueItem of queueItems) {
      try {
        if (queueItem.action === 'upsert') {
          const remappedId = await syncNoteUpsert(queueItem, user);
          if (remappedId) {
            for (const pendingItem of queueItems) {
              if (pendingItem.noteId === remappedId.oldId) {
                pendingItem.noteId = remappedId.newId;
              }
              if (pendingItem.data?.id === remappedId.oldId) {
                pendingItem.data.id = remappedId.newId;
              }
            }
          }
        } else if (queueItem.action === 'delete') {
          await syncNoteDeletion(queueItem, user);
        }

        // Remove from queue on success
        await removeFromQueue(queueItem.id);
      } catch (error) {
        hasSyncErrors = true;
        console.error('[Sync] Error syncing item:', error);
        
        // Increment retry count
        const maxRetries = queueItem.maxRetries || 3;
        const previousRetries = queueItem.retries || 0;
        queueItem.retries = Math.min(previousRetries + 1, maxRetries);
        await updateQueueItem(queueItem);

        if (previousRetries < maxRetries && queueItem.retries >= maxRetries) {
          console.error('[Sync] ❌ Retry limit reached; keeping item queued:', queueItem.noteId);
          if (typeof showNotification === 'function') {
            showNotification('Sync Error', `Failed to sync note ${queueItem.noteId}`, 'error');
          }
        }
      }
    }

    // Update sync timestamps
    if (!hasSyncErrors) {
      await setMetadata('lastSyncSuccessAt', new Date().toISOString());
    }

    console.log(hasSyncErrors ? '[Sync] Sync completed with failures' : '[Sync] ✓ Sync completed successfully');
    if (!hasSyncErrors && typeof showNotification === 'function') {
      showNotification('✓ Synced', 'All changes saved to cloud', 'success');
    }
  } catch (error) {
    console.error('[Sync] ❌ Sync error:', error);
  } finally {
    isSyncing = false;
  }
}

/**
 * Sync note upsert (create/update)
 */
async function syncNoteUpsert(queueItem, user) {
  const noteData = queueItem.data;

  // Use the supabaseClient from app.js
  if (typeof supabaseClient === 'undefined') {
    throw new Error('supabaseClient not available');
  }

  let remappedId = null;
  if (!isUUID(noteData.id)) {
    const oldId = noteData.id;
    const newId = generateUUID();
    await replaceOfflineNoteId(oldId, newId, user.id);
    noteData.id = newId;
    queueItem.noteId = newId;
    remappedId = { oldId, newId };
  }

  const encryptedTitle = noteData.title?.startsWith('enc:')
    ? noteData.title
    : await _fastEncrypt(noteData.title || '');
  const encryptedContent = noteData.content?.startsWith('enc:')
    ? noteData.content
    : await _fastEncrypt(noteData.content || '');

  const { data, error } = await supabaseClient
    .from('notes')
    .upsert({
      id: noteData.id,
      user_id: user.id,
      title: encryptedTitle,
      content: encryptedContent,
      folder_id: noteData.folder_id || null,
      created_at: noteData.created_at,
      ...(typeof noteData.pinned === 'boolean' ? { pinned: noteData.pinned } : {}),
      updated_at: noteData.updated_at || new Date().toISOString()
    });

  if (error) throw error;

  // Update local copy to mark as synced
  await updateNoteSync(noteData.id, true, user.id);

  console.log('[Sync] ✓ Upserted note:', noteData.id);
  return remappedId;
}

/**
 * Sync note deletion
 */
async function syncNoteDeletion(queueItem, user) {
  if (typeof supabaseClient === 'undefined') {
    throw new Error('supabaseClient not available');
  }

  if (!isUUID(queueItem.noteId)) {
    console.log('[Sync] ✓ Skipping deletion of a note that was never uploaded:', queueItem.noteId);
    return;
  }

  const { error } = await supabaseClient
    .from('notes')
    .delete()
    .eq('id', queueItem.noteId)
    .eq('user_id', user.id);

  if (error) throw error;

  console.log('[Sync] ✓ Deleted note:', queueItem.noteId);
}

/**
 * Update note's sync status
 */
async function updateNoteSync(noteId, synced, userId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.notes], 'readwrite');
    const store = transaction.objectStore(STORES.notes);

    // First get the note
    const getRequest = store.get(noteId);

    getRequest.onsuccess = () => {
      const note = getRequest.result;
      if (note && (!userId || note.user_id === userId)) {
        note.synced = synced;
        note.offline = !synced;
        const updateRequest = store.put(note);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// =====================================================
// 4. SYNC QUEUE MANAGEMENT (With Functions to Get, Remove, and Update Queue Items)
// =====================================================

/**
 * Get all pending sync queue items
 */
function getQueueItems(userId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.syncQueue], 'readonly');
    const store = transaction.objectStore(STORES.syncQueue);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result.filter((item) => {
      const ownerId = item.user_id || item.data?.user_id;
      return !userId || ownerId === userId;
    }));
  });
}

/**
 * Remove item from sync queue
 */
function removeFromQueue(queueItemId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.syncQueue], 'readwrite');
    const store = transaction.objectStore(STORES.syncQueue);
    const request = store.delete(queueItemId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Update queue item (for retries)
 */
function updateQueueItem(queueItem) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.syncQueue], 'readwrite');
    const store = transaction.objectStore(STORES.syncQueue);
    const request = store.put(queueItem);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Requeue local changes whose queue entries were lost after earlier retries.
 */
async function recoverUnqueuedOfflineNotes(userId) {
  const [notes, queueItems] = await Promise.all([
    getNotesOffline(userId),
    getQueueItems(userId)
  ]);
  const queuedNoteIds = new Set(
    queueItems
      .filter((item) => item.action === 'upsert')
      .map((item) => item.noteId)
  );

  for (const note of notes) {
    if ((note.synced === false || note.offline === true) && !queuedNoteIds.has(note.id)) {
      const timestamp = new Date().toISOString();
      const queueItem = {
        action: 'upsert',
        user_id: userId,
        noteId: note.id,
        data: note,
        timestamp,
        retries: 0,
        maxRetries: 3
      };
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.syncQueue], 'readwrite');
        const request = transaction.objectStore(STORES.syncQueue).add(queueItem);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      queuedNoteIds.add(note.id);
      console.log('[Sync] Requeued unsynced local note:', note.id);
    }
  }
}

/**
 * Replace a legacy non-UUID note ID in IndexedDB and all of its queued actions.
 */
function replaceOfflineNoteId(oldId, newId, userId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.notes, STORES.syncQueue], 'readwrite');
    const notesStore = transaction.objectStore(STORES.notes);
    const queueStore = transaction.objectStore(STORES.syncQueue);
    const noteRequest = notesStore.get(oldId);

    noteRequest.onsuccess = () => {
      const note = noteRequest.result;
      if (note?.user_id === userId) {
        note.id = newId;
        notesStore.put(note);
        notesStore.delete(oldId);
      }
    };

    noteRequest.onerror = () => reject(noteRequest.error);

    const cursorRequest = queueStore.openCursor();
    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) return;

      const item = cursor.value;
      const ownerId = item.user_id || item.data?.user_id;
      const referencesNote = item.noteId === oldId || item.data?.id === oldId;
      if (ownerId === userId && referencesNote) {
        if (item.noteId === oldId) item.noteId = newId;
        if (item.data?.id === oldId) item.data.id = newId;
        cursor.update(item);
      }
      cursor.continue();
    };

    cursorRequest.onerror = () => reject(cursorRequest.error);
    transaction.oncomplete = () => {
      const appInstance = window.app;
      if (appInstance) {
        for (const note of appInstance.notes || []) {
          if (note.id === oldId) note.id = newId;
        }
        if (appInstance.activeNoteId === oldId) appInstance.activeNoteId = newId;
        document.querySelectorAll('[data-note-id]').forEach((element) => {
          if (element.getAttribute('data-note-id') === oldId) {
            element.setAttribute('data-note-id', newId);
          }
        });
      }
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Failed to replace offline note ID.'));
  });
}

// =====================================================
// 5. METADATA MANAGEMENT (With Functions to Set and Get Metadata Values, Like Last Sync Time)
// =====================================================

/**
 * Set metadata value
 */
function setMetadata(key, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.metadata], 'readwrite');
    const store = transaction.objectStore(STORES.metadata);
    const request = store.put({ key, value, timestamp: new Date().toISOString() });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get metadata value
 */
function getMetadata(key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.metadata], 'readonly');
    const store = transaction.objectStore(STORES.metadata);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result?.value);
  });
}

/**
 * Get last sync time
 */
async function getLastSyncTime() {
  const timestamp = await getMetadata('lastSyncTime');
  return timestamp ? new Date(timestamp) : null;
}

// =====================================================
// 6. HELPER FUNCTIONS (With UUID Generation and User Retrieval Using Supabase Client)
// =====================================================

/**
 * Generate UUID for offline notes
 */
function generateUUID() {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure UUID generation is not available.');
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isUUID(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Get current authenticated user
 * Uses the supabaseClient from app.js
 */
async function getCurrentUser() {
  if (typeof supabaseClient === 'undefined') {
    console.error('[Offline] ❌ supabaseClient not found - make sure offline-sync.js loads AFTER Supabase');
    return null;
  }

  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
  } catch (error) {
    console.error('[Offline] Error getting user:', error);
    return null;
  }
}

// =====================================================
// 7. INITIALIZATION (With Database Initialization and Auto-Sync on Page Load if Online)
// =====================================================

/**
 * Initialize offline support
 */
async function initializeOfflineSupport() {
  try {
    await initializeDatabase();
    console.log('[Offline] ✓ Offline support initialized');

    // Auto-sync if online
    if (isOnline()) {
      // Small delay to let app load
      setTimeout(() => {
        console.log('[Offline] Auto-syncing on page load...');
        syncWithSupabase();
      }, 2000);
    }
  } catch (error) {
    console.error('[Offline] ❌ Failed to initialize offline support:', error);
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOfflineSupport);
} else {
  initializeOfflineSupport();
}

// =====================================================
// 8. PERIODIC SYNC (EVERY 30 SECONDS) (With Check to Avoid Overlapping Syncs and Only Sync When Online)
// =====================================================

/**
 * Periodically try to sync (every 30 seconds if online)
 */
setInterval(() => {
  if (isOnline() && !isSyncing) {
    syncWithSupabase().catch(err => console.error('[Sync] ❌ Periodic sync error:', err));
  }
}, 30 * 1000);

console.log('[Offline] ✓ Module loaded - Offline-first sync enabled');