// src/game/eval/ways.ts
import { GRID_COLS, GRID_ROWS } from '@game/config';
import { PAYTABLE, SPECIAL } from '@game/symbols';

export type WayWin = {
  symbol: string;
  length: number;      // reels in the run
  ways: number;        // product of matches per reel
  payout: number;      // stake * paytable[symbol][length] * ways
  indices: number[];   // cells involved (for highlight)
};

export function evaluateWays(
  grid: string[],   // row-major, length = GRID_COLS * GRID_ROWS
  stake: number,
  cols = GRID_COLS,
  rows = GRID_ROWS,
): { wins: WayWin[]; total: number } {
  const wins: WayWin[] = [];

  // Unique base symbols appearing on the leftmost reel (ignore specials)
  const baseOnReel0 = new Set<string>();
  for (let r = 0; r < rows; r++) {
    const s = norm(grid[r * cols + 0]);
    if (!SPECIAL.has(s as any)) baseOnReel0.add(s);
  }

  for (const sym of baseOnReel0) {
    const counts: number[] = [];
    const reelIdx: number[][] = [];

    for (let c = 0; c < cols; c++) {
      const matches: number[] = [];
      for (let r = 0; r < rows; r++) {
        const i = r * cols + c;
        const g = norm(grid[i]);
        if (g === sym || g === 'wild_feather') matches.push(i);
      }
      if (matches.length === 0) break;      // stop when a reel has no match
      counts.push(matches.length);
      reelIdx.push(matches);
    }

    const length = counts.length;
    if (length < 2) continue;               // adjust to 2+ or 3+ as you prefer

    const ways = counts.reduce((a, b) => a * b, 1);
    const mul  = PAYTABLE[sym as keyof typeof PAYTABLE]?.[length] ?? 0;
    const payout = Math.max(0, mul * ways * stake);

    if (payout > 0) {
      const indices: number[] = [];
      for (let c = 0; c < length; c++) indices.push(...reelIdx[c]);
      wins.push({ symbol: sym, length, ways, payout, indices });
    }
  }

  const total = wins.reduce((a, w) => a + w.payout, 0);
  return { wins, total };
}

function norm(k: string): string {
  const p = k.lastIndexOf('/');
  return p >= 0 ? k.slice(p + 1) : k;
}
