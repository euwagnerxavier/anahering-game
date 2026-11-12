// Títulos honoríficos por Prestígio Real.
export const TITLES = [
  { at: 0, name: 'Rainha Absoluta' },
  { at: 100, name: 'Rainha Absoluta e Magnífica' },
  { at: 250, name: 'Soberana dos Sete Mares (o reino não tem mar)' },
  { at: 500, name: 'Majestade Incontestável' },
  { at: 800, name: 'Imperatriz Suprema do Universo Conhecido e Desconhecido' },
];

export function titleFor(prestige) {
  let t = TITLES[0];
  for (const x of TITLES) if (prestige >= x.at) t = x;
  return t;
}

export function nextTitle(prestige) {
  return TITLES.find((t) => t.at > prestige) || null;
}
