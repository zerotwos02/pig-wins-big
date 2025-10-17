// src/ui/layouts/Footer.ts
// Requires: npm i @pixi/filter-drop-shadow @pixi/filter-glow
import { Container, NineSliceSprite, Texture, Graphics, Text, Ticker } from 'pixi.js';
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
const fmtFUN = (n, d = 2) => 'FUN' + Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
// simple easing so the count-up feels nice
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export class Footer extends Container {
    constructor() {
        super();
        this.balancePanel = new Graphics();
        this.H = 80;
        this.lastW = 0;
        this.lastH = 0;
        // ── Win animation state ─────────────────────────────────────────────────────
        this.winShown = 0; // what’s currently displayed
        this.bg = new NineSliceSprite({
            texture: Texture.from('footer_band'),
            leftWidth: 20, topHeight: 20, rightWidth: 20, bottomHeight: 20,
        });
        this.addChild(this.bg);
        this.buildControls();
        this.syncFromState();
        this.unsub = subscribe(() => this.syncFromState());
    }
    destroy(options) {
        this.unsub?.();
        this.stopWinAnim();
        super.destroy(options);
    }
    get heightPx() { return this.H; }
    // ────────────────────────────────────────────────────────────────────────────
    /** Glossy circular button with purple fill + gold border + hover/press FX */
    makeRound(radius, label) {
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
                stroke: { color: GOLD_3, width: 2, join: 'round' },
            },
        });
        t.anchor.set(0.5);
        btn.addChild(base, gloss, t);
        btn.eventMode = 'static';
        btn.cursor = 'pointer';
        // depth
        btn.filters = [new DropShadowFilter({ distance: 6, blur: 4, alpha: 0.45 })];
        // hover glow + scale
        const hoverGlow = new GlowFilter({ color: GOLD_2, outerStrength: 1.4, innerStrength: 0, quality: 0.25 });
        btn.on('pointerover', () => { btn.scale.set(1.06); btn.filters = [hoverGlow]; });
        btn.on('pointerout', () => { btn.scale.set(1.00); btn.filters = [new DropShadowFilter({ distance: 6, blur: 4, alpha: 0.45 })]; });
        // press scale
        btn.on('pointerdown', () => btn.scale.set(0.94));
        const up = () => btn.scale.set(1.06);
        btn.on('pointerup', up);
        btn.on('pointerupoutside', up);
        return btn;
    }
    buildControls() {
        const r = 22; // +/- radius
        this.minusBtn = this.makeRound(r, '–');
        this.plusBtn = this.makeRound(r, '+');
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
                stroke: { color: GOLD_3, width: 3, join: 'round' },
                dropShadow: true,
                dropShadowColor: 0x000000,
                dropShadowDistance: 3,
                dropShadowBlur: 2,
            },
        });
        // subtle gold glow
        this.stakeText.filters = [new GlowFilter({ color: GOLD_2, outerStrength: 0.8, innerStrength: 0 })];
        // Center: last win (you can upgrade later to a ribbon)
        this.winText = new Text({
            text: '',
            style: {
                fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
                fontSize: 24,
                fontWeight: '900',
                fill: 0xFFFFFF,
                stroke: { color: 0x000000, width: 2 },
            },
        });
        // Right: balance text; will sit inside a gold-framed purple panel
        this.balanceText = new Text({
            text: '',
            style: {
                fontFamily: 'Cinzel, Trajan Pro, Georgia, serif',
                fontSize: 22,
                fontWeight: '800',
                fill: 0xFFFFFF,
                stroke: { color: GOLD_3, width: 2, join: 'round' },
            },
        });
        this.addChild(this.minusBtn, this.stakeText, this.plusBtn, this.winText, this.balancePanel, this.balanceText);
        // bet step handlers
        this.minusBtn.on('pointertap', () => { if (!getState().isSpinning) {
            SFX.play('ui_click');
            stepStake(-1);
        } });
        this.plusBtn.on('pointertap', () => { if (!getState().isSpinning) {
            SFX.play('ui_click');
            stepStake(+1);
        } });
    }
    syncFromState() {
        const s = getState();
        // stake/balance update
        this.stakeText.text = `FUN${s.stake.toLocaleString('fr-FR')}`;
        this.balanceText.text = fmtFUN(s.balance);
        // win update — animate upwards; otherwise set immediately
        if (s.win > this.winShown) {
            this.startWinAnim(this.winShown, s.win, s.stake);
        }
        else if (s.win !== this.winShown) {
            // going down or equal: cancel any anim and snap
            this.stopWinAnim();
            this.winShown = s.win;
            this.winText.text = fmtFUN(this.winShown);
        }
        if (this.lastW)
            this.layout(this.lastW, this.lastH); // reflow widths
    }
    // ── Win count-up animation ──────────────────────────────────────────────────
    startWinAnim(from, to, stake) {
        this.stopWinAnim();
        const delta = Math.max(0, to - from);
        // duration ≈ 0.3s per stake multiple; clamp 0.3s..6s for UX
        const multiples = stake > 0 ? (delta / stake) : 0;
        const durSec = Math.min(6, Math.max(0.3, 0.3 * (multiples || (delta > 0 ? 1 : 0))));
        const durMs = durSec * 1000;
        const ticker = Ticker.shared;
        const onTick = (tk) => {
            const deltaMs = tk.deltaMS;
            if (!this.winAnim)
                return;
            this.winAnim.tMs += deltaMs;
            const t = Math.min(1, this.winAnim.tMs / this.winAnim.durMs);
            const eased = easeOutCubic(t);
            const val = this.winAnim.from + (this.winAnim.to - this.winAnim.from) * eased;
            this.winShown = val;
            this.winText.text = fmtFUN(val);
            if (this.winAnim.stakeAtStart > 0 && this.winAnim.to > this.winAnim.from) {
                const kNow = Math.floor(val / this.winAnim.stakeAtStart);
                if (kNow > this.winAnim.lastDingStep) {
                    this.winAnim.lastDingStep = kNow;
                    SFX.play('win_small');
                }
            }
            if (t >= 1) {
                this.winShown = this.winAnim.to;
                this.winText.text = fmtFUN(this.winShown);
                this.stopWinAnim();
            }
        };
        this.winAnim = {
            from, to, durMs, tMs: 0,
            stakeAtStart: Math.max(0, stake),
            lastDingStep: Math.floor(Math.max(0, from) / Math.max(1, stake)),
            onTick,
        };
        // kick off
        this.winText.text = fmtFUN(from);
        Ticker.shared.add(onTick);
    }
    stopWinAnim() {
        if (this.winAnim) {
            Ticker.shared.remove(this.winAnim.onTick);
            this.winAnim = undefined;
        }
    }
    /**
     * Keep ORDER: [ − ][ FUNxx ][ + ]  |  WIN (center)  |  BALANCE (right panel)
     * `reserveRight` leaves space for the HUD spin button.
     */
    layout(viewW, viewH, reserveRight = 120) {
        this.lastW = viewW;
        this.lastH = viewH;
        const yTop = viewH - this.H;
        this.bg.position.set(0, yTop);
        this.bg.width = viewW;
        this.bg.height = this.H;
        const cy = yTop + this.H / 2;
        const pad = 16;
        const r = 22; // +/- radius (match buildControls)
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
        this.balancePanel.filters = [new DropShadowFilter({ distance: 6, blur: 6, alpha: 0.35 })];
        this.balanceText.anchor.set(0.5, 0.5);
        this.balanceText.position.set(panelX + bw / 2, panelY + bh / 2);
    }
}
