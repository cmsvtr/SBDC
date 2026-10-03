// Converte páginas de legislação do Planalto (HTML do FrontPage/Word, windows-1252)
// em texto puro, uma unidade (parágrafo) por linha. Texto riscado (<strike>, <s>,
// <del> ou style "line-through") é a redação revogada e é descartado.

const BLOCK_TAGS = new Set([
  'p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'li', 'blockquote', 'table', 'center',
]);
const STRIKE_TAGS = new Set(['strike', 's', 'del']);
const VOID_TAGS = new Set(['br', 'img', 'meta', 'link', 'hr', 'input', 'col', 'area', 'base', 'wbr']);

const NAMED_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', deg: '°',
  sect: '§', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…',
  laquo: '«', raquo: '»', middot: '·', shy: '',
};

// Bytes 0x80–0x9F do windows-1252. O TextDecoder do Node trata "windows-1252"
// como latin1 e devolveria caracteres de controle no lugar de – “ ” etc.
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
export function fixC1(s) {
  return s.replace(/[\u0080-\u009f]/g, (c) => CP1252[c.charCodeAt(0) - 0x80]);
}

export function decodeBuffer(buf) {
  const head = buf.subarray(0, 2048).toString('latin1').toLowerCase();
  const m = head.match(/charset=["']?([\w-]+)/);
  const enc = m ? m[1] : 'windows-1252';
  if (enc === 'utf-8' || enc === 'utf8') return new TextDecoder('utf-8').decode(buf);
  return fixC1(buf.toString('latin1'));
}

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      // Referências numéricas 128–159 são, na prática, windows-1252.
      if (code >= 128 && code <= 159) return fixC1(String.fromCharCode(code));
      return String.fromCodePoint(code);
    }
    const v = NAMED_ENTITIES[e.toLowerCase()];
    return v === undefined ? all : v;
  });
}

export function htmlToText(html) {
  html = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(head|style|script)\b[\s\S]*?<\/\1\s*>/gi, '');

  const out = [];
  // Pilha de elementos abertos: cada item registra se o elemento risca o texto.
  const stack = [];
  let struck = 0;
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      if (!struck) out.push(m[4].replace(/\s+/g, ' '));
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';
    if (BLOCK_TAGS.has(tag)) out.push('\n');
    if (VOID_TAGS.has(tag) || attrs.trim().endsWith('/')) continue;
    if (!closing) {
      const strikes = STRIKE_TAGS.has(tag) || /line-through/i.test(attrs);
      stack.push({ tag, strikes });
      if (strikes) struck++;
    } else {
      // Fecha até o elemento correspondente (HTML do Planalto nem sempre é bem formado).
      const idx = stack.map((e) => e.tag).lastIndexOf(tag);
      if (idx === -1) continue;
      while (stack.length > idx) {
        const e = stack.pop();
        if (e.strikes) struck--;
      }
    }
  }
  return decodeEntities(out.join(''))
    .split('\n')
    .map((l) => l.replace(/[\s ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
