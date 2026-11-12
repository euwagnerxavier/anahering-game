import * as THREE from 'three';
import { QueenModel } from './QueenModel.js';
import { canvasTexture, lerp } from '../core/utils.js';

const STATES = ['idle', 'walk', 'run', 'sit', 'jump'];
const DELAY = 0.12; // s de atraso de interpolação

/** "Ecos Reais": outros jogadores como silhuetas douradas translúcidas (ADR-005). */
export class RemotePlayers {
  constructor(game) {
    this.game = game;
    this.players = new Map();
    this.names = new Map();
    const ev = game.events;
    ev.on('net:welcome', (m) => m.players.forEach((p) => this.names.set(p.id, p.name)));
    ev.on('net:join', (m) => {
      this.names.set(m.id, m.name);
      game.systems.hud.toast(`✨ Um Eco Real surgiu: ${m.name}`);
    });
    ev.on('net:leave', (m) => this.remove(m.id));
    ev.on('net:reset', () => [...this.players.keys()].forEach((id) => this.remove(id)));
    ev.on('net:snap', (list) => this.onSnap(list));
  }

  _create(id) {
    const model = new QueenModel({ variant: 'ghost' });
    model.root.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
    const name = this.names.get(id) || 'Eco Real';
    const tex = canvasTexture(512, 96, (c, w, h) => {
      c.font = 'bold 40px Georgia, serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 8;
      c.strokeStyle = 'rgba(40,10,60,0.85)';
      c.strokeText(`✦ ${name} ✦`, w / 2, h / 2);
      c.fillStyle = '#ffe08a';
      c.fillText(`✦ ${name} ✦`, w / 2, h / 2);
    });
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    label.scale.set(3.2, 0.6, 1);
    label.position.y = 2.75;
    model.root.add(label);
    this.game.scene.add(model.root);
    const p = { id, model, buf: [], state: 'idle' };
    this.players.set(id, p);
    return p;
  }

  remove(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.game.scene.remove(p.model.root);
    p.model.root.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        o.geometry?.dispose();
        if (o.material?.map) o.material.map.dispose();
      }
    });
    this.players.delete(id);
  }

  onSnap(list) {
    const now = performance.now() / 1000;
    const seen = new Set();
    for (const [id, x, y, z, r, a] of list) {
      seen.add(id);
      const p = this.players.get(id) || this._create(id);
      p.buf.push({ t: now, x, y, z, r, a });
      if (p.buf.length > 10) p.buf.shift();
    }
    for (const id of this.players.keys()) if (!seen.has(id)) this.remove(id);
  }

  update(dt, time) {
    const rt = performance.now() / 1000 - DELAY;
    for (const p of this.players.values()) {
      const b = p.buf;
      if (!b.length) continue;
      let s0 = b[0], s1 = b[b.length - 1];
      for (let i = 0; i < b.length - 1; i++) {
        if (b[i].t <= rt && b[i + 1].t >= rt) {
          s0 = b[i];
          s1 = b[i + 1];
          break;
        }
      }
      const k = s1.t === s0.t ? 1 : Math.min(1, Math.max(0, (rt - s0.t) / (s1.t - s0.t)));
      const root = p.model.root;
      const px = root.position.x, pz = root.position.z;
      root.position.set(lerp(s0.x, s1.x, k), lerp(s0.y, s1.y, k), lerp(s0.z, s1.z, k));
      let dr = s1.r - s0.r;
      if (dr > Math.PI) dr -= Math.PI * 2;
      if (dr < -Math.PI) dr += Math.PI * 2;
      root.rotation.y = s0.r + dr * k;
      const speed = Math.hypot(root.position.x - px, root.position.z - pz) / Math.max(dt, 1e-3);
      p.model.animate(dt, { state: STATES[s1.a] ?? 'idle', speed: Math.min(1, speed / 9), time });
    }
  }
}
