// src/ui/components/GameTitle.ts
import { Container, Sprite, Ticker } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { GlowFilter } from '@pixi/filter-glow';
export class GameTitle extends Container {
    constructor(alias = 'title_pigwins') {
        super();
        // sizing controls
        this.heightRatio = 0.32;
        this.widthRatio = 0.90;
        this.scaleBias = 1.00;
        this.yOffsetRatio = 0.10;
        this.maxPxHeight = 160;
        // bounce state
        this.bounceActive = false;
        this.bounce = { t: 0, speed: 0.7, ampY: 8, ampScale: 0.06 };
        this.baseX = 0;
        this.baseY = 0;
        this.spr = Sprite.from(alias);
        this.spr.anchor.set(0, 0);
        this.addChild(this.spr);
        const shadow = new DropShadowFilter({ distance: 6, blur: 6, alpha: 0.5 });
        const glow = new GlowFilter({ color: 0xFFD479, outerStrength: 0.6, innerStrength: 0 });
        this.filters = [shadow, glow];
        this.eventMode = 'none';
    }
    setTitleOptions(opts) {
        if (opts.heightRatio != null)
            this.heightRatio = opts.heightRatio;
        if (opts.widthRatio != null)
            this.widthRatio = opts.widthRatio;
        if (opts.scaleBias != null)
            this.scaleBias = opts.scaleBias;
        if (opts.yOffsetRatio != null)
            this.yOffsetRatio = opts.yOffsetRatio;
        if (opts.maxPxHeight != null)
            this.maxPxHeight = opts.maxPxHeight;
    }
    setTextureAlias(alias) {
        this.spr.texture = Sprite.from(alias).texture;
    }
    /** Auto-place to the LEFT of the reels, respecting the footer */
    layout(viewW, viewH, reels, footerH, margin = 16) {
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
            const sy = 1 + this.bounce.ampScale * osc;
            this.scale.set(sx, sy);
        }
        else {
            this.position.set(this.baseX, this.baseY);
            this.scale.set(1, 1);
        }
    }
    /** Start an idle bounce loop */
    startBounceLoop(opts) {
        if (opts?.speed != null)
            this.bounce.speed = opts.speed;
        if (opts?.ampY != null)
            this.bounce.ampY = opts.ampY;
        if (opts?.ampScale != null)
            this.bounce.ampScale = opts.ampScale;
        if (this.bounceActive)
            return;
        this.bounceActive = true;
        this.bounce.t = 0;
        Ticker.shared.add(this.onTick, this); // ✅ Pixi v7 expects (t: Ticker) callback
    }
    /** Stop the idle bounce and reset transforms */
    stopBounce() {
        if (!this.bounceActive)
            return;
        this.bounceActive = false;
        Ticker.shared.remove(this.onTick, this); // ✅ remove with same signature/context
        this.position.set(this.baseX, this.baseY);
        this.scale.set(1, 1);
    }
    // ✅ Pixi v7 signature: receives the Ticker instance
    onTick(t) {
        if (!this.bounceActive)
            return;
        const dtSec = t.deltaMS / 1000;
        this.bounce.t += dtSec * this.bounce.speed;
        const osc = Math.sin(this.bounce.t * 2 * Math.PI);
        const yOff = this.bounce.ampY * osc;
        this.position.set(this.baseX, this.baseY + yOff);
        const sx = 1 + this.bounce.ampScale * -osc;
        const sy = 1 + this.bounce.ampScale * osc;
        this.scale.set(sx, sy);
    }
}
