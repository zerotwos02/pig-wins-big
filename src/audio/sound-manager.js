// src/audio/sound-manager.ts
import { sound } from '@pixi/sound';
class SoundManager {
    constructor() {
        this._enabled = true;
        this._volume = 1;
        this.unlocked = false;
        this.prefKey = 'audio_enabled';
        this.ready = new Promise((res) => (this._readyResolve = res));
        // tiny pub/sub + EventTarget
        this._listeners = new Set();
        this.on = new EventTarget();
        // Autoplay workaround: resume after first gesture
        this.unlockOnFirstInteraction = () => {
            if (this.unlocked)
                return;
            const resume = () => {
                try {
                    sound.resumeAll();
                    this.unlocked = true;
                }
                finally {
                    window.removeEventListener('pointerdown', resume);
                    window.removeEventListener('keydown', resume);
                }
            };
            window.addEventListener('pointerdown', resume, { once: true });
            window.addEventListener('keydown', resume, { once: true });
        };
    }
    onEnabledChange(cb) { this._listeners.add(cb); }
    offEnabledChange(cb) { this._listeners.delete(cb); }
    _emitEnabledChange() {
        this.on.dispatchEvent(new Event('enabled-change'));
        this._listeners.forEach((f) => { try {
            f();
        }
        catch { } });
    }
    init(defaultVolume = 0.8) {
        this.unlockOnFirstInteraction();
        const saved = localStorage.getItem(this.prefKey);
        if (saved !== null)
            this._enabled = saved === 'true';
        this.enabled = this._enabled;
        this.volume = defaultVolume;
    }
    // quick check: is alias present in the pixi-sound registry?
    has(alias) {
        const lib = sound;
        try {
            return Boolean(lib.find?.(alias) || lib._sounds?.[alias]);
        }
        catch {
            return false;
        }
    }
    get enabled() { return this._enabled; }
    set enabled(v) {
        this._enabled = v;
        v ? sound.unmuteAll() : sound.muteAll();
        try {
            localStorage.setItem(this.prefKey, String(v));
        }
        catch { }
        this._emitEnabledChange();
    }
    get volume() { return this._volume; }
    set volume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        sound.volumeAll = this._volume;
    }
    // Add & preload using explicit URLs; resolve via 'loaded' callback
    add(alias, urls, opt) {
        return new Promise((resolve, reject) => {
            try {
                sound.add(alias, {
                    url: urls,
                    preload: true,
                    ...(opt ?? {}),
                    loaded: (err) => err ? reject(err) : resolve(),
                });
            }
            catch (e) {
                reject(e);
            }
        });
    }
    // IMPORTANT: ensure BGMs are loaded with loop:true here
    async load() {
        await Promise.all([
            this.add('ui_click', '/assets/audio/sfx/ui_click.mp3'),
            this.add('spin_start', '/assets/audio/sfx/spin_start.mp3'),
            this.add('info_loop', '/assets/audio/sfx/info_loop.mp3'),
            this.add('reel_stop', '/assets/audio/sfx/reel_stop.mp3'),
            this.add('win_small', '/assets/audio/sfx/win_small.mp3'),
            this.add('win_big', '/assets/audio/sfx/win_big.mp3'),
            this.add('onShown', '/assets/audio/sfx/onShown.mp3'),
            // Main BGM (loop)
            this.add('bg_music', '/assets/audio/music/bg_loop.mp3', { loop: true, volume: 0.25 }),
            // Hammer SFX
            this.add('hammer_whoosh', '/assets/audio/sfx/hammer_whoosh.mp3'),
            this.add('hammer_hit', '/assets/audio/sfx/hammer_hit.mp3'),
            this.add('spark_burst', '/assets/audio/sfx/spark_burst.mp3'),
            // 🔥 Feature BGM MUST be looped so it keeps playing
            this.add('bg_lockandwin', '/assets/audio/music/bg_lockandwin.mp3', { loop: true, volume: 0.28 }),
        ]);
        this._readyResolve?.(); // mark ready once all are loaded
    }
    play(key, opts) {
        if (!this._enabled)
            return;
        if (!this.has(key)) {
            console.warn('[SFX] alias not loaded:', key);
            return;
        }
        return sound.play(key, { volume: opts?.volume ?? 1, speed: opts?.speed ?? 1 });
    }
    stop(key) { sound.stop(key); }
    toggle() { this.enabled = !this.enabled; }
    // Fade the "sound" (alias-level) volume over time
    fade(key, from, to, durationMs) {
        const snd = sound.find?.(key) ?? sound._sounds?.[key] ?? null;
        if (!snd)
            return;
        snd.volume = from;
        const start = performance.now();
        const step = (t) => {
            const k = Math.min(1, (t - start) / durationMs);
            snd.volume = from + (to - from) * k;
            if (k < 1)
                requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }
    // --- Convenience: BGM helpers (safe swap with fade) -----------------------
    async bgmSwap(fromKey, toKey, fadeMs = 180, toVol = 0.28) {
        try {
            await this.ready;
            if (this.has(fromKey)) {
                this.fade(fromKey, 1, 0, fadeMs);
                await this._wait(fadeMs + 10);
                this.stop(fromKey);
            }
            if (this.has(toKey)) {
                this.play(toKey, { volume: 0 }); // start silent
                this.fade(toKey, 0, toVol, fadeMs);
            }
            else {
                console.warn('[SFX] bgmSwap: target not loaded:', toKey);
            }
        }
        catch { }
    }
    async bgmStart(key, vol = 0.25) {
        try {
            await this.ready;
            if (!this.has(key)) {
                console.warn('[SFX] bgmStart: missing', key);
                return;
            }
            this.play(key, { volume: 0 });
            this.fade(key, 0, vol, 160);
        }
        catch { }
    }
    async bgmStop(key, fadeMs = 160) {
        try {
            await this.ready;
            if (!this.has(key))
                return;
            this.fade(key, 1, 0, fadeMs);
            await this._wait(fadeMs + 10);
            this.stop(key);
        }
        catch { }
    }
    _wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}
export const SFX = new SoundManager();
