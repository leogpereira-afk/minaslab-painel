// LABORATÓRIO · ENTRADAS DE AMOSTRAS — a planilha "Protocolo de entradas de
// amostras" dentro do painel. Tabela com filtro em cada coluna (mesmo desenho
// de Serviços Gerados), etapas calculadas e ações em lote para o descarte.
// Regras em ../../lib/laboratorioEntradas.js (com teste); colunas em
// ./colunasEntradas.jsx.
//
// A tabela rola DENTRO da tela: cabeçalho, filtros e barra de rolagem lateral
// ficam sempre à vista, OS fica presa à esquerda e o botão de abrir à direita.
// Clicar na linha também abre a entrada.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Columns3, Download, FlaskConical, HelpCircle, Lock, Pencil, Plus, RefreshCw, Search, Trash2, Timer, Send, Upload, Users, X } from "lucide-react";
import { listarEntradas, salvarEntrada, apagarEntrada, entradasEmLote, importarEntradas } from "../../services/laboratorio.js";
import { podeEditar, ehDirecao, getSessao } from "../../lib/sessao.js";
import { lerXlsx, converterPlanilha } from "../../lib/laboratorioImportacao.js";
import { ymdLocal } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import PaginacaoFinanceiro from "../financeiro/PaginacaoFinanceiro.jsx";
import { StatCard, CarregandoModulo, ErroModulo, Aviso } from "../ui.jsx";
import FormEntrada from "./FormEntrada.jsx";
import SetoresLaboratorio from "./SetoresLaboratorio.jsx";
import { COLUNAS, GRUPOS } from "./colunasEntradas.jsx";
import {
  ETAPAS, ENTRADA_VAZIA, FILTROS_VAZIOS, PRAZO_ALERTA_DIAS, DIAS_DESCARTE, SETORES,
  RESPONSAVEIS_RECEBIMENTO, RESPONSAVEIS_RETIRADA, agoraLocal, contagens,
  etapa, filtrar, linhaPlanilha, COLUNAS_PLANILHA, normalizarParaSalvar, opcoesDe, ordenar, tempoMedio,
} from "../../lib/laboratorioEntradas.js";

const ABAS = [
  ["TODAS", "Todas"], ["ABERTAS", "Em aberto"], ["RECEBIDA", "Recebidas"], ["EM_ANALISE", "Em análise"], ["FINALIZADA", "Finalizadas"],
  ["LIBERADA", "Liberadas"], ["DESCARTE_PENDENTE", "Descartar"], ["DESCARTADA", "Descartadas"], ["IMEDIATO", "Parâmetro imediato"],
  ["ATRASADAS", `Mais de ${PRAZO_ALERTA_DIAS} dias`], ["PENDENCIAS", "Com pendência"], ["CANCELADA", "Canceladas"],
];
const EXPLICA_ETAPA = [
  ["RECEBIDA", "tem data de recebimento e ainda nada do laboratório."],
  ["EM_ANALISE", "o laboratório retirou (data de retirada, responsável pela retirada ou alguma finalização MB/FQ preenchida)."],
  ["FINALIZADA", "\"Finalizado pelo laboratório\" = Sim, ainda sem liberação ao cliente."],
  ["LIBERADA", "tem data de liberação (ou \"Liberado\" = Sim); conta o prazo de descarte."],
  ["DESCARTE_PENDENTE", `passaram ${DIAS_DESCARTE} dias da liberação e ninguém marcou o descarte.`],
  ["DESCARTADA", "marcada como descartada."],
  ["CANCELADA", "OS cancelada (vale acima de tudo)."],
];

// Colunas ocultas: só no navegador de quem escolheu (não muda nada para os outros).
const chaveColunas = () => `lab-entradas:colunas-ocultas:${getSessao()?.usuario || "anonimo"}`;
function lerOcultas() {
  try { const v = JSON.parse(localStorage.getItem(chaveColunas()) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function gravarOcultas(v) {
  try { localStorage.setItem(chaveColunas(), JSON.stringify(v)); } catch { /* sem armazenamento: vale só nesta visita */ }
}

function EscolherColunas({ ocultas, setOcultas }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);
  const alternar = (id) => setOcultas(ocultas.includes(id) ? ocultas.filter((x) => x !== id) : [...ocultas, id]);
  return (
    <div ref={ref} className="relative">
      <button type="button" className={`btn-outline px-3 py-2 text-xs ${ocultas.length ? "border-blue-300 text-blue-700" : ""}`} onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
        <Columns3 size={14} aria-hidden="true" />Colunas{ocultas.length ? ` (${ocultas.length} ocultas)` : ""}
      </button>
      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <b className="text-slate-700">Mostrar colunas</b>
            <button type="button" className="text-blue-700 underline disabled:opacity-40" disabled={!ocultas.length} onClick={() => setOcultas([])}>Mostrar todas</button>
          </div>
          <p className="mb-2 text-[11px] text-slate-500">Vale só para você, neste navegador.</p>
          {["administrativo", "laboratorio", "acompanhamento", "ambos"].map((g) => (
            <div key={g} className="mb-2">
              <div className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${GRUPOS[g].classe}`}>{GRUPOS[g].rotulo}</div>
              {COLUNAS.filter((c) => c.setor === g).map((c) => (
                <label key={c.id} className={`flex items-center gap-2 py-0.5 ${c.fixa ? "text-slate-400" : "text-slate-700"}`}>
                  <input type="checkbox" disabled={c.fixa} checked={!ocultas.includes(c.id)} onChange={() => alternar(c.id)} />{c.rotulo}{c.fixa && " (sempre)"}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EntradasAmostras() {
  const [podeServidor, setPodeServidor] = useState(true);
  const [meusSetores, setMeusSetores] = useState([]);
  const direcao = ehDirecao();
  const pode = podeEditar(undefined, "laboratorio") && podeServidor;
  const podeAdm = direcao || (pode && meusSetores.includes("administrativo"));
  const podeLab = direcao || (pode && meusSetores.includes("laboratorio"));
  const [hoje, setHoje] = useState(() => ymdLocal(new Date()));
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState(null);
  const [aba, setAba] = useState("ABERTAS");
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(50);
  const [selecionados, setSelecionados] = useState([]);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState("");
  const [setoresAberto, setSetoresAberto] = useState(false);
  const [ocultas, setOcultasEstado] = useState(lerOcultas);
  const setOcultas = (v) => { setOcultasEstado(v); gravarOcultas(v); };
  const arquivoRef = useRef(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try { const r = await listarEntradas(); setLista(ordenar(r.itens)); setPodeServidor(r.podeEditar); setMeusSetores(r.setores); }
    catch (e) { setErro(e.message); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  // Aba aberta de um dia para o outro: o prazo de descarte tem de virar sozinho.
  useEffect(() => {
    const f = () => { if (document.visibilityState === "visible") setHoje(ymdLocal(new Date())); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  const todos = useMemo(() => lista || [], [lista]);
  const cont = useMemo(() => contagens(todos, hoje), [todos, hoje]);
  const medio = useMemo(() => tempoMedio(todos, hoje), [todos, hoje]);
  const itens = useMemo(() => filtrar(todos, { filtros, busca, aba, hoje }), [todos, filtros, busca, aba, hoje]);
  const optReceb = useMemo(() => opcoesDe(todos, "recebidoPor", RESPONSAVEIS_RECEBIMENTO), [todos]);
  const optRetir = useMemo(() => opcoesDe(todos, "retiradoPor", RESPONSAVEIS_RETIRADA), [todos]);
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const pag = Math.min(pagina, totalPaginas);
  const itensPagina = itens.slice((pag - 1) * porPagina, pag * porPagina);
  useEffect(() => { setPagina(1); }, [filtros, busca, aba, porPagina]);
  const filtrosAtivos = busca || Object.values(filtros).some(Boolean);
  const limpar = () => { setFiltros(FILTROS_VAZIOS); setBusca(""); };
  const ctx = {
    filtros, hoje, optReceb, optRetir,
    setF: (campo) => (v) => setFiltros((x) => ({ ...x, [campo]: v })),
    periodo: (de, ate) => ({ de: filtros[de], ate: filtros[ate], onApply: (a, b) => setFiltros((x) => ({ ...x, [de]: a, [ate]: b })) }),
  };
  const visiveis = COLUNAS.filter((c) => c.fixa || !ocultas.includes(c.id));
  const [colOs, ...demais] = visiveis;
  // Faixa de setor acima do cabeçalho: junta colunas vizinhas do mesmo setor.
  const faixas = demais.reduce((acc, c) => {
    const ult = acc[acc.length - 1];
    if (ult && ult.setor === c.setor) ult.n += 1; else acc.push({ setor: c.setor, n: 1 });
    return acc;
  }, []);

  const loteVisivel = podeAdm || podeLab;
  const selecionaveis = itensPagina.filter((e) => !["DESCARTADA", "CANCELADA"].includes(etapa(e, hoje)));
  const todosPagina = selecionaveis.length > 0 && selecionaveis.every((e) => selecionados.includes(e.id));
  const alternarPagina = () => setSelecionados((s) => todosPagina ? s.filter((id) => !selecionaveis.some((e) => e.id === id)) : [...new Set([...s, ...selecionaveis.map((e) => e.id)])]);
  const alternar = (id) => setSelecionados((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const escolhidos = todos.filter((e) => selecionados.includes(e.id));

  async function gravar(f) {
    setSalvando(true);
    try {
      const reg = normalizarParaSalvar(f);
      if (!reg.id) delete reg.id;
      await salvarEntrada(reg);
      setEditando(null);
      setAviso({ tipo: "ok", texto: `Entrada da OS ${reg.os} gravada.` });
      await carregar();
    } catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
    finally { setSalvando(false); }
  }
  async function excluir(e) {
    if (!window.confirm(`Excluir a entrada da OS ${e.os}? Essa ação não pode ser desfeita pela tela.`)) return;
    setSalvando(true);
    try { await apagarEntrada(e.id); setEditando(null); setAviso({ tipo: "ok", texto: `Entrada da OS ${e.os} excluída.` }); await carregar(); }
    catch (err) { setAviso({ tipo: "erro", texto: err.message }); }
    finally { setSalvando(false); }
  }
  // Ação em lote: uma chamada só; o servidor pula as que já estavam no estado e devolve quantas mudou.
  async function emLote(tipo) {
    const alvo = tipo === "liberar" ? escolhidos.filter((e) => !e.liberadoEm && !e.liberadoCliente) : escolhidos.filter((e) => !e.descartado);
    if (!alvo.length) { setAviso({ tipo: "aviso", texto: tipo === "liberar" ? "As selecionadas já estão liberadas." : "As selecionadas já estão descartadas." }); return; }
    const texto = tipo === "liberar" ? `Liberar ${alvo.length} entrada(s) para o cliente com a data/hora de agora?` : `Marcar ${alvo.length} entrada(s) como descartada(s) agora?`;
    if (!window.confirm(texto)) return;
    setSalvando(true);
    try {
      const r = await entradasEmLote(tipo, alvo.map((e) => e.id), agoraLocal());
      setSelecionados([]);
      setAviso({ tipo: "ok", texto: `${r.feitos} entrada(s) ${tipo === "liberar" ? "liberada(s)" : "descartada(s)"}.` });
    } catch (err) { setAviso({ tipo: "erro", texto: err.message }); }
    finally { setSalvando(false); await carregar(); }
  }
  async function importar(ev) {
    const arq = ev.target.files?.[0];
    ev.target.value = "";
    if (!arq) return;
    try {
      setImportando("Lendo a planilha…");
      const regs = converterPlanilha(lerXlsx(new Uint8Array(await arq.arrayBuffer())), { arquivo: arq.name });
      if (!regs.length) throw new Error("Nenhuma linha de amostra encontrada (os dados começam na linha 3, como na planilha original).");
      const pend = regs.filter((r) => r.pendencias.length).length;
      if (!window.confirm(`${regs.length} linhas lidas${pend ? `, ${pend} com datas/campos para revisar` : ""}. Importar? Só entram as que ainda não estão no sistema.`)) return;
      const r = await importarEntradas(regs, (feito, total) => setImportando(`Importando ${feito} de ${total}…`));
      setAviso({ tipo: "ok", texto: `${r.inseridos} entrada(s) importada(s); ${r.existentes} já estavam no sistema${r.invalidos ? `; ${r.invalidos} recusada(s)` : ""}.` });
      await carregar();
    } catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
    finally { setImportando(""); }
  }
  function exportar() {
    try {
      const nome = baixarPlanilha({ nome: "entradas-de-amostras", titulo: `Entradas de amostras — ${ABAS.find((a) => a[0] === aba)?.[1] || ""} (${itens.length})`, colunas: COLUNAS_PLANILHA, linhas: itens.map((e) => linhaPlanilha(e, hoje)) });
      setAviso({ tipo: "ok", texto: `Planilha ${nome} baixada.` });
    } catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
  }
  const nova = () => setEditando({ ...ENTRADA_VAZIA, recebidoEm: agoraLocal(), tipos: [], origem: ["INTERNO"] });
  const abrirLinha = (ev, e) => { if (ev.target.closest("input,button,a,label")) return; setEditando(e); };

  if (carregando && !lista) return <CarregandoModulo />;
  if (!lista) return <ErroModulo mensagem={erro || "Não foi possível carregar as entradas."} aoTentar={carregar} />;

  const fundo = (e, et) => selecionados.includes(e.id) ? "bg-blue-50" : et === "DESCARTE_PENDENTE" ? "bg-red-50" : "bg-white group-hover:bg-slate-50";

  return (
    <div className="space-y-4">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard rotulo="Em aberto" valor={String(cont.ABERTAS)} sub="Recebidas, em análise ou finalizadas" icone={FlaskConical} tom="brand" onClick={() => setAba("ABERTAS")} ativo={aba === "ABERTAS"} />
        <StatCard rotulo={`Mais de ${PRAZO_ALERTA_DIAS} dias`} valor={String(cont.ATRASADAS)} sub="Em aberto sem liberação" icone={Clock3} tom={cont.ATRASADAS ? "bad" : "neutral"} onClick={() => setAba("ATRASADAS")} ativo={aba === "ATRASADAS"} />
        <StatCard rotulo="Parâmetro imediato" valor={String(cont.IMEDIATO)} sub="Em aberto, com urgência" icone={AlertTriangle} tom={cont.IMEDIATO ? "warn" : "neutral"} onClick={() => setAba("IMEDIATO")} ativo={aba === "IMEDIATO"} />
        <StatCard rotulo="Descartar" valor={String(cont.DESCARTE_PENDENTE)} sub={`Passaram ${DIAS_DESCARTE} dias da liberação`} icone={Trash2} tom={cont.DESCARTE_PENDENTE ? "bad" : "neutral"} onClick={() => setAba("DESCARTE_PENDENTE")} ativo={aba === "DESCARTE_PENDENTE"} />
        <StatCard rotulo="Tempo médio" valor={medio === null ? "—" : `${String(medio).replace(".", ",")} dias`} sub="Recebimento → liberação (30 dias)" icone={Timer} />
      </div>

      <section className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-2.5 text-slate-400" aria-hidden="true" /><input className="input h-9 w-full py-1 pl-9 text-xs" aria-label="Buscar entradas" placeholder="Buscar por OS, amostra, responsável, observação…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <button className="btn-outline px-3 py-2 text-xs" onClick={limpar} disabled={!filtrosAtivos}><X size={14} aria-hidden="true" />Limpar filtros</button>
          <EscolherColunas ocultas={ocultas} setOcultas={setOcultas} />
          <button className="btn-outline px-3 py-2 text-xs" onClick={carregar} disabled={carregando}><RefreshCw size={14} className={carregando ? "animate-spin" : ""} aria-hidden="true" />Atualizar</button>
          <button className="btn-outline px-3 py-2 text-xs" onClick={exportar} disabled={!itens.length}><Download size={14} aria-hidden="true" />Exportar</button>
          {direcao && <button className="btn-outline px-3 py-2 text-xs" onClick={() => setSetoresAberto(true)}><Users size={14} aria-hidden="true" />Setores</button>}
          {direcao && <button className="btn-outline px-3 py-2 text-xs" onClick={() => arquivoRef.current?.click()} disabled={!!importando} title="Importar a planilha PROTOCOLO DE ENTRADAS DE AMOSTRAS (.xlsx)"><Upload size={14} aria-hidden="true" />{importando || "Importar planilha"}</button>}
          {direcao && <input ref={arquivoRef} type="file" accept=".xlsx" className="hidden" onChange={importar} />}
          {podeAdm && <button className="btn-primary px-3 py-2 text-xs" onClick={nova}><Plus size={14} aria-hidden="true" />Nova entrada</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-600">
          <span>Você edita:</span>
          {direcao ? <span className="rounded-full bg-slate-800 px-2 py-0.5 font-semibold text-white">tudo (direção)</span>
            : [podeAdm && "administrativo", podeLab && "laboratorio"].filter(Boolean).map((s) => <span key={s} className={`rounded-full px-2 py-0.5 font-semibold ${SETORES[s].classe}`}>{SETORES[s].rotulo}</span>)}
          {!direcao && !podeAdm && !podeLab && <span className="inline-flex items-center gap-1 font-semibold text-slate-500"><Lock size={12} aria-hidden="true" />só consulta — peça à direção para incluir você em um setor</span>}
          <details className="ml-auto">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-blue-700"><HelpCircle size={13} aria-hidden="true" />Como a etapa é calculada</summary>
            <div className="absolute right-4 z-40 mt-1 w-[min(92vw,460px)] rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-xl">
              <p className="mb-2">Ninguém digita a etapa: o sistema olha as datas da linha, na ordem abaixo.</p>
              <ul className="space-y-1">{EXPLICA_ETAPA.map(([k, t]) => <li key={k}><span className={`mr-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ETAPAS[k].classe}`}>{ETAPAS[k].rotulo}</span>{t}</li>)}</ul>
              <p className="mt-2">“Dias” = dias corridos do recebimento até a liberação (ou até hoje, se ainda aberta). Em vermelho quando passa de {PRAZO_ALERTA_DIAS}.</p>
            </div>
          </details>
        </div>
        {loteVisivel && escolhidos.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-blue-50 px-3 py-2 text-xs">
            <span className="font-medium text-blue-900"><b>{escolhidos.length}</b> entrada(s) selecionada(s)</span>
            <span className="flex flex-wrap gap-2">
              <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setSelecionados([])}>Limpar seleção</button>
              {podeLab && <button className="btn-outline px-3 py-1.5 text-xs" disabled={salvando} onClick={() => emLote("liberar")}><Send size={14} aria-hidden="true" />Liberar para o cliente</button>}
              {podeLab && <button className="btn-primary px-3 py-1.5 text-xs" disabled={salvando} onClick={() => emLote("descartar")}><CheckCircle2 size={14} aria-hidden="true" />Marcar como descartadas</button>}
              {!podeLab && <span className="text-blue-900">Liberar e descartar são do setor Laboratório.</span>}
            </span>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto border-b px-3 py-2">
          {ABAS.map(([k, n]) => <button key={k} onClick={() => setAba(k)} className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${aba === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{n} ({k === "TODAS" ? cont.TODAS : cont[k] || 0})</button>)}
        </div>
        <div className="max-h-[calc(100vh-240px)] min-h-[360px] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-[11px]">
            <thead className="sticky top-0 z-20 text-left text-[10px] text-slate-500">
              <tr>
                <th className="sticky left-0 z-30 border-b border-r bg-slate-50" />
                {faixas.map((f, i) => <th key={i} colSpan={f.n} className={`border-b border-l border-white px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${GRUPOS[f.setor].classe}`}>{GRUPOS[f.setor].rotulo}</th>)}
                <th className="sticky right-0 z-30 border-b border-l bg-slate-50" />
              </tr>
              <tr className="uppercase">
                <th className="sticky left-0 z-30 min-w-[140px] border-r bg-slate-50 px-2 py-2">
                  <span className="flex items-center gap-2">{loteVisivel && <input type="checkbox" checked={todosPagina} onChange={alternarPagina} aria-label="Selecionar as entradas desta página" title="Selecionar as entradas desta página" />}{colOs.rotulo}</span>
                </th>
                {demais.map((c) => <th key={c.id} className="whitespace-nowrap bg-slate-50 px-2 py-2">{c.rotulo}</th>)}
                <th className="sticky right-0 z-30 border-l bg-slate-50 px-2 py-2 text-right">Abrir</th>
              </tr>
              <tr className="align-top">
                <th className="sticky left-0 z-30 border-b border-r bg-white p-1">{colOs.filtro(ctx)}</th>
                {demais.map((c) => <th key={c.id} className="border-b bg-white p-1">{c.filtro ? c.filtro(ctx) : null}</th>)}
                <th className="sticky right-0 z-30 border-b border-l bg-white" />
              </tr>
            </thead>
            <tbody>
              {itensPagina.map((e) => {
                const et = etapa(e, hoje);
                const bg = fundo(e, et);
                const marcavel = loteVisivel && !["DESCARTADA", "CANCELADA"].includes(et);
                return (
                  <tr key={e.id} className="group cursor-pointer" onClick={(ev) => abrirLinha(ev, e)}>
                    <td className={`sticky left-0 z-10 border-r border-t px-2 py-2 ${bg}`}>
                      <span className="flex items-center gap-2">
                        {loteVisivel && <input type="checkbox" className={marcavel ? "" : "invisible"} disabled={!marcavel} checked={selecionados.includes(e.id)} onChange={() => alternar(e.id)} aria-label={`Selecionar OS ${e.os}`} />}
                        {colOs.celula(e, ctx)}
                      </span>
                    </td>
                    {demais.map((c) => <td key={c.id} className={`border-t px-2 py-2 ${bg} ${c.classe || ""}`}>{c.celula(e, ctx)}</td>)}
                    <td className={`sticky right-0 z-10 border-l border-t px-2 py-1.5 text-right ${bg}`}>
                      <button className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-100" onClick={() => setEditando(e)} title={podeAdm || podeLab ? "Ver / editar" : "Ver"} aria-label={`Abrir OS ${e.os}`}>{podeAdm || podeLab ? <Pencil size={14} /> : <Search size={14} />}</button>
                    </td>
                  </tr>
                );
              })}
              {!itens.length && <tr><td colSpan={visiveis.length + 1} className="p-8 text-center text-slate-500">{todos.length ? "Nenhuma entrada com esses filtros." : "Nenhuma entrada cadastrada ainda."}</td></tr>}
            </tbody>
          </table>
        </div>
        <PaginacaoFinanceiro total={itens.length} pagina={pag} paginas={totalPaginas} porPagina={porPagina} itensNaPagina={itensPagina.length} onPorPagina={setPorPagina} onPagina={setPagina}
          extra={itens.length !== todos.length ? <span className="ml-2 text-[10px] text-slate-400">({todos.length} entradas no total)</span> : null} />
      </section>

      {editando && (
        <FormEntrada key={editando.id || "nova"} aberto entrada={editando} lista={todos} opcoesRecebimento={optReceb} opcoesRetirada={optRetir}
          podeAdm={podeAdm} podeLab={podeLab} salvando={salvando} aoFechar={() => setEditando(null)} aoSalvar={gravar} aoExcluir={excluir} />
      )}
      {setoresAberto && <SetoresLaboratorio aberto aoFechar={() => setSetoresAberto(false)} aoSalvo={() => { setAviso({ tipo: "ok", texto: "Setores gravados." }); carregar(); }} />}
    </div>
  );
}
