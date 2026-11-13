// Qualidade › Equipamentos (ISO/IEC 17025 · 6.4 e 6.5): os DADOS AUDITÁVEIS do equipamento.
// O cadastro é o do Patrimônio (código da etiqueta, área, periodicidade) e o serviço (fornecedor, custo, agenda)
// é de Manutenções. Aqui: critério de aceitação, faixa, ensaios afetados, análise crítica do certificado,
// verificações e situação apto / não apto. Reprovação abre não conformidade e marca "não apto" nos três lugares.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardPlus, Download, ExternalLink, Pencil, Printer, Search, Tag, Wrench } from "lucide-react";
import { salvarRegistro, registrarCalibracao, excluirRegistro } from "../../../services/qualidade.js";
import { baixarPlanilha } from "../../../lib/planilha.js";
import { abrirImpressao, dadosDoFormulario } from "../../../lib/impressao/formularioQualidade.js";
import { FORM_PLCAL, FORM_FICHA_EQ, FORM_ETIQUETA_EQ, corpoPlcal, corpoFichaEquip, corpoEtiquetas } from "../../../lib/impressao/equipamentos.js";
import { StatCard, Modal } from "../../ui.jsx";
import { Anexos, Cabecalho, Campo, Pill, diasAte, fmtData, hojeYmd, nomeDe, Paginacao } from "./comum.jsx";

const CONTROLES = { CALIBRACAO: "Calibração externa", VERIFICACAO: "Verificação com padrão", VALIDACAO: "Validação", DIARIA: "Verificação diária", NENHUM: "Sem controle" };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function situacaoEquip(e) {
  if (e.situacao === "INATIVO") return ["Inativo", "gray"];
  if (e.bloqueado) return ["Não apto", "bad"];
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
  const manutencoes = q.manutencoes || [];
  // O que Manutenções fez e a Qualidade ainda precisa avaliar (6.4.4 e 6.4.9).
  const pend = useMemo(() => {
    const m = new Map();
    for (const e of equipamentos) {
      if (!e.bem_id || e.situacao === "INATIVO") continue;
      const cals = calibracoes.filter((c) => c.equipamento_id === e.id);
      const ultCal = cals.filter((c) => c.tipo === "CALIBRACAO").reduce((x, c) => (c.data > x ? c.data : x), "");
      const ultQualquer = cals.reduce((x, c) => (c.data > x ? c.data : x), "");
      const doBem = manutencoes.filter((x) => x.alvoId === e.bem_id);
      const certificado = doBem.filter((x) => x.status === "feita" && x.tipo === "calibracao" && x.data && x.data > ultCal && !cals.some((c) => c.manutencao_id === x.id));
      const verificar = doBem.filter((x) => x.status === "feita" && x.tipo === "corretiva" && x.data && x.data > ultQualquer && !cals.some((c) => c.manutencao_id === x.id));
      const aberta = doBem.find((x) => x.status !== "feita" && x.tipo === "corretiva") || null;
      if (certificado.length || verificar.length || aberta) m.set(e.id, { certificado, verificar, aberta, todas: doBem });
      else if (doBem.length) m.set(e.id, { certificado: [], verificar: [], aberta: null, todas: doBem });
    }
    return m;
  }, [equipamentos, calibracoes, manutencoes]);
  const temPend = (e) => { const p = pend.get(e.id); return !!p && (p.certificado.length > 0 || p.verificar.length > 0); };
  const [busca, setBusca] = useState(""); const [setor, setSetor] = useState("TODOS"); const [soVencidos, setSoVencidos] = useState(false);
  const [filtro, setFiltro] = useState(null); const [pagina, setPagina] = useState(1);
  const [selId, setSelId] = useState(null); const [form, setForm] = useState(null); const [cal, setCal] = useState(null); const [salvando, setSalvando] = useState(false);
  const hoje = hojeYmd();
  const ativos = equipamentos.filter((e) => e.situacao !== "INATIVO");
  const vencidos = ativos.filter((e) => situacaoEquip(e)[1] === "bad");
  const vence30 = ativos.filter((e) => situacaoEquip(e)[1] === "warn");
  const diarios = ativos.filter((e) => e.controle === "DIARIA" && e.situacao === "ATIVO");
  const feitosHoje = diarios.filter((e) => calibracoes.some((c) => c.equipamento_id === e.id && c.tipo === "DIARIA" && c.data === hoje));
  const setores = [...new Set(equipamentos.map((e) => e.setor).filter(Boolean))].sort();
  // Filtros dos cards: clicar mostra só aqueles equipamentos; clicar de novo limpa.
  const FILTROS = {
    ATIVOS: ["Equipamentos ativos", (e) => e.situacao !== "INATIVO"],
    VENCIDOS: ["Controle vencido", (e) => e.situacao !== "INATIVO" && situacaoEquip(e)[1] === "bad"],
    VENCE30: ["Vence em 30 dias", (e) => e.situacao !== "INATIVO" && situacaoEquip(e)[1] === "warn"],
    NAOAPTO: ["Não aptos", (e) => e.situacao !== "INATIVO" && e.bloqueado],
    PENDENCIA: ["Pendências vindas de Manutenções", (e) => temPend(e)],
    DIA: ["Verificações do dia pendentes", (e) => diarios.includes(e) && !feitosHoje.includes(e)],
  };
  const alternar = (f) => setFiltro((atual) => (atual === f ? null : f));
  const lista = useMemo(() => equipamentos.filter((e) => (setor === "TODOS" || e.setor === setor) && (!soVencidos || ["bad", "warn"].includes(situacaoEquip(e)[1]))
    && (!filtro || FILTROS[filtro][1](e))
    && (!busca || `${e.codigo} ${e.nome} ${e.local || ""}`.toLowerCase().includes(busca.toLowerCase())))
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true })), [equipamentos, setor, soVencidos, busca, filtro, calibracoes, pend]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPagina(1); }, [busca, setor, soVencidos, filtro]);
  const sel = equipamentos.find((e) => e.id === selId) || null;
  const hist = sel ? calibracoes.filter((c) => c.equipamento_id === sel.id) : [];
  const pSel = sel ? pend.get(sel.id) : null;
  const naoAptos = ativos.filter((e) => e.bloqueado);
  const comPend = ativos.filter(temPend);
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

  // Impressão (PLCAL, FM-LAB-114 ficha e histórico, FM-LAB-115 etiquetas de situação).
  const imprimir = (padrao, corpo, opcoes = {}) => { try { abrirImpressao({ form: dadosDoFormulario(q.documentos, padrao), corpo, impressoPor: nomeDe(contas, q.eu), ...opcoes }); } catch (er) { avisar({ tipo: "erro", texto: er.message }); } };
  const imprimirPlcal = () => imprimir(FORM_PLCAL, corpoPlcal(equipamentos, calibracoes, { hojeYmd: hoje, responsavel: nomeDe(contas, q.eu) }), { paisagem: true });
  const imprimirFicha = (e) => imprimir(FORM_FICHA_EQ, corpoFichaEquip(e, { calibracoes, manutencoes, ncs, hojeYmd: hoje }));
  const imprimirEtiquetas = (ls) => imprimir(FORM_ETIQUETA_EQ, corpoEtiquetas(ls, calibracoes, { hojeYmd: hoje }), { controlada: false });

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Equipamentos" iso="ISO 17025 · 6.4 e 6.5" voltar={voltar} acoes={<>
        <button type="button" onClick={imprimirPlcal} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> PLCAL</button>
        <button type="button" onClick={() => imprimirEtiquetas(lista.filter((e) => e.situacao !== "INATIVO"))} className="btn-outline inline-flex items-center gap-1.5" title="Etiquetas dos equipamentos da lista (com os filtros aplicados)"><Tag className="h-4 w-4" aria-hidden /> Etiquetas</button>
        <button type="button" onClick={exportar} className="btn-outline inline-flex items-center gap-1.5"><Download className="h-4 w-4" aria-hidden /> Plano (Excel)</button>
        <Link to="/patrimonio" className="btn-outline inline-flex items-center gap-1.5"><ExternalLink className="h-4 w-4" aria-hidden /> Cadastro no Patrimônio</Link>
      </>} />
      <p className="text-sm text-slate-500">O equipamento é cadastrado no <b>Patrimônio</b> (marque “requer calibração” ou “qualificação”) e aparece aqui. O serviço — agenda, fornecedor, custo — fica em <b>Manutenções</b>. Aqui ficam o critério, a análise do certificado e a situação apto / não apto.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard rotulo="Equipamentos controlados" valor={ativos.length} sub={setores.slice(0, 3).join(", ") || "marque no Patrimônio"} onClick={() => alternar("ATIVOS")} ativo={filtro === "ATIVOS"} />
        <StatCard rotulo="Controle vencido" valor={vencidos.length} tom={vencidos.length ? "bad" : "neutral"} sub={vencidos.map((e) => e.codigo).slice(0, 3).join(", ") || "nenhum"} onClick={() => alternar("VENCIDOS")} ativo={filtro === "VENCIDOS"} />
        <StatCard rotulo="Vence em 30 dias" valor={vence30.length} tom={vence30.length ? "warn" : "neutral"} sub="agendar calibração" onClick={() => alternar("VENCE30")} ativo={filtro === "VENCE30"} />
        <StatCard rotulo="Não aptos" valor={naoAptos.length} tom={naoAptos.length ? "bad" : "neutral"} sub={naoAptos.map((e) => e.codigo).slice(0, 2).join(", ") || "nenhum bloqueado"} onClick={() => alternar("NAOAPTO")} ativo={filtro === "NAOAPTO"} />
        <StatCard rotulo="Vindo de Manutenções" valor={comPend.length} tom={comPend.length ? "warn" : "neutral"} sub="certificado a analisar ou verificar após conserto" onClick={() => alternar("PENDENCIA")} ativo={filtro === "PENDENCIA"} />
        <StatCard rotulo="Verificações do dia" valor={diarios.length ? `${feitosHoje.length} de ${diarios.length}` : "—"} tom={feitosHoje.length < diarios.length ? "warn" : "ok"} sub={diarios.filter((e) => !feitosHoje.includes(e)).map((e) => e.codigo).slice(0, 2).join(", ") || "tudo registrado"} onClick={() => alternar("DIA")} ativo={filtro === "DIA"} />
      </div>
      {filtro && <div className="flex items-center gap-2 text-sm text-slate-600">Mostrando: <b>{FILTROS[filtro][0]}</b><button type="button" onClick={() => setFiltro(null)} className="text-brand-700 underline">limpar</button></div>}
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden /><input className="input pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código ou equipamento…" /></div>
            {["TODOS", ...setores].map((s) => <button key={s} type="button" onClick={() => setSetor(s)} className={`rounded-full border px-3 py-1 text-xs ${setor === s ? "border-brand-300 bg-brand-50 font-semibold text-brand-700" : "text-slate-600"}`}>{s === "TODOS" ? "Todos" : s}</button>)}
            <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={soVencidos} onChange={(e) => setSoVencidos(e.target.checked)} /> Só vencidos / a vencer</label>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Código</th><th className="px-3 py-2.5">Equipamento</th><th className="px-3 py-2.5">Controle</th><th className="px-3 py-2.5">Próxima</th><th className="px-3 py-2.5">Situação</th><th className="px-3 py-2.5">Critério</th></tr></thead>
            <tbody>{lista.slice((pagina - 1) * 25, pagina * 25).map((e) => { const [t, tom] = situacaoEquip(e); return (
              <tr key={e.id} onClick={() => setSelId(e.id)} className={`cursor-pointer border-t hover:bg-slate-50 ${selId === e.id ? "bg-brand-50/60" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{e.codigo}</td><td className="px-3 py-2.5">{e.nome}<span className="block text-xs text-slate-400">{[e.setor, e.local].filter(Boolean).join(" · ")}</span></td>
                <td className="px-3 py-2.5">{CONTROLES[e.controle]}</td><td className="whitespace-nowrap px-3 py-2.5">{["DIARIA", "NENHUM"].includes(e.controle) ? "—" : fmtData(e.proxima)}</td><td className="px-3 py-2.5"><Pill tom={tom}>{t}</Pill>{temPend(e) && <span className="ml-1"><Pill tom="warn">manutenção</Pill></span>}</td><td className="px-3 py-2.5 text-slate-500">{e.criterio || <span className="text-warn-700">definir</span>}</td>
              </tr>); })}</tbody>
          </table>{lista.length === 0 && <p className="p-10 text-center text-sm text-slate-500">{equipamentos.length ? "Nenhum equipamento com esse filtro." : "Nenhum equipamento ainda. No Patrimônio, marque “requer calibração” nos equipamentos do laboratório."}</p>}</div>
          <Paginacao total={lista.length} pagina={pagina} setPagina={setPagina} />
        </div>

        <div className="space-y-4">
          {!sel ? <div className="card p-6 text-center text-sm text-slate-500">Clique num equipamento para ver o histórico, o certificado e registrar calibração ou verificação.</div> : <>
            <div className="card space-y-3 p-5">
              <div className="flex items-start justify-between gap-2"><h3 className="font-display font-semibold text-slate-900">{sel.codigo} · {sel.nome}</h3><Pill tom={situacaoEquip(sel)[1]}>{situacaoEquip(sel)[0]}</Pill></div>
              {sel.bloqueado ? <div className="rounded-xl bg-bad-50 p-3 text-sm text-bad-700"><b>Não apto.</b> {sel.bloqueio_motivo || ""} Não usar nos ensaios até um novo registro aprovado.{sel.ensaios_afetados ? ` Ensaios afetados: ${sel.ensaios_afetados}.` : ""}</div>
                : situacaoEquip(sel)[1] === "bad" && <div className="rounded-xl bg-bad-50 p-3 text-sm text-bad-700"><b>Controle vencido em {fmtData(sel.proxima)}.</b> Não usar nos ensaios até registrar nova calibração/verificação.{sel.ensaios_afetados ? ` Ensaios afetados: ${sel.ensaios_afetados}.` : ""}</div>}
              {pSel?.certificado.map((m) => <div key={m.id} className="rounded-xl bg-warn-50 p-3 text-sm text-warn-700"><b>Calibração feita em {fmtData(m.data)}</b>{m.fornecedor ? ` por ${m.fornecedor}` : ""} (Manutenções). Falta a análise crítica do certificado.
                {podeEscrever && <button type="button" onClick={() => setCal({ equipamento_id: sel.id, manutencao_id: m.id, tipo: "CALIBRACAO", data: m.data, resultado: "APROVADO", laboratorio: m.fornecedor || "" })} className="ml-2 font-semibold underline">Analisar certificado</button>}</div>)}
              {pSel?.verificar.map((m) => <div key={m.id} className="rounded-xl bg-warn-50 p-3 text-sm text-warn-700"><b>Manutenção corretiva em {fmtData(m.data)}</b>{m.descricao ? ` (${m.descricao})` : ""}. Verificar antes de voltar ao uso.
                {podeEscrever && <button type="button" onClick={() => setCal({ equipamento_id: sel.id, manutencao_id: m.id, tipo: "VERIFICACAO", data: hoje, resultado: "APROVADO" })} className="ml-2 font-semibold underline">Registrar verificação</button>}</div>)}
              {pSel?.aberta && <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">Corretiva aberta em Manutenções{pSel.aberta.data ? ` para ${fmtData(pSel.aberta.data)}` : ""}: {pSel.aberta.descricao || "sem descrição"}.</div>}
              <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-slate-500">Controle</dt><dd>{CONTROLES[sel.controle]}{sel.periodicidade_meses ? ` · a cada ${sel.periodicidade_meses} mês(es)` : ""}</dd>
                <dt className="text-slate-500">Critério</dt><dd>{sel.criterio || <span className="text-warn-700">definir em Editar</span>}</dd>
                {sel.faixa_uso && <><dt className="text-slate-500">Faixa de uso</dt><dd>{sel.faixa_uso}</dd></>}
                {sel.ensaios_afetados && <><dt className="text-slate-500">Ensaios que usa</dt><dd>{sel.ensaios_afetados}</dd></>}
                <dt className="text-slate-500">Identificação</dt><dd>{[sel.fabricante, sel.modelo, sel.serie && `série ${sel.serie}`].filter(Boolean).join(" · ") || "—"}</dd>
                {sel.local && <><dt className="text-slate-500">Local</dt><dd>{sel.local}</dd></>}
                {sel.bem && <><dt className="text-slate-500">Patrimônio</dt><dd>{[sel.bem.area, sel.bem.responsavel && `resp. ${sel.bem.responsavel}`, sel.bem.situacao === "baixado" ? "baixado" : null].filter(Boolean).join(" · ") || "—"}{sel.bem.descricao ? <span className="block text-xs text-slate-400">{sel.bem.descricao}</span> : null}</dd></>}
              </dl>
              {podeEscrever && <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setCal({ equipamento_id: sel.id, tipo: sel.controle === "NENHUM" ? "VERIFICACAO" : sel.controle, data: hoje, resultado: "APROVADO" })} className="btn-primary inline-flex items-center gap-1.5"><ClipboardPlus className="h-4 w-4" aria-hidden /> Registrar {sel.controle === "DIARIA" ? "verificação do dia" : "calibração/verificação"}</button>
                <button type="button" onClick={() => setForm({ ...sel })} className="btn-outline inline-flex items-center gap-1.5"><Pencil className="h-4 w-4" aria-hidden /> Editar dados metrológicos</button>
                {sel.situacao === "MANUTENCAO" ? <button type="button" onClick={() => situacao(sel, "ATIVO")} className="btn-outline">Voltou ao uso</button> : <button type="button" onClick={() => situacao(sel, "MANUTENCAO")} className="btn-outline inline-flex items-center gap-1.5"><Wrench className="h-4 w-4" aria-hidden /> Fora de uso</button>}
                <Link to="/manutencoes" className="btn-ghost inline-flex items-center gap-1.5"><ExternalLink className="h-4 w-4" aria-hidden /> Manutenções</Link>
              </div>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => imprimirFicha(sel)} className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Printer className="h-4 w-4" aria-hidden /> Ficha e histórico ({FORM_FICHA_EQ.codigo})</button>
                <button type="button" onClick={() => imprimirEtiquetas([sel])} className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Tag className="h-4 w-4" aria-hidden /> Etiqueta de situação</button>
              </div>
              <div><span className="label">Certificados e documentos</span><Anexos refTipo="equipamento" refId={sel.id} arquivos={arquivos} podeEscrever={podeEscrever} aoMudar={recarregar} avisar={avisar} /></div>
            </div>
            <div className="card p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">Histórico</h3>
              {hist.length === 0 ? <p className="text-sm text-slate-500">Nenhum registro ainda.</p> :
                <table className="w-full text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-1.5">Data</th><th className="py-1.5">Tipo</th><th className="py-1.5">Leitura / certificado</th><th className="py-1.5">Resultado</th><th /></tr></thead>
                  <tbody>{hist.slice(0, 15).map((c) => { const nc = ncs.find((n) => n.id === c.nc_id); return <tr key={c.id} className="border-t align-top"><td className="py-1.5">{fmtData(c.data)}</td><td className="py-1.5">{CONTROLES[c.tipo]}</td><td className="py-1.5 text-slate-600">{[c.leitura, c.certificado, c.laboratorio].filter(Boolean).join(" · ") || "—"}<span className="block text-xs text-slate-400">{nomeDe(contas, c.registrado_por)}</span></td><td className="py-1.5"><Pill tom={c.resultado === "APROVADO" ? "ok" : "bad"}>{c.resultado === "APROVADO" ? "ok" : `reprovado${nc ? ` · ${nc.codigo}` : ""}`}</Pill></td><td className="py-1.5 text-right">{podeEscrever && <button type="button" onClick={() => apagarCal(c)} className="text-xs text-slate-400 hover:text-bad-700">apagar</button>}</td></tr>; })}</tbody></table>}
            </div>
          </>}
          {sel && pSel?.todas.length > 0 && <div className="card p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">Manutenções <span className="text-sm font-normal text-slate-400">(de Manutenções, só leitura)</span></h3>
            <table className="w-full text-left text-sm"><tbody>{[...pSel.todas].sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))).slice(0, 10).map((m) => <tr key={m.id} className="border-t align-top"><td className="whitespace-nowrap py-1.5 pr-2">{fmtData(m.data)}</td><td className="py-1.5">{{ preventiva: "Preventiva", corretiva: "Corretiva", calibracao: "Calibração" }[m.tipo] || m.tipo}{m.descricao ? <span className="block text-xs text-slate-500">{m.descricao}</span> : null}</td><td className="py-1.5 text-xs text-slate-500">{m.fornecedor}</td><td className="py-1.5 text-right"><Pill tom={m.status === "feita" ? "ok" : "sky"}>{m.status === "feita" ? "feita" : "agendada"}</Pill></td></tr>)}</tbody></table>
          </div>}
          <div className="card p-5"><h3 className="mb-2 font-display font-semibold text-slate-900">Vencimentos dos próximos 6 meses</h3>
            <div className="flex h-24 items-end gap-2">{meses.map((m, i) => <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1"><span className="text-[11px] font-semibold text-slate-600">{m.n || ""}</span><div className={`w-full rounded-t-md ${i === 0 && vencidos.length ? "bg-warn-300" : "bg-brand-100"}`} style={{ height: `${(m.n / maxMes) * 70 + 4}%` }} /><span className="text-[11px] text-slate-500">{m.rot}</span></div>)}</div>
          </div>
        </div>
      </div>

      <Modal titulo={form?.id ? `Dados metrológicos · ${form?.codigo}` : "Novo equipamento"} aberto={!!form} aoFechar={() => setForm(null)} largura="max-w-2xl">
        {form && <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
          {form.bem_id && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 sm:col-span-2">Código, nome, área e periodicidade vêm do Patrimônio — para mudar, edite a ficha do bem lá.</p>}
          <Campo rotulo="Código *"><input className="input" required value={form.codigo || ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="EQ-021" disabled={!!form.id} /></Campo>
          <Campo rotulo="Setor"><input className="input" list="qual-setores" disabled={!!form.bem_id} value={form.setor || ""} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="Físico-Químico" /><datalist id="qual-setores">{["Microbiologia", "Físico-Químico", "Coleta", "Geral", ...setores].filter((v, i, a) => a.indexOf(v) === i).map((s) => <option key={s} value={s} />)}</datalist></Campo>
          <Campo rotulo="Equipamento *" className="sm:col-span-2"><input className="input" required disabled={!!form.bem_id} value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Espectrofotômetro UV-Vis" /></Campo>
          <Campo rotulo="Fabricante"><input className="input" value={form.fabricante || ""} onChange={(e) => setForm({ ...form, fabricante: e.target.value })} /></Campo>
          <Campo rotulo="Modelo / nº de série"><div className="flex gap-2"><input className="input" value={form.modelo || ""} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Modelo" /><input className="input" value={form.serie || ""} onChange={(e) => setForm({ ...form, serie: e.target.value })} placeholder="Série" /></div></Campo>
          <Campo rotulo="Controle"><select className="input" value={form.controle} onChange={(e) => setForm({ ...form, controle: e.target.value })}>{Object.entries(CONTROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          <Campo rotulo="Periodicidade (meses)"><input type="number" min="0" className="input" value={form.periodicidade_meses ?? ""} onChange={(e) => setForm({ ...form, periodicidade_meses: e.target.value })} disabled={["DIARIA", "NENHUM"].includes(form.controle) || (!!form.bem_id && !!form.bem && form.periodicidade_meses != null)} /></Campo>
          <Campo rotulo="Próximo vencimento"><input type="date" className="input" value={form.proxima || ""} onChange={(e) => setForm({ ...form, proxima: e.target.value })} disabled={["DIARIA", "NENHUM"].includes(form.controle)} /></Campo>
          <Campo rotulo="Local"><input className="input" value={form.local || ""} onChange={(e) => setForm({ ...form, local: e.target.value })} /></Campo>
          <Campo rotulo="Critério de aceitação" className="sm:col-span-2"><input className="input" value={form.criterio || ""} onChange={(e) => setForm({ ...form, criterio: e.target.value })} placeholder="Erro ≤ 0,005 abs · 35,0 ± 0,5 °C" /></Campo>
          <Campo rotulo="Faixa de uso" className="sm:col-span-2"><input className="input" value={form.faixa_uso || ""} onChange={(e) => setForm({ ...form, faixa_uso: e.target.value })} placeholder="0 a 200 g · 20 a 45 °C · 190 a 1100 nm" /></Campo>
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
          {cal.tipo === "CALIBRACAO" && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 sm:col-span-2">Análise crítica do certificado: confira se o erro + a incerteza ficam dentro do critério{sel?.criterio ? ` (${sel.criterio})` : ""}, se a faixa calibrada cobre a faixa de uso e se o laboratório é acreditado para a grandeza. Anexe o certificado no equipamento.</p>}
          {cal.resultado === "REPROVADO" && <p className="rounded-xl bg-bad-50 p-3 text-xs text-bad-700 sm:col-span-2">Reprovado abre uma não conformidade, marcada como “trabalho afetado”, e deixa o equipamento “não apto” também no Patrimônio e em Manutenções.</p>}
          {cal.resultado === "APROVADO" && cal.tipo !== "DIARIA" && sel?.periodicidade_meses ? <p className="text-xs text-slate-500 sm:col-span-2">O próximo vencimento passa a ser {sel.periodicidade_meses} mês(es) depois desta data. Anexe o certificado no equipamento.</p> : null}
          <button disabled={salvando} className="btn-primary sm:col-span-2">{salvando ? "Salvando..." : "Registrar"}</button>
        </form>}
      </Modal>
    </div>
  );
}
