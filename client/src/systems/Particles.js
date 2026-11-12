import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aSpin;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vSpin;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vSpin = aSpin;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vSpin;
  uniform int uShape; // 0 = brilho redondo, 1 = confete/pétala retangular
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float a;
    if (uShape == 0) {
      a = smoothstep(0.5, 0.0, length(p));
    } else {
      float c = cos(vSpin), s = sin(vSpin);
      vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
      q.y *= 1.0 + 1.5 * abs(sin(vSpin * 0.7));
      a = step(abs(q.x), 0.32) * step(abs(q.y), 0.2);
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

class Emitter {
  constructor(scene, capacity, { shape = 0, additive = true } = {}) {
    this.cap = capacity;
    this.n = 0;
    this.p = new Float32Array(capacity * 3);
    this.v = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.color = new Float32Array(capacity * 3);
    this.spin = new Float32Array(capacity);
    this.spinV = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.sway = new Float32Array(capacity);
    const g = (this.geo = new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSpin', new THREE.BufferAttribute(this.spin, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: innerHeight * 0.6 }, uShape: { value: shape } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, { life = 2, size = 1, color = [1, 1, 1], drag = 0, grav = 0, sway = 0, spin = 0 } = {}) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.p.set([x, y, z], i * 3);
    this.v.set([vx, vy, vz], i * 3);
    this.life[i] = this.max[i] = life;
    this.size[i] = size;
    this.color.set(color, i * 3);
    this.drag[i] = drag;
    this.grav[i] = grav;
    this.sway[i] = sway;
    this.spin[i] = Math.random() * 6;
    this.spinV[i] = spin;
  }

  update(dt, t) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // remove trocando com o último
        const l = --this.n;
        if (i !== l) {
          for (const arr of [this.p, this.v, this.color]) arr.copyWithin(i * 3, l * 3, l * 3 + 3);
          for (const arr of [this.life, this.max, this.size, this.drag, this.grav, this.sway, this.spin, this.spinV]) arr[i] = arr[l];
        }
        continue;
      }
      const k = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.v[k] *= d;
      this.v[k + 1] = this.v[k + 1] * d - this.grav[i] * dt;
      this.v[k + 2] *= d;
      const sw = this.sway[i] ? Math.sin(t * 2 + i) * this.sway[i] : 0;
      this.p[k] += (this.v[k] + sw) * dt;
      this.p[k + 1] += this.v[k + 1] * dt;
      this.p[k + 2] += (this.v[k + 2] + sw * 0.6) * dt;
      this.spin[i] += this.spinV[i] * dt;
      const r = this.life[i] / this.max[i];
      this.alpha[i] = Math.min(1, r * 3) * Math.min(1, (1 - r) * 10 + 0.2);
      i++;
    }
    const g = this.geo;
    g.setDrawRange(0, this.n);
    for (const a of ['position', 'aSize', 'aAlpha', 'aColor', 'aSpin']) g.attributes[a].needsUpdate = true;
  }
}

const CONFETTI = [[1, 0.8, 0.25], [0.62, 0.1, 0.2], [0.45, 0.2, 0.65], [1, 1, 1], [0.95, 0.55, 0.15]];

/** Partículas: brilhos, confete, pétalas e fogos. */
export class Particles {
  constructor(game) {
    this.game = game;
    const s = game.scene;
    this.glow = new Emitter(s, 3000, { shape: 0, additive: true });
    this.paper = new Emitter(s, 3500, { shape: 1, additive: false });
    this.timers = [];
    this.crownT = 0;
    addEventListener('resize', () => {
      this.glow.mat.uniforms.uScale.value = innerHeight * 0.6;
      this.paper.mat.uniforms.uScale.value = innerHeight * 0.6;
    });
    game.events.on('tribute:collected', ({ position }) => this.burst(position, 80, [1, 0.85, 0.3]));
    game.events.on('quest:completed', () => {
      const q = game.systems.queen.position;
      this.burst(q.clone().setY(q.y + 2), 120, [1, 0.85, 0.3]);
      this.confetti(q.clone().setY(q.y + 6), 220);
    });
    game.events.on('decree:issued', () => this.confetti(game.systems.queen.position.clone().setY(game.systems.queen.position.y + 7), 260));
  }

  burst(pos, count = 60, color = [1, 0.85, 0.3], speed = 4) {
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      const r = Math.sqrt(1 - u * u);
      this.glow.spawn(pos.x, pos.y, pos.z, Math.cos(a) * r * s, u * s + 1, Math.sin(a) * r * s, { life: 0.8 + Math.random() * 0.8, size: 0.35, color, drag: 2, grav: 2 });
    }
  }

  confetti(pos, count = 200) {
    for (let i = 0; i < count; i++) {
      this.paper.spawn(pos.x + (Math.random() - 0.5) * 6, pos.y, pos.z + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8, 2 + Math.random() * 6, (Math.random() - 0.5) * 8, {
        life: 4 + Math.random() * 3,
        size: 0.45,
        color: CONFETTI[i % CONFETTI.length],
        drag: 1.6,
        grav: 3,
        sway: 0.8,
        spin: 4 + Math.random() * 8,
      });
    }
  }

  /** Chuva de pétalas por `seconds` ao redor de `center`. */
  petals(center, radius = 25, seconds = 10) {
    this.timers.push({ kind: 'petals', center: center.clone(), radius, t: seconds });
  }

  fireworksShow(center, seconds = 10) {
    this.timers.push({ kind: 'fireworks', center: center.clone(), t: seconds, acc: 0 });
  }

  firework(x, z, y0 = 0) {
    const colors = [[1, 0.8, 0.3], [0.9, 0.3, 0.5], [0.7, 0.4, 1], [1, 1, 1], [0.4, 0.8, 1]];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const h = y0 + 35 + Math.random() * 25;
    const delay = 1.1;
    // rastro subindo
    for (let i = 0; i < 12; i++) this.glow.spawn(x, y0 + 2 + i * 0.3, z, (Math.random() - 0.5) * 0.4, (h - y0) / delay, (Math.random() - 0.5) * 0.4, { life: delay * (0.3 + i / 18), size: 0.5, color: [1, 0.9, 0.6], drag: 0 });
    setTimeout(() => {
      this.burst(new THREE.Vector3(x, h, z), 220, c, 16);
      this.game.systems.audio?.boom();
    }, delay * 1000);
  }

  update(dt, t) {
    const g = this.game;
    for (const tm of this.timers) {
      tm.t -= dt;
      if (tm.kind === 'petals') {
        const n = Math.floor(60 * dt + Math.random());
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * tm.radius;
          this.paper.spawn(tm.center.x + Math.cos(a) * d, tm.center.y + 18 + Math.random() * 6, tm.center.z + Math.sin(a) * d, 0.6, -1.5, 0.2, {
            life: 9,
            size: 0.5,
            color: Math.random() < 0.7 ? [0.95, 0.35, 0.5] : [1, 0.75, 0.8],
            drag: 0.5,
            grav: 0.15,
            sway: 1.2,
            spin: 2,
          });
        }
      } else if (tm.kind === 'fireworks') {
        tm.acc -= dt;
        if (tm.acc <= 0) {
          tm.acc = 0.5 + Math.random() * 0.7;
          this.firework(tm.center.x + (Math.random() - 0.5) * 60, tm.center.z - 20 + (Math.random() - 0.5) * 50, tm.center.y);
        }
      }
    }
    this.timers = this.timers.filter((x) => x.t > 0);

    // brilho constante na coroa da rainha e no colosso
    const q = g.systems.queen;
    if (q && g.mode !== 'title') {
      this.crownT -= dt;
      if (this.crownT <= 0) {
        this.crownT = 0.12;
        const head = q.model.crown.getWorldPosition(new THREE.Vector3());
        this.glow.spawn(head.x + (Math.random() - 0.5) * 0.4, head.y + Math.random() * 0.25, head.z + (Math.random() - 0.5) * 0.4, 0, 0.3, 0, { life: 0.9, size: 0.12, color: [1, 0.9, 0.5] });
      }
    }
    // poeira dourada na praça
    if (Math.random() < dt * 8) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * 30;
      this.glow.spawn(Math.cos(a) * d, 1 + Math.random() * 12, Math.sin(a) * d, 0, 0.3, 0, { life: 4, size: 0.2, color: [1, 0.85, 0.5], sway: 0.3 });
    }
    this.glow.update(dt, t);
    this.paper.update(dt, t);
  }
}
