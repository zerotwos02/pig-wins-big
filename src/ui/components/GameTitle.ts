// src/ui/components/GameTitle.ts
import { Container, Sprite, Ticker } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { GlowFilter } from '@pixi/filter-glow';

export type Rect = { x: number; y: number; width: number; height: number };

export class GameTitle extends Container {
  private spr: Sprite;

  // sizing controls
  private heightRatio = 0.32;
  private widthRatio  = 0.90;
  private scaleBias   = 1.00;
  private yOffsetRatio = 0.10;
  private maxPxHeight = 160;

  // bounce state
  private bounceActive = false;
  private bounce = { t: 0, speed: 0.7, ampY: 8, ampScale: 0.06 };
  private baseX = 0;
  private baseY = 0;

  constructor(alias: string = 'title_pigwins') {
    super();

    this.spr = Sprite.from(alias);
    this.spr.anchor.set(0, 0);
    this.addChild(this.spr);

    const shadow = new DropShadowFilter({ distance: 6, blur: 6, alpha: 0.5 }) as any;
    const glow   = new GlowFilter({ color: 0xFFD479, outerStrength: 0.6, innerStrength: 0 }) as any;
    (this as any).filters = [shadow, glow];

    this.eventMode = 'none';
  }

  setTitleOptions(opts: {
    heightRatio?: number; widthRatio?: number; scaleBias?: number; yOffsetRatio?: number; maxPxHeight?: number
  }) {
    if (opts.heightRatio  != null) this.heightRatio  = opts.heightRatio;
    if (opts.widthRatio   != null) this.widthRatio   = opts.widthRatio;
    if (opts.scaleBias    != null) this.scaleBias    = opts.scaleBias;
    if (opts.yOffsetRatio != null) this.yOffsetRatio = opts.yOffsetRatio;
    if (opts.maxPxHeight  != null) this.maxPxHeight  = opts.maxPxHeight;
  }

  setTextureAlias(alias: string) {
    this.spr.texture = Sprite.from(alias).texture;
  }

  /** Auto-place to the LEFT of the reels, respecting the footer */
  layout(viewW: number, viewH: number, reels: Rect, footerH: number, margin = 16) {
    const texW = this.spr.texture.width || 1;
    const texH = this.spr.texture.height || 1;

    const leftSpace = Math.max(0, reels.x - margin * 2);
    const maxW = leftSpace * this.widthRatio;
    const maxH = Math.min(reels.height * this.heightRatio, viewH - footerH - reels.y - margin, this.maxPxHeight);

    const fallbackW = Math.min(220, viewW * 0.25);

    let scale = (maxW > 0 && maxH > 0)
      ? Math.min(maxW / texW, maxH / texH)
      : Math.min(fallbackW / texW, 1);

    scale *= this.scaleBias;
    this.spr.scale.set(scale);

    // remember base position; bounce offsets from this
    const x = Math.max(margin, reels.x - margin - this.spr.width);
    const y = Math.round(reels.y + reels.height * this.yOffsetRatio);
    this.baseX = x;
    this.baseY = y;

    if (this.bounceActive) {
      const osc = Math.sin(this.bounce.t * 2 * Math.PI);
      const yOff = this.bounce.ampY * osc;
      this.position.set(this.baseX, this.baseY + yOff);
      const sx = 1 + this.bounce.ampScale * -osc;
      const sy = 1 + this.bounce.ampScale *  osc;
      this.scale.set(sx, sy);
    } else {
      this.position.set(this.baseX, this.baseY);
      this.scale.set(1, 1);
    }
  }

  /** Start an idle bounce loop */
  startBounceLoop(opts?: { speed?: number; ampY?: number; ampScale?: number }) {
    if (opts?.speed     != null) this.bounce.speed = opts.speed;
    if (opts?.ampY      != null) this.bounce.ampY = opts.ampY;
    if (opts?.ampScale  != null) this.bounce.ampScale = opts.ampScale;

    if (this.bounceActive) return;
    this.bounceActive = true;
    this.bounce.t = 0;

    Ticker.shared.add(this.onTick, this); // Pixi v7 expects (t: Ticker) callback
  }

  /** Stop the idle bounce and reset transforms */
  stopBounce() {
    if (!this.bounceActive) return;
    this.bounceActive = false;
    Ticker.shared.remove(this.onTick, this); //  remove with same signature/context
    this.position.set(this.baseX, this.baseY);
    this.scale.set(1, 1);
  }

  // Pixi v7 signature: receives the Ticker instance
  private onTick(t: Ticker) {
    if (!this.bounceActive) return;

    const dtSec = t.deltaMS / 1000;
    this.bounce.t += dtSec * this.bounce.speed;

    const osc = Math.sin(this.bounce.t * 2 * Math.PI);
    const yOff = this.bounce.ampY * osc;

    this.position.set(this.baseX, this.baseY + yOff);

    const sx = 1 + this.bounce.ampScale * -osc;
    const sy = 1 + this.bounce.ampScale *  osc;
    this.scale.set(sx, sy);
  }
}
