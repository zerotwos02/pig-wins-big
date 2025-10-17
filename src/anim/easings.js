export const linear = (t) => t;
// smooth & natural ramps
export const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutExpo = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
export const easeOutBack = (s = 1.70158) => (t) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
