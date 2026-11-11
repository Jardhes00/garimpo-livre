// Lê o texto de um post do grupo (no modelo do Garimpo Livre) e devolve uma oferta.
// Não depende de nada do WhatsApp, por isso dá para testar sozinho (node test-parser.js).

const CATEGORIAS = {
  casa: { nome: "Casa", emoji: "🏠" },
  cozinha: { nome: "Casa", emoji: "🍳" },
  tech: { nome: "Tech", emoji: "💻" },
  eletronicos: { nome: "Tech", emoji: "💻" },
  celular: { nome: "Tech", emoji: "📱" },
  games: { nome: "Games", emoji: "🎮" },
  moda: { nome: "Moda", emoji: "👕" },
  beleza: { nome: "Beleza", emoji: "💄" },
  ferramentas: { nome: "Ferramentas", emoji: "🔧" },
  auto: { nome: "Auto", emoji: "🚗" },
  suplementos: { nome: "Suplementos", emoji: "💪" },
  fitness: { nome: "Suplementos", emoji: "💪" },
  bebe: { nome: "Bebê", emoji: "🍼" },
  pet: { nome: "Pet", emoji: "🐾" },
  esporte: { nome: "Esporte", emoji: "⚽" },
  achadinhos: { nome: "Achadinhos", emoji: "💡" },
};

// "1.234,56" -> 1234.56 ; "149" -> 149
function numeroBR(txt) {
  const limpo = txt.replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
// tira emoji/símbolos do começo da linha
const semEmojiInicial = s => s.replace(/^[^\p{L}\p{N}*~_]+/u, "").trim();
// tira a formatação do WhatsApp (*negrito*, _itálico_, ~tachado~)
const semFormatacao = s => s.replace(/[*_~]/g, "").trim();

function linkDoProduto(texto) {
  const urls = texto.match(/https?:\/\/[^\s*~_)]+/g) || [];
  return urls.find(u => /(^https?:\/\/(www\.)?meli\.la\/)|mercadolivre\.com(\.br)?\//i.test(u)) || null;
}

function parsePost(texto) {
  if (!texto || typeof texto !== "string") return { ok: false, motivo: "mensagem sem texto" };
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const link = linkDoProduto(texto);
  if (!link) return { ok: false, motivo: "não achei link do Mercado Livre (meli.la ou mercadolivre.com.br)" };

  // modelo atual: "🚨 OFERTAÇO ... 🚨" / "✅ Por apenas: R$ ..."
  if (linhas.some(l => /^✅\s*Por apenas/i.test(l))) return parseModeloOfertaco(texto, linhas, link);

  // modelo antigo: nome na primeira linha inteira em *negrito* que não seja a de preço
  let nome = null;
  for (const l of linhas) {
    const m = l.match(/^\*([^*]+)\*$/);
    if (m && !/R\$/.test(m[1])) { nome = m[1].trim(); break; }
  }
  if (!nome) return { ok: false, motivo: "não achei o nome do produto (linha só com *Nome do produto*)" };

  // preço: primeira linha com R$ que não seja de parcelamento/cupom
  const linhaPreco = linhas.find(l => /R\$/.test(l) && !/^💳/.test(l) && !/cupom|parcel|\d+x\b/i.test(l));
  if (!linhaPreco) return { ok: false, motivo: "não achei a linha de preço (ex.: 💰 Por *R$ 99,90*)" };
  const valores = [...linhaPreco.matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/g)].map(m => numeroBR(m[1])).filter(v => v !== null);
  if (!valores.length) return { ok: false, motivo: "não consegui ler o valor do preço" };

  let preco, precoDe;
  if (/\bde\b/i.test(semAcento(linhaPreco)) && valores.length >= 2) { precoDe = valores[0]; preco = valores[1]; }
  else preco = valores[valores.length - 1];
  if (precoDe !== undefined && !(precoDe > preco)) precoDe = undefined; // "de" só vale se for maior
  const pix = /\bpix\b/i.test(linhaPreco);

  const linhaParcela = linhas.find(l => /^💳/.test(l) || (/R\$/.test(l) && /\d+x\b|outros meios/i.test(l) && l !== linhaPreco));
  const parcelas = linhaParcela ? semFormatacao(semEmojiInicial(linhaParcela)) : undefined;

  const linhaExtra = linhas.find(l => /^🎟/.test(l) || (/cupom/i.test(l) && l !== linhaPreco));
  const extra = linhaExtra ? semFormatacao(semEmojiInicial(linhaExtra)) : undefined;

  const frete = /frete\s+gr[aá]tis/i.test(texto);
  const relampago = /rel[aâ]mpago/i.test(linhas[0] || "");

  // categoria: hashtag, ex. #casa ; #destaque marca a "Pepita do dia"
  const tags = [...texto.matchAll(/#([\p{L}\p{N}_]+)/gu)].map(m => semAcento(m[1].toLowerCase()));
  const destaque = tags.includes("destaque");
  const tagCat = tags.find(t => t !== "destaque");
  let categoria = "Diversos", emoji = "🛍️";
  if (tagCat) {
    if (CATEGORIAS[tagCat]) ({ nome: categoria, emoji } = CATEGORIAS[tagCat]);
    else categoria = tagCat.charAt(0).toUpperCase() + tagCat.slice(1);
  }

  const oferta = { nome, categoria, preco, link, frete, emoji, afiliado: true };
  if (precoDe !== undefined) oferta.precoDe = precoDe;
  if (pix) oferta.pix = true;
  if (parcelas) oferta.parcelas = parcelas;
  if (extra) oferta.extra = extra;
  if (relampago) oferta.relampago = true;
  if (destaque) oferta.destaque = true;
  return { ok: true, oferta };
}

function parseModeloOfertaco(texto, linhas, link) {
  const valor = l => { const m = l && l.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/); return m ? numeroBR(m[1]) : null; };
  // nome: a primeira linha depois do título que não é preço, link ou aviso
  const nomeLinha = linhas.slice(1).find(l => !/R\$|https?:|^(❌|✅|😱|🚚|🛒|⚠|🎟|🪪|🪀)/u.test(l));
  const nome = nomeLinha ? semFormatacao(semEmojiInicial(nomeLinha)) : null;
  if (!nome) return { ok: false, motivo: "não achei o nome do produto (linha logo abaixo do título)" };

  const lPor = linhas.find(l => /^✅/.test(l));
  const preco = valor(lPor);
  if (preco === null) return { ok: false, motivo: "não consegui ler o valor em \"✅ Por apenas\"" };
  let precoDe = valor(linhas.find(l => /^❌/.test(l)));
  if (precoDe !== null && !(precoDe > preco)) precoDe = null;

  const parcelas = ((lPor.match(/\(([^)]+)\)/) || [])[1] || "").trim() || undefined;
  const linhaExtra = linhas.find(l => /^(🎟|🪪)/u.test(l));
  const tags = [...texto.matchAll(/#([\p{L}\p{N}_]+)/gu)].map(m => semAcento(m[1].toLowerCase()));
  const tagCat = tags.find(t => t !== "destaque");
  let categoria, emoji;
  if (tagCat && CATEGORIAS[tagCat]) ({ nome: categoria, emoji } = CATEGORIAS[tagCat]);
  else { categoria = require("./cartao").categoriaDoNome(nome); emoji = "🛍️"; }

  const oferta = { nome, categoria, preco, link, frete: /frete\s+gr[aá]tis/i.test(texto), emoji, afiliado: true };
  if (precoDe !== null) oferta.precoDe = precoDe;
  if (/\bno pix\b/i.test(lPor)) oferta.pix = true;
  if (parcelas) oferta.parcelas = parcelas;
  if (linhaExtra) oferta.extra = semFormatacao(semEmojiInicial(linhaExtra)).replace(/^cupom:\s*/i, "");
  if (/rel[aâ]mpago/i.test(linhas[0] || "")) oferta.relampago = true;
  if (tags.includes("destaque")) oferta.destaque = true;
  return { ok: true, oferta };
}

module.exports = { parsePost, linkDoProduto, numeroBR };
