// src/game/feature/hammer/hammer.ts
//
// Pure logic for the Hammer feature (no rendering).
// Call stepHammers(...) once per respin after reels stop.

import { GRID_COLS, GRID_ROWS } from '@/game/config';
import { neighborsOf, randomPick } from '@/game/feature/helpers';

export type LockedPig = { amount: number; sym: string };
export type LockedMap = Map<number, LockedPig>;        // index -> pig data

export type HammerState = {
  total: number;        // absorbed value so far
  prevIndex?: number;   // last index to avoid immediately returning there when roaming
};
export type HammerStates = Map<number, HammerState>;   // hammer index -> state

export type StepResult = {
  hammerStates: HammerStates;          // updated states (keys reflect new indices)
  locked: LockedMap;                   // updated locked pigs
  moved: Map<number, number>;          // hammer index remap: from -> to
  smashed: Array<{ at: number; amount: number }>; // pigs smashed this step
};

export function areAdjacent(a: number, b: number): boolean {
  const ra = Math.floor(a / GRID_COLS), ca = a % GRID_COLS;
  const rb = Math.floor(b / GRID_COLS), cb = b % GRID_COLS;
  return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
}

/** Fuse adjacent hammers: both totals become (A + B). Run once per respin before movement. */
export function fuseAdjacentHammers(
  hammerIndices: number[],
  states: HammerStates
): void {
  for (let i = 0; i < hammerIndices.length; i++) {
    for (let j = i + 1; j < hammerIndices.length; j++) {
      const a = hammerIndices[i], b = hammerIndices[j];
      if (!areAdjacent(a, b)) continue;
      const sA = states.get(a) ?? { total: 0 };
      const sB = states.get(b) ?? { total: 0 };
      const sum = sA.total + sB.total;
      sA.total = sum; sB.total = sum;
      states.set(a, sA); states.set(b, sB);
    }
  }
}

/** One hammer acts: smash adjacent locked pig OR roam to a different cell (≠ current, ≠ prev if possible). */
export function actHammerOne(
  hammerIndex: number,
  states: HammerStates,
  locked: LockedMap,
  allIndices: number[]
): { to: number; smashed?: { at: number; amount: number } } {
  const st = states.get(hammerIndex) ?? { total: 0 };

  const adjLocked = neighborsOf(hammerIndex, GRID_COLS, GRID_ROWS).filter((n) => locked.has(n));
  if (adjLocked.length > 0) {
    const target = randomPick(adjLocked)!;
    const pig = locked.get(target)!;
    st.total += pig.amount;
    states.set(hammerIndex, { ...st, prevIndex: hammerIndex });
    locked.delete(target);
    return { to: target, smashed: { at: target, amount: pig.amount } };
  }

  const forbidden = new Set<number>([hammerIndex]);
  if (st.prevIndex !== undefined) forbidden.add(st.prevIndex);
  const candidates = allIndices.filter((i) => !forbidden.has(i));
  const moveTo = candidates.length ? randomPick(candidates)! : hammerIndex;

  states.set(hammerIndex, { ...st, prevIndex: hammerIndex });
  return { to: moveTo };
}

/** Full step for one respin: fuse, act each hammer, then re-key states to new indices. */
export function stepHammers(
  visibleHammerIndices: number[],
  prevStates: HammerStates | undefined,
  locked: LockedMap
): StepResult {
  const states: HammerStates = new Map();
  for (const idx of visibleHammerIndices) {
    const prev = prevStates?.get(idx);
    states.set(idx, prev ? { ...prev } : { total: 0 });
  }

  fuseAdjacentHammers(visibleHammerIndices, states);

  const moved = new Map<number, number>();
  const smashed: Array<{ at: number; amount: number }> = [];
  const allIndices = [...Array(GRID_COLS * GRID_ROWS).keys()];

  for (const hIdx of visibleHammerIndices) {
    const action = actHammerOne(hIdx, states, locked, allIndices);
    moved.set(hIdx, action.to);
    if (action.smashed) smashed.push(action.smashed);
  }

  const updated: HammerStates = new Map();
  for (const [idx, st] of states) if (!moved.has(idx)) updated.set(idx, st);
  for (const [from, to] of moved) updated.set(to, states.get(from)!);

  return { hammerStates: updated, locked, moved, smashed };
}
