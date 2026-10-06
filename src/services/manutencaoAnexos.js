// Anexos das manutenções (nota fiscal, orçamento): envio, abertura e remoção pela função ml-manutencoes-anexos.
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

const URL_ANEXOS = `${API}/ml-manutencoes-anexos`;
export const TIPOS_ANEXO = "application/pdf,image/jpeg,image/png,image/webp";
export const LIMITE_ANEXO = 8 * 1024 * 1024;

async function chamar(corpo) {
  const r = await comCracha(URL_ANEXOS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const b = await r.json().catch(() => null);
  if (!r.ok) throw new Error(b?.erro || mensagemDoStatus(r.status));
  if (!b?.ok) throw new Error("O servidor não confirmou a operação. Tente de novo.");
  return b;
}

export const enviarAnexo = (pasta, nome, base64) => chamar({ action: "enviar", pasta, nome, base64 }).then((r) => r.anexo);
export const urlAnexo = (path) => chamar({ action: "url", path }).then((r) => r.url);
export const removerAnexo = (path) => chamar({ action: "remover", path });

export function lerArquivoBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] || "");
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

export const novaPastaAnexos = () => `p${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

// Abre o anexo numa aba nova. A aba é aberta NA HORA do clique (senão o navegador bloqueia o pop-up) e recebe o endereço depois.
export async function abrirAnexo(path) {
  const aba = window.open("", "_blank");
  try {
    const url = await urlAnexo(path);
    if (aba) { aba.opener = null; aba.location.href = url; } else { window.location.href = url; }
  } catch (e) {
    if (aba) aba.close();
    throw e;
  }
}
