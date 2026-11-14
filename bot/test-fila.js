// Testes da fila: adicionar, não repetir, ordem e post montado.
// Usa uma pasta temporária (FILA_DIR); nunca mexe na fila de verdade, mesmo com o bot ligado.
// Rode com: node test-fila.js
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
process.env.FILA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "garimpo-fila-teste-"));
const fila = require("./fila");
const { montarPost } = require("./post");

const HIST = path.join(process.env.FILA_DIR, "historico.json");
const backup = f => (fs.existsSync(f) ? fs.readFileSync(f) : null);
const restaurar = (f, b) => (b === null ? fs.rmSync(f, { force: true }) : fs.writeFileSync(f, b));
const bFila = backup(fila.ARQ), bHist = backup(HIST);
const entrada = path.join(os.tmpdir(), "garimpo-teste-ofertas.json");
const roda = lista => { fs.writeFileSync(entrada, JSON.stringify(lista)); return JSON.parse(execFileSync(process.execPath, [path.join(__dirname, "adicionar-fila.js"), entrada], { encoding: "utf8" })); };

let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log("✔", nome); };
try {
  fs.rmSync(fila.ARQ, { force: true });
  fs.writeFileSync(HIST, JSON.stringify({ MLB999: "2020-01-01T00:00:00Z" }));
  const A = { nome: "Tênis Casual Kappa Zenit Masculino", preco: 89.99, precoDe: 229.99, parcelas: "3x de R$ 30,00 sem juros", frete: true, link: "https://meli.la/AAA111", anuncio: "https://www.mercadolivre.com.br/tenis/p/MLB111" };
  const B = { nome: "Garrafa Térmica Inox 1L", preco: 39.9, frete: false, link: "https://meli.la/BBB222", anuncio: "https://www.mercadolivre.com.br/garrafa/p/MLB222" };

  t("adiciona ofertas válidas e descarta inválida e já postada", () => {
    const r = roda([A, B, { nome: "Sem link", preco: 10 }, { ...B, nome: "Repetida", link: "https://meli.la/CCC", anuncio: "https://x.mercadolivre.com.br/p/MLB999" }]);
    assert.strictEqual(r.adicionadas.length, 2);
    assert.strictEqual(r.puladas.length, 2);
    assert.strictEqual(r.totalNaFila, 2);
  });
  t("não duplica o que já está na fila", () => {
    const r = roda([A]);
    assert.strictEqual(r.adicionadas.length, 0);
    assert.strictEqual(r.puladas[0].motivo, "já está na fila");
  });
  t("sai na ordem em que entrou, com categoria e post no modelo", () => {
    const i = fila.proximo();
    assert.strictEqual(i.id, "MLB111");
    assert.strictEqual(i.oferta.categoria, "Moda");
    const post = montarPost(i.oferta);
    assert.ok(post.startsWith("🚨 OFERTAÇO TÊNIS CASUAL KAPPA! 🚨"));
    assert.ok(post.includes("😱 60% DE DESCONTO!"));
    assert.ok(post.includes("🛒 Garanta o seu no link: https://meli.la/AAA111"));
    fila.marcarPostado(i.id);
    assert.ok(fila.jaPostado("MLB111"));
    assert.strictEqual(fila.proximo().id, "MLB222");
    assert.strictEqual(fila.proximo(), null);
  });
  t("cupom do anúncio sai com a regra exata", () => {
    const post = montarPost({ ...B, preco: 349.9, cupomAnuncio: "Compre R$299,90 e ganhe 15% OFF", extra: "15% OFF com cupom no anúncio" });
    assert.ok(post.includes("🪪Cupom: Compre R$299,90 e ganhe 15% OFF (ative no anúncio)"));
    assert.ok(!post.includes("ativar no anúncio"));
  });
  console.log(`\n${ok}/4 testes passaram`);
} catch (e) {
  console.log("✘", e.message);
  process.exitCode = 1;
} finally {
  restaurar(fila.ARQ, bFila);
  restaurar(HIST, bHist);
  fs.rmSync(entrada, { force: true });
  fs.rmSync(process.env.FILA_DIR, { recursive: true, force: true });
}
