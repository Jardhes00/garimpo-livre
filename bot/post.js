// Monta o texto do post no modelo do Garimpo Livre:
//
// 🚨 OFERTAÇO TÊNIS CASUAL KAPPA! 🚨
//
// 👟 Tênis Casual Kappa Zenit Masculino Unissex Conforto
//
// ❌ De: R$ 229,99
// ✅ Por apenas: R$ 89,99 (ou 3x de R$ 30,00 sem juros)
// 😱 60% DE DESCONTO!
//
// 🚚 FRETE GRÁTIS!
// 🛒 Garanta o seu no link: https://meli.la/xxxx
//
// ⚠️ Promoção por tempo limitado ou enquanto durarem os estoques.
//
// Linhas só aparecem quando a informação existe no anúncio (sem "De" inventado, sem frete grátis inventado).

const brl = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const desconto = o => (o.precoDe && o.precoDe > o.preco ? Math.floor((1 - o.preco / o.precoDe) * 100) : 0);

const EMOJI_PRODUTO = [
  [/t[êe]nis|sapat|chinelo|sand[áa]lia|bota/i, "👟"],
  [/celular|smartphone|iphone|galaxy|moto g|redmi/i, "📱"],
  [/fone|headset|earbud/i, "🎧"],
  [/smart ?tv|\btv\b|televis/i, "📺"],
  [/monitor|notebook|computador|\bpc\b/i, "🖥️"],
  [/rel[óo]gio|smartwatch|watch/i, "⌚"],
  [/perfume|col[ôo]nia/i, "🌸"],
  [/cueca|camiseta|camisa|cal[çc]a|bermuda|vestido|meia|jaqueta/i, "👕"],
  [/air ?fryer|fritadeira|panela|liquidificador|multiprocessador|cafeteira/i, "🍳"],
  [/creatina|whey|prote[ií]na|suplement/i, "💪"],
  [/furadeira|parafusadeira|ferramenta|chave/i, "🔧"],
  [/fralda|beb[êe]/i, "🍼"],
  [/console|playstation|xbox|nintendo|controle|jogo/i, "🎮"],
];
const EMOJI_CATEGORIA = { Tech: "💻", Games: "🎮", Casa: "🏠", Ferramentas: "🔧", Auto: "🚗", Suplementos: "💪", Beleza: "💄", Moda: "👕", "Bebê": "🍼", Esporte: "⚽", Pet: "🐾" };
const emojiDo = o => (EMOJI_PRODUTO.find(([re]) => re.test(o.nome)) || [])[1] || EMOJI_CATEGORIA[o.categoria] || "🛍️";

// "Tênis Casual Kappa Zenit Masculino..." -> "TÊNIS CASUAL KAPPA"
function chamada(nome) {
  const palavras = nome.replace(/[-–|,/()]+/g, " ").split(/\s+/).filter(p => p && !/^(de|da|do|com|para|e|kit)$/i.test(p));
  return palavras.slice(0, 3).join(" ").toLocaleUpperCase("pt-BR");
}

// Modelo atual (cada linha só aparece se a informação existir no anúncio):
// 🚨 OFERTAÇO TÊNIS CASUAL KAPPA! 🚨
//
// 👟 Tênis Casual Kappa Zenit Masculino Unissex Conforto
//
// 🪪Cupom: CODIGO                      (código do cupom, ou o desconto do cupom do anúncio)
// ❌ De: R$ 229,99
// ✅ Por apenas: R$ 89,99 (ou 3x de R$ 30,00 sem juros)
//
// 😱 60% DE DESCONTO!
// 🚚 FRETE GRÁTIS para todo o país!
// 🛒 Garanta o seu no link: https://meli.la/xxxx
// 🪀Mande para seus amigos: https://whatsapp.com/channel/...
function montarPost(o, { canal } = {}) {
  const d = desconto(o);
  const titulo = o.relampago ? `⚡ OFERTA RELÂMPAGO ${chamada(o.nome)}! ⚡` : `🚨 OFERTAÇO ${chamada(o.nome)}! 🚨`;
  const parcelas = o.parcelas ? ` (${o.parcelas.replace(/^ou\s+/i, "ou ").replace(/^(?!ou )/, "ou ")})` : "";
  // cupom: código, se houver; senão o cupom da página do produto, com a regra exata
  // ("Compre R$299,90 e ganhe 15% OFF", "R$245,95 com Cupom"); senão o desconto do card.
  const cupom = o.cupom
    || (o.cupomAnuncio ? `${o.cupomAnuncio} (ative no anúncio)` : "")
    || (o.extra ? o.extra.replace(/\s*com cupom no an[úu]ncio/i, " (ativar no anúncio)") : "");
  const linhas = [titulo, "", `${emojiDo(o)} ${o.nome}`, ""];
  if (cupom) linhas.push(`🪪Cupom: ${cupom}`);
  if (d) linhas.push(`❌ De: ${brl(o.precoDe)}`);
  linhas.push(`✅ Por apenas: ${brl(o.preco)}${o.pix ? " no Pix" : ""}${parcelas}`);
  linhas.push("");
  if (d) linhas.push(`😱 ${d}% DE DESCONTO!`);
  if (o.frete) linhas.push("🚚 FRETE GRÁTIS para todo o país!");
  linhas.push(`🛒 Garanta o seu no link: ${o.link}`);
  if (canal) linhas.push(`🪀Mande para seus amigos: ${canal}`);
  return linhas.join("\n");
}

module.exports = { montarPost, desconto, chamada };
