// src/ui/components/FeatureComplete.ts
import { Container, Graphics, Text } from 'pixi.js';
import { SFX } from '@/audio/sound-manager';
import { sound as pixiSound } from '@pixi/sound';

type PresentOpts = {
  onShownSfx?: string;      // default: 'onShown'
  onClickSfx?: string;      // default: 'ui_click'
  title1?: string;          // default: 'LOCK & WIN'
  title2?: string;          // default: 'COMPLETE'
  sub?: string;             // default: 'YOU WIN'
  currencyPrefix?: string;  // default: 'FUN'
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

    // Titles
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

    // OK button
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
    // Background & frame
    this.dim.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.65 });
    this.dim.position.set(0, 0);

    this.panel.clear()
      .roundRect(x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.56, 20)
      .stroke({ width: 6, color: 0xFFCC55, alpha: 0.25 });

    const cx = x + w / 2;
    const cy = y + h * 0.38;

    this.title1.position.set(cx, cy - 105);
    this.title2.position.set(cx, cy - 42);
    this.sub.position.set(cx, cy + 22);
    this.amount.position.set(cx, cy + 90);

    const bw = 220, bh = 78;
    this.okBtn.clear()
      .roundRect(0, 0, bw, bh, 20)
      .fill({ color: 0x3be63b })
      .stroke({ width: 6, color: 0x126b12 });
    this.okBtn.pivot.set(bw / 2, bh / 2);
    this.okBtn.position.set(cx, cy + 170);

    this.okTxt.position.set(this.okBtn.x, this.okBtn.y);
  }

  /** Pop: play onShown. OK: click + onShown, stop bg_lockandwin, start bg_music (no fades). */
  async present(totalFun: number, opts: PresentOpts = {}): Promise<void> {
    const {
      onShownSfx = 'onShown',
      onClickSfx = 'ui_click',
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

    // Show immediately (keep simple)
    this.visible = true;
    this.alpha = 1;
    this.scale.set(1);

    // Stinger on pop
    try { await SFX.ready; if (onShownSfx) SFX.play('onShown' as any); } catch {}

    // Wait for OK
    await new Promise<void>((resolve) => {
      const click = async () => {
        try {
          await SFX.ready;

          // Click + stinger again
          if (onClickSfx) SFX.play(onClickSfx as any);
          if (onShownSfx) SFX.play(onShownSfx as any);

          // Stop any ambient loop if used elsewhere
          try { SFX.stop('info_loop' as any); } catch {}

          // 1) STOP feature bg immediately
          try { SFX.stop('bg_lockandwin' as any); } catch {}

          // 2) Make sure audio context & mute are not blocking playback
          try { pixiSound.resumeAll(); } catch {}
          try { pixiSound.unmuteAll(); } catch {}

          // 3) Ensure alias is audible at the sound level
          try {
            const snd: any = (pixiSound as any).find?.('bg_music') ?? (pixiSound as any)._sounds?.['bg_music'];
            if (snd) snd.volume = 0.25;
          } catch {}

          // 4) PLAY bg_music as a fresh single instance (loop is defined at add-time)
          try { (pixiSound as any).play?.('bg_music', { singleInstance: true, volume: 0.25, loop: true }); } catch {}

          // Optional: also go through SFX surface if you prefer
          // try { (SFX as any).play('bg_music', { singleInstance: true, volume: 0.25 }); } catch {}
        } finally {
          resolve();
        }
      };
      this.okBtn.once('pointertap', click);
    });

    this.visible = false;
  }

  dispose() {
    this.removeAllListeners();
    this.removeFromParent();
    this.destroy({ children: true });
  }
}