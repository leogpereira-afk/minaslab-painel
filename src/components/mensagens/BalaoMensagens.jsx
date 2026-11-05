// Balão de mensagens no canto da tela, em qualquer página do painel (menos na própria tela de Mensagens).
// Fechado: mostra as últimas mensagens não lidas empilhadas acima dele, para ler sem clicar.
// Aberto: lista das conversas e a conversa inteira ali mesmo, com resposta. "Abrir em Mensagens" leva à tela completa.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Maximize2, MessageCircle, Search, X } from "lucide-react";
import { clsx } from "clsx";
import Avatar from "../tarefas/Avatar.jsx";
import FotoGrupo from "./FotoGrupo.jsx";
import Chat from "./Chat.jsx";
import { horaLocal } from "../../lib/tarefas.js";
import { assinaturaDasNovas, contadorTexto, filtrarConversas, horaNaLista, previasDoBalao } from "../../lib/mensagens.js";
import { textoSimples } from "../../lib/textoRico.js";
import { avisarContador, conversasListar, mensagensUsuarios } from "../../services/mensagens.js";
import { useContagemMensagens } from "./VigiaMensagens.jsx";

const CHAVE_OCULTAS = "ml_balao_ocultas";
const lerOcultas = () => { try { return sessionStorage.getItem(CHAVE_OCULTAS) || ""; } catch { return ""; } };
const gravarOcultas = (v) => { try { sessionStorage.setItem(CHAVE_OCULTAS, v); } catch { /* sem armazenamento: some só até recarregar */ } };

function Previa({ c, aoAbrir }) {
  return (
    <button type="button" onClick={() => aoAbrir(c.id)} className="flex w-full gap-3 rounded-2xl bg-white p-3 text-left shadow-lg ring-1 ring-slate-200 transition hover:ring-brand-300">
      {c.tipo === "grupo" ? <FotoGrupo tamanho={38} /> : <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-brand-100 text-brand-800"><MessageCircle size={18} aria-hidden="true" /></span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-bold text-slate-900">{c.titulo}</span>
          <span className="shrink-0 text-[11px] font-semibold text-brand-700">{horaNaLista(c.em, new Date(), horaLocal)}</span>
        </span>
        <span className="line-clamp-2 text-[13px] leading-snug text-slate-600">
          {c.tipo === "grupo" && c.autor ? <b className="font-semibold text-slate-700">{c.autor.split(" ")[0]}: </b> : null}
          {c.texto ? textoSimples(c.texto) : "Mensagem nova"}
        </span>
      </span>
      {c.naoLidas > 1 && <span className="grid h-5 min-w-[20px] shrink-0 place-items-center self-center rounded-full bg-sky-600 px-1.5 text-[11px] font-bold text-white" aria-label={`${c.naoLidas} não lidas`}>{contadorTexto(c.naoLidas)}</span>}
    </button>
  );
}

function ListaConversas({ aoAbrir }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const carregar = useCallback(async () => {
    try { setLista(await conversasListar()); setErro(""); } catch (ex) { setErro(ex.message); }
  }, []);
  useEffect(() => {
    void carregar();
    const t = setInterval(() => { if (!document.hidden) void carregar(); }, 15000);
    return () => clearInterval(t);
  }, [carregar]);
  const conversas = useMemo(() => filtrarConversas(lista?.conversas, { busca }), [lista, busca]);
  const agora = new Date();
  const eu = lista?.eu;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b p-3" style={{ borderColor: "var(--hairline)" }}>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input className="input h-10 min-h-0 pl-9 text-sm" placeholder="Pesquisar conversa" aria-label="Pesquisar conversa" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {erro && !lista && <div role="alert" className="m-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        {!lista && !erro && <p className="p-6 text-center text-sm text-slate-500">Carregando as conversas...</p>}
        {lista && conversas.length === 0 && <p className="p-6 text-center text-sm text-slate-500">{lista.conversas.length ? "Nenhuma conversa encontrada." : "Você ainda não tem conversas."}</p>}
        <ul>
          {conversas.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => aoAbrir(c.id)} className={clsx("flex w-full items-start gap-3 border-b px-3 py-3 text-left hover:bg-slate-50", c.naoLidas > 0 && "bg-sky-50/60")} style={{ borderColor: "var(--hairline)" }}>
                {c.tipo === "grupo" ? <FotoGrupo foto={c.foto} tamanho={40} /> : <Avatar usuario={c.outro} nome={c.titulo} tamanho={40} />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={clsx("truncate text-sm", c.naoLidas ? "font-bold text-slate-900" : "font-medium text-slate-800")}>{c.titulo}</span>
                    <span className={clsx("shrink-0 text-[11px]", c.naoLidas ? "font-semibold text-sky-700" : "text-slate-400")}>{horaNaLista(c.ultima?.em, agora, horaLocal)}</span>
                  </span>
                  <span className="flex items-start justify-between gap-2">
                    <span className={clsx("line-clamp-2 text-[13px] leading-snug", c.naoLidas ? "text-slate-700" : "text-slate-500")}>
                      {c.ultima ? <>{c.ultima.autor === eu ? "Você: " : c.tipo === "grupo" && c.ultima.autor ? `${(lista.nomes[c.ultima.autor] || c.ultima.autor).split(" ")[0]}: ` : ""}{c.ultima.texto ? textoSimples(c.ultima.texto, (u) => lista.nomes[u] || u) : "Mensagem apagada"}</> : <i>Sem mensagens</i>}
                    </span>
                    {c.naoLidas > 0 && <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-sky-600 px-1.5 text-[11px] font-bold text-white" aria-label={`${c.naoLidas} não lidas`}>{contadorTexto(c.naoLidas)}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function BalaoMensagens() {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [conversa, setConversa] = useState(null); // id da conversa aberta dentro do balão
  const contagem = useContagemMensagens();
  const [ocultas, setOcultas] = useState(lerOcultas);
  const [usuarios, setUsuarios] = useState([]);

  const conferir = useCallback(() => avisarContador(), []);
  useEffect(() => {
    if (!aberto || usuarios.length) return;
    mensagensUsuarios().then((r) => setUsuarios(r.usuarios || [])).catch(() => {});
  }, [aberto, usuarios.length]);
  useEffect(() => {
    if (!aberto) return undefined;
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]);

  const previas = previasDoBalao(contagem.novas, ocultas);
  const total = contagem.totalNaoLidas;
  const abrirConversa = (id) => { setConversa(id); setAberto(true); };
  const ocultar = () => { const a = assinaturaDasNovas(contagem.novas.filter((c) => c.naoLidas > 0)); setOcultas(a); gravarOcultas(a); };
  const telaCompleta = () => { setAberto(false); navigate(conversa ? `/mensagens?abrir=${conversa}` : "/mensagens"); };

  return (
    <div className="sem-impressao">
      {!aberto && previas.length > 0 && (
        <div className="fixed bottom-24 right-4 z-30 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 sm:right-6" aria-label="Mensagens novas" role="region">
          <div className="flex items-center justify-between px-1">
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-slate-700 shadow-sm">{total === 1 ? "1 mensagem nova" : `${contadorTexto(total)} mensagens novas`}</span>
            <button type="button" onClick={ocultar} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300" title="Esconder estes avisos (as mensagens continuam em Mensagens)"><X size={14} aria-hidden="true" />Ocultar</button>
          </div>
          {previas.map((c) => <Previa key={c.id} c={c} aoAbrir={abrirConversa} />)}
          <button type="button" onClick={() => { setConversa(null); setAberto(true); }} className="self-end rounded px-1.5 py-1 text-xs font-bold text-brand-800 hover:underline">Ver todas as mensagens →</button>
        </div>
      )}

      {aberto && (
        <section className="fixed inset-x-2 bottom-24 top-16 z-40 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 sm:inset-x-auto sm:right-6 sm:top-auto sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[420px]" aria-label="Mensagens">
          <header className="flex items-center gap-2 bg-brand-700 px-3 py-2.5 text-white">
            {conversa
              ? <button type="button" onClick={() => setConversa(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label="Voltar para as conversas"><ArrowLeft size={18} /></button>
              : <MessageCircle size={20} className="ml-1" aria-hidden="true" />}
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-bold leading-tight">Mensagens</span>
              <span className="block text-xs text-white/80">{total ? `${contadorTexto(total)} não lida${total > 1 ? "s" : ""}` : "Tudo lido"}</span>
            </span>
            <button type="button" onClick={telaCompleta} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label="Abrir na tela de Mensagens" title="Abrir na tela de Mensagens"><Maximize2 size={16} /></button>
            <button type="button" onClick={() => setAberto(false)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label="Fechar mensagens" title="Fechar"><X size={18} /></button>
          </header>
          {conversa
            ? <div className="min-h-0 flex-1"><Chat key={conversa} compacto id={conversa} usuarios={usuarios} aoVoltar={() => setConversa(null)} aoMudou={conferir} aoSairDoGrupo={() => setConversa(null)} /></div>
            : <ListaConversas aoAbrir={setConversa} />}
        </section>
      )}

      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-label={aberto ? "Fechar mensagens" : total ? `Abrir mensagens, ${total} não lidas` : "Abrir mensagens"} title="Mensagens"
        className="fixed bottom-5 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand-700 text-white shadow-xl transition hover:bg-brand-800 sm:right-6">
        {aberto ? <X size={24} aria-hidden="true" /> : <MessageCircle size={26} aria-hidden="true" />}
        {!aberto && total > 0 && <span className="absolute -right-1 -top-1 grid h-6 min-w-[24px] place-items-center rounded-full border-2 border-white bg-red-600 px-1 text-xs font-bold" aria-hidden="true">{contadorTexto(total)}</span>}
      </button>
    </div>
  );
}
