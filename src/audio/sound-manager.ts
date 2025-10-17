// src/audio/sound-manager.ts
import { sound } from '@pixi/sound';

export type SoundKey =
  | 'ui_click'
  | 'info_loop'
  | 'spin_start'
  | 'reel_tick'
  | 'reel_stop'
  | 'win_small'
  | 'win_big'
  | 'lock_on'
  | 'bg_music'
  // --- Hammer feature SFX ---
  | 'hammer_draw'
  | 'hammer_whoosh'
  | 'hammer_hit'
  | 'onShown'
  | 'spark_burst'
  | 'bg_lockandwin';

class SoundManager {
  private _enabled = true;
  private _volume = 1;
  private unlocked = false;
  private readonly prefKey = 'audio_enabled';
  private _readyResolve?: () => void;
  readonly ready: Promise<void> = new Promise<void>((res) => (this._readyResolve = res));

  // tiny pub/sub + EventTarget
  private _listeners = new Set<() => void>();
  readonly on = new EventTarget();
  onEnabledChange(cb: () => void) { this._listeners.add(cb); }
  offEnabledChange(cb: () => void) { this._listeners.delete(cb); }
  private _emitEnabledChange() {
    this.on.dispatchEvent(new Event('enabled-change'));
    this._listeners.forEach((f) => { try { f(); } catch {} });
  }

  init(defaultVolume = 0.8) {
    this.unlockOnFirstInteraction();
    const saved = localStorage.getItem(this.prefKey);
    if (saved !== null) this._enabled = saved === 'true';
    this.enabled = this._enabled;
    this.volume = defaultVolume;
  }

  // quick check: is alias present in the pixi-sound registry?
  has(alias: SoundKey) {
    const lib: any = sound as any;
    try {
      return Boolean(lib.find?.(alias) || lib._sounds?.[alias]);
    } catch {
      return false;
    }
  }

  // Autoplay workaround: resume after first gesture
  unlockOnFirstInteraction = () => {
    if (this.unlocked) return;
    const resume = () => {
      try { sound.resumeAll(); this.unlocked = true; }
      finally {
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
      }
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  };

  get enabled() { return this._enabled; }
  set enabled(v: boolean) {
    this._enabled = v;
    v ? sound.unmuteAll() : sound.muteAll();
    try { localStorage.setItem(this.prefKey, String(v)); } catch {}
    this._emitEnabledChange();
  }

  get volume() { return this._volume; }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    (sound as any).volumeAll = this._volume;
  }

  // Add & preload using explicit URLs; resolve via 'loaded' callback
  private add(alias: string, urls: string[] | string, opt?: { loop?: boolean; volume?: number }) {
    return new Promise<void>((resolve, reject) => {
      try {
        (sound as any).add(alias, {
          url: urls,
          preload: true,
          ...(opt ?? {}),
          loaded: (err: Error | null) => err ? reject(err) : resolve(),
        });
      } catch (e) {
        reject(e as Error);
      }
    });
  }

  // IMPORTANT: ensure BGMs are loaded with loop:true here
  async load() {
    await Promise.all([
      this.add('ui_click',    '/assets/audio/sfx/ui_click.mp3'),
      this.add('spin_start',  '/assets/audio/sfx/spin_start.mp3'),
      this.add('info_loop',   '/assets/audio/sfx/info_loop.mp3'),
      this.add('reel_stop',   '/assets/audio/sfx/reel_stop.mp3'),
      this.add('win_small',   '/assets/audio/sfx/win_small.mp3'),
      this.add('win_big',     '/assets/audio/sfx/win_big.mp3'),
      this.add('onShown',     '/assets/audio/sfx/onShown.mp3'),
      
      // Main BGM (loop)
      this.add('bg_music',    '/assets/audio/music/bg_loop.mp3', { loop: true, volume: 0.25 }),

      // Hammer SFX
      this.add('hammer_whoosh', '/assets/audio/sfx/hammer_whoosh.mp3'),
      this.add('hammer_hit',    '/assets/audio/sfx/hammer_hit.mp3'),
      this.add('spark_burst',   '/assets/audio/sfx/spark_burst.mp3'),

      // 🔥 Feature BGM MUST be looped so it keeps playing
      this.add('bg_lockandwin', '/assets/audio/music/bg_lockandwin.mp3', { loop: true, volume: 0.28 }),
    ]);

    this._readyResolve?.(); // mark ready once all are loaded
  }

  play(key: SoundKey, opts?: { volume?: number; speed?: number }) {
    if (!this._enabled) return;
    if (!this.has(key)) { console.warn('[SFX] alias not loaded:', key); return; }
    return (sound as any).play(key, { volume: opts?.volume ?? 1, speed: opts?.speed ?? 1 });
  }

  stop(key: SoundKey) { (sound as any).stop(key); }

  toggle() { this.enabled = !this.enabled; }

  // Fade the "sound" (alias-level) volume over time
  fade(key: SoundKey, from: number, to: number, durationMs: number) {
    const snd: any = (sound as any).find?.(key) ?? (sound as any)._sounds?.[key] ?? null;
    if (!snd) return;
    snd.volume = from;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / durationMs);
      snd.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // --- Convenience: BGM helpers (safe swap with fade) -----------------------
  async bgmSwap(fromKey: SoundKey, toKey: SoundKey, fadeMs = 180, toVol = 0.28) {
    try {
      await this.ready;
      if (this.has(fromKey)) {
        this.fade(fromKey, 1, 0, fadeMs);
        await this._wait(fadeMs + 10);
        this.stop(fromKey);
      }
      if (this.has(toKey)) {
        this.play(toKey, { volume: 0 });         // start silent
        this.fade(toKey, 0, toVol, fadeMs);
      } else {
        console.warn('[SFX] bgmSwap: target not loaded:', toKey);
      }
    } catch {}
  }

  async bgmStart(key: SoundKey, vol = 0.25) {
    try {
      await this.ready;
      if (!this.has(key)) { console.warn('[SFX] bgmStart: missing', key); return; }
      this.play(key, { volume: 0 });
      this.fade(key, 0, vol, 160);
    } catch {}
  }

  async bgmStop(key: SoundKey, fadeMs = 160) {
    try {
      await this.ready;
      if (!this.has(key)) return;
      this.fade(key, 1, 0, fadeMs);
      await this._wait(fadeMs + 10);
      this.stop(key);
    } catch {}
  }

  private _wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }
}

export const SFX = new SoundManager();
