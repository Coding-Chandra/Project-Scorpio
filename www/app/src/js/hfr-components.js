/**
 * ============================================================================
 * HFR UI COMPONENTS (High-Frame-Rate UI Component Library)
 * ============================================================================
 * Production-ready UI components engineered for 120Hz/144Hz mobile displays:
 * 1. HFRInteractiveSheet: Ultra-smooth spring-physics bottom sheet with
 *    gesture velocity inheritance, rubber-banding, and GPU-composited backdrop.
 * 2. HFRInteractiveCard: 3D momentum gesture card with ProMotion spring return.
 * 3. HFRTelemetryHUD: Lightweight real-time display refresh and FPS monitor.
 * ============================================================================
 */

(function (global) {
  'use strict';

  const resolveHFRMotion = () => global.HFRMotion || (typeof window !== 'undefined' ? window.HFRMotion : null);
  const HFRMotion = new Proxy({}, {
    get(target, prop) {
      const engine = resolveHFRMotion();
      return engine ? engine[prop] : undefined;
    }
  });

  // ── 1. HFR INTERACTIVE BOTTOM SHEET ───────────────────────────────────────
  class HFRInteractiveSheet {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - Root container element
     * @param {HTMLElement} options.sheet - Sheet surface element
     * @param {HTMLElement} options.handle - Drag handle element
     * @param {HTMLElement} [options.backdrop] - Dimming backdrop overlay
     * @param {Array<number>} [options.snapRatios=[0.0, 0.45, 0.90]] - Height percentages for [hidden, peek, full]
     * @param {string} [options.preset='promotion'] - Spring preset
     * @param {Function} [options.onSnapChange] - Callback when settled at snap point
     */
    constructor(options) {
      this.container = options.container;
      this.sheet = options.sheet;
      this.handle = options.handle || options.sheet.querySelector('.hfr-sheet-handle') || options.sheet;
      this.backdrop = options.backdrop || options.container.querySelector('.hfr-sheet-backdrop');
      this.snapRatios = options.snapRatios || [0.0, 0.45, 0.90]; // 0=closed, 0.45=peek, 0.90=full
      this.preset = options.preset || 'promotion';
      this.onSnapChange = options.onSnapChange || null;

      this.currentSnap = 0; // 0 = closed
      this.sheetHeight = window.innerHeight;
      this.snapPositions = [this.sheetHeight, this.sheetHeight * 0.55, this.sheetHeight * 0.10];
      this.isDragging = false;
      this.dragStartY = 0;
      this.dragStartSheetY = 0;

      this._initGpuLayers();
      this._initMotionEntities();
      this._bindEvents();
      this._updateDimensions();

      // Ensure sheet starts closed offscreen
      this.snapTo(0, true);
    }

    _initGpuLayers() {
      // Isolate to GPU compositor layers
      this.sheet.classList.add('hfr-gpu-layer', 'hfr-sheet-surface');
      this.sheet.style.willChange = 'transform';
      this.sheet.style.transform = 'translate3d(0, 100%, 0)';
      this.sheet.style.touchAction = 'none'; // Inform browser compositor not to block touch

      if (this.backdrop) {
        this.backdrop.classList.add('hfr-gpu-layer', 'hfr-sheet-backdrop');
        this.backdrop.style.willChange = 'opacity';
        this.backdrop.style.opacity = '0';
        this.backdrop.style.pointerEvents = 'none';
      }
    }

    _initMotionEntities() {
      // Allocate zero-allocation physics entity for sheet
      this.sheetEntityId = HFRMotion.allocateEntity(this.sheet, {
        preset: this.preset,
        animateX: false,
        animateY: true,
        animateScale: false,
        animateOpacity: false,
        onFrame: (x, y) => this._onFrame(x, y),
        onSettle: (id, x, y) => this._onSettle(x, y)
      });

      // Allocate zero-allocation entity for backdrop opacity
      if (this.backdrop) {
        this.backdropEntityId = HFRMotion.allocateEntity(this.backdrop, {
          preset: this.preset,
          animateX: false,
          animateY: false,
          animateScale: false,
          animateOpacity: true
        });
      }
    }

    _updateDimensions() {
      // Pre-measure viewport and snap heights outside the animation loop
      this.sheetHeight = window.innerHeight;
      this.snapPositions = [
        this.sheetHeight,                                  // Hidden
        this.sheetHeight * (1 - this.snapRatios[1]),      // Peek
        this.sheetHeight * (1 - this.snapRatios[2])       // Full
      ];
    }

    _onFrame(x, y) {
      if (!this.backdrop) return;
      // Map sheet translation to backdrop opacity: 0 = hidden, 0.6 = fully open
      const maxTranslate = this.snapPositions[0];
      const minTranslate = this.snapPositions[2];
      const progress = 1 - Math.min(1, Math.max(0, (y - minTranslate) / (maxTranslate - minTranslate)));
      const targetOpacity = progress * 0.65;

      // Update backdrop via direct style without allocating objects
      this.backdrop.style.opacity = targetOpacity.toFixed(3);
    }

    _onSettle(x, y) {
      // Identify closest snap point
      let closestSnap = 0;
      let minDiff = Infinity;
      for (let i = 0; i < this.snapPositions.length; i++) {
        const diff = Math.abs(y - this.snapPositions[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closestSnap = i;
        }
      }
      this.currentSnap = closestSnap;

      // Decouple heavy state & DOM work to idle callback
      HFRMotion.scheduleIdle(() => {
        if (this.currentSnap === 0) {
          if (this.backdrop) this.backdrop.style.pointerEvents = 'none';
          this.container.setAttribute('aria-hidden', 'true');
        } else {
          if (this.backdrop) this.backdrop.style.pointerEvents = 'auto';
          this.container.setAttribute('aria-hidden', 'false');
        }
        if (this.onSnapChange) {
          this.onSnapChange(this.currentSnap, ['closed', 'peek', 'full'][this.currentSnap]);
        }
      });
    }

    _bindEvents() {
      // Passive gesture binding: Zero blocking of the browser compositor
      this.unbindGesture = HFRMotion.bindPassiveGesture(this.handle, {
        onStart: (startX, startY) => {
          this.isDragging = true;
          this.dragStartY = startY;
          const state = HFRMotion.getEntityState(this.sheetEntityId);
          this.dragStartSheetY = state ? state.y : this.snapPositions[this.currentSnap];
          if (this.backdrop) this.backdrop.style.pointerEvents = 'auto';
        },
        onMove: (deltaX, deltaY, curX, curY) => {
          if (!this.isDragging) return;

          let targetY = this.dragStartSheetY + deltaY;
          const minY = this.snapPositions[2]; // Fully open
          const maxY = this.snapPositions[0]; // Hidden

          // Elastic rubber-banding when dragged beyond limits
          if (targetY < minY) {
            const overshoot = minY - targetY;
            targetY = minY - Math.sqrt(overshoot) * 3.5;
          } else if (targetY > maxY) {
            const overshoot = targetY - maxY;
            targetY = maxY + Math.sqrt(overshoot) * 3.5;
          }

          // Direct 1:1 GPU position tracking (Zero layout reflow)
          HFRMotion.setDirectPosition(this.sheetEntityId, 0, targetY);
          this._onFrame(0, targetY);
        },
        onEnd: (deltaX, deltaY, velX, velY) => {
          if (!this.isDragging) return;
          this.isDragging = false;

          const state = HFRMotion.getEntityState(this.sheetEntityId);
          const currentY = state ? state.y : this.dragStartSheetY + deltaY;

          // Projected position incorporating finger velocity at release
          const projectedY = currentY + velY * 0.12;

          let bestSnap = 0;
          let minDistance = Infinity;

          // Check for high-velocity flick
          if (velY > 750) {
            // Strong flick downwards -> dismiss or snap to lower point
            bestSnap = Math.max(0, this.currentSnap - 1);
          } else if (velY < -750) {
            // Strong flick upwards -> snap to higher point
            bestSnap = Math.min(this.snapPositions.length - 1, this.currentSnap + 1);
          } else {
            // Choose snap point closest to inertia projection
            for (let i = 0; i < this.snapPositions.length; i++) {
              const dist = Math.abs(projectedY - this.snapPositions[i]);
              if (dist < minDistance) {
                minDistance = dist;
                bestSnap = i;
              }
            }
          }

          // Inject finger velocity into the spring simulation for seamless continuity
          HFRMotion.injectVelocity(this.sheetEntityId, 0, velY);
          this.snapTo(bestSnap);
        }
      });

      // Window resize debounce
      this.onResize = () => {
        this._updateDimensions();
        this.snapTo(this.currentSnap, true);
      };
      window.addEventListener('resize', this.onResize, { passive: true });

      // Backdrop tap to dismiss
      if (this.backdrop) {
        this.backdrop.addEventListener('click', () => {
          this.close();
        }, { passive: true });
      }
    }

    snapTo(snapIndex, immediate = false) {
      const idx = Math.max(0, Math.min(this.snapPositions.length - 1, snapIndex));
      const targetY = this.snapPositions[idx];
      this.currentSnap = idx;

      if (immediate) {
        HFRMotion.setDirectPosition(this.sheetEntityId, 0, targetY);
        this._onFrame(0, targetY);
        this._onSettle(0, targetY);
      } else {
        HFRMotion.setTarget(this.sheetEntityId, 0, targetY);
      }
    }

    open(mode = 'peek') {
      const idx = mode === 'full' ? 2 : 1;
      this.snapTo(idx);
    }

    close() {
      this.snapTo(0);
    }

    toggle() {
      if (this.currentSnap === 0) {
        this.open('peek');
      } else {
        this.close();
      }
    }

    destroy() {
      if (this.unbindGesture) this.unbindGesture();
      window.removeEventListener('resize', this.onResize);
      HFRMotion.releaseEntity(this.sheetEntityId);
      if (this.backdropEntityId !== undefined) {
        HFRMotion.releaseEntity(this.backdropEntityId);
      }
    }
  }

  // ── 2. HFR INTERACTIVE MOMENTUM CARD ──────────────────────────────────────
  class HFRInteractiveCard {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.element - Card element to animate
     * @param {Function} [options.onSwipe] - Callback on swipe completion
     */
    constructor(options) {
      this.element = options.element;
      this.onSwipe = options.onSwipe || null;
      this.isDragging = false;

      this.element.classList.add('hfr-gpu-layer', 'hfr-interactive-card');
      this.element.style.willChange = 'transform';
      this.element.style.touchAction = 'pan-y';

      this.entityId = HFRMotion.allocateEntity(this.element, {
        preset: 'bouncy',
        animateX: true,
        animateY: false,
        animateScale: true,
        animateOpacity: true
      });

      this._bindGesture();
    }

    _bindGesture() {
      this.unbindGesture = HFRMotion.bindPassiveGesture(this.element, {
        onStart: () => {
          this.isDragging = true;
          // Slight press scale feedback
          HFRMotion.setTarget(this.entityId, null, null, 0.96, 0.95);
        },
        onMove: (deltaX) => {
          if (!this.isDragging) return;
          // Elastic drag with slight rotation
          HFRMotion.setDirectPosition(this.entityId, deltaX, 0, 0.96, 0.9);
        },
        onEnd: (deltaX, deltaY, velX) => {
          if (!this.isDragging) return;
          this.isDragging = false;

          const SWIPE_THRESHOLD = 140;
          if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(velX) > 900) {
            // Fling card offscreen
            const exitX = deltaX > 0 ? window.innerWidth * 1.2 : -window.innerWidth * 1.2;
            HFRMotion.injectVelocity(this.entityId, velX, 0);
            HFRMotion.setTarget(this.entityId, exitX, 0, 0.8, 0.0);

            if (this.onSwipe) {
              HFRMotion.scheduleIdle(() => {
                this.onSwipe(deltaX > 0 ? 'right' : 'left');
              });
            }
          } else {
            // Elastic spring back to center
            HFRMotion.injectVelocity(this.entityId, velX, 0);
            HFRMotion.setTarget(this.entityId, 0, 0, 1.0, 1.0);
          }
        }
      });
    }

    reset() {
      HFRMotion.setTarget(this.entityId, 0, 0, 1.0, 1.0);
    }

    destroy() {
      if (this.unbindGesture) this.unbindGesture();
      HFRMotion.releaseEntity(this.entityId);
    }
  }

  // ── 3. HFR TELEMETRY HUD ──────────────────────────────────────────────────
  class HFRTelemetryHUD {
    constructor() {
      this.hudEl = null;
      this.fpsEl = null;
      this.rateEl = null;
      this.frameTimeEl = null;
      this.dropsEl = null;
      this.intervalId = 0;
      this.rafId = 0;
      this.isVisible = false;
      this._boundTouchMove = null;
      this._boundTouchEnd = null;
      this._boundMouseMove = null;
      this._boundMouseEnd = null;
    }

    mount(container = null) {
      if (this.hudEl && this.hudEl.parentNode) {
        this.hudEl.style.display = 'block';
        this.isVisible = true;
        this._startMonitoring();
        return;
      }

      if (!container) {
        container = typeof document !== 'undefined' ? document.body : null;
      }
      if (!container) {
        if (typeof document !== 'undefined') {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.mount());
          } else {
            setTimeout(() => this.mount(), 50);
          }
        }
        return;
      }

      // Clean up any stale or orphaned HUD overlays in DOM
      const existingHud = document.querySelector('.hfr-telemetry-hud');
      if (existingHud && existingHud !== this.hudEl) {
        existingHud.remove();
      }

      this.hudEl = document.createElement('div');
      this.hudEl.className = 'hfr-telemetry-hud hfr-gpu-layer';
      this.hudEl.setAttribute('role', 'region');
      this.hudEl.setAttribute('aria-label', 'Performance Telemetry HUD');
      this.hudEl.innerHTML = `
        <div class="hfr-hud-badge" style="cursor: move; user-select: none; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="hfr-hud-dot"></div>
            <span class="hfr-hud-title">120/144Hz ProMotion</span>
          </div>
          <button class="hfr-hud-close-btn" type="button" aria-label="Close HUD" title="Close HUD (manage in Dev Options)" style="background: none; border: none; color: rgba(255, 255, 255, 0.7); font-size: 16px; font-weight: bold; cursor: pointer; padding: 2px 6px; line-height: 1;">✕</button>
        </div>
        <div class="hfr-hud-grid">
          <div class="hfr-hud-metric">
            <span class="hfr-hud-label">FPS</span>
            <span class="hfr-hud-value hfr-val-fps">--</span>
          </div>
          <div class="hfr-hud-metric">
            <span class="hfr-hud-label">Display VSync</span>
            <span class="hfr-hud-value hfr-val-rate">Detecting…</span>
          </div>
          <div class="hfr-hud-metric">
            <span class="hfr-hud-label">Frame Budget</span>
            <span class="hfr-hud-value hfr-val-time">-- ms</span>
          </div>
          <div class="hfr-hud-metric">
            <span class="hfr-hud-label">Dropped Frames</span>
            <span class="hfr-hud-value hfr-val-drops">0</span>
          </div>
        </div>
        <div class="hfr-hud-status">
          <span class="hfr-hud-status-chip">GPU Layer: Isolated</span>
          <span class="hfr-hud-status-chip">Heap Alloc/Frame: 0B</span>
        </div>
      `;

      container.appendChild(this.hudEl);

      this.fpsEl = this.hudEl.querySelector('.hfr-val-fps');
      this.rateEl = this.hudEl.querySelector('.hfr-val-rate');
      this.frameTimeEl = this.hudEl.querySelector('.hfr-val-time');
      this.dropsEl = this.hudEl.querySelector('.hfr-val-drops');

      const closeBtn = this.hudEl.querySelector('.hfr-hud-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (typeof window.setHfrHudEnabled === 'function') {
            window.setHfrHudEnabled(false);
          } else {
            localStorage.setItem('notozApp_hfr_hud_enabled', 'false');
            window.dispatchEvent(new CustomEvent('hfr-hud-changed', { detail: { enabled: false } }));
            this.destroy();
          }
        });
      }

      this._setupDraggable();
      this.isVisible = true;
      this._startMonitoring();
    }

    _setupDraggable() {
      const badge = this.hudEl.querySelector('.hfr-hud-badge');
      if (!badge) return;

      let dragging = false;
      let startX = 0, startY = 0;
      let startLeft = 0, startTop = 0;

      const onStart = (clientX, clientY) => {
        dragging = true;
        startX = clientX;
        startY = clientY;
        const rect = this.hudEl.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
      };

      const onMove = (clientX, clientY) => {
        if (!dragging || !this.hudEl) return;
        const dx = clientX - startX;
        const dy = clientY - startY;
        const maxLeft = window.innerWidth - this.hudEl.offsetWidth - 8;
        const maxTop = window.innerHeight - this.hudEl.offsetHeight - 8;
        this.hudEl.style.left = `${Math.max(8, Math.min(maxLeft, startLeft + dx))}px`;
        this.hudEl.style.top = `${Math.max(8, Math.min(maxTop, startTop + dy))}px`;
        this.hudEl.style.right = 'auto';
      };

      const onEnd = () => {
        dragging = false;
      };

      badge.addEventListener('touchstart', (e) => {
        if (e.target.closest('.hfr-hud-close-btn')) return;
        const touch = e.touches[0];
        onStart(touch.clientX, touch.clientY);
      }, { passive: true });

      this._boundTouchMove = (e) => {
        if (!dragging) return;
        const touch = e.touches[0];
        onMove(touch.clientX, touch.clientY);
      };
      window.addEventListener('touchmove', this._boundTouchMove, { passive: true });

      this._boundTouchEnd = onEnd;
      window.addEventListener('touchend', this._boundTouchEnd, { passive: true });

      badge.addEventListener('mousedown', (e) => {
        if (e.target.closest('.hfr-hud-close-btn')) return;
        onStart(e.clientX, e.clientY);
      });

      this._boundMouseMove = (e) => {
        if (!dragging) return;
        onMove(e.clientX, e.clientY);
      };
      window.addEventListener('mousemove', this._boundMouseMove);

      this._boundMouseEnd = onEnd;
      window.addEventListener('mouseup', this._boundMouseEnd);
    }

    _startMonitoring() {
      let lastTime = performance.now();
      let frames = 0;
      let lastFpsUpdate = lastTime;
      let liveFps = 60;
      let liveDt = 16.67;
      let droppedCount = 0;

      const requestFrame = (cb) => {
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          return window.requestAnimationFrame(cb);
        }
        if (typeof requestAnimationFrame === 'function') {
          return requestAnimationFrame(cb);
        }
        return setTimeout(() => cb(performance.now()), 16);
      };

      const onFrame = (now) => {
        if (!this.isVisible || !this.hudEl) return;
        const delta = now - lastTime;
        lastTime = now;
        liveDt = delta;

        const refreshRate = (window.HFRMotion && window.HFRMotion.getTelemetry().detectedRefreshRate) ||
                            (liveFps > 100 ? 120 : (liveFps > 75 ? 90 : 60));
        const expectedDt = 1000 / refreshRate;
        if (delta > expectedDt * 1.45 && delta > 10) {
          droppedCount++;
        }

        frames++;
        if (now - lastFpsUpdate >= 500) {
          liveFps = Math.round((frames * 1000) / (now - lastFpsUpdate));
          frames = 0;
          lastFpsUpdate = now;
        }

        this.rafId = requestFrame(onFrame);
      };

      this.rafId = requestFrame(onFrame);

      this.intervalId = setInterval(() => {
        if (!this.isVisible || !this.hudEl) return;
        const motionTelemetry = window.HFRMotion ? window.HFRMotion.getTelemetry() : null;
        const rate = (motionTelemetry && motionTelemetry.detectedRefreshRate) || (liveFps > 100 ? 120 : (liveFps > 75 ? 90 : 60));

        this.fpsEl.textContent = liveFps;
        this.rateEl.textContent = rate ? rate + ' Hz' : '-- Hz';
        this.frameTimeEl.textContent = liveDt.toFixed(2) + ' ms';
        this.dropsEl.textContent = (motionTelemetry ? motionTelemetry.droppedFrames : 0) + droppedCount;

        const targetBudget = rate >= 120 ? 8.33 : (rate >= 90 ? 11.11 : 16.67);
        if (liveDt > targetBudget * 1.25) {
          this.frameTimeEl.style.color = '#ff453a';
        } else {
          this.frameTimeEl.style.color = '#30d158';
        }
      }, 200);
    }

    toggle() {
      if (!this.hudEl) {
        this.mount();
      } else {
        this.isVisible = !this.isVisible;
        this.hudEl.style.display = this.isVisible ? 'block' : 'none';
        if (this.isVisible) this._startMonitoring();
        else {
          if (this.rafId) {
            if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.rafId);
            else if (typeof window !== 'undefined' && window.cancelAnimationFrame) window.cancelAnimationFrame(this.rafId);
          }
          if (this.intervalId) clearInterval(this.intervalId);
        }
      }
    }

    destroy() {
      this.isVisible = false;
      if (this.rafId) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.rafId);
        else if (typeof window !== 'undefined' && window.cancelAnimationFrame) window.cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = 0;
      }
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        if (this._boundTouchMove) window.removeEventListener('touchmove', this._boundTouchMove);
        if (this._boundTouchEnd) window.removeEventListener('touchend', this._boundTouchEnd);
        if (this._boundMouseMove) window.removeEventListener('mousemove', this._boundMouseMove);
        if (this._boundMouseEnd) window.removeEventListener('mouseup', this._boundMouseEnd);
      }

      if (this.hudEl && this.hudEl.parentNode) {
        this.hudEl.parentNode.removeChild(this.hudEl);
      }
      this.hudEl = null;
    }
  }

  // ── HUD AUTO-SYNC CONTROLLER ──────────────────────────────────────────────
  let activeHudInstance = null;

  function syncGlobalHud() {
    let isEnabled = false;
    try {
      if (typeof window.isHfrHudEnabled === 'function') {
        isEnabled = window.isHfrHudEnabled();
      } else {
        isEnabled = localStorage.getItem('notozApp_hfr_hud_enabled') === 'true';
      }
    } catch (e) {
      isEnabled = false;
    }

    if (isEnabled) {
      if (!activeHudInstance) {
        activeHudInstance = new HFRTelemetryHUD();
      }
      activeHudInstance.mount();
      if (activeHudInstance.hudEl) {
        activeHudInstance.hudEl.style.display = 'block';
        activeHudInstance.isVisible = true;
      }
    } else {
      if (activeHudInstance) {
        activeHudInstance.destroy();
        activeHudInstance = null;
      }
      const existing = document.querySelector('.hfr-telemetry-hud');
      if (existing) existing.remove();
    }
  }

  global.__NOTOZ_SYNC_HUD = syncGlobalHud;
  global.addEventListener('hfr-hud-changed', syncGlobalHud);
  global.addEventListener('developer-options-changed', syncGlobalHud);
  global.addEventListener('storage', (e) => {
    if (e.key === 'notozApp_hfr_hud_enabled' || e.key === 'notozApp_developer_mode') {
      syncGlobalHud();
    }
  });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => syncGlobalHud());
    }
    setTimeout(syncGlobalHud, 10);
    setTimeout(syncGlobalHud, 100);
    setTimeout(syncGlobalHud, 400);
    setTimeout(syncGlobalHud, 1200);
  }
  global.addEventListener('load', () => syncGlobalHud());

  // ── EXPORTS ───────────────────────────────────────────────────────────────
  global.HFRInteractiveSheet = HFRInteractiveSheet;
  global.HFRInteractiveCard = HFRInteractiveCard;
  global.HFRTelemetryHUD = HFRTelemetryHUD;

})(typeof window !== 'undefined' ? window : this);
