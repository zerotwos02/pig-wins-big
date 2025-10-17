// src/game/config.ts
// ------------------------------
// Grid + layout
// ------------------------------
export const GRID_COLS = 5;
export const GRID_ROWS = 5;
export const CELL = 140; // pick what fits your art; 120–160 works well
// Trigger threshold for Lock & Win
export const PIG_TRIGGER_COUNT = 8; // set what you want (you had 5 before)
// Optional z-indexes if you use them
export const Z = { BG: 0, PANEL: 10, GRID: 20, HUD: 30, TOAST: 40 };
// Win tier thresholds (multiples of stake)
export const WIN_TIERS = [
    { title: 'Nice Win', mul: 2 },
    { title: 'Big Win', mul: 10 },
    { title: 'Mega Win', mul: 25 },
    { title: 'Epic Win', mul: 50 },
    { title: 'Legendary!', mul: 100 },
];
export const ENABLE_HAMMER_BASE = true;
