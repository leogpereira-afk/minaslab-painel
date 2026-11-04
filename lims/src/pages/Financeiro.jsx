// Menu Financeiro, fiel ao GerenciaLab:
//  - Contas a receber: parcelas de contrato e faturas por amostra (geradas na
//    emissão do certificado); confirmar pagamento, alterar, cancelar.
//  - Contas a pagar: despesas com parcelas/recorrência.
//  - Fluxo de Caixa: entradas e saídas no período, previsto e realizado.
//  - Notas fiscais de Serviços: registro da NFS-e de cada fatura.
// Na integração, estes lançamentos alimentam o Finanças do painel.

import { useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { navegar } from "../lib/rota.js";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { estaAtivo } from "../lib/cadastros.js";
import { fluxoCaixa, numero } from "../lib/laboratorio.js";
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

/* ---------- Contas a pagar ---------- */

const CATEGORIAS_DESPESA = ["Insumos e reagentes", "Calibração e manutenção", "Subcontratação", "Pessoal", "Impostos", "Aluguel e utilidades", "Logística e coleta", "Software e serviços", "Outras despesas"];

export function ContasPagar() {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [janela, setJanela] = useState(null);
  const [sel, setSel] = useState(new Set());
  const linhas = dados.contas_pagar;
  const st = (r) => (r.statusPagamento === "Pago" ? "Pago" : r.vencimento < hoje() ? "Vencido" : "Em aberto");
  const colunas = [
    { t: "ID", v: (r) => Number(r.cod) || 0 },
    { t: "titulo", v: (r) => r.nome + (r.parcelaDe > 1 ? ` (${r.parcela}/${r.parcelaDe})` : ""), filtro: true },
    { t: "Fornecedor", v: (r) => dados.clientes.find((c) => c.id === r.fornecedor)?.razao || "", filtro: true },
    { t: "Data de Vencimento", v: (r) => r.vencimento || "", h: (r) => dataBR(r.vencimento), fv: (r) => dataBR(r.vencimento), filtro: true },
    { t: "Data de Pagamento", v: (r) => r.dataPagamento || "", h: (r) => dataBR(r.dataPagamento), fv: (r) => dataBR(r.dataPagamento), filtro: true },
    { t: "Categoria", v: (r) => r.categoria || "", filtro: "lista" },
    { t: "Centro de custo", v: (r) => dados.centros_custo.find((c) => c.id === r.centroCusto)?.nome || "", filtro: true },
    { t: "Valor", v: (r) => Number(r.valor) || 0, h: (r) => valorBR(r.valor), fv: (r) => valorBR(r.valor) },
    { t: "Status", v: st, h: (r) => <span className={`lbl ${corConta[st(r)]}`}>{st(r)}</span>, filtro: "lista" },
  ];
  const nova = () => ({ nome: "", fornecedor: "", conta: "", categoria: CATEGORIAS_DESPESA[0], centroCusto: "", vencimento: isoDia(0), valor: "", documento: "", ocorrencia: "Única", parcelas: 1, obs: "", valorPago: "", dataPagamento: "", statusPagamento: "Em aberto" });
  const set = (k, v) => setJanela((j) => ({ ...j, [k]: v }));
  const gravar = async () => {
    const j = janela;
    if (!j.nome.trim() || !(numero(j.valor) > 0) || !j.vencimento) { avisar("Informe nome, valor e vencimento.", "err"); return false; }
    try {
      if (j.id) { await salvar("contas_pagar", { ...j, valor: numero(j.valor), valorPago: numero(j.valorPago) ?? "" }); avisar("Despesa alterada.", "ok"); return; }
      const n = j.ocorrencia === "Única" ? 1 : Math.min(Math.max(1, Number(j.parcelas) || 1), 120);
      const passo = { Única: 0, Mensal: 1, Trimestral: 3, Anual: 12 }[j.ocorrencia] || 1;
      const [a, m, d] = j.vencimento.split("-").map(Number);
      for (let i = 0; i < n; i++) {
        const dt = new Date(Date.UTC(a, m - 1 + i * passo, 1));
        const ult = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
        dt.setUTCDate(Math.min(d, ult));
        await salvar("contas_pagar", { ...j, valor: numero(j.valor), valorPago: numero(j.valorPago) ?? "", vencimento: dt.toISOString().slice(0, 10), parcela: i + 1, parcelaDe: n }, { numerar: true });
      }
      avisar(n > 1 ? `${n} lançamentos criados.` : "Despesa criada.", "ok");
    } catch (e) { avisar(e.message, "err"); return false; }
  };
  return (
    <>
      <Kpis itens={[["A pagar (em aberto)", valorBR(somar(linhas.filter((r) => r.statusPagamento !== "Pago"), (r) => r.valor))], ["Vencido", valorBR(somar(linhas.filter((r) => r.statusPagamento !== "Pago" && r.vencimento < hoje()), (r) => r.valor)), "ruim"], ["Pago no mês", valorBR(somar(linhas.filter((r) => r.statusPagamento === "Pago" && (r.dataPagamento || "").startsWith(hoje().slice(0, 7))), (r) => r.valorPago || r.valor))]]} />
      <Caixa titulo="Contas a Pagar">
        <Grade id="pagar" exportar="contas-a-pagar" linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel} ordemInicial={[3, "asc"]}
          opcoesFiltro={{ 5: CATEGORIAS_DESPESA, 8: ["Em aberto", "Vencido", "Pago"] }} aoAbrir={(r) => setJanela({ ...r, valor: String(r.valor).replace(".", ","), valorPago: r.valorPago === "" || r.valorPago == null ? "" : String(r.valorPago).replace(".", ",") })}
          botoes={[
            { rotulo: "Adicionar despesa", acao: () => setJanela(nova()) },
            { rotulo: "Confirmar pagamento", acao: async () => {
              const s = linhas.filter((r) => sel.has(r.id) && r.statusPagamento !== "Pago");
              if (!s.length) { avisar("Selecione despesas em aberto.", "err"); return; }
              try { for (const r of s) await salvar("contas_pagar", { ...r, statusPagamento: "Pago", dataPagamento: hoje(), valorPago: r.valorPago || r.valor }, { motivo: "Pagamento confirmado" }); setSel(new Set()); avisar(`${s.length} pagamento(s) confirmado(s) com data de hoje.`, "ok"); } catch (e) { avisar(e.message, "err"); }
            } },
          ]} />
      </Caixa>
      {janela && (
        <Modal titulo={janela.id ? "Editar despesa" : "Adicionar despesa"} largo onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={gravar}>
          <div className="frm">
            <div className="fg s6"><label htmlFor="dpNome">Nome da despesa</label><input id="dpNome" value={janela.nome} onChange={(e) => set("nome", e.target.value)} /></div>
            <div className="fg s6"><label htmlFor="dpForn">Fornecedor</label><select id="dpForn" value={janela.fornecedor} onChange={(e) => set("fornecedor", e.target.value)}>{opcoes([["", "—"], ...dados.clientes.map((c) => [c.id, c.razao])])}</select></div>
            <div className="fg s4"><label htmlFor="dpConta">Conta bancária</label><input id="dpConta" value={janela.conta} onChange={(e) => set("conta", e.target.value)} /></div>
            <div className="fg s4"><label htmlFor="dpCat">Categoria</label><select id="dpCat" value={janela.categoria} onChange={(e) => set("categoria", e.target.value)}>{opcoes(CATEGORIAS_DESPESA)}</select></div>
            <div className="fg s4"><label htmlFor="dpCC">Centro de custo</label><select id="dpCC" value={janela.centroCusto} onChange={(e) => set("centroCusto", e.target.value)}>{opcoes([["", "—"], ...dados.centros_custo.map((c) => [c.id, c.nome])])}</select></div>
            <div className="fg s3"><label htmlFor="dpVenc">Vencimento</label><input id="dpVenc" type="date" value={janela.vencimento} onChange={(e) => set("vencimento", e.target.value)} /></div>
            <div className="fg s3"><label htmlFor="dpValor">Valor da parcela</label><input id="dpValor" inputMode="decimal" value={janela.valor} onChange={(e) => set("valor", e.target.value)} /></div>
            <div className="fg s3"><label htmlFor="dpDoc">nº do documento</label><input id="dpDoc" value={janela.documento} onChange={(e) => set("documento", e.target.value)} /></div>
            {!janela.id && <><div className="fg s3"><label htmlFor="dpOc">Ocorrência</label><select id="dpOc" value={janela.ocorrencia} onChange={(e) => set("ocorrencia", e.target.value)}>{opcoes(["Única", "Mensal", "Trimestral", "Anual"])}</select></div>
              {janela.ocorrencia !== "Única" && <div className="fg s3"><label htmlFor="dpParc">Quantidade de Parcelas</label><input id="dpParc" type="number" min="1" max="120" value={janela.parcelas} onChange={(e) => set("parcelas", e.target.value)} /></div>}</>}
            <div className="fg s12"><label htmlFor="dpObs">Observações</label><input id="dpObs" value={janela.obs} onChange={(e) => set("obs", e.target.value)} /></div>
            <div className="fg s3"><label htmlFor="dpStatus">Status pagamento</label><select id="dpStatus" value={janela.statusPagamento} onChange={(e) => set("statusPagamento", e.target.value)}>{opcoes(["Em aberto", "Pago"])}</select></div>
            <div className="fg s3"><label htmlFor="dpPago">Valor pago</label><input id="dpPago" inputMode="decimal" value={janela.valorPago} onChange={(e) => set("valorPago", e.target.value)} /></div>
            <div className="fg s3"><label htmlFor="dpDataPg">Data de pagamento</label><input id="dpDataPg" type="date" value={janela.dataPagamento} onChange={(e) => set("dataPagamento", e.target.value)} /></div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------- Fluxo de caixa ---------- */

export function FluxoCaixa() {
  const { dados } = useDados();
  const [de, setDe] = useState(() => `${hoje().slice(0, 7)}-01`);
  const [ate, setAte] = useState(() => { const d = new Date(); return isoDia(0, new Date(d.getFullYear(), d.getMonth() + 1, 0)); });
  const f = useMemo(() => fluxoCaixa(dados.contas_receber.filter((r) => r.status !== "Cancelado"), dados.contas_pagar, de, ate), [dados.contas_receber, dados.contas_pagar, de, ate]);
  const colunas = [
    { t: "Data de vencimento", v: (r) => r.data, h: (r) => dataBR(r.data), fv: (r) => dataBR(r.data) },
    { t: "Descrição", v: (r) => r.descricao },
    { t: "Lançamento", v: (r) => r.valor, h: (r) => <span style={{ color: r.valor < 0 ? "#b91c1c" : "#047857" }}>{valorBR(r.valor)}</span>, fv: (r) => valorBR(r.valor) },
    { t: "Categoria", v: (r) => r.categoria },
    { t: "Status", v: (r) => r.status },
  ];
  return (
    <>
      <Kpis itens={[["Entradas", valorBR(f.entradas), "bom"], ["Saídas", valorBR(f.saidas), "ruim"], ["Saldo realizado", valorBR(f.realizado)], ["Saldo previsto", valorBR(f.previsto)]]} />
      <Caixa titulo="Fluxo de Caixa">
        <div className="frm" style={{ marginBottom: 10 }}>
          <div className="fg s3"><label htmlFor="fxDe">Data inicial</label><input id="fxDe" type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div className="fg s3"><label htmlFor="fxAte">Data final</label><input id="fxAte" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        </div>
        <Grade key={`${de}${ate}`} id="fluxo" exportar="fluxo-de-caixa" linhas={f.linhas} colunas={colunas} ordemInicial={[0, "asc"]} botoes={[]} />
      </Caixa>
    </>
  );
}

/* ---------- Notas fiscais de serviços ---------- */

export function NotasServico() {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [janela, setJanela] = useState(null);
  const linhas = dados.contas_receber.filter((r) => r.status !== "Cancelado");
  const empresas = dados.config_nfs.filter(estaAtivo);
  const colunas = [
    { t: "Fatura", v: (r) => Number(r.cod) || 0 },
    { t: "Cliente", v: (r) => dados.clientes.find((c) => c.id === r.clienteId)?.razao || "", filtro: true },
    { t: "Descrição", v: (r) => r.descricao || "", filtro: true },
    { t: "Valor", v: (r) => Number(r.valor) || 0, h: (r) => valorBR(r.valor), fv: (r) => valorBR(r.valor) },
    { t: "Vencimento", v: (r) => r.venc || "", h: (r) => dataBR(r.venc) },
    { t: "Status NF", v: (r) => (r.nf?.numero ? "Emitida" : "Pendente"), h: (r) => <span className={`lbl ${r.nf?.numero ? "ok" : "warn"}`}>{r.nf?.numero ? "Emitida" : "Pendente"}</span>, filtro: "lista" },
    { t: "Número NF", v: (r) => r.nf?.numero || "", filtro: true },
    { t: "Emissão NF", v: (r) => r.nf?.data || "", h: (r) => dataBR(r.nf?.data) },
    { t: "Empresa emissora", v: (r) => empresas.find((e) => e.id === r.nf?.empresa)?.empresa || "", filtro: true },
  ];
  return (
    <Caixa titulo="Nota Fiscal">
      <p className="suave" style={{ marginTop: -6 }}>Registro das NFS-e emitidas por fatura. A emissão automática entra na integração com o Finanças do painel (dados da empresa em Configurações → Configuração NFs).</p>
      <Grade id="nfs" exportar="notas-fiscais" linhas={linhas} colunas={colunas} filtrosColuna selecao={sel} aoSelecionar={setSel} opcoesFiltro={{ 5: ["Pendente", "Emitida"] }}
        aoAbrir={(r) => setJanela({ conta: r, numero: r.nf?.numero || "", data: r.nf?.data || hoje(), empresa: r.nf?.empresa || empresas[0]?.id || "", obs: r.nf?.obs || "" })}
        botoes={[{ rotulo: "Registrar NF emitida", acao: () => { const r = linhas.find((x) => sel.has(x.id)); if (!r) { avisar("Selecione uma fatura.", "err"); return; } setJanela({ conta: r, numero: r.nf?.numero || "", data: r.nf?.data || hoje(), empresa: r.nf?.empresa || empresas[0]?.id || "", obs: r.nf?.obs || "" }); } }]} />
      {janela && (
        <Modal titulo={`NF da fatura ${janela.conta.cod}`} onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={async () => {
          if (!janela.numero.trim()) { avisar("Informe o número da NF.", "err"); return false; }
          try { const { conta, ...nf } = janela; await salvar("contas_receber", { ...conta, nf: { ...nf, numero: nf.numero.trim() } }, { motivo: "NF registrada" }); avisar("NF registrada.", "ok"); } catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="nfNum">Número da NF</label><input id="nfNum" value={janela.numero} onChange={(e) => setJanela({ ...janela, numero: e.target.value })} /></div>
          <div className="fg"><label htmlFor="nfData">Data de emissão</label><input id="nfData" type="date" value={janela.data} onChange={(e) => setJanela({ ...janela, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="nfEmp">Empresa emissora</label><select id="nfEmp" value={janela.empresa} onChange={(e) => setJanela({ ...janela, empresa: e.target.value })}>{opcoes([["", "—"], ...empresas.map((e) => [e.id, e.empresa])])}</select></div>
          <div className="fg"><label htmlFor="nfObs">Observação</label><input id="nfObs" value={janela.obs} onChange={(e) => setJanela({ ...janela, obs: e.target.value })} /></div>
        </Modal>
      )}
    </Caixa>
  );
}

export { somar, Kpis, valorBR };
