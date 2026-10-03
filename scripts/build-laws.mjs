#!/usr/bin/env node
// Gera data/laws/<id>.json (consumido pelo app) a partir das fontes oficiais em data/raw/.
// Também grava data/text/<id>.txt, o texto normalizado, para revisão e diff no git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAWS } from './laws.config.mjs';
import { decodeBuffer, htmlToText } from './lib/html-to-text.mjs';
import { pdfToRawText, layoutToUnits } from './lib/pdf-to-text.mjs';
import { parseLaw, applyCorrections } from './lib/parse-law.mjs';
import { buildLessons, collectAcronyms, formatHeading } from './lib/lessons.mjs';
import { selectArticles } from './lib/select.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);

function loadText(law) {
  const file = path.join(root, 'data/raw', law.arquivo);
  if (law.formato === 'pdf') return layoutToUnits(pdfToRawText(file));
  return htmlToText(decodeBuffer(fs.readFileSync(file)));
}

function loadCorrections(id) {
  const f = path.join(root, 'data/corrections', `${id}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
}

fs.mkdirSync(path.join(root, 'data/laws'), { recursive: true });
fs.mkdirSync(path.join(root, 'data/text'), { recursive: true });

const RESUMO = ['id', 'sigla', 'nome', 'descricao', 'status', 'fonte', 'recorte', 'artigos', 'dispositivos', 'licoes', 'unidades'];
const index = [];
for (const law of LAWS) {
  const outFile = path.join(root, 'data/laws', `${law.id}.json`);
  if (only.length && !only.includes(law.id)) {
    if (fs.existsSync(outFile)) {
      const prev = JSON.parse(fs.readFileSync(outFile, 'utf8'));
      index.push(Object.fromEntries(RESUMO.map((k) => [k, prev[k]])));
    }
    continue;
  }
  if (!fs.existsSync(path.join(root, 'data/raw', law.arquivo))) {
    console.warn(`  [${law.id}] fonte data/raw/${law.arquivo} ainda não enviada; norma fora do app.`);
    continue;
  }
  const raw = loadText(law);
  const { text, applied } = applyCorrections(raw, loadCorrections(law.id));
  for (const c of applied.filter((c) => !c.aplicada)) console.warn(`  [${law.id}] correção não encontrada: "${c.de}"`);
  const parsed = parseLaw(text, { id: law.id });
  const avisos = parsed.avisos;
  const { artigos, faltando } = selectArticles(parsed.artigos, law.selecao);
  for (const f of faltando) {
    avisos.push(`Recorte: ${f} não encontrado na fonte.`);
    console.warn(`  [${law.id}] recorte: ${f} não encontrado`);
  }
  const { unidades, licoes } = buildLessons(law.id, artigos);
  const siglas = collectAcronyms(artigos);
  for (const a of artigos) for (const hh of a.hierarquia) hh.titulo = formatHeading(hh.nome, siglas);
  const dispositivos = licoes.reduce((n, l) => n + l.dispositivos.length, 0);

  const resumo = {
    id: law.id, sigla: law.sigla, nome: law.nome, descricao: law.descricao, status: law.status,
    fonte: law.fonte, recorte: Boolean(law.selecao), artigos: artigos.length, dispositivos, licoes: licoes.length, unidades: unidades.length,
  };
  const out = { ...resumo, geradoEm: new Date().toISOString().slice(0, 10), correcoes: applied, avisos, unidades, licoes, artigos };
  fs.writeFileSync(outFile, JSON.stringify(out));
  fs.writeFileSync(path.join(root, 'data/text', `${law.id}.txt`), text + '\n');
  index.push(resumo);
  console.log(`${law.sigla}: ${artigos.length} artigos, ${dispositivos} dispositivos estudáveis, ${unidades.length} unidades, ${licoes.length} lições`);
  for (const a of avisos) console.warn(`  [${law.id}] ${a}`);
}

const order = LAWS.map((l) => l.id);
index.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
fs.writeFileSync(path.join(root, 'data/laws/index.json'), JSON.stringify(index, null, 2) + '\n');
