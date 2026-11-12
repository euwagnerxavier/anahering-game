// Constantes do mapa do Reino de Heringuia. Norte = -Z, Sul = +Z.
export const HILL_H = 18;

export const LAYOUT = {
  plaza: { x: 0, z: 0, r: 36 },
  avenue: { halfWidth: 8, z0: -36, z1: -136 },
  castle: { x: 0, z: -180, w: 72, d: 56, wallH: 24, gateW: 10, gateH: 12 },
  podium: { x: 0, z: -27 },
  mural: { x: -31, z: 8 },
  market: { x: 52, z: 2 },
  lake: { x: 112, z: 108, r: 24 },
  forest: { x: -115, z: 110, r: 70 },
  hiddenStatue: { x: -128, z: 128 },
  spawn: { x: 0, z: -140 },
  tributes: [
    { id: 'tribute_1', x: -98, z: -42 },
    { id: 'tribute_2', x: 136, z: 74 },
    { id: 'tribute_3', x: -52, z: 150 },
    { id: 'tribute_4', x: 56, z: -196 },
    { id: 'tribute_5', x: 22, z: 104 },
  ],
};
