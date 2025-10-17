class Emitter {
    constructor() {
        this.map = new Map();
    }
    on(name, fn) {
        let set = this.map.get(name);
        if (!set) {
            set = new Set();
            this.map.set(name, set);
        }
        set.add(fn);
        return () => set.delete(fn);
    }
    emit(name, payload) {
        const set = this.map.get(name);
        if (!set)
            return;
        for (const fn of set)
            fn(payload);
    }
}
export const events = new Emitter();
