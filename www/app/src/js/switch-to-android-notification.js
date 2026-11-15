/**
 * switch-to-android-notification.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Smart banner promoting the official Notoz Android app to Web / PWA visitors.
 * 
 * ⚠️ IMPORTANT:
 * This script is strictly gated to WEB and PWA environments.
 * It will NEVER run or display inside the native Capacitor Android app.
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ── 1. NATIVE CAPACITOR GATE ──────────────────────────────────────────────
  // If running inside Capacitor Android, exit immediately and permanently.
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
    return;
  }

  // Also do not run on the download page itself
  if (location.pathname.includes('android.html')) {
    return;
  }

  const NOTIF_ID = 'switch-to-android-notif';
  const DISMISS_KEY = 'notoz_android_notif_dismissed';

  function isMobileAndroid() {
    return /android/i.test(navigator.userAgent || '');
  }

  function resolveAndroidPageUrl() {
    // If running in /app/index.html or /app/settings.html:
    if (location.pathname.includes('/app/')) {
      return './src/pages/android.html';
    }
    // If running from repo root or live server root:
    return './app/src/pages/android.html';
  }

  function shouldShow() {
    // Check if dismissed in the last 24 hours
    const lastDismissed = localStorage.getItem(DISMISS_KEY);
    if (lastDismissed) {
      const hoursSince = (Date.now() - Number(lastDismissed)) / (1000 * 60 * 60);
      if (hoursSince < 24) return false;
    }
    return true;
  }

  function buildNotif() {
    const isMobile = isMobileAndroid();
    const title = isMobile ? 'Switch to Notoz Android' : 'Notoz for Android';
    const message = isMobile
      ? 'Get 120Hz speed, biometric folder locks, and full offline sync.'
      : 'Official native app with biometric security and AMOLED optimization.';
    const actionLabel = isMobile ? 'Get APK' : 'Download';

    const notif = document.createElement('div');
    notif.id = NOTIF_ID;
    notif.setAttribute('role', 'status');
    notif.setAttribute('aria-live', 'polite');

    notif.innerHTML = `
      <div class="stan-icon-wrap" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9997.9993-.9997c.551 0 .9992.4486.9992.9997s-.4482.9997-.9992.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9997.9993-.9997c.5511 0 .9993.4486.9993.9997s-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1523-.5676.416.416 0 00-.5676.1524l-2.0223 3.503C15.5902 8.4116 13.8533 8.125 12 8.125c-1.8533 0-3.5902.2866-5.1366.825L4.8411 5.447a.416.416 0 00-.5676-.1524.416.416 0 00-.1523.5676l1.9973 3.4592C2.6889 10.9867 0 14.8091 0 19.3409h24c0-4.5318-2.6889-8.3542-6.1185-10.0195"/>
        </svg>
      </div>
      <div class="stan-content">
        <div class="stan-title">
          <span>${title}</span>
          <span class="stan-badge">APK</span>
        </div>
        <div class="stan-msg">${message}</div>
      </div>
      <div class="stan-actions">
        <button class="stan-btn-action" id="switchToAndroidActionBtn" type="button">${actionLabel}</button>
        <button class="stan-btn-close" id="switchToAndroidCloseBtn" type="button" aria-label="Dismiss">&times;</button>
      </div>
    `;

    return notif;
  }

  function dismiss(notif) {
    if (!notif) return;
    notif.classList.remove('show');
    notif.classList.add('hide');
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setTimeout(() => {
      try { notif.remove(); } catch (_) {}
    }, 450);
  }

  function show() {
    const existing = document.getElementById(NOTIF_ID);
    if (existing) return;

    const notif = buildNotif();
    document.body.appendChild(notif);

    // Slide up smoothly after a subtle delay
    setTimeout(() => {
      requestAnimationFrame(() => {
        notif.classList.add('show');
      });
    }, 1200);

    // Action button opens download page
    const actionBtn = notif.querySelector('#switchToAndroidActionBtn');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        dismiss(notif);
        window.location.href = resolveAndroidPageUrl();
      });
    }

    // Close button dismisses
    const closeBtn = notif.querySelector('#switchToAndroidCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismiss(notif);
      });
    }

    // Auto-dismiss after 12 seconds if unclicked
    setTimeout(() => {
      if (document.getElementById(NOTIF_ID)) {
        dismiss(notif);
      }
    }, 13200);
  }

  function init() {
    if (!shouldShow()) return;
    show();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
