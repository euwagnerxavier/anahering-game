import * as THREE from 'three';
import { makeNoise, smoothstep } from '../core/utils.js';
import { HILL_H, LAYOUT } from './layout.js';

const noise = makeNoise(42);

/** Altura analítica do terreno — usada pela malha e pela física. */
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  // ondulações suaves
  let h = noise(x * 0.02, z * 0.02) * 1.6 + noise(x * 0.06, z * 0.06) * 0.4;
  // áreas urbanas achatadas
  const flat = 1 - smoothstep(150, 185, r);
  h *= 1 - flat * 0.75;
  // praça perfeitamente plana
  const pr = Math.hypot(x - LAYOUT.plaza.x, z - LAYOUT.plaza.z);
  h *= smoothstep(LAYOUT.plaza.r, LAYOUT.plaza.r + 14, pr);
  // avenida plana
  if (z < -30 && z > -140) h *= smoothstep(LAYOUT.avenue.halfWidth, LAYOUT.avenue.halfWidth + 10, Math.abs(x));
  // Colina Real (planalto do castelo)
  const hill = smoothstep(-100, -136, z) * (1 - smoothstep(78, 112, Math.abs(x))) * (1 - smoothstep(236, 260, -z));
  h = h * (1 - hill) + HILL_H * hill;
  // lago
  const lr = Math.hypot(x - LAYOUT.lake.x, z - LAYOUT.lake.z);
  h -= 3.2 * (1 - smoothstep(LAYOUT.lake.r - 8, LAYOUT.lake.r + 4, lr));
  // montanhas na borda do reino
  const m = smoothstep(195, 290, r);
  h += m * (55 + noise(x * 0.015, z * 0.015) * 35) * (1 - hill);
  return h;
}

/** Cor do terreno por região (grama, caminhos de terra, pedra). */
function terrainColor(x, z, h, out) {
  const r = Math.hypot(x, z);
  const n = noise(x * 0.1 + 100, z * 0.1);
  const grass = new THREE.Color().setHSL(0.26 + n * 0.03, 0.5, 0.27 + n * 0.05);
  const dirt = new THREE.Color(0x9b8263);
  const rock = new THREE.Color(0x7d7468);
  out.copy(grass);
  // trilhas de terra nas ruas da cidade
  const sx = Math.abs(((x + 12) % 24 + 24) % 24 - 12), sz = Math.abs(((z + 12) % 24 + 24) % 24 - 12);
  if (r < 165 && (sx < 3.2 || sz < 3.2) && z > -100) out.lerp(dirt, 0.7);
  // rocha nas montanhas
  out.lerp(rock, smoothstep(205, 250, r));
  // areia perto do lago
  const lr = Math.hypot(x - LAYOUT.lake.x, z - LAYOUT.lake.z);
  if (lr < LAYOUT.lake.r + 6) out.lerp(new THREE.Color(0xcdb98a), 1 - smoothstep(LAYOUT.lake.r, LAYOUT.lake.r + 6, lr));
  // neve nos picos
  if (h > 70) out.lerp(new THREE.Color(0xf5f5f8), smoothstep(70, 85, h));
  return out;
}

export function buildTerrain({ scene, physics, materials }) {
  const size = 620, seg = 248;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    terrainColor(x, z, h, c).toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, materials.grass);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);

  // água do lago
  const water = new THREE.Mesh(new THREE.CircleGeometry(LAYOUT.lake.r + 2, 48), materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(LAYOUT.lake.x, -0.9, LAYOUT.lake.z);
  scene.add(water);
  // o lago é bloqueado (a rainha não molha o vestido)
  physics.addCylinder(LAYOUT.lake.x, LAYOUT.lake.z, LAYOUT.lake.r - 3, -10, 3);

  physics.setTerrain(terrainHeight);
  return {
    update(dt, t) {
      water.position.y = -0.9 + Math.sin(t * 0.8) * 0.04;
    },
  };
}
