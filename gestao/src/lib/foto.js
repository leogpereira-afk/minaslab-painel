// Reduz a foto no próprio navegador: recorte quadrado no centro, até 360 px,
// JPEG. Fica pequena (≈20–40 KB) para caber no registro e carregar rápido.
export function reduzirFoto(arquivo, lado = 360) {
  return new Promise((resolve, reject) => {
    if (!arquivo?.type?.startsWith("image/")) { reject(new Error("Escolha uma imagem.")); return; }
    const img = new Image();
    img.onload = () => {
      const l = Math.min(lado, img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = l;
      const menor = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width - menor) / 2, (img.height - menor) / 2, menor, menor, 0, 0, l, l);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Não consegui abrir esta imagem."));
    img.src = URL.createObjectURL(arquivo);
  });
}

// Imagem de slide (print, gráfico, foto): mantém a proporção, até 1600 px no
// lado maior. Fundo branco para prints com transparência. JPEG ≈ 100–250 KB.
export function reduzirImagem(arquivo, maior = 1600) {
  return new Promise((resolve, reject) => {
    if (!arquivo?.type?.startsWith("image/")) { reject(new Error("Escolha uma imagem.")); return; }
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, maior / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * f);
      c.height = Math.round(img.height * f);
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Não consegui abrir esta imagem."));
    img.src = URL.createObjectURL(arquivo);
  });
}
