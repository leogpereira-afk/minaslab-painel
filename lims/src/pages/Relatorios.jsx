// Menu Relatórios, fiel ao GerenciaLab: Relatórios de amostras (por amostra
// ou por parâmetro, com filtros), Relatório de Centro de Custos e Dashboard
// Financeiro. Tudo exporta em planilha (Criar Excel).

import { useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { referenciaAmostra, STATUS_AMOSTRA, statusDaOS } from "../lib/ordens.js";
import { resultadoExibido, parecer, limiteDe } from "../lib/laboratorio.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, opcoes } from "../components/ui.jsx";
import { quandoBR } from "./Coletas.jsx";
import { statusConta } from "./Financeiro.jsx";

const TIPOS_DATA = [["dataColeta", "Data da coleta"], ["dataEntrada", "Data de entrada"], ["dataAssinatura", "Data de assinatura"]];

export function RelatorioAmostras() {
  const { dados } = useDados();
  const [f, setF] = useState({ solicitante: "", cliente: "", statusOS: "", statusAmostra: "", grupo: "", matriz: "", parametro: "", tipoData: "dataColeta", de: `${isoDia(0).slice(0, 4)}-01-01`, ate: `${isoDia(0).slice(0, 4)}-12-31`, tipo: "Por amostra" });
  const [gerado, setGerado] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const osDe = useMemo(() => Object.fromEntries(dados.ordens.map((o) => [o.id, o])), [dados.ordens]);
  const statusOS = useMemo(() => { const p = {}; for (const a of dados.amostras) (p[a.osId] ||= []).push(a); return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, statusDaOS(v)])); }, [dados.amostras]);
  const gerar = () => {
    const am = dados.amostras.filter((a) => {
      const d = String(a[f.tipoData] || "").slice(0, 10);
      return (!f.cliente || a.clienteId === f.cliente) && (!f.solicitante || osDe[a.osId]?.solicitanteId === f.solicitante)
        && (!f.statusAmostra || a.status === f.statusAmostra) && (!f.statusOS || statusOS[a.osId] === f.statusOS)
        && (!f.grupo || a.servico === f.grupo) && (!f.matriz || a.matriz === f.matriz)
        && (!f.parametro || a.analises.some((x) => x.pid === f.parametro))
        && (!f.de || (d && d >= f.de)) && (!f.ate || (d && d <= f.ate));
    });
    setGerado({ tipo: f.tipo, linhas: f.tipo === "Por amostra" ? am : am.flatMap((a) => a.analises.filter((x) => !f.parametro || x.pid === f.parametro).map((x) => ({ id: `${a.id}|${x.pid}`, a, x }))) });
  };
  const cli = (id) => dados.clientes.find((c) => c.id === id)?.razao || "";
  const colAmostra = [
    { t: "Referência", v: (r) => referenciaAmostra(r) }, { t: "Código barra", v: (r) => r.barra }, { t: "OS", v: (r) => r.os }, { t: "Cliente", v: (r) => cli(r.clienteId) },
    { t: "Serviço", v: (r) => r.servico }, { t: "Matriz", v: (r) => r.matriz || "" }, { t: "Identificação", v: (r) => r.identificacao || "" }, { t: "Status", v: (r) => r.status },
    { t: "Coleta", v: (r) => r.dataColeta || "", h: (r) => quandoBR(r.dataColeta), fv: (r) => quandoBR(r.dataColeta) }, { t: "Entrada", v: (r) => r.dataEntrada || "", h: (r) => quandoBR(r.dataEntrada), fv: (r) => quandoBR(r.dataEntrada) },
    { t: "Assinatura", v: (r) => r.dataAssinatura || "", h: (r) => quandoBR(r.dataAssinatura), fv: (r) => quandoBR(r.dataAssinatura) },
    { t: "Não conformes", v: (r) => r.analises.filter((x) => parecer(x.resultado, limiteDe(dados, r, x.pid), x.lq) === "Não conforme").length },
  ];
  const colParam = [
    { t: "Referência", v: (r) => referenciaAmostra(r.a) }, { t: "OS", v: (r) => r.a.os }, { t: "Cliente", v: (r) => cli(r.a.clienteId) }, { t: "Matriz", v: (r) => r.a.matriz || r.a.servico },
    { t: "Identificação", v: (r) => r.a.identificacao || "" }, { t: "Coleta", v: (r) => r.a.dataColeta || "", h: (r) => quandoBR(r.a.dataColeta), fv: (r) => quandoBR(r.a.dataColeta) },
    { t: "Parâmetro", v: (r) => r.x.nome }, { t: "Resultado", v: (r) => resultadoExibido(r.x.resultado, { lq: r.x.lq }) }, { t: "Unidade", v: (r) => r.x.un || "" },
    { t: "Parecer", v: (r) => parecer(r.x.resultado, limiteDe(dados, r.a, r.x.pid), r.x.lq) }, { t: "Método", v: (r) => r.x.metodo || "" }, { t: "Etapa", v: (r) => r.x.etapa },
  ];
  const grupos = [...new Set(dados.amostras.map((a) => a.servico))].sort();
  const matrizes = [...new Set(dados.amostras.map((a) => a.matriz).filter(Boolean))].sort();
  return (
    <>
      <Caixa titulo="Relatórios de amostras">
        <div className="frm">
          <div className="fg s4"><label htmlFor="raSol">Solicitante</label><select id="raSol" value={f.solicitante} onChange={(e) => set("solicitante", e.target.value)}>{opcoes([["", "Todos"], ...dados.solicitantes.map((s) => [s.id, s.nome])])}</select></div>
          <div className="fg s4"><label htmlFor="raCli">Cliente</label><select id="raCli" value={f.cliente} onChange={(e) => set("cliente", e.target.value)}>{opcoes([["", "Todos"], ...dados.clientes.map((c) => [c.id, c.razao])])}</select></div>
          <div className="fg s2"><label htmlFor="raSOS">Status Ordem Serviços</label><select id="raSOS" value={f.statusOS} onChange={(e) => set("statusOS", e.target.value)}>{opcoes([["", "Todos"], ...STATUS_AMOSTRA])}</select></div>
          <div className="fg s2"><label htmlFor="raSA">Status Amostra</label><select id="raSA" value={f.statusAmostra} onChange={(e) => set("statusAmostra", e.target.value)}>{opcoes([["", "Todos"], ...STATUS_AMOSTRA])}</select></div>
          <div className="fg s4"><label htmlFor="raGr">Grupo de análise</label><select id="raGr" value={f.grupo} onChange={(e) => set("grupo", e.target.value)}>{opcoes([["", "Todos"], ...grupos])}</select></div>
          <div className="fg s4"><label htmlFor="raMt">Matriz</label><select id="raMt" value={f.matriz} onChange={(e) => set("matriz", e.target.value)}>{opcoes([["", "Todas"], ...matrizes])}</select></div>
          <div className="fg s4"><label htmlFor="raPar">Parâmetros</label><select id="raPar" value={f.parametro} onChange={(e) => set("parametro", e.target.value)}>{opcoes([["", "Todos"], ...dados.parametros.map((p) => [p.id, p.parametro])])}</select></div>
          <div className="fg s3"><label htmlFor="raTD">Tipo de Data</label><select id="raTD" value={f.tipoData} onChange={(e) => set("tipoData", e.target.value)}>{opcoes(TIPOS_DATA)}</select></div>
          <div className="fg s3"><label htmlFor="raDe">Data Início</label><input id="raDe" type="date" value={f.de} onChange={(e) => set("de", e.target.value)} /></div>
          <div className="fg s3"><label htmlFor="raAte">Data Termíno</label><input id="raAte" type="date" value={f.ate} onChange={(e) => set("ate", e.target.value)} /></div>
          <div className="fg s3"><label htmlFor="raTipo">Tipo de relatório</label><select id="raTipo" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{opcoes(["Por amostra", "Por parâmetro (resultados)"])}</select></div>
        </div>
        <div className="acoes" style={{ marginTop: 10 }}><button type="button" className="btn btn-primary" onClick={gerar}>Gerar Relatório</button></div>
      </Caixa>
      {gerado && (
        <Caixa titulo={`${gerado.tipo} · ${gerado.linhas.length} linha(s)`}>
          <Grade key={JSON.stringify(f) + gerado.linhas.length} id="rel-am" exportar="relatorio-amostras" linhas={gerado.linhas} colunas={gerado.tipo === "Por amostra" ? colAmostra : colParam} ordemInicial={[0, "asc"]} botoes={[]} />
        </Caixa>
      )}
    </>
  );
}

export function RelatorioCentroCusto() {
  const { dados } = useDados();
  const [f, setF] = useState({ centro: "", de: `${isoDia(0).slice(0, 7)}-01`, ate: isoDia(0) });
  const [gerado, setGerado] = useState(null);
  const gerar = () => {
    const dentro = (d) => d && d >= f.de && d <= f.ate;
    const linhas = [
      ...dados.lancamentos_custo.filter((l) => dentro(l.data)).map((l) => ({ id: `l:${l.id}`, data: l.data, centro: l.centroCusto, componente: l.componente, descricao: l.descricao, origem: "Lançamento", valor: (l.tipo === "Receita" ? 1 : -1) * (Number(l.valor) || 0) })),
      ...dados.contas_pagar.filter((p) => p.centroCusto && dentro(p.vencimento)).map((p) => ({ id: `p:${p.id}`, data: p.vencimento, centro: p.centroCusto, componente: "", descricao: p.nome, origem: "Contas a pagar", valor: -(Number(p.valor) || 0) })),
      ...dados.notas_entrada.filter((n) => n.centroCusto && n.status !== "Cancelada" && dentro(n.emissao)).map((n) => ({ id: `n:${n.id}`, data: n.emissao, centro: n.centroCusto, componente: "", descricao: `NF ${n.numero}`, origem: "NF de entrada", valor: -(Number(n.valor) || 0) })),
    ].filter((l) => !f.centro || l.centro === f.centro);
    setGerado(linhas);
  };
  const nomeCC = (id) => dados.centros_custo.find((c) => c.id === id)?.nome || "—";
  const totais = gerado ? Object.entries(gerado.reduce((t, l) => ({ ...t, [l.centro]: (t[l.centro] || 0) + l.valor }), {})) : [];
  return (
    <>
      <Caixa titulo="Relatório de Centro de Custos">
        <div className="frm">
          <div className="fg s4"><label htmlFor="ccG">Grupo Centro de Custo *</label><select id="ccG" value={f.centro} onChange={(e) => setF({ ...f, centro: e.target.value })}>{opcoes([["", "Todos"], ...dados.centros_custo.map((c) => [c.id, c.nome])])}</select></div>
          <div className="fg s3"><label htmlFor="ccDe">Data Início *</label><input id="ccDe" type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></div>
          <div className="fg s3"><label htmlFor="ccAte">Data Fim *</label><input id="ccAte" type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></div>
        </div>
        <div className="acoes" style={{ marginTop: 10 }}><button type="button" className="btn btn-primary" onClick={gerar}>Gerar Relatório</button></div>
      </Caixa>
      {gerado && (
        <Caixa titulo="Resultado">
          <div className="kpis">{totais.length ? totais.map(([c, v]) => <div key={c} className={`kpi ${v < 0 ? "ruim" : "bom"}`}><span>{nomeCC(c)}</span><b>{brl(v)}</b></div>) : <p className="suave">Nenhum lançamento no período.</p>}</div>
          <Grade id="rel-cc" exportar="relatorio-centro-custos" linhas={gerado} ordemInicial={[0, "asc"]} botoes={[]} colunas={[
            { t: "Data", v: (r) => r.data, h: (r) => dataBR(r.data), fv: (r) => dataBR(r.data) }, { t: "Centro de custo", v: (r) => nomeCC(r.centro) },
            { t: "Componente", v: (r) => dados.componentes_custo.find((c) => c.id === r.componente)?.nome || "" }, { t: "Descrição", v: (r) => r.descricao }, { t: "Origem", v: (r) => r.origem },
            { t: "Valor", v: (r) => r.valor, h: (r) => brl(r.valor), fv: (r) => brl(r.valor) },
          ]} />
        </Caixa>
      )}
    </>
  );
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function DashboardFinanceiro() {
  const { dados } = useDados();
  const hoje = isoDia(0);
  const receber = dados.contas_receber.filter((r) => r.status !== "Cancelado");
  const pagar = dados.contas_pagar;
  const meses = useMemo(() => {
    const out = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); }
    return out;
  }, []);
  const soma = (l, f) => l.reduce((s, r) => s + (Number(f(r)) || 0), 0);
  const recebido = meses.map((m) => soma(receber.filter((r) => r.status === "Pago" && (r.pagoEm || "").startsWith(m)), (r) => r.valorPago ?? r.valor));
  const pago = meses.map((m) => soma(pagar.filter((p) => p.statusPagamento === "Pago" && (p.dataPagamento || "").startsWith(m)), (p) => p.valorPago || p.valor));
  const max = Math.max(1, ...recebido, ...pago);
  const abertos = receber.filter((r) => r.status === "Em aberto");
  const porCliente = Object.entries(abertos.reduce((t, r) => ({ ...t, [r.clienteId]: (t[r.clienteId] || 0) + (Number(r.valor) || 0) }), {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const W = 640, H = 220, P = 30, bw = (W - 2 * P) / meses.length;
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span>A receber (em aberto)</span><b>{brl(soma(abertos, (r) => r.valor))}</b></div>
        <div className="kpi ruim"><span>Vencido a receber</span><b>{brl(soma(abertos.filter((r) => r.venc < hoje), (r) => r.valor))}</b></div>
        <div className="kpi bom"><span>Recebido no mês</span><b>{brl(recebido[5])}</b></div>
        <div className="kpi"><span>A pagar (em aberto)</span><b>{brl(soma(pagar.filter((p) => p.statusPagamento !== "Pago"), (p) => p.valor))}</b></div>
        <div className="kpi"><span>Amostras aguardando faturamento</span><b>{dados.amostras.filter((a) => a.status === "Faturamento").length}</b></div>
      </div>
      <Caixa titulo="Recebido × pago (últimos 6 meses)">
        <div className="legend"><span><i style={{ background: "#16a897" }} />Recebido</span><span><i style={{ background: "#24444f" }} />Pago</span></div>
        <svg className="ch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Recebido e pago por mês">
          {meses.map((m, i) => {
            const x = P + i * bw, hR = (recebido[i] / max) * (H - 50), hP = (pago[i] / max) * (H - 50);
            return (
              <g key={m}>
                <rect x={x + bw * 0.15} y={H - 24 - hR} width={bw * 0.32} height={hR} fill="#16a897" rx="2"><title>{`Recebido ${brl(recebido[i])}`}</title></rect>
                <rect x={x + bw * 0.52} y={H - 24 - hP} width={bw * 0.32} height={hP} fill="#24444f" rx="2"><title>{`Pago ${brl(pago[i])}`}</title></rect>
                <text x={x + bw / 2} y={H - 6} textAnchor="middle">{MESES[Number(m.slice(5)) - 1]}/{m.slice(2, 4)}</text>
              </g>
            );
          })}
          <line x1={P} x2={W - P} y1={H - 24} y2={H - 24} stroke="#cbd5e1" />
        </svg>
      </Caixa>
      <Caixa titulo="Maiores saldos em aberto por cliente">
        <div className="tw"><table><thead><tr><th>Cliente</th><th>Em aberto</th><th>Faturas</th><th>Situação</th></tr></thead>
          <tbody>{porCliente.length ? porCliente.map(([c, v]) => { const l = abertos.filter((r) => r.clienteId === c); return <tr key={c}><td>{dados.clientes.find((x) => x.id === c)?.razao}</td><td>{brl(v)}</td><td>{l.length}</td><td>{l.some((r) => statusConta(r) === "Vencido") ? <span className="lbl crit">Com vencidas</span> : <span className="lbl ok">Em dia</span>}</td></tr>; }) : <tr><td colSpan={4} className="vazio">Nada em aberto.</td></tr>}</tbody></table></div>
      </Caixa>
    </>
  );
}
