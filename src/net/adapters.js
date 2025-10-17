// src/net/adapters.ts
import { Symbol as PbSymbol, } from '../gen/game_pb';
// map proto enum → your texture ids
const TEX = {
    [PbSymbol.SYM_PIG]: 'pig',
    [PbSymbol.SYM_PIG_GOLD]: 'pig_gold',
    [PbSymbol.SYM_WILD]: 'wild_feather', // ← renamed
    [PbSymbol.SYM_HAMMER]: 'hammer',
    [PbSymbol.SYM_DIAMOND]: 'diamond',
    [PbSymbol.SYM_GOLD_BARS]: 'gold_bars',
    [PbSymbol.SYM_CASH]: 'cash_stack', // ← your sprite name
    [PbSymbol.SYM_COIN]: 'coin',
    // (Optional) your proto doesn't have DOLLAR/MONEY_BAG yet; they can still be used as filler
};
export function toView(res) {
    const grid = (res.grid?.cells ?? []).map((id) => TEX[id] ?? 'pig');
    const baseWins = (res.baseWins ?? []).map((w) => ({
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
