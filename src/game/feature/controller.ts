// src/game/feature/controller.ts
import { Container, Graphics, Text, Sprite } from 'pixi.js';
import { GRID_COLS, GRID_ROWS, CELL } from '@/game/config';
import { Reels, setFeatureMode, setSpinSpeedScale } from '@/game/reels/display-reels';
import { animateHammerAction, shakeZoomHammerAndPig } from '@/game/feature/hammer/hammer-anim';

import {
  normKey,
  isPigKey,
  isGoldPigKey,
  findHammerCells,
} from '@/game/feature/helpers';
import { stepHammers, HammerStates } from '@/game/feature/hammer/hammer';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// pacing
const RESPIN_START    = 3;
const SPIN_TIME_MS    = 520;
const SLOW_SPIN_SCALE = 0.6;

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const rc  = (i: number) => ({ r: Math.floor(i / GRID_COLS), c: i % GRID_COLS });

/** Credit roll for pigs (heavy-tailed). */
function rollPigAmount(gold: boolean): number {
  const r = Math.random();
  if (!gold) {
    if (r < 0.65) return [50, 100, 150, 200][(Math.random() * 4) | 0];
    if (r < 0.95) return [300, 500][(Math.random() * 2) | 0];
    return Math.random() < 0.7 ? 1000 : 2000;
  } else {
    if (r < 0.60) return [250, 500, 750][(Math.random() * 3) | 0];
    if (r < 0.95) return 1000;
    return Math.random() < 0.7 ? 2500 : 5000;
  }
}

/** Locked pig overlay */
type Overlay = Container & { plate: Graphics; border: Graphics; icon: Sprite; txt: Text };

function makeOverlay(x: number, y: number, cell: number, symKey: string, amount: number): Overlay {
  const root = new Container() as Overlay;

  const plate = new Graphics()
    .roundRect(0, 0, cell, cell, 12)
    .fill({ color: 0x0d0d0d, alpha: 0.92 });
  plate.pivot.set(cell / 2, cell / 2);

  const border = new Graphics()
    .roundRect(0, 0, cell - 4, cell - 4, 10)
    .stroke({ width: 3, color: 0xffbf00, alpha: 0.95 });
  border.pivot.set((cell - 4) / 2, (cell - 4) / 2);

  const icon = Sprite.from(symKey);
  icon.anchor.set(0.5);
  icon.width = icon.height = cell - 16;

  const txt = new Text({ text: fmt(amount), style: { fontSize: 20, fontWeight: '900', fill: 0xffffff } as any });
  (txt as any).anchor?.set?.(0.5);
  txt.position.set(0, cell * 0.34);

  root.addChild(plate, icon, border, txt);
  (root as any).plate  = plate;
  (root as any).border = border;
  (root as any).icon   = icon;
  (root as any).txt    = txt;

  root.position.set(x, y);
  root.alpha = 0;

  // tiny pop-in
  const t0 = performance.now(), dur = 140;
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / dur);
    root.alpha = k;
    const s = 0.92 + 0.08 * (1 - Math.pow(1 - k, 3));
    root.scale.set(s);
    if (k < 1) requestAnimationFrame(tick); else root.scale.set(1);
  };
  requestAnimationFrame(tick);

  return root;
}

export class PigFeatureController extends Container {
  private overlays = new Map<number, Overlay>(); // index -> overlay
  private counterPlate = new Graphics();
  private counterTxt   = new Text({ text: 'Respins: 3', style: { fontSize: 20, fontWeight: '900', fill: 0xfff275 } as any });

  constructor(private reels: Reels) {
    super();
  }

  /**
   * Hold & Win:
   * - Lock pigs with rolled credits (overlays)
   * - Each respin: lock new pigs; resolve hammer step (move/smash)
   * - Reset respins to 3 when any NEW pig lands
   * - Exit: pay sum(remaining pigs + hammer totals); return highlight indices
   */
  async run(startGrid: string[], _stake: number): Promise<{ total: number; highlight: number[] }> {
    // counter UI
    const cx = (GRID_COLS * CELL) / 2;
    const cy = 12;
    this.counterPlate
      .roundRect(0, 0, 160, 28, 8)
      .fill({ color: 0x000000, alpha: 0.55 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.18 });
    this.counterPlate.pivot.set(80, 14);
    (this.counterTxt as any).anchor?.set?.(0.5);

    const counter = new Container();
    counter.addChild(this.counterPlate, this.counterTxt);
    counter.position.set(cx, cy);
    this.addChild(counter);

    // entry lock
    const locked = new Map<number, { amount: number; sym: string }>();
    for (let i = 0; i < startGrid.length; i++) {
      const key = startGrid[i];
      if (isPigKey(key)) {
        const amount = rollPigAmount(isGoldPigKey(key));
        locked.set(i, { amount, sym: normKey(key) });
      }
    }
    for (const [i, v] of locked) {
      const { r, c } = rc(i);
      const x = c * CELL + CELL / 2;
      const y = r * CELL + CELL / 2;
      const ov = makeOverlay(x, y, CELL, v.sym, v.amount);
      this.addChild(ov);
      this.overlays.set(i, ov);
    }

    // feature reel behavior
    setFeatureMode(true);
    setSpinSpeedScale(SLOW_SPIN_SCALE);

    let respins = RESPIN_START;
    let hammerStates: HammerStates = new Map();

    try {
      while (respins > 0) {
        this.counterTxt.text = `Respins: ${respins}`;

        // spin → stop
        this.reels.start();
        await sleep(SPIN_TIME_MS);
        this.reels.requestStaggerStop(false);
        await this.reels.onceAllStopped();

        const vis = this.reels.getVisibleGrid();

        // lock new pigs
        let newPig = false;
        for (let i = 0; i < vis.length; i++) {
          if (locked.has(i)) continue;
          const key = vis[i];
          if (isPigKey(key)) {
            const amount = rollPigAmount(isGoldPigKey(key));
            const sym = normKey(key);
            locked.set(i, { amount, sym });
            newPig = true;

            const { r, c } = rc(i);
            const x = c * CELL + CELL / 2;
            const y = r * CELL + CELL / 2;
            const ov = makeOverlay(x, y, CELL, sym, amount);
            this.addChild(ov);
            this.overlays.set(i, ov);
          }
        }

        // hammer resolution
        const hammerIndices = findHammerCells(vis);
        if (hammerIndices.length > 0) {
          // --- HAMMER RESOLUTION + ANIMATIONS ---
          const step = stepHammers(hammerIndices, hammerStates, locked);
          const movedPairs = [...step.moved.entries()]; // [fromIdx, toIdx]
          hammerStates = step.hammerStates;

          // animate each hammer move (optional pre-hit shake/zoom when smashing)
          for (const [fromIdx, toIdx] of movedPairs) {
            const smash = step.smashed.find(s => s.at === toIdx);

            if (smash) {
              // Avoid pre-hit temp sprites on bottom row (can clip off-screen)
              const { r } = rc(toIdx);
              const isBottomRow = r === GRID_ROWS - 1;
              if (!isBottomRow) {
                await shakeZoomHammerAndPig({
                  fxLayer: this,
                  hammerIdx: fromIdx,
                  pigIdx: smash.at,
                  ms: 200,
                  shakePx: 5,
                  zoomOut: 0.92,
                });
              }
            }

            // ⬇️ Center-of-window celebration (regardless of pig position)
            await animateHammerAction({
              fxLayer: this,
              fromIdx,
              toIdx,
              smashed: smash,
              newTotalUnderHammer: hammerStates.get(toIdx)?.total,

              // force celebration at the true window center
              centerOnWindow: true,
              // Use the root container that spans the window; if PigFeatureController is
              // attached directly under the main scene, this.parent is usually correct.
              viewportForCenter: (this.parent as Container) ?? undefined,
            });
          }

          // remove smashed pig overlays (locked already updated by stepHammers)
          for (const s of step.smashed) {
            const ov = this.overlays.get(s.at);
            if (ov) {
              this.overlays.delete(s.at);
              ov.removeFromParent();
              ov.destroy({ children: true });
            }
          }
          // --- END HAMMER RESOLUTION + ANIMATIONS ---
        }

        // respin bookkeeping
        respins -= 1;
        if (newPig) respins = RESPIN_START;

        await sleep(120);
      }
    } finally {
      // ALWAYS restore normal reels (prevents getting stuck in feature)
      this.reels.stopImmediate();
      setFeatureMode(false);
      setSpinSpeedScale(1);
    }

    // payout: remaining pigs + hammer totals
    let total = 0;
    const highlight: number[] = [];

    for (const [i, v] of locked) {
      total += v.amount;
      highlight.push(i);
    }
    for (const [i, st] of hammerStates) {
      if (st.total > 0) {
        total += st.total;
        highlight.push(i);
      }
    }

    await this.fadeOut();

    this.removeChildren();
    this.overlays.clear();

    return { total, highlight };
  }

  private async fadeOut() {
    const t0 = performance.now(), dur = 220;
    return new Promise<void>((resolve) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        this.alpha = 1 - k;
        if (k < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  destroy(options?: any) {
    super.destroy(options);
    this.removeChildren();
    this.overlays.clear();
  }
}
