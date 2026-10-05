// Cálculos das cinco análises. Funções puras sobre o conjunto colunar
// produzido por parseCsv(); nenhuma dependência de DOM.

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // segunda → domingo

/** 1970-01-01 foi quinta-feira; devolve 0 = domingo ... 6 = sábado. */
export const weekday = (day) => (((day + 4) % 7) + 7) % 7;
export const dayToDate = (day) => new Date(day * 86400000);

const zeros = (n) => new Array(n).fill(0);
const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);
const shares = (arr) => { const t = arr.reduce((a, b) => a + b, 0); return arr.map((x) => pct(x, t)); };

/** Normaliza o conjunto vindo do JSON (Infinity vira null na serialização). */
export function normalize(ds) {
  ds.vels.forEach((v) => { if (v.hi == null) v.hi = Infinity; });
  return ds;
}

/** Iterador simples sobre as linhas com filtro opcional por intervalo de dias. */
function forRows(ds, fn, range) {
  const { e, d, s, f, v, t, n } = ds.cols;
  for (let i = 0; i < n.length; i++) {
    if (range && (d[i] < range[0] || d[i] > range[1])) continue;
    fn(e[i], d[i], s[i], f[i], v[i], t[i], n[i]);
  }
}

/** Índices das categorias de velocidade estritamente acima de `limit` km/h. */
export const speedAbove = (ds, limit = 100) =>
  ds.vels.map((v, i) => (v.lo > limit ? i : -1)).filter((i) => i >= 0);

/* ------------------------------------------------------------------ */
/* Tarefa 1 — Caracterização                                            */
/* ------------------------------------------------------------------ */
export function overview(ds) {
  const nE = ds.equip.length;
  const byTipo = zeros(ds.tipos.length);
  const byVel = zeros(ds.vels.length);
  const bySent = zeros(ds.sentidos.length);
  const byFaixa = zeros(ds.faixas.length);
  const eq = ds.equip.map(() => ({ total: 0, days: new Set(), min: Infinity, max: -Infinity, sent: new Set(), faixa: new Set() }));
  const combos = new Map();
  const allDays = new Set();
  let total = 0;

  forRows(ds, (e, d, s, f, v, t, n) => {
    total += n; byTipo[t] += n; byVel[v] += n; bySent[s] += n; byFaixa[f] += n;
    const q = eq[e];
    q.total += n; q.days.add(d); q.sent.add(s); q.faixa.add(f);
    if (d < q.min) q.min = d; if (d > q.max) q.max = d;
    allDays.add(d);
    const key = `${s}|${f}`;
    if (!combos.has(key)) combos.set(key, { s, f, total: 0, equip: new Set() });
    const c = combos.get(key); c.total += n; c.equip.add(e);
  });

  const days = [...allDays].sort((a, b) => a - b);
  const first = days[0]; const last = days[days.length - 1];
  const calendar = last - first + 1;
  // Intervalos contíguos de dias sem nenhum registro.
  const gaps = [];
  for (let k = 1; k < days.length; k++) {
    if (days[k] - days[k - 1] > 1) gaps.push({ from: days[k - 1] + 1, to: days[k] - 1, days: days[k] - days[k - 1] - 1 });
  }
  const uniq = (k) => [...new Set(ds.equip.map((x) => x[k]))];

  return {
    total,
    records: ds.meta.records,
    first, last, calendarDays: calendar, daysWithData: days.length, missingDays: calendar - days.length, gaps,
    equipCount: nE,
    equipment: ds.equip.map((x, i) => ({
      ...x,
      total: eq[i].total,
      share: pct(eq[i].total, total),
      days: eq[i].days.size,
      first: eq[i].min, last: eq[i].max,
      coverage: pct(eq[i].days.size, eq[i].max - eq[i].min + 1),
      sentidos: [...eq[i].sent].map((s) => ds.sentidos[s]),
      faixas: [...eq[i].faixa].map((f) => ds.faixas[f]),
    })),
    concessionarias: uniq('concessionaria'),
    rodovias: uniq('rodovia'),
    ufs: uniq('uf'),
    municipios: uniq('municipio').map((m) => ({ nome: m, equip: ds.equip.filter((x) => x.municipio === m).map((x) => x.id) })),
    tiposPista: uniq('tipoPista'),
    tipos: ds.tipos.map((name, i) => ({ name, total: byTipo[i], share: pct(byTipo[i], total) })),
    vels: ds.vels.map((x, i) => ({ ...x, total: byVel[i], share: pct(byVel[i], total) })),
    sentidos: ds.sentidos.map((name, i) => ({ name, total: bySent[i], share: pct(bySent[i], total) })),
    faixas: ds.faixas.map((name, i) => ({ name, total: byFaixa[i], share: pct(byFaixa[i], total) })),
    combos: [...combos.values()]
      .sort((a, b) => a.s - b.s || a.f - b.f)
      .map((c) => ({ sentido: ds.sentidos[c.s], faixa: ds.faixas[c.f], total: c.total, share: pct(c.total, total), equip: [...c.equip].sort().map((e) => ds.equip[e].id) })),
  };
}

/* ------------------------------------------------------------------ */
/* Tarefa 2 — Tipo de veículo × velocidade                              */
/* ------------------------------------------------------------------ */
/**
 * Participação de cada tipo dentro de cada categoria de velocidade.
 * `smallShare`: categorias com menos que este % do volume total são
 * consideradas de volume absoluto pequeno.
 */
export function speedComposition(ds, { smallShare = 1 } = {}) {
  const m = ds.vels.map(() => zeros(ds.tipos.length));
  forRows(ds, (e, d, s, f, v, t, n) => { m[v][t] += n; });
  const totals = m.map((r) => r.reduce((a, b) => a + b, 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const overallAbs = ds.tipos.map((_, t) => m.reduce((a, r) => a + r[t], 0));
  const overall = shares(overallAbs);

  const rows = ds.vels.map((vel, i) => {
    const p = shares(m[i]);
    // Distância de variação total (pp) em relação à composição geral.
    const tvd = 0.5 * p.reduce((a, x, t) => a + Math.abs(x - overall[t]), 0);
    return {
      vel, abs: m[i], pct: p, total: totals[i], shareOfTotal: pct(totals[i], grand),
      sum: p.reduce((a, b) => a + b, 0), tvd, small: pct(totals[i], grand) < smallShare,
      dominant: p.indexOf(Math.max(...p)),
    };
  }).filter((r) => r.total > 0);

  // Alertas: percentual alto (dominante ou ≥10 pp acima do geral) com base pequena.
  const alerts = [];
  rows.forEach((r) => {
    if (!r.small) return;
    r.pct.forEach((p, t) => {
      if (p >= 40 || p - overall[t] >= 10) alerts.push({ vel: r.vel, tipo: ds.tipos[t], pct: p, abs: r.abs[t], rowTotal: r.total, shareOfTotal: r.shareOfTotal });
    });
  });

  return { rows, overall, overallAbs, grand, alerts, smallShare };
}

/* ------------------------------------------------------------------ */
/* Tarefa 3 — Perfil por equipamento / quilômetro                       */
/* ------------------------------------------------------------------ */
/** Intervalo de datas comum a todos os equipamentos (ou null). */
export function commonPeriod(ds) {
  const lo = ds.equip.map(() => Infinity); const hi = ds.equip.map(() => -Infinity);
  forRows(ds, (e, d) => { if (d < lo[e]) lo[e] = d; if (d > hi[e]) hi[e] = d; });
  const a = Math.max(...lo); const b = Math.min(...hi);
  return a <= b ? [a, b] : null;
}

export function equipmentProfile(ds, range) {
  const above = new Set(speedAbove(ds));
  const E = ds.equip.map(() => ({ total: 0, days: new Set(), tipo: zeros(ds.tipos.length), vel: zeros(ds.vels.length), sent: new Set() }));
  forRows(ds, (e, d, s, f, v, t, n) => {
    const q = E[e]; q.total += n; q.days.add(d); q.tipo[t] += n; q.vel[v] += n; q.sent.add(s);
  }, range);
  const grand = E.reduce((a, q) => a + q.total, 0);
  const tipoAll = ds.tipos.map((_, t) => E.reduce((a, q) => a + q.tipo[t], 0));
  const velAll = ds.vels.map((_, v) => E.reduce((a, q) => a + q.vel[v], 0));

  const rows = ds.equip.map((x, i) => {
    const q = E[i];
    const tipoPct = shares(q.tipo); const velPct = shares(q.vel);
    const aboveVol = [...above].reduce((a, v) => a + q.vel[v], 0);
    // Velocidade "mediana" aproximada: categoria em que o acumulado passa de 50%.
    let acc = 0; let medianCat = 0;
    for (let v = 0; v < velPct.length; v++) { acc += velPct[v]; if (acc >= 50) { medianCat = v; break; } }
    return {
      ...x, total: q.total, share: pct(q.total, grand), days: q.days.size,
      meanDaily: q.days.size ? q.total / q.days.size : 0,
      tipoAbs: q.tipo, tipoPct, velAbs: q.vel, velPct, aboveVol, abovePct: pct(aboveVol, q.total),
      medianCat, sentidos: [...q.sent].map((s) => ds.sentidos[s]),
    };
  }).filter((r) => r.total > 0);

  // Amplitude (máx − mín, em pp) de cada tipo e de cada faixa de velocidade entre equipamentos.
  const spread = (key, names) => names.map((name, k) => {
    const vals = rows.map((r) => r[key][k]);
    const max = Math.max(...vals); const min = Math.min(...vals);
    return { name, k, max, min, range: max - min, maxEq: rows[vals.indexOf(max)].id, minEq: rows[vals.indexOf(min)].id };
  });

  return {
    range, rows, grand,
    tipoOverall: shares(tipoAll), velOverall: shares(velAll),
    tipoSpread: spread('tipoPct', ds.tipos),
    velSpread: spread('velPct', ds.vels.map((v) => v.label)),
  };
}

/* ------------------------------------------------------------------ */
/* Tarefa 4 — Variação temporal                                         */
/* ------------------------------------------------------------------ */
export function temporal(ds) {
  const nT = ds.tipos.length;
  const daily = new Map(); // dia -> { total, tipo[], equip:Set }
  const eqDaily = ds.equip.map(() => new Map()); // por equipamento: dia -> volume
  forRows(ds, (e, d, s, f, v, t, n) => {
    if (!daily.has(d)) daily.set(d, { total: 0, tipo: zeros(nT), equip: new Set() });
    const x = daily.get(d); x.total += n; x.tipo[t] += n; x.equip.add(e);
    eqDaily[e].set(d, (eqDaily[e].get(d) || 0) + n);
  });

  // Médias diárias por dia da semana: soma ÷ nº de datas daquele dia da semana.
  const wd = WEEKDAYS.map((name, i) => ({ i, name, dates: 0, sum: 0, tipoSum: zeros(nT), eqSum: 0 }));
  for (const [d, x] of daily) {
    const w = wd[weekday(d)]; w.dates++; w.sum += x.total; w.eqSum += x.equip.size;
    x.tipo.forEach((n, t) => { w.tipoSum[t] += n; });
  }
  wd.forEach((w) => {
    w.mean = w.dates ? w.sum / w.dates : 0;
    w.tipoMean = w.tipoSum.map((n) => (w.dates ? n / w.dates : 0));
    w.tipoPct = shares(w.tipoSum);
    w.meanEquip = w.dates ? w.eqSum / w.dates : 0;
  });
  const ordered = WEEK_ORDER.map((i) => wd[i]);
  const max = ordered.reduce((a, b) => (b.mean > a.mean ? b : a));
  const min = ordered.reduce((a, b) => (b.mean < a.mean ? b : a));

  // Transições entre dias consecutivos (inclui domingo → segunda).
  const transitions = ordered.map((w, k) => {
    const next = ordered[(k + 1) % 7];
    return {
      from: w, to: next, change: pct(next.mean - w.mean, w.mean),
      byTipo: ds.tipos.map((name, t) => ({
        name, delta: next.tipoMean[t] - w.tipoMean[t], change: pct(next.tipoMean[t] - w.tipoMean[t], w.tipoMean[t]),
      })),
    };
  });
  const maxRise = transitions.reduce((a, b) => (b.change > a.change ? b : a));

  // Dias úteis × fim de semana: composição e média diária por tipo.
  const group = (days) => {
    const sum = zeros(nT); let dates = 0; let total = 0;
    days.forEach((i) => { const w = wd[i]; dates += w.dates; total += w.sum; w.tipoSum.forEach((n, t) => { sum[t] += n; }); });
    return { dates, total, mean: dates ? total / dates : 0, tipoPct: shares(sum), tipoMean: sum.map((n) => (dates ? n / dates : 0)) };
  };
  const weekdays = group([1, 2, 3, 4, 5]);
  const weekend = group([6, 0]);

  // Índice por tipo (média do dia ÷ média semanal do tipo × 100).
  const tipoIndex = ds.tipos.map((name, t) => {
    const avg = ordered.reduce((a, w) => a + w.tipoMean[t], 0) / 7;
    return { name, values: ordered.map((w) => (avg ? (w.tipoMean[t] / avg) * 100 : 0)) };
  });

  // Robustez: o padrão se repete em cada equipamento?
  const perEquip = ds.equip.map((x, e) => {
    const acc = WEEKDAYS.map(() => ({ n: 0, s: 0 }));
    for (const [d, vol] of eqDaily[e]) { const a = acc[weekday(d)]; a.n++; a.s += vol; }
    const means = WEEK_ORDER.map((i) => (acc[i].n ? acc[i].s / acc[i].n : 0));
    const avg = means.reduce((a, b) => a + b, 0) / 7;
    const iMax = means.indexOf(Math.max(...means)); const iMin = means.indexOf(Math.min(...means));
    return { id: x.id, means, index: means.map((m) => (avg ? (m / avg) * 100 : 0)), maxDay: WEEKDAYS[WEEK_ORDER[iMax]], minDay: WEEKDAYS[WEEK_ORDER[iMin]], days: eqDaily[e].size };
  });

  // Série mensal: média diária por mês.
  const months = new Map();
  for (const [d, x] of daily) {
    const dt = dayToDate(d); const key = dt.getUTCFullYear() * 100 + dt.getUTCMonth() + 1;
    if (!months.has(key)) months.set(key, { key, sum: 0, dates: 0, equip: new Set() });
    const m = months.get(key); m.sum += x.total; m.dates++; x.equip.forEach((e) => m.equip.add(e));
  }
  const monthly = [...months.values()].sort((a, b) => a.key - b.key)
    .map((m) => ({ key: m.key, year: Math.floor(m.key / 100), month: m.key % 100, mean: m.sum / m.dates, dates: m.dates, equip: m.equip.size }));

  return { ordered, max, min, transitions, maxRise, weekdays, weekend, tipoIndex, perEquip, monthly, dates: daily.size };
}

/* ------------------------------------------------------------------ */
/* Tarefa 5 — Sentidos, faixas e velocidades acima de 100 km/h          */
/* ------------------------------------------------------------------ */
export function directionLane(ds) {
  const above = new Set(speedAbove(ds));
  const make = (names) => names.map((name) => ({ name, total: 0, days: new Set(), tipo: zeros(ds.tipos.length), vel: zeros(ds.vels.length), equip: new Set(), above: 0 }));
  const S = make(ds.sentidos); const F = make(ds.faixas);
  const matrix = new Map();
  forRows(ds, (e, d, s, f, v, t, n) => {
    for (const g of [S[s], F[f]]) {
      g.total += n; g.days.add(d); g.tipo[t] += n; g.vel[v] += n; g.equip.add(e); if (above.has(v)) g.above += n;
    }
    const key = `${e}|${s}|${f}`;
    matrix.set(key, (matrix.get(key) || 0) + n);
  });
  const fin = (g) => g.filter((x) => x.total > 0).map((x) => ({
    name: x.name, total: x.total, days: x.days.size, meanDaily: x.total / x.days.size,
    tipoPct: shares(x.tipo), velPct: shares(x.vel), tipoAbs: x.tipo, velAbs: x.vel,
    above: x.above, abovePct: pct(x.above, x.total),
    equip: [...x.equip].sort((a, b) => a - b).map((e) => ds.equip[e].id),
  }));
  const grand = S.reduce((a, x) => a + x.total, 0);
  const cells = [...matrix.entries()].map(([k, total]) => {
    const [e, s, f] = k.split('|').map(Number);
    return { equip: ds.equip[e].id, km: ds.equip[e].km, sentido: ds.sentidos[s], faixa: ds.faixas[f], total, share: pct(total, grand) };
  }).sort((a, b) => a.km - b.km);

  // Confusão estrutural: cada equipamento observa um único sentido/faixa?
  const perEquip = new Map();
  cells.forEach((c) => { if (!perEquip.has(c.equip)) perEquip.set(c.equip, new Set()); perEquip.get(c.equip).add(`${c.sentido}|${c.faixa}`); });
  const oneComboPerEquip = [...perEquip.values()].every((x) => x.size === 1);

  return { sentidos: fin(S), faixas: fin(F), cells, grand, oneComboPerEquip };
}

export function above100(ds, limit = 100) {
  const idx = speedAbove(ds, limit);
  const prof = equipmentProfile(ds);
  const rows = prof.rows.map((r) => ({
    id: r.id, km: r.km, municipio: r.municipio, total: r.total, days: r.days,
    above: r.aboveVol, abovePct: r.abovePct, aboveDaily: r.days ? r.aboveVol / r.days : 0,
    byCat: idx.map((v) => ({ label: ds.vels[v].label, abs: r.velAbs[v] })),
  }));
  const byAbs = [...rows].sort((a, b) => b.above - a.above);
  const byPct = [...rows].sort((a, b) => b.abovePct - a.abovePct);
  const byDaily = [...rows].sort((a, b) => b.aboveDaily - a.aboveDaily);
  const rank = (list) => new Map(list.map((r, i) => [r.id, i + 1]));
  const rA = rank(byAbs); const rP = rank(byPct);
  rows.forEach((r) => { r.rankAbs = rA.get(r.id); r.rankPct = rP.get(r.id); });
  return { limit, cats: idx.map((v) => ds.vels[v].label), rows, byAbs, byPct, byDaily, sameLeader: byAbs[0]?.id === byPct[0]?.id };
}
