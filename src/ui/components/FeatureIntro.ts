// src/ui/components/FeatureIntro.ts
import { Container, Graphics, Text } from "pixi.js";
import { SFX } from "@/audio/sound-manager";

type IntroOptions = {
  spins: number;                 // e.g. 3
  title?: string;                // default: "CONGRATULATIONS"
  subtitle?: string;             // default: "LOCK & WIN TRIGGERED"
  buttonLabel?: string;          // default: "START"
  onShownSfx?: string;           // optional stinger key
  onClickSfx?: string;           // optional click key
};

export class FeatureIntroModal extends Container {
  private dim = new Graphics();
  private panel = new Graphics();
  private titleTxt: Text;
  private subTxt: Text;
  private spinsTxt: Text;
  private btn: Graphics;
  private btnTxt: Text;

  private resolver?: () => void;

  constructor() {
    super();
    this.sortableChildren = true;

    this.addChild(this.dim, this.panel);

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

    // button
    this.btn = new Graphics();
    this.btn.eventMode = "static";
    this.btn.cursor = "pointer";

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

    this.addChild(this.titleTxt, this.subTxt, this.spinsTxt, this.btn, this.btnTxt);

    // simple hover/press
    this.btn.on("pointerover", () => this.btn.scale.set(1.04));
    this.btn.on("pointerout",  () => this.btn.scale.set(1.00));
    this.btn.on("pointerdown", () => this.btn.scale.set(0.96));
    this.btn.on("pointerup",   () => this.btn.scale.set(1.04));
  }

  layout(x: number, y: number, w: number, h: number) {
    this.dim.clear().rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.65 });
    this.dim.position.set(0, 0);

    // centered panel (transparent, we just need positioning helpers)
    this.panel.clear()
      .roundRect(x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.56, 20)
      .stroke({ width: 6, color: 0xFFCC55, alpha: 0.25 });

    const cx = x + w / 2;
    const cy = y + h * 0.38;

    this.titleTxt.position.set(cx, cy - 110);
    this.subTxt.position.set(cx, cy - 45);
    this.spinsTxt.position.set(cx, cy + 30);

    // button
    const bw = 220, bh = 78;
    this.btn.clear()
      .roundRect(0, 0, bw, bh, 20)
      .fill({ color: 0x3be63b })
      .stroke({ width: 6, color: 0x126b12 });
    this.btn.pivot.set(bw / 2, bh / 2);
    this.btn.position.set(cx, cy + 120);

    this.btnTxt.position.set(this.btn.x, this.btn.y);
  }

  /** Show with content and return a promise that resolves after clicking START. */
  async present(opts: IntroOptions): Promise<void> {
    const {
      spins,
      title = "CONGRATULATIONS",
      subtitle = "LOCK & WIN TRIGGERED",
      buttonLabel = "START",
      onShownSfx,
      onClickSfx,
    } = opts;

    this.titleTxt.text = title;
    this.subTxt.text = subtitle;
    this.spinsTxt.text = `${spins} SPINS`;
    this.btnTxt.text = buttonLabel;

    // pop-in animation
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

    // optional stinger
    try { if (onShownSfx) { await SFX.ready; SFX.play(onShownSfx as any); } } catch {}

    // click to resolve
    await new Promise<void>((resolve) => {
      this.resolver = resolve;
      this.btn.once("pointertap", async () => {
        try { if (onClickSfx) { await SFX.ready; SFX.play(onClickSfx as any); } } catch {}
        // tiny press-out
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
