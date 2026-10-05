import { temporal } from '../lib/analysis.js';
import { h, card, stat, callout, p, table, stackedBars, columns, lineChart, F, tipoSeries } from './common.js';

const SHORT = { Segunda: 'Seg', Terça: 'Ter', Quarta: 'Qua', Quinta: 'Qui', Sexta: 'Sex', Sábado: 'Sáb', Domingo: 'Dom' };

export function renderTemporal(ds) {
  const t = temporal(ds);
  const series = tipoSeries(ds);
  const T = ds.tipos;
  const W = t.ordered;

  // ---- Destaques ----
  const kpis = h('div', { class: 'stats' },
    stat('Maior volume médio diário', t.max.name, `${F.int(t.max.mean)} veíc./dia`),
    stat('Menor volume médio diário', t.min.name, `${F.int(t.min.mean)} veíc./dia`),
    stat('Maior aumento entre dias consecutivos', `${t.maxRise.from.name} → ${t.maxRise.to.name}`, `${F.signedPct(t.maxRise.change)} na média diária`),
    stat('Dias úteis × fim de semana', `${F.int(t.weekdays.mean)} × ${F.int(t.weekend.mean)}`, `veíc./dia (${F.signedPct(((t.weekend.mean - t.weekdays.mean) / t.weekdays.mean) * 100)} no fim de semana)`),
  );

  const weekChart = card('Volume médio diário por dia da semana', 'Média diária = soma do volume no dia da semana ÷ número de datas daquele dia no período. Destaques: maior e menor média.',
    columns({
      items: W.map((w) => ({ label: SHORT[w.name], full: w.name, value: w.mean, accent: w === t.max || w === t.min })),
      fmt: (v) => F.int(v), fmtAxis: (v) => F.compact(v), ariaLabel: 'Volume médio diário por dia da semana',
      tipExtra: (it, i) => [h('div', { class: 'tip-note' }, `${W[i].name}: ${W[i].dates} datas no período`)],
    }),
    table({
      columns: [
        { key: 'name', label: 'Dia da semana', align: 'left' },
        { key: 'dates', label: 'Nº de datas', fmt: F.int },
        { key: 'sum', label: 'Soma acumulada', fmt: F.int },
        { key: 'mean', label: 'Média diária', fmt: F.int },
        { key: (w) => t.transitions.find((x) => x.to.i === w.i).change, label: 'Variação vs. dia anterior', fmt: (v) => F.signedPct(v) },
        { key: 'meanEquip', label: 'Equip. ativos (média)', fmt: (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) },
      ],
      rows: W.map((w) => ({ ...w, _class: w === t.max ? 'hi' : w === t.min ? 'lo' : '' })),
    }));

  const transTable = card('Transições entre dias consecutivos', 'Variação percentual da média diária de um dia para o seguinte, no total e por tipo de veículo.',
    table({
      columns: [
        { key: (x) => `${x.from.name} → ${x.to.name}`, label: 'Transição', align: 'left' },
        { key: 'change', label: 'Total', fmt: (v) => F.signedPct(v) },
        ...T.map((name, k) => ({ key: (x) => x.byTipo[k].change, label: name, fmt: (v) => F.signedPct(v) })),
      ],
      rows: t.transitions.map((x) => ({ ...x, _class: x === t.maxRise ? 'hi' : '' })),
    }));

  // ---- Perfil dias úteis × fim de semana ----
  const prof = card('Perfil de tipos: dias úteis × fim de semana', 'Dias úteis = segunda a sexta; fim de semana = sábado e domingo.',
    stackedBars({
      rows: [
        { label: 'Dias úteis', sub: `${F.int(t.weekdays.mean)} veíc./dia`, values: t.weekdays.tipoMean, pcts: t.weekdays.tipoPct },
        { label: 'Fim de semana', sub: `${F.int(t.weekend.mean)} veíc./dia`, values: t.weekend.tipoMean, pcts: t.weekend.tipoPct },
      ],
      series, fmtPct: (v) => F.pct(v), fmtAbs: (v) => `${F.int(v)} veíc./dia`,
    }),
    table({
      columns: [
        { key: 'name', label: 'Tipo', align: 'left' },
        { key: 'wd', label: '% dias úteis', fmt: (v) => F.pct(v) },
        { key: 'we', label: '% fim de semana', fmt: (v) => F.pct(v) },
        { key: (r) => r.we - r.wd, label: 'Diferença', fmt: (v) => F.pp(v) },
        { key: 'wdm', label: 'Média/dia útil', fmt: F.int },
        { key: 'wem', label: 'Média/dia fim de semana', fmt: F.int },
        { key: (r) => ((r.wem - r.wdm) / r.wdm) * 100, label: 'Variação', fmt: (v) => F.signedPct(v) },
      ],
      rows: T.map((name, k) => ({ name, wd: t.weekdays.tipoPct[k], we: t.weekend.tipoPct[k], wdm: t.weekdays.tipoMean[k], wem: t.weekend.tipoMean[k] })),
    }));

  const idx = card('Índice semanal por tipo de veículo', 'Média diária de cada tipo ÷ média semanal do próprio tipo × 100. Permite comparar tipos de tamanhos muito diferentes no mesmo eixo; 100 = dia típico do tipo.',
    lineChart({
      labels: W.map((w) => SHORT[w.name]),
      series: t.tipoIndex.map((x, k) => ({ name: x.name, color: series[k].color, values: x.values })),
      fmt: (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), baseline: 100, ariaLabel: 'Índice semanal por tipo',
    }));

  // Sequência completa de meses (meses sem registro viram lacunas na linha).
  const months = [];
  if (t.monthly.length) {
    const byKey = new Map(t.monthly.map((m) => [m.key, m]));
    let { year, month } = t.monthly[0]; const end = t.monthly[t.monthly.length - 1].key;
    while (year * 100 + month <= end) {
      months.push(byKey.get(year * 100 + month) || { year, month, mean: null });
      month++; if (month > 12) { month = 1; year++; }
    }
  }
  const emptyMonths = months.filter((m) => m.mean == null);

  // ---- Robustez por equipamento ----
  const divergent = (v) => {
    const d = Math.max(-1, Math.min(1, (v - 100) / 25));
    const c = d >= 0 ? 'var(--div-pos)' : 'var(--div-neg)';
    return { background: `color-mix(in oklab, ${c} ${Math.abs(d) * 70}%, var(--div-mid))` };
  };
  const robust = card('O padrão se repete em cada equipamento?', 'Índice do dia da semana por equipamento (média diária do dia ÷ média semanal do equipamento × 100). Vermelho = acima do típico; azul = abaixo.',
    table({
      columns: [
        { key: 'id', label: 'Equipamento', align: 'left' },
        ...W.map((w, i) => ({ key: (r) => r.index[i], label: SHORT[w.name], fmt: (v) => F.int(v), cellStyle: divergent })),
        { key: 'maxDay', label: 'Maior' }, { key: 'minDay', label: 'Menor' }, { key: 'days', label: 'Dias', fmt: F.int },
      ],
      rows: t.perEquip.filter((x) => x.days > 0),
      className: 'heat',
    }));

  const monthly = card('Contexto: média diária por mês', 'Soma dos equipamentos ativos no mês ÷ dias com registro. Mudanças no número de equipamentos ativos afetam o nível da série.',
    lineChart({
      labels: months.map((m) => F.monthLabel(m.year, m.month)),
      series: [{ name: 'Média diária', color: 'var(--series-1)', values: months.map((m) => m.mean) }],
      fmt: (v) => `${F.int(v)} veíc./dia`, fmtAxis: (v) => F.compact(v), xEvery: 6, markers: false, ariaLabel: 'Média diária mensal',
    }),
    p(`Equipamentos ativos por mês: ${summarizeEquip(t.monthly)}.${emptyMonths.length ? ` Meses sem nenhum registro: ${F.list(emptyMonths.map((m) => F.monthLabel(m.year, m.month)))}.` : ''}`, 'card-sub'));

  // ---- Interpretação (responde às cinco perguntas) ----
  const linearRise = t.transitions.filter((x) => x.to !== W[0]).reduce((a, b) => (b.change > a.change ? b : a));
  const intoPeak = t.transitions.find((x) => x.to === t.max);
  const deltaTotal = intoPeak.to.mean - intoPeak.from.mean;
  const contrib = intoPeak.byTipo.map((b) => ({ ...b, share: deltaTotal ? (b.delta / deltaTotal) * 100 : 0 }));
  const lead = [...contrib].sort((a, b) => b.delta - a.delta)[0];
  const profDiff = T.map((name, k) => ({ name, d: t.weekend.tipoPct[k] - t.weekdays.tipoPct[k] })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const profChanges = Math.abs(profDiff[0].d) >= 2;
  const eqAgree = t.perEquip.filter((x) => x.days > 0);
  const sameMax = eqAgree.filter((x) => x.maxDay === t.max.name).map((x) => x.id);
  const sameMin = eqAgree.filter((x) => x.minDay === t.min.name).map((x) => x.id);
  const datesSpread = [Math.min(...W.map((w) => w.dates)), Math.max(...W.map((w) => w.dates))];

  const qa = [
    ['Qual dia da semana possui o maior volume médio diário?',
      `[[${t.max.name}]], com ${F.int(t.max.mean)} veículos/dia em média (${F.signedPct(((t.max.mean - meanOf(W)) / meanOf(W)) * 100)} em relação à média da semana). O mesmo dia é o maior em ${sameMax.length} de ${eqAgree.length} equipamentos (${sameMax.join(', ')}).`],
    ['Qual dia possui o menor volume médio diário?',
      `[[${t.min.name}]], com ${F.int(t.min.mean)} veículos/dia (${F.signedPct(((t.min.mean - meanOf(W)) / meanOf(W)) * 100)} vs. média da semana). É o menor em ${sameMin.length} de ${eqAgree.length} equipamentos${sameMin.length < eqAgree.length ? ` (exceção: ${eqAgree.filter((x) => x.minDay !== t.min.name).map((x) => `${x.id}, cujo menor dia é ${x.minDay}`).join('; ')})` : ''}.`],
    ['Em qual transição entre dias consecutivos ocorre o maior aumento percentual?',
      `[[${t.maxRise.from.name} → ${t.maxRise.to.name}]] (${F.signedPct(t.maxRise.change)}), a retomada após o dia de menor movimento.${linearRise !== t.maxRise ? ` Considerando apenas a sequência dentro da semana (segunda a domingo), o maior aumento é ${linearRise.from.name} → ${linearRise.to.name} (${F.signedPct(linearRise.change)}).` : ''}`],
    ['O perfil de tipos de veículos muda entre dias úteis e finais de semana?',
      profChanges
        ? `[[Sim.]] No fim de semana, ${F.list(profDiff.filter((x) => Math.abs(x.d) >= 0.5).map((x) => `${x.name} ${x.d > 0 ? 'ganha' : 'perde'} ${F.pp(Math.abs(x.d)).replace('+', '')}`))} de participação. ${T.map((name, k) => ({ name, v: ((t.weekend.tipoMean[k] - t.weekdays.tipoMean[k]) / t.weekdays.tipoMean[k]) * 100 })).map((x) => `${x.name}: ${F.signedPct(x.v)}`).join('; ')} na média diária do fim de semana em relação aos dias úteis.`
        : `As participações variam menos de 2 p.p. entre dias úteis e fim de semana; o perfil é estável.`],
    ['O aumento do volume ao final da semana é explicado igualmente por todas as categorias de veículos?',
      `[[Não.]] Na passagem ${intoPeak.from.name} → ${intoPeak.to.name} (${F.signedPct(intoPeak.change)}, +${F.int(deltaTotal)} veíc./dia), ${lead.name} responde por ${F.pct(lead.share)} do acréscimo (${F.signedPct(lead.change)} no próprio tipo). Os demais: ${contrib.filter((c) => c !== lead).map((c) => `${c.name} ${F.signedPct(c.change)} (${F.pct(c.share)} do acréscimo)`).join('; ')}. No fim de semana, a queda também é desigual: de sexta para sábado, ${t.transitions.find((x) => x.from === t.max)?.byTipo.map((b) => `${b.name} ${F.signedPct(b.change)}`).join(', ')}.`],
  ];

  return h('div', { class: 'tab-body' },
    h('div', { class: 'question' }, h('span', {}, 'Tarefa 4'), h('h2', {}, 'Como o tráfego varia ao longo da semana?')),
    kpis,
    card('Respostas', null, h('dl', { class: 'qa' }, qa.flatMap(([q, a]) => [h('dt', {}, q), h('dd', {}, p(a))]))),
    callout('info', 'Por que média diária', p(`O período tem entre ${datesSpread[0]} e ${datesSpread[1]} datas de cada dia da semana (há ${F.int(t.dates)} datas com registro). A soma acumulada favoreceria os dias que aparecem mais vezes; a média diária divide cada soma pelo número de datas do respectivo dia. O número médio de equipamentos ativos é praticamente igual em todos os dias da semana, então a comparação não é distorcida pela cobertura.`)),
    weekChart,
    h('div', { class: 'grid-2' }, prof, idx),
    transTable,
    robust,
    monthly);
}

const meanOf = (W) => W.reduce((a, w) => a + w.mean, 0) / W.length;

function summarizeEquip(monthly) {
  const parts = []; let cur = null;
  monthly.forEach((m) => {
    if (!cur || cur.n !== m.equip) { cur = { n: m.equip, from: m, to: m }; parts.push(cur); } else cur.to = m;
  });
  return parts.map((x) => `${x.n} de ${F.monthLabel(x.from.year, x.from.month)} a ${F.monthLabel(x.to.year, x.to.month)}`).join('; ');
}
