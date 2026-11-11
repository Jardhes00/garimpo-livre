// Postador: pega as ofertas da fila (fila.json) e posta no grupo, uma por vez, com intervalo.
// Quem enche a fila é a tarefa agendada do Claude (11h45 e 18h45), via adicionar-fila.js.
const fs = require("fs");
const { MessageMedia } = require("whatsapp-web.js");
const fila = require("./fila");
const { montarPost } = require("./post");

const sorteio = ([min, max]) => (min + Math.random() * (max - min)) * 60000;
const minutosDoDia = hhmm => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function iniciarPostador({ client, grupoId, cfg, store, log, avisar, teste = false }) {
  const p = cfg.postagem || {};
  const intervalo = teste ? [0.3, 0.5] : (p.intervaloMinutos || [3, 6]);
  const [ini, fim] = p.janela || ["08:00", "22:30"]; // nunca posta de madrugada
  let ocupado = false, liberadoEm = 0, avisouFora = false;

  async function tick() {
    if (ocupado || Date.now() < liberadoEm) return;
    const agora = new Date().toLocaleTimeString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 5);
    const dentro = minutosDoDia(agora) >= minutosDoDia(ini) && minutosDoDia(agora) <= minutosDoDia(fim);
    if (!teste && !dentro) {
      if (!avisouFora && fila.ler().length) { log(`Há ofertas na fila, mas fora do horário de postagem (${ini}–${fim}). Elas saem quando abrir.`); avisouFora = true; }
      return;
    }
    avisouFora = false;
    const item = fila.proximo();
    if (!item) return;
    ocupado = true;
    try {
      const legenda = montarPost(item.oferta, { canal: cfg.canal });
      let media = null;
      if (item.foto && fs.existsSync(item.foto)) media = MessageMedia.fromFilePath(item.foto);
      if (media) await client.sendMessage(grupoId, media, { caption: legenda });
      else await client.sendMessage(grupoId, legenda);

      store.salvar(item.oferta, { media, autor: "bot" });
      store.agendarPublicacao(); // manda para o site no ar (GitHub) junto com os próximos posts
      fila.marcarPostado(item.id);
      if (item.foto) { try { fs.unlinkSync(item.foto); } catch (e) {} }
      const resto = fila.ler().length;
      log(`📤 Postada: ${item.oferta.nome.slice(0, 60)} — R$ ${item.oferta.preco.toFixed(2).replace(".", ",")}${media ? "" : " (sem foto)"} · ${resto} na fila`);
      liberadoEm = Date.now() + sorteio(intervalo);
    } catch (e) {
      item.tentativas = (item.tentativas || 0) + 1;
      log(`⚠️ Não consegui postar "${item.oferta.nome.slice(0, 50)}": ${(e && e.message) || e}`);
      if (item.tentativas < 3) { fila.devolver(item); liberadoEm = Date.now() + 60000; }
      else { log("   Desisti dessa oferta depois de 3 tentativas."); await avisar(`⚠️ Garimpo Livre: não consegui postar "${item.oferta.nome}" no grupo. Erro: ${(e && e.message) || e}`); }
    } finally {
      ocupado = false;
    }
  }

  const n = fila.ler().length;
  log(`📮 Postador ligado${teste ? " (MODO TESTE: intervalo curto, qualquer horário)" : ""}. ${n} oferta(s) na fila. Intervalo entre posts: ${intervalo[0]}–${intervalo[1]} min.`);
  setInterval(tick, 15000);
  tick();
}

module.exports = { iniciarPostador };
