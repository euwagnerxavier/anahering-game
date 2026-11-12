import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Material único com cores por vértice para todos os NPCs. */
let MAT = null;
const material = () =>
  (MAT ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }));

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Acumula partes coloridas e funde num único BufferGeometry. */
class Parts {
  constructor() {
    this.list = [];
  }
  add(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
    const g = geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scale));
    g.applyMatrix4(_m);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.list.push(g);
    return this;
  }
  build() {
    const g = mergeGeometries(this.list, false);
    this.list.forEach((x) => x.dispose());
    return g;
  }
}

// geometrias compartilhadas
const G = {
  tunic: new THREE.CylinderGeometry(0.2, 0.3, 0.62, 10),
  dress: new THREE.CylinderGeometry(0.2, 0.42, 0.95, 12),
  chest: new THREE.CylinderGeometry(0.21, 0.2, 0.42, 10),
  head: new THREE.SphereGeometry(0.15, 12, 10),
  eye: new THREE.SphereGeometry(0.018, 6, 4),
  limb: new THREE.CylinderGeometry(0.055, 0.05, 0.5, 6),
  leg: new THREE.CylinderGeometry(0.07, 0.065, 0.55, 6),
  hand: new THREE.SphereGeometry(0.05, 6, 5),
  shoe: new THREE.BoxGeometry(0.11, 0.07, 0.2),
  belt: new THREE.TorusGeometry(0.21, 0.025, 4, 14),
};

/**
 * Constrói um NPC low-poly. Retorna { root, torso, arms:[L,R], legs:[L,R] }.
 * look: { tunic, trim, skin, hat, hatColor, height, dress, trumpet, chain, bag, chisel, cane, spear, helmet }
 */
export function buildNPCModel(look) {
  const root = new THREE.Group();
  const scale = look.height ?? 1;
  const inner = new THREE.Group();
  inner.scale.setScalar(scale);
  root.add(inner);
  const mat = material();

  // pernas
  const legs = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.1 * s, 0.58, 0);
    const p = new Parts().add(G.leg, look.dress ? look.tunic : 0x3b2f2a, [0, -0.27, 0]).add(G.shoe, 0x2a1d14, [0, -0.54, 0.04]);
    const m = new THREE.Mesh(p.build(), mat);
    m.castShadow = true;
    pivot.add(m);
    inner.add(pivot);
    legs.push(pivot);
  }

  // tronco (pivot no quadril para reverências)
  const torso = new THREE.Group();
  torso.position.y = 0.58;
  inner.add(torso);
  const T = new Parts();
  if (look.dress) T.add(G.dress, look.tunic, [0, -0.08, 0]);
  else T.add(G.tunic, look.tunic, [0, 0.12, 0]);
  T.add(G.chest, look.tunic, [0, 0.58, 0]);
  T.add(G.belt, look.trim ?? 0x6b4426, [0, 0.38, 0], [Math.PI / 2, 0, 0]);
  T.add(G.head, look.skin, [0, 1.0, 0]);
  for (const s of [-1, 1]) T.add(G.eye, 0x1a1210, [0.05 * s, 1.02, 0.135]);
  // chapéus
  const hc = look.hatColor ?? 0x6b4426;
  switch (look.hat) {
    case 'cap':
      T.add(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hc, [0, 1.04, 0]);
      break;
    case 'beret':
      T.add(new THREE.CylinderGeometry(0.19, 0.16, 0.07, 12), hc, [0.03, 1.14, 0], [0, 0, 0.2]);
      break;
    case 'hood':
      T.add(new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), hc, [0, 1.02, -0.02], [-0.3, 0, 0]);
      break;
    case 'straw':
      T.add(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 14), 0xd9b45a, [0, 1.11, 0]);
      T.add(new THREE.CylinderGeometry(0.13, 0.15, 0.12, 10), 0xd9b45a, [0, 1.17, 0]);
      break;
    case 'bun':
      T.add(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hc, [0, 1.02, -0.01]);
      T.add(new THREE.SphereGeometry(0.07, 8, 6), hc, [0, 1.12, -0.12]);
      break;
    case 'tall':
      T.add(new THREE.CylinderGeometry(0.14, 0.15, 0.45, 12), hc, [0, 1.32, 0]);
      T.add(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 14), hc, [0, 1.11, 0]);
      T.add(new THREE.CylinderGeometry(0.145, 0.145, 0.05, 12), 0xf2c14e, [0, 1.15, 0]);
      break;
    case 'feather':
      T.add(new THREE.CylinderGeometry(0.2, 0.18, 0.08, 12), hc, [0, 1.12, 0], [0, 0, -0.15]);
      T.add(new THREE.ConeGeometry(0.04, 0.45, 5), 0xfff4d0, [-0.12, 1.33, -0.05], [0.3, 0, 0.5]);
      break;
    case 'wig':
      for (const [x, y, z, r] of [[0, 1.13, -0.02, 0.17], [-0.15, 1.0, -0.02, 0.11], [0.15, 1.0, -0.02, 0.11], [-0.16, 0.86, -0.02, 0.09], [0.16, 0.86, -0.02, 0.09], [0, 1.0, -0.12, 0.15]])
        T.add(new THREE.SphereGeometry(r, 8, 6), hc, [x, y, z]);
      break;
    case 'helmet':
      T.add(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xb8bcc4, [0, 1.03, 0]);
      T.add(new THREE.ConeGeometry(0.03, 0.18, 5), 0x9e1b32, [0, 1.25, 0]);
      break;
    default:
      T.add(new THREE.SphereGeometry(0.155, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), hc, [0, 1.02, -0.01], [-0.3, 0, 0]);
  }
  if (look.chain) T.add(new THREE.TorusGeometry(0.17, 0.02, 4, 16), 0xf2c14e, [0, 0.72, 0.04], [Math.PI / 2.6, 0, 0]);
  if (look.bag) T.add(new THREE.SphereGeometry(0.16, 8, 6), 0xc9932b, [0.28, 0.25, 0.1], [0, 0, 0], [1, 1.2, 1]);
  if (look.tabard ?? false) T.add(new THREE.BoxGeometry(0.3, 0.5, 0.02), look.trim, [0, 0.45, 0.21]);
  const torsoMesh = new THREE.Mesh(T.build(), mat);
  torsoMesh.castShadow = true;
  torso.add(torsoMesh);

  // braços
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.27 * s, 0.76, 0);
    const A = new Parts().add(G.limb, look.tunic, [0, -0.24, 0]).add(G.hand, look.skin, [0, -0.5, 0]);
    if (s === 1 && look.trumpet) {
      A.add(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), 0xf2c14e, [0, -0.5, 0.28], [Math.PI / 2, 0, 0]);
      A.add(new THREE.ConeGeometry(0.1, 0.18, 10, 1, true), 0xf2c14e, [0, -0.5, 0.62], [-Math.PI / 2, 0, 0]);
    }
    if (s === 1 && look.chisel) A.add(new THREE.BoxGeometry(0.04, 0.04, 0.3), 0x9a9aa0, [0, -0.52, 0.14]);
    if (s === 1 && look.cane) A.add(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 6), 0x5a3a20, [0, -0.85, 0.08]);
    if (s === 1 && look.spear) {
      A.add(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6), 0x5a3a20, [0, -0.3, 0.06]);
      A.add(new THREE.ConeGeometry(0.06, 0.25, 6), 0xd0d4dc, [0, 0.98, 0.06]);
      A.add(new THREE.BoxGeometry(0.3, 0.4, 0.02), 0x5b1f7a, [0.16, 0.6, 0.06]);
    }
    const m = new THREE.Mesh(A.build(), mat);
    m.castShadow = true;
    pivot.add(m);
    torso.add(pivot);
    arms.push(pivot);
  }
  return { root, inner, torso, arms, legs, height: 1.25 * scale };
}
