// Testes do garimpeiro com textos REAIS de cards da página de ofertas (capturados em 10/11/2026).
// Rode com: node test-garimpo.js
const assert = require("assert");
const { lerCartao, fotoGrande } = require("./cartao");
const { escolher } = require("./selecao");
const { montarPost } = require("./post");
const { parsePost } = require("./parser");

const card = (texto, nome, href, img = "https://http2.mlstatic.com/D_Q_NP_2X_605303-MLA116320601976_092026-AB.webp") => lerCartao({ texto, nome, href, img });
let ok = 0, falhas = 0;
const t = (nome, fn) => { try { fn(); ok++; console.log("✔", nome); } catch (e) { falhas++; console.log("✘", nome, "\n   ", e.message); } };

t("Pix + outros meios + frete (cuecas)", () => {
  const r = card("BLACK FRIDAY Kit 10 Cuecas Boxer Lupo Algodão Confortável Box Original LUPO por Osure 4.8 | +100mil vendidos Classificação 4.8 de 5 estrelas. Mais de 100mil produtos vendidos. R$ 449 , 99 R$ 147 , 19 67% OFF no Pix ou R$ 159 , 99 em outros meios 25% OFF com Saldo no Mercado Pago Frete grátis Frete grátis Disponível em 3 cores",
    "Kit 10 Cuecas Boxer Lupo Algodão Confortável Box Original", "https://produto.mercadolivre.com.br/MLB-1473758753-kit-10-cuecas-boxer-lupo-algodo-confortavel-box-original-_JM#polycard");
  assert.ok(r.ok, r.motivo);
  assert.strictEqual(r.oferta.preco, 147.19); assert.strictEqual(r.oferta.precoDe, 449.99); assert.strictEqual(r.desconto, 67);
  assert.strictEqual(r.oferta.pix, true); assert.strictEqual(r.oferta.parcelas, "ou R$ 159,99 em outros meios");
  assert.strictEqual(r.oferta.frete, true); assert.strictEqual(r.nota, 4.8); assert.strictEqual(r.oferta.categoria, "Moda");
  assert.ok(!r.oferta.link.includes("#"));
});

t("Pix + parcelado em outros meios (Moto G06)", () => {
  const r = card("BLACK FRIDAY Smartphone Motorola Moto G06 - 64GB 4GB RAM + 8GB Ram Boost, Camera 50MP com AI, Bateria de 5200 mAh e Tela 6.9\" - Bege Motorola 4.9 | +1000 vendidos Classificação 4.9 de 5 estrelas. Mais de 1000 produtos vendidos. R$ 1.299 R$ 629 , 10 51% OFF no Pix ou R$ 699 em 2x R$ 349 , 50 sem juros Chegará grátis quinta-feira Disponível em 5 cores",
    "Smartphone Motorola Moto G06 - 64GB 4GB RAM", "https://www.mercadolivre.com.br/smartphone-motorola-moto-g06/p/MLB79484488");
  assert.ok(r.ok, r.motivo);
  assert.strictEqual(r.oferta.preco, 629.1); assert.strictEqual(r.oferta.precoDe, 1299); assert.strictEqual(r.desconto, 51);
  assert.strictEqual(r.oferta.parcelas, "ou R$ 699 em 2x de R$ 349,50 sem juros");
  assert.strictEqual(r.oferta.frete, true); assert.strictEqual(r.oferta.categoria, "Tech");
});

t("cupom em R$ e sem Pix (creatina)", () => {
  const r = card("OFERTA IMPERDÍVEL Creatina Monohidratada 1kg 100% Pura - Dark Lab DARK LAB 4.9 | +750mil vendidos Classificação 4.9 de 5 estrelas. Mais de 750mil produtos vendidos. R$ 159 , 90 R$ 69 , 99 56% OFF 25% OFF com Saldo no Mercado Pago R$ 20 OFF com Cupom Frete grátis ou rápido quinta-feira ou rápido quinta-feira",
    "Creatina Monohidratada 1kg 100% Pura - Dark Lab", "https://www.mercadolivre.com.br/creatina-monohidratada-1kg-100-pura-dark-lab/p/MLB25929487");
  assert.ok(r.ok, r.motivo);
  assert.strictEqual(r.oferta.preco, 69.99); assert.strictEqual(r.desconto, 56); assert.strictEqual(r.oferta.pix, undefined);
  assert.strictEqual(r.oferta.extra, "R$ 20 OFF com cupom no anúncio"); assert.strictEqual(r.oferta.categoria, "Suplementos");
});

t("cronômetro = relâmpago, parcelas e 'Mercado Parcelado' ignorado (smartwatch)", () => {
  const r = card("1 0 : 2 0 : 2 2 3 Smartwatch NOVANTE Air R1 Esportivo com Alexa, Chamadas e Monitor de Saúde 4.8 | +500 vendidos Classificação 4.8 de 5 estrelas. Mais de 500 produtos vendidos. R$ 299 R$ 133 , 99 55% OFF 4x R$ 33 , 50 sem juros 60% OFF Mercado Parcelado Chegar",
    "Smartwatch NOVANTE Air R1 Esportivo", "https://www.mercadolivre.com.br/smartwatch-novante/p/MLB123456");
  assert.ok(r.ok, r.motivo);
  assert.strictEqual(r.oferta.relampago, true); assert.strictEqual(r.desconto, 55);
  assert.strictEqual(r.oferta.parcelas, "4x de R$ 33,50 sem juros");
});

t("entrega paga não conta como frete grátis (fralda)", () => {
  const r = card("OFERTA DO DIA Fralda Pampers Premium Care Tamanho XG, 120 Unidades Pampers 5.0 | +5mil vendidos Classificação 5.0 de 5 estrelas. Mais de 5mil produtos vendidos. R$ 255 , 90 R$ 174 32% OFF 12x R$ 17 , 20 Chegará quinta-feira",
    "Fralda Pampers Premium Care Tamanho XG, 120 Unidades", "https://www.mercadolivre.com.br/fralda-pampers/p/MLB44160420");
  assert.ok(r.ok, r.motivo);
  assert.strictEqual(r.oferta.frete, false); assert.strictEqual(r.oferta.preco, 174); assert.strictEqual(r.oferta.categoria, "Bebê");
  assert.strictEqual(r.oferta.parcelas, "12x de R$ 17,20");
});

t("anúncio patrocinado (click1/mclics) é descartado", () => {
  const r = card("Console Sony Playstation 5 ... R$ 5.399 R$ 4.649 13% OFF", "Console PS5", "https://click1.mercadolivre.com.br/mclics/clicks/external/MLB/count");
  assert.strictEqual(r.ok, false);
});

t("cupom em % (parafusadeira)", () => {
  const r = card("BLACK FRIDAY Parafusadeira Furadeira De Impacto The Black Tools Profissional TB-21PX 2 Baterias Com Maleta 60Hz Amarelo THE BLACK TOOLS 4.8 | +250mil vendidos Classificação 4.8 de 5 estrelas. Mais de 250mil produtos vendidos. R$ 259 , 90 R$ 139 , 90 46% OFF 25% OFF com Saldo no Mercado Pago 10% OFF com Cupom Chegará grátis quinta-feira Disponível em 2 cores",
    "Parafusadeira Furadeira De Impacto The Black Tools", "https://www.mercadolivre.com.br/parafusadeira/p/MLB30144703");
  assert.ok(r.ok, r.motivo);
  assert.strictEqual(r.oferta.extra, "10% OFF com cupom no anúncio"); assert.strictEqual(r.oferta.categoria, "Ferramentas");
});

t("foto grande em JPG a partir da miniatura", () => {
  assert.strictEqual(fotoGrande("https://http2.mlstatic.com/D_Q_NP_2X_605303-MLA116320601976_092026-AB.webp"),
    "https://http2.mlstatic.com/D_NQ_NP_2X_605303-MLA116320601976_092026-F.jpg");
});

t("seleção: respeita desconto mínimo, repetição e variedade", () => {
  const mk = (id, cat, desc, nota = 4.8) => ({ desconto: desc, nota, oferta: { nome: "P" + id, categoria: cat, preco: 100, link: `https://www.mercadolivre.com.br/x/p/MLB${id}`, frete: true } });
  const cands = [mk(1, "Tech", 60), mk(2, "Tech", 55), mk(3, "Tech", 50), mk(4, "Tech", 45), mk(5, "Casa", 30), mk(6, "Moda", 10), mk(7, "Casa", 40, 4.0), mk(8, "Auto", 35)];
  const hist = { MLB2: new Date().toISOString() }; // postado hoje: não repete
  const r = escolher(cands, 5, { descontoMinimo: 20, notaMinima: 4.5, maxPorCategoria: 2 }, hist).map(x => x.oferta.nome);
  assert.deepStrictEqual(r, ["P1", "P3", "P8", "P5", "P4"]); // 2 Tech primeiro, depois outras categorias, completa com Tech
});

t("post montado pelo bot é entendido pelo leitor do grupo (vai certo pro site)", () => {
  const r = card("BLACK FRIDAY Kit 10 Cuecas ... 4.8 | +100mil vendidos R$ 449 , 99 R$ 147 , 19 67% OFF no Pix ou R$ 159 , 99 em outros meios Frete grátis",
    "Kit 10 Cuecas Boxer Lupo", "https://produto.mercadolivre.com.br/MLB-1473758753-kit-_JM");
  const o = { ...r.oferta, link: "https://meli.la/1krPo8D" };
  const txt = montarPost(o, { canal: "https://whatsapp.com/channel/0029Vb9VSeT72WTwAyTD8Y3t" });
  const lido = parsePost(txt);
  assert.ok(lido.ok, lido.motivo);
  for (const k of ["nome", "preco", "precoDe", "pix", "parcelas", "frete", "link", "categoria"]) assert.deepStrictEqual(lido.oferta[k], o[k], k);
});

console.log(`\n${ok}/${ok + falhas} testes passaram`);
process.exit(falhas ? 1 : 0);
