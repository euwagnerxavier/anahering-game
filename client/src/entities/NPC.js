import * as THREE from 'three';
import { buildNPCModel } from './NPCModel.js';
import { damp, dampAngle } from '../core/utils.js';

/**
 * Súdito do reino. Tipos: 'crowd' (praça), 'walker' (ruas), 'named', 'courtier', 'guard'.
 * Estados: idle, walk, bow, admire, cheer, clap, gather.
 */
export class NPC {
  constructor({ id, kind, look, position, rotY = 0, name = 'Súdito', dialogue = 'commoner', seed = 0, path = null, home = null }) {
    this.id = id;
    this.kind = kind;
    this.name = name;
    this.dialogue = dialogue;
    this.seed = seed;
    this.model = buildNPCModel(look);
    this.root = this.model.root;
    this.position = this.root.position.copy(position);
    this.rotY = rotY;
    this.baseRot = rotY;
    this.root.rotation.y = rotY;
    this.state = 'idle';
    this.stateT = 0;
    this.cooldown = 0;
    this.phase = seed;
    this.path = path; // [Vector3, Vector3] para andar de um lado ao outro
    this.pathDir = 1;
    this.home = home; // { x, z, r0, r1 } para vagar
    this.target = null;
    this.speed = 1.2 + (seed % 5) * 0.12;
    this.lookAt = null;
    this.forced = null; // estado comandado (cheer/clap/gather) com tempo
    this.forcedT = 0;
  }

  /** Comanda um estado temporário (gather/cheer/clap), olhando para `look` (ou para a rainha). */
  setForced(state, duration, target = null, look = null) {
    this.forced = state;
    this.forcedT = duration;
    this.lookTarget = look;
    if (target) this.target = target.clone();
    else if (state === 'gather') this.forced = 'cheer';
  }

  /** Decide o próximo alvo de caminhada. */
  pickTarget(rand) {
    if (this.path) {
      this.pathDir *= -1;
      this.target = (this.pathDir > 0 ? this.path[1] : this.path[0]).clone();
    } else if (this.home) {
      // anda em arcos curtos para não atravessar o centro (fonte)
      const cur = Math.atan2(this.position.z - this.home.z, this.position.x - this.home.x);
      const a = cur + (rand() - 0.5) * 1.2;
      const d = this.home.r0 + rand() * (this.home.r1 - this.home.r0);
      this.target = new THREE.Vector3(this.home.x + Math.cos(a) * d, 0, this.home.z + Math.sin(a) * d);
    }
  }

  update(dt, time, ctx) {
    const { queenPos, heightAt, rand } = ctx;
    const m = this.model;
    let anim = 'idle';
    this.stateT -= dt;
    this.cooldown -= dt;

    const dq = this.position.distanceTo(queenPos);
    const queenNear = dq < 6.5 && !ctx.queenSitting;

    if (this.forced) {
      this.forcedT -= dt;
      if (this.forcedT <= 0) this.forced = null;
    }

    if (this.forced === 'gather' && this.target) {
      if (this.moveTo(this.target, dt, heightAt, 2.6)) anim = 'walk';
      else {
        anim = 'clap';
        this.faceTo(this.lookTarget ?? queenPos, dt);
      }
    } else if (this.forced === 'cheer' || this.forced === 'clap') {
      anim = this.forced;
      this.faceTo(this.lookTarget ?? queenPos, dt);
    } else if (this.kind !== 'named' && queenNear && this.cooldown <= 0 && this.state !== 'bow') {
      this.state = 'bow';
      this.stateT = 2.2;
      this.cooldown = 9;
      ctx.onBow?.(this);
    }

    if (!this.forced) {
      if (this.state === 'bow') {
        anim = 'bow';
        this.faceTo(queenPos, dt);
        if (this.stateT <= 0) this.state = 'admire';
      } else if (this.state === 'admire' || (this.kind === 'named' && dq < 5)) {
        anim = 'idle';
        this.faceTo(queenPos, dt);
        if (dq > 9) this.state = 'idle';
      } else if (this.kind === 'walker' || this.kind === 'crowd') {
        if (!this.target || this.state === 'idle') {
          if (this.stateT <= 0) {
            this.pickTarget(rand);
            this.state = 'walk';
          }
        }
        if (this.state === 'walk' && this.target) {
          if (this.moveTo(this.target, dt, heightAt, 0.4)) anim = 'walk';
          else {
            this.state = 'idle';
            this.stateT = 1 + rand() * 4;
          }
        }
      } else if (this.kind === 'courtier' || this.kind === 'guard' || this.kind === 'named') {
        this.rotY = dampAngle(this.rotY, this.baseRot, 2, dt);
      }
    }

    this.root.rotation.y = this.rotY;
    this.animate(anim, dt, time);
  }

  moveTo(target, dt, heightAt, arrive) {
    const dx = target.x - this.position.x, dz = target.z - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d < arrive) return false;
    const sp = this.forced === 'gather' ? 3.2 : this.speed;
    this.position.x += (dx / d) * sp * dt;
    this.position.z += (dz / d) * sp * dt;
    this.position.y = heightAt(this.position.x, this.position.z);
    this.rotY = dampAngle(this.rotY, Math.atan2(dx, dz), 8, dt);
    return true;
  }

  faceTo(p, dt) {
    this.rotY = dampAngle(this.rotY, Math.atan2(p.x - this.position.x, p.z - this.position.z), 6, dt);
  }

  animate(anim, dt, time) {
    const m = this.model;
    const [aL, aR] = m.arms;
    const [lL, lR] = m.legs;
    let torsoX = 0, legA = 0, armL = 0, armR = 0, armZ = 0.08, hop = 0;
    if (anim === 'walk') {
      this.phase += dt * 7;
      legA = Math.sin(this.phase) * 0.6;
      armL = -legA * 0.8;
      armR = legA * 0.8;
      hop = Math.abs(Math.sin(this.phase)) * 0.03;
    } else if (anim === 'bow') {
      torsoX = 0.85;
      armL = -0.3;
      armR = -0.3;
    } else if (anim === 'cheer') {
      const t = time * 9 + this.seed;
      armZ = 2.6 + Math.sin(t) * 0.25;
      hop = Math.max(0, Math.sin(time * 6 + this.seed)) * 0.25;
    } else if (anim === 'clap') {
      armL = -1.2;
      armR = -1.2;
      armZ = -0.35 - Math.max(0, Math.sin(time * 16 + this.seed)) * 0.3;
    } else {
      torsoX = Math.sin(time * 1.5 + this.seed) * 0.02;
    }
    m.torso.rotation.x = damp(m.torso.rotation.x, torsoX, 8, dt);
    lL.rotation.x = damp(lL.rotation.x, legA, 14, dt);
    lR.rotation.x = damp(lR.rotation.x, -legA, 14, dt);
    aL.rotation.x = damp(aL.rotation.x, armL, 10, dt);
    aR.rotation.x = damp(aR.rotation.x, armR, 10, dt);
    aL.rotation.z = damp(aL.rotation.z, -armZ, 10, dt);
    aR.rotation.z = damp(aR.rotation.z, armZ, 10, dt);
    m.inner.position.y = damp(m.inner.position.y, hop, 14, dt);
  }
}
