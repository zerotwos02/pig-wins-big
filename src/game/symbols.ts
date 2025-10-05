// src/game/symbols.ts
export const SYMBOLS = [
  'cash_stack','coin','diamond','dollar','gold_bars','hammer',
  'money_bag','pig','pig_gold','wild_feather',
] as const;
export type SymbolKey = typeof SYMBOLS[number];

export const SPECIAL = new Set<SymbolKey>(['pig','pig_gold','wild_feather','hammer']);

export const PAYTABLE: Record<Exclude<SymbolKey,
  'pig' | 'pig_gold' | 'wild_feather' | 'hammer'
>, number[]> = {
  diamond:     [0, 0, 1, 2, 4,  8],
  gold_bars:   [0, 0, 1, 2, 4,  8],
  cash_stack:  [0, 0, 1, 2, 5, 10],
  coin:        [0, 0, 1, 2, 5, 12],
  dollar:      [0, 0, 1, 3, 6, 15],
  money_bag:   [0, 0, 2, 4, 8, 20],
};
