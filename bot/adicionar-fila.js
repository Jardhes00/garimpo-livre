// Coloca ofertas na fila do bot.
// Uso: node adicionar-fila.js ofertas.json
// ofertas.json = lista de ofertas, cada uma assim (campos com ? são opcionais):
// {
//   "nome": "Tênis Casual Kappa Zenit Masculino",
//   "preco": 89.99,            "precoDe"?: 229.99,     "pix"?: true,
//   "parcelas"?: "3x de R$ 30,00 sem juros",           "extra"?: "R$ 20 OFF com cupom no anúncio",
//   "frete": true,             "relampago"?: false,
//   "link": "https://meli.la/xxxxxx",                    (link de AFILIADO)
//   "anuncio": "https://www.mercadolivre.com.br/.../p/MLB123",   (link normal do anúncio)
//   "foto": "https://http2.mlstatic.com/D_Q_NP_2X_...webp"       (foto do anúncio)
// }
const fs = require("fs");
const path = require("path");
const fila = require("./fila");
const { categoriaDoNome, fotoGrande } = require("./cartao");
const { carimbar } = require("./marca");

async function baixar(url, destino) {
  for (const u of [fotoGrande(url), url].filter(Boolean)) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": "garimpo-livre-bot" } });
      const tipo = (r.headers.get("content-type") || "").split(";")[0];
      if (!r.ok || !tipo.startsWith("image/")) continue;
      const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[tipo] || "jpg";
      const arq = `${destino}.${ext}`;
      fs.writeFileSync(arq, Buffer.from(await r.arrayBuffer()));
      return arq;
    } catch (e) {}
  }
  return null;
}

(async () => {
  const entrada = process.argv[2];
  if (!entrada) { console.log("Uso: node adicionar-fila.js ofertas.json"); process.exit(1); }
  const lista = JSON.parse(fs.readFileSync(entrada, "utf8"));
  const atual = fila.ler();
  const naFila = new Set(atual.map(i => i.id));
  fs.mkdirSync(fila.PASTA_FOTOS, { recursive: true });
  const res = { adicionadas: [], puladas: [] };

  for (const o of Array.isArray(lista) ? lista : [lista]) {
    const nome = String(o.nome || "").trim();
    if (!nome || typeof o.preco !== "number" || !/^https:\/\/meli\.la\/\w+/.test(o.link || "")) {
      res.puladas.push({ nome, motivo: "faltou nome, preço (número) ou link meli.la" }); continue;
    }
    const id = fila.idDoLink(o.anuncio || o.link);
    if (naFila.has(id)) { res.puladas.push({ nome, motivo: "já está na fila" }); continue; }
    if (fila.jaPostado(id)) { res.puladas.push({ nome, motivo: "já foi postado antes (não repete)" }); continue; }

    const categoria = o.categoria || categoriaDoNome(nome);
    const oferta = { nome, categoria, preco: o.preco, link: o.link, frete: Boolean(o.frete), afiliado: true };
    if (o.anuncio) oferta.anuncio = o.anuncio;
    if (typeof o.precoDe === "number" && o.precoDe > o.preco) oferta.precoDe = o.precoDe;
    if (o.pix) oferta.pix = true;
    if (o.parcelas) oferta.parcelas = String(o.parcelas).trim();
    if (o.extra) oferta.extra = String(o.extra).trim();
    if (o.cupom) oferta.cupom = String(o.cupom).trim(); // código do cupom, se o anúncio mostrar um
    if (o.cupomAnuncio) oferta.cupomAnuncio = String(o.cupomAnuncio).replace(/\s+/g, " ").trim(); // cupom da página do produto, com a regra
    if (o.relampago) oferta.relampago = true;

    const baixada = o.foto ? await baixar(o.foto, path.join(fila.PASTA_FOTOS, id.replace(/[^\w-]/g, ""))) : null;
    const foto = baixada ? await carimbar(baixada) : null; // logo do Garimpo Livre no canto
    atual.push({ id, oferta, foto, adicionadoEm: new Date().toISOString() });
    naFila.add(id);
    res.adicionadas.push({ nome, foto: Boolean(foto) });
  }
  fila.gravar(atual);
  res.totalNaFila = atual.length;
  console.log(JSON.stringify(res, null, 2));
})().catch(e => { console.error("Erro:", e.message); process.exit(1); });
