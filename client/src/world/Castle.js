import * as THREE from 'three';
import { Batcher } from '../core/utils.js';
import { HILL_H, LAYOUT } from './layout.js';
import { PALETTE } from './Materials.js';

/**
 * Castelo Real: muralhas, torres, torre de menagem e Salão do Trono acessível.
 */
export function buildCastle({ scene, physics, materials, addFlag, addBanner }) {
  const H = HILL_H;
  const { x: cx, z: cz, w, d, wallH, gateW, gateH } = LAYOUT.castle;
  const t = 2;
  const B = new Batcher(materials);
  const group = new THREE.Group();
  group.name = 'castle';
  scene.add(group);

  const box = (key, x, y, z, bw, bh, bd, { collide = true, color = 0xffffff, rot } = {}) => {
    B.add(key, new THREE.BoxGeometry(bw, bh, bd), { pos: [x, y, z], color, rot });
    if (collide) physics.addBox(x, y, z, bw, bh, bd);
  };
  const cyl = (key, x, y, z, r, h, { collide = true, seg = 20, color = 0xffffff, rTop = r } = {}) => {
    B.add(key, new THREE.CylinderGeometry(rTop, r, h, seg), { pos: [x, y, z], color });
    if (collide) physics.addCylinder(x, z, Math.max(r, rTop), y - h / 2, y + h / 2);
  };

  const front = cz + d / 2, back = cz - d / 2, left = cx - w / 2, right = cx + w / 2;
  const wy = H + wallH / 2;

  // ---- muralhas
  box('stone', cx, wy, back, w, wallH, t);
  box('stone', left, wy, cz, t, wallH, d);
  box('stone', right, wy, cz, t, wallH, d);
  const segW = (w - gateW) / 2;
  box('stone', left + segW / 2, wy, front, segW, wallH, t);
  box('stone', right - segW / 2, wy, front, segW, wallH, t);
  box('stone', cx, H + gateH + (wallH - gateH) / 2, front, gateW, wallH - gateH, t);
  // base mais escura
  box('stoneDark', cx, H + 0.6, back - 0.2, w + 0.6, 1.2, t + 0.4, { collide: false });
  box('stoneDark', left - 0.2, H + 0.6, cz, t + 0.4, 1.2, d, { collide: false });
  box('stoneDark', right + 0.2, H + 0.6, cz, t + 0.4, 1.2, d, { collide: false });
  // telhado do salão
  box('stoneDark', cx, H + wallH + 1, cz, w + 2, 2, d + 2);
  // ameias
  const merlon = (x, z) => box('stone', x, H + wallH + 2.75, z, 1.4, 1.5, 1.4, { collide: false });
  for (let x = left + 1; x <= right - 1; x += 3) {
    merlon(x, front + 0.3);
    merlon(x, back - 0.3);
  }
  for (let z = back + 2; z <= front - 2; z += 3) {
    merlon(left - 0.3, z);
    merlon(right + 0.3, z);
  }

  // ---- portão: moldura dourada e portas abertas
  box('gold', cx - gateW / 2 - 0.4, H + gateH / 2, front + 1.05, 0.8, gateH, 0.3, { collide: false });
  box('gold', cx + gateW / 2 + 0.4, H + gateH / 2, front + 1.05, 0.8, gateH, 0.3, { collide: false });
  box('gold', cx, H + gateH + 0.4, front + 1.05, gateW + 1.6, 0.8, 0.3, { collide: false });
  for (const s of [-1, 1]) {
    B.add('wood', new THREE.BoxGeometry(gateW / 2, gateH - 0.4, 0.4), {
      pos: [cx + s * (gateW / 2 + 0.2), H + gateH / 2, front - 1 - gateW / 4],
      rot: [0, s * Math.PI / 2, 0],
    });
  }
  // rosácea sobre o portão
  B.add('glass', new THREE.CircleGeometry(3.6, 32), { pos: [cx, H + 18, front + 1.02], color: 0xffffff });
  B.add('gold', new THREE.TorusGeometry(3.7, 0.35, 8, 40), { pos: [cx, H + 18, front + 1.1] });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    B.add('gold', new THREE.BoxGeometry(0.2, 7.2, 0.2), { pos: [cx, H + 18, front + 1.15], rot: [0, 0, a] });
  }
  // estandartes na fachada
  for (const x of [-26, -14, 14, 26]) addBanner(group, new THREE.Vector3(cx + x, H + 13, front + 1.1), 4, 11, 0);

  // ---- torres de canto
  const towerH = 46;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = cx + sx * (w / 2), tz = cz + sz * (d / 2);
    cyl('stone', tx, H + towerH / 2, tz, 7, towerH, { seg: 24 });
    cyl('stoneDark', tx, H + 1, tz, 7.4, 2, { collide: false, seg: 24 });
    // anel de ameias
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      box('stone', tx + Math.cos(a) * 7, H + towerH + 0.8, tz + Math.sin(a) * 7, 1.4, 1.6, 1.4, { collide: false });
    }
    B.add('purple', new THREE.ConeGeometry(8.4, 16, 24), { pos: [tx, H + towerH + 9.6, tz] });
    B.add('gold', new THREE.SphereGeometry(0.9, 12, 10), { pos: [tx, H + towerH + 18, tz] });
    B.add('gold', new THREE.CylinderGeometry(0.15, 0.15, 6, 6), { pos: [tx, H + towerH + 21, tz] });
    addFlag(group, new THREE.Vector3(tx, H + towerH + 23.2, tz), 5, 3.2);
    // janelas das torres
    for (let k = 0; k < 3; k++) {
      const a = Math.atan2(-sz, -sx) + (k - 1) * 0.9;
      B.add('glass', new THREE.BoxGeometry(1.2, 3.2, 0.3), {
        pos: [tx + Math.cos(a) * 7.05, H + 30, tz + Math.sin(a) * 7.05],
        rot: [0, -a + Math.PI / 2, 0],
      });
    }
  }

  // ---- torre de menagem e coruchéu central
  const keepY0 = H + wallH + 2;
  box('stone', cx, keepY0 + 8, cz - 8, 28, 16, 24, { collide: false });
  for (let x = cx - 13; x <= cx + 13; x += 3) {
    box('stone', x, keepY0 + 16.75, cz - 8 + 12, 1.4, 1.5, 1.4, { collide: false });
    box('stone', x, keepY0 + 16.75, cz - 8 - 12, 1.4, 1.5, 1.4, { collide: false });
  }
  for (const x of [-8, 0, 8]) B.add('glass', new THREE.BoxGeometry(2, 5, 0.3), { pos: [cx + x, keepY0 + 8, cz + 4.05] });
  cyl('stone', cx, keepY0 + 16 + 10, cz - 8, 5.5, 20, { collide: false, seg: 24 });
  B.add('purple', new THREE.ConeGeometry(6.8, 22, 24), { pos: [cx, keepY0 + 36 + 11, cz - 8] });
  B.add('gold', new THREE.SphereGeometry(1.3, 14, 10), { pos: [cx, keepY0 + 58.5, cz - 8] });
  B.add('gold', new THREE.CylinderGeometry(0.2, 0.2, 9, 6), { pos: [cx, keepY0 + 63, cz - 8] });
  addFlag(group, new THREE.Vector3(cx, keepY0 + 66.5, cz - 8), 9, 5.5);
  // coroa colossal na frente da torre de menagem
  // (a coroa abraça o coruchéu central, apoiada no topo da torre de menagem)
  const crownY = keepY0 + 16.6;
  const CR = 7.4;
  B.add('goldGlow', new THREE.CylinderGeometry(CR, CR, 1.2, 40, 1, true), { pos: [cx, crownY, cz - 8] });
  B.add('goldGlow', new THREE.TorusGeometry(CR, 0.4, 8, 48), { pos: [cx, crownY + 0.6, cz - 8], rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tall = i % 2 ? 3 : 5;
    B.add('goldGlow', new THREE.ConeGeometry(0.8, tall, 8), { pos: [cx + Math.sin(a) * CR, crownY + 0.6 + tall / 2, cz - 8 + Math.cos(a) * CR] });
    B.add('glass', new THREE.SphereGeometry(0.5, 10, 8), {
      pos: [cx + Math.sin(a) * CR, crownY + 0.6 + tall + 0.35, cz - 8 + Math.cos(a) * CR],
      color: i % 3 === 0 ? 0xff6688 : 0xffffff,
    });
  }

  // ---- INTERIOR: Salão do Trono
  box('marble', cx, H + 0.05, cz, w - t, 0.1, d - t);
  // tapete vermelho
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 38), materials.carpet);
  materials.carpet.map.repeat.set(1, 6);
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(cx, H + 0.115, front - 19 - 1);
  carpet.receiveShadow = true;
  group.add(carpet);
  // tapete continua para fora do portão
  const carpetOut = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 14), materials.carpet);
  carpetOut.rotation.x = -Math.PI / 2;
  carpetOut.position.set(cx, H + 0.06, front + 7);
  carpetOut.receiveShadow = true;
  group.add(carpetOut);

  // colunas
  for (const sx of [-1, 1]) {
    for (let z = front - 8; z >= back + 12; z -= 9) {
      const x = cx + sx * 19;
      cyl('marble', x, H + wallH / 2, z, 1.1, wallH, { seg: 16 });
      B.add('gold', new THREE.CylinderGeometry(1.6, 1.15, 1.2, 16), { pos: [x, H + wallH - 0.6, z] });
      B.add('gold', new THREE.CylinderGeometry(1.4, 1.5, 0.8, 16), { pos: [x, H + 0.5, z] });
      // estandarte pendurado entre colunas
    }
  }
  // janelas altas (vitrais) nas laterais
  for (let z = front - 12; z >= back + 8; z -= 9) {
    for (const x of [left, right]) {
      B.add('glass', new THREE.BoxGeometry(t + 0.4, 8, 2.4), { pos: [x, H + 10, z], color: 0xffffff });
      B.add('gold', new THREE.BoxGeometry(t + 0.5, 0.3, 2.8), { pos: [x, H + 14.1, z] });
      B.add('gold', new THREE.BoxGeometry(t + 0.5, 0.3, 2.8), { pos: [x, H + 5.9, z] });
    }
  }

  // estrado em degraus
  const floorTop = H + 0.1;
  const steps = [
    { h: 0.5, z0: back + 1, z1: back + 20 },
    { h: 1.0, z0: back + 1, z1: back + 17 },
    { h: 1.5, z0: back + 1, z1: back + 14 },
  ];
  for (const s of steps) {
    const dz = s.z1 - s.z0;
    box('marble', cx, floorTop + s.h / 2, s.z0 + dz / 2, 26, s.h, dz, { color: 0xfffaf0 });
    box('gold', cx, floorTop + s.h - 0.02, s.z1 + 0.05, 26.1, 0.08, 0.15, { collide: false });
  }
  const daisTop = floorTop + 1.5;
  const carpetDais = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 13), materials.carpet);
  carpetDais.rotation.x = -Math.PI / 2;
  carpetDais.position.set(cx, daisTop + 0.012, back + 7.5);
  group.add(carpetDais);

  // TRONO MONUMENTAL
  const tz = back + 5;
  const seatTop = daisTop + 0.9;
  box('gold', cx, daisTop + 0.35, tz, 3.6, 0.7, 2.6, { collide: false });
  box('crimson', cx, daisTop + 0.8, tz + 0.1, 2.8, 0.2, 2.0, { collide: false });
  box('gold', cx, daisTop + 0.9 + 4.4, tz - 1.15, 3.4, 8.8, 0.5, { collide: false });
  box('crimson', cx, daisTop + 0.9 + 3.6, tz - 0.88, 2.6, 6.4, 0.1, { collide: false });
  for (const s of [-1, 1]) {
    box('gold', cx + s * 1.6, daisTop + 1.35, tz + 0.1, 0.45, 0.6, 2.4, { collide: false });
    B.add('glass', new THREE.SphereGeometry(0.32, 14, 10), { pos: [cx + s * 1.6, daisTop + 1.85, tz + 1.2], color: 0xff5577 });
    // pilares laterais do encosto
    cyl('gold', cx + s * 1.9, daisTop + 5.5, tz - 1.15, 0.28, 11, { collide: false, seg: 10 });
    B.add('goldGlow', new THREE.SphereGeometry(0.5, 12, 10), { pos: [cx + s * 1.9, daisTop + 11.3, tz - 1.15] });
  }
  // coroa no topo do trono
  const tcY = daisTop + 10.2;
  B.add('goldGlow', new THREE.TorusGeometry(1.4, 0.22, 8, 28), { pos: [cx, tcY, tz - 1.15], rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const tall = i % 2 ? 1.0 : 1.6;
    B.add('goldGlow', new THREE.ConeGeometry(0.25, tall, 6), { pos: [cx + Math.sin(a) * 1.4, tcY + tall / 2, tz - 1.15 + Math.cos(a) * 1.4] });
  }
  physics.addBox(cx, daisTop + 5, tz - 0.2, 4.2, 10, 2.8);
  // brasão gigante atrás do trono
  addBanner(group, new THREE.Vector3(cx - 9, H + 12, back + 1.1), 5, 12, 0);
  addBanner(group, new THREE.Vector3(cx + 9, H + 12, back + 1.1), 5, 12, 0);

  // ---- lustres e luzes quentes
  const lights = [];
  for (const z of [front - 10, cz, back + 12]) {
    const y = H + 16;
    B.add('gold', new THREE.TorusGeometry(2.2, 0.15, 8, 28), { pos: [cx, y, z], rot: [Math.PI / 2, 0, 0] });
    B.add('gold', new THREE.CylinderGeometry(0.06, 0.06, wallH - 16, 6), { pos: [cx, y + (wallH - 16) / 2, z] });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      B.add('flame', new THREE.ConeGeometry(0.08, 0.3, 6), { pos: [cx + Math.cos(a) * 2.2, y + 0.3, z + Math.sin(a) * 2.2] });
    }
    const L = new THREE.PointLight(0xffb866, 140, 0, 2);
    L.position.set(cx, y - 1, z);
    group.add(L);
    lights.push(L);
  }
  // tochas nas paredes
  const torches = [];
  for (let z = front - 7; z >= back + 7; z -= 9) {
    for (const s of [-1, 1]) {
      const x = cx + s * (w / 2 - t / 2 - 0.4);
      B.add('gold', new THREE.CylinderGeometry(0.15, 0.08, 0.8, 8), { pos: [x, H + 4.5, z] });
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), materials.flame);
      f.position.set(x, H + 5.2, z);
      group.add(f);
      torches.push(f);
    }
  }
  // braseiros no pátio externo
  for (const s of [-1, 1]) {
    const x = cx + s * 7, z = front + 6;
    cyl('stoneDark', x, H + 0.7, z, 0.6, 1.4, { seg: 10 });
    B.add('gold', new THREE.CylinderGeometry(1.1, 0.6, 0.6, 12), { pos: [x, H + 1.7, z] });
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 10), materials.flame);
    f.position.set(x, H + 2.6, z);
    group.add(f);
    torches.push(f);
  }

  B.build(group);

  return {
    seat: { position: new THREE.Vector3(cx, seatTop, tz + 0.15), standPos: new THREE.Vector3(cx, daisTop, tz + 2.6), rotation: 0 },
    throneLook: new THREE.Vector3(cx, seatTop + 1.2, tz),
    hall: { minX: left + 1, maxX: right - 1, minZ: back + 1, maxZ: front - 0.5, minY: H - 1, maxY: H + wallH },
    daisTop,
    update(dt, time) {
      for (let i = 0; i < torches.length; i++) {
        const f = torches[i];
        const s = 1 + Math.sin(time * 13 + i * 1.7) * 0.12 + Math.sin(time * 7.3 + i) * 0.08;
        f.scale.set(1, s, 1);
      }
      for (let i = 0; i < lights.length; i++) lights[i].intensity = 140 + Math.sin(time * 9 + i * 2) * 12;
    },
  };
}

export const CASTLE_COLORS = { PALETTE };
