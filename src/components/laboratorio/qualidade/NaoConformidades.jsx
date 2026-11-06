// Qualidade › Não conformidades e ações corretivas (ISO/IEC 17025 · 7.10 e 8.7).
// Quadro por etapa: aberta → análise de causa (5 porquês) → ação → verificar eficácia → encerrada.
// Também nascem sozinhas de calibração reprovada e de proficiência questionável.
import { useMemo, useState } from "react";
import { ArrowRight, Download, Plus, RotateCcw } from "lucide-react";
import { salvarRegistro } from "../../../services/qualidade.js";
import { baixarPlanilha } from "../../../lib/planilha.js";
import { StatCard, Modal } from "../../ui.jsx";
import { Anexos, Cabecalho, Campo, Pill, SelectPessoa, diasAte, fmtData, hojeYmd, nomeDe, somaMeses } from "./comum.jsx";

export const ORIGENS = { ROTINA: ["Rotina", "gray"], RECLAMACAO: ["Reclamação", "vio"], AUDITORIA: ["Auditoria interna", "warn"], PROFICIENCIA: ["Proficiência", "bad"], EQUIPAMENTO: ["Equipamento", "sky"], FORNECEDOR: ["Fornecedor", "gray"], OUTRA: ["Outra", "gray"] };
const ETAPAS = [["ABERTA", "Aberta"], ["CAUSA", "Análise de causa"], ["ACAO", "Ação em andamento"], ["EFICACIA", "Verificar eficácia"], ["ENCERRADA", "Encerrada"]];
const PROXIMA = { ABERTA: "CAUSA", CAUSA: "ACAO", ACAO: "EFICACIA", EFICACIA: "ENCERRADA" };

export default function NaoConformidades({ q, voltar, recarregar, avisar }) {
  const { ncs, contas, arquivos, podeEscrever } = q;
  const [selId, setSelId] = useState(null); const [nova, setNova] = useState(null); const [ed, setEd] = useState(null); const [salvando, setSalvando] = useState(false);
  const [verTodasEncerradas, setVerTodasEncerradas] = useState(false);
  const [filtro, setFiltro] = useState(null);
  const hoje = hojeYmd();
  const abertas = ncs.filter((n) => n.etapa !== "ENCERRADA");
  const vencidas = abertas.filter((n) => n.prazo && n.prazo < hoje);
  const ano = new Date().getFullYear();
  const encerradasAno = ncs.filter((n) => n.etapa === "ENCERRADA" && n.encerrada_em && new Date(n.encerrada_em).getFullYear() === ano);
  const tempoMedio = encerradasAno.length ? Math.round(encerradasAno.reduce((s, n) => s + (new Date(n.encerrada_em) - new Date(n.criado_em)) / 86400000, 0) / encerradasAno.length) : null;
  const contOrigem = Object.entries(ncs.filter((n) => new Date(n.criado_em).getFullYear() === ano).reduce((m, n) => ({ ...m, [n.origem]: (m[n.origem] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const sel = ncs.find((n) => n.id === selId) || null;
  // Filtros dos cards: clicar mostra só aquelas NCs no quadro; clicar de novo limpa.
  const FILTROS = {
    ABERTAS: ["Abertas", (n) => n.etapa !== "ENCERRADA"],
    VENCIDAS: ["Prazo vencido", (n) => n.etapa !== "ENCERRADA" && n.prazo && n.prazo < hoje],
    EFICACIA: ["Aguardando eficácia", (n) => n.etapa === "EFICACIA"],
    ENCERRADAS: [`Encerradas em ${ano}`, (n) => encerradasAno.includes(n)],
    ORIGEM: ["Origem mais comum", (n) => contOrigem[0] && n.origem === contOrigem[0][0]],
  };
  const alternar = (f) => setFiltro((atual) => (atual === f ? null : f));
  const cols = useMemo(() => ETAPAS.map(([k, l]) => ({ k, l, itens: ncs.filter((n) => n.etapa === k && (!filtro || FILTROS[filtro][1](n))) })), [ncs, filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  function abrir(n) { setSelId(n.id); setEd({ ...n, porques: n.porques?.length ? n.porques : [""] }); }
  async function gravar(dados, msg) {
    setSalvando(true);
    try { const r = await salvarRegistro("nc", dados); await recarregar(); setSelId(r.id); setEd({ ...r, porques: r.porques?.length ? r.porques : [""] }); if (msg) avisar({ tipo: "ok", texto: msg }); return r; }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); return null; } finally { setSalvando(false); }
  }
  async function criar(e) { e.preventDefault(); const r = await gravar(nova, "Não conformidade registrada."); if (r) setNova(null); }
  function avancar() {
    const prox = PROXIMA[ed.etapa];
    if (prox === "ACAO" && !ed.causa_raiz?.trim()) { avisar({ tipo: "erro", texto: "Registre a causa raiz antes de seguir para a ação." }); return; }
    if (prox === "EFICACIA" && !ed.acao?.trim()) { avisar({ tipo: "erro", texto: "Descreva a ação corretiva antes de verificar a eficácia." }); return; }
    const extra = prox === "EFICACIA" && !ed.eficacia_em ? { eficacia_em: somaMeses(hoje, 1) } : {};
    gravar({ ...ed, ...extra, etapa: prox, porques: (ed.porques || []).filter((p) => p.trim()) }, `Seguiu para “${ETAPAS.find((x) => x[0] === prox)[1]}”.`);
  }
  function eficacia(ok) {
    if (!ed.eficacia_resultado?.trim()) { avisar({ tipo: "erro", texto: "Descreva como a eficácia foi verificada." }); return; }
    gravar({ ...ed, eficaz: ok, etapa: ok ? "ENCERRADA" : "CAUSA", porques: (ed.porques || []).filter((p) => p.trim()) }, ok ? "Encerrada: ação eficaz." : "Ação não eficaz: voltou para a análise de causa.");
  }
  function exportar() {
    baixarPlanilha({ nome: "nao-conformidades", titulo: `Não conformidades — ${fmtData(hoje)}`,
      colunas: [{ chave: "codigo", rotulo: "Código" }, { chave: "titulo", rotulo: "Descrição" }, { chave: "origem", rotulo: "Origem" }, { chave: "etapa", rotulo: "Etapa" }, { chave: "resp", rotulo: "Responsável" }, { chave: "prazo", rotulo: "Prazo" }, { chave: "causa", rotulo: "Causa raiz" }, { chave: "acao", rotulo: "Ação corretiva" }, { chave: "eficacia", rotulo: "Eficácia" }, { chave: "aberta", rotulo: "Aberta em" }, { chave: "fim", rotulo: "Encerrada em" }],
      linhas: ncs.map((n) => ({ codigo: n.codigo, titulo: n.titulo, origem: ORIGENS[n.origem]?.[0], etapa: ETAPAS.find((x) => x[0] === n.etapa)?.[1], resp: nomeDe(contas, n.responsavel), prazo: fmtData(n.prazo), causa: n.causa_raiz || "", acao: n.acao || "", eficacia: n.eficaz == null ? "" : n.eficaz ? "Eficaz" : "Não eficaz", aberta: fmtData(n.criado_em), fim: fmtData(n.encerrada_em) })) });
  }
  const ro = !podeEscrever || ed?.etapa === "ENCERRADA";

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Não conformidades e ações corretivas" iso="ISO 17025 · 7.10 e 8.7" voltar={voltar} acoes={<>
        <button type="button" onClick={exportar} className="btn-outline inline-flex items-center gap-1.5"><Download className="h-4 w-4" aria-hidden /> Relatório (Excel)</button>
        {podeEscrever && <button type="button" onClick={() => setNova({ origem: "ROTINA", etapa: "ABERTA", prazo: new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA"), trabalho_afetado: false })} className="btn-primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" aria-hidden /> Registrar não conformidade</button>}
      </>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard rotulo="Abertas" valor={abertas.length} sub={`${ncs.filter((n) => diasAte(n.criado_em?.slice(0, 10)) >= -7).length} nesta semana`} onClick={() => alternar("ABERTAS")} ativo={filtro === "ABERTAS"} />
        <StatCard rotulo="Prazo vencido" valor={vencidas.length} tom={vencidas.length ? "bad" : "neutral"} sub={vencidas.map((n) => n.codigo).slice(0, 2).join(", ") || "nenhuma"} onClick={() => alternar("VENCIDAS")} ativo={filtro === "VENCIDAS"} />
        <StatCard rotulo="Aguardando eficácia" valor={ncs.filter((n) => n.etapa === "EFICACIA").length} tom={ncs.some((n) => n.etapa === "EFICACIA") ? "warn" : "neutral"} sub="verificar se a ação resolveu" onClick={() => alternar("EFICACIA")} ativo={filtro === "EFICACIA"} />
        <StatCard rotulo="Encerradas no ano" valor={encerradasAno.length} tom="ok" sub={tempoMedio == null ? "—" : `tempo médio ${tempoMedio} dia(s)`} onClick={() => alternar("ENCERRADAS")} ativo={filtro === "ENCERRADAS"} />
        <StatCard rotulo="Origem mais comum" valor={contOrigem[0] ? ORIGENS[contOrigem[0][0]][0] : "—"} sub={contOrigem[1] ? `seguida de ${ORIGENS[contOrigem[1][0]][0].toLowerCase()}` : "no ano"} onClick={() => alternar("ORIGEM")} ativo={filtro === "ORIGEM"} />
      </div>
      {filtro && <div className="flex items-center gap-2 text-sm text-slate-600">Mostrando: <b>{FILTROS[filtro][0]}</b><button type="button" onClick={() => setFiltro(null)} className="text-brand-700 underline">limpar</button></div>}
      <div className="grid gap-4 2xl:grid-cols-[2.2fr_1fr]">
        <div className="grid gap-3 overflow-x-auto md:grid-cols-5">
          {cols.map((c) => (
            <div key={c.k} className="min-w-[180px] rounded-2xl border bg-slate-50 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1"><b className="text-sm text-slate-800">{c.l}</b><Pill>{c.itens.length}</Pill></div>
              {(c.k === "ENCERRADA" && !verTodasEncerradas ? c.itens.slice(0, 5) : c.itens).map((n) => { const venc = n.etapa !== "ENCERRADA" && n.prazo && n.prazo < hoje; return (
                <button key={n.id} type="button" onClick={() => abrir(n)} className={`mb-2 block w-full rounded-xl border bg-white p-2.5 text-left text-xs hover:border-brand-300 ${selId === n.id ? "border-2 border-brand" : ""}`}>
                  <span className="flex flex-wrap items-center gap-1"><Pill tom={ORIGENS[n.origem]?.[1]}>{ORIGENS[n.origem]?.[0]}</Pill><span className="text-slate-400">{n.codigo}</span></span>
                  <b className="my-1 block text-[13px] leading-snug text-slate-900">{n.titulo}</b>
                  <span className="text-slate-500">{nomeDe(contas, n.responsavel)} · {n.etapa === "ENCERRADA" ? `encerrada ${fmtData(n.encerrada_em)}` : <>prazo <span className={venc ? "font-bold text-bad-700" : ""}>{fmtData(n.prazo)}</span></>}</span>
                </button>); })}
              {c.k === "ENCERRADA" && c.itens.length > 5 && <button type="button" onClick={() => setVerTodasEncerradas(!verTodasEncerradas)} className="w-full text-xs text-brand-700">{verTodasEncerradas ? "Mostrar menos" : `Ver todas (${c.itens.length})`}</button>}
              {c.itens.length === 0 && <p className="px-1 py-3 text-center text-xs text-slate-400">—</p>}
            </div>
          ))}
        </div>

        <div className="card space-y-3 p-5">
          {!sel || !ed ? <p className="py-6 text-center text-sm text-slate-500">Clique numa não conformidade para tratar: causa, ação e eficácia.</p> : <>
            <div className="flex items-start justify-between gap-2"><h3 className="font-display font-semibold text-slate-900">{sel.codigo} · {sel.titulo}</h3><Pill tom={ORIGENS[sel.origem]?.[1]}>{ORIGENS[sel.origem]?.[0]}</Pill></div>
            <div className="flex flex-wrap gap-1">{ETAPAS.map(([k, l]) => <span key={k} className={`rounded-full px-2 py-0.5 text-[11px] ${k === sel.etapa ? "bg-brand font-semibold text-white" : "bg-slate-100 text-slate-500"}`}>{l}</span>)}</div>
            {sel.descricao && <p className="text-sm text-slate-600">{sel.descricao}</p>}
            <p className="text-xs text-slate-500">Registrada por {nomeDe(contas, sel.registrada_por)} em {fmtData(sel.criado_em)}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Responsável"><SelectPessoa contas={contas} valor={ed.responsavel} onChange={(v) => setEd({ ...ed, responsavel: v })} disabled={ro} /></Campo>
              <Campo rotulo="Prazo"><input type="date" className="input" value={ed.prazo || ""} onChange={(e) => setEd({ ...ed, prazo: e.target.value })} disabled={ro} /></Campo>
            </div>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!ed.trabalho_afetado} onChange={(e) => setEd({ ...ed, trabalho_afetado: e.target.checked })} disabled={ro} /> Afetou resultados/relatórios já emitidos (avaliar e, se preciso, comunicar o cliente)</label>
            {ed.trabalho_afetado && <Campo rotulo="Impacto"><textarea className="input" rows={2} value={ed.impacto || ""} onChange={(e) => setEd({ ...ed, impacto: e.target.value })} disabled={ro} /></Campo>}
            <div><span className="label">Análise de causa (5 porquês)</span>
              <ol className="space-y-1.5">{(ed.porques || []).map((p, i) => <li key={i} className="flex items-center gap-2"><span className="w-12 text-xs text-slate-400">Por quê?</span><input className="input" value={p} onChange={(e) => setEd({ ...ed, porques: ed.porques.map((x, j) => (j === i ? e.target.value : x)) })} disabled={ro} /></li>)}</ol>
              {!ro && (ed.porques || []).length < 5 && <button type="button" onClick={() => setEd({ ...ed, porques: [...(ed.porques || []), ""] })} className="mt-1 text-xs text-brand-700">+ mais um porquê</button>}
            </div>
            <Campo rotulo="Causa raiz"><textarea className="input" rows={2} value={ed.causa_raiz || ""} onChange={(e) => setEd({ ...ed, causa_raiz: e.target.value })} disabled={ro} /></Campo>
            <Campo rotulo="Ação corretiva"><textarea className="input" rows={3} value={ed.acao || ""} onChange={(e) => setEd({ ...ed, acao: e.target.value })} disabled={ro} /></Campo>
            {["EFICACIA", "ENCERRADA"].includes(sel.etapa) && <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Verificar eficácia em"><input type="date" className="input" value={ed.eficacia_em || ""} onChange={(e) => setEd({ ...ed, eficacia_em: e.target.value })} disabled={ro} /></Campo>
              <Campo rotulo="Como foi verificada" className="sm:col-span-2"><textarea className="input" rows={2} value={ed.eficacia_resultado || ""} onChange={(e) => setEd({ ...ed, eficacia_resultado: e.target.value })} disabled={ro} /></Campo>
            </div>}
            {sel.etapa === "ENCERRADA" && <p className="rounded-xl bg-ok-50 p-3 text-sm text-ok-700">Encerrada em {fmtData(sel.encerrada_em)} por {nomeDe(contas, sel.encerrada_por)} · ação {sel.eficaz ? "eficaz" : "—"}.</p>}
            <div><span className="label">Evidências</span><Anexos refTipo="nc" refId={sel.id} arquivos={arquivos} podeEscrever={podeEscrever} aoMudar={recarregar} avisar={avisar} /></div>
            {podeEscrever && <div className="flex flex-wrap gap-2 border-t pt-3">
              {sel.etapa !== "ENCERRADA" && <button type="button" disabled={salvando} onClick={() => gravar({ ...ed, porques: (ed.porques || []).filter((p) => p.trim()) }, "Salvo.")} className="btn-outline">Salvar</button>}
              {["ABERTA", "CAUSA", "ACAO"].includes(sel.etapa) && <button type="button" disabled={salvando} onClick={avancar} className="btn-primary inline-flex items-center gap-1.5">Seguir para “{ETAPAS.find((x) => x[0] === PROXIMA[sel.etapa])[1]}” <ArrowRight className="h-4 w-4" aria-hidden /></button>}
              {sel.etapa === "EFICACIA" && <><button type="button" disabled={salvando} onClick={() => eficacia(true)} className="btn-primary">Eficaz — encerrar</button><button type="button" disabled={salvando} onClick={() => eficacia(false)} className="btn-outline">Não eficaz — rever a causa</button></>}
              {sel.etapa === "ENCERRADA" && <button type="button" disabled={salvando} onClick={() => gravar({ id: sel.id, etapa: "ACAO", eficaz: null }, "Reaberta.")} className="btn-ghost inline-flex items-center gap-1.5"><RotateCcw className="h-4 w-4" aria-hidden /> Reabrir</button>}
            </div>}
          </>}
        </div>
      </div>

      <Modal titulo="Registrar não conformidade" aberto={!!nova} aoFechar={() => setNova(null)} largura="max-w-xl">
        {nova && <form onSubmit={criar} className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="O que aconteceu *" className="sm:col-span-2"><input className="input" required value={nova.titulo || ""} onChange={(e) => setNova({ ...nova, titulo: e.target.value })} placeholder="Etiqueta de amostra ilegível na recepção" /></Campo>
          <Campo rotulo="Detalhes" className="sm:col-span-2"><textarea className="input" rows={3} value={nova.descricao || ""} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} /></Campo>
          <Campo rotulo="Origem"><select className="input" value={nova.origem} onChange={(e) => setNova({ ...nova, origem: e.target.value })}>{Object.entries(ORIGENS).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          <Campo rotulo="Responsável"><SelectPessoa contas={contas} valor={nova.responsavel} onChange={(v) => setNova({ ...nova, responsavel: v })} /></Campo>
          <Campo rotulo="Prazo"><input type="date" className="input" value={nova.prazo || ""} onChange={(e) => setNova({ ...nova, prazo: e.target.value })} /></Campo>
          <label className="mt-6 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!nova.trabalho_afetado} onChange={(e) => setNova({ ...nova, trabalho_afetado: e.target.checked })} /> Afetou resultados</label>
          <button disabled={salvando} className="btn-primary sm:col-span-2">{salvando ? "Salvando..." : "Registrar"}</button>
        </form>}
      </Modal>
    </div>
  );
}
