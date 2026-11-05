// Menu Relatórios, fiel ao GerenciaLab: Relatórios de amostras (por amostra
// ou por parâmetro, com filtros), Relatório de Centro de Custos e Dashboard
// Financeiro. Tudo exporta em planilha (Criar Excel).

import { useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { referenciaAmostra, STATUS_AMOSTRA, statusDaOS, numeroOS } from "../lib/ordens.js";
import { resultadoExibido, parecer, limiteDe, valorAmostra } from "../lib/laboratorio.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, opcoes, useAviso } from "../components/ui.jsx";
import { paraCSV } from "../lib/grade.js";
import { quandoBR } from "./Coletas.jsx";
import { numeroFatura } from "./Financeiro.jsx";


const STATUS_OS_REL = ["Faturamento", "Concluída", "Laboratório", "Em coleta", "Aguardando agendamento", "Inspeção Técnica", "Em Revisão", "Assinatura", "Cancelado"];
const STATUS_AM_REL = ["Laboratório", "Revisão Resultado", "Revisão Certificado", "Retornado Laboratório", "Aguardando Assinatura", "Concluído"];
const TIPOS_DATA = [["dataEntrada", "Data de entrada"], ["dataColeta", "Data da coleta"], ["agendamento", "Data de agendamento coleta"]];

// Situação da amostra como o GerenciaLab filtra no relatório.
function situacaoAmostra(dados, a) {
  if (a.status === "Faturamento" || a.status === "Concluída") return "Concluído";
  if (a.status === "Em Revisão") return "Revisão Resultado";
  if (a.status === "Assinatura") return a.liberadaAssinatura ? "Aguardando Assinatura" : "Revisão Certificado";
  if (a.status === "Laboratório") return a.analises.some((x) => x.motivoRetorno && x.etapa === "Em análise") ? "Retornado Laboratório" : "Laboratório";
  return "";
}

export function RelatorioAmostras() {
  const { dados } = useDados();
  const tres = (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); })();
  const [f, setF] = useState({ solicitante: "", cliente: "", statusOS: "", statusAmostra: "", grupo: "", matriz: "", parametro: "", tipoData: "dataEntrada", de: tres, ate: isoDia(0), tipo: "Excel" });
  const [gerado, setGerado] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const osDe = useMemo(() => Object.fromEntries(dados.ordens.map((o) => [o.id, o])), [dados.ordens]);
  const statusOS = useMemo(() => { const p = {}; for (const a of dados.amostras) (p[a.osId] ||= []).push(a); return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, statusDaOS(v)])); }, [dados.amostras]);
  const grupoDe = (a) => dados.contratos.find((c) => c.id === a.contratoId)?.servicos?.find((s) => s.sid === a.sid)?.grupo || "";
  const nomeGrupo = (id) => dados.grupos_servico.find((g) => g.id === id)?.nome || "";
  const nomeMatriz = (id) => dados.matrizes.find((m) => m.id === id)?.nome || "";
  const cli = (id) => dados.clientes.find((c) => c.id === id)?.razao || "";
  const colAmostra = [
    { t: "Referência", v: (r) => referenciaAmostra(r) }, { t: "Código barra", v: (r) => r.barra }, { t: "OS", v: (r) => r.os }, { t: "Status OS", v: (r) => statusOS[r.osId] || "" }, { t: "Cliente", v: (r) => cli(r.clienteId) },
    { t: "Solicitante", v: (r) => dados.solicitantes.find((s) => s.id === osDe[r.osId]?.solicitanteId)?.razao || "" },
    { t: "Grupo", v: grupoDe }, { t: "Matriz", v: (r) => r.matriz || "" }, { t: "Identificação", v: (r) => r.identificacao || "" }, { t: "Status", v: (r) => r.status },
    { t: "Agendamento", v: (r) => osDe[r.osId]?.dataColeta || "", h: (r) => quandoBR(osDe[r.osId]?.dataColeta), fv: (r) => quandoBR(osDe[r.osId]?.dataColeta) },
    { t: "Coleta", v: (r) => r.dataColeta || "", h: (r) => quandoBR(r.dataColeta), fv: (r) => quandoBR(r.dataColeta) }, { t: "Entrada", v: (r) => r.dataEntrada || "", h: (r) => quandoBR(r.dataEntrada), fv: (r) => quandoBR(r.dataEntrada) },
    { t: "Assinatura", v: (r) => r.dataAssinatura || "", h: (r) => quandoBR(r.dataAssinatura), fv: (r) => quandoBR(r.dataAssinatura) },
    { t: "Não conformes", v: (r) => r.analises.filter((x) => parecer(x.resultado, limiteDe(dados, r, x.pid), x.lq) === "Não conforme").length },
  ];
  const colParam = [
    { t: "Referência", v: (r) => referenciaAmostra(r.a) }, { t: "OS", v: (r) => r.a.os }, { t: "Cliente", v: (r) => cli(r.a.clienteId) }, { t: "Matriz", v: (r) => r.a.matriz || r.a.servico },
    { t: "Identificação", v: (r) => r.a.identificacao || "" }, { t: "Coleta", v: (r) => r.a.dataColeta || "", h: (r) => quandoBR(r.a.dataColeta), fv: (r) => quandoBR(r.a.dataColeta) },
    { t: "Parâmetro", v: (r) => r.x.nome }, { t: "Resultado", v: (r) => resultadoExibido(r.x.resultado, { lq: r.x.lq }) }, { t: "Unidade", v: (r) => r.x.un || "" },
    { t: "VMP", v: (r) => { const l = limiteDe(dados, r.a, r.x.pid); return !l ? "" : l.texto || [l.minimo, l.maximo].filter((x) => x !== "" && x != null).join(" a "); } },
    { t: "Parecer", v: (r) => parecer(r.x.resultado, limiteDe(dados, r.a, r.x.pid), r.x.lq) }, { t: "Método", v: (r) => r.x.metodo || "" }, { t: "Etapa", v: (r) => r.x.etapa },
  ];
  const gerar = () => {
    const am = dados.amostras.filter((a) => {
      const d = String(f.tipoData === "agendamento" ? osDe[a.osId]?.dataColeta || "" : a[f.tipoData] || "").slice(0, 10);
      const stOS = statusOS[a.osId] === "Aguardando Inspeção" ? "Inspeção Técnica" : statusOS[a.osId] === "Aguardando coleta" ? "Em coleta" : statusOS[a.osId];
      return (!f.cliente || a.clienteId === f.cliente) && (!f.solicitante || osDe[a.osId]?.solicitanteId === f.solicitante)
        && (!f.statusAmostra || situacaoAmostra(dados, a) === f.statusAmostra) && (!f.statusOS || stOS === f.statusOS)
        && (!f.grupo || grupoDe(a) === nomeGrupo(f.grupo)) && (!f.matriz || a.matriz === nomeMatriz(f.matriz))
        && (!f.parametro || a.analises.some((x) => x.pid === f.parametro))
        && (!f.de || (d && d >= f.de)) && (!f.ate || (d && d <= f.ate));
    });
    const porParam = f.tipo !== "Excel";
    const linhas = porParam ? am.flatMap((a) => a.analises.filter((x) => !f.parametro || x.pid === f.parametro).map((x) => ({ id: `${a.id}|${x.pid}`, a, x }))) : am;
    const cols = porParam ? colParam : colAmostra;
    setGerado({ tipo: f.tipo, linhas });
    if (linhas.length) { const url = URL.createObjectURL(new Blob([paraCSV(linhas, cols)], { type: "text/csv;charset=utf-8" })); const el = document.createElement("a"); el.href = url; el.download = `relatorio-amostras-${isoDia(0)}.csv`; el.click(); URL.revokeObjectURL(url); }
  };
  const matrizes = dados.matrizes.filter((m) => !f.grupo || m.grupo === f.grupo);
  const params = dados.parametros.filter((p) => (!f.grupo || p.grupo === f.grupo) && p.status !== "Inativo");
  return (
    <>
      <Caixa titulo="Relatórios de amostras">
        <div className="frm">
          <div className="fg s6"><label htmlFor="raSol">Solicitante</label><select id="raSol" value={f.solicitante} onChange={(e) => set("solicitante", e.target.value)}>{opcoes([["", "Todos Solicitante"], ...dados.solicitantes.map((s) => [s.id, s.razao || s.nome])])}</select></div>
          <div className="fg s6"><label htmlFor="raCli">Cliente</label><select id="raCli" value={f.cliente} onChange={(e) => set("cliente", e.target.value)}>{opcoes([["", "Todos clientes"], ...dados.clientes.map((c) => [c.id, c.razao])])}</select></div>
          <div className="fg s6"><label htmlFor="raSOS">Status Ordem Serviços</label><select id="raSOS" value={f.statusOS} onChange={(e) => set("statusOS", e.target.value)}>{opcoes([["", "Todos"], ...STATUS_OS_REL.map((x) => [x, x === "Cancelado" ? "Cancelada" : x])])}</select></div>
          <div className="fg s6"><label htmlFor="raSA">Status Amostra</label><select id="raSA" value={f.statusAmostra} onChange={(e) => set("statusAmostra", e.target.value)}>{opcoes([["", "Todos"], ...STATUS_AM_REL])}</select></div>
          <div className="fg s4"><label htmlFor="raGr">Grupo de análise</label><select id="raGr" value={f.grupo} onChange={(e) => setF((x) => ({ ...x, grupo: e.target.value, matriz: "", parametro: "" }))}>{opcoes([["", `Todos selecionados (${dados.grupos_servico.length})`], ...dados.grupos_servico.map((g) => [g.id, g.nome])])}</select></div>
          <div className="fg s4"><label htmlFor="raMt">Matriz</label><select id="raMt" value={f.matriz} onChange={(e) => set("matriz", e.target.value)}>{opcoes([["", "Todos"], ...matrizes.map((m) => [m.id, m.nome])])}</select></div>
          <div className="fg s4"><label htmlFor="raPar">Parâmetros</label><select id="raPar" value={f.parametro} onChange={(e) => set("parametro", e.target.value)}>{opcoes([["", "Todos"], ...params.map((p) => [p.id, p.parametro])])}</select></div>
          <div className="fg s6"><label htmlFor="raTD">Tipo de Data</label><select id="raTD" value={f.tipoData} onChange={(e) => set("tipoData", e.target.value)}>{opcoes(TIPOS_DATA)}</select></div>
          <div className="fg s6"><label htmlFor="raDe">Data Início</label><input id="raDe" type="date" value={f.de} onChange={(e) => set("de", e.target.value)} /></div>
          <div className="fg s6"><label htmlFor="raAte">Data Termino</label><input id="raAte" type="date" value={f.ate} onChange={(e) => set("ate", e.target.value)} /></div>
          <div className="fg s6"><label htmlFor="raTipo">Tipo de relatório</label><select id="raTipo" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{opcoes(["Excel", "Excel (por parâmetro)"])}</select></div>
        </div>
        <div className="acoes" style={{ marginTop: 10 }}><button type="button" className="btn btn-default" onClick={gerar}>Gerar Relatório</button></div>
      </Caixa>
      {gerado && (
        <Caixa titulo={`Relatório gerado · ${gerado.linhas.length} linha(s)${gerado.linhas.length ? " · planilha baixada" : ""}`}>
          <Grade key={JSON.stringify(f) + gerado.linhas.length} id="rel-am" exportar="relatorio-amostras" linhas={gerado.linhas} colunas={gerado.tipo === "Excel" ? colAmostra : colParam} ordemInicial={[0, "asc"]} botoes={[]} />
        </Caixa>
      )}
    </>
  );
}

export function RelatorioCentroCusto() {
  const { dados } = useDados();
  const [f, setF] = useState({ centro: "", de: `${isoDia(0).slice(0, 7)}-01`, ate: isoDia(0) });
  const [gerado, setGerado] = useState(null);
  const avisar = useAviso();
  const gerar = () => {
    if (!f.centro) { avisar("Selecione o grupo de centro de custo.", "err"); return; }
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
          <div className="fg s4"><label htmlFor="ccG">Grupo Centro de Custo *</label><select id="ccG" value={f.centro} onChange={(e) => setF({ ...f, centro: e.target.value })}>{opcoes([["", "Selecione um grupo"], ...dados.centros_custo.map((c) => [c.id, c.nome])])}</select></div>
          <div className="fg s3"><label htmlFor="ccPer">Período (opcional)</label><select id="ccPer" value="" onChange={(e) => { const v = e.target.value; if (!v) return; const d = new Date(); const ano = d.getFullYear(), m = d.getMonth(); const ini = v === "mes" ? new Date(ano, m, 1) : v === "tri" ? new Date(ano, Math.floor(m / 3) * 3, 1) : v === "sem" ? new Date(ano, m < 6 ? 0 : 6, 1) : new Date(ano, 0, 1); const fim = v === "mes" ? new Date(ano, m + 1, 0) : v === "tri" ? new Date(ano, Math.floor(m / 3) * 3 + 3, 0) : v === "sem" ? new Date(ano, m < 6 ? 6 : 12, 0) : new Date(ano, 12, 0); const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; setF({ ...f, de: iso(ini), ate: iso(fim) }); }}>{opcoes([["", "Selecione para preencher automaticamente"], ["mes", "Mês Atual"], ["tri", "Trimestre Atual"], ["sem", "Semestre Atual"], ["ano", "Ano Atual"]])}</select></div>
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

// Dashboard Financeiro (GerenciaLab): totais de faturas do mês por status e
// as parciais de contrato padrão, parcelado, OS aguardando coleta e pagas.
export function DashboardFinanceiro() {
  const { dados } = useDados();
  const hoje = isoDia(0), mes = hoje.slice(0, 7);
  const [aberto, setAberto] = useState(null);
  const todas = dados.contas_receber.filter((r) => r.status !== "Agrupada");
  const ct = (r) => dados.contratos.find((c) => c.id === r.contratoId);
  const am = (r) => dados.amostras.find((a) => a.id === r.amostraId);
  const respProp = (c) => { const p = dados.propostas.find((x) => x.id === c?.propostaId); return p?.resp || c?.resp || ""; };
  const cliNome = (id) => { const c = dados.clientes.find((x) => x.id === id) || {}; return [c.razao, c.resp].filter(Boolean).join(" - "); };
  const doMes = (r) => String(r.venc || "").startsWith(mes) || (r.status === "Em aberto" && r.venc && r.venc < hoje);
  const emFat = (r) => r.status === "Em aberto" && am(r)?.status === "Faturamento";
  const parcelado = (r) => ct(r)?.ciclo === "Parcelado" || r.origem === "Contrato";
  const situacao = (r) => (r.status === "Pago" ? "Paga" : r.status === "Cancelado" ? "Cancelada" : r.venc && r.venc < hoje ? "Vencida" : "A vencer");
  const statusF = (r) => (r.status === "Cancelado" ? "Cancelada" : emFat(r) ? "Faturamento" : r.status);
  const kpis = [
    ["Total de Faturas Em Aberto (Mensal)", todas.filter((r) => doMes(r) && r.status === "Em aberto" && !emFat(r))],
    ["Total de Faturas Pago (Mensal)", todas.filter((r) => r.status === "Pago" && String(r.pagoEm || "").startsWith(mes))],
    ["Total de Faturas Em Faturamento (Mensal)", todas.filter((r) => doMes(r) && emFat(r))],
    ["Total de Faturas Cancelado (Mensal)", todas.filter((r) => r.status === "Cancelado" && (String(r.venc || "").startsWith(mes) || String(r.atualizadoEm || "").startsWith(mes)))],
    ["Total de Faturas Aguardando fechamento (Mensal)", todas.filter((r) => r.status === "Aguardando fechamento")],
  ];
  const colFatura = [
    { t: "ID Fatura", v: (r) => Number(r.cod) || 0 }, { t: "Unique ID", v: numeroFatura }, { t: "Data Vencimento", v: (r) => r.venc || "", h: (r) => dataBR(r.venc), fv: (r) => dataBR(r.venc) },
    { t: "Cliente", v: (r) => dados.clientes.find((c) => c.id === r.clienteId)?.razao || "" }, { t: "Contrato", v: (r) => r.contrato || "" },
    { t: "Situação", v: situacao, h: (r) => <span className={`lbl ${{ Vencida: "crit", Paga: "ok", Cancelada: "off" }[situacao(r)] || "info"}`}>{situacao(r)}</span> },
    { t: "Status", v: statusF }, { t: "Valor Total (R$)", v: (r) => Number(r.valor) || 0, h: (r) => brl(r.valor), fv: (r) => brl(r.valor) }, { t: "Responsável pela Proposta", v: (r) => respProp(ct(r)) },
  ];
  const valorOS = (o) => dados.amostras.filter((a) => a.osId === o.id).reduce((t, a) => t + valorAmostra(dados.contratos.find((c) => c.id === a.contratoId), a), 0);
  const osAguardando = dados.ordens.map((o) => ({ ...o, st: statusDaOS(dados.amostras.filter((a) => a.osId === o.id)) })).filter((o) => o.st === "Aguardando agendamento" || o.st === "Aguardando coleta");
  const colOS = [
    { t: "ID Ordem de Serviço", v: (o) => Number(o.cod) || 0 }, { t: "Ordem de Serviço", v: (o) => numeroOS(o) }, { t: "Contrato", v: (o) => o.contrato || "" },
    { t: "Cliente - Responsável", v: (o) => cliNome(o.clienteId) }, { t: "Status da OS", v: (o) => o.st },
    { t: "Fatura", v: (o) => todas.filter((r) => r.osId === o.id).map(numeroFatura).join(", ") }, { t: "Responsável pela Proposta", v: (o) => respProp(dados.contratos.find((c) => c.id === o.contratoId)) },
    { t: "Valor Total", v: valorOS, h: (o) => brl(valorOS(o)), fv: (o) => brl(valorOS(o)) },
  ];
  const quadros = [
    ["Parcial de Contrato Padrão (Mensal)", todas.filter((r) => doMes(r) && !parcelado(r) && r.status !== "Cancelado" && r.status !== "Pago"), colFatura, "dash-padrao"],
    ["Parcial de Contrato Parcelado (Mensal)", todas.filter((r) => doMes(r) && parcelado(r) && r.status !== "Cancelado" && r.status !== "Pago"), colFatura, "dash-parcelado"],
    ["Parcial de Ordem de Serviço (Aguardando Agendamento/Aguardando Coleta)", osAguardando, colOS, "dash-os"],
    ["Parcial Faturas Pagas (Mensal)", todas.filter((r) => r.status === "Pago" && String(r.pagoEm || "").startsWith(mes)), colFatura, "dash-pagas"],
  ];
  return (
    <Caixa titulo="Dashboard Financeiro">
      <div className="dash-kpis">{kpis.map(([t, l]) => <button type="button" key={t} className={`dash-kpi${aberto === t ? " on" : ""}`} onClick={() => setAberto(aberto === t ? null : t)} title={`${brl(l.reduce((s, r) => s + (Number(r.valor) || 0), 0))} — clique para ver as faturas`}><span>{t}</span><b>{l.length}</b></button>)}</div>
      {aberto && <div className="quadro" style={{ marginBottom: 14 }}><b>{aberto}</b><Grade id="dash-kpi" exportar="dashboard-faturas" linhas={kpis.find(([t]) => t === aberto)[1]} colunas={colFatura} ordemInicial={[2, "asc"]} porPaginaInicial={10} botoes={[]} /></div>}
      {quadros.map(([t, l, cols, id]) => (
        <div key={t} className="quadro" style={{ marginBottom: 14 }}>
          <b>{t}</b>
          {l.length ? <Grade id={id} exportar={id} linhas={l} colunas={cols} ordemInicial={[2, "asc"]} porPaginaInicial={10} botoes={[]} /> : <p className="vazio" style={{ padding: "30px 0", textAlign: "center" }}>Nenhum resultado</p>}
        </div>
      ))}
    </Caixa>
  );
}
