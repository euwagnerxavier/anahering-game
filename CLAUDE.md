# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also `AGENTS.md` (style, commit and PR conventions) and `docs/game-architecture.md` (full architecture, ADRs, API/WS contracts — read before structural changes).

## Commands

Node.js >= 22.13 (`node:sqlite` is required). Run from the repo root (npm workspaces: `client`, `server`):

- `npm install`
- `npm run dev` — Fastify on :3000 + Vite on :5173 (Vite proxies `/api` and `/ws` to :3000)
- `npm run build` — builds the client into `client/dist/`
- `npm start` — production server on :3000 (serves `client/dist` + API + WS; build first)
- `npm test` — server tests only (`node --test` on `server/test/api.test.js`)
- Single test: `npm test -w server -- --test-name-pattern="rate limit"` (the script is `node --test ... test/api.test.js`, so extra args are appended)

There is no linter, formatter or client test suite. Client changes are verified by building and playing; URL flags: `?offline` (no network) and `?debug` (FPS + collider visualization).

## Architecture

Single-player 3D browser game (Three.js, Vite) plus a small Fastify backend that is deliberately game-rule-agnostic. UI/game text is Brazilian Portuguese.

### Client (`client/src/`)

- `main.js` is the composition root: it creates `Game`, registers systems with `game.addSystem(name, sys)`, then wires world interactions, saving and menus. **Registration order is update order**; `main.js` reorders some systems explicitly (`interaction` runs after `dialogue`, `hud` runs last so it projects against the already-updated camera). Keep this in mind when adding a system.
- `core/Game.js` owns the loop (dt clamped to 0.05 s), `game.systems.<name>` registry, and `game.mode` (`title|play|cinematic|dialogue|modal`). A throwing system's `update` is caught and logged once per system without stopping the loop.
- Systems are classes with `constructor(game)` and optional `update(dt, time)`. Cross-system communication goes through `game.events` (EventBus) with `domain:action` event names (`quest:completed`, `npc:bow`, `net:decree`) — not direct calls. `core/` must not import from `world/`, `entities/` or `systems/`.
- `world/*` builders (`buildX(ctx)`) only create geometry + colliders (and decorative animation) and return `{ interactables, update? }`; gameplay objects are registered in `systems/Interaction` as `{ id, position, radius, label, onInteract, enabled? }`.
- `physics/Physics.js` is a custom kinematic controller (static AABB/cylinder colliders + terrain height function), intentionally no physics engine (ADR-001).
- All geometry, textures (canvas) and music (Web Audio synthesis) are procedural — change the generators rather than adding asset files (ADR-002/007).
- Game content is declarative in `data/` (dialogue graphs, quests, NPC definitions, barks, titles); prefer editing data over adding logic. IDs are `snake_case`.
- Persistence is `localStorage['anahering.save.v1']` via `systems/Save.js`. The game must stay fully playable offline: `systems/Net.js` emits `net:status` and no system may depend on being online.

### Server (`server/src/`)

- `index.js` exports `buildServer(overrides)` (used directly by tests with Fastify injection and in-memory SQLite) and serves static files, REST (`routes/decrees.js`, applause counter) and the `/ws` WebSocket from one process (ADR-004).
- `config.js` maps env vars (see `.env.example`) into validated config; `db.js` wraps `node:sqlite` (WAL, migrations, prepared statements); `moderation.js` filters/sanitizes decree text.
- `realtime/hub.js` handles presence ("Ecos Reais"): 10 Hz snapshots, per-socket token-bucket rate limiting, origin check, per-IP/total connection caps. `realtime/events.js` schedules global events.
- Client IP comes from `CF-Connecting-IP` only when the request arrives from loopback (cloudflared) and `TRUST_CLOUDFLARE` is set; IPs are only stored as salted SHA-256 hashes.
- The server validates, persists and relays only; no gameplay rules live there.

### Deployment

`deploy/` holds Raspberry Pi 5 setup (`setup-pi.sh`), the hardened systemd unit and Cloudflare Tunnel config. Update flow: `git pull && npm ci && npm run build && sudo systemctl restart anahering`.
