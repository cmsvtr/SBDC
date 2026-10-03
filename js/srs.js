// Repetição espaçada (caixas de Leitner) por dispositivo.
// Acertou: sobe uma caixa e o intervalo cresce. Errou: volta para a caixa 1.

export const INTERVALOS_DIAS = [0, 1, 3, 7, 15, 30];
export const CAIXA_DOMINADO = 3;
const DIA = 24 * 60 * 60 * 1000;

export function novoCartao() {
  return { caixa: 0, proxima: 0, acertos: 0, erros: 0 };
}

export function atualizarCartao(cartao, acertou, agora = Date.now()) {
  const c = { ...(cartao || novoCartao()) };
  if (acertou) {
    c.acertos++;
    c.caixa = Math.min(c.caixa + 1, INTERVALOS_DIAS.length - 1);
  } else {
    c.erros++;
    c.caixa = 1;
  }
  c.proxima = agora + INTERVALOS_DIAS[c.caixa] * DIA;
  c.visto = agora;
  return c;
}

export function pendentes(cartoes, prefixo, agora = Date.now()) {
  return Object.entries(cartoes)
    .filter(([id, c]) => id.startsWith(prefixo) && c.proxima <= agora)
    .sort((a, b) => a[1].caixa - b[1].caixa || a[1].proxima - b[1].proxima)
    .map(([id]) => id);
}

export function dominados(cartoes, prefixo) {
  return Object.entries(cartoes).filter(([id, c]) => id.startsWith(prefixo) && c.caixa >= CAIXA_DOMINADO).length;
}
