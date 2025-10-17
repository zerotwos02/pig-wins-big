// src/ui/components/InfoButton.ts
import { Container, Graphics, Text, Circle } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { GlowFilter } from '@pixi/filter-glow';
const GOLD_2 = 0xFFD479;
const GOLD_3 = 0xB68019;
const PURPLE = 0x4B007F;
export class InfoButton extends Container {
    constructor(radius = 18) {
        super();
        this.base = new Graphics();
        this.gloss = new Graphics();
        this.glyph = new Text({
            text: 'i',
            style: {
                fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
                fontSize: 18,
                fontWeight: '900',
                fill: 0xFFFFFF,
                stroke: { color: GOLD_3, width: 2, join: 'round' },
            },
        });
        this.glyph.anchor.set(0.5);
        this.build(radius);
        this.addChild(this.base, this.gloss, this.glyph);
        this.eventMode = 'static';
        this.cursor = 'pointer';
        this.hitArea = new Circle(0, 0, radius + 3);
        // depth
        this.filters = [new DropShadowFilter({ distance: 6, blur: 4, alpha: 0.45 })];
        // hover glow + scale (match +/- buttons)
        const hoverGlow = new GlowFilter({ color: GOLD_2, outerStrength: 1.4, innerStrength: 0, quality: 0.25 });
        this.on('pointerover', () => { this.scale.set(1.06); this.filters = [hoverGlow]; });
        this.on('pointerout', () => { this.scale.set(1.00); this.filters = [new DropShadowFilter({ distance: 6, blur: 4, alpha: 0.45 })]; });
        // press scale
        this.on('pointerdown', () => this.scale.set(0.94));
        // ✅ no custom emit; pointertap is the click
        // (your HUD will attach via onClick(fn) -> 'pointertap')
    }
    build(r) {
        this.base
            .clear()
            .circle(0, 0, r)
            .fill({ color: PURPLE, alpha: 1 })
            .stroke({ width: 4, color: GOLD_2, alpha: 1 });
        this.gloss
            .clear()
            .ellipse(0, -r * 0.35, r * 0.9, r * 0.55)
            .fill({ color: 0xFFFFFF, alpha: 0.18 });
    }
    /** Attach click handler (pointertap) */
    onClick(fn) {
        this.on('pointertap', fn);
    }
}
