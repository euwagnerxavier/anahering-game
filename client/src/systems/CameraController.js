import * as THREE from 'three';
import { clamp, damp } from '../core/utils.js';

/** Câmera orbital em terceira pessoa com anticolisão + planos cinematográficos. */
export class CameraController {
  constructor(game) {
    this.game = game;
    this.cam = game.camera;
    this.yaw = Math.PI; // olhando para +Z (a rainha começa de frente para a cidade)
    this.pitch = 0.28;
    this.distance = 7.5;
    this.effDist = 7.5;
    this.target = new THREE.Vector3();
    this.lookPos = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this.shot = null; // { pos, look, lambda }
    this.orbitTitle = 0;
    this.sensitivity = 0.0024;
    this._tmp = new THREE.Vector3();
  }

  /** Plano cinematográfico fixo (posição e alvo). */
  setShot(pos, look, lambda = 2.5) {
    this.shot = { pos: pos.clone(), look: look.clone(), lambda };
  }
  clearShot() {
    this.shot = null;
    // reorienta a órbita para onde a câmera está agora (transição suave)
    const q = this.game.systems.queen;
    if (q) {
      const d = this._tmp.copy(this.cam.position).sub(q.position);
      this.yaw = Math.atan2(d.x, d.z);
      this.pitch = clamp(Math.asin(clamp(d.y / Math.max(d.length(), 0.001), -1, 1)), -0.35, 1.25);
      this.distance = clamp(d.length(), 2.6, 16);
    }
  }

  update(dt, time) {
    const g = this.game;
    const input = g.input;
    const queen = g.systems.queen;

    if (g.mode === 'title') {
      // órbita lenta ao redor do reino na tela de título
      this.orbitTitle += dt * 0.05;
      const a = this.orbitTitle;
      const p = this._tmp.set(Math.sin(a) * 120, 60 + Math.sin(a * 0.7) * 10, -60 + Math.cos(a) * 120);
      this.cam.position.lerp(p, 1 - Math.exp(-dt * 2));
      this.lookPos.lerp(new THREE.Vector3(0, 20, -110), 1 - Math.exp(-dt * 2));
      this.cam.lookAt(this.lookPos);
      return;
    }

    if (this.shot) {
      const k = 1 - Math.exp(-this.shot.lambda * dt);
      this.cam.position.lerp(this.shot.pos, k);
      this.lookPos.lerp(this.shot.look, k);
      this.cam.lookAt(this.lookPos);
      return;
    }

    if (g.controllable) {
      this.yaw -= input.mouseDX * this.sensitivity;
      this.pitch = clamp(this.pitch + input.mouseDY * this.sensitivity, -0.35, 1.25);
      if (input.wheel) this.distance = clamp(this.distance + input.wheel * 0.8, 2.6, 16);
    }

    // alvo: cabeça da rainha (mais baixo quando sentada)
    const headY = queen.sitting ? 1.2 : 1.75;
    this.target.set(queen.position.x, queen.position.y + headY, queen.position.z);
    const dir = this._tmp.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));

    // anticolisão: marcha do alvo até a posição desejada
    let maxD = this.distance;
    const step = 0.3;
    const probe = new THREE.Vector3();
    for (let d = 0.6; d <= this.distance; d += step) {
      probe.copy(this.target).addScaledVector(dir, d);
      if (g.physics.pointBlocked(probe)) {
        maxD = Math.max(0.8, d - 0.4);
        break;
      }
    }
    this.effDist = maxD < this.effDist ? damp(this.effDist, maxD, 25, dt) : damp(this.effDist, maxD, 3, dt);
    this.camPos.copy(this.target).addScaledVector(dir, this.effDist);
    this.cam.position.lerp(this.camPos, 1 - Math.exp(-18 * dt));
    this.lookPos.lerp(this.target, 1 - Math.exp(-20 * dt));
    this.cam.lookAt(this.lookPos);
  }
}
