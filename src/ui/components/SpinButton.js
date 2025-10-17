// src/ui/components/SpinButton.ts
import { Container, Sprite, Texture } from 'pixi.js';
export class SpinButton extends Container {
    constructor(_label = 'SPIN') {
        super();
        this._mode = 'spin';
        this._pressed = false;
        this._keydown = (e) => {
            if (this._mode === 'disabled')
                return;
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                this.handleClick();
            }
        };
        // textures from your atlas
        this.texSpin = Texture.from('spin_btn');
        this.texStop = Texture.from('spin_btn_red');
        this.btn = new Sprite(this.texSpin);
        this.btn.anchor.set(0.5);
        this.btn.eventMode = 'static';
        this.btn.cursor = 'pointer';
        this.addChild(this.btn);
        // pointer interactions
        this.btn.on('pointertap', () => this.handleClick());
        this.btn.on('pointerdown', () => this.press(true));
        this.btn.on('pointerup', () => this.press(false));
        this.btn.on('pointerupoutside', () => this.press(false));
        this.btn.on('pointerover', () => (this.btn.cursor = this._mode === 'disabled' ? 'default' : 'pointer'));
    }
    layout(viewW, viewH, footerHeight, margin = 18) {
        const cap = Math.min(viewW, viewH) * 0.12;
        const s = Math.min(0.75, cap / this.btn.texture.width);
        this.btn.scale.set(s);
        this.position.set(viewW - margin - this.btn.width / 2, viewH - footerHeight / 2);
    }
    get visualWidth() { return this.btn.width; }
    // legacy alias
    onClick(fn) { this.onSpin = fn; }
    setMode(m) {
        if (this._mode === m)
            return;
        this._mode = m;
        if (m === 'spin') {
            this.btn.texture = this.texSpin; // GREEN
            this.alpha = 1;
            this.btn.eventMode = 'static';
            this.btn.cursor = 'pointer';
        }
        else if (m === 'stop') {
            this.btn.texture = this.texStop; // RED
            this.alpha = 1;
            this.btn.eventMode = 'static';
            this.btn.cursor = 'pointer';
        }
        else {
            this.alpha = 0.6; // DISABLED
            this.btn.eventMode = 'none';
            this.btn.cursor = 'default';
        }
    }
    attachKeyboard() { window.addEventListener('keydown', this._keydown); }
    detachKeyboard() { window.removeEventListener('keydown', this._keydown); }
    setEnabled(v) { this.setMode(v ? (this._mode === 'disabled' ? 'spin' : this._mode) : 'disabled'); }
    handleClick() {
        if (this._mode === 'disabled')
            return;
        if (this._mode === 'spin')
            this.onSpin?.();
        else if (this._mode === 'stop')
            this.onStop?.();
    }
    press(down) {
        if (this._mode === 'disabled')
            return;
        if (down && !this._pressed) {
            this._pressed = true;
            this.btn.scale.set(this.btn.scale.x * 0.96, this.btn.scale.y * 0.96);
        }
        else if (!down && this._pressed) {
            this._pressed = false;
            this.btn.scale.set(this.btn.scale.x / 0.96, this.btn.scale.y / 0.96);
        }
    }
    destroy(options) {
        this.detachKeyboard();
        super.destroy(options);
    }
}
