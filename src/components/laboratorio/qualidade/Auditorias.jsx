// Qualidade › Auditorias e ensaios de proficiência (ISO/IEC 17025 · 8.8 e 7.7.2).
// Programa anual de auditoria interna (requisito × mês) e resultados de proficiência com z-score.
// Proficiência questionável/insatisfatória abre não conformidade sozinha (no servidor).
import { useMemo, useState } from "react";
import { CalendarPlus, FlaskConical, Plus } from "lucide-react";
import { salvarRegistro, excluirRegistro } from "../../../services/qualidade.js";
import { StatCard, Modal } from "../../ui.jsx";
import { Anexos, Cabecalho, Campo, Pill, SelectPessoa, fmtData, hojeYmd, nomeDe } from "./comum.jsx";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const STATUS_AUD = { PROGRAMADA: ["programada", "sky"], EM_CURSO: ["em curso", "warn"], FEITA: ["feita", "ok"], CANCELADA: ["cancelada", "gray"] };
const RES = { AGUARDANDO: ["Aguardando", "sky"], SATISFATORIO: ["Satisfatório", "ok"], QUESTIONAVEL: ["Questionável", "warn"], INSATISFATORIO: ["Insatisfatório", "bad"], CORRETO: ["Correto", "ok"], INCORRETO: ["Incorreto", "bad"] };
const MODELO = [["4 · Imparcialidade e confidencialidade", 3], ["5 · Requisitos de estrutura", 3], ["6.2 · Pessoal e treinamento", 5], ["6.4 · Equipamentos", 6], ["6.6 · Produtos e serviços externos", 7], ["7.1–7.4 · Pedidos, métodos e amostragem", 8], ["7.5–7.8 · Registros, validade e relatórios", 9], ["7.9–7.10 · Reclamações e trabalho não conforme", 11], ["8 · Sistema de gestão", 12]];

export default function Auditorias({ q, voltar, recarregar, avisar }) {
  const { auditorias, proficiencia, ncs, contas, arquivos, podeEscrever } = q;
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [aud, setAud] = useState(null); const [prof, setProf] = useState(null); const [salvando, setSalvando] = useState(false);
  const hoje = hojeYmd();
  const doAno = auditorias.filter((a) => a.ano === ano);
  const requisitos = [...new Set(doAno.map((a) => a.requisito))].sort((x, y) => x.localeCompare(y, "pt-BR", { numeric: true }));
  const anos = [...new Set([anoAtual, anoAtual + 1, ...auditorias.map((a) => a.ano)])].sort();
  const profAno = proficiencia.filter((p) => !p.data || new Date(`${p.data}T12:00:00`).getFullYear() === ano);
  const avaliados = profAno.filter((p) => p.resultado !== "AGUARDANDO");
  const bons = avaliados.filter((p) => ["SATISFATORIO", "CORRETO"].includes(p.resultado));
  const constatacoes = ncs.filter((n) => n.origem === "AUDITORIA" && n.etapa !== "ENCERRADA");
  const proxima = doAno.filter((a) => a.status !== "FEITA" && a.status !== "CANCELADA").sort((x, y) => (x.data || `${x.ano}-${String(x.mes).padStart(2, "0")}-28`).localeCompare(y.data || `${y.ano}-${String(y.mes).padStart(2, "0")}-28`))[0];
  const ultimaRodada = useMemo(() => { const p = proficiencia.filter((x) => x.z != null).sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0]; return p ? proficiencia.filter((x) => x.rodada === p.rodada && x.z != null) : []; }, [proficiencia]);
  const maxZ = Math.max(3, ...ultimaRodada.map((p) => Math.abs(Number(p.z))));

  async function gravar(modulo, reg, fechar) {
    setSalvando(true);
    try { const r = await salvarRegistro(modulo, reg); fechar(); await recarregar(); if (modulo === "proficiencia" && r.nc_id && !reg.nc_id) avisar({ tipo: "erro", texto: "Resultado fora do esperado: aberta uma não conformidade de proficiência." }); else avisar({ tipo: "ok", texto: "Salvo." }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
  }
  async function apagar(modulo, id, fechar) { if (!window.confirm("Excluir este registro?")) return; try { await excluirRegistro(modulo, id); fechar(); await recarregar(); } catch (er) { avisar({ tipo: "erro", texto: er.message }); } }
  async function criarPrograma() {
    const base = auditorias.filter((a) => a.ano === ano - 1);
    const itens = base.length ? base.map((a) => [a.requisito, a.mes]) : MODELO;
    setSalvando(true);
    try { for (const [requisito, mes] of itens) await salvarRegistro("auditoria", { ano, requisito, mes, status: "PROGRAMADA" }); await recarregar(); avisar({ tipo: "ok", texto: `Programa ${ano} criado com ${itens.length} auditorias. Ajuste meses, datas e auditores.` }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
  }
  async function ncDaAuditoria(a) {
    try { await salvarRegistro("nc", { titulo: `Constatação da auditoria interna — ${a.requisito}`, descricao: a.constatacoes || "", origem: "AUDITORIA", etapa: "ABERTA", ref_tipo: "auditoria", ref_id: a.id, prazo: new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-CA") }); await recarregar(); avisar({ tipo: "ok", texto: "Não conformidade aberta em “Não conformidades”." }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Auditorias e ensaios de proficiência" iso="ISO 17025 · 8.8 e 7.7.2" voltar={voltar} acoes={<>
        <select className="input w-auto" value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        {podeEscrever && <button type="button" onClick={() => setProf({ resultado: "AGUARDANDO", data: hoje })} className="btn-outline inline-flex items-center gap-1.5"><FlaskConical className="h-4 w-4" aria-hidden /> Novo ensaio de proficiência</button>}
        {podeEscrever && <button type="button" onClick={() => setAud({ ano, mes: new Date().getMonth() + 1, status: "PROGRAMADA", n_constatacoes: 0 })} className="btn-primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" aria-hidden /> Nova auditoria</button>}
      </>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard rotulo={`Auditorias internas ${ano}`} valor={doAno.length ? `${doAno.filter((a) => a.status === "FEITA").length} de ${doAno.filter((a) => a.status !== "CANCELADA").length}` : "—"} sub={`${doAno.filter((a) => a.status === "PROGRAMADA").length} programada(s)`} />
        <StatCard rotulo="Constatações abertas" valor={constatacoes.length} tom={constatacoes.length ? "warn" : "neutral"} sub="viraram não conformidades" />
        <StatCard rotulo="Ensaios de proficiência" valor={profAno.length} sub={`${[...new Set(profAno.map((p) => p.rodada))].length} rodada(s) em ${ano}`} />
        <StatCard rotulo="Satisfatórios" valor={avaliados.length ? `${bons.length} de ${avaliados.length}` : "—"} tom={avaliados.length && bons.length < avaliados.length ? "warn" : "ok"} sub={avaliados.length ? `${Math.round((bons.length / avaliados.length) * 100)} %` : "sem resultados"} />
        <StatCard rotulo="Próxima auditoria" valor={proxima ? (proxima.data ? fmtData(proxima.data).slice(0, 5) : MESES[proxima.mes - 1]) : "—"} sub={proxima?.requisito || "nada programado"} />
      </div>

      <div className="card overflow-x-auto p-5">
        <h3 className="mb-3 font-display font-semibold text-slate-900">Programa anual de auditoria interna {ano}</h3>
        {requisitos.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          Nenhuma auditoria programada para {ano}.
          {podeEscrever && <div className="mt-3"><button type="button" disabled={salvando} onClick={criarPrograma} className="btn-primary inline-flex items-center gap-1.5"><CalendarPlus className="h-4 w-4" aria-hidden />{auditorias.some((a) => a.ano === ano - 1) ? `Copiar o programa de ${ano - 1}` : "Criar a partir do modelo da ISO 17025"}</button></div>}
        </div> : <table className="w-full min-w-[980px] border-collapse text-xs">
          <thead><tr><th className="w-56 border-b bg-slate-50 p-2 text-left text-slate-500">Requisito</th>{MESES.map((m) => <th key={m} className="border-b bg-slate-50 p-2 font-semibold text-slate-500">{m}</th>)}</tr></thead>
          <tbody>{requisitos.map((r) => (
            <tr key={r}><td className="border-b p-2 font-semibold text-slate-800">{r}</td>
              {MESES.map((_, i) => { const evs = doAno.filter((a) => a.requisito === r && a.mes === i + 1); return (
                <td key={i} onClick={() => podeEscrever && !evs.length && setAud({ ano, mes: i + 1, requisito: r, status: "PROGRAMADA", n_constatacoes: 0 })} className={`border-b border-l p-1 text-center ${podeEscrever && !evs.length ? "cursor-pointer hover:bg-slate-50" : ""}`}>
                  {evs.map((a) => <button key={a.id} type="button" onClick={(e) => { e.stopPropagation(); setAud({ ...a }); }} className="block w-full"><Pill tom={STATUS_AUD[a.status][1]}>{a.status === "FEITA" ? "feita" : a.data ? fmtData(a.data).slice(0, 5) : STATUS_AUD[a.status][0]}{a.n_constatacoes ? ` · ${a.n_constatacoes}` : ""}</Pill></button>)}
                </td>); })}
            </tr>))}</tbody>
        </table>}
        {requisitos.length > 0 && <p className="mt-2 text-xs text-slate-400">Clique num mês vazio para programar; clique numa auditoria para registrar data, auditor e constatações.</p>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-x-auto p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">Ensaios de proficiência / interlaboratoriais</h3>
          <table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-2 py-2">Rodada</th><th className="px-2 py-2">Matriz</th><th className="px-2 py-2">Parâmetro</th><th className="px-2 py-2">z</th><th className="px-2 py-2">Resultado</th></tr></thead>
            <tbody>{profAno.map((p) => { const nc = ncs.find((n) => n.id === p.nc_id); return (
              <tr key={p.id} onClick={() => podeEscrever && setProf({ ...p })} className={`border-t ${podeEscrever ? "cursor-pointer hover:bg-slate-50" : ""}`}>
                <td className="px-2 py-2">{p.rodada}<span className="block text-xs text-slate-400">{p.provedor || ""} {p.data ? `· ${fmtData(p.data)}` : ""}</span></td><td className="px-2 py-2">{p.matriz || "—"}</td><td className="px-2 py-2">{p.parametro}</td>
                <td className="px-2 py-2 font-semibold">{p.z == null ? "—" : String(p.z).replace(".", ",")}</td><td className="px-2 py-2"><Pill tom={RES[p.resultado][1]}>{RES[p.resultado][0]}{nc ? ` · ${nc.codigo}` : ""}</Pill></td>
              </tr>); })}</tbody></table>
          {profAno.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nenhum ensaio de proficiência registrado em {ano}.</p>}
        </div>
        <div className="card p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">z-score por parâmetro {ultimaRodada[0] ? `· ${ultimaRodada[0].rodada}` : ""}</h3>
          {ultimaRodada.length === 0 ? <p className="text-sm text-slate-500">Lance um ensaio com z-score para ver o gráfico.</p> : <>
            <div className="relative flex h-40 items-center gap-2 border-y border-dashed border-slate-200">
              <div className="absolute inset-x-0 top-1/2 border-t border-slate-300" />
              {ultimaRodada.map((p) => { const z = Number(p.z), h = (Math.abs(z) / maxZ) * 48, ruim = Math.abs(z) > 2; return (
                <div key={p.id} className="relative flex h-full flex-1 flex-col items-center">
                  <div className={`absolute left-[20%] right-[20%] rounded ${ruim ? "bg-bad-300" : "bg-brand-300"}`} style={z >= 0 ? { bottom: "50%", height: `${h}%` } : { top: "50%", height: `${h}%` }} />
                  <span className={`absolute text-[11px] font-bold ${ruim ? "text-bad-700" : "text-brand-700"}`} style={z >= 0 ? { bottom: `${50 + h + 2}%` } : { top: `${50 + h + 2}%` }}>{String(z).replace(".", ",")}</span>
                </div>); })}
            </div>
            <div className="mt-1 flex gap-2">{ultimaRodada.map((p) => <span key={p.id} className="flex-1 truncate text-center text-[11px] text-slate-500">{p.parametro}</span>)}</div>
            <p className="mt-3 text-xs text-slate-500">|z| ≤ 2 satisfatório · 2 &lt; |z| &lt; 3 questionável (abre NC) · |z| ≥ 3 insatisfatório.</p>
          </>}
        </div>
      </div>

      <Modal titulo={aud?.id ? `Auditoria · ${aud.requisito}` : "Programar auditoria interna"} aberto={!!aud} aoFechar={() => setAud(null)} largura="max-w-xl">
        {aud && <form onSubmit={(e) => { e.preventDefault(); gravar("auditoria", aud, () => setAud(null)); }} className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Requisito / processo auditado *" className="sm:col-span-2"><input className="input" required list="qual-req" value={aud.requisito || ""} onChange={(e) => setAud({ ...aud, requisito: e.target.value })} /><datalist id="qual-req">{MODELO.map(([r]) => <option key={r} value={r} />)}</datalist></Campo>
          <Campo rotulo="Mês"><select className="input" value={aud.mes} onChange={(e) => setAud({ ...aud, mes: Number(e.target.value) })}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Campo>
          <Campo rotulo="Data"><input type="date" className="input" value={aud.data || ""} onChange={(e) => setAud({ ...aud, data: e.target.value })} /></Campo>
          <Campo rotulo="Situação"><select className="input" value={aud.status} onChange={(e) => setAud({ ...aud, status: e.target.value })}>{Object.entries(STATUS_AUD).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          <Campo rotulo="Auditor(a)"><SelectPessoa contas={contas} valor={aud.auditor} onChange={(v) => setAud({ ...aud, auditor: v })} /></Campo>
          <Campo rotulo="Constatações" className="sm:col-span-2"><textarea className="input" rows={3} value={aud.constatacoes || ""} onChange={(e) => setAud({ ...aud, constatacoes: e.target.value })} placeholder="O que foi encontrado (não conformidades e oportunidades de melhoria)" /></Campo>
          <Campo rotulo="Nº de constatações"><input type="number" min="0" className="input" value={aud.n_constatacoes ?? 0} onChange={(e) => setAud({ ...aud, n_constatacoes: e.target.value })} /></Campo>
          {aud.id && <div className="sm:col-span-2"><span className="label">Relatório da auditoria</span><Anexos refTipo="auditoria" refId={aud.id} arquivos={arquivos} podeEscrever={podeEscrever} aoMudar={recarregar} avisar={avisar} /></div>}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar"}</button>
            {aud.id && aud.constatacoes && <button type="button" onClick={() => ncDaAuditoria(aud)} className="btn-outline">Abrir não conformidade</button>}
            {aud.id && <button type="button" onClick={() => apagar("auditoria", aud.id, () => setAud(null))} className="btn-ghost ml-auto text-bad-700">Excluir</button>}
          </div>
          <p className="text-xs text-slate-400 sm:col-span-2">Auditor(a) deve ser independente da atividade auditada.{aud.auditor ? ` · ${nomeDe(contas, aud.auditor)}` : ""}</p>
        </form>}
      </Modal>

      <Modal titulo={prof?.id ? `Proficiência · ${prof.parametro}` : "Novo ensaio de proficiência"} aberto={!!prof} aoFechar={() => setProf(null)} largura="max-w-xl">
        {prof && <form onSubmit={(e) => { e.preventDefault(); gravar("proficiencia", prof, () => setProf(null)); }} className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Provedor"><input className="input" value={prof.provedor || ""} onChange={(e) => setProf({ ...prof, provedor: e.target.value })} /></Campo>
          <Campo rotulo="Rodada *"><input className="input" required value={prof.rodada || ""} onChange={(e) => setProf({ ...prof, rodada: e.target.value })} placeholder="Rodada 3/2026" /></Campo>
          <Campo rotulo="Matriz"><input className="input" value={prof.matriz || ""} onChange={(e) => setProf({ ...prof, matriz: e.target.value })} placeholder="Água potável" /></Campo>
          <Campo rotulo="Parâmetro *"><input className="input" required value={prof.parametro || ""} onChange={(e) => setProf({ ...prof, parametro: e.target.value })} placeholder="Nitrato" /></Campo>
          <Campo rotulo="Data do resultado"><input type="date" className="input" value={prof.data || ""} onChange={(e) => setProf({ ...prof, data: e.target.value })} /></Campo>
          <Campo rotulo="z-score (quantitativo)"><input className="input" inputMode="decimal" value={prof.z ?? ""} onChange={(e) => setProf({ ...prof, z: e.target.value })} placeholder="ex.: 0,6" /></Campo>
          <Campo rotulo="Resultado" className="sm:col-span-2"><select className="input" value={prof.resultado} onChange={(e) => setProf({ ...prof, resultado: e.target.value })}>{Object.entries(RES).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Com z-score, o resultado é calculado sozinho. Para ensaio qualitativo (ex.: E. coli P/A), use Correto/Incorreto.</span></Campo>
          <Campo rotulo="Observação" className="sm:col-span-2"><textarea className="input" rows={2} value={prof.observacao || ""} onChange={(e) => setProf({ ...prof, observacao: e.target.value })} /></Campo>
          {prof.id && <div className="sm:col-span-2"><span className="label">Relatório do provedor</span><Anexos refTipo="proficiencia" refId={prof.id} arquivos={arquivos} podeEscrever={podeEscrever} aoMudar={recarregar} avisar={avisar} /></div>}
          <div className="flex gap-2 sm:col-span-2"><button disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar"}</button>{prof.id && <button type="button" onClick={() => apagar("proficiencia", prof.id, () => setProf(null))} className="btn-ghost ml-auto text-bad-700">Excluir</button>}</div>
        </form>}
      </Modal>
    </div>
  );
}
