// Bolinha de mensagens não lidas no menu + avisos de mensagem nova: toque, aviso do navegador (se a pessoa permitiu) e contagem no título da aba.
// Confere a cada 8 s (e na hora em que a tela de Mensagens avisa). Só funciona com o painel aberto no navegador.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { contadorTexto, conversasNovas, fotografiaDasNovas, tituloComContagem } from "../../lib/mensagens.js";
import { somLigado, tocarAviso } from "../../lib/somAviso.js";
import { textoSimples } from "../../lib/textoRico.js";
import { conversasContar } from "../../services/mensagens.js";

const PODE_AVISAR = typeof window !== "undefined" && "Notification" in window;

export default function ContadorMensagens() {
  const navigate = useNavigate();
  const raiz = useRef(null);
  const anterior = useRef(null);
  const [total, setTotal] = useState(0);

  const conferir = useCallback(async () => {
    if (!raiz.current?.offsetParent) return; // a cópia escondida (celular x computador) não precisa conferir
    try {
      const r = await conversasContar();
      const n = r.totalNaoLidas || 0;
      setTotal(n);
      const abertaId = new URLSearchParams(window.location.search).get("abrir") || "";
      const novas = window.location.pathname.endsWith("/mensagens") ? conversasNovas(anterior.current, r.novas || [], { abertaId, abaVisivel: !document.hidden && document.hasFocus() }) : conversasNovas(anterior.current, r.novas || []);
      anterior.current = fotografiaDasNovas(r.novas || []);
      if (novas.length) {
        if (somLigado()) tocarAviso();
        if (PODE_AVISAR && Notification.permission === "granted" && (document.hidden || !document.hasFocus())) {
          for (const c of novas.slice(0, 3)) {
            const aviso = new Notification(c.tipo === "grupo" && c.autor ? `${c.titulo} — ${c.autor}` : c.titulo, { body: textoSimples(c.texto), tag: `msg-${c.id}`, renotify: true });
            aviso.onclick = () => { window.focus(); navigate(`/mensagens?abrir=${c.id}`); aviso.close(); };
          }
        }
      }
      document.title = tituloComContagem(document.title, n);
    } catch { /* o contador é só conforto */ }
  }, [navigate]);

  useEffect(() => {
    void conferir();
    const t = setInterval(() => { if (!document.hidden || PODE_AVISAR) void conferir(); }, 8000);
    window.addEventListener("mensagens:atualizar", conferir);
    document.addEventListener("visibilitychange", conferir);
    return () => { clearInterval(t); window.removeEventListener("mensagens:atualizar", conferir); document.removeEventListener("visibilitychange", conferir); };
  }, [conferir]);

  return <span ref={raiz} className="ml-auto">{total > 0 && <span className="grid min-w-[20px] place-items-center rounded-full bg-sky-600 px-1.5 text-[11px] font-bold leading-5 text-white" aria-label={`${total} mensagens não lidas`}>{contadorTexto(total)}</span>}</span>;
}
