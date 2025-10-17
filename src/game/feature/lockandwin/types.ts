// src/game/feature/lockandwin/types.ts

// your visible key, e.g. 'pig', 'pig_gold', 'coin_50', etc.
export type CellKey = string;

// ---------------------------------------------------------------------------
// Config for the Lock & Win feature
// ---------------------------------------------------------------------------
export type LWConfig = {
  startSpins: number;        // e.g. 3
  lockKeys: string[];        // keys that lock (e.g. ['pig', 'pig_gold', 'coin_*'])
  valueOf: (k: CellKey) => number; // map a key to its FUN value
  isLockable: (k: CellKey) => boolean; // quick guard

  // optional: grid size used for positioning calculations
  gridCols?: number;          // default 5
  gridRows?: number;          // default 4
};

// ---------------------------------------------------------------------------
// Feature outcome at the end
// ---------------------------------------------------------------------------
export type LWOutcome = {
  total: number;
  locked: { index: number; key: CellKey; amount: number }[];
};

// ---------------------------------------------------------------------------
// Event hooks for UI / FX / HUD integration
// ---------------------------------------------------------------------------
export type LWEvents = {
  // existing callbacks
  onRound?: (round: number, spinsLeft: number, total: number) => void;
  onLock?: (index: number, amount: number) => void;
  onFinish?: (out: LWOutcome) => void;

  // ---- new optional hooks for animation & HUD ----
  /** Called before pigs start flying so the HUD can reset to 0 */
  onTotalReset?: () => void;

  /** Called whenever the total value updates (during count-up animation) */
  onTotalChange?: (value: number) => void;

  /** Get world-space center of a cell for fly animations */
  getCellCenter?: (index: number) => { x: number; y: number };

  /** Get world-space position of the total win field */
  getTotalFieldPos?: () => { x: number; y: number };

  /** Pig fly-in animation start / end (for SFX or particles) */
  onPigFlyStart?: (index: number, amount: number) => void;
  onPigFlyEnd?: (index: number, amount: number) => void;
};
