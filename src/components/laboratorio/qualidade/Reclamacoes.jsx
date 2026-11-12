// Qualidade › Reclamações de clientes (ISO/IEC 17025 · 7.9; PG 013; formulário FM-LAB-113, antigo RRC).
// Protocolo RRC NNN/AAAA gerado pelo servidor. Etapas: recebida → validação (procede? + confirmação do
// recebimento ao reclamante) → investigação e ação (NC quando precisa) → resposta ao cliente → encerrada.
// Quem analisa e aprova não pode estar entre os envolvidos (7.9.6). Imprime o FM-LAB-113 preenchido ou em branco.
import { useMemo, useState } from "react";
import { ArrowRight, Download, FileWarning, Plus, Printer, RotateCcw } from "lucide-react";
import { salvarReclamacao, abrirNcDaReclamacao } from "../../../services/qualidade.js";
import { baixarPlanilha } from "../../../lib/planilha.js";
import { abrirImpressao, dadosDoFormulario } from "../../../lib/impressao/formularioQualidade.js";
import { FORM_RRC, corpoRrc } from "../../../lib/impressao/rrc.js";
import { ETAPAS_RECLAMACAO, CLASSIFICACOES, CANAIS, proximaEtapa, prazoResposta, alertasPrazo } from "../../../../supabase/functions/_shared/reclamacoes-regras.mjs";
import { StatCard, Modal } from "../../ui.jsx";
import { Anexos, Cabecalho, Campo, Pill, SelectPessoa, fmtData, hojeYmd, nomeDe } from "./comum.jsx";

const TOM_CLASSE = { CRITICA: "bad", ALTA: "warn", MEDIA: "sky", BAIXA: "gray" };
const rotEtapa = (e) => ETAPAS_RECLAMACAO.find((x) => x[0] === e)?.[1] || e;
const rotClasse = (c) => CLASSIFICACOES.find((x) => x[0] === c)?.[1] || c;
const ordemEtapa = (e) => ETAPAS_RECLAMACAO.findIndex((x) => x[0] === e);

export default function Reclamacoes({ q, voltar, recarregar, avisar }) {
  const { contas, arquivos, podeEscrever } = q;
  const lista = q.reclamacoes || [];
  const hoje = hojeYmd();
  const [selId, setSelId] = useState(null); const [ed, setEd] = useState(null);
  const [nova, setNova] = useState(null); const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState(null); const [busca, setBusca] = useState("");
  const nome = (u) => nomeDe(contas, u);
  const form = dadosDoFormulario(q.documentos, FORM_RRC);

  const ano = new Date().getFullYear();
  const abertas = lista.filter((r) => r.etapa !== "ENCERRADA");
  const confAtras = abertas.filter((r) => alertasPrazo(r, hoje).includes("confirmação atrasada"));
  const respAtras = abertas.filter((r) => alertasPrazo(r, hoje).includes("resposta atrasada"));
  const doAno = lista.filter((r) => String(r.recebida_em).startsWith(String(ano)) && r.tipo !== "SUGESTAO");
  const encAno = lista.filter((r) => r.encerrada_em && new Date(r.encerrada_em).getFullYear() === ano);
  const tempoMedio = encAno.length ? Math.round(encAno.reduce((s, r) => s + (new Date(r.encerrada_em) - new Date(`${r.recebida_em}T12:00:00`)) / 864e5, 0) / encAno.length) : null;
  const validadas = doAno.filter((r) => r.procedente != null);
  const FILTROS = {
    ABERTAS: ["Abertas", (r) => r.etapa !== "ENCERRADA"],
    CONF: ["Confirmação atrasada", (r) => confAtras.includes(r)],
    RESP: ["Resposta atrasada", (r) => respAtras.includes(r)],
    ENC: [`Encerradas em ${ano}`, (r) => encAno.includes(r)],
  };
  const vis = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return lista.filter((r) => (!filtro || FILTROS[filtro][1](r)) && (!s || [r.codigo, r.cliente_nome, r.reclamante, r.os_referencia, r.descricao].some((v) => String(v || "").toLowerCase().includes(s))));
  }, [lista, filtro, busca]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = lista.find((r) => r.id === selId) || null;
  const nc = sel?.nc_id ? q.ncs.find((n) => n.id === sel.nc_id) : null;

  function abrir(r) { setSelId(r.id); setEd({ ...r }); }
  async function gravar(dados, opcoes, msg) {
    setSalvando(true);
    try { const r = await salvarReclamacao(dados, opcoes); await recarregar(); setSelId(r.id); setEd({ ...r }); if (msg) avisar({ tipo: "ok", texto: msg }); return r; }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); return null; } finally { setSalvando(false); }
  }
  async function criar(e) { e.preventDefault(); const r = await gravar(nova, {}, "Reclamação registrada."); if (r) { setNova(null); avisar({ tipo: "ok", texto: `Reclamação registrada com o protocolo ${r.codigo}.` }); } }
  async function abrirNc() {
    setSalvando(true);
    try { const n = await abrirNcDaReclamacao(sel.id); await recarregar(); avisar({ tipo: "ok", texto: `Não conformidade ${n.codigo} aberta e ligada a ${sel.codigo}.` }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
  }
  function imprimir(r) {
    try { abrirImpressao({ form, corpo: corpoRrc(r || {}, { nome, nc: r?.nc_id ? q.ncs.find((n) => n.id === r.nc_id) : null }), impressoPor: nome(q.eu), controlada: !!r }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }
  function exportar() {
    baixarPlanilha({ nome: "reclamacoes", titulo: `Reclamações de clientes — ${fmtData(hoje)}`,
      colunas: [["codigo", "Protocolo"], ["tipo", "Tipo"], ["recebida", "Recebida"], ["cliente", "Cliente"], ["os", "OS/Relatório"], ["classe", "Classificação"], ["etapa", "Etapa"], ["procede", "Procede"], ["confirmada", "Recebimento confirmado"], ["prazo", "Prazo de resposta"], ["respondida", "Respondida"], ["nc", "NC"], ["encerrada", "Encerrada"]].map(([chave, rotulo]) => ({ chave, rotulo })),
      linhas: lista.map((r) => ({ codigo: r.codigo, tipo: r.tipo === "SUGESTAO" ? "Sugestão" : "Reclamação", recebida: fmtData(r.recebida_em), cliente: r.cliente_nome || r.reclamante || "", os: r.os_referencia || "", classe: rotClasse(r.classificacao), etapa: rotEtapa(r.etapa), procede: r.procedente == null ? "" : r.procedente ? "Sim" : "Não", confirmada: r.confirmada_em ? fmtData(r.confirmada_em) : "", prazo: fmtData(r.prazo_resposta), respondida: r.respondida_em ? fmtData(r.respondida_em) : "", nc: q.ncs.find((n) => n.id === r.nc_id)?.codigo || "", encerrada: r.encerrada_em ? fmtData(r.encerrada_em) : "" })) });
  }
  const proxima = sel ? proximaEtapa(ed || sel) : null;
  const ro = !podeEscrever || sel?.etapa === "ENCERRADA";
  const at = (e) => ordemEtapa(sel?.etapa) >= ordemEtapa(e); // a seção aparece quando a etapa já chegou nela
  const set = (k) => (e) => setEd({ ...ed, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Reclamações de clientes" iso="ISO 17025 · 7.9 · PG 013" voltar={voltar} acoes={<>
        <button type="button" onClick={() => imprimir(null)} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> {form.codigo} em branco</button>
        <button type="button" onClick={exportar} className="btn-outline inline-flex items-center gap-1.5"><Download className="h-4 w-4" aria-hidden /> Relatório (Excel)</button>
        {podeEscrever && <button type="button" onClick={() => setNova({ tipo: "RECLAMACAO", canal: "WHATSAPP", classificacao: "MEDIA", recebida_em: hoje, recebida_por: q.eu })} className="btn-primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" aria-hidden /> Registrar reclamação</button>}
      </>} />
      {!form.naListaMestra && <p className="rounded-xl bg-warn-50 p-3 text-sm text-warn-700">O formulário <b>{form.codigo}</b> ainda não está na Lista Mestra (Documentos e POPs). A impressão sai com “Rev. {form.revisao}” e sem data de emissão até ele ser cadastrado lá.</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard rotulo="Abertas" valor={abertas.length} sub={`${doAno.length} reclamação(ões) em ${ano}`} onClick={() => setFiltro(filtro === "ABERTAS" ? null : "ABERTAS")} ativo={filtro === "ABERTAS"} />
        <StatCard rotulo="Confirmação atrasada" valor={confAtras.length} tom={confAtras.length ? "bad" : "neutral"} sub="avisar o cliente em até 2 dias úteis" onClick={() => setFiltro(filtro === "CONF" ? null : "CONF")} ativo={filtro === "CONF"} />
        <StatCard rotulo="Resposta atrasada" valor={respAtras.length} tom={respAtras.length ? "bad" : "neutral"} sub="crítica 5 · alta 10 · média 15 · baixa 30 dias" onClick={() => setFiltro(filtro === "RESP" ? null : "RESP")} ativo={filtro === "RESP"} />
        <StatCard rotulo="Encerradas no ano" valor={encAno.length} tom="ok" sub={tempoMedio == null ? "—" : `tempo médio ${tempoMedio} dia(s)`} onClick={() => setFiltro(filtro === "ENC" ? null : "ENC")} ativo={filtro === "ENC"} />
        <StatCard rotulo="Procedentes no ano" valor={validadas.length ? `${Math.round((validadas.filter((r) => r.procedente).length / validadas.length) * 100)}%` : "—"} sub={`${validadas.filter((r) => r.procedente).length} de ${validadas.length} validada(s)`} />
      </div>
      {filtro && <div className="flex items-center gap-2 text-sm text-slate-600">Mostrando: <b>{FILTROS[filtro][0]}</b><button type="button" onClick={() => setFiltro(null)} className="text-brand-700 underline">limpar</button></div>}

      <div className="grid gap-4 2xl:grid-cols-[1.6fr_1fr]">
        <div className="card overflow-hidden">
          <div className="border-b p-3"><input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por protocolo, cliente, OS ou texto" /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Protocolo</th><th className="px-3 py-2">Recebida</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Classificação</th><th className="px-3 py-2">Etapa</th><th className="px-3 py-2">Resposta até</th></tr></thead>
              <tbody>
                {vis.map((r) => { const al = alertasPrazo(r, hoje); return (
                  <tr key={r.id} onClick={() => abrir(r)} className={`cursor-pointer border-t align-top hover:bg-slate-50 ${selId === r.id ? "bg-brand-50" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">{r.codigo}{r.tipo === "SUGESTAO" && <span className="ml-1 text-xs font-normal text-slate-500">sugestão</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2">{fmtData(r.recebida_em)}</td>
                    <td className="px-3 py-2"><span className="block font-medium">{r.cliente_nome || r.reclamante || "—"}</span><span className="line-clamp-1 text-xs text-slate-500">{r.descricao}</span></td>
                    <td className="px-3 py-2"><Pill tom={TOM_CLASSE[r.classificacao]}>{rotClasse(r.classificacao)}</Pill></td>
                    <td className="px-3 py-2"><Pill tom={r.etapa === "ENCERRADA" ? "ok" : "brand"}>{rotEtapa(r.etapa)}</Pill>{r.procedente === false && <span className="block text-xs text-slate-500">não procede</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.etapa === "ENCERRADA" ? "—" : fmtData(r.prazo_resposta)}{al.map((a) => <span key={a} className="block text-xs font-semibold text-bad-700">{a}</span>)}</td>
                  </tr>); })}
                {vis.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">{lista.length ? "Nada com esse filtro." : "Nenhuma reclamação registrada."}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card space-y-3 p-5">
          {!sel || !ed ? <p className="py-6 text-center text-sm text-slate-500">Clique numa reclamação para tratar: validação, investigação, resposta e encerramento.</p> : <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-display font-semibold text-slate-900">{sel.codigo} · {sel.cliente_nome || sel.reclamante}</h3>
              <button type="button" onClick={() => imprimir(sel)} className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Printer className="h-4 w-4" aria-hidden /> Imprimir {form.codigo}</button>
            </div>
            <div className="flex flex-wrap gap-1">{ETAPAS_RECLAMACAO.map(([k, l]) => <span key={k} className={`rounded-full px-2 py-0.5 text-[11px] ${k === sel.etapa ? "bg-brand font-semibold text-white" : ordemEtapa(k) < ordemEtapa(sel.etapa) ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"}`}>{l}</span>)}</div>
            {alertasPrazo(sel, hoje).length > 0 && <p className="rounded-xl bg-bad-50 p-2.5 text-sm text-bad-700">{alertasPrazo(sel, hoje).join(" · ")}</p>}

            <Bloco titulo="Registro">
              <p className="text-xs text-slate-500">Recebida em {fmtData(sel.recebida_em)} por {nome(sel.recebida_por)} · {CANAIS.find((c) => c[0] === sel.canal)?.[1] || "canal não informado"}{sel.os_referencia ? ` · ${sel.os_referencia}` : ""}</p>
              <Campo rotulo="Descrição"><textarea className="input" rows={3} value={ed.descricao || ""} onChange={set("descricao")} disabled={ro} /></Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Classificação"><select className="input" value={ed.classificacao} onChange={(e) => setEd({ ...ed, classificacao: e.target.value, prazo_resposta: prazoResposta(ed.recebida_em, e.target.value) })} disabled={ro}>{CLASSIFICACOES.map(([v, l, d]) => <option key={v} value={v}>{l} — {d}</option>)}</select></Campo>
                <Campo rotulo="Responsável"><SelectPessoa contas={contas} valor={ed.responsavel} onChange={(v) => setEd({ ...ed, responsavel: v })} disabled={ro} /></Campo>
                <Campo rotulo="Responder ao cliente até"><input type="date" className="input" value={ed.prazo_resposta || ""} onChange={set("prazo_resposta")} disabled={ro} /></Campo>
                <Campo rotulo="Envolvidos no serviço reclamado"><select multiple className="input h-20" value={ed.envolvidos || []} onChange={(e) => setEd({ ...ed, envolvidos: [...e.target.selectedOptions].map((o) => o.value) })} disabled={ro}>{contas.map((c) => <option key={c.usuario} value={c.usuario}>{c.nome}</option>)}</select></Campo>
              </div>
              {ed.classificacao === "CRITICA" && <Campo rotulo="Ação imediata *"><textarea className="input" rows={2} value={ed.acao_imediata || ""} onChange={set("acao_imediata")} disabled={ro} /></Campo>}
            </Bloco>

            {at("VALIDACAO") && <Bloco titulo="Validação e confirmação ao reclamante (7.9.3 b · 7.9.4)">
              <div className="flex flex-wrap gap-4 text-sm">
                {[[true, "Procede — é sobre atividade do laboratório"], [false, "Não procede"]].map(([v, l]) => <label key={String(v)} className="inline-flex items-center gap-2"><input type="radio" checked={ed.procedente === v} onChange={() => setEd({ ...ed, procedente: v })} disabled={ro} /> {l}</label>)}
              </div>
              <Campo rotulo="Por quê"><textarea className="input" rows={2} value={ed.validacao || ""} onChange={set("validacao")} disabled={ro} /></Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo={`Recebimento confirmado em (até ${fmtData(sel.prazo_confirmacao)})`}><input type="date" className="input" value={ed.confirmada_em || ""} onChange={set("confirmada_em")} disabled={ro} /></Campo>
                <Campo rotulo="Como"><select className="input" value={ed.confirmada_meio || ""} onChange={set("confirmada_meio")} disabled={ro}><option value="">—</option>{CANAIS.map(([v, l]) => <option key={v} value={l}>{l}</option>)}</select></Campo>
              </div>
            </Bloco>}

            {at("INVESTIGACAO") && sel.procedente !== false && <Bloco titulo="Investigação e ação">
              <Campo rotulo="Análise preliminar / investigação / causa raiz"><textarea className="input" rows={3} value={ed.analise || ""} onChange={set("analise")} disabled={ro} /></Campo>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {nc ? <span>Não conformidade <b>{nc.codigo}</b> · {nc.etapa === "ENCERRADA" ? "encerrada" : "em tratamento"}</span>
                  : podeEscrever && sel.etapa !== "ENCERRADA" && <button type="button" disabled={salvando} onClick={abrirNc} className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><FileWarning className="h-4 w-4" aria-hidden /> Abrir não conformidade (ação corretiva)</button>}
              </div>
              <Campo rotulo="Ação tomada"><textarea className="input" rows={2} value={ed.acao || ""} onChange={set("acao")} disabled={ro} placeholder="Correção feita e, se houve NC, a ação corretiva" /></Campo>
              <Campo rotulo="Verificação da eficácia"><textarea className="input" rows={2} value={ed.eficacia || ""} onChange={set("eficacia")} disabled={ro} /></Campo>
            </Bloco>}

            {at("RESPOSTA") && <Bloco titulo="Resposta ao cliente e encerramento (7.9.6 · 7.9.7)">
              <Campo rotulo="Resposta dada ao cliente"><textarea className="input" rows={3} value={ed.resposta || ""} onChange={set("resposta")} disabled={ro} /></Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Respondida em"><input type="date" className="input" value={ed.respondida_em || ""} onChange={set("respondida_em")} disabled={ro} /></Campo>
                <Campo rotulo="Como"><select className="input" value={ed.respondida_meio || ""} onChange={set("respondida_meio")} disabled={ro}><option value="">—</option>{CANAIS.map(([v, l]) => <option key={v} value={l}>{l}</option>)}</select></Campo>
                <Campo rotulo="Analisado por"><SelectPessoa contas={contas.filter((c) => !(ed.envolvidos || []).includes(c.usuario))} valor={ed.analisado_por} onChange={(v) => setEd({ ...ed, analisado_por: v, analisado_em: ed.analisado_em || hoje })} disabled={ro} /></Campo>
                <Campo rotulo="Em"><input type="date" className="input" value={ed.analisado_em || ""} onChange={set("analisado_em")} disabled={ro} /></Campo>
                <Campo rotulo="Aprovado por"><SelectPessoa contas={contas.filter((c) => !(ed.envolvidos || []).includes(c.usuario))} valor={ed.aprovado_por} onChange={(v) => setEd({ ...ed, aprovado_por: v, aprovado_em: ed.aprovado_em || hoje })} disabled={ro} /></Campo>
                <Campo rotulo="Em"><input type="date" className="input" value={ed.aprovado_em || ""} onChange={set("aprovado_em")} disabled={ro} /></Campo>
              </div>
              <Campo rotulo="Observação"><textarea className="input" rows={2} value={ed.observacao || ""} onChange={set("observacao")} disabled={ro} /></Campo>
              <Campo rotulo="Encerramento / análise de tendência"><textarea className="input" rows={2} value={ed.encerramento || ""} onChange={set("encerramento")} disabled={ro} placeholder="Ex.: ocorrência pontual, sem recorrência nos últimos 12 meses" /></Campo>
            </Bloco>}

            {sel.etapa === "ENCERRADA" && <p className="rounded-xl bg-ok-50 p-3 text-sm text-ok-700">Encerrada em {fmtData(sel.encerrada_em)} por {nome(sel.encerrada_por)}.</p>}
            <div><span className="label">Evidências (prints, e-mails, relatório corrigido)</span><Anexos refTipo="reclamacao" refId={sel.id} arquivos={arquivos} podeEscrever={podeEscrever} aoMudar={recarregar} avisar={avisar} /></div>
            <Historico itens={sel.historico} nome={nome} />
            {podeEscrever && <div className="flex flex-wrap gap-2 border-t pt-3">
              {sel.etapa !== "ENCERRADA" && <button type="button" disabled={salvando} onClick={() => gravar(ed, {}, "Salvo.")} className="btn-outline">Salvar</button>}
              {proxima && <button type="button" disabled={salvando} onClick={() => gravar(ed, { seguir: true }, `Seguiu para “${rotEtapa(proxima)}”.`)} className="btn-primary inline-flex items-center gap-1.5">{proxima === "ENCERRADA" ? "Encerrar reclamação" : `Seguir para “${rotEtapa(proxima)}”`} <ArrowRight className="h-4 w-4" aria-hidden /></button>}
              {sel.etapa === "ENCERRADA" && <button type="button" disabled={salvando} onClick={() => { const motivo = window.prompt("Motivo da reabertura:"); if (motivo) gravar({ id: sel.id }, { reabrir: true, motivo }, "Reaberta."); }} className="btn-ghost inline-flex items-center gap-1.5"><RotateCcw className="h-4 w-4" aria-hidden /> Reabrir</button>}
            </div>}
          </>}
        </div>
      </div>

      <Modal titulo="Registrar reclamação" aberto={!!nova} aoFechar={() => setNova(null)} largura="max-w-2xl">
        {nova && <form onSubmit={criar} className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Tipo"><select className="input" value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })}><option value="RECLAMACAO">Reclamação</option><option value="SUGESTAO">Sugestão</option></select></Campo>
          <Campo rotulo="Recebida em"><input type="date" className="input" value={nova.recebida_em} onChange={(e) => setNova({ ...nova, recebida_em: e.target.value })} /></Campo>
          <Campo rotulo="Cliente"><input className="input" value={nova.cliente_nome || ""} onChange={(e) => setNova({ ...nova, cliente_nome: e.target.value })} /></Campo>
          <Campo rotulo="CNPJ/CPF"><input className="input" value={nova.cnpj_cpf || ""} onChange={(e) => setNova({ ...nova, cnpj_cpf: e.target.value })} /></Campo>
          <Campo rotulo="Reclamante (quem falou)"><input className="input" value={nova.reclamante || ""} onChange={(e) => setNova({ ...nova, reclamante: e.target.value })} /></Campo>
          <Campo rotulo="Canal"><select className="input" value={nova.canal} onChange={(e) => setNova({ ...nova, canal: e.target.value })}>{CANAIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          <Campo rotulo="Telefone"><input className="input" value={nova.contato || ""} onChange={(e) => setNova({ ...nova, contato: e.target.value })} /></Campo>
          <Campo rotulo="E-mail"><input type="email" className="input" value={nova.email || ""} onChange={(e) => setNova({ ...nova, email: e.target.value })} /></Campo>
          <Campo rotulo="OS / relatório citado"><input className="input" value={nova.os_referencia || ""} onChange={(e) => setNova({ ...nova, os_referencia: e.target.value })} placeholder="OS01681/2026" /></Campo>
          <Campo rotulo="Data do ocorrido"><input type="date" className="input" value={nova.ocorrido_em || ""} onChange={(e) => setNova({ ...nova, ocorrido_em: e.target.value })} /></Campo>
          <Campo rotulo="Descrição detalhada *" className="sm:col-span-2"><textarea className="input" rows={4} required value={nova.descricao || ""} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} /></Campo>
          <Campo rotulo="Classificação"><select className="input" value={nova.classificacao} onChange={(e) => setNova({ ...nova, classificacao: e.target.value })}>{CLASSIFICACOES.map(([v, l, d]) => <option key={v} value={v}>{l} — {d}</option>)}</select></Campo>
          <Campo rotulo="Responsável pelo tratamento"><SelectPessoa contas={contas} valor={nova.responsavel} onChange={(v) => setNova({ ...nova, responsavel: v })} /></Campo>
          {nova.classificacao === "CRITICA" && <Campo rotulo="Ação imediata *" className="sm:col-span-2"><textarea className="input" rows={2} value={nova.acao_imediata || ""} onChange={(e) => setNova({ ...nova, acao_imediata: e.target.value })} /></Campo>}
          <p className="text-xs text-slate-500 sm:col-span-2">O protocolo (RRC NNN/{String(nova.recebida_em).slice(0, 4)}) é gerado ao salvar. Confirmar o recebimento ao cliente em até 2 dias úteis; responder até {fmtData(prazoResposta(nova.recebida_em || hoje, nova.classificacao))}.</p>
          <button disabled={salvando} className="btn-primary sm:col-span-2">{salvando ? "Salvando..." : "Registrar"}</button>
        </form>}
      </Modal>
    </div>
  );
}

function Bloco({ titulo, children }) {
  return <section className="space-y-2.5 rounded-2xl border p-3"><h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h4>{children}</section>;
}

function Historico({ itens, nome }) {
  const lista = Array.isArray(itens) ? [...itens].reverse() : [];
  if (!lista.length) return null;
  return (
    <details className="rounded-2xl border p-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-700">Histórico ({lista.length})</summary>
      <ol className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
        {lista.map((h, i) => <li key={i}><span className="text-xs text-slate-500">{new Date(h.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })} · {nome(h.por)}</span>
          <span className="block text-slate-800">{h.de && h.de !== h.para ? `${rotEtapa(h.de)} → ${rotEtapa(h.para)}` : h.texto}</span>{h.de && h.de !== h.para && h.texto && <span className="block text-slate-600">{h.texto}</span>}</li>)}
      </ol>
    </details>
  );
}
