// src/scenes/game-scene.ts
import { Container, Sprite, Texture, NineSliceSprite, Ticker, Graphics } from 'pixi.js';

import { App } from '@/core/app';
import { GRID_COLS, GRID_ROWS, CELL, ENABLE_HAMMER_BASE, PIG_TRIGGER_COUNT } from '@/game/config';
import { HUD } from '@/scenes/hud';
import { spin } from '@/net/client';

import { InfoModal } from '@/ui/components/InfoModal';
import { InfoButton } from '@/ui/components/InfoButton';

import { getState, setSpinning, debitStake, setWin, setBalance } from '@/state/store';

import { Reels } from '@/game/reels/display-reels';
import { evaluateWays } from '@/game/eval/ways';
import { animateHammerAction, pinkBurstAtCell, showValueTokenAtCell } from '@/game/feature/hammer/hammer-anim';
import { findPigCells, findHammerCells, neighborsOf } from '@/game/feature/helpers';
import { PigFeatureController } from '@/game/feature/controller';
import { WinToast } from '@/ui/layouts/WinToast';

import { SFX } from '@/audio/sound-manager';
import { AudioToggle } from '@/ui/components/audio-toggle';
import { FeatureIntroModal } from '@/ui/components/FeatureIntro';
// NEW: completed modal
import { FeatureCompleteModal } from '@/ui/components/FeatureComplete';

// ──────────────────────────────────────────────────────────────────────────────
// DEV: URL flag to force Lock&Win (add ?forceLW to the URL)
const DEV_FORCE_LW = new URLSearchParams(location.search).has('forceLW');
// ──────────────────────────────────────────────────────────────────────────────

const AUTO_STOP_MS = 1100;
const HIGHLIGHT_MS = 900;

export class gameScene extends Container {
  private bg!: Sprite;
  private panel!: NineSliceSprite;
  private grid = new Container();

  // Clips reels + FX to the panel’s inner window
  private gridMask = new Graphics();

  private _bgStarted = false;
  private audioToggle!: AudioToggle;

  private hud = new HUD();
  private reels = new Reels();
  private winToast = new WinToast();

  private infoModal = new InfoModal();
  private infoBtn = new InfoButton();

  private fxFlash?: Graphics;
  private fxRafFlash?: number;
  private fxRafShake?: number;

  private autoStopTimer: number | undefined;
  private pendingSpin?: Promise<{ grid: string[]; win?: number }>;

  // DEV: press L to force Lock&Win on next settle
  private _forceLWOnce = false;
  // DEV: press H to force a single hammer smash on next settle (base game)
  private _forceHammerOnce = false;

  private handleKeyDown = (e: KeyboardEvent) => {
    // Space/Enter are now handled by SpinButton.attachKeyboard()
    if (e.code === 'KeyL') {
      e.preventDefault();
      this._forceLWOnce = true;
      console.log('[DEV] Lock&Win will trigger on next settle');
      if (!this.reels.isRolling) this.startSpin();
      return;
    }
    if (e.code === 'KeyH') {
      e.preventDefault();
      this._forceHammerOnce = true;
      console.log('[DEV] Hammer test will trigger on next settle');
      if (!this.reels.isRolling) this.startSpin();
      return;
    }
  };

  async init() {
    this.sortableChildren = true;

    // Background
    this.bg = Sprite.from('bg');
    this.bg.anchor.set(0.5);
    this.addChild(this.bg);

    // Panel frame
    this.panel = new NineSliceSprite({
      texture: Texture.from('panel'),
      leftWidth: 60,
      topHeight: 60,
      rightWidth: 60,
      bottomHeight: 60,
    });
    this.panel.alpha = 0.85;
    this.panel.anchor.set(0.5);
    this.addChild(this.panel);

    // Reels inside grid container (we will sort children here)
    this.grid.sortableChildren = true;      // allow zIndex inside grid
    this.grid.addChild(this.reels.view);
    this.reels.view.zIndex = 0;             // reels at the bottom
    this.addChild(this.grid);

    // Mask that matches the panel’s inner window (drawn in layout())
    this.addChild(this.gridMask);
    this.grid.mask = this.gridMask;

    // HUD
    this.addChild(this.hud);
    try {
      // @ts-ignore optional fun bounce
      this.hud.title?.startBounceLoop?.({ speed: 0.7, ampY: 6, ampScale: 0.045 });
    } catch {}

    // Spin button wiring (uses Spin/Stop/Disabled modes)
    this.hud.spin.attachKeyboard();
    this.hud.spin.onSpin = async () => {
      await SFX.ready;
      if (!this._bgStarted) {
        SFX.play('bg_music');
        this._bgStarted = true;
      }
      SFX.play('ui_click');
      if (!this.reels.isRolling) this.startSpin();
    };
    this.hud.spin.onStop = () => {
      // User pressed STOP while spinning: disable button and stagger stop
      this.hud.spin.setMode('disabled');
      this.disarmAutoStop();
      this.reels.requestStaggerStop(false);
      this.awaitAndSettle();
    };

    // Audio toggle + Info UI
    this.audioToggle = new AudioToggle();
    this.audioToggle.zIndex = 998;
    this.addChild(this.audioToggle);

    this.addChild(this.winToast);

    this.addChild(this.infoModal);
    this.addChild(this.infoBtn);
    this.infoBtn.zIndex = 999;
    this.infoBtn.on('pointertap', () => {
      this.infoModal.open();
      this.infoModal.layout(App.pixi.renderer.screen.width, App.pixi.renderer.screen.height);
    });

    // Full-scene flash overlay
    this.fxFlash = new Graphics();
    this.fxFlash.zIndex = 1500;
    this.fxFlash.visible = false;
    this.addChild(this.fxFlash);

    // Start BGM on first pointer
    const startBgOnce = async () => {
      await SFX.ready;
      if (!this._bgStarted) {
        SFX.play('bg_music');
        this._bgStarted = true;
      }
    };
    window.addEventListener('pointerdown', startBgOnce, { once: true });

    // Ticker + input
    App.pixi.ticker.add(this.onTick, this);
    window.addEventListener('keydown', this.handleKeyDown);
    addEventListener('resize', () => this.layout());

    this.layout();
  }

  private onTick = (t: Ticker) => {
    this.reels.update(t.deltaMS);
  };

  private layout() {
    const W = App.pixi.renderer.screen.width;
    const H = App.pixi.renderer.screen.height;

    // Background scale/pos (cover)
    const bw = this.bg.texture.width;
    const bh = this.bg.texture.height;
    const s = Math.max(W / bw, H / bh);
    this.bg.scale.set(s);
    this.bg.position.set(W / 2, H / 2);

    // Reels placement & panel sizing
    const gridW = GRID_COLS * CELL;
    const gridH = GRID_ROWS * CELL;
    const target = Math.min(W, H) * 0.8;
    const k = Math.min(target / gridW, target / gridH);

    this.grid.scale.set(k);
    this.grid.position.set((W - gridW * k) / 2, H * 0.45 - (gridH * k) / 2);

    this.panel.width = gridW * k + 60;
    this.panel.height = gridH * k + 60;
    this.panel.position.set(W / 2, H * 0.45);

    // HUD reel rect
    this.hud.setReelsRect({
      x: this.grid.x,
      y: this.grid.y,
      width: gridW * k,
      height: gridH * k,
    });
    this.hud.layout(W, H);

    // Info & audio positions
    const r = 18, PAD = 16;
    this.infoBtn.position.set(W - PAD - r, PAD + r);

    const gap = 12;
    if (this.audioToggle) {
      this.audioToggle.x = this.infoBtn.x - this.infoBtn.width - gap - this.audioToggle.width;
      this.audioToggle.y = PAD;
    }

    // Flash overlay reset
    if (this.fxFlash) {
      this.fxFlash.clear().rect(0, 0, W, H).fill({ color: 0xFFFFFF, alpha: 0 });
      this.fxFlash.visible = false;
    }

    // Info modal layout
    this.infoModal.layout(W, H);

    // Mask that clips reels + FX to the exact inner panel region
    const RADIUS = 18;
    this.gridMask.clear()
      .roundRect(this.grid.x, this.grid.y, gridW * k, gridH * k, RADIUS)
      .fill(0xffffff);
  }

  /** Start a base spin and reflect UI state on the Spin button. */
  private startSpin() {
    const s = getState();
    if (s.isSpinning || s.balance < s.stake) return;

    setSpinning(true);
    setWin(0);
    debitStake();

    // Switch button to STOP mode while spinning
    this.hud.spin.setMode('stop');

    this.reels.start();

    this.pendingSpin = spin(getState().stake).catch((e) => {
      console.error('spin() failed:', e);
      return { grid: this.reels.getVisibleGrid(), win: 0 };
    });

    this.armAutoStop();
  }

  /** Auto stop after timeout: go disabled during stopping, then settle. */
  private armAutoStop() {
    this.disarmAutoStop();
    this.autoStopTimer = window.setTimeout(() => {
      // User didn't press STOP: trigger staggered stop and disable button during stop
      this.hud.spin.setMode('disabled');
      this.reels.requestStaggerStop(false);
      this.awaitAndSettle();
    }, AUTO_STOP_MS);
  }

  private disarmAutoStop() {
    if (this.autoStopTimer !== undefined) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = undefined;
    }
  }

  // cues
  private async playWinCue(amount: number, stake: number) {
    if (amount <= 0 || stake <= 0) return;
    await SFX.ready;
    const ratio = amount / stake;
    SFX.play(ratio >= 10 ? 'win_big' : 'win_small');
  }

  private sceneFlash(color = 0xFFD479, alpha = 0.55, fadeMs = 240) {
    if (!this.fxFlash) return;
    const overlay = this.fxFlash;
    const W = App.pixi.renderer.screen.width;
    const H = App.pixi.renderer.screen.height;

    overlay.clear().rect(0, 0, W, H).fill({ color, alpha: 1 });
    overlay.alpha = alpha;
    overlay.visible = true;

    if (this.fxRafFlash) cancelAnimationFrame(this.fxRafFlash);
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / fadeMs;
      if (t >= 1) {
        overlay.visible = false;
        overlay.alpha = 0;
        this.fxRafFlash = undefined;
        return;
      }
      overlay.alpha = alpha * (1 - t);
      this.fxRafFlash = requestAnimationFrame(tick);
    };
    this.fxRafFlash = requestAnimationFrame(tick);
  }

  private screenShake(intensityPx = 6, ms = 260) {
    if (this.fxRafShake) cancelAnimationFrame(this.fxRafShake);
    const baseX = this.x, baseY = this.y;
    const t0 = performance.now();
    const tick = () => {
      const dt = performance.now() - t0;
      const k = Math.min(1, dt / ms);
      const damp = 1 - k;
      this.x = baseX + (Math.random() * 2 - 1) * intensityPx * damp;
      this.y = baseY + (Math.random() * 2 - 1) * intensityPx * damp;
      if (k >= 1) {
        this.x = baseX; this.y = baseY;
        this.fxRafShake = undefined;
        return;
      }
      this.fxRafShake = requestAnimationFrame(tick);
    };
    this.fxRafShake = requestAnimationFrame(tick);
  }

  // helpers (grid space)
  private idxToXY(idx: number): { x: number; y: number } {
    const r = Math.floor(idx / GRID_COLS);
    const c = idx % GRID_COLS;
    return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
  }
  private makeCellSprite(texKey: string, size = CELL * 0.9): Sprite {
    const spr = Sprite.from(texKey);
    spr.anchor.set(0.5);
    const w = Math.max(1, spr.texture.width);
    const h = Math.max(1, spr.texture.height);
    const scale = Math.min(size / w, size / h);
    spr.scale.set(scale);
    return spr;
  }
  private async playLocalPigSquash(idx: number, texKey: string) {
    // overlay a temp sprite and squash it in-place
    const { x, y } = this.idxToXY(idx);
    const spr = this.makeCellSprite(texKey);
    spr.position.set(x, y);
    spr.zIndex = 1000;
    this.grid.addChild(spr);

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 180);
        const e = easeOutCubic(k);
        spr.scale.y = spr.scale.y * (1 - 0.5 * e); // squash down
        spr.alpha = 1 - 0.6 * e;
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    spr.destroy();
  }

  /** Wait for reels stop, resolve outcomes, then return UI to SPIN. */
  private async awaitAndSettle() {
    try {
      await this.reels.onceAllStopped();
      const res = await this.pendingSpin!;
      this.pendingSpin = undefined;

      const visible = this.reels.getVisibleGrid();

      // ────────────────────────────────────────────────────────────────────────
      // DEV: force Lock&Win (hotkey 'L' or ?forceLW)
      if (DEV_FORCE_LW || this._forceLWOnce) {
        this._forceLWOnce = false;

        // Try to place a pig in each column visibly (if Reels supports it)
        const setCellKey = (this.reels as any).setCellKey as ((i:number,k:string)=>void) | undefined;
        const primaryPigKey = 'pig'; // adjust if your base pig texture key is different
        const idxOf = (r: number, c: number) => r * GRID_COLS + c;

        // Put pigs on top row of every column
        for (let c = 0; c < GRID_COLS; c++) {
          const top = idxOf(0, c);
          if (setCellKey) setCellKey(top, primaryPigKey);
          visible[top] = primaryPigKey; // keep controller view consistent
        }

        // INTRO modal (red & green button UI stays as-is)
        {
          const intro = new FeatureIntroModal();
          this.addChild(intro);
          const W = App.pixi.renderer.screen.width;
          const H = App.pixi.renderer.screen.height;
          intro.layout(0, 0, W, H);
          await intro.present({
            spins: 3,
            onShownSfx: 'bonus_enter',
            onClickSfx: 'ui_click',
          });
          intro.dispose();
        }

        // Run Lock&Win (PigFeatureController)
        this.reels.clearHighlights();

        const feature = new PigFeatureController(this.reels);
        feature.zIndex = 900;                 // above reels
        feature.sortableChildren = true;
        this.grid.addChild(feature);

        const { total, highlight } = await feature.run(visible, getState().stake);
        feature.destroy();

        // COMPLETED modal
        {
          const complete = new FeatureCompleteModal();
          this.addChild(complete);
          const W = App.pixi.renderer.screen.width;
          const H = App.pixi.renderer.screen.height;
          complete.layout(0, 0, W, H);
          await complete.present(total, { onShownSfx: 'bonus_finish', onClickSfx: 'ui_click' });
          complete.dispose();
        }

        setWin(total);
        setBalance(getState().balance + total);

        const ratioF = total / Math.max(1, getState().stake);
        this.playWinCue(total, getState().stake);
        this.sceneFlash(0xFFD479, ratioF >= 10 ? 0.7 : 0.5, 260);
        this.screenShake(ratioF >= 10 ? 8 : 4, ratioF >= 10 ? 320 : 220);

        if (highlight.length) {
          this.reels.highlightCells(highlight);
          window.setTimeout(() => this.reels.clearHighlights(), HIGHLIGHT_MS);
        } else {
          this.reels.clearHighlights();
        }

        await this.winToast.show(total, getState().stake);
        return; // skip base game after forcing L&W
      }
      // ────────────────────────────────────────────────────────────────────────
      // DEV: force a single hammer smash in base game (not during Lock&Win)
      if (this._forceHammerOnce) {
        this._forceHammerOnce = false;

        const setCellKey = (this.reels as any).setCellKey as ((i:number,k:string)=>void) | undefined;

        // 1) Pick or create a pig target
        let target = visible.findIndex(k => k && k.startsWith('pig'));
        if (target < 0) {
          // no pig on board: create one at bottom-center for a clean test
          const r = GRID_ROWS - 1;
          const c = Math.floor(GRID_COLS / 2);
          target = r * GRID_COLS + c;
          if (setCellKey) setCellKey(target, 'pig');
          visible[target] = 'pig';
        }

        const pigTexKey = visible[target];

        // 2) Try to use a real hammer neighbor; if none, use a free flight
        const hammerCells = findHammerCells(visible);
        const neighbor = neighborsOf(target).find(i => hammerCells.includes(i));
        const useFreeFlight = neighbor == null;

        // If we have a clean neighbor hammer, hide its static symbol
        if (!useFreeFlight) this.reels.setCellAlpha(neighbor!, 0);

        try {
          await animateHammerAction({
            fxLayer: this.grid,
            centerOnWindow: useFreeFlight,
            viewportForCenter: this.grid,
            fromIdx: neighbor ?? 0,
            toIdx: target,
            smashed: { at: target, amount: 100 },
            showAmount: true,
            speed: 0.8,
            onImpact: async () => {
              this.reels.setCellAlpha(target, 0);
              if (pigTexKey) {
                await this.playLocalPigSquash(target, pigTexKey);
              }
            },
          });

          await pinkBurstAtCell(this.grid, target, { count: 18, lifeMs: 380 });
          await showValueTokenAtCell(this.grid, target, 100, 650);
        } finally {
          if (!useFreeFlight) this.reels.setCellAlpha(neighbor!, 1);
          this.reels.setCellAlpha(target, 1);
        }
      }
      // ─────────────────────────────────────────────

      // Feature trigger (original pig feature if enough pigs total)
      const pigs = findPigCells(visible);
      if (pigs.length >= PIG_TRIGGER_COUNT) {
        this.reels.clearHighlights();

        // INTRO modal
        {
          const intro = new FeatureIntroModal();
          this.addChild(intro);
          const W = App.pixi.renderer.screen.width;
          const H = App.pixi.renderer.screen.height;
          intro.layout(0, 0, W, H);
          await intro.present({
            spins: 3,
            onShownSfx: 'bonus_enter',
            onClickSfx: 'ui_click',
          });
          intro.dispose();
        }

        const feature = new PigFeatureController(this.reels);
        feature.zIndex = 900;                 // above reels
        feature.sortableChildren = true;
        this.grid.addChild(feature);

        const { total, highlight } = await feature.run(visible, getState().stake);
        feature.destroy();

        // COMPLETED modal
        {
          const complete = new FeatureCompleteModal();
          this.addChild(complete);
          const W = App.pixi.renderer.screen.width;
          const H = App.pixi.renderer.screen.height;
          complete.layout(0, 0, W, H);
          await complete.present(total, { onShownSfx: 'bonus_finish', onClickSfx: 'ui_click' });
          complete.dispose();
        }

        setWin(total);
        setBalance(getState().balance + total);

        const ratioF = total / Math.max(1, getState().stake);
        this.playWinCue(total, getState().stake);
        this.sceneFlash(0xFFD479, ratioF >= 10 ? 0.7 : 0.5, 260);
        this.screenShake(ratioF >= 10 ? 8 : 4, ratioF >= 10 ? 320 : 220);

        if (highlight.length) {
          this.reels.highlightCells(highlight);
          window.setTimeout(() => this.reels.clearHighlights(), HIGHLIGHT_MS);
        } else {
          this.reels.clearHighlights();
        }

        await this.winToast.show(total, getState().stake);
        return;
      }

      // Base game (ways + optional hammer-in-base)
      const stake = getState().stake;
      const { wins, total } = evaluateWays(visible, stake);
      let grand = total;

      const hlSet = new Set<number>();
      for (const w of wins) for (const i of w.indices) hlSet.add(i);

      if (ENABLE_HAMMER_BASE) {
        const { computeHammerAwardsBase } = await import('@/game/feature/hammer/base-resolve');
        const baseHammer = computeHammerAwardsBase(visible);
        grand += baseHammer.total;
        baseHammer.indices.forEach(i => hlSet.add(i));

        const hammerCells = findHammerCells(visible);

        for (const s of baseHammer.smashed) {
          const fromIdx = neighborsOf(s.at).find(i => hammerCells.includes(i));
          if (fromIdx == null) continue;

          // Only hide the hammer source before the flight; keep pig visible until impact
          this.reels.setCellAlpha(fromIdx, 0);
          const pigTexKey = visible[s.at]; // remember texture to squash

          try {
            await animateHammerAction({
              fxLayer: this.grid,
              fromIdx,
              toIdx: s.at,
              smashed: { at: s.at, amount: s.amount },
              showAmount: true,
              speed: 0.7,
              onImpact: async () => {
                // hide base pig sprite exactly at impact, then squash overlay
                this.reels.setCellAlpha(s.at, 0);
                if (pigTexKey) {
                  await this.playLocalPigSquash(s.at, pigTexKey);
                }
              },
            });

            // Post-hit FX; helpers auto-destroy their own graphics
            await pinkBurstAtCell(this.grid, s.at, { count: 18, lifeMs: 380 });
            await showValueTokenAtCell(this.grid, s.at, s.amount, 650);
          } finally {
            // ALWAYS restore board state so everything is back to normal
            this.reels.setCellAlpha(fromIdx, 1);
            this.reels.setCellAlpha(s.at, 1); // keep if pig should remain; remove if a smash should consume it
          }
        }
      }

      setWin(grand);
      setBalance(getState().balance + grand);

      if (grand > 0) {
        const ratio = grand / Math.max(1, stake);
        this.playWinCue(grand, stake);
        this.sceneFlash(0xFFD479, ratio >= 10 ? 0.65 : 0.45, 240);
        this.screenShake(ratio >= 10 ? 7 : 1, ratio >= 10 ? 300 : 200);
      }

      const indices = Array.from(hlSet);
      if (indices.length) {
        this.reels.highlightCells(indices);
        window.setTimeout(() => this.reels.clearHighlights(), HIGHLIGHT_MS);
      } else {
        this.reels.clearHighlights();
      }

      await this.winToast.show(grand, stake);
    } catch (e) {
      console.error('settle error:', e);
    } finally {
      setSpinning(false);
      // Return button to SPIN after everything finishes
      this.hud.spin.setMode('spin');
    }
  }

  destroy(options?: any) {
    super.destroy(options);
    this.disarmAutoStop();
    if (this.fxRafFlash) cancelAnimationFrame(this.fxRafFlash);
    if (this.fxRafShake) cancelAnimationFrame(this.fxRafShake);
    App.pixi.ticker.remove(this.onTick, this);
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
