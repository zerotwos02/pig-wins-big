// src/styles/theme.ts
export const COLOR = {
  gold1: 0xFFF3B0, // highlight
  gold2: 0xFFD479, // mid
  gold3: 0xB68019, // shadow
  purple: 0x4B007F,
  purpleDark: 0x2C004A,
  green: 0x09B200,
  white: 0xFFFFFF,
  black: 0x000000,
};

export const GOLD_GRADIENT = {
  // for Text (Pixi supports gradient arrays)
  fill: ['#FFF3B0', '#FFD479', '#B68019'],
  stops: [0, 0.55, 1],
};

export const FX = {
  shadow: { distance: 10, alpha: 0.4, blur: 6 },
  glowGold: { color: 0xFFD479, outerStrength: 1.8, innerStrength: 0.0, quality: 0.25 },
  glowGreen:{ color: 0x09B200, outerStrength: 1.4, innerStrength: 0.0, quality: 0.2 },
};
