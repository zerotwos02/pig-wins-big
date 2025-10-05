// src/ui/layouts/Footer.ts
// Requires: npm i @pixi/filter-drop-shadow @pixi/filter-glow
import { Container, NineSliceSprite, Texture, Graphics, Text } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { GlowFilter } from '@pixi/filter-glow';
import { getState, subscribe, stepStake } from '@/state/store';
import { SFX } from '@/audio/sound-manager';

// ── Theme ─────────────────────────────────────────────────────────────────────
const GOLD_1 = 0xFFF3B0;
const GOLD_2 = 0xFFD479;
const GOLD_3 = 0xB68019;
const PURPLE = 0x4B007F;
const PURPLE_DARK = 0x2C004A;

// format helpers
const fmtFUN = (n: number, d = 2) =>
  'FUN' + n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

export class Footer extends Container {
  private bg: NineSliceSprite;

  private minusBtn!: Container;
  private plusBtn!: Container;

  private stakeText!: Text;     // left: between − / +
  private winText!: Text;       // center: last win
  private balanceText!: Text;   // right: balance
  private balancePanel = new Graphics();

  private readonly H = 80;
  private unsub?: () => void;
  private lastW = 0;
  private lastH = 0;

  constructor() {
    super();

    this.bg = new NineSliceSprite({
      texture: Texture.from('footer_band'),
      leftWidth: 20, topHeight: 20, rightWidth: 20, bottomHeight: 20,
    });
    this.addChild(this.bg);

    this.buildControls();
    this.syncFromState();
    this.unsub = subscribe(() => this.syncFromState());
  }

  destroy(options?: any) {
    this.unsub?.();
    super.destroy(options);
  }

  get heightPx() { return this.H; }

  // ────────────────────────────────────────────────────────────────────────────
  /** Glossy circular button with purple fill + gold border + hover/press FX */
  private makeRound(radius: number, label: string) {
    const btn = new Container();

    const base = new Graphics()
      .circle(0, 0, radius)
      .fill({ color: PURPLE, alpha: 1 })
      .stroke({ width: 4, color: GOLD_2, alpha: 1 });

    // soft top gloss
    const gloss = new Graphics()
      .ellipse(0, -radius * 0.35, radius * 0.9, radius * 0.55)
      .fill({ color: 0xFFFFFF, alpha: 0.18 });

    const t = new Text({
      text: label,
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif', // casino serif vibe
        fontSize: 22,
        fontWeight: '900',
        fill: 0xFFFFFF,
        stroke: { color: GOLD_3, width: 2, join: 'round' } as any,
      } as any,
    });
    t.anchor.set(0.5);

    btn.addChild(base, gloss, t);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    // depth
    btn.filters = [ new DropShadowFilter({ distance: 6, blur: 4, alpha: 0.45 }) as any ];

    // hover glow + scale
    const hoverGlow = new GlowFilter({ color: GOLD_2, outerStrength: 1.4, innerStrength: 0, quality: 0.25 }) as any;
    btn.on('pointerover', () => { btn.scale.set(1.06); (btn as any).filters = [hoverGlow]; });
    btn.on('pointerout',  () => { btn.scale.set(1.00); (btn as any).filters = [ new DropShadowFilter({ distance: 6, blur: 4, alpha: 0.45 }) as any ]; });

    // press scale
    btn.on('pointerdown', () => btn.scale.set(0.94));
    const up = () => btn.scale.set(1.06);
    btn.on('pointerup', up);
    btn.on('pointerupoutside', up);

    return btn;
  }

  private buildControls() {
    const r = 22; // +/- radius
    this.minusBtn = this.makeRound(r, '–');
    this.plusBtn  = this.makeRound(r, '+');

    // Gold gradient, bold, slightly larger to draw attention
    this.stakeText = new Text({
      text: '',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 28,
        fontWeight: '900',
        fill: ['#FFF3B0', '#FFD479', '#B68019'],
        fillGradientStops: [0, 0.55, 1],
        fillGradientType: 0, // vertical gradient
        stroke: { color: GOLD_3, width: 3, join: 'round' } as any,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowDistance: 3,
        dropShadowBlur: 2,
      } as any,
    });
    // subtle gold glow
    (this.stakeText as any).filters = [ new GlowFilter({ color: GOLD_2, outerStrength: 0.8, innerStrength: 0 }) as any ];

    // Center: last win (you can upgrade later to a ribbon)
    this.winText = new Text({
      text: '',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 24,
        fontWeight: '900',
        fill: 0xFFFFFF,
        stroke: { color: 0x000000, width: 2 } as any,
      } as any,
    });

    // Right: balance text; will sit inside a gold-framed purple panel
    this.balanceText = new Text({
      text: '',
      style: {
        fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
        fontSize: 22,
        fontWeight: '800',
        fill: 0xFFFFFF,
        stroke: { color: GOLD_3, width: 2, join: 'round' } as any,
      } as any,
    });

    this.addChild(
      this.minusBtn, this.stakeText, this.plusBtn,
      this.winText,
      this.balancePanel, this.balanceText
    );

    // bet step handlers
    this.minusBtn.on('pointertap', () => { if (!getState().isSpinning) { SFX.play('ui_click'); stepStake(-1); }});
    this.plusBtn.on('pointertap',  () => { if (!getState().isSpinning) { SFX.play('ui_click'); stepStake(+1); }});
  }

  private syncFromState() {
    const s = getState();
    this.stakeText.text   = `FUN${s.stake.toLocaleString('fr-FR')}`; // e.g. FUN100
    this.winText.text     = fmtFUN(s.win);                             // e.g. FUN320,00
    this.balanceText.text = fmtFUN(s.balance);                         // e.g. FUN17 240,00
    if (this.lastW) this.layout(this.lastW, this.lastH); // reflow widths
  }

  /**
   * Keep ORDER: [ − ][ FUNxx ][ + ]  |  WIN (center)  |  BALANCE (right panel)
   * `reserveRight` leaves space for the HUD spin button.
   */
  layout(viewW: number, viewH: number, reserveRight = 120) {
    this.lastW = viewW; this.lastH = viewH;

    const yTop = viewH - this.H;
    this.bg.position.set(0, yTop);
    this.bg.width = viewW;
    this.bg.height = this.H;

    const cy  = yTop + this.H / 2;
    const pad = 16;
    const r   = 22;   // +/- radius (match buildControls)
    const gap = 12;

    // LEFT: [ − ][  FUNxxx  ][ + ]  (stake centered between buttons)
    const minusX = pad + r;
    this.minusBtn.position.set(minusX, cy);

    const textW = Math.max(this.stakeText.width, 120);
    this.stakeText.anchor.set(0.5, 0.5);
    const stakeCenterX = minusX + r + gap + textW / 2;
    this.stakeText.position.set(stakeCenterX, cy);

    const plusX = stakeCenterX + textW / 2 + gap + r;
    this.plusBtn.position.set(plusX, cy);

    // CENTER: last win
    this.winText.anchor.set(0.5, 0.5);
    this.winText.position.set(viewW / 2, cy);

    // RIGHT: balance inside a gold-framed panel (leave room for HUD spin)
    const panelPadX = 12;
    const panelPadY = 8;
    const bw = this.balanceText.width + panelPadX * 2;
    const bh = 40;
    const panelX = viewW - pad - reserveRight - bw;
    const panelY = cy - bh / 2;

    this.balancePanel
      .clear()
      .roundRect(panelX, panelY, bw, bh, 12)
      .fill({ color: PURPLE_DARK, alpha: 0.6 })
      .stroke({ width: 3, color: GOLD_2, alpha: 1 });

    // soft outer depth
    (this.balancePanel as any).filters = [ new DropShadowFilter({ distance: 6, blur: 6, alpha: 0.35 }) as any ];

    this.balanceText.anchor.set(0.5, 0.5);
    this.balanceText.position.set(panelX + bw / 2, panelY + bh / 2);
  }
}
