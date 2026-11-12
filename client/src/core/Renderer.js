import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const QUALITY = {
  high: { pixelRatio: Math.min(devicePixelRatio, 1.5), bloom: true, shadow: 2048 },
  medium: { pixelRatio: 1, bloom: true, shadow: 1536 },
  low: { pixelRatio: 0.75, bloom: false, shadow: 1024 },
};

/** Renderer + pós-processamento + qualidade adaptativa. */
export class Renderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.72;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(r.domElement);
    this.canvas = r.domElement;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1500);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.3, 4.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.autoQuality = true;
    this.fpsSamples = [];
    this.lowTime = 0;
    this.setQuality(localStorage.getItem('anahering.quality') || 'high');

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  setQuality(level) {
    if (!QUALITY[level]) level = 'high';
    this.quality = level;
    const q = QUALITY[level];
    this.renderer.setPixelRatio(q.pixelRatio);
    this.composer.setPixelRatio?.(q.pixelRatio);
    this.bloom.enabled = q.bloom;
    this.shadowSize = q.shadow;
    if (this.sun) this.applyShadowSize();
    try {
      localStorage.setItem('anahering.quality', level);
    } catch {
      /* armazenamento indisponível */
    }
    this.resize();
  }

  /** Registra a luz do sol para ajustar o shadow map conforme a qualidade. */
  setSun(sun) {
    this.sun = sun;
    this.applyShadowSize();
  }
  applyShadowSize() {
    const s = this.shadowSize;
    if (this.sun.shadow.mapSize.x !== s) {
      this.sun.shadow.mapSize.set(s, s);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  /** Reduz a qualidade se o FPS ficar baixo por alguns segundos. */
  trackPerformance(dt) {
    if (!this.autoQuality || dt <= 0) return;
    const fps = 1 / dt;
    if (fps < 42) this.lowTime += dt;
    else this.lowTime = Math.max(0, this.lowTime - dt * 0.5);
    if (this.lowTime > 3) {
      this.lowTime = 0;
      if (this.quality === 'high') this.setQuality('medium');
      else if (this.quality === 'medium') this.setQuality('low');
      else this.autoQuality = false;
      return this.quality;
    }
    return null;
  }

  render() {
    if (this.bloom.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
