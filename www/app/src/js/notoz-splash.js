/**
 * ============================================================================
 * NOTOZ – Unique Notes Splash Engine (Logo -> 3D "N" -> "NOTOZ" + Shimmer)
 * ============================================================================
 * Features:
 *  1. Notepad logo card emergence with animated ruled ink lines.
 *  2. Cinematic morph into the bold 3D folded red ribbon "N".
 *  3. "NOTOZ" wordmark reveal with premium tracked typography.
 *  4. Liquid-light lens flare & specular shimmer sweep across the emblem.
 *  5. Bespoke 3-stage soundscape via Web Audio API (Pen tick + Deep bass + Crystalline chime).
 *  6. Dual-impact Android native haptics synchronized to key frames.
 *  7. Instant tap-to-skip & clean DOM lifecycle.
 * ============================================================================
 */

(function () {
  'use strict';

  // Platform Gate: ONLY show on native Android (unless forced via ?splash or window.__FORCE_SPLASH)
  const isNative = typeof window.Capacitor !== 'undefined' && 
                   typeof window.Capacitor.isNativePlatform === 'function' && 
                   window.Capacitor.isNativePlatform();
  const isForced = new URLSearchParams(window.location.search).has('splash') || window.__FORCE_SPLASH;

  // On Web: bypass splash screen completely
  if (!isNative && !isForced) {
    const existing = document.getElementById('notoz-splash');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    return;
  }

  // Smart Session Guard: Cold-start only on Android, unless explicitly forced
  if (sessionStorage.getItem('notoz_splash_shown') === '1' && !isForced) {
    if (window.Capacitor?.Plugins?.SplashScreen) {
      window.Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 150 }).catch(() => {});
    }
    const existing = document.getElementById('notoz-splash');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    return;
  }

  // Inject or bind splash DOM
  function ensureSplashDOM() {
    let splash = document.getElementById('notoz-splash');
    if (splash) return splash;

    splash = document.createElement('div');
    splash.id = 'notoz-splash';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-label', 'Notoz Launch Screen');

    splash.innerHTML = `
      <div class="notoz-ambient-glow"></div>
      <canvas id="notoz-spark-canvas"></canvas>

      <div class="notoz-stage">
        <!-- 1. The Notepad Logo Card (Sketches ink lines, then morphs) -->
        <div class="notoz-card">
          <div class="notoz-card-header">
            <span class="notoz-card-badge">Notoz</span>
            <div class="notoz-card-dots">
              <div class="notoz-card-dot"></div>
              <div class="notoz-card-dot"></div>
              <div class="notoz-card-dot"></div>
            </div>
          </div>
          <div class="notoz-card-lines">
            <div class="notoz-card-line"></div>
            <div class="notoz-card-line"></div>
            <div class="notoz-card-line"></div>
          </div>
        </div>

        <!-- 2. The 3D Folded Ribbon "N" -->
        <div class="notoz-n-wrap">
          <!-- Backlight beam & radiant glow coming through behind the N -->
          <div class="notoz-backlight-burst"></div>
          <div class="notoz-backlight-core"></div>
          <div class="notoz-backlight-streak"></div>

          <svg class="notoz-n-svg" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="notozNLeft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#D71921"/>
                <stop offset="100%" stop-color="#A01018"/>
              </linearGradient>
              <linearGradient id="notozNRight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#D71921"/>
                <stop offset="100%" stop-color="#A01018"/>
              </linearGradient>
              <linearGradient id="notozNDiag" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#FF2A34"/>
                <stop offset="40%" stop-color="#D71921"/>
                <stop offset="100%" stop-color="#8A0010"/>
              </linearGradient>
              <filter id="notozNShadow" x="-25%" y="-25%" width="155%" height="155%">
                <feDropShadow dx="-5" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.88"/>
              </filter>
            </defs>

            <!-- Left vertical ribbon with subtle arc bottom -->
            <path d="M42,50 L74,50 L74,250 C62,251 52,251.5 42,252 Z" fill="url(#notozNLeft)"/>

            <!-- Right vertical ribbon with subtle arc bottom -->
            <path d="M126,50 L158,50 L158,252 C148,251.5 138,251 126,250 Z" fill="url(#notozNRight)"/>

            <!-- Diagonal folded ribbon with 3D drop shadow -->
            <path d="M42,50 L74,50 L158,252 C146,251.5 136,250.5 126,249 L42,50 Z" fill="url(#notozNDiag)" filter="url(#notozNShadow)"/>
          </svg>
        </div>

        <!-- 3. The "NOTOZ" Wordmark & Subtitle -->
        <div class="notoz-wordmark-wrap">
          <span class="notoz-wordmark-title">NOTOZ</span>
          <span class="notoz-wordmark-sub">Notes &bull; Thoughts &bull; Focus</span>
        </div>
      </div>

      <div class="notoz-skip-hint">Tap to continue</div>
    `;

    document.body.appendChild(splash);
    return splash;
  }

  // ── 1. BESPOKE AUDIO SOUNDSCAPE ───────────────────────────────────────────
  function playNotozSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // ── Step 1: Tactile Ink/Pen Contact Tick (t = 0.05s) ──
      const tickTime = now + 0.05;
      const oscTick = ctx.createOscillator();
      const gainTick = ctx.createGain();
      oscTick.type = 'triangle';
      oscTick.frequency.setValueAtTime(460, tickTime);
      oscTick.frequency.exponentialRampToValueAtTime(110, tickTime + 0.06);
      gainTick.gain.setValueAtTime(0.42, tickTime);
      gainTick.gain.exponentialRampToValueAtTime(0.001, tickTime + 0.07);
      oscTick.connect(gainTick);
      gainTick.connect(ctx.destination);
      oscTick.start(tickTime);
      oscTick.stop(tickTime + 0.07);

      // Light haptic tap on pen contact
      setTimeout(() => {
        if (window.__NOTOZ_HAPTICS?.impact) {
          window.__NOTOZ_HAPTICS.impact('LIGHT');
        }
      }, 50);

      // ── Step 2: Warm Cinematic Sub-Bass Swell (t = 0.85s, "N" forms) ──
      const bassTime = now + 0.85;
      const oscBass = ctx.createOscillator();
      const gainBass = ctx.createGain();
      oscBass.type = 'sine';
      oscBass.frequency.setValueAtTime(65, bassTime);
      oscBass.frequency.exponentialRampToValueAtTime(36, bassTime + 1.25);
      gainBass.gain.setValueAtTime(0.72, bassTime);
      gainBass.gain.exponentialRampToValueAtTime(0.0001, bassTime + 1.4);
      oscBass.connect(gainBass);
      gainBass.connect(ctx.destination);
      oscBass.start(bassTime);
      oscBass.stop(bassTime + 1.4);

      // ── Step 3: Crystalline Shimmer Sparkle Chime (t = 1.38s, Shimmer passes "NOTOZ") ──
      const chimeTime = now + 1.38;
      const chimeFreqs = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6 harmonic
      chimeFreqs.forEach((freq, idx) => {
        const noteTime = chimeTime + idx * 0.075;
        const oscChime = ctx.createOscillator();
        const gainChime = ctx.createGain();
        oscChime.type = 'sine';
        oscChime.frequency.setValueAtTime(freq, noteTime);
        gainChime.gain.setValueAtTime(0.12, noteTime);
        gainChime.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.65);
        oscChime.connect(gainChime);
        gainChime.connect(ctx.destination);
        oscChime.start(noteTime);
        oscChime.stop(noteTime + 0.65);
      });

      // Medium haptic pulse on shimmer sweep
      setTimeout(() => {
        if (window.__NOTOZ_HAPTICS?.impact) {
          window.__NOTOZ_HAPTICS.impact('MEDIUM');
        }
      }, 1380);

    } catch (e) {
      // Audio autoplay policy or unavailable context; gracefully ignored
    }
  }

  // ── 2. SUBTLE GOLDEN/CRIMSON SPARK PARTICLES ──────────────────────────────
  let sparkAnimId = null;

  function initSparks(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const particles = [];
    const count = 32;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: w / 2 + (Math.random() - 0.5) * 180,
        y: h / 2 + (Math.random() - 0.5) * 90 + 20,
        vx: (Math.random() - 0.5) * 2.8,
        vy: -(Math.random() * 2.4 + 0.6),
        size: Math.random() * 2.4 + 0.8,
        alpha: Math.random() * 0.85 + 0.15,
        color: Math.random() > 0.4 ? '#FFFFFF' : '#D71921'
      });
    }

    let startTime = null;

    function render(time) {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha *= 0.965;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fill();
      }

      if (elapsed < 1150) {
        sparkAnimId = requestAnimationFrame(render);
      }
    }

    const timer = setTimeout(() => {
      sparkAnimId = requestAnimationFrame(render);
    }, 1350);

    return () => {
      clearTimeout(timer);
      if (sparkAnimId) cancelAnimationFrame(sparkAnimId);
      window.removeEventListener('resize', onResize);
    };
  }

  // ── 3. MAIN CONTROLLER ────────────────────────────────────────────────────
  function startSplash() {
    console.log('[NotozSplash] Launching animated Android splash sequence…');
    const splash = ensureSplashDOM();
    const canvas = document.getElementById('notoz-spark-canvas');
    const stopSparks = initSparks(canvas);

    // Audio & Haptics
    playNotozSound();

    // Auto-hide native Capacitor splash right away to reveal web splash
    if (window.Capacitor?.Plugins?.SplashScreen) {
      window.Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
    }

    let dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;

      console.log('[NotozSplash] Splash sequence completed.');
      sessionStorage.setItem('notoz_splash_shown', '1');
      splash.classList.add('notoz-fade-out');

      if (stopSparks) stopSparks();

      setTimeout(() => {
        if (splash.parentNode) {
          splash.parentNode.removeChild(splash);
        }
        window.dispatchEvent(new CustomEvent('notoz-splash-complete'));
      }, 450);
    }

    // Auto-dismiss at 2.5s
    const autoTimer = setTimeout(dismiss, 2500);

    // Fast skip on click or touch
    splash.addEventListener('click', () => {
      clearTimeout(autoTimer);
      dismiss();
    });

    splash.addEventListener('touchstart', () => {
      clearTimeout(autoTimer);
      dismiss();
    }, { passive: true });
  }

  // Global manual replay function
  window.playNotozSplash = function () {
    sessionStorage.removeItem('notoz_splash_shown');
    window.__FORCE_SPLASH = true;
    startSplash();
  };

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSplash);
  } else {
    startSplash();
  }

})();
