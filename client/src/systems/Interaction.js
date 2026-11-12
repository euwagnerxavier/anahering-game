/**
 * Interações por proximidade ([E]), zonas nomeadas e coleta de tributos.
 * Interativo: { id, position: Vector3, radius, label: string|fn, onInteract(), enabled?(), priority? }
 */
export class Interaction {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.current = null;
    this.zone = null;
  }

  register(item) {
    this.items.push(item);
    return item;
  }

  update(dt) {
    const g = this.game;
    const q = g.systems.queen;
    if (!q) return;
    const p = q.position;

    // zonas
    const z = g.world.zoneAt(p);
    if ((z?.id ?? null) !== (this.zone?.id ?? null)) {
      if (this.zone) g.events.emit('zone:leave', { id: this.zone.id });
      this.zone = z;
      if (z) g.events.emit('zone:enter', { id: z.id, name: z.name });
    }

    // tributos (coleta automática)
    for (const t of g.world.tributes) {
      if (t.collected || !t.mesh.visible) continue;
      const d = Math.hypot(t.mesh.position.x - p.x, t.mesh.position.z - p.z);
      if (d < 1.8 && Math.abs(t.mesh.position.y - p.y) < 3) {
        t.collected = true;
        t.mesh.visible = false;
        g.events.emit('tribute:collected', { id: t.id, position: t.mesh.position.clone() });
      }
    }

    // interativo mais próximo
    let best = null, bestScore = Infinity;
    if (g.controllable && !q.sitting) {
      for (const it of this.items) {
        if (it.enabled && !it.enabled()) continue;
        const dx = it.position.x - p.x, dz = it.position.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > it.radius || Math.abs(it.position.y - p.y) > 2.6) continue;
        const score = d - (it.priority || 0);
        if (score < bestScore) {
          bestScore = score;
          best = it;
        }
      }
    }
    if (best !== this.current) {
      this.current = best;
      g.systems.hud.setPrompt(best ? (typeof best.label === 'function' ? best.label() : best.label) : null);
    }
    if (q.sitting && g.controllable) g.systems.hud.setPrompt('[E] Levantar-se   ·   [R] Emitir Decreto Real', true);
    else if (!best) g.systems.hud.setPrompt(null);

    if (best && g.input.wasPressed('KeyE')) {
      g.input.consume('KeyE');
      g.systems.audio?.sfx('ui');
      best.onInteract();
      this.current = null;
      g.systems.hud.setPrompt(null);
    }
  }
}
