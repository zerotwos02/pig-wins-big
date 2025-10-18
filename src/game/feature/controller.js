// src/game/feature/controller.ts
import { Container, Graphics, Text, Sprite } from 'pixi.js';
import { GRID_COLS, CELL } from '@/game/config';
import { setFeatureMode, setSpinSpeedScale } from '@/game/reels/display-reels';
import { normKey, isPigKey, isGoldPigKey } from '@/game/feature/helpers';

// simple async delay helper used for timing between frames/steps
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── pacing / feature tuning ───────────────────────────────────────────────────
const RESPIN_START = 3;                  // starting number of respins granted
const MIN_SPIN_MS = 520;                 // minimum spin time before we allow STOP
const SLOW_SPIN_SCALE = 0.6;             // reel speed scale while feature active

// compact format helpers
const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const rc = (i) => ({ r: Math.floor(i / GRID_COLS), c: i % GRID_COLS }); // index -> row/col

/**
 * Random payout for pig symbols.
 * Gold pigs have a richer table; normal pigs skew toward smaller values.
 */
function rollPigAmount(gold) {
    const r = Math.random();
    if (!gold) {
        if (r < 0.65) return [50, 100, 150, 200][(Math.random() * 4) | 0];
        if (r < 0.95) return [300, 500][(Math.random() * 2) | 0];
        return Math.random() < 0.7 ? 1000 : 2000;
    } else {
        if (r < 0.60) return [250, 500, 750][(Math.random() * 3) | 0];
        if (r < 0.95) return 1000;
        return Math.random() < 0.7 ? 2500 : 5000;
    }
}

/**
 * Builds a visual overlay that sits on top of a locked pig cell.
 * Contains: dark plate, golden border, pig icon, and amount text.
 * Also performs a tiny pop-in animation on creation.
 */
function makeOverlay(x, y, cell, symKey, amount) {
    const root = new Container();

    // base plate (opaque black) sized to the cell
    const plate = new Graphics()
        .roundRect(0, 0, cell, cell, 12)
        .fill({ color: 0x000000, alpha: 1 });
    plate.pivot.set(cell / 2, cell / 2);

    // golden border inset slightly to avoid clipping
    const border = new Graphics()
        .roundRect(0, 0, cell - 4, cell - 4, 10)
        .stroke({ width: 3, color: 0xffbf00, alpha: 0.95 });
    border.pivot.set((cell - 4) / 2, (cell - 4) / 2);

    // pig icon (normal or gold) centered
    const icon = Sprite.from(symKey);
    icon.anchor.set(0.5);
    icon.width = icon.height = cell - 16;

    // amount text under the icon
    const txt = new Text({ text: fmt(amount), style: { fontSize: 20, fontWeight: '900', fill: 0xffffff } });
    txt.anchor?.set?.(0.5);
    txt.position.set(0, cell * 0.34);

    root.addChild(plate, icon, border, txt);

    // stash references (convenient for external tweaks/debug)
    root.plate = plate;
    root.border = border;
    root.icon = icon;
    root.txt = txt;

    // position and layer above reels
    root.position.set(x, y);
    root.alpha = 0;
    root.zIndex = 950;

    // tiny pop-in animation (fade + ease scale)
    const t0 = performance.now(), dur = 140;
    const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        root.alpha = k;
        const s = 0.92 + 0.08 * (1 - Math.pow(1 - k, 3));
        root.scale.set(s);
        if (k < 1) requestAnimationFrame(tick);
        else root.scale.set(1);
    };
    requestAnimationFrame(tick);

    return root;
}

/** Activation rule: at least one pig symbol in each column of the grid. */
function hasPigInEveryColumn(grid) {
    const colsWithPig = new Set();
    for (let i = 0; i < grid.length; i++) {
        if (isPigKey(grid[i])) colsWithPig.add(i % GRID_COLS);
    }
    return colsWithPig.size === GRID_COLS;
}

/** Lightweight event emitter for UI components (e.g., SpinButton) to react to state. */
function emitSpinState(target, state) {
    target.dispatchEvent(new CustomEvent('spinstate', { detail: state }));
}

export class PigFeatureController extends Container {
    constructor(reels) {
        super();
        this.reels = reels;

        // index -> overlay (locked pig visuals)
        this.overlays = new Map();

        // small counter UI showing remaining respins
        this.counterPlate = new Graphics();
        this.counterTxt = new Text({ text: 'Respins: 3', style: { fontSize: 20, fontWeight: '900', fill: 0xfff275 } });

        // UI state + events
        this._spinState = 'Idle';             // 'Idle' | 'Spinning' | 'Stopping'
        this.uiEvents = new EventTarget();    // for external subscribers
        this.stopRequested = false;           // set by Spin button to fast-stop

        // render order & z-indexing for overlays/counter
        this.sortableChildren = true;
        this.zIndex = 900;
    }

    /** Subscribe UI (e.g., SpinButton) to state changes. Returns unsubscribe fn. */
    onStateChange(cb) {
        const h = (e) => cb(e.detail);
        this.uiEvents.addEventListener('spinstate', h);
        queueMicrotask(() => cb(this._spinState)); // immediately push current state
        return () => this.uiEvents.removeEventListener('spinstate', h);
    }

    /** Called by the Spin button to request an early stop during a spin cycle. */
    requestStop() {
        this.stopRequested = true;
        if (this._spinState === 'Spinning') this.setSpinState('Stopping');
    }

    /** Internal: mutate + broadcast spin state if it actually changed. */
    setSpinState(s) {
        if (this._spinState === s) return;
        this._spinState = s;
        emitSpinState(this.uiEvents, s);
    }

    /**
     * Main feature loop:
     * 1) Activate only if grid has pigs in every column.
     * 2) Lock visible pigs with overlays and random amounts.
     * 3) Start respin loop with slow reels; each new pig resets respins.
     * 4) On finish, sum locked amounts and fade out overlays.
     */
    async run(startGrid, _stake) {
        // activation gate
        if (!hasPigInEveryColumn(startGrid)) {
            return { total: 0, highlight: [] };
        }

        // build respin counter UI centered above reels
        const cx = (GRID_COLS * CELL) / 2;
        const cy = 12;
        this.counterPlate
            .roundRect(0, 0, 160, 28, 8)
            .fill({ color: 0x000000, alpha: 1 })
            .stroke({ width: 2, color: 0xffbf00, alpha: 0.9 });
        this.counterPlate.pivot.set(80, 14);
        this.counterTxt.anchor?.set?.(0.5);
        const counter = new Container();
        counter.addChild(this.counterPlate, this.counterTxt);
        counter.position.set(cx, cy);
        counter.zIndex = 980;
        this.addChild(counter);

        // initial lock of all starting pigs (store amount + normalized symbol key)
        const locked = new Map();
        for (let i = 0; i < startGrid.length; i++) {
            const key = startGrid[i];
            if (isPigKey(key)) {
                const amount = rollPigAmount(isGoldPigKey(key));
                locked.set(i, { amount, sym: normKey(key) });
            }
        }

        // render overlays for initially locked pigs
        for (const [i, v] of locked) {
            const { r, c } = rc(i);
            const x = c * CELL + CELL / 2;
            const y = r * CELL + CELL / 2;
            const ov = makeOverlay(x, y, CELL, v.sym, v.amount);
            this.addChild(ov);
            this.overlays.set(i, ov);
        }

        // enable feature mode + slow down reels for duration of respins
        setFeatureMode(true);
        setSpinSpeedScale(SLOW_SPIN_SCALE);

        let respins = RESPIN_START;

        try {
            while (respins > 0) {
                // update counter text
                this.counterTxt.text = `Respins: ${respins}`;
                this.stopRequested = false;

                // ── SPINNING ────────────────────────────────────────────────
                this.setSpinState('Spinning');
                this.reels.start();

                // enforce minimal spin time OR allow user to request early stop
                const t0 = performance.now();
                while (performance.now() - t0 < MIN_SPIN_MS && !this.stopRequested) {
                    await sleep(16);
                }

                // ── STOPPING ────────────────────────────────────────────────
                this.setSpinState('Stopping');
                this.reels.requestStaggerStop(false);
                await this.reels.onceAllStopped();
                this.setSpinState('Idle');

                // after stop: inspect visible grid for new pigs and lock them
                const vis = this.reels.getVisibleGrid();
                let newPig = false;

                for (let i = 0; i < vis.length; i++) {
                    if (locked.has(i)) continue; // already locked from previous rounds
                    const key = vis[i];
                    if (isPigKey(key)) {
                        const amount = rollPigAmount(isGoldPigKey(key));
                        const sym = normKey(key);
                        locked.set(i, { amount, sym });
                        newPig = true;

                        // create overlay at the correct cell position
                        const { r, c } = rc(i);
                        const x = c * CELL + CELL / 2;
                        const y = r * CELL + CELL / 2;
                        const ov = makeOverlay(x, y, CELL, sym, amount);
                        this.addChild(ov);
                        this.overlays.set(i, ov);
                    }
                }

                // respin bookkeeping: consume one, reset if we found any new pig(s)
                respins -= 1;
                if (newPig) respins = RESPIN_START;

                // tiny pause to avoid abrupt loop churn
                await sleep(120);
            }
        } finally {
            // always restore reels + state even if loop breaks
            this.reels.stopImmediate();
            setFeatureMode(false);
            setSpinSpeedScale(1);
            this.setSpinState('Idle');
        }

        // ── payout summarization ────────────────────────────────────────────────
        let total = 0;
        const highlight = [];
        for (const [i, v] of locked) {
            total += v.amount;
            highlight.push(i); // cells to highlight on result
        }

        // clean visuals
        await this.fadeOut();
        this.removeChildren();
        this.overlays.clear();

        return { total, highlight };
    }

    /** Quick fade-out for all overlays/children, used before clearing. */
    async fadeOut() {
        const t0 = performance.now(), dur = 220;
        return new Promise((resolve) => {
            const step = () => {
                const k = Math.min(1, (performance.now() - t0) / dur);
                this.alpha = 1 - k;
                if (k < 1) requestAnimationFrame(step);
                else resolve();
            };
            requestAnimationFrame(step);
        });
    }

    /** Ensure overlays/children are removed if the controller gets destroyed. */
    destroy(options) {
        super.destroy(options);
        this.removeChildren();
        this.overlays.clear();
    }
}
