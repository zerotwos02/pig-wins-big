// src/game/feature/hammer/base-resolve.ts
import { GRID_COLS, GRID_ROWS } from '@/game/config';
import { isPigKey, isGoldPigKey, isHammerKey, neighborsOf, normKey } from '@/game/feature/helpers';

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function rollPigAmount(gold: boolean): number {
  const r = Math.random();
  if (!gold) {
    if (r < 0.65) return [50, 100, 150, 200][(Math.random() * 4) | 0];
    if (r < 0.95) return [300, 500][(Math.random() * 2) | 0];
    return Math.random() < 0.7 ? 1000 : 2000;
  } else {
    if (r < 0.60) return [250, 500, 750][(Math.random() * 3) | 0];
    if (r < 0.95) return 1000;
    return Math.random() < 0.7 ? 2500 : 5000;
  }
}

export type BaseHammerResult = {
  total: number;        // sum of all smashed pig values (paid immediately)
  indices: number[];    // cells to highlight (hammer + smashed pigs)
  smashed: Array<{ at: number; amount: number }>;
};

/**
 * Base-game rule:
 * For each HAMMER, smash ALL adjacent (4-neighbors) PIGS.
 * Reveal each pig's value and add to total (award immediately).
 * This does NOT mutate the grid; use indices for highlights/FX.
 */
export function computeHammerAwardsBase(
  grid: string[],
  cols = GRID_COLS,
  rows = GRID_ROWS
): BaseHammerResult {
  const n = cols * rows;
  const indices: number[] = [];
  const smashed: Array<{ at: number; amount: number }> = [];
  let total = 0;

  for (let i = 0; i < n; i++) {
    if (!isHammerKey(grid[i])) continue;
    indices.push(i);

    const adj = neighborsOf(i, cols, rows);
    for (const a of adj) {
      const k = grid[a];
      if (!isPigKey(k)) continue;

      const amt = rollPigAmount(isGoldPigKey(k));
      total += amt;
      smashed.push({ at: a, amount: amt });
      indices.push(a);
    }
  }

  // de-dup indices
  const uniq = Array.from(new Set(indices));
  return { total, indices: uniq, smashed };
}
