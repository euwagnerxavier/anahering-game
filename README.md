# 👑 Ana Hering — The Queen

Jogo 3D satírico de mundo aberto que roda direto no navegador. O jogador controla **Ana Hering, Rainha Absoluta do Reino de Heringuia**: explora o reino, conversa com súditos bajuladores, senta no trono monumental, discursa para a multidão, publica Decretos Reais num mural compartilhado e chega à Coroação Suprema.

> Obra de ficção e sátira humorística. Personagens, falas, decretos e acontecimentos do jogo são fictícios.

- **Cliente:** Three.js + JavaScript (ES modules) + Vite. Geometria, texturas e música 100% procedurais (~205 KB gzip).
- **Servidor:** Node.js 22+ com Fastify 5, SQLite (`node:sqlite`) e WebSocket, pensado para um **Raspberry Pi 5**.
- **Documentos BMAD:** [GDD](docs/gdd.md) · [Arquitetura](docs/game-architecture.md)

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:5173 (Vite) + servidor em :3000 (proxy /api e /ws)
npm test           # testes do servidor (API, moderação, WebSocket, estáticos)
npm run build && npm start   # produção local em http://localhost:3000
```

Parâmetros úteis na URL: `?offline` (sem rede) e `?debug` (mostra os colisores).

## Controles

| Tecla | Ação |
|---|---|
| W A S D | mover |
| Mouse (clique para capturar) / roda | câmera / zoom |
| Shift | correr |
| Espaço | pular |
| E | interagir / avançar diálogo |
| 1 2 3 | escolher resposta |
| Q | acenar aos súditos |
| R | emitir Decreto Real (sentada no trono) |
| M | música |
| Esc | pausa |

## O que tem no jogo

- **Reino aberto:** castelo gigante com Salão do Trono acessível, Avenida da Glória com estátuas e bandeiras, Praça da Soberana com colosso dourado de 25 m, cidade procedural com ~250 casas, mercado, lago, Bosque dos Bajuladores e montanhas.
- **Campanha com 7 missões** e 5 títulos honoríficos, até a *Imperatriz Suprema do Universo Conhecido e Desconhecido*.
- **~56 NPCs** que se curvam, aplaudem, se juntam para ouvir discursos e soltam frases de bajulação.
- **Online (servidor no Pi):** Mural de Lealdade com decretos de todos os jogadores, "Ecos Reais" (outros jogadores aparecem como rainhas douradas translúcidas), Aplausômetro Global e eventos ao vivo (fogos, pétalas, fanfarras).
- Funciona offline: sem servidor, o jogo continua completo e os decretos ficam salvos no navegador.

## Estrutura

```
client/src/
  core/       loop, eventos, input, renderer + qualidade adaptativa
  physics/    física cinemática (AABB/cilindros + altura do terreno)
  world/      terreno, céu, castelo, praça, cidade, natureza, estátuas, bandeiras
  entities/   rainha (modelo + controle), NPCs, Ecos Reais
  systems/    câmera, interação, diálogo, missões, cerimônias, áudio, partículas, rede, save
  ui/         HUD/minimapa, diálogos, decretos/mural, CSS
  data/       diálogos, missões, NPCs, falas, títulos (editáveis sem tocar na lógica)
server/src/   Fastify: estáticos + REST + WebSocket, SQLite, moderação, eventos globais
deploy/       setup do Raspberry Pi, systemd, Cloudflare Tunnel
```

## Deploy no Raspberry Pi 5

1. Instale o **Raspberry Pi OS Lite 64-bit**. Um SSD por USB 3 ou NVMe é recomendado.
2. Copie o projeto para o Pi (por `git clone` ou `scp`) e rode:
   ```bash
   bash deploy/setup-pi.sh
   ```
   O script instala o Node 22 e cria o usuário `anahering`. Depois compila o jogo, instala o serviço systemd endurecido e gera `/etc/anahering.env` com `IP_SALT` e `ADMIN_TOKEN` aleatórios. Por fim, liga o firewall (só SSH entra), o backup diário do SQLite e o `cloudflared`.
3. Publique na internet sem abrir portas no roteador:
   - Teste rápido: `cloudflared tunnel --url http://127.0.0.1:3000` gera uma URL `*.trycloudflare.com`.
   - Definitivo: siga as instruções impressas no fim do script e use `deploy/cloudflared-config.yml`.

O Cloudflare guarda em cache os arquivos do jogo (`/assets/*` com `Cache-Control: immutable`). Assim, o upload da internet de casa quase não é usado: o Pi só atende a API e o WebSocket.

**Atualizar:** `git pull && bash deploy/setup-pi.sh`
**Logs:** `journalctl -u anahering -f`

### Moderação (público aberto)

- Filtro de termos com normalização de acentos e leetspeak, bloqueio de links e de caracteres invisíveis.
- Rate limit global e por rota (3 decretos/min e 20/dia por IP), além de token bucket por WebSocket.
- Limite de conexões totais e por IP e verificação de `Origin` no WebSocket.
- Decretos com 3 denúncias de IPs diferentes são ocultados automaticamente.
- Para remover um decreto manualmente:
  ```bash
  curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" https://rainha.seudominio.com/api/admin/decrees/42
  ```
