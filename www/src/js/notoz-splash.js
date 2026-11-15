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

        <!-- 2. The Dot-Matrix "N" (Notoz Brand Signature) -->
        <div class="notoz-n-wrap">
          <!-- Backlight beam & radiant glow coming through behind the N -->
          <div class="notoz-backlight-burst"></div>
          <div class="notoz-backlight-core"></div>
          <div class="notoz-backlight-streak"></div>

          <svg class="notoz-n-svg notoz-dot-matrix-n" viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="notozDotGlow" cx="42%" cy="38%" r="62%">
                <stop offset="0%" stop-color="#FF525B"/>
                <stop offset="35%" stop-color="#D71921"/>
                <stop offset="80%" stop-color="#B30F17"/>
                <stop offset="100%" stop-color="#730006"/>
              </radialGradient>
              <filter id="notozMatrixGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#D71921" flood-opacity="0.6"/>
              </filter>
            </defs>

            <!-- 5x7 Dot Matrix Grid for "N" (17 Active Glowing Dots) -->
            <g class="notoz-matrix-dots" filter="url(#notozMatrixGlow)">
              <!-- Col 0: Left Vertical Stem (7 dots) -->
              <circle class="notoz-dot dot-c0-r0" cx="28" cy="25" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c0-r1" cx="28" cy="63.3" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c0-r2" cx="28" cy="101.6" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c0-r3" cx="28" cy="140" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c0-r4" cx="28" cy="178.3" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c0-r5" cx="28" cy="216.6" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c0-r6" cx="28" cy="255" r="13.5" fill="url(#notozDotGlow)"/>

              <!-- Diagonal (3 dots) -->
              <circle class="notoz-dot dot-diag-1" cx="64" cy="101.6" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-diag-2" cx="100" cy="140" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-diag-3" cx="136" cy="178.3" r="13.5" fill="url(#notozDotGlow)"/>

              <!-- Col 4: Right Vertical Stem (7 dots) -->
              <circle class="notoz-dot dot-c4-r0" cx="172" cy="25" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c4-r1" cx="172" cy="63.3" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c4-r2" cx="172" cy="101.6" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c4-r3" cx="172" cy="140" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c4-r4" cx="172" cy="178.3" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c4-r5" cx="172" cy="216.6" r="13.5" fill="url(#notozDotGlow)"/>
              <circle class="notoz-dot dot-c4-r6" cx="172" cy="255" r="13.5" fill="url(#notozDotGlow)"/>
            </g>
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
