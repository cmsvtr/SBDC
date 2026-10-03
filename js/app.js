// Interface do LexQuest: roteamento por hash e telas.
import * as E from './engine.js';
import * as G from './game.js';
import * as S from './store.js';
import * as R from './srs.js';

const app = document.getElementById('app');
const hud = document.getElementById('hud');
const toastEl = document.getElementById('toast');

let estado = S.carregar();
let indice = null; // data/laws/index.json
const cacheLeis = new Map(); // id -> { lei, idx }
let sessao = null;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Cria elementos sem innerHTML: o texto legal entra sempre como textContent. */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function salvar() {
  if (!S.salvar(estado)) toast('Não foi possível salvar o progresso neste navegador.');
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function render(...nodes) {
  app.replaceChildren(...nodes);
  app.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function fmt(n) {
  return n.toLocaleString('pt-BR');
}

async function carregarIndice() {
  if (!indice) {
    const r = await fetch('data/laws/index.json');
    if (!r.ok) throw new Error('Não foi possível carregar a lista de normas.');
    indice = await r.json();
  }
  return indice;
}

async function carregarLei(id) {
  if (!cacheLeis.has(id)) {
    const r = await fetch(`data/laws/${id}.json`);
    if (!r.ok) throw new Error('Norma não encontrada.');
    const lei = await r.json();
    cacheLeis.set(id, { lei, idx: E.prepareLaw(lei) });
  }
  return cacheLeis.get(id);
}

function progressoLei(resumoOuLei) {
  const total = resumoOuLei.licoes;
  const n = typeof total === 'number' ? total : total.length;
  const feitas = Object.keys(estado.licoes).filter((k) => k.startsWith(`${resumoOuLei.id}-l`) && estado.licoes[k].estrelas > 0).length;
  return { feitas, total: n, pct: n ? feitas / n : 0 };
}

function barra(pct, cls = '') {
  return h('div', { class: `bar ${cls}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct * 100) },
    h('span', { style: `width:${Math.max(0, Math.min(1, pct)) * 100}%` }));
}

function estrelas(n, total = 3) {
  return h('span', { class: 'stars', 'aria-label': `${n} de ${total} estrelas` },
    Array.from({ length: total }, (_, i) => h('span', { class: i < n ? 'on' : '' }, '★')));
}

function atualizarHud() {
  const { nivel } = G.nivelDoXp(estado.xp);
  hud.replaceChildren(
    h('span', { class: 'chip', title: 'Dias seguidos de estudo' }, '🔥 ', G.ofensivaAtual(estado)),
    h('span', { class: 'chip', title: 'Experiência total' }, '⭐ ', fmt(estado.xp)),
    h('a', { class: 'chip', href: '#/perfil', title: 'Perfil e conquistas' }, `Nv ${nivel}`),
  );
}

function erro(msg) {
  render(h('section', { class: 'card' }, h('h2', {}, 'Algo deu errado'), h('p', {}, msg), h('a', { class: 'btn', href: '#/' }, 'Voltar ao início')));
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

async function telaInicio() {
  const leis = await carregarIndice();
  const meta = estado.meta;
  const feito = G.xpHoje(estado);
  const { nivel, progresso, faltam } = G.nivelDoXp(estado.xp);

  const resumoDia = h('section', { class: 'card hero' },
    h('div', { class: 'hero-row' },
      h('div', {},
        h('p', { class: 'eyebrow' }, 'Meta de hoje'),
        h('p', { class: 'big' }, `${Math.min(feito, meta)} / ${meta} XP`),
        barra(feito / meta, feito >= meta ? 'done' : '')),
      h('div', { class: 'streak' }, h('span', { class: 'flame' }, '🔥'), h('strong', {}, G.ofensivaAtual(estado)), h('small', {}, 'dias'))),
    h('p', { class: 'muted small' }, `Nível ${nivel} · faltam ${fmt(faltam)} XP para o próximo`),
    barra(progresso, 'thin'));

  const cards = leis.map((l) => {
    const p = progressoLei(l);
    const pend = R.pendentes(estado.cartoes, `${l.id}:`).length;
    return h('article', { class: 'card law' },
      h('a', { href: `#/lei/${l.id}`, class: 'law-link' },
        h('div', { class: 'law-head' },
          h('div', {},
            h('p', { class: 'eyebrow' }, l.sigla, l.status === 'beta' ? h('span', { class: 'badge', title: 'Importação automática ainda não revisada dispositivo a dispositivo' }, 'beta') : null),
            h('h2', {}, l.nome)),
          h('span', { class: 'pct' }, `${Math.round(p.pct * 100)}%`)),
        h('p', { class: 'muted small' }, `${fmt(l.artigos)} artigos · ${fmt(l.dispositivos)} dispositivos · ${l.licoes} lições`),
        barra(p.pct)),
      pend ? h('a', { class: 'btn small ghost', href: `#/revisao/${l.id}` }, `🔁 Revisar ${pend} pendente${pend > 1 ? 's' : ''}`) : null);
  });

  render(resumoDia, h('h2', { class: 'section-title' }, 'Normas'), ...cards,
    h('p', { class: 'muted small center' }, 'Textos oficiais do Planalto e do Cade. As questões são geradas a partir da letra da lei.'));
}

// ---------------------------------------------------------------------------
// Trilha de uma norma
// ---------------------------------------------------------------------------

async function telaLei(id) {
  const { lei } = await carregarLei(id);
  const p = progressoLei(lei);
  const pend = R.pendentes(estado.cartoes, `${lei.id}:`).length;
  const dom = R.dominados(estado.cartoes, `${lei.id}:`);
  const licoesIdx = new Map(lei.licoes.map((l, i) => [l.id, i]));

  const topo = h('section', { class: 'card' },
    h('p', { class: 'eyebrow' }, lei.sigla),
    h('h1', {}, lei.nome),
    h('p', { class: 'muted small' }, `${p.feitas} de ${p.total} lições · ${fmt(dom)} de ${fmt(lei.dispositivos)} dispositivos dominados`),
    barra(p.pct),
    h('div', { class: 'row' },
      h('a', { class: `btn ${pend ? '' : 'ghost'}`, href: `#/revisao/${lei.id}` }, pend ? `🔁 Revisar (${pend})` : '🔁 Revisão'),
      h('a', { class: 'btn ghost', href: `#/ler/${lei.id}` }, '📖 Ler a norma')),
    lei.status === 'beta' ? h('p', { class: 'note' }, 'Importação automática ainda em revisão. Se uma questão parecer errada, use “Questão com problema” para ela sair do seu jogo.') : null);

  let proximaMarcada = false;
  const unidades = lei.unidades.map((u) => {
    const nos = u.licoes.map((lid) => {
      const i = licoesIdx.get(lid);
      const l = lei.licoes[i];
      const prog = estado.licoes[l.id];
      const liberada = G.licaoLiberada(estado, lei, i);
      const atual = liberada && !prog?.estrelas && !proximaMarcada;
      if (atual) proximaMarcada = true;
      return h('li', { class: `node ${prog?.estrelas ? 'done' : ''} ${liberada ? '' : 'locked'} ${atual ? 'current' : ''}` },
        h('button', { class: 'node-btn', onclick: () => abrirLicao(lei, l, liberada), 'aria-label': `${l.titulo}, ${l.faixa}${liberada ? '' : ', bloqueada'}` },
          h('span', { class: 'node-icon' }, liberada ? (prog?.estrelas ? '✓' : String(i + 1)) : '🔒'),
          h('span', { class: 'node-text' },
            h('strong', {}, l.titulo),
            h('small', {}, l.faixa, ' · ', `${l.dispositivos.length} dispositivos`)),
          prog?.estrelas ? estrelas(prog.estrelas) : null));
    });
    return h('section', { class: 'unit' },
      h('header', { class: 'unit-head' }, u.caminho ? h('p', { class: 'eyebrow' }, u.caminho) : null, h('h2', {}, u.titulo)),
      h('ol', { class: 'path' }, nos));
  });

  render(topo, ...unidades);
  document.querySelector('.node.current')?.scrollIntoView({ block: 'center' });
}

function abrirLicao(lei, l, liberada) {
  const prog = estado.licoes[l.id];
  const nivel = prog?.nivel || 0;
  const tipos = E.tiposPorNivel(nivel).map((t) => E.TIPOS[t]).join(', ');
  const dlg = h('dialog', { class: 'sheet' },
    h('p', { class: 'eyebrow' }, l.faixa),
    h('h2', {}, l.titulo),
    prog?.estrelas ? h('p', {}, estrelas(prog.estrelas), ` · concluída ${prog.feitas}×`) : null,
    h('p', { class: 'muted small' }, `Nível ${nivel + 1} de 3: ${tipos}.`),
    liberada ? null : h('p', { class: 'note' }, 'Conclua a lição anterior para liberar esta, ou ative “Desbloquear todas as lições” no perfil.'),
    h('div', { class: 'col' },
      h('a', { class: 'btn ghost', href: `#/ler/${lei.id}/${l.id}`, onclick: () => dlg.close() }, '📖 Estudar o texto'),
      liberada ? h('a', { class: 'btn', href: `#/jogar/${lei.id}/${l.id}`, onclick: () => dlg.close() }, prog?.estrelas ? 'Praticar de novo' : 'Começar') : null,
      h('button', { class: 'btn link', onclick: () => dlg.close() }, 'Fechar')));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}

// ---------------------------------------------------------------------------
// Leitura do texto
// ---------------------------------------------------------------------------

function renderArtigo(art, idx, destaque) {
  const blocos = [];
  for (const d of art.dispositivos) {
    if (d.tipo === 'caput') {
      blocos.push(h('p', { class: 'disp caput' }, h('strong', {}, art.rotulo, /º$/.test(art.rotulo) ? ' ' : '. '), d.texto || (d.revogado ? '(revogado)' : d.vetado ? '(vetado)' : '')));
    } else {
      const cls = `disp ${d.tipo} ${d.revogado || d.vetado ? 'gone' : ''} ${destaque && destaque.has(d.id) ? 'hl' : ''}`;
      const rotulo = d.tipo === 'paragrafo' ? `${d.rotulo === 'parágrafo único' ? 'Parágrafo único.' : d.rotulo} ` :
        d.tipo === 'inciso' ? `${d.rotulo.replace('inciso ', '')} – ` :
        d.tipo === 'alinea' ? `${d.rotulo.replace('alínea ', '')}) ` : '';
      blocos.push(h('p', { class: cls }, rotulo, d.texto || (d.revogado ? '(revogado)' : d.vetado ? '(vetado)' : '')));
    }
    const notas = (d.notas || []).filter((n) => /vide|adi|adpf|suspens|declarad/i.test(n));
    if (notas.length) blocos.push(h('p', { class: 'nota' }, '⚠ ', notas.join(' ')));
  }
  return h('article', { class: 'artigo', id: `art-${art.num}` }, blocos);
}

async function telaLer(id, licaoId) {
  const { lei, idx } = await carregarLei(id);
  if (licaoId) {
    const l = lei.licoes.find((x) => x.id === licaoId);
    if (!l) return erro('Lição não encontrada.');
    const destaque = new Set(l.dispositivos);
    const arts = l.artigos.map((n) => idx.arts.get(n));
    render(
      h('section', { class: 'card' },
        h('p', { class: 'eyebrow' }, `${lei.sigla} · ${l.faixa}`),
        h('h1', {}, l.titulo),
        h('p', { class: 'muted small' }, 'Leia com atenção a prazos, órgãos competentes e palavras como “poderá”, “deverá”, “somente” e “cumulativamente”.')),
      h('section', { class: 'card text' }, arts.map((a) => renderArtigo(a, idx, l.dispositivos.length < 40 ? null : destaque))),
      h('div', { class: 'sticky-actions' },
        h('a', { class: 'btn ghost', href: `#/lei/${lei.id}` }, 'Voltar'),
        G.licaoLiberada(estado, lei, lei.licoes.indexOf(l)) ? h('a', { class: 'btn', href: `#/jogar/${lei.id}/${l.id}` }, 'Praticar') : null));
    return;
  }

  // Norma completa, com busca.
  const lista = h('div', {});
  const busca = h('input', { type: 'search', class: 'search', placeholder: 'Buscar no texto (ex.: leniência, 240 dias)', 'aria-label': 'Buscar no texto da norma' });
  const LIMITE = 150;
  const desenhar = () => {
    const q = busca.value.trim().toLowerCase();
    const nodes = [];
    let ultimoCaminho = '';
    let n = 0;
    for (const art of lei.artigos) {
      if (q && !art.dispositivos.some((d) => d.texto.toLowerCase().includes(q)) && !art.rotulo.toLowerCase().includes(q)) continue;
      if (++n > LIMITE && q) break;
      const caminho = art.hierarquia.map((x) => `${x.tipo} ${x.numero} ${x.nome}`).join('|');
      if (caminho !== ultimoCaminho) {
        const novos = art.hierarquia.filter((x, i) => ultimoCaminho.split('|')[i] !== `${x.tipo} ${x.numero} ${x.nome}`);
        for (const x of novos) nodes.push(h(`h${Math.min(6, 3 + Math.max(0, x.nivel - 2))}`, { class: 'heading' }, `${x.tipo.charAt(0)}${x.tipo.slice(1).toLowerCase()} ${x.numero}`.trim(), (x.titulo || x.nome) ? ` — ${x.titulo || x.nome}` : ''));
        ultimoCaminho = caminho;
      }
      nodes.push(renderArtigo(art, idx));
    }
    if (!nodes.length) nodes.push(h('p', { class: 'muted' }, 'Nada encontrado.'));
    if (q && n > LIMITE) nodes.push(h('p', { class: 'muted small' }, `Mostrando os primeiros ${LIMITE} artigos. Refine a busca.`));
    lista.replaceChildren(...nodes);
  };
  let t;
  busca.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(desenhar, 200);
  });
  desenhar();
  render(
    h('section', { class: 'card' },
      h('p', { class: 'eyebrow' }, lei.sigla),
      h('h1', {}, lei.nome),
      h('p', { class: 'muted small' }, 'Fonte: ', h('a', { href: lei.fonte, target: '_blank', rel: 'noopener' }, 'texto oficial'), ` · importado em ${lei.geradoEm}`),
      busca),
    h('section', { class: 'card text' }, lista));
}

// ---------------------------------------------------------------------------
// Sessão de exercícios
// ---------------------------------------------------------------------------

function excluidas() {
  return new Set(Object.keys(estado.sinalizadas));
}

async function iniciarLicao(id, licaoId) {
  const { lei, idx } = await carregarLei(id);
  const i = lei.licoes.findIndex((x) => x.id === licaoId);
  if (i < 0) return erro('Lição não encontrada.');
  const l = lei.licoes[i];
  if (!G.licaoLiberada(estado, lei, i)) return erro('Esta lição ainda está bloqueada.');
  const nivel = estado.licoes[l.id]?.nivel || 0;
  const rng = E.mulberry32(Date.now() & 0xffffffff);
  const n = Math.min(10, Math.max(6, l.dispositivos.length + 2));
  const exercicios = E.buildSession(idx, l.dispositivos, { n, nivel, rng, excluir: excluidas() });
  if (!exercicios.length) return erro('Não há questões disponíveis para esta lição.');
  sessao = { modo: 'licao', lei, idx, licao: l, exercicios, i: 0, vidas: G.VIDAS, acertos: 0, erros: 0, combo: 0, xp: 0, respondido: false, selecao: null };
  telaExercicio();
}

async function iniciarRevisao(id) {
  const { lei, idx } = await carregarLei(id);
  let ids = R.pendentes(estado.cartoes, `${lei.id}:`).filter((d) => idx.devs.has(d));
  if (ids.length < 5) {
    // Completa com os dispositivos mais fracos já vistos.
    const vistos = Object.entries(estado.cartoes)
      .filter(([k]) => k.startsWith(`${lei.id}:`) && idx.devs.has(k) && !ids.includes(k))
      .sort((a, b) => a[1].caixa - b[1].caixa)
      .map(([k]) => k);
    ids = ids.concat(vistos.slice(0, 8 - ids.length));
  }
  if (!ids.length) {
    render(h('section', { class: 'card' }, h('h2', {}, 'Nada para revisar ainda'),
      h('p', {}, 'A revisão usa os dispositivos que você já praticou. Faça algumas lições primeiro.'),
      h('a', { class: 'btn', href: `#/lei/${lei.id}` }, 'Ir para as lições')));
    return;
  }
  const rng = E.mulberry32(Date.now() & 0xffffffff);
  const exercicios = E.buildSession(idx, ids.slice(0, 12), { n: Math.min(12, ids.length + 3), tipos: ['lacuna', 'vf', 'artigo', 'digitar'], rng, excluir: excluidas() });
  sessao = { modo: 'revisao', lei, idx, licao: null, exercicios, i: 0, vidas: Infinity, acertos: 0, erros: 0, combo: 0, xp: 0, respondido: false, selecao: null };
  telaExercicio();
}

function textoComLacuna(ex, conteudoLacuna) {
  return h('p', { class: 'ex-text' }, ex.antes, conteudoLacuna, ex.depois);
}

function contexto(ex) {
  if (!ex.contexto.length) return null;
  return h('div', { class: 'ctx' }, ex.contexto.map((c) => h('p', {}, c.rotulo === 'caput' ? '' : `${c.rotulo}: `, c.texto)));
}

function telaExercicio() {
  const s = sessao;
  const ex = s.exercicios[s.i];
  s.respondido = false;
  s.selecao = null;

  const total = s.exercicios.length;
  const topo = h('div', { class: 'session-top' },
    h('a', { class: 'close', href: s.modo === 'licao' ? `#/lei/${s.lei.id}` : `#/lei/${s.lei.id}`, 'aria-label': 'Sair da sessão' }, '✕'),
    barra(s.i / total),
    s.modo === 'licao' ? h('span', { class: 'lives', 'aria-label': `${s.vidas} vidas` }, '❤️ ', s.vidas) : h('span', { class: 'lives' }, '🔁'));

  const verificar = h('button', { class: 'btn wide', disabled: true }, 'Verificar');
  const corpo = h('div', { class: 'ex-body' });
  let obterResposta = () => s.selecao;

  const enunciado = h('p', { class: 'eyebrow' }, E.TIPOS[ex.tipo], ex.tipo !== 'artigo' ? ` · ${ex.rotulo}` : '');

  if (ex.tipo === 'lacuna' || ex.tipo === 'artigo') {
    const lacuna = h('span', { class: 'blank' }, '   ');
    if (ex.tipo === 'lacuna') corpo.append(contexto(ex) || '', textoComLacuna(ex, lacuna));
    else corpo.append(contexto(ex) || '', h('p', { class: 'ex-text' }, ex.rotuloDispositivo ? h('strong', {}, ex.rotuloDispositivo, ' ') : null, ex.texto));
    const opcoes = h('div', { class: 'options' }, ex.opcoes.map((o, k) => h('button', {
      class: 'option',
      'data-k': k + 1,
      onclick: (ev) => {
        if (s.respondido) return;
        s.selecao = o;
        opcoes.querySelectorAll('.option').forEach((b) => b.classList.toggle('sel', b === ev.currentTarget));
        if (ex.tipo === 'lacuna') {
          lacuna.textContent = o;
          lacuna.classList.add('filled');
        }
        verificar.disabled = false;
      },
    }, h('kbd', {}, k + 1), o)));
    corpo.append(opcoes);
  } else if (ex.tipo === 'vf') {
    corpo.append(h('p', { class: 'muted small' }, 'Este texto reproduz exatamente a lei?'), contexto(ex) || '', h('p', { class: 'ex-text' }, ex.texto));
    const opcoes = h('div', { class: 'options two' }, [[true, 'Certo'], [false, 'Errado']].map(([v, rot], k) => h('button', {
      class: `option ${v ? 'ok' : 'nok'}`,
      'data-k': k + 1,
      onclick: (ev) => {
        if (s.respondido) return;
        s.selecao = v;
        opcoes.querySelectorAll('.option').forEach((b) => b.classList.toggle('sel', b === ev.currentTarget));
        verificar.disabled = false;
      },
    }, h('kbd', {}, k + 1), rot)));
    corpo.append(opcoes);
  } else if (ex.tipo === 'digitar') {
    const input = h('input', { class: 'num-input', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Número que completa o dispositivo', size: 8 });
    input.addEventListener('input', () => {
      verificar.disabled = !input.value.trim();
    });
    obterResposta = () => input.value;
    corpo.append(contexto(ex) || '', textoComLacuna(ex, input), h('p', { class: 'muted small' }, 'Digite só o número (ex.: 30, 2/3, 60.000).'));
    setTimeout(() => input.focus(), 50);
  }

  const rodape = h('footer', { class: 'session-foot' }, verificar);
  verificar.addEventListener('click', () => responder(obterResposta(), rodape, corpo));

  render(h('section', { class: 'session' }, topo, h('div', { class: 'card ex' }, enunciado, corpo), rodape));
}

function feedbackOficial(ex) {
  const t = ex.original;
  let conteudo;
  if (ex.tipo === 'lacuna' || ex.tipo === 'digitar') {
    const alvo = ex.tipo === 'digitar' ? ex.respostaCompleta : ex.resposta;
    const pos = t.indexOf(alvo, Math.max(0, ex.antes.length - 4));
    conteudo = pos >= 0 ? [t.slice(0, pos), h('mark', {}, alvo), t.slice(pos + alvo.length)] : [t];
  } else if (ex.tipo === 'vf' && ex.trocado) {
    const pos = ex.trocado.inicio;
    conteudo = [t.slice(0, pos), h('mark', {}, ex.trocado.de), t.slice(pos + ex.trocado.de.length)];
  } else {
    conteudo = [t];
  }
  return h('blockquote', { class: 'oficial' }, h('cite', {}, ex.tipo === 'artigo' ? E.deviceLabel(sessao.idx, sessao.idx.devs.get(ex.devId)) : ex.rotulo), h('p', {}, conteudo));
}

function responder(resposta, rodape, corpo) {
  const s = sessao;
  if (s.respondido) return;
  s.respondido = true;
  const ex = s.exercicios[s.i];
  const certo = E.checkAnswer(ex, resposta);

  // Estatísticas e repetição espaçada.
  estado.stats.respostas++;
  estado.cartoes[ex.devId] = R.atualizarCartao(estado.cartoes[ex.devId], certo);
  let ganho = 0;
  if (certo) {
    s.acertos++;
    s.combo++;
    estado.stats.acertos++;
    estado.stats.comboMax = Math.max(estado.stats.comboMax, s.combo);
    ganho = s.modo === 'revisao' ? G.XP.acertoRevisao : G.XP.acerto;
    if (s.combo > 0 && s.combo % 5 === 0) ganho += G.XP.combo;
  } else {
    s.erros++;
    s.combo = 0;
    if (s.modo === 'licao') s.vidas--;
  }
  if (ganho) {
    G.ganharXp(estado, ganho);
    s.xp += ganho;
  }
  salvar();
  atualizarHud();

  corpo.querySelectorAll('.option').forEach((b) => {
    b.disabled = true;
    const valor = ex.tipo === 'vf' ? (b.classList.contains('ok')) : b.textContent.slice(1);
    if (valor === ex.resposta) b.classList.add('right');
    else if (b.classList.contains('sel')) b.classList.add('wrong');
  });
  corpo.querySelector('.num-input')?.setAttribute('disabled', '');

  const titulo = certo
    ? `Correto!${ganho ? ` +${ganho} XP` : ''}${s.combo >= 3 ? ` · ${s.combo} seguidas 🔥` : ''}`
    : ex.tipo === 'digitar' ? `Resposta: ${ex.respostaCompleta}` : ex.tipo === 'vf' ? (ex.verdadeiro ? 'Era o texto exato da lei.' : 'Havia uma troca no texto.') : `Resposta: ${ex.resposta}`;

  const notas = (ex.notas || []).filter((n) => /vide|adi|adpf|suspens|declarad/i.test(n));
  const fim = s.modo === 'licao' && s.vidas <= 0;
  const proximo = h('button', { class: `btn wide ${certo ? 'go' : 'warn'}` }, fim ? 'Ver resultado' : s.i + 1 >= s.exercicios.length ? 'Concluir' : 'Continuar');
  proximo.addEventListener('click', avancar);

  rodape.replaceChildren(
    h('div', { class: `feedback ${certo ? 'good' : 'bad'}` },
      h('p', { class: 'fb-title' }, titulo),
      ex.tipo === 'vf' && ex.trocado ? h('p', { class: 'small' }, `Trocaram “${ex.trocado.de}” por “${ex.trocado.para}”.`) : null,
      feedbackOficial(ex),
      notas.length ? h('p', { class: 'nota' }, '⚠ Nota do texto oficial: ', notas.join(' ')) : null,
      h('button', { class: 'btn link small', onclick: () => sinalizar(ex) }, '⚑ Questão com problema?')),
    proximo);
  proximo.focus();
}

function sinalizar(ex) {
  const key = E.exerciseKey(ex);
  estado.sinalizadas[key] = {
    data: G.hojeISO(), lei: sessao.lei.id, rotulo: ex.rotulo, tipo: ex.tipo, alvo: ex.alvo || '',
    texto: ex.texto || `${ex.antes || ''}_____${ex.depois || ''}`,
  };
  salvar();
  toast('Questão sinalizada. Ela não aparecerá mais para você.');
}

function avancar() {
  const s = sessao;
  if (s.modo === 'licao' && s.vidas <= 0) return telaFim(false);
  s.i++;
  if (s.i >= s.exercicios.length) return telaFim(true);
  telaExercicio();
}

function telaFim(concluiu) {
  const s = sessao;
  const total = s.acertos + s.erros;
  const pct = total ? s.acertos / total : 0;
  const novas = [];
  let est = 0;

  if (concluiu) {
    estado.stats.sessoes++;
    if (s.modo === 'licao') {
      est = G.estrelasPorAcerto(pct);
      const prev = estado.licoes[s.licao.id] || { estrelas: 0, nivel: 0, feitas: 0 };
      estado.licoes[s.licao.id] = { estrelas: Math.max(prev.estrelas, est), nivel: Math.min(prev.nivel + 1, 2), feitas: prev.feitas + 1, melhor: Math.max(prev.melhor || 0, pct) };
      let bonus = G.XP.licao;
      if (s.erros === 0) {
        bonus += G.XP.perfeita;
        estado.stats.perfeitas++;
      }
      G.ganharXp(estado, bonus);
      s.xp += bonus;
      const norma = G.verificarNormaConcluida(estado, s.lei);
      if (norma) novas.push(norma);
    } else {
      estado.stats.revisoes++;
    }
    G.registrarDia(estado);
  }
  novas.push(...G.verificarConquistas(estado));
  salvar();
  atualizarHud();

  const prox = s.modo === 'licao' && concluiu ? s.lei.licoes[s.lei.licoes.indexOf(s.licao) + 1] : null;
  render(h('section', { class: 'card result' },
    h('p', { class: 'result-icon' }, concluiu ? (s.erros === 0 ? '💎' : '🏁') : '💔'),
    h('h1', {}, concluiu ? (s.modo === 'revisao' ? 'Revisão concluída' : 'Lição concluída!') : 'Acabaram as vidas'),
    concluiu && s.modo === 'licao' ? h('p', { class: 'center' }, estrelas(est)) : null,
    h('div', { class: 'stats-row' },
      h('div', {}, h('strong', {}, `+${s.xp}`), h('small', {}, 'XP')),
      h('div', {}, h('strong', {}, `${Math.round(pct * 100)}%`), h('small', {}, 'acertos')),
      h('div', {}, h('strong', {}, G.ofensivaAtual(estado)), h('small', {}, 'dias 🔥'))),
    concluiu ? null : h('p', { class: 'muted center' }, 'Releia o texto e tente de novo. Seus acertos já contaram para a revisão.'),
    novas.length ? h('div', { class: 'achievements-new' }, h('p', { class: 'eyebrow' }, 'Conquistas desbloqueadas'),
      novas.map((c) => h('p', { class: 'ach' }, h('span', {}, c.icone), ' ', h('strong', {}, c.nome), ' — ', c.desc))) : null,
    h('div', { class: 'col' },
      prox ? h('a', { class: 'btn', href: `#/jogar/${s.lei.id}/${prox.id}` }, 'Próxima lição') : null,
      !concluiu && s.licao ? h('a', { class: 'btn ghost', href: `#/ler/${s.lei.id}/${s.licao.id}` }, '📖 Reler o texto') : null,
      !concluiu && s.licao ? h('a', { class: 'btn', href: `#/jogar/${s.lei.id}/${s.licao.id}`, onclick: () => setTimeout(rota, 0) }, 'Tentar de novo') : null,
      h('a', { class: `btn ${prox ? 'ghost' : ''}`, href: `#/lei/${s.lei.id}` }, 'Voltar à trilha'))));
  sessao = null;
}

// ---------------------------------------------------------------------------
// Perfil, conquistas e configurações
// ---------------------------------------------------------------------------

function telaPerfil() {
  const { nivel, progresso, faltam } = G.nivelDoXp(estado.xp);
  const st = estado.stats;
  const taxa = st.respostas ? Math.round((st.acertos / st.respostas) * 100) : 0;

  const metaSel = h('select', { 'aria-label': 'Meta diária de XP', onchange: (e) => { estado.meta = +e.target.value; salvar(); toast('Meta atualizada.'); } },
    [20, 50, 100, 200].map((v) => h('option', { value: v, selected: estado.meta === v }, `${v} XP por dia`)));
  const desbloq = h('input', { type: 'checkbox', checked: estado.config.desbloquearTudo, onchange: (e) => { estado.config.desbloquearTudo = e.target.checked; salvar(); } });

  const arquivo = h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      estado = S.importar(await f.text());
      salvar();
      toast('Backup restaurado.');
      rota();
    } catch (err) {
      toast(err.message);
    }
  } });

  const sinal = Object.entries(estado.sinalizadas);
  render(
    h('section', { class: 'card' },
      h('h1', {}, `Nível ${nivel}`),
      barra(progresso), h('p', { class: 'muted small' }, `${fmt(estado.xp)} XP · faltam ${fmt(faltam)} para o nível ${nivel + 1}`),
      h('div', { class: 'stats-row' },
        h('div', {}, h('strong', {}, G.ofensivaAtual(estado)), h('small', {}, 'dias seguidos')),
        h('div', {}, h('strong', {}, estado.ofensiva.melhor), h('small', {}, 'recorde')),
        h('div', {}, h('strong', {}, `${taxa}%`), h('small', {}, 'acertos')),
        h('div', {}, h('strong', {}, fmt(st.respostas)), h('small', {}, 'respostas')))),
    h('section', { class: 'card' },
      h('h2', {}, 'Conquistas'),
      h('ul', { class: 'ach-grid' }, G.CONQUISTAS.map((c) => h('li', { class: estado.conquistas[c.id] ? 'got' : '' },
        h('span', { class: 'ach-icon' }, c.icone), h('strong', {}, c.nome), h('small', {}, c.desc))))),
    h('section', { class: 'card' },
      h('h2', {}, 'Configurações'),
      h('label', { class: 'field' }, 'Meta diária ', metaSel),
      h('label', { class: 'field check' }, desbloq, ' Desbloquear todas as lições (para quem já conhece a norma)'),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onclick: () => baixar(`lexquest-backup-${G.hojeISO()}.json`, S.exportar(estado)) }, '⬇ Exportar progresso'),
        h('button', { class: 'btn ghost', onclick: () => arquivo.click() }, '⬆ Importar progresso'), arquivo),
      h('p', { class: 'muted small' }, 'O progresso fica salvo só neste navegador. Exporte um backup para levar a outro aparelho.')),
    h('section', { class: 'card' },
      h('h2', {}, `Questões sinalizadas (${sinal.length})`),
      sinal.length ? h('ul', { class: 'flags' }, sinal.slice(-20).reverse().map(([k, v]) => h('li', {},
        h('strong', {}, v.rotulo), ` · ${E.TIPOS[v.tipo]}`, v.alvo && v.alvo !== 'original' ? ` · “${v.alvo}”` : '',
        h('button', { class: 'btn link small', onclick: () => { delete estado.sinalizadas[k]; salvar(); telaPerfil(); } }, 'reativar')))) : h('p', { class: 'muted small' }, 'Nenhuma. Use “Questão com problema?” durante o jogo.'),
      sinal.length ? h('button', { class: 'btn ghost', onclick: () => baixar(`lexquest-sinalizadas-${G.hojeISO()}.json`, JSON.stringify(estado.sinalizadas, null, 2)) }, '⬇ Exportar para correção') : null),
    h('section', { class: 'card danger' },
      h('button', { class: 'btn link', onclick: () => {
        if (confirm('Apagar todo o progresso deste navegador? Isso não pode ser desfeito.')) {
          S.apagar();
          estado = S.carregar();
          rota();
        }
      } }, 'Apagar progresso')));
}

function baixar(nome, conteudo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
  const a = h('a', { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Roteamento e atalhos de teclado
// ---------------------------------------------------------------------------

async function rota() {
  atualizarHud();
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  try {
    switch (partes[0]) {
      case undefined: return await telaInicio();
      case 'lei': return await telaLei(partes[1]);
      case 'ler': return await telaLer(partes[1], partes[2]);
      case 'jogar': return await iniciarLicao(partes[1], partes[2]);
      case 'revisao': return await iniciarRevisao(partes[1]);
      case 'perfil': return telaPerfil();
      default: return erro('Página não encontrada.');
    }
  } catch (e) {
    console.error(e);
    erro(e.message || String(e));
  }
}

document.addEventListener('keydown', (e) => {
  if (!document.querySelector('.session') || e.target.tagName === 'INPUT' && e.key !== 'Enter') return;
  if (/^[1-4]$/.test(e.key)) document.querySelector(`.option[data-k="${e.key}"]:not([disabled])`)?.click();
  if (e.key === 'Enter') {
    const b = document.querySelector('.session-foot .btn:not([disabled])');
    if (b) {
      e.preventDefault();
      b.click();
    }
  }
});

window.addEventListener('hashchange', rota);
rota();
