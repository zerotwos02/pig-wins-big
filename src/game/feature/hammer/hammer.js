// src/game/feature/hammer/hammer.ts
//
// Pure logic for the Hammer feature (no rendering).
// Call stepHammers(...) once per (re)spin after reels stop.
import { GRID_COLS, GRID_ROWS } from '@/game/config';
import { neighborsOf, randomPick } from '@/game/feature/helpers';
export function areAdjacent(a, b) {
    const ra = Math.floor(a / GRID_COLS), ca = a % GRID_COLS;
    const rb = Math.floor(b / GRID_COLS), cb = b % GRID_COLS;
    return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
}
/** Fuse adjacent hammers: both totals become (A + B). Run once per respin before movement. */
export function fuseAdjacentHammers(hammerIndices, states) {
    // Deterministic order: left→right, then top→bottom
    const ordered = [...hammerIndices].sort((a, b) => {
        const ra = Math.floor(a / GRID_COLS), ca = a % GRID_COLS;
        const rb = Math.floor(b / GRID_COLS), cb = b % GRID_COLS;
        return ra === rb ? ca - cb : ra - rb;
    });
    for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
            const a = ordered[i], b = ordered[j];
            if (!areAdjacent(a, b))
                continue;
            const sA = states.get(a) ?? { total: 0 };
            const sB = states.get(b) ?? { total: 0 };
            const sum = sA.total + sB.total;
            sA.total = sum;
            sB.total = sum;
            states.set(a, sA);
            states.set(b, sB);
        }
    }
}
/** One hammer acts: smash adjacent locked pig OR roam to a different cell (≠ current, ≠ prev if possible). */
export function actHammerOne(hammerIndex, states, locked, allIndices) {
    const st = states.get(hammerIndex) ?? { total: 0 };
    // Prefer smashing an adjacent locked pig (orthogonal only)
    const adjLocked = neighborsOf(hammerIndex, GRID_COLS, GRID_ROWS)
        .filter((n) => locked.has(n));
    if (adjLocked.length > 0) {
        // Deterministic pick: left→right, then top→bottom
        adjLocked.sort((a, b) => {
            const ra = Math.floor(a / GRID_COLS), ca = a % GRID_COLS;
            const rb = Math.floor(b / GRID_COLS), cb = b % GRID_COLS;
            return ra === rb ? ca - cb : ra - rb;
        });
        const target = adjLocked[0];
        const pig = locked.get(target);
        st.total += pig.amount;
        states.set(hammerIndex, { ...st, prevIndex: hammerIndex });
        locked.delete(target);
        return { to: target, smashed: { at: target, amount: pig.amount } };
    }
    // Otherwise roam (avoid immediate back-and-forth)
    const forbidden = new Set([hammerIndex]);
    if (st.prevIndex !== undefined)
        forbidden.add(st.prevIndex);
    const candidates = allIndices.filter((i) => !forbidden.has(i));
    const moveTo = candidates.length ? randomPick(candidates) : hammerIndex;
    states.set(hammerIndex, { ...st, prevIndex: hammerIndex });
    return { to: moveTo };
}
/** Full step for one (re)spin: fuse, act each hammer once, then re-key states to new indices. */
export function stepHammers(visibleHammerIndices, prevStates, locked) {
    // Seed states for visible hammers this step (persist totals when possible)
    const states = new Map();
    for (const idx of visibleHammerIndices) {
        const prev = prevStates?.get(idx);
        states.set(idx, prev ? { ...prev } : { total: 0 });
    }
    // Merge adjacent hammers' totals (both sides see the same sum)
    fuseAdjacentHammers(visibleHammerIndices, states);
    // Deterministic hammer order: left→right, then top→bottom
    const hOrder = [...visibleHammerIndices].sort((a, b) => {
        const ra = Math.floor(a / GRID_COLS), ca = a % GRID_COLS;
        const rb = Math.floor(b / GRID_COLS), cb = b % GRID_COLS;
        return ra === rb ? ca - cb : ra - rb;
    });
    const moved = new Map();
    const smashed = [];
    const allIndices = [...Array(GRID_COLS * GRID_ROWS).keys()];
    // De-dup: once a pig is smashed by the first eligible hammer, it's removed from 'locked'
    for (const hIdx of hOrder) {
        const action = actHammerOne(hIdx, states, locked, allIndices);
        moved.set(hIdx, action.to);
        if (action.smashed)
            smashed.push(action.smashed);
    }
    // Re-key states to their new positions
    const updated = new Map();
    for (const [idx, st] of states)
        if (!moved.has(idx))
            updated.set(idx, st);
    for (const [from, to] of moved)
        updated.set(to, states.get(from));
    return { hammerStates: updated, locked, moved, smashed };
}
