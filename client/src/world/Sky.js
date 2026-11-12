import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { canvasTexture, rng } from '../core/utils.js';

/** Céu com espalhamento atmosférico, sol de fim de tarde, névoa e nuvens. */
export function buildSky({ scene, game }) {
  const sky = new Sky();
  sky.scale.setScalar(4000);
  const u = sky.material.uniforms;
  u.turbidity.value = 6;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.003;
  u.mieDirectionalG.value = 0.75;
  // nuvens volumétricas do próprio shader; disco solar desligado (evita estouro no bloom)
  if (u.showSunDisc) u.showSunDisc.value = 0;
  if (u.cloudCoverage) {
    u.cloudCoverage.value = 0.42;
    u.cloudDensity.value = 0.5;
  }
  const elevation = 30, azimuth = -35; // sol a sul-sudoeste: ilumina a fachada do castelo
  const sunDir = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - elevation),
    THREE.MathUtils.degToRad(azimuth)
  );
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);

  // ambiente PBR a partir do céu (reflexos dourados)
  const pmrem = new THREE.PMREMGenerator(game.gfx.renderer);
  const envScene = new THREE.Scene();
  const skyClone = new Sky();
  skyClone.scale.setScalar(1000);
  for (const k of Object.keys(u)) skyClone.material.uniforms[k].value = u[k].value;
  envScene.add(skyClone);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 0.35;

  scene.fog = new THREE.FogExp2(0xe8c9a8, 0.0032);

  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x5a6b3a, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe2b8, 2.3);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -60;
  sc.right = 60;
  sc.top = 60;
  sc.bottom = -60;
  sc.near = 1;
  sc.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  game.gfx.setSun(sun);

  // nuvens em sprites
  const cloudTex = canvasTexture(128, 128, (ctx, w, h) => {
    const r = rng(77);
    for (let i = 0; i < 14; i++) {
      const x = w * (0.25 + r() * 0.5), y = h * (0.4 + r() * 0.25), rad = 18 + r() * 26;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });
  const clouds = [];
  const r = rng(99);
  for (let i = 0; i < (u.cloudCoverage ? 10 : 26); i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, color: 0xfff0e6, transparent: true, opacity: 0.75, depthWrite: false, fog: false });
    const s = new THREE.Sprite(mat);
    const a = r() * Math.PI * 2, d = 150 + r() * 350;
    s.position.set(Math.cos(a) * d, 110 + r() * 90, Math.sin(a) * d);
    const sz = 90 + r() * 120;
    s.scale.set(sz, sz * 0.5, 1);
    scene.add(s);
    clouds.push(s);
  }

  const target = new THREE.Vector3();
  return {
    sun,
    sunDir,
    update(dt, t) {
      if (u.time) u.time.value = t;
      // sombra acompanha a rainha
      const q = game.systems.queen;
      if (q) {
        target.copy(q.position);
        // alinha ao texel para evitar "tremido" das sombras
        const step = 120 / sun.shadow.mapSize.x;
        target.x = Math.round(target.x / step) * step;
        target.z = Math.round(target.z / step) * step;
        sun.target.position.copy(target);
        sun.position.copy(target).addScaledVector(sunDir, 180);
      }
      for (const c of clouds) {
        c.position.x += dt * 1.5;
        if (c.position.x > 520) c.position.x = -520;
      }
    },
  };
}
