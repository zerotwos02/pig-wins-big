// src/ui/components/FeatureComplete.ts
import { Container, Graphics, Text } from 'pixi.js';
import { SFX } from '@/audio/sound-manager';

type PresentOpts = {
  onShownSfx?: string;   // e.g., 'bonus_finish'
  onClickSfx?: string;   // e.g., 'ui_click'
  title1?: string;       // default: 'LOCK & WIN'
  title2?: string;       // default: 'COMPLETE'
  sub?: string;          // default: 'YOU WIN'
  currencyPrefix?: string; // default: 'FUN'
};

export class FeatureCompleteModal extends Container {
  private dim = new Graphics();
  private panel = new Graphics();

  private title1: Text;
  private title2: Text;
  private sub: Text;
  private amount: Text;

  private okBtn = new Graphics();
  private okTxt: Text;

  constructor() {
    super();
    this.sortableChildren = true;

    // Titles styled to match FeatureIntro (same family, heavy stroke)
    this.title1 = new Text({
      text: 'LOCK & WIN',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 60,
        fontWeight: '900',
        fill: ['#FFA800', '#FF2F2F', '#8B0000'],
        fillGradientStops: [0, 0.4, 1],
        stroke: { color: 0x000000, width: 6 } as any,
        align: 'center',
      } as any,
    });
    this.title1.anchor.set(0.5);

    this.title2 = new Text({
      text: 'COMPLETE',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 64,
        fontWeight: '900',
        fill: ['#FFA800', '#FF2F2F', '#8B0000'],
        fillGradientStops: [0, 0.4, 1],
        stroke: { color: 0x000000, width: 6 } as any,
        align: 'center',
      } as any,
    });
    this.title2.anchor.set(0.5);

    this.sub = new Text({
      text: 'YOU WIN',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 48,
        fontWeight: '900',
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 6 } as any,
        align: 'center',
      } as any,
    });
    this.sub.anchor.set(0.5);

    this.amount = new Text({
      text: 'FUN0.00',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 64,
        fontWeight: '900',
        fill: 0xffff7a,
        stroke: { color: 0x000000, width: 6 } as any,
        align: 'center',
      } as any,
    });
    this.amount.anchor.set(0.5);

    // OK button (same vibe as intro button with hover/press)
    this.okTxt = new Text({
      text: 'OK',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 40,
        fontWeight: '900',
        fill: 0x113300,
        stroke: { color: 0x073600, width: 3 } as any,
      } as any,
    });
    this.okTxt.anchor.set(0.5);

    this.okBtn.eventMode = 'static';
    this.okBtn.cursor = 'pointer';
    this.okBtn.on('pointerover', () => this.okBtn.scale.set(1.04));
    this.okBtn.on('pointerout',  () => this.okBtn.scale.set(1.00));
    this.okBtn.on('pointerdown', () => this.okBtn.scale.set(0.96));
    this.okBtn.on('pointerup',   () => this.okBtn.scale.set(1.04));

    this.addChild(
      this.dim, this.panel,
      this.title1, this.title2, this.sub, this.amount,
      this.okBtn, this.okTxt
    );

    this.visible = false;
    this.alpha = 0;
  }

  layout(x: number, y: number, w: number, h: number) {
    // Dim background
    this.dim.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.65 });
    this.dim.position.set(0, 0);

    // Panel frame (transparent center, golden stroke)
    this.panel.clear()
      .roundRect(x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.56, 20)
      .stroke({ width: 6, color: 0xFFCC55, alpha: 0.25 });

    const cx = x + w / 2;
    const cy = y + h * 0.38;

    this.title1.position.set(cx, cy - 105);
    this.title2.position.set(cx, cy - 42);
    this.sub.position.set(cx, cy + 22);
    this.amount.position.set(cx, cy + 90);

    // OK button
    const bw = 220, bh = 78;
    this.okBtn.clear()
      .roundRect(0, 0, bw, bh, 20)
      .fill({ color: 0x3be63b })
      .stroke({ width: 6, color: 0x126b12 });
    this.okBtn.pivot.set(bw / 2, bh / 2);
    this.okBtn.position.set(cx, cy + 170);

    this.okTxt.position.set(this.okBtn.x, this.okBtn.y);
  }

  /** Show the modal, set amount, wait for OK click. */
  async present(totalFun: number, opts: PresentOpts = {}): Promise<void> {
    const {
      onShownSfx, onClickSfx,
      title1 = 'LOCK & WIN',
      title2 = 'COMPLETE',
      sub = 'YOU WIN',
      currencyPrefix = 'FUN',
    } = opts;

    this.title1.text = title1;
    this.title2.text = title2;
    this.sub.text = sub;

    const formatted = `${currencyPrefix}${totalFun.toLocaleString('fr-FR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`;
    this.amount.text = formatted;

    // pop-in (same feel as intro)
    this.visible = true;
    this.alpha = 0;
    this.scale.set(0.97);
    const t0 = performance.now();
    await new Promise<void>((res) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 220);
        const ease = 1 - Math.pow(1 - k, 3);
        this.alpha = ease;
        this.scale.set(0.97 + 0.03 * ease);
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });

    try { if (onShownSfx) { await SFX.ready; SFX.play(onShownSfx as any); } } catch {}

    // Wait for click
    await new Promise<void>((resolve) => {
      const click = async () => {
        try { if (onClickSfx) { await SFX.ready; SFX.play(onClickSfx as any); } } catch {}
        // tiny press-out
        const t1 = performance.now();
        const startScale = this.scale.x;
        const endScale = 0.98;
        const dur = 120;
        const tick = () => {
          const k = Math.min(1, (performance.now() - t1) / dur);
          this.scale.set(startScale + (endScale - startScale) * k);
          if (k < 1) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      };
      this.okBtn.once('pointertap', click);
    });

    // fade out
    const t2 = performance.now();
    await new Promise<void>((res) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t2) / 160);
        this.alpha = 1 - k;
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });

    this.visible = false;
  }

  dispose() {
    this.removeAllListeners();
    this.removeFromParent();
    this.destroy({ children: true });
  }
}
