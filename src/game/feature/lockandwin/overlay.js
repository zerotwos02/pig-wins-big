import { Container, Graphics, Text } from 'pixi.js';
export class LWOverlay extends Container {
    constructor() {
        super();
        this.dim = new Graphics();
        this.counter = new Text({ text: '', style: { fontSize: 24, fontWeight: '900', fill: 0xffffff } });
        this.totalTxt = new Text({ text: '', style: { fontSize: 24, fontWeight: '900', fill: 0xffd15c } });
        this.addChild(this.dim, this.counter, this.totalTxt);
        this.sortableChildren = true;
    }
    layout(x, y, w, h) {
        // OPAQUE black background with a thin gold stroke
        this.dim
            .clear()
            .roundRect(x, y, w, h, 16)
            .fill({ color: 0x000000, alpha: 1 }) // ← solid black
            .stroke({ width: 2, color: 0xffd15c, alpha: 0.9 }); // optional border
        this.counter.position.set(x + 12, y + 10);
        this.totalTxt.position.set(x + w - 12, y + 10);
        this.totalTxt.anchor.set(1, 0);
    }
    setInfo(spinsLeft, total) {
        this.counter.text = `Respins: ${spinsLeft}`;
        this.totalTxt.text = `Total: FUN${total.toLocaleString('fr-FR')}`;
    }
}
