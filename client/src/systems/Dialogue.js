import * as THREE from 'three';
import { buildDialogues, SPEAKERS } from '../data/dialogues.js';

/** Executa grafos de diálogo declarativos e controla o enquadramento da câmera. */
export class Dialogue {
  constructor(game) {
    this.game = game;
    this.defs = buildDialogues(game);
    this.active = null;
  }

  get ui() {
    return this.game.systems.dialogueUI;
  }

  open(id, ctx = {}) {
    const def = this.defs[id];
    if (!def || this.active) return;
    const g = this.game;
    this.active = { id, def, ctx };
    g.setMode('dialogue');
    if (document.pointerLockElement) document.exitPointerLock();

    // enquadramento: por cima do ombro da rainha mirando o interlocutor
    const q = g.systems.queen;
    const focus = ctx.npc ? ctx.npc.position : ctx.focus;
    if (focus) {
      const mid = new THREE.Vector3().copy(q.position).lerp(focus, 0.5);
      mid.y = q.position.y + 1.5;
      const dir = new THREE.Vector3().subVectors(focus, q.position).setY(0).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const camPos = new THREE.Vector3().copy(q.position).addScaledVector(dir, -2.6).addScaledVector(side, 1.6);
      camPos.y = q.position.y + 2.3;
      g.systems.camera.setShot(camPos, mid, 4);
      // a rainha e o NPC se encaram
      if (ctx.npc) {
        q.yaw = Math.atan2(dir.x, dir.z);
        ctx.npc.rotY = Math.atan2(-dir.x, -dir.z);
      }
    }
    const start = typeof def.start === 'function' ? def.start(g, ctx) : def.start;
    this.show(start);
  }

  show(nodeId) {
    const g = this.game;
    const { def, ctx } = this.active;
    const node = def.nodes[nodeId];
    if (!node) return this.close();
    this.active.node = node;
    node.action?.(g, ctx);
    const speakerKey = node.speaker ?? def.speaker;
    const sp = { ...SPEAKERS[speakerKey] };
    if (speakerKey === 'commoner' && ctx.npc) {
      const [name, job] = ctx.npc.name.split(', ');
      sp.name = name;
      sp.title = job || ctx.npc.name;
    }
    const text = typeof node.text === 'function' ? node.text(g, ctx) : node.text;
    const choices = node.choices?.length ? node.choices : null;
    g.systems.audio?.sfx('blip');
    this.ui.show({
      speaker: sp,
      text,
      choices: choices?.map((c) => c.text),
      canContinue: !choices,
      onChoice: (i) => {
        const c = choices[i];
        g.systems.audio?.sfx('ui');
        const next = typeof c.next === 'function' ? c.next(g, ctx) : c.next;
        // a ação pode abrir uma cerimônia; fechamos o diálogo antes
        if (!next) this.close();
        c.action?.(g, ctx);
        if (next) this.show(next);
      },
      onContinue: () => {
        const next = typeof node.next === 'function' ? node.next(g, ctx) : node.next;
        if (next) this.show(next);
        else this.close();
      },
    });
  }

  close() {
    if (!this.active) return;
    const g = this.game;
    const { id, ctx } = this.active;
    this.active = null;
    this.ui.hide();
    if (g.mode === 'dialogue') {
      g.setMode('play');
      g.systems.camera.clearShot();
    }
    if (ctx.npc) g.events.emit('npc:talked', { id: ctx.npc.id, dialogue: id });
    g.events.emit('dialogue:closed', { id });
  }

  update() {
    if (!this.active) return;
    const input = this.game.input;
    const keys = ['KeyE', 'Enter', 'Space'];
    if (keys.some((k) => input.wasPressed(k))) {
      keys.forEach((k) => input.consume(k));
      this.ui.advance();
    }
    for (let i = 0; i < 3; i++) {
      const code = `Digit${i + 1}`;
      if (input.wasPressed(code)) {
        input.consume(code);
        this.ui.choose(i);
      }
    }
  }
}
