---
title: 'Game Architecture'
project: 'anahering-game'
date: '2026-11-12'
author: 'Wagner'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'
mode: 'fast-track (decisões propostas pelo arquiteto, aprovadas pelo usuário)'

# Source Documents
gdd: 'docs/gdd.md'
epics: null
brief: null
---

# Arquitetura — Ana Hering: The Queen

## Executive Summary

Jogo 3D em mundo aberto que roda **100% no navegador**: Three.js para renderizar, JavaScript (ES modules) e Vite para o build. A física é cinemática e própria, e toda a geometria é procedural. O **backend roda num Raspberry Pi 5** em Node.js 22 LTS + Fastify 5. Ele tem três funções:

1. **Servir o jogo** (arquivos estáticos com hash, cacheados na borda do Cloudflare).
2. **API REST** do Mural de Lealdade (decretos com moderação) e do Aplausômetro Global.
3. **WebSocket** para presença ao vivo ("Ecos Reais" de outros jogadores) e eventos globais.

O banco é **SQLite** pelo módulo nativo `node:sqlite`, sem dependências compiladas no ARM. O Pi fica exposto à internet pelo **Cloudflare Tunnel**: nenhuma porta aberta no roteador, HTTPS automático e cache de borda, que contorna o upload limitado da conexão residencial.

**Por que o Pi 5 aguenta:** renderização, física e IA rodam no cliente. O servidor só retransmite posições a 10 Hz e grava textos curtos. Com 50 jogadores, o tráfego de WebSocket fica em ~50 × 10 msg/s × ~60 B ≈ 30 KB/s por direção, e o uso de RAM previsto é < 150 MB.

## Project Initialization

```bash
# raiz do monorepo (npm workspaces)
npm install
npm run dev        # Vite (cliente) em :5173 + servidor em :3000 com proxy /api e /ws
npm run build      # gera client/dist, servido pelo Fastify em produção
npm start          # servidor de produção (serve dist + API + WS)
```

## Decision Summary

| Categoria | Decisão | Versão | Afeta Epics | Racional |
| --- | --- | --- | --- | --- |
| Engine/render | Three.js (WebGL2) | 0.18x | E1–E6 | Pedido do usuário; maduro, leve, sem lock-in |
| Linguagem | JavaScript ES2022 + JSDoc | — | todos | Pedido do usuário; sem etapa de compilação TS |
| Build | Vite | 8.x | E1, E8 | HMR rápido, bundling com hash |
| Física | Controlador cinemático próprio + colisores estáticos (AABB, cilindro, função de altura) | — | E1, E2, E3 | Mundo estático; evita ~1 MB de WASM do Rapier |
| Pós-processamento | EffectComposer + UnrealBloom + OutputPass | addons do three | E1, E6 | Brilho dourado "majestoso" |
| Céu | `Sky` (espalhamento atmosférico + nuvens volumétricas do próprio shader, disco solar desligado) + névoa + sprites | addons do three | E3 | Céu "volumétrico" barato; sem disco solar para não estourar o bloom |
| Assets | 100% procedurais (geometria e texturas em canvas) | — | E2, E3 | Download < 2 MB; sem licenças |
| Áudio | Web Audio API, síntese procedural | — | E6 | Sem arquivos de áudio; trilha dinâmica |
| Arquitetura do cliente | Sistemas com `update(dt)` + EventBus tipado por nome | — | todos | Simples, desacoplado, previsível para agentes de IA |
| Dados de jogo | Módulos JS declarativos (`data/`) | — | E4, E5 | Diálogos e missões editáveis sem tocar na lógica |
| Save | `localStorage` versionado | v1 | E5 | GDD: saves na nuvem fora do escopo |
| Runtime do servidor | Node.js LTS | ≥ 22.13 | E7, E8 | ARM64 oficial; `node:sqlite` embutido |
| Framework HTTP | Fastify | 5.x | E7 | Rápido, schemas JSON, plugins oficiais |
| Tempo real | `@fastify/websocket` (ws) | 11.x | E7 | Mesmo processo/porta que a API |
| Banco | SQLite (`node:sqlite`), modo WAL | embutido | E7 | Zero dependências nativas, ideal para cartão SD/SSD |
| Rate limit | `@fastify/rate-limit` + limitador por socket próprio | 10.x | E7 | Público aberto |
| Exposição | Cloudflare Tunnel (`cloudflared`) | latest | E8 | Sem port-forward, TLS, cache de borda, proteção DDoS |
| Processo | systemd com hardening | — | E8 | Reinício automático, sandbox |

## Project Structure

```
anahering-game/
├── package.json              # workspaces: client, server
├── client/
│   ├── index.html            # shell + overlay de UI
│   ├── vite.config.js        # proxy /api e /ws → :3000
│   └── src/
│       ├── main.js           # bootstrap: cria Game e tela de título
│       ├── core/             # infraestrutura sem regra de jogo
│       │   ├── Game.js       # dono do loop, registro de sistemas
│       │   ├── EventBus.js
│       │   ├── Input.js
│       │   ├── Renderer.js   # renderer, composer, qualidade adaptativa
│       │   └── utils.js      # rng determinística, math helpers, texturas canvas
│       ├── physics/
│       │   └── Physics.js    # colisores estáticos + resolução do personagem
│       ├── world/            # construção do reino (só geometria + colisores)
│       │   ├── World.js      # orquestra os construtores abaixo
│       │   ├── Terrain.js  Sky.js  Castle.js  City.js  Plaza.js
│       │   ├── Statue.js  Flags.js  Nature.js  Materials.js
│       ├── entities/
│       │   ├── QueenModel.js # malha procedural + rig simples
│       │   ├── Queen.js      # controlador do jogador
│       │   ├── NPC.js  NPCManager.js
│       │   └── RemotePlayers.js
│       ├── systems/
│       │   ├── CameraController.js  Interaction.js  Dialogue.js
│       │   ├── Quests.js  Audio.js  Particles.js  Net.js  Save.js
│       ├── ui/
│       │   ├── HUD.js  DialogueUI.js  DecreeUI.js  styles.css
│       └── data/
│           ├── dialogues.js  quests.js  barks.js  titles.js
├── server/
│   ├── package.json
│   └── src/
│       ├── index.js          # Fastify: static, REST, WS, headers
│       ├── config.js         # env → config validada
│       ├── db.js             # node:sqlite, migrations, prepared statements
│       ├── moderation.js     # filtro de texto, sanitização
│       ├── routes/decrees.js  routes/applause.js
│       ├── realtime/hub.js   # salas, presença, broadcast, rate limit por socket
│       └── realtime/events.js# eventos globais agendados
├── deploy/
│   ├── setup-pi.sh  anahering.service  cloudflared-config.yml
└── _bmad-output/             # GDD, arquitetura
```

## Epic to Architecture Mapping

| Epic | Módulos |
| --- | --- |
| E1 Fundação | `core/*`, `physics/Physics.js`, `systems/CameraController.js` |
| E2 A Rainha | `entities/QueenModel.js`, `entities/Queen.js` |
| E3 O Reino | `world/*` |
| E4 Súditos | `entities/NPC*.js`, `systems/Dialogue.js`, `systems/Interaction.js`, `data/dialogues.js`, `data/barks.js` |
| E5 Missões | `systems/Quests.js`, `systems/Save.js`, `data/quests.js`, `data/titles.js`, `ui/HUD.js` |
| E6 Áudio/FX | `systems/Audio.js`, `systems/Particles.js` |
| E7 Backend | `server/src/*`, `systems/Net.js`, `entities/RemotePlayers.js`, `ui/DecreeUI.js` |
| E8 Deploy | `deploy/*`, scripts do `package.json` |

## Technology Stack Details

### Core Technologies

- **Cliente:** Three.js (WebGLRenderer, `PCFShadowMap` — o PCFSoft foi removido no three 0.187, `ACESFilmicToneMapping`, `SRGBColorSpace`), addons `Sky`, `EffectComposer`, `UnrealBloomPass`, `OutputPass`.
- **Servidor:** Node.js ≥ 22.13 (testado no 24), Fastify 5, `@fastify/static`, `@fastify/websocket`, `@fastify/rate-limit`, `node:sqlite`.

### Integration Points

| Ponto | Protocolo | Detalhe |
| --- | --- | --- |
| Cliente → Mural | REST `GET/POST /api/decrees` | JSON, validado por schema |
| Cliente → Aplausômetro | REST `GET /api/applause` + WS `applause` | Contador global |
| Presença | WS `/ws` | JSON compacto, 10 Hz |
| Offline | — | Se `/api` ou `/ws` falharem, o jogo continua 100% jogável (decretos ficam locais) |

## Novel Pattern Designs

### "Majestade Reativa" (o mundo responde à rainha)

Todo NPC consulta `queen.position` no `update` e entra no estado `BOW` quando estiver a < 6 m. Eventos globais (`queen:wave`, `quest:completed`, `throne:sat`) são assinados pelos sistemas de multidão, áudio e partículas. A reação nasce desses eventos, nunca de chamadas diretas entre sistemas.

### "Ecos Reais" (multiplayer sem quebrar a fantasia)

Cada jogador é *a* rainha na própria realidade. Os outros jogadores aparecem como silhuetas douradas translúcidas da rainha, com o apelido acima ("Eco Real de Fulana"). Não há colisão entre eles; as posições são interpoladas com ~100 ms de atraso.

## Implementation Patterns

1. **Sistemas:** classes com `constructor(game)` e `update(dt, time)` opcional, registradas em `Game.addSystem(name, sys)` e acessadas via `game.systems.<name>`.
2. **Eventos:** `game.events.emit('dominio:acao', payload)`. Nomes sempre em `dominio:acao` minúsculo (`quest:completed`, `dialogue:open`, `npc:bow`, `net:decree`).
3. **Construtores do mundo:** funções `buildX(ctx)` que recebem `{ scene, physics, game }`, adicionam malhas e colisores e retornam `{ interactables, update? }`.
4. **Interativos:** objetos `{ id, position: Vector3, radius, label, onInteract() , enabled?() }` registrados em `systems.interaction.register()`.
5. **Dados declarativos:** diálogos são grafos `{ id: { speaker, text, choices: [{ text, next, action? }] } }`; missões são `{ id, title, steps: [{ id, text, target? }] }`. A lógica nunca usa strings de UI fixas no código.
6. **Delta time:** todo movimento usa `dt` (s) limitado a 0,05 para evitar túnel de colisão.
7. **Rede tolerante a falhas:** `Net` emite `net:status`; nenhum sistema depende de estar online.

## Consistency Rules

### Naming Conventions

- Arquivos de classe em `PascalCase.js`, utilitários em `camelCase.js`.
- Eventos em `dominio:acao`; IDs de dados em `snake_case` (`quest_throne`, `npc_bajulacio`).
- Textos de jogo em **português brasileiro**.

### Code Organization

- `core/` não importa nada de `world/`, `entities/` ou `systems/`.
- `world/` só cria geometria e colisores; não tem estado de gameplay além de animação decorativa.
- O servidor não conhece regras de gameplay: só valida, persiste e retransmite.

### Error Handling

- **Cliente:** erros de rede são capturados em `Net` e viram um toast discreto. Um erro em `update` de um sistema é registrado uma vez por sistema, sem derrubar o loop.
- **Servidor:** validação por JSON Schema (respostas 400), `setErrorHandler` global devolve `{ error: 'mensagem' }` sem stack em produção. Mensagens de WS inválidas são descartadas; abusos repetidos fecham o socket (código 1008).

### Logging Strategy

- **Servidor:** logger pino do Fastify; nível `info` em produção (vai para o journald via systemd). IPs nunca são gravados em claro: usa-se SHA-256 com sal.
- **Cliente:** `console.warn` só para falhas recuperáveis. `?debug` na URL mostra o FPS e os colisores.

## Data Architecture

```sql
CREATE TABLE decrees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,        -- apelido sanitizado (2–20)
  text TEXT NOT NULL,          -- 3–140 chars, moderado
  ip_hash TEXT NOT NULL,       -- sha256(ip + salt)
  hidden INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL  -- epoch ms
);
CREATE INDEX idx_decrees_visible ON decrees(hidden, id DESC);
CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
```

Save local (`localStorage['anahering.save.v1']`): `{ version:1, prestige, quests:{id:{step,done}}, collected:[ids], nickname, settings:{music} }`.

## API Contracts

| Método | Rota | Corpo/Resposta | Limite |
| --- | --- | --- | --- |
| GET | `/api/health` | `{ ok, uptime, players }` | — |
| GET | `/api/decrees?limit=20` | `{ decrees:[{id,author,text,createdAt}] }` | 60/min/IP |
| POST | `/api/decrees` | `{ author, text }` → `201 { decree }` / `422 { error }` | 3/min/IP, 20/dia/IP |
| POST | `/api/decrees/:id/report` | `204`; esconde com ≥ 3 denúncias | 10/min/IP |
| DELETE | `/api/admin/decrees/:id` | header `Authorization: Bearer ADMIN_TOKEN` | — |
| GET | `/api/applause` | `{ total }` | 60/min/IP |

**WebSocket `/ws`** (JSON, máx. 512 bytes por mensagem):

| Direção | Mensagem |
| --- | --- |
| C→S | `{t:'hello', name}` · `{t:'pos', p:[x,y,z], r, a}` (≤ 12/s; `a` = animação 0 idle/1 walk/2 run/3 sit) · `{t:'applaud'}` (≤ 2/s) |
| S→C | `{t:'welcome', id, players}` · `{t:'snap', s:[[id,x,y,z,r,a],...]}` (10 Hz) · `{t:'join', id, name}` · `{t:'leave', id}` · `{t:'decree', decree}` · `{t:'applause', total}` · `{t:'event', kind, ...}` |

## Security Architecture

Público aberto, então as defesas vão em camadas:

1. **Borda:** Cloudflare Tunnel (sem porta aberta em casa; WAF/DDoS básico gratuito; IP real em `CF-Connecting-IP`, confiado só quando vem do túnel local).
2. **HTTP:** rate limit global e por rota; `bodyLimit` de 2 KB; JSON Schema com `additionalProperties:false`; headers CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
3. **Conteúdo:** moderação de decretos (normalização de acentos e leetspeak, lista de termos bloqueados, sem URLs, sem caracteres de controle, limite de repetição); denúncia comunitária com auto-ocultação; rota admin com token.
4. **WebSocket:** verificação de `Origin`, máx. 100 conexões totais e 3 por IP, `maxPayload` de 512 B, token bucket por socket, clamp de coordenadas no limite do mapa, desconexão por abuso ou inatividade (60 s).
5. **Privacidade:** nenhum dado pessoal além do apelido; IP só como hash com sal.
6. **Sistema:** usuário `anahering` sem shell; systemd com `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`; `ufw` bloqueando entrada (o túnel é só de saída); atualizações automáticas (`unattended-upgrades`).

## Performance Considerations

- **Cliente:** geometrias mescladas por material (`mergeGeometries`) para casas, bandeiras e muralhas; `InstancedMesh` para árvores, telhados e multidão estática; sombras só da luz direcional, com câmera de sombra que segue a rainha; qualidade adaptativa (reduz `pixelRatio` e desliga o bloom se o FPS ficar < 45 por 3 s); NPCs distantes atualizam a 1/4 da taxa.
- **Rede:** snapshots a 10 Hz com números arredondados (1 casa decimal) e envio de posição só quando há movimento.
- **Servidor no Pi:** um único processo Node; SQLite em WAL; prepared statements; assets com `Cache-Control: immutable`, então o Cloudflare serve quase todo o download e o upload de casa vira irrelevante.

## Deployment Architecture

```
Jogador ──HTTPS/WSS──► Cloudflare (cache de /assets/*) ──túnel de saída──► cloudflared (Pi 5)
                                                                              │
                                                                     http://127.0.0.1:3000
                                                                              │
                                                                   Fastify (static + /api + /ws)
                                                                              │
                                                                  SQLite /var/lib/anahering/db
```

- **Pi 5:** Raspberry Pi OS Lite 64-bit; de preferência SSD por USB 3/NVMe (o SQLite em WAL desgasta menos, mas o SSD é bem mais durável que o cartão SD).
- `deploy/setup-pi.sh` instala Node 22 LTS, cria o usuário e as pastas, instala o serviço systemd e o cloudflared.
- Atualização: `git pull && npm ci && npm run build && sudo systemctl restart anahering`.
- Backup: `sqlite3 /var/lib/anahering/anahering.db ".backup ..."` via cron diário.

## Development Environment

### Prerequisites

Node.js ≥ 22.13 (o desenvolvimento atual usa o 24), npm ≥ 10, navegador com WebGL2.

### AI Tooling (MCP Servers)

Não há engine com MCP dedicado (Three.js puro). Para testes visuais, recomenda-se a extensão Claude in Chrome ou o Playwright MCP para capturar screenshots e o console.

### Setup Commands

```bash
npm install
npm run dev
# produção local
npm run build && npm start   # http://localhost:3000
```

## Validação (fast-track)

- 8 testes de servidor (`npm test`): API, moderação, rate limit, denúncias, WebSocket, origem, estáticos.
- Playthrough automatizado em Chrome headless: 7 missões concluídas, 5 títulos, decreto persistido via API, save local, 2 jogadores simultâneos vendo os Ecos Reais um do outro.
- Medições: ~205 KB gzip de download, ~250 casas, 56 NPCs, ~1.280 colisores, 120 FPS na máquina de desenvolvimento.
- Bloom com threshold alto (4.0): só emissivos (ouro, gemas, chamas) brilham; o sol fica a sul-sudoeste para iluminar a fachada do castelo.

## Architecture Decision Records (ADRs)

- **ADR-001 · Física cinemática própria em vez de Rapier/Cannon.** O mundo é estático e o único corpo dinâmico é a rainha. Colisores AABB e cilíndricos com resolução por empurrão (push-out) e uma função de altura do terreno bastam. Com isso, economizamos ~1 MB de WASM e a complexidade de sincronização. *Revisitar se* forem adicionados objetos empurráveis.
- **ADR-002 · Geometria procedural em vez de modelos glTF.** Garante download mínimo (o upload residencial é o gargalo), zero licenças e personagem 100% customizável. *Custo:* menos detalhe orgânico, compensado pela estética estilizada low-poly e pela iluminação.
- **ADR-003 · `node:sqlite` em vez de `better-sqlite3`.** Evita compilação nativa no ARM64 e dependências de build no Pi.
- **ADR-004 · Um único processo Fastify serve estáticos, API e WS.** Simplicidade operacional no Pi. O Cloudflare faz o cache. O Caddy/nginx é opcional (só para HTTPS na LAN).
- **ADR-005 · Multiplayer como "Ecos Reais" sem autoridade de física.** Mantém a fantasia ("só existe uma rainha" por realidade), o custo baixo no servidor e uma superfície de trapaça irrelevante (não há competição).
- **ADR-006 · Cloudflare Tunnel em vez de port-forward/DDNS.** Segurança (nada exposto), TLS automático, cache de borda e IP residencial oculto.
- **ADR-007 · Áudio procedural com Web Audio.** Download zero de áudio, trilha que reage ao estado do jogo e nenhum problema de direitos autorais.

---

_Gerado pelo BMAD Game Architecture Workflow (modo fast-track)_
_Data: 2026-11-12_
_Para: Wagner_
