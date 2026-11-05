// Menu Laboratório, fiel ao GerenciaLab:
//  - Inspeção técnica de amostra: recebimento (ISO/IEC 17025 7.4) por código
//    de barras ou OS, com protocolo para imprimir.
//  - Análise por Amostra: lança os resultados de cada amostra.
//  - Análise por Parâmetro: lote (batelada) e lançamento por parâmetro.

import { useMemo, useState } from "react";
import { useDados, configSistema } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { agoraLocal, isoDia } from "../lib/formato.js";
import { validadeCalibracao } from "../lib/cadastros.js";
import { referenciaAmostra, PRIORIDADES } from "../lib/ordens.js";
import { PERGUNTAS_INSPECAO, COR_ETAPA, ETAPAS_ANALISE, inspecionar, lancarResultado, enviarRevisao, statusPelasAnalises, resultadoExibido, parecer, limiteDe } from "../lib/laboratorio.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, opcoes, useAviso } from "../components/ui.jsx";
import { CamposDinamicos, camposAtivos, valoresDinamicos } from "../components/Dinamicos.jsx";
import { NaoAchou } from "./Clientes.jsx";
import { emailDoTipo } from "../lib/clientes.js";
import { ehMicro } from "./DocumentosOS.jsx";
import { RotuloOS, CodigoBarras } from "./Ordens.jsx";
import { Pessoas, quandoBR, colunasAmostra } from "./Coletas.jsx";
import logoMinasLab from "../assets/logo-minaslab.webp";

export const RotuloEtapa = ({ e }) => <span className={`lbl ${COR_ETAPA[e] || "default"}`}>{e}</span>;
export const textoLimite = (l) => (!l ? "" : l.texto || [l.minimo !== "" && l.minimo != null ? `mín. ${l.minimo}` : "", l.maximo !== "" && l.maximo != null ? `máx. ${l.maximo}` : ""].filter(Boolean).join(" · "));

// Equipamentos em uso e com calibração válida (6.4/6.5). Vencido aparece, mas bloqueia.
export function useEquipamentos() {
  const { dados } = useDados();
  return useMemo(() => dados.equipamentos.filter((e) => e.emUso !== "Não").map((e) => {
    const val = validadeCalibracao(e);
    return { ...e, validade: val, vencido: !!val && val < isoDia(0) };
  }), [dados.equipamentos]);
}
const rotuloEquip = (e) => `${e.codigo ? `${e.codigo} · ` : ""}${e.equipamento}${e.vencido ? " (calibração vencida)" : ""}`;

// Prazo para iniciar a análise: coleta + "Prazo limite para iniciar (horas)" do parâmetro.
export function prazoInicio(dados, amostra, pid) {
  const h = Number(dados.parametros.find((p) => p.id === pid)?.horasInicio);
  if (!h || !amostra.dataColeta) return "";
  const d = new Date(amostra.dataColeta);
  if (Number.isNaN(d.getTime())) return "";
  d.setHours(d.getHours() + h);
  return agoraLocal(d);
}

/* ---------- Inspeção técnica ---------- */

export function Inspecao() {
  const { dados, salvarLote, eu } = useDados();
  const avisar = useAviso();
  const equip = useEquipamentos();
  const cfg = configSistema(dados);
  const aceitos = ["Aguardando Inspeção", ...(cfg.permitirInspecaoSemColeta === "Sim" || cfg.liberarInspecaoSemColeta === "Sim" ? ["Aguardando coleta", "Em coleta", "Coletado App", "Aguardando agendamento"] : [])];
  const aguardando = dados.amostras.filter((a) => aceitos.includes(a.status));
  const [busca, setBusca] = useState("");
  const [osInteira, setOsInteira] = useState(false);
  const [desmarcadas, setDesmarcadas] = useState(new Set());
  const novoForm = () => ({ temperaturaOk: "Sim", identificadoOk: "Sim", prazoOk: "Sim", integraOk: "Sim", armazenadoOk: "Sim", responsavel: eu?.nome || "", temperatura: "", obsTemperatura: "", termometro: "", notificar: "Não", observacoes: "", dataEntrada: agoraLocal(), campos: {} });
  const [f, setF] = useState(novoForm);
  const [liberadas, setLiberadas] = useState([]);
  const [detalhes, setDetalhes] = useState(false);
  const defs = camposAtivos(dados.campos_inspecao);
  // Código de barras acha a amostra; com a caixa marcada (ou digitando a OS) vêm todas as amostras da OS.
  const achadas = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (!q) return [];
    const porCodigo = aguardando.filter((a) => a.barra === q.padStart(11, "0") || a.barra === q || referenciaAmostra(a).toUpperCase() === q);
    const os = new Set(porCodigo.map((a) => a.osId));
    const porOS = aguardando.filter((a) => (a.os || "").toUpperCase().replace(/\s/g, "").startsWith(q.replace(/\s/g, "")) && q.startsWith("OS"));
    return osInteira ? [...new Set([...aguardando.filter((a) => os.has(a.osId)), ...porOS])] : porCodigo.length ? porCodigo : porOS;
  }, [busca, aguardando, osInteira]);
  const alvo = achadas.filter((a) => !desmarcadas.has(a.id));
  const liberar = async () => {
    if (!alvo.length) { avisar(busca.trim() ? "Nenhuma amostra aguardando inspeção com esse código." : "Informe o código de barras ou a ordem de serviço.", "err"); return; }
    const t = equip.find((e) => e.id === f.termometro);
    if (t?.vencido) { avisar(`O termômetro ${t.equipamento} está com a calibração vencida.`, "err"); return; }
    try {
      const novas = alvo.map((a) => inspecionar(a, { ...f, termometroNome: t ? rotuloEquip(t) : "" }, { quando: agoraLocal() }));
      await salvarLote("amostras", novas, { motivo: "Inspeção técnica (recebimento)" });
      setLiberadas(novas.map((a) => a.id));
      setBusca(""); setDesmarcadas(new Set()); setF((x) => ({ ...novoForm(), responsavel: x.responsavel, termometro: x.termometro }));
      avisar(`${novas.length} amostra(s) liberada(s) para o laboratório.`, "ok");
    } catch (e) { avisar(e.message, "err"); }
  };
  const ultimas = liberadas.map((id) => dados.amostras.find((a) => a.id === id)).filter(Boolean);
  const enviarProtocolo = () => {
    if (!ultimas.length) { avisar("Libere as amostras primeiro; o protocolo é da última liberação.", "err"); return; }
    const cli = dados.clientes.find((c) => c.id === ultimas[0].clienteId) || {};
    const para = emailDoTipo(cli, "Resultados");
    const corpo = `Prezado(a),\n\nConfirmamos o recebimento das amostras abaixo em ${quandoBR(ultimas[0].inspecao?.dataEntrada || ultimas[0].dataEntrada)}:\n\n${ultimas.map((a) => `- ${referenciaAmostra(a)} (${a.barra}) · ${a.os} · ${a.identificacao || a.matriz || a.servico}`).join("\n")}\n\nAtenciosamente,\n${cfg.empresa || "MinasLab"}`;
    window.location.href = `mailto:${encodeURIComponent(para)}?subject=${encodeURIComponent(`Protocolo de recebimento - ${ultimas[0].os}`)}&body=${encodeURIComponent(corpo)}`;
  };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const campo = (id, rot, el, cls = "s4") => <div className={`fg ${cls}`}><label htmlFor={id}>{rot}</label>{el}</div>;
  const simNao = (k) => <select id={`i-${k}`} value={f[k]} onChange={(e) => set(k, e.target.value)}>{opcoes(["Sim", "Não"])}</select>;
  const desvio = PERGUNTAS_INSPECAO.some(([k]) => f[k] === "Não");
  return (
    <Caixa titulo="Inspeção técnica de amostra">
      <div className="frm">
        <div className="fg s12"><label htmlFor="iBusca">Código barra ou Ordem de serviço</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" aria-label="Todas as amostras da ordem de serviço" title="Todas as amostras da ordem de serviço" checked={osInteira} onChange={(e) => setOsInteira(e.target.checked)} />
            <input id="iBusca" placeholder="Código" value={busca} autoFocus onChange={(e) => { setBusca(e.target.value); setDesmarcadas(new Set()); }} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} /></div></div>
        {busca.trim() && <div className="s12">{achadas.length ? <div className="tw"><table>
          <thead><tr><th className="chk" /><th>Referência</th><th>Código barra</th><th>OS</th><th>Cliente</th><th>Matriz</th><th>Coleta</th><th>Status</th></tr></thead>
          <tbody>{achadas.map((a) => <tr key={a.id}><td className="chk"><input type="checkbox" aria-label={`Liberar ${referenciaAmostra(a)}`} checked={!desmarcadas.has(a.id)} onChange={(e) => { const s = new Set(desmarcadas); e.target.checked ? s.delete(a.id) : s.add(a.id); setDesmarcadas(s); }} /></td><td>{referenciaAmostra(a)}</td><td className="mono">{a.barra}</td><td>{a.os}</td><td>{dados.clientes.find((c) => c.id === a.clienteId)?.razao}</td><td>{a.matriz || a.servico}</td><td>{quandoBR(a.dataColeta)}</td><td><RotuloOS s={a.status} /></td></tr>)}</tbody>
        </table></div> : <p className="suave" style={{ margin: 0 }}>Nenhuma amostra aguardando inspeção com esse código ({aguardando.length} aguardando no total).</p>}</div>}
        {PERGUNTAS_INSPECAO.map(([k, p]) => <div key={k} className="fg s4"><label htmlFor={`i-${k}`}>{p}</label>{simNao(k)}</div>)}
        {campo("iResp", "Responsável pelo recebimento no laboratório", <><input id="iResp" list="pessoas-insp" value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} /><Pessoas id="pessoas-insp" /></>)}
        {campo("iTemp", "Temperatura de recebimento (°C)", <input id="iTemp" inputMode="decimal" value={f.temperatura} onChange={(e) => set("temperatura", e.target.value)} />)}
        {campo("iObsT", "Observação da Temperatura", <input id="iObsT" value={f.obsTemperatura} onChange={(e) => set("obsTemperatura", e.target.value)} />)}
        {campo("iTermo", "Código do Termômetro", <select id="iTermo" value={f.termometro} onChange={(e) => set("termometro", e.target.value)}>{opcoes([["", "Selecione"], ...equip.map((e) => [e.id, rotuloEquip(e)])])}</select>)}
        <div className="fg s4"><span className="rot">Notificar o cliente? ( solicitação de autorização )</span>{["Não", "Sim"].map((o) => <label key={o} className="radios"><input type="radio" name="notif" checked={f.notificar === o} onChange={() => set("notificar", o)} /> {o}</label>)}</div>
        {campo("iObs", <>Observações da amostra {desvio && <span className="nc">(obrigatória: houve desvio)</span>}</>, <input id="iObs" placeholder="Observações da amostra caso necessário" value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />, "s6")}
        {campo("iEnt", "Data de entrada", <input id="iEnt" type="datetime-local" value={f.dataEntrada} onChange={(e) => set("dataEntrada", e.target.value)} />, "s4")}
      </div>
      {defs.length > 0 && <CamposDinamicos prefixo="ins" defs={defs} valor={f.campos} set={(v) => set("campos", v)} />}
      <div className="acoes" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-default" onClick={liberar}>Liberar amostra{alvo.length > 1 ? `s (${alvo.length})` : ""}</button>
        <button type="button" className="btn btn-default" onClick={() => (ultimas.length ? navegar("protocolo", liberadas.join(".")) : avisar("Libere as amostras primeiro; o protocolo é da última liberação.", "err"))}>Imprimir protocolo</button>
        <button type="button" className="btn btn-default" onClick={enviarProtocolo}>Enviar protocolo</button>
        <button type="button" className="btn btn-default" onClick={() => (achadas.length ? setDetalhes(true) : avisar("Informe o código de barras ou a ordem de serviço.", "err"))}>Detalhes</button>
      </div>
      {ultimas.length > 0 && <p className="aviso ok" style={{ marginBottom: 0 }}>Última liberação: {ultimas.map((a) => referenciaAmostra(a)).join(", ")}.</p>}
      {f.notificar === "Sim" && <p className="suave" style={{ marginBottom: 0 }}>O aviso ao cliente fica registrado na inspeção; o envio automático entra com a integração de e-mail.</p>}
      {detalhes && (
        <Modal titulo="Informações" largo onFechar={() => setDetalhes(false)}>
          <h4 style={{ margin: "0 0 6px" }}>Plano de amostragem</h4>
          {(() => { const v = valoresDinamicos(camposAtivos(dados.plano_amostragem), achadas[0]?.fichaColeta); return v.length ? <table className="doc-tab"><tbody>{v.map(([t, x]) => <tr key={t}><th style={{ width: "40%" }}>{t}</th><td>{x}</td></tr>)}</tbody></table> : <p className="suave">Sem dados do plano de amostragem.</p>; })()}
          <h4 style={{ margin: "14px 0 6px" }}>Amostras</h4>
          <div className="tw"><table><thead><tr><th>Referência</th><th>Identificação</th><th>Coletor</th><th>Coleta</th><th>Parâmetros</th></tr></thead>
            <tbody>{achadas.map((a) => <tr key={a.id}><td>{referenciaAmostra(a)}</td><td>{a.identificacao}</td><td>{a.coletor}</td><td>{quandoBR(a.dataColeta)}</td><td className="quebra">{a.analises.map((x) => x.nome).join(", ")}</td></tr>)}</tbody></table></div>
        </Modal>
      )}
    </Caixa>
  );
}

export function Protocolo({ param }) {
  const { dados } = useDados();
  const amostras = String(param || "").split(".").map((id) => dados.amostras.find((a) => a.id === id)).filter(Boolean);
  if (!amostras.length) return <NaoAchou />;
  const cfg = configSistema(dados);
  const defs = camposAtivos(dados.campos_inspecao);
  const i0 = amostras[0].inspecao || {};
  const cli = dados.clientes.find((c) => c.id === amostras[0].clienteId) || {};
  return (
    <>
      <div className="box nao-imprimir"><div className="box-head-row"><h2 className="box-title">Protocolo de recebimento</h2><div className="acoes"><button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir</button><button type="button" className="btn btn-default" onClick={() => window.history.back()}>Voltar</button></div></div></div>
      <div className="doc">
        <div className="doc-topo"><img src={logoMinasLab} alt="MinasLab" width="120" height="36" /><div><b>Protocolo de recebimento de amostras</b><br /><span className="suave">{cfg.empresa || "MinasLab"}</span></div><div>{quandoBR(i0.dataEntrada)}</div></div>
        <dl className="detail">
          <div><dt>Cliente</dt><dd>{cli.razao}</dd></div><div><dt>Recebido por</dt><dd>{i0.responsavel}</dd></div>
          <div><dt>Temperatura (°C)</dt><dd>{i0.temperatura || "—"} {i0.termometroNome ? `· ${i0.termometroNome}` : ""}</dd></div><div><dt>Observação da temperatura</dt><dd>{i0.obsTemperatura || "—"}</dd></div>
        </dl>
        <table className="doc-tab"><tbody>{PERGUNTAS_INSPECAO.map(([k, p]) => <tr key={k}><th style={{ width: "70%" }}>{p}</th><td className={i0[k] === "Não" ? "nc" : ""}>{i0[k] || "—"}</td></tr>)}
          {valoresDinamicos(defs, i0.campos).map(([t, v]) => <tr key={t}><th>{t}</th><td>{v}</td></tr>)}</tbody></table>
        <table className="doc-tab"><thead><tr><th>Referência</th><th>Código barra</th><th>OS</th><th>Serviço / Matriz</th><th>Coleta</th><th>Observações</th></tr></thead>
          <tbody>{amostras.map((a) => <tr key={a.id}><td>{referenciaAmostra(a)}</td><td>{a.barra}</td><td>{a.os}</td><td>{a.servico}{a.matriz ? ` — ${a.matriz}` : ""}</td><td>{quandoBR(a.dataColeta)}</td><td>{a.inspecao?.observacoes}</td></tr>)}</tbody></table>
        <div className="assinatura"><div>Entregue por</div><div>Recebido por: {i0.responsavel}</div></div>
      </div>
    </>
  );
}

/* ---------- Análise por Amostra ---------- */

export function AnalisePorAmostra() {
  const { dados } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const linhas = dados.amostras.filter((a) => a.status === "Laboratório" || a.status === "Em Revisão");
  const osDe = Object.fromEntries(dados.ordens.map((o) => [o.id, o]));
  const colunas = [
    { t: "ID", v: (r) => Number(osDe[r.osId]?.cod) || 0, filtro: true },
    { t: "Ordem Serviço", v: (r) => r.os || "", filtro: true },
    { t: "Amostra ID", v: (r) => Number(r.cod) || 0, filtro: true },
    { t: "Matriz", v: (r) => r.matriz || r.servico || "", filtro: true },
    { t: "Identificação", v: (r) => r.identificacao || "", filtro: true },
    { t: "Código barra", v: (r) => r.barra, filtro: true },
    { t: "Amostra", v: (r) => referenciaAmostra(r), filtro: true },
    { t: "Status", v: (r) => r.status, h: (r) => <RotuloOS s={r.status} />, filtro: "lista" },
    { t: "Prioridade", v: (r) => r.prioridade || "Padrão", h: (r) => (r.prioridade && r.prioridade !== "Padrão" ? <span className="lbl crit">{r.prioridade}</span> : "Padrão"), filtro: "lista" },
    { t: "Data do agendamento", v: (r) => osDe[r.osId]?.dataColeta || r.dataColeta || "", h: (r) => quandoBR(osDe[r.osId]?.dataColeta || r.dataColeta), fv: (r) => quandoBR(osDe[r.osId]?.dataColeta || r.dataColeta), filtro: true },
    { t: "Data da coleta", v: (r) => r.dataColeta || "", h: (r) => quandoBR(r.dataColeta), fv: (r) => quandoBR(r.dataColeta), filtro: true },
    { t: "Local", v: (r) => r.local || "", filtro: true },
    { t: "Res. Amostra", v: (r) => r.respAmostra || "" },
    { t: "Resultados", v: (r) => `${r.analises.filter((x) => String(x.resultado || "").trim()).length}/${r.analises.length}` },
  ];
  const a1 = linhas.find((a) => sel.has(a.id));
  const exigir = (fn) => () => (a1 ? fn(a1) : avisar("Selecione uma amostra.", "err"));
  return (
    <Caixa titulo="Ordem serviços - Laboratório">
      <Grade id="lab-amostra" exportar="analise-por-amostra" ocultasPadrao={["Resultados"]} linhas={linhas} colunas={colunas} porPaginaInicial={100}
        selecao={sel} aoSelecionar={setSel} aoAbrir={(r) => navegar("analise", r.id)}
        botoes={[
          { rotulo: "Visualizar Ordem Serviço", acao: exigir((a) => navegar("ordem", a.osId)) },
          { rotulo: "Visualizar Amostra", acao: exigir((a) => navegar("analise", a.id)) },
        ]} />
    </Caixa>
  );
}

const ROTULO_ETAPA = { Aguardando: "Aguardando registro" };

// Análise amostra (GerenciaLab): abas Detalhes da amostra, Informações da
// amostra (inspeção), Consumível e Análises (grade + painel do parâmetro).
export function AnaliseAmostra({ param }) {
  const { dados, salvar, eu } = useDados();
  const avisar = useAviso();
  const equip = useEquipamentos();
  const a = dados.amostras.find((x) => x.id === param);
  const [aba, setAba] = useState("Análises");
  const [edit, setEdit] = useState({});
  const [pidSel, setPidSel] = useState(a?.analises[0]?.pid || "");
  const [janela, setJanela] = useState(null);
  const [calc, setCalc] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  if (!a) return <NaoAchou />;
  const cfg = configSistema(dados);
  const ed = (pid) => edit[pid] || {};
  const set = (pid, k, v) => { setCalc(null); setEdit((e) => ({ ...e, [pid]: { ...e[pid], [k]: v } })); };
  const mudadas = a.analises.filter((x) => edit[x.pid] && ((edit[x.pid].resultado ?? x.resultado) !== x.resultado || (edit[x.pid].equipamento ?? x.equipamento ?? "") !== (x.equipamento || "")));
  const gravar = async (depois) => {
    setOcupado(true);
    try {
      const quando = agoraLocal();
      for (const x of mudadas) { const e = equip.find((q) => q.id === (ed(x.pid).equipamento ?? x.equipamento)); if (e?.vencido) throw new Error(`${x.nome}: o equipamento ${e.equipamento} está com a calibração vencida.`); }
      let nova = { ...a, analises: a.analises.map((x) => (mudadas.includes(x) ? lancarResultado(x, { resultado: ed(x.pid).resultado ?? x.resultado, equipamento: ed(x.pid).equipamento ?? x.equipamento ?? "", analista: eu?.usuario || "", quando }) : x)) };
      if (depois === "revisao") nova = enviarRevisao(nova, quando);
      else nova = { ...nova, status: statusPelasAnalises(nova) };
      await salvar("amostras", nova, { motivo: depois === "revisao" ? "Liberado para revisão" : "Resultados lançados" });
      setEdit({});
      avisar(depois === "revisao" ? "Resultados liberados para a revisão." : "Resultados salvos.", "ok");
    } catch (e) { avisar(e.message, "err"); } finally { setOcupado(false); }
  };
  const agora = agoraLocal();
  const par = (pid) => dados.parametros.find((p) => p.id === pid) || {};
  const x = a.analises.find((y) => y.pid === pidSel) || a.analises[0];
  const insp = a.inspecao || {};
  const contrato = dados.contratos.find((c) => c.id === a.contratoId);
  const grupo = contrato?.servicos?.find((s) => s.sid === a.sid)?.grupo || "";
  const dataPrevista = a.analises.map((y) => prazoInicio(dados, a, y.pid)).filter(Boolean).sort().pop();
  const consumiveis = a.consumiveis || [];
  const infoSel = (() => {
    if (!x) return [];
    const res = ed(x.pid).resultado ?? x.resultado ?? "";
    const lim = limiteDe(dados, a, x.pid);
    const prazo = prazoInicio(dados, a, x.pid);
    return [
      ["Parâmetro", x.nome + (x.acred ? " *" : "")],
      ["Resultado", <input key="r" aria-label={`Resultado ${x.nome}`} disabled={x.etapa === "Revisão" || x.etapa === "Revisado"} value={res} onChange={(e) => set(x.pid, "resultado", e.target.value)} />],
      ["Equipamento", <select key="e" aria-label={`Equipamento ${x.nome}`} disabled={x.etapa === "Revisão" || x.etapa === "Revisado"} value={ed(x.pid).equipamento ?? x.equipamento ?? ""} onChange={(e) => set(x.pid, "equipamento", e.target.value)}>{opcoes([["", "—"], ...equip.map((e) => [e.id, rotuloEquip(e)])])}</select>],
      ...(calc && calc.pid === x.pid ? [["Resultado exibido", calc.exibido], ["Parecer", calc.parecer || "—"]] : []),
      ["VMP", textoLimite(lim) || "—"],
      ["Prazo para início", <span key="p" style={prazo && !x.inicio && prazo < agora ? { color: cfg.corAposVencimento || "#dc2626", fontWeight: 600 } : undefined}>{quandoBR(prazo) || "—"}</span>],
      ["Analista", x.analista || "—"], ["Início / término", `${quandoBR(x.inicio) || "—"} / ${quandoBR(x.termino) || "—"}`],
      ...(x.motivoRetorno && x.etapa === "Em análise" ? [["Retorno da revisão", <span key="m" className="nc">{x.motivoRetorno}</span>]] : []),
    ];
  })();
  const calcular = () => {
    if (!x) return;
    const res = ed(x.pid).resultado ?? x.resultado ?? "";
    if (!String(res).trim()) { avisar("Informe o resultado do parâmetro.", "err"); return; }
    setCalc({ pid: x.pid, exibido: resultadoExibido(res, { lq: x.lq, casas: par(x.pid).casasDecimais }), parecer: parecer(res, limiteDe(dados, a, x.pid), x.lq) });
  };
  const det = (r, v) => <div className="fg s3"><span className="rot">{r}</span><span>{v || "—"}</span></div>;
  return (
    <>
      <div className="box"><div className="box-hd" style={{ fontSize: 16 }}>Análise amostra</div>
        <div style={{ padding: "0 20px 14px" }}><b>Amostra: {referenciaAmostra(a)} {a.matriz || a.servico}{a.identificacao ? ` - ${a.identificacao}` : ""}</b> <RotuloOS s={a.status} /></div></div>
      <div className="box">
        <div className="abas" role="tablist">{["Detalhes da amostra", "Informações da amostra", "Consumível", "Análises"].map((t) => <button key={t} type="button" role="tab" aria-selected={aba === t} className={aba === t ? "on" : ""} onClick={() => setAba(t)}>{t}</button>)}</div>
        <div style={{ marginTop: 16 }}>
          {aba === "Detalhes da amostra" && <div className="frm">
            {det("Amostra Id", a.cod)}{det("Ordem de serviço", <a href={link("ordem", a.osId)}>{a.os}</a>)}{det("Referência da amostra", referenciaAmostra(a))}{det("Data e hora da coleta", quandoBR(a.dataColeta))}
            {det("Data e hora de entrada", quandoBR(a.dataEntrada))}{det("Data Prevista", quandoBR(dataPrevista))}{det("Grupo", grupo)}{det("Matriz", a.matriz || a.servico)}
            {det("Descrição", a.identificacao)}{det("Responsável coleta", a.coletor)}{det("Legislação", a.legislacao)}{det("Cliente", dados.clientes.find((c) => c.id === a.clienteId)?.razao)}
          </div>}
          {aba === "Informações da amostra" && <div className="frm">
            {PERGUNTAS_INSPECAO.map(([k, p]) => <div key={k} className="fg s4"><span className="rot">{p}</span><span className={insp[k] === "Não" ? "nc" : ""}>{insp[k] || "—"}</span></div>)}
            {det("Responsável pelo recebimento no laboratório", insp.responsavel)}{det("Temperatura de recebimento (°C)", insp.temperatura)}{det("Observação da Temperatura", insp.obsTemperatura)}{det("Código do Termômetro", insp.termometroNome)}
            {insp.observacoes ? <div className="fg s12"><span className="rot">Observações da amostra</span><span>{insp.observacoes}</span></div> : null}
          </div>}
          {aba === "Consumível" && <>
            <div className="acoes" style={{ marginBottom: 8 }}><button type="button" className="dbtn" onClick={() => setJanela({ pid: x?.pid || "", nome: "", quantidade: "1", validade: "", responsavel: eu?.nome || "", data: agoraLocal() })}>Adicionar</button></div>
            <div className="tw"><table><thead><tr>{["Id", "Parâmetro", "Consumível", "Quantidade", "Responsável", "Data Expiração do Consumivel", "Data de uso", ""].map((t, k) => <th key={k}>{t}</th>)}</tr></thead>
              <tbody>{consumiveis.length ? consumiveis.map((c, k) => <tr key={c.id}><td>{k + 1}</td><td>{a.analises.find((y) => y.pid === c.pid)?.nome || ""}</td><td>{c.nome}</td><td>{c.quantidade}</td><td>{c.responsavel}</td><td>{quandoBR(c.validade)}</td><td>{quandoBR(c.data)}</td>
                <td><button type="button" className="dbtn" onClick={async () => { try { await salvar("amostras", { ...a, consumiveis: consumiveis.filter((y) => y.id !== c.id) }, { motivo: `Cancelou consumível ${c.nome}` }); avisar("Consumível cancelado.", "ok"); } catch (e) { avisar(e.message, "err"); } }}>Cancelar</button></td></tr>) : <tr><td colSpan={8} className="vazio">Nenhum consumível registrado.</td></tr>}</tbody></table></div>
          </>}
          {aba === "Análises" && <div className="analise-lay">
            <div className="quadro" style={{ minWidth: 0 }}>
              <div className="acoes" style={{ marginBottom: 8 }}><a className="dbtn" href={link("laboratory-order-services")}>Voltar</a><button type="button" className="dbtn" onClick={() => setJanela("equip")}>Equipamentos</button><button type="button" className="dbtn" onClick={() => setAba("Consumível")}>Consumível</button></div>
              <div className="tw"><table>
                <thead><tr>{["Id", "Status", "Parâmetro", "Resultado", "Parecer da Análise", "Unidade", "LQ", "LD", "Incerteza", "VMP", "Metodologia"].map((t) => <th key={t}>{t}</th>)}</tr></thead>
                <tbody>{a.analises.map((y, k) => { const res = ed(y.pid).resultado ?? y.resultado ?? ""; const lim = limiteDe(dados, a, y.pid); const pr = parecer(res, lim, y.lq); const p = par(y.pid); return (
                  <tr key={y.pid} className={`clicavel${y.pid === x?.pid ? " sel" : ""}`} onClick={() => { setPidSel(y.pid); setCalc(null); }}>
                    <td>{p.cod || k + 1}</td><td><span className={`lbl ${COR_ETAPA[y.etapa] || "default"}`}>{ROTULO_ETAPA[y.etapa] || y.etapa}</span></td><td>{y.nome}{y.acred ? " *" : ""}</td>
                    <td>{resultadoExibido(res, { lq: y.lq, casas: p.casasDecimais })}</td><td className={pr === "Não conforme" ? "nc" : ""}>{pr}</td><td>{y.un}</td><td>{y.lq}</td><td>{p.ld || "-"}</td><td>{p.incerteza || "-"}</td><td>{textoLimite(lim)}</td><td>{y.metodo}</td></tr>
                ); })}</tbody>
              </table></div>
              <p className="suave" style={{ marginBottom: 0 }}>* Ensaio acreditado. Resultado abaixo do LQ sai como "&lt; LQ".</p>
            </div>
            <div className="quadro" style={{ minWidth: 0 }}>
              <div className="acoes" style={{ marginBottom: 8 }}>
                <button type="button" className="dbtn" onClick={calcular}>Calcular</button>
                <button type="button" className="dbtn" disabled={ocupado || !mudadas.length} onClick={() => gravar("salvar")}>Salvar{mudadas.length ? ` (${mudadas.length})` : ""}</button>
                <button type="button" className="dbtn" disabled={ocupado || a.analises.every((y) => y.etapa === "Revisão" || y.etapa === "Revisado")} onClick={() => gravar("revisao")}>Liberar para revisão</button>
              </div>
              <div className="tw"><table><thead><tr><th>Título</th><th>Valor</th></tr></thead>
                <tbody>{infoSel.map(([t, v]) => <tr key={t}><td>{t}</td><td>{v}</td></tr>)}</tbody></table></div>
            </div>
          </div>}
        </div>
      </div>
      {janela === "equip" && (
        <Modal titulo="Equipamentos" largo onFechar={() => setJanela(null)}>
          <div className="tw"><table><thead><tr><th>Parâmetro</th><th>Equipamento</th></tr></thead>
            <tbody>{a.analises.map((y) => <tr key={y.pid}><td>{y.nome}</td><td><select aria-label={`Equipamento ${y.nome}`} disabled={y.etapa === "Revisão" || y.etapa === "Revisado"} value={ed(y.pid).equipamento ?? y.equipamento ?? ""} onChange={(e) => set(y.pid, "equipamento", e.target.value)}>{opcoes([["", "—"], ...equip.map((e) => [e.id, rotuloEquip(e)])])}</select></td></tr>)}</tbody></table></div>
          <p className="suave" style={{ marginBottom: 0 }}>Clique em Salvar no painel para gravar. Equipamento com calibração vencida não é aceito.</p>
        </Modal>
      )}
      {janela?.data && (
        <Modal titulo="Adicionar consumível" onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={async () => {
          if (!janela.pid || !janela.nome.trim()) { avisar("Informe o parâmetro e o consumível.", "err"); return false; }
          try { await salvar("amostras", { ...a, consumiveis: [...consumiveis, { ...janela, id: `cs${Date.now().toString(36)}`, nome: janela.nome.trim() }] }, { motivo: `Consumível ${janela.nome.trim()}` }); avisar("Consumível registrado.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="csP">Parâmetro</label><select id="csP" value={janela.pid} onChange={(e) => setJanela({ ...janela, pid: e.target.value })}>{opcoes([["", "Selecione"], ...a.analises.map((y) => [y.pid, y.nome])])}</select></div>
          <div className="fg"><label htmlFor="csN">Consumível</label><input id="csN" list="cons-lista" value={janela.nome} onChange={(e) => setJanela({ ...janela, nome: e.target.value })} /><datalist id="cons-lista">{[...new Set(dados.preservantes.map((q) => q.consumivel).filter(Boolean))].map((n) => <option key={n} value={n} />)}</datalist></div>
          <div className="fg"><label htmlFor="csQ">Quantidade</label><input id="csQ" value={janela.quantidade} onChange={(e) => setJanela({ ...janela, quantidade: e.target.value })} /></div>
          <div className="fg"><label htmlFor="csV">Data Expiração do Consumivel</label><input id="csV" type="date" value={janela.validade} onChange={(e) => setJanela({ ...janela, validade: e.target.value })} /></div>
          {janela.validade && janela.validade < agora.slice(0, 10) && <p className="aviso alerta" style={{ margin: 0 }}>Consumível vencido.</p>}
        </Modal>
      )}
    </>
  );
}

/* ---------- Análise por Parâmetro (batelada) ---------- */

const FASES = ["Aguardando Preparação", "Em Preparo", "Aguardando Análise", "Em Análise", "Revisão Pendente"];
const faseDe = (x) => (x.etapa === "Revisão" ? "Revisão Pendente" : x.etapa === "Em análise" ? "Em Análise" : x.fase || "Aguardando Análise");
const ST_BATELADA = ["Aguardando coleta", "Em coleta", "Coletado App", "Aguardando Inspeção", "Laboratório", "Em Revisão"];
const recebida = (a) => a.status === "Laboratório" || a.status === "Em Revisão";

export function prazoAnalitico(dados, a, pid) {
  const dias = Number(dados.parametros.find((p) => p.id === pid)?.prazoDias);
  const base = a.dataEntrada || a.dataColeta;
  if (!dias || !base) return "";
  const d = new Date(`${String(base).slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function AnalisePorParametro() {
  const ctx = useDados();
  const { dados, salvarLote, eu, proximo } = ctx;
  const avisar = useAviso();
  const equip = useEquipamentos();
  const [sel, setSel] = useState(new Set());
  const [chave, setChave] = useState(0);
  const [janela, setJanela] = useState(null);
  const linhas = useMemo(() => dados.amostras.filter((a) => ST_BATELADA.includes(a.status)).flatMap((a) => a.analises.filter((x) => x.etapa !== "Revisado").map((x) => ({ id: `${a.id}|${x.pid}`, a, x }))), [dados.amostras]);
  const par = (r) => dados.parametros.find((p) => p.id === r.x.pid) || {};
  const setor = (r) => dados.setores.find((s) => s.id === par(r).setor)?.nome || (ehMicro(dados, r.x.pid, r.x.nome) ? "Microbiológico" : "Físico-Químico");
  const colunas = [
    { t: "ID", v: (r) => Number(r.a.cod) || 0 },
    { t: "Lote", v: (r) => r.x.lote || "", filtro: true },
    { t: "Setor", v: setor, filtro: "lista" },
    { t: "Etapas", v: (r) => faseDe(r.x), h: (r) => <span className={`lbl ${{ "Em Análise": "info", "Revisão Pendente": "primary", "Em Preparo": "warn" }[faseDe(r.x)] || "default"}`}>{faseDe(r.x)}</span>, filtro: "lista" },
    { t: "Registrado", v: (r) => (recebida(r.a) ? "Amostra Recebida" : "Aguardando"), h: (r) => <span className={`lbl ${recebida(r.a) ? "ok" : "default"}`}>{recebida(r.a) ? "Amostra Recebida" : "Aguardando"}</span>, filtro: "lista" },
    { t: "Prioridade", v: (r) => r.a.prioridade || "Padrão", filtro: "lista" },
    { t: "Código de Barras", v: (r) => r.a.barra, filtro: true },
    { t: "Amostra", v: (r) => referenciaAmostra(r.a), filtro: true },
    { t: "Ordem serviço", v: (r) => r.a.os, filtro: true },
    { t: "Parâmetros", v: (r) => r.x.nome, filtro: true },
    { t: "Resultado", v: (r) => r.x.resultado || "" },
    { t: "Tipo Parâmetro", v: (r) => par(r).tipo || "Ensaio", filtro: true },
    { t: "Método", v: (r) => r.x.metodo || "", filtro: true },
    { t: "Coleta", v: (r) => r.a.dataColeta || "", h: (r) => quandoBR(r.a.dataColeta), fv: (r) => quandoBR(r.a.dataColeta), filtro: true },
    { t: "Matriz", v: (r) => r.a.matriz || r.a.servico, filtro: true },
    { t: "Identificação", v: (r) => r.a.identificacao || "", filtro: true },
    { t: "Data Entrada", v: (r) => r.a.dataEntrada || "", h: (r) => quandoBR(r.a.dataEntrada), fv: (r) => quandoBR(r.a.dataEntrada), filtro: true },
    { t: "Prazo analítico", v: (r) => prazoAnalitico(dados, r.a, r.x.pid), h: (r) => quandoBR(prazoAnalitico(dados, r.a, r.x.pid)), fv: (r) => quandoBR(prazoAnalitico(dados, r.a, r.x.pid)), filtro: true },
    { t: "Prazo início analítico", v: (r) => prazoInicio(dados, r.a, r.x.pid), h: (r) => quandoBR(prazoInicio(dados, r.a, r.x.pid)), fv: (r) => quandoBR(prazoInicio(dados, r.a, r.x.pid)), filtro: true },
    { t: "Responsável da análise", v: (r) => r.x.analista || "", filtro: true },
    { t: "Responsável pela Amostra", v: (r) => (r.a.respAmostra === "Cliente" ? "Cliente" : "MinasLab"), filtro: true },
    { t: "Responsável da Coleta", v: (r) => r.a.coletor || "", filtro: true },
    { t: "Equipamento", v: (r) => equip.find((e) => e.id === r.x.equipamento)?.equipamento || "", filtro: true },
    { t: "Obs amostra", v: (r) => r.a.obsLab || "" },
  ];
  const selecionadas = linhas.filter((r) => sel.has(r.id));
  // Aplica uma mudança às análises escolhidas, agrupando por amostra.
  const aplicar = async (fn, motivo, lista = selecionadas, mudaAmostra = (a) => a) => {
    const porAmostra = {};
    for (const r of lista) (porAmostra[r.a.id] ||= { a: r.a, pids: new Set() }).pids.add(r.x.pid);
    const novas = Object.values(porAmostra).map(({ a, pids }) => { const n = mudaAmostra({ ...a, analises: a.analises.map((x) => (pids.has(x.pid) ? fn(x, a) : x)) }); return recebida(n) ? { ...n, status: statusPelasAnalises(n) } : n; });
    await salvarLote("amostras", novas, { motivo });
    setSel(new Set());
  };
  const exigir = (fn) => () => (selecionadas.length ? fn() : avisar("Selecione ao menos uma análise.", "err"));
  const exigirRecebidas = (fn) => exigir(() => { const nao = selecionadas.filter((r) => !recebida(r.a)); if (nao.length) { avisar(`${nao.length} análise(s) de amostra ainda não recebida (faça a Inspeção técnica).`, "err"); return; } fn(); });
  const iSet = 2, iFase = 3, iReg = 4, iPri = 5;
  return (
    <Caixa titulo="Análise Batelada">
      <Grade key={chave} id="lab-param" exportar="analise-por-parametro" linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel} ordemInicial={[9, "asc"]} ocultasPadrao={["Resultado", "Equipamento", "Obs amostra"]}
        opcoesFiltro={{ [iSet]: ["Físico-Químico", "Microbiológico"], [iFase]: FASES, [iReg]: ["Aguardando", "Amostra Recebida"], [iPri]: PRIORIDADES }} aoAbrir={(r) => navegar("analise", r.a.id)}
        botoes={[
          { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setChave((k) => k + 1); } },
          { rotulo: "Selecionar", menu: [{ rotulo: "Selecionar todos", acao: () => setSel(new Set(linhas.map((r) => r.id))) }, { rotulo: "Deselecionar todos", acao: () => setSel(new Set()) }] },
          { rotulo: "Alterar Etapa", acao: exigir(() => setJanela({ tipo: "etapa", fase: "Em Preparo" })) },
          { rotulo: "Analisar", acao: exigirRecebidas(() => setJanela({ tipo: "resultados", valores: Object.fromEntries(selecionadas.map((r) => [r.id, r.x.resultado || ""])) })) },
          { rotulo: "Obs amostra", acao: exigir(() => setJanela({ tipo: "obs", texto: selecionadas[0].a.obsLab || "" })) },
          { rotulo: "Lote", menu: [
            { rotulo: "Criar Lote", acao: exigirRecebidas(() => setJanela({ tipo: "lote", inicio: agoraLocal(), equipamento: "" })) },
            { rotulo: "Remover Lote", acao: exigir(async () => { const com = selecionadas.filter((r) => r.x.lote); if (!com.length) { avisar("As análises selecionadas não estão em lote.", "err"); return; } try { await aplicar((x) => ({ ...x, lote: "" }), "Removeu do lote", com); avisar("Removido do lote.", "ok"); } catch (e) { avisar(e.message, "err"); } }) },
          ] },
          { rotulo: "Documentos", menu: [
            { rotulo: "Ficha de análise", acao: exigir(() => navegar("doc-os", `am.${[...new Set(selecionadas.map((r) => r.a.id))].join(".")}`)) },
          ] },
        ]} />
      {janela?.tipo === "etapa" && (
        <Modal titulo="Alterar Etapa" onFechar={() => setJanela(null)} rotuloOk="Alterar" aoConfirmar={async () => {
          const travadas = selecionadas.filter((r) => r.x.etapa === "Revisão");
          if (travadas.length) { avisar("Há análises em revisão; peça o retorno ao revisor.", "err"); return false; }
          if (janela.fase === "Em Análise" && selecionadas.some((r) => !recebida(r.a))) { avisar("Só analisa amostra recebida (faça a Inspeção técnica).", "err"); return false; }
          try { await aplicar((x) => (janela.fase === "Em Análise" ? { ...x, fase: "", etapa: "Em análise", inicio: x.inicio || agoraLocal(), analista: x.analista || eu?.usuario || "" } : { ...x, fase: janela.fase, etapa: "Aguardando" }), `Etapa: ${janela.fase}`); avisar("Etapa alterada.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="fEt">Etapa</label><select id="fEt" value={janela.fase} onChange={(e) => setJanela({ ...janela, fase: e.target.value })}>{opcoes(FASES.slice(0, 4))}</select></div>
          <p className="suave" style={{ margin: 0 }}>{selecionadas.length} análise(s). "Revisão Pendente" é colocada pelo Analisar → Liberar para revisão.</p>
        </Modal>
      )}
      {janela?.tipo === "obs" && (
        <Modal titulo="Obs amostra" onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={async () => {
          try { await aplicar((x) => x, "Observação da amostra (laboratório)", selecionadas, (a) => ({ ...a, obsLab: janela.texto.trim() })); avisar("Observação salva.", "ok"); } catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="oLab">Observação da amostra ({[...new Set(selecionadas.map((r) => referenciaAmostra(r.a)))].join(", ")})</label><textarea id="oLab" rows={3} value={janela.texto} onChange={(e) => setJanela({ ...janela, texto: e.target.value })} /></div>
        </Modal>
      )}
      {janela?.tipo === "lote" && (
        <Modal titulo={`Criar lote · ${selecionadas.length} análise(s)`} onFechar={() => setJanela(null)} rotuloOk="Criar Lote" aoConfirmar={async () => {
          const e = equip.find((q) => q.id === janela.equipamento);
          if (e?.vencido) { avisar(`O equipamento ${e.equipamento} está com a calibração vencida.`, "err"); return false; }
          try {
            const n = await proximo(`lote:${new Date().getFullYear()}`);
            const lote = `L${String(n).padStart(5, "0")}/${new Date().getFullYear()}`;
            await aplicar((x) => ({ ...x, lote, fase: "", inicio: x.inicio || janela.inicio, equipamento: janela.equipamento || x.equipamento || "", analista: x.analista || eu?.usuario || "", etapa: "Em análise" }), `Lote ${lote}`);
            avisar(`Lote ${lote} criado.`, "ok");
          } catch (er) { avisar(er.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="lIni">Data/Hora Início da Análise</label><input id="lIni" type="datetime-local" value={janela.inicio} onChange={(e) => setJanela({ ...janela, inicio: e.target.value })} /></div>
          <div className="fg"><label htmlFor="lEq">Equipamento</label><select id="lEq" value={janela.equipamento} onChange={(e) => setJanela({ ...janela, equipamento: e.target.value })}>{opcoes([["", "—"], ...equip.map((e) => [e.id, rotuloEquip(e)])])}</select></div>
        </Modal>
      )}
      {janela?.tipo === "resultados" && (
        <Modal titulo={`Analisar · ${selecionadas.length} análise(s)`} largo onFechar={() => setJanela(null)} rotuloOk="Salvar"
          extra={<button type="button" className="btn btn-success" onClick={async () => {
            const sem = selecionadas.filter((r) => !String(janela.valores[r.id] ?? "").trim());
            if (sem.length) { avisar(`Falta resultado em ${sem.length} análise(s).`, "err"); return; }
            try { const q = agoraLocal(); await aplicar((x, a) => ({ ...lancarResultado(x, { resultado: janela.valores[`${a.id}|${x.pid}`], equipamento: x.equipamento || "", analista: eu?.usuario || "", quando: q }), etapa: "Revisão", enviadoRevisao: q, motivoRetorno: "", fase: "" }), "Liberado para revisão (batelada)"); setJanela(null); avisar("Resultados liberados para a revisão.", "ok"); }
            catch (e) { avisar(e.message, "err"); }
          }}>Liberar para revisão</button>}
          aoConfirmar={async () => {
            try { await aplicar((x, a) => ({ ...lancarResultado(x, { resultado: janela.valores[`${a.id}|${x.pid}`], equipamento: x.equipamento || "", analista: eu?.usuario || "", quando: agoraLocal() }), fase: "" }), "Resultados lançados (batelada)"); avisar("Resultados salvos.", "ok"); }
            catch (e) { avisar(e.message, "err"); return false; }
          }}>
          <div className="tw"><table><thead><tr><th>Amostra</th><th>Parâmetro</th><th>Resultado</th><th>Unidade</th><th>LQ</th><th>VMP</th><th>Parecer</th></tr></thead>
            <tbody>{selecionadas.map((r) => { const lim = limiteDe(dados, r.a, r.x.pid); const pr = parecer(janela.valores[r.id], lim, r.x.lq); return <tr key={r.id}><td>{referenciaAmostra(r.a)}</td><td>{r.x.nome}</td><td><input aria-label={`Resultado ${r.x.nome} ${referenciaAmostra(r.a)}`} value={janela.valores[r.id]} onChange={(e) => setJanela({ ...janela, valores: { ...janela.valores, [r.id]: e.target.value } })} /></td><td>{r.x.un}</td><td>{r.x.lq}</td><td>{textoLimite(lim)}</td><td className={pr === "Não conforme" ? "nc" : ""}>{pr}</td></tr>; })}</tbody></table></div>
        </Modal>
      )}
    </Caixa>
  );
}
