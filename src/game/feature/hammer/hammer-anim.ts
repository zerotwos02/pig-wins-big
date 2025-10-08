import {
  Container,
  Graphics,
  Text,
  Sprite,
  Point,
  Texture,
  AnimatedSprite,
} from 'pixi.js';
import { CELL, GRID_COLS, GRID_ROWS } from '@/game/config';
import { SFX } from '@/audio/sound-manager';

// ---------------- small SFX helper ----------------
async function sfx(name: string, opts?: any) {
  try {
    await SFX.ready;
    // @ts-ignore: sound manager may accept extra opts like volume, rate, detune
    SFX.play(name, opts || {});
  } catch {}
}

// ---------------- math & helpers ----------------
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

function getWindowCenterIn(layer: Container, viewport?: Container): Point {
  const src = viewport ?? layer;
  const gb = src.getBounds();
  const gc = new Point(gb.x + gb.width / 2, gb.y + gb.height / 2);
  return layer.toLocal(gc);
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

// ---------------- impact ring & number pops ----------------
export async function impactRingAt(fxLayer: Container, x: number, y: number): Promise<void> {
  const ring = new Graphics();
  ring.zIndex = 1000;
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

export async function popAmountAt(
  fxLayer: Container, x: number, y: number, amount: number
): Promise<void> {
  const txt = new Text({
    text: `+${amount.toLocaleString()}`,
    style: { fontSize: 22, fontWeight: '900', fill: 0xffffff } as any,
  });
  (txt as any).anchor?.set?.(0.5);
  txt.position.set(x, y);
  txt.alpha = 0;
  txt.zIndex = 1100;
  fxLayer.addChild(txt);

  await tween(120, (k) => {
    const t = easeOutCubic(k);
    txt.alpha = t;
    txt.scale.set(0.9 + 0.1 * t);
  });

  await tween(260, (k) => {
    const t = easeOutCubic(k);
    txt.y = y - 10 - 16 * t;
    txt.alpha = 1 - 0.9 * t;
  });

  txt.destroy();
}

// ---------------- bigger pink burst & value token ----------------
export async function pinkBurstAtCell(
  fxLayer: Container,
  atIdx: number,
  opts?: { count?: number; lifeMs?: number; size?: number }
): Promise<void> {
  const { x, y } = idxToXY(atIdx);
  const count  = opts?.count  ?? 26;
  const lifeMs = opts?.lifeMs ?? 420;
  const size   = opts?.size   ?? 1.8;

  sfx('spark_burst', { volume: 0.65 });

  for (let i = 0; i < count; i++) {
    const g = new Graphics();
    const r = (3.2 + Math.random() * 2.2) * size;
    g.circle(0, 0, r).fill(0xff79b2);
    g.position.set(x, y);
    g.alpha = 1;
    g.zIndex = 1000;
    fxLayer.addChild(g);

    const angle   = Math.random() * Math.PI * 2;
    const speed   = (280 + Math.random() * 200) * size;
    const vx      = Math.cos(angle) * speed;
    const vy0     = Math.sin(angle) * speed;
    const gravity = 560 * (size * 0.85);

    const t0 = performance.now();
    const step = () => {
      const elapsed = (performance.now() - t0) / 1000;
      const k = Math.min(1, (performance.now() - t0) / lifeMs);

      const vy = vy0 + gravity * elapsed * 0.6;
      g.x = x + vx * elapsed;
      g.y = y + vy * elapsed;

      g.alpha = 1 - k;
      const s = 1 - 0.5 * k;
      g.scale.set(s);

      if (k < 1) requestAnimationFrame(step);
      else g.destroy();
    };
    requestAnimationFrame(step);
  }

  await new Promise<void>((r) => setTimeout(r, lifeMs));
}

export async function showValueTokenAtCell(
  fxLayer: Container,
  atIdx: number,
  amount: number,
  msVisible = 800
): Promise<void> {
  const { x, y } = idxToXY(atIdx);

  const plate = new Graphics()
    .roundRect(-CELL * 0.34, -CELL * 0.2, CELL * 0.68, CELL * 0.4, 10)
    .fill({ color: 0x101010, alpha: 0.92 })
    .stroke({ width: 2, color: 0xffc74d, alpha: 0.98 });

  const txt = new Text({
    text: `$${amount.toLocaleString()}`,
    style: { fontSize: 24, fontWeight: '900', fill: 0xffffff } as any,
  });
  (txt as any).anchor?.set?.(0.5);

  const root = new Container();
  root.position.set(x, y);
  root.alpha = 0;
  root.zIndex = 1100;
  root.addChild(plate, txt);
  fxLayer.addChild(root);

  // pop in
  await (async () => {
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 140);
        const t = easeOutCubic(k);
        root.alpha = t;
        root.scale.set(0.9 + 0.1 * t);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  })();

  sfx('win_tick', { volume: 0.9 });

  await new Promise<void>((r) => setTimeout(r, msVisible));

  // fade out
  await (async () => {
    const t1 = performance.now();
    await new Promise<void>((resolve) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t1) / 160);
        root.alpha = 1 - k;
        root.scale.set(1 - 0.06 * k);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  })();

  root.destroy({ children: true });
}

// ---------------- main hammer animation w/ anticipation & impact gate ----------------
export async function animateHammerAction(opts: {
  fxLayer: Container;
  fromIdx: number;
  toIdx: number;
  smashed?: { at: number; amount: number };
  /** Called EXACTLY at impact; do squash/remove here. */
  onImpact?: () => void | Promise<void>;
  newTotalUnderHammer?: number;
  centerOnWindow?: boolean;
  viewportForCenter?: Container;
  rotateDuringMove?: boolean; // default true
  showAmount?: boolean;       // default false (avoid duplicates)
  anticipation?: boolean;     // default true (pull back then strike)
  impactBurst?: { count?: number; size?: number } | false; // default {..}
  /** Optional: resolve this when the pig finished appearing. */
  impactGate?: Promise<void>;
  /** 1 = current speed; <1 = slower (e.g., 0.7), >1 = faster */
  speed?: number;
}): Promise<void> {
  const {
    fxLayer, fromIdx, toIdx, smashed, newTotalUnderHammer,
    centerOnWindow = false, viewportForCenter,
    rotateDuringMove = true,
    showAmount = false,
    anticipation = true,
    impactBurst = { count: 28, size: 1.9 },
    impactGate,
    speed = 0.75, // slower overall default
    onImpact,
  } = opts;

  const sp = Math.max(0.2, speed);  // clamp
  const scaleDur = (ms: number) => Math.round(ms / sp);

  const target = centerOnWindow
    ? getWindowCenterIn(fxLayer, viewportForCenter)
    : new Point(...Object.values(idxToXY(toIdx)) as [number, number]);

  const startP = centerOnWindow
    ? new Point(target.x + CELL * 1.6, target.y - CELL * 1.2)
    : new Point(...Object.values(idxToXY(fromIdx)) as [number, number]);

  const hammer = makeCellSprite('hammer');
  const baseScaleX = hammer.scale.x;
  const baseScaleY = hammer.scale.y;
  const start = clampPos(startP.x, startP.y);
  hammer.position.set(start.x, start.y);
  hammer.zIndex = 1000;

  if (rotateDuringMove) {
    const dx = target.x - startP.x;
    const dy = target.y - startP.y;
    hammer.rotation = Math.atan2(dy, dx);
  }
  fxLayer.addChild(hammer);

  // 0) Approach in two phases (A: 85% path, B: hover near target)
  const phaseA = new Point(
    lerp(startP.x, target.x, 0.85),
    lerp(startP.y, target.y, 0.85),
  );

  await tween(scaleDur(220), (k) => {
    const t = easeOutCubic(k);
    hammer.position.set(
      lerp(startP.x, phaseA.x, t),
      lerp(startP.y, phaseA.y, t),
    );
  });

  const hoverPos = new Point(
    lerp(phaseA.x, target.x, 0.06),
    lerp(phaseA.y, target.y, 0.06),
  );
  await tween(scaleDur(140), (k) => {
    const t = easeOutCubic(k);
    hammer.position.set(
      lerp(phaseA.x, hoverPos.x, t),
      lerp(phaseA.y, hoverPos.y, t),
    );
  });

  // 1) Optional anticipation pull-back
  const prevRot = hammer.rotation;
  if (anticipation) {
    const back = new Point(
      lerp(hoverPos.x, target.x, -0.24),
      lerp(hoverPos.y, target.y, -0.24),
    );
    sfx('hammer_draw', { volume: 0.6 });
    await tween(scaleDur(160), (k) => {
      const t = easeOutCubic(k);
      hammer.position.set(
        lerp(hoverPos.x, back.x, t),
        lerp(hoverPos.y, back.y, t),
      );
      hammer.scale.set(baseScaleX * (1.02 - 0.04 * t), baseScaleY * (1.02 - 0.04 * t));
      if (rotateDuringMove) hammer.rotation = prevRot - (Math.PI / 18) * t;
    });
  }

  // 2) Wait for pig to finish appearing if provided
  if (impactGate) {
    try { await impactGate; } catch {}
  }

  // 3) Final strike to target
  sfx('hammer_whoosh', { volume: 0.75 });
  await tween(scaleDur(150), (k) => {
    const t = easeOutCubic(k);
    hammer.position.set(
      lerp(hammer.position.x, target.x, t),
      lerp(hammer.position.y, target.y, t),
    );
    if (rotateDuringMove) hammer.rotation = prevRot + (Math.PI / 10) * t;
  });

  // 4) Impact — call hook BEFORE any pop/burst so pig stays visible until now
  sfx('hammer_hit', { volume: 0.9 });
  if (onImpact) {
    try { await onImpact(); } catch {}
  }

  // 5) Overswing & post-hit effects
  const impactRot = hammer.rotation;
  await tween(scaleDur(140), (k) => {
    const t = easeOutCubic(k);
    const s = 1 + 0.08 * (1 - Math.abs(0.5 - t) * 2);
    hammer.scale.set(baseScaleX * s, baseScaleY * s);
    if (rotateDuringMove) {
      const overshoot = (Math.PI / 14) * (1 - Math.abs(0.5 - t) * 2);
      hammer.rotation = impactRot + overshoot;
    }
  });

  await impactRingAt(fxLayer, target.x, target.y);

  if (impactBurst) {
    await pinkBurstAtCell(
      fxLayer,
      toIdx,
      { count: impactBurst.count ?? 28, size: impactBurst.size ?? 1.9 }
    );
  }

  if (smashed && showAmount) {
    if (centerOnWindow) {
      await popAmountAt(fxLayer, target.x, target.y, smashed.amount);
    } else {
      const p = idxToXY(smashed.at);
      await popAmountAt(fxLayer, p.x, p.y, smashed.amount);
    }
  }

  hammer.destroy();

  if (typeof newTotalUnderHammer === 'number') {
    ensureHammerBadge(fxLayer, toIdx, newTotalUnderHammer);
  }
}

export function ensureHammerBadge(fxLayer: Container, atIdx: number, currentTotal: number): Text {
  const p0 = idxToXY(atIdx);
  let badge = fxLayer.children.find(
    (c) => c instanceof Text && Math.abs(c.x - p0.x) < 4 && Math.abs(c.y - (p0.y + CELL * 0.34)) < 6
  ) as Text | undefined;

  if (!badge) {
    badge = new Text({ text: '', style: { fontSize: 18, fontWeight: '900', fill: 0xfff275 } as any });
    (badge as any).anchor?.set?.(0.5);
    badge.position.set(p0.x, p0.y + CELL * 0.34);
    badge.zIndex = 1050;
    fxLayer.addChild(badge);
  }
  badge.text = currentTotal.toLocaleString();
  return badge;
}

// ---- optional flipbook explosion support ----
function getFlipbookFrames(prefix: string, max = 32): Texture[] {
  const frames: Texture[] = [];
  for (let i = 0; i < max; i++) {
    const key = `${prefix}_${String(i).padStart(3, '0')}`;
    const tex = Texture.from(key);
    const w = (tex as any)?.frame?.width ?? tex.width ?? 0;
    const h = (tex as any)?.frame?.height ?? tex.height ?? 0;
    if (!w || !h) break;
    frames.push(tex);
  }
  return frames;
}

export async function playPigExplosion(opts: {
  fxLayer: Container;
  atIdx: number;
  prefix?: string;
  fps?: number;
  withSparks?: boolean;
}): Promise<void> {
  const {
    fxLayer,
    atIdx,
    prefix = 'pig_explode',
    fps = 24,
    withSparks = true,
  } = opts;

  const p = idxToXY(atIdx);
  const frames = getFlipbookFrames(prefix, 32);

  if (frames.length > 0) {
    const anim = new AnimatedSprite(frames);
    anim.anchor.set(0.5);
    const target = CELL * 0.95;
    const w = (frames[0] as any)?.frame?.width ?? frames[0].width ?? 1;
    const h = (frames[0] as any)?.frame?.height ?? frames[0].height ?? 1;
    const scale = Math.min(target / w, target / h);
    anim.scale.set(scale);
    anim.position.set(p.x, p.y);
    anim.animationSpeed = fps / 60;
    anim.loop = false;
    anim.zIndex = 1100;
    fxLayer.addChild(anim);

    sfx('spark_burst', { volume: 0.7 });

    anim.play();

    if (withSparks) void pinkBurstAtCell(fxLayer, atIdx, { count: 22, lifeMs: 380, size: 1.8 });

    await new Promise<void>((resolve) => {
      anim.onComplete = () => {
        anim.destroy();
        resolve();
      };
    });
  } else {
    sfx('spark_burst', { volume: 0.7 });
    await pinkBurstAtCell(fxLayer, atIdx, { count: 22, lifeMs: 380, size: 1.8 });
  }
}
