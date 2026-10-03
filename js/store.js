// Persistência do progresso no navegador (localStorage), com backup em JSON.
// O progresso fica só neste aparelho: exporte o backup para levar a outro.
import { estadoInicial } from './game.js';

const CHAVE = 'lexquest:v1';

function mesclar(base, salvo) {
  const out = { ...base, ...salvo };
  for (const k of ['hoje', 'ofensiva', 'stats', 'config']) out[k] = { ...base[k], ...(salvo[k] || {}) };
  return out;
}

export function carregar() {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return estadoInicial();
    return mesclar(estadoInicial(), JSON.parse(raw));
  } catch {
    return estadoInicial();
  }
}

export function salvar(estado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    return true;
  } catch {
    return false;
  }
}

export function exportar(estado) {
  return JSON.stringify({ app: 'lexquest', exportadoEm: new Date().toISOString(), estado }, null, 2);
}

export function importar(texto) {
  const data = JSON.parse(texto);
  if (data.app !== 'lexquest' || !data.estado) throw new Error('Arquivo não é um backup do LexQuest.');
  return mesclar(estadoInicial(), data.estado);
}

export function apagar() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento disponível */
  }
}
