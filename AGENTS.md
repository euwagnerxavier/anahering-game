# Repository Guidelines

## Project Structure & Module Organization

This npm workspace contains a browser game and its backend:

- `client/src/`: Three.js client, organized into `core`, `physics`, `world`, `entities`, `systems`, `ui`, and declarative `data` modules. Geometry, textures, and music are procedural; edit their generators rather than adding asset dependencies unnecessarily.
- `server/src/`: Fastify REST routes, WebSocket presence, SQLite persistence, moderation, and configuration.
- `server/test/api.test.js`: automated backend tests.
- `docs/`: game design and architecture; consult `docs/game-architecture.md` before structural changes.
- `deploy/`: Raspberry Pi setup, systemd service, and Cloudflare Tunnel configuration.

## Build, Test, and Development Commands

Use Node.js **22.13+** and run commands from the repository root:

- `npm install`: install both workspaces and shared development tools.
- `npm run dev`: start Fastify on port 3000 and Vite on port 5173, with API/WebSocket proxying.
- `npm run build`: generate the production client in `client/dist/`.
- `npm start`: serve the built client and backend together on port 3000.
- `npm test`: run the server test suite.

## Coding Style & Naming Conventions

Use JavaScript ES modules, two-space indentation, single quotes, and semicolons. Match surrounding code; no formatter or linter script is configured.

Name class files `PascalCase.js`, utilities `camelCase.js`, data IDs `snake_case`, and events lowercase `domain:action` (for example, `quest:completed`). Keep game text in Brazilian Portuguese and content definitions in `client/src/data/`.

Follow existing systems with `constructor(game)` and optional `update(dt, time)`. Use the EventBus for cross-system reactions. Keep `core/` independent of gameplay modules and preserve offline operation.

## Testing Guidelines

Tests use `node:test`, strict assertions, Fastify injection, and `ws`, with in-memory SQLite. Add descriptive behavior-based cases to `server/test/api.test.js`; the test command explicitly selects that file. No coverage threshold is configured.

Run `npm test` before submitting. For client changes, also build and manually check gameplay, including `?offline`; use `?debug` to inspect colliders.

## Commit & Pull Request Guidelines

History includes descriptive Portuguese commits and `feat:` subjects. Use concise, action-oriented messages; `feat: refine queen and NPC character visuals` is an existing example.

Explain what changed and why, link relevant issues, report validation, and include screenshots for visual changes. Contributions use AGPL-3.0-or-later.

## Security & Configuration

Use `.env.example` as the environment-variable reference. Keep secrets, SQLite databases, and generated builds out of commits. Configure production `IP_SALT` and `ADMIN_TOKEN` through the deployment environment.
