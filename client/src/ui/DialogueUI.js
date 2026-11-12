import { $, escapeHtml } from '../core/utils.js';

/** Caixa de diálogo com texto em máquina de escrever e escolhas. */
export class DialogueUI {
  constructor() {
    this.el = $('#dialogue');
    this.name = $('#dlg-name');
    this.role = $('#dlg-role');
    this.icon = $('#dlg-icon');
    this.text = $('#dlg-text');
    this.choices = $('#dlg-choices');
    this.hint = $('#dlg-hint');
    this.data = null;
    this.full = '';
    this.shown = 0;
    this.timer = null;
  }

  show(data) {
    this.data = data;
    this.el.classList.add('visible');
    this.name.textContent = data.speaker?.name ?? '';
    this.name.style.color = data.speaker?.color ?? '#fff';
    this.role.textContent = data.speaker?.title ?? '';
    this.icon.textContent = data.speaker?.icon ?? '⚜';
    this.icon.style.borderColor = data.speaker?.color ?? '#f2c14e';
    this.full = data.text ?? '';
    this.shown = 0;
    this.text.textContent = '';
    this.choices.innerHTML = '';
    this.hint.textContent = '';
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.shown += 2;
      if (this.shown >= this.full.length) this.finishTyping();
      else this.text.textContent = this.full.slice(0, this.shown);
    }, 28);
  }

  get typing() {
    return this.shown < this.full.length;
  }

  finishTyping() {
    clearInterval(this.timer);
    this.shown = this.full.length;
    this.text.textContent = this.full;
    const d = this.data;
    if (d.choices) {
      this.choices.innerHTML = d.choices
        .map((c, i) => `<button class="choice" data-i="${i}"><span class="key">${i + 1}</span>${escapeHtml(c)}</button>`)
        .join('');
      this.choices.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.choose(Number(b.dataset.i))));
      this.hint.textContent = 'Escolha com 1, 2, 3 ou clique';
    } else this.hint.textContent = '[E] continuar';
  }

  advance() {
    if (!this.data) return;
    if (this.typing) return this.finishTyping();
    if (this.data.canContinue) this.data.onContinue();
  }

  choose(i) {
    if (!this.data?.choices) return;
    if (this.typing) return this.finishTyping();
    if (i < 0 || i >= this.data.choices.length) return;
    const d = this.data;
    d.onChoice(i);
  }

  hide() {
    clearInterval(this.timer);
    this.data = null;
    this.el.classList.remove('visible');
  }
}
