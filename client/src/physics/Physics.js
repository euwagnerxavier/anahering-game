import * as THREE from 'three';

/**
 * Física cinemática (ADR-001): colisores estáticos AABB e cilindros + função de altura do terreno.
 * Topos de caixas servem de chão (degraus, plataformas, piso do castelo).
 */
export class Physics {
  constructor() {
    this.boxes = []; // {minX,maxX,minY,maxY,minZ,maxZ}
    this.cylinders = []; // {x,z,r,minY,maxY}
    this.heightAt = () => 0;
    this.stepHeight = 0.55;
    this.worldRadius = 212;
    // grade espacial para consultas rápidas
    this.cell = 16;
    this.grid = new Map();
  }

  setTerrain(fn) {
    this.heightAt = fn;
  }

  _key(ix, iz) {
    return ix * 73856093 ^ iz * 19349663;
  }
  _insert(obj, minX, maxX, minZ, maxZ) {
    const c = this.cell;
    for (let ix = Math.floor(minX / c); ix <= Math.floor(maxX / c); ix++)
      for (let iz = Math.floor(minZ / c); iz <= Math.floor(maxZ / c); iz++) {
        const k = this._key(ix, iz);
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(obj);
      }
  }
  /** Colisores próximos de (x,z) num raio. */
  query(x, z, r = 2) {
    const c = this.cell;
    const out = new Set();
    for (let ix = Math.floor((x - r) / c); ix <= Math.floor((x + r) / c); ix++)
      for (let iz = Math.floor((z - r) / c); iz <= Math.floor((z + r) / c); iz++) {
        const list = this.grid.get(this._key(ix, iz));
        if (list) for (const o of list) out.add(o);
      }
    return out;
  }

  /** Caixa alinhada aos eixos a partir de centro e tamanho. */
  addBox(cx, cy, cz, w, h, d) {
    const b = { type: 'box', minX: cx - w / 2, maxX: cx + w / 2, minY: cy - h / 2, maxY: cy + h / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
    this.boxes.push(b);
    this._insert(b, b.minX, b.maxX, b.minZ, b.maxZ);
    return b;
  }
  addCylinder(x, z, r, minY, maxY) {
    const c = { type: 'cyl', x, z, r, minY, maxY };
    this.cylinders.push(c);
    this._insert(c, x - r, x + r, z - r, z + r);
    return c;
  }

  /** Altura do chão sob (x,z) considerando topos de caixas alcançáveis a partir de `feetY`. */
  groundAt(x, z, feetY, radius = 0.35) {
    let g = this.heightAt(x, z);
    for (const o of this.query(x, z, radius)) {
      if (o.type === 'box') {
        if (x > o.minX - radius * 0.5 && x < o.maxX + radius * 0.5 && z > o.minZ - radius * 0.5 && z < o.maxZ + radius * 0.5) {
          if (o.maxY <= feetY + this.stepHeight && o.maxY > g) g = o.maxY;
        }
      } else if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + radius * 0.5) ** 2) {
        if (o.maxY <= feetY + this.stepHeight && o.maxY > g) g = o.maxY;
      }
    }
    return g;
  }

  /** Teto acima de `headY` (para não atravessar telhados ao pular). */
  ceilingAt(x, z, feetY, height, radius = 0.35) {
    let c = Infinity;
    for (const o of this.query(x, z, radius)) {
      const inside =
        o.type === 'box'
          ? x > o.minX && x < o.maxX && z > o.minZ && z < o.maxZ
          : (x - o.x) ** 2 + (z - o.z) ** 2 < o.r ** 2;
      if (inside && o.minY >= feetY + height - 0.3 && o.minY < c) c = o.minY;
    }
    return c;
  }

  /**
   * Empurra um cilindro vertical (personagem) para fora dos colisores. Modifica `pos` (pés).
   */
  resolve(pos, radius, height) {
    const feet = pos.y;
    const head = pos.y + height;
    for (let iter = 0; iter < 3; iter++) {
      for (const o of this.query(pos.x, pos.z, radius + 1)) {
        // ignora o que está abaixo dos pés (pisável) ou acima da cabeça
        if (o.maxY <= feet + this.stepHeight || o.minY >= head) continue;
        if (o.type === 'box') {
          const cx = Math.max(o.minX, Math.min(pos.x, o.maxX));
          const cz = Math.max(o.minZ, Math.min(pos.z, o.maxZ));
          const dx = pos.x - cx, dz = pos.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 < radius * radius) {
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2);
              pos.x += (dx / d) * (radius - d);
              pos.z += (dz / d) * (radius - d);
            } else {
              // centro dentro da caixa: sai pela face mais próxima
              const pens = [pos.x - o.minX, o.maxX - pos.x, pos.z - o.minZ, o.maxZ - pos.z];
              const m = Math.min(...pens);
              if (m === pens[0]) pos.x = o.minX - radius;
              else if (m === pens[1]) pos.x = o.maxX + radius;
              else if (m === pens[2]) pos.z = o.minZ - radius;
              else pos.z = o.maxZ + radius;
            }
          }
        } else {
          const dx = pos.x - o.x, dz = pos.z - o.z;
          const d = Math.hypot(dx, dz);
          const min = o.r + radius;
          if (d < min) {
            if (d < 1e-6) pos.x += min;
            else {
              pos.x = o.x + (dx / d) * min;
              pos.z = o.z + (dz / d) * min;
            }
          }
        }
      }
    }
    // limite do mundo
    const r = Math.hypot(pos.x, pos.z);
    if (r > this.worldRadius) {
      pos.x *= this.worldRadius / r;
      pos.z *= this.worldRadius / r;
    }
  }

  /** Um ponto está dentro de algum colisor sólido? (usado pela câmera) */
  pointBlocked(p) {
    if (p.y < this.heightAt(p.x, p.z) + 0.2) return true;
    for (const o of this.query(p.x, p.z, 0.3)) {
      if (p.y < o.minY || p.y > o.maxY) continue;
      if (o.type === 'box') {
        if (p.x > o.minX && p.x < o.maxX && p.z > o.minZ && p.z < o.maxZ) return true;
      } else if ((p.x - o.x) ** 2 + (p.z - o.z) ** 2 < o.r * o.r) return true;
    }
    return false;
  }

  /** Malhas wireframe para depuração (?debug). */
  debugMeshes() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
    for (const b of this.boxes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ), mat);
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      g.add(m);
    }
    for (const c of this.cylinders) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.maxY - c.minY, 12), mat);
      m.position.set(c.x, (c.minY + c.maxY) / 2, c.z);
      g.add(m);
    }
    return g;
  }
}
