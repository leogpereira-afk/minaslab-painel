// Regras puras dos anexos (Tarefas e Mensagens): tipos aceitos, tamanho, ícone e leitura do arquivo em base64.
// O servidor confere tudo de novo (tipo pelo nome do arquivo, até 8 MB); aqui é para avisar antes de enviar.

export const LIMITE_ANEXO_BYTES = 8 * 1024 * 1024;
export const EXTENSOES_ACEITAS = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "xml", "zip"];
export const ACEITAR_NO_INPUT = EXTENSOES_ACEITAS.map((e) => `.${e}`).join(",");
// No Messenger também vale áudio (mensagem de voz gravada na tela ou arquivo de áudio).
export const EXTENSOES_AUDIO = ["webm", "ogg", "m4a", "mp3", "wav"];
export const EXTENSOES_MENSAGEM = [...EXTENSOES_ACEITAS, ...EXTENSOES_AUDIO];
export const ACEITAR_NO_INPUT_MENSAGEM = EXTENSOES_MENSAGEM.map((e) => `.${e}`).join(",");
const IMAGENS = ["png", "jpg", "jpeg", "webp", "gif"];

export const extensaoDo = (nome) => { const p = String(nome || "").split("."); return p.length > 1 ? p.pop().toLowerCase() : ""; };
export const ehImagem = (nomeOuTipo) => { const t = String(nomeOuTipo || ""); return t.startsWith("image/") || IMAGENS.includes(extensaoDo(t)); };

/** "850 KB", "2,4 MB". */
export function formatarTamanho(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Texto do problema com o arquivo, ou "" se pode enviar. */
export function problemaDoArquivo(arquivo, extensoes = EXTENSOES_ACEITAS) {
  if (!arquivo) return "Escolha o arquivo.";
  const ext = extensaoDo(arquivo.name);
  if (!extensoes.includes(ext)) return `Não aceito arquivo .${ext || "sem extensão"} (${arquivo.name}). Aceitos: PDF, imagens, Word, Excel, PowerPoint, CSV, TXT, XML e ZIP.`;
  if (!arquivo.size) return `O arquivo "${arquivo.name}" está vazio.`;
  // Foto grande de celular é reduzida antes de enviar; os demais tipos não têm como reduzir.
  if (arquivo.size > LIMITE_ANEXO_BYTES && !ehImagem(arquivo.name)) return `"${arquivo.name}" passa de 8 MB. Reduza ou divida o arquivo.`;
  return "";
}

/** Família do arquivo, para escolher o ícone. */
export function familiaDoArquivo(nomeOuTipo) {
  const ext = extensaoDo(nomeOuTipo) || String(nomeOuTipo || "").split("/").pop();
  if (ehImagem(nomeOuTipo)) return "imagem";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "planilha";
  if (["doc", "docx", "txt"].includes(ext)) return "documento";
  if (["ppt", "pptx"].includes(ext)) return "apresentacao";
  if (ext === "zip") return "compactado";
  if (EXTENSOES_AUDIO.includes(ext) || String(nomeOuTipo || "").startsWith("audio/")) return "audio";
  return "arquivo";
}

/** Lado maior de uma imagem reduzida para caber no limite (mantém a proporção; nunca amplia). */
export const ladoReduzido = (w, h, max = 2000) => { const m = Math.max(w, h); if (m <= max) return { w, h }; const f = max / m; return { w: Math.round(w * f), h: Math.round(h * f) }; };

/** Lê o arquivo como base64. Imagem grande (PNG/JPG/WEBP > 1,5 MB) vira JPEG de até 2000 px — foto de celular cabe fácil. */
export async function lerArquivoParaEnvio(arquivo) {
  const ext = extensaoDo(arquivo.name);
  if (["png", "jpg", "jpeg", "webp"].includes(ext) && arquivo.size > 1.5 * 1024 * 1024) {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok, falha) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => falha(new Error(`Não consegui ler a imagem "${arquivo.name}".`)); im.src = url; });
      const { w, h } = ladoReduzido(img.naturalWidth, img.naturalHeight);
      const tela = document.createElement("canvas"); tela.width = w; tela.height = h;
      const ctx = tela.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      const base64 = tela.toDataURL("image/jpeg", 0.85).split(",")[1];
      return { nome: arquivo.name.replace(/\.[^.]+$/, "") + ".jpg", base64 };
    } finally { URL.revokeObjectURL(url); }
  }
  const base64 = await new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = () => falha(new Error(`Não consegui ler "${arquivo.name}".`));
    r.readAsDataURL(arquivo);
  });
  return { nome: arquivo.name, base64 };
}
