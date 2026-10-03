// Regras de gamificação: XP, níveis, ofensiva (streak), meta diária e conquistas.
// Funções puras sobre o objeto de estado salvo pelo store.js.

export const XP = { acerto: 10, acertoRevisao: 8, combo: 5, licao: 20, perfeita: 20 };
export const VIDAS = 3;

export function estadoInicial() {
  return {
    v: 1,
    xp: 0,
    meta: 50,
    hoje: { data: null, xp: 0 },
    ofensiva: { atual: 0, melhor: 0, ultimoDia: null },
    licoes: {},
    cartoes: {},
    sinalizadas: {},
    conquistas: {},
    stats: { respostas: 0, acertos: 0, comboMax: 0, sessoes: 0, perfeitas: 0, revisoes: 0 },
    config: { desbloquearTudo: false },
  };
}

export function hojeISO(agora = new Date()) {
  const d = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

function ontemISO(agora = new Date()) {
  return hojeISO(new Date(agora.getTime() - 24 * 60 * 60 * 1000));
}

export function nivelDoXp(xp) {
  const nivel = Math.floor(Math.sqrt(xp / 40)) + 1;
  const base = 40 * (nivel - 1) ** 2;
  const prox = 40 * nivel ** 2;
  return { nivel, progresso: (xp - base) / (prox - base), faltam: prox - xp };
}

export function ganharXp(estado, qtd, agora = new Date()) {
  const dia = hojeISO(agora);
  if (estado.hoje.data !== dia) estado.hoje = { data: dia, xp: 0 };
  estado.xp += qtd;
  estado.hoje.xp += qtd;
}

export function xpHoje(estado, agora = new Date()) {
  return estado.hoje.data === hojeISO(agora) ? estado.hoje.xp : 0;
}

/** Registra atividade do dia; mantém a ofensiva se houve estudo ontem. */
export function registrarDia(estado, agora = new Date()) {
  const dia = hojeISO(agora);
  const o = estado.ofensiva;
  if (o.ultimoDia === dia) return false;
  o.atual = o.ultimoDia === ontemISO(agora) ? o.atual + 1 : 1;
  o.melhor = Math.max(o.melhor, o.atual);
  o.ultimoDia = dia;
  return true;
}

/** Ofensiva exibida: zera se o último dia de estudo foi antes de ontem. */
export function ofensivaAtual(estado, agora = new Date()) {
  const o = estado.ofensiva;
  if (!o.ultimoDia) return 0;
  if (o.ultimoDia === hojeISO(agora) || o.ultimoDia === ontemISO(agora)) return o.atual;
  return 0;
}

export function estrelasPorAcerto(pct) {
  if (pct >= 0.9) return 3;
  if (pct >= 0.75) return 2;
  return 1;
}

export function licaoLiberada(estado, lei, indice) {
  if (estado.config.desbloquearTudo || indice === 0) return true;
  const anterior = lei.licoes[indice - 1];
  return (estado.licoes[anterior.id]?.estrelas || 0) > 0;
}

export const CONQUISTAS = [
  { id: 'primeira', icone: '🎯', nome: 'Primeiro passo', desc: 'Conclua sua primeira lição.', ok: (e) => e.stats.sessoes >= 1 },
  { id: 'perfeita', icone: '💎', nome: 'Sem errar uma', desc: 'Conclua uma lição sem nenhum erro.', ok: (e) => e.stats.perfeitas >= 1 },
  { id: 'combo10', icone: '⚡', nome: 'Embalado', desc: 'Acerte 10 questões seguidas.', ok: (e) => e.stats.comboMax >= 10 },
  { id: 'combo25', icone: '🌩️', nome: 'Imparável', desc: 'Acerte 25 questões seguidas.', ok: (e) => e.stats.comboMax >= 25 },
  { id: 'ofensiva3', icone: '🔥', nome: 'Constância', desc: 'Estude 3 dias seguidos.', ok: (e) => e.ofensiva.melhor >= 3 },
  { id: 'ofensiva7', icone: '📅', nome: 'Uma semana', desc: 'Estude 7 dias seguidos.', ok: (e) => e.ofensiva.melhor >= 7 },
  { id: 'ofensiva30', icone: '🏛️', nome: 'Hábito de jurista', desc: 'Estude 30 dias seguidos.', ok: (e) => e.ofensiva.melhor >= 30 },
  { id: 'acertos100', icone: '✅', nome: 'Cem acertos', desc: 'Acumule 100 respostas certas.', ok: (e) => e.stats.acertos >= 100 },
  { id: 'acertos1000', icone: '🏆', nome: 'Mil acertos', desc: 'Acumule 1.000 respostas certas.', ok: (e) => e.stats.acertos >= 1000 },
  { id: 'revisor', icone: '🔁', nome: 'Revisor', desc: 'Conclua 5 sessões de revisão.', ok: (e) => e.stats.revisoes >= 5 },
  { id: 'xp1000', icone: '⭐', nome: '1.000 XP', desc: 'Some 1.000 pontos de experiência.', ok: (e) => e.xp >= 1000 },
  { id: 'xp10000', icone: '🌟', nome: '10.000 XP', desc: 'Some 10.000 pontos de experiência.', ok: (e) => e.xp >= 10000 },
];

/** Concede conquistas recém-obtidas e devolve a lista delas. */
export function verificarConquistas(estado, agora = new Date()) {
  const novas = [];
  for (const c of CONQUISTAS) {
    if (!estado.conquistas[c.id] && c.ok(estado)) {
      estado.conquistas[c.id] = hojeISO(agora);
      novas.push(c);
    }
  }
  return novas;
}

/** Conquista por norma concluída (todas as lições com ao menos 1 estrela). */
export function verificarNormaConcluida(estado, lei, agora = new Date()) {
  const id = `norma:${lei.id}`;
  if (estado.conquistas[id]) return null;
  if (lei.licoes.every((l) => (estado.licoes[l.id]?.estrelas || 0) > 0)) {
    estado.conquistas[id] = hojeISO(agora);
    return { id, icone: '📜', nome: `${lei.sigla} concluída`, desc: `Todas as lições de ${lei.nome}.` };
  }
  return null;
}
