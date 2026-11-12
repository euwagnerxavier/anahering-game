import * as THREE from 'three';
import { EventBus } from './EventBus.js';
import { Input } from './Input.js';
import { Renderer } from './Renderer.js';
import { Physics } from '../physics/Physics.js';

/** Dono do loop principal e do registro de sistemas. */
export class Game {
  constructor(container) {
    this.events = new EventBus();
    this.gfx = new Renderer(container);
    this.scene = this.gfx.scene;
    this.camera = this.gfx.camera;
    this.input = new Input(this.gfx.canvas);
    this.physics = new Physics();
    this.timer = new THREE.Timer();
    this.time = 0;
    this.systems = {};
    this.order = [];
    this.failed = new Set();
    this.paused = false;
    /** 'title' | 'play' | 'cinematic' | 'dialogue' | 'modal' */
    this.mode = 'title';
    this.debug = new URLSearchParams(location.search).has('debug');
  }

  addSystem(name, sys) {
    this.systems[name] = sys;
    this.order.push(name);
    return sys;
  }

  setMode(mode) {
    const prev = this.mode;
    this.mode = mode;
    this.events.emit('game:mode', { mode, prev });
  }

  /** O jogador pode controlar a rainha? */
  get controllable() {
    return this.mode === 'play' && !this.paused;
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), 0.05);
      if (!this.paused) {
        this.time += dt;
        for (const name of this.order) {
          const s = this.systems[name];
          if (!s.update) continue;
          try {
            s.update(dt, this.time);
          } catch (err) {
            if (!this.failed.has(name)) {
              this.failed.add(name);
              console.warn(`[game] sistema "${name}" falhou`, err);
            }
          }
        }
      }
      const q = this.gfx.trackPerformance(dt);
      if (q) this.events.emit('gfx:quality', q);
      this.gfx.render();
      this.input.endFrame();
    };
    loop();
  }
}
