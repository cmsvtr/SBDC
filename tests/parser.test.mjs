import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeBuffer, htmlToText } from '../scripts/lib/html-to-text.mjs';
import { parseLaw, normalizeOrdinals, extractAnnotations } from '../scripts/lib/parse-law.mjs';
import { buildLessons, isExercisable } from '../scripts/lib/lessons.mjs';
import { layoutToUnits } from '../scripts/lib/pdf-to-text.mjs';

const lei12529 = parseLaw(htmlToText(decodeBuffer(fs.readFileSync(new URL('../data/raw/L12529.html', import.meta.url)))), { id: 'lei-12529' });
const art = (num) => lei12529.artigos.find((a) => a.num === num);

test('htmlToText descarta texto riscado e mantém o resto', () => {
  const t = htmlToText('<p>Art. 1º <strike>texto antigo</strike>texto novo</p><p>§ 1º <span style="text-decoration: line-through">velho</span>ok</p>');
  assert.equal(t, 'Art. 1º texto novo\n§ 1º ok');
});

test('normaliza ordinais do Planalto', () => {
  assert.equal(normalizeOrdinals('Art. 1o Esta Lei'), 'Art. 1º Esta Lei');
  assert.equal(normalizeOrdinals('§ 4o deste artigo'), '§ 4º deste artigo');
  assert.equal(normalizeOrdinals('Lei no 8.137, de 1990'), 'Lei nº 8.137, de 1990');
  assert.equal(normalizeOrdinals('art. 5° da Lei'), 'art. 5º da Lei');
});

test('separa anotações editoriais do texto legal', () => {
  const r = extractAnnotations('os coautores responderão. (Incluído pela Lei nº 14.470, de 2022)');
  assert.equal(r.texto, 'os coautores responderão.');
  assert.deepEqual(r.notas, ['(Incluído pela Lei nº 14.470, de 2022)']);
  const rev = extractAnnotations('(Revogado). (Redação dada pela Lei nº 14.230, de 2021)');
  assert.equal(rev.texto, '');
  assert.equal(rev.notas.length, 2);
});

test('Lei 12.529: todos os artigos, inclusive 46-A e 47-A', () => {
  assert.equal(lei12529.artigos.length, 130);
  assert.ok(art('46-A') && art('47-A'));
  assert.equal(art('1').rotulo, 'Art. 1º');
  assert.equal(art('128').rotulo, 'Art. 128');
});

test('Lei 12.529: hierarquia de títulos e capítulos', () => {
  const h = art('1').hierarquia;
  assert.equal(h[0].tipo, 'TÍTULO');
  assert.equal(h[0].numero, 'I');
  assert.equal(h[1].nome, 'DA FINALIDADE');
});

test('Lei 12.529: art. 36, § 3º tem incisos I a XIX e alíneas a–d no inciso I', () => {
  const devs = art('36').dispositivos;
  const p3 = devs.find((d) => d.rotulo === '§ 3º');
  const incisos = devs.filter((d) => d.tipo === 'inciso' && d.pai === p3.id);
  assert.equal(incisos.length, 19);
  const alineas = devs.filter((d) => d.tipo === 'alinea' && d.pai === incisos[0].id);
  assert.deepEqual(alineas.map((a) => a.rotulo), ['alínea a', 'alínea b', 'alínea c', 'alínea d']);
});

test('Lei 12.529: prazos e valores preservados literalmente', () => {
  const p2 = art('88').dispositivos.find((d) => d.rotulo === '§ 2º');
  assert.match(p2.texto, /240 \(duzentos e quarenta\) dias/);
  const inc1 = art('88').dispositivos.find((d) => d.rotulo === 'inciso I');
  assert.match(inc1.texto, /R\$ 750\.000\.000,00|R\$ 400\.000\.000,00/);
});

test('Lei 12.529: art. 98, § 4º (revogado pelo CPC) não vira exercício', () => {
  const devs = art('98').dispositivos;
  assert.ok(devs.some((d) => d.revogado));
  assert.ok(!devs.some((d) => /preclusão consumativa/.test(d.texto)));
});

test('Lei 12.529: artigos que alteram outras leis ficam fora dos exercícios', () => {
  assert.equal(art('116').alteradora, true);
  assert.equal(art('117').alteradora, true);
  assert.ok(art('116').dispositivos.every((d) => !isExercisable(d, art('116'))));
});

test('nenhum dispositivo carrega anotação do Planalto no texto', () => {
  for (const a of lei12529.artigos) for (const d of a.dispositivos) {
    assert.doesNotMatch(d.texto, /\((Redação dada|Incluíd[oa]|Revogad[oa] pela|Vide )/, `${a.rotulo} ${d.rotulo}`);
  }
});

test('lições cobrem todos os dispositivos estudáveis, sem repetir', () => {
  const { licoes, unidades } = buildLessons('lei-12529', lei12529.artigos);
  const ids = licoes.flatMap((l) => l.dispositivos);
  assert.equal(new Set(ids).size, ids.length);
  const esperados = lei12529.artigos.flatMap((a) => a.dispositivos.filter((d) => isExercisable(d, a)).map((d) => d.id));
  assert.deepEqual(new Set(ids), new Set(esperados));
  assert.ok(licoes.every((l) => l.dispositivos.length <= 14));
  assert.ok(unidades.every((u) => u.licoes.length > 0));
});

test('PDF: junta linhas quebradas e separa artigos colados', () => {
  const raw = 'Art. 1º O Cade, entidade\n judicante com jurisdição.\n 5\nI - primeiro\ninciso;\nArt. 2º Texto. Art. 3º Outro texto.';
  assert.equal(layoutToUnits(raw), 'Art. 1º O Cade, entidade judicante com jurisdição.\nI - primeiro inciso;\nArt. 2º Texto.\nArt. 3º Outro texto.');
});

test('decodifica windows-1252 com travessão e aspas (0x96, 0x93, 0x94)', () => {
  const buf = Buffer.from([...Buffer.from('<meta charset="windows-1252"><p>II '), 0x96, 0x20, 0x93, 0x61, 0x94, 0xe7, ...Buffer.from('</p>')]);
  assert.equal(htmlToText(decodeBuffer(buf)), 'II – “a”ç');
});

test('Lei 7.347: correções da fonte e estrutura do art. 1º e do art. 5º', async () => {
  const { applyCorrections } = await import('../scripts/lib/parse-law.mjs');
  const correcoes = JSON.parse(fs.readFileSync(new URL('../data/corrections/lacp.json', import.meta.url)));
  const bruto = htmlToText(decodeBuffer(fs.readFileSync(new URL('../data/raw/L7347Compilada.html', import.meta.url))));
  const { text, applied } = applyCorrections(bruto, correcoes);
  assert.ok(applied.every((c) => c.aplicada === 1));
  const lacp = parseLaw(text, { id: 'lacp' });
  assert.equal(lacp.artigos.length, 23);
  const a1 = lacp.artigos[0].dispositivos;
  assert.deepEqual(a1.filter((d) => d.tipo === 'inciso').map((d) => d.rotulo.replace('inciso ', '')), ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']);
  const a5 = lacp.artigos.find((a) => a.num === '5').dispositivos;
  assert.match(a5.find((d) => d.rotulo === '§ 4º').texto, /^O requisito da pré-constituição/);
  assert.equal(a5.filter((d) => d.tipo === 'paragrafo').length, 6);
});

test('recorte: mantém só os artigos e incisos escolhidos, com o caput como contexto', async () => {
  const { selectArticles } = await import('../scripts/lib/select.mjs');
  const texto = [
    'Art. 1º Primeiro artigo.',
    'Art. 5º Todos são iguais perante a lei:',
    'I - inciso um;',
    'XXXII - o Estado promoverá a defesa do consumidor;',
    'a) alínea do trinta e dois;',
    'LIV - ninguém será privado da liberdade;',
    '§ 1º Parágrafo fora do recorte.',
    'Art. 9º Fora do recorte.',
  ].join('\n');
  const { artigos } = parseLaw(texto, { id: 'cf' });
  const { artigos: sel, faltando } = selectArticles(artigos, { 1: true, 5: ['inciso XXXII', 'inciso LIV', 'inciso XC'] });
  assert.deepEqual(sel.map((a) => a.num), ['1', '5']);
  assert.deepEqual(faltando, ['Art. 5, inciso XC']);
  const a5 = sel[1].dispositivos;
  assert.deepEqual(a5.map((d) => d.rotulo), ['caput', 'inciso XXXII', 'alínea a', 'inciso LIV']);
  assert.equal(a5[0].contexto, true);
  assert.ok(!a5.slice(1).some((d) => d.contexto));
  const { licoes } = buildLessons('cf', sel);
  const ids = licoes.flatMap((l) => l.dispositivos);
  assert.ok(!ids.includes(a5[0].id));
  assert.equal(ids.length, 4);
});

test('CF: recorte com art. 171 revogado ausente e sem restos de redação riscada no art. 170', () => {
  const cf = JSON.parse(fs.readFileSync(new URL('../data/laws/cf.json', import.meta.url)));
  assert.deepEqual(cf.artigos.map((a) => a.num), ['1', '2', '3', '5', '37', '170', '172', '173', '174']);
  const a170 = cf.artigos.find((a) => a.num === '170').dispositivos;
  assert.equal(a170.filter((d) => d.rotulo === 'inciso IX').length, 1);
  assert.match(a170.find((d) => d.rotulo === 'inciso IX').texto, /^tratamento favorecido para as empresas de pequeno porte constituídas/);
  assert.ok(!a170.some((d) => d.rotulo === '§ 2º'));
  const a5 = cf.artigos.find((a) => a.num === '5').dispositivos;
  assert.deepEqual(a5.map((d) => d.rotulo), ['caput', 'inciso XXXII', 'inciso LIV', 'inciso LV']);
  assert.equal(a5[0].contexto, true);
});

test('Lei 8.137: art. 4º na redação da Lei 12.529 e art. 7º completo', () => {
  const l = JSON.parse(fs.readFileSync(new URL('../data/laws/lei-8137.json', import.meta.url)));
  assert.deepEqual(l.artigos.map((a) => a.num), ['4', '7']);
  const a4 = l.artigos[0].dispositivos;
  assert.match(a4.find((d) => d.rotulo === 'inciso I').texto, /mediante qualquer forma de ajuste ou acordo de empresas;$/);
  assert.equal(a4.find((d) => d.tipo === 'pena').texto, 'Pena - reclusão, de 2 (dois) a 5 (cinco) anos e multa.');
  assert.ok(!a4.some((d) => d.tipo === 'outro'));
  assert.equal(l.artigos[1].dispositivos.filter((d) => d.tipo === 'inciso').length, 9);
});

test('LINDB: arts. 1º a 30, com os arts. 20 a 30 da Lei 13.655/2018', () => {
  const l = JSON.parse(fs.readFileSync(new URL('../data/laws/lindb.json', import.meta.url)));
  assert.equal(l.artigos.length, 30);
  assert.match(l.artigos.find((a) => a.num === '20').dispositivos[0].texto, /^Nas esferas administrativa, controladora e judicial, não se decidirá com base em valores jurídicos abstratos/);
  assert.equal(l.artigos.find((a) => a.num === '25').vetado, true);
});
