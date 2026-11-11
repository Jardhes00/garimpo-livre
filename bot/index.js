// Bot do Garimpo Livre.
// 1) GARIMPO: nos horários do config.json, busca ofertas no Mercado Livre, gera o link de afiliado e posta no grupo.
// 2) LEITURA: quando você ou seu parceiro postam uma oferta no grupo, ela também vai para o site.
// Teste rápido: npm run testar  (faz uma rodada agora com 2 ofertas)
const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { parsePost, linkDoProduto } = require("./parser");
const { criarStore } = require("./store");
const { iniciarPostador } = require("./garimpeiro");

const hora = () => new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
// mostra na janela e grava em bot.log (para conferir depois)
const arqLog = path.join(__dirname, "bot.log");
const log = (...a) => {
  console.log(`[${hora()}]`, ...a);
  try {
    const dia = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    fs.appendFileSync(arqLog, `[${dia} ${hora()}] ${a.map(x => (typeof x === "string" ? x : String(x))).join(" ")}\n`);
  } catch (e) {}
};

// ---- configuração ----
const arqConfig = path.join(__dirname, "config.json");
if (!fs.existsSync(arqConfig)) {
  console.log("Falta o arquivo config.json. Copie config.example.json para config.json e preencha (veja o LEIA-ME).");
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(arqConfig, "utf8"));
const soDigitos = s => String(s || "").replace(/\D/g, "");
const autorizados = (cfg.autorizados || []).map(String);
const modoDescoberta = autorizados.length === 0;

// ---- estado: última mensagem lida, para recuperar posts feitos com o bot desligado ----
const arqEstado = path.join(__dirname, "estado.json");
let estado = { ultimo: 0 };
try { estado = JSON.parse(fs.readFileSync(arqEstado, "utf8")); } catch (e) {}
const marcarLida = ts => { if (ts > (estado.ultimo || 0)) { estado.ultimo = ts; fs.writeFileSync(arqEstado, JSON.stringify(estado)); } };

const store = criarStore(cfg, log);
let grupoId = null;
let ehCanal = false;

// "numeroBot" no config.json (ex.: "5511999999999") = conectar por código em vez de QR
const numeroBot = soDigitos(cfg.numeroBot);
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, ".sessao") }),
  ...(numeroBot ? { pairWithPhoneNumber: { phoneNumber: numeroBot, showNotification: true, intervalMs: 180000 } } : {}),
  puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
});

// o QR também é salvo como imagem grande (qr.png), mais fácil de escanear que o da tela
const arqQR = path.join(__dirname, "qr.png");
client.on("qr", qr => {
  log("Escaneie este QR Code com o celular DO BOT: WhatsApp > Aparelhos conectados > Conectar aparelho");
  qrcode.generate(qr, { small: true });
  require("qrcode").toFile(arqQR, qr, { width: 640, margin: 3 })
    .then(() => log(`QR também salvo como imagem: ${arqQR}`))
    .catch(() => {});
});
client.on("code", codigo => {
  const bonito = String(codigo).replace(/^(.{4})(.{4})$/, "$1-$2");
  console.log("\n==============================================");
  console.log(`   CÓDIGO PARA CONECTAR:   ${bonito}`);
  console.log("==============================================");
  log(`No celular do número ${numeroBot}: WhatsApp > ⋮ > Aparelhos conectados > Conectar um aparelho >`);
  log('"Conectar com número de telefone" e digite o código acima. Ele vale por 3 minutos; depois sai um novo.\n');
  try { fs.writeFileSync(path.join(__dirname, "codigo.txt"), `${bonito}\n`); } catch (e) {}
});
client.on("authenticated", () => {
  try { fs.unlinkSync(path.join(__dirname, "codigo.txt")); } catch (e) {}
  log("Conectado ao WhatsApp.");
  try { fs.unlinkSync(arqQR); } catch (e) {}
});
client.on("auth_failure", m => log("⚠️ Falha no login:", m, "- apague a pasta .sessao e escaneie o QR de novo."));

// logo depois de conectar o WhatsApp ainda está sincronizando; tenta de novo algumas vezes
async function comPaciencia(nome, fn, tentativas = 8) {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      if (i >= tentativas) throw e;
      log(`WhatsApp ainda sincronizando (${nome}); tentando de novo em 15s... (${i}/${tentativas - 1})`);
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

client.on("ready", async () => {
  try { await aoConectar(); }
  catch (e) { log("⚠️ Não consegui ler as conversas do WhatsApp:", e.message || e, "- feche o bot e ligue de novo."); }
});

async function aoConectar() {
  // id direto no config (ex.: "1203630...@g.us"): usa sem procurar
  if (/@g\.us$/.test(String(cfg.grupo))) {
    grupoId = cfg.grupo; ehCanal = false;
    log(`✅ Usando o grupo de id ${grupoId}.`);
    iniciarAgenda();
    return;
  }
  // o destino pode ser um GRUPO ou um CANAL do WhatsApp (campo "grupo" do config.json)
  const bate = c => c.id._serialized === cfg.grupo || (c.name || "").trim().toLowerCase() === String(cfg.grupo).trim().toLowerCase();
  // procura primeiro nos Canais; a lista de conversas (grupos) só é lida se precisar
  let canais = [], grupos = [];
  try { canais = await comPaciencia("canais", () => client.getChannels(), 4); }
  catch (e) { log("Não consegui listar os Canais:", (e && e.message) || e); }
  let alvo = canais.find(bate);
  // não achou pelo nome: procura o Canal pelo link de convite do config ("canal")
  const convite = (String(cfg.canal || "").match(/channel\/([\w-]+)/) || [])[1];
  if (!alvo && convite) {
    try {
      const ch = await comPaciencia("link do Canal", () => client.getChannelByInviteCode(convite), 3);
      if (ch && bate(ch)) {
        const segue = canais.some(c => c.id._serialized === ch.id._serialized);
        if (!segue) {
          // seguir o Canal facilita o dono convidar o bot como administrador
          try { await client.subscribeToChannel(ch.id._serialized); log(`O número do bot passou a seguir o Canal "${ch.name}".`); }
          catch (e) { log("Não consegui seguir o Canal automaticamente:", (e && e.message) || e); }
          log(`⚠️ Falta tornar o número do bot ADMINISTRADOR do Canal "${ch.name}".`);
          log("   No SEU celular (dono do Canal): abra o Canal > toque no nome > Administradores > Convidar administrador > escolha o número do bot.");
          log("   No celular do BOT: aceite o convite. Depois feche o bot (Ctrl+C) e ligue de novo.");
          return;
        }
        alvo = ch;
      }
    } catch (e) { log("Não consegui achar o Canal pelo link:", (e && e.message) || e); }
  }
  if (!alvo) {
    try { grupos = (await comPaciencia("conversas", () => client.getChats(), 4)).filter(c => c.isGroup); }
    catch (e) { log("Não consegui listar os grupos:", (e && e.message) || e); }
    alvo = grupos.find(bate);
  }
  if (!alvo) {
    log(`⚠️ Não achei o grupo ou Canal "${cfg.grupo}". Onde o número do bot está:`);
    canais.forEach(c => console.log(`   - [Canal] ${c.name}${c.isReadOnly ? "  (o bot só segue, NÃO é administrador)" : "  (administrador)"}`));
    grupos.forEach(g => console.log(`   - [Grupo] ${g.name}`));
    // plano B: acha o grupo pela primeira mensagem que chegar nele
    aguardandoGrupo = true;
    log(`👉 Mande qualquer mensagem no grupo "${cfg.grupo}" (de outro celular, não do bot). O bot reconhece o grupo por ela.`);
    return;
  }
  grupoId = alvo.id._serialized;
  ehCanal = Boolean(alvo.isChannel || /@newsletter$/.test(grupoId));
  if (ehCanal && alvo.isReadOnly) {
    log(`⚠️ O número do bot segue o Canal "${alvo.name}", mas NÃO é administrador, então não consegue postar.`);
    log("   No celular dono do Canal: abra o Canal > toque no nome > Administradores > Convidar administrador > escolha o número do bot.");
    log("   No celular do bot: aceite o convite que chegar. Depois reinicie o bot.");
    return;
  }
  log(`✅ Conectado ao ${ehCanal ? "Canal" : "grupo"} "${alvo.name}"${ehCanal ? " como administrador" : ""}.`);
  iniciarAgenda();
  if (modoDescoberta && !ehCanal) {
    log("🔎 MODO DESCOBERTA: a lista de autorizados está vazia, então nada vai para o site ainda.");
    log("   Mande uma mensagem qualquer no grupo (você e seu parceiro) e copie o id que aparecer aqui.");
    return;
  }
  // recupera posts feitos enquanto o bot estava desligado
  if (estado.ultimo) {
    try {
      const msgs = await alvo.fetchMessages({ limit: cfg.recuperarUltimas || 60 });
      const novas = msgs.filter(m => m.timestamp > estado.ultimo);
      if (novas.length) log(`Recuperando ${novas.length} mensagem(ns) enviadas com o bot desligado...`);
      for (const m of novas) await tratar(m);
    } catch (e) { log("Não consegui reler as mensagens antigas (sem problema, segue normal)."); }
  } else {
    marcarLida(Math.floor(Date.now() / 1000));
  }
}

// um erro inesperado não derruba o bot inteiro
process.on("unhandledRejection", e => log("⚠️ Erro inesperado:", (e && e.message) || e));

async function quemMandou(msg) {
  const ids = new Set();
  if (msg.author) ids.add(msg.author);
  try {
    const c = await msg.getContact();
    if (c && c.id) ids.add(c.id._serialized);
    if (c && c.number) ids.add(c.number);
    return { ids: [...ids], nome: (c && (c.pushname || c.name)) || msg.author || "?" };
  } catch (e) { return { ids: [...ids], nome: msg.author || "?" }; }
}
function ehAutorizado(ids) {
  return ids.some(id => autorizados.some(a => a === id || (soDigitos(a).length >= 8 && soDigitos(a) === soDigitos(id))));
}

let aguardandoGrupo = false;
async function reconhecerGrupo(msg) {
  if (!/@g\.us$/.test(msg.from)) return;
  let nome = null;
  try { nome = (await msg.getChat()).name; } catch (e) {}
  const alvo = String(cfg.grupo).trim().toLowerCase();
  if (nome && nome.trim().toLowerCase() === alvo) {
    aguardandoGrupo = false;
    grupoId = msg.from; ehCanal = false;
    log(`✅ Grupo "${nome}" reconhecido (id ${grupoId}).`);
    // salva o id no config.json para não precisar disso da próxima vez
    try {
      const c = JSON.parse(fs.readFileSync(arqConfig, "utf8"));
      c.grupo = grupoId; fs.writeFileSync(arqConfig, JSON.stringify(c, null, 2) + "\n");
      log('   Id salvo em "grupo" no config.json.');
    } catch (e) {}
    iniciarAgenda();
  } else {
    log(`Mensagem de um grupo${nome ? ` ("${nome}")` : ""} com id ${msg.from}. Se esse for o "${cfg.grupo}", coloque esse id em "grupo" no config.json e reinicie.`);
  }
}

async function tratar(msg) {
  if (aguardandoGrupo && !grupoId) return reconhecerGrupo(msg);
  try {
    if (!grupoId || msg.from !== grupoId || msg.fromMe) return;
    marcarLida(msg.timestamp);
    // num Canal só administradores postam, então todo post vale; num grupo, só os autorizados
    const { ids, nome } = ehCanal ? { ids: [], nome: "admin do Canal" } : await quemMandou(msg);

    if (!ehCanal && modoDescoberta) {
      log(`📋 Mensagem de ${nome}. Copie para "autorizados": ${ids.map(i => JSON.stringify(i)).join("  ou  ")}`);
      return;
    }
    if (!ehCanal && !ehAutorizado(ids)) return; // mensagens de outras pessoas são ignoradas

    const texto = msg.body || "";
    if (/#remover\b/i.test(texto)) {
      const link = linkDoProduto(texto);
      if (link && store.remover(link)) { log(`🗑️ Oferta removida do site: ${link}`); store.agendarPublicacao(); }
      else log(`#remover: não achei essa oferta no site (${link || "sem link"}).`);
      return;
    }

    const r = parsePost(texto);
    if (!r.ok) {
      if (linkDoProduto(texto)) log(`⚠️ Post de ${nome} NÃO entrou no site: ${r.motivo}.\n   Início do texto: "${texto.slice(0, 80).replace(/\n/g, " ")}"`);
      return;
    }

    let media = null;
    if (msg.hasMedia && msg.type === "image") {
      try { media = await msg.downloadMedia(); } catch (e) { log("Não consegui baixar a foto; a oferta entra com ícone."); }
    }
    const res = store.salvar(r.oferta, { media, autor: nome });
    log(`${res.atualizou ? "🔄 Atualizada" : "🆕 Nova"}: ${r.oferta.nome} — R$ ${r.oferta.preco.toFixed(2).replace(".", ",")}${media ? " (com foto)" : " (sem foto)"} · ${res.total} no site${res.removidas ? ` · ${res.removidas} antiga(s) removida(s)` : ""}`);
    store.agendarPublicacao();
  } catch (e) {
    log("⚠️ Erro ao processar mensagem:", e.message);
  }
}

// ---- garimpo automático ----
async function avisar(texto) {
  const n = soDigitos(cfg.avisarNumero);
  if (!n) return;
  try { await client.sendMessage(`${n}@c.us`, texto); } catch (e) { log("Não consegui mandar o aviso no privado:", e.message); }
}
// posta o que estiver na fila (fila.json). --teste = intervalo curto e qualquer horário
let agendaLigada = false;
function iniciarAgenda() {
  if (agendaLigada) return;
  agendaLigada = true;
  iniciarPostador({ client, grupoId, cfg, store, log, avisar, teste: process.argv.includes("--teste") });
  // de hora em hora, tira do site as ofertas com mais de "diasNoArquivo" (48h)
  const limpeza = () => { const n = store.limparVencidas(); if (n) log(`🧹 ${n} oferta(s) com mais de 48h apagada(s) do site.`); };
  limpeza();
  setInterval(limpeza, 60 * 60 * 1000);
}

client.on("message", tratar);
client.on("disconnected", motivo => {
  log("⚠️ Desconectado do WhatsApp:", motivo, "- tentando reconectar em 15s...");
  setTimeout(() => client.initialize().catch(e => log("Falhou ao reconectar:", e.message)), 15000);
});

log("Iniciando o bot do Garimpo Livre...");
client.initialize();
