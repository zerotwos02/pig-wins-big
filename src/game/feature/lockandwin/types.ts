export type CellKey = string; // your visible key, e.g. 'pig', 'pig_gold', 'coin_50', etc.

export type LWConfig = {
  startSpins: number;       // e.g. 3
  lockKeys: string[];       // keys that lock (e.g. ['pig', 'pig_gold', 'coin_*'])
  valueOf: (k: CellKey) => number; // map a key to its FUN value
  isLockable: (k: CellKey) => boolean; // fast guard
};

export type LWOutcome = {
  total: number;
  locked: { index: number; key: CellKey; amount: number }[];
};

export type LWEvents = {
  onRound?: (round: number, spinsLeft: number, total: number) => void;
  onLock?: (index: number, amount: number) => void;
  onFinish?: (out: LWOutcome) => void;
};
