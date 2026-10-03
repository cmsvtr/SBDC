// Transforma o texto de uma lei (uma unidade por linha, ver html-to-text.mjs)
// em uma estrutura de artigos e dispositivos. O texto legal nunca é reescrito:
// só normalizamos ordinais ("1o" -> "1º"), separamos anotações editoriais do
// Planalto ("(Redação dada pela...)") e aplicamos correções explícitas.

const HEADING_LEVELS = [
  ['PARTE', 0], ['LIVRO', 1], ['TÍTULO', 2], ['CAPÍTULO', 3], ['SEÇÃO', 4], ['SUBSEÇÃO', 5],
];
const HEADING_RE = /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O|Se[çc][ãa]o|Subse[çc][ãa]o)\b(.*)$/;

const ART_RE = /^Art\.\s*(\d{1,2}(?:\.\d{3})|\d+)\s*[º°o]?\s*(?:-\s*([A-Z]))?\s*[.\-–]?\s*(.*)$/;
const PAR_RE = /^§\s*(\d+)\s*[º°o]?\s*(?:-\s*([A-Z]))?\s*\.?\s*(.*)$/;
const PAR_UNICO_RE = /^Par[áa]grafo [úu]nico\s*[.:\-–]?\s*(.*)$/i;
const INCISO_RE = /^([IVXLC]+)(?:\s*-\s*([A-Z])(?=\s*[-–—]))?(?:\s*[-–—]\s*|\s+(?=[a-zà-ú(]))(.*)$/;
const ALINEA_RE = /^([a-z])\)\s*(.*)$/;
const PENA_RE = /^Pena\s*[-–—:]\s*(.*)$/;
const END_RE = /^(Bras[íi]lia|Rio de Janeiro),?\s+\d/;

const ANNOTATION_HEAD =
  '(?:Reda[çc][ãa]o dada|Inclu[íi]d[oa]s?|Revogad[oa]s?|Vide|Vig[êe]ncia|Renumerad[oa]|Acrescid[oa]|' +
  'Declarad[oa]|Produ[çc][ãa]o de efeito|Promulga[çc][ãa]o|Regulamento|VETAD[OA]|Vetad[oa]|Suspens[oa])';
const ANNOTATION_RE = new RegExp(`\\s*\\(${ANNOTATION_HEAD}[^()]*(?:\\([^()]*\\)[^()]*)*\\)\\s*\\.?`, 'gi');
const ALTERADORA_RE = /passa(?:m)? a (?:vigorar|ter)|seguinte reda[çc][ãa]o|acrescid[oa]s? d[oa]s? seguintes?|fica(?:m)? acrescid|^Acrescente(?:m)?-se|^Suprima-se|^D[êe]-se a seguinte/i;

export function normalizeOrdinals(s) {
  return s
    .replace(/°/g, 'º')
    .replace(/\b(\d{1,4})o(?=[\s,.;:)\-]|$)/g, '$1º')
    .replace(/\bn\s?[oº]\s?(?=\d)/g, 'nº ')
    .replace(/\bn\s?º\s?s\b/g, 'nºs')
    .replace(/\s+([,;])/g, '$1');
}

export function extractAnnotations(text) {
  const notas = [];
  const limpo = text
    .replace(ANNOTATION_RE, (m) => {
      notas.push(m.trim().replace(/\.$/, ''));
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { texto: limpo, notas };
}

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
export function romanToInt(r) {
  let n = 0;
  for (let i = 0; i < r.length; i++) {
    const v = ROMAN[r[i]], next = ROMAN[r[i + 1]] || 0;
    n += v < next ? -v : v;
  }
  return n;
}

function headingLevel(word) {
  const w = word.toUpperCase().replace('Í', 'I').replace('Ç', 'C').replace('Ã', 'A');
  for (const [k, lvl] of HEADING_LEVELS) {
    if (w === k.replace('Í', 'I').replace('Ç', 'C').replace('Ã', 'A')) return lvl;
  }
  return -1;
}

function isDeviceLine(l) {
  return ART_RE.test(l) || PAR_RE.test(l) || PAR_UNICO_RE.test(l) || ALINEA_RE.test(l) || PENA_RE.test(l) ||
    (INCISO_RE.test(l) && !HEADING_RE.test(l));
}

export function applyCorrections(text, corrections = []) {
  const applied = [];
  for (const c of corrections) {
    const count = text.split(c.de).length - 1;
    if (count === 0) {
      applied.push({ ...c, aplicada: 0 });
      continue;
    }
    text = text.split(c.de).join(c.para);
    applied.push({ ...c, aplicada: count });
  }
  return { text, applied };
}

/**
 * @param {string} text  texto da lei, uma unidade por linha
 * @param {{id: string}} opts
 */
export function parseLaw(text, { id }) {
  const lines = text.split('\n').map((l) => normalizeOrdinals(l.trim())).filter(Boolean);
  const hierarchy = [];
  const artigos = [];
  let art = null;
  let lastPar = null; // último § (ou caput) — pai dos incisos
  let lastInciso = null;
  let started = false;
  const avisos = [];

  const hierarchySnapshot = () => hierarchy.filter(Boolean).map((h) => ({ ...h }));

  function addDevice(tipo, rotulo, rawText, parent) {
    const { texto, notas } = extractAnnotations(rawText);
    const vazio = texto === '' || /^[.;:\s]*$/.test(texto);
    const revogado = vazio && notas.some((n) => /revogad/i.test(n));
    const vetado = vazio && notas.some((n) => /vetad/i.test(n));
    const base = `${id}:${art.num}`;
    let devId = `${base}:${tipo === 'caput' ? 'caput' : rotulo.replace(/\s+/g, '')}`;
    if (parent && (tipo === 'inciso' || tipo === 'alinea')) devId = `${parent.id}:${rotulo.replace(/\s+/g, '')}`;
    // Garante ids únicos mesmo em artigos com texto citado (ex.: alteração de outra lei).
    let unique = devId, k = 2;
    while (art.dispositivos.some((d) => d.id === unique)) unique = `${devId}~${k++}`;
    const d = {
      id: unique,
      tipo,
      rotulo,
      texto: vazio ? '' : texto,
      pai: parent ? parent.id : null,
      revogado,
      vetado,
      notas,
    };
    art.dispositivos.push(d);
    return d;
  }

  function startArticle(num, sufixo, rest) {
    const key = sufixo ? `${num}-${sufixo}` : num;
    const n = parseInt(num.replace('.', ''), 10);
    const label = `Art. ${num}${n < 10 ? 'º' : ''}${sufixo ? `-${sufixo}` : ''}`;
    const existing = artigos.find((a) => a.num === key);
    if (existing) {
      avisos.push(`Artigo ${label} aparece mais de uma vez; mantida a última ocorrência.`);
      artigos.splice(artigos.indexOf(existing), 1);
    }
    art = { num: key, rotulo: label, ordem: artigos.length, hierarquia: hierarchySnapshot(), alteradora: false, dispositivos: [] };
    artigos.push(art);
    lastInciso = null;
    const caput = addDevice('caput', 'caput', rest, null);
    lastPar = caput;
    if (ALTERADORA_RE.test(rest)) art.alteradora = true;
  }

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (END_RE.test(l)) break;

    const h = l.match(HEADING_RE);
    if (h && !ART_RE.test(l)) {
      const lvl = headingLevel(h[1]);
      if (lvl >= 0) {
        let nome = h[2].replace(/^\s*[-–—.:]\s*/, '').trim();
        const tipo = HEADING_LEVELS[lvl][0];
        // "CAPÍTULO I" + linha seguinte com o nome ("DA FINALIDADE").
        let numero = '';
        const mNum = nome.match(/^((?:[IVXLC]+(?:-[A-Z])?)|[ÚU]NIC[OA]|GERAL|ESPECIAL)\b\s*[-–—.:]?\s*(.*)$/i);
        if (mNum) {
          numero = mNum[1];
          nome = mNum[2];
        }
        const next = lines[i + 1];
        if (!nome && next && !isDeviceLine(next) && !HEADING_RE.test(next) && !next.startsWith('(')) {
          nome = next;
          i++;
        }
        const notasH = [];
        if (lines[i + 1] && /^\(/.test(lines[i + 1]) && !isDeviceLine(lines[i + 1])) {
          notasH.push(lines[i + 1]);
          i++;
        }
        const { texto: nomeLimpo } = extractAnnotations(nome);
        hierarchy[lvl] = { nivel: lvl, tipo, numero, nome: nomeLimpo, notas: notasH };
        hierarchy.length = lvl + 1;
        continue;
      }
    }

    const a = l.match(ART_RE);
    if (a && !/^["“]/.test(l)) {
      // Dentro de artigo que altera outra lei, "Art." citado vem entre aspas; o
      // ART_RE já exige que a linha comece com "Art.", então é artigo desta lei.
      started = true;
      startArticle(a[1], a[2], a[3]);
      continue;
    }
    if (!started || !art) continue;

    if (art.alteradora) {
      addDevice('citacao', 'texto citado', l, art.dispositivos[0]);
      continue;
    }

    // Linha só com anotação: o texto riscado (revogado) foi removido e sobrou a nota.
    if (/^\(/.test(l) && extractAnnotations(l).texto === '') {
      const { notas } = extractAnnotations(l);
      if (notas.some((n) => /revogad/i.test(n))) {
        const d = addDevice('outro', 'dispositivo revogado', l, null);
        d.revogado = true;
      } else {
        const last = art.dispositivos[art.dispositivos.length - 1];
        last.notas.push(...notas);
      }
      continue;
    }

    let m;
    if ((m = l.match(PAR_RE))) {
      const rot = `§ ${m[1]}${parseInt(m[1], 10) < 10 ? 'º' : ''}${m[2] ? `-${m[2]}` : ''}`;
      lastPar = addDevice('paragrafo', rot, m[3], null);
      lastInciso = null;
    } else if ((m = l.match(PAR_UNICO_RE))) {
      lastPar = addDevice('paragrafo', 'parágrafo único', m[1], null);
      lastInciso = null;
    } else if ((m = l.match(INCISO_RE))) {
      lastInciso = addDevice('inciso', `inciso ${m[1]}${m[2] ? `-${m[2]}` : ''}`, m[3], lastPar);
    } else if ((m = l.match(ALINEA_RE))) {
      addDevice('alinea', `alínea ${m[1]}`, m[2], lastInciso || lastPar);
    } else if ((m = l.match(PENA_RE))) {
      addDevice('pena', 'pena', `Pena - ${m[1]}`, art.dispositivos[art.dispositivos.length - 1]);
    } else {
      // Linha que não começa com rótulo: continuação do dispositivo anterior.
      const last = art.dispositivos[art.dispositivos.length - 1];
      const { texto, notas } = extractAnnotations(l);
      if (texto) last.texto = `${last.texto} ${texto}`.trim();
      last.notas.push(...notas);
      if (texto) {
        last.revogado = false;
        last.vetado = false;
      }
    }
  }

  // Artigo totalmente revogado/vetado: só o caput, vazio.
  for (const ar of artigos) {
    const vivos = ar.dispositivos.filter((d) => !d.revogado && !d.vetado && d.texto);
    ar.revogado = vivos.length === 0 && ar.dispositivos.some((d) => d.revogado);
    ar.vetado = vivos.length === 0 && !ar.revogado;
  }
  return { artigos, avisos };
}
