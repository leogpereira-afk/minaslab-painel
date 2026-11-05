// Menu Coletas, fiel ao GerenciaLab:
//  - Logística: amostras a agendar/coletar; Agendar coletor e data.
//  - Coletas: registrar a coleta (ficha de coleta, condições ambientais e
//    resultados in loco) e imprimir a cadeia de custódia.
//  - Agenda: calendário do mês com as coletas e compromissos.
//  - Descarte amostras: guarda e descarte após a análise.

import { useMemo, useState } from "react";
import { useDados, configSistema } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { agoraLocal, dataBR, isoDia } from "../lib/formato.js";
import { estaAtivo } from "../lib/cadastros.js";
import { referenciaAmostra, statusDaOS } from "../lib/ordens.js";
import { enderecosDoCliente } from "../lib/clientes.js";
import { numeroContrato } from "../lib/contratos.js";
import { totalItem } from "../lib/propostas.js";
import { brl } from "../lib/formato.js";
import { gerarOS } from "../lib/gerarOS.js";
import { getSessao } from "../lib/sessao.js";
import { paraCSV } from "../lib/grade.js";
import { registrarColeta, dataParaDescarte } from "../lib/laboratorio.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, opcoes, useAviso } from "../components/ui.jsx";
import { CamposDinamicos, camposAtivos, valoresDinamicos } from "../components/Dinamicos.jsx";
import { NaoAchou } from "./Clientes.jsx";
import { RotuloOS, CodigoBarras } from "./Ordens.jsx";
import logoMinasLab from "../assets/logo-minaslab.webp";

export const quandoBR = (s) => (s ? (String(s).length > 10 ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : dataBR(s)) : "");

// Pessoas para "Responsável": funcionários ativos (Configurações → Funcionários).
export function Pessoas({ id }) {
  const { dados } = useDados();
  return <datalist id={id}>{dados.funcionarios.filter(estaAtivo).map((f) => <option key={f.id} value={f.nome} />)}</datalist>;
}

// Colunas comuns às listas de amostras.
export function colunasAmostra(dados, extras = []) {
  const os = Object.fromEntries(dados.ordens.map((o) => [o.id, o]));
  const cli = Object.fromEntries(dados.clientes.map((c) => [c.id, c.razao]));
  const ct = Object.fromEntries(dados.contratos.map((c) => [c.id, c]));
  return [
    { t: "ID", v: (r) => Number(r.cod) || 0 },
    { t: "Ordem Serviço", v: (r) => r.os || "", filtro: true },
    { t: "Referência", v: (r) => referenciaAmostra(r), filtro: true },
    { t: "Código barra", v: (r) => r.barra, filtro: true },
    { t: "Status", v: (r) => r.status, h: (r) => <RotuloOS s={r.status} />, filtro: "lista" },
    { t: "Cliente", v: (r) => cli[r.clienteId] || "", filtro: true },
    { t: "Solicitante", v: (r) => dados.solicitantes.find((s) => s.id === os[r.osId]?.solicitanteId)?.nome || "", filtro: true },
    { t: "Serviço / Matriz", v: (r) => `${r.servico}${r.matriz ? ` — ${r.matriz}` : ""}`, filtro: true },
    { t: "identificação", v: (r) => r.identificacao || "", filtro: true },
    ...extras,
    { t: "Data do agendamento", v: (r) => r.dataColeta || "", h: (r) => quandoBR(r.dataColeta), fv: (r) => quandoBR(r.dataColeta), filtro: true },
    { t: "Centro de Serv.", v: (r) => os[r.osId]?.centro || "", filtro: true },
    { t: "Região", v: (r) => dados.grupos_regionais.find((g) => g.id === r.regiao)?.nome || "", filtro: true },
    { t: "Tipo de contrato", v: (r) => ct[r.contratoId]?.ciclo || ct[r.contratoId]?.tipo || "", filtro: true },
    { t: "Res. Coleta", v: (r) => (r.respAmostra === "Cliente" ? "Coleta pelo Cliente" : "Coleta por Minaslab"), filtro: "lista" },
  ];
}

/* ---------- Agendar (Logística) ---------- */

function Agendar({ amostras, onFechar }) {
  const { salvarLote } = useDados();
  const avisar = useAviso();
  const [f, setF] = useState({ coletor: amostras[0]?.coletor || "", data: (amostras[0]?.dataColeta || `${isoDia(1)}T08:00`).slice(0, 16), msg: "Não", obs: amostras[0]?.obsLogistica || "" });
  return (
    <Modal titulo="Logística - Agendamento" onFechar={onFechar} rotuloOk="Agendar" aoConfirmar={async () => {
      if (!f.coletor.trim() || !f.data) { avisar("Informe o responsável pela coleta e a data.", "err"); return false; }
      try {
        await salvarLote("amostras", amostras.map((a) => ({ ...a, coletor: f.coletor.trim(), dataColeta: f.data, obsLogistica: f.obs, confirmarCliente: f.msg, status: a.status === "Aguardando agendamento" ? "Aguardando coleta" : a.status })), { motivo: "Agendamento da coleta" });
        avisar(`Coleta agendada (${amostras.length} amostra(s)).`, "ok");
      } catch (e) { avisar(e.message, "err"); return false; }
    }}>
      <div className="fg"><label htmlFor="agCol">Responsável pela coleta</label><input id="agCol" list="pessoas-ag" value={f.coletor} onChange={(e) => setF({ ...f, coletor: e.target.value })} /><Pessoas id="pessoas-ag" /></div>
      <div className="fg"><label htmlFor="agData">Data e Hora da Coleta</label><input id="agData" type="datetime-local" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
      <div className="fg"><label htmlFor="agMsg">Enviar mensagem confirmação</label><select id="agMsg" value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })}>{opcoes(["Não", "Sim"])}</select></div>
      {f.msg === "Sim" && <p className="suave" style={{ margin: 0 }}>O envio automático para o cliente ainda não está ligado; fica registrado que a confirmação foi pedida.</p>}
      <div className="fg"><label htmlFor="agObs">Observações internas</label><textarea id="agObs" rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></div>
    </Modal>
  );
}

const textoEndereco = (e) => [e.end, e.num ? `nº ${e.num}` : "", e.comp, e.bairro].filter(Boolean).join(", ") + (e.cidade ? ` - ${e.cidade} / ${e.uf || ""}` : "");

// Linhas por OS (como no GerenciaLab): as amostras da OS nos status da tela.
function useLinhasOS(status) {
  const { dados } = useDados();
  return useMemo(() => {
    const por = {};
    for (const a of dados.amostras) if (status.includes(a.status)) (por[a.osId] ||= []).push(a);
    return Object.entries(por).map(([osId, amostras]) => ({ id: osId, os: dados.ordens.find((o) => o.id === osId) || {}, amostras: amostras.sort((x, y) => x.num - y.num) }));
  }, [dados.amostras, dados.ordens, status]);
}

function colunasOS(dados, { tipoContrato = true } = {}) {
  const ct = (r) => dados.contratos.find((c) => c.id === r.os.contratoId);
  const prop = (r) => dados.propostas.find((p) => p.id === ct(r)?.propostaId);
  return [
    { t: "ID", v: (r) => Number(r.os.cod) || 0, filtro: true },
    { t: "Coletor", v: (r) => [...new Set(r.amostras.map((a) => a.coletor).filter(Boolean))].join(", "), h: (r) => { const c = [...new Set(r.amostras.map((a) => a.coletor).filter(Boolean))].join(", "); return c || <span className="lbl default">Aguardando</span>; }, filtro: true },
    { t: "Ordem Serviço", v: (r) => r.amostras[0]?.os || "", filtro: true },
    { t: "Status", v: (r) => statusDaOS(r.amostras), h: (r) => <RotuloOS s={statusDaOS(r.amostras)} />, filtro: "lista" },
    { t: "Solicitante", v: (r) => dados.solicitantes.find((s) => s.id === r.os.solicitanteId)?.razao || dados.solicitantes.find((s) => s.id === r.os.solicitanteId)?.nome || "", filtro: true },
    { t: "Cliente", v: (r) => { const c = dados.clientes.find((x) => x.id === r.os.clienteId) || {}; return c.fantasia ? `${c.razao} ( ${c.fantasia} )` : c.razao || ""; }, h: (r) => { const c = dados.clientes.find((x) => x.id === r.os.clienteId) || {}; return <a href={link("cliente", c.id)}>{c.fantasia ? `${c.razao} ( ${c.fantasia} )` : c.razao}</a>; }, filtro: true },
    { t: "Equipamentos", v: (r) => r.os.equip || ct(r)?.equip || prop(r)?.equip || "" },
    { t: "identificação", v: (r) => [...new Set(r.amostras.map((a) => a.identificacao).filter(Boolean))].join(", ") || r.os.descricao || "", filtro: true },
    { t: "Contrato", v: (r) => r.os.contrato || "", filtro: true },
    { t: "Data do agendamento", v: (r) => r.amostras[0]?.dataColeta || r.os.dataColeta || "", h: (r) => quandoBR(r.amostras[0]?.dataColeta || r.os.dataColeta), fv: (r) => quandoBR(r.amostras[0]?.dataColeta || r.os.dataColeta), filtro: true },
    { t: "Res. Coleta", v: (r) => (r.amostras[0]?.respAmostra === "Cliente" ? "Coleta pelo Cliente" : "Coleta por Minaslab Laboratório"), filtro: "lista" },
    { t: "Centro de Serv.", v: (r) => r.os.centro || "", filtro: true },
    { t: "Região", v: (r) => dados.grupos_regionais.find((g) => g.id === (r.amostras[0]?.regiao || ct(r)?.grupoRegional))?.nome || "", filtro: true },
    ...(tipoContrato ? [{ t: "Tipo de contrato", v: (r) => ct(r)?.tipoContrato || "", filtro: true }] : []),
  ];
}

function JanelaEnderecos({ linhas, onFechar }) {
  const { dados } = useDados();
  return (
    <Modal titulo="Endereços de coleta" largo onFechar={onFechar}>
      {linhas.map((r) => { const c = dados.clientes.find((x) => x.id === r.os.clienteId) || {}; const ends = enderecosDoCliente(c).filter((e) => e.status !== "Inativo"); const escolhidos = [...new Set(r.amostras.map((a) => a.enderecoColeta).filter(Boolean))]; return (
        <div key={r.id} style={{ marginBottom: 12 }}><b>{r.amostras[0]?.os}</b> · {c.razao}
          {escolhidos.length ? <p style={{ margin: "4px 0" }}><b>Endereço da coleta:</b> {escolhidos.join(" | ")}</p> : null}
          <div className="tw"><table><thead><tr><th>Tipo</th><th>Endereço</th><th>Responsável</th><th>Telefone</th></tr></thead>
            <tbody>{ends.length ? ends.map((e) => <tr key={e.id}><td>{e.tipo}{e.padrao === "Sim" ? " (padrão)" : ""}</td><td>{textoEndereco(e)}</td><td>{e.responsavel}</td><td>{e.cel || e.tel}</td></tr>) : <tr><td colSpan={4} className="vazio">Cliente sem endereço cadastrado.</td></tr>}</tbody></table></div></div>
      ); })}
    </Modal>
  );
}

function JanelaEquipamentos({ linhas, onFechar }) {
  const { dados } = useDados();
  const col = colunasOS(dados).find((c) => c.t === "Equipamentos");
  return (
    <Modal titulo="Equipamentos" onFechar={onFechar}>
      <div className="tw"><table><thead><tr><th>Ordem Serviço</th><th>Equipamentos</th></tr></thead>
        <tbody>{linhas.map((r) => <tr key={r.id}><td>{r.amostras[0]?.os}</td><td>{col.v(r) || "—"}</td></tr>)}</tbody></table></div>
      <p className="suave" style={{ marginBottom: 0 }}>Os equipamentos vêm da proposta (campo Equipamentos).</p>
    </Modal>
  );
}

const menuDocumentos = (exigir, idsAm, completo) => ({ rotulo: "Documentos", menu: [
  { rotulo: "Gerar Etiqueta", acao: exigir((s) => navegar("etiquetas", idsAm(s))) },
  ...(completo ? [{ rotulo: "Endereço coleta", acao: exigir((s, abrir) => abrir({ enderecos: s })) }] : []),
  ...(completo ? [{ rotulo: "Ficha de coleta - em branco", acao: exigir((s) => navegar("ficha-coleta", `branco.${idsAm(s)}`)) }, { rotulo: "Ficha de coleta - Preenchida", acao: exigir((s) => navegar("ficha-coleta", idsAm(s))) }] : [{ rotulo: "Ficha de coleta", acao: exigir((s) => navegar("ficha-coleta", idsAm(s))) }]),
  { rotulo: "Embalagens", acao: exigir((s) => navegar("doc-os", `embalagens.${idsAm(s)}`)) },
  ...(completo ? [] : [{ rotulo: "Plano de amostragem", acao: exigir((s) => navegar("doc-os", `plano.${idsAm(s)}`)) }]),
  { rotulo: completo ? "Análise MB - O.S" : "Ficha de análise MB - O.S", acao: exigir((s) => navegar("doc-os", `mb-os.${idsAm(s)}`)) },
  { rotulo: completo ? "Análise FQ - O.S" : "Ficha de análise FQ - O.S", acao: exigir((s) => navegar("doc-os", `fq-os.${idsAm(s)}`)) },
  ...(completo ? [{ rotulo: "Análise Subcontratado MB - O.S", acao: exigir((s) => navegar("doc-os", `sub-mb-os.${idsAm(s)}`)) }, { rotulo: "Análises Subcontratado FQ - O.S", acao: exigir((s) => navegar("doc-os", `sub-fq-os.${idsAm(s)}`)) }] : []),
] });

/* ---------- Plano de coleta pendente (agendamentos dos contratos sem OS) ---------- */

function PlanoPendente({ onFechar }) {
  const ctx = useDados();
  const { dados } = ctx;
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [ocupado, setOcupado] = useState(false);
  const linhas = dados.contratos.filter((c) => c.status !== "Inativo").flatMap((c) => (c.agendamentos || []).filter((a) => a.status === "Agendado").flatMap((a) => a.servicos.map((s, i) => ({ id: `${c.id}|${a.id}|${i}`, c, a, s, sv: c.servicos.find((x) => x.sid === s.sid) || {} }))));
  const colunas = [
    { t: "Id", v: (r) => Number(r.c.cod) || 0 },
    { t: "Cliente", v: (r) => dados.clientes.find((x) => x.id === r.c.clienteId)?.razao || "", filtro: true },
    { t: "Contrato", v: (r) => numeroContrato(r.c), filtro: true },
    { t: "Referência", v: (r) => r.a.identificacao || "", filtro: true },
    { t: "Data", v: (r) => r.a.data, h: (r) => quandoBR(r.a.data), fv: (r) => quandoBR(r.a.data), filtro: true },
    { t: "Grupo", v: (r) => r.sv.grupo || "", filtro: true },
    { t: "Matriz", v: (r) => r.sv.matriz || "", filtro: true },
    { t: "Descrição", v: (r) => `${r.sv.descricao || ""}${Number(r.s.qtd) > 1 ? ` (${r.s.qtd})` : ""}`, filtro: true },
    { t: "Legislação Aplicável", v: (r) => r.sv.legislacao || "", filtro: true },
    { t: "Total", v: (r) => totalItem({ ...r.sv, qtd: r.s.qtd }), h: (r) => brl(totalItem({ ...r.sv, qtd: r.s.qtd })) },
  ];
  const criar = async () => {
    const ags = [...new Map(linhas.filter((r) => sel.has(r.id)).map((r) => [r.a.id, r])).values()];
    if (!ags.length) { avisar("Selecione ao menos um item do plano de coleta.", "err"); return; }
    setOcupado(true);
    try {
      for (const r of ags) {
        const c = ctx.dados.contratos.find((x) => x.id === r.c.id);
        const atual = c.agendamentos.find((x) => x.id === r.a.id);
        if (atual?.status !== "Agendado") continue;
        await gerarOS(ctx, { contrato: c, servicos: atual.servicos, agendamento: atual, por: getSessao()?.nome || "" });
      }
      setSel(new Set());
      avisar(`${ags.length} ordem(ns) de serviço criada(s).`, "ok");
    } catch (e) { avisar(e.message, "err"); } finally { setOcupado(false); }
  };
  return (
    <Caixa titulo="Plano de coleta">
      <Grade id="plano-pendente" linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel} ordemInicial={[4, "asc"]} porPaginaInicial={10}
        botoes={[{ rotulo: ocupado ? "Criando…" : "Criar Agendamento", acao: criar, desativado: ocupado }, { rotulo: "Ocultar Plano de coleta", acao: onFechar }]} />
    </Caixa>
  );
}

/* ---------- Logística ---------- */

const ST_LOGISTICA = ["Em coleta", "Aguardando agendamento", "Aguardando coleta"];
const ST_COLETAS = ["Em coleta", "Coletado App", "Aguardando coleta"];

export function Logistica() {
  const { dados, salvarLote } = useDados();
  const avisar = useAviso();
  const linhas = useLinhasOS(ST_LOGISTICA);
  const [sel, setSel] = useState(new Set());
  const [chave, setChave] = useState(0);
  const [janela, setJanela] = useState(null);
  const [plano, setPlano] = useState(false);
  const colunas = colunasOS(dados);
  const marcadas = linhas.filter((r) => sel.has(r.id));
  const exigir = (fn) => () => (marcadas.length ? fn(marcadas, setJanela) : avisar("Selecione ao menos uma ordem de serviço.", "err"));
  const idsAm = (s) => s.flatMap((r) => r.amostras.map((a) => a.id)).join(".");
  const iSt = colunas.findIndex((c) => c.t === "Status"), iRes = colunas.findIndex((c) => c.t === "Res. Coleta");
  return (
    <>
      {plano && <PlanoPendente onFechar={() => setPlano(false)} />}
      <Caixa titulo="Ordem serviços - Logística">
        <Grade key={chave} id="logistica" exportar="logistica" exportarMenu linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel}
          opcoesFiltro={{ [iSt]: ST_LOGISTICA, [iRes]: ["Coleta por Minaslab Laboratório", "Coleta pelo Cliente"] }} aoAbrir={(r) => navegar("ordem", r.id)}
          botoes={[
            { rotulo: "Agendamento", acao: exigir((s) => setJanela({ agendar: s.flatMap((r) => r.amostras) })) },
            { rotulo: "Visualizar", acao: exigir((s) => navegar("ordem", s[0].id)) },
            { rotulo: "Em coleta", acao: exigir((s) => setJanela({ emColeta: s })) },
            { rotulo: "Endereço coleta", acao: exigir((s) => setJanela({ enderecos: s })) },
            { rotulo: "Equipamentos", acao: exigir((s) => setJanela({ equip: s })) },
            menuDocumentos(exigir, idsAm, false),
            { rotulo: plano ? "Ocultar Plano de coleta" : "Visualizar Plano de coleta", acao: () => setPlano((x) => !x) },
            { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setChave((k) => k + 1); } },
          ]} />
      </Caixa>
      {janela?.agendar && <Agendar amostras={janela.agendar} onFechar={() => { setJanela(null); setSel(new Set()); }} />}
      {janela?.enderecos && <JanelaEnderecos linhas={janela.enderecos} onFechar={() => setJanela(null)} />}
      {janela?.equip && <JanelaEquipamentos linhas={janela.equip} onFechar={() => setJanela(null)} />}
      {janela?.emColeta && (
        <Modal titulo="Em coleta" onFechar={() => setJanela(null)} rotuloOk="Sim" aoConfirmar={async () => {
          const am = janela.emColeta.flatMap((r) => r.amostras).filter((a) => a.status !== "Em coleta");
          if (am.some((a) => !a.coletor || !a.dataColeta)) { avisar("Faça o agendamento (responsável e data) antes de colocar em coleta.", "err"); return false; }
          try { if (am.length) await salvarLote("amostras", am.map((a) => ({ ...a, status: "Em coleta" })), { motivo: "Saiu para coleta" }); setSel(new Set()); avisar(`${am.length} amostra(s) em coleta.`, "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <p style={{ margin: 0 }}>Colocar {janela.emColeta.length} ordem(ns) de serviço em coleta?</p>
        </Modal>
      )}
    </>
  );
}

/* ---------- Coletas ---------- */

export function Coletas({ sessao }) {
  const { dados, salvarLote } = useDados();
  const avisar = useAviso();
  const todas = useLinhasOS(ST_COLETAS);
  const [sel, setSel] = useState(new Set());
  const [chave, setChave] = useState(0);
  const [janela, setJanela] = useState(null);
  const [minhas, setMinhas] = useState(false);
  const eu = (sessao?.nome || getSessao()?.nome || "").toLowerCase();
  const linhas = minhas ? todas.filter((r) => r.amostras.some((a) => String(a.coletor || "").toLowerCase() === eu)) : todas;
  const colunas = colunasOS(dados, { tipoContrato: false });
  const marcadas = linhas.filter((r) => sel.has(r.id));
  const exigir = (fn) => () => (marcadas.length ? fn(marcadas, setJanela) : avisar("Selecione ao menos uma ordem de serviço.", "err"));
  const idsAm = (s) => s.flatMap((r) => r.amostras.map((a) => a.id)).join(".");
  const iSt = colunas.findIndex((c) => c.t === "Status"), iRes = colunas.findIndex((c) => c.t === "Res. Coleta");
  const situacao = (st) => exigir(async (s) => {
    const am = s.flatMap((r) => r.amostras).filter((a) => a.status !== st);
    try { if (am.length) await salvarLote("amostras", am.map((a) => ({ ...a, status: st })), { motivo: `Situação da amostra: ${st}` }); setSel(new Set()); avisar(`${am.length} amostra(s) em "${st}".`, "ok"); } catch (e) { avisar(e.message, "err"); }
  });
  const baixar = () => { const csv = paraCSV(linhas, colunas); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const el = document.createElement("a"); el.href = url; el.download = `coletas-${isoDia(0)}.csv`; el.click(); URL.revokeObjectURL(url); };
  return (
    <Caixa titulo="Ordem serviços - Coletas">
      <Grade key={chave} id="coletas" exportar="coletas" exportarMenu linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel}
        opcoesFiltro={{ [iSt]: ST_COLETAS, [iRes]: ["Coleta por Minaslab Laboratório", "Coleta pelo Cliente"] }} aoAbrir={(r) => navegar("coleta", r.amostras.map((a) => a.id).join("."))}
        botoes={[
          { rotulo: "Dados", menu: [{ rotulo: "Exportar", acao: baixar }] },
          { rotulo: "Situação da amostra", menu: [{ rotulo: "Aguardando coleta", acao: situacao("Aguardando coleta") }, { rotulo: "Em coleta", acao: situacao("Em coleta") }] },
          { rotulo: "Tarefas", menu: [{ rotulo: "Minhas Tarefas", marcado: minhas, acao: () => { setMinhas(true); setSel(new Set()); } }, { rotulo: "Todas Tarefas", marcado: !minhas, padrao: true, acao: () => { setMinhas(false); setSel(new Set()); } }] },
          menuDocumentos(exigir, idsAm, true),
          { rotulo: "Edição Dinâmica", acao: exigir((s) => navegar("coleta", idsAm(s))) },
          { rotulo: "Visualizar", acao: exigir((s) => navegar("ordem", s[0].id)) },
          { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setMinhas(false); setChave((k) => k + 1); } },
        ]} />
      {janela?.enderecos && <JanelaEnderecos linhas={janela.enderecos} onFechar={() => setJanela(null)} />}
    </Caixa>
  );
}

/* ---------- Registrar coleta ---------- */

// Edição Dinâmica (GerenciaLab): as amostras das OS selecionadas numa tela só,
// com as abas Rastreabilidade da amostragem (plano de amostragem, vale para
// todas), Dados principais (ponto, coletor, data/hora) e Dados adicionais
// (campos da coleta e análises in loco de cada amostra).
export function RegistrarColeta({ param }) {
  const { dados, salvarLote } = useDados();
  const avisar = useAviso();
  const ids = String(param || "").split(".").filter(Boolean);
  const amostras = ids.map((id) => dados.amostras.find((x) => x.id === id)).filter(Boolean);
  const [aba, setAba] = useState("Dados principais da amostras");
  const [ed, setEd] = useState(() => Object.fromEntries(amostras.map((a) => [a.id, { coletor: a.coletor || getSessao()?.nome || "", dataColeta: (a.dataColeta || agoraLocal()).slice(0, 16), ident: a.identificacao || "", campos: { ...(a.fichaColeta || {}) }, inloco: {} }])));
  const [plano, setPlano] = useState(() => ({ ...(amostras[0]?.fichaColeta || {}) }));
  const [aberta, setAberta] = useState(amostras[0]?.id || "");
  const [ocupado, setOcupado] = useState(false);
  if (!amostras.length) return <NaoAchou />;
  const cfg = configSistema(dados);
  const statusFinal = cfg.coletaStatusFinal === "Status Laboratório" ? "Laboratório" : "Aguardando Inspeção";
  const defsPlano = camposAtivos(dados.plano_amostragem, (d) => d.resultadoFinal !== "Nenhum");
  const defsDe = (a) => { const c = dados.contratos.find((x) => x.id === a.contratoId); const pac = dados.pacotes.find((p) => p.id === c?.servicos?.find((s) => s.sid === a.sid)?.pacoteId); return camposAtivos(dados.campos_coleta, (d) => !d.grupo || d.grupo === pac?.grupo); };
  const inlocoDe = (a) => a.analises.filter((x) => dados.parametros.find((p) => p.id === x.pid)?.inloco === "Sim");
  const set = (id, k, v) => setEd((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  const montar = (a, finalizar) => {
    const e = ed[a.id];
    const campos = { ...plano, ...e.campos };
    if (!finalizar) return { ...a, coletor: e.coletor.trim(), dataColeta: e.dataColeta, identificacao: e.ident, fichaColeta: campos };
    const nova = { ...registrarColeta(a, { coletor: e.coletor.trim(), dataColeta: e.dataColeta, campos, inloco: e.inloco }, statusFinal), identificacao: e.ident };
    if (statusFinal === "Laboratório" && !nova.dataEntrada) nova.dataEntrada = agoraLocal();
    return nova;
  };
  const gravar = async (finalizar) => {
    setOcupado(true);
    try {
      if (finalizar) { const ag = agoraLocal(); const fut = amostras.filter((a) => (ed[a.id].dataColeta || "") > ag); if (fut.length) throw new Error(`Data e hora da coleta no futuro (${fut.map(referenciaAmostra).join(", ")}). Informe quando a coleta foi feita.`); }
      const novas = amostras.map((a) => montar(a, finalizar));
      await salvarLote("amostras", novas, { motivo: finalizar ? "Coleta registrada" : "Edição dinâmica da coleta" });
      avisar(finalizar ? `Coleta finalizada: ${novas.length} amostra(s) em "${statusFinal}".` : "Dados da coleta salvos.", "ok");
      if (finalizar) navegar("collections");
    } catch (e) { avisar(e.message, "err"); } finally { setOcupado(false); }
  };
  const osDe = [...new Set(amostras.map((a) => a.os))];
  const grupoDe = (a) => { const c = dados.contratos.find((x) => x.id === a.contratoId); return c?.servicos?.find((s) => s.sid === a.sid)?.grupo || ""; };
  return (
    <Caixa cabecalho={`Edição Dinâmica · ${osDe.join(", ")} · ${amostras.length} amostra(s)`}>
      <div className="abas" role="tablist">{["Rastreabilidade da amostragem", "Dados principais da amostras", "Dados Adicionais"].map((t) => <button key={t} type="button" role="tab" aria-selected={aba === t} className={aba === t ? "on" : ""} onClick={() => setAba(t)}>{t}</button>)}</div>
      <div style={{ marginTop: 16 }}>
        {aba === "Rastreabilidade da amostragem" && (defsPlano.length ? <CamposDinamicos prefixo="pla" defs={defsPlano} valor={plano} set={setPlano} /> : <p className="suave">Nenhum campo de plano de amostragem configurado (Configurações → Plano de amostragem).</p>)}
        {aba === "Dados principais da amostras" && (
          <div className="tw"><table>
            <thead><tr>{["Amostra Id", "Referência", "Código barra", "Grupo", "Descrição", "Responsável pela coleta", "Data e hora da coleta"].map((t) => <th key={t}>{t}</th>)}</tr></thead>
            <tbody>{amostras.map((a) => (
              <tr key={a.id}><td>{a.cod}</td><td>{referenciaAmostra(a)}</td><td>{a.barra}</td><td>{grupoDe(a)}</td>
                <td><input aria-label={`Descrição ${referenciaAmostra(a)}`} value={ed[a.id].ident} onChange={(e) => set(a.id, "ident", e.target.value)} placeholder={a.matriz || a.servico} /></td>
                <td><input aria-label={`Coletor ${referenciaAmostra(a)}`} list="pessoas-col" value={ed[a.id].coletor} onChange={(e) => set(a.id, "coletor", e.target.value)} /></td>
                <td><input aria-label={`Data ${referenciaAmostra(a)}`} type="datetime-local" value={ed[a.id].dataColeta} onChange={(e) => set(a.id, "dataColeta", e.target.value)} /></td></tr>
            ))}</tbody>
          </table><Pessoas id="pessoas-col" /></div>
        )}
        {aba === "Dados Adicionais" && amostras.map((a) => { const defs = defsDe(a), il = inlocoDe(a); return (
          <div key={a.id} className="quadro" style={{ marginBottom: 10 }}>
            <button type="button" className="dbtn" onClick={() => setAberta(aberta === a.id ? "" : a.id)}>{aberta === a.id ? "▾" : "▸"} {referenciaAmostra(a)} · {a.barra} · {ed[a.id].ident || a.matriz || a.servico}</button>
            {aberta === a.id && <div style={{ marginTop: 10 }}>
              {defs.length ? <CamposDinamicos prefixo={`col-${a.id}`} defs={defs} valor={ed[a.id].campos} set={(v) => set(a.id, "campos", v)} /> : <p className="suave" style={{ margin: 0 }}>Nenhum campo de coleta configurado (Configurações → Coleta).</p>}
              {il.length > 0 && <div className="tw" style={{ marginTop: 10 }}><table><thead><tr><th>Análise in loco</th><th>Resultado</th><th>Unidade</th><th>Método</th></tr></thead>
                <tbody>{il.map((x) => <tr key={x.pid}><td>{x.nome}</td><td><input aria-label={`Resultado ${x.nome} ${referenciaAmostra(a)}`} value={ed[a.id].inloco[x.pid] ?? x.resultado ?? ""} onChange={(e) => set(a.id, "inloco", { ...ed[a.id].inloco, [x.pid]: e.target.value })} /></td><td>{x.un}</td><td>{x.metodo}</td></tr>)}</tbody></table></div>}
            </div>}
          </div>
        ); })}
      </div>
      <div className="acoes" style={{ marginTop: 16 }}>
        <a className="btn btn-default" href={link("collections")}>Voltar</a>
        <a className="btn btn-default" href={link("ficha-coleta", ids.join("."))}>Cadeia de custódia</a>
        <button type="button" className="btn btn-default" disabled={ocupado} onClick={() => gravar(false)}>Salvar</button>
        <button type="button" className="btn btn-success" disabled={ocupado} onClick={() => gravar(true)}>{ocupado ? "Salvando…" : "Finalizar Coleta"}</button>
      </div>
    </Caixa>
  );
}

/* ---------- Ficha de coleta / Cadeia de custódia (impressão) ---------- */

export function FichaCustodia({ param }) {
  const { dados } = useDados();
  const ids = String(param || "").split(".").filter(Boolean);
  const branco = ids[0] === "branco";
  if (branco) ids.shift();
  const amostras = ids.map((id) => dados.amostras.find((a) => a.id === id)).filter(Boolean).map((a) => (branco ? { ...a, dataColeta: "", coletor: "", fichaColeta: {} } : a));
  if (!amostras.length) return <NaoAchou />;
  const cfg = configSistema(dados);
  const defsColeta = camposAtivos(dados.campos_coleta);
  return (
    <>
      <div className="box nao-imprimir"><div className="box-head-row"><h2 className="box-title">Cadeia de custódia · {amostras.length} amostra(s)</h2>
        <div className="acoes"><button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir</button><button type="button" className="btn btn-default" onClick={() => window.history.back()}>Voltar</button></div></div></div>
      {amostras.map((a) => {
        const cli = dados.clientes.find((c) => c.id === a.clienteId) || {};
        const preenchidos = valoresDinamicos(defsColeta, a.fichaColeta);
        return (
          <div className="doc" key={a.id}>
            <div className="doc-topo"><img src={logoMinasLab} alt="MinasLab" width="120" height="36" /><div><b>Cadeia de custódia / Ficha de coleta</b><br /><span className="suave">{cfg.empresa || "MinasLab"}{cfg.cnpj ? ` · CNPJ ${cfg.cnpj}` : ""}</span></div><div style={{ width: 180 }}><CodigoBarras texto={a.barra} altura={34} /><div className="et-barra">{a.barra}</div></div></div>
            <dl className="detail">
              <div><dt>Amostra</dt><dd>{referenciaAmostra(a)}</dd></div><div><dt>Ordem de serviço</dt><dd>{a.os}</dd></div>
              <div><dt>Cliente</dt><dd>{cli.razao}</dd></div><div><dt>CNPJ/CPF</dt><dd>{cli.doc}</dd></div>
              <div><dt>Serviço / Matriz</dt><dd>{a.servico}{a.matriz ? ` — ${a.matriz}` : ""}</dd></div><div><dt>Legislação</dt><dd>{a.legislacao}</dd></div>
              <div><dt>Identificação / ponto</dt><dd>{a.identificacao || "______________________"}</dd></div><div><dt>Data e hora da coleta</dt><dd>{quandoBR(a.dataColeta) || "____/____/______ ____:____"}</dd></div>
              <div><dt>Responsável pela coleta</dt><dd>{a.coletor || "______________________"}</dd></div><div><dt>Coleta por</dt><dd>{a.respAmostra === "Cliente" ? "Cliente" : "MinasLab"}</dd></div>
            </dl>
            <table className="doc-tab"><thead><tr><th>Parâmetro</th><th>Método</th><th>Frasco / embalagem</th><th>Preservante</th><th>Quantidade</th></tr></thead>
              <tbody>{a.analises.map((x) => { const p = dados.parametros.find((q) => q.id === x.pid) || {}; return <tr key={x.pid}><td>{x.nome}</td><td>{x.metodo}</td><td>{p.embalagem || ""}</td><td>{dados.preservantes.find((q) => q.id === p.preservante)?.nome || ""}</td><td>{p.quantidade || ""}</td></tr>; })}</tbody></table>
            {preenchidos.length ? <table className="doc-tab"><tbody>{preenchidos.map(([t, v]) => <tr key={t}><th style={{ width: "40%" }}>{t}</th><td>{v}</td></tr>)}</tbody></table>
              : defsColeta.length ? <table className="doc-tab"><tbody>{defsColeta.map((d) => <tr key={d.id}><th style={{ width: "40%" }}>{d.titulo}</th><td>&nbsp;</td></tr>)}</tbody></table> : null}
            <table className="doc-tab"><thead><tr><th>Etapa</th><th>Nome</th><th>Data e hora</th><th>Assinatura</th></tr></thead>
              <tbody>{["Coletado por", "Transportado por", "Recebido no laboratório por"].map((e) => <tr key={e}><td>{e}</td><td /><td /><td style={{ height: 28 }} /></tr>)}</tbody></table>
          </div>
        );
      })}
    </>
  );
}

/* ---------- Agenda ---------- */

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const CORES_AGENDA = ["#1f77b4", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#17becf", "#bcbd22", "#ff7f0e", "#7f7f7f"];
const ST_AGENDA = ["Em coleta", "Coletado App", "Aguardando coleta", "Aguardando agendamento"];

export function Agenda() {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const hoje = isoDia(0);
  const [dia, setDia] = useState(hoje);
  const [vista, setVista] = useState("Lista");
  const [fSt, setFSt] = useState("Todos");
  const [fResp, setFResp] = useState("Todos");
  const [janela, setJanela] = useState(null);
  const pessoas = dados.funcionarios.filter(estaAtivo).map((f) => f.nome);
  const cor = (nome) => { const i = pessoas.indexOf(nome); return i < 0 ? "#9aa5a8" : CORES_AGENDA[i % CORES_AGENDA.length]; };
  const eventos = useMemo(() => {
    const ev = [];
    const porOS = {};
    for (const a of dados.amostras) if (a.dataColeta && ST_AGENDA.includes(a.status)) (porOS[`${a.osId}|${a.dataColeta.slice(0, 16)}`] ||= []).push(a);
    for (const [k, l] of Object.entries(porOS)) {
      const c = dados.clientes.find((x) => x.id === l[0].clienteId) || {};
      ev.push({ id: k, dia: l[0].dataColeta.slice(0, 10), hora: l[0].dataColeta.slice(11, 16), resp: l[0].coletor || "", status: l[0].status, texto: `${l[0].os} ${c.razao || ""}${c.fantasia ? ` ( ${c.fantasia} )` : ""} | Coletor: ${l[0].coletor || "Aguardando"}`, tipo: "coleta", osId: l[0].osId });
    }
    for (const g of dados.agenda) if (g.status !== "Cancelado") ev.push({ id: g.id, dia: (g.data || "").slice(0, 10), hora: (g.data || "").slice(11, 16), resp: g.responsavel || "", status: "", texto: `${g.descricao}${g.responsavel ? ` | ${g.responsavel}` : ""}`, tipo: "agenda", reg: g });
    return ev.filter((e) => (fSt === "Todos" || e.status === fSt) && (fResp === "Todos" || e.resp === fResp)).sort((a, b) => `${a.dia}${a.hora}`.localeCompare(`${b.dia}${b.hora}`));
  }, [dados.amostras, dados.agenda, dados.clientes, fSt, fResp]);
  const mes = dia.slice(0, 7);
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(ano, m - 1, 1);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const celulas = [...Array(primeiro.getDay()).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
  const mover = (n) => { if (vista === "Dia") { const d = new Date(`${dia}T12:00:00`); d.setDate(d.getDate() + n); setDia(d.toISOString().slice(0, 10)); } else { const d = new Date(ano, m - 1 + n, 1); setDia(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`); } };
  const titulo = vista === "Dia" ? new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const abrir = (e) => (e.tipo === "coleta" ? navegar("ordem", e.osId) : setJanela({ ...e.reg }));
  const evBotao = (e, curto) => <button type="button" key={e.id} className={`cal-ev ${e.tipo}`} style={{ borderLeft: `4px solid ${cor(e.resp)}` }} title={e.texto} onClick={() => abrir(e)}>{e.hora} {curto ? e.texto.split(" | ")[0] : e.texto}</button>;
  const doMes = eventos.filter((e) => e.dia.startsWith(mes));
  const porDia = [...new Set(doMes.map((e) => e.dia))];
  return (
    <Caixa titulo="Ordem serviços - Logística">
      <div className="agenda-lay">
        <aside className="agenda-usuarios"><div className="agenda-usu-tit">Usuários</div>{pessoas.map((n) => <button key={n} type="button" className={fResp === n ? "on" : ""} onClick={() => setFResp(fResp === n ? "Todos" : n)}><span style={{ color: cor(n) }}>●</span>{n}</button>)}</aside>
        <div style={{ minWidth: 0 }}>
          <div className="frm" style={{ marginBottom: 10 }}>
            <div className="fg s6"><label htmlFor="agSt">Status</label><select id="agSt" value={fSt} onChange={(e) => setFSt(e.target.value)}>{opcoes(["Todos", ...ST_AGENDA])}</select></div>
            <div className="fg s6"><label htmlFor="agResp">Responsável</label><select id="agResp" value={fResp} onChange={(e) => setFResp(e.target.value)}>{opcoes(["Todos", ...pessoas])}</select></div>
          </div>
          <div className="acoes" style={{ alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="acoes"><button type="button" className="btn btn-default btn-sm" onClick={() => setDia(hoje)}>Hoje</button><button type="button" className="btn btn-default btn-sm" aria-label="Anterior" onClick={() => mover(-1)}>‹</button><button type="button" className="btn btn-default btn-sm" aria-label="Próximo" onClick={() => mover(1)}>›</button>
              <button type="button" className="btn btn-default btn-sm" onClick={() => setJanela({ descricao: "", data: `${dia}T08:00`, responsavel: "", status: "Agendado" })}>Adicionar</button></div>
            <b style={{ fontSize: 18 }}>{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</b>
            <div className="acoes">{["Mês", "Dia", "Lista"].map((v) => <button key={v} type="button" className={`btn btn-sm ${vista === v ? "btn-primary" : "btn-default"}`} onClick={() => setVista(v)}>{v}</button>)}</div>
          </div>
          {vista === "Mês" && <div className="tw"><div className="cal">
            {DIAS.map((d) => <div key={d} className="cal-dia-sem">{d}</div>)}
            {celulas.map((d, i) => (
              <div key={i} className={`cal-cel${d === hoje ? " hoje" : ""}${d ? "" : " vazia"}`}>
                {d && <div className="cal-num">{Number(d.slice(8))}</div>}
                {d && eventos.filter((e) => e.dia === d).map((e) => evBotao(e, true))}
              </div>
            ))}
          </div></div>}
          {vista === "Dia" && <div className="agenda-lista">{eventos.filter((e) => e.dia === dia).length ? eventos.filter((e) => e.dia === dia).map((e) => evBotao(e)) : <p className="suave">Nenhum evento neste dia.</p>}</div>}
          {vista === "Lista" && <div className="agenda-lista">{porDia.length ? porDia.map((d) => (
            <div key={d}><div className="agenda-dia"><b>{new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</b><span>{(() => { const t = new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }); return t.charAt(0).toUpperCase() + t.slice(1); })()}</span></div>
              {doMes.filter((e) => e.dia === d).map((e) => evBotao(e))}</div>
          )) : <p className="suave">Nenhum evento neste mês.</p>}</div>}
        </div>
      </div>
      {janela && (
        <Modal titulo={janela.id ? "Atualizar agendamento" : "Adicionar Agenda"} onFechar={() => setJanela(null)} rotuloOk={janela.id ? "Atualizar agendamento" : "Agendar"}
          extra={janela.id ? <button type="button" className="btn btn-danger" onClick={async () => { try { await salvar("agenda", { ...janela, status: "Cancelado" }, { motivo: "Agendamento cancelado" }); setJanela(null); avisar("Agendamento cancelado.", "ok"); } catch (e) { avisar(e.message, "err"); } }}>Cancelar Agendamento</button> : null}
          aoConfirmar={async () => {
            if (!janela.descricao.trim() || !janela.data) { avisar("Informe a descrição e a data.", "err"); return false; }
            try { await salvar("agenda", janela, { numerar: !janela.id }); avisar("Agenda salva.", "ok"); } catch (e) { avisar(e.message, "err"); return false; }
          }}>
          <div className="fg"><label htmlFor="gDesc">Descrição</label><input id="gDesc" value={janela.descricao} onChange={(e) => setJanela({ ...janela, descricao: e.target.value })} /></div>
          <div className="fg"><label htmlFor="gData">Data e Hora</label><input id="gData" type="datetime-local" value={janela.data} onChange={(e) => setJanela({ ...janela, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="gResp">Responsável</label><select id="gResp" value={janela.responsavel} onChange={(e) => setJanela({ ...janela, responsavel: e.target.value })}>{opcoes([["", "Selecione"], ...pessoas])}</select></div>
          <div className="fg"><label htmlFor="gSt">Status</label><select id="gSt" value={janela.status} onChange={(e) => setJanela({ ...janela, status: e.target.value })}>{opcoes(["Agendado", "Concluído", "Cancelado"])}</select></div>
        </Modal>
      )}
    </Caixa>
  );
}

/* ---------- Descarte de amostras ---------- */

export function Descarte() {
  const { dados, salvarLote } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [chave, setChave] = useState(0);
  const [janela, setJanela] = useState(null);
  const dias = Number(configSistema(dados).diasDescarte) || 30;
  const linhas = dados.amostras.filter((a) => a.dataEntrada && !["Cancelado"].includes(a.status));
  const colunas = [
    { t: "ID", v: (r) => Number(r.cod) || 0 },
    { t: "Amostra", v: (r) => referenciaAmostra(r), filtro: true },
    { t: "Código barra", v: (r) => r.barra, filtro: true },
    { t: "Grupo", v: (r) => r.servico, filtro: true },
    { t: "Matriz", v: (r) => r.matriz || "", filtro: true },
    { t: "Descrição", v: (r) => r.identificacao || "", filtro: true },
    { t: "Data para descarte", v: (r) => dataParaDescarte(r, dias), h: (r) => { const d = dataParaDescarte(r, dias); return <span className={!r.descarte && d <= isoDia(0) ? "lbl crit" : ""}>{dataBR(d)}</span>; }, fv: (r) => dataBR(dataParaDescarte(r, dias)), filtro: true },
    { t: "Data do descarte", v: (r) => r.descarte?.data || "", h: (r) => dataBR(r.descarte?.data), fv: (r) => dataBR(r.descarte?.data), filtro: true },
    { t: "status", v: (r) => (r.descarte ? "Concluído" : "Aguardando"), filtro: "lista" },
    { t: "Responsável descarte", v: (r) => r.descarte?.responsavel || "", filtro: true },
  ];
  const selecionadas = linhas.filter((a) => sel.has(a.id));
  return (
    <Caixa titulo="Descarte de amostras">
      <p className="suave" style={{ marginTop: -6 }}>Guarda de {dias} dias após a entrada no laboratório (Configuração do sistema → Coleta). Em vermelho: prazo de guarda vencido.</p>
      <Grade key={chave} id="descarte" exportar="descarte-amostras" linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel} opcoesFiltro={{ 8: ["Aguardando", "Concluído"] }} ordemInicial={[6, "asc"]}
        botoes={[{ rotulo: "Descartar amostra", acao: () => { const s = selecionadas.filter((a) => !a.descarte); if (!s.length) { avisar("Selecione amostras aguardando descarte.", "err"); return; } setJanela({ amostras: s, data: isoDia(0), responsavel: getSessao()?.nome || "", obs: "" }); } }, { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setChave((k) => k + 1); } }]} />
      {janela && (
        <Modal titulo={`Descartar amostra · ${janela.amostras.length} amostra(s)`} onFechar={() => setJanela(null)} rotuloOk="Registrar" aoConfirmar={async () => {
          if (!janela.responsavel.trim()) { avisar("Informe o responsável pelo descarte.", "err"); return false; }
          const cedo = janela.amostras.filter((a) => !["Concluída", "Faturamento", "Assinatura"].includes(a.status));
          if (cedo.length) { avisar(`${cedo.length} amostra(s) ainda sem resultado revisado. Descarte só depois da revisão.`, "err"); return false; }
          try { await salvarLote("amostras", janela.amostras.map((a) => ({ ...a, descarte: { data: janela.data, responsavel: janela.responsavel.trim(), obs: janela.obs } })), { motivo: "Descarte de amostra" }); setSel(new Set()); avisar("Descarte registrado.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="dData">Data do descarte</label><input id="dData" type="date" value={janela.data} onChange={(e) => setJanela({ ...janela, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="dResp">Responsável descarte</label><input id="dResp" list="pessoas-desc" value={janela.responsavel} onChange={(e) => setJanela({ ...janela, responsavel: e.target.value })} /><Pessoas id="pessoas-desc" /></div>
          <div className="fg"><label htmlFor="dObs">Observação (forma de descarte)</label><input id="dObs" value={janela.obs} onChange={(e) => setJanela({ ...janela, obs: e.target.value })} /></div>
        </Modal>
      )}
    </Caixa>
  );
}

