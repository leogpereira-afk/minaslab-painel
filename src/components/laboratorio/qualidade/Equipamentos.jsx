// Qualidade › Equipamentos (ISO/IEC 17025 · 6.4 e 6.5): calibração, verificação e validação com vencimento,
// histórico com certificado e verificação diária. Reprovação abre não conformidade automaticamente.
import { useMemo, useState } from "react";
import { ClipboardPlus, Download, Pencil, Plus, Search, Wrench } from "lucide-react";
import { salvarRegistro, registrarCalibracao, excluirRegistro } from "../../../services/qualidade.js";
import { baixarPlanilha } from "../../../lib/planilha.js";
import { StatCard, Modal } from "../../ui.jsx";
import { Anexos, Cabecalho, Campo, Pill, diasAte, fmtData, hojeYmd, nomeDe } from "./comum.jsx";

const CONTROLES = { CALIBRACAO: "Calibração externa", VERIFICACAO: "Verificação com padrão", VALIDACAO: "Validação", DIARIA: "Verificação diária", NENHUM: "Sem controle" };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function situacaoEquip(e) {
  if (e.situacao === "MANUTENCAO") return ["Em manutenção", "gray"];
  if (e.situacao === "INATIVO") return ["Inativo", "gray"];
  if (["DIARIA", "NENHUM"].includes(e.controle) || !e.proxima) return ["Em dia", "ok"];
  const d = diasAte(e.proxima);
  if (d < 0) return [`Vencida há ${-d} dia(s)`, "bad"];
  if (d <= 30) return [`Vence em ${d} dia(s)`, "warn"];
  return ["Em dia", "ok"];
}

export default function Equipamentos({ q, voltar, recarregar, avisar }) {
  const { equipamentos, calibracoes, ncs, contas, arquivos, podeEscrever } = q;
  const [busca, setBusca] = useState(""); const [setor, setSetor] = useState("TODOS"); const [soVencidos, setSoVencidos] = useState(false);
  const [selId, setSelId] = useState(null); const [form, setForm] = useState(null); const [cal, setCal] = useState(null); const [salvando, setSalvando] = useState(false);
  const hoje = hojeYmd();
  const ativos = equipamentos.filter((e) => e.situacao !== "INATIVO");
  const vencidos = ativos.filter((e) => situacaoEquip(e)[1] === "bad");
  const vence30 = ativos.filter((e) => situacaoEquip(e)[1] === "warn");
  const diarios = ativos.filter((e) => e.controle === "DIARIA" && e.situacao === "ATIVO");
  const feitosHoje = diarios.filter((e) => calibracoes.some((c) => c.equipamento_id === e.id && c.tipo === "DIARIA" && c.data === hoje));
  const setores = [...new Set(equipamentos.map((e) => e.setor).filter(Boolean))].sort();
  const lista = useMemo(() => equipamentos.filter((e) => (setor === "TODOS" || e.setor === setor) && (!soVencidos || ["bad", "warn"].includes(situacaoEquip(e)[1]))
    && (!busca || `${e.codigo} ${e.nome} ${e.local || ""}`.toLowerCase().includes(busca.toLowerCase()))), [equipamentos, setor, soVencidos, busca]);
  const sel = equipamentos.find((e) => e.id === selId) || null;
  const hist = sel ? calibracoes.filter((c) => c.equipamento_id === sel.id) : [];
  const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i); const ym = d.toLocaleDateString("en-CA").slice(0, 7); return { rot: MESES[d.getMonth()], n: ativos.filter((e) => (e.proxima || "").startsWith(ym) && !["DIARIA", "NENHUM"].includes(e.controle)).length + (i === 0 ? vencidos.length : 0) }; });
  const maxMes = Math.max(1, ...meses.map((m) => m.n));

  async function salvar(e) {
    e.preventDefault(); setSalvando(true);
    try { const r = await salvarRegistro("equipamento", form); setForm(null); setSelId(r.id); await recarregar(); avisar({ tipo: "ok", texto: "Equipamento salvo." }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
  }
  async function registrar(e) {
    e.preventDefault(); setSalvando(true);
    try { const r = await registrarCalibracao(cal); setCal(null); await recarregar(); avisar({ tipo: r.nc ? "erro" : "ok", texto: r.nc ? `Registrado como reprovado. Aberta a ${r.nc.codigo} em Não conformidades.` : "Registrado. Próximo vencimento atualizado." }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
  }
  async function situacao(eq, s) { try { await salvarRegistro("equipamento", { id: eq.id, situacao: s }); await recarregar(); } catch (er) { avisar({ tipo: "erro", texto: er.message }); } }
  async function apagarCal(c) { if (!window.confirm("Apagar este registro de calibração/verificação?")) return; try { await excluirRegistro("calibracao", c.id); await recarregar(); } catch (er) { avisar({ tipo: "erro", texto: er.message }); } }
  function exportar() {
    baixarPlanilha({ nome: "plano-equipamentos", titulo: `Equipamentos — plano de calibração e verificação (${fmtData(hoje)})`,
      colunas: [{ chave: "codigo", rotulo: "Código" }, { chave: "nome", rotulo: "Equipamento" }, { chave: "setor", rotulo: "Setor" }, { chave: "controle", rotulo: "Controle" }, { chave: "per", rotulo: "Periodicidade (meses)" }, { chave: "prox", rotulo: "Próxima" }, { chave: "crit", rotulo: "Critério de aceitação" }, { chave: "sit", rotulo: "Situação" }],
      linhas: lista.map((e) => ({ codigo: e.codigo, nome: e.nome, setor: e.setor || "", controle: CONTROLES[e.controle], per: e.periodicidade_meses ?? "", prox: fmtData(e.proxima), crit: e.criterio || "", sit: situacaoEquip(e)[0] })) });
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Equipamentos" iso="ISO 17025 · 6.4 e 6.5" voltar={voltar} acoes={<>
        <button type="button" onClick={exportar} className="btn-outline inline-flex items-center gap-1.5"><Download className="h-4 w-4" aria-hidden /> Plano (Excel)</button>
        {podeEscrever && <button type="button" onClick={() => setForm({ controle: "CALIBRACAO", periodicidade_meses: 12, situacao: "ATIVO" })} className="btn-primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" aria-hidden /> Novo equipamento</button>}
      </>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard rotulo="Equipamentos ativos" valor={ativos.length} sub={setores.join(", ") || "cadastre os equipamentos"} />
        <StatCard rotulo="Controle vencido" valor={vencidos.length} tom={vencidos.length ? "bad" : "neutral"} sub={vencidos.map((e) => e.codigo).slice(0, 3).join(", ") || "nenhum"} onClick={() => setSoVencidos(true)} />
        <StatCard rotulo="Vence em 30 dias" valor={vence30.length} tom={vence30.length ? "warn" : "neutral"} sub="agendar calibração" onClick={() => setSoVencidos(true)} />
        <StatCard rotulo="Em manutenção" valor={equipamentos.filter((e) => e.situacao === "MANUTENCAO").length} sub="fora de uso" />
        <StatCard rotulo="Verificações do dia" valor={diarios.length ? `${feitosHoje.length} de ${diarios.length}` : "—"} tom={feitosHoje.length < diarios.length ? "warn" : "ok"} sub={diarios.filter((e) => !feitosHoje.includes(e)).map((e) => e.codigo).slice(0, 2).join(", ") || "tudo registrado"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden /><input className="input pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código ou equipamento…" /></div>
            {["TODOS", ...setores].map((s) => <button key={s} type="button" onClick={() => setSetor(s)} className={`rounded-full border px-3 py-1 text-xs ${setor === s ? "border-brand-300 bg-brand-50 font-semibold text-brand-700" : "text-slate-600"}`}>{s === "TODOS" ? "Todos" : s}</button>)}
            <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={soVencidos} onChange={(e) => setSoVencidos(e.target.checked)} /> Só vencidos / a vencer</label>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Código</th><th className="px-3 py-2.5">Equipamento</th><th className="px-3 py-2.5">Controle</th><th className="px-3 py-2.5">Próxima</th><th className="px-3 py-2.5">Situação</th><th className="px-3 py-2.5">Critério</th></tr></thead>
            <tbody>{lista.map((e) => { const [t, tom] = situacaoEquip(e); return (
              <tr key={e.id} onClick={() => setSelId(e.id)} className={`cursor-pointer border-t hover:bg-slate-50 ${selId === e.id ? "bg-brand-50/60" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{e.codigo}</td><td className="px-3 py-2.5">{e.nome}<span className="block text-xs text-slate-400">{[e.setor, e.local].filter(Boolean).join(" · ")}</span></td>
                <td className="px-3 py-2.5">{CONTROLES[e.controle]}</td><td className="whitespace-nowrap px-3 py-2.5">{["DIARIA", "NENHUM"].includes(e.controle) ? "—" : fmtData(e.proxima)}</td><td className="px-3 py-2.5"><Pill tom={tom}>{t}</Pill></td><td className="px-3 py-2.5 text-slate-500">{e.criterio || "—"}</td>
              </tr>); })}</tbody>
          </table>{lista.length === 0 && <p className="p-10 text-center text-sm text-slate-500">{equipamentos.length ? "Nenhum equipamento com esse filtro." : "Nenhum equipamento cadastrado ainda. Comece em “Novo equipamento”."}</p>}</div>
        </div>

        <div className="space-y-4">
          {!sel ? <div className="card p-6 text-center text-sm text-slate-500">Clique num equipamento para ver o histórico, o certificado e registrar calibração ou verificação.</div> : <>
            <div className="card space-y-3 p-5">
              <div className="flex items-start justify-between gap-2"><h3 className="font-display font-semibold text-slate-900">{sel.codigo} · {sel.nome}</h3><Pill tom={situacaoEquip(sel)[1]}>{situacaoEquip(sel)[0]}</Pill></div>
              {situacaoEquip(sel)[1] === "bad" && <div className="rounded-xl bg-bad-50 p-3 text-sm text-bad-700"><b>Controle vencido em {fmtData(sel.proxima)}.</b> Não usar nos ensaios até registrar nova calibração/verificação.{sel.ensaios_afetados ? ` Ensaios afetados: ${sel.ensaios_afetados}.` : ""}</div>}
              <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-slate-500">Controle</dt><dd>{CONTROLES[sel.controle]}{sel.periodicidade_meses ? ` · a cada ${sel.periodicidade_meses} mês(es)` : ""}</dd>
                <dt className="text-slate-500">Critério</dt><dd>{sel.criterio || "—"}</dd>
                {sel.ensaios_afetados && <><dt className="text-slate-500">Ensaios que usa</dt><dd>{sel.ensaios_afetados}</dd></>}
                <dt className="text-slate-500">Identificação</dt><dd>{[sel.fabricante, sel.modelo, sel.serie && `série ${sel.serie}`].filter(Boolean).join(" · ") || "—"}</dd>
                {sel.local && <><dt className="text-slate-500">Local</dt><dd>{sel.local}</dd></>}
              </dl>
              {podeEscrever && <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setCal({ equipamento_id: sel.id, tipo: sel.controle === "NENHUM" ? "VERIFICACAO" : sel.controle, data: hoje, resultado: "APROVADO" })} className="btn-primary inline-flex items-center gap-1.5"><ClipboardPlus className="h-4 w-4" aria-hidden /> Registrar {sel.controle === "DIARIA" ? "verificação do dia" : "calibração/verificação"}</button>
                <button type="button" onClick={() => setForm({ ...sel })} className="btn-outline inline-flex items-center gap-1.5"><Pencil className="h-4 w-4" aria-hidden /> Editar</button>
                {sel.situacao === "MANUTENCAO" ? <button type="button" onClick={() => situacao(sel, "ATIVO")} className="btn-outline">Voltou da manutenção</button> : <button type="button" onClick={() => situacao(sel, "MANUTENCAO")} className="btn-outline inline-flex items-center gap-1.5"><Wrench className="h-4 w-4" aria-hidden /> Em manutenção</button>}
              </div>}
              <div><span className="label">Certificados e documentos</span><Anexos refTipo="equipamento" refId={sel.id} arquivos={arquivos} podeEscrever={podeEscrever} aoMudar={recarregar} avisar={avisar} /></div>
            </div>
            <div className="card p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">Histórico</h3>
              {hist.length === 0 ? <p className="text-sm text-slate-500">Nenhum registro ainda.</p> :
                <table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-1.5">Data</th><th className="py-1.5">Tipo</th><th className="py-1.5">Leitura / certificado</th><th className="py-1.5">Resultado</th><th /></tr></thead>
                  <tbody>{hist.slice(0, 15).map((c) => { const nc = ncs.find((n) => n.id === c.nc_id); return <tr key={c.id} className="border-t align-top"><td className="py-1.5">{fmtData(c.data)}</td><td className="py-1.5">{CONTROLES[c.tipo]}</td><td className="py-1.5 text-slate-600">{[c.leitura, c.certificado, c.laboratorio].filter(Boolean).join(" · ") || "—"}<span className="block text-xs text-slate-400">{nomeDe(contas, c.registrado_por)}</span></td><td className="py-1.5"><Pill tom={c.resultado === "APROVADO" ? "ok" : "bad"}>{c.resultado === "APROVADO" ? "ok" : `reprovado${nc ? ` · ${nc.codigo}` : ""}`}</Pill></td><td className="py-1.5 text-right">{podeEscrever && <button type="button" onClick={() => apagarCal(c)} className="text-xs text-slate-400 hover:text-bad-700">apagar</button>}</td></tr>; })}</tbody></table>}
            </div>
          </>}
          <div className="card p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">Vencimentos dos próximos 6 meses</h3>
            <div className="flex h-24 items-end gap-2">{meses.map((m, i) => <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1"><span className="text-[11px] font-semibold text-slate-600">{m.n || ""}</span><div className={`w-full rounded-t-md ${i === 0 && vencidos.length ? "bg-warn-300" : "bg-brand-100"}`} style={{ height: `${(m.n / maxMes) * 70 + 4}%` }} /><span className="text-[11px] text-slate-500">{m.rot}</span></div>)}</div>
          </div>
        </div>
      </div>

      <Modal titulo={form?.id ? `Editar ${form?.codigo}` : "Novo equipamento"} aberto={!!form} aoFechar={() => setForm(null)} largura="max-w-2xl">
        {form && <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Código *"><input className="input" required value={form.codigo || ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="EQ-021" disabled={!!form.id} /></Campo>
          <Campo rotulo="Setor"><input className="input" list="qual-setores" value={form.setor || ""} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="Físico-Químico" /><datalist id="qual-setores">{["Microbiologia", "Físico-Químico", "Coleta", "Geral", ...setores].filter((v, i, a) => a.indexOf(v) === i).map((s) => <option key={s} value={s} />)}</datalist></Campo>
          <Campo rotulo="Equipamento *" className="sm:col-span-2"><input className="input" required value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Espectrofotômetro UV-Vis" /></Campo>
          <Campo rotulo="Fabricante"><input className="input" value={form.fabricante || ""} onChange={(e) => setForm({ ...form, fabricante: e.target.value })} /></Campo>
          <Campo rotulo="Modelo / nº de série"><div className="flex gap-2"><input className="input" value={form.modelo || ""} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Modelo" /><input className="input" value={form.serie || ""} onChange={(e) => setForm({ ...form, serie: e.target.value })} placeholder="Série" /></div></Campo>
          <Campo rotulo="Controle"><select className="input" value={form.controle} onChange={(e) => setForm({ ...form, controle: e.target.value })}>{Object.entries(CONTROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          <Campo rotulo="Periodicidade (meses)"><input type="number" min="0" className="input" value={form.periodicidade_meses ?? ""} onChange={(e) => setForm({ ...form, periodicidade_meses: e.target.value })} disabled={["DIARIA", "NENHUM"].includes(form.controle)} /></Campo>
          <Campo rotulo="Próximo vencimento"><input type="date" className="input" value={form.proxima || ""} onChange={(e) => setForm({ ...form, proxima: e.target.value })} disabled={["DIARIA", "NENHUM"].includes(form.controle)} /></Campo>
          <Campo rotulo="Local"><input className="input" value={form.local || ""} onChange={(e) => setForm({ ...form, local: e.target.value })} /></Campo>
          <Campo rotulo="Critério de aceitação" className="sm:col-span-2"><input className="input" value={form.criterio || ""} onChange={(e) => setForm({ ...form, criterio: e.target.value })} placeholder="Erro ≤ 0,005 abs · 35,0 ± 0,5 °C" /></Campo>
          <Campo rotulo="Ensaios que usam o equipamento" className="sm:col-span-2"><input className="input" value={form.ensaios_afetados || ""} onChange={(e) => setForm({ ...form, ensaios_afetados: e.target.value })} placeholder="Ferro, manganês, fósforo" /></Campo>
          <Campo rotulo="Observação" className="sm:col-span-2"><textarea className="input" rows={2} value={form.observacao || ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></Campo>
          <button disabled={salvando} className="btn-primary sm:col-span-2">{salvando ? "Salvando..." : "Salvar"}</button>
        </form>}
      </Modal>

      <Modal titulo="Registrar calibração / verificação" aberto={!!cal} aoFechar={() => setCal(null)}>
        {cal && <form onSubmit={registrar} className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Tipo"><select className="input" value={cal.tipo} onChange={(e) => setCal({ ...cal, tipo: e.target.value })}>{["CALIBRACAO", "VERIFICACAO", "VALIDACAO", "DIARIA"].map((v) => <option key={v} value={v}>{CONTROLES[v]}</option>)}</select></Campo>
          <Campo rotulo="Data"><input type="date" className="input" value={cal.data} onChange={(e) => setCal({ ...cal, data: e.target.value })} /></Campo>
          <Campo rotulo="Leitura / erro encontrado"><input className="input" value={cal.leitura || ""} onChange={(e) => setCal({ ...cal, leitura: e.target.value })} placeholder="35,1 °C · erro 0,003" /></Campo>
          <Campo rotulo="Resultado"><select className="input" value={cal.resultado} onChange={(e) => setCal({ ...cal, resultado: e.target.value })}><option value="APROVADO">Aprovado (dentro do critério)</option><option value="REPROVADO">Reprovado (fora do critério)</option></select></Campo>
          {cal.tipo !== "DIARIA" && <><Campo rotulo="Nº do certificado"><input className="input" value={cal.certificado || ""} onChange={(e) => setCal({ ...cal, certificado: e.target.value })} /></Campo>
          <Campo rotulo="Laboratório de calibração"><input className="input" value={cal.laboratorio || ""} onChange={(e) => setCal({ ...cal, laboratorio: e.target.value })} /></Campo></>}
          <Campo rotulo="Observação" className="sm:col-span-2"><textarea className="input" rows={2} value={cal.observacao || ""} onChange={(e) => setCal({ ...cal, observacao: e.target.value })} /></Campo>
          {cal.resultado === "REPROVADO" && <p className="rounded-xl bg-bad-50 p-3 text-xs text-bad-700 sm:col-span-2">Reprovado abre uma não conformidade automaticamente, marcada como “trabalho afetado”.</p>}
          {cal.resultado === "APROVADO" && cal.tipo !== "DIARIA" && sel?.periodicidade_meses ? <p className="text-xs text-slate-500 sm:col-span-2">O próximo vencimento passa a ser {sel.periodicidade_meses} mês(es) depois desta data. Anexe o certificado no equipamento.</p> : null}
          <button disabled={salvando} className="btn-primary sm:col-span-2">{salvando ? "Salvando..." : "Registrar"}</button>
        </form>}
      </Modal>
    </div>
  );
}
