import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../world/Materials.js';
import { damp, lerp } from '../core/utils.js';

const V = (x, y) => new THREE.Vector2(x, y);

function makeMaterials(variant, shared) {
  if (variant === 'marble' || variant === 'gold' || variant === 'ghost') {
    let m;
    if (variant === 'marble') m = shared?.marble ?? new THREE.MeshStandardMaterial({ color: PALETTE.marble, roughness: 0.4 });
    else if (variant === 'gold') m = shared?.gold ?? new THREE.MeshStandardMaterial({ color: PALETTE.gold, metalness: 1, roughness: 0.3 });
    else
      m = new THREE.MeshStandardMaterial({
        color: 0xffd76a,
        emissive: 0xc98a1a,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    return new Proxy({}, { get: () => m });
  }
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    gown: std({ color: PALETTE.purple, roughness: 0.55, metalness: 0.05 }),
    bodice: std({ color: PALETTE.crimson, roughness: 0.5 }),
    gold: std({ color: PALETTE.gold, metalness: 1, roughness: 0.22, emissive: 0x3d2a05, emissiveIntensity: 0.4 }),
    skin: std({ color: PALETTE.skin, roughness: 0.6 }),
    hair: std({ color: PALETTE.hair, roughness: 0.55 }),
    eye: std({ color: 0x1d1410, roughness: 0.2 }),
    pearl: std({ color: 0xfff3df, roughness: 0.28, metalness: 0.12 }),
    lips: std({ color: 0xb8334a, roughness: 0.5 }),
    gemRed: std({ color: 0xff1f4b, emissive: 0xff0033, emissiveIntensity: 20, roughness: 0.1 }),
    gemBlue: std({ color: 0x2f7bff, emissive: 0x1d5cff, emissiveIntensity: 20, roughness: 0.1 }),
    gemGreen: std({ color: 0x22e08a, emissive: 0x0fc060, emissiveIntensity: 20, roughness: 0.1 }),
    cape: shared?.cape ?? std({ color: PALETTE.crimson, side: THREE.DoubleSide }),
    ermine: shared?.ermine ?? std({ color: PALETTE.ermine }),
    sleeve: std({ color: PALETTE.purple, roughness: 0.5 }),
  };
}

/**
 * Modelo procedural de Ana Hering. Pés em y=0, de frente para +Z. Altura ~2,25 m com coroa.
 * variant: 'normal' | 'marble' | 'gold' | 'ghost'
 */
export class QueenModel {
  constructor({ variant = 'normal', materials = null } = {}) {
    this.variant = variant;
    const M = (this.mats = makeMaterials(variant, materials));
    const root = (this.root = new THREE.Group());
    root.name = 'queen';
    const add = (parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      m.rotation.set(...rot);
      m.scale.set(...scale);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };

    // ---- corpo (bob/inclinação)
    const body = (this.body = new THREE.Group());
    root.add(body);

    // saia do vestido (sino)
    const skirtPivot = (this.skirt = new THREE.Group());
    skirtPivot.position.y = 1.02;
    body.add(skirtPivot);
    const skirtProfile = [V(0.001, -1.0), V(0.66, -1.0), V(0.64, -0.88), V(0.56, -0.62), V(0.44, -0.36), V(0.32, -0.12), V(0.24, 0.02), V(0.001, 0.02)];
    add(skirtPivot, new THREE.LatheGeometry(skirtProfile, 28), M.gown);
    add(skirtPivot, new THREE.TorusGeometry(0.655, 0.03, 8, 40), M.gold, [0, -0.96, 0], [Math.PI / 2, 0, 0]);
    add(skirtPivot, new THREE.TorusGeometry(0.5, 0.018, 6, 36), M.gold, [0, -0.55, 0], [Math.PI / 2, 0, 0], [1.03, 1.03, 1]);
    // painel frontal dourado
    add(skirtPivot, new THREE.BoxGeometry(0.16, 0.9, 0.02), M.gold, [0, -0.5, 0.46], [-0.33, 0, 0]);
    // Bordado acompanha o perfil do sino, sem atravessar o tecido.
    for (const s of [-1, 1]) {
      const seam = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.08, -0.08, 0.302),
        new THREE.Vector3(s * 0.15, -0.36, 0.42),
        new THREE.Vector3(s * 0.23, -0.62, 0.52),
        new THREE.Vector3(s * 0.3, -0.94, 0.59),
      ]);
      add(skirtPivot, new THREE.TubeGeometry(seam, 16, 0.009, 5, false), M.gold);
    }
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI * 2 / 12;
      add(skirtPivot, new THREE.SphereGeometry(0.018, 8, 6), M.pearl,
        [Math.sin(a) * 0.65, -0.88, Math.cos(a) * 0.65]);
    }

    // tronco superior
    const chest = (this.chest = new THREE.Group());
    chest.position.y = 1.02;
    body.add(chest);
    const bodiceProfile = [V(0.001, 0), V(0.23, 0), V(0.2, 0.14), V(0.22, 0.3), V(0.26, 0.44), V(0.2, 0.55), V(0.07, 0.6), V(0.001, 0.6)];
    add(chest, new THREE.LatheGeometry(bodiceProfile, 22), M.bodice);
    add(chest, new THREE.TorusGeometry(0.225, 0.03, 8, 28), M.gold, [0, 0.02, 0], [Math.PI / 2, 0, 0]);
    add(chest, new THREE.SphereGeometry(0.04, 10, 8), M.gemRed, [0, 0.03, 0.23]);
    // gola de arminho
    add(chest, new THREE.TorusGeometry(0.22, 0.075, 10, 26), M.ermine, [0, 0.52, -0.01], [Math.PI / 2, 0, 0], [1.05, 0.9, 1]);
    // pescoço + colar
    add(chest, new THREE.CylinderGeometry(0.055, 0.065, 0.16, 12), M.skin, [0, 0.64, 0]);
    add(chest, new THREE.TorusGeometry(0.075, 0.012, 6, 20), M.gold, [0, 0.6, 0.01], [Math.PI / 2.4, 0, 0]);
    add(chest, new THREE.SphereGeometry(0.025, 8, 6), M.gemBlue, [0, 0.55, 0.075]);

    // cabeça
    const head = (this.head = new THREE.Group());
    head.position.y = 0.83;
    chest.add(head);
    add(head, new THREE.SphereGeometry(0.145, 22, 18), M.skin, [0, 0, 0], [0, 0, 0], [1, 1.1, 1]);
    // cabelo: calota + volume atrás até os ombros
    add(head, new THREE.SphereGeometry(0.158, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair, [0, 0.015, -0.01], [-0.25, 0, 0], [1.02, 1.1, 1.05]);
    add(head, new THREE.SphereGeometry(0.15, 14, 12), M.hair, [0, -0.1, -0.06], [0, 0, 0], [1.1, 1.2, 0.75]);
    add(head, new THREE.SphereGeometry(0.06, 10, 8), M.hair, [0, 0.06, -0.15]); // coque
    // rosto
    for (const s of [-1, 1]) {
      add(head, new THREE.SphereGeometry(0.022, 10, 8), M.pearl, [0.05 * s, 0.02, 0.129], [0, 0, 0], [1, 0.75, 0.5]);
      add(head, new THREE.SphereGeometry(0.013, 8, 6), M.eye, [0.05 * s, 0.02, 0.14], [0, 0, 0], [1, 1, 0.5]);
      add(head, new THREE.SphereGeometry(0.004, 6, 4), M.pearl, [0.05 * s - 0.004, 0.025, 0.147]);
      add(head, new THREE.SphereGeometry(0.027, 10, 8), M.skin, [0.14 * s, -0.015, 0], [0, 0, 0], [0.5, 1, 0.7]);
      add(head, new THREE.SphereGeometry(0.012, 8, 6), M.pearl, [0.145 * s, -0.05, 0.012]);
      // Mechas laterais preservam a leitura do rosto sob a coroa.
      add(head, new THREE.CapsuleGeometry(0.025, 0.14, 4, 8), M.hair,
        [0.125 * s, -0.045, -0.025], [0, 0, -0.15 * s]);
      add(head, new THREE.BoxGeometry(0.05, 0.008, 0.01), M.hair, [0.05 * s, 0.06, 0.135], [0, 0, -0.15 * s]); // sobrancelhas altivas
    }
    add(head, new THREE.SphereGeometry(0.02, 8, 6), M.skin, [0, -0.02, 0.145], [0, 0, 0], [0.8, 1, 0.9]); // nariz
    add(head, new THREE.CapsuleGeometry(0.008, 0.04, 4, 6), M.lips, [0, -0.07, 0.13], [0, 0, Math.PI / 2]);

    // coroa ornamentada (exagerada)
    const crown = (this.crown = new THREE.Group());
    crown.position.y = 0.13;
    head.add(crown);
    add(crown, new THREE.CylinderGeometry(0.135, 0.125, 0.07, 24, 1, true), M.gold, [0, 0, 0]);
    add(crown, new THREE.TorusGeometry(0.135, 0.012, 6, 24), M.gold, [0, 0.035, 0], [Math.PI / 2, 0, 0]);
    add(crown, new THREE.TorusGeometry(0.127, 0.012, 6, 24), M.gold, [0, -0.035, 0], [Math.PI / 2, 0, 0]);
    const spikes = 8;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const tall = i % 2 === 0 ? 0.17 : 0.11;
      add(crown, new THREE.ConeGeometry(0.03, tall, 6), M.gold, [Math.sin(a) * 0.13, 0.035 + tall / 2, Math.cos(a) * 0.13]);
      add(crown, new THREE.SphereGeometry(0.017, 8, 6), M.gold, [Math.sin(a) * 0.13, 0.035 + tall + 0.012, Math.cos(a) * 0.13]);
      const gem = [M.gemRed, M.gemBlue, M.gemGreen][i % 3];
      add(crown, new THREE.SphereGeometry(0.019, 8, 6), gem, [Math.sin(a) * 0.137, 0, Math.cos(a) * 0.137]);
    }
    // arcos e orbe no topo
    add(crown, new THREE.TorusGeometry(0.12, 0.01, 6, 20, Math.PI), M.gold, [0, 0.04, 0], [0, 0, 0], [1, 1.2, 1]);
    add(crown, new THREE.TorusGeometry(0.12, 0.01, 6, 20, Math.PI), M.gold, [0, 0.04, 0], [0, Math.PI / 2, 0], [1, 1.2, 1]);
    add(crown, new THREE.SphereGeometry(0.03, 10, 8), M.gemRed, [0, 0.2, 0]);
    add(crown, new THREE.BoxGeometry(0.012, 0.07, 0.012), M.gold, [0, 0.25, 0]);
    add(crown, new THREE.BoxGeometry(0.045, 0.012, 0.012), M.gold, [0, 0.255, 0]);

    // braços
    this.arms = [];
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.27 * s, 0.47, 0);
      chest.add(shoulder);
      add(shoulder, new THREE.SphereGeometry(0.1, 12, 10), M.sleeve, [0, 0, 0], [0, 0, 0], [1, 0.95, 1]); // manga bufante
      add(shoulder, new THREE.CylinderGeometry(0.05, 0.045, 0.3, 10), M.sleeve, [0, -0.17, 0]);
      const elbow = new THREE.Group();
      elbow.position.y = -0.31;
      shoulder.add(elbow);
      add(elbow, new THREE.CylinderGeometry(0.045, 0.06, 0.26, 10), M.sleeve, [0, -0.13, 0]);
      add(elbow, new THREE.TorusGeometry(0.055, 0.012, 6, 14), M.gold, [0, -0.25, 0], [Math.PI / 2, 0, 0]);
      add(elbow, new THREE.SphereGeometry(0.045, 10, 8), M.skin, [0, -0.3, 0.01], [0, 0, 0], [0.9, 1.1, 0.7]);
      this.arms.push({ shoulder, elbow, side: s });
    }
    // cetro na mão direita
    const scepter = (this.scepter = new THREE.Group());
    scepter.position.set(0, -0.3, 0.03);
    scepter.rotation.x = Math.PI / 2;
    this.arms[1].elbow.add(scepter);
    add(scepter, new THREE.CylinderGeometry(0.016, 0.02, 0.85, 8), M.gold, [0, 0.15, 0]);
    add(scepter, new THREE.SphereGeometry(0.05, 12, 10), M.gemBlue, [0, 0.6, 0]);
    add(scepter, new THREE.TorusGeometry(0.055, 0.01, 6, 16), M.gold, [0, 0.6, 0]);
    add(scepter, new THREE.ConeGeometry(0.03, 0.08, 6), M.gold, [0, 0.69, 0]);

    // manto real (malha animada)
    this.capeAttachY = 1.02 + 0.5;
    this._buildCape(M.cape);

    // sapatos dourados
    this.feet = [];
    for (const s of [-1, 1]) {
      const f = add(root, new THREE.BoxGeometry(0.1, 0.07, 0.22), M.gold, [0.11 * s, 0.035, 0.05]);
      this.feet.push(f);
    }

    this.phase = 0;
    this.speedSmooth = 0;
    this.waveT = 0;
  }

  _buildCape(mat) {
    const cols = 10, rows = 16;
    this.capeCols = cols;
    this.capeRows = rows;
    const geo = new THREE.PlaneGeometry(1, 1, cols, rows);
    this.capeBase = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) + 0.5), v = 0.5 - pos.getY(i); // u 0..1 (esq→dir), v 0..1 (topo→baixo)
      this.capeBase.push({ u, v });
    }
    const cape = (this.cape = new THREE.Mesh(geo, mat));
    cape.castShadow = true;
    cape.receiveShadow = true;
    cape.position.set(0, this.capeAttachY, -0.14);
    this.body.add(cape);
    this._updateCape(0, 0, 0, 0);
  }

  _updateCape(t, speed, lift, sitting) {
    const pos = this.cape.geometry.attributes.position;
    const len = 1.95; // vai até o chão e arrasta
    const attach = this.capeAttachY;
    for (let i = 0; i < pos.count; i++) {
      const { u, v } = this.capeBase[i];
      const w = lerp(0.62, 1.55, Math.pow(v, 0.8));
      let x = (u - 0.5) * w;
      let y = -v * len;
      const round = 1 - Math.pow(2 * u - 1, 2);
      let z = -0.04 - 0.22 * v * round - 0.08 * v;
      // fluxo para trás com a velocidade + ondulação
      const flow = speed * Math.pow(v, 1.4);
      z -= flow * 0.75;
      y += flow * lift * 0.5;
      const wave = Math.sin(t * (4 + speed * 5) + v * 5 + u * 3) * 0.035 * v * (0.35 + speed);
      z += wave;
      x += Math.sin(t * 3 + v * 4) * 0.015 * v;
      if (sitting) z = -0.04 - 0.25 * v * round - 0.05;
      // arrasta no chão
      const worldY = attach + y;
      if (worldY < 0.03 && !sitting) {
        const excess = 0.03 - worldY;
        y = 0.03 - attach;
        z -= excess * 0.9;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    this.cape.geometry.computeVertexNormals();
  }

  /**
   * @param {number} dt
   * @param {{state:string, speed:number, time:number}} s  speed 0..1 (1 = correndo)
   */
  animate(dt, { state = 'idle', speed = 0, time = 0 }) {
    this.speedSmooth = damp(this.speedSmooth, speed, 8, dt);
    const sp = this.speedSmooth;
    const moving = state === 'walk' || state === 'run';
    const freq = state === 'run' ? 9.5 : 6.2;
    if (moving) this.phase += dt * freq;
    const ph = this.phase;
    const sitting = state === 'sit';
    const [aL, aR] = this.arms;

    // padrão: postura ereta e majestosa
    let bob = 0, lean = 0, sway = 0, footAmp = 0, armAmp = 0;
    if (moving) {
      bob = Math.abs(Math.sin(ph)) * (state === 'run' ? 0.08 : 0.035);
      lean = state === 'run' ? 0.16 : 0.04;
      sway = Math.sin(ph) * (state === 'run' ? 0.06 : 0.035);
      footAmp = state === 'run' ? 0.26 : 0.16;
      armAmp = state === 'run' ? 0.9 : 0.45;
    }
    const breathe = Math.sin(time * 1.6) * 0.008;

    this.body.position.y = damp(this.body.position.y, sitting ? 0 : bob, 12, dt);
    this.chest.rotation.x = damp(this.chest.rotation.x, lean, 6, dt);
    this.chest.scale.y = 1 + breathe;
    this.skirt.rotation.z = damp(this.skirt.rotation.z, sway * 0.6, 8, dt);
    this.skirt.rotation.x = damp(this.skirt.rotation.x, -lean * 0.3, 6, dt);
    this.chest.rotation.y = damp(this.chest.rotation.y, moving ? Math.sin(ph) * 0.06 : 0, 6, dt);
    this.head.rotation.y = damp(this.head.rotation.y, moving ? 0 : Math.sin(time * 0.35) * 0.35, 2, dt);
    this.head.rotation.x = damp(this.head.rotation.x, -0.08, 3, dt); // queixo erguido
    this.skirt.scale.set(1, sitting ? 0.62 : 1, sitting ? 1.15 : 1);

    // pés
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const s = i === 0 ? 1 : -1;
      if (sitting) {
        f.position.z = damp(f.position.z, 0.55, 8, dt);
        f.position.y = 0.035;
      } else {
        f.position.z = damp(f.position.z, 0.05 + Math.sin(ph) * footAmp * s, 14, dt);
        f.position.y = 0.035 + Math.max(0, Math.cos(ph) * s) * footAmp * 0.3;
      }
    }

    // braço esquerdo: balança ou acena
    this.waveT = Math.max(0, this.waveT - dt);
    if (this.waveT > 0) {
      aL.shoulder.rotation.z = damp(aL.shoulder.rotation.z, -2.6, 10, dt);
      aL.shoulder.rotation.x = damp(aL.shoulder.rotation.x, 0, 10, dt);
      aL.elbow.rotation.z = Math.sin(time * 12) * 0.5 - 0.3;
    } else if (sitting) {
      aL.shoulder.rotation.x = damp(aL.shoulder.rotation.x, -0.5, 6, dt);
      aL.shoulder.rotation.z = damp(aL.shoulder.rotation.z, -0.25, 6, dt);
      aL.elbow.rotation.x = damp(aL.elbow.rotation.x, -0.9, 6, dt);
      aL.elbow.rotation.z = 0;
    } else {
      aL.shoulder.rotation.x = damp(aL.shoulder.rotation.x, Math.sin(ph) * armAmp * (moving ? 1 : 0), 10, dt);
      aL.shoulder.rotation.z = damp(aL.shoulder.rotation.z, -0.18, 8, dt);
      aL.elbow.rotation.x = damp(aL.elbow.rotation.x, moving ? -0.4 : -0.15, 8, dt);
      aL.elbow.rotation.z = damp(aL.elbow.rotation.z, 0, 8, dt);
    }
    // braço direito: cetro erguido com autoridade
    aR.shoulder.rotation.x = damp(aR.shoulder.rotation.x, sitting ? -0.6 : -0.25 - Math.sin(ph) * armAmp * 0.3, 8, dt);
    aR.shoulder.rotation.z = damp(aR.shoulder.rotation.z, 0.2, 8, dt);
    aR.elbow.rotation.x = damp(aR.elbow.rotation.x, sitting ? -0.7 : -1.1, 8, dt);

    if (state === 'jump') {
      aL.shoulder.rotation.z = damp(aL.shoulder.rotation.z, -0.9, 10, dt);
      this.skirt.scale.y = 0.93;
    }

    if (this.variant !== 'marble' && this.variant !== 'gold') this._updateCape(time, moving ? sp : 0, state === 'run' ? 1 : 0.3, sitting);
  }

  wave() {
    this.waveT = 1.6;
  }
}

/**
 * Funde todas as malhas de um grupo numa única malha estática (para estátuas).
 */
export function bakeStatic(group, material) {
  group.updateMatrixWorld(true);
  const geos = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.clone() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld);
    geos.push(g.index ? g : indexify(g));
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function indexify(g) {
  const n = g.attributes.position.count;
  g.setIndex([...Array(n).keys()]);
  return g;
}
