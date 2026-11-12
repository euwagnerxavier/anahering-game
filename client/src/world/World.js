import * as THREE from 'three';
import { createMaterials } from './Materials.js';
import { buildTerrain, terrainHeight } from './Terrain.js';
import { buildSky } from './Sky.js';
import { createFlagSystem } from './Flags.js';
import { buildCastle } from './Castle.js';
import { buildPlaza } from './Plaza.js';
import { buildCity } from './City.js';
import { buildNature } from './Nature.js';
import { buildStatue } from './Statue.js';
import { LAYOUT, HILL_H } from './layout.js';

/** Constrói o Reino de Heringuia e expõe as âncoras de gameplay. */
export class World {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    const materials = (this.materials = createMaterials(game.gfx.renderer));
    const flags = (this.flags = createFlagSystem(materials.flag));
    const ctx = {
      scene,
      physics: game.physics,
      materials,
      game,
      flags,
      heightAt: terrainHeight,
      flowerBeds: [],
      addFlag: (p, pos, w, h, r) => flags.addFlag(p, pos, w, h, r),
      addBanner: (p, pos, w, h, r) => flags.addBanner(p, pos, w, h, r),
    };
    this.heightAt = terrainHeight;
    this.updaters = [];

    this.updaters.push(buildTerrain(ctx));
    this.sky = buildSky(ctx);
    this.updaters.push(this.sky);
    this.castle = buildCastle(ctx);
    this.updaters.push(this.castle);
    this.plaza = buildPlaza(ctx);
    this.updaters.push(this.plaza);
    this.city = buildCity(ctx);
    this.hiddenStatue = buildStatue(ctx, {
      x: LAYOUT.hiddenStatue.x,
      y: terrainHeight(LAYOUT.hiddenStatue.x, LAYOUT.hiddenStatue.z),
      z: LAYOUT.hiddenStatue.z,
      scale: 3.4,
      variant: 'gold',
      rotY: Math.PI * 0.75,
    });
    buildNature(ctx);
    flags.build(scene);
    this.updaters.push(flags);

    this.tributes = this._buildTributes();

    /** As 3 estátuas da missão de inspeção. */
    this.inspectStatues = [
      { id: 'statue_colossus', name: 'o Colosso Dourado da Praça', pos: new THREE.Vector3(0, 0, 11.5) },
      { id: 'statue_gate', name: 'a Guardiã do Portão Real', pos: new THREE.Vector3(-15, HILL_H, -142.5) },
      { id: 'statue_forest', name: 'a Rainha Secreta do Bosque', pos: this.hiddenStatue.position.clone().add(new THREE.Vector3(1.6, 0, -1.6)) },
    ];

    this.zones = [
      { id: 'throne_hall', name: 'Salão do Trono', box: this.castle.hall },
      { id: 'plaza', name: 'Praça da Soberana', circle: { x: 0, z: 0, r: LAYOUT.plaza.r } },
      { id: 'forest', name: 'Bosque dos Bajuladores', circle: { x: LAYOUT.forest.x, z: LAYOUT.forest.z, r: LAYOUT.forest.r - 10 } },
      { id: 'avenue', name: 'Avenida da Glória', box: { minX: -10, maxX: 10, minZ: -130, maxZ: -40, minY: -5, maxY: 40 } },
      { id: 'market', name: 'Mercado Real', circle: { x: LAYOUT.market.x, z: LAYOUT.market.z, r: 14 } },
    ];

    if (game.debug) scene.add(game.physics.debugMeshes());
  }

  _buildTributes() {
    const geo = new THREE.LatheGeometry(
      [[0.001, 0], [0.22, 0], [0.22, 0.05], [0.06, 0.1], [0.05, 0.38], [0.12, 0.45], [0.24, 0.62], [0.26, 0.8], [0.22, 0.8], [0.001, 0.55]].map(
        ([x, y]) => new THREE.Vector2(x, y)
      ),
      18
    );
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd35c, metalness: 1, roughness: 0.15, emissive: 0xffa000, emissiveIntensity: 10 });
    const list = LAYOUT.tributes.map((t) => {
      const mesh = new THREE.Mesh(geo, mat);
      const y = terrainHeight(t.x, t.z) + 0.9;
      mesh.position.set(t.x, y, t.z);
      mesh.scale.setScalar(1.6);
      mesh.castShadow = true;
      mesh.visible = false;
      // feixe de luz para ser visto de longe
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 40, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd35c, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      beam.position.y = 20 / 1.6;
      beam.scale.setScalar(1 / 1.6);
      mesh.add(beam);
      this.game.scene.add(mesh);
      return { id: t.id, mesh, baseY: y, collected: false };
    });
    this.updaters.push({
      update: (dt, t) => {
        for (const tr of list) {
          if (!tr.mesh.visible) continue;
          tr.mesh.rotation.y += dt * 1.8;
          tr.mesh.position.y = tr.baseY + Math.sin(t * 2 + tr.baseY) * 0.15;
        }
      },
    });
    return list;
  }

  /** Em qual zona um ponto está (primeira que bater). */
  zoneAt(p) {
    for (const z of this.zones) {
      if (z.box) {
        const b = z.box;
        if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ && p.y > b.minY && p.y < b.maxY) return z;
      } else if (Math.hypot(p.x - z.circle.x, p.z - z.circle.z) < z.circle.r) return z;
    }
    return null;
  }

  update(dt, t) {
    for (const u of this.updaters) u.update?.(dt, t);
  }
}
