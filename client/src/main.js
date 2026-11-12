import * as THREE from 'three';
import './ui/styles.css';
import { Game } from './core/Game.js';
import { $ } from './core/utils.js';
import { World } from './world/World.js';
import { LAYOUT, HILL_H } from './world/layout.js';
import { Queen } from './entities/Queen.js';
import { NPCManager } from './entities/NPCManager.js';
import { RemotePlayers } from './entities/RemotePlayers.js';
import { CameraController } from './systems/CameraController.js';
import { Interaction } from './systems/Interaction.js';
import { Dialogue } from './systems/Dialogue.js';
import { Quests } from './systems/Quests.js';
import { Ceremony } from './systems/Ceremony.js';
import { Audio } from './systems/Audio.js';
import { Particles } from './systems/Particles.js';
import { Net } from './systems/Net.js';
import { Save } from './systems/Save.js';
import { HUD } from './ui/HUD.js';
import { DialogueUI } from './ui/DialogueUI.js';
import { DecreeUI } from './ui/DecreeUI.js';

function boot() {
  const container = $('#app');
  let game;
  try {
    game = new Game(container);
  } catch (err) {
    console.error(err);
    $('#loading').textContent = 'Seu navegador não suporta WebGL2. A Rainha lamenta profundamente.';
    return;
  }
  window.__game = game; // depuração

  const saved = Save.load();
  // ordem de registro = ordem de update
  game.addSystem('hud', new HUD(game));
  game.addSystem('interaction', new Interaction(game));
  game.world = new World(game);
  game.addSystem('world', game.world);
  game.addSystem('dialogueUI', new DialogueUI());
  game.addSystem('dialogue', new Dialogue(game));
  // a interação roda depois do diálogo (ver Input.consume)
  game.order.splice(game.order.indexOf('interaction'), 1);
  game.order.push('interaction');
  const spawn = new THREE.Vector3(LAYOUT.spawn.x, HILL_H, LAYOUT.spawn.z);
  game.addSystem('queen', new Queen(game, spawn));
  game.addSystem('npcs', new NPCManager(game));
  game.addSystem('remote', new RemotePlayers(game));
  game.addSystem('camera', new CameraController(game));
  game.addSystem('quests', new Quests(game, saved?.quests));
  game.addSystem('ceremony', new Ceremony(game));
  game.addSystem('audio', new Audio(game));
  game.addSystem('particles', new Particles(game));
  game.addSystem('net', new Net(game));
  game.addSystem('decree', new DecreeUI(game));
  // HUD por último para projetar balões com a câmera já atualizada
  game.order.splice(game.order.indexOf('hud'), 1);
  game.order.push('hud');

  registerWorldInteractions(game);
  wireSaving(game);
  wireMenus(game, saved);

  game.systems.decree.refreshWorld();
  game.systems.hud.show(false);
  $('#loading').classList.add('hidden');
  $('#title-screen').classList.add('visible');
  game.start();
}

function registerWorldInteractions(game) {
  const I = game.systems.interaction;
  const w = game.world;
  const S = game.systems;
  I.register({
    id: 'throne',
    position: w.castle.seat.standPos,
    radius: 3.2,
    priority: 3,
    label: 'Sentar no Trono Monumental',
    onInteract: () => S.queen.sitOnThrone(w.castle.seat),
  });
  I.register({
    id: 'podium',
    position: w.plaza.podium,
    radius: 3.4,
    priority: 3,
    enabled: () => !S.ceremony.busy,
    label: () => (S.quests.isAt('quest_coronation', 'ceremony') ? 'Iniciar a Coroação Suprema' : 'Discursar ao povo'),
    onInteract: () => S.dialogue.open('podium', { focus: new THREE.Vector3(0, 0, 0) }),
  });
  I.register({
    id: 'mural',
    position: w.plaza.muralPos,
    radius: 4,
    priority: 1,
    label: 'Ler o Mural de Lealdade',
    onInteract: () => S.decree.openMural(),
  });
  for (const st of w.inspectStatues) {
    I.register({
      id: st.id,
      position: st.pos,
      radius: 3.6,
      priority: 1,
      label: () => (S.quests.isAt('quest_statues', 'inspect') && !S.quests.flags[st.id] ? 'Inspecionar estátua real' : 'Admirar a estátua'),
      onInteract: () => S.dialogue.open('statue', { statue: st, focus: st.pos }),
    });
  }
}

function wireSaving(game) {
  let timer = null;
  game.events.on('save:request', () => {
    if (game.mode === 'title') return;
    clearTimeout(timer);
    timer = setTimeout(() => Save.write({ quests: game.systems.quests.serialize(), nickname: game.systems.net.nickname }), 800);
  });
}

function wireMenus(game, saved) {
  const S = game.systems;
  const title = $('#title-screen');
  const nick = $('#nickname');
  const cont = $('#btn-continue');
  const newBtn = $('#btn-new');
  const pause = $('#pause');
  nick.value = saved?.nickname || localStorage.getItem('anahering.nick') || '';
  const hasProgress = saved?.quests && (saved.quests.index > 0 || saved.quests.step > 0 || saved.quests.prestige > 0);
  cont.classList.toggle('hidden', !hasProgress);
  newBtn.textContent = hasProgress ? 'Novo Reinado' : 'Assumir o Trono';

  const begin = async (fresh) => {
    const name = (nick.value || '').trim().slice(0, 20) || 'Súdito Anônimo';
    try {
      localStorage.setItem('anahering.nick', name);
    } catch {
      /* ignora */
    }
    S.audio.init();
    S.net.connect(name);
    title.classList.remove('visible');
    S.hud.show(true);
    game.input.requestLock();
    if (fresh) {
      Save.clear();
      S.quests.reset();
      await S.ceremony.intro();
    } else {
      game.setMode('play');
      S.camera.yaw = Math.PI;
    }
    S.quests.start();
  };
  newBtn.addEventListener('click', () => begin(true));
  cont.addEventListener('click', () => begin(false));
  nick.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') begin(!hasProgress);
  });

  // clicar no canvas captura o mouse
  game.gfx.canvas.addEventListener('click', () => {
    if (game.mode === 'play' && !game.paused) game.input.requestLock();
  });

  const setPaused = (on) => {
    game.paused = on;
    pause.classList.toggle('visible', on);
    if (on && document.pointerLockElement) document.exitPointerLock();
    $('#opt-music').textContent = `Música: ${S.audio.musicOn ? 'ligada' : 'desligada'}`;
    $('#opt-quality').value = game.gfx.quality;
  };
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Escape') {
      if (game.mode === 'dialogue') return S.dialogue.close();
      if (game.mode === 'play' || game.paused) setPaused(!game.paused);
    }
    if (e.code === 'KeyM' && game.mode !== 'title') {
      const on = S.audio.toggleMusic();
      S.hud.toast(on ? '🎺 Música real ligada' : '🔇 Música real silenciada');
    }
  });
  $('#opt-resume').addEventListener('click', () => {
    setPaused(false);
    game.input.requestLock();
  });
  $('#opt-music').addEventListener('click', () => {
    S.audio.toggleMusic();
    setPaused(true);
  });
  $('#opt-quality').addEventListener('change', (e) => {
    game.gfx.autoQuality = false;
    game.gfx.setQuality(e.target.value);
  });
  $('#opt-mural').addEventListener('click', () => {
    setPaused(false);
    S.decree.openMural();
  });
  $('#opt-restart').addEventListener('click', () => {
    if (!confirm('Recomeçar a campanha? O prestígio e as missões serão zerados.')) return;
    Save.clear();
    location.reload();
  });
  game.events.on('game:mode', ({ mode }) => document.body.dataset.mode = mode);
}

boot();
