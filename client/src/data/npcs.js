import { HILL_H, LAYOUT } from '../world/layout.js';

// Personagens nomeados. `look` descreve o visual procedural.
export const NAMED_NPCS = [
  {
    id: 'puxassaco',
    name: 'Conselheiro Puxassaco',
    role: 'Guardião do Trono',
    pos: { x: 4.2, y: HILL_H + 1.6, z: -199 },
    rotY: -Math.PI / 2,
    dialogue: 'puxassaco',
    look: { tunic: 0x1c1a24, trim: 0xf2c14e, skin: 0xe8b996, hat: 'tall', hatColor: 0x1c1a24, chain: true, height: 1.05 },
  },
  {
    id: 'trombetildo',
    name: 'Arauto Trombetildo',
    role: 'Anunciador Oficial',
    pos: { x: 5.5, y: 0, z: LAYOUT.podium.z + 2 },
    rotY: -0.6,
    dialogue: 'trombetildo',
    look: { tunic: 0x9e1b32, trim: 0xf2c14e, skin: 0xf0c4a4, hat: 'feather', hatColor: 0x5b1f7a, trumpet: true },
  },
  {
    id: 'bajulacio',
    name: 'Sir Bajulácio',
    role: 'Ministro da Bajulação Oficial',
    pos: { x: -15, y: 0, z: 15 },
    rotY: 2.4,
    dialogue: 'bajulacio',
    look: { tunic: 0x5b1f7a, trim: 0xf2c14e, skin: 0xf3cfb3, hat: 'wig', hatColor: 0xf5f2ea, height: 0.95 },
  },
  {
    id: 'tributina',
    name: 'Dona Tributina',
    role: 'Cobradora do Imposto sobre Elogios',
    pos: { x: LAYOUT.market.x - 1, y: 0, z: LAYOUT.market.z },
    rotY: -Math.PI / 2,
    dialogue: 'tributina',
    look: { tunic: 0x2f7a4a, trim: 0xf2c14e, skin: 0xd9a27e, hat: 'hood', hatColor: 0x1f5a35, bag: true, dress: true },
  },
  {
    id: 'escultorius',
    name: 'Mestre Escultorius',
    role: 'Escultor Real (347 bustos e contando)',
    pos: { x: 18.4, y: 0, z: -59 },
    rotY: Math.PI / 2,
    dialogue: 'escultorius',
    look: { tunic: 0xe9e2d0, trim: 0x8a6a3a, skin: 0xc68e6a, hat: 'beret', hatColor: 0x3a3a6a, chisel: true },
  },
  {
    id: 'fofocarda',
    name: 'Velha Fofocarda',
    role: 'A única que já viu a Rainha piscar',
    pos: { x: LAYOUT.hiddenStatue.x + 6, y: 0, z: LAYOUT.hiddenStatue.z - 5 },
    rotY: -2.2,
    dialogue: 'fofocarda',
    look: { tunic: 0x7a5a8a, trim: 0xd9c9a0, skin: 0xe2b494, hat: 'bun', hatColor: 0xcfcfcf, cane: true, dress: true, height: 0.88 },
  },
];

export const COMMON_LOOKS = {
  tunics: [0x8a3b2a, 0x3a5a8a, 0x5a7a3a, 0x8a6a2a, 0x6a3a6a, 0x2a6a6a, 0xa05a3a, 0x4a4a6a, 0x9a8a5a],
  skins: [0xf0c4a4, 0xe0ac86, 0xc68e6a, 0x9c6a4a, 0x7a4e34, 0xf3d4bc],
  hats: ['none', 'none', 'cap', 'beret', 'hood', 'straw', 'bun', 'none'],
  hatColors: [0x6b4426, 0x3a3a3a, 0x9e1b32, 0x2f5a3a, 0xd9b45a, 0x5b1f7a],
};
