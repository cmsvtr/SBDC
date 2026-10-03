import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareLaw, buildExercise, buildSession, checkAnswer, findTargets, mulberry32 } from '../js/engine.js';

const carregar = (id) => JSON.parse(fs.readFileSync(new URL(`../data/laws/${id}.json`, import.meta.url)));
const lei = carregar('lei-12529');
const idx = prepareLaw(lei);
const todos = lei.licoes.flatMap((l) => l.dispositivos);

test('encontra prazos, valores e palavras de pegadinha', () => {
  const t = findTargets('poderá ser dilatado por até 60 (sessenta) dias, mediante multa de R$ 60.000,00 (sessenta mil reais)');
  const tipos = t.map((x) => `${x.tipo}:${x.texto}`);
  assert.ok(tipos.includes('chave:poderá'));
  assert.ok(tipos.includes('numero:60 (sessenta) dias'));
  assert.ok(tipos.includes('numero:R$ 60.000,00 (sessenta mil reais)'));
});

test('lacuna: resposta entre as opções, opções distintas, texto reconstrói o original', () => {
  const rng = mulberry32(42);
  let n = 0;
  for (const id of todos) {
    const ex = buildExercise(idx, id, 'lacuna', rng);
    if (!ex) continue;
    n++;
    assert.ok(ex.opcoes.includes(ex.resposta), id);
    assert.equal(new Set(ex.opcoes).size, ex.opcoes.length, id);
    assert.equal(ex.antes + ex.resposta + ex.depois, ex.original, id);
  }
  assert.ok(n > todos.length * 0.9, `lacunas geradas para ${n} de ${todos.length}`);
});

test('certo/errado: versão errada difere do original em exatamente um trecho', () => {
  for (let seed = 1; seed <= 3; seed++) {
    const rng = mulberry32(seed);
    for (const id of todos) {
      const ex = buildExercise(idx, id, 'vf', rng);
      if (!ex) continue;
      if (ex.verdadeiro) {
        assert.equal(ex.texto, ex.original);
      } else {
        assert.notEqual(ex.texto, ex.original);
        const { de, para, inicio } = ex.trocado;
        assert.equal(ex.original.slice(0, inicio) + para + ex.original.slice(inicio + de.length), ex.texto);
      }
    }
  }
});

test('qual artigo: resposta é o artigo do dispositivo', () => {
  const rng = mulberry32(7);
  for (const id of todos.slice(0, 200)) {
    const ex = buildExercise(idx, id, 'artigo', rng);
    if (!ex) continue;
    assert.equal(ex.resposta, idx.devArt.get(id).rotulo);
    assert.equal(new Set(ex.opcoes).size, 4);
  }
});

test('digitar: aceita o número com ou sem pontuação', () => {
  const rng = mulberry32(3);
  const id = lei.artigos.find((a) => a.num === '88').dispositivos.find((d) => d.rotulo === '§ 2º').id;
  const ex = buildExercise(idx, id, 'digitar', rng);
  assert.equal(ex.resposta, '240');
  assert.ok(checkAnswer(ex, '240'));
  assert.ok(checkAnswer(ex, ' 240 '));
  assert.ok(!checkAnswer(ex, '24'));
  assert.ok(!checkAnswer(ex, ''));
  assert.ok(checkAnswer({ tipo: 'digitar', resposta: '60.000,00' }, '60000'));
  assert.ok(checkAnswer({ tipo: 'digitar', resposta: '60.000,00' }, '60.000'));
});

test('sessão: tamanho pedido, sem dispositivos revogados, respeita exclusões', () => {
  const rng = mulberry32(11);
  for (const l of lei.licoes) {
    const s = buildSession(idx, l.dispositivos, { n: 10, nivel: 2, rng });
    assert.ok(s.length >= Math.min(6, l.dispositivos.length), `${l.id}: ${s.length}`);
    for (const ex of s) {
      const d = idx.devs.get(ex.devId);
      assert.ok(!d.revogado && !d.vetado && d.texto);
    }
  }
  const l = lei.licoes[5];
  const s1 = buildSession(idx, l.dispositivos, { n: 10, nivel: 0, rng: mulberry32(1) });
  const excluir = new Set(s1.map((e) => `${e.devId}|${e.tipo}|${e.alvo || ''}`));
  const s2 = buildSession(idx, l.dispositivos, { n: 10, nivel: 0, rng: mulberry32(1), excluir });
  assert.ok(s2.every((e) => !excluir.has(`${e.devId}|${e.tipo}|${e.alvo || ''}`)));
});

test('nível 0 só usa lacuna e certo/errado', () => {
  const s = buildSession(idx, lei.licoes[3].dispositivos, { n: 10, nivel: 0, rng: mulberry32(5) });
  assert.ok(s.every((e) => e.tipo === 'lacuna' || e.tipo === 'vf'));
});

test('todas as normas geradas produzem sessões', () => {
  for (const { id } of JSON.parse(fs.readFileSync(new URL('../data/laws/index.json', import.meta.url)))) {
    const l = carregar(id);
    const ix = prepareLaw(l);
    const rng = mulberry32(9);
    for (const lic of [l.licoes[0], l.licoes[Math.floor(l.licoes.length / 2)], l.licoes.at(-1)]) {
      assert.ok(buildSession(ix, lic.dispositivos, { n: 8, nivel: 2, rng }).length > 0, `${id} ${lic.id}`);
    }
  }
});

test('certo/errado é equilibrado (marcar sempre "Certo" não compensa)', () => {
  let certo = 0, n = 0;
  for (let seed = 1; seed <= 5; seed++) {
    const rng = mulberry32(seed * 7919);
    for (const l of lei.licoes) {
      for (const ex of buildSession(idx, l.dispositivos, { n: 10, nivel: 2, rng })) {
        if (ex.tipo !== 'vf') continue;
        n++;
        if (ex.resposta) certo++;
      }
    }
  }
  assert.ok(Math.abs(certo / n - 0.5) < 0.05, `${certo}/${n}`);
});
