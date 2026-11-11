// Guarda as ofertas no ofertas.json do site, salva as fotos e publica (git push).
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD

function criarStore(cfg, log) {
  const pastaSite = path.resolve(__dirname, cfg.pastaSite || "..");
  const arquivo = path.join(pastaSite, "ofertas.json");
  const pastaImg = path.join(pastaSite, "img");

  function ler() {
    try { return JSON.parse(fs.readFileSync(arquivo, "utf8")); }
    catch (e) { return { atualizado: hojeSP(), ofertas: [] }; }
  }
  function gravar(dados) {
    dados.atualizado = new Date().toISOString();
    const tmp = arquivo + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(dados, null, 2) + "\n");
    fs.renameSync(tmp, arquivo); // grava inteiro de uma vez, o site nunca lê arquivo pela metade
  }
  // id estável a partir do link: meli.la/AbC123 -> AbC123 ; mercadolivre .../MLB123 -> MLB123
  function idDoLink(link) {
    const mlb = link.match(/MLB-?\d+/i);
    if (mlb) return mlb[0].replace("-", "").toUpperCase();
    return link.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop();
  }
  function apagarFoto(o) {
    if (o.imagem && o.imagem.startsWith("img/wa-")) {
      try { fs.unlinkSync(path.join(pastaSite, o.imagem)); } catch (e) {}
    }
  }
  function salvarFoto(id, media) {
    if (!media || !media.data || !/^image\//.test(media.mimetype || "")) return null;
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[media.mimetype] || "jpg";
    fs.mkdirSync(pastaImg, { recursive: true });
    const nome = `wa-${id.replace(/[^\w-]/g, "")}.${ext}`;
    fs.writeFileSync(path.join(pastaImg, nome), Buffer.from(media.data, "base64"));
    return `img/${nome}`;
  }
  // remove ofertas mais velhas que cfg.diasNoArquivo
  function limpar(dados) {
    const limite = Date.now() - (cfg.diasNoArquivo || 7) * 864e5;
    const antes = dados.ofertas.length;
    dados.ofertas = dados.ofertas.filter(o => {
      const t = new Date(o.postado || (o.conferido + "T12:00:00-03:00")).getTime();
      const fica = !(t < limite);
      if (!fica) apagarFoto(o);
      return fica;
    });
    return antes - dados.ofertas.length;
  }

  function salvar(oferta, { media, autor } = {}) {
    const dados = ler();
    const id = idDoLink(oferta.link);
    const anterior = dados.ofertas.find(o => o.id === id);
    const nova = { id, ...oferta, postado: new Date().toISOString(), conferido: hojeSP(), origem: "grupo" };
    if (autor) nova.autor = autor;
    const foto = salvarFoto(id, media);
    if (foto) nova.imagem = foto;
    else if (anterior && anterior.imagem) nova.imagem = anterior.imagem; // repost sem foto mantém a antiga
    if (nova.destaque) dados.ofertas.forEach(o => delete o.destaque);
    dados.ofertas = [nova, ...dados.ofertas.filter(o => o.id !== id)]; // mais nova primeiro
    const removidas = limpar(dados);
    gravar(dados);
    return { id, atualizou: Boolean(anterior), removidas, total: dados.ofertas.length };
  }

  // apaga do site as ofertas vencidas mesmo quando não chega nada novo (chamado de hora em hora)
  function limparVencidas() {
    const dados = ler();
    const removidas = limpar(dados);
    if (removidas) { gravar(dados); agendarPublicacao(); }
    return removidas;
  }

  function remover(link) {
    const dados = ler();
    const id = idDoLink(link);
    const alvo = dados.ofertas.find(o => o.id === id);
    if (!alvo) return false;
    apagarFoto(alvo);
    dados.ofertas = dados.ofertas.filter(o => o.id !== id);
    gravar(dados);
    return true;
  }

  // ---- publicação: junta vários posts seguidos num envio só ----
  let timer = null, pendentes = 0;
  const git = args => new Promise((ok, falha) =>
    execFile("git", args, { cwd: pastaSite, windowsHide: true }, (err, stdout, stderr) =>
      err ? falha(new Error((stderr || err.message).trim())) : ok(stdout.trim())));

  async function publicarAgora() {
    const n = pendentes; pendentes = 0; timer = null;
    if (!cfg.git || !cfg.git.ativo) { log(`💾 ofertas.json atualizado (${n} mudança(s)). Publicação automática desligada.`); return; }
    try {
      await git(["add", "ofertas.json", "img"]);
      const status = await git(["status", "--porcelain", "--", "ofertas.json", "img"]);
      if (!status) { log("Nada novo para publicar."); return; }
      await git(["commit", "-m", `Ofertas do grupo: ${n} atualização(ões)`]);
      await git(["push"]);
      log(`🚀 Site publicado (${n} atualização(ões)). Deve aparecer em 1 a 2 minutos.`);
    } catch (e) {
      log(`⚠️ Não consegui publicar no GitHub: ${e.message}`);
      log("   As ofertas estão salvas no computador; tento de novo na próxima oferta.");
      pendentes += n;
    }
  }
  function agendarPublicacao() {
    pendentes++;
    clearTimeout(timer);
    timer = setTimeout(publicarAgora, ((cfg.git && cfg.git.esperarSegundos) || 60) * 1000);
  }

  return { salvar, remover, limparVencidas, agendarPublicacao, idDoLink, arquivo };
}

module.exports = { criarStore };
