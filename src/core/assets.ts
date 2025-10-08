// src/boot/assets.ts (or wherever loadBoot lives)
import { Assets } from 'pixi.js';

export async function loadBoot() {
  Assets.addBundle('ui', {
    pig:         '/assets/images/pig.png',
    pig_gold:    '/assets/images/pig_gold.png',
    wild_feather:'/assets/images/wild_feather.png',
    hammer:      '/assets/images/hammer.png',
    coin:        '/assets/images/coin.png',
    money_bag:   '/assets/images/money_bag.png',
    diamond:     '/assets/images/diamond.png',
    gold_bars:   '/assets/images/gold_bars.png',
    cash_stack:  '/assets/images/cash_stack.png',
    dollar:      '/assets/images/dollar.png',

    // NEW:
    banker:      '/assets/images/banker.png',
    A:           '/assets/images/sym_A.png',
    K:           '/assets/images/sym_K.png',
    Q:           '/assets/images/sym_Q.png',
    J:           '/assets/images/sym_J.png',
    '10':        '/assets/images/sym_10.png',

    // UI
    spin_btn:    '/assets/images/spin_btn.png',
     spin_btn_red:    '/assets/images/spin_btn_red.png',
    title_pigwins: '/assets/images/title_pigwins.png',
    panel:       '/assets/images/panel.png',
    footer_band: '/assets/images/footer_band.png',
    bg:          '/assets/images/bg.jpg',
  });
  await Assets.loadBundle('ui');
}
