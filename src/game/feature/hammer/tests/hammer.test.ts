import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  areAdjacent,
  fuseAdjacentHammers,
  actHammerOne,
  stepHammers,
  type HammerStates,
  type LockedMap,
} from '@/game/feature/hammer/hammer';
import { GRID_COLS, GRID_ROWS } from '@/game/config';

// Helpers
const idx = (r: number, c: number) => r * GRID_COLS + c;

describe('hammer logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('areAdjacent works for 4-neighbors', () => {
    expect(areAdjacent(idx(2,2), idx(2,3))).toBe(true); // right
    expect(areAdjacent(idx(2,2), idx(2,1))).toBe(true); // left
    expect(areAdjacent(idx(2,2), idx(1,2))).toBe(true); // up
    expect(areAdjacent(idx(2,2), idx(3,2))).toBe(true); // down
    expect(areAdjacent(idx(2,2), idx(3,3))).toBe(false); // diagonal not allowed
  });

  it('fuseAdjacentHammers sets both totals to A+B', () => {
    const a = idx(1,1), b = idx(1,2);
    const states: HammerStates = new Map([
      [a, { total: 20 }],
      [b, { total: 80 }],
    ]);
    fuseAdjacentHammers([a, b], states);
    expect(states.get(a)?.total).toBe(100);
    expect(states.get(b)?.total).toBe(100);
  });

  it('actHammerOne smashes an adjacent locked pig and moves onto it', () => {
    const h = idx(2,2);
    const pig = idx(2,3);
    const states: HammerStates = new Map([[h, { total: 10 }]]);
    const locked: LockedMap = new Map([[pig, { amount: 90, sym: 'pig' }]]);
    const allIndices = [...Array(GRID_COLS * GRID_ROWS).keys()];

    const res = actHammerOne(h, states, locked, allIndices);
    expect(res.to).toBe(pig);
    expect(res.smashed?.at).toBe(pig);
    expect(res.smashed?.amount).toBe(90);
    expect(states.get(h)?.total).toBe(100);
    expect(locked.has(pig)).toBe(false); // removed
  });

  it('actHammerOne roams when no adjacent pigs, avoiding prevIndex', () => {
    const h = idx(0,0);
    const states: HammerStates = new Map([[h, { total: 0, prevIndex: idx(0,1) }]]);
    const locked: LockedMap = new Map(); // none
    const all = [...Array(GRID_COLS * GRID_ROWS).keys()];

    const res = actHammerOne(h, states, locked, all);
    expect(res.to).not.toBe(h);
    expect(res.to).not.toBe(idx(0,1));
  });

  it('stepHammers: fuses neighbors, smashes pigs, re-keys moved states', () => {
    const hammerA = idx(2,1);
    const hammerB = idx(2,2); // adjacent to A
    const pigR = idx(2,3);

    // prev states (carry totals)
    const prev: HammerStates = new Map([
      [hammerA, { total: 30 }],
      [hammerB, { total: 70 }],
    ]);
    const locked: LockedMap = new Map([[pigR, { amount: 50, sym: 'pig' }]]);

    const step = stepHammers([hammerA, hammerB], prev, locked);

    // After fuse: both totals should be 100 BEFORE acting.
    // One of the hammers will act; since pig is adjacent only to hammerB, B should move to pigR.
    const movedTo = step.moved.get(hammerB);
    expect(movedTo).toBe(pigR);

    // States are re-keyed by destination
    expect(step.hammerStates.get(pigR)?.total).toBe(100 + 50); // absorbed pig 50
    expect(step.smashed[0].at).toBe(pigR);
  });
});
