// Verificação rápida: roda as análises em Node e confere invariantes
// (somas de percentuais, total geral, médias diárias). Uso: npm test
import { readFileSync } from 'node:fs';
import { decodeBuffer, parseCsv } from '../src/lib/csv.js';
import * as A from '../src/lib/analysis.js';

const ds = A.normalize(parseCsv(decodeBuffer(readFileSync('volume-radar-trans.csv'))));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// Total independente, lendo o CSV linha a linha.
const lines = decodeBuffer(readFileSync('volume-radar-trans.csv')).split(/\r?\n/).slice(1).filter(Boolean);
const rawTotal = lines.reduce((a, l) => a + Number(l.split(';').at(-1)), 0);

const ov = A.overview(ds);
check(ov.total === rawTotal, `volume total ${ov.total} = soma bruta ${rawTotal}`);
check(ov.equipment.reduce((a, e) => a + e.total, 0) === ov.total, 'soma por equipamento = total');

const sc = A.speedComposition(ds);
sc.rows.forEach((r) => check(near(r.sum, 100), `composição ${r.vel.label} soma ${r.sum.toFixed(4)}%`));
check(sc.grand === ov.total, 'tabela velocidade × tipo cobre o total');

const tp = A.temporal(ds);
check(tp.ordered.reduce((a, w) => a + w.dates, 0) === ov.daysWithData, 'datas por dia da semana = datas com dados');
check(near(tp.ordered.reduce((a, w) => a + w.sum, 0), ov.total), 'soma semanal = total');

const dl = A.directionLane(ds);
check(near(dl.sentidos.reduce((a, s) => a + s.total, 0), ov.total), 'soma por sentido = total');
check(near(dl.faixas.reduce((a, s) => a + s.total, 0), ov.total), 'soma por faixa = total');

if (process.argv.includes('--print')) {
  console.dir({ ov, sc, cp: A.commonPeriod(ds), eqAll: A.equipmentProfile(ds), eqCommon: A.equipmentProfile(ds, A.commonPeriod(ds)), tp, dl, a100: A.above100(ds) }, { depth: 6 });
}
process.exit(fails ? 1 : 0);
