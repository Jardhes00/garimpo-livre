// Coloca a logo do Garimpo Livre no canto inferior direito da foto do produto.
// A mesma foto vai para o WhatsApp e para o site.
// Se algo falhar, devolve a foto original (o post nunca deixa de sair por causa da logo).
const fs = require("fs");
const path = require("path");

const LOGO_ORIGINAL = path.join(__dirname, "..", "img", "logo-original.jpg");
const LOGO_REDONDA = path.join(__dirname, "marca-logo.png");
const TAMANHO = 0.18;   // logo = 18% do lado menor da foto
const MARGEM = 0.03;    // distância da borda

let sharp = null;
try { sharp = require("sharp"); } catch (e) {}

// recorta a logo em círculo (fundo transparente) uma vez só
async function logoRedonda() {
  if (fs.existsSync(LOGO_REDONDA)) return LOGO_REDONDA;
  const L = 512;
  const mascara = Buffer.from(`<svg width="${L}" height="${L}"><circle cx="${L / 2}" cy="${L / 2}" r="${L * 0.485}" fill="#fff"/></svg>`);
  await sharp(LOGO_ORIGINAL).resize(L, L)
    .composite([{ input: mascara, blend: "dest-in" }])
    .png().toFile(LOGO_REDONDA);
  return LOGO_REDONDA;
}

async function carimbar(arquivo) {
  if (!sharp || !arquivo || !fs.existsSync(arquivo) || !fs.existsSync(LOGO_ORIGINAL)) return arquivo;
  try {
    const base = sharp(fs.readFileSync(arquivo)).rotate() // lê para a memória: no Windows o arquivo aberto não pode ser regravado.flatten({ background: "#ffffff" });
    const { width, height } = await base.clone().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).toBuffer({ resolveWithObject: true }).then(r => r.info);
    const lado = Math.round(Math.min(width, height) * TAMANHO);
    const margem = Math.round(Math.min(width, height) * MARGEM);
    const logo = await sharp(await logoRedonda()).resize(lado, lado).toBuffer();
    const destino = arquivo.replace(/\.\w+$/, "") + ".jpg";
    const saida = await base.resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .composite([{ input: logo, left: width - lado - margem, top: height - lado - margem }])
      .jpeg({ quality: 88 }).toBuffer();
    fs.writeFileSync(destino, saida);
    if (destino !== arquivo) fs.unlinkSync(arquivo);
    return destino;
  } catch (e) {
    if (process.env.DEBUG_MARCA) console.error("marca:", e.message);
    return arquivo;
  }
}

module.exports = { carimbar };
