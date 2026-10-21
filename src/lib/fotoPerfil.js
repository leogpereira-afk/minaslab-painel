// Prepara a foto de perfil: recorta o quadrado do centro (ou da área escolhida) e reduz para um JPEG leve.
export const LADO_FOTO_PERFIL = 320;

/** Retângulo quadrado a recortar de uma imagem w×h. `zoom` ≥ 1 aproxima; `px`/`py` (0–1) deslocam dentro da folga. */
export function recorteQuadrado(w, h, zoom = 1, px = 0.5, py = 0.5) {
  const lado = Math.max(1, Math.min(w, h) / Math.max(1, zoom));
  const x = Math.min(Math.max(0, (w - lado) * px), w - lado);
  const y = Math.min(Math.max(0, (h - lado) * py), h - lado);
  return { x, y, lado };
}

/** Lê o arquivo escolhido e devolve { base64, previa } (JPEG 320×320). Lança Error com texto para a pessoa. */
export async function prepararFotoPerfil(arquivo, { zoom = 1, px = 0.5, py = 0.5 } = {}) {
  if (!arquivo || !/^image\/(jpeg|png|webp)$/i.test(arquivo.type)) throw new Error("Escolha uma foto JPG, PNG ou WebP.");
  if (arquivo.size > 20 * 1024 * 1024) throw new Error("Escolha uma foto de até 20 MB.");
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, falha) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => falha(new Error("Não foi possível ler a foto.")); im.src = url; });
    const { x, y, lado } = recorteQuadrado(img.naturalWidth, img.naturalHeight, zoom, px, py);
    const tela = document.createElement("canvas");
    tela.width = tela.height = LADO_FOTO_PERFIL;
    const ctx = tela.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, LADO_FOTO_PERFIL, LADO_FOTO_PERFIL);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, x, y, lado, lado, 0, 0, LADO_FOTO_PERFIL, LADO_FOTO_PERFIL);
    const previa = tela.toDataURL("image/jpeg", 0.86);
    return { base64: previa.split(",")[1], previa };
  } finally { URL.revokeObjectURL(url); }
}
