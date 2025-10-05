// src/net/mock-server.ts (top of file)
import {
  Symbol as PbSymbol,
  type SpinResponse,
  SpinResponseSchema,
  GridSchema,
  BaseWinSchema,
  PigFeatureSchema,
} from "../gen/game_pb";              // ← relative path
import {
  GRID_COLS as COLS,
  GRID_ROWS as ROWS,
  PIG_TRIGGER_COUNT,
} from "../game/config";                          // ← relative path

import { create } from "@bufbuild/protobuf";

// line-pay symbols (adjust to your set)
const LINE_PAY_SYMS = [
  PbSymbol.SYM_DIAMOND,
  PbSymbol.SYM_GOLD_BARS,
  PbSymbol.SYM_CASH,
  PbSymbol.SYM_COIN,
];

// random pool and simple rates
const POOL = [
  PbSymbol.SYM_DIAMOND,
  PbSymbol.SYM_GOLD_BARS,
  PbSymbol.SYM_CASH,
  PbSymbol.SYM_COIN,
  PbSymbol.SYM_PIG,
  PbSymbol.SYM_PIG_GOLD,
  PbSymbol.SYM_WILD,
  PbSymbol.SYM_HAMMER,
];

// paytable (× stake per WAY) indexed by reels length 0..5
const PAY: Record<number, number[]> = {
  [PbSymbol.SYM_DIAMOND]:   [0, 0, 0.5, 1.0, 2.0, 4.0],
  [PbSymbol.SYM_GOLD_BARS]: [0, 0, 0.4, 0.8, 1.6, 3.2],
  [PbSymbol.SYM_CASH]:      [0, 0, 0.3, 0.6, 1.2, 2.4],
  [PbSymbol.SYM_COIN]:      [0, 0, 0.2, 0.4, 0.8, 1.6],
};

// shadow pig values for hammer instant collect (× stake)
const PINK_VALUES = [0.5, 1, 2, 3, 5];
const GOLD_VALUES = [5, 10, 20, 50, 100];

const idx = (r: number, c: number) => r * COLS + c;
const rc = (i: number) => ({ r: (i / COLS) | 0, c: i % COLS });
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function rand<T>(a: T[]) { return a[(Math.random() * a.length) | 0]; }

// neighbors: up/down/left/right with row-safety for left/right
function neighbors4(i: number) {
  const { r, c } = rc(i);
  const n: number[] = [];
  if (r > 0) n.push(idx(r - 1, c));
  if (r < ROWS - 1) n.push(idx(r + 1, c));
  if (c > 0) n.push(idx(r, c - 1));
  if (c < COLS - 1) n.push(idx(r, c + 1));
  return n;
}

function powerPays(cells: number[], stake: number) {
  const baseWins: ReturnType<typeof create<typeof BaseWinSchema>>[] = [];
  const winIndexSet = new Set<number>();

  for (const sym of LINE_PAY_SYMS) {
    let reels = 0;
    const counts: number[] = [];
    const perReelIdx: number[][] = [];

    for (let c = 0; c < COLS; c++) {
      let count = 0; const inds: number[] = [];
      for (let r = 0; r < ROWS; r++) {
        const i = idx(r, c);
        if (cells[i] === sym) { count++; inds.push(i); }
      }
      if (c === 0 && count === 0) break;      // must start on reel 1
      if (count > 0) { reels++; counts.push(count); perReelIdx.push(inds); }
      else break;
    }

    if (reels >= 3) {
      const ways = counts.reduce((a, b) => a * b, 1);
      const perWay = (PAY[sym] && PAY[sym][reels]) || 0;
      const amount = ways * perWay * stake;
      if (amount > 0) {
        const allIdx = perReelIdx.flat();
        allIdx.forEach(i => winIndexSet.add(i));
        baseWins.push(create(BaseWinSchema, {
          symbol: sym,
          reels,
          ways,
          amount,
          indices: allIdx,
        }));
      }
    }
  }

  const baseWinTotal = baseWins.reduce((a, w) => a + (w.amount ?? 0), 0);
  return { baseWins, baseWinTotal, winIndices: Array.from(winIndexSet) };
}

function hammerInstantCollect(cells: number[], stake: number) {
  let sum = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== PbSymbol.SYM_HAMMER) continue;
    for (const j of neighbors4(i)) {
      const s = cells[j];
      if (s === PbSymbol.SYM_PIG || s === PbSymbol.SYM_PIG_GOLD) {
        const mult = (s === PbSymbol.SYM_PIG) ? rand(PINK_VALUES) : rand(GOLD_VALUES);
        sum += mult * stake;
      }
    }
  }
  return sum;
}

function countPigs(cells: number[]) {
  let n = 0; const idxs: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const s = cells[i];
    if (s === PbSymbol.SYM_PIG || s === PbSymbol.SYM_PIG_GOLD) { n++; idxs.push(i); }
  }
  return { n, idxs };
}

export async function mockSpin(stake: number): Promise<SpinResponse> {
  // 1) random 5×5
  const cells = Array.from({ length: ROWS * COLS }, () => POOL[(Math.random() * POOL.length) | 0]);

  // 2) base wins
  const { baseWins, baseWinTotal, winIndices } = powerPays(cells, stake);

  // 3) hammer insta-collect
  const hammerPay = hammerInstantCollect(cells, stake);

  // 4) feature trigger (placeholder; we’ll script events later)
  const { n: pigCount, idxs: pigIndices } = countPigs(cells);
  const feature =
    pigCount >= PIG_TRIGGER_COUNT
      ? create(PigFeatureSchema, {
          triggered: true,
          pigsTotal: pigCount,
          pigIndices,
          fullBoardDouble: pigCount === ROWS * COLS,
          featureWin: 0,
          events: [],
        })
      : undefined;

  // 5) assemble
  return create(SpinResponseSchema, {
    grid: create(GridSchema, { cells }),
    baseWinTotal: baseWinTotal + hammerPay,
    baseWins,
    winIndices,
    feature,
    totalWin: baseWinTotal + hammerPay + (feature?.featureWin ?? 0),
  });
}
