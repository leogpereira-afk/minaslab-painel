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

const FORMAS = ["Boleto", "Pix", "Transferência", "Cartão", "Dinheiro", "Depósito"];
const hoje = () => isoDia(0);
export const statusConta = (r) => (r.status === "Em aberto" && r.venc && r.venc < hoje() ? "Vencido" : r.status);
const corConta = { "Em aberto": "warn", Vencido: "crit", Pago: "ok", Cancelado: "off" };
const valorBR = (v) => brl(v);
const somar = (l, f) => Math.round(l.reduce((s, r) => s + (Number(f(r)) || 0), 0) * 100) / 100;

function Kpis({ itens }) {
  return <div className="kpis">{itens.map(([t, v, c]) => <div key={t} className={`kpi ${c || ""}`}><span>{t}</span><b>{v}</b></div>)}</div>;
}

/* ---------- Contas a receber ---------- */

export function ContasReceber() {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [janela, setJanela] = useState(null);
  const cli = (r) => dados.clientes.find((c) => c.id === r.clienteId) || {};
  const linhas = dados.contas_receber;
  const colunas = [
    { t: "Id", v: (r) => Number(r.cod) || 0 },
    { t: "Fatura", v: (r) => r.descricao || "", filtro: true },
    { t: "Cliente", v: (r) => cli(r).razao || "", filtro: true },
    { t: "CNPJ/CPF", v: (r) => cli(r).doc || "", filtro: true },
    { t: "Contrato", v: (r) => r.contrato || "", filtro: true },
    { t: "Amostra Referência", v: (r) => r.referencia || "", filtro: true },
    { t: "Ordem de Serviço", v: (r) => r.os || "", filtro: true },
    { t: "Data de Vencimento", v: (r) => r.venc || "", h: (r) => dataBR(r.venc), fv: (r) => dataBR(r.venc), filtro: true },
    { t: "Data de Pagamento", v: (r) => r.pagoEm || "", h: (r) => dataBR(r.pagoEm), fv: (r) => dataBR(r.pagoEm), filtro: true },
    { t: "Total", v: (r) => Number(r.valor) || 0, h: (r) => valorBR(r.valor), fv: (r) => valorBR(r.valor) },
    { t: "Obs", v: (r) => r.obs || "", filtro: true },
    { t: "Status", v: statusConta, h: (r) => <span className={`lbl ${corConta[statusConta(r)]}`}>{statusConta(r)}</span>, filtro: "lista" },
    { t: "Forma pagamento", v: (r) => r.forma || "", filtro: "lista" },
    { t: "NF", v: (r) => r.nf?.numero || "", filtro: true },
  ];
  const abertas = linhas.filter((r) => r.status === "Em aberto");
  const selecionadas = linhas.filter((r) => sel.has(r.id));
  const exigir = (fn) => () => (selecionadas.length ? fn(selecionadas) : avisar("Selecione ao menos uma fatura.", "err"));
  const confirmar = async () => {
    const alvo = janela.contas.filter((r) => r.status === "Em aberto");
    if (!alvo.length) { avisar("As faturas selecionadas não estão em aberto.", "err"); return false; }
    try {
      for (const r of alvo) {
        await salvar("contas_receber", { ...r, status: "Pago", pagoEm: janela.data, forma: janela.forma, valorPago: alvo.length === 1 && janela.valor !== "" ? numero(janela.valor) ?? r.valor : r.valor }, { motivo: "Pagamento confirmado" });
        const a = r.amostraId && dados.amostras.find((x) => x.id === r.amostraId);
        if (a && a.status === "Faturamento") await salvar("amostras", { ...a, status: "Concluída" }, { motivo: "Fatura paga" });
      }
      setSel(new Set());
      avisar(`${alvo.length} pagamento(s) confirmado(s).`, "ok");
    } catch (e) { avisar(e.message, "err"); return false; }
  };
  return (
    <>
      <Kpis itens={[["Em aberto", valorBR(somar(abertas, (r) => r.valor))], ["Vencido", valorBR(somar(abertas.filter((r) => r.venc < hoje()), (r) => r.valor)), "ruim"], [`Recebido em ${new Date().toLocaleDateString("pt-BR", { month: "long" })}`, valorBR(somar(linhas.filter((r) => r.status === "Pago" && (r.pagoEm || "").startsWith(hoje().slice(0, 7))), (r) => r.valorPago ?? r.valor)), "bom"]]} />
      <Caixa titulo="Contas a Receber">
        <Grade id="receber" exportar="contas-a-receber" linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel} ordemInicial={[7, "asc"]}
          opcoesFiltro={{ 11: ["Em aberto", "Vencido", "Pago", "Cancelado"], 12: FORMAS }} aoAbrir={(r) => setJanela({ tipo: "alterar", conta: { ...r } })}
          botoes={[
            { rotulo: "Confirmar pagamento", acao: exigir((s) => setJanela({ tipo: "pagar", contas: s, data: hoje(), forma: "Boleto", valor: s.length === 1 ? String(s[0].valor) : "" })) },
            { rotulo: "Alterar", acao: exigir((s) => setJanela({ tipo: "alterar", conta: { ...s[0] } })) },
            { rotulo: "Nova fatura avulsa", acao: () => setJanela({ tipo: "alterar", conta: { descricao: "", clienteId: "", valor: "", venc: isoDia(30), status: "Em aberto", origem: "Avulsa", obs: "" } }) },
            { rotulo: "Boletim de Medição", acao: exigir((s) => { const c = new Set(s.map((r) => r.clienteId)); if (c.size > 1) { avisar("Selecione faturas de um só cliente.", "err"); return; } navegar("boletim", s.map((r) => r.id).join(".")); }) },
          ]} />
      </Caixa>
      {janela?.tipo === "pagar" && (
        <Modal titulo={`Confirmar pagamento · ${janela.contas.length} fatura(s) · ${valorBR(somar(janela.contas, (r) => r.valor))}`} onFechar={() => setJanela(null)} rotuloOk="Confirmar pagamento" aoConfirmar={confirmar}>
          <div className="fg"><label htmlFor="pgData">Data de pagamento</label><input id="pgData" type="date" value={janela.data} onChange={(e) => setJanela({ ...janela, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="pgForma">Forma de pagamento</label><select id="pgForma" value={janela.forma} onChange={(e) => setJanela({ ...janela, forma: e.target.value })}>{opcoes(FORMAS)}</select></div>
          {janela.contas.length === 1 && <div className="fg"><label htmlFor="pgValor">Valor pago</label><input id="pgValor" inputMode="decimal" value={janela.valor} onChange={(e) => setJanela({ ...janela, valor: e.target.value })} /></div>}
        </Modal>
      )}
      {janela?.tipo === "alterar" && (
        <Modal titulo={janela.conta.id ? `Alterar fatura ${janela.conta.cod || ""}` : "Nova fatura avulsa"} onFechar={() => setJanela(null)} rotuloOk="Salvar"
          extra={janela.conta.id && janela.conta.status === "Em aberto" ? <button type="button" className="btn btn-danger" onClick={() => setJanela({ tipo: "cancelar", conta: janela.conta, motivo: "" })}>Cancelar fatura</button> : null}
          aoConfirmar={async () => {
            const c = janela.conta;
            if (!c.clienteId || !(numero(c.valor) > 0) || !c.venc) { avisar("Informe cliente, valor e vencimento.", "err"); return false; }
            if (c.status === "Pago") { avisar("Fatura paga não pode ser alterada.", "err"); return false; }
            try { await salvar("contas_receber", { ...c, valor: numero(c.valor) }, { numerar: !c.id, motivo: c.id ? "Fatura alterada" : "Fatura avulsa" }); avisar("Fatura salva.", "ok"); } catch (e) { avisar(e.message, "err"); return false; }
          }}>
          <div className="fg"><label htmlFor="fCli">Cliente</label><select id="fCli" disabled={!!janela.conta.id} value={janela.conta.clienteId} onChange={(e) => setJanela({ ...janela, conta: { ...janela.conta, clienteId: e.target.value } })}>{opcoes([["", "Selecione"], ...dados.clientes.map((c) => [c.id, c.razao])])}</select></div>
          <div className="fg"><label htmlFor="fDesc">Descrição</label><input id="fDesc" value={janela.conta.descricao} onChange={(e) => setJanela({ ...janela, conta: { ...janela.conta, descricao: e.target.value } })} /></div>
          <div className="fg"><label htmlFor="fValor">Valor (R$)</label><input id="fValor" inputMode="decimal" value={String(janela.conta.valor ?? "").replace(".", ",")} onChange={(e) => setJanela({ ...janela, conta: { ...janela.conta, valor: e.target.value } })} /></div>
          <div className="fg"><label htmlFor="fVenc">Vencimento</label><input id="fVenc" type="date" value={janela.conta.venc} onChange={(e) => setJanela({ ...janela, conta: { ...janela.conta, venc: e.target.value } })} /></div>
          <div className="fg"><label htmlFor="fObs">Obs</label><input id="fObs" value={janela.conta.obs || ""} onChange={(e) => setJanela({ ...janela, conta: { ...janela.conta, obs: e.target.value } })} /></div>
        </Modal>
      )}
      {janela?.tipo === "cancelar" && (
        <Modal titulo="Cancelar fatura" onFechar={() => setJanela(null)} rotuloOk="Cancelar fatura" aoConfirmar={async () => {
          if (!janela.motivo.trim()) { avisar("Informe o motivo.", "err"); return false; }
          try { await salvar("contas_receber", { ...janela.conta, status: "Cancelado" }, { motivo: janela.motivo.trim() }); avisar("Fatura cancelada.", "ok"); } catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="cMot">Motivo</label><input id="cMot" value={janela.motivo} onChange={(e) => setJanela({ ...janela, motivo: e.target.value })} /></div>
        </Modal>
      )}
    </>
  );
}

export function BoletimMedicao({ param }) {
  const { dados } = useDados();
  const contas = String(param || "").split(".").map((id) => dados.contas_receber.find((r) => r.id === id)).filter(Boolean);
  const cli = dados.clientes.find((c) => c.id === contas[0]?.clienteId) || {};
  return (
    <>
      <div className="box nao-imprimir"><div className="box-head-row"><h2 className="box-title">Boletim de Medição</h2><div className="acoes"><button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir</button><button type="button" className="btn btn-default" onClick={() => window.history.back()}>Voltar</button></div></div></div>
      <div className="doc">
        <div className="doc-topo"><b>Boletim de Medição</b><span>{cli.razao}{cli.doc ? ` · ${cli.doc}` : ""}</span><span>{dataBR(isoDia(0))}</span></div>
        <table className="doc-tab"><thead><tr><th>Fatura</th><th>Descrição</th><th>OS</th><th>Amostra</th><th>Vencimento</th><th>Status</th><th>Valor</th></tr></thead>
          <tbody>{contas.map((r) => <tr key={r.id}><td>{r.cod}</td><td>{r.descricao}</td><td>{r.os}</td><td>{r.referencia}</td><td>{dataBR(r.venc)}</td><td>{statusConta(r)}</td><td>{valorBR(r.valor)}</td></tr>)}
            <tr><th colSpan={6} style={{ textAlign: "right" }}>Total</th><th>{valorBR(somar(contas, (r) => r.valor))}</th></tr></tbody></table>
      </div>
    </>
  );
}

export { somar, Kpis, valorBR };
