// LABORATÓRIO · ENTRADAS DE AMOSTRAS — a planilha "Protocolo de entradas de
// amostras" dentro do painel. Tabela com filtro em cada coluna (mesmo desenho
// de Serviços Gerados), etapas calculadas e ações em lote para o descarte.
// Regras em ../../lib/laboratorioEntradas.js (com teste).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Download, FlaskConical, Pencil, Plus, RefreshCw, Search, Trash2, X, Filter, Timer, Send, Upload } from "lucide-react";
import { listarEntradas, salvarEntrada, apagarEntrada, entradasEmLote, importarEntradas } from "../../services/laboratorio.js";
import { podeEditar, ehDirecao } from "../../lib/sessao.js";
import { lerXlsx, converterPlanilha } from "../../lib/laboratorioImportacao.js";
import { ymdLocal } from "../../lib/format.js";
import { baixarPlanilha } from "../../lib/planilha.js";
import PeriodoFiltro from "../PeriodoFiltro.jsx";
import PaginacaoFinanceiro from "../financeiro/PaginacaoFinanceiro.jsx";
import { StatCard, CarregandoModulo, ErroModulo, Aviso } from "../ui.jsx";
import FormEntrada from "./FormEntrada.jsx";
import {
  ETAPAS, ENTRADA_VAZIA, FILTROS_VAZIOS, PRAZO_ALERTA_DIAS, TIPOS_ANALISE, ORIGENS,
  RESPONSAVEIS_RECEBIMENTO, RESPONSAVEIS_RETIRADA, agoraLocal, atrasada, contagens, dataHora, diasAtendimento,
  etapa, filtrar, linhaPlanilha, COLUNAS_PLANILHA, normalizarParaSalvar, opcoesDe, ordenar, prazoDescarte, tempoMedio,
} from "../../lib/laboratorioEntradas.js";

const filtroInput = "h-7 w-full min-w-[78px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-normal text-slate-700 outline-none focus:border-blue-400";
const ABAS = [
  ["TODAS", "Todas"], ["ABERTAS", "Em aberto"], ["RECEBIDA", "Recebidas"], ["EM_ANALISE", "Em análise"], ["FINALIZADA", "Finalizadas"],
  ["LIBERADA", "Liberadas"], ["DESCARTE_PENDENTE", "Descartar"], ["DESCARTADA", "Descartadas"], ["IMEDIATO", "Parâmetro imediato"],
  ["ATRASADAS", `Mais de ${PRAZO_ALERTA_DIAS} dias`], ["PENDENCIAS", "Com pendência"], ["CANCELADA", "Canceladas"],
];
const sn = (v) => (v === true ? "SIM" : v === false ? "NÃO" : "—");
const Pill = ({ et }) => <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${ETAPAS[et].classe}`}>{ETAPAS[et].rotulo}</span>;
const Lista = ({ v }) => (v?.length ? v.join(", ") : "—");

function FiltroTexto({ valor, onChange, placeholder }) {
  return <div className="relative"><Filter size={11} className="absolute left-2 top-2 text-slate-400" aria-hidden="true" /><input className={`${filtroInput} pl-6`} aria-label={`Filtrar ${placeholder}`} placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} /></div>;
}
function FiltroSelect({ valor, onChange, opcoes, rotulo }) {
  return <select className={filtroInput} aria-label={`Filtrar ${rotulo}`} value={valor} onChange={(e) => onChange(e.target.value)}><option value="">Todos</option>{opcoes.map((o) => Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>)}</select>;
}

export default function EntradasAmostras() {
  const [podeServidor, setPodeServidor] = useState(true);
  const pode = podeEditar(undefined, "laboratorio") && podeServidor;
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
  const arquivoRef = useRef(null);
  const direcao = ehDirecao();

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try { const r = await listarEntradas(); setLista(ordenar(r.itens)); setPodeServidor(r.podeEditar); }
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
  const setF = (campo) => (v) => setFiltros((x) => ({ ...x, [campo]: v }));
  const periodo = (de, ate) => ({ de: filtros[de], ate: filtros[ate], onApply: (a, b) => setFiltros((x) => ({ ...x, [de]: a, [ate]: b })) });
  const filtrosAtivos = busca || Object.values(filtros).some(Boolean);
  const limpar = () => { setFiltros(FILTROS_VAZIOS); setBusca(""); };

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

  if (carregando && !lista) return <CarregandoModulo />;
  if (!lista) return <ErroModulo mensagem={erro || "Não foi possível carregar as entradas."} aoTentar={carregar} />;

  return (
    <div className="space-y-4">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard rotulo="Em aberto" valor={String(cont.ABERTAS)} sub="Recebidas, em análise ou finalizadas" icone={FlaskConical} tom="brand" onClick={() => setAba("ABERTAS")} ativo={aba === "ABERTAS"} />
        <StatCard rotulo={`Mais de ${PRAZO_ALERTA_DIAS} dias`} valor={String(cont.ATRASADAS)} sub="Em aberto sem liberação" icone={Clock3} tom={cont.ATRASADAS ? "bad" : "neutral"} onClick={() => setAba("ATRASADAS")} ativo={aba === "ATRASADAS"} />
        <StatCard rotulo="Parâmetro imediato" valor={String(cont.IMEDIATO)} sub="Em aberto, com urgência" icone={AlertTriangle} tom={cont.IMEDIATO ? "warn" : "neutral"} onClick={() => setAba("IMEDIATO")} ativo={aba === "IMEDIATO"} />
        <StatCard rotulo="Descartar" valor={String(cont.DESCARTE_PENDENTE)} sub="Passaram 5 dias da liberação" icone={Trash2} tom={cont.DESCARTE_PENDENTE ? "bad" : "neutral"} onClick={() => setAba("DESCARTE_PENDENTE")} ativo={aba === "DESCARTE_PENDENTE"} />
        <StatCard rotulo="Tempo médio" valor={medio === null ? "—" : `${String(medio).replace(".", ",")} dias`} sub="Recebimento → liberação (30 dias)" icone={Timer} />
      </div>

      <section className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[240px] flex-1"><Search size={15} className="absolute left-3 top-2.5 text-slate-400" aria-hidden="true" /><input className="input h-9 w-full py-1 pl-9 text-xs" aria-label="Buscar entradas" placeholder="Buscar por OS, amostra, responsável, observação…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <button className="btn-outline px-3 py-2 text-xs" onClick={limpar} disabled={!filtrosAtivos}><X size={14} aria-hidden="true" />Limpar filtros</button>
          <button className="btn-outline px-3 py-2 text-xs" onClick={carregar} disabled={carregando}><RefreshCw size={14} className={carregando ? "animate-spin" : ""} aria-hidden="true" />Atualizar</button>
          <button className="btn-outline px-3 py-2 text-xs" onClick={exportar} disabled={!itens.length}><Download size={14} aria-hidden="true" />Exportar planilha</button>
          {direcao && <button className="btn-outline px-3 py-2 text-xs" onClick={() => arquivoRef.current?.click()} disabled={!!importando} title="Importar a planilha PROTOCOLO DE ENTRADAS DE AMOSTRAS (.xlsx)"><Upload size={14} aria-hidden="true" />{importando || "Importar planilha"}</button>}
          {direcao && <input ref={arquivoRef} type="file" accept=".xlsx" className="hidden" onChange={importar} />}
          {pode && <button className="btn-primary px-3 py-2 text-xs" onClick={nova}><Plus size={14} aria-hidden="true" />Nova entrada</button>}
        </div>
        {pode && escolhidos.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-blue-50 px-3 py-2 text-xs">
            <span className="font-medium text-blue-900"><b>{escolhidos.length}</b> entrada(s) selecionada(s)</span>
            <span className="flex flex-wrap gap-2">
              <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setSelecionados([])}>Limpar seleção</button>
              <button className="btn-outline px-3 py-1.5 text-xs" disabled={salvando} onClick={() => emLote("liberar")}><Send size={14} aria-hidden="true" />Liberar para o cliente</button>
              <button className="btn-primary px-3 py-1.5 text-xs" disabled={salvando} onClick={() => emLote("descartar")}><CheckCircle2 size={14} aria-hidden="true" />Marcar como descartadas</button>
            </span>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto border-b px-3 py-2">
          {ABAS.map(([k, n]) => <button key={k} onClick={() => setAba(k)} className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${aba === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{n} ({k === "TODAS" ? cont.TODAS : cont[k] || 0})</button>)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2050px] text-[11px]">
            <thead className="bg-slate-50 text-left text-[10px] text-slate-500">
              <tr className="uppercase">
                <th className="w-[34px] px-2 py-2">{pode && <input type="checkbox" checked={todosPagina} onChange={alternarPagina} aria-label="Selecionar as entradas desta página" title="Selecionar as entradas desta página" />}</th>
                <th className="w-[95px] px-2 py-2">OS</th><th className="w-[150px] px-2">Nº amostra(s)</th><th className="px-2">Recebimento</th><th className="px-2">Recebido por</th>
                <th className="px-2">Tipo</th><th className="px-2">Imediato</th><th className="px-2">Interno / provedor</th><th className="px-2">Retirado por</th>
                <th className="px-2">Retirada lab.</th><th className="px-2">Retirada comercial</th><th className="px-2">Finalizado</th><th className="px-2">Final. MB</th>
                <th className="px-2">Final. FQ</th><th className="px-2">Liberado</th><th className="px-2">Liberação</th><th className="px-2">Descarte</th>
                <th className="px-2">Etapa</th><th className="px-2">Dias</th><th className="min-w-[200px] px-2">Observação</th><th className="px-2 text-right">Ações</th>
              </tr>
              <tr className="border-t border-slate-200 bg-white align-top">
                <th />
                <th className="p-1"><FiltroTexto valor={filtros.os} onChange={setF("os")} placeholder="OS" /></th>
                <th className="p-1"><FiltroTexto valor={filtros.amostras} onChange={setF("amostras")} placeholder="Amostra" /></th>
                <th className="p-1.5"><PeriodoFiltro label="Recebimento" {...periodo("recebidoDe", "recebidoAte")} /></th>
                <th className="p-1.5"><FiltroSelect rotulo="recebido por" valor={filtros.recebidoPor} onChange={setF("recebidoPor")} opcoes={optReceb} /></th>
                <th className="p-1.5"><FiltroSelect rotulo="tipo" valor={filtros.tipo} onChange={setF("tipo")} opcoes={TIPOS_ANALISE} /></th>
                <th className="p-1.5"><FiltroSelect rotulo="parâmetro imediato" valor={filtros.imediato} onChange={setF("imediato")} opcoes={[["SIM", "Sim"], ["NAO", "Não"]]} /></th>
                <th className="p-1.5"><FiltroSelect rotulo="interno ou provedor" valor={filtros.origem} onChange={setF("origem")} opcoes={ORIGENS} /></th>
                <th className="p-1.5"><FiltroSelect rotulo="retirado por" valor={filtros.retiradoPor} onChange={setF("retiradoPor")} opcoes={optRetir} /></th>
                <th className="p-1.5"><PeriodoFiltro label="Retirada lab." {...periodo("retiradaDe", "retiradaAte")} /></th>
                <th className="p-1.5"><PeriodoFiltro label="Comercial" {...periodo("comercialDe", "comercialAte")} /></th>
                <th className="p-1.5"><FiltroSelect rotulo="finalizado" valor={filtros.finalizado} onChange={setF("finalizado")} opcoes={[["SIM", "Sim"], ["NAO", "Não"]]} /></th>
                <th className="p-1.5"><PeriodoFiltro label="Final. MB" {...periodo("mbDe", "mbAte")} /></th>
                <th className="p-1.5"><PeriodoFiltro label="Final. FQ" {...periodo("fqDe", "fqAte")} /></th>
                <th className="p-1.5"><FiltroSelect rotulo="liberado" valor={filtros.liberado} onChange={setF("liberado")} opcoes={[["SIM", "Sim"], ["NAO", "Não"]]} /></th>
                <th className="p-1.5"><PeriodoFiltro label="Liberação" {...periodo("liberadoDe", "liberadoAte")} /></th>
                <th />
                <th className="p-1.5"><FiltroSelect rotulo="etapa" valor={filtros.etapa} onChange={setF("etapa")} opcoes={Object.entries(ETAPAS).map(([k, v]) => [k, v.rotulo])} /></th>
                <th />
                <th className="p-1"><FiltroTexto valor={filtros.observacao} onChange={setF("observacao")} placeholder="Observação" /></th>
                <th />
              </tr>
            </thead>
            <tbody>
              {itensPagina.map((e) => {
                const et = etapa(e, hoje);
                const dias = diasAtendimento(e, hoje);
                const marcavel = pode && !["DESCARTADA", "CANCELADA"].includes(et);
                return (
                  <tr key={e.id} className={`border-t hover:bg-slate-50 ${et === "DESCARTE_PENDENTE" ? "bg-red-50/40" : ""} ${selecionados.includes(e.id) ? "bg-blue-50/60" : ""}`}>
                    <td className="px-2 py-2">{marcavel && <input type="checkbox" checked={selecionados.includes(e.id)} onChange={() => alternar(e.id)} aria-label={`Selecionar OS ${e.os}`} />}</td>
                    <td className="whitespace-nowrap px-2 py-2 font-semibold text-slate-800">
                      {e.os || "—"}
                      {e.parametroImediato && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700" title="Possui parâmetro imediato">Imed.</span>}
                      {!!e.pendencias?.length && <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700" title={e.pendencias.join("\n")}>Revisar</span>}
                    </td>
                    <td className="max-w-[170px] truncate px-2 py-2" title={e.amostras}>{e.amostras || "—"}{e.qtdAmostras > 1 && <span className="ml-1 text-[9px] text-slate-400">({e.qtdAmostras})</span>}</td>
                    <td className="whitespace-nowrap px-2 py-2">{dataHora(e.recebidoEm) || "—"}</td>
                    <td className="max-w-[140px] truncate px-2 py-2" title={(e.recebidoPor || []).join(", ")}><Lista v={e.recebidoPor} /></td>
                    <td className="whitespace-nowrap px-2 py-2"><Lista v={e.tipos} /></td>
                    <td className="px-2 py-2">{sn(e.parametroImediato)}</td>
                    <td className="whitespace-nowrap px-2 py-2"><Lista v={e.origem} /></td>
                    <td className="max-w-[140px] truncate px-2 py-2" title={(e.retiradoPor || []).join(", ")}><Lista v={e.retiradoPor} /></td>
                    <td className="whitespace-nowrap px-2 py-2">{dataHora(e.retiradaLabEm) || "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2">{dataHora(e.retiradaComercialEm) || "—"}</td>
                    <td className="px-2 py-2">{sn(e.finalizadoLab)}</td>
                    <td className="whitespace-nowrap px-2 py-2">{dataHora(e.finalizadoMbEm) || "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2">{dataHora(e.finalizadoFqEm) || "—"}</td>
                    <td className="px-2 py-2">{sn(e.liberadoEm ? true : e.liberadoCliente)}</td>
                    <td className="whitespace-nowrap px-2 py-2">{dataHora(e.liberadoEm) || "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2">{e.descartado ? <span className="text-slate-500">Feito{e.descartadoEm ? ` ${dataHora(e.descartadoEm)}` : ""}</span> : prazoDescarte(e) ? <span className={et === "DESCARTE_PENDENTE" ? "font-semibold text-red-700" : ""}>{dataHora(prazoDescarte(e))}</span> : "—"}</td>
                    <td className="px-2 py-2"><Pill et={et} /></td>
                    <td className={`px-2 py-2 text-right tabular-nums ${atrasada(e, hoje) ? "font-semibold text-red-700" : ""}`}>{dias ?? "—"}</td>
                    <td className="max-w-[260px] truncate px-2 py-2 text-[10px] text-slate-600" title={e.observacao}>{e.observacao || "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50" onClick={() => setEditando(e)} title={pode ? "Visualizar / editar" : "Visualizar"} aria-label={`Abrir OS ${e.os}`}>{pode ? <Pencil size={14} /> : <Search size={14} />}</button>
                    </td>
                  </tr>
                );
              })}
              {!itens.length && <tr><td colSpan="21" className="p-8 text-center text-slate-500">{todos.length ? "Nenhuma entrada com esses filtros." : "Nenhuma entrada cadastrada ainda."}</td></tr>}
            </tbody>
          </table>
        </div>
        <PaginacaoFinanceiro total={itens.length} pagina={pag} paginas={totalPaginas} porPagina={porPagina} itensNaPagina={itensPagina.length} onPorPagina={setPorPagina} onPagina={setPagina}
          extra={itens.length !== todos.length ? <span className="ml-2 text-[10px] text-slate-400">({todos.length} entradas no total)</span> : null} />
      </section>

      {editando && (
        <FormEntrada key={editando.id || "nova"} aberto entrada={editando} lista={todos} opcoesRecebimento={optReceb} opcoesRetirada={optRetir}
          somenteLeitura={!pode} salvando={salvando} aoFechar={() => setEditando(null)} aoSalvar={gravar} aoExcluir={excluir} />
      )}
    </div>
  );
}
