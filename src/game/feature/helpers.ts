// src/game/feature/helpers.ts
import { GRID_COLS, GRID_ROWS } from '@game/config';

// --- key normalization -------------------------------------------------------
/**
 * Normalize a texture key:
 * - take basename after last '/'
 * - lowercase
 * - strip query/hash
 * - strip common extensions (.png/.jpg/.jpeg/.webp/.avif/.gif/.svg)
 * Example:
 *   "ui/hammer-gray.png?v=2" -> "hammer-gray"
 */
export const normKey = (k: string) => {
  let s = k ?? '';
  const slash = s.lastIndexOf('/');
  if (slash >= 0) s = s.slice(slash + 1);
  s = s.split('?')[0].split('#')[0];
  s = s.toLowerCase();
  s = s.replace(/\.(png|jpg|jpeg|webp|avif|gif|svg)$/i, '');
  return s;
};

// --- kind checks -------------------------------------------------------------
export const isPigKey = (k: string) => {
  const t = normKey(k);
  // accept "pig", "pig_gold", plus versions like "pig_gold_v2", "pig-bright"
  return t === 'pig' || t.startsWith('pig_') || t.startsWith('pig-');
};

export const isGoldPigKey = (k: string) => {
  const t = normKey(k);
  // accept "pig_gold" and variants like "pig_gold_v2"
  return t === 'pig_gold' || t.startsWith('pig_gold');
};

export const isHammerKey = (k: string) => {
  const t = normKey(k);
  // accept "hammer" and variants like "hammer_gray", "hammer-01"
  return t === 'hammer' || t.startsWith('hammer_') || t.startsWith('hammer-');
};

// --- scans -------------------------------------------------------------------
/** Return indices of all pig cells (pig or pig_gold) on the visible grid. */
export function findPigCells(
  grid: string[],
  cols = GRID_COLS,
  rows = GRID_ROWS
): number[] {
  const out: number[] = [];
  const n = cols * rows;
  for (let i = 0; i < n; i++) {
    if (isPigKey(grid[i])) out.push(i);
  }
  return out;
}

/** Return indices of all hammer cells on the visible grid. */
export function findHammerCells(
  grid: string[],
  cols = GRID_COLS,
  rows = GRID_ROWS
): number[] {
  const out: number[] = [];
  const n = cols * rows;
  for (let i = 0; i < n; i++) {
    if (isHammerKey(grid[i])) out.push(i);
  }
  return out;
}

/** True if there is at least one pig on each reel (column). */
export function hasPigOnEveryReel(
  grid: string[],
  cols = GRID_COLS,
  rows = GRID_ROWS
): boolean {
  for (let c = 0; c < cols; c++) {
    let found = false;
    for (let r = 0; r < rows; r++) {
      if (isPigKey(grid[r * cols + c])) { found = true; break; }
    }
    if (!found) return false;
  }
  return true;
}

// --- neighbors & utils -------------------------------------------------------
/** 4-neighborhood indices (up/down/left/right) within bounds. */
export function neighborsOf(
  idx: number,
  cols = GRID_COLS,
  rows = GRID_ROWS
): number[] {
  const r = Math.floor(idx / cols);
  const c = idx % cols;
  const out: number[] = [];
  if (c > 0) out.push(r * cols + (c - 1));
  if (c < cols - 1) out.push(r * cols + (c + 1));
  if (r > 0) out.push((r - 1) * cols + c);
  if (r < rows - 1) out.push((r + 1) * cols + c);
  return out;
}

/** Pick a random element from a non-empty array. */
export function randomPick<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[(Math.random() * arr.length) | 0];
}
