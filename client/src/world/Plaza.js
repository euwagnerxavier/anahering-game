import * as THREE from 'three';
import { Batcher, canvasTexture, escapeHtml } from '../core/utils.js';
import { LAYOUT } from './layout.js';
import { buildStatue } from './Statue.js';
import { addFlagPole } from './Flags.js';
import { drawCrest } from './Materials.js';

/** Praça da Soberana: colosso dourado, fonte, púlpito, Mural de Lealdade e mercado. */
export function buildPlaza(ctx) {
  const { scene, physics, materials, flags } = ctx;
  const { r } = LAYOUT.plaza;
  const B = new Batcher(materials);
  const group = new THREE.Group();
  group.name = 'plaza';
  scene.add(group);

  // piso de pedra
  const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 64), materials.cobble.clone());
  floor.material.vertexColors = false;
  floor.material.map = materials.cobble.map.clone();
  floor.material.map.repeat.set(26, 26);
  floor.material.map.needsUpdate = true;
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  floor.receiveShadow = true;
  group.add(floor);
  // anel dourado e mosaico
  B.add('gold', new THREE.TorusGeometry(r, 0.25, 6, 96), { pos: [0, 0.05, 0], rot: [Math.PI / 2, 0, 0] });
  B.add('marble', new THREE.RingGeometry(14, 16, 64), { pos: [0, 0.06, 0], rot: [-Math.PI / 2, 0, 0] });
  // avenida de pedra até o castelo
  const av = LAYOUT.avenue;
  const aveMat = materials.cobble.clone();
  aveMat.vertexColors = false;
  aveMat.map = materials.cobble.map.clone();
  aveMat.map.repeat.set(2, 34);
  aveMat.map.needsUpdate = true;
  const aveGeo = new THREE.PlaneGeometry(av.halfWidth * 2, 1, 1, 60);
  aveGeo.rotateX(-Math.PI / 2);
  const ap = aveGeo.attributes.position;
  for (let i = 0; i < ap.count; i++) {
    const z = av.z0 + (ap.getZ(i) + 0.5) * (av.z1 - av.z0);
    ap.setZ(i, z);
    ap.setY(i, ctx.heightAt(ap.getX(i), z) + 0.06);
  }
  aveGeo.computeVertexNormals();
  const avenue = new THREE.Mesh(aveGeo, aveMat);
  avenue.receiveShadow = true;
  group.add(avenue);

  // fonte + colosso
  B.add('marble', new THREE.CylinderGeometry(10, 10.4, 1.1, 48, 1, true), { pos: [0, 0.55, 0] });
  B.add('marble', new THREE.TorusGeometry(10.2, 0.35, 8, 64), { pos: [0, 1.1, 0], rot: [Math.PI / 2, 0, 0] });
  const water = new THREE.Mesh(new THREE.CircleGeometry(10, 48), materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.85;
  group.add(water);
  physics.addCylinder(0, 0, 10.6, -1, 1.1 + 0.6);
  // o colosso encara o sul, de onde chegam os súditos
  const colossus = buildStatue(ctx, { x: 0, y: 0.8, z: 0, scale: 9.5, variant: 'gold', pedestalH: 4.5 });

  // púlpito de discursos (norte da praça, voltado para o sul)
  const P = LAYOUT.podium;
  B.add('marble', new THREE.CylinderGeometry(3.4, 3.6, 0.5, 24), { pos: [P.x, 0.25, P.z] });
  B.add('marble', new THREE.CylinderGeometry(2.6, 2.6, 1.0, 24), { pos: [P.x, 0.5, P.z] });
  B.add('gold', new THREE.TorusGeometry(2.62, 0.08, 6, 32), { pos: [P.x, 1.0, P.z], rot: [Math.PI / 2, 0, 0] });
  B.add('purple', new THREE.BoxGeometry(1.3, 1.2, 0.6), { pos: [P.x, 1.6, P.z + 1.6] });
  B.add('gold', new THREE.BoxGeometry(1.5, 0.12, 0.8), { pos: [P.x, 2.25, P.z + 1.6], rot: [-0.25, 0, 0] });
  physics.addCylinder(P.x, P.z, 3.6, -1, 0.5);
  physics.addCylinder(P.x, P.z, 2.6, -1, 1.0);
  physics.addBox(P.x, 1.5, P.z + 1.6, 1.4, 1.4, 0.7);
  // cortina e estandartes atrás do púlpito
  for (const s of [-1, 1]) {
    B.add('gold', new THREE.CylinderGeometry(0.12, 0.12, 7, 8), { pos: [P.x + s * 3, 3.5, P.z - 1.8] });
    flags.addBanner(null, new THREE.Vector3(P.x + s * 1.5, 4.4, P.z - 1.8), 2.6, 5, 0);
  }

  // mastros em anel
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    addFlagPole(B, flags, Math.cos(a) * (r - 2), 0, Math.sin(a) * (r - 2), 11);
  }
  // postes de luz e bancos
  const lanterns = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * 20, z = Math.sin(a) * 20;
    B.add('stoneDark', new THREE.CylinderGeometry(0.1, 0.14, 4, 8), { pos: [x, 2, z] });
    B.add('glass', new THREE.SphereGeometry(0.35, 10, 8), { pos: [x, 4.2, z], color: 0xffd27a });
    physics.addCylinder(x, z, 0.25, -1, 4);
    const ba = a + Math.PI / 8;
    const bx = Math.cos(ba) * 22, bz = Math.sin(ba) * 22;
    B.add('wood', new THREE.BoxGeometry(2.4, 0.15, 0.6), { pos: [bx, 0.55, bz], rot: [0, -ba + Math.PI / 2, 0] });
    B.add('wood', new THREE.BoxGeometry(2.4, 0.6, 0.12), { pos: [bx + Math.cos(ba) * 0.3, 0.9, bz + Math.sin(ba) * 0.3], rot: [0, -ba + Math.PI / 2, 0] });
    lanterns.push([x, z]);
  }
  // canteiros de flores (instanciados depois em Nature) — marcamos posições
  ctx.flowerBeds.push({ x: 0, z: 0, r0: 16.5, r1: 19, count: 260 });

  // MURAL DE LEALDADE
  const M = LAYOUT.mural;
  const muralCanvas = document.createElement('canvas');
  muralCanvas.width = 1024;
  muralCanvas.height = 640;
  const muralTex = new THREE.CanvasTexture(muralCanvas);
  muralTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshStandardMaterial({ map: muralTex, roughness: 0.8, emissive: 0xffffff, emissiveMap: muralTex, emissiveIntensity: 0.25 }));
  board.position.set(M.x + 0.2, 3.6, M.z);
  board.rotation.y = Math.PI / 2;
  group.add(board);
  B.add('wood', new THREE.BoxGeometry(0.3, 6.6, 8.8), { pos: [M.x - 0.05, 3.3, M.z] });
  B.add('gold', new THREE.BoxGeometry(0.4, 0.4, 9.2), { pos: [M.x, 6.3, M.z] });
  B.add('gold', new THREE.BoxGeometry(0.4, 0.3, 9.2), { pos: [M.x, 1.0, M.z] });
  physics.addBox(M.x - 0.05, 3.3, M.z, 0.6, 6.6, 8.8);
  const drawMural = (decrees = []) => {
    const c = muralCanvas.getContext('2d');
    const w = muralCanvas.width, h = muralCanvas.height;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f6ead0');
    g.addColorStop(1, '#e6d3a8');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#8a5a12';
    c.lineWidth = 14;
    c.strokeRect(10, 10, w - 20, h - 20);
    drawCrest(c, 90, 90, 50, { bg: '#5b1f7a' });
    drawCrest(c, w - 90, 90, 50, { bg: '#5b1f7a' });
    c.fillStyle = '#5b1f7a';
    c.textAlign = 'center';
    c.font = 'bold 64px Georgia, serif';
    c.fillText('MURAL DE LEALDADE', w / 2, 96);
    c.font = 'italic 26px Georgia, serif';
    c.fillStyle = '#7a5310';
    c.fillText('Decretos Reais emitidos por Vossas Majestades de todas as realidades', w / 2, 140);
    c.textAlign = 'left';
    const list = decrees.slice(0, 6);
    if (!list.length) {
      c.font = 'italic 32px Georgia, serif';
      c.fillStyle = '#6b5a40';
      c.fillText('Nenhum decreto ainda. O reino aguarda a vontade da Rainha.', 70, 300);
    }
    list.forEach((d, i) => {
      const y = 200 + i * 72;
      c.fillStyle = '#9e1b32';
      c.font = 'bold 26px Georgia, serif';
      c.fillText(`⚜ ${d.author}:`, 60, y);
      c.fillStyle = '#2b1c08';
      c.font = '26px Georgia, serif';
      wrap(c, `“${d.text}”`, 60, y + 32, w - 120, 30, 1);
    });
    muralTex.needsUpdate = true;
  };
  drawMural([]);

  // mercado (barracas listradas)
  const mk = LAYOUT.market;
  const awnTex = canvasTexture(64, 64, (c, w, h) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#f2c14e' : '#9e1b32';
      c.fillRect((i * w) / 8, 0, w / 8, h);
    }
  });
  const awnMat = new THREE.MeshStandardMaterial({ map: awnTex, side: THREE.DoubleSide, roughness: 0.8 });
  const stalls = [];
  for (let i = 0; i < 6; i++) {
    const sx = mk.x + (i % 3) * 7 - 7, sz = mk.z + (i < 3 ? -7 : 7);
    B.add('wood', new THREE.BoxGeometry(4, 1, 2), { pos: [sx, 0.5, sz] });
    for (const [dx, dz] of [[-1.9, -0.9], [1.9, -0.9], [-1.9, 0.9], [1.9, 0.9]]) B.add('wood', new THREE.BoxGeometry(0.12, 2.6, 0.12), { pos: [sx + dx, 1.3, sz + dz] });
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.6), awnMat);
    awn.position.set(sx, 2.75, sz);
    awn.rotation.set(-Math.PI / 2 + (i < 3 ? 0.25 : -0.25), 0, 0);
    awn.castShadow = true;
    group.add(awn);
    // mercadorias
    const colors = [0xd9412b, 0xf2a93b, 0x7fb540, 0x9a5bd6];
    for (let k = 0; k < 5; k++) B.add('foliage', new THREE.IcosahedronGeometry(0.22, 0), { pos: [sx - 1.4 + k * 0.7, 1.15, sz], color: colors[(k + i) % 4] });
    physics.addBox(sx, 0.5, sz, 4, 1.2, 2);
    stalls.push([sx, sz]);
  }

  B.build(group);

  return {
    colossus,
    drawMural,
    podium: new THREE.Vector3(P.x, 1.0, P.z),
    muralPos: new THREE.Vector3(M.x + 1.5, 0, M.z),
    update(dt, t) {
      water.position.y = 0.85 + Math.sin(t * 1.3) * 0.03;
    },
  };
}

function wrap(c, text, x, y, maxW, lh, maxLines) {
  const words = text.split(' ');
  let line = '', lines = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (c.measureText(test + ' …').width > maxW && line) {
      if (++lines >= maxLines) {
        c.fillText(line + ' …', x, y);
        return;
      }
      c.fillText(line, x, y);
      y += lh;
      line = w;
    } else line = test;
  }
  c.fillText(line, x, y);
}

export { escapeHtml };
