// Recorte de uma norma: só os artigos (e, se indicado, só os dispositivos) escolhidos.
//
// selecao = { '1': true, '5': ['inciso XXXII', 'inciso LIV'] }
//   true  -> o artigo inteiro
//   lista -> só esses dispositivos (por rótulo); os ancestrais deles (ex.: o caput)
//            ficam como contexto, visíveis na leitura mas sem gerar exercícios.

export function selectArticles(artigos, selecao) {
  if (!selecao) return { artigos, faltando: [] };
  const faltando = [];
  const out = [];
  for (const [num, regra] of Object.entries(selecao)) {
    const art = artigos.find((a) => a.num === num);
    if (!art) {
      faltando.push(`Art. ${num}`);
      continue;
    }
    if (regra === true) {
      out.push(art);
      continue;
    }
    const byId = new Map(art.dispositivos.map((d) => [d.id, d]));
    const manter = new Set();
    const escolhidos = new Set();
    for (const rotulo of regra) {
      const d = art.dispositivos.find((x) => x.rotulo === rotulo);
      if (!d) {
        faltando.push(`Art. ${num}, ${rotulo}`);
        continue;
      }
      escolhidos.add(d.id);
      // O dispositivo, seus filhos (alíneas) e seus ancestrais.
      for (const x of art.dispositivos) if (x.id === d.id || x.pai === d.id) manter.add(x.id);
      let p = d.pai && byId.get(d.pai);
      while (p) {
        manter.add(p.id);
        p = p.pai && byId.get(p.pai);
      }
    }
    const dispositivos = art.dispositivos
      .filter((d) => manter.has(d.id))
      .map((d) => (escolhidos.has(d.id) || (d.pai && escolhidos.has(d.pai)) ? d : { ...d, contexto: true }));
    out.push({ ...art, recorte: true, dispositivos });
  }
  // Mantém a ordem original da norma.
  out.sort((a, b) => artigos.indexOf(artigos.find((x) => x.num === a.num)) - artigos.indexOf(artigos.find((x) => x.num === b.num)));
  return { artigos: out.map((a, i) => ({ ...a, ordem: i })), faltando };
}
