// Vigia de mensagens: UMA consulta para o painel inteiro (a cada 8 s e na hora em que alguém avisa "mensagens:atualizar").
// Toca o som, mostra o aviso do navegador e põe a contagem no título da aba. Fica montado no Layout, fora do menu:
// antes isso morava no contador do menu lateral, que some com a janela estreita (menos de 1024 px) e no celular —
// e aí o som parava junto. O contador do menu e o balão só LEEM o resultado (useContagemMensagens).
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { conversasNovas, fotografiaDasNovas, tituloComContagem } from "../../lib/mensagens.js";
import { somLigado, tocarAviso } from "../../lib/somAviso.js";
import { textoSimples } from "../../lib/textoRico.js";
import { conversasContar } from "../../services/mensagens.js";

const PODE_AVISAR = typeof window !== "undefined" && "Notification" in window;
const EVENTO = "mensagens:contagem";
let ultima = { totalNaoLidas: 0, novas: [] };

/** Última contagem conhecida, atualizada a cada consulta do vigia. */
export function useContagemMensagens() {
  const [c, setC] = useState(ultima);
  useEffect(() => {
    const ouvir = (e) => setC(e.detail);
    window.addEventListener(EVENTO, ouvir);
    setC(ultima);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);
  return c;
}

export default function VigiaMensagens() {
  const navigate = useNavigate();
  const anterior = useRef(null);

  const conferir = useCallback(async () => {
    try {
      const r = await conversasContar();
      const n = r.totalNaoLidas || 0;
      ultima = { totalNaoLidas: n, novas: r.novas || [] };
      window.dispatchEvent(new CustomEvent(EVENTO, { detail: ultima }));
      const abertaId = new URLSearchParams(window.location.search).get("abrir") || "";
      const novas = window.location.pathname.endsWith("/mensagens") ? conversasNovas(anterior.current, ultima.novas, { abertaId, abaVisivel: !document.hidden && document.hasFocus() }) : conversasNovas(anterior.current, ultima.novas);
      anterior.current = fotografiaDasNovas(ultima.novas);
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
    } catch { /* o aviso é só conforto */ }
  }, [navigate]);

  useEffect(() => {
    void conferir();
    const t = setInterval(() => { void conferir(); }, 8000);
    window.addEventListener("mensagens:atualizar", conferir);
    document.addEventListener("visibilitychange", conferir);
    return () => { clearInterval(t); window.removeEventListener("mensagens:atualizar", conferir); document.removeEventListener("visibilitychange", conferir); };
  }, [conferir]);

  return null;
}
