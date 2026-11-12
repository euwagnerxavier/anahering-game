import * as THREE from 'three';
import { Batcher, prismGeometry, rng } from '../core/utils.js';
import { LAYOUT, HILL_H } from './layout.js';
import { addFlagPole } from './Flags.js';
import { buildStatue } from './Statue.js';

const PLASTER = [0xfff4dc, 0xffe2d0, 0xfff0b8, 0xe2ecf4, 0xf4dfe8, 0xfbe9c9];
const ROOFS = [0xb5482f, 0x9b3a2a, 0x5d6f8a, 0x7a3b2a, 0x6a2a7a, 0xa85a2c];

/** Exclusões para casas e árvores: lugares que precisam ficar livres. */
export function isReserved(x, z, pad = 0) {
  const d = (a, b) => Math.hypot(x - a, z - b);
  if (d(LAYOUT.plaza.x, LAYOUT.plaza.z) < LAYOUT.plaza.r + 10 + pad) return true;
  if (Math.abs(x) < 18 + pad && z < -20) return true; // avenida
  if (z < -92 - pad * 0) return true; // colina
  if (d(LAYOUT.lake.x, LAYOUT.lake.z) < LAYOUT.lake.r + 10 + pad) return true;
  if (Math.abs(x - LAYOUT.market.x) < 16 + pad && Math.abs(z - LAYOUT.market.z) < 16 + pad) return true;
  for (const t of LAYOUT.tributes) if (d(t.x, t.z) < 7 + pad) return true;
  return false;
}

/** Cidade Baixa: casas em enxaimel geradas proceduralmente + avenida com estátuas e bandeiras. */
export function buildCity(ctx) {
  const { scene, physics, materials, flags, heightAt } = ctx;
  const B = new Batcher(materials);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const r = rng(2024);
  const houses = [];

  const addHouse = (x, z, w, d, h, rotQuarter) => {
    // ancora na menor altura dos cantos
    let base = Infinity;
    for (const [dx, dz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0]]) base = Math.min(base, heightAt(x + dx, z + dz));
    const plaster = r.pick(PLASTER), roof = r.pick(ROOFS);
    const [bw, bd] = rotQuarter ? [d, w] : [w, d];
    // fundação de pedra
    B.add('stoneDark', new THREE.BoxGeometry(bw + 0.3, 1.2, bd + 0.3), { pos: [x, base - 0.3, z] });
    B.add('plaster', new THREE.BoxGeometry(bw, h, bd), { pos: [x, base + h / 2, z], color: plaster });
    const rh = 2.2 + r() * 1.6;
    // telhado: cumeeira ao longo do maior lado
    const ridgeAlongX = bw >= bd;
    const roofGeo = prismGeometry(ridgeAlongX ? bw + 0.8 : bd + 0.8, rh, ridgeAlongX ? bd + 1 : bw + 1);
    B.add('roof', roofGeo, { pos: [x, base + h, z], rot: [0, ridgeAlongX ? 0 : Math.PI / 2, 0], color: roof });
    // chaminé
    if (r() < 0.6) B.add('stoneDark', new THREE.BoxGeometry(0.7, rh + 1, 0.7), { pos: [x + bw * 0.25, base + h + rh / 2 + 0.3, z + bd * 0.2] });
    // porta voltada para a rua mais próxima (face +Z ou -Z)
    const dz = ((z % 24) + 24) % 24 < 12 ? -1 : 1; // rua em múltiplos de 24
    B.add('wood', new THREE.BoxGeometry(1.2, 2.1, 0.12), { pos: [x, base + 1.05, z + dz * (bd / 2 + 0.03)] });
    B.add('gold', new THREE.SphereGeometry(0.06, 6, 4), { pos: [x + 0.4, base + 1.05, z + dz * (bd / 2 + 0.1)] });
    // devoção: bandeirinhas da rainha em algumas casas
    if (r() < 0.3) flags.addBanner(null, new THREE.Vector3(x - bw * 0.25, base + h * 0.62, z + dz * (bd / 2 + 0.06)), 1.1, 2.2, dz > 0 ? 0 : Math.PI);
    physics.addBox(x, base + (h + rh) / 2 - 0.5, z, bw, h + rh + 1, bd);
    houses.push({ x, z, w: bw, d: bd });
  };

  // quarteirões: ruas em múltiplos de 24 m
  for (let bx = -168; bx <= 168; bx += 24) {
    for (let bz = -84; bz <= 168; bz += 24) {
      const cx = bx + 12, cz = bz + 12;
      if (Math.hypot(cx, cz) > 168) continue;
      for (const [qx, qz] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) {
        if (r() < 0.22) continue;
        const x = cx + qx + (r() - 0.5) * 0.8, z = cz + qz + (r() - 0.5) * 0.8;
        const w = 5 + r() * 2.4, d = 5 + r() * 2.4, h = 3.8 + r() * 3.4;
        if (isReserved(x, z, 4) || inForest(x, z)) continue;
        addHouse(x, z, w, d, h, r() < 0.5);
      }
    }
  }

  // Avenida da Glória: estátuas e bandeiras
  const statues = [];
  for (let i = 0; i < 4; i++) {
    const z = -50 - i * 14;
    for (const s of [-1, 1]) {
      const st = buildStatue(ctx, { x: s * 13, y: heightAt(s * 13, z), z, scale: 2.6, variant: 'marble', rotY: (s * -Math.PI) / 2 });
      statues.push(st);
    }
  }
  for (let z = -40; z >= -132; z -= 10) {
    for (const s of [-1, 1]) {
      const x = s * 9.5;
      addFlagPole(B, flags, x, heightAt(x, z), z, 8, 2.6, 1.7);
      physics.addCylinder(x, z, 0.4, -50, 50);
    }
  }
  // estátuas que guardam o portão do castelo
  const gate = [];
  for (const s of [-1, 1]) gate.push(buildStatue(ctx, { x: s * 15, y: HILL_H, z: -145, scale: 4.5, variant: 'marble' }));
  // obra inacabada do Mestre Escultorius (o 347º busto)
  const wip = new THREE.Group();
  B.add('marble', new THREE.BoxGeometry(2.2, 2.6, 2.2), { pos: [21, heightAt(21, -60) + 1.3, -60], color: 0xf2eee6 });
  B.add('wood', new THREE.BoxGeometry(3.2, 0.2, 0.2), { pos: [21, heightAt(21, -60) + 3.2, -61.2] });
  physics.addBox(21, heightAt(21, -60) + 1.3, -60, 2.2, 2.6, 2.2);
  group.add(wip);

  B.build(group);
  return { houses, avenueStatues: statues, gateStatues: gate };
}

export function inForest(x, z) {
  return Math.hypot(x - LAYOUT.forest.x, z - LAYOUT.forest.z) < LAYOUT.forest.r;
}
