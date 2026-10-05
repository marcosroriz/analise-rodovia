import { overview } from '../lib/analysis.js';
import { h, card, stat, callout, chips, p, table, hBars, F, tipoSeries, velSeries } from './common.js';

export function renderOverview(ds) {
  const o = overview(ds);
  const tipoColors = tipoSeries(ds);
  const velColors = velSeries(ds);
  const yrs = ((o.last - o.first + 1) / 365.25).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  const kpis = h('div', { class: 'stats' },
    stat('Período analisado', `${F.date(o.first)} – ${F.date(o.last)}`, `${F.int(o.calendarDays)} dias corridos (~${yrs} anos) · ${F.int(o.daysWithData)} com registros`),
    stat('Equipamentos', F.int(o.equipCount), o.equipment.map((e) => e.id).join(' · ')),
    stat('Volume total registrado', F.int(o.total), `${F.compact(o.total)} passagens de veículos`),
    stat('Registros no arquivo', F.int(o.records), 'linhas agregadas (equipamento × data × sentido × faixa × velocidade × tipo)'),
  );

  const local = card('Rodovia, estado e municípios', 'Valores distintos encontrados nas colunas do arquivo.',
    h('dl', { class: 'facts' },
      h('dt', {}, 'Rodovia(s)'), h('dd', {}, chips(o.rodovias)),
      h('dt', {}, 'Estado(s) (UF)'), h('dd', {}, chips(o.ufs)),
      h('dt', {}, 'Concessionária'), h('dd', {}, chips(o.concessionarias)),
      h('dt', {}, 'Tipo de pista'), h('dd', {}, chips(o.tiposPista)),
      h('dt', {}, `Municípios (${o.municipios.length})`),
      h('dd', {}, h('ul', { class: 'plain' }, o.municipios.map((m) => h('li', {}, h('strong', {}, m.nome), ` — ${m.equip.join(', ')}`))))));

  const equipTable = card('Equipamentos monitorados', 'Ordenados por quilômetro. Cobertura = dias com registro ÷ dias entre o primeiro e o último registro do equipamento.',
    table({
      columns: [
        { key: 'id', label: 'Equipamento', align: 'left' },
        { key: 'km', label: 'km', fmt: (v) => v.toLocaleString('pt-BR') },
        { key: 'municipio', label: 'Município', align: 'left' },
        { key: (r) => `${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}`, label: 'Lat, Lon', align: 'left' },
        { key: (r) => r.sentidos.join(', '), label: 'Sentido', align: 'left' },
        { key: (r) => r.faixas.join(', '), label: 'Faixa' },
        { key: (r) => `${F.date(r.first)} – ${F.date(r.last)}`, label: 'Período', align: 'left' },
        { key: 'days', label: 'Dias c/ dados', fmt: F.int },
        { key: 'coverage', label: 'Cobertura', fmt: (v) => F.pct(v) },
        { key: 'total', label: 'Volume', fmt: F.int },
        { key: 'share', label: '% do total', fmt: (v) => F.pct(v) },
      ],
      rows: o.equipment,
    }));

  const tipos = card('Tipos de veículos', `${o.tipos.length} tipos distintos na coluna tipo_de_veiculo.`,
    hBars({
      items: o.tipos.map((t, i) => ({ label: t.name, sub: F.pct(t.share), value: t.total, color: tipoColors[i].color, tipLabel: 'Volume' })),
      fmt: F.int, ariaLabel: 'Volume por tipo de veículo',
    }));

  const vels = card('Categorias de velocidade', `${o.vels.length} categorias na coluna velocidade (rótulos do arquivo vêm truncados, ex.: "81 - 100 K"; aqui foram normalizados).`,
    table({
      columns: [
        { key: (r) => r.label, label: 'Categoria', align: 'left', fmt: (v, r) => h('span', { class: 'with-swatch' }, h('span', { class: 'swatch', style: { background: velColors[o.vels.indexOf(r)].color } }), v) },
        { key: 'raw', label: 'Rótulo original', align: 'left', fmt: (v) => h('code', {}, `"${v}"`) },
        { key: 'total', label: 'Volume', fmt: F.int },
        { key: 'share', label: '% do total', fmt: (v) => F.pct(v) },
      ],
      rows: o.vels,
    }));

  const sentidos = card('Sentidos e faixas de passagem', 'Combinações sentido × faixa existentes no arquivo e quais equipamentos as registram.',
    h('div', { class: 'grid-2' },
      table({ columns: [{ key: 'name', label: 'Sentido', align: 'left' }, { key: 'total', label: 'Volume', fmt: F.int }, { key: 'share', label: '%', fmt: (v) => F.pct(v) }], rows: o.sentidos }),
      table({ columns: [{ key: 'name', label: 'Faixa', align: 'left' }, { key: 'total', label: 'Volume', fmt: F.int }, { key: 'share', label: '%', fmt: (v) => F.pct(v) }], rows: o.faixas })),
    table({
      columns: [
        { key: 'sentido', label: 'Sentido', align: 'left' }, { key: 'faixa', label: 'Faixa' },
        { key: (r) => r.equip.join(', '), label: 'Equipamentos', align: 'left' },
        { key: 'total', label: 'Volume', fmt: F.int }, { key: 'share', label: '% do total', fmt: (v) => F.pct(v) },
      ],
      rows: o.combos,
    }));

  // Observações de qualidade/estrutura derivadas diretamente do arquivo.
  const notes = [];
  const partial = o.equipment.filter((e) => e.first > o.first || e.last < o.last);
  partial.forEach((e) => notes.push(p(`[[${e.id}]] só possui registros de ${F.date(e.first)} a ${F.date(e.last)} (${F.int(e.days)} dias). Comparações com os demais equipamentos devem considerar a diferença de período — por isso as abas seguintes usam médias diárias e oferecem o recorte de período comum.`)));
  if (o.missingDays > 0) {
    const big = [...o.gaps].sort((a, b) => b.days - a.days).slice(0, 3);
    notes.push(p(`Há [[${F.int(o.missingDays)} dias sem nenhum registro]] dentro do período, em ${o.gaps.length} intervalo(s). Maiores: ${F.list(big.map((g) => (g.days === 1 ? F.date(g.from) : `${F.date(g.from)} a ${F.date(g.to)} (${g.days} dias)`)))}.`));
  }
  const oneCombo = o.equipment.every((e) => e.sentidos.length === 1 && e.faixas.length === 1);
  if (oneCombo) {
    notes.push(p(`Cada equipamento registra [[um único sentido e uma única faixa]]: ${F.list(o.combos.map((c) => `${c.sentido}/faixa ${c.faixa} → ${c.equip.join(', ')}`))}. Assim, comparações entre sentidos ou entre faixas são, na prática, comparações entre conjuntos de equipamentos (ver aba 5).`));
  }

  return h('div', { class: 'tab-body' },
    h('div', { class: 'question' }, h('span', {}, 'Tarefa 1'), h('h2', {}, 'Caracterização do conjunto de dados')),
    kpis,
    notes.length ? callout('info', 'Pontos de atenção na estrutura do arquivo', ...notes) : null,
    h('div', { class: 'grid-2' }, local, tipos),
    equipTable,
    h('div', { class: 'grid-2' }, vels, sentidos));
}
