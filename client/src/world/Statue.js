import * as THREE from 'three';
import { QueenModel, bakeStatic } from '../entities/QueenModel.js';
import { PALETTE } from './Materials.js';
import { canvasTexture } from '../core/utils.js';

let statueMats = null;
function getMats(materials) {
  if (statueMats) return statueMats;
  statueMats = {
    marble: new THREE.MeshStandardMaterial({ map: materials.marble.map, color: 0xf6f2ea, roughness: 0.35 }),
    gold: new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 1, roughness: 0.22, emissive: 0x4a3208, emissiveIntensity: 0.35 }),
    plaque: new THREE.MeshStandardMaterial({
      map: canvasTexture(512, 128, (ctx, w, h) => {
        ctx.fillStyle = '#c9932b';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#7a5310';
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, w - 12, h - 12);
        ctx.fillStyle = '#3a2405';
        ctx.textAlign = 'center';
        ctx.font = 'bold 46px Georgia, serif';
        ctx.fillText('ANA HERING', w / 2, 58);
        ctx.font = 'italic 26px Georgia, serif';
        ctx.fillText('Rainha Absoluta · Eterna · Incontestável', w / 2, 100);
      }),
      metalness: 0.6,
      roughness: 0.4,
    }),
  };
  // geometria-base de cada variante, construída uma única vez e reaproveitada
  statueMats.geo = {};
  for (const v of ['marble', 'gold']) {
    const model = new QueenModel({ variant: v, materials: { marble: statueMats.marble, gold: statueMats.gold } });
    // pose solene: cetro erguido
    model.arms[1].shoulder.rotation.x = -1.2;
    model.arms[1].elbow.rotation.x = -0.6;
    model.arms[0].shoulder.rotation.z = -0.25;
    model.head.rotation.x = -0.12;
    statueMats.geo[v] = bakeStatic(model.root, statueMats[v]).geometry;
  }
  return statueMats;
}

/**
 * Estátua da rainha sobre pedestal.
 * @returns {{ position: THREE.Vector3, height: number, group: THREE.Group }}
 */
export function buildStatue({ scene, physics, materials }, { x, y, z, scale = 3, variant = 'marble', rotY = 0, pedestalH = null }) {
  const S = getMats(materials);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotY;
  const ph = pedestalH ?? Math.max(1.2, scale * 0.45);
  const pr = Math.max(0.9, scale * 0.42);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr * 1.12, ph, 8), S.marble);
  ped.position.y = ph / 2;
  ped.castShadow = ped.receiveShadow = true;
  group.add(ped);
  const trim = new THREE.Mesh(new THREE.CylinderGeometry(pr * 1.06, pr * 1.06, ph * 0.08, 8), S.gold);
  trim.position.y = ph - ph * 0.04;
  group.add(trim);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(pr * 1.1, pr * 0.28), S.plaque);
  plaque.position.set(0, ph * 0.55, pr * 1.04);
  group.add(plaque);

  const mesh = new THREE.Mesh(S.geo[variant], S[variant]);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.scale.setScalar(scale);
  mesh.position.y = ph;
  group.add(mesh);
  scene.add(group);

  physics.addCylinder(x, z, pr * 1.12, y - 1, y + ph + scale * 2.2);
  return { position: new THREE.Vector3(x, y, z), height: ph + scale * 2.3, group };
}
