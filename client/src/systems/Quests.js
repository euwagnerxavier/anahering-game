import * as THREE from 'three';
import { QUESTS } from '../data/quests.js';
import { titleFor } from '../data/titles.js';

/** Campanha linear de missões, prestígio, títulos e marcador 3D de objetivo. */
export class Quests {
  constructor(game, saved = null) {
    this.game = game;
    this.defs = QUESTS;
    this.index = saved?.index ?? 0;
    this.step = saved?.step ?? 0;
    this.progress = saved?.progress ?? 0;
    this.prestige = saved?.prestige ?? 0;
    this.flags = saved?.flags ?? {};
    this.collected = new Set(saved?.collected ?? []);
    this.finished = this.index >= this.defs.length;
    this.waveCooldown = 0;

    // marcador de objetivo
    const m = new THREE.Group();
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({ color: 0xffd35c, emissive: 0xffa800, emissiveIntensity: 10, metalness: 0.6, roughness: 0.2 })
    );
    gem.scale.y = 1.6;
    m.add(gem);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.5, 30, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd35c, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    );
    beam.position.y = 15;
    m.add(beam);
    m.visible = false;
    game.scene.add(m);
    this.marker = m;
    this.markerGem = gem;

    // restaura tributos coletados
    for (const t of game.world.tributes) if (this.collected.has(t.id)) t.collected = true;

    // escuta todos os eventos usados pelas etapas
    const events = new Set(this.defs.flatMap((q) => q.steps.map((s) => s.event)));
    for (const e of events) game.events.on(e, (p) => this.onEvent(e, p));
    game.events.on('tribute:collected', (p) => {
      this.collected.add(p.id);
      this.addPrestige(5, 'Tributo recuperado');
    });
    game.events.on('queen:waved', ({ count }) => {
      if (count >= 3 && this.waveCooldown <= 0) {
        this.waveCooldown = 10;
        this.addPrestige(2, 'Aceno real');
      }
    });
  }

  /** Novo jogo: zera a campanha. */
  reset() {
    this.index = this.step = this.progress = this.prestige = 0;
    this.flags = {};
    this.collected.clear();
    this.finished = false;
    for (const t of this.game.world.tributes) {
      t.collected = false;
      t.mesh.visible = false;
    }
  }

  get quest() {
    return this.defs[this.index] ?? null;
  }
  get stepDef() {
    return this.quest?.steps[this.step] ?? null;
  }

  isAt(questId, stepId) {
    return this.quest?.id === questId && this.stepDef?.id === stepId;
  }
  isDone(questId) {
    const i = this.defs.findIndex((q) => q.id === questId);
    return i >= 0 && i < this.index;
  }

  /** Texto atual do rastreador. */
  trackerText() {
    const s = this.stepDef;
    if (!s) return null;
    return s.text.replace('{n}', this.progress).replace('{count}', s.count ?? 1);
  }

  start() {
    // chamado quando o jogo começa (inclui retomada de save)
    if (this.finished) return this.emitState();
    this.stepDef?.onStart?.(this.game);
    this.game.events.emit('quest:started', { quest: this.quest, resumed: this.step > 0 });
    this.emitState();
  }

  onEvent(name, payload) {
    const s = this.stepDef;
    if (!s || s.event !== name) return;
    if (s.match && !s.match(payload, this.game)) return;
    this.progress++;
    if (this.progress < (s.count ?? 1)) {
      this.game.events.emit('quest:progress', { quest: this.quest, step: s, progress: this.progress });
      this.emitState();
      return;
    }
    this.advance();
  }

  advance() {
    const g = this.game;
    this.progress = 0;
    this.step++;
    if (this.step >= this.quest.steps.length) {
      const done = this.quest;
      this.index++;
      this.step = 0;
      g.events.emit('quest:completed', { quest: done });
      this.addPrestige(done.reward, `Missão: ${done.title}`);
      if (this.index >= this.defs.length) {
        this.finished = true;
        g.events.emit('campaign:completed');
        this.emitState();
      } else {
        this.emitState();
        setTimeout(() => {
          this.stepDef?.onStart?.(g);
          g.events.emit('quest:started', { quest: this.quest });
          this.emitState();
        }, 3500);
      }
    } else {
      this.stepDef?.onStart?.(g);
      g.events.emit('quest:step', { quest: this.quest, step: this.stepDef });
      this.emitState();
    }
  }

  addPrestige(amount, reason) {
    const before = titleFor(this.prestige);
    this.prestige += amount;
    const after = titleFor(this.prestige);
    this.game.events.emit('prestige:gained', { amount, reason, total: this.prestige });
    if (after !== before) this.game.events.emit('title:new', { title: after });
    this.emitState();
  }

  emitState() {
    this.game.events.emit('quest:state', {
      quest: this.quest,
      tracker: this.trackerText(),
      prestige: this.prestige,
      finished: this.finished,
    });
    this.game.events.emit('save:request');
  }

  serialize() {
    return { index: this.index, step: this.step, progress: this.progress, prestige: this.prestige, flags: this.flags, collected: [...this.collected] };
  }

  /** Posição do objetivo atual (ou null). */
  target() {
    const s = this.stepDef;
    if (!s?.target || this.game.mode === 'title') return null;
    try {
      return s.target(this.game) ?? null;
    } catch {
      return null;
    }
  }

  update(dt, time) {
    this.waveCooldown -= dt;
    const t = this.target();
    this.marker.visible = !!t;
    if (t) {
      this.marker.position.set(t.x, t.y + 3.2 + Math.sin(time * 2.5) * 0.25, t.z);
      this.markerGem.rotation.y = time * 2;
      // some quando a rainha está em cima do objetivo
      const d = this.game.systems.queen.position.distanceTo(t);
      this.marker.children[1].visible = d > 12;
      this.markerGem.visible = d > 2.5;
    }
  }
}
