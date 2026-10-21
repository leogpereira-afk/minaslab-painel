// Bolinha de mensagens não lidas no menu. Confere a cada 20 s e na hora em que a tela de Mensagens avisa.
import { useCallback, useEffect, useRef, useState } from "react";
import { contadorTexto } from "../../lib/mensagens.js";
import { conversasContar } from "../../services/mensagens.js";

export default function ContadorMensagens() {
  const raiz = useRef(null);
  const [total, setTotal] = useState(0);
  const conferir = useCallback(async () => {
    if (!raiz.current?.offsetParent) return; // a cópia escondida (celular x computador) não precisa conferir
    try { const r = await conversasContar(); setTotal(r.totalNaoLidas || 0); } catch { /* o contador é só conforto */ }
  }, []);
  useEffect(() => {
    void conferir();
    const t = setInterval(() => { if (!document.hidden) void conferir(); }, 20000);
    window.addEventListener("mensagens:atualizar", conferir);
    document.addEventListener("visibilitychange", conferir);
    return () => { clearInterval(t); window.removeEventListener("mensagens:atualizar", conferir); document.removeEventListener("visibilitychange", conferir); };
  }, [conferir]);
  return <span ref={raiz} className="ml-auto">{total > 0 && <span className="grid min-w-[20px] place-items-center rounded-full bg-sky-600 px-1.5 text-[11px] font-bold leading-5 text-white" aria-label={`${total} mensagens não lidas`}>{contadorTexto(total)}</span>}</span>;
}
