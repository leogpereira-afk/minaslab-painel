// Qualidade › Indicadores e análise crítica (ISO/IEC 17025 · 8.9).
// Números tirados das outras páginas: Entradas de amostras (prazo de liberação), Pesquisa de satisfação,
// Não conformidades, Equipamentos e Proficiência. Metas editáveis; pauta da análise crítica pronta para exportar.
import { useEffect, useMemo, useState } from "react";
import { Download, Pencil } from "lucide-react";
import { lerSatisfacao, salvarMeta } from "../../../services/qualidade.js";
import { baixarPlanilha } from "../../../lib/planilha.js";
import { Modal } from "../../ui.jsx";
import { Cabecalho, Campo, Pill, fmtData, hojeYmd } from "./comum.jsx";
import { situacaoEquip } from "./Equipamentos.jsx";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const num = (v, casas = 1) => (v == null || Number.isNaN(v) ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas }));
const dataDe = (v) => (v ? new Date(String(v).length === 16 ? `${v}:00` : v) : null);
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const npsDe = (rs) => (rs.length ? Math.round(((rs.filter((r) => r.nps >= 9).length - rs.filter((r) => r.nps <= 6).length) / rs.length) * 100) : null);

export default function Indicadores({ q, voltar, recarregar, avisar }) {
  const { metas, ncs, equipamentos, proficiencia, auditorias, entradas, documentos, podeEscrever } = q;
  const [sat, setSat] = useState(null);
  const [nMeses, setNMeses] = useState(6);
  const [editMeta, setEditMeta] = useState(null);
  useEffect(() => { lerSatisfacao().then(setSat).catch(() => setSat({ respostas: [], tratativas: [] })); }, []);
  const meta = (k) => metas.find((m) => m.chave === k);

  const meses = useMemo(() => Array.from({ length: nMeses }, (_, i) => { const d = new Date(); d.setDate(1); d.setHours(12); d.setMonth(d.getMonth() - (nMeses - 1 - i)); const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59); return { ini: d, fim, rot: MESES[d.getMonth()], ano: d.getFullYear(), m: d.getMonth() }; }), [nMeses]);
  const noMes = (v, mm) => { const d = dataDe(v); return d && d.getFullYear() === mm.ano && d.getMonth() === mm.m; };
  const inicio = meses[0].ini;
  const prazoMeta = Number(meta("prazo_liberacao")?.meta ?? 5);
  const libs = entradas.filter((e) => e.lib).map((e) => ({ ...e, dias: (dataDe(e.lib) - dataDe(e.rec)) / 86400000 })).filter((e) => e.dias >= 0 && e.dias < 120);
  const resp = sat?.respostas || [];
  // Reclamações registradas (FM-LAB-113) + NCs de reclamação antigas, sem registro próprio + insatisfações da pesquisa.
  const reclamacoesDe = (mm) => (q.reclamacoes || []).filter((r) => r.tipo !== "SUGESTAO" && noMes(r.recebida_em, mm)).length
    + ncs.filter((n) => n.origem === "RECLAMACAO" && n.ref_tipo !== "reclamacao" && noMes(n.criado_em, mm)).length
    + resp.filter((r) => r.insatisfeito && noMes(r.respondido_em, mm)).length;
  const ncAbertasEm = (fim) => ncs.filter((n) => new Date(n.criado_em) <= fim && (!n.encerrada_em || new Date(n.encerrada_em) > fim)).length;
  const profAte = (fim) => { const lim = new Date(fim); lim.setFullYear(lim.getFullYear() - 1); const ps = proficiencia.filter((p) => p.resultado !== "AGUARDANDO" && p.data && new Date(`${p.data}T12:00:00`) <= fim && new Date(`${p.data}T12:00:00`) > lim); return ps.length ? (ps.filter((p) => ["SATISFATORIO", "CORRETO"].includes(p.resultado)).length / ps.length) * 100 : null; };
  const ativosEq = equipamentos.filter((e) => e.situacao === "ATIVO");
  const emDia = ativosEq.length ? (ativosEq.filter((e) => situacaoEquip(e)[1] !== "bad").length / ativosEq.length) * 100 : null;
  const periodo = (fn) => fn(libs.filter((e) => dataDe(e.lib) >= inicio));

  const indicadores = [
    { k: "prazo_liberacao", fmt: (v) => `${num(v)} dias`, serie: meses.map((mm) => media(libs.filter((e) => noMes(e.lib, mm)).map((e) => e.dias))), valor: periodo((ls) => media(ls.map((e) => e.dias))), fonte: "Entradas de amostras: recebimento → liberação" },
    { k: "no_prazo", fmt: (v) => `${num(v, 0)} %`, serie: meses.map((mm) => { const ls = libs.filter((e) => noMes(e.lib, mm)); return ls.length ? (ls.filter((e) => e.dias <= prazoMeta).length / ls.length) * 100 : null; }), valor: periodo((ls) => (ls.length ? (ls.filter((e) => e.dias <= prazoMeta).length / ls.length) * 100 : null)), fonte: `Liberadas em até ${num(prazoMeta)} dias` },
    { k: "reclamacoes", fmt: (v) => num(v), serie: meses.map(reclamacoesDe), valor: meses.length ? reclamacoesDe(meses[meses.length - 1]) : 0, fonte: "Reclamações registradas + insatisfações da pesquisa (mês atual)" },
    { k: "nps", fmt: (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v}`), serie: meses.map((mm) => npsDe(resp.filter((r) => noMes(r.respondido_em, mm)))), valor: npsDe(resp.filter((r) => new Date(r.respondido_em) >= inicio)), fonte: "Pesquisa de satisfação" },
    { k: "satisfacao", fmt: (v) => num(v), serie: meses.map((mm) => media(resp.filter((r) => noMes(r.respondido_em, mm)).map((r) => r.notas?.satisfacao_geral).filter((x) => typeof x === "number"))), valor: media(resp.filter((r) => new Date(r.respondido_em) >= inicio).map((r) => r.notas?.satisfacao_geral).filter((x) => typeof x === "number")), fonte: "Pesquisa de satisfação (1 a 5)" },
    { k: "nc_abertas", fmt: (v) => num(v, 0), serie: meses.map((mm) => ncAbertasEm(mm.fim)), valor: ncs.filter((n) => n.etapa !== "ENCERRADA").length, fonte: "Não conformidades (hoje)" },
    { k: "equip_em_dia", fmt: (v) => `${num(v, 0)} %`, serie: null, valor: emDia, fonte: "Equipamentos ativos sem controle vencido (hoje)" },
    { k: "proficiencia", fmt: (v) => `${num(v, 0)} %`, serie: meses.map((mm) => profAte(mm.fim)), valor: profAte(new Date()), fonte: "Proficiência dos últimos 12 meses" },
  ].map((i) => { const m = meta(i.k); const ok = i.valor == null || !m ? null : m.sentido === "MAX" ? i.valor <= Number(m.meta) : i.valor >= Number(m.meta); return { ...i, m, ok }; });

  const ncAbertas = ncs.filter((n) => n.etapa !== "ENCERRADA");
  const anoAtual = new Date().getFullYear();
  const audAno = auditorias.filter((a) => a.ano === anoAtual);
  const pauta = [
    ["Ações de análises críticas anteriores", "Registrar o andamento na reunião"],
    ["Mudanças internas e externas", "Pessoal, equipamentos, métodos, legislação, clientes"],
    ["Adequação de políticas e procedimentos", `${documentos.filter((d) => d.status === "VIGENTE").length} documentos vigentes; ${documentos.filter((d) => d.status === "VIGENTE" && d.proxima_revisao && d.proxima_revisao < hojeYmd()).length} com revisão vencida`],
    ["Resultados de auditorias internas", `${audAno.filter((a) => a.status === "FEITA").length} de ${audAno.filter((a) => a.status !== "CANCELADA").length} feitas em ${anoAtual}; ${ncs.filter((n) => n.origem === "AUDITORIA" && n.etapa !== "ENCERRADA").length} constatação(ões) aberta(s)`],
    ["Ações corretivas e não conformidades", `${ncAbertas.length} aberta(s), ${ncAbertas.filter((n) => n.prazo && n.prazo < hojeYmd()).length} com prazo vencido; ${ncs.filter((n) => n.etapa === "ENCERRADA" && n.encerrada_em && new Date(n.encerrada_em).getFullYear() === anoAtual).length} encerrada(s) no ano`],
    ["Ensaios de proficiência / interlaboratoriais", indicadores.find((i) => i.k === "proficiencia").valor == null ? "Sem resultados nos últimos 12 meses" : `${num(indicadores.find((i) => i.k === "proficiencia").valor, 0)} % satisfatórios nos últimos 12 meses`],
    ["Volume e tipo de trabalho", `${libs.filter((e) => dataDe(e.lib) >= inicio).length} entradas liberadas nos últimos ${nMeses} meses; prazo médio ${num(indicadores[0].valor)} dias`],
    ["Retorno de clientes e reclamações", `NPS ${indicadores.find((i) => i.k === "nps").fmt(indicadores.find((i) => i.k === "nps").valor)}; satisfação ${num(indicadores.find((i) => i.k === "satisfacao").valor)}; ${(sat?.tratativas || []).filter((t) => t.status !== "CONCLUIDA").length} insatisfação(ões) em tratamento`],
    ["Eficácia das melhorias implementadas", `${ncs.filter((n) => n.eficaz === true).length} ação(ões) verificada(s) como eficaz(es)`],
    ["Adequação de recursos (equipamentos e pessoal)", `${num(emDia, 0)} % dos equipamentos com controle em dia; ${equipamentos.filter((e) => e.situacao === "MANUTENCAO").length} em manutenção`],
    ["Resultados de identificação de riscos e oportunidades", "Registrar na reunião"],
  ];

  function exportarPauta() {
    baixarPlanilha({ nome: "analise-critica-pauta", titulo: `Análise crítica pela direção — dados de ${fmtData(hojeYmd())} (últimos ${nMeses} meses)`,
      colunas: [{ chave: "item", rotulo: "Item (ISO 17025 · 8.9.2)" }, { chave: "dado", rotulo: "Dados do sistema" }, { chave: "decisao", rotulo: "Decisões e ações (preencher na reunião)" }],
      linhas: [...pauta.map(([item, dado]) => ({ item, dado, decisao: "" })), { item: "", dado: "", decisao: "" },
        ...indicadores.map((i) => ({ item: i.m?.rotulo || i.k, dado: `${i.fmt(i.valor)} · meta ${i.m?.sentido === "MAX" ? "≤" : "≥"} ${num(Number(i.m?.meta))}${i.m?.unidade ? ` ${i.m.unidade}` : ""} · ${i.ok == null ? "sem dados" : i.ok ? "atingida" : "não atingida"}`, decisao: "" }))] });
  }
  async function gravarMeta(e) {
    e.preventDefault();
    try { await salvarMeta(editMeta.chave, editMeta.meta); setEditMeta(null); await recarregar(); avisar({ tipo: "ok", texto: "Meta atualizada." }); } catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Indicadores e análise crítica" iso="ISO 17025 · 8.9" voltar={voltar} acoes={<>
        <select className="input w-auto" value={nMeses} onChange={(e) => setNMeses(Number(e.target.value))} aria-label="Período"><option value={3}>Últimos 3 meses</option><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option></select>
        <button type="button" onClick={exportarPauta} className="btn-primary inline-flex items-center gap-1.5"><Download className="h-4 w-4" aria-hidden /> Pauta da análise crítica (Excel)</button>
      </>} />
      {!sat ? <p className="text-sm text-slate-500">Carregando…</p> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {indicadores.map((i) => { const max = Math.max(1, ...(i.serie || []).map((v) => Math.abs(v ?? 0))); return (
            <div key={i.k} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-xs font-semibold text-slate-500">{i.m?.rotulo || i.k}</p><p className="mt-0.5 font-display text-2xl font-semibold text-slate-900">{i.fmt(i.valor)}</p></div>
                <button type="button" disabled={!podeEscrever} onClick={() => setEditMeta({ ...i.m })} title="Mudar a meta"><Pill tom={i.ok == null ? "gray" : i.ok ? "ok" : "bad"}>meta {i.m?.sentido === "MAX" ? "≤" : "≥"} {num(Number(i.m?.meta))}{i.m?.unidade === "%" ? " %" : ""}{podeEscrever && <Pencil className="ml-1 inline h-3 w-3" aria-hidden />}</Pill></button>
              </div>
              {i.serie ? <><div className="mt-2 flex h-12 items-end gap-1">{i.serie.map((v, j) => <div key={j} title={`${meses[j].rot}: ${i.fmt(v)}`} className={`flex-1 rounded-t ${j === i.serie.length - 1 ? "bg-brand" : "bg-brand-100"}`} style={{ height: `${v == null ? 3 : Math.max(6, (Math.abs(v) / max) * 100)}%` }} />)}</div>
                <div className="mt-0.5 flex gap-1">{meses.map((mm, j) => <span key={j} className="flex-1 text-center text-[10px] text-slate-400">{mm.rot}</span>)}</div></> : <div className="mt-2 h-12" />}
              <p className="mt-1 text-[11px] text-slate-400">{i.fonte}</p>
            </div>); })}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="card overflow-x-auto p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">Metas do período</h3>
            <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-2 py-2">Indicador</th><th className="px-2 py-2">Meta</th><th className="px-2 py-2">Resultado</th><th className="px-2 py-2">Situação</th></tr></thead>
              <tbody>{indicadores.map((i) => <tr key={i.k} className="border-t"><td className="px-2 py-2">{i.m?.rotulo}</td><td className="px-2 py-2">{i.m?.sentido === "MAX" ? "≤" : "≥"} {num(Number(i.m?.meta))} {i.m?.unidade}</td><td className="px-2 py-2 font-semibold">{i.fmt(i.valor)}</td><td className="px-2 py-2"><Pill tom={i.ok == null ? "gray" : i.ok ? "ok" : "bad"}>{i.ok == null ? "sem dados" : i.ok ? "Atingida" : "Não atingida"}</Pill></td></tr>)}</tbody></table>
          </div>
          <div className="card p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">Pauta da análise crítica pela direção (8.9.2)</h3>
            <ol className="space-y-2 border-l-2 border-brand-100 pl-4 text-sm">{pauta.map(([item, dado]) => <li key={item}><b className="text-slate-800">{item}</b><span className="block text-slate-500">{dado}</span></li>)}</ol>
            <p className="mt-3 text-xs text-slate-400">Cada item vem dos dados das outras páginas da Qualidade. Exporte a pauta e registre as decisões na reunião.</p>
          </div>
        </div>
      </>}
      <Modal titulo={`Meta · ${editMeta?.rotulo || ""}`} aberto={!!editMeta} aoFechar={() => setEditMeta(null)}>
        {editMeta && <form onSubmit={gravarMeta} className="grid gap-3">
          <Campo rotulo={`Meta (${editMeta.sentido === "MAX" ? "resultado deve ser no máximo" : "resultado deve ser no mínimo"})`}><input className="input" inputMode="decimal" value={editMeta.meta} onChange={(e) => setEditMeta({ ...editMeta, meta: e.target.value })} /></Campo>
          <button className="btn-primary">Salvar meta</button>
        </form>}
      </Modal>
    </div>
  );
}
