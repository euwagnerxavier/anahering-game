import assert from 'node:assert/strict';
import { QueenModel, bakeStatic } from './src/entities/QueenModel.js';
import { buildNPCModel } from './src/entities/NPCModel.js';
import { NAMED_NPCS, COMMON_LOOKS } from './src/data/npcs.js';

function inspect(root) {
  let meshes = 0;
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh) return;
    meshes++;
    for (const a of Object.values(o.geometry.attributes)) {
      assert.ok(Array.from(a.array).every(Number.isFinite), 'finite geometry attributes');
    }
    assert.ok(o.matrixWorld.elements.every(Number.isFinite), 'finite transforms');
    assert.ok(o.material, 'material assigned');
  });
  return meshes;
}

for (const variant of ['normal', 'ghost', 'marble', 'gold']) {
  const q = new QueenModel({ variant });
  for (const state of ['idle', 'walk', 'run', 'jump', 'sit']) {
    q.wave();
    for (let i = 0; i < 120; i++) q.animate(1 / 60, { state, speed: 0.7, time: i / 60 });
    inspect(q.root);
  }
  if (variant === 'marble' || variant === 'gold') {
    inspect(bakeStatic(q.root, q.mats.gold));
    q.root.traverse(o => { if (o.isMesh) assert.equal(o.material, q.mats.gold); });
  }
}
const looks = [
  ...NAMED_NPCS.map(n => n.look),
  ...COMMON_LOOKS.hats.map((hat, i) => ({ hat, tunic: COMMON_LOOKS.tunics[i], skin: COMMON_LOOKS.skins[i % 6] })),
  { hat: 'helmet', tunic: 0x555555, skin: 0xc68e6a, spear: true, tabard: true, trim: 0xf2c14e },
];
let sharedMaterial;
for (const look of looks) {
  const npc = buildNPCModel(look);
  assert.equal(inspect(npc.root), 5, 'NPC draw mesh count preserved');
  npc.root.traverse(o => {
    if (!o.isMesh) return;
    sharedMaterial ??= o.material;
    assert.equal(o.material, sharedMaterial, 'shared NPC material');
  });
  npc.torso.rotation.x = -0.8;
  npc.arms.forEach(a => { a.rotation.x = 1; });
  npc.legs.forEach(a => { a.rotation.x = -0.5; });
  inspect(npc.root);
}
console.log(`Character verification passed: 4 queen variants, 5 animation states, ${looks.length} NPC looks.`);
