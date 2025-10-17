// src/game/reels/display-reels.ts
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GRID_COLS, GRID_ROWS, CELL } from '@/game/config';
import type { Cell, SpinOutcomeCell } from '@/game/config';
import { SFX } from '@/audio/sound-manager';

// --- cell geometry ---
const COL_W = CELL;
const ROW_H = CELL;
const PAD   = Math.round(CELL * 0.05);
const MASK_PAD = Math.round(CELL * 0.06);

// --- window & buffer ---
const VISIBLE = GRID_ROWS;
const BUFFER  = 3;
const EXTRA   = 2;
const N_ROWS  = VISIBLE + BUFFER + EXTRA;

// --- motion ---
const BASE_SPEED_PX_PER_MS = ROW_H * 0.010;

// expose setters that modify Reels class statics (single source of truth)
export function setSpinSpeedScale(scale: number) {
  Reels.SPEED_SCALE = Math.max(0.2, Math.min(3, scale));
}
export function setSpinTiming(opts: { decelWaitMs?: number; staggerMs?: number }) {
  if (typeof opts.decelWaitMs === 'number') Reels.DECEL_WAIT_MS = Math.max(0, opts.decelWaitMs);
  if (typeof opts.staggerMs === 'number') Reels.STAGGER_MS = Math.max(0, opts.staggerMs);
}

// --- feature weights toggle (if you use it elsewhere) ---
let FEATURE_MODE = false;
export function setFeatureMode(on: boolean) { FEATURE_MODE = on; }

// Weights must be integers (relative probabilities)
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
const SIZE_MULT: Record<string, number> = {
  pig: 1.70, pig_gold: 1.70, diamond: 1.40, gold_bars: 1.09,
  cash_stack: 1.00, dollar: 1.70, coin: 1.09, banker: 1.09,
  hammer: 1.40, wild_feather: 1.00,
  A: 1.00, K: 1.09, Q: 1.09, J: 1.09, '10': 1.09,
  default: 1.09,
};

type FitMode = 'contain' | 'nativeMax';
const FIT_MODE: Record<string, FitMode> = {
  A: 'nativeMax', cash_stack: 'nativeMax', default: 'contain',
};

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
  static SPEED_SCALE = 1;
  static DECEL_WAIT_MS = 160;
  static STAGGER_MS = 110;

  public readonly view = new Container();
  public isRolling = false;
  public isStaggering = false;

  private stripRoot = new Container();
  private maskShape = new Graphics();
  private highlights = new Graphics();

  private cols: Container[] = [];
  private spCols: Sprite[][] = [];
  private baseY: number[] = [];
  private colOffset: number[] = [];
  private colStopped: boolean[] = [];

  private elapsedMs = 0;
  private stopPlan: number[] = [];
  private stopResolve: StopResolve = null;

  constructor() {
    this.maskShape.clear()
      .rect(-MASK_PAD, -MASK_PAD, GRID_COLS * COL_W + MASK_PAD * 2, GRID_ROWS * ROW_H + MASK_PAD * 2)
      .fill(0xffffff);
    this.stripRoot.mask = this.maskShape;

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

    this.view.addChild(this.stripRoot, this.maskShape, this.highlights);
    this.highlights.visible = false;

    this.baseY = Array.from({ length: N_ROWS }, (_, i) => (i - 1) * ROW_H + ROW_H / 2);
    this.colOffset  = Array(GRID_COLS).fill(0);
    this.colStopped = Array(GRID_COLS).fill(false);

    this.positionAllSprites();
  }

  private positionAllSprites() {
    for (let c = 0; c < GRID_COLS; c++) {
      const off = this.colOffset[c] || 0;
      const sprites = this.spCols[c];
      for (let i = 0; i < N_ROWS; i++) {
        sprites[i].y = this.baseY[i] + off;
      }
    }
  }

  private rotateDown(c: number) {
    const sprites = this.spCols[c];
    for (let i = N_ROWS - 1; i >= 1; i--) {
      const k = getSpriteKey(sprites[i - 1]);
      setSpriteKey(sprites[i], k);
    }
    setSpriteKey(sprites[0], randKey());
  }

  update(deltaMs: number) {
    if (!this.isRolling) return;

    for (let c = 0; c < GRID_COLS; c++) {
      if (this.colStopped[c]) continue;

      this.colOffset[c] += (BASE_SPEED_PX_PER_MS * Reels.SPEED_SCALE) * deltaMs;

      while (this.colOffset[c] >= ROW_H) {
        this.colOffset[c] -= ROW_H;
        this.rotateDown(c);
      }
    }

    this.positionAllSprites();

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

      if (this.colStopped.every(Boolean)) {
        this.isRolling = false;
        this.isStaggering = false;
        for (let c = 0; c < GRID_COLS; c++) this.colOffset[c] = 0;
        this.positionAllSprites();

        const res = this.stopResolve; this.stopResolve = null; res?.();
      }
    }
  }

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

  requestStaggerStop(immediate: boolean) {
    if (!this.isRolling) return;
    this.isStaggering = true;
    this.elapsedMs = 0;

    const t0 = immediate ? 0 : Reels.DECEL_WAIT_MS;
    this.stopPlan = Array.from({ length: GRID_COLS }, (_, i) => t0 + i * Reels.STAGGER_MS);
  }

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

  onceAllStopped(): Promise<void> {
    if (!this.isRolling && this.colStopped.every(Boolean)) return Promise.resolve();
    return new Promise<void>((resolve) => { this.stopResolve = resolve; });
  }

  applyResultGrid(_grid: string[]) { /* no-op */ }

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

  public setCellAlpha(index: number, a: number) {
    const r = Math.floor(index / GRID_COLS);
    const c = index % GRID_COLS;
    const sp = this.spCols?.[c]?.[1 + r];
    if (sp) sp.alpha = a;
  }

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

  clearHighlights() {
    this.highlights.clear();
    this.highlights.visible = false;
  }

  toCells(flat: string[]): Cell[][] {
    const grid: Cell[][] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const i = r * GRID_COLS + c;
        row.push({ kind: this.normalizeKey(flat[i]) });
      }
      grid.push(row);
    }
    return grid;
  }

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

  private normalizeKey(k: string): Cell['kind'] {
    const base = k?.split('/').pop() ?? k;
    if (base === 'pig') return 'pig';
    if (base === 'pig_gold') return 'pig_gold';
    if (base === 'wild_feather') return 'wild';
    if (base === 'hammer') return 'hammer';
    return 'icon';
  }
}
