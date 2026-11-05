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
import { referenciaAmostra } from "../lib/ordens.js";
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

/* ---------- Agendar (Logística e Coletas) ---------- */

function Agendar({ amostras, onFechar }) {
  const { salvarLote } = useDados();
  const avisar = useAviso();
  const [f, setF] = useState({ coletor: amostras[0]?.coletor || "", data: (amostras[0]?.dataColeta || `${isoDia(1)}T08:00`).slice(0, 16), obs: "" });
  return (
    <Modal titulo={`Agendamento · ${amostras.length} amostra(s)`} onFechar={onFechar} rotuloOk="Agendar" aoConfirmar={async () => {
      if (!f.coletor.trim() || !f.data) { avisar("Informe o responsável pela coleta e a data.", "err"); return false; }
      try {
        await salvarLote("amostras", amostras.map((a) => ({ ...a, coletor: f.coletor.trim(), dataColeta: f.data, obsLogistica: f.obs || a.obsLogistica || "", status: a.status === "Aguardando agendamento" ? "Aguardando coleta" : a.status })), { motivo: "Agendamento da coleta" });
        avisar("Coleta agendada.", "ok");
      } catch (e) { avisar(e.message, "err"); return false; }
    }}>
      <div className="fg"><label htmlFor="agCol">Responsável pela coleta</label><input id="agCol" list="pessoas-ag" value={f.coletor} onChange={(e) => setF({ ...f, coletor: e.target.value })} /><Pessoas id="pessoas-ag" /></div>
      <div className="fg"><label htmlFor="agData">Data e Hora da Coleta</label><input id="agData" type="datetime-local" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
      <div className="fg"><label htmlFor="agObs">Observações internas</label><textarea id="agObs" rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></div>
    </Modal>
  );
}

function ListaColeta({ titulo, id, status, extras = [], botoesExtra = () => [] }) {
  const { dados } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [janela, setJanela] = useState(null);
  const linhas = dados.amostras.filter((a) => status.includes(a.status));
  const colunas = colunasAmostra(dados, [{ t: "Coletor", v: (r) => r.coletor || "", filtro: true }, ...extras]);
  const iSt = colunas.findIndex((c) => c.t === "Status"), iRes = colunas.findIndex((c) => c.t === "Res. Coleta");
  const selecionadas = linhas.filter((a) => sel.has(a.id));
  const exigir = (fn) => () => (selecionadas.length ? fn(selecionadas) : avisar("Selecione ao menos uma amostra.", "err"));
  return (
    <Caixa titulo={titulo}>
      <Grade id={id} exportar={id} linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel}
        opcoesFiltro={{ [iSt]: status, [iRes]: ["Coleta por Minaslab", "Coleta pelo Cliente"] }} aoAbrir={(r) => navegar("ordem", r.osId)}
        botoes={[
          { rotulo: "Agendar", acao: exigir((s) => setJanela(s)) },
          ...botoesExtra(selecionadas, exigir),
          { rotulo: "Ficha de coleta / Cadeia de custódia", acao: exigir((s) => navegar("ficha-coleta", s.map((a) => a.id).join("."))) },
          { rotulo: "Gerar Etiqueta", acao: exigir((s) => navegar("etiquetas", s.map((a) => a.id).join("."))) },
        ]} />
      {janela && <Agendar amostras={janela} onFechar={() => { setJanela(null); setSel(new Set()); }} />}
    </Caixa>
  );
}

export const Logistica = () => <ListaColeta titulo="Ordem serviços - Logística" id="logistica" status={["Aguardando agendamento", "Aguardando coleta", "Em coleta"]} />;

export function Coletas() {
  return (
    <ListaColeta titulo="Ordem serviços - Coletas" id="coletas" status={["Aguardando coleta", "Em coleta", "Coletado App"]}
      botoesExtra={(_, exigir) => [{ rotulo: "Registrar coleta", acao: exigir((s) => navegar("coleta", s[0].id)) }]} />
  );
}

/* ---------- Registrar coleta ---------- */

export function RegistrarColeta({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const a = dados.amostras.find((x) => x.id === param);
  const [f, setF] = useState(() => ({ coletor: a?.coletor || "", dataColeta: (a?.dataColeta || agoraLocal()).slice(0, 16), campos: a?.fichaColeta || {}, inloco: {} }));
  const [ocupado, setOcupado] = useState(false);
  if (!a) return <NaoAchou />;
  const contrato = dados.contratos.find((c) => c.id === a.contratoId);
  const pacote = dados.pacotes.find((p) => p.id === contrato?.servicos?.find((s) => s.sid === a.sid)?.pacoteId);
  const defsColeta = camposAtivos(dados.campos_coleta, (d) => !d.grupo || d.grupo === pacote?.grupo);
  const defsPlano = camposAtivos(dados.plano_amostragem, (d) => d.resultadoFinal !== "Nenhum");
  const inloco = a.analises.filter((x) => dados.parametros.find((p) => p.id === x.pid)?.inloco === "Sim");
  const cfg = configSistema(dados);
  const statusFinal = cfg.coletaStatusFinal === "Status Laboratório" ? "Laboratório" : "Aguardando Inspeção";
  const gravar = async () => {
    setOcupado(true);
    try {
      const { _ident, ...campos } = f.campos;
      const nova = { ...registrarColeta(a, { coletor: f.coletor.trim(), dataColeta: f.dataColeta, campos, inloco: f.inloco }, statusFinal), identificacao: _ident ?? a.identificacao ?? "" };
      if (statusFinal === "Laboratório" && !nova.dataEntrada) nova.dataEntrada = agoraLocal();
      await salvar("amostras", nova, { motivo: "Coleta registrada" });
      avisar(`Coleta registrada. Amostra em "${statusFinal}".`, "ok");
      navegar("collections");
    } catch (e) { avisar(e.message, "err"); } finally { setOcupado(false); }
  };
  return (
    <>
      <Caixa cabecalho={`Registrar coleta · ${referenciaAmostra(a)} · ${a.barra}`}>
        <p style={{ marginTop: 0 }}><b>{a.servico}</b>{a.matriz ? ` — ${a.matriz}` : ""} · {dados.clientes.find((c) => c.id === a.clienteId)?.razao} · <a href={link("ordem", a.osId)}>{a.os}</a> · <RotuloOS s={a.status} /></p>
        <div className="frm">
          <div className="fg s4"><label htmlFor="cCol">Responsável pela coleta *</label><input id="cCol" list="pessoas-col" value={f.coletor} onChange={(e) => setF({ ...f, coletor: e.target.value })} /><Pessoas id="pessoas-col" /></div>
          <div className="fg s4"><label htmlFor="cData">Data e Hora da Coleta *</label><input id="cData" type="datetime-local" value={f.dataColeta} onChange={(e) => setF({ ...f, dataColeta: e.target.value })} /></div>
          <div className="fg s4"><label htmlFor="cIdent">Identificação / ponto de coleta</label><input id="cIdent" value={f.campos._ident ?? a.identificacao ?? ""} onChange={(e) => setF({ ...f, campos: { ...f.campos, _ident: e.target.value } })} /></div>
        </div>
      </Caixa>
      <Caixa titulo="Dados da coleta">
        {defsColeta.length ? <CamposDinamicos prefixo="col" defs={defsColeta} valor={f.campos} set={(v) => setF({ ...f, campos: v })} /> : <p className="suave" style={{ margin: 0 }}>Nenhum campo configurado. Cadastre em Configurações → Coleta.</p>}
      </Caixa>
      {defsPlano.length > 0 && <Caixa titulo="Plano de amostragem / condições ambientais"><CamposDinamicos prefixo="pla" defs={defsPlano} valor={f.campos} set={(v) => setF({ ...f, campos: v })} /></Caixa>}
      {inloco.length > 0 && (
        <Caixa titulo="Análises in loco">
          <div className="tw"><table><thead><tr><th>Parâmetro</th><th>Resultado</th><th>Unidade</th><th>Método</th></tr></thead>
            <tbody>{inloco.map((x) => <tr key={x.pid}><td>{x.nome}</td><td><input aria-label={`Resultado ${x.nome}`} value={f.inloco[x.pid] ?? x.resultado ?? ""} onChange={(e) => setF({ ...f, inloco: { ...f.inloco, [x.pid]: e.target.value } })} /></td><td>{x.un}</td><td>{x.metodo}</td></tr>)}</tbody></table></div>
        </Caixa>
      )}
      <div className="acoes"><a className="btn btn-default" href={link("collections")}>Voltar</a><a className="btn btn-default" href={link("ficha-coleta", a.id)}>Cadeia de custódia</a><button type="button" className="btn btn-success" disabled={ocupado} onClick={gravar}>{ocupado ? "Salvando…" : "Finalizar coleta"}</button></div>
    </>
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

export function Agenda() {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [mes, setMes] = useState(() => isoDia(0).slice(0, 7));
  const [janela, setJanela] = useState(null);
  const eventos = useMemo(() => {
    const ev = [];
    const porOS = {};
    for (const a of dados.amostras) if (a.dataColeta && !["Cancelado", "Processo de cancelamento"].includes(a.status)) (porOS[`${a.osId}|${a.dataColeta.slice(0, 10)}`] ||= []).push(a);
    for (const [k, l] of Object.entries(porOS)) ev.push({ id: k, dia: l[0].dataColeta.slice(0, 10), hora: l[0].dataColeta.slice(11, 16), texto: `${l[0].os} · ${l.length} amostra(s) · ${dados.clientes.find((c) => c.id === l[0].clienteId)?.razao || ""}${l[0].coletor ? ` · ${l[0].coletor}` : ""}`, tipo: "coleta", osId: l[0].osId });
    for (const g of dados.agenda) if (g.status !== "Cancelado") ev.push({ id: g.id, dia: (g.data || "").slice(0, 10), hora: (g.data || "").slice(11, 16), texto: `${g.descricao}${g.responsavel ? ` · ${g.responsavel}` : ""}`, tipo: "agenda", reg: g });
    return ev;
  }, [dados.amostras, dados.agenda, dados.clientes]);
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(ano, m - 1, 1);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const celulas = [...Array(primeiro.getDay()).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
  const mover = (n) => { const d = new Date(ano, m - 1 + n, 1); setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const nomeMes = primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const hoje = isoDia(0);
  return (
    <Caixa titulo="Agenda">
      <div className="acoes" style={{ alignItems: "center", marginBottom: 10 }}>
        <button type="button" className="btn btn-default btn-sm" onClick={() => mover(-1)}>‹ Anterior</button>
        <b style={{ textTransform: "capitalize", minWidth: 150, textAlign: "center" }}>{nomeMes}</b>
        <button type="button" className="btn btn-default btn-sm" onClick={() => mover(1)}>Próximo ›</button>
        <button type="button" className="btn btn-default btn-sm" onClick={() => setMes(hoje.slice(0, 7))}>Hoje</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setJanela({ descricao: "", data: `${hoje}T08:00`, responsavel: "", status: "Agendado" })}>Adicionar Agenda</button>
      </div>
      <div className="tw"><div className="cal">
        {DIAS.map((d) => <div key={d} className="cal-dia-sem">{d}</div>)}
        {celulas.map((d, i) => (
          <div key={i} className={`cal-cel${d === hoje ? " hoje" : ""}${d ? "" : " vazia"}`}>
            {d && <div className="cal-num">{Number(d.slice(8))}</div>}
            {d && eventos.filter((e) => e.dia === d).sort((a, b) => a.hora.localeCompare(b.hora)).map((e) => (
              <button type="button" key={e.id} className={`cal-ev ${e.tipo}`} title={e.texto} onClick={() => (e.tipo === "coleta" ? navegar("ordem", e.osId) : setJanela({ ...e.reg }))}>{e.hora} {e.texto}</button>
            ))}
          </div>
        ))}
      </div></div>
      <p className="suave" style={{ marginBottom: 0 }}><span className="cal-ev coleta" style={{ display: "inline-block" }}>Coleta</span> agendada pela Logística · <span className="cal-ev agenda" style={{ display: "inline-block" }}>Compromisso</span> da agenda</p>
      {janela && (
        <Modal titulo={janela.id ? "Atualizar agendamento" : "Adicionar Agenda"} onFechar={() => setJanela(null)} rotuloOk={janela.id ? "Atualizar agendamento" : "Agendar"}
          extra={janela.id ? <button type="button" className="btn btn-danger" onClick={async () => { try { await salvar("agenda", { ...janela, status: "Cancelado" }, { motivo: "Agendamento cancelado" }); setJanela(null); avisar("Agendamento cancelado.", "ok"); } catch (e) { avisar(e.message, "err"); } }}>Cancelar Agendamento</button> : null}
          aoConfirmar={async () => {
            if (!janela.descricao.trim() || !janela.data) { avisar("Informe a descrição e a data.", "err"); return false; }
            try { await salvar("agenda", janela, { numerar: !janela.id }); avisar("Agenda salva.", "ok"); } catch (e) { avisar(e.message, "err"); return false; }
          }}>
          <div className="fg"><label htmlFor="gDesc">Descrição</label><input id="gDesc" value={janela.descricao} onChange={(e) => setJanela({ ...janela, descricao: e.target.value })} /></div>
          <div className="fg"><label htmlFor="gData">Data e Hora</label><input id="gData" type="datetime-local" value={janela.data} onChange={(e) => setJanela({ ...janela, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="gResp">Responsável</label><input id="gResp" list="pessoas-ag2" value={janela.responsavel} onChange={(e) => setJanela({ ...janela, responsavel: e.target.value })} /><Pessoas id="pessoas-ag2" /></div>
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
      <Grade id="descarte" exportar="descarte-amostras" linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel} opcoesFiltro={{ 8: ["Aguardando", "Concluído"] }} ordemInicial={[6, "asc"]}
        botoes={[{ rotulo: "Registrar descarte", acao: () => { const s = selecionadas.filter((a) => !a.descarte); if (!s.length) { avisar("Selecione amostras aguardando descarte.", "err"); return; } setJanela({ amostras: s, data: isoDia(0), responsavel: "", obs: "" }); } }]} />
      {janela && (
        <Modal titulo={`Registrar descarte · ${janela.amostras.length} amostra(s)`} onFechar={() => setJanela(null)} rotuloOk="Registrar" aoConfirmar={async () => {
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

