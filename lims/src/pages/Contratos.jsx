// Menu Contratos, fiel ao GerenciaLab:
//  - Contratos Pendentes: propostas aceitas sem contrato → "Gerar notificação de serviço"
//    (cria o contrato e, se pedido, as faturas em Contas a receber).
//  - Contratos: lista com filtros por coluna, Visualizar e Status.
//  - Ficha do contrato (abas Geral / Financeiro / Solicitante).
//  - Detalhes do contrato (serviços contratados, adicionar amostra, histórico).
//  - Plano de Coleta (agendamentos) e Plano de Coleta automático.

import { useEffect, useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { rotuloSolicitante, emailsDoSolicitante } from "../lib/solicitantes.js";
import { enderecosDoCliente } from "../lib/clientes.js";
import { link, navegar } from "../lib/rota.js";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { estaAtivo } from "../lib/cadastros.js";
import { numeroProposta, totalProposta, totalItem, precoUnitario, itemDoPacote } from "../lib/propostas.js";
import { numeroContrato, contratosPendentes, contratoDaProposta, totalContrato, diasParaVencer, gerarParcelas, saldoServicos, planoAutomatico, datasRepeticao, agendarPlano, mesclarAgendamentos, REPETIR, AGENDAR_TODA } from "../lib/contratos.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, opcoes, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";
import { gerarOS } from "../lib/gerarOS.js";
import { JanelaAmostra } from "./PropostaServicos.jsx";
import { numeroOS } from "../lib/ordens.js";
import { getSessao } from "../lib/sessao.js";

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
    setG({ inicio: "", fim: "", ciclo: x.ciclo || "Faturado", parcelas: x.parcelas || 1, tipoPeriodo: x.tipoPeriodo || "Por dia Fixo", cobrarDia: x.cobrarDia || "10", primeiroPag: x.primeiroPag || "" });
  };
  const colunas = [
    { t: "Proposta ID", v: (r) => numeroProposta(r), filtro: true },
    { t: "Cliente", v: (r) => cli(r).razao || "", filtro: true },
    { t: "Data criação", v: (r) => r.criacao, h: (r) => dataBR(r.criacao), fv: (r) => dataBR(r.criacao), filtro: true },
    { t: "Data Validade", v: (r) => r.validade, h: (r) => dataBR(r.validade), fv: (r) => dataBR(r.validade), filtro: true },
    { t: "Ciclo de Pagamento", v: (r) => r.ciclo || "", filtro: true },
    { t: "Responsável", v: (r) => r.resp || "", filtro: true },
    { t: "Total", v: (r) => totalProposta(r), h: (r) => brl(totalProposta(r)), fv: (r) => brl(totalProposta(r)) },
    { t: "Status", v: () => "Aguardando", h: () => <span className="lbl crit">Aguardando</span> },
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
    <Caixa titulo="Contratos pendentes">
      <Grade id="pend" exportar="contratos-pendentes" linhas={pendentes} colunas={colunas} aoAbrir={abrir} porPaginaInicial={10}
        selecao={new Set()} aoSelecionar={(s) => { const x = pendentes.find((y) => y.id === [...s][0]); if (x) abrir(x); }} botoes={[]} />
      {p && g && (
        <Modal titulo="Gerar notificação de serviço" onFechar={() => setG(null)} rotuloOk="Gerar contrato" aoConfirmar={() => ((!g.inicio || !g.fim || g.fim < g.inicio) ? (avisar("Informe a data início e a data final.", "err"), false) : gerar())}>
          <div className="fg"><span className="rot">Proposta:</span><span>{numeroProposta(p)} <span className="suave">· {cli(p).razao} · {brl(totalProposta(p))}</span></span></div>
          <div className="frm">
            <div className="fg s6"><label htmlFor="gIni">Data Início</label><input id="gIni" type="date" value={g.inicio} onChange={set("inicio")} /></div>
            <div className="fg s6"><label htmlFor="gFim">Data Final</label><input id="gFim" type="date" value={g.fim} onChange={set("fim")} /></div>
            <div className="fg s12"><span className="rot">Ciclo de pagamento</span><span>{g.ciclo}</span></div>
            {g.ciclo === "Parcelado" && <>
            <div className="fg s6"><label htmlFor="gParc">Número de parcelas</label><input id="gParc" type="number" min="1" max="60" value={g.parcelas} disabled={g.ciclo !== "Parcelado"} onChange={set("parcelas")} /></div>
            <div className="fg s6"><label htmlFor="gTP">Tipo período</label><select id="gTP" value={g.tipoPeriodo} disabled={g.ciclo !== "Parcelado"} onChange={set("tipoPeriodo")}>{opcoes(["Por dia Fixo", "Por dia útil"])}</select></div>
            <div className="fg s6"><label htmlFor="gDia">Cobrar sempre no</label><select id="gDia" value={g.cobrarDia} disabled={g.ciclo !== "Parcelado"} onChange={set("cobrarDia")}>{opcoes(Array.from({ length: 31 }, (_, i) => String(i + 1)))}</select></div>
            <div className="fg s6"><label htmlFor="gPrim">Data da primeira parcela</label><input id="gPrim" type="date" value={g.primeiroPag} disabled={g.ciclo !== "Parcelado"} onChange={set("primeiroPag")} /></div>
            <div className="fg s6" style={{ justifyContent: "flex-end" }}><label className="radios"><input type="checkbox" checked={gerarFaturas} disabled={g.ciclo !== "Parcelado"} onChange={(e) => setGerarFaturas(e.target.checked)} /> Gerar faturas</label></div>
            </>}
          </div>
          {g.ciclo === "Parcelado" && g.primeiroPag && Number(g.parcelas) >= 1 && (
            <div className="tw"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead>
              <tbody>{gerarParcelas(totalProposta(p), g.parcelas, g.primeiroPag, g.tipoPeriodo, g.cobrarDia, feriadosAtivos(dados)).map((x) => <tr key={x.parcela}><td>{x.parcela}/{x.de}</td><td>{dataBR(x.venc)}</td><td>{brl(x.valor)}</td></tr>)}</tbody></table></div>
          )}
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
  const [status, setStatus] = useState("Todos");
  const linhas = status === "Todos" ? dados.contratos : dados.contratos.filter((r) => (r.status || "Ativo") === status);
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
    { t: "CNPJ Solicitante", v: (r) => sol(r)?.doc || "", filtro: true },
    { t: "Solicitante", v: (r) => sol(r)?.razao || sol(r)?.nome || "-", filtro: true },
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
      <Grade key={chave} id="contratos" exportar="contratos" linhas={linhas} colunas={colunas} filtrosColuna opcoesFiltro={{ 4: ["Ativo", "Inativo"] }}
        selecao={sel} aoSelecionar={setSel} aoAbrir={(r) => navegar("contract", r.id)}
        botoes={[
          { rotulo: "Visualizar", acao: exigir(() => navegar("contract", c.id)) },
          { rotulo: "Status", menu: ["Todos", "Ativo", "Inativo"].map((o) => ({ rotulo: o, marcado: status === o, padrao: o === "Todos", acao: () => { setStatus(o); setSel(new Set()); } })) },
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
          {campo("cENF", "Email Nota Fiscal Cliente", <input id="cENF" type="email" list="em-cli" value={f.emailNF || ""} onChange={set("emailNF")} />, "s4")}
          {campo("cERes", "Email Resultado Cliente", <input id="cERes" type="email" list="em-cli" value={f.emailResultado || ""} onChange={set("emailResultado")} />, "s4")}
          <datalist id="em-cli">{[...new Set([cliente.email, ...enderecosDoCliente(cliente).map((e) => e.email)].filter(Boolean))].map((e) => <option key={e} value={e} />)}</datalist>
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
          {campo("cCond", "Condições de pagamento", <select id="cCond" value={f.condicoes || ""} onChange={set("condicoes")}>{opcoes([["", "Selecione"], ...new Set([...(f.condicoes ? [f.condicoes] : []), ...dados.formas_pagamento.filter((x) => estaAtivo(x) && (!f.tipoContrato || x.tipoContrato === f.tipoContrato)).map((x) => x.descricao), ...dados.condicoes_pagamento.map((c) => c.descricao)])])}</select>, "s6")}
          {campo("cCiclo", "Ciclo pagamento", <select id="cCiclo" value={f.ciclo} onChange={set("ciclo")}>{opcoes(["Faturado", "Parcelado"])}</select>)}
          {campo("cCob", "Cobrança Na", <select id="cCob" value={f.cobrancaNa || ""} onChange={set("cobrancaNa")}>{opcoes(["Entrada da amostra", "Assinatura do certificado", "Nota Fiscal"])}</select>)}
          {campo("cParc", "Numero de parcelas", <input id="cParc" type="number" min="1" value={f.parcelas || 1} onChange={set("parcelas")} />)}
          {campo("cTP", "Por dia", <select id="cTP" value={f.tipoPeriodo || "Por dia Fixo"} onChange={set("tipoPeriodo")}>{opcoes(["Por dia Fixo", "Por dia útil"])}</select>)}
          {campo("cPrim", "Data primeiro pagamento", <input id="cPrim" type="date" value={f.primeiroPag || ""} onChange={set("primeiroPag")} />)}
          <div className="s12"><Parcelas contrato={f} /></div>
        </>}
        {aba === "Solicitante" && <>
          {campo("cSol", "Solicitante", <select id="cSol" value={f.solicitanteId || ""} onChange={(e) => setF((x) => ({ ...x, solicitanteId: e.target.value || null }))}>{opcoes([["", "Sem solicitante"], ...dados.solicitantes.filter((s) => s.status === "Ativo").map((s) => [s.id, rotuloSolicitante(s)])])}</select>, "s6")}
          {campo("cCobS", "Cobrança", <select id="cCobS" value={f.cobranca} onChange={set("cobranca")}>{opcoes(["Cliente", "Solicitante"])}</select>)}
          {campo("cResS", "Resultado Final", <select id="cResS" value={f.resultado} onChange={set("resultado")}>{opcoes(["Cliente", "Solicitante", "Ambos"])}</select>)}
          {campo("cECS", "Email cobrança Solicitante", <input id="cECS" type="email" list="em-sol" value={f.emailCobSol || ""} onChange={set("emailCobSol")} />, "s6")}
          {campo("cERS", "Email Resultado Solicitante", <input id="cERS" type="email" list="em-sol" value={f.emailResSol || ""} onChange={set("emailResSol")} />, "s6")}
          <datalist id="em-sol">{emailsDoSolicitante(dados.solicitantes.find((s) => s.id === f.solicitanteId)).map((e) => <option key={e} value={e} />)}</datalist>
        </>}
      </div>
      <div className="acoes" style={{ marginTop: 20, justifyContent: "space-between" }}>
        <div className="acoes"><a className="btn btn-default" href={link("contracts")}>Voltar</a><button type="button" className="btn btn-default" disabled={ocupado} onClick={gravar}>{ocupado ? "Salvando…" : "Atualizar contrato"}</button></div>
        <div className="acoes">
          <a className="btn btn-default" href={link("collection-plan", f.id)}>Plano de Coleta</a>
          <a className="btn btn-default" href={link("collection-plan-auto", f.id)}>Plano de Coleta automático</a>
          <a className="btn btn-default" href={link("services-contract", f.id)}>Detalhes do contrato</a>
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
  const [sel, setSel] = useState(new Set());
  const [janela, setJanela] = useState(null);
  const [hist, setHist] = useState(null);
  if (!c) return <NaoAchou />;
  const saldo = saldoServicos(c).map((s) => ({ ...s, id: s.sid }));
  const s1 = saldo.find((s) => sel.has(s.id));
  const colunas = [
    { t: "ID", v: (s) => Number(String(s.sid).replace(/\D/g, "")) || 0 },
    { t: "Status", v: (s) => s.status || "Ativo", h: (s) => <span className={`lbl ${s.status === "Inativo" ? "off" : "ok"}`}>{s.status === "Inativo" ? "Cancelado" : "Ativo"}</span> },
    { t: "Preço", v: (s) => precoUnitario(s), h: (s) => brl(precoUnitario(s)) },
    { t: "Qtde", v: (s) => Number(s.qtd) || 0 },
    { t: "Total", v: (s) => totalItem(s), h: (s) => brl(totalItem(s)) },
    { t: "Grupo", v: (s) => s.grupo || "" },
    { t: "Matriz", v: (s) => s.matriz || s.descricao },
    { t: "Parâmetros", v: (s) => s.params.map((x) => x.nome).join(", "), h: (s) => <span title={s.params.map((x) => x.nome).join(", ")}>{s.params.length}: {s.params.map((x) => x.abrev || x.nome).join(", ")}</span> },
    { t: "L. Apli 1.", v: (s) => s.legislacao || "" },
    { t: "L. Apli 2.", v: (s) => (s.legislacao2 || []).join(", ") },
    { t: "Agendado", v: (s) => s.agendado },
    { t: "Saldo", v: (s) => s.saldo },
  ];
  const abrirHist = async () => { setJanela("hist"); setHist(null); try { setHist(await auditoria({ colecao: "contratos", registroId: c.id, limite: 100 })); } catch { setHist([]); } };
  return (
    <Caixa cabecalho={`Detalhes do contrato ${numeroContrato(c)}`}>
      <Grade id="det-contrato" exportar="detalhes-contrato" linhas={saldo} colunas={colunas} selecao={sel} aoSelecionar={setSel} ordemInicial={[0, "asc"]}
        botoes={[
          { rotulo: "Voltar", acao: () => navegar("contract", c.id) },
          { rotulo: "Adicionar", acao: () => setJanela("add") },
          { rotulo: "Cancelar", acao: () => (s1 ? (s1.status === "Inativo" ? avisar("Este serviço já está cancelado.", "err") : setJanela({ cancelar: s1, motivo: "" })) : avisar("Selecione um serviço.", "err")) },
          { rotulo: "Histórico de alterações", acao: abrirHist },
        ]} />
      <div className="tot"><span>Total do contrato: <b>{brl(totalContrato(c))}</b></span></div>
      <div className="acoes" style={{ marginTop: 12 }}><a className="btn btn-default" href={link("collection-plan", c.id)}>Plano de Coleta</a></div>
      {janela === "add" && <JanelaAmostra inicial={{}} onFechar={() => setJanela(null)} aoSalvar={async (item) => {
        const sid = `s${Math.max(0, ...c.servicos.map((s) => Number(String(s.sid).slice(1)) || 0)) + 1}`;
        try { await salvar("contratos", { ...c, servicos: [...c.servicos, { ...item, sid, status: "Ativo" }] }, { motivo: `Adicionou ${item.descricao} (${item.qtd})` }); avisar("Amostra adicionada ao contrato.", "ok"); }
        catch (e) { avisar(e.message, "err"); return false; }
      }} />}
      {janela?.cancelar && (
        <Modal titulo="Cancelar serviço do contrato" onFechar={() => setJanela(null)} rotuloOk="Cancelar serviço" aoConfirmar={async () => {
          if (!janela.motivo.trim()) { avisar("Informe o motivo.", "err"); return false; }
          try { await salvar("contratos", { ...c, servicos: c.servicos.map((x) => (x.sid === janela.cancelar.sid ? { ...x, status: "Inativo" } : x)) }, { motivo: `Cancelou ${janela.cancelar.descricao}: ${janela.motivo.trim()}` }); avisar("Serviço cancelado.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <p style={{ marginTop: 0 }}>{janela.cancelar.matriz || janela.cancelar.descricao} — saldo {janela.cancelar.saldo} de {janela.cancelar.qtd}.</p>
          <div className="fg"><label htmlFor="cMot">Motivo</label><input id="cMot" list="mot-ct" value={janela.motivo} onChange={(e) => setJanela({ ...janela, motivo: e.target.value })} /><datalist id="mot-ct">{dados.motivos_alteracao.filter(estaAtivo).map((m) => <option key={m.id} value={m.identificacao} />)}</datalist></div>
        </Modal>
      )}
      {janela === "hist" && (
        <Modal titulo="Histórico de alterações" largo onFechar={() => setJanela(null)}>
          <div className="tw"><table><thead><tr><th>Data</th><th>Usuário</th><th>O que mudou</th></tr></thead>
            <tbody>{hist?.length ? hist.map((a) => <tr key={a.id}><td>{quandoBR(a.em)}</td><td>{a.usuario}</td><td className="quebra">{a.acao}</td></tr>) : <tr><td colSpan={3} className="vazio">{hist ? "Sem registros." : "Carregando…"}</td></tr>}</tbody></table></div>
        </Modal>
      )}
    </Caixa>
  );
}

/* ======================= Plano de Coleta ======================= */

const statusAg = (a) => (a.status === "OS gerada" ? "Executado" : a.status);

function TabelaAgendamentos({ c }) {
  const ctx = useDados();
  const { salvar } = ctx;
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [editar, setEditar] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const nome = (sid) => { const s = c.servicos.find((x) => x.sid === sid); return s ? `[ ${String(s.sid).replace(/\D/g, "")} ] ${s.matriz || s.descricao}` : sid; };
  const linhas = (c.agendamentos || []).map((a, i) => ({ ...a, n: i + 1 }));
  const marcados = linhas.filter((a) => sel.has(a.id));
  const um = (fn) => () => (marcados.length === 1 ? fn(marcados[0]) : avisar(marcados.length ? "Selecione apenas um agendamento." : "Selecione um agendamento.", "err"));
  const gravar = async (novo, msg) => { try { await salvar("contratos", novo); setSel(new Set()); if (msg) avisar(msg, "ok"); } catch (e) { avisar(e.message, "err"); return false; } };
  const trocar = (ag, msg) => gravar({ ...c, agendamentos: c.agendamentos.map((a) => (a.id === ag.id ? ag : a)) }, msg);
  const executar = um(async (a) => {
    if (a.status !== "Agendado") { avisar("Este agendamento já foi executado ou cancelado.", "err"); return; }
    setOcupado(true);
    try { const os = await gerarOS(ctx, { contrato: c, servicos: a.servicos, agendamento: a, por: getSessao()?.nome || "" }); setSel(new Set()); avisar(`${numeroOS(os)} gerada.`, "ok"); }
    catch (e) { avisar(e.message, "err"); } finally { setOcupado(false); }
  });
  const colunas = [
    { t: "ID", v: (a) => a.n },
    { t: "Identificação", v: (a) => a.identificacao || "" },
    { t: "Serviços", v: (a) => a.servicos.map((s) => `${nome(s.sid)}${Number(s.qtd) > 1 ? ` (${s.qtd})` : ""}`).join("; ") },
    { t: "Data do agendamento", v: (a) => a.data || "", h: (a) => quandoBR(a.data), fv: (a) => quandoBR(a.data) },
    { t: "Periodo", v: (a) => a.periodo || "unico" },
    { t: "Status", v: (a) => statusAg(a), h: (a) => <span className={`lbl ${a.status === "Cancelado" ? "off" : a.status === "Agendado" ? "info" : "ok"}`}>{statusAg(a)}</span> },
    { t: "OS", v: (a) => a.osId || "", h: (a) => (a.osId ? <a href={link("ordem", a.osId)}>Ver OS</a> : "") },
  ];
  return (
    <>
      <Grade id="agendamentos" exportar="agendamentos" linhas={linhas} colunas={colunas} multipla selecao={sel} aoSelecionar={setSel} ordemInicial={[0, "asc"]} porPaginaInicial={10}
        botoes={[
          { rotulo: ocupado ? "Executando…" : "Executar", acao: executar, desativado: ocupado },
          { rotulo: "Cancelar", acao: um((a) => (a.status !== "Agendado" ? avisar("Só é possível cancelar agendamento ainda não executado.", "err") : trocar({ ...a, status: "Cancelado" }, "Agendamento cancelado."))) },
          { rotulo: "Editar", acao: um((a) => (a.status !== "Agendado" ? avisar("Só é possível editar agendamento ainda não executado.", "err") : setEditar({ ...a }))) },
          { rotulo: "Mesclar", acao: () => { try { gravar(mesclarAgendamentos(c, marcados.map((a) => a.id)), "Agendamentos mesclados."); } catch (e) { avisar(e.message, "err"); } } },
        ]} />
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
  const [marc, setMarc] = useState({}); // sid -> Set(pids) (com o serviço marcado)
  const [plano, setPlano] = useState([]); // [{ sid, params, qtd }]
  const [ag, setAg] = useState({ identificacao: "", repetir: "Único", inicio: "", fim: "", cada: 1, dia: AGENDAR_TODA[0] });
  if (!c) return <NaoAchou />;
  const cliente = dados.clientes.find((x) => x.id === c.clienteId) || {};
  const ends = enderecosDoCliente(cliente).filter((e) => e.status !== "Inativo");
  const endColeta = ends.find((e) => e.tipo === "Coleta" && e.padrao === "Sim") || ends.find((e) => e.tipo === "Coleta");
  const endUsado = endColeta || ends.find((e) => e.tipo === "Principal") || {};
  const textoEnd = [endUsado.end, endUsado.num ? `nº ${endUsado.num}` : "", endUsado.comp, endUsado.bairro].filter(Boolean).join(", ") + (endUsado.cidade ? ` - ${endUsado.cidade} / ${endUsado.uf || ""}` : "");
  const saldo = saldoServicos(c).filter((s) => s.status !== "Inativo");
  const marcarServ = (s, on) => setMarc((m) => { const n = { ...m }; if (on) n[s.sid] = n[s.sid] || new Set(); else delete n[s.sid]; return n; });
  const marcarParam = (s, pid, on) => setMarc((m) => { const atual = new Set(m[s.sid] || []); on ? atual.add(pid) : atual.delete(pid); return { ...m, [s.sid]: atual }; });
  const adicionar = () => {
    const escolhidos = Object.entries(marc);
    if (!escolhidos.length) { avisar("Selecione os serviços.", "err"); return; }
    if (escolhidos.some(([, ps]) => !ps.size)) { avisar("Selecione os parâmetros.", "err"); return; }
    setPlano((p) => [...p, ...escolhidos.map(([sid, ps]) => { const sv = c.servicos.find((x) => x.sid === sid); return { k: `${sid}-${Date.now()}-${Math.random()}`, sid, params: ps.size === sv.params.length ? [] : [...ps], qtd: 1 }; })]);
    setMarc({});
  };
  const agendar = async () => {
    try {
      if (!plano.length) throw new Error("Adicione serviços ao plano de coleta.");
      const datas = datasRepeticao({ ...ag, feriados: feriadosAtivos(dados) });
      const periodo = ag.repetir === "Único" ? "unico" : `${ag.repetir.toLowerCase()}${Number(ag.cada) > 1 ? ` a cada ${ag.cada}` : ""}`;
      const novos = agendarPlano(c, { datas, servicos: plano, identificacao: ag.identificacao, periodo });
      await salvar("contratos", { ...c, agendamentos: [...(c.agendamentos || []), ...novos] }, { motivo: `Plano de coleta: ${novos.length} agendamento(s)` });
      setPlano([]); setAg((x) => ({ ...x, identificacao: "", inicio: "", fim: "" }));
      avisar(`${novos.length} agendamento(s) criado(s).`, "ok");
    } catch (e) { avisar(e.message, "err"); }
  };
  const nomeServ = (sid) => { const s = c.servicos.find((x) => x.sid === sid); return s?.matriz || s?.descricao || sid; };
  const setA = (k) => (e) => setAg((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Caixa cabecalho={`Plano de coleta - ${cliente.razao || ""}`}>
      <h3 className="box-title" style={{ fontSize: 15 }}>Serviços do contrato</h3>
      <div className="acoes" style={{ marginBottom: 8 }}><button type="button" className="dbtn" onClick={() => setMarc(Object.fromEntries(saldo.filter((s) => s.saldo > 0).map((s) => [s.sid, new Set(s.params.map((x) => x.id))])))}>Selecionar Todos</button></div>
      <div className="tw"><table>
        <thead><tr>{["ID", "#", "Grupo", "Matriz", "Legislação Aplicável", "Legislação Aplicável comparativa", "Parâmetros", "Qtde", "Saldo", "Total"].map((t) => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>
          <tr><td colSpan={10} className="suave">{endColeta ? <><b>Endereço de coleta:</b> {textoEnd}</> : <><b>Nenhum endereço de coleta definido como padrão; usando o endereço principal de cadastro.</b><br /><b>Endereço usado:</b> {textoEnd || "—"}</>}</td></tr>
          {saldo.length ? saldo.map((s) => {
            const ps = marc[s.sid];
            return (
              <tr key={s.sid}><td>{String(s.sid).replace(/\D/g, "")}</td>
                <td className="chk"><input type="checkbox" aria-label={`Selecionar ${s.matriz || s.descricao}`} disabled={s.saldo <= 0} checked={!!ps} onChange={(e) => marcarServ(s, e.target.checked)} /></td>
                <td>{s.grupo || ""}</td><td>{s.matriz || s.descricao}</td><td>{s.legislacao || ""}</td><td>{(s.legislacao2 || []).join(", ") || "-"}</td>
                <td><label className="radios"><input type="checkbox" disabled={s.saldo <= 0} checked={!!ps && ps.size === s.params.length} onChange={(e) => setMarc((m) => ({ ...m, [s.sid]: new Set(e.target.checked ? s.params.map((x) => x.id) : []) }))} /> <b>Selecionar todos</b></label>
                  {s.params.map((x) => <label key={x.id} className="radios"><input type="checkbox" disabled={s.saldo <= 0} checked={!!ps?.has(x.id)} onChange={(e) => marcarParam(s, x.id, e.target.checked)} /> {x.nome}</label>)}</td>
                <td>{s.qtd}</td><td>{s.saldo}</td><td>{brl(totalItem(s))}</td></tr>
            );
          }) : <tr><td colSpan={10} className="vazio">O contrato não tem serviços ativos.</td></tr>}
        </tbody>
      </table></div>
      <div style={{ margin: "16px 0" }}><button type="button" className="btn btn-info" onClick={adicionar}>Adicionar serviço ao agendamento</button></div>
      <h3 className="box-title" style={{ fontSize: 15 }}>Plano de coleta</h3>
      <div className="tw"><table>
        <thead><tr><th style={{ width: 110 }}>Remover</th><th>Serviço</th><th style={{ width: 260 }}>Quantidade</th></tr></thead>
        <tbody>{plano.map((p) => (
          <tr key={p.k}><td><button type="button" className="dbtn" onClick={() => setPlano((l) => l.filter((x) => x.k !== p.k))}>Remover</button></td>
            <td>{nomeServ(p.sid)}{p.params.length ? <span className="suave"> · {p.params.length} parâmetro(s)</span> : ""}</td>
            <td><input className="campo-num" type="number" min="1" aria-label={`Quantidade de ${nomeServ(p.sid)}`} value={p.qtd} onChange={(e) => setPlano((l) => l.map((x) => (x.k === p.k ? { ...x, qtd: e.target.value } : x)))} /></td></tr>
        ))}</tbody>
      </table></div>
      {plano.length > 0 && <>
        <h3 className="box-title" style={{ fontSize: 15, marginTop: 24 }}>Agendamento Ordem de Serviço</h3>
        <div className="frm">
          <div className="fg s4"><label htmlFor="agId">Identificação</label><input id="agId" value={ag.identificacao} onChange={setA("identificacao")} /></div>
          <div className="quebra-linha" />
          <div className="fg s2"><label htmlFor="agRep">Repetir</label><select id="agRep" value={ag.repetir} onChange={setA("repetir")}>{opcoes(REPETIR)}</select></div>
          <div className="fg s3"><label htmlFor="agIni">Data inicio e hora (Primeira coleta)</label><input id="agIni" type="datetime-local" value={ag.inicio} onChange={setA("inicio")} /></div>
          {ag.repetir !== "Único" && <>
            <div className="fg s3"><label htmlFor="agFim">Data final e hora (Última coleta)</label><input id="agFim" type="datetime-local" value={ag.fim} onChange={setA("fim")} /></div>
            <div className="fg s2"><label htmlFor="agCada">Repetir a cada</label><select id="agCada" value={ag.cada} onChange={setA("cada")}>{opcoes(Array.from({ length: 24 }, (_, i) => String(i + 1)))}</select></div>
            <div className="fg s2"><label htmlFor="agDia">agendar toda</label><select id="agDia" value={ag.dia} onChange={setA("dia")}>{opcoes(AGENDAR_TODA)}</select></div>
          </>}
        </div>
        <div className="acoes" style={{ marginTop: 12 }}><button type="button" className="btn btn-success" onClick={agendar}>Agendar</button><button type="button" className="btn btn-default" onClick={() => setPlano([])}>Voltar</button></div>
      </>}
      <h3 className="box-title" style={{ fontSize: 15, marginTop: 28 }}>Agendamentos</h3>
      <TabelaAgendamentos c={c} />
      <div className="acoes" style={{ marginTop: 12 }}><a className="btn btn-default" href={link("contract", c.id)}>Voltar</a><a className="btn btn-default" href={link("collection-plan-auto", c.id)}>Plano de Coleta automático</a></div>
    </Caixa>
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
