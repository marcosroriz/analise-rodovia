import { equipmentProfile, commonPeriod } from '../lib/analysis.js';
import { h, card, callout, p, table, stackedBars, hBars, F, tipoSeries, velSeries } from './common.js';

const NOTABLE_PP = 5; // amplitude entre equipamentos a partir da qual a diferença é destacada

/** Diagrama linear da rodovia com a posição (km) de cada equipamento. */
function kmDiagram(rows) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 760; const H = 120; const m = 110;
  const lo = Math.min(...rows.map((r) => r.km)); const hi = Math.max(...rows.map((r) => r.km));
  const span = hi - lo || 1;
  const x = (km) => m + ((km - lo) / span) * (W - 2 * m);
  const maxV = Math.max(...rows.map((r) => r.meanDaily));
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'km-svg');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Posição dos equipamentos ao longo da rodovia');
  const add = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); if (text != null) n.textContent = text; svg.append(n); return n; };
  add('line', { x1: m - 20, x2: W - m + 20, y1: 60, y2: 60, class: 'road' });
  rows.forEach((r, i) => {
    const cx = x(r.km); const rad = 5 + 9 * Math.sqrt(r.meanDaily / maxV);
    const up = i % 2 === 0;
    add('circle', { cx, cy: 60, r: rad, class: 'km-dot' });
    add('text', { x: cx, y: up ? 60 - rad - 20 : 60 + rad + 18, class: 'km-label', 'text-anchor': 'middle' }, `${r.id} · km ${r.km.toLocaleString('pt-BR')}`);
    add('text', { x: cx, y: up ? 60 - rad - 6 : 60 + rad + 32, class: 'km-sub', 'text-anchor': 'middle' }, `${r.municipio} · ${r.sentidos.join('/')}`);
  });
  return h('div', { class: 'km-wrap' }, svg, h('p', { class: 'card-sub' }, 'Esquema linear (não é mapa). Tamanho do círculo ∝ volume médio diário.'));
}

export function renderSpatial(ds, state, rerender) {
  const cp = commonPeriod(ds);
  const useCommon = state.spatialCommon && cp;
  const prof = equipmentProfile(ds, useCommon ? cp : undefined);
  const full = equipmentProfile(ds);
  const commonProf = cp ? equipmentProfile(ds, cp) : null;
  const rows = prof.rows;
  const tipos = tipoSeries(ds);
  const vels = velSeries(ds);

  const fullRange = (() => { let a = Infinity; let b = -Infinity; for (const d of ds.cols.d) { if (d < a) a = d; if (d > b) b = d; } return [a, b]; })();
  const periodBtns = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Período de comparação' },
    h('button', { role: 'radio', 'aria-checked': String(!useCommon), class: !useCommon ? 'on' : '', onclick: () => { state.spatialCommon = false; rerender(); } },
      `Período completo (${F.date(fullRange[0])} – ${F.date(fullRange[1])})`),
    cp ? h('button', { role: 'radio', 'aria-checked': String(!!useCommon), class: useCommon ? 'on' : '', onclick: () => { state.spatialCommon = true; rerender(); } },
      `Período comum a todos (${F.date(cp[0])} – ${F.date(cp[1])})`) : null);

  const volume = card('Volume de veículos por equipamento', 'Média diária = volume ÷ dias com registro do equipamento (neutraliza diferenças de cobertura).',
    hBars({
      items: rows.map((r) => ({ label: `${r.id} · km ${r.km}`, sub: r.municipio, value: r.meanDaily, tipLabel: 'Média diária', note: `Total: ${F.int(r.total)} veíc. em ${F.int(r.days)} dias (${F.pct(r.share)} do volume)` })),
      fmt: (v) => `${F.int(v)} veíc./dia`, ariaLabel: 'Volume médio diário por equipamento',
    }),
    table({
      columns: [
        { key: 'id', label: 'Equipamento', align: 'left' }, { key: 'km', label: 'km' }, { key: 'municipio', label: 'Município', align: 'left' },
        { key: (r) => r.sentidos.join(', '), label: 'Sentido', align: 'left' },
        { key: 'days', label: 'Dias', fmt: F.int }, { key: 'total', label: 'Volume total', fmt: F.int },
        { key: 'share', label: '% do total', fmt: (v) => F.pct(v) }, { key: 'meanDaily', label: 'Média diária', fmt: F.int },
      ],
      rows,
    }));

  const comp = card('Participação percentual por tipo de veículo', null,
    stackedBars({ rows: rows.map((r) => ({ label: r.id, sub: `km ${r.km}`, values: r.tipoAbs, pcts: r.tipoPct })), series: tipos, fmtPct: (v) => F.pct(v), fmtAbs: (v) => `${F.int(v)} veíc.`, ariaLabel: 'Composição por tipo em cada equipamento' }),
    table({
      columns: [{ key: 'id', label: 'Equipamento', align: 'left' }, ...ds.tipos.map((t, k) => ({ key: (r) => r.tipoPct[k], label: t, fmt: (v) => F.pct(v) }))],
      rows, foot: [{ id: 'Todos', tipoPct: prof.tipoOverall }],
    }));

  const speed = card('Distribuição das categorias de velocidade', 'Azul: até 100 km/h · vermelho: acima de 100 km/h.',
    stackedBars({ rows: rows.map((r) => ({ label: r.id, sub: `km ${r.km}`, values: r.velAbs, pcts: r.velPct })), series: vels, fmtPct: (v) => F.pct(v), fmtAbs: (v) => `${F.int(v)} veíc.`, ariaLabel: 'Distribuição de velocidade em cada equipamento' }),
    table({
      columns: [{ key: 'id', label: 'Equipamento', align: 'left' }, ...ds.vels.map((v, k) => ({ key: (r) => r.velPct[k], label: v.label, fmt: (x) => F.pct(x) })),
        { key: (r) => ds.vels[r.medianCat].label, label: 'Categoria mediana' }],
      rows, foot: [{ id: 'Todos', velPct: prof.velOverall, medianCat: medianOf(prof.velOverall) }],
    }));

  // ---- Interpretação ----
  const text = [];
  const byVol = [...rows].sort((a, b) => b.meanDaily - a.meanDaily);
  const hiV = byVol[0]; const loV = byVol[byVol.length - 1];
  text.push(p(`[[Volume:]] o maior volume médio diário está em ${hiV.id} (km ${hiV.km}, ${F.int(hiV.meanDaily)} veíc./dia) e o menor em ${loV.id} (km ${loV.km}, ${F.int(loV.meanDaily)} veíc./dia) — razão de ${(hiV.meanDaily / loV.meanDaily).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} vezes. ${F.list(byVol.map((r) => `${r.id} ${F.pct(r.share)}`))} do volume do período.`));

  const tipoDiffs = prof.tipoSpread.filter((s) => s.range >= NOTABLE_PP);
  if (tipoDiffs.length) {
    text.push(p(`[[Composição por tipo:]] ${tipoDiffs.map((s) => `${s.name} varia de ${F.pct(s.min)} (${s.minEq}) a ${F.pct(s.max)} (${s.maxEq}), amplitude de ${F.pp(s.range).replace('+', '')}`).join('; ')}.`));
  } else text.push(p('[[Composição por tipo:]] as participações dos tipos variam menos de 5 p.p. entre os equipamentos.'));

  // Categoria modal de cada equipamento.
  const modal = rows.map((r) => ({ id: r.id, k: r.velPct.indexOf(Math.max(...r.velPct)), v: Math.max(...r.velPct) }));
  const modalGroups = new Map(); modal.forEach((m) => { if (!modalGroups.has(m.k)) modalGroups.set(m.k, []); modalGroups.get(m.k).push(m); });
  text.push(p(`[[Velocidade:]] ${[...modalGroups.entries()].map(([k, ms]) => `em ${F.list(ms.map((m) => `${m.id} (${F.pct(m.v)})`))} a categoria mais frequente é ${ds.vels[k].label}`).join('; ')}. ${prof.velSpread.filter((s) => s.range >= NOTABLE_PP).map((s) => `A categoria ${s.name} vai de ${F.pct(s.min)} (${s.minEq}) a ${F.pct(s.max)} (${s.maxEq})`).join('. ')}.`));

  // Efeito do período: o que muda quando se compara o mesmo intervalo?
  if (cp && commonProf) {
    const shifts = [];
    full.rows.forEach((r) => {
      const c = commonProf.rows.find((x) => x.id === r.id); if (!c) return;
      ds.tipos.forEach((t, k) => { const d = c.tipoPct[k] - r.tipoPct[k]; if (Math.abs(d) >= 3) shifts.push(`${r.id}/${t}: ${F.pct(r.tipoPct[k])} → ${F.pct(c.tipoPct[k])}`); });
    });
    if (shifts.length) {
      text.push(p(`[[O período importa:]] a composição de um mesmo equipamento muda conforme o intervalo considerado (período completo → período comum): ${shifts.slice(0, 6).join('; ')}${shifts.length > 6 ? '; …' : ''}. Por isso, equipamentos com coberturas diferentes só devem ser comparados no mesmo intervalo — use o seletor acima.`));
    }
  }

  // Equipamento mais distinto: maior desvio (tipo + velocidade) em relação aos demais somados.
  const tvd = (a, b) => 0.5 * a.reduce((acc, x, k) => acc + Math.abs(x - b[k]), 0);
  const distinct = rows.map((r) => {
    const others = rows.filter((o) => o !== r);
    const sum = (key, n) => Array.from({ length: n }, (_, k) => others.reduce((a, o) => a + o[key][k], 0));
    const share = (arr) => { const t = arr.reduce((a, b) => a + b, 0) || 1; return arr.map((x) => (x / t) * 100); };
    return { r, dTipo: tvd(r.tipoPct, share(sum('tipoAbs', ds.tipos.length))), dVel: tvd(r.velPct, share(sum('velAbs', ds.vels.length))) };
  }).sort((a, b) => (b.dTipo + b.dVel) - (a.dTipo + a.dVel));
  const top = distinct[0];

  const heterogeneous = tipoDiffs.length > 0 || modalGroups.size > 1;
  const answer = heterogeneous
    ? `Sim, existem trechos com composição de tráfego diferente. Os pontos monitorados diferem em volume, na participação dos tipos de veículos e na distribuição de velocidades. O ponto mais distinto é ${top.r.id} (km ${top.r.km}): sua composição por tipo difere ${F.pp(top.dTipo).replace('+', '')} e a distribuição de velocidades ${F.pp(top.dVel).replace('+', '')} da dos demais equipamentos somados.`
    : 'O perfil é relativamente homogêneo entre os pontos monitorados.';

  const canSay = h('ul', {},
    h('li', {}, 'Quantos veículos cada equipamento registrou, em quantos dias, e a média diária resultante.'),
    h('li', {}, 'A participação de cada tipo de veículo e de cada categoria de velocidade em cada ponto, e as diferenças em pontos percentuais.'),
    h('li', {}, 'Em que sentido e faixa cada equipamento registra, sua posição (km) e município.'),
    h('li', {}, 'Que parte das diferenças muda conforme o período considerado.'));
  const cannotSay = h('ul', {},
    h('li', {}, 'Por que um trecho tem mais veículos comerciais ou velocidades menores (geometria da via, proximidade urbana, fiscalização, praças de pedágio, acessos etc.) — nenhuma dessas variáveis está no arquivo.'),
    h('li', {}, 'Se as diferenças se devem ao local ou ao sentido: cada equipamento registra um único sentido e faixa, então local e sentido não podem ser separados.'),
    h('li', {}, 'Se a classificação de tipos é feita da mesma forma por todos os equipamentos (diferenças em "Não classificado" podem refletir o equipamento, não o tráfego).'));

  return h('div', { class: 'tab-body' },
    h('div', { class: 'question' }, h('span', {}, 'Tarefa 3'), h('h2', {}, 'O perfil do tráfego é homogêneo ao longo dos pontos monitorados?')),
    callout('answer', 'Resposta curta', p(answer)),
    h('div', { class: 'toolbar' }, h('span', { class: 'toolbar-label' }, 'Comparar no:'), periodBtns),
    card('Posição dos equipamentos', null, kmDiagram(rows)),
    volume,
    comp,
    speed,
    card('Interpretação', useCommon ? `Valores do período comum (${F.date(cp[0])} – ${F.date(cp[1])}).` : 'Valores do período completo de cada equipamento.', h('div', { class: 'prose' }, ...text)),
    h('div', { class: 'grid-2' },
      callout('info', 'O que pode ser afirmado diretamente com base no arquivo', canSay),
      callout('warn', 'O que não pode ser afirmado com estes dados', cannotSay)));
}

function medianOf(pcts) {
  let acc = 0; for (let k = 0; k < pcts.length; k++) { acc += pcts[k]; if (acc >= 50) return k; } return pcts.length - 1;
}
