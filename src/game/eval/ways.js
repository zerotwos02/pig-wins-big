// src/game/eval/ways.ts
import { GRID_COLS, GRID_ROWS } from '@game/config';
import { PAYTABLE, SPECIAL } from '@game/symbols';
export function evaluateWays(grid, // row-major, length = GRID_COLS * GRID_ROWS
stake, cols = GRID_COLS, rows = GRID_ROWS) {
    const wins = [];
    // Unique base symbols appearing on the leftmost reel (ignore specials)
    const baseOnReel0 = new Set();
    for (let r = 0; r < rows; r++) {
        const s = norm(grid[r * cols + 0]);
        if (!SPECIAL.has(s))
            baseOnReel0.add(s);
    }
    for (const sym of baseOnReel0) {
        const counts = [];
        const reelIdx = [];
        for (let c = 0; c < cols; c++) {
            const matches = [];
            for (let r = 0; r < rows; r++) {
                const i = r * cols + c;
                const g = norm(grid[i]);
                if (g === sym || g === 'wild_feather')
                    matches.push(i);
            }
            if (matches.length === 0)
                break; // stop when a reel has no match
            counts.push(matches.length);
            reelIdx.push(matches);
        }
        const length = counts.length;
        if (length < 2)
            continue; // adjust to 2+ or 3+ as you prefer
        const ways = counts.reduce((a, b) => a * b, 1);
        const mul = PAYTABLE[sym]?.[length] ?? 0;
        const payout = Math.max(0, mul * ways * stake);
        if (payout > 0) {
            const indices = [];
            for (let c = 0; c < length; c++)
                indices.push(...reelIdx[c]);
            wins.push({ symbol: sym, length, ways, payout, indices });
        }
    }
    const total = wins.reduce((a, w) => a + w.payout, 0);
    return { wins, total };
}
function norm(k) {
    const p = k.lastIndexOf('/');
    return p >= 0 ? k.slice(p + 1) : k;
}
