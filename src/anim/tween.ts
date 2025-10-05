// src/anim/tween.ts
import { Ticker } from 'pixi.js';
import type { Easing } from './easings';

type TweenOpts = {
  from: number;
  to: number;
  duration: number;       // ms
  ease?: Easing;
  onUpdate: (v: number) => void;
  onComplete?: () => void;
};

export type TweenHandle = { stop: () => void; active: boolean };

export function tween(opts: TweenOpts): TweenHandle {
  const ease = opts.ease ?? ((t: number) => t);
  const start = performance.now();
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    const now = performance.now();
    const t = Math.min(1, (now - start) / opts.duration);
    const v = opts.from + (opts.to - opts.from) * ease(t);
    opts.onUpdate(v);
    if (t >= 1) {
      Ticker.shared.remove(tick);
      opts.onComplete?.();
    }
  };

  Ticker.shared.add(tick);
  return {
    active: true,
    stop: () => {
      if (stopped) return;
      stopped = true;
      Ticker.shared.remove(tick);
    },
  };
}
