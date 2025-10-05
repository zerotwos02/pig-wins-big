// src/ui/components/HUD.ts
import { Container } from 'pixi.js';
import { Footer } from '@/ui/layouts/footer';          // ✅ match file casing
import { SpinButton } from '@/ui/components/SpinButton';
import { GameTitle } from '@/ui/components/GameTitle';

export type Rect = { x: number; y: number; width: number; height: number };

export class HUD extends Container {
  readonly footer = new Footer();
  readonly spin   = new SpinButton('SPIN');            // accepts 0 or 1 arg
  readonly title  = new GameTitle();                   // uses alias 'title_pigwins'

  private reelsRect?: Rect;

  constructor() {
    super();
    this.sortableChildren = true;

    // draw order: title (0), footer (1), spin (2)
    this.title.zIndex  = 0;
    this.footer.zIndex = 1;
    this.spin.zIndex   = 2;

    // make the title smaller by default (tweak if you want)
    this.title.setTitleOptions({
      heightRatio: 0.90,    // fraction of reels height
      widthRatio: 0.90,     // fraction of left space
      //scaleBias: 0.95,      // extra shrink
      yOffsetRatio: 0.07,   // 10% down from reels top
    });

    this.addChild(this.title, this.footer, this.spin);
  }

  /** Scene should call this after sizing/positioning the reels area */
  setReelsRect(rect: Rect) {
    this.reelsRect = rect;
  }

  /** Call at boot and on resize */
  layout(viewW: number, viewH: number) {
    // place spin first so footer reserves space properly
    this.spin.layout(viewW, viewH, this.footer.heightPx, /* right margin */ 12);
    this.footer.layout(viewW, viewH, this.spin.visualWidth + 10);

    // title hugs the left side of reels (only if we know the reels rect)
    if (this.reelsRect) {
      this.title.layout(viewW, viewH, this.reelsRect, this.footer.heightPx, /* margin */ 50);
      this.title.setTitleOptions({ heightRatio: 0.30, scaleBias: 0.95, maxPxHeight: 140 });
      this.title.startBounceLoop({ speed: 0.7, ampY: 6, ampScale: 0.045 }); // subtle
    }
  }

  /** Optional: disable spin during base spin */
  setSpinning(isSpinning: boolean) {
    this.spin.setEnabled(!isSpinning);
  }
}
