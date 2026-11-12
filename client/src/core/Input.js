// Teclado + mouse (pointer lock com fallback de arrastar).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.dragging = false;
    this.enabled = true; // false quando um modal de texto está aberto

    addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 2) this.dragging = true;
    });
    addEventListener('mouseup', () => (this.dragging = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.locked || this.dragging) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        this.wheel += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false }
    );
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  requestLock() {
    if (!this.locked && this.canvas.requestPointerLock) {
      try {
        const p = this.canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch {
        /* navegadores sem suporte: usa arrastar */
      }
    }
  }

  /** Marca uma tecla como já tratada neste frame. */
  consume(code) {
    this.pressed.delete(code);
  }

  isDown(code) {
    return this.enabled && this.down.has(code);
  }
  wasPressed(code) {
    return this.enabled && this.pressed.has(code);
  }

  /** Chamado no fim de cada frame. */
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
