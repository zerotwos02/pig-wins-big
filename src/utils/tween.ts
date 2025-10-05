// src/utils/tween.ts
import { Ticker } from 'pixi.js';
import { App } from '@core/app';

export type EaseFn = (t: number) => number;

export const easeOutCubic: EaseFn = (t) => 1 - Math.pow(1 - t, 3);

export const easeOutBack: EaseFn = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function tween(opts: {
  duration: number;                 // ms
  from?: number; to?: number;
  ease?: EaseFn;
  update: (t01: number, value?: number) => void;
  complete?: () => void;
}) {
  const ease = opts.ease ?? easeOutCubic;
  const start = performance.now();
  const from = opts.from ?? 0;
  const to = opts.to ?? 1;
  const diff = to - from;

  const tick = (_t: Ticker) => {
    const p = Math.max(0, Math.min(1, (performance.now() - start) / opts.duration));
    const e = ease(p);
    opts.update(e, from + diff * e);
    if (p >= 1) {
      App.pixi.ticker.remove(tick);
      opts.complete?.();
    }
  };
  App.pixi.ticker.add(tick);
  return () => App.pixi.ticker.remove(tick);
}
