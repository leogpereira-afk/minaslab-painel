// Qualidade › Pessoal e competência (ISO/IEC 17025 · 6.2; PT 001 – Capacitação do pessoal).
// Abas: Colaboradores (RELP, supervisão de 90 dias) · Treinamentos (RT/PAT + AVET 1 mês depois) ·
// Autorizações (AUTZ) · Matriz de competências (MC). Cada registro imprime o formulário do PT 001.
// Os colaboradores vêm do cadastro do RH (só nome, função, setor, admissão e formação).
import { useMemo, useState } from "react";
import { BadgeCheck, CalendarClock, GraduationCap, Plus, Printer, Users } from "lucide-react";
import { salvarPessoal } from "../../../services/qualidade.js";
import { abrirImpressao, dadosDoFormulario } from "../../../lib/impressao/formularioQualidade.js";
import { FORM_RT, FORM_AVET, FORM_AUTZ, FORM_MC, FORM_RELP, corpoRt, corpoAvet, corpoAutz, corpoMc, corpoRelp } from "../../../lib/impressao/pessoal.js";
import { ORIGENS_TREINAMENTO, STATUS_MATRIZ, PERGUNTAS_AVET, pendenciasEficacia, emSupervisao, cumprimentoPat, META_PAT, somaDias, DIAS_EFICACIA } from "../../../../supabase/functions/_shared/pessoal-regras.mjs";
import { StatCard, Modal } from "../../ui.jsx";
import { Anexos, Cabecalho, Campo, Pill, SelectPessoa, fmtData, hojeYmd, nomeDe } from "./comum.jsx";

const ABAS = [["colaboradores", "Colaboradores"], ["treinamentos", "Treinamentos"], ["autorizacoes", "Autorizações"], ["matriz", "Matriz de competências"]];
const rotOrigem = (o) => ORIGENS_TREINAMENTO.find((x) => x[0] === o)?.[1] || o;
const TOM_STATUS = { PLANEJADO: "sky", REALIZADO: "ok", CANCELADO: "gray" };

export default function Pessoal({ q, voltar, recarregar, avisar }) {
  const { contas, arquivos, podeEscrever } = q;
  const pessoas = q.pessoas || [], treinamentos = q.treinamentos || [], eficacias = q.eficacias || [], autorizacoes = q.autorizacoes || [], matriz = q.matriz || [];
  const hoje = hojeYmd(), ano = Number(hoje.slice(0, 4));
  const [aba, setAba] = useState("colaboradores");
  const [salvando, setSalvando] = useState(false);
  const [trein, setTrein] = useState(null);       // edição de treinamento (RT/PAT)
  const [efic, setEfic] = useState(null);         // AVET de um participante
  const [autz, setAutz] = useState(null);         // AUTZ
  const [pessoaSel, setPessoaSel] = useState(null);
  const [verInativos, setVerInativos] = useState(false);
  const nome = (u) => nomeDe(contas, u);
  const tituloDoc = (c) => q.documentos.find((d) => d.codigo === c)?.titulo || "";
  const form = (padrao) => dadosDoFormulario(q.documentos, padrao);
  const imprimir = (padrao, corpo, opcoes = {}) => { try { abrirImpressao({ form: form(padrao), corpo, impressoPor: nome(q.eu), ...opcoes }); } catch (e) { avisar({ tipo: "erro", texto: e.message }); } };

  const ativos = pessoas.filter((p) => p.ativo);
  const lista = verInativos ? pessoas : ativos;
  const autzVigente = (pid) => autorizacoes.find((z) => String(z.pessoa_id) === String(pid) && !z.revogada_em);
  const supervisao = ativos.filter((p) => emSupervisao(p, hoje));
  const semAutz = ativos.filter((p) => !autzVigente(p.id));
  const pend = treinamentos.map((t) => ({ t, ...pendenciasEficacia(t, eficacias, hoje) })).filter((x) => x.pendentes.length);
  const efAtras = pend.filter((x) => x.atrasada);
  const pat = cumprimentoPat(treinamentos, ano);
  const autzRevisar = autorizacoes.filter((z) => !z.revogada_em && z.revisar_em && z.revisar_em < hoje);

  async function gravar(tipo, reg, msg) {
    setSalvando(true);
    try { const r = await salvarPessoal(tipo, reg); await recarregar(); if (msg) avisar({ tipo: "ok", texto: typeof msg === "function" ? msg(r) : msg }); return r || true; }
    catch (e) { avisar({ tipo: "erro", texto: e.message }); return null; } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Pessoal e competência" iso="ISO 17025 · 6.2 · PT 001" voltar={voltar} acoes={<>
        <button type="button" onClick={() => imprimir(FORM_RELP, corpoRelp(ativos.map((p) => ({ ...p, autz: autzVigente(p.id)?.codigo }))), { paisagem: true })} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> RELP</button>
        {podeEscrever && <button type="button" onClick={() => setTrein({ status: "REALIZADO", origem: "EVENTUAL", tipo: "INTERNO", data: hoje, local: "MinasLab", participantes: [], documentos: [], responsavel: q.eu })} className="btn-primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" aria-hidden /> Registrar treinamento</button>}
      </>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard rotulo="Colaboradores ativos" valor={ativos.length} icone={Users} sub={`${supervisao.length} em supervisão (até 90 dias)`} onClick={() => setAba("colaboradores")} />
        <StatCard rotulo="Sem autorização vigente" valor={semAutz.length} tom={semAutz.length ? "warn" : "ok"} icone={BadgeCheck} sub={autzRevisar.length ? `${autzRevisar.length} para reavaliar` : "AUTZ em dia"} onClick={() => setAba("autorizacoes")} />
        <StatCard rotulo="Eficácia pendente" valor={pend.reduce((s, x) => s + x.pendentes.length, 0)} tom={efAtras.length ? "bad" : "neutral"} icone={CalendarClock} sub={efAtras.length ? `${efAtras.length} treinamento(s) com prazo vencido` : "AVET 1 mês após o treinamento"} onClick={() => setAba("treinamentos")} />
        <StatCard rotulo={`PAT ${ano}`} valor={pat.pct == null ? "—" : `${pat.pct}%`} tom={pat.pct == null ? "neutral" : pat.pct >= META_PAT ? "ok" : "warn"} icone={GraduationCap} sub={`${pat.realizados} de ${pat.previstos} · meta ${META_PAT}%`} onClick={() => setAba("treinamentos")} />
        <StatCard rotulo={`Treinamentos em ${ano}`} valor={treinamentos.filter((t) => t.status === "REALIZADO" && String(t.data).startsWith(String(ano))).length} sub="registrados no RT" onClick={() => setAba("treinamentos")} />
      </div>

      <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1">
        {ABAS.map(([v, l]) => <button key={v} type="button" onClick={() => setAba(v)} className={`rounded-xl px-3 py-1.5 text-sm ${aba === v ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600"}`}>{l}</button>)}
      </div>

      {aba === "colaboradores" && <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b p-3 text-sm"><span className="text-slate-500">Cadastro vem do RH. Clique para ver o histórico de competência.</span><label className="inline-flex items-center gap-2"><input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} /> mostrar desligados</label></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Colaborador</th><th className="px-3 py-2">Função</th><th className="px-3 py-2">Admissão</th><th className="px-3 py-2">Treinamentos</th><th className="px-3 py-2">Autorização</th><th className="px-3 py-2">Matriz</th></tr></thead>
          <tbody>{lista.map((p) => { const sup = emSupervisao(p, hoje); const z = autzVigente(p.id); const nT = treinamentos.filter((t) => t.status === "REALIZADO" && (t.participantes || []).some((x) => String(x.id) === String(p.id))).length; const nM = matriz.filter((m) => String(m.pessoa_id) === String(p.id) && m.status === "LIBERADO").length; return (
            <tr key={p.id} onClick={() => setPessoaSel(p)} className="cursor-pointer border-t hover:bg-slate-50">
              <td className="px-3 py-2 font-medium text-slate-900">{p.nome}{!p.ativo && <span className="ml-1 text-xs text-slate-400">desligado</span>}</td>
              <td className="px-3 py-2">{p.cargo || "—"}<span className="block text-xs text-slate-500">{p.setor}</span></td>
              <td className="whitespace-nowrap px-3 py-2">{fmtData(p.admissao)}{sup && <span className="block text-xs font-semibold text-warn-700">supervisão até {fmtData(sup)}</span>}</td>
              <td className="px-3 py-2">{nT}</td>
              <td className="px-3 py-2">{z ? <Pill tom="ok">{z.codigo}</Pill> : <Pill tom="warn">sem AUTZ</Pill>}</td>
              <td className="px-3 py-2">{nM ? `${nM} liberado(s)` : "—"}</td>
            </tr>); })}
            {lista.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhum colaborador no RH.</td></tr>}
          </tbody></table></div>
      </div>}

      {aba === "treinamentos" && <div className="card overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Nº</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Treinamento</th><th className="px-3 py-2">Origem</th><th className="px-3 py-2">Participantes</th><th className="px-3 py-2">Eficácia (AVET)</th><th className="px-3 py-2" /></tr></thead>
          <tbody>{treinamentos.map((t) => { const pe = pendenciasEficacia(t, eficacias, hoje); const avs = eficacias.filter((a) => a.treinamento_id === t.id); return (
            <tr key={t.id} className="border-t align-top">
              <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">{t.codigo}<span className="block"><Pill tom={TOM_STATUS[t.status]}>{t.status === "PLANEJADO" ? "Planejado" : t.status === "CANCELADO" ? "Cancelado" : "Realizado"}</Pill></span></td>
              <td className="whitespace-nowrap px-3 py-2">{fmtData(t.data)}<span className="block text-xs text-slate-500">{t.carga_horaria}</span></td>
              <td className="px-3 py-2"><span className="font-medium">{t.tema}</span>{(t.documentos || []).length > 0 && <span className="block text-xs text-slate-500">{t.documentos.join(", ")}</span>}</td>
              <td className="px-3 py-2 text-xs">{rotOrigem(t.origem)}</td>
              <td className="px-3 py-2 text-xs">{(t.participantes || []).map((p) => p.nome).join(", ") || "—"}</td>
              <td className="px-3 py-2 text-xs">{t.status !== "REALIZADO" ? "—" : <>
                {avs.map((a) => <button key={a.id} type="button" onClick={() => setEfic({ ...a, _t: t })} className="mb-0.5 mr-1 inline-block rounded-full border px-2 py-0.5 hover:bg-slate-50">{String(a.nome || "").split(" ")[0]}: {a.eficaz ? "eficaz" : "não eficaz"}</button>)}
                {pe.pendentes.map((p) => <button key={p.id} type="button" disabled={!podeEscrever} onClick={() => setEfic({ _t: t, treinamento_id: t.id, pessoa_id: p.id, nome: p.nome, cargo: p.cargo, data_avaliacao: hoje, avaliadores: [q.eu] })} className={`mb-0.5 mr-1 inline-block rounded-full px-2 py-0.5 ${pe.atrasada ? "bg-bad-50 font-semibold text-bad-700" : "bg-warn-50 text-warn-700"}`}>avaliar {String(p.nome).split(" ")[0]}</button>)}
                {pe.pendentes.length > 0 && <span className="block text-slate-500">até {fmtData(pe.prazo)}</span>}
              </>}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right"><button type="button" onClick={() => imprimir(FORM_RT, corpoRt(t, { tituloDoc }))} className="btn-ghost px-2 py-1 text-xs" title="Imprimir RT"><Printer className="h-4 w-4" aria-hidden /></button>{podeEscrever && <button type="button" onClick={() => setTrein({ ...t })} className="btn-outline ml-1 px-2.5 py-1 text-xs">Abrir</button>}</td>
            </tr>); })}
            {treinamentos.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Nenhum treinamento registrado. Use “Registrar treinamento” (realizado ou planejado no PAT).</td></tr>}
          </tbody></table></div>
      </div>}

      {aba === "autorizacoes" && <div className="space-y-3">
        {podeEscrever && <div className="flex justify-end"><button type="button" onClick={() => setAutz({ data_autorizacao: hoje, revisar_em: somaDias(hoje, 365), autorizado_por: q.eu })} className="btn-primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" aria-hidden /> Nova autorização</button></div>}
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Nº</th><th className="px-3 py-2">Colaborador</th><th className="px-3 py-2">Atividades autorizadas</th><th className="px-3 py-2">Desde</th><th className="px-3 py-2">Reavaliar em</th><th className="px-3 py-2" /></tr></thead>
          <tbody>{autorizacoes.map((z) => (
            <tr key={z.id} className={`border-t align-top ${z.revogada_em ? "text-slate-400" : ""}`}>
              <td className="whitespace-nowrap px-3 py-2 font-semibold">{z.codigo}{z.revogada_em && <span className="block text-xs">revogada</span>}</td>
              <td className="px-3 py-2">{z.nome}<span className="block text-xs text-slate-500">{z.cargo}</span></td>
              <td className="px-3 py-2 text-xs"><span className="line-clamp-3 whitespace-pre-line">{z.atividades}</span></td>
              <td className="whitespace-nowrap px-3 py-2">{fmtData(z.data_autorizacao)}</td>
              <td className={`whitespace-nowrap px-3 py-2 ${!z.revogada_em && z.revisar_em && z.revisar_em < hoje ? "font-semibold text-bad-700" : ""}`}>{fmtData(z.revisar_em)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right"><button type="button" onClick={() => imprimir(FORM_AUTZ, corpoAutz(z, { nome }))} className="btn-ghost px-2 py-1 text-xs" title="Imprimir AUTZ"><Printer className="h-4 w-4" aria-hidden /></button>{podeEscrever && <button type="button" onClick={() => setAutz({ ...z })} className="btn-outline ml-1 px-2.5 py-1 text-xs">Abrir</button>}</td>
            </tr>))}
            {autorizacoes.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Nenhuma autorização registrada.</td></tr>}
          </tbody></table></div></div>
      </div>}

      {aba === "matriz" && <Matriz q={q} ativos={ativos} matriz={matriz} podeEscrever={podeEscrever} salvando={salvando} gravar={gravar} imprimirMc={(p) => imprimir(FORM_MC, corpoMc(p, matriz.filter((m) => String(m.pessoa_id) === String(p.id)).sort((a, b) => a.documento.localeCompare(b.documento, "pt-BR")), { aprovadoPor: nome(q.eu), data: hoje }))} />}

      {/* Ficha do colaborador */}
      <Modal titulo={pessoaSel ? pessoaSel.nome : ""} aberto={!!pessoaSel} aoFechar={() => setPessoaSel(null)} largura="max-w-2xl">
        {pessoaSel && <FichaColaborador p={pessoaSel} hoje={hoje} treinamentos={treinamentos} eficacias={eficacias} autorizacoes={autorizacoes} matriz={matriz}
          imprimirMc={() => imprimir(FORM_MC, corpoMc(pessoaSel, matriz.filter((m) => String(m.pessoa_id) === String(pessoaSel.id)), { aprovadoPor: nome(q.eu), data: hoje }))} />}
      </Modal>

      {/* RT / PAT */}
      <Modal titulo={trein?.id ? `Treinamento ${trein.codigo}` : "Registrar treinamento"} aberto={!!trein} aoFechar={() => setTrein(null)} largura="max-w-3xl">
        {trein && <form onSubmit={async (e) => { e.preventDefault(); const r = await gravar("treinamento", trein, (x) => `Treinamento ${x.codigo} salvo.`); if (r) setTrein(null); }} className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Situação"><select className="input" value={trein.status} onChange={(e) => setTrein({ ...trein, status: e.target.value })}><option value="REALIZADO">Realizado</option><option value="PLANEJADO">Planejado (PAT)</option><option value="CANCELADO">Cancelado</option></select></Campo>
          <Campo rotulo="Origem"><select className="input" value={trein.origem} onChange={(e) => setTrein({ ...trein, origem: e.target.value })}>{ORIGENS_TREINAMENTO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          <Campo rotulo="Tipo"><select className="input" value={trein.tipo} onChange={(e) => setTrein({ ...trein, tipo: e.target.value })}><option value="INTERNO">Interno</option><option value="EXTERNO">Externo</option></select></Campo>
          <Campo rotulo="Treinamento (tema) *" className="sm:col-span-3"><textarea className="input" rows={2} required value={trein.tema || ""} onChange={(e) => setTrein({ ...trein, tema: e.target.value })} /></Campo>
          <Campo rotulo="Objetivo" className="sm:col-span-3"><textarea className="input" rows={2} value={trein.objetivo || ""} onChange={(e) => setTrein({ ...trein, objetivo: e.target.value })} /></Campo>
          <Campo rotulo={trein.status === "PLANEJADO" ? "Previsto para" : "Data *"}><input type="date" className="input" value={trein.data || ""} onChange={(e) => setTrein({ ...trein, data: e.target.value, eficacia_prevista: e.target.value ? somaDias(e.target.value, DIAS_EFICACIA) : "" })} /></Campo>
          <Campo rotulo="Carga horária"><input className="input" value={trein.carga_horaria || ""} onChange={(e) => setTrein({ ...trein, carga_horaria: e.target.value })} placeholder="4h" /></Campo>
          <Campo rotulo="Local"><input className="input" value={trein.local || ""} onChange={(e) => setTrein({ ...trein, local: e.target.value })} /></Campo>
          <Campo rotulo="Responsável(is) pelo treinamento" className="sm:col-span-2"><input className="input" value={trein.instrutor || ""} onChange={(e) => setTrein({ ...trein, instrutor: e.target.value })} placeholder="Quem ministrou" /></Campo>
          <Campo rotulo="Avaliar eficácia até"><input type="date" className="input" value={trein.eficacia_prevista || ""} onChange={(e) => setTrein({ ...trein, eficacia_prevista: e.target.value })} /></Campo>
          <Campo rotulo="Participantes" className="sm:col-span-3"><Escolha opcoes={ativos.map((p) => ({ v: p.id, l: p.nome, d: p.cargo }))} valor={(trein.participantes || []).map((p) => p.id)} onChange={(ids) => setTrein({ ...trein, participantes: ids.map((id) => { const p = pessoas.find((x) => x.id === id) || (trein.participantes || []).find((x) => x.id === id); return { id, nome: p?.nome, cargo: p?.cargo }; }) })} /></Campo>
          <Campo rotulo="Documentos treinados (Lista Mestra) — eficaz → liberado na matriz" className="sm:col-span-3"><Escolha opcoes={q.documentos.filter((d) => d.status !== "OBSOLETO").map((d) => ({ v: d.codigo, l: d.codigo, d: d.titulo }))} valor={trein.documentos || []} onChange={(v) => setTrein({ ...trein, documentos: v })} busca /></Campo>
          <Campo rotulo="Observações" className="sm:col-span-3"><textarea className="input" rows={2} value={trein.observacao || ""} onChange={(e) => setTrein({ ...trein, observacao: e.target.value })} /></Campo>
          {trein.id && <div className="sm:col-span-3"><span className="label">Evidências (lista de presença assinada, certificado, material)</span><Anexos refTipo="treinamento" refId={trein.id} arquivos={arquivos} podeEscrever={podeEscrever} aoMudar={recarregar} avisar={avisar} /></div>}
          <div className="flex justify-end gap-2 sm:col-span-3">
            {trein.id && <button type="button" onClick={() => imprimir(FORM_RT, corpoRt(trein, { tituloDoc }))} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> Imprimir RT</button>}
            <button disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>}
      </Modal>

      {/* AVET */}
      <Modal titulo={efic ? `Eficácia do treinamento · ${efic.nome}` : ""} aberto={!!efic} aoFechar={() => setEfic(null)} largura="max-w-3xl">
        {efic && <form onSubmit={async (e) => { e.preventDefault(); const { _t, ...reg } = efic; const r = await gravar("eficacia", reg, `Avaliação de ${efic.nome} salva.${efic.eficaz && (_t.documentos || []).length ? " Documentos liberados na matriz." : ""}`); if (r) setEfic(null); }} className="grid gap-3">
          <p className="text-sm text-slate-600"><b>{efic._t.codigo}</b> · {efic._t.tema} · realizado em {fmtData(efic._t.data)}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Data da avaliação"><input type="date" className="input" value={efic.data_avaliacao || ""} onChange={(e) => setEfic({ ...efic, data_avaliacao: e.target.value })} /></Campo>
            <Campo rotulo="Responsáveis pela avaliação"><Escolha opcoes={contas.map((c) => ({ v: c.usuario, l: c.nome }))} valor={efic.avaliadores || []} onChange={(v) => setEfic({ ...efic, avaliadores: v })} /></Campo>
          </div>
          {PERGUNTAS_AVET.map(([k, titulo, opcoes]) => <fieldset key={k} className="rounded-2xl border p-3"><legend className="px-1 text-sm font-semibold text-slate-700">{titulo}</legend>
            <div className={opcoes ? "grid gap-1" : "flex flex-wrap gap-3"}>{(opcoes || ["", "", "", "", ""]).map((o, i) => <label key={i} className="inline-flex items-start gap-2 text-sm"><input type="radio" name={k} checked={Number(efic[k]) === i + 1} onChange={() => setEfic({ ...efic, [k]: i + 1, ...(k === "nota_geral" && efic.eficaz == null ? { eficaz: i + 1 >= 3 } : {}) })} /> <span><b>{i + 1}</b>{o ? ` — ${o}` : ""}</span></label>)}</div>
          </fieldset>)}
          <Campo rotulo="Melhorias obtidas"><textarea className="input" rows={2} value={efic.melhorias || ""} onChange={(e) => setEfic({ ...efic, melhorias: e.target.value })} /></Campo>
          <div className="flex flex-wrap gap-4 text-sm"><span className="font-semibold">Resultado:</span>{[[true, "Eficaz"], [false, "Não eficaz"]].map(([v, l]) => <label key={l} className="inline-flex items-center gap-2"><input type="radio" checked={efic.eficaz === v} onChange={() => setEfic({ ...efic, eficaz: v })} /> {l}</label>)}</div>
          {efic.eficaz === false && <div className="grid gap-3 rounded-2xl border border-bad-200 p-3 sm:grid-cols-2">
            <Campo rotulo="Descrição e causa da não eficácia" className="sm:col-span-2"><textarea className="input" rows={2} value={efic.plano_causa || ""} onChange={(e) => setEfic({ ...efic, plano_causa: e.target.value })} /></Campo>
            <Campo rotulo="Ação a ser tomada *" className="sm:col-span-2"><textarea className="input" rows={2} value={efic.plano_acao || ""} onChange={(e) => setEfic({ ...efic, plano_acao: e.target.value })} /></Campo>
            <Campo rotulo="Responsável"><input className="input" value={efic.plano_responsavel || ""} onChange={(e) => setEfic({ ...efic, plano_responsavel: e.target.value })} /></Campo>
            <Campo rotulo="Data"><input type="date" className="input" value={efic.plano_data || ""} onChange={(e) => setEfic({ ...efic, plano_data: e.target.value })} /></Campo>
            <Campo rotulo="Verificação da eficácia da ação" className="sm:col-span-2"><textarea className="input" rows={2} value={efic.plano_verificacao || ""} onChange={(e) => setEfic({ ...efic, plano_verificacao: e.target.value })} /></Campo>
          </div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Aprovação (gerente)"><SelectPessoa contas={contas} valor={efic.aprovado_por} onChange={(v) => setEfic({ ...efic, aprovado_por: v, aprovado_em: efic.aprovado_em || hoje })} /></Campo>
            <Campo rotulo="Data"><input type="date" className="input" value={efic.aprovado_em || ""} onChange={(e) => setEfic({ ...efic, aprovado_em: e.target.value })} /></Campo>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => imprimir(FORM_AVET, corpoAvet(efic, efic._t, { nome }))} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> Imprimir AVET</button>
            {podeEscrever && <button disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar avaliação"}</button>}
          </div>
        </form>}
      </Modal>

      {/* AUTZ */}
      <Modal titulo={autz?.id ? `Autorização ${autz.codigo}` : "Nova autorização"} aberto={!!autz} aoFechar={() => setAutz(null)} largura="max-w-2xl">
        {autz && <form onSubmit={async (e) => { e.preventDefault(); const r = await gravar("autorizacao", autz, (x) => `Autorização ${x.codigo} salva.`); if (r) setAutz(null); }} className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Colaborador *"><select className="input" value={autz.pessoa_id || ""} disabled={!!autz.id} onChange={(e) => { const p = pessoas.find((x) => x.id === e.target.value); setAutz({ ...autz, pessoa_id: p?.id, pessoa: p && { id: p.id, nome: p.nome, cargo: p.cargo }, nome: p?.nome, cargo: p?.cargo }); }}><option value="">—</option>{ativos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
          <Campo rotulo="Cargo / função"><input className="input" value={autz.cargo || ""} onChange={(e) => setAutz({ ...autz, cargo: e.target.value })} /></Campo>
          <Campo rotulo="Atividades autorizadas * (uma por linha)" className="sm:col-span-2"><textarea className="input" rows={6} value={autz.atividades || ""} onChange={(e) => setAutz({ ...autz, atividades: e.target.value })} placeholder={"Ex.:\nRealizar ensaios microbiológicos conforme POP-CQ-0xx\nOperar autoclave e estufas\nEmitir e assinar relatórios de ensaio (signatário)"} /></Campo>
          <Campo rotulo="Fundamentação (treinamentos, CCOM, experiência)" className="sm:col-span-2"><textarea className="input" rows={2} value={autz.fundamentacao || ""} onChange={(e) => setAutz({ ...autz, fundamentacao: e.target.value })} /></Campo>
          <Campo rotulo="Autorizado por"><SelectPessoa contas={contas} valor={autz.autorizado_por} onChange={(v) => setAutz({ ...autz, autorizado_por: v })} /></Campo>
          <Campo rotulo="Data da autorização"><input type="date" className="input" value={autz.data_autorizacao || ""} onChange={(e) => setAutz({ ...autz, data_autorizacao: e.target.value })} /></Campo>
          <Campo rotulo="Reavaliar em"><input type="date" className="input" value={autz.revisar_em || ""} onChange={(e) => setAutz({ ...autz, revisar_em: e.target.value })} /></Campo>
          {autz.id && <Campo rotulo="Revogada em"><input type="date" className="input" value={autz.revogada_em || ""} onChange={(e) => setAutz({ ...autz, revogada_em: e.target.value })} /></Campo>}
          {autz.revogada_em && <Campo rotulo="Motivo da revogação *" className="sm:col-span-2"><input className="input" value={autz.revogada_motivo || ""} onChange={(e) => setAutz({ ...autz, revogada_motivo: e.target.value })} /></Campo>}
          {autz.id && <div className="sm:col-span-2"><span className="label">AUTZ assinada (digitalizada)</span><Anexos refTipo="autorizacao" refId={autz.id} arquivos={arquivos} podeEscrever={podeEscrever} aoMudar={recarregar} avisar={avisar} /></div>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => imprimir(FORM_AUTZ, corpoAutz(autz, { nome }))} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> Imprimir AUTZ</button>
            <button disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </form>}
      </Modal>
    </div>
  );
}

/** Seleção múltipla com chips (participantes, documentos, avaliadores). */
function Escolha({ opcoes, valor, onChange, busca = false }) {
  const [filtro, setFiltro] = useState("");
  const sel = new Set(valor);
  const vis = useMemo(() => { const s = filtro.trim().toLowerCase(); return opcoes.filter((o) => !s || `${o.l} ${o.d || ""}`.toLowerCase().includes(s)).slice(0, busca ? 60 : 200); }, [opcoes, filtro, busca]);
  return (
    <div className="rounded-xl border p-2">
      {valor.length > 0 && <div className="mb-2 flex flex-wrap gap-1">{valor.map((v) => { const o = opcoes.find((x) => x.v === v); return <button key={v} type="button" onClick={() => onChange(valor.filter((x) => x !== v))} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{o?.l || v} ×</button>; })}</div>}
      {busca && <input className="input mb-2 py-1.5 text-sm" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar código ou título" />}
      <div className="max-h-36 overflow-y-auto text-sm">{vis.map((o) => <label key={o.v} className="flex items-start gap-2 py-0.5"><input type="checkbox" checked={sel.has(o.v)} onChange={(e) => onChange(e.target.checked ? [...valor, o.v] : valor.filter((x) => x !== o.v))} /> <span>{o.l}{o.d && <span className="text-xs text-slate-500"> · {o.d}</span>}</span></label>)}</div>
    </div>
  );
}

function FichaColaborador({ p, hoje, treinamentos, eficacias, autorizacoes, matriz, imprimirMc }) {
  const sup = emSupervisao(p, hoje);
  const ts = treinamentos.filter((t) => (t.participantes || []).some((x) => String(x.id) === String(p.id)));
  const zs = autorizacoes.filter((z) => String(z.pessoa_id) === String(p.id));
  const ms = matriz.filter((m) => String(m.pessoa_id) === String(p.id));
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 rounded-2xl border p-3 sm:grid-cols-2">
        <span><b>Função:</b> {p.cargo || "—"}</span><span><b>Setor:</b> {p.setor || "—"}</span>
        <span><b>Admissão:</b> {fmtData(p.admissao)}</span><span><b>Formação:</b> {[p.escolaridade, p.formacao].filter(Boolean).join(" · ") || "—"}</span>
        {p.registroConselho && <span><b>Conselho:</b> {p.registroConselho}</span>}
        {sup && <span className="font-semibold text-warn-700 sm:col-span-2">Novo colaborador: treinamento e supervisão até {fmtData(sup)} (PT 001, 90 dias).</span>}
      </div>
      <div><span className="label">Treinamentos ({ts.length})</span>{ts.length ? <ul className="space-y-1">{ts.map((t) => { const a = eficacias.find((x) => x.treinamento_id === t.id && String(x.pessoa_id) === String(p.id)); return <li key={t.id}>{fmtData(t.data)} · <b>{t.codigo}</b> {t.tema} — {t.status !== "REALIZADO" ? t.status.toLowerCase() : a ? (a.eficaz ? "eficaz" : "não eficaz") : "eficácia pendente"}</li>; })}</ul> : <p className="text-slate-500">Nenhum.</p>}</div>
      <div><span className="label">Autorizações</span>{zs.length ? <ul className="space-y-1">{zs.map((z) => <li key={z.id}><b>{z.codigo}</b> de {fmtData(z.data_autorizacao)}{z.revogada_em ? ` · revogada em ${fmtData(z.revogada_em)}` : z.revisar_em ? ` · reavaliar em ${fmtData(z.revisar_em)}` : ""}</li>)}</ul> : <p className="text-slate-500">Nenhuma.</p>}</div>
      <div className="flex items-center justify-between"><span className="label mb-0">Matriz: {ms.filter((m) => m.status === "LIBERADO").length} documento(s) liberado(s)</span><button type="button" onClick={imprimirMc} className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Printer className="h-4 w-4" aria-hidden /> Imprimir MC</button></div>
    </div>
  );
}

function Matriz({ q, ativos, matriz, podeEscrever, salvando, gravar, imprimirMc }) {
  const [pid, setPid] = useState(ativos[0]?.id || "");
  const [busca, setBusca] = useState("");
  const p = ativos.find((x) => x.id === pid);
  const daPessoa = new Map(matriz.filter((m) => String(m.pessoa_id) === String(pid)).map((m) => [m.documento, m]));
  const docs = q.documentos.filter((d) => d.status !== "OBSOLETO");
  const codigos = [...new Set([...docs.map((d) => d.codigo), ...daPessoa.keys()])];
  const s = busca.trim().toLowerCase();
  const linhas = codigos.map((c) => ({ c, t: docs.find((d) => d.codigo === c)?.titulo || daPessoa.get(c)?.documento_titulo || "", m: daPessoa.get(c) }))
    .filter((l) => !s || `${l.c} ${l.t}`.toLowerCase().includes(s)).sort((a, b) => a.c.localeCompare(b.c, "pt-BR"));
  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo rotulo="Colaborador"><select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>{ativos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></Campo>
        <Campo rotulo="Buscar documento" className="min-w-[14rem] flex-1"><input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="PG, POP, IT…" /></Campo>
        {p && <button type="button" onClick={() => imprimirMc(p)} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> Imprimir MC</button>}
      </div>
      <p className="text-xs text-slate-500">Treinamento avaliado como eficaz libera aqui, automaticamente, os documentos treinados. Também dá para liberar à mão.</p>
      <div className="max-h-[32rem] overflow-y-auto rounded-xl border"><table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Documento</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2">Liberado em</th><th className="px-3 py-2">Origem</th></tr></thead>
        <tbody>{linhas.map(({ c, t, m }) => (
          <tr key={c} className="border-t">
            <td className="px-3 py-1.5"><b>{c}</b> <span className="text-slate-500">{t}</span></td>
            <td className="px-3 py-1.5"><select className="input py-1 text-xs" disabled={!podeEscrever || salvando} value={m?.status || ""} onChange={(e) => gravar("matriz", e.target.value ? { pessoa_id: pid, documento: c, documento_titulo: t, status: e.target.value, liberado_em: m?.liberado_em, origem: m?.origem } : { pessoa_id: pid, documento: c, remover: true })}><option value="">—</option>{STATUS_MATRIZ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
            <td className="whitespace-nowrap px-3 py-1.5">{m?.liberado_em ? fmtData(m.liberado_em) : ""}</td>
            <td className="px-3 py-1.5 text-xs text-slate-500">{m?.origem || ""}</td>
          </tr>))}
          {linhas.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Nenhum documento na Lista Mestra.</td></tr>}
        </tbody></table></div>
    </div>
  );
}
