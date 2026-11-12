import * as THREE from 'three';
import { $, escapeHtml } from '../core/utils.js';
import { titleFor, nextTitle } from '../data/titles.js';
import { ZONE_ARRIVALS } from '../data/barks.js';
import { LAYOUT } from '../world/layout.js';

const MAP_R = 215; // metros cobertos pelo minimapa (raio)

/** HUD: título/prestígio, rastreador de missão, prompt, toasts, anúncios, balões e minimapa. */
export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      root: $('#hud'),
      title: $('#hud-title'),
      prestige: $('#hud-prestige'),
      bar: $('#hud-bar-fill'),
      next: $('#hud-next'),
      questTitle: $('#quest-title'),
      questStep: $('#quest-step'),
      questBox: $('#quest-box'),
      prompt: $('#prompt'),
      toasts: $('#toasts'),
      announce: $('#announce'),
      bubbles: $('#bubbles'),
      zone: $('#zone-name'),
      net: $('#net-status'),
      applause: $('#applause'),
      lockHint: $('#lock-hint'),
      map: $('#minimap'),
    };
    this.bubblesList = [];
    this.announceQueue = [];
    this.announcing = false;
    this.applauseShown = 0;
    this.applauseTarget = 0;
    this.prompt = null;
    this.mapCtx = this.el.map.getContext('2d');
    this._v = new THREE.Vector3();

    const ev = game.events;
    ev.on('quest:state', (s) => this.updateQuest(s));
    ev.on('quest:started', ({ quest, resumed }) => {
      if (!resumed) this.announce('NOVA MISSÃO', quest.title, quest.intro);
    });
    ev.on('quest:completed', ({ quest }) => this.announce('MISSÃO CUMPRIDA', quest.title, `+${quest.reward} de Prestígio Real`));
    ev.on('campaign:completed', () =>
      setTimeout(() => this.announce('O REINADO É ETERNO', 'Campanha concluída', 'Continue explorando, decretando e sendo adorada.'), 9000)
    );
    ev.on('title:new', ({ title }) => this.announce('NOVO TÍTULO HONORÍFICO', title.name));
    ev.on('prestige:gained', ({ amount, reason }) => this.floatText(`+${amount} Prestígio · ${reason}`));
    ev.on('zone:enter', ({ id, name }) => {
      this.showZone(name);
      if (ZONE_ARRIVALS[id]) this.toast(ZONE_ARRIVALS[id]);
    });
    ev.on('net:status', ({ online }) => this.updateNet(online));
    ev.on('net:applause', ({ total }) => (this.applauseTarget = total));
    ev.on('gfx:quality', (q) => this.toast(`Qualidade gráfica ajustada para "${{ high: 'alta', medium: 'média', low: 'baixa' }[q]}" para manter a fluidez.`));
    this.updateNet(false);
  }

  show(on) {
    this.el.root.classList.toggle('hidden', !on);
  }

  updateQuest({ quest, tracker, prestige, finished }) {
    const t = titleFor(prestige);
    const n = nextTitle(prestige);
    this.el.title.textContent = t.name;
    this.el.prestige.textContent = `${prestige} de Prestígio Real`;
    const lo = t.at, hi = n ? n.at : prestige || 1;
    this.el.bar.style.width = `${n ? ((prestige - lo) / (hi - lo)) * 100 : 100}%`;
    this.el.next.textContent = n ? `Próximo título: ${n.at}` : 'Título máximo alcançado';
    if (finished || !quest) {
      this.el.questTitle.textContent = 'Reinado Eterno';
      this.el.questStep.textContent = 'Explore o reino, emita decretos e aceite adoração.';
    } else {
      this.el.questTitle.textContent = quest.title;
      this.el.questStep.textContent = tracker ?? '';
      this.el.questBox.classList.remove('pulse');
      void this.el.questBox.offsetWidth;
      this.el.questBox.classList.add('pulse');
    }
  }

  setPrompt(text, raw = false) {
    const t = text ? (raw ? text : `[E] ${text}`) : null;
    if (t === this.prompt) return;
    this.prompt = t;
    this.el.prompt.textContent = t ?? '';
    this.el.prompt.classList.toggle('visible', !!t);
  }

  toast(text, ms = 4200) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => d.classList.add('out'), ms);
    setTimeout(() => d.remove(), ms + 600);
  }

  floatText(text) {
    const d = document.createElement('div');
    d.className = 'float-text';
    d.textContent = text;
    this.el.root.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  }

  showZone(name) {
    const z = this.el.zone;
    z.textContent = name;
    z.classList.remove('show');
    void z.offsetWidth;
    z.classList.add('show');
  }

  /** Grande anúncio central (fila). */
  announce(kicker, title, sub = '', urgent = false) {
    const item = { kicker, title, sub };
    if (urgent) {
      // cerimônias furam a fila: mostram já
      this.announceQueue.unshift(item);
      clearTimeout(this.announceTimer);
      this.announcing = false;
    } else this.announceQueue.push(item);
    if (!this.announcing) this._nextAnnounce();
  }
  _nextAnnounce() {
    const a = this.announceQueue.shift();
    if (!a) {
      this.announcing = false;
      return;
    }
    this.announcing = true;
    const el = this.el.announce;
    el.innerHTML = `<div class="kicker">${escapeHtml(a.kicker)}</div><div class="big">${escapeHtml(a.title)}</div>${a.sub ? `<div class="sub">${escapeHtml(a.sub)}</div>` : ''}`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    this.announceTimer = setTimeout(() => {
      el.classList.remove('show');
      this.announceTimer = setTimeout(() => this._nextAnnounce(), 500);
    }, 3400);
  }

  /** Balão de fala preso a um objeto 3D. */
  bubble(anchor, text, seconds = 2.5, height = 1.3) {
    if (this.bubblesList.length > 5) this.bubblesList.shift().el.remove();
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    this.el.bubbles.appendChild(el);
    this.bubblesList.push({ el, anchor, height: height + 0.5, t: seconds });
  }

  updateNet(online) {
    this.online = online;
    this._renderNet();
  }
  _renderNet() {
    const n = this.game.systems.remote?.players.size ?? 0;
    this.el.net.innerHTML = this.online
      ? `<span class="dot on"></span> Reino conectado · ${n} ${n === 1 ? 'Eco Real' : 'Ecos Reais'} por perto`
      : `<span class="dot"></span> Reino offline (o jogo continua normalmente)`;
  }

  update(dt) {
    const g = this.game;
    const cam = g.camera;
    // balões
    for (let i = this.bubblesList.length - 1; i >= 0; i--) {
      const b = this.bubblesList[i];
      b.t -= dt;
      if (b.t <= 0) {
        b.el.remove();
        this.bubblesList.splice(i, 1);
        continue;
      }
      const v = this._v.copy(b.anchor.position);
      v.y += b.height;
      const dist = v.distanceTo(cam.position);
      v.project(cam);
      const visible = v.z < 1 && dist < 45 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      b.el.style.display = visible ? 'block' : 'none';
      if (visible) {
        b.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px)`;
        b.el.style.opacity = Math.min(1, b.t * 2);
      }
    }
    // aplausômetro animado
    if (this.applauseShown !== this.applauseTarget) {
      this.applauseShown += Math.ceil((this.applauseTarget - this.applauseShown) * Math.min(1, dt * 4)) || Math.sign(this.applauseTarget - this.applauseShown);
      this.el.applause.textContent = `👏 ${this.applauseShown.toLocaleString('pt-BR')} aplausos no Aplausômetro Global`;
    }
    this._netAcc = (this._netAcc || 0) + dt;
    if (this._netAcc > 1) {
      this._netAcc = 0;
      this._renderNet();
    }
    this.el.lockHint.classList.toggle('visible', g.mode === 'play' && !g.paused && !g.input.locked);
    this.drawMap();
  }

  // ---------- minimapa
  _buildMapBase() {
    const W = this.el.map.width;
    const c = document.createElement('canvas');
    c.width = c.height = W;
    const x = c.getContext('2d');
    const s = W / (MAP_R * 2);
    const P = (wx, wz) => [(wx + MAP_R) * s, (wz + MAP_R) * s];
    x.fillStyle = '#4f6b34';
    x.fillRect(0, 0, W, W);
    // montanhas
    const grd = x.createRadialGradient(W / 2, W / 2, W * 0.42, W / 2, W / 2, W * 0.55);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(110,100,90,1)');
    x.fillStyle = grd;
    x.fillRect(0, 0, W, W);
    // colina e castelo
    x.fillStyle = '#6f8a45';
    const [hx, hz] = P(-95, -250);
    x.fillRect(hx, hz, 190 * s, 135 * s);
    x.fillStyle = '#c9bfae';
    const c0 = LAYOUT.castle;
    const [cx, cz] = P(c0.x - c0.w / 2, c0.z - c0.d / 2);
    x.fillRect(cx, cz, c0.w * s, c0.d * s);
    x.fillStyle = '#5b1f7a';
    for (const [tx, tz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const [px, pz] = P(c0.x + (tx * c0.w) / 2, c0.z + (tz * c0.d) / 2);
      x.beginPath();
      x.arc(px, pz, 7 * s + 1, 0, Math.PI * 2);
      x.fill();
    }
    // avenida
    x.fillStyle = '#b8ad98';
    const [ax, az] = P(-8, -136);
    x.fillRect(ax, az, 16 * s, 100 * s);
    // floresta
    x.fillStyle = '#2f4a22';
    const [fx, fz] = P(LAYOUT.forest.x, LAYOUT.forest.z);
    x.beginPath();
    x.arc(fx, fz, LAYOUT.forest.r * s, 0, Math.PI * 2);
    x.fill();
    // lago
    x.fillStyle = '#3f7fa6';
    const [lx, lz] = P(LAYOUT.lake.x, LAYOUT.lake.z);
    x.beginPath();
    x.arc(lx, lz, LAYOUT.lake.r * s, 0, Math.PI * 2);
    x.fill();
    // casas
    x.fillStyle = '#a5523a';
    for (const h of this.game.world.city.houses) {
      const [px, pz] = P(h.x - h.w / 2, h.z - h.d / 2);
      x.fillRect(px, pz, Math.max(1.5, h.w * s), Math.max(1.5, h.d * s));
    }
    // praça
    x.fillStyle = '#d8cdb8';
    const [ppx, ppz] = P(0, 0);
    x.beginPath();
    x.arc(ppx, ppz, LAYOUT.plaza.r * s, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#f2c14e';
    x.beginPath();
    x.arc(ppx, ppz, 3, 0, Math.PI * 2);
    x.fill();
    this.mapBase = c;
    this.mapScale = s;
  }

  drawMap() {
    const g = this.game;
    if (!g.world) return;
    if (!this.mapBase) this._buildMapBase();
    const x = this.mapCtx;
    const W = this.el.map.width;
    const s = this.mapScale;
    const P = (p) => [(p.x + MAP_R) * s, (p.z + MAP_R) * s];
    x.clearRect(0, 0, W, W);
    x.save();
    x.beginPath();
    x.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    x.clip();
    x.drawImage(this.mapBase, 0, 0);
    // personagens nomeados
    x.fillStyle = '#ffe9a8';
    for (const n of g.systems.npcs.list) {
      if (n.kind !== 'named') continue;
      const [px, pz] = P(n.position);
      x.fillRect(px - 1.5, pz - 1.5, 3, 3);
    }
    // ecos reais
    x.fillStyle = '#ffd35c';
    for (const p of g.systems.remote?.players.values() ?? []) {
      const [px, pz] = P(p.model.root.position);
      x.beginPath();
      x.arc(px, pz, 2.5, 0, Math.PI * 2);
      x.fill();
    }
    // objetivo
    const t = g.systems.quests?.target();
    if (t) {
      const [px, pz] = P(t);
      const pulse = 4 + Math.sin(g.time * 5) * 1.5;
      x.fillStyle = '#ffcc33';
      x.strokeStyle = '#3a0f52';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(px, pz - pulse - 2);
      x.lineTo(px + pulse, pz);
      x.lineTo(px, pz + pulse + 2);
      x.lineTo(px - pulse, pz);
      x.closePath();
      x.fill();
      x.stroke();
    }
    // rainha
    const q = g.systems.queen;
    const [qx, qz] = P(q.position);
    x.translate(qx, qz);
    x.rotate(-q.yaw + Math.PI);
    x.fillStyle = '#ffffff';
    x.strokeStyle = '#5b1f7a';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(0, -7);
    x.lineTo(5, 5);
    x.lineTo(0, 2);
    x.lineTo(-5, 5);
    x.closePath();
    x.fill();
    x.stroke();
    x.restore();
    // moldura
    x.strokeStyle = '#f2c14e';
    x.lineWidth = 4;
    x.beginPath();
    x.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = '#f2c14e';
    x.font = 'bold 14px Georgia, serif';
    x.textAlign = 'center';
    x.fillText('N', W / 2, 16);
  }
}
