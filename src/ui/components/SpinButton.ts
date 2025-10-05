// src/ui/components/SpinButton.ts
import { Container, Sprite } from 'pixi.js';

export class SpinButton extends Container {
  private btn: Sprite;
  private _enabled = true;

  // accept an optional label to satisfy calls like new SpinButton('SPIN')
  constructor(_label: string = 'SPIN') {
    super();
    this.btn = Sprite.from('spin_btn'); // asset id
    this.btn.anchor.set(0.5);
    this.btn.eventMode = 'static';
    this.btn.cursor = 'pointer';
    this.addChild(this.btn);
  }

  layout(viewW: number, viewH: number, footerHeight: number, margin = 18) {
    const cap = Math.min(viewW, viewH) * 0.12;
    const s = Math.min(0.75, cap / this.btn.texture.width);
    this.btn.scale.set(s);

    this.position.set(
      viewW - margin - this.btn.width / 2,
      viewH - footerHeight / 2
    );
  }

  get visualWidth() { return this.btn.width; }

  onClick(fn: () => void) {
    this.btn.removeAllListeners('pointertap');
    this.btn.on('pointertap', () => { if (this._enabled) fn(); });
  }

  /** Enable/disable interactions + dim when disabled */
  setEnabled(v: boolean) {
    this._enabled = v;
    this.btn.eventMode = v ? 'static' : 'none';
    this.btn.cursor = v ? 'pointer' : 'default';
    this.alpha = v ? 1 : 0.6;
  }
}
