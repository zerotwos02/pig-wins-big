import { COLOR, GOLD_GRADIENT } from './theme';
export const goldNum = (size = 42) => ({
    fontFamily: 'Bebas Neue, DIN Condensed, system-ui, sans-serif',
    fontSize: size,
    fill: GOLD_GRADIENT.fill,
    fillGradientStops: GOLD_GRADIENT.stops,
    fillGradientType: 1,
    stroke: { color: COLOR.gold3, width: 3, join: 'round' },
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowDistance: 3,
    dropShadowBlur: 2,
});
export const labelSmall = (size = 22) => ({
    fontFamily: 'Bebas Neue, DIN Condensed, system-ui, sans-serif',
    fontSize: size,
    fill: COLOR.white,
});
