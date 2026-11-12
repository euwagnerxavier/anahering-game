import * as THREE from 'three';
import { rng } from '../core/utils.js';
import { LAYOUT } from './layout.js';
import { isReserved, inForest } from './City.js';

/** Árvores, pinheiros, pedras e flores com InstancedMesh. */
export function buildNature(ctx) {
  const { scene, physics, heightAt, flowerBeds } = ctx;
  const r = rng(555);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  const blocked = (x, z, rad) => {
    for (const o of physics.query(x, z, rad + 1)) {
      if (o.type === 'box') {
        if (x > o.minX - rad && x < o.maxX + rad && z > o.minZ - rad && z < o.maxZ + rad) return true;
      } else if (Math.hypot(x - o.x, z - o.z) < o.r + rad) return true;
    }
    return false;
  };

  const spots = [];
  const tryAdd = (x, z, kind, minGap = 2.2) => {
    const R = Math.hypot(x, z);
    if (R > 235) return;
    if (isReserved(x, z, 0) && !(z < -92 && Math.abs(x) > 50)) return; // colina: só nas laterais
    if (Math.hypot(x - LAYOUT.hiddenStatue.x, z - LAYOUT.hiddenStatue.z) < 12) return;
    if (z < -92 && Math.abs(x) < 46 && z > -215) return; // pátio do castelo livre
    if (Math.abs(x) < 6 && z < -92) return;
    if (blocked(x, z, minGap)) return;
    const h = heightAt(x, z);
    if (h > 60) return;
    spots.push({ x, z, y: h, kind });
    physics.addCylinder(x, z, kind === 'rock' ? 0.9 : 0.45, h - 1, h + 6);
  };

  // Bosque dos Bajuladores (denso)
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * LAYOUT.forest.r;
    tryAdd(LAYOUT.forest.x + Math.cos(a) * d, LAYOUT.forest.z + Math.sin(a) * d, r() < 0.45 ? 'pine' : 'tree');
  }
  // anel externo e colinas
  for (let i = 0; i < 700; i++) {
    const a = r() * Math.PI * 2, d = 150 + r() * 80;
    tryAdd(Math.cos(a) * d, Math.sin(a) * d, r() < 0.6 ? 'pine' : 'tree');
  }
  // espalhadas pela cidade e arredores do lago
  for (let i = 0; i < 260; i++) {
    const x = (r() - 0.5) * 300, z = -90 + r() * 240;
    if (!inForest(x, z)) tryAdd(x, z, r() < 0.15 ? 'rock' : 'tree', 3);
  }
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = LAYOUT.lake.r + 8 + r() * 14;
    tryAdd(LAYOUT.lake.x + Math.cos(a) * d, LAYOUT.lake.z + Math.sin(a) * d, r() < 0.3 ? 'rock' : 'tree');
  }

  const trees = spots.filter((s) => s.kind === 'tree');
  const pines = spots.filter((s) => s.kind === 'pine');
  const rocks = spots.filter((s) => s.kind === 'rock');

  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b8478, roughness: 0.95, flatShading: true });

  const inst = (geo, mat, list, setup) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, i) => {
      setup(s, i, dummy);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (m.instanceColor !== undefined) {
        /* cores definidas no setup */
      }
    });
    m.castShadow = true;
    m.receiveShadow = true;
    m.instanceMatrix.needsUpdate = true;
    scene.add(m);
    return m;
  };

  // árvores redondas
  const sc = trees.map(() => 0.8 + r() * 0.7);
  inst(new THREE.CylinderGeometry(0.22, 0.32, 3, 6).translate(0, 1.5, 0), barkMat, trees, (s, i, o) => {
    o.position.set(s.x, s.y - 0.2, s.z);
    o.scale.setScalar(sc[i]);
    o.rotation.set(0, 0, 0);
  });
  const leaves = inst(new THREE.IcosahedronGeometry(1.9, 1).translate(0, 4.1, 0), leafMat, trees, (s, i, o) => {
    o.position.set(s.x, s.y - 0.2, s.z);
    o.scale.set(sc[i], sc[i] * (0.9 + r() * 0.3), sc[i]);
    o.rotation.set(0, r() * 6, 0);
  });
  trees.forEach((_, i) => leaves.setColorAt(i, col.setHSL(0.25 + r() * 0.08, 0.5, 0.3 + r() * 0.1)));

  // pinheiros
  const ps = pines.map(() => 0.9 + r() * 0.8);
  inst(new THREE.CylinderGeometry(0.2, 0.3, 2, 6).translate(0, 1, 0), barkMat, pines, (s, i, o) => {
    o.position.set(s.x, s.y - 0.2, s.z);
    o.scale.setScalar(ps[i]);
  });
  const pineGeo = (() => {
    const a = new THREE.ConeGeometry(2.2, 3.4, 8).translate(0, 3.2, 0);
    const b = new THREE.ConeGeometry(1.7, 3, 8).translate(0, 4.9, 0);
    const c = new THREE.ConeGeometry(1.1, 2.4, 8).translate(0, 6.4, 0);
    const g = new THREE.BufferGeometry();
    const parts = [a, b, c].map((x) => x.toNonIndexed());
    const pos = [], nor = [];
    for (const p of parts) {
      pos.push(...p.attributes.position.array);
      nor.push(...p.attributes.normal.array);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  })();
  const pineLeaves = inst(pineGeo, leafMat, pines, (s, i, o) => {
    o.position.set(s.x, s.y - 0.2, s.z);
    o.scale.setScalar(ps[i]);
    o.rotation.set(0, r() * 6, 0);
  });
  pines.forEach((_, i) => pineLeaves.setColorAt(i, col.setHSL(0.33 + r() * 0.05, 0.45, 0.2 + r() * 0.07)));

  // pedras
  inst(new THREE.DodecahedronGeometry(1, 0), rockMat, rocks, (s, i, o) => {
    o.position.set(s.x, s.y + 0.2, s.z);
    o.scale.set(0.8 + r(), 0.6 + r() * 0.6, 0.8 + r());
    o.rotation.set(r(), r() * 6, r());
  });

  // flores nos canteiros
  const flowers = [];
  for (const bed of flowerBeds) {
    for (let i = 0; i < bed.count; i++) {
      const a = r() * Math.PI * 2, d = bed.r0 + r() * (bed.r1 - bed.r0);
      flowers.push({ x: bed.x + Math.cos(a) * d, z: bed.z + Math.sin(a) * d });
    }
  }
  // e flores silvestres pelo campo
  for (let i = 0; i < 900; i++) {
    const x = (r() - 0.5) * 380, z = (r() - 0.5) * 380;
    if (!isReserved(x, z) && Math.hypot(x, z) < 190 && !blocked(x, z, 0.5)) flowers.push({ x, z });
  }
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x220011, flatShading: true });
  const fm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0).translate(0, 0.25, 0), flowerMat, flowers.length);
  const fcol = [0xff4d6d, 0xffc93c, 0xf8f8ff, 0xb46bff, 0xff8fab];
  flowers.forEach((f, i) => {
    dummy.position.set(f.x, heightAt(f.x, f.z), f.z);
    dummy.scale.setScalar(0.8 + r() * 0.6);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    fm.setMatrixAt(i, dummy.matrix);
    fm.setColorAt(i, col.set(fcol[i % fcol.length]));
  });
  scene.add(fm);

  return { treeCount: spots.length };
}
