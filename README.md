# Análise dos radares de velocidade — BR-153 (Transbrasiliana)

Sistema web que analisa o arquivo `volume-radar-trans.csv` (tráfego de veículos nos radares de
controle de velocidade, Sistema de Informação de Rodovias da ANTT) em cinco abas:

1. **Caracterização** — período, equipamentos, rodovia/UF/municípios, tipos de veículos, categorias de velocidade, sentidos/faixas e volume total.
2. **Tipo × velocidade** — participação de cada tipo dentro de cada categoria de velocidade, com alerta para percentuais altos sobre bases pequenas.
3. **Distribuição por ponto** — volume, composição por tipo e por velocidade em cada equipamento (período completo ou período comum).
4. **Variação temporal** — médias diárias por dia da semana, transições, dias úteis × fim de semana e contribuição de cada tipo.
5. **Espacial e operacional** — sentidos, faixas e rankings de veículos acima de 100 km/h (absoluto × proporção).

Todos os textos de interpretação são gerados a partir dos números calculados, então o botão
**Carregar outro CSV** (mesmo layout de colunas, `;` ou `,`, UTF-8 ou Latin-1) reprocessa tudo no navegador.

## Como rodar

Requer Node.js 20+.

```bash
npm install
npm run dev      # servidor de desenvolvimento (http://localhost:5173)
npm run build    # gera dist/index.html
npm test         # confere totais e somas das análises
```

### Localmente, sem servidor

`npm run build` gera **um único arquivo** `dist/index.html` com JS, CSS e dados embutidos.
Basta abri-lo com duplo clique no navegador (funciona via `file://`, sem internet).

### Vercel

Importe o repositório na Vercel; `vercel.json` já define `npm run build` e a saída `dist`.
O CSV precisa estar versionado na raiz, pois o build o converte em dados.

## Estrutura

```
volume-radar-trans.csv     dados originais (Latin-1)
scripts/prepare-data.mjs   CSV → src/data/dataset.json (roda antes de dev/build)
scripts/check-analysis.mjs verificações (npm test)
src/lib/csv.js             leitura do CSV (Node e navegador)
src/lib/analysis.js        cálculos das cinco análises (funções puras)
src/lib/charts.js          gráficos e tabelas em HTML/SVG, sem dependências
src/tabs/*.js              uma aba por tarefa, com a interpretação dos resultados
```

## Decisões de análise

- **Médias diárias** (volume ÷ dias com registro) em vez de somas, porque os equipamentos têm coberturas
  diferentes (o LE-89 só tem dados de jan–jun/2022) e há 64 dias sem registro (incluindo abr/2023).
- **Sentido e faixa estão sobrepostos ao equipamento**: cada radar registra um único sentido e faixa
  (Crescente/faixa 1 = só LE-60). A aba 5 explicita isso e compara também o par LE-60 × LE-62 (2 km de distância).
- **"Acima de 100 km/h"** = categorias 101–120, 121–140, 141–160 e > 160 km/h.
- Os rótulos de velocidade vêm truncados no arquivo (`"81 - 100 K"`) e são normalizados pelo limite numérico.
