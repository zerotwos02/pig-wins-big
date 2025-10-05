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
export const Z = { BG: 0, PANEL: 10, GRID: 20, HUD: 30, TOAST: 40 } as const;

// Win tier thresholds (multiples of stake)
export const WIN_TIERS = [
  { title: 'Nice Win',   mul: 2 },
  { title: 'Big Win',    mul: 10 },
  { title: 'Mega Win',   mul: 25 },
  { title: 'Epic Win',   mul: 50 },
  { title: 'Legendary!', mul: 100 },
] as const;

export type WinTier = typeof WIN_TIERS[number];
export const ENABLE_HAMMER_BASE = true;

// ------------------------------
// Lock & Win types (moved here)
// ------------------------------

// Kinds used in feature logic / reels helpers
export type CellKind =
  | 'empty'
  | 'pig'
  | 'pig_gold'
  | 'wild'
  | 'hammer'
  | 'icon';

// A single cell on the logical grid
export interface Cell {
  kind: CellKind;
  pigValue?: number;     // shown during feature
  hammerValue?: number;  // accumulated by hammer during feature
  locked?: boolean;      // pigs lock during feature
}

// Feature config constants (if you ever use an engine)
export interface FeatureConfig {
  baseRespins: number;        // usually 3
  fullGridMultiplier: number; // usually 2x when full of pigs
}

// Runtime feature state (if you ever use an engine)
export interface FeatureState {
  active: boolean;
  respinsLeft: number;
  grid: Cell[][];    // same size as reels
  totalPot: number;  // values absorbed by hammers
  entryPigs: number; // pigs present at entry
}

// Outcome cell (what lands in an unlocked cell on a respin)
export interface SpinOutcomeCell {
  kind: CellKind;
  pigValue?: number; // server/maths may assign on spawn
}

// Full respin outcome (row-major)
export type SpinOutcome = SpinOutcomeCell[][];
