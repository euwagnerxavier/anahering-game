// Moderação de textos públicos (decretos e apelidos). Conservadora: na dúvida, rejeita.

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };

// Termos bloqueados (PT-BR + EN), comparados sobre o texto normalizado.
const BLOCKED = [
  'porra', 'caralh', 'buceta', 'boceta', 'xoxota', 'piroca', 'cuzao', 'cuzinho', 'arrombad',
  'fdp', 'filhadaput', 'filhodaput', 'putaria', 'vagabund', 'viado', 'veado', 'sapatao',
  'traveco', 'crioulo', 'retardad', 'mongoloide', 'estupr', 'pedofil', 'hitler',
  'fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fag', 'whore', 'slut', 'dick', 'pussy',
  'merda', 'bosta', 'cacete', 'punheta', 'siririca', 'gozar', 'foder', 'fodid', 'transar',
  'suicid', 'terroris',
];
// Termos que só bloqueiam como palavra inteira (curtos ou ambíguos).
const BLOCKED_WORDS = new Set([
  'cu', 'cus', 'pau', 'ass', 'nazi', 'goza', 'pica', 'rola', 'fode', 'puta', 'puto', 'bicha', 'rape', 'retard',
]);

const dedupe = (s) => s.replace(/(.)\1+/g, '$1');
// Termos longos (>= 5) são procurados no texto inteiro sem espaços (pega "p o r r a");
// termos curtos só no início de cada palavra (evita falsos positivos como "sofa grande").
const LONG = BLOCKED.filter((w) => w.length >= 5).map(dedupe);
const SHORT = BLOCKED.filter((w) => w.length < 5).map(dedupe);
const WORDS = new Set([...BLOCKED_WORDS].map(dedupe));

export function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0134578@$!]/g, (c) => LEET[c] ?? c);
}

const URL_RE = /(https?:|www\.|\.(com|net|org|br|io|gg|xyz|me|ly|co)\b|discord|t\.me|wa\.me)/i;
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;
// Letras, números, espaços, pontuação comum e alguns emojis "reais".
const ALLOWED_RE = /^(?:[\p{L}\p{N} .,;:!?'"()\-–—…]|\u{1F451}|✨|\u{1F3BA}|\u{1F339}|\u{1F48E}|⚜️?|\u{1F3F0}|❤️?)+$/u;

/** Remove espaços extras e caracteres invisíveis/de controle. */
export function clean(text) {
  return String(text ?? '')
    .replace(CONTROL_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @returns {{ ok: true, value: string } | { ok: false, reason: string }}
 */
export function checkText(raw, { min, max, field }) {
  const value = clean(raw);
  const len = [...value].length;
  if (len < min) return { ok: false, reason: `${field} muito curto (mínimo ${min}).` };
  if (len > max) return { ok: false, reason: `${field} muito longo (máximo ${max}).` };
  if (!ALLOWED_RE.test(value)) return { ok: false, reason: `${field} contém caracteres não permitidos.` };
  if (URL_RE.test(value)) return { ok: false, reason: 'Links não são permitidos em textos da corte.' };
  if (/(.)\1{5,}/u.test(value)) return { ok: false, reason: 'Repetição excessiva de caracteres.' };

  const norm = normalize(value);
  const squashed = dedupe(norm.replace(/[^a-z]/g, ''));
  const words = norm.split(/[^a-z]+/).filter(Boolean).map(dedupe);
  const bad =
    words.some((w) => WORDS.has(w) || SHORT.some((b) => w.startsWith(b))) || LONG.some((b) => squashed.includes(b));
  if (bad) return { ok: false, reason: 'O Conselho Real considerou o texto impróprio para a corte.' };
  return { ok: true, value };
}

export const checkDecree = (t) => checkText(t, { min: 3, max: 140, field: 'Decreto' });
export const checkNickname = (t) => checkText(t, { min: 2, max: 20, field: 'Apelido' });
