import * as THREE from 'three';
import { HILL_H } from '../world/layout.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Sequências cinematográficas: intro, discurso, trono e Coroação Suprema. */
export class Ceremony {
  constructor(game) {
    this.game = game;
    this.busy = false;
    game.events.on('throne:sat', () => this.throne());
    game.events.on('net:event', (e) => this.globalEvent(e));
  }

  get s() {
    return this.game.systems;
  }

  async intro() {
    const g = this.game;
    const { camera, hud, audio } = this.s;
    g.setMode('cinematic');
    const q = this.s.queen.position;
    camera.cam.position.set(0, 60, 40);
    camera.lookPos.set(0, 12, 0);
    camera.setShot(new THREE.Vector3(18, 30, -60), new THREE.Vector3(0, 12, -20), 0.6);
    audio.fanfare();
    hud.announce('ANA HERING', 'Rainha Absoluta do Reino de Heringuia', '', true);
    await wait(3800);
    camera.setShot(new THREE.Vector3(q.x + 3.5, q.y + 2.2, q.z + 6), new THREE.Vector3(q.x, q.y + 1.6, q.z), 1.4);
    hud.toast('Os súditos aguardam lá embaixo. O reino é seu.');
    await wait(2600);
    camera.clearShot();
    camera.yaw = Math.PI;
    camera.pitch = 0.25;
    camera.distance = 7.5;
    g.setMode('play');
  }

  throne() {
    const { camera, hud, audio, particles } = this.s;
    const seat = this.game.world.castle.seat.position;
    camera.setShot(new THREE.Vector3(seat.x + 2.5, seat.y + 0.6, seat.z + 9), new THREE.Vector3(seat.x, seat.y + 1.4, seat.z), 2);
    audio.fanfare();
    audio.applause(4);
    hud.toast('A corte aplaude de pé. Alguns aplaudem sentados para não ofuscar a Rainha.');
    particles.confetti(new THREE.Vector3(seat.x, seat.y + 6, seat.z + 6), 160);
    // a câmera permanece cinematográfica enquanto sentada
    const off = this.game.events.on('throne:stood', () => {
      off();
      camera.clearShot();
    });
  }

  async speech(choice) {
    if (this.busy) return;
    this.busy = true;
    const g = this.game;
    const { camera, hud, audio, particles, queen } = this.s;
    const podium = g.world.plaza.podium;
    g.setMode('cinematic');
    queen.placeAt(new THREE.Vector3(podium.x, podium.y, podium.z + 0.4), 0);
    g.events.emit('speech:start', { podium });
    camera.setShot(new THREE.Vector3(podium.x - 5, podium.y + 3.2, podium.z + 16), new THREE.Vector3(podium.x, podium.y + 2, podium.z), 1.6);
    const lines = [
      ['“…AMANHÃ TAMBÉM SERÁ HOJE!”', 'O povo não entendeu nada e aplaudiu por 40 minutos.'],
      ['“…ELOGIEM À VONTADE!”', 'Três súditos desmaiaram de alívio fiscal.'],
      ['“…BASTA OLHAREM PARA MIM.”', 'Eles olharam. Ninguém conseguiu parar de olhar.'],
    ][choice] ?? ['“…”', 'Silêncio reverente.'];
    await wait(2200);
    hud.announce('DISCURSO REAL', lines[0], lines[1], true);
    audio.fanfare();
    audio.applause(6);
    queen.model.wave();
    g.events.emit('crowd:cheer', { center: podium, radius: 60, duration: 8, look: podium });
    particles.confetti(new THREE.Vector3(podium.x, podium.y + 8, podium.z + 8), 400);
    await wait(2500);
    camera.setShot(new THREE.Vector3(podium.x + 6, podium.y + 2.4, podium.z + 5), new THREE.Vector3(podium.x, podium.y + 1.9, podium.z), 1.2);
    particles.petals(new THREE.Vector3(podium.x, podium.y, podium.z + 8), 18, 8);
    await wait(3000);
    camera.clearShot();
    g.setMode('play');
    this.busy = false;
    g.events.emit('speech:done', { choice });
  }

  async coronation() {
    if (this.busy) return;
    this.busy = true;
    const g = this.game;
    const { camera, hud, audio, particles, queen } = this.s;
    const podium = g.world.plaza.podium;
    g.setMode('cinematic');
    queen.placeAt(new THREE.Vector3(podium.x, podium.y, podium.z + 0.4), 0);
    g.events.emit('speech:start', { podium });
    audio.setIntensity(1);
    camera.setShot(new THREE.Vector3(0, 30, 40), new THREE.Vector3(0, 12, 0), 0.7);
    hud.announce('A COROAÇÃO SUPREMA', 'Que todos os reinos, conhecidos e desconhecidos, se curvem.', '', true);
    audio.fanfare();
    await wait(3500);
    camera.setShot(new THREE.Vector3(podium.x + 4, podium.y + 2.6, podium.z + 7), new THREE.Vector3(podium.x, podium.y + 2.2, podium.z), 1.4);
    // uma segunda coroa desce do céu sobre a coroa
    const crown2 = queen.model.crown.clone();
    crown2.scale.setScalar(1.25);
    g.scene.add(crown2);
    const head = new THREE.Vector3();
    const t0 = performance.now();
    await new Promise((resolve) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / 3500);
        queen.model.crown.getWorldPosition(head);
        crown2.position.set(head.x, head.y + 0.2 + (1 - t) * 6, head.z);
        crown2.rotation.y = t * Math.PI * 4;
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
    g.scene.remove(crown2);
    queen.model.crown.scale.setScalar(1.35);
    queen.model.crown.position.y = 0.16;
    g.events.emit('queen:crowned');
    audio.fanfare();
    audio.applause(10);
    g.events.emit('crowd:cheer', { center: podium, radius: 120, duration: 14, look: podium });
    particles.fireworksShow(new THREE.Vector3(0, 0, 0), 14);
    particles.petals(new THREE.Vector3(0, 0, -10), 40, 14);
    particles.confetti(new THREE.Vector3(podium.x, podium.y + 8, podium.z + 6), 600);
    hud.announce('IMPERATRIZ SUPREMA', 'do Universo Conhecido e Desconhecido', '', true);
    await wait(3000);
    camera.setShot(new THREE.Vector3(-30, 22, 50), new THREE.Vector3(0, 14, -10), 0.8);
    await wait(5000);
    camera.clearShot();
    audio.setIntensity(0);
    g.setMode('play');
    this.busy = false;
    g.events.emit('coronation:done');
  }

  /** Eventos globais vindos do servidor (todos os jogadores veem ao mesmo tempo). */
  globalEvent(e) {
    const { hud, audio, particles, queen } = this.s;
    hud.toast(`📯 ${e.msg}`, 6000);
    if (e.kind === 'fireworks') particles.fireworksShow(new THREE.Vector3(0, 0, 0), 10);
    else if (e.kind === 'petals') particles.petals(queen.position.clone(), 30, 20);
    else if (e.kind === 'fanfare') audio.fanfare();
    else if (e.kind === 'holiday') this.game.events.emit('crowd:cheer', { center: queen.position, radius: 80, duration: 6 });
    if (e.kind !== 'fanfare') audio.applause(3);
  }
}

export { HILL_H };
