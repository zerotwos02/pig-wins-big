import { sound } from '@pixi/sound';

export type SoundKey =
  | 'ui_click' | 'info_loop' | 'spin_start' | 'reel_tick' | 'reel_stop'
  | 'win_small' | 'win_big' | 'lock_on' | 'bg_music';

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
   // optional: quick check
  has(alias: SoundKey) {
  const lib: any = sound as any;
  return !!(lib.find?.(alias) || lib._sounds?.[alias]);
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
  set volume(v: number) { this._volume = Math.max(0, Math.min(1, v)); (sound as any).volumeAll = this._volume; }

  // Add & preload using explicit URLs; resolve via 'loaded' callback
  private add(alias: string, urls: string[] | string, opt?: { loop?: boolean; volume?: number }) {
    return new Promise<void>((resolve, reject) => {
      try {
        (sound as any).add(alias, {
          url: urls,        // ✅ string or string[]
          preload: true,
          ...(opt ?? {}),
          loaded: (err: Error | null) => err ? reject(err) : resolve(),
        });
      } catch (e) {
        reject(e as Error);
      }
    });
  }

  // IMPORTANT: use the formats you actually have. If you only have .mp3, pass just the mp3 string.
 // in load()
async load() {
  await Promise.all([
    this.add('ui_click',   '/assets/audio/sfx/ui_click.mp3'),
    // this.add('ui_hover',   '/assets/audio/sfx/ui_hover.mp3'),
    this.add('spin_start', '/assets/audio/sfx/spin_start.mp3'),
    this.add('info_loop', 'assets/audio/sfx/info_loop.mp3'),
    // this.add('reel_tick',  '/assets/audio/sfx/reel_tick.mp3'),
    this.add('reel_stop',  '/assets/audio/sfx/reel_stop.mp3'),
    this.add('win_small',  '/assets/audio/sfx/win_small.mp3'),
    this.add('win_big',    '/assets/audio/sfx/win_big.mp3'),
    // this.add('lock_on',    '/assets/audio/sfx/lock_on.mp3'),
    this.add('bg_music',   '/assets/audio/music/bg_loop.mp3', { loop: true, volume: 0.25 }),
  ]);
  this._readyResolve?.(); // <-- mark ready
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

/*
Place your files under:
public/assets/audio/sfx/*.mp3(.ogg)
public/assets/audio/music/*.mp3(.ogg)
*/
