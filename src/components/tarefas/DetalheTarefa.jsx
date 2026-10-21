// A tarefa aberta: dados e lista de verificação à esquerda, bate-papo da tarefa à direita (como no Bitrix24).
// O servidor decide quem pode o quê (`pode`); aqui só se mostram os botões que a pessoa pode usar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, Flame, Hourglass, ListChecks, Lock, MoreHorizontal, Play, Plus, RotateCcw, Search, Send, Trash2, UserPlus, X } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "../ui.jsx";
import Avatar from "./Avatar.jsx";
import SeletorPessoas from "./SeletorPessoas.jsx";
import ArquivosTarefa from "./ArquivosTarefa.jsx";
import { LEMBRETES, STATUS_TAREFA, deInputLocal, diasDeAtraso, lembreteDoSelect, paraInputLocal, progressoChecklist, quandoAvisa, resumoRecorrencia, rotuloLembrete, rotuloPrazo } from "../../lib/tarefas.js";
import { tarefaAtualizar, tarefaChecklist, tarefaDelegar, tarefaExcluir, tarefaMensagem, tarefaObter, tarefaPessoas, tarefaStatus } from "../../services/tarefas.js";

const FUSO = "America/Sao_Paulo";
const horaMsg = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO });
const diaMsg = (iso) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: FUSO });
const chaveDia = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: FUSO });

function Linha({ rotulo, children }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-2 py-1.5 text-sm">
      <span className="pt-0.5 text-slate-500">{rotulo}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Pessoa({ usuario, nomes }) {
  return <span className="inline-flex items-center gap-1.5"><Avatar usuario={usuario} nome={nomes[usuario]} tamanho={24} />{nomes[usuario] || usuario}</span>;
}

function BatePapo({ dados, aoEnviar }) {
  const { mensagens, nomes, eu, visualizacoes } = dados;
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fim = useRef(null);
  const ultima = mensagens.length ? mensagens[mensagens.length - 1].id : "";
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [ultima]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try { await aoEnviar(t); setTexto(""); } finally { setEnviando(false); }
  };

  const ultimaMsgEm = mensagens.length ? mensagens[mensagens.length - 1].criado_em : "";
  const viram = visualizacoes.filter((v) => !ultimaMsgEm || v.visto_em >= ultimaMsgEm).map((v) => nomes[v.usuario] || v.usuario);

  let diaAnterior = "";
  return (
    <div className="flex h-full min-h-[22rem] flex-col rounded-xl border bg-slate-50" style={{ borderColor: "var(--hairline)" }}>
      <header className="border-b bg-white px-4 py-2.5 font-display text-sm font-semibold text-slate-800" style={{ borderColor: "var(--hairline)" }}>Bate-papo da tarefa</header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3" role="log" aria-live="polite" aria-label="Mensagens da tarefa">
        {mensagens.map((m) => {
          const dia = chaveDia(m.criado_em);
          const separador = dia !== diaAnterior ? <p key={`d-${dia}`} className="py-1 text-center text-xs text-slate-400 first-letter:uppercase">{diaMsg(m.criado_em)}</p> : null;
          diaAnterior = dia;
          if (m.tipo === "sistema") {
            return (<div key={m.id}>{separador}<p className="mx-auto w-fit max-w-[92%] rounded-xl bg-white px-3 py-1.5 text-center text-xs text-slate-600 shadow-sm [overflow-wrap:anywhere]">{m.texto}<span className="ml-1.5 text-slate-400">{horaMsg(m.criado_em)}</span></p></div>);
          }
          const meu = m.autor === eu;
          return (
            <div key={m.id}>
              {separador}
              <div className={clsx("flex items-end gap-2", meu && "flex-row-reverse")}>
                <Avatar usuario={m.autor} nome={nomes[m.autor]} tamanho={26} />
                <div className={clsx("max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm", meu ? "rounded-br-sm bg-sky-100 text-sky-950" : "rounded-bl-sm bg-white text-slate-800")}>
                  {!meu && <p className="mb-0.5 text-xs font-semibold text-slate-500">{nomes[m.autor] || m.autor}</p>}
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.texto}</p>
                  <p className="mt-0.5 text-right text-[10px] text-slate-400">{horaMsg(m.criado_em)}</p>
                </div>
              </div>
            </div>
          );
        })}
        {viram.length > 0 && <p className="text-right text-[11px] text-slate-400">Visualizado por {viram.join(", ")}</p>}
        <div ref={fim} />
      </div>
      <div className="border-t bg-white p-2" style={{ borderColor: "var(--hairline)" }}>
        <div className="flex items-end gap-2">
          <textarea
            className="input min-h-[44px] flex-1 resize-none py-2 text-sm" rows={2} placeholder="Escreva uma mensagem (Enter envia, Shift+Enter quebra a linha)" aria-label="Mensagem" value={texto} maxLength={5000}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
          />
          <button type="button" className="btn-primary h-11 w-11 shrink-0 p-0" onClick={enviar} disabled={enviando || !texto.trim()} aria-label="Enviar mensagem"><Send size={17} /></button>
        </div>
      </div>
    </div>
  );
}

export default function DetalheTarefa({ id, usuarios, agora, aoFechar, aoMudou, aoAbrirOutra, aoCriarSubtarefa }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [pendentes, setPendentes] = useState(0);
  const fila = useRef(Promise.resolve()); // as ações vão uma de cada vez, na ordem em que a pessoa clicou
  const ocupado = pendentes > 0;
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [novoItem, setNovoItem] = useState("");
  const [novoMarcador, setNovoMarcador] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [delegando, setDelegando] = useState(false);
  const [buscaDelegar, setBuscaDelegar] = useState("");

  const carregar = useCallback(async () => {
    try {
      const d = await tarefaObter(id);
      setDados(d);
      setErro("");
      return d;
    } catch (ex) {
      setErro(ex.message);
      return null;
    }
  }, [id]);

  // Abre e atualiza sozinho a cada 10 s enquanto a aba está visível (mensagens e mudanças dos outros).
  useEffect(() => {
    let vivo = true;
    carregar();
    const t = setInterval(() => { if (vivo && !document.hidden) carregar(); }, 10000);
    return () => { vivo = false; clearInterval(t); };
  }, [carregar]);

  const tarefa = dados?.tarefa;
  useEffect(() => { if (tarefa) { setTitulo(tarefa.titulo); setDescricao(tarefa.descricao); } }, [tarefa?.id, tarefa?.titulo, tarefa?.descricao]); // eslint-disable-line react-hooks/exhaustive-deps

  const executar = (acao) => {
    setPendentes((n) => n + 1);
    const feito = fila.current.then(async () => {
      setErro("");
      try {
        await acao();
        await carregar();
        aoMudou?.();
      } catch (ex) {
        setErro(ex.message);
        await carregar();
      }
    }).finally(() => setPendentes((n) => n - 1));
    fila.current = feito.catch(() => {});
    return feito;
  };

  const nomes = dados?.nomes || {};
  const pode = dados?.pode || {};
  const agrupado = useMemo(() => {
    const m = new Map();
    for (const i of dados?.checklist || []) m.set(i.grupo, [...(m.get(i.grupo) || []), i]);
    return [...m.entries()];
  }, [dados?.checklist]);
  const total = dados?.checklist.length || 0;
  const feitos = (dados?.checklist || []).filter((i) => i.feito).length;
  const atraso = tarefa && tarefa.status !== "concluida" ? diasDeAtraso(tarefa.prazo, agora) : 0;
  const st = tarefa ? STATUS_TAREFA[tarefa.status] : null;

  const salvarTexto = () => {
    const campos = {};
    if (titulo.trim() && titulo.trim() !== tarefa.titulo) campos.titulo = titulo;
    if (descricao.trim() !== (tarefa.descricao || "").trim()) campos.descricao = descricao;
    if (Object.keys(campos).length) void executar(() => tarefaAtualizar(id, campos));
  };
  // A caixinha muda na hora; se o servidor recusar, a recarga logo em seguida desfaz.
  const marcarItem = (item, feito) => {
    setDados((d) => (d ? { ...d, checklist: d.checklist.map((x) => (x.id === item.id ? { ...x, feito } : x)) } : d));
    void executar(() => tarefaChecklist(id, "marcar", { item_id: item.id, feito }));
  };
  const adicionarItem = () => { const t = novoItem.trim(); if (!t) return; setNovoItem(""); void executar(() => tarefaChecklist(id, "adicionar", { texto: t })); };
  const adicionarMarcador = () => {
    const t = novoMarcador.trim().replace(/^#/, "");
    setNovoMarcador("");
    if (t && !tarefa.marcadores.includes(t)) void executar(() => tarefaAtualizar(id, { marcadores: [...tarefa.marcadores, t] }));
  };

  return (
    <Modal titulo="Tarefa" aberto aoFechar={aoFechar} largura="max-w-6xl">
      {!dados && !erro && <p className="py-10 text-center text-sm text-slate-500">Abrindo a tarefa...</p>}
      {!dados && erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {dados && tarefa && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            {dados.pai && <p className="text-xs text-slate-500">Subtarefa de <button type="button" className="font-semibold text-brand-700 underline" onClick={() => aoAbrirOutra(dados.pai.id)}>{dados.pai.titulo}</button></p>}
            <div className="flex items-start gap-2">
              {pode.gerir ? (
                <textarea className="input min-h-[44px] flex-1 resize-none py-2 font-display text-lg font-semibold leading-snug" rows={1} aria-label="Nome da tarefa" value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} onBlur={salvarTexto} />
              ) : (
                <h3 className="flex-1 font-display text-lg font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">{tarefa.titulo}</h3>
              )}
              <button type="button" disabled={!pode.gerir || ocupado} onClick={() => executar(() => tarefaAtualizar(id, { urgente: !tarefa.urgente }))} aria-pressed={tarefa.urgente} title={tarefa.urgente ? "Urgente (clique para tirar a marca)" : "Marcar como urgente"} className={clsx("grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition", tarefa.urgente ? "border-orange-300 bg-orange-50 text-orange-600" : "text-slate-300", pode.gerir && !tarefa.urgente && "hover:text-orange-500")} style={tarefa.urgente ? undefined : { borderColor: "var(--hairline)" }}>
                <Flame size={20} aria-hidden="true" />
              </button>
            </div>

            {pode.gerir ? (
              <textarea className="input min-h-[72px] py-2 text-sm" rows={3} placeholder="Descrição" aria-label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} onBlur={salvarTexto} />
            ) : (
              tarefa.descricao ? <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700 [overflow-wrap:anywhere]">{tarefa.descricao}</p> : null
            )}

            <div className="rounded-xl border px-3 py-1.5" style={{ borderColor: "var(--hairline)" }}>
              <Linha rotulo="Proprietário"><Pessoa usuario={tarefa.proprietario} nomes={nomes} /></Linha>
              <Linha rotulo="Responsável">
                {pode.gerir
                  ? <SeletorPessoas usuarios={usuarios} valor={tarefa.responsavel} unico rotuloBotao="Passar para outra pessoa" onChange={(u) => u !== tarefa.responsavel && executar(() => tarefaDelegar(id, u))} />
                  : <Pessoa usuario={tarefa.responsavel} nomes={nomes} />}
              </Linha>
              <Linha rotulo="Prazo">
                <div className="flex flex-wrap items-center gap-2">
                  {pode.gerir ? (
                    <input type="datetime-local" className="input h-9 min-h-0 w-auto text-sm" aria-label="Prazo" value={paraInputLocal(tarefa.prazo)} onChange={(e) => executar(() => tarefaAtualizar(id, { prazo: deInputLocal(e.target.value) }))} />
                  ) : <span>{tarefa.prazo ? rotuloPrazo(tarefa.prazo, agora) : "Sem prazo"}</span>}
                  {pode.gerir && tarefa.prazo && <button type="button" className="text-xs text-slate-500 underline" onClick={() => executar(() => tarefaAtualizar(id, { prazo: null }))}>Sem prazo</button>}
                  {atraso > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Atrasado {atraso} dia{atraso > 1 ? "s" : ""}</span>}
                </div>
              </Linha>
              {tarefa.prazo && tarefa.status !== "concluida" && (pode.gerir || tarefa.lembrete !== null) && (
                <Linha rotulo="Lembrete">
                  {pode.gerir ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select className="input h-9 min-h-0 w-auto text-sm" aria-label="Lembrete" value={tarefa.lembrete ?? ""} onChange={(e) => executar(() => tarefaAtualizar(id, { lembrete: lembreteDoSelect(e.target.value) }))}>
                        {LEMBRETES.map((l) => <option key={String(l.valor)} value={l.valor ?? ""}>{l.rotulo}</option>)}
                      </select>
                      {quandoAvisa(tarefa.prazo, tarefa.lembrete) && <span className="text-xs text-slate-500">avisa {rotuloPrazo(quandoAvisa(tarefa.prazo, tarefa.lembrete), agora).toLowerCase()}</span>}
                    </div>
                  ) : <span>{rotuloLembrete(tarefa.lembrete)}</span>}
                </Linha>
              )}
              {dados.recorrencia && <Linha rotulo="Repete"><span className="text-slate-600">{resumoRecorrencia(dados.recorrencia)}{dados.recorrencia.ativa ? "" : " (pausada)"}</span></Linha>}
              <Linha rotulo="Situação"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.classe}`}>{st.rotulo}</span></Linha>
              <Linha rotulo="Criada em"><span className="text-slate-600">{rotuloPrazo(tarefa.criadoEm, agora)}</span></Linha>
              <Linha rotulo="Participantes">
                {pode.gerir
                  ? <SeletorPessoas usuarios={usuarios} valor={tarefa.participantes} onChange={(l) => executar(() => tarefaPessoas(id, l, tarefa.observadores))} ocultar={[tarefa.responsavel, tarefa.proprietario, ...tarefa.observadores]} vazio="Ninguém" />
                  : (tarefa.participantes.length ? <span className="flex flex-wrap gap-2">{tarefa.participantes.map((u) => <Pessoa key={u} usuario={u} nomes={nomes} />)}</span> : <span className="text-slate-400">Ninguém</span>)}
              </Linha>
              <Linha rotulo="Observadores">
                {pode.gerir
                  ? <SeletorPessoas usuarios={usuarios} valor={tarefa.observadores} onChange={(l) => executar(() => tarefaPessoas(id, tarefa.participantes, l))} ocultar={[tarefa.responsavel, tarefa.proprietario, ...tarefa.participantes]} vazio="Ninguém" />
                  : (tarefa.observadores.length ? <span className="flex flex-wrap gap-2">{tarefa.observadores.map((u) => <Pessoa key={u} usuario={u} nomes={nomes} />)}</span> : <span className="text-slate-400">Ninguém</span>)}
              </Linha>
              <Linha rotulo="Marcadores">
                <div className="flex flex-wrap items-center gap-1.5">
                  {tarefa.marcadores.map((m) => (
                    <span key={m} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">#{m}{pode.gerir && <button type="button" aria-label={`Remover marcador ${m}`} onClick={() => executar(() => tarefaAtualizar(id, { marcadores: tarefa.marcadores.filter((x) => x !== m) }))}><X size={11} /></button>}</span>
                  ))}
                  {pode.gerir && <input className="input h-8 min-h-0 w-36 text-xs" placeholder="Novo marcador" aria-label="Novo marcador" value={novoMarcador} maxLength={30} onChange={(e) => setNovoMarcador(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarMarcador(); } }} />}
                  {!pode.gerir && tarefa.marcadores.length === 0 && <span className="text-slate-400">Nenhum</span>}
                </div>
              </Linha>
            </div>

            <section aria-label="Lista de verificação" className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 font-display text-sm font-semibold text-slate-800"><ListChecks size={15} aria-hidden="true" />Lista de verificação</h4>
                {total > 0 && <span className="text-xs text-slate-500">Concluídos {feitos} de {total}</span>}
              </div>
              {total > 0 && <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progressoChecklist({ feitos, total })} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressoChecklist({ feitos, total })}%` }} /></div>}
              {agrupado.map(([grupo, itens]) => (
                <div key={grupo}>
                  {agrupado.length > 1 && <p className="mb-1 mt-2 text-xs font-semibold uppercase text-slate-400">{grupo}</p>}
                  <ul className="space-y-0.5">
                    {itens.map((i) => (
                      <li key={i.id} className="group flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-slate-50">
                        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-emerald-600" checked={i.feito} disabled={!pode.colaborar} aria-label={i.texto} onChange={(e) => marcarItem(i, e.target.checked)} />
                        <span className={clsx("min-w-0 flex-1 text-sm [overflow-wrap:anywhere]", i.feito && "text-slate-400 line-through")}>{i.texto}{i.feito && i.feito_por && <span className="ml-1.5 text-[11px] no-underline text-slate-400">({nomes[i.feito_por] || i.feito_por})</span>}</span>
                        {pode.colaborar && <button type="button" className="shrink-0 text-slate-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100 focus:opacity-100" aria-label={`Remover ${i.texto}`} onClick={() => executar(() => tarefaChecklist(id, "remover", { item_id: i.id }))}><X size={14} /></button>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {total === 0 && !pode.colaborar && <p className="text-sm text-slate-400">Sem itens.</p>}
              {pode.colaborar && (
                <div className="mt-2 flex gap-2">
                  <input className="input h-9 min-h-0 flex-1 text-sm" placeholder="Adicionar item e apertar Enter" aria-label="Novo item da lista de verificação" value={novoItem} maxLength={300} onChange={(e) => setNovoItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarItem(); } }} />
                  <button type="button" className="btn-outline h-9 min-h-0" onClick={adicionarItem} disabled={!novoItem.trim() || ocupado}><Plus size={14} />Item</button>
                </div>
              )}
            </section>

            <ArquivosTarefa id={id} anexos={dados.anexos || []} nomes={nomes} eu={dados.eu} pode={pode} executar={executar} />

            {(dados.subtarefas.length > 0 || pode.colaborar) && (
              <section aria-label="Subtarefas" className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
                <h4 className="mb-1.5 font-display text-sm font-semibold text-slate-800">Subtarefas</h4>
                <ul className="space-y-1">
                  {dados.subtarefas.map((s) => (
                    <li key={s.id}><button type="button" className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-slate-50" onClick={() => aoAbrirOutra(s.id)}><span className={clsx("h-2 w-2 shrink-0 rounded-full", s.status === "concluida" ? "bg-emerald-500" : "bg-sky-500")} /><span className={clsx("min-w-0 flex-1 [overflow-wrap:anywhere]", s.status === "concluida" && "text-slate-400 line-through")}>{s.titulo}</span></button></li>
                  ))}
                </ul>
                {pode.colaborar && <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline" onClick={() => aoCriarSubtarefa({ id: tarefa.id, titulo: tarefa.titulo })}><Plus size={14} />Adicionar subtarefa</button>}
              </section>
            )}

            {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

            <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-2 border-t bg-white px-1 pb-1 pt-3" style={{ borderColor: "var(--hairline)" }}>
              {tarefa.status !== "concluida" && pode.gerir && <button type="button" className="btn-primary" disabled={ocupado} onClick={() => executar(() => tarefaStatus(id, "concluir"))}><CheckCircle2 size={16} />Concluir</button>}
              {tarefa.status === "concluida" && pode.gerir && <button type="button" className="btn-primary" disabled={ocupado} onClick={() => executar(() => tarefaStatus(id, "reabrir"))}><RotateCcw size={16} />Reabrir</button>}
              {(tarefa.status === "nova" || tarefa.status === "aguardando") && pode.colaborar && <button type="button" className="btn-outline" disabled={ocupado} onClick={() => executar(() => tarefaStatus(id, "iniciar"))}><Play size={16} />Iniciar</button>}
              {(tarefa.status !== "concluida" || pode.excluir) && (
                <div className="relative">
                  <button type="button" className="btn-ghost h-10 w-10 p-0" aria-label="Mais opções" aria-expanded={menu} onClick={() => { setMenu((v) => !v); setConfirmaExcluir(false); }}><MoreHorizontal size={18} /></button>
                  {menu && (
                    <div className="absolute bottom-full left-0 z-40 mb-1 w-56 rounded-xl border bg-white p-1 shadow-lg" style={{ borderColor: "var(--hairline)" }}>
                      {!confirmaExcluir ? (
                        <>
                          {tarefa.status !== "concluida" && tarefa.status !== "aguardando" && pode.colaborar && (
                            <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setMenu(false); void executar(() => tarefaStatus(id, "pausar")); }}>Pausar<Hourglass size={15} className="text-slate-400" aria-hidden="true" /></button>
                          )}
                          {tarefa.status !== "concluida" && (
                            <button type="button" disabled={!pode.gerir} title={pode.gerir ? "Passar a tarefa para outra pessoa" : "Só o proprietário, o responsável ou a direção delegam"} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent" onClick={() => { setMenu(false); setBuscaDelegar(""); setDelegando(true); }}>
                              <span className="flex items-center gap-1.5">{!pode.gerir && <Lock size={13} className="text-sky-600" aria-hidden="true" />}Delegar</span>
                              <UserPlus size={15} className="text-slate-400" aria-hidden="true" />
                            </button>
                          )}
                          {pode.excluir && <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50" onClick={() => setConfirmaExcluir(true)}><Trash2 size={15} />Excluir tarefa</button>}
                        </>
                      ) : (
                        <div className="p-2 text-sm"><p className="mb-2 text-slate-700">Excluir esta tarefa para todos?</p>
                          <div className="flex gap-2"><button type="button" className="btn-outline h-9 min-h-0 flex-1" onClick={() => setConfirmaExcluir(false)}>Não</button><button type="button" className="h-9 flex-1 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700" onClick={() => executar(async () => { await tarefaExcluir(id); aoMudou?.(); aoFechar(); })}>Excluir</button></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500" title="Pessoas que já abriram a tarefa"><Eye size={14} aria-hidden="true" />{dados.visualizacoes.length + 1}</span>
            </div>
          </div>
          <div className="lg:sticky lg:top-0 lg:h-[min(40rem,calc(100dvh-9rem))] lg:self-start">
            <BatePapo dados={dados} aoEnviar={async (t) => { await tarefaMensagem(id, t); await carregar(); aoMudou?.(); }} />
          </div>
        </div>
      )}
      {delegando && (
        <Modal titulo="Passar a tarefa para outra pessoa" aberto aoFechar={() => setDelegando(false)} largura="max-w-sm">
          <div className="space-y-2">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input autoFocus className="input h-10 min-h-0 pl-9 text-sm" placeholder="Pesquisar pessoa" aria-label="Pesquisar pessoa" value={buscaDelegar} onChange={(e) => setBuscaDelegar(e.target.value)} />
            </div>
            <ul className="max-h-72 overflow-auto">
              {usuarios.filter((u) => u.usuario !== tarefa.responsavel && (!buscaDelegar.trim() || `${u.nome} ${u.usuario}`.toLowerCase().includes(buscaDelegar.trim().toLowerCase()))).map((u) => (
                <li key={u.usuario}>
                  <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50" onClick={() => { setDelegando(false); void executar(() => tarefaDelegar(id, u.usuario)); }}>
                    <Avatar usuario={u.usuario} nome={u.nome} tamanho={32} /><span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{u.nome}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
