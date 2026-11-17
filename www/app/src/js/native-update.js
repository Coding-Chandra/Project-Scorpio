/**
 * Native (Capacitor) OTA update manager.
 * Same UX as cache-update.js: no auto updates, user taps -> download -> apply.
 *
 * Requires:  npm i @capgo/capacitor-updater @capacitor/app @capacitor/browser
 * capacitor.config:  plugins: { CapacitorUpdater: { autoUpdate: false } }
 *
 * Exposes the same globals cache-update.js uses, so settings UI needs no changes.
 */

const GITHUB_REPO = 'Coding-Chandra/Project-Scorpio';
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/ota`;
const MANIFEST_URL =
  `https://github.com/${GITHUB_REPO}/releases/download/ota/latest.json`;

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

// "2.5.016" vs "2.5.015" -> true. Compares numerically per segment.
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
      if (info && info.version) return info.version;          // fall back to the shell's versionName
    } catch (_) {}
  }

  if (typeof window !== 'undefined' && window.__NOTOZ_VERSION) {
    return window.__NOTOZ_VERSION;
  }

  return 'Unknown';
}

async function fetchManifest() {
  const http = getPlugins().CapacitorHttp;

  // 1. Primary Method: Query GitHub API directly for the 'ota' release
  // api.github.com sends Access-Control-Allow-Origin: * and returns 200 OK directly with NO 302 redirects!
  try {
    let apiData = null;

    if (http && typeof http.get === 'function') {
      try {
        const res = await Promise.race([
          http.get({
            url: `${API_URL}?t=${Date.now()}`,
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Project-Scorpio',
              'Cache-Control': 'no-cache'
            },
            connectTimeout: 5000,
            readTimeout: 5000
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('CapacitorHttp timeout')), 6000))
        ]);
        if (res && res.status >= 200 && res.status < 300) {
          apiData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        }
      } catch (e) {
        console.warn('[Native Update] Native HTTP API check failed:', e?.message || e);
      }
    }

    if (!apiData) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(`${API_URL}?t=${Date.now()}`, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Cache-Control': 'no-cache'
          },
          signal: controller.signal
        });
        if (res.ok) {
          apiData = await res.json();
        }
      } catch (e) {
        console.warn('[Native Update] Browser fetch API check failed:', e?.message || e);
      } finally {
        clearTimeout(timer);
      }
    }

    if (apiData) {
      // First check if release body contains valid JSON manifest
      if (apiData.body) {
        try {
          const parsed = JSON.parse(apiData.body.trim());
          if (parsed && parsed.version) {
            console.log('[Native Update] Resolved OTA manifest from release body:', parsed.version);
            return {
              version: String(parsed.version).replace(/^v/, ''),
              native: String(parsed.native || '1'),
              checksum: parsed.checksum || '',
              url: parsed.url || `https://github.com/${GITHUB_REPO}/releases/download/ota/notoz-${parsed.version}.zip`
            };
          }
        } catch (_) {}
      }

      // Check assets for newest notoz-*.zip
      if (Array.isArray(apiData.assets)) {
        const bundles = apiData.assets
          .map(a => {
            const m = (a.name || '').match(/^notoz-([0-9.]+)\.zip$/);
            return m ? { version: m[1], url: a.browser_download_url } : null;
          })
          .filter(Boolean);

        if (bundles.length > 0) {
          bundles.sort((a, b) => (isNewer(a.version, b.version) ? -1 : 1));
          const best = bundles[0];
          console.log('[Native Update] Resolved OTA manifest from assets:', best.version);
          return {
            version: best.version,
            url: best.url,
            native: '1',
            checksum: ''
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Native Update] GitHub API check encountered error:', err);
  }

  // 2. Secondary Fallback: Fetch latest.json directly (handling 301/302 redirects)
  try {
    if (http && typeof http.get === 'function') {
      let res = await Promise.race([
        http.get({
          url: `${MANIFEST_URL}?t=${Date.now()}`,
          headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
          connectTimeout: 5000,
          readTimeout: 5000
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('CapacitorHttp timeout')), 6000))
      ]);

      if (res && (res.status === 301 || res.status === 302)) {
        const loc = res.headers?.Location || res.headers?.location;
        if (loc) {
          res = await Promise.race([
            http.get({
              url: loc,
              connectTimeout: 5000,
              readTimeout: 5000
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('CapacitorHttp timeout')), 6000))
          ]);
        }
      }

      if (res && res.status >= 200 && res.status < 300) {
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        return {
          version: String(data.version).replace(/^v/, ''),
          native: String(data.native || '1'),
          checksum: data.checksum || '',
          url: data.url
        };
      }
    }
  } catch (err) {
    console.warn('[Native Update] Direct manifest fallback failed:', err);
  }

  return null;
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
    const latest = await fetchManifest();
    if (!latest || !latest.version) {
      updateAvailable = false;
      needsFullApk = false;
      pending = null;
      window.__nativeUpdate = { updateAvailable: false, needsFullApk: false, pending: null };
      if (typeof window.updateButtonUI === 'function') {
        window.updateButtonUI(false);
      }
      return false;
    }

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
    return updateAvailable;
  } catch (e) {
    console.warn('[Native Update] check failed:', e);
    return false;
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
    const downloadOpts = {
      url: pending.url,
      version: pending.version,
    };
    if (pending.checksum) {
      downloadOpts.checksum = pending.checksum;
    }
    const bundle = await updater.download(downloadOpts);
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
