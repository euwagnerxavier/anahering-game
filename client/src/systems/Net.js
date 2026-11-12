/**
 * Cliente de rede: REST (Mural de Lealdade) + WebSocket (Ecos Reais, Aplausômetro, eventos).
 * Tolerante a falhas: o jogo funciona 100% offline.
 */
export class Net {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.id = null;
    this.online = false;
    this.backoff = 1000;
    this.sendAcc = 0;
    this.pingAcc = 0;
    this.last = '';
    this.nickname = 'Súdito';
    this.disabled = new URLSearchParams(location.search).has('offline');
    game.events.on('queen:wave', () => this.send({ t: 'applaud' }));
    game.events.on('speech:done', () => this.send({ t: 'applaud' }));
  }

  connect(nickname) {
    this.nickname = nickname;
    if (this.disabled) return this._status(false);
    this._open();
  }

  _open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let ws;
    try {
      ws = this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    } catch {
      return this._retry();
    }
    ws.onopen = () => {
      this.backoff = 1000;
      ws.send(JSON.stringify({ t: 'hello', name: this.nickname }));
    };
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      this._handle(m);
    };
    ws.onclose = () => {
      this._status(false);
      this.game.events.emit('net:reset');
      this._retry();
    };
    ws.onerror = () => {};
  }

  _retry() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this._open(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 30000);
  }

  _status(on) {
    this.online = on;
    this.game.events.emit('net:status', { online: on });
  }

  _handle(m) {
    const ev = this.game.events;
    switch (m.t) {
      case 'welcome':
        this.id = m.id;
        this._status(true);
        ev.emit('net:welcome', m);
        ev.emit('net:applause', { total: m.applause });
        break;
      case 'snap':
        ev.emit('net:snap', m.s.filter((e) => e[0] !== this.id));
        break;
      case 'join':
        ev.emit('net:join', m);
        break;
      case 'leave':
        ev.emit('net:leave', m);
        break;
      case 'decree':
        ev.emit('net:decree', m.decree);
        break;
      case 'applause':
        ev.emit('net:applause', { total: m.total });
        break;
      case 'event':
        ev.emit('net:event', m);
        break;
    }
  }

  send(msg) {
    if (this.ws?.readyState === 1 && this.online) this.ws.send(JSON.stringify(msg));
  }

  // ---------- REST
  async fetchDecrees(limit = 20) {
    try {
      const r = await fetch(`/api/decrees?limit=${limit}`);
      if (!r.ok) throw new Error(r.status);
      return (await r.json()).decrees;
    } catch {
      return null;
    }
  }

  /** @returns {Promise<{ok:true, decree}|{ok:false, error:string, offline?:boolean}>} */
  async postDecree(text) {
    try {
      const r = await fetch('/api/decrees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: this.nickname, text }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok) return { ok: true, decree: body.decree };
      return { ok: false, error: body.error || 'O Conselho Real rejeitou o decreto.' };
    } catch {
      return { ok: false, offline: true, error: 'O mensageiro real não encontrou o servidor (modo offline).' };
    }
  }

  async report(id) {
    try {
      await fetch(`/api/decrees/${id}/report`, { method: 'POST' });
      return true;
    } catch {
      return false;
    }
  }

  update(dt) {
    if (!this.online) return;
    const q = this.game.systems.queen;
    this.sendAcc += dt;
    this.pingAcc += dt;
    if (this.sendAcc >= 0.1) {
      this.sendAcc = 0;
      const p = q.position;
      const msg = { t: 'pos', p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], r: +q.yaw.toFixed(2), a: q.animCode };
      const s = JSON.stringify(msg);
      if (s !== this.last) {
        this.last = s;
        this.pingAcc = 0;
        this.ws.send(s);
      }
    }
    if (this.pingAcc > 20) {
      this.pingAcc = 0;
      this.send({ t: 'ping' });
    }
  }
}
