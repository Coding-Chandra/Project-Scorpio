/**
 * Notoz App Version Definition
 * Version: 2.5.017
 */
const VERSION = '2.5.017';

if (typeof window !== 'undefined') {
  window.__NOTOZ_VERSION = VERSION;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VERSION };
}
