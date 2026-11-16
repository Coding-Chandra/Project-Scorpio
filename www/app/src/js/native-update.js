/**
 * Native (Capacitor) OTA update manager.
 * Same UX as cache-update.js: no auto updates, user taps -> download -> apply.
 *
 * Requires:  npm i @capgo/capacitor-updater @capacitor/app @capacitor/browser
 * capacitor.config:  plugins: { CapacitorUpdater: { autoUpdate: false } }
 *
 * Exposes the same globals cache-update.js uses, so settings UI needs no changes.
 */

const MANIFEST_URL =
  'https://github.com/Coding-Chandra/Project-Scorpio/releases/download/ota/latest.json';

let pending = null;            // { version, url, native, apkUrl }
let needsFullApk = false;
let updateAvailable = false;

function getCapacitor() {
  if (typeof window !== 'undefined' && window.Capacitor) {
    return window.Capacitor;
  }
  return null;
}

function getPlugins() {
  const cap = getCapacitor();
  return cap?.Plugins || {};
}

const isNative = () => {
  const cap = getCapacitor();
  return typeof cap !== 'undefined' && cap !== null && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
};

// "2.5.012" vs "2.5.011" -> true. Compares numerically per segment.
function isNewer(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

async function installedWebVersion() {
  const updater = getPlugins().CapacitorUpdater;
  const app = getPlugins().App;

  if (updater && typeof updater.current === 'function') {
    try {
      const { bundle } = await updater.current();
      // 'builtin' = the web files shipped inside the APK
      if (bundle && bundle.version && bundle.version !== 'builtin') return bundle.version;
    } catch (_) {}
  }

  if (app && typeof app.getInfo === 'function') {
    try {
      const info = await app.getInfo();
      return info.version;          // fall back to the shell's versionName
    } catch (_) {}
  }

  return 'Unknown';
}

export async function initNativeUpdater() {
  if (!isNative()) return false;

  const updater = getPlugins().CapacitorUpdater;

  // MUST run on every launch, otherwise the plugin rolls back to the last good bundle
  if (updater && typeof updater.notifyAppReady === 'function') {
    try {
      await updater.notifyAppReady();
    } catch (e) {
      console.warn('[Native Update] notifyAppReady error:', e);
    }
  }

  const v = await installedWebVersion();
  const el = document.getElementById('buildNumberDisplay');
  if (el) el.textContent = `Build: ${v}`;

  setTimeout(checkNativeUpdate, 1500);
  return true;
}

export async function checkNativeUpdate() {
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      console.log('[Native Update] Manifest returned status', res.status);
      return;
    }
    const latest = await res.json();

    const app = getPlugins().App;
    let shell = '0.0.0';
    if (app && typeof app.getInfo === 'function') {
      try {
        shell = (await app.getInfo()).version;
      } catch (_) {}
    }
    const web = await installedWebVersion();

    // shell too old for this web bundle -> OTA would break, needs a full APK
    needsFullApk = !!(latest.native && isNewer(latest.native, shell));
    updateAvailable = needsFullApk || isNewer(latest.version, web);
    pending = latest;

    window.__nativeUpdate = { updateAvailable, needsFullApk, pending };
    if (typeof window.updateButtonUI === 'function') {
      window.updateButtonUI(updateAvailable);
    }
  } catch (e) {
    console.warn('[Native Update] check failed', e);
  }
}

export async function performNativeUpdate(onProgress) {
  if (!pending) throw new Error('No update pending');

  if (needsFullApk) {
    // native change: send them to the APK release page
    const browser = getPlugins().Browser;
    const targetUrl = pending.apkUrl || 'https://github.com/Coding-Chandra/Project-Scorpio/releases/latest';
    if (browser && typeof browser.open === 'function') {
      await browser.open({ url: targetUrl });
    } else {
      window.open(targetUrl, '_blank');
    }
    return;
  }

  const updater = getPlugins().CapacitorUpdater;
  if (!updater || typeof updater.download !== 'function') {
    throw new Error('CapacitorUpdater plugin not available');
  }

  let listener = null;
  if (typeof updater.addListener === 'function') {
    listener = await updater.addListener('download', e => {
      onProgress?.(e.percent);     // 0-100
    });
  }

  try {
    const bundle = await updater.download({
      url: pending.url,
      version: pending.version,
    });
    onProgress?.(100);
    await updater.set(bundle);   // swaps bundle + reloads the WebView
  } finally {
    if (listener && typeof listener.remove === 'function') {
      listener.remove();
    }
  }
}

export { isNative };

// Expose globals for non-module callers and debugging
if (typeof window !== 'undefined') {
  window.initNativeUpdater = initNativeUpdater;
  window.checkNativeUpdate = checkNativeUpdate;
  window.performNativeUpdate = performNativeUpdate;
  window.isNativePlatform = isNative;
}
