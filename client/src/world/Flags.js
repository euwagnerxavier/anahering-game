import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bandeiras tremulando (vertex shader) fundidas num único mesh por tipo.
 * - flag: presa ao mastro pela borda esquerda, tremula ao vento (+X).
 * - banner: estandarte vertical preso pela borda superior, balança suavemente.
 */
export function createFlagSystem(baseMaterial) {
  const uniforms = { uTime: { value: 0 } };
  const makeMat = (mode) => {
    const m = baseMaterial.clone();
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          mode === 'flag'
            ? `#include <begin_vertex>
               float k = uv.x;
               float ph = uTime * 5.0 - uv.x * 6.0 + (position.x + position.z) * 0.05;
               transformed += objectNormal * (sin(ph) * 0.18 + sin(ph * 2.3) * 0.05) * k * (1.0 + k);
               transformed.y -= k * k * 0.12;`
            : `#include <begin_vertex>
               float k = 1.0 - uv.y;
               transformed += objectNormal * sin(uTime * 1.6 + position.x * 0.3 + uv.y * 3.0) * 0.12 * k * k;`
        );
    };
    m.customProgramCacheKey = () => `flag-${mode}`;
    return m;
  };
  const mats = { flag: makeMat('flag'), banner: makeMat('banner') };
  const lists = { flag: [], banner: [] };
  const _m = new THREE.Matrix4();

  return {
    uniforms,
    /** Bandeira presa em `pos` (canto superior junto ao mastro). */
    addFlag(_parent, pos, w = 3, h = 2, rotY = 0) {
      const g = new THREE.PlaneGeometry(w, h, 12, 6);
      g.translate(w / 2 + 0.1, -h / 2, 0);
      _m.makeRotationY(rotY).setPosition(pos);
      g.applyMatrix4(_m);
      lists.flag.push(g);
    },
    /** Estandarte vertical centrado em `pos`, frente para +Z rotacionada por rotY. */
    addBanner(_parent, pos, w = 3, h = 8, rotY = 0) {
      const g = new THREE.PlaneGeometry(w, h, 4, 10);
      _m.makeRotationY(rotY).setPosition(pos);
      g.applyMatrix4(_m);
      lists.banner.push(g);
    },
    build(scene) {
      for (const k of ['flag', 'banner']) {
        if (!lists[k].length) continue;
        const merged = mergeGeometries(lists[k]);
        const mesh = new THREE.Mesh(merged, mats[k]);
        mesh.frustumCulled = false;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
    },
    update(dt, t) {
      uniforms.uTime.value = t;
    },
  };
}

/** Mastro com bandeira. */
export function addFlagPole(batcher, flags, x, y, z, height = 10, flagW = 3.6, flagH = 2.3) {
  batcher.add('gold', new THREE.CylinderGeometry(0.09, 0.12, height, 8), { pos: [x, y + height / 2, z] });
  batcher.add('gold', new THREE.SphereGeometry(0.22, 10, 8), { pos: [x, y + height + 0.15, z] });
  batcher.add('stoneDark', new THREE.CylinderGeometry(0.4, 0.5, 0.6, 10), { pos: [x, y + 0.3, z] });
  flags.addFlag(null, new THREE.Vector3(x, y + height - 0.2, z), flagW, flagH);
}
