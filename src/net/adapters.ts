// src/net/adapters.ts
import {
  SpinResponse as PbSpinResponse,
  BaseWin as PbBaseWin,
  Symbol as PbSymbol,
} from '../gen/game_pb';

// map proto enum → your texture ids
const TEX: Record<number, string> = {
  [PbSymbol.SYM_PIG]:       'pig',
  [PbSymbol.SYM_PIG_GOLD]:  'pig_gold',
  [PbSymbol.SYM_WILD]:      'wild_feather', // ← renamed
  [PbSymbol.SYM_HAMMER]:    'hammer',
  [PbSymbol.SYM_DIAMOND]:   'diamond',
  [PbSymbol.SYM_GOLD_BARS]: 'gold_bars',
  [PbSymbol.SYM_CASH]:      'cash_stack',   // ← your sprite name
  [PbSymbol.SYM_COIN]:      'coin',
  // (Optional) your proto doesn't have DOLLAR/MONEY_BAG yet; they can still be used as filler
};


export type ViewBaseWin = {
  symbol: string;
  reels: number;
  ways: number;
  amount: number;
  indices: number[];
};

export type ViewSpin = {
  grid: string[];           // 49 texture keys for your sprites
  baseWinTotal: number;     // FUN
  baseWins: ViewBaseWin[];
  winIndices: number[];
  totalWin: number;         // FUN (base + feature)
  feature?: {
    triggered: boolean;
    pigsTotal: number;
    pigIndices: number[];
    fullBoardDouble: boolean;
    featureWin: number;
    // (events are available in res.feature.events if/when you need them)
  };
  // keep raw in case you need exact fields later
  _raw: PbSpinResponse;
};

export function toView(res: PbSpinResponse): ViewSpin {
  const grid = (res.grid?.cells ?? []).map((id) => TEX[id] ?? 'pig');
  const baseWins: ViewBaseWin[] = (res.baseWins ?? []).map((w: PbBaseWin) => ({
    symbol: TEX[w.symbol] ?? 'unknown',
    reels: w.reels ?? 0,
    ways: w.ways ?? 0,
    amount: w.amount ?? 0,
    indices: [...(w.indices ?? [])],
  }));

  const feature = res.feature
    ? {
        triggered: !!res.feature.triggered,
        pigsTotal: res.feature.pigsTotal ?? 0,
        pigIndices: [...(res.feature.pigIndices ?? [])],
        fullBoardDouble: !!res.feature.fullBoardDouble,
        featureWin: res.feature.featureWin ?? 0,
      }
    : undefined;

  return {
    grid,
    baseWinTotal: res.baseWinTotal ?? 0,
    baseWins,
    winIndices: [...(res.winIndices ?? [])],
    totalWin: res.totalWin ?? 0,
    feature,
    _raw: res,
  };
}
