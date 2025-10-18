// src/ui/components/FeatureIntro.ts
import { Container, Graphics, Text } from "pixi.js";
import { SFX } from "@/audio/sound-manager";

type IntroOptions = {
  spins: number;
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  onShownSfx?: string;   // default: "onShown" (one-shot stinger)
  onClickSfx?: string;   // default: "ui_click"
};

export class FeatureIntroModal extends Container {
  // Overlay + frame
  private dim = new Graphics();
  private panel = new Graphics();

  // Headline, subtitle, "n SPINS"
  private titleTxt: Text;
  private subTxt: Text;
  private spinsTxt: Text;

  // Start button (graphics + label)
  private btn: Graphics;
  private btnTxt: Text;

  // Used to resolve present() when button is clicked
  private resolver?: () => void;

  constructor() {
    super();
    this.sortableChildren = true;

    // Backdrop + panel live at the bottom
    this.addChild(this.dim, this.panel);

    // Title
    this.titleTxt = new Text({
      text: "",
      style: {
        fontFamily: "Cinzel, Trajan Pro, Georgia, serif",
        fontSize: 64,
        fontWeight: "900",
        fill: ["#FFA800", "#FF2F2F", "#8B0000"],
        fillGradientStops: [0, 0.4, 1],
        stroke: { color: 0x000000, width: 6 } as any,
        align: "center",
      } as any,
    });
    this.titleTxt.anchor.set(0.5);

    // Subtitle
    this.subTxt = new Text({
      text: "",
      style: {
        fontFamily: "Cinzel, Trajan Pro, Georgia, serif",
        fontSize: 46,
        fontWeight: "900",
        fill: 0xFFFFFF,
        stroke: { color: 0x000000, width: 6 } as any,
        align: "center",
      } as any,
    });
    this.subTxt.anchor.set(0.5);

    // Spins text (e.g., "3 SPINS")
    this.spinsTxt = new Text({
      text: "",
      style: {
        fontFamily: "Cinzel, Trajan Pro, Georgia, serif",
        fontSize: 58,
        fontWeight: "900",
        fill: 0xFFFFFF,
        stroke: { color: 0x000000, width: 6 } as any,
        align: "center",
      } as any,
    });
    this.spinsTxt.anchor.set(0.5);

    // Clickable button (graphics container)
    this.btn = new Graphics();
    this.btn.eventMode = "static";
    this.btn.cursor = "pointer";

    // Button label
    this.btnTxt = new Text({
      text: "START",
      style: {
        fontFamily: "Cinzel, Trajan Pro, Georgia, serif",
        fontSize: 40,
        fontWeight: "900",
        fill: 0x113300,
        stroke: { color: 0x073600, width: 3 } as any,
      } as any,
    });
    this.btnTxt.anchor.set(0.5);

    // Draw order above panel
    this.addChild(this.titleTxt, this.subTxt, this.spinsTxt, this.btn, this.btnTxt);

    // Simple hover/press feedback via scaling
    this.btn.on("pointerover", () => this.btn.scale.set(1.04));
    this.btn.on("pointerout",  () => this.btn.scale.set(1.00));
    this.btn.on("pointerdown", () => this.btn.scale.set(0.96));
    this.btn.on("pointerup",   () => this.btn.scale.set(1.04));
  }

  // Compute positions and (re)draw panel / button geometry
  layout(x: number, y: number, w: number, h: number) {
    // Full-screen dim background
    this.dim.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.65 });
    this.dim.position.set(0, 0);

    // Framed panel centered in the screen
    this.panel.clear()
      .roundRect(x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.56, 20)
      .stroke({ width: 6, color: 0xFFCC55, alpha: 0.25 });

    // Center anchor
    const cx = x + w / 2;
    const cy = y + h * 0.38;

    // Text block positions
    this.titleTxt.position.set(cx, cy - 110);
    this.subTxt.position.set(cx, cy - 45);
    this.spinsTxt.position.set(cx, cy + 30);

    // Button geometry and placement
    const bw = 220, bh = 78;
    this.btn.clear()
      .roundRect(0, 0, bw, bh, 20)
      .fill({ color: 0x3be63b })
      .stroke({ width: 6, color: 0x126b12 });
    this.btn.pivot.set(bw / 2, bh / 2);
    this.btn.position.set(cx, cy + 120);

    // Label centered on the button
    this.btnTxt.position.set(this.btn.x, this.btn.y);
  }

  // Show the modal, play stinger, and resolve when the button is clicked
  async present(opts: IntroOptions): Promise<void> {
    const {
      spins,
      title = "CONGRATULATIONS",
      subtitle = "LOCK & WIN TRIGGERED",
      buttonLabel = "START",
      onShownSfx = "onShown",
      onClickSfx = "ui_click",
    } = opts;

    // Fill text contents
    this.titleTxt.text = title;
    this.subTxt.text = subtitle;
    this.spinsTxt.text = `${spins} SPINS`;
    this.btnTxt.text = buttonLabel;

    // Subtly fade out the base bgm under the modal (polish)
    try { await SFX.bgmStop('bg_music', 160); } catch {}

    // Tiny pop-in animation (fade + scale)
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

    // Stinger when the intro pops up (optional)
    try { await SFX.ready; if (onShownSfx) SFX.play('onShown' as any); } catch {}

    // Wait for START click, then handle audio & close
    await new Promise<void>((resolve) => {
      this.resolver = resolve;
      this.btn.once("pointertap", async () => {
        try {
          await SFX.ready;

          // Click sfx
          if (onClickSfx) SFX.play(onClickSfx as any);

          // If any info-loop is running elsewhere, stop it quietly
          try { SFX.stop('info_loop' as any); } catch {}

          // Start and KEEP the Lock&Win BGM after clicking START
          if (SFX.has('bg_lockandwin' as any)) {
            try { SFX.stop('bg_lockandwin' as any); } catch {}
            SFX.fade('bg_lockandwin' as any, 0, 0, 0);       // reset volume
            SFX.play('bg_lockandwin' as any);                // run during the feature
            SFX.fade('bg_lockandwin' as any, 0, 0.28, 160);  // fade in
          }
          // Note: we allow 'onShown' stinger to finish naturally.
        } catch {}

        // Tiny press-out animation before resolving
        const t1 = performance.now();
        const startScale = this.scale.x;
        const endScale = 0.98;
        const dur = 120;
        const fini = () => {
          this.resolver = undefined;
          resolve();
        };
        const tick = () => {
          const k = Math.min(1, (performance.now() - t1) / dur);
          this.scale.set(startScale + (endScale - startScale) * k);
          if (k < 1) requestAnimationFrame(tick);
          else fini();
        };
        requestAnimationFrame(tick);
      });
    });
  }

  /** Clean up the modal from the scene. */
  dispose() {
    this.removeAllListeners();
    this.removeFromParent();
    this.destroy({ children: true });
  }
}
