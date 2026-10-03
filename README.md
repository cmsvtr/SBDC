# LexQuest — letra da lei, em jogo

App web gamificado (PWA, funciona offline e pode ser instalado no celular) para memorizar e entender
os dispositivos de:

| Norma | Fonte | Artigos | Dispositivos estudáveis | Lições | Status |
|---|---|---|---|---|---|
| Lei 12.529/2011 (Defesa da Concorrência) | Planalto | 130 | 505 | 60 | revisada |
| Regimento Interno do Cade (versão 22/06/2026) | Cade (PDF) | 234 | 1.121 | 126 | beta |
| Lei 8.429/1992 (Improbidade, compilada) | Planalto | 35 | 219 | 24 | beta |
| Lei 8.078/1990 (CDC, compilado) | Planalto | 130 | 426 | 51 | beta |
| Lei 13.105/2015 (CPC, compilado) | Planalto | 1.073 | 3.896 | 436 | beta |

"Revisada" quer dizer que a importação foi conferida por testes automatizados específicos (estrutura do
art. 36, prazos do art. 88, revogação do art. 98, § 4º etc.). "Beta" quer dizer que a importação passou
pelos testes genéricos, mas ainda não foi conferida dispositivo a dispositivo.

## Como funciona

- **Conteúdo fiel à letra da lei.** Nenhuma questão é escrita à mão. Todas são geradas mecanicamente a
  partir do texto oficial, então nenhuma afirma algo que não esteja no dispositivo.
- **Tipos de exercício:**
  - *Complete a lacuna:* prazos, valores, órgãos e palavras-chave, com alternativas tiradas da própria norma.
  - *Certo ou errado?:* o texto original ou uma versão com uma troca típica de banca (poderá↔deverá,
    dias↔dias úteis, mínimo↔máximo, órgão trocado…).
  - *Qual é o artigo?*
  - *Digite o número:* recordação ativa de prazos e valores.
- **Progressão:** trilha por Título/Capítulo, com lições curtas (até 12 dispositivos). Cada lição tem 3
  níveis, e os tipos de questão ficam mais difíceis a cada vez que você a conclui.
- **Gamificação:** XP, níveis, vidas por lição, combos, estrelas, ofensiva diária (🔥), meta diária e conquistas.
- **Repetição espaçada:** cada dispositivo tem uma caixa de Leitner (intervalos de 0, 1, 3, 7, 15 e 30
  dias). O botão "Revisar" traz o que está vencendo.
- **Leitura:** texto integral com busca, títulos e notas do Planalto (ex.: "Vide ADI…").
- **Questão com problema?** Remove a questão do seu jogo e a guarda numa lista exportável em JSON (no
  Perfil), para correção do importador.
- **Progresso** salvo no navegador, com exportação e importação de backup no Perfil.

## Jogar no celular

O app é publicado automaticamente no GitHub Pages a cada push na `main`:
**https://cmsvtr.github.io/SBDC/**

1. Abra o link no celular.
2. Instale na tela inicial:
   - **Android (Chrome):** toque em "Instalar" no cartão da tela inicial do app, ou use o menu ⋮ → "Instalar app".
   - **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início". No iPhone, instalar também evita que o
     Safari apague o progresso depois de alguns dias sem uso.
3. Depois da primeira abertura, o app funciona sem internet. Cada norma fica disponível offline depois que
   você a abre uma vez.

Configuração única no GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. O
workflow `.github/workflows/pages.yml` roda os testes e publica só o app, sem as fontes brutas.

## Rodar localmente

Não há dependências de runtime. O app é HTML, CSS e JS puro.

```bash
npm start          # serve em http://localhost:8080 (python3 -m http.server)
npm test           # testes (node --test)
npm run build:data # regenera data/laws/*.json a partir de data/raw/
```

Para publicar, sirva a pasta como site estático (GitHub Pages, Netlify etc.). O service worker exige HTTPS
ou `localhost`.

## Atualizar ou incluir uma norma

1. Salve a página do Planalto (HTML, "texto compilado") ou o PDF oficial em `data/raw/`.
2. Cadastre ou atualize a entrada em `scripts/laws.config.mjs`.
3. Rode `npm run build:data` e `npm test`.
4. Confira o diff de `data/text/<id>.txt`, o texto normalizado, para ver exatamente o que mudou.

Erros de digitação da própria fonte podem ser corrigidos de forma auditável em
`data/corrections/<id>.json` (`[{ "de": "...", "para": "...", "motivo": "..." }]`), sem editar o arquivo
original.

### Regras do importador

- Texto riscado no HTML (`<strike>`, `line-through`) é redação revogada e é descartado.
- Anotações como "(Redação dada pela…)", "(Incluído pela…)" e "(Vide ADI…)" saem do texto e ficam como
  notas do dispositivo.
- Dispositivos revogados ou vetados aparecem na leitura, mas não geram exercícios.
- Artigos que só alteram outras leis (ex.: art. 116 da Lei 12.529; arts. 110 a 117 do CDC) aparecem na
  leitura, mas não geram exercícios.

## Limitações conhecidas

- **Letra da lei ≠ direito vigente aplicado.** O app ensina o texto como publicado. Exemplos: os valores
  do art. 88 da Lei 12.529 (R$ 400 mi / R$ 30 mi) foram atualizados por portaria interministerial, e
  dispositivos da LIA têm eficácia afetada por ADIs. As notas do Planalto aparecem na tela, mas o app não
  ensina jurisprudência.
- **O RICade vem de PDF.** A reconstrução das linhas é heurística. Use "Questão com problema?" quando algo
  parecer quebrado.
- O progresso não sincroniza entre aparelhos. Use exportar/importar.

## Estrutura

```
index.html, css/, js/          app (PWA)
  js/engine.js                 geração e correção de exercícios (puro, testado em Node)
  js/game.js, js/srs.js        gamificação e repetição espaçada
  js/store.js                  persistência (localStorage + backup)
sw.js, manifest.webmanifest    offline e instalação
scripts/                       importador: HTML/PDF → texto → artigos/dispositivos → lições
data/raw/                      fontes oficiais
data/text/                     texto normalizado (para revisão/diff)
data/laws/                     JSON consumido pelo app
tests/                         node --test
```
