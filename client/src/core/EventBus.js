// Barramento de eventos simples. Nomes no formato 'dominio:acao'.
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.handlers = new Map();
  }
  on(name, fn) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name).add(fn);
    return () => this.off(name, fn);
  }
  once(name, fn) {
    const off = this.on(name, (p) => {
      off();
      fn(p);
    });
    return off;
  }
  off(name, fn) {
    this.handlers.get(name)?.delete(fn);
  }
  emit(name, payload) {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.warn(`[events] erro em handler de "${name}"`, err);
      }
    }
  }
}
