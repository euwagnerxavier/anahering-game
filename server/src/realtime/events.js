// Eventos globais do reino, disparados para todos os jogadores conectados ao mesmo tempo.
const EVENTS = [
  { kind: 'fireworks', msg: 'O Arauto anuncia: FOGOS EM HOMENAGEM À RAINHA sobre a Praça da Soberana!' },
  { kind: 'petals', msg: 'Uma chuva de pétalas cai sobre o reino. Os súditos choram de emoção.' },
  { kind: 'fanfare', msg: 'Fanfarra Real Espontânea! Todas as trombetas do reino tocam ao mesmo tempo.' },
  { kind: 'holiday', msg: 'Por decreto, hoje é feriado nacional em homenagem ao feriado de ontem.' },
];

export function startEvents(hub, intervalMs) {
  let i = Math.floor(Math.random() * EVENTS.length);
  const timer = setInterval(() => {
    if (hub.playerCount === 0) return;
    const ev = EVENTS[i++ % EVENTS.length];
    hub.broadcast({ t: 'event', ...ev, at: Date.now() });
  }, intervalMs);
  return () => clearInterval(timer);
}
