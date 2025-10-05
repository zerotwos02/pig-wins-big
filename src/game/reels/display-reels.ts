// src/game/reels/display-reels.ts
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GRID_COLS, GRID_ROWS, CELL } from '@/game/config';
import type { Cell, SpinOutcomeCell } from '@/game/config';
import { SFX } from '@/audio/sound-manager'; // 🔊 add

// --- cell geometry ---
const COL_W = CELL;
const ROW_H = CELL;
const PAD   = Math.round(CELL * 0.08);

// --- window & buffer ---
const VISIBLE = GRID_ROWS;
const BUFFER  = 3;
const EXTRA   = 2;
const N_ROWS  = VISIBLE + BUFFER + EXTRA;

// --- motion ---
const BASE_SPEED_PX_PER_MS = ROW_H * 0.010; // base speed (~1 row / 100ms)
let SPEED_SCALE = 1;                         // 1.0 = normal; <1 slower
export function setSpinSpeedScale(scale: number) {
  SPEED_SCALE = Math.max(0.2, Math.min(2, scale));
}

// --- symbol weights (to control pigs during feature) ---
let FEATURE_MODE = false;
export function setFeatureMode(on: boolean) { FEATURE_MODE = on; }

// Weights must be integers (relative probabilities)
const WEIGHTS_BASE: Record<string, number> = {
  diamond: 10, gold_bars: 10, cash_stack: 10, coin: 10, dollar: 10, money_bag: 10,
  wild_feather: 3, hammer: 3,
  pig: 19,
  pig_gold: 1,
  banker: 8,
  A: 14, K: 14, Q: 14, J: 14, '10': 14,
};

// Very low pig odds during feature (~2–3% total)
const WEIGHTS_FEATURE: Record<string, number> = {
  diamond: 20, gold_bars: 20, cash_stack: 20, coin: 20, dollar: 20, money_bag: 20, // 6*20 = 120
  wild_feather: 2, hammer: 2,                                                      // +4 = 124
  pig: 3,                                                                          // +3 = 127
  pig_gold: 0, // keep gold practically impossible during feature
  banker: 10,
  A: 20, K: 20, Q: 20, J: 20, '10': 20,
};                       
// pigs share ≈ 3 / 127 = 2.36%

function weightedPick(weights: Record<string, number>): string {
  let sum = 0;
  const entries = Object.entries(weights);
  for (const [, w] of entries) sum += w;
  let r = Math.random() * sum;
  for (const [k, w] of entries) {
    r -= w;
    if (r < 0) return k;
  }
  return entries[0][0];
}

function randKey() {
  return FEATURE_MODE ? weightedPick(WEIGHTS_FEATURE) : weightedPick(WEIGHTS_BASE);
}

// store & read logical key on each sprite (so we can copy keys cleanly)
function setSpriteKey(sp: Sprite, key: string) {
  (sp as any).$key = key;
  sp.texture = Texture.from(key);
  const size = Math.min(COL_W, ROW_H) - PAD * 2;
  sp.width = size; sp.height = size; sp.anchor.set(0.5);
}
function getSpriteKey(sp: Sprite): string {
  return (sp as any).$key ?? '';
}

type StopResolve = (() => void) | null;

export class Reels {
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
      .rect(0, 0, GRID_COLS * COL_W, GRID_ROWS * ROW_H)
      .fill(0xffffff);
    this.stripRoot.mask = this.maskShape;

    for (let c = 0; c < GRID_COLS; c++) {
      const col = new Container();
      col.x = c * COL_W;

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

      this.colOffset[c] += (BASE_SPEED_PX_PER_MS * SPEED_SCALE) * deltaMs;

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

          // 🔊 per-column stop cue (slightly softer for later columns)
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

    // 🔊 spin start cue
    SFX.ready.then(() => SFX.play('spin_start'));

    this.positionAllSprites();
  }

  requestStaggerStop(immediate: boolean) {
    if (!this.isRolling) return;
    this.isStaggering = true;
    this.elapsedMs = 0;

    const STAGGER_MS = 110;
    const DECEL_WAIT_MS = 160;
    const t0 = immediate ? 0 : DECEL_WAIT_MS;
    this.stopPlan = Array.from({ length: GRID_COLS }, (_, i) => t0 + i * STAGGER_MS);
  }

  stopImmediate() {
    if (!this.isRolling) return;
    this.colStopped = Array(GRID_COLS).fill(true);
    this.isRolling = false;
    this.isStaggering = false;

    for (let c = 0; c < GRID_COLS; c++) this.colOffset[c] = 0;
    this.positionAllSprites();

    // 🔊 single stop cue for immediate halt
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

  // Optional helpers retained for completeness
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
