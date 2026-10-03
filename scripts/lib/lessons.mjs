// Agrupa os artigos em unidades (Título/Capítulo) e lições curtas.

const PARTICLES = new Set([
  'a', 'à', 'ao', 'aos', 'as', 'às', 'com', 'contra', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'entre',
  'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'sem', 'sobre',
]);

export const MAX_DEVICES_PER_LESSON = 12;
export const MAX_ARTICLES_PER_LESSON = 5;
export const MIN_DEVICES_PER_LESSON = 6;

export function isExercisable(dev, art) {
  return !art.alteradora && !dev.revogado && !dev.vetado && dev.texto && !['citacao', 'outro'].includes(dev.tipo);
}

export function formatHeading(name, acronyms = new Set()) {
  if (!name) return '';
  const letters = name.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters !== letters.toUpperCase()) return name; // já está em caixa mista
  return name
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w, i) => {
      if (/^\s+$|^-$/.test(w)) return w;
      const up = w.toUpperCase();
      if (acronyms.has(up)) return up;
      if (i > 0 && PARTICLES.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join('');
}

function headingLabel(h, acronyms) {
  const tipo = { PARTE: 'Parte', LIVRO: 'Livro', 'TÍTULO': 'Título', 'CAPÍTULO': 'Capítulo', 'SEÇÃO': 'Seção', 'SUBSEÇÃO': 'Subseção' }[h.tipo] || h.tipo;
  const numero = h.numero ? ` ${/^[IVXLC]/.test(h.numero) ? h.numero.toUpperCase() : formatHeading(h.numero)}` : '';
  return { curto: `${tipo}${numero}`, nome: formatHeading(h.nome, acronyms) };
}

function artRange(arts) {
  const first = arts[0], last = arts[arts.length - 1];
  return first === last ? first.rotulo : `${first.rotulo} a ${last.rotulo.replace(/^Art\. /, '')}`;
}

// Sigla = palavra que aparece em caixa alta no corpo do texto e nunca em minúsculas
// (CADE, SBDC), para não confundir com "DAS-6" x "das".
export function collectAcronyms(artigos) {
  const upper = new Set();
  const lower = new Set();
  for (const a of artigos) for (const d of a.dispositivos) {
    for (const m of d.texto.matchAll(/[A-Za-zÀ-ÿ]+/g)) {
      const w = m[0];
      if (w.length >= 2 && w.length <= 6 && w === w.toUpperCase()) upper.add(w);
      if (w === w.toLowerCase()) lower.add(w);
    }
  }
  const s = new Set([...upper].filter((w) => !lower.has(w.toLowerCase())));
  for (const w of ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']) s.add(w);
  return s;
}

export function buildLessons(lawId, artigos) {
  const acronyms = collectAcronyms(artigos);
  const unidades = [];
  const licoes = [];
  let unitKey = null;
  let current = null;

  const unitLevelMax = artigos.some((a) => a.hierarquia.some((h) => h.nivel === 2)) ? 2 : 3;

  function pushLesson(lesson) {
    if (!lesson || lesson.dispositivos.length === 0) return;
    lesson.id = `${lawId}-l${licoes.length + 1}`;
    lesson.faixa = lesson.parte ? `${artRange(lesson._arts)} (parte ${lesson.parte})` : artRange(lesson._arts);
    lesson.artigos = lesson._arts.map((a) => a.num);
    delete lesson._arts;
    licoes.push(lesson);
    unidades[unidades.length - 1].licoes.push(lesson.id);
  }

  for (const art of artigos) {
    const unitPath = art.hierarquia.filter((h) => h.nivel <= unitLevelMax);
    const key = unitPath.map((h) => `${h.tipo}${h.numero}`).join('>') || 'geral';
    // Lições não atravessam capítulos; seções pequenas do mesmo capítulo podem se juntar.
    const groupKey = art.hierarquia.filter((h) => h.nivel <= 3).map((h) => `${h.tipo}${h.numero}`).join('>');
    const devs = art.dispositivos.filter((d) => isExercisable(d, art));

    if (key !== unitKey) {
      pushLesson(current);
      current = null;
      unitKey = key;
      const last = unitPath[unitPath.length - 1];
      const lbl = last ? headingLabel(last, acronyms) : { curto: 'Disposições', nome: '' };
      unidades.push({
        id: `${lawId}-u${unidades.length + 1}`,
        titulo: lbl.nome ? `${lbl.curto} — ${lbl.nome}` : lbl.curto,
        caminho: unitPath.slice(0, -1).map((h) => headingLabel(h, acronyms).curto).join(' › '),
        licoes: [],
      });
    }

    const deepest = art.hierarquia[art.hierarquia.length - 1];
    const titulo = deepest ? headingLabel(deepest, acronyms).nome || headingLabel(deepest, acronyms).curto : 'Disposições';

    if (devs.length > MAX_DEVICES_PER_LESSON + 2) {
      // Artigo longo (ex.: rol de incisos): vira uma ou mais lições só dele.
      pushLesson(current);
      current = null;
      const parts = Math.ceil(devs.length / MAX_DEVICES_PER_LESSON);
      const size = Math.ceil(devs.length / parts);
      for (let p = 0; p < parts; p++) {
        pushLesson({ titulo, grupo: groupKey, parte: parts > 1 ? p + 1 : null, _arts: [art], dispositivos: devs.slice(p * size, (p + 1) * size).map((d) => d.id) });
      }
      continue;
    }

    const small = current && current.dispositivos.length < MIN_DEVICES_PER_LESSON;
    const fits = current && (current.grupo === groupKey || small) &&
      current._arts.length < MAX_ARTICLES_PER_LESSON &&
      current.dispositivos.length + devs.length <= MAX_DEVICES_PER_LESSON;
    if (!fits) {
      pushLesson(current);
      current = { titulo, grupo: groupKey, parte: null, _arts: [], dispositivos: [] };
    }
    current._arts.push(art);
    current.dispositivos.push(...devs.map((d) => d.id));
  }
  pushLesson(current);
  for (const l of licoes) delete l.grupo;
  return { unidades: unidades.filter((u) => u.licoes.length), licoes };
}
