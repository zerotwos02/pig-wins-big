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
  | 'hammer_draw'   // small pull-back cue
  | 'hammer_whoosh' // fast lunge
  | 'hammer_hit'    // impact
  | 'spark_burst'   // pink particle pop / explosion
  | 'win_tick';     // token pop or count-up tick

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
      // find() exists in pixi-sound v5; _sounds used in older versions
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

  // IMPORTANT: use the formats you actually have
  async load() {
    await Promise.all([
      this.add('ui_click',    '/assets/audio/sfx/ui_click.mp3'),
      this.add('spin_start',  '/assets/audio/sfx/spin_start.mp3'),
      this.add('info_loop',   '/assets/audio/sfx/info_loop.mp3'),
      // this.add('reel_tick', '/assets/audio/sfx/reel_tick.mp3'),
      this.add('reel_stop',   '/assets/audio/sfx/reel_stop.mp3'),
      this.add('win_small',   '/assets/audio/sfx/win_small.mp3'),
      this.add('win_big',     '/assets/audio/sfx/win_big.mp3'),
      // this.add('lock_on',   '/assets/audio/sfx/lock_on.mp3'),
      this.add('bg_music',    '/assets/audio/music/bg_loop.mp3', { loop: true, volume: 0.25 }),

      // --- Hammer feature SFX (add the files you actually have) ---
      //this.add('hammer_draw',   '/assets/audio/sfx/hammer_draw.mp3'),
      this.add('hammer_whoosh', '/assets/audio/sfx/hammer_whoosh.mp3'),
      this.add('hammer_hit',    '/assets/audio/sfx/hammer_hit.mp3'),
      this.add('spark_burst',   '/assets/audio/sfx/spark_burst.mp3'),
      //this.add('win_tick',      '/assets/audio/sfx/win_tick.mp3'),
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

  fade(key: SoundKey, from: number, to: number, durationMs: number) {
    const inst: any = (sound as any).find?.(key) ?? (sound as any)._sounds?.[key] ?? null;
    if (!inst) return;
    inst.volume = from;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / durationMs);
      inst.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

export const SFX = new SoundManager();

