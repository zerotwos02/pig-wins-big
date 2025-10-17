import { BlurFilter } from '@pixi/filter-blur';
import { tween } from '@/anim/tween';
import { easeInOutCubic, easeOutBack, easeOutExpo } from '@/anim/easings';
export class ReelsMotion {
    constructor(args) {
        this.blur = new BlurFilter();
        this.bounceTweens = [];
        this.preKickTweens = [];
        this.speed = 1;
        this.cfg = {
            // smoother pre-kick defaults
            preKickPx: 12,
            preKickMs: 200,
            preKickStaggerMs: 40,
            preKickOvershootRatio: 0.22,
            // your stronger motion defaults
            rampFrom: 0.50,
            rampTo: 1.10,
            rampMs: 420,
            decelTo: 0.32,
            decelMs: 420,
            blurMaxY: 10.0,
            bouncePx: 14,
            bounceMs: 340,
        };
        this.strip = args.stripRoot;
        this.colCount = args.colCount;
        this.setSpeed = args.setSpeed;
        this.setNudge = args.setNudge;
        this.setStartNudge = args.setStartNudge;
        if (args.options)
            Object.assign(this.cfg, args.options);
        this.blurMaxY = this.cfg.blurMaxY;
        this.blur.quality = 3;
        this.blur.blurX = 0;
        this.blur.blurY = 0;
        this.strip.filters = [this.blur];
        this.bounceTweens = Array(this.colCount).fill(null);
        this.preKickTweens = Array(this.colCount).fill(null);
    }
    /** Called at start() */
    onStartSpin() {
        this.killAll();
        // ensure blur exists
        this.strip.filters = [this.blur];
        // reset nudges
        for (let c = 0; c < this.colCount; c++) {
            this.setNudge(c, 0);
            this.setStartNudge(c, 0);
        }
        // keep speed 0 during pre-kick; blur stays off
        this.speed = 0;
        this.applySpeed();
        // run smooth pre-kick, then ramp
        this.runPreKick(() => {
            // ramp up speed after pre-kick completes
            this.rampTween = tween({
                from: this.cfg.rampFrom,
                to: this.cfg.rampTo,
                duration: this.cfg.rampMs,
                ease: easeInOutCubic,
                onUpdate: (v) => { this.speed = v; this.applySpeed(); },
            });
        });
    }
    /** Called when requestStaggerStop(...) happens */
    onRequestStop(immediate) {
        if (immediate) {
            this.killMoveTweens();
            this.speed = this.cfg.decelTo;
            this.applySpeed();
            return;
        }
        this.killMoveTweens();
        this.decelTween = tween({
            from: this.speed,
            to: this.cfg.decelTo,
            duration: this.cfg.decelMs,
            ease: easeOutExpo,
            onUpdate: (v) => { this.speed = v; this.applySpeed(); },
        });
    }
    /** Called for each column exactly when it stops */
    onColumnStop(col) {
        // small settle “thud”: nudge down then ease back to 0
        this.bounceTweens[col]?.stop();
        this.setNudge(col, this.cfg.bouncePx);
        this.bounceTweens[col] = tween({
            from: this.cfg.bouncePx,
            to: 0,
            duration: this.cfg.bounceMs,
            ease: easeOutBack(1.6),
            onUpdate: (v) => this.setNudge(col, v),
        });
    }
    /** Called when all columns have stopped */
    onAllStopped() {
        this.killMoveTweens();
        // fade blur out
        const start = this.blur.blurY;
        tween({
            from: start,
            to: 0,
            duration: 240,
            ease: easeInOutCubic,
            onUpdate: (v) => (this.blur.blurY = v),
            onComplete: () => {
                // remove blur filter when done to save perf
                this.strip.filters = null;
            },
        });
    }
    // ── internals ─────────────────────────────────────────────────────────────
    applySpeed() {
        this.setSpeed(this.speed);
        // amplify blur response (slightly stronger than linear)
        this.blur.blurY = this.blurMaxY * Math.pow(this.speed, 1.35);
    }
    /** Smoother 3-phase pre-kick: up → slight down-overshoot → settle */
    runPreKick(onComplete) {
        const upPx = this.cfg.preKickPx;
        const total = this.cfg.preKickMs;
        const gap = this.cfg.preKickStaggerMs;
        const overshoot = upPx * this.cfg.preKickOvershootRatio;
        // time split (adds up to total): up 45%, overshoot 30%, settle 25%
        const upMs = total * 0.45;
        const overMs = total * 0.30;
        const settleMs = total * 0.25;
        let done = 0;
        for (let c = 0; c < this.colCount; c++) {
            const delay = c * gap;
            // phase A: 0 → -upPx (ease in/out for smooth start/stop)
            setTimeout(() => {
                this.preKickTweens[c]?.stop();
                this.preKickTweens[c] = tween({
                    from: 0,
                    to: -upPx,
                    duration: upMs,
                    ease: easeInOutCubic,
                    onUpdate: (v) => this.setStartNudge(c, v),
                    onComplete: () => {
                        // phase B: -upPx → +overshoot (soft back-ease)
                        this.preKickTweens[c] = tween({
                            from: -upPx,
                            to: +overshoot,
                            duration: overMs,
                            ease: easeOutBack(1.1),
                            onUpdate: (v) => this.setStartNudge(c, v),
                            onComplete: () => {
                                // phase C: +overshoot → 0 (ease in/out settle)
                                this.preKickTweens[c] = tween({
                                    from: +overshoot,
                                    to: 0,
                                    duration: settleMs,
                                    ease: easeInOutCubic,
                                    onUpdate: (v) => this.setStartNudge(c, v),
                                    onComplete: () => { if (++done === this.colCount)
                                        onComplete(); },
                                });
                            },
                        });
                    },
                });
            }, delay);
        }
    }
    killMoveTweens() {
        this.rampTween?.stop();
        this.decelTween?.stop();
        this.rampTween = undefined;
        this.decelTween = undefined;
    }
    killAll() {
        this.killMoveTweens();
        for (let i = 0; i < this.bounceTweens.length; i++) {
            this.bounceTweens[i]?.stop();
            this.bounceTweens[i] = null;
            this.setNudge(i, 0);
        }
        for (let i = 0; i < this.preKickTweens.length; i++) {
            this.preKickTweens[i]?.stop();
            this.preKickTweens[i] = null;
            this.setStartNudge(i, 0);
        }
    }
}
