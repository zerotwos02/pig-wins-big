// src/state/store.ts
import { events } from './events';

export type GameState = {
  balance: number;
  stake: number;
  win: number;
  isSpinning: boolean;
  autoplay: boolean;
  turbo: boolean;
};

const state: GameState = {
  balance: 10000,
  stake: 10,
  win: 0,
  isSpinning: false,
  autoplay: false,
  turbo: false,
};

const listeners = new Set<(s: GameState) => void>();
export function getState() { return state; }
export function subscribe(fn: (s: GameState) => void) { listeners.add(fn); return () => listeners.delete(fn); }

export const BET_STEPS = [10, 20, 50, 100, 200, 500] as const;
export type Bet = typeof BET_STEPS[number];

function notify() { for (const fn of listeners) fn(state); }

// keep setStake for direct sets if needed
export function setStake(v: number) {
  state.stake = v;
  notify();
  events.emit('StakeChanged', { stake: state.stake });
}

// looping stepper over the fixed steps
export function stepStake(dir: 1 | -1) {
  const idx = Math.max(0, BET_STEPS.indexOf(state.stake as Bet));
  const nextIdx = (idx + dir + BET_STEPS.length) % BET_STEPS.length;
  setStake(BET_STEPS[nextIdx]);
}

// (optional) remove or stop using the old free-form incStake
// export function incStake(_: number) { /* deprecated */ }

export function setWin(v: number) { state.win = v; notify(); }
export function setBalance(v: number) { state.balance = v; notify(); events.emit('BalanceChanged', { balance: v }); }
export function debitStake() { setBalance(Math.max(0, state.balance - state.stake)); }

export function setSpinning(v: boolean) { state.isSpinning = v; notify(); }
