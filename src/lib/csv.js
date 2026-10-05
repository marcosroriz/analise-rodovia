// Leitura do CSV de volume dos radares (ANTT) e conversão para um conjunto
// de dados colunar e compacto. Usado tanto pelo script de preparação (Node)
// quanto pelo navegador (upload de outro arquivo).

const REQUIRED = [
  'concessionaria', 'identificador', 'rodovia', 'uf', 'km_m', 'municipio',
  'tipo_de_pista', 'latitude', 'longitude', 'data_da_passagem',
  'sentido_da_passagem', 'faixa_da_passagem', 'velocidade',
  'tipo_de_veiculo', 'volume_total',
];

const TIPO_ORDER = ['Passeio', 'Comercial', 'Moto', 'Não classificado'];
const SENTIDO_ORDER = ['Crescente', 'Decrescente'];

/** Decodifica bytes: tenta UTF-8 e, se inválido, usa Windows-1252 (Latin-1). */
export function decodeBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Divide uma linha CSV respeitando aspas. */
function splitLine(line, sep) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const num = (s) => Number(String(s).replace(',', '.'));

/** "dd/mm/aaaa" (ou "aaaa-mm-dd") -> dias desde 1970-01-01 (UTC). */
function parseDay(s) {
  let y, m, d;
  if (s.includes('/')) [d, m, y] = s.split('/').map(Number);
  else [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  return Number.isFinite(t) ? Math.round(t / 86400000) : NaN;
}

/**
 * Interpreta o rótulo da categoria de velocidade (que vem truncado no
 * arquivo, ex.: "81 - 100 K", "101 - 120 ") e devolve limites e rótulo limpo.
 */
export function parseSpeed(raw) {
  const s = raw.replace(/\s+/g, ' ').trim();
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (/^<=|^≤|^</.test(s)) return { raw, lo: 0, hi: nums[0], label: `≤ ${nums[0]} km/h` };
  if (/^>=|^≥|^>/.test(s)) return { raw, lo: nums[0] + 1, hi: Infinity, label: `> ${nums[0]} km/h` };
  if (nums.length >= 2) return { raw, lo: nums[0], hi: nums[1], label: `${nums[0]}–${nums[1]} km/h` };
  return { raw, lo: nums[0] ?? 9999, hi: nums[0] ?? 9999, label: s };
}

function orderBy(values, preferred) {
  return [...values].sort((a, b) => {
    const ia = preferred.indexOf(a); const ib = preferred.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b, 'pt-BR');
  });
}

/**
 * Converte o texto do CSV em conjunto de dados colunar:
 * { equip[], sentidos[], faixas[], vels[], tipos[], cols:{e,d,s,f,v,t,n}, meta }
 */
export function parseCsv(text, source = 'arquivo.csv') {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error('Arquivo vazio ou sem registros.');
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const header = splitLine(lines[0], sep).map((h) => h.toLowerCase());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`Colunas ausentes: ${missing.join(', ')}`);
  const ix = Object.fromEntries(REQUIRED.map((c) => [c, header.indexOf(c)]));

  const equipMap = new Map();
  const dicts = { s: new Map(), f: new Map(), v: new Map(), t: new Map() };
  const raw = { e: [], d: [], s: [], f: [], v: [], t: [], n: [] };
  let skipped = 0;

  const code = (dict, key) => {
    if (!dict.has(key)) dict.set(key, dict.size);
    return dict.get(key);
  };

  for (let i = 1; i < lines.length; i++) {
    const r = splitLine(lines[i], sep);
    const id = r[ix.identificador];
    const day = parseDay(r[ix.data_da_passagem]);
    const vol = num(r[ix.volume_total]);
    if (!id || !Number.isFinite(day) || !Number.isFinite(vol)) { skipped++; continue; }
    if (!equipMap.has(id)) {
      equipMap.set(id, {
        id,
        concessionaria: r[ix.concessionaria],
        rodovia: r[ix.rodovia],
        uf: r[ix.uf],
        km: num(r[ix.km_m]),
        municipio: r[ix.municipio],
        tipoPista: r[ix.tipo_de_pista],
        lat: num(r[ix.latitude]),
        lon: num(r[ix.longitude]),
      });
    }
    raw.e.push(id);
    raw.d.push(day);
    raw.s.push(code(dicts.s, r[ix.sentido_da_passagem]));
    raw.f.push(code(dicts.f, r[ix.faixa_da_passagem]));
    raw.v.push(code(dicts.v, r[ix.velocidade]));
    raw.t.push(code(dicts.t, r[ix.tipo_de_veiculo]));
    raw.n.push(vol);
  }

  // Ordena dimensões de forma estável e semântica, e recodifica.
  const equip = [...equipMap.values()].sort((a, b) => a.km - b.km || a.id.localeCompare(b.id));
  const eIndex = new Map(equip.map((e, i) => [e.id, i]));
  const keys = (m) => [...m.keys()];
  const sentidos = orderBy(keys(dicts.s), SENTIDO_ORDER);
  const faixas = keys(dicts.f).sort((a, b) => num(a) - num(b));
  const tipos = orderBy(keys(dicts.t), TIPO_ORDER);
  const vels = keys(dicts.v).map(parseSpeed).sort((a, b) => a.lo - b.lo);
  const remap = (m, ordered, keyOf = (x) => x) => {
    const pos = new Map(ordered.map((x, i) => [keyOf(x), i]));
    const arr = []; for (const [k, c] of m) arr[c] = pos.get(k); return arr;
  };
  const rs = remap(dicts.s, sentidos); const rf = remap(dicts.f, faixas);
  const rt = remap(dicts.t, tipos); const rv = remap(dicts.v, vels, (x) => x.raw);

  const cols = {
    e: raw.e.map((id) => eIndex.get(id)),
    d: raw.d,
    s: raw.s.map((c) => rs[c]),
    f: raw.f.map((c) => rf[c]),
    v: raw.v.map((c) => rv[c]),
    t: raw.t.map((c) => rt[c]),
    n: raw.n,
  };

  return {
    meta: { source, records: cols.n.length, skipped },
    equip, sentidos, faixas, vels, tipos, cols,
  };
}
