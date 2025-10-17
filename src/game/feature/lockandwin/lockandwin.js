import { Container, Sprite } from 'pixi.js';
import { setSpinSpeedScale, setSpinTiming } from '@/game/reels/display-reels';
import { SFX } from '@/audio/sound-manager';
// ---------- tiny tween helpers ----------
const nowMs = () => performance.now();
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function tween(durMs, onStep) {
    const t0 = nowMs();
    return new Promise((resolve) => {
        const tick = () => {
            const k = Math.min(1, (nowMs() - t0) / durMs);
            onStep(k);
            if (k < 1)
                requestAnimationFrame(tick);
            else
                resolve();
        };
        requestAnimationFrame(tick);
    });
}
const waitMs = (ms) => new Promise(r => setTimeout(r, ms));
// ---------- Sound keys ----------
const K = (s) => s;
const BGM_MAIN = K('bg_music'); // loop:true in SFX.load()
const BGM_LW = K('bg_lockandwin'); // loop:true in SFX.load()
const UI_LOOP = K('info_loop'); // ambient loop under modals
const STINGER = K('onShown'); // modal stinger
export class LockAndWinController extends Container {
    constructor(reels, cfg, ev) {
        super();
        this.locked = new Map();
        this.spinsLeft = 0;
        this.round = 0;
        this.total = 0;
        this.reels = reels;
        this.cfg = cfg;
        this.ev = ev;
        this.sortableChildren = true;
    }
    /** Enter the feature with a starting grid (already showing the trigger). */
    async run(startSpins) {
        // Start feature audio NOW (intro START already clicked)
        await this.startFeatureAudio();
        // feature reel behavior
        const prevSpeed = 1.0;
        setSpinSpeedScale(2.3);
        setSpinTiming({ decelWaitMs: 80, staggerMs: 70 });
        try {
            const grid = this.reels.getVisibleGrid();
            this.spinsLeft = startSpins ?? this.cfg.startSpins;
            // Lock all currently lockable cells at entry
            const seedIndices = [];
            grid.forEach((k, i) => {
                if (this.cfg.isLockable(k) && !this.locked.has(i)) {
                    const amt = this.cfg.valueOf(k);
                    this.locked.set(i, { index: i, key: k, amount: amt });
                    this.total += amt;
                    seedIndices.push(i);
                }
            });
            // Spin-in the starting symbols on their own cells
            if (seedIndices.length) {
                try {
                    for (const i of seedIndices) {
                        const k = this.locked.get(i).key;
                        this.reels.setCellKey(i, k);
                        this.reels.setCellAlpha(i, 0.0);
                    }
                    await this.reels.respinUnlocked(seedIndices);
                    for (const i of seedIndices)
                        this.reels.setCellAlpha(i, 1.0);
                }
                catch {
                    await tween(300, (k) => { for (const i of seedIndices)
                        this.reels.setCellAlpha(i, k); });
                }
            }
            // --- Main loop --------------------------------------------------------
            this.round = 0;
            while (true) {
                this.round++;
                this.ev?.onRound?.(this.round, this.spinsLeft, this.total);
                const all = [...this.reels.getVisibleGrid().keys()];
                const unlocked = all.filter(i => !this.locked.has(i));
                if (unlocked.length === 0)
                    break;
                await this.reels.respinUnlocked(unlocked);
                const after = this.reels.getVisibleGrid();
                let gotNew = false;
                for (const i of unlocked) {
                    const key = after[i];
                    if (this.cfg.isLockable(key)) {
                        const amount = this.cfg.valueOf(key);
                        this.locked.set(i, { index: i, key, amount });
                        this.total += amount;
                        gotNew = true;
                        this.ev?.onLock?.(i, amount);
                    }
                }
                this.spinsLeft = gotNew ? this.cfg.startSpins : (this.spinsLeft - 1);
                this.ev?.onRound?.(this.round, this.spinsLeft, this.total);
                if (this.spinsLeft <= 0)
                    break;
            }
            // Finish sequence – pigs fly to the Total & count per pig
            await this.finishWithFlyAndCount();
            const out = { total: this.total, locked: Array.from(this.locked.values()) };
            this.ev?.onFinish?.(out);
            return out;
        }
        finally {
            // Always restore speed
            setSpinSpeedScale(prevSpeed);
            setSpinTiming({ decelWaitMs: 160, staggerMs: 110 });
            // Fade out feature BGM and fade in main BGM RIGHT HERE (self-contained).
            await this.swapBackToMainBGM();
        }
    }
    // --------------------------------------------------------------------------
    // Finish sequence helpers
    // --------------------------------------------------------------------------
    async finishWithFlyAndCount() {
        const locks = Array.from(this.locked.values());
        const pigs = locks.filter(L => L.key === 'pig' || L.key === 'pig_gold');
        const others = locks.filter(L => !pigs.includes(L));
        const ordered = [...pigs, ...others];
        this.ev?.onTotalReset?.();
        let runningTotal = 0;
        for (const L of ordered) {
            const from = this.ev?.getCellCenter?.(L.index) ?? this.defaultCellCenter(L.index);
            const to = this.ev?.getTotalFieldPos?.() ?? this.defaultTotalPos();
            const spr = Sprite.from(L.key);
            spr.anchor.set(0.5);
            spr.position.copyFrom(from);
            spr.zIndex = 9999;
            spr.scale.set(0.9);
            this.addChild(spr);
            this.ev?.onPigFlyStart?.(L.index, L.amount);
            const dur = 260;
            const cx = (from.x + to.x) / 2;
            const cy = Math.min(from.y, to.y) - 80;
            await tween(dur, (kLin) => {
                const k = easeOutCubic(kLin);
                const x = (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * cx + k * k * to.x;
                const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * cy + k * k * to.y;
                spr.position.set(x, y);
                spr.scale.set(0.9 - 0.3 * k);
                spr.alpha = 1 - 0.2 * k;
            });
            spr.destroy();
            this.ev?.onPigFlyEnd?.(L.index, L.amount);
            const start = runningTotal;
            const end = runningTotal + L.amount;
            await tween(500, (k) => this.ev?.onTotalChange?.(Math.round((start + (end - start) * k) * 100) / 100));
            runningTotal = end;
        }
        this.ev?.onTotalChange?.(runningTotal);
    }
    defaultCellCenter(index) {
        const cols = this.cfg.gridCols ?? 5;
        const rows = this.cfg.gridRows ?? 4;
        const b = this.reels.view.getBounds();
        const cw = b.width / cols;
        const ch = b.height / rows;
        const c = index % cols;
        const r = Math.floor(index / cols);
        return { x: b.x + c * cw + cw / 2, y: b.y + r * ch + ch / 2 };
    }
    defaultTotalPos() {
        const b = this.reels.view.getBounds();
        return { x: b.x + b.width - 40, y: b.y - 20 };
    }
    // --------------------------------------------------------------------------
    // Audio control (SOUND-level fades; no instance-volume trap)
    // --------------------------------------------------------------------------
    async startFeatureAudio() {
        try {
            await SFX.ready;
            // Kill UI loops/stingers so they don't mask the feature track
            if (SFX.has(UI_LOOP))
                SFX.stop(UI_LOOP);
            if (SFX.has(STINGER))
                SFX.stop(STINGER);
            // Fade out + stop main bg
            if (SFX.has(BGM_MAIN)) {
                SFX.fade(BGM_MAIN, 1, 0, 140);
                await waitMs(150);
                SFX.stop(BGM_MAIN);
            }
            // Clean start for bg_lockandwin
            if (SFX.has(BGM_LW)) {
                SFX.stop(BGM_LW); // clear stale instance
                SFX.fade(BGM_LW, 0, 0, 0); // set SOUND base vol 0
                SFX.play(BGM_LW); // play (instance inherits 0)
                SFX.fade(BGM_LW, 0, 0.28, 200); // fade SOUND up
            }
            else {
                console.warn('[LockAndWin] Missing bg_lockandwin alias (check SFX.load)');
            }
        }
        catch (e) {
            console.warn('[LockAndWin] startFeatureAudio error:', e);
        }
    }
    /** Fade out feature BGM and fade in main BGM immediately. */
    async swapBackToMainBGM() {
        try {
            await SFX.ready;
            // Fade out + stop feature bg
            if (SFX.has(BGM_LW)) {
                SFX.fade(BGM_LW, 1, 0, 160);
                await waitMs(170);
                SFX.stop(BGM_LW);
            }
            // Safety: stop UI loop/stinger if a modal left them running
            if (SFX.has(UI_LOOP))
                SFX.stop(UI_LOOP);
            if (SFX.has(STINGER))
                SFX.stop(STINGER);
            // Fade in main bg (SOUND-level)
            if (SFX.has(BGM_MAIN)) {
                SFX.fade(BGM_MAIN, 0, 0, 0); // set SOUND base vol 0
                SFX.play(BGM_MAIN); // play (instance inherits 0)
                SFX.fade(BGM_MAIN, 0, 0.25, 160);
            }
        }
        catch (e) {
            console.warn('[LockAndWin] swapBackToMainBGM error:', e);
        }
    }
}
