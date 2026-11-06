// Qualidade › Documentos e POPs (ISO/IEC 17025 · 8.3 e 8.4): lista mestra, revisões, vigência, leitura confirmada.
import { useMemo, useState } from "react";
import { BookOpenCheck, Download, FilePlus2, Pencil, RefreshCcw, Search } from "lucide-react";
import { salvarRegistro, confirmarLeitura } from "../../../services/qualidade.js";
import { baixarPlanilha } from "../../../lib/planilha.js";
import { StatCard, Modal } from "../../ui.jsx";
import { Anexos, Cabecalho, Campo, Pill, SelectPessoa, diasAte, fmtData, hojeYmd, nomeDe, somaMeses } from "./comum.jsx";

const TIPOS = [["PG", "Procedimento de gestão"], ["PT", "Procedimento técnico"], ["POP", "Procedimento operacional"], ["IT", "Instrução operacional (IO)"], ["FOR", "Formulário"], ["MQ", "Manual da qualidade"], ["OUTRO", "Outro"]];
const STATUS = { ELABORACAO: ["Em elaboração", "gray"], EM_APROVACAO: ["Em aprovação", "sky"], VIGENTE: ["Vigente", "ok"], OBSOLETO: ["Obsoleto", "gray"] };
const proxRev = (r) => { const n = parseInt(r, 10); return Number.isFinite(n) ? String(n + 1).padStart(String(r).length || 2, "0") : r; };

function situacao(d) {
  if (d.status !== "VIGENTE") return STATUS[d.status] || [d.status, "gray"];
  const dias = diasAte(d.proxima_revisao);
  if (dias == null) return ["Vigente", "ok"];
  if (dias < 0) return [`Revisão vencida há ${-dias} dia(s)`, "bad"];
  if (dias <= 60) return [`Revisar em ${dias} dia(s)`, "warn"];
  return ["Vigente", "ok"];
}

export default function Documentos({ q, voltar, recarregar, avisar }) {
  const { documentos, revisoes, leituras, contas, arquivos, podeEscrever, eu } = q;
  const [busca, setBusca] = useState(""); const [tipo, setTipo] = useState("TODOS"); const [verObsoletos, setVerObsoletos] = useState(false);
  const [selId, setSelId] = useState(null); const [form, setForm] = useState(null); const [salvando, setSalvando] = useState(false);

  const pendentes = (d) => (d.leitores || []).filter((u) => !leituras.some((l) => l.documento_id === d.id && l.revisao === d.revisao && l.usuario === u));
  const vigentes = documentos.filter((d) => d.status === "VIGENTE");
  const vencendo = vigentes.filter((d) => { const x = diasAte(d.proxima_revisao); return x != null && x >= 0 && x <= 60; });
  const vencidas = vigentes.filter((d) => { const x = diasAte(d.proxima_revisao); return x != null && x < 0; });
  const leituraPend = vigentes.reduce((n, d) => n + pendentes(d).length, 0);
  const minhasPend = vigentes.filter((d) => pendentes(d).includes(eu));

  const lista = useMemo(() => documentos.filter((d) => (verObsoletos || d.status !== "OBSOLETO") && (tipo === "TODOS" || d.tipo === tipo)
    && (!busca || `${d.codigo} ${d.titulo} ${d.setor || ""}`.toLowerCase().includes(busca.toLowerCase()))), [documentos, verObsoletos, tipo, busca]);
  const sel = documentos.find((d) => d.id === selId) || null;

  function novo() { const hoje = hojeYmd(); setForm({ tipo: "POP", revisao: "00", status: "VIGENTE", vigencia_inicio: hoje, proxima_revisao: somaMeses(hoje, 12), leitores: [] }); }
  function revisar(d) { const hoje = hojeYmd(); setForm({ ...d, revisao: proxRev(d.revisao), vigencia_inicio: hoje, proxima_revisao: somaMeses(hoje, 12), status: "EM_APROVACAO", motivo_revisao: "", _revisao: true }); }
  async function salvar(e) {
    e.preventDefault(); setSalvando(true);
    try { const r = await salvarRegistro("documento", form); setForm(null); setSelId(r.id); await recarregar(); avisar({ tipo: "ok", texto: "Documento salvo." }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
  }
  async function mudarStatus(d, status) {
    if (status === "OBSOLETO" && !window.confirm(`Marcar ${d.codigo} como obsoleto? Ele sai da lista de vigentes.`)) return;
    try { await salvarRegistro("documento", { id: d.id, status }); await recarregar(); } catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }
  async function ler(d) { try { await confirmarLeitura(d.id); await recarregar(); avisar({ tipo: "ok", texto: `Leitura de ${d.codigo} rev. ${d.revisao} confirmada.` }); } catch (er) { avisar({ tipo: "erro", texto: er.message }); } }
  function exportar() {
    baixarPlanilha({ nome: "lista-mestra-documentos", titulo: `Lista mestra de documentos — ${fmtData(hojeYmd())}`,
      colunas: [{ chave: "codigo", rotulo: "Código" }, { chave: "titulo", rotulo: "Título" }, { chave: "tipo", rotulo: "Tipo" }, { chave: "revisao", rotulo: "Revisão" }, { chave: "vig", rotulo: "Vigência" }, { chave: "prox", rotulo: "Próxima revisão" }, { chave: "elab", rotulo: "Elaborado por" }, { chave: "aprov", rotulo: "Aprovado por" }, { chave: "sit", rotulo: "Situação" }],
      linhas: lista.map((d) => ({ codigo: d.codigo, titulo: d.titulo, tipo: d.tipo, revisao: d.revisao, vig: fmtData(d.vigencia_inicio), prox: fmtData(d.proxima_revisao), elab: nomeDe(contas, d.elaborado_por), aprov: nomeDe(contas, d.aprovado_por), sit: situacao(d)[0] })) });
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Documentos e POPs" iso="ISO 17025 · 8.3 e 8.4" voltar={voltar} acoes={<>
        <button type="button" onClick={exportar} className="btn-outline inline-flex items-center gap-1.5"><Download className="h-4 w-4" aria-hidden /> Lista mestra (Excel)</button>
        {podeEscrever && <button type="button" onClick={novo} className="btn-primary inline-flex items-center gap-1.5"><FilePlus2 className="h-4 w-4" aria-hidden /> Novo documento</button>}
      </>} />
      {minhasPend.length > 0 && <div className="rounded-2xl border border-warn-200 bg-warn-50 p-3 text-sm text-warn-700"><b>Você tem {minhasPend.length} documento(s) para ler:</b> {minhasPend.map((d) => <button key={d.id} type="button" onClick={() => setSelId(d.id)} className="ml-2 underline">{d.codigo} rev. {d.revisao}</button>)}</div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard rotulo="Documentos vigentes" valor={vigentes.length} sub="PG, POP, IT e formulários" />
        <StatCard rotulo="Revisão vencendo (60 dias)" valor={vencendo.length} tom={vencendo.length ? "warn" : "neutral"} sub={vencendo[0] ? `${vencendo[0].codigo} em ${diasAte(vencendo[0].proxima_revisao)} dias` : "nenhuma"} />
        <StatCard rotulo="Revisão vencida" valor={vencidas.length} tom={vencidas.length ? "bad" : "neutral"} sub={vencidas.map((d) => d.codigo).slice(0, 2).join(", ") || "nenhuma"} />
        <StatCard rotulo="Em aprovação" valor={documentos.filter((d) => d.status === "EM_APROVACAO").length} sub="aguardando quem aprova" />
        <StatCard rotulo="Leitura pendente" valor={leituraPend} tom={leituraPend ? "warn" : "neutral"} sub="pessoas sem confirmar leitura" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden /><input className="input pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código ou título…" /></div>
            {["TODOS", "PG", "POP", "IT", "FOR"].map((t) => <button key={t} type="button" onClick={() => setTipo(t)} className={`rounded-full border px-3 py-1 text-xs ${tipo === t ? "border-brand-300 bg-brand-50 font-semibold text-brand-700" : "text-slate-600"}`}>{t === "TODOS" ? "Todos" : t === "FOR" ? "Formulários" : t}</button>)}
            <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={verObsoletos} onChange={(e) => setVerObsoletos(e.target.checked)} /> Obsoletos</label>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Código</th><th className="px-3 py-2.5">Título</th><th className="px-3 py-2.5">Rev.</th><th className="px-3 py-2.5">Vigência</th><th className="px-3 py-2.5">Próx. revisão</th><th className="px-3 py-2.5">Situação</th></tr></thead>
            <tbody>{lista.map((d) => { const [txt, tom] = situacao(d); return (
              <tr key={d.id} onClick={() => setSelId(d.id)} className={`cursor-pointer border-t hover:bg-slate-50 ${selId === d.id ? "bg-brand-50/60" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{d.codigo}</td><td className="px-3 py-2.5">{d.titulo}<span className="block text-xs text-slate-400">{d.tipo}{d.setor ? ` · ${d.setor}` : ""}</span></td>
                <td className="px-3 py-2.5">{d.revisao}</td><td className="whitespace-nowrap px-3 py-2.5">{fmtData(d.vigencia_inicio)}</td><td className="whitespace-nowrap px-3 py-2.5">{fmtData(d.proxima_revisao)}</td><td className="px-3 py-2.5"><Pill tom={tom}>{txt}</Pill></td>
              </tr>); })}</tbody>
          </table>{lista.length === 0 && <p className="p-10 text-center text-sm text-slate-500">{documentos.length ? "Nenhum documento com esse filtro." : "Nenhum documento cadastrado ainda. Comece pela lista mestra: “Novo documento”."}</p>}</div>
        </div>

        <div className="space-y-4">
          {!sel ? <div className="card p-6 text-center text-sm text-slate-500">Clique num documento para ver revisões, leituras e arquivos.</div> : <>
            <div className="card space-y-3 p-5">
              <div className="flex items-start justify-between gap-2"><h3 className="font-display font-semibold text-slate-900">{sel.codigo} · rev. {sel.revisao}</h3><Pill tom={situacao(sel)[1]}>{situacao(sel)[0]}</Pill></div>
              <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-slate-500">Título</dt><dd className="font-medium">{sel.titulo}</dd>
                <dt className="text-slate-500">Elaborado por</dt><dd>{nomeDe(contas, sel.elaborado_por)}</dd>
                <dt className="text-slate-500">Aprovado por</dt><dd>{nomeDe(contas, sel.aprovado_por)}</dd>
                <dt className="text-slate-500">Vigência</dt><dd>{fmtData(sel.vigencia_inicio)} → {fmtData(sel.proxima_revisao)}</dd>
                {sel.setor && <><dt className="text-slate-500">Onde se aplica</dt><dd>{sel.setor}</dd></>}
                {sel.observacao && <><dt className="text-slate-500">Observação</dt><dd>{sel.observacao}</dd></>}
              </dl>
              <div className="flex flex-wrap gap-2">
                {pendentes(sel).includes(eu) && <button type="button" onClick={() => ler(sel)} className="btn-primary inline-flex items-center gap-1.5"><BookOpenCheck className="h-4 w-4" aria-hidden /> Confirmar que li</button>}
                {podeEscrever && <>
                  {sel.status !== "OBSOLETO" && <button type="button" onClick={() => revisar(sel)} className="btn-outline inline-flex items-center gap-1.5"><RefreshCcw className="h-4 w-4" aria-hidden /> Nova revisão</button>}
                  <button type="button" onClick={() => setForm({ ...sel })} className="btn-outline inline-flex items-center gap-1.5"><Pencil className="h-4 w-4" aria-hidden /> Editar</button>
                  {sel.status === "EM_APROVACAO" && <button type="button" onClick={() => mudarStatus(sel, "VIGENTE")} className="btn-outline">Aprovar (vigente)</button>}
                  {sel.status !== "OBSOLETO" ? <button type="button" onClick={() => mudarStatus(sel, "OBSOLETO")} className="btn-ghost text-bad-700">Marcar obsoleto</button> : <button type="button" onClick={() => mudarStatus(sel, "VIGENTE")} className="btn-ghost">Voltar a vigente</button>}
                </>}
              </div>
              <div><span className="label">Arquivo do documento</span><Anexos refTipo="documento" refId={sel.id} arquivos={arquivos} podeEscrever={podeEscrever} aoMudar={recarregar} avisar={avisar} /></div>
            </div>
            <div className="card p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">Histórico de revisões</h3>
              <ol className="space-y-2 border-l-2 border-slate-200 pl-4 text-sm">{revisoes.filter((r) => r.documento_id === sel.id).map((r) => <li key={r.id}><b>Rev. {r.revisao}</b> · {fmtData(r.data)}{r.descricao ? ` · ${r.descricao}` : ""} <span className="text-xs text-slate-400">{nomeDe(contas, r.autor)}</span></li>)}</ol>
            </div>
            <div className="card p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">Leitura da rev. {sel.revisao} <span className="text-sm font-normal text-slate-400">(quem precisa conhecer)</span></h3>
              {(sel.leitores || []).length === 0 ? <p className="text-sm text-slate-500">Ninguém marcado para ler. Escolha as pessoas em “Editar”.</p> :
                <table className="w-full text-sm"><tbody>{sel.leitores.map((u) => { const l = leituras.find((x) => x.documento_id === sel.id && x.revisao === sel.revisao && x.usuario === u); return <tr key={u} className="border-t"><td className="py-1.5">{nomeDe(contas, u)}</td><td className="py-1.5 text-right">{l ? <Pill tom="ok">{fmtData(l.confirmado_em)}</Pill> : <Pill tom="warn">pendente</Pill>}</td></tr>; })}</tbody></table>}
            </div>
          </>}
        </div>
      </div>

      <Modal titulo={form?._revisao ? `Nova revisão · ${form?.codigo}` : form?.id ? `Editar ${form?.codigo}` : "Novo documento"} aberto={!!form} aoFechar={() => setForm(null)} largura="max-w-2xl">
        {form && <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Código *"><input className="input" required value={form.codigo || ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="POP FQ 011" disabled={!!form.id} /></Campo>
          <Campo rotulo="Tipo"><select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{v} · {l}</option>)}</select></Campo>
          <Campo rotulo="Título *" className="sm:col-span-2"><input className="input" required value={form.titulo || ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></Campo>
          <Campo rotulo="Revisão"><input className="input" value={form.revisao || ""} onChange={(e) => setForm({ ...form, revisao: e.target.value })} /></Campo>
          <Campo rotulo="Situação"><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          <Campo rotulo="Vigente desde"><input type="date" className="input" value={form.vigencia_inicio || ""} onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value, proxima_revisao: e.target.value ? somaMeses(e.target.value, 12) : form.proxima_revisao })} /></Campo>
          <Campo rotulo="Próxima revisão"><input type="date" className="input" value={form.proxima_revisao || ""} onChange={(e) => setForm({ ...form, proxima_revisao: e.target.value })} /></Campo>
          <Campo rotulo="Elaborado por"><SelectPessoa contas={contas} valor={form.elaborado_por} onChange={(v) => setForm({ ...form, elaborado_por: v })} /></Campo>
          <Campo rotulo="Aprovado por"><SelectPessoa contas={contas} valor={form.aprovado_por} onChange={(v) => setForm({ ...form, aprovado_por: v })} /></Campo>
          <Campo rotulo="Onde se aplica (setor)" className="sm:col-span-2"><input className="input" value={form.setor || ""} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="Físico-Químico · Coleta" /></Campo>
          {form._revisao && <Campo rotulo="O que mudou nesta revisão" className="sm:col-span-2"><textarea className="input" rows={2} value={form.motivo_revisao || ""} onChange={(e) => setForm({ ...form, motivo_revisao: e.target.value })} /></Campo>}
          <div className="sm:col-span-2"><span className="label">Quem precisa ler e confirmar</span>
            <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-xl border p-2 text-sm">{contas.map((c) => <label key={c.usuario} className="inline-flex items-center gap-2"><input type="checkbox" checked={(form.leitores || []).includes(c.usuario)} onChange={(e) => setForm({ ...form, leitores: e.target.checked ? [...(form.leitores || []), c.usuario] : (form.leitores || []).filter((u) => u !== c.usuario) })} />{c.nome}</label>)}</div>
            {form._revisao && <p className="mt-1 text-xs text-slate-500">Na nova revisão, todos precisam confirmar a leitura de novo.</p>}
          </div>
          <Campo rotulo="Observação" className="sm:col-span-2"><textarea className="input" rows={2} value={form.observacao || ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></Campo>
          <button disabled={salvando} className="btn-primary sm:col-span-2">{salvando ? "Salvando..." : "Salvar"}</button>
        </form>}
      </Modal>
    </div>
  );
}
