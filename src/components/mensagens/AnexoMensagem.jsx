// Arquivo dentro de uma mensagem: imagem aparece na conversa (clique abre inteira); os demais são um cartão que baixa ao clicar.
// O link do arquivo é assinado e dura poucos minutos: é pedido ao servidor só quando a imagem entra na tela ou quando se clica.
import { useEffect, useState } from "react";
import { Download, ImageOff } from "lucide-react";
import IconeArquivo from "../anexos/IconeArquivo.jsx";
import { ehImagem, formatarTamanho } from "../../lib/anexos.js";
import { conversaArquivoUrl } from "../../services/mensagens.js";

const cache = new Map(); // mensagemId → { url, expira }
async function linkDaImagem(conversaId, mensagemId) {
  const c = cache.get(mensagemId);
  if (c && c.expira > Date.now()) return c.url;
  const r = await conversaArquivoUrl(conversaId, mensagemId, false);
  cache.set(mensagemId, { url: r.url, expira: Date.now() + 4 * 60 * 1000 });
  return r.url;
}

export default function AnexoMensagem({ conversaId, mensagem: m, minha }) {
  const [url, setUrl] = useState("");
  const [falhou, setFalhou] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const imagem = ehImagem(m.anexo.nome) && m.seq != null;

  useEffect(() => {
    if (!imagem) return undefined;
    let vivo = true;
    linkDaImagem(conversaId, m.id).then((u) => { if (vivo) setUrl(u); }).catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [imagem, conversaId, m.id]);

  const abrir = async (baixar) => {
    setBaixando(true);
    try { const r = await conversaArquivoUrl(conversaId, m.id, baixar); window.open(r.url, "_blank", "noopener"); } catch { setFalhou(true); } finally { setBaixando(false); }
  };

  if (imagem && !falhou) {
    return url
      ? <button type="button" onClick={() => abrir(false)} className="block overflow-hidden rounded-xl" aria-label={`Abrir imagem ${m.anexo.nome}`}><img src={url} alt={m.anexo.nome} loading="lazy" className="max-h-60 max-w-full rounded-xl object-cover" onError={() => setFalhou(true)} /></button>
      : <div className="grid h-24 w-40 place-items-center rounded-xl bg-slate-100 text-xs text-slate-400">Carregando imagem...</div>;
  }
  return (
    <button type="button" onClick={() => m.seq != null && abrir(true)} disabled={m.seq == null || baixando} className="flex w-full min-w-[12rem] max-w-xs items-center gap-2.5 rounded-xl bg-black/5 p-2 text-left hover:bg-black/10 disabled:cursor-default" title={m.seq == null ? "Enviando..." : "Baixar"}>
      {falhou ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400"><ImageOff size={18} aria-hidden="true" /></span> : <IconeArquivo nome={m.anexo.nome} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{m.anexo.nome}</span>
        <span className="block text-xs opacity-60">{m.seq == null ? "Enviando..." : falhou ? "Não consegui abrir agora" : formatarTamanho(m.anexo.tamanho)}</span>
      </span>
      {m.seq != null && !minha && <Download size={15} className="shrink-0 opacity-50" aria-hidden="true" />}
    </button>
  );
}
