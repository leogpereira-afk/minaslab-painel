// Menu Financeiro do LIMS: só Contas a receber (decisão do Léo, 04/11/2026;
// contas a pagar, fluxo de caixa e notas ficam no Finanças do painel).
// Parcelas de contrato e faturas por amostra (geradas na emissão do
// certificado); confirmar pagamento, alterar, cancelar e Boletim de Medição.

import { useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { navegar } from "../lib/rota.js";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { numero } from "../lib/laboratorio.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, opcoes, useAviso } from "../components/ui.jsx";
import { statusDaOS } from "../lib/ordens.js";
import { paraCSV } from "../lib/grade.js";

const quando = (s) => (s ? (String(s).length > 10 ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : dataBR(s)) : "");

const FORMAS = ["Boleto", "Pix", "Transferência", "Cartão", "Dinheiro", "Depósito"];
const hoje = () => isoDia(0);
export const statusConta = (r) => (r.status === "Em aberto" && r.venc && r.venc < hoje() ? "Vencido" : r.status);
const valorBR = (v) => brl(v);
const somar = (l, f) => Math.round(l.reduce((s, r) => s + (Number(f(r)) || 0), 0) * 100) / 100;

function Kpis({ itens }) {
  return <div className="kpis">{itens.map(([t, v, c]) => <div key={t} className={`kpi ${c || ""}`}><span>{t}</span><b>{v}</b></div>)}</div>;
}

/* ---------- Contas a receber ---------- */

const STATUS_FATURA = ["Em aberto", "Pago", "Aguardando fechamento", "Cancelado"];
const rotuloStatus = (s) => (s === "Cancelado" ? "Cancelada" : s);
export const numeroFatura = (r) => `FA${String(r.cod || 0).padStart(5, "0")}/${String(r.criadoEm || r.venc || isoDia(0)).slice(0, 4)}`;
const somarDias = (n) => { const d = new Date(`${hoje()}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function ContasReceber() {
  const { dados, salvar, salvarLote } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [chave, setChave] = useState(0);
  const [expandir, setExpandir] = useState(false);
  const [janela, setJanela] = useState(null);
  const cli = (r) => dados.clientes.find((c) => c.id === r.clienteId) || {};
  const ct = (r) => dados.contratos.find((c) => c.id === r.contratoId);
  const os = (r) => dados.ordens.find((o) => o.id === r.osId);
  const am = (r) => dados.amostras.find((a) => a.id === r.amostraId);
  const linhas = dados.contas_receber.filter((r) => expandir || r.status !== "Agrupada");
  const forma = (r) => r.forma || ct(r)?.condicoes || "";
  const colunas = [
    { t: "Id", v: (r) => Number(r.cod) || 0, filtro: true },
    { t: "Status Fatura", v: (r) => rotuloStatus(r.status), h: (r) => { const venc = statusConta(r) === "Vencido"; return <span className={`lbl ${r.status === "Pago" ? "ok" : r.status === "Cancelado" || r.status === "Agrupada" ? "off" : venc ? "crit" : r.status === "Aguardando fechamento" ? "info" : "warn"}`}>{rotuloStatus(r.status)}</span>; }, filtro: "lista" },
    { t: "Fatura", v: numeroFatura, h: (r) => <span title={r.descricao}>{numeroFatura(r)}{r.agrupa?.length ? ` (${r.agrupa.length})` : ""}</span>, filtro: true },
    { t: "Forma pagamento", v: forma, filtro: "lista" },
    { t: "Cliente", v: (r) => { const c = cli(r); return c.fantasia ? `${c.razao} (${c.fantasia})` : c.razao || ""; }, filtro: true },
    { t: "CNPJ/CPF", v: (r) => cli(r).doc || "", filtro: true },
    { t: "Solicitante", v: (r) => dados.solicitantes.find((s) => s.id === (ct(r)?.solicitanteId || os(r)?.solicitanteId))?.razao || "Sem solicitante", filtro: true },
    { t: "Contrato", v: (r) => r.contrato || "", filtro: true },
    { t: "Amostra Referência", v: (r) => r.referencia || "", filtro: true },
    { t: "Ordem de Serviço", v: (r) => r.os || "", filtro: true },
    { t: "Status Ordem serviço", v: (r) => (r.osId ? statusDaOS(dados.amostras.filter((a) => a.osId === r.osId)) : r.origem === "Contrato" ? "Parcelado" : ""), filtro: "lista" },
    { t: "Data do Agendamento", v: (r) => os(r)?.dataColeta || "", h: (r) => quando(os(r)?.dataColeta), fv: (r) => quando(os(r)?.dataColeta), filtro: true },
    { t: "Data de Recepção", v: (r) => am(r)?.dataEntrada || "", h: (r) => quando(am(r)?.dataEntrada), fv: (r) => quando(am(r)?.dataEntrada), filtro: true },
    { t: "Data de Vencimento", v: (r) => r.venc || "", h: (r) => dataBR(r.venc), fv: (r) => dataBR(r.venc), filtro: true },
    { t: "Data de Pagamento", v: (r) => r.pagoEm || "", h: (r) => dataBR(r.pagoEm), fv: (r) => dataBR(r.pagoEm), filtro: true },
    { t: "Total", v: (r) => Number(r.valor) || 0, h: (r) => valorBR(r.valor), fv: (r) => valorBR(r.valor) },
    { t: "Obs", v: (r) => r.obs || "", filtro: true },
  ];
  const abertas = dados.contas_receber.filter((r) => r.status === "Em aberto");
  const h = hoje(), d30 = somarDias(30), m30 = somarDias(-30);
  const selecionadas = linhas.filter((r) => sel.has(r.id));
  const exigir = (fn) => () => (selecionadas.length ? fn(selecionadas) : avisar("Selecione ao menos uma fatura.", "err"));
  const umaSo = (fn) => exigir((s) => fn(s[0]));
  const confirmar = async () => {
    const alvo = janela.contas.filter((r) => r.status === "Em aberto" || r.status === "Aguardando fechamento");
    if (!alvo.length) { avisar("As faturas selecionadas não estão em aberto.", "err"); return false; }
    try {
      const pagas = [];
      for (const r of alvo) pagas.push(r, ...(r.agrupa || []).map((id) => dados.contas_receber.find((x) => x.id === id)).filter(Boolean));
      await salvarLote("contas_receber", pagas.map((r) => ({ ...r, status: r.status === "Agrupada" ? "Agrupada" : "Pago", pagoEm: janela.data, forma: janela.forma || forma(r), valorPago: r.valor, pagoNoGrupo: r.status === "Agrupada" || undefined })), { motivo: "Pagamento confirmado" });
      const ams = pagas.map((r) => r.amostraId && dados.amostras.find((x) => x.id === r.amostraId)).filter((a) => a && a.status === "Faturamento");
      if (ams.length) await salvarLote("amostras", ams.map((a) => ({ ...a, status: "Concluída" })), { motivo: "Fatura paga" });
      setSel(new Set());
      avisar(`${alvo.length} pagamento(s) confirmado(s).`, "ok");
    } catch (e) { avisar(e.message, "err"); return false; }
  };
  const agrupar = exigir(async (s) => {
    const ok = s.filter((r) => r.status === "Em aberto" && !r.agrupa?.length);
    if (ok.length < 2) { avisar("Selecione ao menos duas faturas em aberto.", "err"); return; }
    if (new Set(ok.map((r) => r.clienteId)).size > 1) { avisar("Só agrupa faturas do mesmo cliente.", "err"); return; }
    try {
      const venc = ok.map((r) => r.venc).sort().pop();
      const g = await salvar("contas_receber", { origem: "Agrupamento", clienteId: ok[0].clienteId, contratoId: ok[0].contratoId || null, contrato: [...new Set(ok.map((r) => r.contrato).filter(Boolean))].join(", "), os: [...new Set(ok.map((r) => r.os).filter(Boolean))].join(", "), descricao: `Agrupamento de ${ok.length} faturas`, valor: somar(ok, (r) => r.valor), venc, status: "Em aberto", agrupa: ok.map((r) => r.id), forma: forma(ok[0]) }, { numerar: true, motivo: `Agrupou ${ok.length} faturas` });
      await salvarLote("contas_receber", ok.map((r) => ({ ...r, status: "Agrupada", grupoId: g.id })), { motivo: `Agrupada em ${numeroFatura(g)}` });
      setSel(new Set()); avisar(`Faturas agrupadas em ${numeroFatura(g)}.`, "ok");
    } catch (e) { avisar(e.message, "err"); }
  });
  const desagrupar = exigir(async (s) => {
    const gs = s.filter((r) => r.agrupa?.length && r.status !== "Pago");
    if (!gs.length) { avisar("Selecione um agrupamento em aberto.", "err"); return; }
    try {
      for (const g of gs) {
        const filhas = g.agrupa.map((id) => dados.contas_receber.find((x) => x.id === id)).filter(Boolean);
        await salvarLote("contas_receber", filhas.map((r) => ({ ...r, status: "Em aberto", grupoId: null })), { motivo: `Desagrupada de ${numeroFatura(g)}` });
        await salvar("contas_receber", { ...g, status: "Cancelado", agrupa: [] }, { motivo: "Agrupamento desfeito" });
      }
      setSel(new Set()); avisar("Faturas desagrupadas.", "ok");
    } catch (e) { avisar(e.message, "err"); }
  });
  const exportar = (lista, nome) => { const url = URL.createObjectURL(new Blob([paraCSV(lista, colunas)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `${nome}-${isoDia(0)}.csv`; a.click(); URL.revokeObjectURL(url); };
  const boletim = (modo) => exigir((s) => { if (new Set(s.map((r) => r.clienteId)).size > 1) { avisar("Selecione faturas de um só cliente.", "err"); return; } navegar("boletim", `${modo ? `${modo}.` : ""}${s.map((r) => r.id).join(".")}`); });
  return (
    <Caixa titulo="Contas a Receber">
      <div className="kpis kpis-azul">
        {[["A RECEBER HOJE", abertas.filter((r) => r.venc === h)], ["EM ATRASO", abertas.filter((r) => r.venc && r.venc < h)], ["A RECEBER PRÓXIMOS 30 DIAS", abertas.filter((r) => r.venc > h && r.venc <= d30)], ["EM ATRASO 30 DIAS", abertas.filter((r) => r.venc && r.venc < m30)]].map(([t, l]) => <div key={t} className="kpi"><span>{t}</span><b>{valorBR(somar(l, (r) => r.valor))}</b></div>)}
      </div>
      <Grade key={chave} id="receber" exportar="contas-a-receber" linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel} ordemInicial={[0, "desc"]}
        opcoesFiltro={{ 1: [...STATUS_FATURA.map(rotuloStatus), ...(expandir ? ["Agrupada"] : [])], 3: [...new Set([...dados.formas_pagamento.map((x) => x.descricao), ...linhas.map(forma)].filter(Boolean))], 10: ["Faturamento", "Parcelado", "Concluída", "Laboratório", "Em coleta", "Aguardando agendamento", "Em Revisão", "Assinatura", "Cancelado"] }}
        aoAbrir={(r) => setJanela({ tipo: "ver", conta: { ...r } })}
        botoes={[
          { rotulo: "Selecionar todos", acao: () => setSel(new Set(linhas.map((r) => r.id))) },
          { rotulo: "Deselecionar todos", acao: () => setSel(new Set()) },
          { rotulo: "Documentos", menu: [
            { rotulo: "Boletim medição", acao: boletim("") },
            { rotulo: "Boletim medição Paramêtro", acao: boletim("param") },
            { rotulo: "Exportar tela para Excel", acao: () => exportar(linhas, "contas-a-receber") },
            { rotulo: "Exportar Selecionados Excel", acao: exigir((s) => exportar(s, "faturas-selecionadas")) },
          ] },
          { rotulo: "Agrupar Faturas", menu: [{ rotulo: "Agrupar faturas", acao: agrupar }, { rotulo: "Desagrupar faturas", acao: desagrupar }] },
          { rotulo: "Visualizar", acao: umaSo((r) => setJanela({ tipo: "ver", conta: { ...r } })) },
          { rotulo: "Status fatura", acao: exigir((s) => setJanela({ tipo: "status", contas: s, status: s[0].status === "Agrupada" ? "Em aberto" : s[0].status, motivo: "" })) },
          { rotulo: expandir ? "Recolher Faturas" : "Expandir Faturas", acao: () => { setExpandir((x) => !x); setSel(new Set()); } },
          { rotulo: "Confirmar Pagamento", acao: exigir((s) => setJanela({ tipo: "pagar", contas: s, data: hoje(), forma: "" })) },
          { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setChave((k) => k + 1); } },
        ]} />
      {janela?.tipo === "pagar" && (
        <Modal titulo="Confirmar pagamento" onFechar={() => setJanela(null)} rotuloOk="Confirmar" aoConfirmar={confirmar}>
          <p style={{ marginTop: 0 }}>{janela.contas.length} fatura(s) · {valorBR(somar(janela.contas, (r) => r.valor))}</p>
          <div className="fg"><label htmlFor="pgData">Data de pagamento</label><input id="pgData" type="date" value={janela.data} onChange={(e) => setJanela({ ...janela, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="pgForma">Forma de pagamento (se diferente da fatura)</label><select id="pgForma" value={janela.forma} onChange={(e) => setJanela({ ...janela, forma: e.target.value })}>{opcoes([["", "Manter a da fatura"], ...new Set([...dados.formas_pagamento.filter((x) => x.status !== "Inativo").map((x) => x.descricao), ...FORMAS])])}</select></div>
        </Modal>
      )}
      {janela?.tipo === "status" && (
        <Modal titulo="Status fatura" onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={async () => {
          const alvo = janela.contas.filter((r) => r.status !== "Pago" && r.status !== "Agrupada");
          if (!alvo.length) { avisar("Fatura paga ou agrupada não muda de status (desagrupe antes).", "err"); return false; }
          if (janela.status === "Pago") { avisar("Para marcar como paga use Confirmar Pagamento.", "err"); return false; }
          if (janela.status === "Cancelado" && !janela.motivo.trim()) { avisar("Informe o motivo do cancelamento.", "err"); return false; }
          try { await salvarLote("contas_receber", alvo.map((r) => ({ ...r, status: janela.status })), { motivo: `Status: ${rotuloStatus(janela.status)}${janela.motivo.trim() ? ` · ${janela.motivo.trim()}` : ""}` }); setSel(new Set()); avisar("Status alterado.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="stF">Status</label><select id="stF" value={janela.status} onChange={(e) => setJanela({ ...janela, status: e.target.value })}>{opcoes(STATUS_FATURA.filter((x) => x !== "Pago").map((x) => [x, rotuloStatus(x)]))}</select></div>
          <div className="fg"><label htmlFor="stM">Motivo</label><input id="stM" value={janela.motivo} onChange={(e) => setJanela({ ...janela, motivo: e.target.value })} /></div>
        </Modal>
      )}
      {janela?.tipo === "ver" && (() => { const r = janela.conta; const filhas = (r.agrupa || []).map((id) => dados.contas_receber.find((x) => x.id === id)).filter(Boolean); const pode = r.status === "Em aberto" || r.status === "Aguardando fechamento"; return (
        <Modal titulo={`Fatura ${numeroFatura(r)}`} largo onFechar={() => setJanela(null)} rotuloOk={pode ? "Salvar" : undefined} aoConfirmar={pode ? async () => {
          if (!r.venc) { avisar("Informe o vencimento.", "err"); return false; }
          try { await salvar("contas_receber", r, { motivo: "Fatura alterada" }); avisar("Fatura salva.", "ok"); } catch (e) { avisar(e.message, "err"); return false; }
        } : undefined}>
          <dl className="detail">
            <div><dt>Cliente</dt><dd>{cli(r).razao}</dd></div><div><dt>Status</dt><dd>{rotuloStatus(r.status)}</dd></div>
            <div><dt>Descrição</dt><dd>{r.descricao}</dd></div><div><dt>Total</dt><dd>{valorBR(r.valor)}</dd></div>
            <div><dt>Contrato</dt><dd>{r.contrato || "—"}</dd></div><div><dt>OS / Amostra</dt><dd>{[r.os, r.referencia].filter(Boolean).join(" · ") || "—"}</dd></div>
            {r.pagoEm && <div><dt>Pago em</dt><dd>{dataBR(r.pagoEm)}</dd></div>}
          </dl>
          {pode && <div className="frm">
            <div className="fg s4"><label htmlFor="vVenc">Data de Vencimento</label><input id="vVenc" type="date" value={r.venc || ""} onChange={(e) => setJanela({ ...janela, conta: { ...r, venc: e.target.value } })} /></div>
            <div className="fg s4"><label htmlFor="vForma">Forma pagamento</label><input id="vForma" list="formas-cr" value={r.forma || forma(r)} onChange={(e) => setJanela({ ...janela, conta: { ...r, forma: e.target.value } })} /><datalist id="formas-cr">{dados.formas_pagamento.map((x) => <option key={x.id} value={x.descricao} />)}</datalist></div>
            <div className="fg s12"><label htmlFor="vObs">Obs</label><input id="vObs" value={r.obs || ""} onChange={(e) => setJanela({ ...janela, conta: { ...r, obs: e.target.value } })} /></div>
          </div>}
          {filhas.length > 0 && <div className="tw"><table><thead><tr><th>Fatura</th><th>Descrição</th><th>OS</th><th>Amostra</th><th>Vencimento</th><th>Valor</th></tr></thead>
            <tbody>{filhas.map((x) => <tr key={x.id}><td>{numeroFatura(x)}</td><td>{x.descricao}</td><td>{x.os}</td><td>{x.referencia}</td><td>{dataBR(x.venc)}</td><td>{valorBR(x.valor)}</td></tr>)}</tbody></table></div>}
        </Modal>
      ); })()}
    </Caixa>
  );
}

export function BoletimMedicao({ param }) {
  const { dados } = useDados();
  const partes = String(param || "").split(".").filter(Boolean);
  const porParametro = partes[0] === "param";
  if (porParametro) partes.shift();
  const contas = partes.map((id) => dados.contas_receber.find((r) => r.id === id)).filter(Boolean)
    .flatMap((r) => (r.agrupa?.length ? r.agrupa.map((id) => dados.contas_receber.find((x) => x.id === id)).filter(Boolean) : [r]));
  const cli = dados.clientes.find((c) => c.id === contas[0]?.clienteId) || {};
  const linhasParam = porParametro ? contas.flatMap((r) => {
    const a = dados.amostras.find((x) => x.id === r.amostraId);
    const sv = dados.contratos.find((c) => c.id === r.contratoId)?.servicos?.find((s) => s.sid === a?.sid);
    return a && sv ? a.analises.map((x) => ({ r, a, nome: x.nome, preco: Number(sv.params.find((p) => p.id === x.pid)?.preco) || 0 })) : [{ r, a: null, nome: r.descricao, preco: Number(r.valor) || 0 }];
  }) : [];
  return (
    <>
      <div className="box nao-imprimir"><div className="box-head-row"><h2 className="box-title">Boletim de Medição{porParametro ? " por parâmetro" : ""}</h2><div className="acoes"><button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir / PDF</button><button type="button" className="btn btn-default" onClick={() => window.history.back()}>Voltar</button></div></div></div>
      <div className="doc">
        <div className="doc-topo"><b>Boletim de Medição{porParametro ? " por parâmetro" : ""}</b><span>{cli.razao}{cli.doc ? ` · ${cli.doc}` : ""}</span><span>{dataBR(isoDia(0))}</span></div>
        {porParametro ? (
          <table className="doc-tab"><thead><tr><th>Fatura</th><th>OS</th><th>Amostra</th><th>Identificação</th><th>Parâmetro</th><th>Valor</th></tr></thead>
            <tbody>{linhasParam.map((l, k) => <tr key={k}><td>{numeroFatura(l.r)}</td><td>{l.r.os}</td><td>{l.r.referencia}</td><td>{l.a?.identificacao || ""}</td><td>{l.nome}</td><td>{valorBR(l.preco)}</td></tr>)}
              <tr><th colSpan={5} style={{ textAlign: "right" }}>Total</th><th>{valorBR(somar(contas, (r) => r.valor))}</th></tr></tbody></table>
        ) : (
          <table className="doc-tab"><thead><tr><th>Fatura</th><th>Descrição</th><th>OS</th><th>Amostra</th><th>Vencimento</th><th>Status</th><th>Valor</th></tr></thead>
            <tbody>{contas.map((r) => <tr key={r.id}><td>{numeroFatura(r)}</td><td>{r.descricao}</td><td>{r.os}</td><td>{r.referencia}</td><td>{dataBR(r.venc)}</td><td>{rotuloStatus(r.status === "Agrupada" ? "Em aberto" : r.status)}</td><td>{valorBR(r.valor)}</td></tr>)}
              <tr><th colSpan={6} style={{ textAlign: "right" }}>Total</th><th>{valorBR(somar(contas, (r) => r.valor))}</th></tr></tbody></table>
        )}
      </div>
    </>
  );
}

export { somar, Kpis, valorBR };
