// Fila de ofertas prontas para postar (fila.json + fotos em fila-fotos/).
// Quem enche a fila: o script adicionar-fila.js (usado pela tarefa agendada do Claude).
// Quem esvazia: o postador do bot, um item por vez, com intervalo.
const fs = require("fs");
const path = require("path");
const { idDoLink } = require("./selecao");

// FILA_DIR só é usado pelos testes, para não mexer na fila de verdade
const BASE = process.env.FILA_DIR || __dirname;
const ARQ = path.join(BASE, "fila.json");
const PASTA_FOTOS = path.join(BASE, "fila-fotos");
const ARQ_HIST = path.join(BASE, "historico.json");

const ler = () => { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch (e) { return []; } };
function gravar(fila) {
  const tmp = ARQ + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(fila, null, 2));
  fs.renameSync(tmp, ARQ);
}
const lerHistorico = () => { try { return JSON.parse(fs.readFileSync(ARQ_HIST, "utf8")); } catch (e) { return {}; } };
// o histórico guarda TODO produto já postado, para nunca repetir
function marcarPostado(id) {
  const h = lerHistorico();
  h[id] = new Date().toISOString();
  fs.writeFileSync(ARQ_HIST, JSON.stringify(h, null, 2));
}
const jaPostado = id => Boolean(lerHistorico()[id]);

function proximo() {
  const fila = ler();
  const item = fila.shift();
  if (item) gravar(fila);
  return item || null;
}
function devolver(item) { gravar([item, ...ler()]); }

module.exports = { ler, gravar, proximo, devolver, marcarPostado, jaPostado, idDoLink, PASTA_FOTOS, ARQ };
