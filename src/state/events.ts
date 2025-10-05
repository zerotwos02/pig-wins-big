// Minimal typed event bus
export type Events = {
  SpinRequested: void;
  SpinStarted:   { stake: number };
  SpinResult:    { win: number; grid: string[] }; // 49 items row-major (7x7)
  StakeChanged:  { stake: number };
  BalanceChanged:{ balance: number };
  GameOver: {};
};

type Handler<T> = (p: T) => void;

class Emitter {
  private map = new Map<keyof Events, Set<Function>>();

  on<K extends keyof Events>(name: K, fn: Handler<Events[K]>): () => void {
    let set = this.map.get(name);
    if (!set) { set = new Set(); this.map.set(name, set); }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof Events>(name: K, payload: Events[K]) {
    const set = this.map.get(name);
    if (!set) return;
    for (const fn of set) (fn as Handler<Events[K]>)(payload);
  }
}

export const events = new Emitter();
