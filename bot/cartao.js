// Lê o texto de um card da página de ofertas do Mercado Livre e devolve os dados da oferta.
// Exemplo de texto de card (como o navegador mostra):
// "BLACK FRIDAY Kit 10 Cuecas ... 4.8 | +100mil vendidos ... R$ 449 , 99 R$ 147 , 19 67% OFF no Pix
//  ou R$ 159 , 99 em outros meios 25% OFF com Saldo no Mercado Pago Frete grátis"
// Não depende do navegador: dá para testar sozinho (node test-garimpo.js).

const numeroBR = s => {
  const n = Number(String(s).replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const brlTxt = v => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
// "R$ 1.299" | "R$ 629 , 10" | "R$ 34 , 50"
const RE_VALOR = /R\$\s*([\d.]+(?:\s*,\s*\d{2})?)/g;

const PALAVRAS_CATEGORIA = [
  ["Tech", /celular|smartphone|iphone|galaxy|moto g|redmi|fone|headset|monitor|notebook|tablet|smart ?tv|\btv\b|smartwatch|watch|impressora|mouse|teclado|ssd|carregador|caixa de som|soundbar|alexa|echo|kindle/i],
  ["Games", /playstation|ps5|ps4|xbox|nintendo|switch|controle|jogo |console|gamer/i],
  ["Casa", /panela|pote|air ?fryer|fritadeira|liquidificador|multiprocessador|cafeteira|travesseiro|colch|toalha|len[çc]ol|aspirador|fechadura|ar.condicionado|ventilador|geladeira|micro-?ondas|cozinha|organizador|tapete|cortina/i],
  ["Ferramentas", /parafusadeira|furadeira|ferramenta|chave|soquete|serra|esmerilhadeira|trena|alicate|compressor/i],
  ["Auto", /veicular|carro|moto\b|pneu|automotiv|auxiliar de partida|inversor/i],
  ["Suplementos", /creatina|whey|prote[ií]na|suplement|col[áa]geno|vitamina|termog/i],
  ["Beleza", /perfume|s[ée]rum|shampoo|condicionador|maquiagem|hidratante|creme|protetor solar|secador|chapinha|barbeador|wella|loreal|nivea/i],
  ["Moda", /cueca|t[êe]nis|camiseta|camisa|cal[çc]a|bermuda|vestido|meia|jaqueta|bolsa|mochila|rel[óo]gio|[óo]culos|sand[áa]lia|chinelo/i],
  ["Bebê", /fralda|beb[êe]|infantil|mamadeira|carrinho de beb/i],
  ["Esporte", /bicicleta|ergom[ée]trica|halter|esteira|yoga|academia|bola|patinete/i],
  ["Pet", /\bpet\b|ra[çc][ãa]o|gato|cachorro|areia sanit/i],
];
const EMOJI = { Tech: "💻", Games: "🎮", Casa: "🏠", Ferramentas: "🔧", Auto: "🚗", Suplementos: "💪", Beleza: "💄", Moda: "👕", "Bebê": "🍼", Esporte: "⚽", Pet: "🐾", Diversos: "🛍️" };

function categoriaDoNome(nome) {
  const achou = PALAVRAS_CATEGORIA.find(([, re]) => re.test(nome));
  return achou ? achou[0] : "Diversos";
}

// Link limpo do produto. Anúncios patrocinados (click1.mercadolivre / mclics) voltam null.
function linkLimpo(href) {
  if (!href || /click\d*\.mercadolivre|mclics/i.test(href)) return null;
  const u = href.split("#")[0].split("?")[0];
  return /mercadolivre\.com\.br\//.test(u) && /MLB/i.test(u) ? u : null;
}

// Foto grande em JPG a partir da miniatura (o WhatsApp manda JPG como foto; WebP pode virar figurinha)
function fotoGrande(src) {
  const m = String(src || "").match(/(\d+-ML[ABU]\d+_\d+)/);
  return m ? `https://http2.mlstatic.com/D_NQ_NP_2X_${m[1]}-F.jpg` : null;
}

function lerCartao({ texto, nome, href, img }) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  const link = linkLimpo(href);
  if (!link) return { ok: false, motivo: "anúncio patrocinado ou sem link" };
  if (!nome) return { ok: false, motivo: "sem nome" };

  // pega só o trecho de preços: do primeiro R$ até o "% OFF" principal (ignora "OFF com Saldo/Cupom/Parcelado")
  const iPreco = t.indexOf("R$");
  if (iPreco < 0) return { ok: false, motivo: "sem preço" };
  const off = t.match(/(\d{1,2})% OFF(?! com| Mercado)/);
  const valores = [...t.slice(iPreco).matchAll(RE_VALOR)].map(m => ({ v: numeroBR(m[1]), i: m.index + iPreco }));
  if (!valores.length) return { ok: false, motivo: "não li o preço" };

  let preco, precoDe;
  if (off && valores.length >= 2 && valores[1].i < off.index) { precoDe = valores[0].v; preco = valores[1].v; }
  else preco = valores[0].v;
  if (precoDe !== undefined && !(precoDe > preco)) precoDe = undefined;
  const desconto = precoDe ? Math.floor((1 - preco / precoDe) * 100) : 0;

  const depoisOff = off ? t.slice(off.index) : t.slice(valores[0].i);
  const pix = /^\d{1,2}% OFF no Pix/.test(depoisOff);

  // parcelas / outros meios: "ou R$ 699 em 2x R$ 349 , 50 sem juros" | "12x R$ 17 , 20" | "ou R$ 999 , 99 em outros meios"
  let parcelas;
  const mOutros = depoisOff.match(/ou (R\$\s*[\d.]+(?:\s*,\s*\d{2})?) em (\d+)x (R\$\s*[\d.]+(?:\s*,\s*\d{2})?)( sem juros)?/);
  const mMeios = depoisOff.match(/ou (R\$\s*[\d.]+(?:\s*,\s*\d{2})?) em outros meios/);
  const mParc = depoisOff.match(/(\d+)x (R\$\s*[\d.]+(?:\s*,\s*\d{2})?)( sem juros)?/);
  const fmt = s => brlTxt(numeroBR(s.replace("R$", "")));
  if (mOutros) parcelas = `ou ${fmt(mOutros[1])} em ${mOutros[2]}x de ${fmt(mOutros[3])}${mOutros[4] || ""}`;
  else if (mMeios) parcelas = `ou ${fmt(mMeios[1])} em outros meios`;
  else if (mParc) parcelas = `${mParc[1]}x de ${fmt(mParc[2])}${mParc[3] || ""}`;

  // cupom: "R$ 20 OFF com Cupom" | "10% OFF com Cupom"
  const mCupom = t.match(/(R\$\s*\d+|\d{1,2}%) OFF com Cupom/i);
  const extra = mCupom ? `${mCupom[1].replace(/\s+/g, " ")} OFF com cupom no anúncio` : undefined;

  const nota = (t.match(/(\d\.\d) \|/) || [])[1];
  const vendidos = (t.match(/\+([\d.,]+(?:mil|M)?) vendidos/) || [])[1];
  const frete = /Frete gr[áa]tis|Chegar[áa] gr[áa]tis/i.test(t);
  const relampago = /^\d\s?\d\s?:\s?\d\s?\d\s?:/.test(t); // card com cronômetro

  const categoria = categoriaDoNome(nome);
  const oferta = {
    nome: nome.replace(/\s+/g, " ").trim(),
    categoria, emoji: EMOJI[categoria],
    preco, link, frete, afiliado: false,
    imagemOriginal: fotoGrande(img) || img || null,
  };
  if (precoDe) oferta.precoDe = precoDe;
  if (pix) oferta.pix = true;
  if (parcelas) oferta.parcelas = parcelas;
  if (extra) oferta.extra = extra;
  if (relampago) oferta.relampago = true;
  return { ok: true, oferta, desconto, nota: nota ? Number(nota) : null, vendidos: vendidos || null };
}

module.exports = { lerCartao, categoriaDoNome, linkLimpo, fotoGrande, numeroBR };
