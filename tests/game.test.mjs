import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../js/game.js';
import * as R from '../js/srs.js';

const dia = (s) => new Date(`${s}T12:00:00`);

test('ofensiva cresce em dias seguidos e reinicia após um dia sem estudo', () => {
  const e = G.estadoInicial();
  G.registrarDia(e, dia('2026-10-01'));
  G.registrarDia(e, dia('2026-10-02'));
  G.registrarDia(e, dia('2026-10-02'));
  assert.equal(e.ofensiva.atual, 2);
  assert.equal(G.ofensivaAtual(e, dia('2026-10-03')), 2);
  assert.equal(G.ofensivaAtual(e, dia('2026-10-04')), 0);
  G.registrarDia(e, dia('2026-10-05'));
  assert.equal(e.ofensiva.atual, 1);
  assert.equal(e.ofensiva.melhor, 2);
});

test('XP do dia zera na virada do dia', () => {
  const e = G.estadoInicial();
  G.ganharXp(e, 30, dia('2026-10-01'));
  assert.equal(G.xpHoje(e, dia('2026-10-01')), 30);
  assert.equal(G.xpHoje(e, dia('2026-10-02')), 0);
  G.ganharXp(e, 10, dia('2026-10-02'));
  assert.equal(e.xp, 40);
  assert.equal(G.xpHoje(e, dia('2026-10-02')), 10);
});

test('níveis', () => {
  assert.equal(G.nivelDoXp(0).nivel, 1);
  assert.equal(G.nivelDoXp(39).nivel, 1);
  assert.equal(G.nivelDoXp(40).nivel, 2);
  assert.equal(G.nivelDoXp(160).nivel, 3);
});

test('estrelas por aproveitamento', () => {
  assert.equal(G.estrelasPorAcerto(1), 3);
  assert.equal(G.estrelasPorAcerto(0.8), 2);
  assert.equal(G.estrelasPorAcerto(0.5), 1);
});

test('lições liberam em sequência, salvo se desbloquear tudo', () => {
  const e = G.estadoInicial();
  const lei = { licoes: [{ id: 'a' }, { id: 'b' }] };
  assert.ok(G.licaoLiberada(e, lei, 0));
  assert.ok(!G.licaoLiberada(e, lei, 1));
  e.licoes.a = { estrelas: 1 };
  assert.ok(G.licaoLiberada(e, lei, 1));
  e.licoes.a = { estrelas: 0 };
  e.config.desbloquearTudo = true;
  assert.ok(G.licaoLiberada(e, lei, 1));
});

test('conquistas são concedidas uma vez', () => {
  const e = G.estadoInicial();
  e.stats.sessoes = 1;
  assert.deepEqual(G.verificarConquistas(e).map((c) => c.id), ['primeira']);
  assert.deepEqual(G.verificarConquistas(e), []);
});

test('repetição espaçada: acerto sobe de caixa, erro volta para a 1', () => {
  const t0 = Date.UTC(2026, 9, 1);
  let c = R.atualizarCartao(null, true, t0);
  assert.equal(c.caixa, 1);
  c = R.atualizarCartao(c, true, t0);
  assert.equal(c.caixa, 2);
  assert.equal(c.proxima, t0 + 3 * 86400000);
  c = R.atualizarCartao(c, false, t0);
  assert.equal(c.caixa, 1);
  const cartoes = { 'lei:1:caput': c, 'lei:2:caput': { ...c, proxima: t0 + 10 * 86400000 }, 'outra:1': c };
  assert.deepEqual(R.pendentes(cartoes, 'lei:', t0 + 86400000), ['lei:1:caput']);
});
