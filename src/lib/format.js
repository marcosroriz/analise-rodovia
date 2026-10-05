// Formatação numérica e de datas em pt-BR.
import { dayToDate } from './analysis.js';

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nfCompact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const df = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const mf = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short', year: 'numeric' });

export const int = (x) => nf0.format(Math.round(x));
export const compact = (x) => nfCompact.format(x);
export const date = (day) => df.format(dayToDate(day));
export const monthLabel = (y, m) => mf.format(new Date(Date.UTC(y, m - 1, 1))).replace('.', '');

/**
 * Percentual com casas adaptativas: valores muito pequenos ganham mais
 * casas para não aparecerem como "0,0%" quando não são zero.
 */
export function pct(x, digits = 1) {
  if (x === 0) return '0%';
  const a = Math.abs(x);
  let d = digits;
  if (a < 0.1) d = Math.max(digits, 1 - Math.floor(Math.log10(a)));
  d = Math.min(d, 6);
  return `${x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
}

/** Variação com sinal: +8,7% / −9,7%. */
export const signedPct = (x, digits = 1) =>
  `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

/** Pontos percentuais com sinal. */
export const pp = (x, digits = 1) =>
  `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} p.p.`;

/** Lista em português: "a, b e c". */
export function list(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}
