// src/ui/components/InfoModal.ts
import {
  Container,
  Graphics,
  NineSliceSprite,
  Sprite,
  Text,
  Texture,
  Rectangle,
} from 'pixi.js';
import { SFX } from '@/audio/sound-manager';

type Page = Container;

const YELLOW = 0xffc23d;
const PURPLE = 0x4b007f;
const BGM_KEY = 'bg_music'; // your background music alias

export class InfoModal extends Container {
  private overlay = new Graphics();
  private panel: NineSliceSprite;

  private contentRoot = new Container();

  private closeBtn!: Container;
  private leftBtn!: Container;
  private rightBtn!: Container;

  private pages: Page[] = [];
  private pageIndex = 0;

  // swipe
  private touchStartX = 0;
  private touchActive = false;

  constructor() {
    super();
    this.visible = false;
    this.alpha = 0;
    this.eventMode = 'static'; // block input behind modal

    // backdrop (darker over game)
    this.overlay.rect(0, 0, 100, 100).fill({ color: YELLOW, alpha: 0.80 });
    this.addChild(this.overlay);

    // modal panel (9-slice skin)
    this.panel = new NineSliceSprite({
      texture: Texture.from('panel'),
      leftWidth: 40, topHeight: 40, rightWidth: 40, bottomHeight: 40,
    });
    this.panel.alpha = 0.98;
    this.addChild(this.panel);



    // content container
    this.addChild(this.contentRoot);

    // pages
    this.pages = [this.makePage1(), this.makePage2(), this.makePage3()];
    for (const p of this.pages) this.contentRoot.addChild(p);

    // controls
    this.closeBtn = this.makeCloseChip('×', 18);
    this.leftBtn  = this.makeChevron('<', 30, YELLOW);
    this.rightBtn = this.makeChevron('>', 30, YELLOW);
    this.addChild(this.closeBtn, this.leftBtn, this.rightBtn);

    // events
    this.closeBtn.on('pointertap', () => this.close());
    this.leftBtn.on('pointertap', () => this.prev());
    this.rightBtn.on('pointertap', () => this.next());

    // swipe on panel
    this.panel.eventMode = 'static';
    this.panel.on('pointerdown', (e) => {
      this.touchActive = true;
      this.touchStartX = e.globalX;
    });
    this.panel.on('pointerup', (e) => {
      if (!this.touchActive) return;
      const dx = e.globalX - this.touchStartX;
      this.touchActive = false;
      const THRESH = 40;
      if (dx <= -THRESH) this.next();
      else if (dx >= THRESH) this.prev();
    });

    this.updatePagesVisibility();
    this.updateNavState();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────────────
  open() {
    SFX.ready.then(() => {
      SFX.play?.('ui_click');

      // Pause BGM (alias-based) with safe fallbacks
      if ('pause' in SFX) (SFX as any).pause(BGM_KEY);
      else (SFX as any).stop?.(BGM_KEY);

      // Start info loop (single instance, low volume)
      if ('playLoop' in SFX) (SFX as any).playLoop('info_loop', 0.35);
      else (SFX as any).play?.('info_loop', { loop: true, singleInstance: true, volume: 0.35 });
    });

    this.visible = true;
    this.animateTo(1);
  }

  close() {
    SFX.ready.then(() => {
      SFX.play?.('ui_click');

      // Stop info loop
      (SFX as any).stop?.('info_loop');

      // Resume BGM (or start it again)
      if ('resume' in SFX) (SFX as any).resume(BGM_KEY);
      else (SFX as any).play?.(BGM_KEY, { loop: true, volume: 0.25 });
    });

    this.animateTo(0, () => (this.visible = false));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Layout
  // ────────────────────────────────────────────────────────────────────────────
  layout(viewW: number, viewH: number) {
    // overlay
    this.overlay.clear().rect(0, 0, viewW, viewH).fill({ color: 0x000000, alpha: 0.80 });

    // panel size (center)
    const W = Math.min(820, Math.max(560, viewW * 0.86));
    const H = Math.min(520, Math.max(380, viewH * 0.68));
    this.panel.width = W;
    this.panel.height = H;
    this.panel.position.set((viewW - W) / 2, (viewH - H) / 2);
  
    // content padding
    const padX = 28, padTop = 26;
    this.contentRoot.position.set(this.panel.x + padX, this.panel.y + padTop);

    // buttons
    this.closeBtn.position.set(this.panel.x + W - 24, this.panel.y + 24);

    // nav arrows at middle sides
    const midY = this.panel.y + H / 2;
    this.leftBtn.position.set(this.panel.x + 26, midY);
    this.rightBtn.position.set(this.panel.x + W - 26, midY);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Pages (centered text)
  // ────────────────────────────────────────────────────────────────────────────
  private makeTitle(text: string, color = YELLOW) {
    const t = new Text(text, {
      fill: color,
      fontSize: 28,
      fontWeight: '900',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 720,
    } as any);
    (t as any).anchor?.set?.(0.5, 0);
    t.x = 360; // center across 720 content width
    return t;
  }

  private makeSub(text: string) {
    const t = new Text(text, {
      fill: 0xffffff,
      fontSize: 18,
      fontWeight: '700',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 720,
    } as any);
    (t as any).anchor?.set?.(0.5, 0);
    t.x = 360;
    return t;
  }

  private makeBody(text: string) {
    const t = new Text(text, {
      fill: 0xffffff,
      fontSize: 16,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 720,
      lineHeight: 22,
    } as any);
    (t as any).anchor?.set?.(0.5, 0);
    t.x = 360;
    return t;
  }

  private makePage1(): Page {
    const root = new Container();

    const title = this.makeTitle('WAY WINS');
    const sub   = this.makeSub('All wins multiply total stake');
    const body  = this.makeBody(
      'Wild substitutes for all icons except Pig icons.\n' +
      'During the Lock & Win feature, Wild increases the value of any adjacent Pig icons.'
    );

    const wild = Sprite.from('wild_feather');
    wild.anchor.set(0.5);
    wild.width = wild.height = 64;
    wild.x = 360;

    // vertical stack
    title.position.set(title.x, 0);
    sub.position.set(sub.x, title.y + title.height + 12);
    wild.position.set(wild.x, sub.y + sub.height + 24);
    body.position.set(body.x, wild.y + 52);

    root.addChild(title, sub, body, wild);
    return root;
  }

  private makePage2(): Page {
    const root = new Container();

    const title = this.makeTitle('PAYOUTS');

    const PAYTABLE: Array<[string, string, number, number, number]> = [
      ['pig',        'Pig',      0.80, 1.50, 1.80],
      ['pig_gold',   'Gold Pig', 1.00, 1.60, 2.00],
      ['banker',     'Banker',   0.60, 1.20, 1.50],
      ['diamond',    'Diamond',  0.40, 0.80, 1.20],
      ['gold_bars',  'Gold Bars',0.40, 0.80, 1.20],
      ['money_bag',  'Money Bag',0.30, 0.60, 1.00],
      ['cash_stack', 'Cash',     0.30, 0.60, 1.00],
      ['dollar',     'Dollar',   0.20, 0.40, 0.80],
      ['coin',       'Coin',     0.20, 0.40, 0.80],
    ];

    // centered header
    title.position.set(title.x, 0);

    // simple centered table block
    const hIcon = new Text('ICON', { fill: 0xffffff, fontSize: 16, fontWeight: '800' } as any);
    const h3    = new Text('×3',   { fill: 0xffffff, fontSize: 16, fontWeight: '800' } as any);
    const h4    = new Text('×4',   { fill: 0xffffff, fontSize: 16, fontWeight: '800' } as any);
    const h5    = new Text('×5',   { fill: 0xffffff, fontSize: 16, fontWeight: '800' } as any);

    const colX = [120, 360, 440, 520]; // centered within 720 width

    hIcon.position.set(colX[0], title.y + title.height + 14);
    h3.position.set(colX[1], hIcon.y);
    h4.position.set(colX[2], hIcon.y);
    h5.position.set(colX[3], hIcon.y);

    const rows = new Container();
    rows.position.set(0, hIcon.y + hIcon.height + 8);

    let y = 0;
    for (const [key, label, p3, p4, p5] of PAYTABLE) {
      const line = new Container();

      const icon = Sprite.from(key);
      icon.anchor.set(0.5);
      icon.width = icon.height = 36;

      const name = new Text(label, { fill: 0xffffff, fontSize: 16, fontWeight: '600' } as any);
      const t3   = new Text(p3.toFixed(2), { fill: 0xffffff, fontSize: 16 } as any);
      const t4   = new Text(p4.toFixed(2), { fill: 0xffffff, fontSize: 16 } as any);
      const t5   = new Text(p5.toFixed(2), { fill: 0xffffff, fontSize: 16 } as any);

      icon.position.set(colX[0] + 18, 0);
      name.position.set(colX[0] + 44, -12);
      t3.position.set(colX[1], -12);
      t4.position.set(colX[2], -12);
      t5.position.set(colX[3], -12);

      const underline = new Graphics().rect(colX[0], 16, colX[3] + 52 - colX[0], 1)
        .fill({ color: 0xffffff, alpha: 0.12 });

      line.addChild(icon, name, t3, t4, t5, underline);
      line.position.set(0, y);
      y += 30;

      rows.addChild(line);
    }

    root.addChild(title, hIcon, h3, h4, h5, rows);
    return root;
  }

  private makePage3(): Page {
    const root = new Container();

    const title = this.makeTitle('BETTING & GAME OVER', PURPLE); // title in purple
    const body  = this.makeBody(
      'Use the – / + buttons to select bet amounts: 10, 20, 50, 100, 200, 500 (wraps at ends).\n' +
      'Each spin subtracts the chosen amount from your FUN balance.\n' +
      'If your balance reaches 0, the game ends.'
    );

    title.position.set(title.x, 0);
    body.position.set(body.x, title.y + title.height + 12);

    root.addChild(title, body);
    return root;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────────
  private animateTo(targetAlpha: number, done?: () => void) {
    const start = this.alpha;
    const dur = 180;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      this.alpha = start + (targetAlpha - start) * k;
      if (k < 1) requestAnimationFrame(step);
      else { this.alpha = targetAlpha; done?.(); }
    };
    requestAnimationFrame(step);
  }

  private makeCloseChip(label: string, r: number) {
    const c = new Container();
    const g = new Graphics()
      .circle(0, 0, r)
      .fill({ color: PURPLE, alpha: 1 })
      .stroke({ width: 3, color: YELLOW, alpha: 1 });
    const t = new Text({ text: label, style: { fill: 0xffffff, fontSize: 18, fontWeight: '900', align: 'center' } as any });
    (t as any).anchor?.set?.(0.5);
    c.addChild(g, t);
    c.eventMode = 'static'; c.cursor = 'pointer';
    c.on('pointerdown', () => c.scale.set(0.96));
    const up = () => c.scale.set(1);
    c.on('pointerup', up);
    c.on('pointerupoutside', up);
    return c;
  }

  private makeChevron(dir: '<' | '>', size: number, color: number) {
    const c = new Container();
    const g = new Graphics();
    const w = size, h = size * 1.2;
    g.poly([
      dir === '<' ?  w/2 : -w/2, -h/2,
      dir === '<' ? -w/2 :  w/2,  0,
      dir === '<' ?  w/2 : -w/2,  h/2,
    ]).fill({ color }).stroke({ width: 3, color: 0x000000, alpha: 0.35 });
    c.addChild(g);
    c.eventMode = 'static'; c.cursor = 'pointer';

    // generous rectangular hit area
    const pad = 12;
    c.hitArea = new Rectangle(-w/2 - pad, -h/2 - pad, w + pad*2, h + pad*2);
    return c;
  }

  private prev() {
    const target = this.pageIndex - 1;
    if (target >= 0) {
      SFX.play?.('ui_click');
      this.goTo(target);
    }
  }

  private next() {
    const target = this.pageIndex + 1;
    if (target < this.pages.length) {
      SFX.play?.('ui_click');
      this.goTo(target);
    }
  }

  private goTo(i: number) {
    this.pageIndex = Math.max(0, Math.min(this.pages.length - 1, i));
    this.updatePagesVisibility();
    this.updateNavState();
  }

  private updatePagesVisibility() {
    this.pages.forEach((p, i) => p.visible = (i === this.pageIndex));
  }

  private updateNavState() {
    const atFirst = this.pageIndex === 0;
    const atLast  = this.pageIndex === this.pages.length - 1;

    this.leftBtn.alpha = atFirst ? 0.35 : 1;
    this.rightBtn.alpha = atLast ? 0.35 : 1;

    this.leftBtn.eventMode = atFirst ? 'none' : 'static';
    this.rightBtn.eventMode = atLast ? 'none' : 'static';
  }
}
