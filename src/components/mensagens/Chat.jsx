// Uma conversa aberta: mensagens, envio, tique de "visualizado" e participantes do grupo.
// Atualiza sozinha a cada poucos segundos (só as mensagens novas, pela posição `seq`).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BellOff, Bell, Check, CheckCheck, Loader2, Send, Trash2, Users } from "lucide-react";
import { clsx } from "clsx";
import Avatar from "../tarefas/Avatar.jsx";
import ParticipantesGrupo from "./ParticipantesGrupo.jsx";
import { corDoAvatar, horaLocal } from "../../lib/tarefas.js";
import { comSeparadores, mesclarMensagens, quemViu, situacaoDaMensagem } from "../../lib/mensagens.js";
import { avisarContador, conversaApagarMensagem, conversaEnviar, conversaObter, conversaSilenciar } from "../../services/mensagens.js";

const INTERVALO = 4000;
let contadorLocal = 0;

export default function Chat({ id, usuarios, aoVoltar, aoMudou, aoSairDoGrupo }) {
  const [dados, setDados] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [maisAntigas, setMaisAntigas] = useState(false);
  const [erro, setErro] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [carregandoAntigas, setCarregandoAntigas] = useState(false);
  const [verGrupo, setVerGrupo] = useState(false);
  const [agora, setAgora] = useState(() => new Date());
  const rolagem = useRef(null);
  const campo = useRef(null);
  const colarNoFim = useRef(true);
  const ultimaSeq = useRef(0);

  const aplicar = useCallback((r, { substituir }) => {
    setDados((d) => ({ ...(d || {}), ...r, mensagens: undefined }));
    setMensagens((atuais) => {
      const novas = r.mensagens.map((m) => ({ ...m }));
      const lista = substituir ? novas : mesclarMensagens(atuais, novas);
      ultimaSeq.current = lista.reduce((n, m) => Math.max(n, m.seq || 0), 0);
      return lista;
    });
  }, []);

  const carregar = useCallback(async ({ inicial = false } = {}) => {
    try {
      const r = await conversaObter(id, inicial || !ultimaSeq.current ? {} : { apos: ultimaSeq.current });
      if (inicial) setMaisAntigas(r.maisAntigas);
      aplicar(r, { substituir: inicial });
      setAgora(new Date());
      setErro("");
      if (inicial || r.mensagens.length) avisarContador();
      if (r.mensagens.length) aoMudou?.();
    } catch (ex) { if (inicial) setErro(ex.message); }
  }, [id, aplicar, aoMudou]);

  useEffect(() => {
    setDados(null); setMensagens([]); setTexto(""); setErro(""); ultimaSeq.current = 0; colarNoFim.current = true;
    void carregar({ inicial: true });
    const t = setInterval(() => { if (!document.hidden) void carregar(); }, INTERVALO);
    const volta = () => { if (!document.hidden) void carregar(); };
    document.addEventListener("visibilitychange", volta);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", volta); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = rolagem.current;
    if (el && colarNoFim.current) el.scrollTop = el.scrollHeight;
  }, [mensagens, dados?.conversa?.id]);

  const aoRolar = () => {
    const el = rolagem.current;
    if (el) colarNoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const eu = dados?.eu;
  const grupo = dados?.conversa?.tipo === "grupo";
  const nomeDe = (u) => dados?.nomes?.[u] || usuarios.find((x) => x.usuario === u)?.nome || u;
  const itens = useMemo(() => comSeparadores(mensagens, agora), [mensagens, agora]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando || !dados) return;
    const provisoria = { id: `local-${++contadorLocal}`, seq: null, autor: eu, tipo: "mensagem", texto: t, apagada: false, criadoEm: new Date().toISOString() };
    colarNoFim.current = true;
    setMensagens((l) => [...l, provisoria]);
    setTexto("");
    setEnviando(true);
    try {
      const r = await conversaEnviar(id, t);
      setMensagens((l) => mesclarMensagens(l.filter((m) => m.id !== provisoria.id), [r.mensagem]));
      ultimaSeq.current = Math.max(ultimaSeq.current, r.mensagem.seq);
      aoMudou?.();
    } catch (ex) {
      setMensagens((l) => l.filter((m) => m.id !== provisoria.id));
      setTexto(t);
      setErro(ex.message);
    } finally { setEnviando(false); campo.current?.focus(); }
  };

  const maisAntigasPedir = async () => {
    const primeira = mensagens.find((m) => m.seq != null);
    if (!primeira || carregandoAntigas) return;
    setCarregandoAntigas(true);
    const el = rolagem.current, alturaAntes = el?.scrollHeight || 0;
    try {
      const r = await conversaObter(id, { antes: primeira.seq });
      colarNoFim.current = false;
      setMensagens((l) => mesclarMensagens(l, r.mensagens));
      setMaisAntigas(r.maisAntigas);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - alturaAntes; });
    } catch (ex) { setErro(ex.message); } finally { setCarregandoAntigas(false); }
  };

  const apagar = async (m) => {
    if (!window.confirm("Apagar esta mensagem para todos?")) return;
    try { await conversaApagarMensagem(id, m.id); setMensagens((l) => l.map((x) => (x.id === m.id ? { ...x, apagada: true, texto: "" } : x))); aoMudou?.(); } catch (ex) { setErro(ex.message); }
  };
  const alternarSilencio = async () => {
    const novo = !dados.conversa.silenciado;
    try { await conversaSilenciar(id, novo); setDados((d) => ({ ...d, conversa: { ...d.conversa, silenciado: novo } })); aoMudou?.(); avisarContador(); } catch (ex) { setErro(ex.message); }
  };

  if (erro && !dados) return <div className="grid h-full place-items-center p-6"><div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro}</div></div>;
  if (!dados) return <div className="grid h-full place-items-center text-sm text-slate-500"><Loader2 className="animate-spin" size={20} aria-label="Carregando" /></div>;

  const c = dados.conversa;
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={`Conversa com ${c.titulo}`}>
      <header className="flex items-center gap-3 border-b px-3 py-2.5" style={{ borderColor: "var(--hairline)" }}>
        <button type="button" className="btn-ghost h-9 w-9 shrink-0 p-0 lg:hidden" onClick={aoVoltar} aria-label="Voltar para as conversas"><ArrowLeft size={18} /></button>
        {grupo ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700"><Users size={18} aria-hidden="true" /></span> : <Avatar usuario={c.outro} nome={c.titulo} tamanho={40} />}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-semibold text-slate-900">{c.titulo}</h2>
          {grupo && <p className="truncate text-xs text-slate-500">{dados.membros.map((m) => nomeDe(m.usuario).split(" ")[0]).join(", ")}</p>}
        </div>
        <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={alternarSilencio} aria-label={c.silenciado ? "Reativar avisos" : "Silenciar conversa"} title={c.silenciado ? "Reativar avisos" : "Silenciar conversa"}>{c.silenciado ? <BellOff size={17} /> : <Bell size={17} />}</button>
        {grupo && <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setVerGrupo(true)} aria-label="Participantes do grupo" title="Participantes"><Users size={17} /></button>}
      </header>

      <div ref={rolagem} onScroll={aoRolar} className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-slate-50 px-3 py-3" role="log" aria-live="polite" aria-label="Mensagens">
        {maisAntigas && <div className="pb-2 text-center"><button type="button" className="text-xs font-medium text-sky-700 underline" onClick={maisAntigasPedir} disabled={carregandoAntigas}>{carregandoAntigas ? "Carregando..." : "Ver mensagens mais antigas"}</button></div>}
        {itens.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Nenhuma mensagem ainda. Diga um oi!</p>}
        {itens.map((it, i) => {
          if (it.tipo === "dia") return <div key={it.chave} className="py-2 text-center"><span className="rounded-full bg-white px-3 py-0.5 text-xs font-medium text-slate-500 shadow-sm">{it.rotulo}</span></div>;
          const m = it.mensagem;
          if (m.tipo === "sistema") return <p key={it.chave} className="py-1 text-center text-xs text-slate-500">{m.texto}</p>;
          const minha = m.autor === eu;
          const anterior = itens[i - 1]?.mensagem;
          const mesmoAutor = anterior && anterior.tipo === "mensagem" && anterior.autor === m.autor && itens[i - 1].tipo === "msg";
          const situacao = minha ? situacaoDaMensagem(m, dados.membros, eu) : null;
          const viram = grupo && minha && situacao ? quemViu(m, dados.membros, eu) : [];
          return (
            <div key={it.chave} className={clsx("group flex items-end gap-1.5", minha ? "justify-end" : "justify-start", !mesmoAutor && "pt-1.5")}>
              {!minha && grupo && (mesmoAutor ? <span className="w-7 shrink-0" /> : <Avatar usuario={m.autor} nome={nomeDe(m.autor)} tamanho={28} />)}
              {minha && !m.apagada && m.seq != null && <button type="button" className="mb-1 hidden rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover:block group-focus-within:block" onClick={() => apagar(m)} aria-label="Apagar mensagem" title="Apagar mensagem"><Trash2 size={13} /></button>}
              <div className={clsx("max-w-[78%] rounded-2xl px-3 py-1.5 text-sm shadow-sm", minha ? "rounded-br-md bg-sky-100 text-slate-900" : "rounded-bl-md bg-white text-slate-900")}>
                {!minha && grupo && !mesmoAutor && <p className="text-xs font-semibold" style={{ color: corDoAvatar(m.autor) }}>{nomeDe(m.autor)}</p>}
                {m.apagada ? <p className="italic text-slate-400">Mensagem apagada</p> : <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.texto}</p>}
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-slate-400">
                  {horaLocal(m.criadoEm)}
                  {minha && !m.apagada && (situacao === "enviando" ? <Loader2 size={12} className="animate-spin" aria-label="Enviando" /> : situacao === "visualizada" ? <CheckCheck size={14} className="text-sky-600" aria-label="Visualizada" /> : <Check size={14} aria-label="Enviada" />)}
                </p>
                {viram.length > 0 && !grupoTodosViram(viram, dados.membros, eu) && <p className="text-right text-[10px] text-slate-400">Visto por {viram.map((u) => nomeDe(u).split(" ")[0]).join(", ")}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {erro && <div role="alert" className="border-t bg-red-50 px-3 py-2 text-sm text-red-700" style={{ borderColor: "var(--hairline)" }}>{erro}</div>}
      <form className="flex items-end gap-2 border-t bg-white p-2.5" style={{ borderColor: "var(--hairline)" }} onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <textarea ref={campo} className="input max-h-32 min-h-[44px] flex-1 resize-none py-2.5 text-sm" rows={1} placeholder="Escreva uma mensagem" aria-label="Escreva uma mensagem" value={texto} maxLength={5000} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }} />
        <button type="submit" className="btn-primary h-11 w-11 shrink-0 p-0" disabled={!texto.trim() || enviando} aria-label="Enviar mensagem" title="Enviar (Enter)"><Send size={18} /></button>
      </form>

      {verGrupo && <ParticipantesGrupo dados={dados} usuarios={usuarios} eu={eu} aoFechar={() => setVerGrupo(false)} aoMudou={() => carregar({ inicial: true })} aoSair={() => { setVerGrupo(false); aoSairDoGrupo?.(); }} />}
    </section>
  );
}

// Em grupo, "Visto por ..." só aparece enquanto nem todos viram (todos viram = tique azul duplo basta).
function grupoTodosViram(viram, membros, eu) {
  return viram.length === membros.filter((m) => m.usuario !== eu).length;
}
