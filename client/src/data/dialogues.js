// Diálogos declarativos. Nós: { speaker?, text, choices?: [{ text, next?, action? }], next?, action? }
// `text`, `start` e `next` podem ser funções (game, ctx) => valor.

export const SPEAKERS = {
  queen: { name: 'Ana Hering', title: 'Rainha Absoluta', color: '#f2c14e', icon: '👑' },
  narrator: { name: 'O Reino', title: '', color: '#d8c7ff', icon: '⚜' },
  puxassaco: { name: 'Conselheiro Puxassaco', title: 'Guardião do Trono', color: '#bfb7d9', icon: '🎩' },
  trombetildo: { name: 'Arauto Trombetildo', title: 'Anunciador Oficial', color: '#ff8a8a', icon: '🎺' },
  bajulacio: { name: 'Sir Bajulácio', title: 'Ministro da Bajulação Oficial', color: '#d9a8ff', icon: '🙇' },
  tributina: { name: 'Dona Tributina', title: 'Cobradora do Imposto sobre Elogios', color: '#9fe0b4', icon: '💰' },
  escultorius: { name: 'Mestre Escultorius', title: 'Escultor Real', color: '#e8dcc0', icon: '🗿' },
  fofocarda: { name: 'Velha Fofocarda', title: 'Testemunha Ocular', color: '#e0c0e8', icon: '👵' },
  commoner: { name: 'Súdito', title: 'Cidadão de Heringuia', color: '#e8d9b8', icon: '🙂' },
};

const COMPLIMENTS = [
  'Majestade, a senhora é tão luminosa que eu economizo vela só de lembrar.',
  'Se elegância fosse imposto, a senhora sustentaria o reino sozinha!',
  'Vossa Majestade tem o perfil perfeito para moedas, selos e montanhas.',
  'Eu sonhei com a senhora. No sonho, a senhora também era rainha.',
  'Sua capa tem mais nobreza que a minha família inteira!',
  'A senhora anda como quem já sabe que o chão é seu. E é!',
  'Até meu bode fez reverência quando a senhora passou.',
];
const SMALLTALK = [
  'Majestade! Eu... eu... *desmaia de emoção e levanta de novo*',
  'Hoje acordei e pensei: que sorte viver no mesmo século que a Rainha!',
  'Pintei minha casa de dourado em sua homenagem. A vizinha pintou duas.',
  'Dizem que a senhora não precisa dormir. O sono é que precisa da senhora.',
  'Majestade, posso contar aos meus netos que a senhora falou comigo? Vou contar mesmo se a senhora disser não.',
  'Estamos todos muito felizes. Por decreto, mas também de coração!',
];

export function buildDialogues(game) {
  const Q = () => game.systems.quests;
  const at = (q, s) => Q().isAt(q, s);
  const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
  const ceremony = () => game.systems.ceremony;

  return {
    puxassaco: {
      speaker: 'puxassaco',
      start: () => (at('quest_awakening', 'sit') || at('quest_awakening', 'enter_hall') ? 'awaken' : at('quest_decree', 'issue') ? 'decree' : 'idle'),
      nodes: {
        awaken: { text: 'Majestade! O trono sentiu a sua falta. Literalmente: ele range de saudade quando a senhora se afasta.', next: 'awaken2' },
        awaken2: {
          text: 'Por favor, sente-se. Os súditos não conseguem respirar direito sem saber que a senhora está confortável.',
          choices: [{ text: 'Muito bem, Puxassaco. O trono pode parar de ranger.' }],
        },
        decree: {
          text: 'Majestade, o povo clama por um Decreto Real! Sente-se no trono e pressione [R] para ditar sua vontade. Eu anoto tudo. Com caligrafia dourada.',
          choices: [{ text: 'Prepare a tinta dourada.' }],
        },
        idle: {
          text: 'Permita-me dizer, Majestade: magnífica. Eu digo isso 300 vezes por dia e ainda acho pouco.',
          choices: [{ text: 'Pode dizer mais vezes.', next: 'idle2' }, { text: 'Obrigada, Conselheiro.' }],
        },
        idle2: { text: 'Magnífica. Magnífica. Magnífica... Preciso de água. ...Magnífica.' },
      },
    },

    trombetildo: {
      speaker: 'trombetildo',
      start: () => (at('quest_speech', 'talk_trombetildo') ? 'offer' : at('quest_coronation', 'talk_trombetildo') ? 'coronation' : 'idle'),
      nodes: {
        offer: {
          text: '♪ TARARÁÁÁ! ♪ Atenção, povo de Heringuia! Sua Majestade, a Rainha Absoluta Ana Hering, Soberana de Tudo e de Mais Um Pouco, honra a praça com a sua presença!',
          next: 'offer2',
        },
        offer2: {
          text: 'Majestade, o povo ensaia aplausos desde as cinco da manhã. Um discurso no púlpito faria todos chorarem por semanas.',
          choices: [{ text: 'Que se prepare o povo. Vou discursar.' }, { text: 'Que chorem só por alguns dias. Não exageremos.', next: 'offer3' }],
        },
        offer3: { text: 'Dias?! Vossa Majestade é tão humilde que eu vou chorar agora mesmo. *buáá* — O púlpito aguarda!' },
        coronation: { text: '♪ TARARÁÁÁ-TÁ-TÁÁÁ! ♪ Majestade! O reino inteiro concorda: chegou a hora da COROAÇÃO SUPREMA!', next: 'coronation2' },
        coronation2: {
          text: 'Vamos coroar a sua coroa com outra coroa. Os ourives garantem que é tecnicamente possível. Suba ao púlpito quando desejar!',
          choices: [{ text: 'Uma coroa sobre a coroa. Finalmente alguém com visão.' }],
        },
        idle: {
          text: (g) => pick(['♪ Tarará! ♪ Anunciando: a Rainha está aqui. Repito: A RAINHA ESTÁ AQUI.', 'Eu ensaio trombeta 14 horas por dia. As outras 10 eu passo anunciando.', 'Já anunciei a senhora 4.812 vezes hoje. Meta: 5.000!'], Math.floor(g.time)),
          choices: [{ text: 'Continue anunciando.' }],
        },
      },
    },

    bajulacio: {
      speaker: 'bajulacio',
      start: () => (at('quest_compliments', 'talk_bajulacio') ? 'offer' : at('quest_compliments', 'return') ? 'return' : at('quest_compliments', 'collect') ? 'reminder' : 'idle'),
      nodes: {
        offer: { text: 'Majestade! Sir Bajulácio, Ministro da Bajulação Oficial, a seus pés. E também às suas mãos, ao seu cetro e à sua sombra.', next: 'offer2' },
        offer2: { text: 'Temos uma crise: o Imposto sobre Elogios não está sendo recolhido! Os súditos elogiam a senhora o tempo todo, mas ninguém declara.', next: 'offer3' },
        offer3: {
          text: 'Converse com três súditos e receba os elogios oficialmente. Cada elogio recolhido é patrimônio do reino!',
          choices: [{ text: 'Recolherei cada elogio pessoalmente.' }, { text: 'E se eles não me elogiarem?', next: 'offer4' }],
        },
        offer4: { text: 'Hahaha! Majestade é tão engraçada! ...Era uma piada, certo? CERTO?' },
        reminder: { text: 'Converse com qualquer súdito, Majestade. Eles estão LOUCOS para elogiar. Alguns já elogiaram até a estátua achando que era a senhora.' },
        return: { text: 'Três elogios declarados! O tesouro real nunca esteve tão cheio de... palavras bonitas. Vou emoldurá-los em ouro.' },
        idle: { text: 'Majestade, se a senhora fosse um pouco mais majestosa, o reino precisaria de um reino maior.' },
      },
    },

    tributina: {
      speaker: 'tributina',
      start: () =>
        at('quest_tributes', 'talk_tributina') ? 'offer' : at('quest_tributes', 'return') ? 'return' : at('quest_tributes', 'collect') ? 'reminder' : 'idle',
      nodes: {
        offer: { text: 'Ai, Majestade! Que desgraça fiscal! Os Cinco Cálices Dourados da Arrecadação sumiram!', next: 'offer2' },
        offer2: {
          text: 'Um caiu do bolso de um ministro, outro rolou ladeira abaixo, outro foi parar no bosque... e dois eu nem sei. Sigam os feixes de luz dourada pelo reino!',
          choices: [{ text: 'Ninguém perde os tributos da Rainha. Eu mesma vou buscá-los.' }],
        },
        reminder: { text: 'Ainda faltam cálices, Majestade! Procure os feixes de luz dourada no céu — e o marcador no mapa.' },
        return: { text: 'OS CINCO CÁLICES! Majestade, a senhora é a primeira monarca da história que coleta os próprios impostos. Revolucionário! Assustador! Magnífico!' },
        idle: { text: 'Imposto sobre elogios, sobre suspiros, sobre olhar a coroa por mais de 3 segundos... Este último é o que mais arrecada.' },
      },
    },

    escultorius: {
      speaker: 'escultorius',
      start: () =>
        at('quest_statues', 'talk_escultorius') ? 'offer' : at('quest_statues', 'return') ? 'return' : at('quest_statues', 'inspect') ? 'reminder' : 'idle',
      nodes: {
        offer: { text: 'Majestade! Mestre Escultorius, criador de 347 bustos, 92 estátuas e 1 estátua de uma estátua da senhora.', next: 'offer2' },
        offer2: { text: 'O Conselho exige uma inspeção real das três obras mais importantes: o Colosso Dourado da Praça, a Guardiã do Portão Real e... a Rainha Secreta do Bosque.', next: 'offer3' },
        offer3: {
          text: 'Visite cada uma e diga se ficaram à sua altura. Spoiler: nada fica à sua altura, mas eu tentei.',
          choices: [{ text: 'Inspecionarei com rigor absoluto.' }],
        },
        reminder: { text: 'Faltam estátuas para inspecionar, Majestade. A do bosque está bem escondida, perto da Velha Fofocarda, a sudoeste.' },
        return: { text: 'A senhora aprovou TODAS? Vou esculpir uma estátua comemorativa da senhora aprovando estátuas!' },
        idle: { text: 'Estou no busto 348. Neste, a coroa é ainda maior. A coroa tem a sua própria coroa.' },
      },
    },

    fofocarda: {
      speaker: 'fofocarda',
      start: 'idle',
      nodes: {
        idle: {
          text: 'Psiu, Majestade! Sabia que a senhora piscou em 1987? Eu vi. Ninguém acredita em mim.',
          choices: [{ text: 'Rainhas não piscam. Os olhos apenas descansam majestosamente.', next: 'f2' }, { text: 'Guarde segredo.', next: 'f3' }],
        },
        f2: { text: 'Foi o que o Conselheiro disse! Com essas mesmas palavras! Ele deve ser muito sábio.' },
        f3: { text: 'Levarei para o túmulo, Majestade! Mas antes vou contar só pra minha vizinha, que conta só pra vizinha dela...' },
      },
    },

    commoner: {
      speaker: 'commoner',
      start: (g, ctx) => (at('quest_compliments', 'collect') && !Q().flags[`compliment_${ctx.npc.id}`] ? 'compliment' : 'talk'),
      nodes: {
        compliment: {
          text: (g, ctx) => `${pick(COMPLIMENTS, ctx.npc.seed)}\n\n✦ Elogio tributável recolhido! ✦`,
          action: (g, ctx) => {
            Q().flags[`compliment_${ctx.npc.id}`] = true;
            g.events.emit('compliment:received', { npcId: ctx.npc.id });
          },
          choices: [{ text: 'Elogio aceito. Pode continuar me admirando.' }],
        },
        talk: {
          text: (g, ctx) => pick(SMALLTALK, ctx.npc.seed + Math.floor(g.time / 20)),
          choices: [{ text: 'Muito bem, súdito.' }, { text: 'Continue sendo leal.' }],
        },
      },
    },

    podium: {
      speaker: 'narrator',
      start: () => (at('quest_coronation', 'ceremony') ? 'coronation' : 'speech'),
      nodes: {
        speech: {
          text: 'O povo se cala. Mil olhos brilham. Um bebê para de chorar só para ouvir. O que Vossa Majestade dirá?',
          choices: [
            { text: '“Povo de Heringuia! Decreto que amanhã também será hoje!”', action: () => ceremony().speech(0) },
            { text: '“Prometo baixar os impostos... sobre os elogios a mim. Elogiem à vontade!”', action: () => ceremony().speech(1) },
            { text: '“Eu poderia dizer muita coisa. Mas basta olharem para mim.”', action: () => ceremony().speech(2) },
          ],
        },
        coronation: {
          text: 'Os sinos tocam. O Arauto treme. O ourives segura a Coroa Sobre a Coroa com as duas mãos e uma oração.',
          choices: [{ text: 'Que comece a Coroação Suprema!', action: () => ceremony().coronation() }],
        },
      },
    },

    statue: {
      speaker: 'narrator',
      start: 'look',
      nodes: {
        look: {
          text: (g, ctx) => `Vossa Majestade observa ${ctx.statue.name}. O silêncio é absoluto. Até o vento espera o veredito.`,
          choices: [
            { text: 'Aprovada.', action: (g, ctx) => inspect(g, ctx, 0) },
            { text: 'Aprovada com louvor. Está quase tão bonita quanto eu.', action: (g, ctx) => inspect(g, ctx, 5) },
            { text: 'Faltou brilho. Mas aprovo, porque sou eu.', action: (g, ctx) => inspect(g, ctx, 0) },
          ],
        },
      },
    },
  };
}

function inspect(g, ctx, bonus) {
  const Q = g.systems.quests;
  // só conta durante a missão (antes disso é apenas admiração)
  if (!Q.isAt('quest_statues', 'inspect') || Q.flags[ctx.statue.id]) return;
  Q.flags[ctx.statue.id] = true;
  if (bonus) Q.addPrestige(bonus, 'Louvor artístico');
  g.events.emit('statue:inspected', { id: ctx.statue.id });
}
