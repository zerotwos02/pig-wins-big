// src/scenes/game-scene.ts
import { Container, Sprite, Texture, NineSliceSprite, Ticker, Graphics, Point } from 'pixi.js';

import { App } from '@/core/app';
import { GRID_COLS, GRID_ROWS, CELL, ENABLE_HAMMER_BASE, PIG_TRIGGER_COUNT } from '@/game/config';
import { HUD } from '@/scenes/hud';
import { spin } from '@/net/client';

import { InfoModal } from '@/ui/components/InfoModal';
import { InfoButton } from '@/ui/components/InfoButton';

import { getState, setSpinning, debitStake, setWin, setBalance } from '@/state/store';

import { Reels } from '@/game/reels/display-reels';
import { evaluateWays } from '@/game/eval/ways';
import { impactRingAt, popAmountAt, shakeZoomHammerAndPig } from '@/game/feature/hammer/hammer-anim';
import { findPigCells, findHammerCells, neighborsOf } from '@/game/feature/helpers';
import { PigFeatureController } from '@/game/feature/controller';
import { WinToast } from '@/ui/layouts/WinToast';

import { SFX } from '@/audio/sound-manager';
import { AudioToggle } from '@/ui/components/audio-toggle';

const AUTO_STOP_MS = 1100;
const HIGHLIGHT_MS = 900;

export class gameScene extends Container {
  private bg!: Sprite;
  private panel!: NineSliceSprite;
  private grid = new Container();

  // ⬇️ NEW: mask to clip reels + FX inside the panel area
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

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      this.toggleSpin();
    }
  };

  async init() {
    this.sortableChildren = true;

    this.bg = Sprite.from('bg');
    this.bg.anchor.set(0.5);
    this.addChild(this.bg);

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

    this.grid.addChild(this.reels.view);
    this.addChild(this.grid);

    // ⬇️ NEW: add and assign mask so reels + FX are clipped to the panel window
    this.addChild(this.gridMask);
    this.grid.mask = this.gridMask;

    this.addChild(this.hud);

    try {
      // @ts-ignore optional
      this.hud.title?.startBounceLoop?.({ speed: 0.7, ampY: 6, ampScale: 0.045 });
    } catch {}

    this.hud.spin.onClick(async () => {
      await SFX.ready;
      if (!this._bgStarted) {
        SFX.play('bg_music');
        this._bgStarted = true;
      }
      SFX.play('ui_click');
      this.toggleSpin();
    });

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

    this.fxFlash = new Graphics();
    this.fxFlash.zIndex = 1500;
    this.fxFlash.visible = false;
    this.addChild(this.fxFlash);

    const startBgOnce = async () => {
      await SFX.ready;
      if (!this._bgStarted) {
        SFX.play('bg_music');
        this._bgStarted = true;
      }
    };
    window.addEventListener('pointerdown', startBgOnce, { once: true });

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

    const bw = this.bg.texture.width;
    const bh = this.bg.texture.height;
    const s = Math.max(W / bw, H / bh);
    this.bg.scale.set(s);
    this.bg.position.set(W / 2, H / 2);

    const gridW = GRID_COLS * CELL;
    const gridH = GRID_ROWS * CELL;
    const target = Math.min(W, H) * 0.8;
    const k = Math.min(target / gridW, target / gridH);

    this.grid.scale.set(k);
    this.grid.position.set((W - gridW * k) / 2, H * 0.45 - (gridH * k) / 2);

    this.panel.width = gridW * k + 60;
    this.panel.height = gridH * k + 60;
    this.panel.position.set(W / 2, H * 0.45);

    // HUD knows the reel rect
    this.hud.setReelsRect({
      x: this.grid.x,
      y: this.grid.y,
      width: gridW * k,
      height: gridH * k,
    });

    this.hud.layout(W, H);

    const r = 18, PAD = 16;
    this.infoBtn.position.set(W - PAD - r, PAD + r);

    const gap = 12;
    if (this.audioToggle) {
      this.audioToggle.x = this.infoBtn.x - this.infoBtn.width - gap - this.audioToggle.width;
      this.audioToggle.y = PAD;
    }

    if (this.fxFlash) {
      this.fxFlash.clear().rect(0, 0, W, H).fill({ color: 0xFFFFFF, alpha: 0 });
      this.fxFlash.visible = false;
    }

    this.infoModal.layout(W, H);

    // ⬇️ NEW/UPDATED: draw mask to match the exact reel area (rounded corners)
    const RADIUS = 18; // match your panel's inner rounding
    this.gridMask.clear()
      .roundRect(this.grid.x, this.grid.y, gridW * k, gridH * k, RADIUS)
      .fill(0xffffff); // color doesn't matter for masks
  }

  private toggleSpin() {
    if (this.reels.isRolling) {
      this.disarmAutoStop();
      this.reels.stopImmediate();
      this.awaitAndSettle();
      return;
    }
    this.startSpin();
  }

  private startSpin() {
    const s = getState();
    if (s.isSpinning || s.balance < s.stake) return;

    setSpinning(true);
    setWin(0);
    debitStake();

    this.reels.start();

    this.pendingSpin = spin(getState().stake).catch((e) => {
      console.error('spin() failed:', e);
      return { grid: this.reels.getVisibleGrid(), win: 0 };
    });

    this.armAutoStop();
  }

  private armAutoStop() {
    this.disarmAutoStop();
    this.autoStopTimer = window.setTimeout(() => {
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

  /** Center of the window converted to this scene's local space */
  private getWindowCenterLocal(): Point {
    const W = App.pixi.renderer.screen.width;
    const H = App.pixi.renderer.screen.height;
    return this.toLocal(new Point(W / 2, H / 2));
    // Alternative if your scene is not at (0,0): return this.toLocal({x: W/2, y:H/2} as any);
  }

  private async awaitAndSettle() {
    try {
      await this.reels.onceAllStopped();
      const res = await this.pendingSpin!;
      this.pendingSpin = undefined;

      const visible = this.reels.getVisibleGrid();

      // Feature trigger
      const pigs = findPigCells(visible);
      if (pigs.length >= PIG_TRIGGER_COUNT) {
        this.reels.clearHighlights();

        const feature = new PigFeatureController(this.reels);
        this.grid.addChild(feature);

        const { total, highlight } = await feature.run(visible, getState().stake);
        feature.destroy();

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

      // Base game
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

        // optional FX per smashed pig
        const hammerCells = findHammerCells(visible);
        for (const s of baseHammer.smashed) {
          const anyAdjHammer = neighborsOf(s.at).find(i => hammerCells.includes(i));

          // ⬇️ Skip pre-hit temp sprites when pig is on bottom row (prevents HUD overlap)
          const row = Math.floor(s.at / GRID_COLS);
          const isBottom = row === GRID_ROWS - 1;
          if (!isBottom) {
            await shakeZoomHammerAndPig({
              fxLayer: this,
              hammerIdx: anyAdjHammer,
              pigIdx: s.at,
              ms: 520,          // short & subtle
              zoomOut: 0.9995,  // tiny zoom-out feel
            });
          }

          // Centered celebration (ignore the cell position)
          const cen = this.getWindowCenterLocal();
          await impactRingAt(this, cen.x, cen.y);
          await popAmountAt(this, cen.x, cen.y, s.amount);
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
