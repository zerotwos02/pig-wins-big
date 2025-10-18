// src/game/reels/display-reels.ts
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GRID_COLS, GRID_ROWS, CELL } from '@/game/config';
import type { Cell, SpinOutcomeCell } from '@/game/config';
import { SFX } from '@/audio/sound-manager';

// --- cell geometry ---
// Column width / row height are tied to the CELL size; small padding helps visuals breathe.
const COL_W = CELL;
const ROW_H = CELL;
const PAD   = Math.round(CELL * 0.05);
const MASK_PAD = Math.round(CELL * 0.06);

// --- window & buffer ---
// VISIBLE = rows shown; BUFFER/EXTRA provide off-screen rows to enable seamless rotation.
const VISIBLE = GRID_ROWS;
const BUFFER  = 3;
const EXTRA   = 2;
const N_ROWS  = VISIBLE + BUFFER + EXTRA;

// --- motion ---
// Base vertical speed per millisecond; actual speed = BASE * SPEED_SCALE.
const BASE_SPEED_PX_PER_MS = ROW_H * 0.010;

// expose setters that modify Reels class statics (single source of truth)
// External knobs for gameplay: slow down/speed up reels and tweak stop timing.
export function setSpinSpeedScale(scale: number) {
  Reels.SPEED_SCALE = Math.max(0.2, Math.min(3, scale));
}
export function setSpinTiming(opts: { decelWaitMs?: number; staggerMs?: number }) {
  if (typeof opts.decelWaitMs === 'number') Reels.DECEL_WAIT_MS = Math.max(0, opts.decelWaitMs);
  if (typeof opts.staggerMs === 'number') Reels.STAGGER_MS = Math.max(0, opts.staggerMs);
}

// --- feature weights toggle (if you use it elsewhere) ---
// When FEATURE_MODE is on, the symbol distribution shifts to favor non-pig icons.
let FEATURE_MODE = false;
export function setFeatureMode(on: boolean) { FEATURE_MODE = on; }

// Weights must be integers (relative probabilities)
// Base spin distribution: pigs relatively common; wild/hammer rarer for balance.
const WEIGHTS_BASE: Record<string, number> = {
  diamond: 10, gold_bars: 10, cash_stack: 10, coin: 10, dollar: 10, money_bag: 10,
  wild_feather: 3, hammer: 3,
  pig: 19, pig_gold: 1, banker: 8,
  A: 14, K: 14, Q: 14, J: 14, '10': 14,
};

const WEIGHTS_FEATURE: Record<string, number> = {
  diamond: 20, gold_bars: 20, cash_stack: 20, coin: 20, dollar: 20, money_bag: 20,
  wild_feather: 2, hammer: 2,
  pig: 3, pig_gold: 0, banker: 10,
  A: 20, K: 20, Q: 20, J: 20, '10': 20,
};

// --- per-symbol visual tuning (no stretch for A/cash_stack; wider banker) ---
// SIZE_MULT: uniform scale multiplier per symbol family to harmonize on-reel sizing.
const SIZE_MULT: Record<string, number> = {
  pig: 1.70, pig_gold: 1.70, diamond: 1.40, gold_bars: 1.09,
  cash_stack: 1.00, dollar: 1.70, coin: 1.09, banker: 1.09,
  hammer: 1.40, wild_feather: 1.00,
  A: 1.00, K: 1.09, Q: 1.09, J: 1.09, '10': 1.09,
  default: 1.09,
};

// Fit behavior hint per symbol: 'nativeMax' avoids upscaling beyond texture’s native size.
type FitMode = 'contain' | 'nativeMax';
const FIT_MODE: Record<string, FitMode> = {
  A: 'nativeMax', cash_stack: 'nativeMax', default: 'contain',
};

// Weighted random pick helper for symbol keys.
function weightedPick(weights: Record<string, number>): string {
  let sum = 0;
  const entries = Object.entries(weights);
  for (const [, w] of entries) sum += w;
  let r = Math.random() * sum;
  for (const [k, w] of entries) { r -= w; if (r < 0) return k; }
  return entries[0][0];
}
function randKey() {
  return FEATURE_MODE ? weightedPick(WEIGHTS_FEATURE) : weightedPick(WEIGHTS_BASE);
}

// store & read logical key on each sprite
// Attach a $key for quick lookup; compute scale to fit inside SAFE_SIZE with optional per-symbol tweaks.
function setSpriteKey(sp: Sprite, key: string) {
  (sp as any).$key = key;
  const tex = Texture.from(key);
  sp.texture = tex;
  sp.anchor.set(0.5);

  const SAFE_SIZE = Math.min(COL_W, ROW_H) - PAD * 2;
  const origW = (tex as any).orig?.width ?? tex.width ?? SAFE_SIZE;
  const origH = (tex as any).orig?.height ?? tex.height ?? SAFE_SIZE;

  const containFit = SAFE_SIZE / Math.max(origW, origH);
  const mult = (SIZE_MULT as any)[key] ?? SIZE_MULT.default;
  const mode: FitMode = (FIT_MODE as any)[key] ?? FIT_MODE.default;

  let scale = containFit * mult;
  if (mode === 'nativeMax') {
    const nativeScale = 1 * mult; // do not upscale beyond native
    scale = Math.min(nativeScale, scale);
  }

  sp.scale.set(scale);
  if (key === 'banker') sp.scale.x *= 1.18; // wider man, same height
}
function getSpriteKey(sp: Sprite): string {
  return (sp as any).$key ?? '';
}

type StopResolve = (() => void) | null;

export class Reels {
  // 🔥 class-level (static) config so all instances share the same values
  static SPEED_SCALE = 1;      // global multiplier for spin speed
  static DECEL_WAIT_MS = 160;  // delay before first column begins stopping
  static STAGGER_MS = 110;     // gap between consecutive column stops

  public readonly view = new Container(); // parent container to mount in the scene
  public isRolling = false;               // true while reels are spinning
  public isStaggering = false;            // true during the stop phase

  private stripRoot = new Container();    // holds all columns
  private maskShape = new Graphics();     // viewport mask (soft pad to avoid clipping)
  private highlights = new Graphics();    // optional win-highlights overlay

  private cols: Container[] = [];         // column containers
  private spCols: Sprite[][] = [];        // sprites per column (top->bottom)
  private baseY: number[] = [];           // canonical Y positions for rows (without offset)
  private colOffset: number[] = [];       // per-column vertical scroll offset
  private colStopped: boolean[] = [];     // per-column stopping flags

  private elapsedMs = 0;                  // time since staggering started
  private stopPlan: number[] = [];        // planned stop times for columns
  private stopResolve: StopResolve = null;// resolves when all columns have stopped

  constructor() {
    // Build rectangular mask slightly larger than visible window to hide edges.
    this.maskShape.clear()
      .rect(-MASK_PAD, -MASK_PAD, GRID_COLS * COL_W + MASK_PAD * 2, GRID_ROWS * ROW_H + MASK_PAD * 2)
      .fill(0xffffff);
    this.stripRoot.mask = this.maskShape;

    // Construct columns and seed with initial random symbols.
    for (let c = 0; c < GRID_COLS; c++) {
      const col = new Container(); col.x = c * COL_W;
      const sprites: Sprite[] = [];
      for (let i = 0; i < N_ROWS; i++) {
        const sp = Sprite.from('diamond');
        setSpriteKey(sp, randKey());
        sp.x = COL_W / 2;
        sprites.push(sp);
        col.addChild(sp);
      }
      this.cols.push(col);
      this.spCols.push(sprites);
      this.stripRoot.addChild(col);
    }

    // mount draw order: strips under mask, then highlights on top
    this.view.addChild(this.stripRoot, this.maskShape, this.highlights);
    this.highlights.visible = false;

    // Precompute baseline Y for rows so scrolling is just an offset add.
    this.baseY = Array.from({ length: N_ROWS }, (_, i) => (i - 1) * ROW_H + ROW_H / 2);
    this.colOffset  = Array(GRID_COLS).fill(0);
    this.colStopped = Array(GRID_COLS).fill(false);

    this.positionAllSprites();
  }

  // Place every sprite based on baseY + per-column offset.
  private positionAllSprites() {
    for (let c = 0; c < GRID_COLS; c++) {
      const off = this.colOffset[c] || 0;
      const sprites = this.spCols[c];
      for (let i = 0; i < N_ROWS; i++) {
        sprites[i].y = this.baseY[i] + off;
      }
    }
  }

  // Shift symbols down one row in column c; insert new random at the top.
  private rotateDown(c: number) {
    const sprites = this.spCols[c];
    for (let i = N_ROWS - 1; i >= 1; i--) {
      const k = getSpriteKey(sprites[i - 1]);
      setSpriteKey(sprites[i], k);
    }
    setSpriteKey(sprites[0], randKey());
  }

  // Main per-frame update: advance offsets, rotate rows when a full cell passes,
  // and handle staggered stopping schedule.
  update(deltaMs: number) {
    if (!this.isRolling) return;

    for (let c = 0; c < GRID_COLS; c++) {
      if (this.colStopped[c]) continue;

      this.colOffset[c] += (BASE_SPEED_PX_PER_MS * Reels.SPEED_SCALE) * deltaMs;

      // When offset crosses one row, rotate symbols and wrap offset.
      while (this.colOffset[c] >= ROW_H) {
        this.colOffset[c] -= ROW_H;
        this.rotateDown(c);
      }
    }

    this.positionAllSprites();

    // Handle the stopping phase (staggered column stops).
    if (this.isStaggering) {
      this.elapsedMs += deltaMs;

      for (let c = 0; c < GRID_COLS; c++) {
        if (!this.colStopped[c] && this.elapsedMs >= this.stopPlan[c]) {
          this.colStopped[c] = true;
          this.colOffset[c] = 0;
          const vol = Math.max(0.35, 0.8 - c * 0.12);
          SFX.ready.then(() => SFX.play('reel_stop', { volume: vol }));
        }
      }

      // If all columns have stopped, finalize and resolve waiting promises.
      if (this.colStopped.every(Boolean)) {
        this.isRolling = false;
        this.isStaggering = false;
        for (let c = 0; c < GRID_COLS; c++) this.colOffset[c] = 0;
        this.positionAllSprites();

        const res = this.stopResolve; this.stopResolve = null; res?.();
      }
    }
  }

  // Begin a new spin: reset state, show strips, clear highlights, play SFX.
  start() {
    this.isRolling = true;
    this.isStaggering = false;
    this.elapsedMs = 0;
    this.stopPlan = [];

    this.colStopped = Array(GRID_COLS).fill(false);
    this.colOffset  = Array(GRID_COLS).fill(0);

    this.stripRoot.visible = true;
    this.stripRoot.alpha = 1;

    this.highlights.clear();
    this.highlights.visible = false;

    SFX.ready.then(() => SFX.play('spin_start'));
    this.positionAllSprites();
  }

  // Plan a staggered stop: either immediately or after a deceleration wait.
  requestStaggerStop(immediate: boolean) {
    if (!this.isRolling) return;
    this.isStaggering = true;
    this.elapsedMs = 0;

    const t0 = immediate ? 0 : Reels.DECEL_WAIT_MS;
    this.stopPlan = Array.from({ length: GRID_COLS }, (_, i) => t0 + i * Reels.STAGGER_MS);
  }

  // Emergency halt: stop everything at once, reset offsets, play stop SFX.
  stopImmediate() {
    if (!this.isRolling) return;
    this.colStopped = Array(GRID_COLS).fill(true);
    this.isRolling = false;
    this.isStaggering = false;

    for (let c = 0; c < GRID_COLS; c++) this.colOffset[c] = 0;
    this.positionAllSprites();

    SFX.ready.then(() => SFX.play('reel_stop', { volume: 0.8 }));
    const res = this.stopResolve; this.stopResolve = null; res?.();
  }

  // Promise resolves once all columns are fully stopped (either staggered or immediate).
  onceAllStopped(): Promise<void> {
    if (!this.isRolling && this.colStopped.every(Boolean)) return Promise.resolve();
    return new Promise<void>((resolve) => { this.stopResolve = resolve; });
  }

  // Placeholder for server-driven layouts; randomized reels ignore an external grid.
  applyResultGrid(_grid: string[]) { /* no-op */ }

  // Read current visible window (row-major order) as logical keys.
  getVisibleGrid(): string[] {
    const out: string[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const sp = this.spCols[c][1 + r];
        out.push(getSpriteKey(sp));
      }
    }
    return out;
  }

  // Fade a specific visible cell (by flat index) for win/highlight effects.
  public setCellAlpha(index: number, a: number) {
    const r = Math.floor(index / GRID_COLS);
    const c = index % GRID_COLS;
    const sp = this.spCols?.[c]?.[1 + r];
    if (sp) sp.alpha = a;
  }

  // Draw rectangular highlights around provided flat indices.
  highlightCells(indices: number[]) {
    this.highlights.clear();
    this.highlights.visible = true;
    for (const i of indices) {
      if (i < 0 || i >= GRID_ROWS * GRID_COLS) continue;
      const r = (i / GRID_COLS) | 0;
      const c = i % GRID_COLS;
      this.highlights
        .rect(c * COL_W + 4, r * ROW_H + 4, COL_W - 8, ROW_H - 8)
        .stroke({ width: 4, color: 0xffff66, alpha: 0.95 });
    }
  }

  // Remove highlight overlay.
  clearHighlights() {
    this.highlights.clear();
    this.highlights.visible = false;
  }

  // Convert a flat list of keys to a grid of Cell objects (UI-facing type).
  toCells(flat: string[]): Cell[][] {
    const grid: Cell[][] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const i = r * GRID_COLS + c;
        row.push({ kind: this.normalizeKey(flat[i]) });
      }
      row.push;
      grid.push(row);
    }
    return grid;
  }

  // Convert current visible window to a grid of SpinOutcomeCell for scoring.
  toOutcome(): SpinOutcomeCell[][] {
    const flat = this.getVisibleGrid();
    const grid: SpinOutcomeCell[][] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const row: SpinOutcomeCell[] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const i = r * GRID_COLS + c;
        row.push({ kind: this.normalizeKey(flat[i]) });
      }
      grid.push(row);
    }
    return grid;
  }

  // Normalize sprite keys to game logic kinds consumed by evaluators.
  private normalizeKey(k: string): Cell['kind'] {
    const base = k?.split('/').pop() ?? k;
    if (base === 'pig') return 'pig';
    if (base === 'pig_gold') return 'pig_gold';
    if (base === 'wild_feather') return 'wild';
    if (base === 'hammer') return 'hammer';
    return 'icon';
  }
}
