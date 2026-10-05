import { directionLane, above100, equipmentProfile, commonPeriod } from '../lib/analysis.js';
import { h, card, callout, p, table, stackedBars, hBars, F, tipoSeries, velSeries } from './common.js';

export function renderDirection(ds) {
  const dl = directionLane(ds);
  const a = above100(ds);
  const tipos = tipoSeries(ds);
  const vels = velSeries(ds);
  const T = ds.tipos;

  const groupBlock = (title, groups, label) => card(title, null,
    table({
      columns: [
        { key: 'name', label, align: 'left' },
        { key: (g) => g.equip.join(', '), label: 'Equipamentos', align: 'left' },
        { key: 'days', label: 'Dias', fmt: F.int },
        { key: 'total', label: 'Volume', fmt: F.int },
        { key: (g) => (g.total / dl.grand) * 100, label: '% do total', fmt: (v) => F.pct(v) },
        { key: 'meanDaily', label: 'Média diária', fmt: F.int },
        { key: 'abovePct', label: '% > 100 km/h', fmt: (v) => F.pct(v) },
      ],
      rows: groups,
    }),
    h('h4', {}, 'Composição por tipo'),
    stackedBars({ rows: groups.map((g) => ({ label: `${label} ${g.name}`, values: g.tipoAbs, pcts: g.tipoPct })), series: tipos, fmtPct: (v) => F.pct(v), fmtAbs: (v) => `${F.int(v)} veíc.` }),
    h('h4', {}, 'Distribuição de velocidades'),
    stackedBars({ rows: groups.map((g) => ({ label: `${label} ${g.name}`, values: g.velAbs, pcts: g.velPct })), series: vels, fmtPct: (v) => F.pct(v), fmtAbs: (v) => `${F.int(v)} veíc.` }));

  const sent = groupBlock('Sentidos de circulação', dl.sentidos, 'Sentido');
  const lane = groupBlock('Faixas da pista', dl.faixas, 'Faixa');

  const matrix = card('Equipamento × sentido × faixa', 'Combinações presentes no arquivo.',
    table({
      columns: [
        { key: 'equip', label: 'Equipamento', align: 'left' }, { key: 'km', label: 'km' },
        { key: 'sentido', label: 'Sentido', align: 'left' }, { key: 'faixa', label: 'Faixa' },
        { key: 'total', label: 'Volume', fmt: F.int }, { key: 'share', label: '% do total', fmt: (v) => F.pct(v) },
      ],
      rows: dl.cells,
    }));

  // Par mais próximo de equipamentos com sentidos opostos: comparação mais justa entre sentidos.
  const prof = equipmentProfile(ds);
  let pair = null;
  for (const x of prof.rows) for (const y of prof.rows) {
    if (x.id >= y.id || x.sentidos.join() === y.sentidos.join()) continue;
    const dist = Math.abs(x.km - y.km);
    if (!pair || dist < pair.dist) pair = { x, y, dist };
  }

  // ---- Texto: sentidos e faixas ----
  const text = [];
  if (dl.oneComboPerEquip) {
    text.push(p(`[[Atenção à estrutura dos dados:]] cada equipamento registra um único sentido e uma única faixa. ${dl.sentidos.map((s) => `${s.name}: ${s.equip.join(', ')}`).join(' · ')}. ${dl.faixas.map((f) => `Faixa ${f.name}: ${f.equip.join(', ')}`).join(' · ')}. Logo, sentido, faixa e equipamento estão sobrepostos: a comparação entre sentidos é idêntica à comparação entre faixas, e ambas misturam diferenças de local.`));
  }
  const cmp = (groups, label) => {
    if (groups.length < 2) return;
    const [g1, g2] = [...groups].sort((x, y) => y.meanDaily - x.meanDaily);
    const tDiff = T.map((t, k) => ({ t, d: g1.tipoPct[k] - g2.tipoPct[k] })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
    const vDiff = ds.vels.map((v, k) => ({ v: v.label, d: g1.velPct[k] - g2.velPct[k] })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
    text.push(p(`[[${label}:]] ${label.toLowerCase()} ${g1.name} soma ${F.int(g1.total)} veículos (${F.int(g1.meanDaily)}/dia, ${g1.equip.length} equip.) e ${g2.name} ${F.int(g2.total)} (${F.int(g2.meanDaily)}/dia, ${g2.equip.length} equip.). A maior diferença de composição está em ${tDiff.t} (${F.pct(g1.tipoPct[T.indexOf(tDiff.t)])} × ${F.pct(g2.tipoPct[T.indexOf(tDiff.t)])}); na velocidade, em ${vDiff.v} (${F.pct(g1.velPct[ds.vels.findIndex((v) => v.label === vDiff.v)])} × ${F.pct(g2.velPct[ds.vels.findIndex((v) => v.label === vDiff.v)])}).${g1.equip.length !== g2.equip.length ? ' Como os grupos têm números diferentes de equipamentos, o volume total não é comparável diretamente.' : ''}`));
  };
  cmp(dl.sentidos, 'Sentido');
  if (!dl.oneComboPerEquip) cmp(dl.faixas, 'Faixa');
  if (pair) {
    const { x, y } = pair;
    text.push(p(`[[Comparação mais controlada:]] ${x.id} (km ${x.km}, ${x.sentidos.join('/')}) e ${y.id} (km ${y.km}, ${y.sentidos.join('/')}) estão a ${pair.dist.toLocaleString('pt-BR')} km um do outro${x.municipio === y.municipio ? `, no mesmo município (${x.municipio})` : ''}, em sentidos opostos. Médias diárias: ${F.int(x.meanDaily)} × ${F.int(y.meanDaily)}. Tipos: ${T.map((t, k) => `${t} ${F.pct(x.tipoPct[k])} × ${F.pct(y.tipoPct[k])}`).join('; ')}. Velocidade > 100 km/h: ${F.pct(x.abovePct)} × ${F.pct(y.abovePct)}.`));
  }

  // ---- Acima de 100 km/h ----
  const absLeader = a.byAbs[0]; const pctLeader = a.byPct[0];
  const rankTable = table({
    columns: [
      { key: 'id', label: 'Equipamento', align: 'left' }, { key: 'km', label: 'km' },
      { key: 'total', label: 'Volume total', fmt: F.int }, { key: 'days', label: 'Dias', fmt: F.int },
      ...a.cats.map((c, i) => ({ key: (r) => r.byCat[i].abs, label: c, fmt: F.int })),
      { key: 'above', label: '> 100 km/h (abs.)', fmt: F.int },
      { key: 'rankAbs', label: 'Rank abs.', fmt: (v) => `${v}º` },
      { key: 'abovePct', label: '% do próprio volume', fmt: (v) => F.pct(v, 3) },
      { key: 'rankPct', label: 'Rank %', fmt: (v) => `${v}º` },
      { key: 'aboveDaily', label: '> 100 km/h por dia', fmt: (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) },
    ],
    rows: a.byAbs,
  });

  const twoCharts = h('div', { class: 'grid-2' },
    card('Ranking por volume absoluto > 100 km/h', 'Número de veículos nas categorias acima de 100 km/h no período.',
      hBars({ items: a.byAbs.map((r) => ({ label: r.id, sub: `km ${r.km}`, value: r.above, highlight: r === absLeader, tipLabel: 'Veículos > 100 km/h', note: `de ${F.int(r.total)} no total` })), fmt: F.int, color: 'var(--fast-2)' })),
    card('Ranking por proporção > 100 km/h', 'Veículos acima de 100 km/h ÷ volume total do próprio equipamento.',
      hBars({ items: a.byPct.map((r) => ({ label: r.id, sub: `km ${r.km}`, value: r.abovePct, highlight: r === pctLeader, tipLabel: '% do volume', note: `${F.int(r.above)} de ${F.int(r.total)} veíc.` })), fmt: (v) => F.pct(v, 3), color: 'var(--fast-2)' })));

  // Robustez: o ranking por proporção se mantém no período comum a todos os equipamentos?
  const cp = commonPeriod(ds);
  const cpRows = cp ? [...equipmentProfile(ds, cp).rows].sort((x, y) => y.abovePct - x.abovePct) : [];
  const dailyLeader = a.byDaily[0];
  const ratio = pctLeader.abovePct / (absLeader.abovePct || 1);
  const why = [
    p(`[[Maior volume absoluto acima de 100 km/h:]] ${absLeader.id} (km ${absLeader.km}), com ${F.int(absLeader.above)} veículos — ${F.pct(absLeader.abovePct, 3)} do seu volume total de ${F.int(absLeader.total)}.`),
    p(`[[Maior proporção acima de 100 km/h:]] ${pctLeader.id} (km ${pctLeader.km}), com ${F.pct(pctLeader.abovePct, 3)} do seu volume (${F.int(pctLeader.above)} de ${F.int(pctLeader.total)} veículos)${a.sameLeader ? '' : `, ${ratio.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} vezes a proporção de ${absLeader.id}`}.`),
    a.sameLeader
      ? p('Neste conjunto, o mesmo equipamento lidera os dois rankings — mas isso não é garantido; veja abaixo por quê.')
      : p(`[[Por que os rankings diferem:]] a contagem absoluta é o produto de dois fatores — quanto tráfego passa pelo equipamento (e por quantos dias ele registrou) e que fração desse tráfego está acima de 100 km/h. ${absLeader.id} lidera em quantidade porque concentra ${F.pct(absLeader.total / dl.grand * 100)} de todo o volume do arquivo, ainda que uma fração mínima dele esteja acima de 100 km/h. ${pctLeader.id} tem um volume total ${(absLeader.total / pctLeader.total).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} vezes menor${pctLeader.days < absLeader.days ? ` e apenas ${F.int(pctLeader.days)} dias de registro (contra ${F.int(absLeader.days)})` : ''}, mas uma fração maior de seus veículos está nessas categorias.`),
    p(`[[Normalizando pelo tempo:]] dividindo pelo número de dias com registro, o maior número de passagens acima de 100 km/h por dia é de ${dailyLeader.id} (${dailyLeader.aboveDaily.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}/dia) — um terceiro critério, que corrige a diferença de período, mas não a de volume.`),
    cpRows.length && cp[1] - cp[0] < (Math.max(...ds.cols.d) - Math.min(...ds.cols.d)) ? p(`[[No período comum]] (${F.date(cp[0])} – ${F.date(cp[1])}), a proporção acima de 100 km/h fica: ${cpRows.map((r) => `${r.id} ${F.pct(r.abovePct, 3)}`).join('; ')}. ${cpRows[0].id === pctLeader.id ? `${pctLeader.id} continua com a maior proporção, portanto o resultado não decorre apenas de ele ter sido observado em um período diferente.` : `No mesmo intervalo, a liderança passa para ${cpRows[0].id}: parte da diferença no período completo vem do período de observação.`}`) : null,
    p('[[Por que não são a mesma medida:]] a quantidade absoluta responde "onde ocorreram mais passagens acima de 100 km/h" e cresce com o volume e com o tempo de observação. A proporção responde "em qual ponto uma passagem tem maior chance de estar acima de 100 km/h" e independe do tamanho do fluxo. Um ponto movimentado pode ter muitas ocorrências com proporção baixa; um ponto pouco movimentado pode ter proporção alta com poucas ocorrências. Comparar equipamentos pela contagem absoluta equivale, em boa parte, a compará-los pelo volume total.'),
    p(`[[Cautela com bases pequenas:]] as categorias acima de 100 km/h somam ${F.int(a.rows.reduce((s, r) => s + r.above, 0))} veículos em todo o arquivo (${F.pct(a.rows.reduce((s, r) => s + r.above, 0) / dl.grand * 100, 3)} do total). Com numeradores tão pequenos, poucas passagens mudam as proporções; e um período de observação diferente (${a.rows.map((r) => `${r.id}: ${F.int(r.days)} dias`).join(', ')}) também afeta a contagem absoluta. A coluna "> 100 km/h por dia" normaliza pelo tempo, mas não pelo volume.`),
  ];

  return h('div', { class: 'tab-body' },
    h('div', { class: 'question' }, h('span', {}, 'Tarefa 5'), h('h2', {}, 'Análise espacial e operacional: sentidos, faixas e velocidades acima de 100 km/h')),
    callout('answer', 'Respostas curtas',
      p(`Maior volume absoluto acima de 100 km/h: [[${absLeader.id}]] (${F.int(absLeader.above)} veículos). Maior proporção acima de 100 km/h: [[${pctLeader.id}]] (${F.pct(pctLeader.abovePct, 3)} do próprio volume).${a.sameLeader ? '' : ' Os rankings são diferentes porque medem coisas diferentes.'}`)),
    sent,
    lane,
    matrix,
    card('Interpretação: sentidos e faixas', null, h('div', { class: 'prose' }, ...text)),
    twoCharts,
    card('Detalhamento acima de 100 km/h por equipamento', null, rankTable),
    card('Absoluto × proporção', null, h('div', { class: 'prose' }, ...why.filter(Boolean))));
}
