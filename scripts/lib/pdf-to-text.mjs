// Extrai texto de normas em PDF (ex.: Regimento Interno do Cade) com `pdftotext -layout`
// e reconstrói uma unidade (dispositivo ou título) por linha, juntando as quebras
// de linha do PDF.
import { execFileSync } from 'node:child_process';

const UNIT_START = new RegExp(
  [
    '^Art\\.\\s*\\d',
    '^§\\s*\\d',
    '^Par[áa]grafo [úu]nico',
    '^[IVXLC]+\\s*[-–—]',
    '^[a-z]\\)\\s',
    '^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O|Se[çc][ãa]o|Subse[çc][ãa]o)\\b',
    '^Pena\\s*[-–—:]',
    '^\\(', // anotações em linha própria
  ].join('|'),
);
const HEADING = /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE[ÇC][ÃA]O|Se[çc][ãa]o|Subse[çc][ãa]o)\b/;

export function pdfToRawText(file) {
  return execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
}

export function layoutToUnits(raw) {
  const lines = raw
    .replace(/\f/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^\d{1,3}$/.test(l) && !/\.{6,}/.test(l)); // números de página e sumário

  const units = [];
  let prevHeading = false;
  for (const l of lines) {
    const startsUnit = UNIT_START.test(l);
    // Nome de título/capítulo vem na linha seguinte e fica em linha própria.
    if (startsUnit || prevHeading || units.length === 0) {
      units.push(l);
    } else {
      units[units.length - 1] += ` ${l}`;
    }
    prevHeading = HEADING.test(l) && /^\S+\s+([IVXLC]+(-[A-Z])?|[ÚU]NIC[OA])?\s*$/.test(l);
  }
  return units
    .map((u) => u.replace(/(\w)- (\w)/g, '$1-$2'))
    // Dois artigos colados na mesma linha do PDF ("... atacada. Art. 227. Estando ...").
    .map((u) => u.replace(/([.;:])\s+(?=Art\.\s*\d+[º°.]?\s+[A-ZÀ-Ú])/g, '$1\n'))
    .join('\n');
}
