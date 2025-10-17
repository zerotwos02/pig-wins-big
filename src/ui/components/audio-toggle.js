// src/ui/components/audio-toggle.ts
import { Container, Graphics, Text, Rectangle } from 'pixi.js';
import { DropShadowFilter } from '@pixi/filter-drop-shadow';
import { GlowFilter } from '@pixi/filter-glow';
import { SFX } from '@/audio/sound-manager';
const GOLD_2 = 0xFFD479;
const PURPLE = 0x4B007F;
const PURPLE_DARK = 0x2C004A;
export class AudioToggle extends Container {
    constructor(size = 40) {
        super();
        this.bg = new Graphics();
        this.speaker = new Graphics();
        this.waves = new Graphics();
        this.slash = new Graphics();
        this.tooltip = new Container();
        this.tooltipBg = new Graphics();
        this.tooltipText = new Text({ text: '', style: { fontSize: 12, fill: 0xffffff } });
        this._size = 40; // button square size (px)
        this._enabled = true;
        this.handleEnabledChange = () => this.updateView();
        this._size = size;
        this.tooltip.addChild(this.tooltipBg, this.tooltipText);
        this.tooltip.visible = false;
        this.addChild(this.bg, this.speaker, this.waves, this.slash, this.tooltip);
        this.eventMode = 'static';
        this.cursor = 'pointer';
        // FX
        const baseShadow = new DropShadowFilter({ distance: 4, blur: 4, alpha: 0.35 });
        this.filters = [baseShadow];
        const hoverGlow = new GlowFilter({ color: GOLD_2, outerStrength: 1.0, innerStrength: 0, quality: 0.25 });
        // Interactions
        this.on('pointertap', () => {
            if (!this._enabled)
                return;
            SFX.enabled = !SFX.enabled;
        });
        this.on('pointerover', () => {
            if (!this._enabled)
                return;
            this.filters = [hoverGlow];
            this.scale.set(1.06);
            this.showTooltip(SFX.enabled ? 'Sound on' : 'Sound off');
        });
        const leave = () => {
            this.filters = [baseShadow];
            this.scale.set(1.0);
            this.tooltip.visible = false;
        };
        this.on('pointerout', leave);
        this.on('pointerdown', () => this._enabled && this.scale.set(0.94));
        this.on('pointerup', () => this._enabled && this.scale.set(1.06));
        this.on('pointerupoutside', () => this._enabled && this.scale.set(1));
        // react to external changes
        SFX.on.addEventListener('enabled-change', this.handleEnabledChange);
        this.redrawAll();
        this.updateView();
    }
    destroy(options) {
        SFX.on.removeEventListener('enabled-change', this.handleEnabledChange);
        super.destroy(options);
    }
    /** Center-right HUD placement helper (top-right corner) */
    layoutTopRight(viewW, margin = 12, y = 12) {
        this.position.set(viewW - margin - this._size, y);
    }
    setSize(px) {
        this._size = Math.max(28, px);
        this.redrawAll();
        this.updateView();
    }
    setEnabled(v) {
        this._enabled = v;
        this.alpha = v ? 1 : 0.6;
        this.eventMode = v ? 'static' : 'none';
        this.cursor = v ? 'pointer' : 'default';
    }
    // ────────────────────────────────────────────────────────────────────────────
    redrawAll() {
        const w = this._size, h = this._size;
        // Background: subtle rounded square
        this.bg.clear()
            .roundRect(0, 0, w, h, 10)
            .fill({ color: 0x000000, alpha: 0.10 })
            .stroke({ width: 2, color: PURPLE_DARK, alpha: 0.35 });
        // Speaker icon (vector)
        this.drawSpeaker();
        // Waves (visible when ON)
        this.drawWaves();
        // Slash (visible when OFF)
        this.drawSlash();
        // Proper hit area
        this.hitArea = new Rectangle(0, 0, w, h);
    }
    drawSpeaker() {
        const s = this._size;
        const pad = Math.max(4, s * 0.08);
        const cx = s * 0.5, cy = s * 0.5;
        const bodyW = s * 0.28;
        const bodyH = s * 0.44;
        const coneW = s * 0.26;
        const left = cx - bodyW * 0.9;
        const top = cy - bodyH / 2;
        this.speaker.clear();
        // body (rounded rect)
        this.speaker
            .roundRect(left, top, bodyW, bodyH, 3)
            .fill({ color: PURPLE, alpha: 0.95 });
        // cone (triangle)
        this.speaker
            .moveTo(left + bodyW, cy - bodyH * 0.42)
            .lineTo(left + bodyW + coneW, cy)
            .lineTo(left + bodyW, cy + bodyH * 0.42)
            .closePath()
            .fill({ color: PURPLE, alpha: 0.95 })
            .stroke({ width: 2, color: GOLD_2, alpha: 0.7 });
    }
    drawWaves() {
        const s = this._size;
        const cx = s * 0.5, cy = s * 0.5;
        const startX = cx + s * 0.16;
        this.waves.clear();
        this.waves.stroke({ width: 2, color: GOLD_2, alpha: 1 });
        // three arcs with increasing radius
        const radii = [s * 0.12, s * 0.18, s * 0.24];
        for (const r of radii) {
            this.waves.arc(startX, cy, r, -Math.PI / 3, Math.PI / 3);
        }
    }
    drawSlash() {
        const s = this._size;
        this.slash.clear()
            .moveTo(s * 0.25, s * 0.25)
            .lineTo(s * 0.75, s * 0.75)
            .stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
    }
    updateView() {
        const on = SFX.enabled;
        this.waves.visible = on;
        this.slash.visible = !on;
        // tooltip text if already hovered
        if (this.tooltip.visible) {
            this.showTooltip(on ? 'Sound on' : 'Sound off');
        }
    }
    showTooltip(text) {
        const padX = 8, padY = 4;
        this.tooltipText.text = text;
        const tw = Math.max(40, this.tooltipText.width);
        const th = Math.max(16, this.tooltipText.height);
        this.tooltipBg.clear()
            .roundRect(0, 0, tw + padX * 2, th + padY * 2, 6)
            .fill({ color: 0x000000, alpha: 0.65 })
            .stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
        this.tooltipText.position.set(padX, padY);
        // place tooltip above the button
        const bx = (this._size - (tw + padX * 2)) / 2;
        const by = -(th + padY * 2 + 6);
        this.tooltip.position.set(bx, by);
        this.tooltip.visible = true;
    }
}
