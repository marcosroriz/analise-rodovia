import './style.css';
import defaultData from './data/dataset.json';
import { normalize } from './lib/analysis.js';
import { decodeBuffer, parseCsv } from './lib/csv.js';
import { int } from './lib/format.js';
import { renderOverview } from './tabs/tab1-overview.js';
import { renderSpeedType } from './tabs/tab2-speed-type.js';
import { renderSpatial } from './tabs/tab3-spatial.js';
import { renderTemporal } from './tabs/tab4-temporal.js';
import { renderDirection } from './tabs/tab5-direction.js';

const TABS = {
  t1: renderOverview,
  t2: renderSpeedType,
  t3: renderSpatial,
  t4: renderTemporal,
  t5: renderDirection,
};

const app = document.getElementById('app');
const state = { ds: normalize(defaultData), tab: 't1', spatialCommon: false, cache: new Map() };

function render() {
  const key = `${state.tab}|${state.spatialCommon}`;
  if (!state.cache.has(key)) {
    try {
      state.cache.set(key, TABS[state.tab](state.ds, state, () => render()));
    } catch (err) {
      console.error(err);
      state.cache.set(key, Object.assign(document.createElement('div'), { className: 'callout warn', textContent: `Erro ao calcular esta análise: ${err.message}` }));
    }
  }
  app.replaceChildren(state.cache.get(key));
  document.querySelectorAll('[role=tab]').forEach((b) => {
    const on = b.dataset.tab === state.tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  app.setAttribute('aria-labelledby', `tab-${state.tab}`);
}

function selectTab(tab, push = true) {
  if (!TABS[tab]) tab = 't1';
  state.tab = tab;
  if (push && location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  render();
}

document.querySelectorAll('[role=tab]').forEach((b) => {
  b.addEventListener('click', () => { selectTab(b.dataset.tab); window.scrollTo({ top: 0 }); });
  b.addEventListener('keydown', (e) => {
    const tabs = [...document.querySelectorAll('[role=tab]')];
    const i = tabs.indexOf(b);
    const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
    if (next) { e.preventDefault(); next.focus(); selectTab(next.dataset.tab); }
  });
});
window.addEventListener('hashchange', () => selectTab(location.hash.slice(1), false));

function updateSource() {
  const { meta, equip } = state.ds;
  document.getElementById('source-line').textContent =
    `Arquivo: ${meta.source} · ${int(meta.records)} registros · ${equip.length} equipamentos · ANTT`;
}

document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  app.replaceChildren(Object.assign(document.createElement('p'), { className: 'loading', textContent: `Processando ${file.name}…` }));
  try {
    const ds = normalize(parseCsv(decodeBuffer(await file.arrayBuffer()), file.name));
    Object.assign(state, { ds, cache: new Map(), spatialCommon: false });
    updateSource();
  } catch (err) {
    alert(`Não foi possível ler o arquivo: ${err.message}`);
  }
  e.target.value = '';
  render();
});

// Tema: segue o sistema; o botão fixa claro/escuro (lembrado quando possível).
const root = document.documentElement;
try { const saved = localStorage.getItem('theme'); if (saved) root.dataset.theme = saved; } catch { /* sem storage */ }
document.getElementById('theme-toggle').addEventListener('click', () => {
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch { /* sem storage */ }
});

updateSource();
selectTab(location.hash.slice(1) || 't1', false);
