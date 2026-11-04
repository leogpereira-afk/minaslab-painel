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
  const [sel, setSel] = useState(new Set());
  const [f, setF] = useState(() => ({ temperaturaOk: "Sim", prazoOk: "Sim", integraOk: "Sim", responsavel: eu?.nome || "", temperatura: "", obsTemperatura: "", termometro: "", notificar: "Não", observacoes: "", dataEntrada: agoraLocal(), campos: {} }));
  const [liberadas, setLiberadas] = useState([]);
  const defs = camposAtivos(dados.campos_inspecao);
  const achadas = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (!q) return [];
    return aguardando.filter((a) => a.barra === q.padStart(11, "0") || a.barra === q || (a.os || "").toUpperCase().includes(q) || referenciaAmostra(a).includes(q));
  }, [busca, aguardando]);
  const buscar = () => { if (!achadas.length) avisar("Nenhuma amostra aguardando inspeção com esse código.", "err"); setSel(new Set(achadas.map((a) => a.id))); };
  const liberar = async () => {
    const alvo = aguardando.filter((a) => sel.has(a.id));
    if (!alvo.length) { avisar("Selecione as amostras.", "err"); return; }
    const t = equip.find((e) => e.id === f.termometro);
    if (t?.vencido) { avisar(`O termômetro ${t.equipamento} está com a calibração vencida.`, "err"); return; }
    try {
      const novas = alvo.map((a) => inspecionar(a, { ...f, termometroNome: t ? rotuloEquip(t) : "" }, { quando: agoraLocal() }));
      await salvarLote("amostras", novas, { motivo: "Inspeção técnica (recebimento)" });
      setLiberadas(novas.map((a) => a.id));
      setSel(new Set()); setBusca("");
      avisar(`${novas.length} amostra(s) liberada(s) para o laboratório.`, "ok");
    } catch (e) { avisar(e.message, "err"); }
  };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <>
      <Caixa titulo="Inspeção técnica de amostra">
        <div className="frm">
          <div className="fg s6"><label htmlFor="iBusca">Código barra ou Ordem de serviço</label><input id="iBusca" value={busca} autoFocus onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") buscar(); }} /></div>
          <div className="fg s2" style={{ alignSelf: "end" }}><button type="button" className="btn btn-primary" onClick={buscar}>Buscar</button></div>
        </div>
        {liberadas.length > 0 && <p className="aviso ok" style={{ marginBottom: 0 }}>Amostras liberadas. <a href={link("protocolo", liberadas.join("."))}>Imprimir protocolo</a></p>}
      </Caixa>
      <Caixa titulo={`Selecione as amostras (${aguardando.length} aguardando inspeção)`}>
        <div className="tw"><table>
          <thead><tr><th className="chk"><input type="checkbox" aria-label="Todas" checked={aguardando.length > 0 && sel.size === aguardando.length} onChange={(e) => setSel(e.target.checked ? new Set(aguardando.map((a) => a.id)) : new Set())} /></th><th>Referência</th><th>Código barra</th><th>OS</th><th>Cliente</th><th>Serviço / Matriz</th><th>Coleta</th><th>Status</th></tr></thead>
          <tbody>{aguardando.length ? aguardando.map((a) => (
            <tr key={a.id} className={sel.has(a.id) ? "sel" : ""}><td className="chk"><input type="checkbox" aria-label={`Selecionar ${referenciaAmostra(a)}`} checked={sel.has(a.id)} onChange={(e) => { const s = new Set(sel); e.target.checked ? s.add(a.id) : s.delete(a.id); setSel(s); }} /></td>
              <td>{referenciaAmostra(a)}</td><td className="mono">{a.barra}</td><td>{a.os}</td><td>{dados.clientes.find((c) => c.id === a.clienteId)?.razao}</td><td>{a.servico}{a.matriz ? ` — ${a.matriz}` : ""}</td><td>{quandoBR(a.dataColeta)}</td><td><RotuloOS s={a.status} /></td></tr>
          )) : <tr><td colSpan={8} className="vazio">Nenhuma amostra aguardando inspeção.</td></tr>}</tbody>
        </table></div>
      </Caixa>
      <Caixa titulo="Informações do recebimento">
        <div className="frm">
          {PERGUNTAS_INSPECAO.map(([k, p]) => (
            <div key={k} className="fg s4"><label>{p}</label><div className="radios">{["Sim", "Não"].map((o) => <label key={o}><input type="radio" name={k} checked={f[k] === o} onChange={() => set(k, o)} /> {o}</label>)}</div></div>
          ))}
          <div className="fg s4"><label htmlFor="iResp">Responsável pelo recebimento no laboratório *</label><input id="iResp" list="pessoas-insp" value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} /><Pessoas id="pessoas-insp" /></div>
          <div className="fg s2"><label htmlFor="iTemp">Temperatura de recebimento (°C)</label><input id="iTemp" inputMode="decimal" value={f.temperatura} onChange={(e) => set("temperatura", e.target.value)} /></div>
          <div className="fg s3"><label htmlFor="iTermo">Código do Termômetro</label><select id="iTermo" value={f.termometro} onChange={(e) => set("termometro", e.target.value)}>{opcoes([["", "Selecione"], ...equip.map((e) => [e.id, rotuloEquip(e)])])}</select></div>
          <div className="fg s3"><label htmlFor="iObsT">Observação da Temperatura</label><input id="iObsT" value={f.obsTemperatura} onChange={(e) => set("obsTemperatura", e.target.value)} /></div>
          <div className="fg s3"><label htmlFor="iEnt">Data de entrada</label><input id="iEnt" type="datetime-local" value={f.dataEntrada} onChange={(e) => set("dataEntrada", e.target.value)} /></div>
          <div className="fg s3"><label>Notificar o cliente? (solicitação de autorização)</label><div className="radios">{["Sim", "Não"].map((o) => <label key={o}><input type="radio" name="notif" checked={f.notificar === o} onChange={() => set("notificar", o)} /> {o}</label>)}</div></div>
          <div className="fg s12"><label htmlFor="iObs">Observações da amostra {PERGUNTAS_INSPECAO.some(([k]) => f[k] === "Não") && <span className="nc">(obrigatória: houve desvio)</span>}</label><textarea id="iObs" rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        {defs.length > 0 && <CamposDinamicos prefixo="ins" defs={defs} valor={f.campos} set={(v) => set("campos", v)} />}
        <div className="acoes" style={{ marginTop: 12 }}><button type="button" className="btn btn-success" disabled={!sel.size} onClick={liberar}>Liberar amostras{sel.size ? ` (${sel.size})` : ""}</button></div>
        {f.notificar === "Sim" && <p className="suave" style={{ marginBottom: 0 }}>O aviso ao cliente fica registrado na inspeção; o envio por e-mail/WhatsApp entra com a integração.</p>}
      </Caixa>
    </>
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
        <table className="doc-tab"><tbody>{PERGUNTAS_INSPECAO.map(([k, p]) => <tr key={k}><th style={{ width: "70%" }}>{p}</th><td className={i0[k] === "Não" ? "nc" : ""}>{i0[k]}</td></tr>)}
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
  const linhas = dados.amostras.filter((a) => a.status === "Laboratório" || a.status === "Em Revisão");
  const base = colunasAmostra(dados);
  const colunas = [
    base[0], base[1],
    { t: "Amostra ID", v: (r) => referenciaAmostra(r), filtro: true },
    { t: "Matriz", v: (r) => `${r.servico}${r.matriz ? ` — ${r.matriz}` : ""}`, filtro: true },
    { t: "Identificação", v: (r) => r.identificacao || "", filtro: true },
    { t: "Local", v: (r) => r.local || "", filtro: true },
    { t: "Código barra", v: (r) => r.barra, filtro: true },
    { t: "Status", v: (r) => r.status, h: (r) => <RotuloOS s={r.status} />, filtro: "lista" },
    { t: "Prioridade", v: (r) => r.prioridade || "Padrão", filtro: "lista" },
    { t: "Resultados", v: (r) => `${r.analises.filter((x) => String(x.resultado || "").trim()).length}/${r.analises.length}` },
    { t: "Data da coleta", v: (r) => r.dataColeta || "", h: (r) => quandoBR(r.dataColeta), fv: (r) => quandoBR(r.dataColeta), filtro: true },
    { t: "Data de entrada", v: (r) => r.dataEntrada || "", h: (r) => quandoBR(r.dataEntrada), fv: (r) => quandoBR(r.dataEntrada), filtro: true },
  ];
  return (
    <Caixa titulo="Ordem serviços - Laboratório">
      <p className="suave" style={{ marginTop: -6 }}>Dois cliques abrem a amostra para lançar os resultados.</p>
      <Grade id="lab-amostra" exportar="analise-por-amostra" linhas={linhas} colunas={colunas} filtrosColuna opcoesFiltro={{ 7: ["Laboratório", "Em Revisão"], 8: PRIORIDADES }} aoAbrir={(r) => navegar("analise", r.id)} botoes={[]} />
    </Caixa>
  );
}

export function AnaliseAmostra({ param }) {
  const { dados, salvar, eu } = useDados();
  const avisar = useAviso();
  const equip = useEquipamentos();
  const a = dados.amostras.find((x) => x.id === param);
  const [edit, setEdit] = useState({});
  const [ocupado, setOcupado] = useState(false);
  if (!a) return <NaoAchou />;
  const cfg = configSistema(dados);
  const ed = (pid) => edit[pid] || {};
  const set = (pid, k, v) => setEdit((e) => ({ ...e, [pid]: { ...e[pid], [k]: v } }));
  const mudadas = a.analises.filter((x) => edit[x.pid] && ((edit[x.pid].resultado ?? x.resultado) !== x.resultado || (edit[x.pid].equipamento ?? x.equipamento ?? "") !== (x.equipamento || "")));
  const gravar = async (depois) => {
    setOcupado(true);
    try {
      const quando = agoraLocal();
      for (const x of mudadas) { const e = equip.find((q) => q.id === (ed(x.pid).equipamento ?? x.equipamento)); if (e?.vencido) throw new Error(`${x.nome}: o equipamento ${e.equipamento} está com a calibração vencida.`); }
      let nova = { ...a, analises: a.analises.map((x) => (mudadas.includes(x) ? lancarResultado(x, { resultado: ed(x.pid).resultado ?? x.resultado, equipamento: ed(x.pid).equipamento ?? x.equipamento ?? "", analista: eu?.usuario || "", quando }) : x)) };
      if (depois === "revisao") nova = enviarRevisao(nova, quando);
      else nova = { ...nova, status: statusPelasAnalises(nova) };
      await salvar("amostras", nova, { motivo: depois === "revisao" ? "Enviado para revisão" : "Resultados lançados" });
      setEdit({});
      avisar(depois === "revisao" ? "Resultados enviados para a revisão." : "Resultados salvos.", "ok");
    } catch (e) { avisar(e.message, "err"); } finally { setOcupado(false); }
  };
  const agora = agoraLocal();
  return (
    <>
      <Caixa cabecalho={`Análise · ${referenciaAmostra(a)} · ${a.barra}`}>
        <dl className="detail">
          <div><dt>Cliente</dt><dd>{dados.clientes.find((c) => c.id === a.clienteId)?.razao}</dd></div><div><dt>OS</dt><dd><a href={link("ordem", a.osId)}>{a.os}</a></dd></div>
          <div><dt>Serviço / Matriz</dt><dd>{a.servico}{a.matriz ? ` — ${a.matriz}` : ""}</dd></div><div><dt>Legislação</dt><dd>{a.legislacao || "—"}</dd></div>
          <div><dt>Identificação</dt><dd>{a.identificacao || "—"}</dd></div><div><dt>Status</dt><dd><RotuloOS s={a.status} /></dd></div>
          <div><dt>Coleta</dt><dd>{quandoBR(a.dataColeta)}</dd></div><div><dt>Entrada</dt><dd>{quandoBR(a.dataEntrada)}</dd></div>
        </dl>
        {a.inspecao?.desvios?.length > 0 && <p className="aviso alerta">Desvio no recebimento: {a.inspecao.desvios.join("; ")}. {a.inspecao.observacoes}</p>}
      </Caixa>
      <Caixa titulo="Resultados">
        <div className="tw"><table>
          <thead><tr>{["Análise", "Resultado", "Exibido", "Unidade", "LQ", "VMP", "Parecer", "Método", "Equipamento", "Prazo início", "Etapa", "Analista"].map((t) => <th key={t}>{t}</th>)}</tr></thead>
          <tbody>{a.analises.map((x) => {
            const travada = x.etapa === "Revisão" || x.etapa === "Revisado";
            const res = ed(x.pid).resultado ?? x.resultado ?? "";
            const lim = limiteDe(dados, a, x.pid);
            const par = parecer(res, lim, x.lq);
            const prazo = prazoInicio(dados, a, x.pid);
            const atrasado = prazo && !x.inicio && prazo < agora;
            const casas = dados.parametros.find((p) => p.id === x.pid)?.casasDecimais;
            return (
              <tr key={x.pid}>
                <td>{x.nome}{x.acred ? " *" : ""}{x.inloco ? " (in loco)" : ""}{x.motivoRetorno && x.etapa === "Em análise" && <div className="nc" style={{ fontWeight: 400 }}>Retorno: {x.motivoRetorno}</div>}</td>
                <td><input aria-label={`Resultado ${x.nome}`} disabled={travada} value={res} onChange={(e) => set(x.pid, "resultado", e.target.value)} style={{ minWidth: 90 }} /></td>
                <td>{resultadoExibido(res, { lq: x.lq, casas })}</td><td>{x.un}</td><td>{x.lq}</td><td>{textoLimite(lim)}</td>
                <td className={par === "Não conforme" ? "nc" : ""}>{par}</td><td>{x.metodo}</td>
                <td><select aria-label={`Equipamento ${x.nome}`} disabled={travada} value={ed(x.pid).equipamento ?? x.equipamento ?? ""} onChange={(e) => set(x.pid, "equipamento", e.target.value)}>{opcoes([["", "—"], ...equip.map((e) => [e.id, rotuloEquip(e)])])}</select></td>
                <td style={atrasado ? { color: cfg.corAposVencimento || "#dc2626", fontWeight: 600 } : undefined}>{quandoBR(prazo)}</td>
                <td><RotuloEtapa e={x.etapa} /></td><td>{x.analista}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <p className="suave">* Ensaio acreditado. Resultado abaixo do LQ sai como "&lt; LQ". O parecer compara com o VMP da legislação (Configurações → Resultado Legislação Aplicável).</p>
        <div className="acoes">
          <a className="btn btn-default" href={link("laboratory-order-services")}>Voltar</a>
          <button type="button" className="btn btn-primary" disabled={ocupado || !mudadas.length} onClick={() => gravar("salvar")}>Salvar resultados{mudadas.length ? ` (${mudadas.length})` : ""}</button>
          <button type="button" className="btn btn-success" disabled={ocupado || a.analises.every((x) => x.etapa === "Revisão" || x.etapa === "Revisado")} onClick={() => gravar("revisao")}>Enviar para revisão</button>
        </div>
      </Caixa>
    </>
  );
}

/* ---------- Análise por Parâmetro (batelada) ---------- */

export function AnalisePorParametro() {
  const ctx = useDados();
  const { dados, salvarLote, eu, proximo } = ctx;
  const avisar = useAviso();
  const equip = useEquipamentos();
  const [sel, setSel] = useState(new Set());
  const [janela, setJanela] = useState(null);
  const linhas = useMemo(() => dados.amostras.filter((a) => a.status === "Laboratório").flatMap((a) => a.analises.filter((x) => x.etapa === "Aguardando" || x.etapa === "Em análise").map((x) => ({ id: `${a.id}|${x.pid}`, a, x }))), [dados.amostras]);
  const par = (r) => dados.parametros.find((p) => p.id === r.x.pid) || {};
  const setor = (r) => dados.setores.find((s) => s.id === par(r).setor)?.nome || "";
  const colunas = [
    { t: "ID", v: (r) => Number(r.a.cod) || 0 },
    { t: "Lote", v: (r) => r.x.lote || "", filtro: true },
    { t: "Setor", v: setor, filtro: "lista" },
    { t: "Registrado", v: (r) => r.x.etapa, h: (r) => <RotuloEtapa e={r.x.etapa} />, filtro: "lista" },
    { t: "Prioridade", v: (r) => r.a.prioridade || "Padrão", filtro: "lista" },
    { t: "Código de Barras", v: (r) => r.a.barra, filtro: true },
    { t: "Amostra", v: (r) => referenciaAmostra(r.a), filtro: true },
    { t: "Ordem serviço", v: (r) => r.a.os, filtro: true },
    { t: "Parâmetros", v: (r) => r.x.nome, filtro: true },
    { t: "Resultado", v: (r) => r.x.resultado || "" },
    { t: "Método", v: (r) => r.x.metodo || "", filtro: true },
    { t: "Matriz", v: (r) => r.a.matriz || r.a.servico, filtro: true },
    { t: "Data Entrada", v: (r) => r.a.dataEntrada || "", h: (r) => quandoBR(r.a.dataEntrada), fv: (r) => quandoBR(r.a.dataEntrada) },
    { t: "Prazo início analítico", v: (r) => prazoInicio(dados, r.a, r.x.pid), h: (r) => quandoBR(prazoInicio(dados, r.a, r.x.pid)) },
    { t: "Responsável da análise", v: (r) => r.x.analista || "", filtro: true },
    { t: "Equipamento", v: (r) => equip.find((e) => e.id === r.x.equipamento)?.equipamento || "", filtro: true },
  ];
  const setores = [...new Set(linhas.map(setor).filter(Boolean))];
  const selecionadas = linhas.filter((r) => sel.has(r.id));
  // Aplica uma mudança às análises escolhidas, agrupando por amostra.
  const aplicar = async (fn, motivo) => {
    const porAmostra = {};
    for (const r of selecionadas) (porAmostra[r.a.id] ||= { a: r.a, pids: new Set() }).pids.add(r.x.pid);
    const novas = Object.values(porAmostra).map(({ a, pids }) => { const n = { ...a, analises: a.analises.map((x) => (pids.has(x.pid) ? fn(x, a) : x)) }; return { ...n, status: statusPelasAnalises(n) }; });
    await salvarLote("amostras", novas, { motivo });
    setSel(new Set());
  };
  const exigir = (fn) => () => (selecionadas.length ? fn() : avisar("Selecione ao menos uma análise.", "err"));
  return (
    <Caixa titulo="Análise Batelada">
      <Grade id="lab-param" exportar="analise-por-parametro" linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel} ordemInicial={[8, "asc"]}
        opcoesFiltro={{ 2: setores, 3: ETAPAS_ANALISE.slice(0, 2), 4: PRIORIDADES }} aoAbrir={(r) => navegar("analise", r.a.id)}
        botoes={[
          { rotulo: "Criar Lote", acao: exigir(() => setJanela({ tipo: "lote", inicio: agoraLocal(), equipamento: "" })) },
          { rotulo: "Lançar resultados", acao: exigir(() => setJanela({ tipo: "resultados", valores: Object.fromEntries(selecionadas.map((r) => [r.id, r.x.resultado || ""])) })) },
          { rotulo: "Enviar para revisão", acao: exigir(async () => {
            const sem = selecionadas.filter((r) => !String(r.x.resultado || "").trim());
            if (sem.length) { avisar(`Falta resultado em ${sem.length} análise(s).`, "err"); return; }
            try { await aplicar((x) => ({ ...x, etapa: "Revisão", enviadoRevisao: agoraLocal(), motivoRetorno: "" }), "Enviado para revisão"); avisar("Enviado para a revisão.", "ok"); } catch (e) { avisar(e.message, "err"); }
          }) },
        ]} />
      {janela?.tipo === "lote" && (
        <Modal titulo={`Criar lote · ${selecionadas.length} análise(s)`} onFechar={() => setJanela(null)} rotuloOk="Criar Lote" aoConfirmar={async () => {
          const e = equip.find((q) => q.id === janela.equipamento);
          if (e?.vencido) { avisar(`O equipamento ${e.equipamento} está com a calibração vencida.`, "err"); return false; }
          try {
            const n = await proximo(`lote:${new Date().getFullYear()}`);
            const lote = `L${String(n).padStart(5, "0")}/${new Date().getFullYear()}`;
            await aplicar((x) => ({ ...x, lote, inicio: x.inicio || janela.inicio, equipamento: janela.equipamento || x.equipamento || "", analista: x.analista || eu?.usuario || "", etapa: "Em análise" }), `Lote ${lote}`);
            avisar(`Lote ${lote} criado.`, "ok");
          } catch (er) { avisar(er.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="lIni">Data/Hora Início da Análise</label><input id="lIni" type="datetime-local" value={janela.inicio} onChange={(e) => setJanela({ ...janela, inicio: e.target.value })} /></div>
          <div className="fg"><label htmlFor="lEq">Equipamento</label><select id="lEq" value={janela.equipamento} onChange={(e) => setJanela({ ...janela, equipamento: e.target.value })}>{opcoes([["", "—"], ...equip.map((e) => [e.id, rotuloEquip(e)])])}</select></div>
        </Modal>
      )}
      {janela?.tipo === "resultados" && (
        <Modal titulo={`Lançar resultados · ${selecionadas.length} análise(s)`} largo onFechar={() => setJanela(null)} rotuloOk="Salvar resultados" aoConfirmar={async () => {
          try { await aplicar((x, a) => lancarResultado(x, { resultado: janela.valores[`${a.id}|${x.pid}`], equipamento: x.equipamento || "", analista: eu?.usuario || "", quando: agoraLocal() }), "Resultados lançados (batelada)"); avisar("Resultados salvos.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="tw"><table><thead><tr><th>Amostra</th><th>Parâmetro</th><th>Resultado</th><th>Unidade</th><th>LQ</th></tr></thead>
            <tbody>{selecionadas.map((r) => <tr key={r.id}><td>{referenciaAmostra(r.a)}</td><td>{r.x.nome}</td><td><input aria-label={`Resultado ${r.x.nome} ${referenciaAmostra(r.a)}`} value={janela.valores[r.id]} onChange={(e) => setJanela({ ...janela, valores: { ...janela.valores, [r.id]: e.target.value } })} /></td><td>{r.x.un}</td><td>{r.x.lq}</td></tr>)}</tbody></table></div>
        </Modal>
      )}
    </Caixa>
  );
}

