export function validarArquivoFoto(arquivo) {
  if (!arquivo || !['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) throw new Error('Escolha uma foto JPG, PNG ou WebP.');
  if (!arquivo.size || arquivo.size > 5 * 1024 * 1024) throw new Error('A foto deve ter até 5 MB.');
}

export function fotoValida(valor) {
  return typeof valor === 'string' && valor.length <= 150000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(valor);
}

// Miniatura privada junto da ficha: não cria link público nem envia ao selecionar.
export async function prepararFoto(arquivo) {
  validarArquivoFoto(arquivo);
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Não foi possível abrir esta imagem.')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar a foto neste navegador.');
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(img, (img.naturalWidth-lado)/2, (img.naturalHeight-lado)/2, lado, lado, 0, 0, 256, 256);
    const foto = canvas.toDataURL('image/jpeg', 0.8);
    if (!fotoValida(foto)) throw new Error('A foto ficou muito grande. Escolha outra imagem.');
    return foto;
  } finally { URL.revokeObjectURL(url); }
}
