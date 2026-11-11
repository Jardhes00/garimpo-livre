// Testes de como o bot grava as ofertas. Usa uma pasta temporária; não mexe no site de verdade.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { criarStore } = require("./store");
const { parsePost } = require("./parser");

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "garimpo-teste-"));
const velha = { id: "VELHA", nome: "Oferta velha", categoria: "Casa", preco: 10, link: "https://meli.la/VELHA", postado: "2020-01-01T12:00:00Z", imagem: "img/wa-VELHA.jpg" };
fs.mkdirSync(path.join(pasta, "img"));
fs.writeFileSync(path.join(pasta, "img", "wa-VELHA.jpg"), "x");
fs.writeFileSync(path.join(pasta, "ofertas.json"), JSON.stringify({ ofertas: [velha] }));

const logs = [];
const store = criarStore({ pastaSite: pasta, diasNoArquivo: 7, git: { ativo: false } }, m => logs.push(m));
const ler = () => JSON.parse(fs.readFileSync(path.join(pasta, "ofertas.json"), "utf8")).ofertas;
const post = (nome, preco, link, extra = "") => parsePost(`*${nome}*\n💰 Por *R$ ${preco}*\n🔗 ${link}\n${extra}`).oferta;
const fotoFake = { mimetype: "image/jpeg", data: Buffer.from("foto").toString("base64") };

let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log("✔", nome); };

try {
  t("nova oferta entra no topo, com foto, e a velha (2020) sai junto com a foto", () => {
    const r = store.salvar(post("Produto A", "50,00", "https://meli.la/AAA"), { media: fotoFake, autor: "Parceiro" });
    const lista = ler();
    assert.strictEqual(r.removidas, 1);
    assert.strictEqual(lista.length, 1);
    assert.strictEqual(lista[0].id, "AAA");
    assert.strictEqual(lista[0].imagem, "img/wa-AAA.jpg");
    assert.ok(fs.existsSync(path.join(pasta, "img", "wa-AAA.jpg")));
    assert.ok(!fs.existsSync(path.join(pasta, "img", "wa-VELHA.jpg")));
    assert.strictEqual(lista[0].autor, "Parceiro");
  });
  t("segunda oferta fica na frente da primeira", () => {
    store.salvar(post("Produto B", "20,00", "https://meli.la/BBB"));
    assert.deepStrictEqual(ler().map(o => o.id), ["BBB", "AAA"]);
  });
  t("repostar o mesmo link atualiza o preço, sobe para o topo e mantém a foto", () => {
    const r = store.salvar(post("Produto A", "45,00", "https://meli.la/AAA"));
    const lista = ler();
    assert.strictEqual(r.atualizou, true);
    assert.deepStrictEqual(lista.map(o => o.id), ["AAA", "BBB"]);
    assert.strictEqual(lista[0].preco, 45);
    assert.strictEqual(lista[0].imagem, "img/wa-AAA.jpg");
  });
  t("#destaque fica só em uma oferta", () => {
    store.salvar(post("Produto C", "30,00", "https://meli.la/CCC", "#destaque"));
    store.salvar(post("Produto D", "31,00", "https://meli.la/DDD", "#destaque"));
    assert.deepStrictEqual(ler().filter(o => o.destaque).map(o => o.id), ["DDD"]);
  });
  t("#remover tira a oferta e apaga a foto", () => {
    assert.strictEqual(store.remover("https://meli.la/AAA"), true);
    assert.ok(!ler().some(o => o.id === "AAA"));
    assert.ok(!fs.existsSync(path.join(pasta, "img", "wa-AAA.jpg")));
    assert.strictEqual(store.remover("https://meli.la/NAOEXISTE"), false);
  });
  t("link comum do Mercado Livre vira id MLB", () => {
    assert.strictEqual(store.idDoLink("https://produto.mercadolivre.com.br/MLB-1473758753-kit-_JM"), "MLB1473758753");
  });
  console.log(`\n${ok}/6 testes passaram`);
} catch (e) {
  console.log("✘", e.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(pasta, { recursive: true, force: true });
}
