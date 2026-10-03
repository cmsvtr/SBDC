// Motor de exercícios. Tudo é gerado mecanicamente a partir do texto oficial:
// nenhuma questão afirma algo que não esteja literalmente no dispositivo.
// Módulo puro (sem DOM), usado pelo app e pelos testes em Node.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// Alvos de lacuna
// ---------------------------------------------------------------------------

// "30 (trinta) dias úteis", "R$ 60.000,00 (sessenta mil reais)", "2/3 (dois terços)", "1% (um por cento)"
const NUM_RE = /(?:R\$\s?)?\d[\d.,]*(?:\/\d+)?%?\s?\([^()]{2,80}\)(?:\s(?:dias úteis|dias corridos|dias|dia|anos|ano|meses|mês|horas|hora|minutos|vezes|membros|Conselheiros|testemunhas|reuniões ordinárias consecutivas|salários mínimos|salários-mínimos))?/g;

// Palavras que costumam ser trocadas em provas. A troca é sempre por um antônimo
// no mesmo lugar sintático, então a frase continua gramatical.
export const SWAPS = [
  ['poderá', 'deverá'], ['poderão', 'deverão'], ['pode', 'deve'], ['podem', 'devem'],
  ['mínimo', 'máximo'], ['mínima', 'máxima'], ['inferior', 'superior'],
  ['cumulativamente', 'alternativamente'], ['prévio', 'posterior'], ['prévia', 'posterior'],
  ['obrigatória', 'facultativa'], ['obrigatório', 'facultativo'],
  ['absoluta', 'relativa'], ['absoluto', 'relativo'],
  ['suspende', 'interrompe'], ['suspensão', 'interrupção'],
  ['solidária', 'subsidiária'], ['solidariamente', 'subsidiariamente'],
  ['dolosa', 'culposa'], ['doloso', 'culposo'], ['dolo', 'culpa'],
  ['vedado', 'permitido'], ['vedada', 'permitida'], ['vedados', 'permitidos'],
  ['improrrogáveis', 'prorrogáveis'], ['improrrogável', 'prorrogável'],
  ['maioria absoluta', 'maioria simples'],
  ['expressamente', 'tacitamente'], ['expressa', 'tácita'],
  ['com efeito suspensivo', 'sem efeito suspensivo'],
  ['de ofício', 'a requerimento'],
  ['somente', 'também'],
];
const SWAP_MAP = new Map();
for (const [a, b] of SWAPS) {
  SWAP_MAP.set(a, b);
  SWAP_MAP.set(b, a);
}
const SWAP_RE = new RegExp(
  `(?<![\\p{L}])(${[...SWAP_MAP.keys()].sort((x, y) => y.length - x.length).map((k) => k.replace(/ /g, '\\s')).join('|')})(?![\\p{L}])`,
  'giu',
);

// Expressões institucionais: sequências de palavras com inicial maiúscula.
const CAP = '[A-ZÀ-Ú][a-zà-ú]+(?:-[A-ZÀ-Ú][a-zà-ú]+)?';
const TERM_RE = new RegExp(`${CAP}(?:\\s(?:de|da|do|das|dos|e|junto ao|junto à)?\\s?${CAP})*`, 'g');
const TERM_STOP = new Set(['Lei', 'Art', 'Pena', 'Parágrafo', 'Título', 'Capítulo', 'Seção', 'Subseção', 'Livro', 'Parte', 'Regimento', 'Código', 'Decreto', 'Resolução', 'Anexo', 'Juiz', 'Juízo', 'País', 'Brasil', 'União', 'Este', 'Esta', 'Estes', 'Estas', 'Para', 'Nos', 'Nas', 'Na', 'No', 'Os', 'As', 'Em', 'Ao', 'Aos', 'Se', 'Da', 'Do', 'De', 'Quando', 'Sem', 'Com', 'Salvo', 'Caso']);

const STOPWORDS = new Set('quando sempre também mediante através conforme durante enquanto inclusive respectiva respectivo respectivos respectivas deverá poderá deverão poderão nenhuma qualquer quaisquer referido referida referidos referidas previsto prevista previstos previstas disposto deste desta destes destas nesta neste dessa desse naquela naquele aquela aquele'.split(' '));

function capitalizeLike(model, word) {
  if (model[0] === model[0].toUpperCase() && model[0] !== model[0].toLowerCase()) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return word;
}

function numClass(s) {
  if (s.startsWith('R$')) return 'reais';
  if (/%/.test(s)) return 'percentual';
  if (/\d\/\d/.test(s)) return 'fracao';
  const unit = s.match(/\)\s(.+)$/);
  if (!unit) return 'numero';
  const u = unit[1];
  if (/^dias? úteis$/.test(u)) return 'dias';
  if (/^dias?( corridos)?$/.test(u)) return 'dias';
  return u.replace(/s$/, '');
}

function numValue(s) {
  const m = s.match(/\d[\d.,]*(?:\/\d+)?/);
  return m ? m[0] : s;
}

/** Encontra alvos possíveis num texto: [{tipo, texto, inicio, fim, classe}] */
export function findTargets(text) {
  const out = [];
  for (const m of text.matchAll(NUM_RE)) {
    out.push({ tipo: 'numero', texto: m[0], inicio: m.index, fim: m.index + m[0].length, classe: numClass(m[0]) });
  }
  for (const m of text.matchAll(SWAP_RE)) {
    const key = m[0].toLowerCase().replace(/\s+/g, ' ');
    if (!SWAP_MAP.has(key)) continue;
    if (out.some((t) => m.index < t.fim && m.index + m[0].length > t.inicio)) continue;
    out.push({ tipo: 'chave', texto: m[0], inicio: m.index, fim: m.index + m[0].length, classe: 'chave', troca: capitalizeLike(m[0], SWAP_MAP.get(key)) });
  }
  for (const m of text.matchAll(TERM_RE)) {
    const t = m[0];
    if (m.index === 0) continue; // início de frase
    const before = text.slice(Math.max(0, m.index - 2), m.index);
    if (/[.:;]\s$/.test(before)) continue;
    if (TERM_STOP.has(t) || t.length < 4) continue;
    if (out.some((o) => m.index < o.fim && m.index + t.length > o.inicio)) continue;
    out.push({ tipo: 'termo', texto: t, inicio: m.index, fim: m.index + t.length, classe: 'termo' });
  }
  return out.sort((a, b) => a.inicio - b.inicio);
}

// ---------------------------------------------------------------------------
// Índice da norma
// ---------------------------------------------------------------------------

export function prepareLaw(law) {
  const devs = new Map();
  const devArt = new Map();
  const arts = new Map();
  const studyArts = [];
  const pools = { numero: new Map(), termo: new Map(), palavra: new Map() };
  const termCount = new Map();

  for (const art of law.artigos) {
    arts.set(art.num, art);
    for (const d of art.dispositivos) {
      devs.set(d.id, d);
      devArt.set(d.id, art);
    }
  }
  const studyIds = new Set(law.licoes.flatMap((l) => l.dispositivos));
  for (const art of law.artigos) {
    if (art.dispositivos.some((d) => studyIds.has(d.id))) studyArts.push(art);
  }
  for (const id of studyIds) {
    const d = devs.get(id);
    for (const t of findTargets(d.texto)) {
      if (t.tipo === 'numero') {
        if (!pools.numero.has(t.classe)) pools.numero.set(t.classe, new Set());
        pools.numero.get(t.classe).add(t.texto);
      } else if (t.tipo === 'termo') {
        termCount.set(t.texto, (termCount.get(t.texto) || 0) + 1);
      }
    }
    for (const [w] of d.texto.matchAll(/(?<!\p{L})[a-zà-ú]{7,}(?!\p{L})/gu)) {
      if (STOPWORDS.has(w)) continue;
      const suf = w.slice(-3);
      if (!pools.palavra.has(suf)) pools.palavra.set(suf, new Set());
      pools.palavra.get(suf).add(w);
    }
  }
  // Só termos recorrentes viram alvo (evita nomes de leis citadas uma única vez);
  // palavra isolada precisa ser ainda mais frequente para contar como instituição.
  const termos = [...termCount].filter(([t, n]) => n >= (/[\s-]/.test(t) ? 2 : 3)).map(([t]) => t);
  pools.termo.set('termo', new Set(termos));
  return { law, devs, devArt, arts, studyArts, pools, termos: new Set(termos), studyIds };
}

function distractorsFor(idx, target, rng, n = 3) {
  const used = new Set([target.texto.toLowerCase()]);
  const res = [];
  const add = (s) => {
    if (res.length >= n || !s || used.has(s.toLowerCase())) return;
    used.add(s.toLowerCase());
    res.push(s);
  };
  if (target.tipo === 'chave') {
    add(target.troca);
    return res;
  }
  if (target.tipo === 'numero') {
    // Pegadinha clássica: mesmo número, "dias" x "dias úteis".
    if (/dias úteis$/.test(target.texto)) add(target.texto.replace(/ úteis$/, ''));
    else if (/\bdias$/.test(target.texto)) add(`${target.texto} úteis`);
    const val = numValue(target.texto);
    const pool = [...(idx.pools.numero.get(target.classe) || [])].filter((s) => numValue(s) !== val);
    for (const s of shuffle(pool, rng)) add(s);
    return res;
  }
  if (target.tipo === 'termo') {
    const pool = [...idx.pools.termo.get('termo')].filter((s) => !s.includes(target.texto) && !target.texto.includes(s));
    // Prefere termos com o mesmo número de palavras e tamanho parecido, para não denunciar a resposta.
    const words = (s) => s.split(/\s+/).length;
    const dist = (s) => Math.abs(words(s) - words(target.texto)) * 100 + Math.abs(s.length - target.texto.length);
    const sorted = shuffle(pool, rng).sort((a, b) => dist(a) - dist(b));
    for (const s of sorted.slice(0, 8).sort(() => rng() - 0.5)) add(s);
    return res;
  }
  if (target.tipo === 'palavra') {
    const pool = [...(idx.pools.palavra.get(target.texto.slice(-3)) || [])]
      .filter((w) => w.slice(0, 5) !== target.texto.slice(0, 5));
    for (const s of shuffle(pool, rng)) add(s);
  }
  return res;
}

function wordTargets(text) {
  const out = [];
  for (const m of text.matchAll(/(?<!\p{L})[a-zà-ú]{8,}(?!\p{L})/gu)) {
    if (STOPWORDS.has(m[0])) continue;
    out.push({ tipo: 'palavra', texto: m[0], inicio: m.index, fim: m.index + m[0].length, classe: 'palavra' });
  }
  return out;
}

export function contextOf(idx, dev) {
  const chain = [];
  let p = dev.pai ? idx.devs.get(dev.pai) : null;
  while (p) {
    chain.unshift(p);
    p = p.pai ? idx.devs.get(p.pai) : null;
  }
  return chain.map((d) => ({ rotulo: d.rotulo, texto: d.texto }));
}

export function deviceLabel(idx, dev) {
  const art = idx.devArt.get(dev.id);
  if (dev.tipo === 'caput') return `${art.rotulo}, caput`;
  const chain = [];
  let d = dev;
  while (d && d.tipo !== 'caput') {
    chain.unshift(d.rotulo);
    d = d.pai ? idx.devs.get(d.pai) : null;
  }
  return `${art.rotulo}, ${chain.join(', ')}`;
}

function usableTargets(idx, dev) {
  return findTargets(dev.texto).filter((t) => t.tipo !== 'termo' || idx.termos.has(t.texto));
}

function chooseTarget(idx, dev, rng, prefer) {
  const all = usableTargets(idx, dev);
  const byType = (t) => all.filter((x) => x.tipo === t);
  const order = prefer ? [prefer] : ['numero', 'chave', 'termo'];
  for (const t of order) {
    const c = byType(t);
    if (c.length) return pick(c, rng);
  }
  if (!prefer) {
    const w = wordTargets(dev.texto);
    if (w.length) return pick(w, rng);
  }
  return null;
}

export function exerciseKey(ex) {
  return `${ex.devId}|${ex.tipo}|${ex.alvo || ''}`;
}

// ---------------------------------------------------------------------------
// Tipos de exercício
// ---------------------------------------------------------------------------

export const TIPOS = {
  lacuna: 'Complete a lacuna',
  vf: 'Certo ou errado?',
  artigo: 'Qual é o artigo?',
  digitar: 'Digite o número',
};

export function buildExercise(idx, devId, tipo, rng) {
  const dev = idx.devs.get(devId);
  if (!dev || !dev.texto) return null;
  const base = { devId, tipo, rotulo: deviceLabel(idx, dev), contexto: contextOf(idx, dev), notas: dev.notas || [], original: dev.texto };

  if (tipo === 'lacuna') {
    // Tenta alvos em ordem de valor didático até achar um com alternativas suficientes.
    const candidates = [
      ...shuffle(usableTargets(idx, dev).filter((t) => t.tipo === 'numero'), rng),
      ...shuffle(usableTargets(idx, dev).filter((t) => t.tipo === 'chave'), rng),
      ...shuffle(usableTargets(idx, dev).filter((t) => t.tipo === 'termo'), rng),
      ...shuffle(wordTargets(dev.texto), rng).slice(0, 4),
    ];
    for (const t of candidates) {
      const ds = distractorsFor(idx, t, rng, 3);
      const min = t.tipo === 'chave' ? 1 : 2;
      if (ds.length < min) continue;
      return {
        ...base,
        alvo: t.texto,
        alvoTipo: t.tipo,
        antes: dev.texto.slice(0, t.inicio),
        depois: dev.texto.slice(t.fim),
        opcoes: shuffle([t.texto, ...ds], rng),
        resposta: t.texto,
      };
    }
    return null;
  }

  if (tipo === 'digitar') {
    const nums = usableTargets(idx, dev).filter((t) => t.tipo === 'numero');
    if (!nums.length) return null;
    const t = pick(nums, rng);
    const valor = numValue(t.texto);
    // Esconde só o número; o extenso entre parênteses daria a resposta.
    const unidade = t.texto.replace(/^(?:R\$\s?)?\d[\d.,]*(?:\/\d+)?%?\s?\([^()]*\)\s?/, '');
    return {
      ...base,
      alvo: t.texto,
      alvoTipo: 'numero',
      antes: dev.texto.slice(0, t.inicio) + (t.texto.startsWith('R$') ? 'R$ ' : ''),
      depois: (unidade ? ` ${unidade}` : '') + dev.texto.slice(t.fim),
      resposta: valor,
      respostaCompleta: t.texto,
    };
  }

  if (tipo === 'vf') {
    const podeTrocar = usableTargets(idx, dev).some((t) => t.tipo !== 'termo' || idx.pools.termo.get('termo').size > 1);
    if (!podeTrocar) return null;
    const verdadeiro = rng() < 0.5;
    if (verdadeiro) return { ...base, alvo: 'original', texto: dev.texto, verdadeiro: true, resposta: true };
    // Sem troca possível, não gera a questão: devolver o original aqui deixaria
    // "Certo" mais provável que "Errado".
    const t = chooseTarget(idx, dev, rng, 'chave') || chooseTarget(idx, dev, rng, 'numero') || chooseTarget(idx, dev, rng, 'termo');
    if (!t) return null;
    const ds = distractorsFor(idx, t, rng, 1);
    if (!ds.length) return null;
    return {
      ...base,
      alvo: t.texto,
      texto: dev.texto.slice(0, t.inicio) + ds[0] + dev.texto.slice(t.fim),
      trocado: { de: t.texto, para: ds[0], inicio: t.inicio },
      verdadeiro: false,
      resposta: false,
    };
  }

  if (tipo === 'artigo') {
    const art = idx.devArt.get(devId);
    const pos = idx.studyArts.indexOf(art);
    if (pos < 0 || idx.studyArts.length < 4) return null;
    const near = idx.studyArts.slice(Math.max(0, pos - 8), pos + 9).filter((a) => a !== art);
    const opts = shuffle(near, rng).slice(0, 3).map((a) => a.rotulo);
    if (opts.length < 3) return null;
    const rot = dev.tipo === 'caput' ? '' : dev.rotulo;
    return { ...base, alvo: art.num, texto: dev.texto, rotuloDispositivo: rot, opcoes: shuffle([art.rotulo, ...opts], rng), resposta: art.rotulo };
  }
  return null;
}

const PESOS = { lacuna: 4, vf: 3, artigo: 1.5, digitar: 1.5 };
function weightedPick(tipos, rng) {
  const total = tipos.reduce((s, t) => s + PESOS[t], 0);
  let r = rng() * total;
  for (const t of tipos) {
    r -= PESOS[t];
    if (r <= 0) return t;
  }
  return tipos[tipos.length - 1];
}

/** Tipos liberados por nível de domínio da lição (0 = primeira vez). */
export function tiposPorNivel(nivel) {
  if (nivel <= 0) return ['lacuna', 'vf'];
  if (nivel === 1) return ['lacuna', 'vf', 'artigo'];
  return ['lacuna', 'vf', 'artigo', 'digitar'];
}

/**
 * Monta uma sessão de exercícios cobrindo os dispositivos dados.
 * @param {{n?: number, nivel?: number, rng: () => number, excluir?: Set<string>, tipos?: string[]}} opts
 */
export function buildSession(idx, devIds, { n = 10, nivel = 0, rng, excluir = new Set(), tipos } = {}) {
  const allowed = tipos || tiposPorNivel(nivel);
  const exercises = [];
  const seen = new Set();
  const pool = shuffle(devIds.filter((id) => idx.devs.get(id)?.texto), rng);
  if (!pool.length) return [];
  let attempts = 0;
  let i = 0;
  while (exercises.length < n && attempts < n * 12) {
    attempts++;
    const devId = pool[i++ % pool.length];
    const tipo = weightedPick(allowed, rng);
    const ex = buildExercise(idx, devId, tipo, rng);
    if (!ex) continue;
    const key = exerciseKey(ex);
    if (excluir.has(key)) continue;
    const dedupe = `${key}|${ex.texto || ex.antes || ''}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    exercises.push(ex);
  }
  return exercises;
}

export function normalizeNumber(s) {
  return String(s).replace(/[^\d/,%]/g, '').replace(/,00$/, '');
}

export function checkAnswer(ex, answer) {
  if (ex.tipo === 'digitar') return normalizeNumber(answer) !== '' && normalizeNumber(answer) === normalizeNumber(ex.resposta);
  return answer === ex.resposta;
}
