import * as THREE from 'three';
import { QueenModel } from './QueenModel.js';
import { damp, dampAngle } from '../core/utils.js';

const RADIUS = 0.42;
const HEIGHT = 2.1;
const WALK = 4.6;
const RUN = 9.2;
const JUMP_V = 7.2;
const GRAVITY = 16; // gravidade "majestosa": um pouco mais lenta

/** Controlador em terceira pessoa de Ana Hering. */
export class Queen {
  constructor(game, spawn) {
    this.game = game;
    this.model = new QueenModel({ materials: game.world.materials });
    game.scene.add(this.model.root);
    this.position = new THREE.Vector3().copy(spawn);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.onGround = true;
    this.sitting = false;
    this.seat = null;
    this.state = 'idle';
    this.lastStepPhase = 0;
    this.spawn = spawn.clone();
    this.position.y = game.physics.groundAt(spawn.x, spawn.z, spawn.y + 1);
  }

  /** Estado de animação compacto para a rede (0 idle, 1 walk, 2 run, 3 sit, 4 jump). */
  get animCode() {
    return { idle: 0, walk: 1, run: 2, sit: 3, jump: 4 }[this.state] ?? 0;
  }

  sitOnThrone(seat) {
    if (this.sitting) return;
    this.sitting = true;
    this.seat = seat;
    this.velocity.set(0, 0, 0);
    this.position.set(seat.position.x, seat.position.y - 0.45, seat.position.z);
    this.yaw = seat.rotation;
    this.game.events.emit('throne:sat', { seat });
  }

  standUp() {
    if (!this.sitting) return;
    this.sitting = false;
    this.position.copy(this.seat.standPos);
    this.game.events.emit('throne:stood');
  }

  /** Teleporta (usado em cerimônias). */
  placeAt(p, yaw) {
    this.position.copy(p);
    this.velocity.set(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
  }

  update(dt, time) {
    const g = this.game;
    const input = g.input;
    const phys = g.physics;
    const control = g.controllable;

    if (this.sitting) {
      this.state = 'sit';
      if (control) {
        const move = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((k) => input.isDown(k));
        if (input.wasPressed('KeyE') || move) {
          input.consume('KeyE');
          this.standUp();
        }
        else if (input.wasPressed('KeyR')) g.systems.decree.open();
      }
    } else {
      // direção relativa à câmera
      let ix = 0, iz = 0;
      if (control) {
        if (input.isDown('KeyW') || input.isDown('ArrowUp')) iz += 1;
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) iz -= 1;
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) ix += 1;
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) ix -= 1;
      }
      const camYaw = g.systems.camera.yaw;
      const len = Math.hypot(ix, iz);
      const running = control && (input.isDown('ShiftLeft') || input.isDown('ShiftRight'));
      const speed = running ? RUN : WALK;
      let tx = 0, tz = 0;
      if (len > 0) {
        ix /= len;
        iz /= len;
        const s = Math.sin(camYaw), c = Math.cos(camYaw);
        // frente da câmera = (-sin, -cos); direita = (cos, -sin)
        tx = (-ix * c - iz * s) * speed;
        tz = (ix * s - iz * c) * speed;
      }
      const accel = this.onGround ? 10 : 2.5;
      this.velocity.x = damp(this.velocity.x, tx, accel, dt);
      this.velocity.z = damp(this.velocity.z, tz, accel, dt);

      if (control && this.onGround && input.wasPressed('Space')) {
        this.velocity.y = JUMP_V;
        this.onGround = false;
        g.events.emit('queen:jump');
      }
      if (control && input.wasPressed('KeyQ')) {
        this.model.wave();
        g.events.emit('queen:wave');
      }

      this.velocity.y -= GRAVITY * dt;
      const p = this.position;
      const prevGround = this.onGround;
      p.x += this.velocity.x * dt;
      p.z += this.velocity.z * dt;
      p.y += this.velocity.y * dt;

      phys.resolve(p, RADIUS, HEIGHT);
      g.systems.npcs?.pushOut(p, RADIUS);

      const ceil = phys.ceilingAt(p.x, p.z, p.y - this.velocity.y * dt, HEIGHT, RADIUS);
      if (p.y + HEIGHT > ceil) {
        p.y = ceil - HEIGHT;
        if (this.velocity.y > 0) this.velocity.y = 0;
      }

      const ground = phys.groundAt(p.x, p.z, Math.max(p.y, p.y - this.velocity.y * dt), RADIUS);
      // gruda no chão ao descer rampas suaves
      const snap = prevGround && this.velocity.y <= 0 && p.y - ground < 0.6;
      if (p.y <= ground || snap) {
        p.y = ground;
        if (this.velocity.y < 0) this.velocity.y = 0;
        if (!prevGround) g.events.emit('queen:land');
        this.onGround = true;
      } else this.onGround = false;

      if (p.y < -40) this.placeAt(this.spawn);

      const hs = Math.hypot(this.velocity.x, this.velocity.z);
      if (hs > 0.3) this.yaw = dampAngle(this.yaw, Math.atan2(this.velocity.x, this.velocity.z), 10, dt);
      this.state = !this.onGround ? 'jump' : hs > WALK + 0.8 ? 'run' : hs > 0.4 ? 'walk' : 'idle';
    }

    // passos
    const ph = this.model.phase;
    if ((this.state === 'walk' || this.state === 'run') && Math.floor(ph / Math.PI) !== Math.floor(this.lastStepPhase / Math.PI)) {
      g.events.emit('queen:step', { run: this.state === 'run' });
    }
    this.lastStepPhase = ph;

    const root = this.model.root;
    root.position.copy(this.position);
    root.rotation.y = this.yaw;
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    this.model.animate(dt, { state: this.state, speed: Math.min(1, hs / RUN), time });
  }
}
