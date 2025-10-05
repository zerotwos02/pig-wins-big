// src/ui/layouts/WinToast.ts
import { Container, Graphics, Text } from 'pixi.js';
import { WIN_TIERS } from '@/game/config';
import { App } from '@/core/app';

// ── utils ─────────────────────────────────────────────────────────────────────
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t: number, s = 1.70158) { return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function formatAmt(n: number) { return n.toLocaleString(); }

// tiny color helpers
const GOLD_SOFT = 0xffd34d;
const GOLD_DEEP = 0xffc235;
const GOLD_RICH = 0xffb000;
const GOLD_PALE = 0xfff7b2;

export class WinToast extends Container {
  private plate!: Graphics;
  private barBg!: Graphics;
  private barFg!: Graphics;
  private title!: Text;
  private amount!: Text;

  // shiny overlay: cloned text + moving mask band
  private shineText!: Text;
  private shineMask!: Graphics;

  // confetti particles (simple vector dots)
  private confettiLayer = new Container();
  private confetti: { g: Graphics; vx: number; vy: number; life: number; t0: number }[] = [];

  private rAF?: number;

  constructor() {
    super();
    this.visible = false;

    // backdrop plate
    this.plate = new Graphics()
      .roundRect(0, 0, 420, 120, 20)
      .fill({ color: 0x000000, alpha: 0.62 })
      .stroke({ width: 2, color: 0xffffff, alpha: 0.12 });
    this.plate.pivot.set(210, 60);
    this.addChild(this.plate);

    // title
    this.title = new Text({
      text: '',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 28,
        fontWeight: '800',
        fill: GOLD_PALE,
        dropShadow: { color: 0x000000, alpha: 0.6, distance: 2, blur: 4 },
      } as any
    });
    this.title.anchor.set(0.5, 0);
    this.title.position.set(0, -40);
    this.addChild(this.title);

    // amount (base)
    this.amount = new Text({
      text: '+0',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 44,
        fontWeight: '900',
        fill: 0xfff275,
        dropShadow: { color: 0x000000, alpha: 0.65, distance: 2, blur: 4 },
      } as any
    });
    this.amount.anchor.set(0.5);
    this.amount.position.set(0, 10);
    this.addChild(this.amount);

    // shiny overlay (white) + mask band (we animate the mask)
    this.shineText = new Text({
      text: '+0',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 44,
        fontWeight: '900',
        fill: 0xffffff,
      } as any
    });
    this.shineText.anchor.set(0.5);
    this.shineText.position.set(0, 10);
    this.shineText.alpha = 0.0; // off unless sweeping
    this.addChild(this.shineText);

    this.shineMask = new Graphics();
    this.shineText.mask = this.shineMask;
    this.addChild(this.shineMask);

    // progress to next tier
    this.barBg = new Graphics().roundRect(0, 0, 300, 10, 5).fill({ color: 0xffffff, alpha: 0.12 });
    this.barBg.pivot.set(150, 0);
    this.barBg.position.set(0, 52);
    this.addChild(this.barBg);

    this.barFg = new Graphics().roundRect(0, 0, 300, 10, 5).fill({ color: GOLD_SOFT, alpha: 0.95 });
    this.barFg.pivot.set(150, 0);
    this.barFg.position.set(0, 52);
    this.barFg.scale.x = 0;
    this.addChild(this.barFg);

    // confetti layer on top of bar/amount
    this.confettiLayer.position.set(0, 10);
    this.addChild(this.confettiLayer);
  }

  /** Show a toast; resolves when the animation completes */
  show(amount: number, stake: number): Promise<void> {
    if (amount <= 0 || stake <= 0) return Promise.resolve();

    // cancel any previous animation
    if (this.rAF) cancelAnimationFrame(this.rAF);
    this.clearConfetti();

    // compute tier by stake multiple
    const ratio = amount / stake;
    let tierIdx = -1;
    for (let i = 0; i < WIN_TIERS.length; i++) {
      if (ratio >= WIN_TIERS[i].mul) tierIdx = i;
    }
    const tier = tierIdx >= 0 ? WIN_TIERS[tierIdx] : null;
    const title = tier?.title ?? 'Win';

    // progress toward next tier (for the bar)
    const nextMul = WIN_TIERS[Math.min(tierIdx + 1, WIN_TIERS.length - 1)].mul;
    const prevMul = tierIdx >= 0 ? WIN_TIERS[tierIdx].mul : 0;
    const prog = clamp((ratio - prevMul) / Math.max(1e-6, nextMul - prevMul), 0, 1);

    // per-tier color tweak (subtle)
    const barColor =
      tierIdx >= 2 ? GOLD_RICH :
      tierIdx === 1 ? GOLD_DEEP :
      GOLD_SOFT;

    // durations scale with tier
    const durIn = 200;                                // punchier in
    const durCount = tierIdx < 0 ? 520 : 900 + tierIdx * 220;
    const hold = 560;
    const durOut = 260;

    // two glint sweeps across the amount during counting
    const shineDur = 380;
    const shineTimes = [
      durIn + durCount * 0.30,
      durIn + durCount * 0.72,
    ];
    let shineIndex = 0;
    let shineStart = -1;

    // confetti burst for medium+ tiers, at end of count
    const doConfetti = tierIdx >= 2;
    const confettiStart = durIn + durCount - 40; // start a hair before final value
    const confettiHoldMs = hold;                 // they fade during hold
    let confettiStarted = false;

    // layout
    const W = App.pixi.renderer.screen.width;
    const H = App.pixi.renderer.screen.height;
    this.position.set(W / 2, H * 0.18);

    this.title.text = title;
    this.amount.text = '+0';
    this.shineText.text = '+0';
    this.barFg.clear().roundRect(0, 0, 300, 10, 5).fill({ color: barColor, alpha: 0.95 });
    this.barFg.scale.x = 0;

    // reset state
    this.alpha = 0;
    this.scale.set(0.92);
    this.amount.scale.set(1);
    this.shineText.alpha = 0;
    this.shineMask.clear();

    this.visible = true;

    // animate
    const t0 = performance.now();
    const total = durIn + durCount + hold + durOut;
    let popped = false; // guard so we do the final pop once

    return new Promise<void>((resolve) => {
      const step = () => {
        const now = performance.now();
        const t = now - t0;

        // entrance
        if (t < durIn) {
          const k = t / durIn;
          this.alpha = k;
          const s = 0.92 + 0.10 * easeOutBack(k, 2.1); // slight overshoot
          this.scale.set(s);
        }
        // counting
        else if (t < durIn + durCount) {
          this.alpha = 1;
          this.scale.set(1);

          const k = (t - durIn) / durCount;
          const eased = easeOutCubic(k);
          const val = Math.floor(amount * eased);
          this.amount.text = `+${formatAmt(val)}`;
          this.shineText.text = this.amount.text;

          // progress bar fill
          this.barFg.scale.x = Math.max(0.06, prog * eased);

          // schedule/animate shine passes
          if (shineIndex < shineTimes.length) {
            if (shineStart < 0 && t >= shineTimes[shineIndex]) {
              shineStart = now;
              this.shineText.alpha = 0.85;
            }
          }
          if (shineStart >= 0) {
            const sT = (now - shineStart) / shineDur;
            if (sT >= 1) {
              // end this shine
              shineStart = -1;
              shineIndex++;
              this.shineText.alpha = 0.0;
              this.shineMask.clear();
            } else {
              // animate a vertical band moving left->right across the text bounds
              const w = Math.max(60, this.amount.width * 0.25);
              const h = Math.max(40, this.amount.height * 1.4);
              const bandW = Math.max(8, w * 0.18);
              const x0 = -w * 0.6;
              const x1 = +w * 0.6;
              const x = x0 + (x1 - x0) * easeOutCubic(sT);
              this.shineMask
                .clear()
                .rect(x - bandW / 2, -h / 2, bandW, h)
                .fill({ color: 0xffffff, alpha: 1 });
              // keep mask aligned with shine text
              this.shineMask.position.set(this.shineText.x, this.shineText.y);
            }
          }
        }
        // hold final value (with a quick pop on entry)
        else if (t < durIn + durCount + hold) {
          this.alpha = 1;
          this.scale.set(1);
          this.amount.text = `+${formatAmt(amount)}`;
          this.shineText.text = this.amount.text;
          this.barFg.scale.x = Math.max(0.06, prog);

          // trigger confetti once (for big tiers)
          if (doConfetti && !confettiStarted && t >= confettiStart) {
            confettiStarted = true;
            this.spawnConfettiBurst(14, barColor);
          }

          // one-time pop when we hit the final amount
          if (!popped) {
            popped = true;
            // quick bounce over ~180ms
            const since = t - (durIn + durCount);
            const popK = clamp(since / 180, 0, 1);
            const osc = Math.sin(popK * Math.PI); // up then down
            const s = 1 + 0.06 * osc;
            this.amount.scale.set(s);
            // keep animating pop while in early hold:
            if (popK < 1) {
              this.rAF = requestAnimationFrame(step);
              return;
            } else {
              this.amount.scale.set(1);
            }
          }

          // update confetti (fade during hold)
          if (confettiStarted) {
            const tHold = t - (durIn + durCount);
            const fade = 1 - clamp(tHold / confettiHoldMs, 0, 1);
            this.updateConfetti(1 / 60, fade); // ~frame step; not critical
          }
        }
        // fade out
        else if (t < total) {
          const k = (t - durIn - durCount - hold) / durOut;
          this.alpha = 1 - k;
          // let confetti keep drifting but fade with container alpha too
          if (confettiStarted) this.updateConfetti(1 / 60, (1 - k) * 0.6);
        }
        // done
        else {
          this.visible = false;
          this.clearConfetti();
          resolve();
          return;
        }

        this.rAF = requestAnimationFrame(step);
      };

      this.rAF = requestAnimationFrame(step);
    });
  }

  // ── confetti helpers ───────────────────────────────────────────────────────
  private spawnConfettiBurst(n: number, color: number) {
    this.clearConfetti();
    const palette = [color, 0xfff3b0, 0xffd479, 0xffea88];

    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      const c = palette[i % palette.length];
      const r = 2 + Math.random() * 2.5;
      g.circle(0, 0, r).fill({ color: c, alpha: 1 });
      g.x = (Math.random() - 0.5) * 60;
      g.y = 0;
      this.confettiLayer.addChild(g);

      const speed = 60 + Math.random() * 110;
      const ang = (-80 + Math.random() * 160) * (Math.PI / 180); // upward spread
      const vx = Math.cos(ang) * speed;
      const vy = Math.sin(ang) * speed - 10;
      this.confetti.push({ g, vx, vy, life: 700 + Math.random() * 450, t0: performance.now() });
    }
  }

  private updateConfetti(dt: number, alphaMul: number) {
    const now = performance.now();
    for (const p of this.confetti) {
      const age = now - p.t0;
      const t = clamp(age / p.life, 0, 1);
      // simple ballistic + drag
      const drag = 1 - t * 0.4;
      p.g.x += p.vx * drag * dt;
      p.g.y += (p.vy + 160 * t) * dt; // gravity-ish
      p.g.alpha = (1 - t) * alphaMul;
    }
  }

  private clearConfetti() {
    for (const p of this.confetti) p.g.destroy();
    this.confetti.length = 0;
    this.confettiLayer.removeChildren();
  }

  destroy(options?: any) {
    if (this.rAF) cancelAnimationFrame(this.rAF);
    this.clearConfetti();
    super.destroy(options);
  }
}
