// Mensagens (Messenger): conversas individuais e grupos entre quem usa o painel.
// Só os participantes leem uma conversa — nem a direção lê a dos outros (regra do servidor, ml-messenger).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BellOff, MessageSquarePlus, Search, Users } from "lucide-react";
import FotoGrupo from "../components/mensagens/FotoGrupo.jsx";
import AvisosDoMessenger from "../components/mensagens/AvisosDoMessenger.jsx";
import { clsx } from "clsx";
import Avatar from "../components/tarefas/Avatar.jsx";
import Chat from "../components/mensagens/Chat.jsx";
import NovaConversa from "../components/mensagens/NovaConversa.jsx";
import { horaLocal } from "../lib/tarefas.js";
import { contadorTexto, filtrarConversas, horaNaLista } from "../lib/mensagens.js";
import { mencionaUsuario, textoSimples } from "../lib/textoRico.js";
import { avisarContador, conversasListar, mensagensUsuarios } from "../services/mensagens.js";

export default function Mensagens() {
  const [params, setParams] = useSearchParams();
  const [lista, setLista] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [eu, setEu] = useState("");
  const [busca, setBusca] = useState("");
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [erro, setErro] = useState("");
  const [nova, setNova] = useState(null); // null | "pessoa" | "grupo"
  const [agora, setAgora] = useState(() => new Date());
  const aberta = params.get("abrir");

  const carregar = useCallback(async () => {
    try {
      const r = await conversasListar();
      setLista(r); setEu(r.eu); setErro(""); setAgora(new Date());
      avisarContador();
    } catch (ex) { setErro(ex.message); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) void carregar(); }, 15000);
    return () => clearInterval(t);
  }, [carregar]);
  useEffect(() => {
    let vivo = true;
    mensagensUsuarios().then((r) => { if (vivo) { setUsuarios(r.usuarios); setEu((v) => v || r.eu); } }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const abrir = useCallback((id) => { const p = new URLSearchParams(params); p.set("abrir", id); setParams(p); }, [params, setParams]);
  const fechar = useCallback(() => { const p = new URLSearchParams(params); p.delete("abrir"); setParams(p, { replace: true }); }, [params, setParams]);
  const conversas = useMemo(() => filtrarConversas(lista?.conversas, { busca, soNaoLidas }), [lista, busca, soNaoLidas]);
  const totalNaoLidas = lista?.totalNaoLidas || 0;

  const criada = (id) => { setNova(null); void carregar(); abrir(id); };

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Mensagens</h1>
      <div className="flex h-[calc(100dvh-8rem)] min-h-[420px] lg:h-[calc(100dvh-6.5rem)] overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--hairline)" }}>
        <aside className={clsx("flex min-h-0 w-full flex-col border-r lg:w-80 lg:shrink-0", aberta && "hidden lg:flex")} style={{ borderColor: "var(--hairline)" }} aria-label="Conversas">
          <div className="space-y-2 border-b p-3" style={{ borderColor: "var(--hairline)" }}>
            <div className="flex gap-2">
              <button type="button" className="btn-primary h-10 flex-1" onClick={() => setNova("pessoa")}><MessageSquarePlus size={16} />Nova conversa</button>
              <button type="button" className="btn-outline h-10 px-3" onClick={() => setNova("grupo")} title="Criar grupo" aria-label="Criar grupo"><Users size={16} /></button>
            </div>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input className="input h-10 min-h-0 pl-9 text-sm" placeholder="Pesquisar conversa" aria-label="Pesquisar conversa" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="flex gap-1.5" role="group" aria-label="Filtro">
              {[[false, "Todas"], [true, `Não lidas${totalNaoLidas ? ` (${contadorTexto(totalNaoLidas)})` : ""}`]].map(([v, rotulo]) => (
                <button key={String(v)} type="button" aria-pressed={soNaoLidas === v} onClick={() => setSoNaoLidas(v)} className={clsx("rounded-full border px-3 py-0.5 text-xs font-medium", soNaoLidas === v ? "border-brand-400 bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50")} style={soNaoLidas === v ? undefined : { borderColor: "var(--hairline)" }}>{rotulo}</button>
              ))}
            </div>
            <AvisosDoMessenger />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {erro && !lista && <div role="alert" className="m-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
            {!lista && !erro && <p className="p-6 text-center text-sm text-slate-500">Carregando as conversas...</p>}
            {lista && conversas.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                {lista.conversas.length === 0 ? <><p>Você ainda não tem conversas.</p><button type="button" className="mt-2 font-medium text-sky-700 underline" onClick={() => setNova("pessoa")}>Começar uma conversa</button></> : <p>Nenhuma conversa encontrada.</p>}
              </div>
            )}
            <ul>
              {conversas.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => abrir(c.id)} aria-current={aberta === c.id ? "true" : undefined} className={clsx("flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50", aberta === c.id && "bg-sky-50")}>
                    {c.tipo === "grupo" ? <FotoGrupo foto={c.foto} tamanho={44} /> : <Avatar usuario={c.outro} nome={c.titulo} tamanho={44} />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={clsx("truncate text-sm", c.naoLidas ? "font-bold text-slate-900" : "font-medium text-slate-800")}>{c.titulo}</span>
                        <span className={clsx("shrink-0 text-[11px]", c.naoLidas ? "font-semibold text-sky-700" : "text-slate-400")}>{horaNaLista(c.ultima?.em, agora, horaLocal)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={clsx("truncate text-xs", c.naoLidas ? "font-medium text-slate-700" : "text-slate-500")}>
                          {c.ultima ? <>{c.ultima.autor === eu ? "Você: " : c.tipo === "grupo" && c.ultima.autor ? `${(lista.nomes[c.ultima.autor] || c.ultima.autor).split(" ")[0]}: ` : ""}{c.ultima.texto ? textoSimples(c.ultima.texto, (u) => lista.nomes[u] || u) : "Mensagem apagada"}</> : <i>Sem mensagens</i>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {c.naoLidas > 0 && mencionaUsuario(c.ultima?.texto, eu) && <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-white" title="Você foi marcado(a)" aria-label="Você foi marcado(a)">@</span>}
                          {c.silenciado && <BellOff size={12} className="text-slate-400" aria-label="Silenciada" />}
                          {c.naoLidas > 0 && <span className="grid min-w-[20px] place-items-center rounded-full bg-sky-600 px-1.5 text-[11px] font-bold leading-5 text-white" aria-label={`${c.naoLidas} não lidas`}>{contadorTexto(c.naoLidas)}</span>}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className={clsx("min-w-0 flex-1", !aberta && "hidden lg:block")}>
          {aberta
            ? <Chat key={aberta} id={aberta} usuarios={usuarios} aoVoltar={fechar} aoMudou={carregar} aoSairDoGrupo={() => { fechar(); void carregar(); }} />
            : <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-500"><div><MessageSquarePlus size={32} className="mx-auto mb-2 text-slate-300" aria-hidden="true" />Escolha uma conversa ao lado ou comece uma nova.</div></div>}
        </div>
      </div>
      {nova && <NovaConversa usuarios={usuarios} eu={eu} inicial={nova} aoFechar={() => setNova(null)} aoAbrir={criada} />}
    </div>
  );
}
