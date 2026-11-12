import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Interpolação exponencial independente de framerate. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export function dampAngle(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

/** RNG determinística (mulberry32), para o reino ser igual para todos. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

/** Value noise 2D suave (para terreno). */
export function makeNoise(seed = 7) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256).map(() => r() * 2 - 1);
  const v = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), w);
  };
}

/** Cria textura a partir de um canvas desenhado por `draw(ctx, w, h)`. */
export function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Prisma triangular (telhado de duas águas), base centrada na origem, cumeeira ao longo de X. */
export function prismGeometry(w, h, d) {
  const hw = w / 2, hd = d / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hd, 0);
  shape.lineTo(hd, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-hw, 0, 0);
  // ExtrudeGeometry não é indexada; indexamos para combinar com primitivas.
  return toIndexed(g);
}

export function toIndexed(g) {
  if (g.index) return g;
  const count = g.attributes.position.count;
  const idx = new Uint32Array(count);
  for (let i = 0; i < count; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * Agrupa geometrias por material e funde num único Mesh por material (menos draw calls).
 */
export class Batcher {
  constructor(materials) {
    this.materials = materials; // { key: Material }
    this.buckets = new Map();
  }
  /**
   * @param {string} key  chave do material
   * @param {THREE.BufferGeometry} geo
   * @param {{pos?:number[], rot?:number[], scale?:number[], color?:number|THREE.Color}} t
   */
  add(key, geo, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], color = 0xffffff } = {}) {
    const g = toIndexed(geo.index ? geo.clone() : geo);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.morphAttributes = {};
    g.clearGroups();
    _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scale));
    g.applyMatrix4(_m);
    const col = color instanceof THREE.Color ? color : new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(arr, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!this.buckets.has(key)) this.buckets.set(key, []);
    this.buckets.get(key).push(g);
    return g;
  }
  /** Gera os Meshes e os adiciona em `parent`. */
  build(parent, { castShadow = true, receiveShadow = true } = {}) {
    const meshes = {};
    for (const [key, list] of this.buckets) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this.materials[key]);
      mesh.castShadow = castShadow && !this.materials[key].userData.noShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.name = `batch:${key}`;
      parent.add(mesh);
      meshes[key] = mesh;
    }
    this.buckets.clear();
    return meshes;
  }
}

export function $(sel) {
  return document.querySelector(sel);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
