// src/net/mock-server.ts
import {
  Symbol as PbSymbol,
  type SpinResponse,
  SpinResponseSchema,
  GridSchema,
  BaseWinSchema,
  type BaseWin,
  PigFeatureSchema,
} from "../gen/game_pb";
import {
  GRID_COLS as COLS,
  GRID_ROWS as ROWS,
  PIG_TRIGGER_COUNT,
} from "../game/config";
import { create } from "@bufbuild/protobuf";

// ───────────────────────────────────────────────────────────────
// Configuration & utility helpers
// ───────────────────────────────────────────────────────────────

// line-pay symbols (adjust to your set)
const LINE_PAY_SYMS = [
  PbSymbol.SYM_DIAMOND,
  PbSymbol.SYM_GOLD_BARS,
  PbSymbol.SYM_CASH,
  PbSymbol.SYM_COIN,
];

// random pool of symbols
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

// pig symbol values (× stake)
const PINK_VALUES = [0.5, 1, 2, 3, 5];
const GOLD_VALUES = [5, 10, 20, 50, 100];

// helpers
const idx = (r: number, c: number) => r * COLS + c;
const rc = (i: number) => ({ r: (i / COLS) | 0, c: i % COLS });
function rand<T>(a: T[]): T { return a[(Math.random() * a.length) | 0]; }

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

// ───────────────────────────────────────────────────────────────
// Core mock win calculations
// ───────────────────────────────────────────────────────────────

function powerPays(cells: number[], stake: number) {
  const baseWins: BaseWin[] = [];
  const winIndexSet = new Set<number>();

  for (const sym of LINE_PAY_SYMS) {
    let reels = 0;
    const counts: number[] = [];
    const perReelIdx: number[][] = [];

    for (let c = 0; c < COLS; c++) {
      let count = 0;
      const inds: number[] = [];
      for (let r = 0; r < ROWS; r++) {
        const i = idx(r, c);
        if (cells[i] === sym) {
          count++;
          inds.push(i);
        }
      }
      if (c === 0 && count === 0) break; // must start on reel 1
      if (count > 0) {
        reels++;
        counts.push(count);
        perReelIdx.push(inds);
      } else break;
    }

    if (reels >= 3) {
      const ways = counts.reduce((a, b) => a * b, 1);
      const perWay = PAY[sym]?.[reels] ?? 0;
      const amount = ways * perWay * stake;
      if (amount > 0) {
        const allIdx = perReelIdx.flat();
        allIdx.forEach(i => winIndexSet.add(i));
        baseWins.push(
          create(BaseWinSchema, {
            symbol: sym,
            reels,
            ways,
            amount,
            indices: allIdx,
          })
        );
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
        const mult = s === PbSymbol.SYM_PIG ? rand(PINK_VALUES) : rand(GOLD_VALUES);
        sum += mult * stake;
      }
    }
  }
  return sum;
}

function countPigs(cells: number[]) {
  let n = 0;
  const idxs: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const s = cells[i];
    if (s === PbSymbol.SYM_PIG || s === PbSymbol.SYM_PIG_GOLD) {
      n++;
      idxs.push(i);
    }
  }
  return { n, idxs };
}

// ───────────────────────────────────────────────────────────────
// Main exported mock spin
// ───────────────────────────────────────────────────────────────

export async function mockSpin(stake: number): Promise<SpinResponse> {
  // 1) random 5×5 grid
  const cells = Array.from({ length: ROWS * COLS }, () => rand(POOL));

  // 2) base line wins
  const { baseWins, baseWinTotal, winIndices } = powerPays(cells, stake);

  // 3) hammer instant collection
  const hammerPay = hammerInstantCollect(cells, stake);

  // 4) feature trigger (basic placeholder)
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

  // 5) assemble protobuf response
  const totalWin = baseWinTotal + hammerPay + (feature?.featureWin ?? 0);
  return create(SpinResponseSchema, {
    grid: create(GridSchema, { cells }),
    baseWins,
    baseWinTotal: baseWinTotal + hammerPay,
    winIndices,
    feature,
    totalWin,
  });
}
