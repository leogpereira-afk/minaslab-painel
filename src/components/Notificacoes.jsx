// O sino do painel: quantas novidades a pessoa tem (tarefas hoje; calendário e mensagens depois) e a lista.
// Confere a cada 30 s. Se a pessoa permitir, também avisa pelo navegador quando chega algo com a aba em segundo plano.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "./ui.jsx";
import { tempoRelativo } from "../lib/tarefas.js";
import { avisoLido, avisosContar, avisosListar, avisosTodosLidos } from "../services/tarefas.js";

const PODE_AVISAR = typeof window !== "undefined" && "Notification" in window;

export default function Notificacoes({ className }) {
  const navigate = useNavigate();
  const raiz = useRef(null);
  const ultimoTotal = useRef(null);
  const jaAvisados = useRef(new Set());
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");
  const [permissao, setPermissao] = useState(PODE_AVISAR ? Notification.permission : "denied");

  const avisarNoNavegador = useCallback(async () => {
    try {
      const r = await avisosListar(5);
      // Só o que chegou nos últimos 2 minutos e ainda não foi avisado: não repete nem traz o que já estava lá.
      const novos = r.itens.filter((n) => !n.lida && !jaAvisados.current.has(n.id) && Date.now() - Date.parse(n.criado_em) < 120000).slice(0, 3);
      r.itens.forEach((n) => jaAvisados.current.add(n.id));
      for (const n of novos) {
        const aviso = new Notification(n.titulo, { body: n.corpo, tag: n.id });
        aviso.onclick = () => { window.focus(); navigate(n.link || "/tarefas"); aviso.close(); };
      }
    } catch { /* aviso do navegador é só conforto */ }
  }, [navigate]);

  const contar = useCallback(async () => {
    if (!raiz.current?.offsetParent) return; // a cópia escondida (celular x computador) não precisa conferir
    try {
      const { naoLidas: n } = await avisosContar();
      setNaoLidas(n);
      const subiu = ultimoTotal.current !== null && n > ultimoTotal.current;
      ultimoTotal.current = n;
      if (subiu && PODE_AVISAR && Notification.permission === "granted" && document.hidden) void avisarNoNavegador();
    } catch { /* sem rede por um instante: tenta de novo no próximo ciclo */ }
  }, [avisarNoNavegador]);

  useEffect(() => {
    void contar();
    const t = setInterval(() => { if (!document.hidden || (PODE_AVISAR && Notification.permission === "granted")) void contar(); }, 30000);
    const volta = () => { if (!document.hidden) void contar(); };
    document.addEventListener("visibilitychange", volta);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", volta); };
  }, [contar]);

  const carregarLista = useCallback(async () => {
    try {
      const r = await avisosListar(40);
      setItens(r.itens);
      setNaoLidas(r.naoLidas);
      ultimoTotal.current = r.naoLidas;
      setErro("");
    } catch (ex) { setErro(ex.message); }
  }, []);
  useEffect(() => { if (aberto) void carregarLista(); }, [aberto, carregarLista]);

  const abrirAviso = async (n) => {
    setAberto(false);
    if (!n.lida) { setItens((l) => l.map((x) => (x.id === n.id ? { ...x, lida: true } : x))); setNaoLidas((v) => Math.max(0, v - 1)); avisoLido(n.id).catch(() => {}); }
    if (n.link) navigate(n.link);
  };
  const marcarTodas = async () => { try { await avisosTodosLidos(); setItens((l) => l.map((x) => ({ ...x, lida: true }))); setNaoLidas(0); ultimoTotal.current = 0; } catch (ex) { setErro(ex.message); } };
  const ativarNavegador = async () => { if (PODE_AVISAR) setPermissao(await Notification.requestPermission()); };

  return (
    <span ref={raiz} className={clsx("relative inline-flex", className)}>
      <button type="button" onClick={() => setAberto(true)} className="btn-ghost relative h-9 w-9 p-0 text-slate-500 hover:text-brand-700" title="Notificações" aria-label={naoLidas ? `Notificações: ${naoLidas} não lidas` : "Notificações"}>
        {naoLidas > 0 ? <BellRing size={16} /> : <Bell size={16} />}
        {naoLidas > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">{naoLidas > 99 ? "99+" : naoLidas}</span>}
      </button>
      <Modal titulo="Notificações" aberto={aberto} aoFechar={() => setAberto(false)} largura="max-w-md" gaveta>
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="btn-outline h-9 min-h-0 text-sm" onClick={marcarTodas} disabled={!naoLidas}><CheckCheck size={14} />Marcar todas como lidas</button>
            {PODE_AVISAR && permissao === "default" && <button type="button" className="text-sm text-brand-700 underline" onClick={ativarNavegador}>Avisar também pelo navegador</button>}
          </div>
          {PODE_AVISAR && permissao === "denied" && <p className="text-xs text-slate-500">Os avisos do navegador estão bloqueados. Libere nas configurações do site se quiser recebê-los.</p>}
          {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
          {itens.length === 0 && !erro && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500" style={{ borderColor: "var(--hairline)" }}>Nenhuma notificação por enquanto.</p>}
          <ul className="space-y-1.5">
            {itens.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => abrirAviso(n)} className={clsx("block w-full rounded-xl border px-3 py-2.5 text-left transition hover:bg-slate-50", n.lida ? "bg-white" : "border-sky-200 bg-sky-50")} style={n.lida ? { borderColor: "var(--hairline)" } : undefined}>
                  <span className="flex items-start justify-between gap-2">
                    <span className={clsx("text-sm [overflow-wrap:anywhere]", n.lida ? "text-slate-700" : "font-semibold text-slate-900")}>{n.titulo}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{tempoRelativo(n.criado_em)}</span>
                  </span>
                  {n.corpo && <span className="mt-0.5 block text-xs text-slate-500 [overflow-wrap:anywhere]">{n.corpo}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </span>
  );
}
