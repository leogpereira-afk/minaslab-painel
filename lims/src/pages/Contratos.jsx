// Menu Contratos, fiel ao GerenciaLab:
//  - Contratos Pendentes: propostas aceitas sem contrato → "Gerar notificação de serviço"
//    (cria o contrato e, se pedido, as faturas em Contas a receber).
//  - Contratos: lista com filtros por coluna, Visualizar e Status.
//  - Ficha do contrato (abas Geral / Financeiro / Solicitante).
//  - Detalhes do contrato (serviços contratados, adicionar amostra, histórico).
//  - Plano de Coleta (agendamentos) e Plano de Coleta automático.

import { useEffect, useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { estaAtivo } from "../lib/cadastros.js";
import { numeroProposta, totalProposta, totalItem, precoUnitario, itemDoPacote } from "../lib/propostas.js";
import { numeroContrato, contratosPendentes, contratoDaProposta, totalContrato, diasParaVencer, gerarParcelas, saldoServicos, novoAgendamento, planoAutomatico } from "../lib/contratos.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, opcoes, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";
import { gerarOS } from "../lib/gerarOS.js";
import { numeroOS } from "../lib/ordens.js";
import { getSessao } from "../lib/sessao.js";

const AVISO_EXPORTAR = "A exportação em Excel, PDF e impressão entra numa próxima etapa.";
const feriadosAtivos = (dados) => dados.feriados.filter(estaAtivo).map((f) => f.data).filter(Boolean);
const quandoBR = (s) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

/* ======================= Contratos Pendentes ======================= */

export function ContratosPendentes({ sessao }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [p, setP] = useState(null);
  const [g, setG] = useState(null);
  const [gerarFaturas, setGerarFaturas] = useState(true);
  const pendentes = contratosPendentes(dados.propostas, dados.contratos);
  const cli = (x) => dados.clientes.find((c) => c.id === x.clienteId) || {};
  const abrir = (x) => {
    setP(x);
    setGerarFaturas(true);
    setG({ inicio: isoDia(0), fim: isoDia(365), ciclo: x.ciclo || "Faturado", parcelas: x.parcelas || 1, tipoPeriodo: x.tipoPeriodo || "Por dia Fixo", cobrarDia: x.cobrarDia || "10", primeiroPag: x.primeiroPag || "" });
  };
  const colunas = [
    { t: "Proposta ID", v: (r) => numeroProposta(r), filtro: true },
    { t: "Cliente", v: (r) => cli(r).razao || "", filtro: true },
    { t: "Data criação", v: (r) => r.criacao, h: (r) => dataBR(r.criacao), fv: (r) => dataBR(r.criacao), filtro: true },
    { t: "Data Validade", v: (r) => r.validade, h: (r) => dataBR(r.validade), fv: (r) => dataBR(r.validade), filtro: true },
    { t: "Ciclo de Pagamento", v: (r) => r.ciclo || "", filtro: true },
    { t: "Responsável", v: (r) => r.resp || "", filtro: true },
    { t: "Total", v: (r) => totalProposta(r), h: (r) => brl(totalProposta(r)), fv: (r) => brl(totalProposta(r)) },
    { t: "Status", v: (r) => r.status, h: (r) => <span className="lbl ok">{r.status}</span> },
  ];
  const gerar = async () => {
    try {
      const novo = contratoDaProposta(p, g, sessao.nome || sessao.usuario);
      const c = await salvar("contratos", novo, { numerar: true, motivo: `Gerado da proposta ${numeroProposta(p)}` });
      if (gerarFaturas && g.ciclo === "Parcelado") {
        for (const parc of gerarParcelas(totalContrato(c), g.parcelas, g.primeiroPag, g.tipoPeriodo, g.cobrarDia, feriadosAtivos(dados))) {
          await salvar("contas_receber", { origem: "Contrato", contratoId: c.id, contrato: numeroContrato(c), clienteId: c.clienteId, descricao: `Contrato ${numeroContrato(c)} · parcela ${parc.parcela}/${parc.de}`, ...parc, status: "Em aberto" }, { numerar: true });
        }
      }
      await salvar("propostas", { ...p, statusProc: "Contrato gerado" });
      avisar(`Contrato ${numeroContrato(c)} gerado.`, "ok");
      navegar("contract", c.id);
    } catch (e) { avisar(e.message, "err"); return false; }
  };
  const set = (k) => (e) => setG((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Caixa titulo="Contratos Pendentes">
      <p className="suave" style={{ marginTop: -6 }}>Propostas aceitas que ainda não viraram contrato. Dê dois cliques (ou selecione e clique em Gerar contrato) para gerar a notificação de serviço.</p>
      <Grade id="pend" linhas={pendentes} colunas={colunas} filtrosColuna aoAbrir={abrir} porPaginaInicial={25}
        selecao={new Set(p ? [p.id] : [])} aoSelecionar={(s) => { const id = [...s][0]; setP(pendentes.find((x) => x.id === id) || null); }}
        botoes={[{ rotulo: "Gerar contrato", acao: () => (p ? abrir(p) : avisar("Selecione uma proposta.", "err")) }, { rotulo: "Visualizar proposta", acao: () => (p ? navegar("proposta", p.id) : avisar("Selecione uma proposta.", "err")) }]} />
      {p && g && (
        <Modal titulo="Gerar notificação de serviço" onFechar={() => setG(null)} rotuloOk="Gerar contrato" aoConfirmar={gerar}>
          <p style={{ margin: 0 }}><b>Proposta:</b> {numeroProposta(p)} · {cli(p).razao} · {brl(totalProposta(p))}</p>
          <div className="frm">
            <div className="fg s6"><label htmlFor="gIni">Data Início</label><input id="gIni" type="date" value={g.inicio} onChange={set("inicio")} /></div>
            <div className="fg s6"><label htmlFor="gFim">Data Final</label><input id="gFim" type="date" value={g.fim} onChange={set("fim")} /></div>
            <div className="fg s6"><label htmlFor="gCiclo">Ciclo de pagamento</label><select id="gCiclo" value={g.ciclo} onChange={set("ciclo")}>{opcoes(["Faturado", "Parcelado"])}</select></div>
            <div className="fg s6"><label htmlFor="gParc">Número de parcelas</label><input id="gParc" type="number" min="1" max="60" value={g.parcelas} disabled={g.ciclo !== "Parcelado"} onChange={set("parcelas")} /></div>
            <div className="fg s6"><label htmlFor="gTP">Tipo período</label><select id="gTP" value={g.tipoPeriodo} disabled={g.ciclo !== "Parcelado"} onChange={set("tipoPeriodo")}>{opcoes(["Por dia Fixo", "Por dia útil"])}</select></div>
            <div className="fg s6"><label htmlFor="gDia">Cobrar sempre no</label><select id="gDia" value={g.cobrarDia} disabled={g.ciclo !== "Parcelado"} onChange={set("cobrarDia")}>{opcoes(Array.from({ length: 31 }, (_, i) => String(i + 1)))}</select></div>
            <div className="fg s6"><label htmlFor="gPrim">Data da primeira parcela</label><input id="gPrim" type="date" value={g.primeiroPag} disabled={g.ciclo !== "Parcelado"} onChange={set("primeiroPag")} /></div>
            <div className="fg s6" style={{ justifyContent: "flex-end" }}><label className="radios"><input type="checkbox" checked={gerarFaturas} disabled={g.ciclo !== "Parcelado"} onChange={(e) => setGerarFaturas(e.target.checked)} /> Gerar faturas</label></div>
          </div>
          {g.ciclo === "Parcelado" && g.primeiroPag && Number(g.parcelas) >= 1 && (
            <div className="tw"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead>
              <tbody>{gerarParcelas(totalProposta(p), g.parcelas, g.primeiroPag, g.tipoPeriodo, g.cobrarDia, feriadosAtivos(dados)).map((x) => <tr key={x.parcela}><td>{x.parcela}/{x.de}</td><td>{dataBR(x.venc)}</td><td>{brl(x.valor)}</td></tr>)}</tbody></table></div>
          )}
          {g.ciclo === "Faturado" && <p className="suave" style={{ margin: 0 }}>Faturado: a cobrança acontece por ordem de serviço, conforme "Cobrança na" da proposta.</p>}
        </Modal>
      )}
    </Caixa>
  );
}

/* ======================= Lista de contratos ======================= */

export function ListaContratos() {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [chave, setChave] = useState(0);
  const cli = (r) => dados.clientes.find((c) => c.id === r.clienteId) || {};
  const sol = (r) => dados.solicitantes.find((s) => s.id === r.solicitanteId);
  const func = (id) => dados.funcionarios.find((f) => f.id === id)?.nome || "";
  const hoje = isoDia(0);
  const c = dados.contratos.find((x) => sel.has(x.id));
  const colunas = [
    { t: "ID", v: (r) => Number(r.cod) || 0, filtro: true },
    { t: "Proposta", v: (r) => r.proposta, filtro: true },
    { t: "Título Proposta", v: (r) => r.ident || "", filtro: true },
    { t: "Contrato", v: (r) => numeroContrato(r), filtro: true },
    { t: "Status", v: (r) => r.status, h: (r) => <span className={`lbl ${r.status === "Ativo" ? "ok" : "off"}`}>{r.status}</span>, filtro: "lista" },
    { t: "CNPJ Solicitante", v: () => "", filtro: true },
    { t: "Solicitante", v: (r) => sol(r)?.nome || "-", filtro: true },
    { t: "CNPJ Cliente", v: (r) => cli(r).doc || "", filtro: true },
    { t: "Cliente", v: (r) => cli(r).razao || "", filtro: true },
    { t: "Resp. pela coleta", v: (r) => (r.coleta === "Cliente" ? "Cliente" : "MinasLab"), filtro: true },
    { t: "Data inicio", v: (r) => r.inicio, h: (r) => dataBR(r.inicio), fv: (r) => dataBR(r.inicio), filtro: true },
    { t: "Data Final", v: (r) => r.fim, h: (r) => dataBR(r.fim), fv: (r) => dataBR(r.fim), filtro: true },
    { t: "Dias Vencimento", v: (r) => diasParaVencer(r, hoje) ?? 0, h: (r) => { const d = diasParaVencer(r, hoje); return d == null ? "" : <span className={`lbl ${d < 0 ? "crit" : d <= 30 ? "warn" : "ok"}`}>{d}</span>; } },
    { t: "Centro de Serviço", v: (r) => r.centro || "", filtro: true },
    { t: "Responsável", v: (r) => func(r.responsavel) || r.resp || "", filtro: true },
  ];
  const exigir = (fn) => () => (c ? fn() : avisar("Selecione um contrato.", "err"));
  return (
    <Caixa titulo="Contratos">
      <Grade key={chave} id="contratos" linhas={dados.contratos} colunas={colunas} filtrosColuna opcoesFiltro={{ 4: ["Ativo", "Inativo"] }}
        selecao={sel} aoSelecionar={setSel} aoAbrir={(r) => navegar("contract", r.id)}
        botoes={[
          { rotulo: "Criar Excel", acao: () => avisar(AVISO_EXPORTAR) }, { rotulo: "Criar PDF", acao: () => avisar(AVISO_EXPORTAR) }, { rotulo: "Imprimir", acao: () => avisar(AVISO_EXPORTAR) },
          { rotulo: "Visualizar", acao: exigir(() => navegar("contract", c.id)) },
          { rotulo: "Status", acao: exigir(async () => { try { await salvar("contratos", { ...c, status: c.status === "Ativo" ? "Inativo" : "Ativo" }); avisar(`Contrato ${c.status === "Ativo" ? "inativado" : "ativado"}.`, "ok"); } catch (e) { avisar(e.message, "err"); } }) },
          { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setChave((k) => k + 1); } },
        ]} />
    </Caixa>
  );
}

/* ======================= Ficha do contrato ======================= */

export function FichaContrato({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const atual = dados.contratos.find((x) => x.id === param);
  const [f, setF] = useState(() => (atual ? { ...atual } : null));
  const [aba, setAba] = useState("Geral");
  const [ocupado, setOcupado] = useState(false);
  if (!atual || !f) return <NaoAchou />;
  const cliente = dados.clientes.find((c) => c.id === f.clienteId) || {};
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const gravar = async () => {
    if (!f.inicio || !f.fim || f.fim < f.inicio) { avisar("Confira as datas de início e término.", "err"); return; }
    setOcupado(true);
    try { await salvar("contratos", f); avisar("Contrato atualizado.", "ok"); } catch (e) { avisar(e.message, "err"); } finally { setOcupado(false); }
  };
  const campo = (id, rot, el, cls = "s3") => <div className={`fg ${cls}`}><label htmlFor={id}>{rot}</label>{el}</div>;
  return (
    <div className="box">
      <div className="box-hd">Cliente: <a href={link("cliente", cliente.id)}>{cliente.razao}</a> <b>Contrato: {numeroContrato(f)}</b> <span className="suave">· proposta {f.proposta} · total {brl(totalContrato(f))}</span></div>
      <div className="abas" role="tablist">{["Geral", "Financeiro", "Solicitante"].map((a) => <button key={a} type="button" role="tab" aria-selected={aba === a} className={aba === a ? "on" : ""} onClick={() => setAba(a)}>{a}</button>)}</div>
      <div className="frm" style={{ marginTop: 18 }}>
        {aba === "Geral" && <>
          <div className="s12"><b>Informações Adicionais</b></div>
          {campo("cIni", "Data de início", <input id="cIni" type="date" value={f.inicio} onChange={set("inicio")} />)}
          {campo("cFim", "Data Término", <input id="cFim" type="date" value={f.fim} onChange={set("fim")} />)}
          {campo("cInd", "Indicação", <select id="cInd" className="gray" value={f.indicacao} onChange={set("indicacao")}>{opcoes(["Sem indicação", "Cliente", "Parceiro", "Site", "Redes sociais"])}</select>)}
          {campo("cGr", "Grupo regional", <select id="cGr" value={f.grupoRegional || ""} onChange={set("grupoRegional")}>{opcoes([["", "Selecione a região"], ...dados.grupos_regionais.map((g) => [g.id, g.nome])])}</select>)}
          {campo("cENF", "Email Nota Fiscal Cliente", <input id="cENF" type="email" value={f.emailNF || ""} onChange={set("emailNF")} />, "s4")}
          {campo("cERes", "Email Resultado Cliente", <input id="cERes" type="email" value={f.emailResultado || ""} onChange={set("emailResultado")} />, "s4")}
          <div className="quebra-linha" />
          {campo("cPMb", "Prazo Parâmetros Microbiológicos (dias)", <input id="cPMb" type="number" min="0" value={f.prazoMicro || ""} onChange={set("prazoMicro")} />)}
          {campo("cPFq", "Prazo Parâmetros Físico-químicos (dias)", <input id="cPFq" type="number" min="0" value={f.prazoFQ || ""} onChange={set("prazoFQ")} />)}
          {campo("cResp", "Responsável", <select id="cResp" value={f.responsavel || ""} onChange={set("responsavel")}>{opcoes([["", "Todos"], ...dados.funcionarios.filter(estaAtivo).map((x) => [x.id, x.nome])])}</select>)}
          <div className="fg s3"><span className="rot">Coleta</span>
            <label className="radios"><input type="radio" name="coleta" checked={f.coleta !== "Cliente"} onChange={() => setF((x) => ({ ...x, coleta: "MinasLab" }))} /> Coleta pela MinasLab Laboratório</label>
            <label className="radios"><input type="radio" name="coleta" checked={f.coleta === "Cliente"} onChange={() => setF((x) => ({ ...x, coleta: "Cliente" }))} /> Coleta pelo Cliente</label></div>
          <div className="fg s3"><span className="rot">Status</span>
            {["Ativo", "Inativo"].map((s) => <label key={s} className="radios"><input type="radio" name="status" checked={f.status === s} onChange={() => setF((x) => ({ ...x, status: s }))} /> {s === "Ativo" ? "Ativo" : "Inativo"}</label>)}</div>
        </>}
        {aba === "Financeiro" && <>
          {campo("cObsF", "Observações Financeiras", <textarea id="cObsF" rows={3} value={f.obsFin || ""} onChange={set("obsFin")} />, "s12")}
          {campo("cLim", "Limite de amostras", <input id="cLim" type="number" min="0" value={f.limiteAmostras || ""} onChange={set("limiteAmostras")} />)}
          {campo("cTC", "Tipo de contrato", <select id="cTC" value={f.tipoContrato || ""} onChange={set("tipoContrato")}>{opcoes([["", "Selecione tipo de contrato"], "Contrato Padrão", "Contrato Parcelado"])}</select>)}
          {campo("cCond", "Condições de pagamento", <select id="cCond" value={f.condicoes || ""} onChange={set("condicoes")}>{opcoes([["", "Selecione"], ...new Set([...(f.condicoes ? [f.condicoes] : []), ...dados.condicoes_pagamento.map((c) => c.descricao)])])}</select>, "s6")}
          {campo("cCiclo", "Ciclo pagamento", <select id="cCiclo" value={f.ciclo} onChange={set("ciclo")}>{opcoes(["Faturado", "Parcelado"])}</select>)}
          {campo("cCob", "Cobrança Na", <select id="cCob" value={f.cobrancaNa || ""} onChange={set("cobrancaNa")}>{opcoes(["Entrada da amostra", "Assinatura do certificado", "Nota Fiscal"])}</select>)}
          {campo("cParc", "Numero de parcelas", <input id="cParc" type="number" min="1" value={f.parcelas || 1} onChange={set("parcelas")} />)}
          {campo("cTP", "Por dia", <select id="cTP" value={f.tipoPeriodo || "Por dia Fixo"} onChange={set("tipoPeriodo")}>{opcoes(["Por dia Fixo", "Por dia útil"])}</select>)}
          {campo("cPrim", "Data primeiro pagamento", <input id="cPrim" type="date" value={f.primeiroPag || ""} onChange={set("primeiroPag")} />)}
          <div className="s12"><Parcelas contrato={f} /></div>
        </>}
        {aba === "Solicitante" && <>
          {campo("cSol", "Solicitante", <select id="cSol" value={f.solicitanteId || ""} onChange={(e) => setF((x) => ({ ...x, solicitanteId: e.target.value || null }))}>{opcoes([["", "Sem solicitante"], ...dados.solicitantes.filter((s) => s.status === "Ativo").map((s) => [s.id, `${s.nome} (${s.cliente})`])])}</select>, "s6")}
          {campo("cCobS", "Cobrança", <select id="cCobS" value={f.cobranca} onChange={set("cobranca")}>{opcoes(["Cliente", "Solicitante"])}</select>)}
          {campo("cResS", "Resultado Final", <select id="cResS" value={f.resultado} onChange={set("resultado")}>{opcoes(["Cliente", "Solicitante", "Ambos"])}</select>)}
          {campo("cECS", "Email cobrança Solicitante", <input id="cECS" type="email" value={f.emailCobSol || ""} onChange={set("emailCobSol")} />, "s6")}
          {campo("cERS", "Email Resultado Solicitante", <input id="cERS" type="email" value={f.emailResSol || ""} onChange={set("emailResSol")} />, "s6")}
        </>}
      </div>
      <div className="acoes" style={{ marginTop: 20, justifyContent: "space-between" }}>
        <a className="btn btn-default" href={link("contracts")}>Voltar</a>
        <div className="acoes">
          <a className="btn btn-default" href={link("collection-plan", f.id)}>Plano de Coleta</a>
          <a className="btn btn-default" href={link("collection-plan-auto", f.id)}>Plano de Coleta automático</a>
          <a className="btn btn-default" href={link("services-contract", f.id)}>Detalhes do contrato</a>
          <button type="button" className="btn btn-success" disabled={ocupado} onClick={gravar}>{ocupado ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

function Parcelas({ contrato }) {
  const { dados } = useDados();
  const lista = dados.contas_receber.filter((r) => r.contratoId === contrato.id).sort((a, b) => (a.venc || "").localeCompare(b.venc || ""));
  if (!lista.length) return <p className="suave" style={{ margin: 0 }}>Nenhuma fatura gerada para este contrato.</p>;
  return (
    <div className="tw"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead>
      <tbody>{lista.map((r) => <tr key={r.id}><td>{r.parcela}/{r.de}</td><td>{dataBR(r.venc)}</td><td>{brl(r.valor)}</td><td><span className={`lbl ${r.status === "Pago" ? "ok" : r.venc < isoDia(0) ? "crit" : "info"}`}>{r.status === "Pago" ? "Pago" : r.venc < isoDia(0) ? "Vencida" : "Em aberto"}</span></td></tr>)}</tbody></table></div>
  );
}

/* ======================= Detalhes do contrato ======================= */

export function DetalhesContrato({ param }) {
  const { dados, salvar, auditoria } = useDados();
  const avisar = useAviso();
  const c = dados.contratos.find((x) => x.id === param);
  const pacotes = dados.pacotes.filter(estaAtivo);
  const [pid, setPid] = useState(pacotes[0]?.id || "");
  const [qtd, setQtd] = useState(1);
  const [hist, setHist] = useState(null);
  useEffect(() => { if (c) auditoria({ colecao: "contratos", registroId: c.id, limite: 50 }).then(setHist).catch(() => setHist([])); }, [auditoria, c?.id, c?.atualizadoEm]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return <NaoAchou />;
  const saldo = saldoServicos(c);
  const adicionar = async () => {
    try {
      const pac = pacotes.find((x) => x.id === pid);
      const item = itemDoPacote(pac, dados, qtd, new Set(pac?.parametros || []));
      const sid = `s${Math.max(0, ...c.servicos.map((s) => Number(String(s.sid).slice(1)) || 0)) + 1}`;
      await salvar("contratos", { ...c, servicos: [...c.servicos, { ...item, sid, status: "Ativo" }] }, { motivo: `Adicionou ${item.descricao} (${item.qtd})` });
      avisar("Amostra adicionada ao contrato.", "ok");
    } catch (e) { avisar(e.message, "err"); }
  };
  const alternar = async (s) => {
    try { await salvar("contratos", { ...c, servicos: c.servicos.map((x) => (x.sid === s.sid ? { ...x, status: x.status === "Inativo" ? "Ativo" : "Inativo" } : x)) }); }
    catch (e) { avisar(e.message, "err"); }
  };
  return (
    <>
      <Caixa cabecalho={`Detalhes do contrato ${numeroContrato(c)}`}>
        {pacotes.length ? (
          <div className="frm">
            <div className="fg s6"><label htmlFor="dPac">Pacote de serviços</label><select id="dPac" value={pid} onChange={(e) => setPid(e.target.value)}>{opcoes(pacotes.map((x) => [x.id, x.descricao]))}</select></div>
            <div className="fg s2"><label htmlFor="dQtd">Qtde</label><input id="dQtd" type="number" min="1" value={qtd} onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))} /></div>
            <div className="fg s4" style={{ justifyContent: "flex-end" }}><button type="button" className="btn btn-primary" onClick={adicionar}>Adicionar amostra</button></div>
          </div>
        ) : <p className="aviso alerta">Cadastre Pacotes de Serviço em <a href={link("service-package")}>Configurações</a> para adicionar amostras.</p>}
        <div className="tw" style={{ marginTop: 14 }}>
          <table>
            <thead><tr>{["ID", "Status", "Preço", "Serviço / Matriz", "Parâmetros", "L. Apli 1.", "Qtde", "Agendado", "Saldo", "Total", ""].map((t) => <th key={t}>{t}</th>)}</tr></thead>
            <tbody>{saldo.map((s) => (
              <tr key={s.sid}>
                <td>{s.sid}</td><td><span className={`lbl ${s.status === "Inativo" ? "off" : "ok"}`}>{s.status || "Ativo"}</span></td><td>{brl(precoUnitario(s))}</td>
                <td>{s.descricao}{s.matriz ? ` — ${s.matriz}` : ""}</td><td title={s.params.map((x) => x.nome).join(", ")}>{s.params.length}: {s.params.map((x) => x.abrev || x.nome).join(", ")}</td>
                <td>{s.legislacao}</td><td>{s.qtd}</td><td>{s.agendado}</td><td>{s.saldo}</td><td>{brl(totalItem(s))}</td>
                <td><button type="button" className="btn btn-default btn-sm" onClick={() => alternar(s)}>{s.status === "Inativo" ? "Ativar" : "Inativar"}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="tot"><span>Total do contrato: <b>{brl(totalContrato(c))}</b></span></div>
        <div className="acoes" style={{ marginTop: 12 }}><a className="btn btn-default" href={link("contract", c.id)}>Voltar</a><a className="btn btn-default" href={link("collection-plan", c.id)}>Plano de Coleta</a></div>
      </Caixa>
      <Caixa titulo="Histórico de Alterações">
        <div className="tw"><table><thead><tr><th>Data</th><th>Usuário</th><th>O que mudou</th></tr></thead>
          <tbody>{hist?.length ? hist.map((a) => <tr key={a.id}><td>{quandoBR(a.em)}</td><td>{a.usuario}</td><td className="quebra">{a.acao}</td></tr>) : <tr><td colSpan={3} className="vazio">{hist ? "Sem registros." : "Carregando…"}</td></tr>}</tbody></table></div>
      </Caixa>
    </>
  );
}

/* ======================= Plano de Coleta ======================= */

function TabelaAgendamentos({ c }) {
  const ctx = useDados();
  const { salvar } = ctx;
  const avisar = useAviso();
  const [editar, setEditar] = useState(null);
  const [gerando, setGerando] = useState("");
  const gerar = async (ag) => {
    setGerando(ag.id);
    try { const os = await gerarOS(ctx, { contrato: c, servicos: ag.servicos, agendamento: ag, por: getSessao()?.nome || "" }); avisar(`${numeroOS(os)} gerada.`, "ok"); }
    catch (e) { avisar(e.message, "err"); } finally { setGerando(""); }
  };
  const nome = (sid) => c.servicos.find((s) => s.sid === sid)?.descricao || sid;
  const trocar = async (ag, msg) => { try { await salvar("contratos", { ...c, agendamentos: c.agendamentos.map((a) => (a.id === ag.id ? ag : a)) }); if (msg) avisar(msg, "ok"); } catch (e) { avisar(e.message, "err"); return false; } };
  const ordenados = [...(c.agendamentos || [])].sort((a, b) => a.data.localeCompare(b.data));
  return (
    <>
      <div className="tw"><table>
        <thead><tr>{["ID", "Identificação", "Serviços", "Data do agendamento", "Período", "Status", ""].map((t) => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>{ordenados.length ? ordenados.map((a, i) => (
          <tr key={a.id}><td>{i + 1}</td><td>{a.identificacao}</td><td className="quebra">{a.servicos.map((s) => `${nome(s.sid)} (${s.qtd})`).join("; ")}</td><td>{quandoBR(a.data)}</td><td>{a.periodo}</td>
            <td><span className={`lbl ${a.status === "Cancelado" ? "off" : a.status === "OS gerada" ? "ok" : "info"}`}>{a.status}</span></td>
            <td><div className="acoes">{a.status === "Agendado" && <><button type="button" className="btn btn-success btn-sm" disabled={!!gerando} onClick={() => gerar(a)}>{gerando === a.id ? "Gerando…" : "Gerar OS"}</button><button type="button" className="btn btn-default btn-sm" onClick={() => setEditar({ ...a })}>Alterar</button><button type="button" className="btn btn-danger btn-sm" onClick={() => trocar({ ...a, status: "Cancelado" }, "Agendamento cancelado.")}>Remover</button></>}{a.osId && <a className="btn btn-default btn-sm" href={link("ordem", a.osId)}>Ver OS</a>}</div></td></tr>
        )) : <tr><td colSpan={7} className="vazio">Nenhum agendamento.</td></tr>}</tbody>
      </table></div>
      {editar && (
        <Modal titulo="Alterar Agendamento" onFechar={() => setEditar(null)} rotuloOk="Atualizar" aoConfirmar={() => (editar.data ? trocar(editar, "Agendamento alterado.") : (avisar("Informe a data.", "err"), false))}>
          <div className="fg"><label htmlFor="eData">Data e Hora do agendamento</label><input id="eData" type="datetime-local" value={editar.data} onChange={(e) => setEditar({ ...editar, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="eIdent">Identificação</label><input id="eIdent" value={editar.identificacao || ""} onChange={(e) => setEditar({ ...editar, identificacao: e.target.value })} /></div>
        </Modal>
      )}
    </>
  );
}

export function PlanoColeta({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const c = dados.contratos.find((x) => x.id === param);
  const [qtds, setQtds] = useState({});
  const [data, setData] = useState(`${isoDia(1)}T08:00`);
  const [ident, setIdent] = useState("");
  if (!c) return <NaoAchou />;
  const cliente = dados.clientes.find((x) => x.id === c.clienteId) || {};
  const saldo = saldoServicos(c).filter((s) => s.status !== "Inativo");
  const agendar = async () => {
    try {
      const ag = novoAgendamento(c, { data, identificacao: ident, servicos: Object.entries(qtds).map(([sid, qtd]) => ({ sid, qtd })) });
      await salvar("contratos", { ...c, agendamentos: [...(c.agendamentos || []), ag] });
      setQtds({}); setIdent("");
      avisar("Serviço adicionado ao agendamento.", "ok");
    } catch (e) { avisar(e.message, "err"); }
  };
  return (
    <>
      <Caixa cabecalho={`Plano de coleta - ${cliente.razao || ""} · contrato ${numeroContrato(c)}`}>
        <h3 className="box-title" style={{ fontSize: 14 }}>Serviços do contrato</h3>
        <div className="acoes" style={{ marginBottom: 8 }}><button type="button" className="btn btn-default btn-sm" onClick={() => setQtds(Object.fromEntries(saldo.filter((s) => s.saldo > 0).map((s) => [s.sid, 1])))}>Selecionar Todos</button></div>
        <div className="tw"><table>
          <thead><tr>{["#", "Serviço / Matriz", "Legislação Aplicável", "Parâmetros", "Qtde", "Saldo", "Total", "Quantidade a agendar"].map((t) => <th key={t}>{t}</th>)}</tr></thead>
          <tbody>{saldo.length ? saldo.map((s) => (
            <tr key={s.sid}><td>{s.sid}</td><td>{s.descricao}{s.matriz ? ` — ${s.matriz}` : ""}</td><td>{s.legislacao}</td><td>{s.params.length}</td><td>{s.qtd}</td><td>{s.saldo}</td><td>{brl(totalItem(s))}</td>
              <td><input className="campo-num" type="number" min="0" max={s.saldo} aria-label={`Quantidade de ${s.descricao}`} disabled={s.saldo <= 0} value={qtds[s.sid] ?? ""} onChange={(e) => setQtds((q) => ({ ...q, [s.sid]: e.target.value }))} /></td></tr>
          )) : <tr><td colSpan={8} className="vazio">O contrato não tem serviços ativos.</td></tr>}</tbody>
        </table></div>
        <div className="frm" style={{ marginTop: 14 }}>
          <div className="fg s4"><label htmlFor="pData">Data e Hora do agendamento</label><input id="pData" type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="fg s4"><label htmlFor="pIdent">Identificação</label><input id="pIdent" placeholder="Ex.: Coleta mensal - pontos 1 a 4" value={ident} onChange={(e) => setIdent(e.target.value)} /></div>
          <div className="fg s4" style={{ justifyContent: "flex-end" }}><button type="button" className="btn btn-primary" onClick={agendar}>Adicionar serviço ao agendamento</button></div>
        </div>
      </Caixa>
      <Caixa titulo="Agendamentos">
        <TabelaAgendamentos c={c} />
        <div className="acoes" style={{ marginTop: 12 }}><a className="btn btn-default" href={link("contract", c.id)}>Voltar</a><a className="btn btn-default" href={link("collection-plan-auto", c.id)}>Plano de Coleta automático</a></div>
      </Caixa>
    </>
  );
}

export function PlanoColetaAutomatico({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const c = dados.contratos.find((x) => x.id === param);
  const freqs = useMemo(() => dados.frequencias.filter(estaAtivo).filter((f) => Number(f.dias) > 0), [dados.frequencias]);
  const [p, setP] = useState(() => ({ inicio: c?.inicio && c.inicio > isoDia(0) ? c.inicio : isoDia(1), fim: c?.fim || isoDia(365), intervaloDias: freqs[0]?.dias || 30, hora: "08:00", pularNaoUteis: true, sids: [] }));
  const [previa, setPrevia] = useState(null);
  if (!c) return <NaoAchou />;
  const saldo = saldoServicos(c).filter((s) => s.status !== "Inativo" && s.saldo > 0);
  const calcular = () => {
    try { setPrevia(planoAutomatico(c, { ...p, feriados: feriadosAtivos(dados) })); } catch (e) { setPrevia(null); avisar(e.message, "err"); }
  };
  const confirmar = async () => {
    try { await salvar("contratos", { ...c, agendamentos: [...(c.agendamentos || []), ...previa] }, { motivo: `Plano automático: ${previa.length} agendamento(s)` }); avisar(`${previa.length} agendamento(s) criado(s).`, "ok"); navegar("collection-plan", c.id); }
    catch (e) { avisar(e.message, "err"); }
  };
  const set = (k, v) => { setP((x) => ({ ...x, [k]: v })); setPrevia(null); };
  return (
    <Caixa cabecalho={`Plano de Coleta automático · contrato ${numeroContrato(c)}`}>
      <div className="frm">
        <div className="fg s3"><label htmlFor="aIni">Início</label><input id="aIni" type="date" value={p.inicio} onChange={(e) => set("inicio", e.target.value)} /></div>
        <div className="fg s3"><label htmlFor="aFim">Fim</label><input id="aFim" type="date" value={p.fim} onChange={(e) => set("fim", e.target.value)} /></div>
        <div className="fg s3"><label htmlFor="aFreq">Frequência</label>
          <select id="aFreq" value={String(p.intervaloDias)} onChange={(e) => set("intervaloDias", Number(e.target.value))}>{opcoes([...new Map([...freqs.map((f) => [String(f.dias), `${f.descricao} (${f.dias} dias)`]), ["7", "Semanal (7 dias)"], ["15", "Quinzenal (15 dias)"], ["30", "Mensal (30 dias)"]]).entries()])}</select></div>
        <div className="fg s3"><label htmlFor="aHora">Hora</label><input id="aHora" type="time" value={p.hora} onChange={(e) => set("hora", e.target.value)} /></div>
        <div className="fg s12"><label className="radios"><input type="checkbox" checked={p.pularNaoUteis} onChange={(e) => set("pularNaoUteis", e.target.checked)} /> Mover para o próximo dia útil quando cair em fim de semana ou feriado (Configurações → Feriados)</label></div>
      </div>
      <div className="tw" style={{ marginTop: 12 }}><table>
        <thead><tr><th className="chk" /><th>Serviço / Matriz</th><th>Saldo</th></tr></thead>
        <tbody>{saldo.length ? saldo.map((s) => (
          <tr key={s.sid}><td className="chk"><input type="checkbox" aria-label={`Incluir ${s.descricao}`} checked={p.sids.includes(s.sid)} onChange={(e) => set("sids", e.target.checked ? [...p.sids, s.sid] : p.sids.filter((x) => x !== s.sid))} /></td><td>{s.descricao}{s.matriz ? ` — ${s.matriz}` : ""}</td><td>{s.saldo}</td></tr>
        )) : <tr><td colSpan={3} className="vazio">Nenhum serviço com saldo para agendar.</td></tr>}</tbody>
      </table></div>
      <p className="suave">Cada data recebe 1 amostra de cada serviço marcado, até acabar o saldo contratado.</p>
      <div className="acoes"><a className="btn btn-default" href={link("contract", c.id)}>Voltar</a><button type="button" className="btn btn-default" onClick={calcular}>Pré-visualizar</button>{previa && <button type="button" className="btn btn-success" onClick={confirmar}>Criar {previa.length} agendamento(s)</button>}</div>
      {previa && <div className="tw" style={{ marginTop: 12 }}><table><thead><tr><th>#</th><th>Data</th><th>Serviços</th></tr></thead>
        <tbody>{previa.map((a, i) => <tr key={a.id}><td>{i + 1}</td><td>{quandoBR(a.data)}</td><td>{a.servicos.length}</td></tr>)}</tbody></table></div>}
    </Caixa>
  );
}
