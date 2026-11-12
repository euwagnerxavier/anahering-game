import * as THREE from 'three';
import { HILL_H } from '../world/layout.js';

const npcPos = (g, id) => g.systems.npcs.byId(id)?.position;

/** Campanha principal (linear). Textos com {n} e {count} mostram o progresso. */
export const QUESTS = [
  {
    id: 'quest_awakening',
    title: 'O Despertar da Soberana',
    reward: 50,
    intro: 'O trono aguarda sua dona.',
    steps: [
      { id: 'enter_hall', text: 'Entre no Salão do Trono do Castelo Real', event: 'zone:enter', match: (p) => p.id === 'throne_hall', target: () => new THREE.Vector3(0, HILL_H, -160) },
      { id: 'sit', text: 'Sente-se no Trono Monumental  [E]', event: 'throne:sat', target: (g) => g.world.castle.seat.position },
    ],
  },
  {
    id: 'quest_speech',
    title: 'O Discurso da Praça',
    reward: 80,
    intro: 'O povo implora para ouvir a sua voz.',
    steps: [
      { id: 'talk_trombetildo', text: 'Fale com o Arauto Trombetildo na Praça da Soberana', event: 'npc:talked', match: (p) => p.id === 'trombetildo', target: (g) => npcPos(g, 'trombetildo') },
      { id: 'speech', text: 'Suba ao púlpito e discurse ao povo', event: 'speech:done', target: (g) => g.world.plaza.podium },
    ],
  },
  {
    id: 'quest_tributes',
    title: 'Tributos Perdidos',
    reward: 120,
    intro: 'Há uma crise fiscal no Mercado Real.',
    steps: [
      { id: 'talk_tributina', text: 'Fale com Dona Tributina no Mercado Real', event: 'npc:talked', match: (p) => p.id === 'tributina', target: (g) => npcPos(g, 'tributina') },
      {
        id: 'collect',
        text: 'Recolha os Cálices Dourados perdidos ({n}/{count})',
        event: 'tribute:collected',
        count: 5,
        onStart: (g) => g.world.tributes.forEach((t) => (t.mesh.visible = !t.collected)),
        target: (g) => nearest(g, g.world.tributes.filter((t) => !t.collected).map((t) => t.mesh.position)),
      },
      { id: 'return', text: 'Entregue os tributos a Dona Tributina', event: 'npc:talked', match: (p) => p.id === 'tributina', target: (g) => npcPos(g, 'tributina') },
    ],
  },
  {
    id: 'quest_statues',
    title: 'A Inspeção das Estátuas',
    reward: 120,
    intro: 'A arte do reino exige o olhar da Rainha.',
    steps: [
      { id: 'talk_escultorius', text: 'Fale com Mestre Escultorius na Avenida da Glória', event: 'npc:talked', match: (p) => p.id === 'escultorius', target: (g) => npcPos(g, 'escultorius') },
      {
        id: 'inspect',
        text: 'Inspecione as estátuas reais ({n}/{count})',
        event: 'statue:inspected',
        count: 3,
        target: (g) => nearest(g, g.world.inspectStatues.filter((s) => !g.systems.quests.flags[s.id]).map((s) => s.pos)),
      },
      { id: 'return', text: 'Volte ao Mestre Escultorius com o veredito', event: 'npc:talked', match: (p) => p.id === 'escultorius', target: (g) => npcPos(g, 'escultorius') },
    ],
  },
  {
    id: 'quest_compliments',
    title: 'O Imposto sobre Elogios',
    reward: 150,
    intro: 'Há elogios sendo sonegados no reino!',
    steps: [
      { id: 'talk_bajulacio', text: 'Fale com Sir Bajulácio na Praça da Soberana', event: 'npc:talked', match: (p) => p.id === 'bajulacio', target: (g) => npcPos(g, 'bajulacio') },
      { id: 'collect', text: 'Converse com súditos e recolha elogios tributáveis ({n}/{count})', event: 'compliment:received', count: 3, target: (g) => g.systems.npcs.nearestCommoner(g.systems.queen.position)?.position },
      { id: 'return', text: 'Declare os elogios a Sir Bajulácio', event: 'npc:talked', match: (p) => p.id === 'bajulacio', target: (g) => npcPos(g, 'bajulacio') },
    ],
  },
  {
    id: 'quest_decree',
    title: 'O Primeiro Decreto',
    reward: 150,
    intro: 'O reino precisa conhecer a sua vontade.',
    steps: [
      { id: 'issue', text: 'Sente-se no trono e emita um Decreto Real  [R]', event: 'decree:issued', target: (g) => g.world.castle.seat.position },
    ],
  },
  {
    id: 'quest_coronation',
    title: 'A Coroação Suprema',
    reward: 200,
    intro: 'O destino final de toda rainha: mais coroa.',
    steps: [
      { id: 'talk_trombetildo', text: 'O Arauto Trombetildo convoca Vossa Majestade à Praça', event: 'npc:talked', match: (p) => p.id === 'trombetildo', target: (g) => npcPos(g, 'trombetildo') },
      { id: 'ceremony', text: 'Suba ao púlpito para a Coroação Suprema', event: 'coronation:done', target: (g) => g.world.plaza.podium },
    ],
  },
];

function nearest(g, list) {
  const q = g.systems.queen.position;
  let best = null, bd = Infinity;
  for (const p of list) {
    const d = p.distanceToSquared(q);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}
