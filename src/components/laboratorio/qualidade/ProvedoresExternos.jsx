// Qualidade › Provedores externos (ISO/IEC 17025 · 6.6; PG 007, PG 008, PG 009, PG 010).
// O cadastro, a FAPE, os documentos e a inspeção de recebimento (IR) continuam na Gestão de Estoque;
// aqui a Qualidade acompanha: quem requer qualificação, reavaliação vencida, documento vencido, IR reprovada
// nos últimos 12 meses, e abre NC de fornecedor. Imprime a lista de provedores aprovados (FM-LAB-116).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FileWarning, Printer } from "lucide-react";
import { abrirNcDeFornecedor } from "../../../services/qualidade.js";
import { abrirImpressao, dadosDoFormulario, dataBr, esc } from "../../../lib/impressao/formularioQualidade.js";
import { StatCard, Modal } from "../../ui.jsx";
import { Cabecalho, Campo, Pill, SelectPessoa, fmtData, hojeYmd, nomeDe } from "./comum.jsx";

const FORM_PROVEDORES = { codigo: "FM-LAB-116", titulo: "Lista de Provedores Externos Aprovados", revisao: "00", emissao: null, extra: "Documento de origem: PG 009" };
const norm = (v) => String(v ?? "").normalize("NFD").replace(/\p{M}/gu, "").trim().toUpperCase();
const reprovada = (i) => /REPROV|RECUS|DEVOL|NAO CONFORM/.test(norm(`${i.parecer} ${i.status}`));

export default function ProvedoresExternos({ q, voltar, recarregar, avisar }) {
  const { contas, podeEscrever } = q;
  const p = useMemo(() => q.provedores || { fornecedores: [], documentos: [], inspecoes: [], avaliacoes: [] }, [q.provedores]);
  const hoje = hojeYmd();
  const [filtro, setFiltro] = useState(null); const [busca, setBusca] = useState("");
  const [nc, setNc] = useState(null); const [salvando, setSalvando] = useState(false);

  const linhas = useMemo(() => p.fornecedores.map((f) => {
    const docs = p.documentos.filter((d) => d.fornecedorId === f.id);
    const docsVencidos = docs.filter((d) => d.validade && String(d.validade).slice(0, 10) < hoje);
    const irs = p.inspecoes.filter((i) => norm(i.fornecedor) && norm(i.fornecedor) === norm(f.nome));
    const irRep = irs.filter(reprovada);
    const reavVencida = !!f.proxima && String(f.proxima).slice(0, 10) < hoje;
    const inativo = /INATIV|BLOQUE|REPROV/.test(norm(f.status));
    const critico = f.requerQualificacao === true || norm(f.requerQualificacao) === "SIM";
    return { f, docs, docsVencidos, irs, irRep, reavVencida, inativo, critico };
  }), [p, hoje]);
  const ativos = linhas.filter((l) => !l.inativo);
  const FILTROS = {
    CRITICOS: ["Requerem qualificação", (l) => l.critico],
    REAV: ["Reavaliação vencida", (l) => l.reavVencida],
    DOCS: ["Documento vencido", (l) => l.docsVencidos.length > 0],
    IR: ["IR reprovada (12 meses)", (l) => l.irRep.length > 0],
  };
  const vis = ativos.filter((l) => (!filtro || FILTROS[filtro][1](l)) && (!busca.trim() || norm(`${l.f.nome} ${l.f.cnpj} ${l.f.servico}`).includes(norm(busca))))
    .sort((a, b) => String(a.f.nome).localeCompare(String(b.f.nome), "pt-BR"));
  const conta = (k) => ativos.filter(FILTROS[k][1]).length;

  function imprimir() {
    const aprovados = ativos.filter((l) => !l.reavVencida).sort((a, b) => String(a.f.nome).localeCompare(String(b.f.nome), "pt-BR"));
    const corpo = `<table style="margin-top:6px;font-size:8.5pt"><tr><th>Fornecedor</th><th>CNPJ</th><th>Tipo / serviço</th><th>Requer qualificação</th><th>Última avaliação</th><th>Resultado</th><th>Próxima avaliação</th></tr>
${aprovados.map((l) => `<tr><td>${esc(l.f.nome)}</td><td>${esc(l.f.cnpj)}</td><td>${esc([l.f.tipo, l.f.servico].filter(Boolean).join(" · "))}</td><td>${l.critico ? "Sim" : "Não"}</td><td>${esc(dataBr(l.f.ultima))}</td><td>${esc(l.f.resultado || "")}</td><td>${esc(dataBr(l.f.proxima))}</td></tr>`).join("")}</table>
<p style="font-size:8pt;margin-top:4px">Fornecedores ativos com avaliação em dia em ${esc(dataBr(hoje))}. Cadastro, FAPE e IR: Gestão de Estoque.</p>`;
    try { abrirImpressao({ form: dadosDoFormulario(q.documentos, FORM_PROVEDORES), corpo, impressoPor: nomeDe(contas, q.eu), paisagem: true }); } catch (e) { avisar({ tipo: "erro", texto: e.message }); }
  }
  async function abrirNc(e) {
    e.preventDefault(); setSalvando(true);
    try { const r = await abrirNcDeFornecedor({ fornecedorId: nc.f.id, descricao: nc.descricao, responsavel: nc.responsavel, trabalhoAfetado: nc.trabalhoAfetado }); setNc(null); await recarregar(); avisar({ tipo: "ok", texto: `Não conformidade ${r.codigo} aberta para ${nc.f.nome}.` }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Provedores externos" iso="ISO 17025 · 6.6 · PG 009" voltar={voltar} acoes={<>
        <button type="button" onClick={imprimir} className="btn-outline inline-flex items-center gap-1.5"><Printer className="h-4 w-4" aria-hidden /> Lista de aprovados ({FORM_PROVEDORES.codigo})</button>
        <Link to="/gestao-estoque" className="btn-outline inline-flex items-center gap-1.5"><ExternalLink className="h-4 w-4" aria-hidden /> Gestão de Estoque</Link>
      </>} />
      <p className="text-sm text-slate-500">Cadastro, FAPE, documentos e inspeção de recebimento ficam na <b>Gestão de Estoque</b>. Aqui a Qualidade acompanha o que pede ação e abre a não conformidade do fornecedor.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard rotulo="Fornecedores ativos" valor={ativos.length} sub={`${linhas.length - ativos.length} inativo(s)`} onClick={() => setFiltro(null)} ativo={!filtro} />
        <StatCard rotulo="Requerem qualificação" valor={conta("CRITICOS")} sub="afetam a validade dos resultados" onClick={() => setFiltro(filtro === "CRITICOS" ? null : "CRITICOS")} ativo={filtro === "CRITICOS"} />
        <StatCard rotulo="Reavaliação vencida" valor={conta("REAV")} tom={conta("REAV") ? "bad" : "ok"} sub="FAPE fora do prazo" onClick={() => setFiltro(filtro === "REAV" ? null : "REAV")} ativo={filtro === "REAV"} />
        <StatCard rotulo="Documento vencido" valor={conta("DOCS")} tom={conta("DOCS") ? "warn" : "ok"} sub="alvará, acreditação, certificados" onClick={() => setFiltro(filtro === "DOCS" ? null : "DOCS")} ativo={filtro === "DOCS"} />
        <StatCard rotulo="IR reprovada (12 meses)" valor={conta("IR")} tom={conta("IR") ? "warn" : "ok"} sub={`${p.inspecoes.length} inspeção(ões) no período`} onClick={() => setFiltro(filtro === "IR" ? null : "IR")} ativo={filtro === "IR"} />
      </div>
      <div className="card overflow-hidden">
        <div className="border-b p-3"><input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fornecedor, CNPJ ou serviço" /></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Tipo / serviço</th><th className="px-3 py-2">Avaliação</th><th className="px-3 py-2">Próxima</th><th className="px-3 py-2">Documentos</th><th className="px-3 py-2">IR (12 meses)</th><th className="px-3 py-2" /></tr></thead>
          <tbody>{vis.map((l) => (
            <tr key={l.f.id} className="border-t align-top">
              <td className="px-3 py-2"><span className="font-medium text-slate-900">{l.f.nome}</span>{l.critico && <span className="ml-1"><Pill tom="vio">qualificação</Pill></span>}<span className="block text-xs text-slate-500">{l.f.cnpj}</span></td>
              <td className="px-3 py-2 text-xs">{[l.f.tipo, l.f.servico].filter(Boolean).join(" · ") || "—"}</td>
              <td className="px-3 py-2 text-xs">{l.f.resultado || "—"}{l.f.ultima && <span className="block text-slate-500">{fmtData(String(l.f.ultima).slice(0, 10))}</span>}</td>
              <td className={`whitespace-nowrap px-3 py-2 ${l.reavVencida ? "font-semibold text-bad-700" : ""}`}>{l.f.proxima ? fmtData(String(l.f.proxima).slice(0, 10)) : "—"}{l.reavVencida && <span className="block text-xs">vencida</span>}</td>
              <td className="px-3 py-2 text-xs">{l.docs.length}{l.docsVencidos.length > 0 && <span className="block font-semibold text-warn-700">{l.docsVencidos.length} vencido(s): {l.docsVencidos.map((d) => d.tipo).slice(0, 2).join(", ")}</span>}</td>
              <td className="px-3 py-2 text-xs">{l.irs.length}{l.irRep.length > 0 && <span className="block font-semibold text-bad-700">{l.irRep.length} reprovada(s)</span>}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{podeEscrever && <button type="button" onClick={() => setNc({ f: l.f, descricao: l.irRep.length ? `IR reprovada: ${l.irRep.map((i) => `${i.produto} (${fmtData(String(i.data).slice(0, 10))})`).join("; ")}` : "", responsavel: q.eu, trabalhoAfetado: false })} className="btn-outline inline-flex items-center gap-1 px-2.5 py-1 text-xs"><FileWarning className="h-3.5 w-3.5" aria-hidden /> Abrir NC</button>}</td>
            </tr>))}
            {vis.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">{p.fornecedores.length ? "Nada com esse filtro." : "Nenhum fornecedor cadastrado na Gestão de Estoque."}</td></tr>}
          </tbody></table></div>
      </div>
      <Modal titulo={nc ? `Não conformidade de fornecedor · ${nc.f.nome}` : ""} aberto={!!nc} aoFechar={() => setNc(null)}>
        {nc && <form onSubmit={abrirNc} className="grid gap-3">
          <Campo rotulo="O que aconteceu *"><textarea className="input" rows={4} required value={nc.descricao} onChange={(e) => setNc({ ...nc, descricao: e.target.value })} placeholder="Ex.: lote de meio de cultura recebido fora da especificação; certificado de calibração sem acreditação" /></Campo>
          <Campo rotulo="Responsável"><SelectPessoa contas={contas} valor={nc.responsavel} onChange={(v) => setNc({ ...nc, responsavel: v })} /></Campo>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={nc.trabalhoAfetado} onChange={(e) => setNc({ ...nc, trabalhoAfetado: e.target.checked })} /> Pode ter afetado resultados já emitidos (avaliar trabalho afetado)</label>
          <p className="text-xs text-slate-500">A NC entra em Não conformidades (origem Fornecedor), com 5 porquês, ação e eficácia. Atualize também a FAPE do fornecedor na Gestão de Estoque.</p>
          <button disabled={salvando} className="btn-primary">{salvando ? "Abrindo..." : "Abrir não conformidade"}</button>
        </form>}
      </Modal>
    </div>
  );
}
