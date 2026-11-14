/* ===== CONFIGURAÇÃO: troque aqui ===== */
const CONFIG = {
  canal: "https://whatsapp.com/channel/0029Vb9VSeT72WTwAyTD8Y3t",
  grupo: "" // cole o link do grupo quando tiver; vazio = botão "em breve"
};

/* ===== OFERTAS =====
   As ofertas ficam no arquivo ofertas.json, ao lado desta página.
   O bot do WhatsApp atualiza esse arquivo; você também pode editar à mão.
   DIAS_NO_SITE: ofertas postadas há mais tempo que isso somem da vitrine. */
const DIAS_NO_SITE = 2;
let OFERTAS = [];

/* ===== daqui pra baixo, não precisa mexer ===== */
const $ = s => document.querySelector(s);
const brl = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/* desconto arredondado para baixo, igual ao que o Mercado Livre mostra */
const desc = o => o.precoDe && o.precoDe > o.preco ? Math.floor((1 - o.preco / o.precoDe) * 100) : 0;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dia = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
/* segurança: só aceita links do Mercado Livre (https) e fotos do próprio site ou do Mercado Livre */
const HOSTS_LINK = /^(meli\.la|([\w-]+\.)*mercadolivre\.com(\.br)?|([\w-]+\.)*mercadolibre\.com)$/i;
function linkSeguro(u) {
  try { const x = new URL(u); return x.protocol === "https:" && HOSTS_LINK.test(x.hostname) ? x.href : ""; } catch (e) { return ""; }
}
function imagemSegura(u) {
  if (/^img\/[\w.-]+\.(jpe?g|png|webp)$/i.test(u || "")) return u;
  try { const x = new URL(u); return x.protocol === "https:" && x.hostname === "http2.mlstatic.com" ? x.href : ""; } catch (e) { return ""; }
}
/* "há 3h" para ofertas vindas do grupo; "conferido 10/11" para as cadastradas à mão */
function quando(o) {
  if (!o.postado) return o.conferido ? "conferido " + dia(o.conferido) : "";
  const h = Math.max(0, Math.floor((Date.now() - new Date(o.postado)) / 36e5));
  if (h < 1) return "agora há pouco";
  if (h < 24) return `há ${h}h`;
  return Math.floor(h / 24) === 1 ? "ontem" : `há ${Math.floor(h / 24)} dias`;
}
const ph = o =>`<span class="ph" aria-hidden="true">${o.emoji || "🛍️"}</span>`;
function thumb(o) {
  if (o.imagem) return `<div class="thumb"><img src="${esc(o.imagem)}" width="400" height="300" alt="${esc(o.nome)}" loading="lazy" referrerpolicy="no-referrer" data-emoji="${esc(o.emoji || "🛍️")}"></div>`;
  return `<div class="thumb">${ph(o)}</div>`;
}
/* se a foto não carregar, mostra o ícone da categoria */
document.addEventListener("error", e => {
  const img = e.target;
  if (img.tagName !== "IMG" || !img.dataset.emoji) return;
  img.parentNode.innerHTML = `<span class="ph" aria-hidden="true">${img.dataset.emoji}</span>`;
}, true);
function priceHTML(o) {
  const d = desc(o);
  const [reais, cent] = o.preco.toFixed(2).split(".");
  return `<div class="price">
    ${d ? `<div class="de">de <s>${brl(o.precoDe)}</s><span class="off">−${d}%</span></div>` : ""}
    <div class="por"><small>R$</small>${Number(reais).toLocaleString("pt-BR")},${cent}${o.pix ? `<span class="pix">no Pix</span>` : ""}</div>
  </div>
  <div class="meta">${o.parcelas ? `<span>${esc(o.parcelas)}</span>` : ""}${o.extra ? `<span class="extra">${esc(o.extra)}</span>` : ""}${o.frete ? `<span class="frete">Frete grátis</span>` : ""}</div>`;
}
function postWhats(o) {
  const d = desc(o);
  const linhas = [
    o.relampago ? "⚡ OFERTA RELÂMPAGO!" : d >= 40 ? "🔥 BAIXOU BASTANTE!" : o.preco < 50 ? "💡 ACHADINHO ABAIXO DE R$ 50" : "🔥 OFERTA DO DIA!",
    "", `*${o.nome}*`, "",
    (d ? `💰 De ~${brl(o.precoDe)}~ por *${brl(o.preco)}*` : `💰 Por *${brl(o.preco)}*`) + (o.pix ? " no Pix" : "")
  ];
  if (o.parcelas) linhas.push(`💳 ${o.parcelas}`);
  if (o.extra) linhas.push(`🎟️ ${o.extra}`);
  if (o.frete) linhas.push("🚚 Frete grátis");
  linhas.push("", "⭐️ Anúncio | Mercado Livre", `🔗 ${o.link}`, "", "📢 Siga o Canal e receba mais achados:", `🔗 ${CONFIG.canal}`);
  return linhas.join("\n");
}

let cat = "Todas";
const admin = () => location.hash === "#admin";
try { const c = localStorage.getItem("gl-cat"); if (c) cat = c; } catch (e) {}

function renderDestaque() {
  /* destaque: a marcada com "destaque" (ou #destaque no post); se não houver, a de maior desconto */
  const o = OFERTAS.find(x => x.destaque) || [...OFERTAS].sort((a, b) => desc(b) - desc(a))[0];
  if (!o) return;
  $("#destaque").innerHTML = `<article class="tag">
    <span class="tag-label">Pepita do dia</span>
    ${thumb(o)}
    <h3>${esc(o.nome)}</h3>
    ${priceHTML(o)}
    <a class="btn buy buy-destaque" href="${esc(o.link)}" target="_blank" rel="noopener sponsored">Ver no Mercado Livre ↗</a>
  </article>`;
}
function renderChips() {
  const cats = ["Todas", ...new Set(OFERTAS.map(o => o.categoria))];
  if (!cats.includes(cat)) cat = "Todas";
  $("#chips").innerHTML = cats.map(c => `<button class="chip" type="button" aria-pressed="${c === cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}
function render() {
  const q = $("#busca").value.trim().toLowerCase();
  const ord = $("#ordem").value;
  let lista = OFERTAS.filter(o => (cat === "Todas" || o.categoria === cat) && (!q || o.nome.toLowerCase().includes(q)));
  lista.sort((a, b) => ord === "menor" ? a.preco - b.preco : ord === "desconto" ? desc(b) - desc(a) : OFERTAS.indexOf(a) - OFERTAS.indexOf(b));
  $("#grid").innerHTML = lista.map((o, i) => `<article class="card">
    ${thumb(o)}
    <div class="card-top"><span class="cat">${esc(o.categoria)}${o.relampago ? ' · <span class="relampago">⚡ relâmpago</span>' : ""}</span><span>${quando(o)}</span></div>
    <h3>${esc(o.nome)}</h3>
    ${priceHTML(o)}
    <div class="spacer"></div>
    <a class="btn buy btn-sm" href="${esc(o.link)}" target="_blank" rel="noopener sponsored">Ver no Mercado Livre ↗</a>
    <div class="anuncio">Anúncio · link de afiliado</div>
    ${admin() ? `<button class="btn copy btn-sm" type="button" data-i="${OFERTAS.indexOf(o)}">Copiar post p/ WhatsApp</button>${o.afiliado ? "" : '<div class="aviso">⚠️ Link comum. Troque pelo seu link de afiliado.</div>'}` : ""}
  </article>`).join("");
  $("#empty").hidden = lista.length > 0;
  $("#empty").textContent = OFERTAS.length
    ? "Nenhuma oferta encontrada com esse filtro. Tente outra categoria ou limpe a busca."
    : "As ofertas novas chegam todo dia ao meio-dia. Siga o Canal para receber na hora.";
  const n = lista.length;
  $("#count").textContent = `${n} ${n === 1 ? "oferta" : "ofertas"}${cat !== "Todas" ? ` em ${cat}` : ""} · confira o preço final no Mercado Livre`;
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

$("#chips").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  cat = b.dataset.cat;
  try { localStorage.setItem("gl-cat", cat); } catch (err) {}
  renderChips(); render();
});
$("#busca").addEventListener("input", render);
$("#ordem").addEventListener("change", render);
$("#grid").addEventListener("click", e => {
  const b = e.target.closest(".copy"); if (!b) return;
  const txt = postWhats(OFERTAS[+b.dataset.i]);
  const ok = () => toast("Post copiado. É só colar no WhatsApp.");
  const fallback = () => {
    const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
    let done = false; try { done = document.execCommand("copy"); } catch (err) {}
    ta.remove(); toast(done ? "Post copiado. É só colar no WhatsApp." : "Não deu para copiar automaticamente neste navegador.");
  };
  try { navigator.clipboard.writeText(txt).then(ok, fallback); } catch (err) { fallback(); }
});
window.addEventListener("hashchange", render);

["#cta-canal", "#cta-canal-top", "#cta-canal-band"].forEach(id => $(id).href = CONFIG.canal);
const g = $("#cta-grupo");
if (CONFIG.grupo) { g.href = CONFIG.grupo; }
else { g.removeAttribute("href"); g.setAttribute("aria-disabled", "true"); g.textContent = "Grupo · em breve"; }

/* carrega ofertas.json; mostra só as das últimas 48 horas */
async function iniciar() {
  try {
    const r = await fetch("ofertas.json?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const dados = await r.json();
    const todas = (dados.ofertas || [])
      .filter(o => o && typeof o.nome === "string" && typeof o.preco === "number" && isFinite(o.preco))
      .map(o => ({ ...o, link: linkSeguro(o.link), imagem: imagemSegura(o.imagem), precoDe: typeof o.precoDe === "number" ? o.precoDe : 0, categoria: String(o.categoria || "Diversos") }))
      .filter(o => o.link);
    const limite = Date.now() - DIAS_NO_SITE * 864e5;
    const recentes = todas.filter(o => new Date(o.postado || o.conferido + "T12:00:00-03:00").getTime() >= limite);
    OFERTAS = recentes;
  } catch (err) {
    $("#count").textContent = "Não foi possível carregar as ofertas agora. Tente atualizar a página.";
    return;
  }
  renderDestaque(); renderChips(); render();
}
iniciar();
