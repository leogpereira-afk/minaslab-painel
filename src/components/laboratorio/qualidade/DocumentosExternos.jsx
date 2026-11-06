// Qualidade › Documentos externos — a planilha "Controle de Documentos de Origem Externa" (CDOE, PG 005)
// dentro do painel, no desenho de Entradas de amostras: cards que filtram, abas com contagem, filtro em
// cada coluna, tabela que rola dentro da tela com o documento preso à esquerda, seleção em lote e exportar.
//
// Duas colunas são calculadas, nunca digitadas:
// - Status da verificação: sai da data da próxima verificação (trimestral, 3 meses).
// - Atualização: sai do resultado da última verificação; "Pendente de atualizar" quando existe versão
//   mais nova ou o documento foi cancelado/revogado.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarCheck2, CheckCircle2, Download, ExternalLink, FileWarning, Filter, FolderOpen, HelpCircle, Library, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { excluirRegistro, salvarRegistro, verificarExternos } from "../../../services/qualidade.js";
import { baixarPlanilha } from "../../../lib/planilha.js";
import { StatCard, Modal } from "../../ui.jsx";
import PaginacaoFinanceiro from "../../financeiro/PaginacaoFinanceiro.jsx";
import { Cabecalho, Campo, diasAte, fmtData, hojeYmd, somaMeses } from "./comum.jsx";

export const MESES_VERIFICACAO = 3;
// Pasta do Drive compartilhado: QUALIDADE › GESTÃO DA QUALIDADE 2026 › PROCEDIMETOS GERENCIAIS › PG 005 - Controle de Documentos Origem Externa.
const PASTA_PG005 = "https://drive.google.com/drive/folders/1vVlh7AV7WeEWWgEFGYQJcAYMsab2HX6U";
const PARA_VENCER_DIAS = 30;

// Resultado da verificação de atualização (gravado) → como aparece na coluna "Atualização".
export const ATUALIZACAO = {
  VIGENTE: { rotulo: "Em dia", classe: "bg-emerald-100 text-emerald-800", explica: "a versão cadastrada é a vigente." },
  ATUALIZAR: { rotulo: "Pendente de atualizar", classe: "bg-red-100 text-red-800", explica: "existe edição, revisão ou emenda mais nova." },
  CANCELADA: { rotulo: "Cancelada · substituir", classe: "bg-red-100 text-red-800", explica: "foi cancelada ou revogada; trocar pelo substituto." },
  CONFERIR: { rotulo: "Conferir na fonte", classe: "bg-amber-100 text-amber-800", explica: "a verificação não conseguiu confirmar; conferir na fonte oficial." },
  VALIDADE: { rotulo: "Controle por validade", classe: "bg-slate-200 text-slate-700", explica: "licença ou certificado: o que vale é a data de validade." },
};
export const pendente = (d) => d.ativo !== false && (d.resultado === "ATUALIZAR" || d.resultado === "CANCELADA");

// Status da verificação, pela próxima data (mesma ideia da planilha: Apto ao uso / Para vencer / Vencida).
export function statusVerificacao(d) {
  const dias = diasAte(d.proxima_verificacao);
  if (dias == null) return { k: "SEM_DATA", rotulo: "Sem data", classe: "bg-slate-100 text-slate-500", dias };
  if (dias < 0) return { k: "VENCIDA", rotulo: "Vencida", classe: "bg-red-100 text-red-800", dias };
  if (dias <= PARA_VENCER_DIAS) return { k: "PARA_VENCER", rotulo: "Para vencer", classe: "bg-amber-100 text-amber-800", dias };
  return { k: "APTO", rotulo: "Apto ao uso", classe: "bg-emerald-100 text-emerald-800", dias };
}

const ABAS = [
  ["TODOS", "Todos", (d) => d.ativo !== false],
  ["PENDENTES", "Pendentes de atualizar", pendente],
  ["CONFERIR", "Conferir na fonte", (d) => d.ativo !== false && d.resultado === "CONFERIR"],
  ["EM_DIA", "Em dia", (d) => d.ativo !== false && d.resultado === "VIGENTE"],
  ["VALIDADE", "Controle por validade", (d) => d.ativo !== false && d.resultado === "VALIDADE"],
  ["VENCIDAS", "Verificação vencida", (d) => d.ativo !== false && statusVerificacao(d).k === "VENCIDA"],
  ["PARA_VENCER", "Verificação para vencer", (d) => d.ativo !== false && statusVerificacao(d).k === "PARA_VENCER"],
  ["REMOVIDOS", "Fora de uso", (d) => d.ativo === false],
];
const FILTROS_VAZIOS = { documento: "", controlado: "", local: "", status: "", atualizacao: "", versao: "" };
const filtroInput = "h-7 w-full min-w-[78px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-normal normal-case text-slate-700 outline-none focus:border-blue-400";
const POR_PAGINA = [50, 100, 200, { valor: 100000, rotulo: "Todas" }];
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const contem = (v, f) => !f || sem(v).includes(sem(f));
const parar = (ev) => ev.stopPropagation();

function FiltroTexto({ valor, onChange, placeholder }) {
  return <div className="relative"><Filter size={11} className="absolute left-2 top-2 text-slate-400" aria-hidden="true" /><input className={`${filtroInput} pl-6`} aria-label={`Filtrar ${placeholder}`} placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} /></div>;
}
function FiltroSelect({ valor, onChange, opcoes, rotulo }) {
  return <select className={filtroInput} aria-label={`Filtrar ${rotulo}`} value={valor} onChange={(e) => onChange(e.target.value)}><option value="">Todos</option>{opcoes.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>;
}
const Etiqueta = ({ classe, children }) => <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${classe}`}>{children}</span>;

export default function DocumentosExternos({ q, voltar, recarregar, avisar }) {
  const { podeEscrever } = q;
  const todos = useMemo(() => q.externos || [], [q.externos]);
  const hoje = hojeYmd();
  const [aba, setAba] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(100);
  const [selecionados, setSelecionados] = useState([]);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const tabelaRef = useRef(null);

  const cont = useMemo(() => Object.fromEntries(ABAS.map(([k, , f]) => [k, todos.filter(f).length])), [todos]);
  const itens = useMemo(() => {
    const fAba = ABAS.find(([k]) => k === aba)[2];
    return todos.filter((d) => fAba(d)
      && contem(d.documento, filtros.documento) && contem(d.controlado_por, filtros.controlado) && contem(d.local_uso, filtros.local)
      && contem(d.versao_vigente, filtros.versao)
      && (!filtros.status || statusVerificacao(d).k === filtros.status) && (!filtros.atualizacao || d.resultado === filtros.atualizacao)
      && (!busca || sem(`${d.item} ${d.documento} ${d.local_uso} ${d.controlado_por} ${d.versao_vigente} ${d.observacao}`).includes(sem(busca))));
  }, [todos, aba, filtros, busca]);
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina));
  const pag = Math.min(pagina, totalPaginas);
  const itensPagina = itens.slice((pag - 1) * porPagina, pag * porPagina);
  useEffect(() => { setPagina(1); }, [aba, filtros, busca, porPagina]);
  useEffect(() => { tabelaRef.current?.scrollTo?.({ top: 0 }); }, [pag]);
  const setF = (c) => (v) => setFiltros((x) => ({ ...x, [c]: v }));
  const filtrosAtivos = busca || Object.values(filtros).some(Boolean);

  const ativosPagina = itensPagina;
  const todosPagina = ativosPagina.length > 0 && ativosPagina.every((d) => selecionados.includes(d.id));
  const alternarPagina = () => setSelecionados((s) => (todosPagina ? s.filter((id) => !ativosPagina.some((d) => d.id === id)) : [...new Set([...s, ...ativosPagina.map((d) => d.id)])]));
  const alternar = (id) => setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const escolhidos = todos.filter((d) => selecionados.includes(d.id));

  async function atualizar() { setAtualizando(true); try { await recarregar(); } finally { setAtualizando(false); } }
  async function gravar(reg, texto) {
    setSalvando(true);
    try { await salvarRegistro("externo", reg); setEditando(null); avisar({ tipo: "ok", texto }); await recarregar(); }
    catch (e) { avisar({ tipo: "erro", texto: e.message }); }
    finally { setSalvando(false); }
  }
  // Ajuste rápido direto na tabela (coluna Atualização), como o Finalizado MB/FQ das entradas.
  const mudarResultado = (d, v) => gravar({ id: d.id, resultado: v }, `Item ${d.item ?? ""}: atualização = ${ATUALIZACAO[v].rotulo}.`);
  async function registrarVerificacao(lista) {
    if (!lista.length) return;
    if (!window.confirm(`Registrar a verificação de hoje (${fmtData(hoje)}) em ${lista.length} documento(s)? A próxima fica para ${fmtData(somaMeses(hoje, MESES_VERIFICACAO))}.`)) return;
    setSalvando(true);
    try { const r = await verificarExternos(lista.map((d) => d.id), hoje); setSelecionados([]); avisar({ tipo: "ok", texto: `Verificação registrada em ${r.feitos} documento(s).` }); await recarregar(); }
    catch (e) { avisar({ tipo: "erro", texto: e.message }); }
    finally { setSalvando(false); }
  }
  // Excluir de vez (some da lista e do banco). Para manter o histórico, use "Tirar de uso".
  async function excluir(lista) {
    if (!lista.length) return;
    const nomes = lista.length === 1 ? `o item ${lista[0].item ?? ""} (${String(lista[0].documento).slice(0, 80)})` : `${lista.length} documentos`;
    if (!window.confirm(`Excluir ${nomes}? Essa ação não pode ser desfeita. Se quiser só tirar da lista mantendo o histórico, use "Tirar de uso".`)) return;
    setSalvando(true);
    let feitos = 0;
    try {
      for (const d of lista) { await excluirRegistro("externo", d.id); feitos += 1; }
      setSelecionados([]); setEditando(null);
      avisar({ tipo: "ok", texto: `${feitos} documento(s) excluído(s).` });
    } catch (e) { avisar({ tipo: "erro", texto: `${feitos ? `${feitos} excluído(s); ` : ""}${e.message}` }); }
    finally { setSalvando(false); await recarregar(); }
  }
  function exportar() {
    baixarPlanilha({
      nome: "controle-documentos-origem-externa",
      titulo: `Controle de Documentos de Origem Externa (CDOE · PG 005) — ${ABAS.find((a) => a[0] === aba)[1]} — ${fmtData(hoje)}`,
      colunas: [{ chave: "item", rotulo: "Nº" }, { chave: "documento", rotulo: "Documento" }, { chave: "controlado", rotulo: "Controlado por" }, { chave: "registro", rotulo: "Data de registro" },
        { chave: "verificacao", rotulo: "Data de verificação da atualização" }, { chave: "proxima", rotulo: "Data da próxima verificação" }, { chave: "local", rotulo: "Local de utilização" },
        { chave: "dias", rotulo: "Dias" }, { chave: "status", rotulo: "Status" }, { chave: "atualizacao", rotulo: "Atualização" }, { chave: "versao", rotulo: "Versão vigente / substituta" },
        { chave: "obs", rotulo: "Observação" }, { chave: "fonte", rotulo: "Fonte" }],
      linhas: itens.map((d) => { const st = statusVerificacao(d); return {
        item: d.item ?? "", documento: d.documento, controlado: d.controlado_por || "", registro: fmtData(d.data_registro), verificacao: fmtData(d.data_verificacao), proxima: fmtData(d.proxima_verificacao),
        local: d.local_uso || "", dias: st.dias ?? "", status: st.rotulo, atualizacao: ATUALIZACAO[d.resultado]?.rotulo || d.resultado, versao: d.versao_vigente || "", obs: d.observacao || "", fonte: d.fonte || "" }; }),
    });
  }
  const novo = () => setEditando({ documento: "", controlado_por: "", local_uso: "", data_registro: hoje, data_verificacao: hoje, proxima_verificacao: somaMeses(hoje, MESES_VERIFICACAO), resultado: "VIGENTE", versao_vigente: "", observacao: "", fonte: "", ativo: true });
  const abrirLinha = (ev, d) => { if (ev.target.closest("input,button,a,label,select")) return; setEditando({ ...d }); };
  const fundo = (d) => (selecionados.includes(d.id) ? "bg-blue-50" : pendente(d) ? "bg-red-50/70" : "bg-white group-hover:bg-slate-50");
  const vencidas = cont.VENCIDAS + cont.PARA_VENCER;

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Documentos externos" iso="CDOE · PG 005 · ISO 17025 8.3" voltar={voltar} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Documentos controlados" valor={String(cont.TODOS)} sub="normas, legislação, guias e licenças" icone={Library} tom="brand" onClick={() => setAba("TODOS")} ativo={aba === "TODOS"} />
        <StatCard rotulo="Pendentes de atualizar" valor={String(cont.PENDENTES)} sub="versão nova ou cancelados" icone={FileWarning} tom={cont.PENDENTES ? "bad" : "neutral"} onClick={() => setAba("PENDENTES")} ativo={aba === "PENDENTES"} />
        <StatCard rotulo="Conferir na fonte" valor={String(cont.CONFERIR)} sub="não confirmados na verificação" icone={AlertTriangle} tom={cont.CONFERIR ? "warn" : "neutral"} onClick={() => setAba("CONFERIR")} ativo={aba === "CONFERIR"} />
        <StatCard rotulo="Verificação vencendo" valor={String(vencidas)} sub={cont.VENCIDAS ? `${cont.VENCIDAS} vencida(s)` : `próximos ${PARA_VENCER_DIAS} dias · trimestral`} icone={CalendarCheck2} tom={cont.VENCIDAS ? "bad" : vencidas ? "warn" : "neutral"} onClick={() => setAba(cont.VENCIDAS ? "VENCIDAS" : "PARA_VENCER")} ativo={aba === "VENCIDAS" || aba === "PARA_VENCER"} />
      </div>

      <section className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-2.5 text-slate-400" aria-hidden="true" /><input className="input h-9 w-full py-1 pl-9 text-xs" aria-label="Buscar documentos externos" placeholder="Buscar norma, legislação, local, observação…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <button type="button" className="btn-outline px-3 py-2 text-xs" onClick={() => { setFiltros(FILTROS_VAZIOS); setBusca(""); }} disabled={!filtrosAtivos}><X size={14} aria-hidden="true" />Limpar filtros</button>
          <button type="button" className="btn-outline px-3 py-2 text-xs" onClick={atualizar} disabled={atualizando}><RefreshCw size={14} className={atualizando ? "animate-spin" : ""} aria-hidden="true" />Atualizar</button>
          <button type="button" className="btn-outline px-3 py-2 text-xs" onClick={exportar} disabled={!itens.length}><Download size={14} aria-hidden="true" />Exportar</button>
          <a className="btn-outline px-3 py-2 text-xs" href={PASTA_PG005} target="_blank" rel="noreferrer" title="Abre no Google Drive a pasta PG 005 - Controle de Documentos Origem Externa"><FolderOpen size={14} aria-hidden="true" />Pasta PG 005 (Drive)</a>
          {podeEscrever && <button type="button" className="btn-primary px-3 py-2 text-xs" onClick={novo}><Plus size={14} aria-hidden="true" />Novo documento</button>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-600">
          <span>Data de hoje: <b>{fmtData(hoje)}</b></span>
          <span>Frequência da verificação: <b>Trimestral</b> ({MESES_VERIFICACAO} meses)</span>
          <span>Documento de origem: <b>PG 005</b></span>
          <details className="ml-auto">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-blue-700"><HelpCircle size={13} aria-hidden="true" />Como o status e a atualização são calculados</summary>
            <div className="absolute right-4 z-40 mt-1 w-[min(92vw,480px)] rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-xl">
              <p className="mb-1 font-semibold text-slate-700">Status (pela data da próxima verificação)</p>
              <ul className="mb-2 space-y-1">
                <li><Etiqueta classe="bg-emerald-100 text-emerald-800">Apto ao uso</Etiqueta> faltam mais de {PARA_VENCER_DIAS} dias.</li>
                <li><Etiqueta classe="bg-amber-100 text-amber-800">Para vencer</Etiqueta> faltam {PARA_VENCER_DIAS} dias ou menos.</li>
                <li><Etiqueta classe="bg-red-100 text-red-800">Vencida</Etiqueta> a data passou: verificar de novo.</li>
              </ul>
              <p className="mb-1 font-semibold text-slate-700">Atualização (resultado da última verificação)</p>
              <ul className="space-y-1">{Object.entries(ATUALIZACAO).map(([k, a]) => <li key={k}><Etiqueta classe={a.classe}>{a.rotulo}</Etiqueta> {a.explica}</li>)}</ul>
              <p className="mt-2">Ao verificar, selecione as linhas e use “Registrar verificação de hoje”: a próxima verificação vai para daqui a {MESES_VERIFICACAO} meses. Linhas pendentes de atualizar ficam em vermelho.</p>
            </div>
          </details>
        </div>
        {podeEscrever && escolhidos.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-blue-50 px-3 py-2 text-xs">
            <span className="font-medium text-blue-900"><b>{escolhidos.length}</b> documento(s) selecionado(s)</span>
            <span className="flex flex-wrap gap-2">
              <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setSelecionados([])}>Limpar seleção</button>
              <button type="button" className="btn-outline px-3 py-1.5 text-xs text-bad-700" disabled={salvando} onClick={() => excluir(escolhidos)}><Trash2 size={14} aria-hidden="true" />Excluir</button>
              <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={salvando} onClick={() => registrarVerificacao(escolhidos.filter((d) => d.ativo !== false))}><CheckCircle2 size={14} aria-hidden="true" />Registrar verificação de hoje</button>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {ABAS.map(([k, n]) => <button key={k} type="button" onClick={() => setAba(k)} className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${aba === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{n} ({cont[k]})</button>)}
          </div>
        </div>
        <div ref={tabelaRef} className="max-h-[calc(100vh-240px)] min-h-[360px] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-[11px]">
            <thead className="sticky top-0 z-20 text-left text-[10px] uppercase text-slate-500">
              <tr>
                <th className="sticky left-0 z-30 min-w-[320px] border-r bg-slate-50 px-2 py-2">
                  <span className="flex items-center gap-2">{podeEscrever && <input type="checkbox" checked={todosPagina} onChange={alternarPagina} aria-label="Selecionar os documentos desta página" title="Selecionar os documentos desta página" />}Nº · Documento</span>
                </th>
                {["Controlado por", "Data de registro", "Verificação da atualização", "Próxima verificação", "Local de utilização", "Dias", "Status", "Atualização", "Versão vigente / substituta", "Observação"].map((t) => <th key={t} className="whitespace-nowrap bg-slate-50 px-2 py-2">{t}</th>)}
                <th className="sticky right-0 z-30 border-l bg-slate-50 px-2 py-2 text-right">Abrir</th>
              </tr>
              <tr className="align-top">
                <th className="sticky left-0 z-30 border-b border-r bg-white p-1"><FiltroTexto valor={filtros.documento} onChange={setF("documento")} placeholder="documento" /></th>
                <th className="border-b bg-white p-1"><FiltroTexto valor={filtros.controlado} onChange={setF("controlado")} placeholder="responsável" /></th>
                <th className="border-b bg-white p-1" /><th className="border-b bg-white p-1" /><th className="border-b bg-white p-1" />
                <th className="border-b bg-white p-1"><FiltroTexto valor={filtros.local} onChange={setF("local")} placeholder="local" /></th>
                <th className="border-b bg-white p-1" />
                <th className="border-b bg-white p-1"><FiltroSelect valor={filtros.status} onChange={setF("status")} rotulo="status" opcoes={[["APTO", "Apto ao uso"], ["PARA_VENCER", "Para vencer"], ["VENCIDA", "Vencida"], ["SEM_DATA", "Sem data"]]} /></th>
                <th className="border-b bg-white p-1"><FiltroSelect valor={filtros.atualizacao} onChange={setF("atualizacao")} rotulo="atualização" opcoes={Object.entries(ATUALIZACAO).map(([k, a]) => [k, a.rotulo])} /></th>
                <th className="border-b bg-white p-1"><FiltroTexto valor={filtros.versao} onChange={setF("versao")} placeholder="versão" /></th>
                <th className="border-b bg-white p-1" />
                <th className="sticky right-0 z-30 border-b border-l bg-white" />
              </tr>
            </thead>
            <tbody>
              {itensPagina.map((d) => {
                const st = statusVerificacao(d); const at = ATUALIZACAO[d.resultado] || ATUALIZACAO.VIGENTE; const bg = fundo(d);
                return (
                  <tr key={d.id} className="group cursor-pointer" onClick={(ev) => abrirLinha(ev, d)}>
                    <td className={`sticky left-0 z-10 min-w-[320px] max-w-[420px] border-r border-t px-2 py-2 align-top ${bg}`}>
                      <span className="flex items-start gap-2">
                        {podeEscrever && <input type="checkbox" className="mt-0.5" checked={selecionados.includes(d.id)} onChange={() => alternar(d.id)} aria-label={`Selecionar item ${d.item}`} />}
                        <span><b className="mr-1 text-slate-400">{d.item ?? "—"}</b><span className={`font-medium ${d.ativo === false ? "text-slate-400 line-through" : "text-slate-800"}`}>{d.documento}</span></span>
                      </span>
                    </td>
                    <td className={`whitespace-nowrap border-t px-2 py-2 align-top ${bg}`}>{d.controlado_por || <span className="text-slate-400">—</span>}</td>
                    <td className={`whitespace-nowrap border-t px-2 py-2 align-top ${bg}`}>{fmtData(d.data_registro)}</td>
                    <td className={`whitespace-nowrap border-t px-2 py-2 align-top ${bg}`}>{fmtData(d.data_verificacao)}</td>
                    <td className={`whitespace-nowrap border-t px-2 py-2 align-top ${bg}`}>{fmtData(d.proxima_verificacao)}</td>
                    <td className={`min-w-[160px] border-t px-2 py-2 align-top ${bg}`}>{d.local_uso || <span className="text-slate-400">—</span>}</td>
                    <td className={`whitespace-nowrap border-t px-2 py-2 text-right align-top font-semibold ${st.k === "VENCIDA" ? "text-red-700" : st.k === "PARA_VENCER" ? "text-amber-700" : "text-slate-600"} ${bg}`}>{st.dias ?? "—"}</td>
                    <td className={`border-t px-2 py-2 align-top ${bg}`}><Etiqueta classe={st.classe}>{st.rotulo}</Etiqueta></td>
                    <td className={`border-t px-2 py-2 align-top ${bg}`} onClick={parar}>
                      {podeEscrever && d.ativo !== false
                        ? <select value={d.resultado} disabled={salvando} onChange={(ev) => mudarResultado(d, ev.target.value)} aria-label={`Atualização do item ${d.item}`} className={`h-6 rounded-full border-0 px-2 text-[10px] font-semibold outline-none ring-1 ring-slate-200 ${at.classe}`}>
                            {Object.entries(ATUALIZACAO).map(([k, a]) => <option key={k} value={k}>{a.rotulo}</option>)}
                          </select>
                        : <Etiqueta classe={at.classe}>{at.rotulo}</Etiqueta>}
                    </td>
                    <td className={`min-w-[200px] max-w-[280px] border-t px-2 py-2 align-top ${bg}`}>{d.versao_vigente || <span className="text-slate-400">—</span>}</td>
                    <td className={`min-w-[260px] max-w-[380px] border-t px-2 py-2 align-top text-slate-600 ${bg}`}>
                      <span className="line-clamp-3" title={d.observacao || ""}>{d.observacao || <span className="text-slate-400">—</span>}</span>
                      {d.fonte && <a href={d.fonte} target="_blank" rel="noreferrer" onClick={parar} className="mt-0.5 inline-flex items-center gap-1 text-blue-700 underline"><ExternalLink size={11} aria-hidden="true" />fonte</a>}
                    </td>
                    <td className={`sticky right-0 z-10 border-l border-t px-2 py-1.5 text-right align-top ${bg}`}>
                      <button type="button" className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-100" onClick={() => setEditando({ ...d })} title={podeEscrever ? "Ver / editar" : "Ver"} aria-label={`Abrir item ${d.item}`}>{podeEscrever ? <Pencil size={14} /> : <Search size={14} />}</button>
                    </td>
                  </tr>
                );
              })}
              {!itens.length && <tr><td colSpan={12} className="p-8 text-center text-slate-500">{todos.length ? "Nenhum documento com esses filtros." : "Nenhum documento externo cadastrado ainda."}</td></tr>}
            </tbody>
          </table>
        </div>
        <PaginacaoFinanceiro total={itens.length} pagina={pag} paginas={totalPaginas} porPagina={porPagina} itensNaPagina={itensPagina.length} onPorPagina={setPorPagina} onPagina={(n) => setPagina(Math.min(Math.max(1, n), totalPaginas))} opcoes={POR_PAGINA} />
      </section>

      <Modal titulo={editando?.id ? `Documento externo nº ${editando.item ?? ""}` : "Novo documento externo"} aberto={!!editando} aoFechar={() => setEditando(null)} largura="max-w-3xl">
        {editando && <FormExterno d={editando} setD={setEditando} pode={podeEscrever} salvando={salvando}
          aoSalvar={() => gravar(editando, editando.id ? `Item ${editando.item ?? ""} gravado.` : "Documento externo cadastrado.")}
          aoVerificar={() => registrarVerificacao([editando])}
          aoExcluir={() => excluir([editando])}
          aoTirarDeUso={() => { if (window.confirm("Tirar este documento de uso? Ele sai da lista (fica na aba “Fora de uso”).")) gravar({ id: editando.id, ativo: false }, `Item ${editando.item ?? ""} fora de uso.`); }}
          aoVoltarAoUso={() => gravar({ id: editando.id, ativo: true }, `Item ${editando.item ?? ""} de volta à lista.`)} />}
      </Modal>
    </div>
  );
}

function FormExterno({ d, setD, pode, salvando, aoSalvar, aoVerificar, aoExcluir, aoTirarDeUso, aoVoltarAoUso }) {
  const st = statusVerificacao(d);
  const set = (c) => (e) => setD({ ...d, [c]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); aoSalvar(); }} className="grid gap-3 sm:grid-cols-2">
      {d.id && <div className="flex flex-wrap gap-2 sm:col-span-2"><Etiqueta classe={st.classe}>Status: {st.rotulo}{st.dias != null ? ` (${st.dias} dias)` : ""}</Etiqueta><Etiqueta classe={(ATUALIZACAO[d.resultado] || ATUALIZACAO.VIGENTE).classe}>{(ATUALIZACAO[d.resultado] || ATUALIZACAO.VIGENTE).rotulo}</Etiqueta>{d.ativo === false && <Etiqueta classe="bg-slate-200 text-slate-600">Fora de uso</Etiqueta>}</div>}
      <Campo rotulo="Documento (norma, legislação, guia) *" className="sm:col-span-2"><textarea className="input" rows={2} required disabled={!pode} value={d.documento || ""} onChange={set("documento")} placeholder="ABNT NBR ISO 6888-2:2023 — Microbiologia…" /></Campo>
      <Campo rotulo="Controlado por"><input className="input" disabled={!pode} value={d.controlado_por || ""} onChange={set("controlado_por")} /></Campo>
      <Campo rotulo="Local de utilização"><input className="input" disabled={!pode} value={d.local_uso || ""} onChange={set("local_uso")} placeholder="Procedimentos microbiológicos e físico-químicos" /></Campo>
      <Campo rotulo="Data de registro"><input type="date" className="input" disabled={!pode} value={d.data_registro || ""} onChange={set("data_registro")} /></Campo>
      <Campo rotulo="Data de verificação da atualização"><input type="date" className="input" disabled={!pode} value={d.data_verificacao || ""} onChange={(e) => setD({ ...d, data_verificacao: e.target.value, proxima_verificacao: e.target.value ? somaMeses(e.target.value, MESES_VERIFICACAO) : d.proxima_verificacao })} /></Campo>
      <Campo rotulo="Próxima verificação (trimestral)"><input type="date" className="input" disabled={!pode} value={d.proxima_verificacao || ""} onChange={set("proxima_verificacao")} /></Campo>
      <Campo rotulo="Atualização (resultado da verificação)"><select className="input" disabled={!pode} value={d.resultado || "VIGENTE"} onChange={set("resultado")}>{Object.entries(ATUALIZACAO).map(([k, a]) => <option key={k} value={k}>{a.rotulo}</option>)}</select></Campo>
      <Campo rotulo="Versão vigente / substituta" className="sm:col-span-2"><input className="input" disabled={!pode} value={d.versao_vigente || ""} onChange={set("versao_vigente")} placeholder="Ex.: ABNT NBR ISO 6888-2:2023" /></Campo>
      <Campo rotulo="Observação" className="sm:col-span-2"><textarea className="input" rows={3} disabled={!pode} value={d.observacao || ""} onChange={set("observacao")} /></Campo>
      <Campo rotulo="Fonte (link)" className="sm:col-span-2"><input className="input" disabled={!pode} value={d.fonte || ""} onChange={set("fonte")} placeholder="https://…" /></Campo>
      {pode && <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar"}</button>
        {d.id && d.ativo !== false && <button type="button" disabled={salvando} onClick={aoVerificar} className="btn-outline inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" aria-hidden />Registrar verificação de hoje</button>}
        {d.id && (d.ativo !== false
          ? <button type="button" disabled={salvando} onClick={aoTirarDeUso} className="btn-ghost ml-auto text-bad-700">Tirar de uso</button>
          : <button type="button" disabled={salvando} onClick={aoVoltarAoUso} className="btn-ghost ml-auto">Voltar à lista</button>)}
        {d.id && <button type="button" disabled={salvando} onClick={aoExcluir} className="btn-outline inline-flex items-center gap-1.5 text-bad-700"><Trash2 className="h-4 w-4" aria-hidden />Excluir</button>}
      </div>}
    </form>
  );
}
