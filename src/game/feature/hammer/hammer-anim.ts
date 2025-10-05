// src/game/feature/hammer/hammer-anim.ts
import { Container, Graphics, Text, Sprite, Point } from 'pixi.js';
import { CELL, GRID_COLS, GRID_ROWS } from '@/game/config';

// ------------- utils -------------
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const BOARD_W = GRID_COLS * CELL;
const BOARD_H = GRID_ROWS * CELL;
const PADDING = CELL * 0.08;

function clampPos(x: number, y: number) {
  const minX = PADDING, maxX = BOARD_W - PADDING;
  const minY = PADDING, maxY = BOARD_H - PADDING;
  return { x: Math.max(minX, Math.min(maxX, x)), y: Math.max(minY, Math.min(maxY, y)) };
}

function idxToXY(idx: number) {
  const r = Math.floor(idx / GRID_COLS);
  const c = idx % GRID_COLS;
  return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
}

function tween(ms: number, onUpdate: (t01: number) => void): Promise<void> {
  const t0 = performance.now();
  return new Promise((res) => {
    const step = () => {
      const k = clamp01((performance.now() - t0) / ms);
      onUpdate(k);
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}

/** toLocal center of a given viewport (usually app.stage or root scene) */
function getWindowCenterIn(layer: Container, viewport?: Container): Point {
  const src = viewport ?? layer; // if not provided, use the layer itself
  const gb = src.getBounds();    // global bounds
  const gc = new Point(gb.x + gb.width / 2, gb.y + gb.height / 2);
  return layer.toLocal(gc);      // convert global center to layer local
}

/** Create a symbol sprite sized to fit a cell (keeps aspect ratio). */
function makeCellSprite(texKey: string, size = CELL * 0.9): Sprite {
  const spr = Sprite.from(texKey);
  spr.anchor.set(0.5);
  const w = Math.max(1, spr.texture.width);
  const h = Math.max(1, spr.texture.height);
  const scale = Math.min(size / w, size / h);
  spr.scale.set(scale);
  return spr;
}

// ------------- tiny FX -------------
export async function impactRing(fxLayer: Container, atIdx: number): Promise<void> {
  const p0 = idxToXY(atIdx);
  const pc = clampPos(p0.x, p0.y);
  await impactRingAt(fxLayer, pc.x, pc.y);
}

/** NEW: ring at an arbitrary position (used for centered celebration) */
export async function impactRingAt(fxLayer: Container, x: number, y: number): Promise<void> {
  const ring = new Graphics();
  fxLayer.addChild(ring);
  await tween(160, (k) => {
    const t = easeOutCubic(k);
    const r = 10 + 22 * t;
    const a = 0.6 * (1 - t);
    ring.clear().circle(0, 0, r).stroke({ width: 3, color: 0xffd15c, alpha: a });
    ring.position.set(x, y);
  });
  ring.destroy();
}

export async function popAmount(fxLayer: Container, atIdx: number, amount: number): Promise<void> {
  const p = idxToXY(atIdx);
  await popAmountAt(fxLayer, p.x, p.y, amount);
}

/** NEW: floating text at an arbitrary position (used for centered celebration) */
export async function popAmountAt(
  fxLayer: Container, x: number, y: number, amount: number
): Promise<void> {
  const start = clampPos(x, y);
  const txt = new Text({
    text: `+${amount.toLocaleString()}`,
    style: { fontSize: 20, fontWeight: '900', fill: 0xffffff } as any,
  });
  (txt as any).anchor?.set?.(0.5);
  txt.position.set(start.x, start.y);
  txt.alpha = 0;
  fxLayer.addChild(txt);

  await tween(120, (k) => {
    const t = easeOutCubic(k);
    txt.alpha = t;
    txt.scale.set(0.9 + 0.1 * t);
  });

  const minY = PADDING + CELL * 0.5;
  const maxY = BOARD_H - PADDING - CELL * 0.5;

  await tween(260, (k) => {
    const t = easeOutCubic(k);
    const targetY = start.y - 10 - 16 * t;
    txt.y = Math.max(minY, Math.min(maxY, targetY));
    txt.alpha = 1 - 0.9 * t;
  });

  txt.destroy();
}

/** legacy (kept) */
export async function arcMove(fxLayer: Container, fromIdx: number, toIdx: number): Promise<void> {
  if (fromIdx === toIdx) return;
  const a = idxToXY(fromIdx);
  const b = idxToXY(toIdx);
  const trail = new Graphics().stroke({ width: 2, color: 0xffffff, alpha: 0.12 });
  fxLayer.addChild(trail);
  await tween(180, (k) => {
    const t = easeOutCubic(k);
    trail.clear().moveTo(a.x, a.y).lineTo(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  });
  trail.destroy();
}

export function ensureHammerBadge(fxLayer: Container, atIdx: number, currentTotal: number): Text {
  const p = idxToXY(atIdx);
  let badge = fxLayer.children.find(
    (c) => c instanceof Text && Math.abs(c.x - p.x) < 4 && Math.abs(c.y - (p.y + CELL * 0.34)) < 6
  ) as Text | undefined;

  if (!badge) {
    badge = new Text({ text: '', style: { fontSize: 18, fontWeight: '900', fill: 0xfff275 } as any });
    (badge as any).anchor?.set?.(0.5);
    badge.position.set(p.x, p.y + CELL * 0.34);
    fxLayer.addChild(badge);
  }
  badge.text = currentTotal.toLocaleString();
  return badge;
}

// ------------- SIMPLE HIT (original) + centered switch -------------
export async function animateHammerAction(opts: {
  fxLayer: Container;
  fromIdx: number;
  toIdx: number;
  smashed?: { at: number; amount: number };
  newTotalUnderHammer?: number;
  /** NEW: if true, ignore grid and celebrate at window center */
  centerOnWindow?: boolean;
  /** Optional viewport container (app.stage/root). Defaults to fxLayer. */
  viewportForCenter?: Container;
}): Promise<void> {
  const {
    fxLayer, fromIdx, toIdx, smashed, newTotalUnderHammer,
    centerOnWindow = false, viewportForCenter,
  } = opts;

  // choose target position
  const target = centerOnWindow
    ? getWindowCenterIn(fxLayer, viewportForCenter)
    : new Point(...Object.values(idxToXY(toIdx)) as [number, number]);

  const startP = centerOnWindow
    ? new Point(target.x + CELL * 1.6, target.y - CELL * 1.2) // enter from top-right relative to center
    : new Point(...Object.values(idxToXY(fromIdx)) as [number, number]);

  // temp hammer overlay normalized to cell size
  const hammer = makeCellSprite('hammer');
  const baseScaleX = hammer.scale.x;
  const baseScaleY = hammer.scale.y;
  const start = clampPos(startP.x, startP.y);
  hammer.position.set(start.x, start.y);
  hammer.zIndex = 9999;
  fxLayer.addChild(hammer);

  // straight slide
  await tween(140, (k) => {
    const t = easeOutCubic(k);
    const nx = lerp(startP.x, target.x, t);
    const ny = lerp(startP.y, target.y, t);
    const p = clampPos(nx, ny);
    hammer.position.set(p.x, p.y);
  });

  // arrival pop — non-cumulative
  await tween(90, (k) => {
    const t = easeOutCubic(k);
    const s = 1 + 0.06 * (1 - Math.abs(0.5 - t) * 2);
    hammer.scale.set(baseScaleX * s, baseScaleY * s);
  });

  // FX at chosen place
  await impactRingAt(fxLayer, target.x, target.y);

  if (smashed) {
    // if centered, show amount at center; otherwise at provided cell
    if (centerOnWindow) {
      await popAmountAt(fxLayer, target.x, target.y, smashed.amount);
    } else {
      await popAmount(fxLayer, smashed.at, smashed.amount);
    }
  }

  hammer.destroy();

  if (typeof newTotalUnderHammer === 'number') {
    // badge stays under original cell index for game logic
    ensureHammerBadge(fxLayer, toIdx, newTotalUnderHammer);
  }
}

// ------------- tiny compatibility pulse -------------
export async function shakeZoomHammerAndPig(opts: {
  fxLayer: Container;
  hammerObj?: Container;
  pigObj?: Container;
  hammerIdx?: number;
  pigIdx?: number;
  hammerTexKey?: string;
  pigTexKey?: string;
  ms?: number;
  shakePx?: number; // ignored
  zoomOut?: number; // ignored
}): Promise<void> {
  const {
    fxLayer,
    hammerIdx,
    pigIdx,
    hammerTexKey = 'hammer',
    pigTexKey = 'pig',
    ms = 200,
  } = opts;

  const spawn = (key: string, i?: number) => {
    if (typeof i !== 'number') return;
    const p = idxToXY(i);
    const s = makeCellSprite(key);
    s.position.set(p.x, p.y);
    fxLayer.addChild(s);
    return s;
  };

  const h = spawn(hammerTexKey, hammerIdx);
  const g = spawn(pigTexKey, pigIdx);

  await tween(ms, (k) => {
    const t = easeOutCubic(k);
    const f = 1 + 0.04 * (1 - Math.abs(0.5 - t) * 2); // 1→1.04→1
    h && h.scale.set(h.scale.x * f, h.scale.y * f);
    g && g.scale.set(g.scale.x * f, g.scale.y * f);
  });

  h?.destroy();
  g?.destroy();
}
