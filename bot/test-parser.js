// Testes do leitor de posts. Rode com: node test-parser.js
const assert = require("assert");
const { parsePost } = require("./parser");

const casos = [];
const caso = (nome, fn) => casos.push({ nome, fn });

caso("post completo no modelo (Pix, parcelas, frete, categoria)", () => {
  const r = parsePost(`🔥 BAIXOU BASTANTE!

*Kit 10 Cuecas Boxer Lupo Algodão Confortável*

💰 De ~R$ 449,99~ por *R$ 147,19* no Pix
💳 ou R$ 159,99 em outros meios
🚚 Frete grátis

⭐️ Anúncio | Mercado Livre
🔗 https://meli.la/1krPo8D

📢 Siga o Canal e receba mais achados:
🔗 https://whatsapp.com/channel/0029Vb9VSeT72WTwAyTD8Y3t
#moda`);
  assert.ok(r.ok, r.motivo);
  const o = r.oferta;
  assert.strictEqual(o.nome, "Kit 10 Cuecas Boxer Lupo Algodão Confortável");
  assert.strictEqual(o.preco, 147.19);
  assert.strictEqual(o.precoDe, 449.99);
  assert.strictEqual(o.pix, true);
  assert.strictEqual(o.parcelas, "ou R$ 159,99 em outros meios");
  assert.strictEqual(o.frete, true);
  assert.strictEqual(o.link, "https://meli.la/1krPo8D");
  assert.strictEqual(o.categoria, "Moda");
});

caso("sem 'de', preço com milhar, cupom e relâmpago", () => {
  const r = parsePost(`⚡ OFERTA RELÂMPAGO!

*Smart TV LG 43" 4K UHD 43UN85C*

💰 Por *R$ 1.628,00*
🎟️ R$ 20 OFF com cupom no anúncio

🔗 https://meli.la/1CVpSAG
#tech #destaque`);
  assert.ok(r.ok, r.motivo);
  assert.strictEqual(r.oferta.preco, 1628);
  assert.strictEqual(r.oferta.precoDe, undefined);
  assert.strictEqual(r.oferta.extra, "R$ 20 OFF com cupom no anúncio");
  assert.strictEqual(r.oferta.relampago, true);
  assert.strictEqual(r.oferta.destaque, true);
  assert.strictEqual(r.oferta.frete, false);
  assert.strictEqual(r.oferta.categoria, "Tech");
});

caso("preço sem centavos e sem hashtag", () => {
  const r = parsePost(`🔥 OFERTA DO DIA!
*Fone Soundcore P20i*
💰 De ~R$ 299~ por *R$ 138*
https://meli.la/1KjaXDS`);
  assert.ok(r.ok, r.motivo);
  assert.strictEqual(r.oferta.preco, 138);
  assert.strictEqual(r.oferta.precoDe, 299);
  assert.strictEqual(r.oferta.categoria, "Diversos");
});

caso("link comum do mercadolivre.com.br também vale", () => {
  const r = parsePost(`*Creatina 1kg*\n💰 Por *R$ 69,99*\n🔗 https://www.mercadolivre.com.br/creatina/p/MLB25929487`);
  assert.ok(r.ok, r.motivo);
  assert.ok(r.oferta.link.includes("MLB25929487"));
});

caso("ignora conversa normal (sem link)", () => {
  const r = parsePost("Bom dia pessoal! Hoje tem oferta boa às 11h");
  assert.strictEqual(r.ok, false);
});

caso("ignora post sem nome em negrito", () => {
  const r = parsePost("Olha essa: R$ 50 https://meli.la/abc123");
  assert.strictEqual(r.ok, false);
});

caso("não usa o link do Canal como link do produto", () => {
  const r = parsePost(`*Produto X*\n💰 Por *R$ 10,00*\n🔗 https://whatsapp.com/channel/0029Vb9VSeT72WTwAyTD8Y3t`);
  assert.strictEqual(r.ok, false);
});

caso("'de' menor que o preço é descartado", () => {
  const r = parsePost(`*Produto Y*\n💰 De ~R$ 10,00~ por *R$ 20,00*\nhttps://meli.la/xyz`);
  assert.ok(r.ok, r.motivo);
  assert.strictEqual(r.oferta.precoDe, undefined);
  assert.strictEqual(r.oferta.preco, 20);
});

let falhas = 0;
for (const c of casos) {
  try { c.fn(); console.log("✔", c.nome); }
  catch (e) { falhas++; console.log("✘", c.nome, "\n   ", e.message); }
}
console.log(`\n${casos.length - falhas}/${casos.length} testes passaram`);
process.exit(falhas ? 1 : 0);
