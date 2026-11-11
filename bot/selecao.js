// Escolhe quais ofertas postar numa rodada, seguindo os critérios do config.json.
const idDoLink = link => (link.match(/MLB-?\d+/i) || [link])[0].replace("-", "").toUpperCase();

function escolher(candidatos, quantidade, criterios = {}, historico = {}, agora = Date.now()) {
  const c = {
    descontoMinimo: 20, notaMinima: 4.5, precoMinimo: 15, precoMaximo: 5000,
    evitarRepetirDias: 7, maxPorCategoria: 3, exigirFreteGratis: false, palavrasBloqueadas: [], ...criterios,
  };
  const limiteRepeticao = agora - c.evitarRepetirDias * 864e5;
  const bloqueio = c.palavrasBloqueadas.length ? new RegExp(c.palavrasBloqueadas.join("|"), "i") : null;
  const vistos = new Set();

  const aptos = candidatos.filter(x => {
    const o = x.oferta, id = idDoLink(o.link);
    if (vistos.has(id)) return false; // mesmo produto aparece 2x na página
    vistos.add(id);
    if (historico[id] && new Date(historico[id]).getTime() > limiteRepeticao) return false;
    if (x.desconto < c.descontoMinimo) return false;
    if (x.nota !== null && x.nota < c.notaMinima) return false;
    if (o.preco < c.precoMinimo || o.preco > c.precoMaximo) return false;
    if (c.exigirFreteGratis && !o.frete) return false;
    if (bloqueio && bloqueio.test(o.nome)) return false;
    return true;
  });

  // ordena por "força" da oferta: desconto, nota e frete grátis
  const forca = x => x.desconto + (x.nota ? (x.nota - 4.5) * 20 : 0) + (x.oferta.frete ? 5 : 0);
  aptos.sort((a, b) => forca(b) - forca(a));

  // variedade: no máximo N por categoria, completando depois se faltar
  const porCat = {}, escolhidos = [];
  for (const x of aptos) {
    if (escolhidos.length >= quantidade) break;
    const k = x.oferta.categoria;
    if ((porCat[k] || 0) >= c.maxPorCategoria) continue;
    porCat[k] = (porCat[k] || 0) + 1;
    escolhidos.push(x);
  }
  for (const x of aptos) {
    if (escolhidos.length >= quantidade) break;
    if (!escolhidos.includes(x)) escolhidos.push(x);
  }
  return escolhidos;
}

module.exports = { escolher, idDoLink };
