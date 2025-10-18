// src/ui/components/FeatureComplete.ts
import { Container, Graphics, Text } from 'pixi.js';
import { SFX } from '@/audio/sound-manager';
import { sound as pixiSound } from '@pixi/sound';

type PresentOpts = {
  onShownSfx?: string;      // optional one-shot stinger when modal appears
  onClickSfx?: string;      // click sound for OK button
  title1?: string;          // first title line (e.g., "LOCK & WIN")
  title2?: string;          // second title line (e.g., "COMPLETE")
  sub?: string;             // subtitle above the amount (e.g., "YOU WIN")
  currencyPrefix?: string;  // currency label (e.g., "FUN")
};

export class FeatureCompleteModal extends Container {
  private dim = new Graphics();   // full-screen dim backdrop
  private panel = new Graphics(); // framed panel outline

  private title1: Text;           // top title (row 1)
  private title2: Text;           // top title (row 2)
  private sub: Text;              // "YOU WIN"
  private amount: Text;           // formatted amount text

  private okBtn = new Graphics(); // green rounded button
  private okTxt: Text;            // "OK" label centered on the button

  constructor() {
    super();
    this.sortableChildren = true;

    // Titles (gold/red gradient + black stroke)
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

    // Subtitle + amount (white/yellow with stroke)
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

    // OK button visuals + interactions
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

    // basic hover/press feedback via scaling
    this.okBtn.eventMode = 'static';
    this.okBtn.cursor = 'pointer';
    this.okBtn.on('pointerover', () => this.okBtn.scale.set(1.04));
    this.okBtn.on('pointerout',  () => this.okBtn.scale.set(1.00));
    this.okBtn.on('pointerdown', () => this.okBtn.scale.set(0.96));
    this.okBtn.on('pointerup',   () => this.okBtn.scale.set(1.04));

    // draw order: backdrop, panel, titles, amount, button, label
    this.addChild(
      this.dim, this.panel,
      this.title1, this.title2, this.sub, this.amount,
      this.okBtn, this.okTxt
    );

    // hidden by default; present() will show instantly
    this.visible = false;
    this.alpha = 0;
  }

  // Compute positions and redraw shapes based on viewport
  layout(x: number, y: number, w: number, h: number) {
    // Background & frame
    this.dim.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.65 });
    this.dim.position.set(0, 0);

    this.panel.clear()
      .roundRect(x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.56, 20)
      .stroke({ width: 6, color: 0xFFCC55, alpha: 0.25 });

    // Center coordinates for text/button cluster
    const cx = x + w / 2;
    const cy = y + h * 0.38;

    // Title/sub/amount vertical stack
    this.title1.position.set(cx, cy - 105);
    this.title2.position.set(cx, cy - 42);
    this.sub.position.set(cx, cy + 22);
    this.amount.position.set(cx, cy + 90);

    // Button geometry centered under amount
    const bw = 220, bh = 78;
    this.okBtn.clear()
      .roundRect(0, 0, bw, bh, 20)
      .fill({ color: 0x3be63b })
      .stroke({ width: 6, color: 0x126b12 });
    this.okBtn.pivot.set(bw / 2, bh / 2);
    this.okBtn.position.set(cx, cy + 170);

    // Label sits atop button center
    this.okTxt.position.set(this.okBtn.x, this.okBtn.y);
  }

  /** Pop: play onShown. OK: click + onShown, stop bg_lockandwin, start bg_music (no fades). */
  async present(totalFun: number, opts: PresentOpts = {}): Promise<void> {
    const {
      onShownSfx = 'onShown',  // stinger when modal appears
      onClickSfx = 'ui_click', // click feedback for OK
      title1 = 'LOCK & WIN',
      title2 = 'COMPLETE',
      sub = 'YOU WIN',
      currencyPrefix = 'FUN',
    } = opts;

    // Update texts
    this.title1.text = title1;
    this.title2.text = title2;
    this.sub.text = sub;

    // Format amount with 2 decimals (FR locale) and prefix
    const formatted = `${currencyPrefix}${totalFun.toLocaleString('fr-FR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`;
    this.amount.text = formatted;

    // Show immediately (no entrance tween here)
    this.visible = true;
    this.alpha = 1;
    this.scale.set(1);

    // Stinger on pop (optional)
    try { await SFX.ready; if (onShownSfx) SFX.play('onShown' as any); } catch {}

    // Wait for OK tap/click, then handle audio handoff and resolve
    await new Promise<void>((resolve) => {
      const click = async () => {
        try {
          await SFX.ready;

          // Button click (+ optionally replay onShown stinger)
          if (onClickSfx) SFX.play(onClickSfx as any);
          if (onShownSfx) SFX.play(onShownSfx as any);

          // Stop any ambient/info loop if active elsewhere
          try { SFX.stop('info_loop' as any); } catch {}

          // 1) ensure the feature BGM stops immediately
          try { SFX.stop('bg_lockandwin' as any); } catch {}

          // 2) resume/unmute audio context (mobile autoplay safeguards)
          try { pixiSound.resumeAll(); } catch {}
          try { pixiSound.unmuteAll(); } catch {}

          // 3) make sure background music alias has sane volume
          try {
            const snd: any = (pixiSound as any).find?.('bg_music') ?? (pixiSound as any)._sounds?.['bg_music'];
            if (snd) snd.volume = 0.25;
          } catch {}

          // 4) (re)start bg_music as a single looping instance
          try { (pixiSound as any).play?.('bg_music', { singleInstance: true, volume: 0.25, loop: true }); } catch {}

          // Alternative via SFX wrapper kept commented in original
          // try { (SFX as any).play('bg_music', { singleInstance: true, volume: 0.25 }); } catch {}
        } finally {
          resolve();
        }
      };
      this.okBtn.once('pointertap', click);
    });

    // Hide after acknowledgement
    this.visible = false;
  }

  // Clean teardown to avoid leaks
  dispose() {
    this.removeAllListeners();
    this.removeFromParent();
    this.destroy({ children: true });
  }
}
