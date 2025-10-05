// src/ui/components/InfoButton.ts
import { Container, Graphics, Text, Circle } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { GlowFilter } from '@pixi/filter-glow';

const GOLD_2 = 0xFFD479;
const GOLD_3 = 0xB68019;
const PURPLE = 0x4B007F;

export class InfoButton extends Container {
  private base = new Graphics();
  private gloss = new Graphics();
  private glyph = new Text({
    text: 'i',
    style: {
      fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
      fontSize: 18,
      fontWeight: '900',
      fill: 0xFFFFFF,
      stroke: { color: GOLD_3, width: 2, join: 'round' } as any,
    } as any,
  });

  constructor(radius = 18) {
    super();

    this.glyph.anchor.set(0.5);
    this.build(radius);
    this.addChild(this.base, this.gloss, this.glyph);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Circle(0, 0, radius + 3);

    // depth
    this.filters = [ new DropShadowFilter({ distance: 6, blur: 4, alpha: 0.45 }) as any ];

    // hover glow + scale (match +/- buttons)
    const hoverGlow = new GlowFilter({ color: GOLD_2, outerStrength: 1.4, innerStrength: 0, quality: 0.25 }) as any;
    this.on('pointerover', () => { this.scale.set(1.06); (this as any).filters = [hoverGlow]; });
    this.on('pointerout',  () => { this.scale.set(1.00); (this as any).filters = [ new DropShadowFilter({ distance: 6, blur: 4, alpha: 0.45 }) as any ]; });

    // press scale
    this.on('pointerdown', () => this.scale.set(0.94));

    // ✅ no custom emit; pointertap is the click
    // (your HUD will attach via onClick(fn) -> 'pointertap')
  }

  private build(r: number) {
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
  onClick(fn: () => void) {
    this.on('pointertap', fn);
  }
}
