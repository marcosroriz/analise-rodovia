// Componentes de visualização sem dependências (HTML + SVG).
// Cores são passadas como variáveis CSS para que claro/escuro troquem juntos.

/* ---------------- DOM helpers ---------------- */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  children.flat().forEach((c) => c != null && node.append(c instanceof Node ? c : document.createTextNode(String(c))));
  return node;
}

/* ---------------- Tooltip ---------------- */
let tip;
function tooltip() {
  if (!tip) { tip = h('div', { class: 'tooltip', role: 'status', 'aria-live': 'polite' }); document.body.append(tip); }
  return tip;
}
export function showTip(evt, content) {
  const t = tooltip();
  t.replaceChildren(...(Array.isArray(content) ? content : [content]));
  t.classList.add('on');
  const pad = 14; const r = t.getBoundingClientRect();
  let x = evt.clientX + pad; let y = evt.clientY + pad;
  if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
  t.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
}
export function hideTip() { tooltip().classList.remove('on'); }

const tipRow = (color, label, value) => h('div', { class: 'tip-row' },
  color ? h('span', { class: 'swatch', style: { background: color } }) : null,
  h('span', { class: 'tip-label' }, label), h('span', { class: 'tip-value' }, value));
const tipTitle = (t) => h('div', { class: 'tip-title' }, t);

function bindTip(node, fn) {
  node.addEventListener('pointermove', (e) => { e.stopPropagation(); showTip(e, fn()); });
  node.addEventListener('pointerleave', hideTip);
}

/* ---------------- Legend ---------------- */
export function legend(series) {
  return h('div', { class: 'legend', role: 'list' },
    series.map((x) => h('span', { class: 'legend-item', role: 'listitem' },
      h('span', { class: 'swatch', style: { background: x.color } }), x.name)));
}

/* ---------------- Stacked 100% horizontal bars ---------------- */
/**
 * rows: [{ label, sub?, values:number[] (abs), pcts:number[] }]
 * series: [{ name, color }]
 */
// Segmentos abaixo de `minPct` não são desenhados (seriam invisíveis e o espaçador
// de 2px exageraria sua presença); continuam no tooltip e nas tabelas.
export function stackedBars({ rows, series, fmtPct, fmtAbs, minLabel = 9, minPct = 0.15, showLegend = true, ariaLabel }) {
  const body = h('div', { class: 'stack-chart', role: 'img', 'aria-label': ariaLabel || 'Gráfico de barras empilhadas' });
  rows.forEach((r) => {
    const bar = h('div', { class: 'stack-bar' });
    r.pcts.forEach((p, k) => {
      if (p < minPct) return;
      const seg = h('div', { class: 'stack-seg', style: { width: `${p}%`, background: series[k].color } },
        p >= minLabel ? h('span', { class: 'seg-label', style: { color: series[k].ink || '#fff' } }, fmtPct(p)) : null);
      bindTip(seg, () => [tipTitle(r.label), ...series.map((x, j) => {
        const row = tipRow(x.color, x.name, `${fmtPct(r.pcts[j])} · ${fmtAbs(r.values[j])}`);
        if (j === k) row.classList.add('active');
        return row;
      })]);
      bar.append(seg);
    });
    // Tooltip também na barra inteira (cobre as categorias muito pequenas não desenhadas).
    bindTip(bar, () => [tipTitle(r.label), ...series.map((x, j) => tipRow(x.color, x.name, `${fmtPct(r.pcts[j])} · ${fmtAbs(r.values[j])}`))]);
    body.append(h('div', { class: 'stack-row' },
      h('div', { class: 'row-label' }, h('strong', {}, r.label), r.sub ? h('small', {}, r.sub) : null),
      bar));
  });
  return h('div', { class: 'chart' }, showLegend ? legend(series) : null, body);
}

/* ---------------- Simple horizontal bars ---------------- */
/** items: [{ label, sub?, value, note?, highlight? }] */
export function hBars({ items, fmt, color = 'var(--series-1)', muted = 'var(--series-muted)', ariaLabel, max }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 0);
  return h('div', { class: 'chart hbars', role: 'img', 'aria-label': ariaLabel || 'Gráfico de barras' },
    items.map((it) => {
      const w = top > 0 ? (it.value / top) * 100 : 0;
      const bar = h('div', { class: 'hbar', style: { width: `${Math.max(w, it.value > 0 ? 0.6 : 0)}%`, background: it.highlight === false ? muted : (it.color || color) } });
      const row = h('div', { class: 'hbar-row' },
        h('div', { class: 'row-label' }, h('strong', {}, it.label), it.sub ? h('small', {}, it.sub) : null),
        h('div', { class: 'hbar-track' }, bar, h('span', { class: 'hbar-value' }, fmt(it.value))));
      bindTip(row, () => [tipTitle(it.label), tipRow(null, it.tipLabel || 'Valor', fmt(it.value)), it.note ? h('div', { class: 'tip-note' }, it.note) : null].filter(Boolean));
      return row;
    }));
}

/* ---------------- Vertical columns ---------------- */
/** items: [{ label, value, accent? }] — accent destaca máximos/mínimos. */
export function columns({ items, fmt, fmtAxis = fmt, height = 220, ariaLabel, tipExtra }) {
  const max = Math.max(...items.map((i) => i.value));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const ticks = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const plot = h('div', { class: 'cols-plot', style: { height: `${height}px` } },
    ticks.map((v) => h('div', { class: 'grid-line', style: { bottom: `${(v / top) * 100}%` } }, h('span', {}, fmtAxis(v)))),
    h('div', { class: 'cols' }, items.map((it, i) => {
      const col = h('div', { class: 'col-wrap' },
        h('span', { class: 'col-value' }, it.accent ? fmt(it.value) : ''),
        h('div', { class: `col ${it.accent ? 'accent' : ''}`, style: { height: `${(it.value / top) * 100}%` } }));
      bindTip(col, () => [tipTitle(it.label), tipRow(null, 'Média diária', fmt(it.value)), ...(tipExtra ? tipExtra(it, i) : [])]);
      return col;
    })));
  return h('div', { class: 'chart columns', role: 'img', 'aria-label': ariaLabel || 'Gráfico de colunas' },
    plot, h('div', { class: 'cols-axis' }, items.map((it) => h('span', {}, it.label))));
}

function niceStep(raw) {
  if (raw <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/* ---------------- Line chart (SVG) ---------------- */
/**
 * labels: string[]; series: [{ name, color, values:(number|null)[] }]
 * baseline: valor de referência desenhado como linha (ex.: 100 para índices).
 */
export function lineChart({ labels, series, fmt, fmtAxis = fmt, height = 260, baseline, yMin, ariaLabel, xEvery = 1, markers = true }) {
  const wrap = h('div', { class: 'line-wrap', style: { height: `${height}px` } });
  const all = series.flatMap((x) => x.values).filter((v) => v != null);
  let lo = yMin ?? Math.min(...all, baseline ?? Infinity);
  let hi = Math.max(...all, baseline ?? -Infinity);
  const step = niceStep((hi - lo) / 4 || 1);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;

  // Desenha na largura real do contêiner (texto nunca é esticado).
  const draw = (W) => {
    const H = height; const m = { t: 16, r: 20, b: 30, l: 56 };
    const x = (i) => m.l + (labels.length === 1 ? 0 : (i / (labels.length - 1)) * (W - m.l - m.r));
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo || 1)) * (H - m.t - m.b);
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'line-svg', role: 'img', 'aria-label': ariaLabel || 'Gráfico de linhas' });
    for (let v = lo; v <= hi + 1e-9; v += step) {
      svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid' }));
      svg.append(s('text', { x: m.l - 8, y: y(v) + 4, class: 'axis-text', 'text-anchor': 'end' }, fmtAxis(v)));
    }
    if (baseline != null) svg.append(s('line', { x1: m.l, x2: W - m.r, y1: y(baseline), y2: y(baseline), class: 'baseline' }));
    // Espaça rótulos do eixo x conforme a largura disponível.
    const every = Math.max(xEvery, Math.ceil(labels.length / Math.max(2, Math.floor((W - m.l - m.r) / 70))));
    labels.forEach((l, i) => {
      if (i % every === 0) svg.append(s('text', { x: x(i), y: H - 8, class: 'axis-text', 'text-anchor': i === 0 && labels.length > 12 ? 'start' : 'middle' }, l));
    });
    series.forEach((sr) => {
      let d = ''; let pen = false;
      sr.values.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
      });
      svg.append(s('path', { d, class: 'line', stroke: sr.color }));
      if (markers) sr.values.forEach((v, i) => v != null && svg.append(s('circle', { cx: x(i), cy: y(v), r: 4, fill: sr.color, class: 'dot' })));
    });
    const cross = s('line', { y1: m.t, y2: H - m.b, class: 'crosshair' });
    svg.append(cross);
    const overlay = s('rect', { x: m.l - 10, y: m.t, width: W - m.l - m.r + 20, height: H - m.t - m.b, fill: 'transparent' });
    svg.append(overlay);
    overlay.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = e.clientX - r.left;
      const i = Math.max(0, Math.min(labels.length - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (labels.length - 1))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.classList.add('on');
      showTip(e, [tipTitle(labels[i]), ...series.map((sr) => tipRow(sr.color, sr.name, sr.values[i] == null ? 'sem dados' : fmt(sr.values[i])))]);
    });
    overlay.addEventListener('pointerleave', () => { cross.classList.remove('on'); hideTip(); });
    wrap.replaceChildren(svg);
  };
  let last = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w > 0 && w !== last) { last = w; draw(w); }
  }).observe(wrap);
  return h('div', { class: 'chart' }, series.length > 1 ? legend(series) : null, wrap);
}

/* ---------------- Table ---------------- */
/**
 * columns: [{ key, label, align?, fmt?, cellStyle?(row) }]
 */
export function table({ columns: cols, rows, caption, foot, className = '' }) {
  return h('div', { class: 'table-wrap' },
    h('table', { class: `data-table ${className}` },
      caption ? h('caption', {}, caption) : null,
      h('thead', {}, h('tr', {}, cols.map((c) => h('th', { scope: 'col', class: c.align === 'left' ? 'left' : '' }, c.label)))),
      h('tbody', {}, rows.map((r) => h('tr', { class: r._class || '' }, cols.map((c, j) => {
        const v = typeof c.key === 'function' ? c.key(r) : r[c.key];
        const content = c.fmt ? c.fmt(v, r) : v;
        const tag = j === 0 ? 'th' : 'td';
        return h(tag, { scope: j === 0 ? 'row' : null, class: c.align === 'left' ? 'left' : '', style: c.cellStyle ? c.cellStyle(v, r) : null }, content);
      })))),
      foot ? h('tfoot', {}, foot.map((r) => h('tr', {}, cols.map((c, j) => {
        const v = typeof c.key === 'function' ? c.key(r) : r[c.key];
        return h(j === 0 ? 'th' : 'td', { class: c.align === 'left' ? 'left' : '' }, c.fmt ? c.fmt(v, r) : v);
      })))) : null));
}

/* ---------------- Layout pieces ---------------- */
export const card = (title, subtitle, ...body) => h('section', { class: 'card' },
  title ? h('h3', {}, title) : null, subtitle ? h('p', { class: 'card-sub' }, subtitle) : null, ...body);

export const stat = (label, value, note) => h('div', { class: 'stat' },
  h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-value' }, value), note ? h('span', { class: 'stat-note' }, note) : null);

export const callout = (kind, title, ...body) => h('div', { class: `callout ${kind}` },
  title ? h('strong', { class: 'callout-title' }, title) : null, ...body);

export const chips = (items) => h('div', { class: 'chips' }, items.map((x) => h('span', { class: 'chip' }, x)));

/** Parágrafo aceitando trechos em negrito via [[texto]]. */
export function p(text, cls) {
  const node = h('p', { class: cls });
  String(text).split(/(\[\[.*?\]\])/).forEach((part) => {
    if (part.startsWith('[[')) node.append(h('strong', {}, part.slice(2, -2)));
    else if (part) node.append(part);
  });
  return node;
}
