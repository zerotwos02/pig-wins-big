// src/game/paytable.ts
export const SPECIAL = new Set(['pig', 'pig_gold', 'hammer', 'wild_feather']);
/**
 * Ways pay per symbol, indexed by run length (1..5 on your grid).
 * Numbers are example multipliers; tweak later to match math.
 */
export const PAYTABLE = {
    diamond: [0, 0, 1, 2, 4, 8],
    gold_bars: [0, 0, 1, 2, 4, 8],
    cash_stack: [0, 0, 1, 2, 5, 10],
    coin: [0, 0, 1, 2, 5, 12],
    dollar: [0, 0, 1, 3, 6, 15],
    money_bag: [0, 0, 2, 4, 8, 20],
    pig: [0, 0, 0, 0, 0, 0], // handled by feature logic
    pig_gold: [0, 0, 0, 0, 0, 0], // handled by feature logic
    wild_feather: [0, 0, 0, 0, 0, 0], // wild; we’ll fold into matches
    hammer: [0, 0, 0, 0, 0, 0], // special; base smash handled separately
};
