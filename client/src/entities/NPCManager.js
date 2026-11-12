import * as THREE from 'three';
import { NPC } from './NPC.js';
import { NAMED_NPCS, COMMON_LOOKS } from '../data/npcs.js';
import { BARKS, CHEERS, ZONE_ARRIVALS } from '../data/barks.js';
import { rng } from '../core/utils.js';
import { HILL_H, LAYOUT } from '../world/layout.js';

const FIRST = ['Joaquim', 'Benedita', 'Gervásio', 'Clotilde', 'Anacleto', 'Filomena', 'Romualdo', 'Genoveva', 'Teobaldo', 'Esmeralda', 'Leopoldo', 'Bartira', 'Custódio', 'Odete', 'Severino', 'Iracema', 'Belmiro', 'Zuleica', 'Aristides', 'Hortênsia'];
const JOBS = ['Padeiro Real', 'Ferreiro Devoto', 'Fiandeira Leal', 'Carteiro da Coroa', 'Pastor de Gansos Reais', 'Polidor de Estátuas', 'Aprendiz de Bajulador', 'Contador de Reverências', 'Florista Oficial', 'Engraxate do Cetro'];

/** Cria e coordena todos os súditos do reino. */
export class NPCManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.rand = rng(31337);
    this.barkCooldown = 0;
    this.frame = 0;
    const heightAt = game.world.heightAt;
    this.heightAt = heightAt;
    const r = this.rand;
    let n = 0;

    const look = () => ({
      tunic: r.pick(COMMON_LOOKS.tunics),
      skin: r.pick(COMMON_LOOKS.skins),
      hat: r.pick(COMMON_LOOKS.hats),
      hatColor: r.pick(COMMON_LOOKS.hatColors),
      trim: r.pick([0x6b4426, 0xf2c14e, 0x3a2a1a]),
      dress: r() < 0.4,
      height: 0.9 + r() * 0.18,
    });
    const commonName = () => `${r.pick(FIRST)}, ${r.pick(JOBS)}`;
    const add = (opts) => {
      const npc = new NPC({ seed: n++, ...opts });
      game.scene.add(npc.root);
      this.list.push(npc);
      return npc;
    };

    // personagens nomeados
    for (const d of NAMED_NPCS) {
      const y = d.pos.y || heightAt(d.pos.x, d.pos.z);
      add({ id: d.id, kind: 'named', look: d.look, position: new THREE.Vector3(d.pos.x, y, d.pos.z), rotY: d.rotY, name: d.name, dialogue: d.dialogue });
    }
    // multidão da praça
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = 14 + r() * 18;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      add({ id: `crowd_${i}`, kind: 'crowd', look: look(), position: new THREE.Vector3(x, heightAt(x, z), z), rotY: r() * 6, name: commonName(), home: { x: 0, z: 0, r0: 13, r1: 33 } });
    }
    // transeuntes nas ruas (múltiplos de 24 m)
    for (let i = 0, tries = 0; i < 20 && tries < 400; tries++) {
      const vertical = r() < 0.5;
      const line = r.int(-5, 5) * 24;
      const start = r.int(-3, 5) * 24 + (r() - 0.5) * 10;
      const len = 30 + r() * 40;
      const a = vertical ? new THREE.Vector3(line, 0, start) : new THREE.Vector3(start, 0, line);
      const b = vertical ? new THREE.Vector3(line, 0, start + len) : new THREE.Vector3(start + len, 0, line);
      if (!this._streetOk(a, b)) continue;
      a.y = heightAt(a.x, a.z);
      b.y = heightAt(b.x, b.z);
      const p = a.clone().lerp(b, r());
      add({ id: `walker_${i}`, kind: 'walker', look: look(), position: p, name: commonName(), path: [a, b] });
      i++;
    }
    // corte real no Salão do Trono
    for (let i = 0; i < 10; i++) {
      const s = i % 2 ? 1 : -1;
      const z = -162 - Math.floor(i / 2) * 6;
      add({
        id: `courtier_${i}`,
        kind: 'courtier',
        look: { tunic: r.pick([0x5b1f7a, 0x9e1b32, 0x2a2a5a, 0x1f5a4a]), trim: 0xf2c14e, skin: r.pick(COMMON_LOOKS.skins), hat: r.pick(['wig', 'tall', 'feather', 'bun']), hatColor: r.pick([0xf5f2ea, 0x1c1a24, 0x5b1f7a]), dress: r() < 0.5 },
        position: new THREE.Vector3(s * 5, HILL_H + 0.1, z),
        rotY: (-s * Math.PI) / 2,
        name: `${r.pick(['Duque', 'Duquesa', 'Marquês', 'Baronesa', 'Visconde', 'Condessa'])} ${r.pick(FIRST)}`,
      });
    }
    // guardas reais
    const guardLook = { tunic: 0x5b1f7a, trim: 0xf2c14e, skin: 0xe0ac86, hat: 'helmet', spear: true, tabard: true, height: 1.08 };
    const guards = [
      [-3.8, HILL_H, -149.2, 0],
      [3.8, HILL_H, -149.2, 0],
      [-4.5, 0, LAYOUT.podium.z - 1, 0],
      [4.5, 0, LAYOUT.podium.z - 1.5, -0.4],
    ];
    guards.forEach(([x, y, z, ry], i) =>
      add({ id: `guard_${i}`, kind: 'guard', look: { ...guardLook, skin: r.pick(COMMON_LOOKS.skins) }, position: new THREE.Vector3(x, y || heightAt(x, z), z), rotY: ry, name: 'Guarda Real' })
    );

    this._wireEvents();
    this._registerInteractions();
  }

  _streetOk(a, b) {
    for (let t = 0; t <= 1; t += 0.1) {
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      if (Math.hypot(x, z) < 14) return false; // fonte
      if (z < -88 || Math.hypot(x, z) > 165) return false;
      if (Math.hypot(x - LAYOUT.lake.x, z - LAYOUT.lake.z) < LAYOUT.lake.r + 4) return false;
      if (Math.abs(x) < 10 && z < -36) return false; // avenida tem estátuas/mastros
    }
    return true;
  }

  byId(id) {
    return this.list.find((n) => n.id === id);
  }

  nearestCommoner(p) {
    let best = null, bd = Infinity;
    for (const n of this.list) {
      if (n.kind === 'named') continue;
      if (this.game.systems.quests?.flags[`compliment_${n.id}`]) continue;
      const d = n.position.distanceToSquared(p);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  _registerInteractions() {
    const I = this.game.systems.interaction;
    for (const npc of this.list) {
      const named = npc.kind === 'named';
      I.register({
        id: `npc:${npc.id}`,
        position: npc.position,
        radius: named ? 2.8 : 2.0,
        priority: named ? 2 : 0,
        label: named ? `Falar com ${npc.name}` : `Conversar com ${npc.name.split(',')[0]}`,
        onInteract: () => this.game.systems.dialogue.open(npc.dialogue, { npc }),
      });
    }
  }

  _wireEvents() {
    const ev = this.game.events;
    const q = () => this.game.systems.queen;
    ev.on('speech:start', ({ podium }) => {
      const r = this.rand;
      for (const n of this.list) {
        if (n.kind !== 'crowd' && n.kind !== 'walker') continue;
        if (n.position.distanceTo(podium) > 90) continue;
        const t = new THREE.Vector3(podium.x + (r() - 0.5) * 22, 0, podium.z + 7 + r() * 9);
        n.setForced('gather', 16, t, podium);
      }
    });
    ev.on('crowd:cheer', ({ center, radius = 40, duration = 4, look = null }) => {
      for (const n of this.list) {
        if (n.kind === 'named') continue;
        if (n.position.distanceTo(center) < radius) n.setForced(n.forced === 'gather' ? 'gather' : 'cheer', duration, n.forced === 'gather' ? n.target : null, look);
      }
      // gritos de euforia
      const near = this.list.filter((n) => n.position.distanceTo(center) < radius && n.kind !== 'named');
      for (let i = 0; i < Math.min(4, near.length); i++) {
        const n = near[Math.floor(this.rand() * near.length)];
        setTimeout(() => this.game.systems.hud?.bubble(n.root, this.rand.pick(CHEERS), 2.2, n.model.height), i * 350);
      }
    });
    ev.on('throne:sat', () => {
      const look = this.game.world.castle.seat.position;
      for (const n of this.list) if (n.kind === 'courtier') n.setForced('clap', 6, null, look);
    });
    ev.on('zone:enter', ({ id }) => {
      const msg = ZONE_ARRIVALS[id];
      if (!msg) return;
      if (id === 'plaza' || id === 'market') ev.emit('crowd:cheer', { center: q().position, radius: 30, duration: 3 });
    });
    ev.on('queen:wave', () => {
      const p = q().position;
      const near = this.list.filter((n) => n.kind !== 'named' && n.position.distanceTo(p) < 16);
      for (const n of near) n.setForced('cheer', 2.5);
      ev.emit('queen:waved', { count: near.length });
    });
  }

  update(dt, time) {
    this.frame++;
    this.barkCooldown -= dt;
    const qs = this.game.systems.queen;
    const queenPos = qs.position;
    const ctx = {
      queenPos,
      queenSitting: qs.sitting,
      heightAt: this.heightAt,
      rand: this.rand,
      onBow: (npc) => {
        if (this.barkCooldown > 0 || this.rand() > 0.55) return;
        this.barkCooldown = 2.2;
        this.game.systems.hud?.bubble(npc.root, this.rand.pick(BARKS), 2.8, npc.model.height);
        this.game.events.emit('npc:bow', { id: npc.id });
      },
    };
    for (let i = 0; i < this.list.length; i++) {
      const n = this.list[i];
      const d2 = n.position.distanceToSquared(queenPos);
      n.root.visible = d2 < 170 * 170 || n.forced != null;
      if (!n.root.visible) continue;
      // LOD: NPCs distantes atualizam com menos frequência
      if (d2 > 70 * 70) {
        n._acc = (n._acc || 0) + dt;
        if ((this.frame + i) % 5 !== 0) continue;
        n.update(n._acc, time, ctx);
        n._acc = 0;
      } else n.update(dt, time, ctx);
    }
  }

  /** Empurra a rainha para fora dos súditos (colisão leve). */
  pushOut(pos, radius) {
    for (const n of this.list) {
      const dx = pos.x - n.position.x, dz = pos.z - n.position.z;
      if (Math.abs(pos.y - n.position.y) > 1.5) continue;
      const d = Math.hypot(dx, dz), min = radius + 0.32;
      if (d < min && d > 1e-4) {
        pos.x = n.position.x + (dx / d) * min;
        pos.z = n.position.z + (dz / d) * min;
      }
    }
  }
}
