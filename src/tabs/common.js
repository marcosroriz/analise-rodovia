// Cores por papel. Tipos de veículo usam a paleta categórica (ordem fixa);
// categorias de velocidade usam duas rampas ordinais: azul até 100 km/h e
// vermelho acima de 100 km/h (escurecendo com a velocidade).

const TIPO_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
const TIPO_INK = ['#fff', '#fff', '#0b0b0b', '#0b0b0b', '#0b0b0b', '#fff'];

export const tipoSeries = (ds) => ds.tipos.map((name, i) => ({ name, color: TIPO_COLORS[i] || 'var(--series-muted)', ink: TIPO_INK[i] || '#fff' }));

export function velSeries(ds, limit = 100) {
  const low = ds.vels.filter((v) => v.lo <= limit).length;
  const high = ds.vels.length - low;
  return ds.vels.map((v, i) => {
    if (v.lo <= limit) {
      const k = Math.round(((i) / Math.max(1, low - 1)) * 3); // 0..3
      return { name: v.label, color: `var(--slow-${k})`, ink: k >= 2 ? '#fff' : '#0b0b0b' };
    }
    const j = i - low;
    const k = Math.round((j / Math.max(1, high - 1)) * 3);
    return { name: v.label, color: `var(--fast-${k})`, ink: k >= 1 ? '#fff' : '#0b0b0b' };
  });
}

export { h, card, stat, callout, chips, p, table, legend, stackedBars, hBars, columns, lineChart } from '../lib/charts.js';
export * as F from '../lib/format.js';
