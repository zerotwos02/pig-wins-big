// src/game/feature/lockandwin/lockandwin.ts
import { Container, Sprite } from 'pixi.js';
import { LWConfig, LWOutcome, LWEvents, CellKey } from './types';

// Minimal reel “port” you need from your Reels impl:
export type ReelsPort = {
  view: Container;
  getVisibleGrid(): CellKey[];                    // length = GRID_COLS*GRID_ROWS
  setCellKey(idx: number, key: CellKey): void;    // swap symbol for one cell
  setCellAlpha(idx: number, a: number): void;     // hide/show
  respinUnlocked(unlockedIndices: number[]): Promise<void>; // spin just these cells
};

// NOTE: use `index` (not `idx`) so it matches LWOutcome.locked
type Lock = { index: number; key: CellKey; amount: number; spr?: Sprite };

export class LockAndWinController extends Container {
  private reels: ReelsPort;
  private cfg: LWConfig;
  private ev?: LWEvents;

  private locked = new Map<number, Lock>(); // key = cell index
  private spinsLeft = 0;
  private round = 0;
  private total = 0;

  constructor(reels: ReelsPort, cfg: LWConfig, ev?: LWEvents) {
    super();
    this.reels = reels;
    this.cfg = cfg;
    this.ev = ev;
    this.sortableChildren = true;
  }

  /** Enter the feature with a starting grid (already showing the trigger). */
  async run(startSpins?: number): Promise<LWOutcome> {
    const grid = this.reels.getVisibleGrid();
    this.spinsLeft = startSpins ?? this.cfg.startSpins;

    // Lock all currently lockable cells at entry
    grid.forEach((k, i) => {
      if (this.cfg.isLockable(k) && !this.locked.has(i)) {
        const amt = this.cfg.valueOf(k);
        this.locked.set(i, { index: i, key: k, amount: amt });
        this.total += amt;
      }
    });

    // Main loop
    this.round = 0;
    while (true) {
      this.round++;
      this.ev?.onRound?.(this.round, this.spinsLeft, this.total);

      // Compute unlocked indices (those NOT locked)
      const all = [...this.reels.getVisibleGrid().keys()];
      const unlocked = all.filter(i => !this.locked.has(i));

      // If full board locked -> finish
      if (unlocked.length === 0) break;

      // Respin only the unlocked ones
      await this.reels.respinUnlocked(unlocked);

      const after = this.reels.getVisibleGrid();

      // Detect new locks in this round
      let gotNew = false;
      for (const i of unlocked) {
        const key = after[i];
        if (this.cfg.isLockable(key)) {
          const amount = this.cfg.valueOf(key);
          this.locked.set(i, { index: i, key, amount });
          this.total += amount;
          gotNew = true;
          this.ev?.onLock?.(i, amount);
        }
      }

      // Reset or decrement spinsLeft
      this.spinsLeft = gotNew ? this.cfg.startSpins : (this.spinsLeft - 1);

      // Update HUD
      this.ev?.onRound?.(this.round, this.spinsLeft, this.total);

      if (this.spinsLeft <= 0) break;
    }

    // Shape matches LWOutcome.locked { index, key, amount }
    const out: LWOutcome = {
      total: this.total,
      locked: Array.from(this.locked.values()),
    };
    this.ev?.onFinish?.(out);
    return out;
  }
}
