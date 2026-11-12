import { $, escapeHtml } from '../core/utils.js';

const LOCAL_KEY = 'anahering.localDecrees';

/** Modal de Decreto Real + painel do Mural de Lealdade. */
export class DecreeUI {
  constructor(game) {
    this.game = game;
    this.modal = $('#decree-modal');
    this.input = $('#decree-text');
    this.count = $('#decree-count');
    this.status = $('#decree-status');
    this.send = $('#decree-send');
    this.mural = $('#mural-panel');
    this.list = $('#mural-list');
    this.decrees = [];
    this.prevMode = 'play';

    this.input.addEventListener('input', () => (this.count.textContent = `${[...this.input.value].length}/140`));
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.submit();
      } else if (e.key === 'Escape') this.close();
    });
    this.send.addEventListener('click', () => this.submit());
    $('#decree-cancel').addEventListener('click', () => this.close());
    $('#mural-close').addEventListener('click', () => this.closeMural());
    this.list.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-report]');
      if (!b) return;
      b.disabled = true;
      b.textContent = 'Denunciado';
      await game.systems.net.report(b.dataset.report);
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.mural.classList.contains('visible')) this.closeMural();
    });

    game.events.on('net:decree', (d) => {
      if (!this.decrees.find((x) => x.id === d.id)) this.decrees.unshift(d);
      this.refreshWorld();
      if (d.author !== game.systems.net.nickname) game.systems.hud.toast(`📜 Novo decreto de ${d.author}: “${d.text}”`, 6000);
    });
    game.events.on('net:welcome', () => this.load());
  }

  get localDecrees() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    } catch {
      return [];
    }
  }

  async load() {
    const remote = await this.game.systems.net.fetchDecrees(30);
    if (remote) this.decrees = remote;
    this.refreshWorld();
  }

  all() {
    return [...this.decrees, ...this.localDecrees.map((d) => ({ ...d, local: true }))].sort((a, b) => b.createdAt - a.createdAt);
  }

  refreshWorld() {
    this.game.world.plaza.drawMural(this.all());
  }

  open() {
    const g = this.game;
    if (g.mode === 'modal') return;
    this.prevMode = g.mode;
    g.setMode('modal');
    if (document.pointerLockElement) document.exitPointerLock();
    this.modal.classList.add('visible');
    this.status.textContent = '';
    this.status.className = '';
    this.input.value = '';
    this.count.textContent = '0/140';
    setTimeout(() => this.input.focus(), 50);
  }

  close() {
    this.modal.classList.remove('visible');
    this.input.blur();
    if (this.game.mode === 'modal') this.game.setMode(this.prevMode === 'modal' ? 'play' : this.prevMode);
  }

  async submit() {
    const text = this.input.value.trim();
    if ([...text].length < 3) {
      this.status.textContent = 'Um decreto real precisa de pelo menos 3 letras, Majestade.';
      this.status.className = 'err';
      return;
    }
    this.send.disabled = true;
    this.status.textContent = 'O Arauto corre até o Mural…';
    this.status.className = '';
    const res = await this.game.systems.net.postDecree(text);
    this.send.disabled = false;
    const g = this.game;
    if (res.ok) {
      if (!this.decrees.find((x) => x.id === res.decree.id)) this.decrees.unshift(res.decree);
      g.systems.hud.toast('📜 Decreto publicado no Mural de Lealdade para todos os reinos!');
    } else if (res.offline) {
      const local = this.localDecrees;
      local.unshift({ id: `local-${Date.now()}`, author: g.systems.net.nickname, text: text.slice(0, 140), createdAt: Date.now() });
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(local.slice(0, 20)));
      } catch {
        /* ignora */
      }
      g.systems.hud.toast('📜 Decreto guardado nos Arquivos Reais (modo offline).');
    } else {
      this.status.textContent = res.error;
      this.status.className = 'err';
      return;
    }
    this.refreshWorld();
    this.close();
    g.systems.audio.sfx('decree');
    g.systems.hud.announce('DECRETO REAL', `“${text.slice(0, 140)}”`, 'Assim está escrito. Assim será.');
    g.events.emit('decree:issued', { text });
  }

  async openMural() {
    const g = this.game;
    this.prevMode = g.mode;
    g.setMode('modal');
    if (document.pointerLockElement) document.exitPointerLock();
    this.mural.classList.add('visible');
    this.list.innerHTML = '<p class="muted">O Arauto está desenrolando os pergaminhos…</p>';
    await this.load();
    const all = this.all();
    this.list.innerHTML = all.length
      ? all
          .map(
            (d) => `<li><div class="d-author">⚜ ${escapeHtml(d.author)} <span class="d-date">${new Date(d.createdAt).toLocaleString('pt-BR')}</span></div>
        <div class="d-text">“${escapeHtml(d.text)}”</div>
        ${d.local ? '<span class="d-local">guardado localmente</span>' : `<button data-report="${Number(d.id)}" title="Denunciar conteúdo impróprio">Denunciar</button>`}</li>`
          )
          .join('')
      : '<p class="muted">Nenhum decreto ainda. Sente-se no trono e pressione [R] para ser a primeira!</p>';
  }

  closeMural() {
    this.mural.classList.remove('visible');
    if (this.game.mode === 'modal') this.game.setMode('play');
  }
}
