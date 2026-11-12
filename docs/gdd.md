---
title: 'Ana Hering — The Queen · Game Design Document'
project: 'anahering-game'
date: '2026-11-12'
author: 'Wagner'
version: '1.0'
status: 'approved-fast-track'
gameType: 'action-adventure (mundo aberto, terceira pessoa)'
platforms: ['Web (desktop, navegadores com WebGL2)']
---

# Ana Hering — The Queen — Game Design Document

**Autor:** Wagner
**Tipo de jogo:** Aventura em mundo aberto, terceira pessoa, com humor e sátira política
**Plataforma alvo:** Navegador desktop (Chrome, Edge, Firefox, Safari 17+), WebGL2

> **Aviso de ficção:** o jogo é uma obra de sátira e humor. Ana Hering aparece como personagem satírica; nenhum acontecimento, fala ou decreto do jogo é real ou atribuído à pessoa real. O aviso aparece na tela de título.

---

## Executive Summary

### Core Concept

O jogador controla **Ana Hering, Rainha Absoluta do Reino de Heringuia**, num reino 3D estilizado. Tudo no mundo existe para reforçar a majestade da rainha: estátuas colossais, bandeiras com o brasão real, súditos que se curvam quando ela passa, um castelo monumental no alto da colina e um trono de proporções ridículas. A rainha explora a cidade, conversa com súditos bajuladores, cumpre missões cerimoniais absurdas e publica **Decretos Reais**. Os decretos ficam visíveis para todos os jogadores no **Mural de Lealdade** da praça central.

### Target Audience

Jogadores casuais de 12+ que gostam de exploração leve e humor (pense em *Goat Simulator* e *Untitled Goose Game*, só que com pompa monárquica). As sessões duram de 10 a 30 minutos. O jogador abre um link e joga na hora: sem instalação e sem conta.

### Unique Selling Points (USPs)

1. **Fantasia de poder exagerada:** o mundo inteiro reage à rainha, com súditos se curvando, multidões aplaudindo e fanfarras tocando quando ela entra num lugar.
2. **Sátira política leve:** ministros bajuladores, impostos sobre elogios, decretos absurdos.
3. **Reino compartilhado:** os decretos de cada jogador viram parte do mundo de todos, e outros jogadores aparecem ao vivo como "Ecos Reais" dourados.
4. **Zero instalação:** roda no navegador e tem o tamanho de um site leve.

---

## Goals and Context

### Project Goals

- Entregar uma experiência **jogável de ponta a ponta**, não uma cena estática: mundo explorável, interior do castelo, trono, missões, diálogos.
- Rodar a 60 FPS em notebooks com GPU integrada recente.
- Hospedar tudo em casa num **Raspberry Pi 5**.

### Background and Rationale

Projeto pessoal e humorístico. O navegador como plataforma permite compartilhar por link. O backend no Pi mantém o custo de hospedagem perto de zero.

---

## Core Gameplay

### Game Pillars

1. **MAJESTADE ABSOLUTA:** toda decisão de design responde à pergunta "isso faz o jogador se sentir a soberana suprema?".
2. **Humor satírico:** os textos são exagerados, bajuladores e autoconscientes.
3. **Exploração recompensadora:** cada canto do reino tem um súdito, uma estátua ou um tributo.
4. **Mundo vivo e compartilhado:** NPCs reagem; outros jogadores e seus decretos aparecem.

### Core Gameplay Loop

Explorar o reino → encontrar súdito/evento (ícone ❗) → dialogar (E) → aceitar missão cerimonial → cumprir objetivo (ir até um lugar, coletar tributos, discursar, sentar no trono) → recompensa (Prestígio Real + fanfarra + reação da multidão) → novos títulos honoríficos → explorar mais.

### Win/Loss Conditions

Não há derrota: **a rainha nunca perde**. A vitória é concluir todas as missões e receber o título final **"Imperatriz Suprema do Universo Conhecido e Desconhecido"**, com uma cerimônia de coroação na praça. Depois disso a exploração e os decretos continuam livres.

---

## Game Mechanics

### Primary Mechanics

| Mecânica | Descrição |
|---|---|
| Locomoção | Caminhada e corrida com aceleração suave; a rainha vira na direção do movimento; o manto balança. |
| Pulo | Pulo com gravidade "majestosa" (um pouco mais lenta que o normal). |
| Interação | Ao chegar perto de um NPC ou objeto interativo, aparece o prompt `[E] Ação`. |
| Diálogo | Caixa de diálogo com retrato, texto em máquina de escrever e escolhas ramificadas (1–3). |
| Trono | No trono, a câmera vira um plano cinematográfico, a corte aplaude e o jogador pode "Emitir Decreto". |
| Decreto Real | Texto de até 140 caracteres enviado ao servidor; aparece no Mural de Lealdade para todos. |
| Missões | Rastreador no HUD, marcador 3D no mundo, etapas sequenciais. |
| Reverência | NPCs a menos de 6 m se curvam e falam frases curtas de bajulação. |
| Prestígio Real | Pontuação que sobe com missões e tributos; dá títulos honoríficos. |
| Aplausômetro Global | Contador compartilhado no servidor; cada homenagem de qualquer jogador soma nele. |

### Controls and Input

| Entrada | Ação |
|---|---|
| W A S D | Mover |
| Mouse (pointer lock) | Câmera orbital |
| Roda do mouse | Zoom da câmera |
| Shift | Correr |
| Espaço | Pular |
| E | Interagir / avançar diálogo |
| 1 / 2 / 3 | Escolher opção de diálogo |
| Q | Acenar aos súditos (gera aplausos) |
| M | Silenciar/ativar música |
| Esc | Pausar / soltar o mouse |

---

## Open World Specific Design

### Mapa do Reino de Heringuia (~400 m × 400 m)

| Zona | Conteúdo |
|---|---|
| **Colina Real (norte)** | Castelo gigantesco com 4 torres, muralha, portão, escadaria monumental, **Salão do Trono** (interior acessível) com trono de 8 m. |
| **Avenida da Glória** | Rua larga ligando a praça ao castelo, com fileira de bandeiras e estátuas. |
| **Praça da Soberana (centro)** | Estátua colossal da rainha (25 m), púlpito de discursos, Mural de Lealdade, multidão de súditos, fonte. |
| **Cidade Baixa** | Casas medievais geradas proceduralmente, mercado, ruas, NPCs passeando. |
| **Bosque dos Bajuladores (sul/leste)** | Árvores, lago, estátua escondida, tributos perdidos. |
| **Limites** | Muralha externa e montanhas ao redor (bordas invisíveis com justificativa visual). |

### NPCs

- **Súditos comuns** (~40): passeiam, reconhecem a rainha, se curvam e soltam frases de bajulação.
- **Personagens nomeados com diálogo/missão:**
  - **Sir Bajulácio**, Ministro da Bajulação Oficial
  - **Dona Tributina**, Cobradora do Imposto sobre Elogios
  - **Mestre Escultorius**, escultor de estátuas da rainha (está no 347º busto)
  - **Arauto Trombetildo**, anunciador oficial
  - **Conselheiro Puxassaco**, guarda do trono
  - **Velha Fofocarda**, a única que já viu a rainha piscar

---

## Progression and Balance

### Player Progression

Os títulos são liberados por Prestígio Real:

| Prestígio | Título |
|---|---|
| 0 | Rainha Absoluta |
| 100 | Rainha Absoluta e Magnífica |
| 250 | Soberana dos Sete Mares (o reino não tem mar) |
| 500 | Majestade Incontestável |
| 800 | Imperatriz Suprema do Universo Conhecido e Desconhecido |

### Missões (campanha principal)

1. **O Despertar da Soberana:** ir ao Salão do Trono e sentar no trono.
2. **O Discurso da Praça:** discursar no púlpito da praça; a multidão aplaude.
3. **Tributos Perdidos:** coletar 5 Cálices Dourados espalhados pelo reino.
4. **A Inspeção das Estátuas:** visitar 3 estátuas e aprovar (ou "aprovar com louvor") cada uma.
5. **O Imposto sobre Elogios:** conversar com 3 súditos e receber elogios tributáveis.
6. **O Primeiro Decreto:** emitir um Decreto Real pelo trono (vai para o Mural de Lealdade).
7. **A Coroação Suprema:** voltar à praça para a cerimônia final (fogos, chuva de pétalas, fanfarra).

### Difficulty Curve

Plana de propósito: o desafio é explorar e descobrir. As missões são "fáceis demais", e esse é o objetivo satírico.

### Economy and Resources

Um único recurso, o **Prestígio Real**, que só sobe. Não há loja nem microtransações.

---

## Level Design Framework

### Level Types

Um mundo contínuo (sem carregamento de fase), com interior do castelo no mesmo espaço físico (salão de verdade dentro do volume do castelo).

### Level Progression

As missões guiam o jogador da Colina Real → Praça → Cidade → Bosque → Praça (cerimônia final).

---

## Art and Audio Direction

### Art Style

- 3D low-poly estilizado com materiais PBR simples, paleta **dourado, púrpura real, carmim e mármore branco**.
- Iluminação cinematográfica: sol de fim de tarde, sombras dinâmicas suaves, bloom nos dourados, névoa atmosférica, céu com espalhamento atmosférico e nuvens.
- Partículas: pétalas de rosa na praça, brilhos na coroa, confete em celebrações, fogos de artifício.
- Rainha: coroa dourada ornamentada com gemas, manto púrpura com arminho, vestido elegante, cetro, postura ereta. Animações procedurais de idle (respiração, olhar majestoso), caminhada e corrida.

### Audio and Music

- Trilha **gerada proceduralmente via Web Audio**: progressões em tom maior com metais sintetizados, cordas, tímpanos e sinos. Ela fica mais intensa nos momentos cerimoniais.
- Efeitos: fanfarra de trompete, aplausos da multidão, passos, sino de missão concluída.
- Sem dependência de arquivos de áudio externos, o que deixa o download pequeno.

---

## Technical Specifications

### Performance Requirements

- 60 FPS em GPU integrada (Intel Iris Xe / Apple M1), resolução 1080p, com ajuste automático de qualidade.
- Download inicial < 2 MB gzip (a geometria é procedural).
- Carregamento até jogável < 5 s numa conexão de 20 Mbps.

### Platform-Specific Details

- WebGL2 obrigatório; Pointer Lock API; Web Audio API.
- Desktop com teclado e mouse. Mobile está fora do escopo da v1.

### Asset Requirements

- Geometria 100% procedural em código (Three.js), texturas geradas em canvas.
- Nenhum asset de terceiros, o que evita problemas de licença e de banda.

---

## Development Epics

### Epic Structure

| Epic | Nome | Escopo |
|---|---|---|
| E1 | Fundação do Motor | Loop, input, câmera, física simples, renderer, pós-processamento, qualidade adaptativa |
| E2 | A Rainha | Modelo procedural, animações, controlador de personagem |
| E3 | O Reino | Terreno, castelo + interior, trono, cidade, praça, estátuas, bandeiras, céu, vegetação |
| E4 | Súditos | NPCs, IA de passeio, reverência, diálogos |
| E5 | Missões e Progressão | Sistema de missões, prestígio, títulos, cerimônia final, save local |
| E6 | Áudio e Partículas | Trilha procedural, SFX, sistemas de partículas |
| E7 | Backend no Raspberry Pi | API de decretos, moderação, WebSocket ao vivo, Aplausômetro, eventos globais |
| E8 | Deploy | Build, systemd, Cloudflare Tunnel, hardening |

---

## Success Metrics

### Technical Metrics

- ≥ 55 FPS médios na máquina de referência; < 2 MB de download; servidor com < 150 MB de RAM no Pi com 50 conexões.

### Gameplay Metrics

- ≥ 60% dos jogadores concluem a missão 1; ≥ 25% concluem a campanha; ≥ 1 decreto por sessão em média.

---

## Out of Scope

- Combate, inimigos, morte.
- Contas com senha e login social.
- Suporte a mobile/touch (v2).
- Multiplayer com física sincronizada (os outros jogadores são apenas "ecos" visuais).
- Saves na nuvem (o progresso fica no navegador via localStorage).
