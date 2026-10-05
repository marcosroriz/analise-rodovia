import { speedComposition } from '../lib/analysis.js';
import { h, card, callout, p, table, stackedBars, F, tipoSeries } from './common.js';

const SIMILAR_PP = 10; // desvio (distância de variação total) até o qual a composição é "semelhante"
const ALERT_PP = 5;    // diferença mínima frente ao geral para alertar em categorias pequenas
const TINY_SHARE = 0.01; // % do volume total abaixo do qual a base é "muito pequena"

export function renderSpeedType(ds) {
  const r = speedComposition(ds, { smallShare: 1 });
  const series = tipoSeries(ds);
  const T = ds.tipos;

  // ---- Tabela pedida: participação de cada tipo dentro da categoria ----
  const badge = (row) => (row.shareOfTotal < TINY_SHARE ? h('span', { class: 'badge warn' }, 'base muito pequena')
    : row.small ? h('span', { class: 'badge' }, 'base pequena') : null);
  const heat = (v) => ({ background: `color-mix(in oklab, var(--series-1) ${Math.min(100, v) * 0.38}%, transparent)` });

  const mainTable = table({
    caption: 'Participação percentual de cada tipo de veículo dentro de cada categoria de velocidade (linhas somam 100%).',
    columns: [
      { key: (x) => x.vel.label, label: 'Velocidade', align: 'left', fmt: (v, x) => h('span', {}, v, ' ', badge(x)) },
      ...T.map((name, k) => ({ key: (x) => x.pct[k], label: name, fmt: (v) => F.pct(v), cellStyle: heat })),
      { key: 'sum', label: 'Soma', fmt: (v) => F.pct(v) },
      { key: 'total', label: 'Veículos na categoria', fmt: F.int },
      { key: 'shareOfTotal', label: '% do volume total', fmt: (v) => F.pct(v) },
    ],
    rows: r.rows,
    foot: [{ vel: { label: 'Todas as categorias' }, pct: r.overall, sum: 100, total: r.grand, shareOfTotal: 100 }],
    className: 'heat',
  });

  const absTable = table({
    caption: 'Volumes absolutos (número de veículos) por categoria de velocidade e tipo.',
    columns: [
      { key: (x) => x.vel.label, label: 'Velocidade', align: 'left' },
      ...T.map((name, k) => ({ key: (x) => x.abs[k], label: name, fmt: F.int })),
      { key: 'total', label: 'Total', fmt: F.int },
    ],
    rows: r.rows,
    foot: [{ vel: { label: 'Total' }, abs: r.overallAbs, total: r.grand }],
  });

  const chart = stackedBars({
    rows: r.rows.map((x) => ({ label: x.vel.label, sub: `${F.int(x.total)} veíc.`, values: x.abs, pcts: x.pct })),
    series, fmtPct: (v) => F.pct(v), fmtAbs: (v) => `${F.int(v)} veíc.`, ariaLabel: 'Composição por tipo de veículo em cada categoria de velocidade',
  });

  // ---- Interpretação gerada a partir dos números ----
  const big = r.rows.filter((x) => !x.small);
  const small = r.rows.filter((x) => x.small);
  const bigShare = big.reduce((a, x) => a + x.shareOfTotal, 0);
  const similar = big.filter((x) => x.tvd <= SIMILAR_PP);
  const different = big.filter((x) => x.tvd > SIMILAR_PP);
  const text = [];

  text.push(p(`No conjunto completo, a frota registrada é composta por ${F.list(T.map((t, k) => `[[${t} ${F.pct(r.overall[k])}]]`))}. Para comparar as categorias, mediu-se o desvio de cada uma em relação a essa composição geral (metade da soma das diferenças absolutas, em pontos percentuais — 0 p.p. = composição idêntica; 100 p.p. = totalmente diferente).`));

  if (similar.length) {
    const maxDev = Math.max(...similar.map((x) => x.tvd));
    text.push(p(`As categorias ${F.list(similar.map((x) => `[[${x.vel.label}]]`))}, que concentram ${F.pct(similar.reduce((a, x) => a + x.shareOfTotal, 0))} do volume, têm composição [[semelhante à geral]] (desvio máximo de ${F.pp(maxDev).replace('+', '')}).`));
  }
  different.forEach((x) => {
    const diffs = T.map((t, k) => ({ t, k, d: x.pct[k] - r.overall[k] })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    const top = diffs[0];
    text.push(p(`A categoria [[${x.vel.label}]] foge do padrão (desvio de ${F.pp(x.tvd).replace('+', '')}): ${top.t} representa ${F.pct(x.pct[top.k])} dos veículos nela, contra ${F.pct(r.overall[top.k])} no geral (${F.pp(top.d)}). Trata-se de uma base expressiva — ${F.int(x.total)} veículos, ${F.pct(x.shareOfTotal)} do total —, portanto essa diferença não é efeito de amostra pequena.`));
  });

  const smallSimilar = small.filter((x) => x.tvd <= SIMILAR_PP);
  if (smallSimilar.length) {
    text.push(p(`Também ficam próximas da composição geral, apesar da base pequena, as categorias ${F.list(smallSimilar.map((x) => `${x.vel.label} (desvio ${F.pp(x.tvd).replace('+', '')})`))}.`));
  }

  // Tendência de cada tipo nas categorias "típicas" (excluídas a atípica e as de base muito pequena).
  const typical = r.rows.filter((x) => x.tvd <= SIMILAR_PP && x.shareOfTotal >= TINY_SHARE);
  if (typical.length >= 2) {
    const trends = T.map((t, k) => {
      const vals = typical.map((x) => x.pct[k]);
      const iMax = vals.indexOf(Math.max(...vals)); const iMin = vals.indexOf(Math.min(...vals));
      return { t, k, vals, range: Math.max(...vals) - Math.min(...vals), iMax, iMin };
    }).sort((a, b) => b.range - a.range);
    text.push(p(`Considerando apenas as categorias típicas com base suficiente (${F.list(typical.map((x) => x.vel.label))}), as participações variam pouco: ${trends.map((tr) => `${tr.t} entre ${F.pct(tr.vals[tr.iMin])} e ${F.pct(tr.vals[tr.iMax])}`).join('; ')}. Não há uma tendência forte de um tipo ganhar ou perder espaço à medida que a velocidade aumenta; a [[ruptura está na categoria mais lenta]]${different.length ? ` (${F.list(different.map((x) => x.vel.label))})` : ''}.`));
  }

  // Categorias pequenas e alertas.
  if (small.length) {
    text.push(p(`As categorias ${F.list(small.map((x) => `${x.vel.label} (${F.int(x.total)} veíc.)`))} somam apenas [[${F.pct(small.reduce((a, x) => a + x.shareOfTotal, 0))} do volume]]. Nelas, os percentuais são calculados sobre bases pequenas e oscilam muito com poucos veículos.`));
  }

  const alerts = [];
  small.forEach((x) => {
    T.forEach((t, k) => {
      const d = x.pct[k] - r.overall[k];
      if (Math.abs(d) >= ALERT_PP) alerts.push({ x, t, k, d });
    });
  });
  const alertList = alerts.length ? h('ul', { class: 'alerts' }, alerts.map(({ x, t, k, d }) => h('li', {},
    p(`[[${x.vel.label} · ${t}: ${F.pct(x.pct[k])}]] (${F.pp(d)} vs. geral) — corresponde a ${F.int(x.abs[k])} de ${F.int(x.total)} veículos em todo o período${x.total < 1000 ? `; cada veículo a mais ou a menos altera esse percentual em ${F.pct(100 / x.total)}` : ''}.`)))) : null;

  const answer = different.length || small.some((x) => x.tvd > SIMILAR_PP)
    ? `Não totalmente. A composição é estável na faixa em que circula a maior parte do tráfego, mas há categorias com perfil diferente — e parte dessas diferenças ocorre em categorias com volume absoluto muito pequeno, que devem ser lidas com cautela.`
    : 'Sim. A composição dos tipos de veículos é semelhante em todas as categorias de velocidade.';

  return h('div', { class: 'tab-body' },
    h('div', { class: 'question' }, h('span', {}, 'Tarefa 2'), h('h2', {}, 'A composição dos tipos de veículos é semelhante entre as diferentes categorias de velocidade?')),
    callout('answer', 'Resposta curta', p(answer)),
    card('Participação dos tipos por categoria de velocidade', `Cada linha soma ~100%. Categorias abaixo de 1% do volume total são marcadas como "base pequena"; abaixo de ${F.pct(TINY_SHARE)}, "base muito pequena".`, mainTable),
    card('Composição visual', 'Barras 100% empilhadas; passe o mouse para ver percentuais e volumes absolutos.', chart),
    card('Interpretação', null, h('div', { class: 'prose' }, ...text)),
    alertList ? callout('warn', 'Percentuais elevados associados a volumes absolutos muito pequenos', p(`Diferenças de pelo menos ${ALERT_PP} p.p. em relação à composição geral, em categorias com menos de 1% do volume:`), alertList) : null,
    h('details', { class: 'card' }, h('summary', {}, 'Ver volumes absolutos'), absTable));
}
