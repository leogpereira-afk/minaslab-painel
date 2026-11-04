// Menu Revisão, fiel ao GerenciaLab:
//  - Resultado: conferência de cada resultado por quem não o lançou; aprova
//    ou devolve ao laboratório com motivo (ISO/IEC 17025 7.7 e 7.8.1).
//  - Certificado: por OS, com progresso; o signatário autorizado assina e
//    emite o certificado de ensaio (7.8). Reemissão gera nova revisão que
//    substitui a anterior (7.8.8), sempre com motivo.

import { useMemo, useState } from "react";
import { useDados, configSistema } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { agoraLocal, isoDia } from "../lib/formato.js";
import { estaAtivo } from "../lib/cadastros.js";
import { referenciaAmostra, numeroOS, PRIORIDADES } from "../lib/ordens.js";
import { revisar, resultadoExibido, parecer, limiteDe, progressoOS, valorAmostra } from "../lib/laboratorio.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";
import { RotuloOS, CodigoBarras } from "./Ordens.jsx";
import { quandoBR } from "./Coletas.jsx";
import { textoLimite } from "./Laboratorio.jsx";
import logoMinasLab from "../assets/logo-minaslab.webp";

const statusRevisao = (x) => (x.etapa === "Revisado" ? "Revisado" : x.etapa === "Revisão" ? "Aguardando" : x.motivoRetorno ? "Revisão LAB" : "");

// Revisor configurado (Configurações → Configuração Revisão). Sem configuração, qualquer usuário revisa.
function podeRevisar(dados, usuario, pid) {
  const cfgs = dados.config_revisao.filter(estaAtivo);
  if (!cfgs.length) return true;
  const p = dados.parametros.find((x) => x.id === pid) || {};
  return cfgs.some((c) => dados.funcionarios.find((f) => f.id === c.analista)?.usuario === usuario && (!c.parametro || c.parametro === pid) && (!c.grupo || c.grupo === p.grupo));
}

export function RevisaoResultado() {
  const { dados, salvarLote, eu } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [janela, setJanela] = useState(null);
  const linhas = useMemo(() => dados.amostras.flatMap((a) => a.analises.filter((x) => statusRevisao(x)).map((x) => ({ id: `${a.id}|${x.pid}`, a, x }))), [dados.amostras]);
  const colunas = [
    { t: "ID", v: (r) => Number(r.a.cod) || 0 },
    { t: "Lote", v: (r) => r.x.lote || "", filtro: true },
    { t: "OS", v: (r) => r.a.os, filtro: true },
    { t: "Referência", v: (r) => referenciaAmostra(r.a), filtro: true },
    { t: "Descrição", v: (r) => r.a.identificacao || r.a.servico, filtro: true },
    { t: "Parâmetro", v: (r) => r.x.nome, filtro: true },
    { t: "Status", v: (r) => statusRevisao(r.x), h: (r) => <span className={`lbl ${{ Aguardando: "warn", Revisado: "ok", "Revisão LAB": "crit" }[statusRevisao(r.x)]}`}>{statusRevisao(r.x)}</span>, filtro: "lista" },
    { t: "Prioridade", v: (r) => r.a.prioridade || "Padrão", filtro: "lista" },
    { t: "Resultado", v: (r) => resultadoExibido(r.x.resultado, { lq: r.x.lq, casas: dados.parametros.find((p) => p.id === r.x.pid)?.casasDecimais }), filtro: true },
    { t: "LQ", v: (r) => r.x.lq || "" },
    { t: "VMP", v: (r) => textoLimite(limiteDe(dados, r.a, r.x.pid)) },
    { t: "Parecer", v: (r) => parecer(r.x.resultado, limiteDe(dados, r.a, r.x.pid), r.x.lq), h: (r) => { const p = parecer(r.x.resultado, limiteDe(dados, r.a, r.x.pid), r.x.lq); return <span className={p === "Não conforme" ? "nc" : ""}>{p}</span>; }, filtro: true },
    { t: "Unidade", v: (r) => r.x.un || "" },
    { t: "Método", v: (r) => r.x.metodo || "", filtro: true },
    { t: "Incerteza", v: (r) => dados.parametros.find((p) => p.id === r.x.pid)?.incerteza || "" },
    { t: "Data de Coleta", v: (r) => r.a.dataColeta || "", h: (r) => quandoBR(r.a.dataColeta) },
    { t: "Data de Entrada", v: (r) => r.a.dataEntrada || "", h: (r) => quandoBR(r.a.dataEntrada) },
    { t: "Data início da Análise", v: (r) => r.x.inicio || "", h: (r) => quandoBR(r.x.inicio) },
    { t: "Data de Término", v: (r) => r.x.termino || "", h: (r) => quandoBR(r.x.termino) },
    { t: "Analista", v: (r) => r.x.analista || "", filtro: true },
    { t: "Conferência", v: (r) => r.x.revisor || "", filtro: true },
  ];
  const selecionadas = linhas.filter((r) => sel.has(r.id));
  const decidir = async (aprovar, motivo = "") => {
    const alvo = selecionadas.filter((r) => r.x.etapa === "Revisão");
    if (!alvo.length) { avisar("Selecione resultados aguardando revisão.", "err"); return false; }
    const semPermissao = alvo.filter((r) => !podeRevisar(dados, eu?.usuario, r.x.pid));
    if (semPermissao.length) { avisar(`Você não está configurado como revisor de: ${[...new Set(semPermissao.map((r) => r.x.nome))].join(", ")} (Configurações → Configuração Revisão).`, "err"); return false; }
    const porAmostra = {};
    for (const r of alvo) (porAmostra[r.a.id] ||= { a: r.a, pids: [] }).pids.push(r.x.pid);
    try {
      const novas = Object.values(porAmostra).map(({ a, pids }) => revisar(a, pids, { aprovar, revisor: eu?.usuario || "", quando: agoraLocal(), motivo, independente: configSistema(dados).revisaoIndependente !== "Não" }));
      await salvarLote("amostras", novas, { motivo: aprovar ? "Resultado revisado" : `Retorno ao laboratório: ${motivo}` });
      setSel(new Set());
      avisar(aprovar ? `${alvo.length} resultado(s) aprovado(s).` : `${alvo.length} resultado(s) devolvido(s) ao laboratório.`, "ok");
    } catch (e) { avisar(e.message, "err"); return false; }
  };
  return (
    <Caixa titulo="Ordem serviços - Revisão">
      <Grade id="rev-res" exportar="revisao-resultados" linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel}
        opcoesFiltro={{ 6: ["Aguardando", "Revisado", "Revisão LAB"], 7: PRIORIDADES }} aoAbrir={(r) => navegar("analise", r.a.id)}
        botoes={[
          { rotulo: "Aprovar resultado", acao: () => decidir(true) },
          { rotulo: "Retornar ao laboratório", acao: () => (selecionadas.length ? setJanela({ motivo: "" }) : avisar("Selecione ao menos um resultado.", "err")) },
        ]} />
      {janela && (
        <Modal titulo="Informe o motivo do retorno" onFechar={() => setJanela(null)} rotuloOk="Retornar" aoConfirmar={() => (janela.motivo.trim() ? decidir(false, janela.motivo) : (avisar("Informe o motivo do retorno.", "err"), false))}>
          <div className="fg"><label htmlFor="rMot">Motivo do retorno</label><input id="rMot" list="mot-rev" value={janela.motivo} onChange={(e) => setJanela({ motivo: e.target.value })} />
            <datalist id="mot-rev">{dados.motivos_alteracao.filter(estaAtivo).map((m) => <option key={m.id} value={m.identificacao} />)}</datalist></div>
        </Modal>
      )}
    </Caixa>
  );
}

/* ---------- Certificado ---------- */

const emAberto = (r) => r.status !== "Pago" && r.status !== "Cancelado";

export function RevisaoCertificado() {
  const { dados } = useDados();
  const linhas = useMemo(() => dados.ordens.map((o) => {
    const am = dados.amostras.filter((a) => a.osId === o.id);
    const pr = progressoOS(am);
    const rev = am.flatMap((a) => a.analises.map((x) => x.revisadoEm || "")).filter(Boolean).sort().pop() || "";
    return { ...o, am, pr, liberacao: rev };
  }).filter((o) => o.am.some((a) => ["Em Revisão", "Assinatura", "Faturamento", "Concluída"].includes(a.status))), [dados.ordens, dados.amostras]);
  const hoje = isoDia(0);
  const inad = (cid) => dados.contas_receber.some((r) => r.clienteId === cid && emAberto(r) && r.venc && r.venc < hoje);
  const colunas = [
    { t: "ID", v: (r) => Number(r.cod) || 0 },
    { t: "Data de liberação", v: (r) => r.liberacao, h: (r) => quandoBR(r.liberacao) },
    { t: "Progresso", v: (r) => r.pr.pct, h: (r) => <span className="progresso" title={`${r.pr.prontas}/${r.pr.total}`}><i style={{ width: `${r.pr.pct}%` }} /><b>{r.pr.prontas}/{r.pr.total}</b></span> },
    { t: "Solicitante", v: (r) => dados.solicitantes.find((s) => s.id === r.solicitanteId)?.nome || "", filtro: true },
    { t: "Cliente", v: (r) => dados.clientes.find((c) => c.id === r.clienteId)?.razao || "", filtro: true },
    { t: "Ordem Serviço", v: (r) => numeroOS(r), filtro: true },
    { t: "Certificados", v: (r) => dados.certificados.filter((c) => c.osId === r.id && !c.substituidoPor).length },
    { t: "Inadimplência", v: (r) => (inad(r.clienteId) ? "Sim" : "Não"), h: (r) => (inad(r.clienteId) ? <span className="lbl crit">Sim</span> : "Não"), filtro: "lista" },
  ];
  return (
    <Caixa titulo="Ordem serviços - Revisão">
      <p className="suave" style={{ marginTop: -6 }}>Dois cliques abrem a OS para assinar e emitir os certificados.</p>
      <Grade id="rev-cert" exportar="certificados" linhas={linhas} colunas={colunas} filtrosColuna opcoesFiltro={{ 7: ["Sim", "Não"] }} aoAbrir={(r) => navegar("certificado", r.id)} botoes={[]} />
    </Caixa>
  );
}

// Conteúdo do certificado congelado na emissão (o que foi assinado não muda).
function montarConteudo(dados, a) {
  return {
    amostra: { ref: referenciaAmostra(a), barra: a.barra, os: a.os, servico: a.servico, matriz: a.matriz, legislacao: a.legislacao, identificacao: a.identificacao, local: a.local, respAmostra: a.respAmostra, coletor: a.coletor || "", dataColeta: a.dataColeta, dataEntrada: a.dataEntrada, inspecao: a.inspecao || null },
    analises: a.analises.map((x) => {
      const p = dados.parametros.find((q) => q.id === x.pid) || {};
      const lim = limiteDe(dados, a, x.pid);
      return { nome: x.nome, resultado: resultadoExibido(x.resultado, { lq: x.lq, casas: p.casasDecimais }), un: x.un, lq: x.lq, vmp: textoLimite(lim), parecer: parecer(x.resultado, lim, x.lq), metodo: x.metodo, acred: !!x.acred, subcontratado: p.subcontratado ? (dados.subcontratados.find((s) => s.id === p.subcontratado)?.empresa || "Subcontratado") : "", inicio: x.inicio, termino: x.termino, incerteza: p.incerteza || "" };
    }),
  };
}

export function DocCertificado({ cert, dados, previa = false }) {
  const cfg = configSistema(dados);
  const cli = dados.clientes.find((c) => c.id === cert.clienteId) || {};
  const { amostra: am, analises } = cert.conteudo;
  const temAcred = analises.some((x) => x.acred), temSub = analises.some((x) => x.subcontratado), temNC = analises.some((x) => x.parecer === "Não conforme");
  const anterior = cert.substitui ? dados.certificados.find((c) => c.id === cert.substitui) : null;
  const datas = analises.flatMap((x) => [x.inicio, x.termino]).filter(Boolean).sort();
  return (
    <div className="doc">
      <div className="doc-topo">
        <img src={logoMinasLab} alt="MinasLab" width="130" height="39" />
        <div style={{ textAlign: "center" }}><b style={{ fontSize: 15 }}>{cfg.tituloCertificado || "Certificado de Ensaio"}</b><br />{previa ? <span className="nc">PRÉVIA — sem validade</span> : <>Nº {cert.numero}{cert.revisao ? ` · Revisão ${cert.revisao}` : ""}</>}</div>
        <div style={{ width: 170 }}><CodigoBarras texto={am.barra} altura={30} /><div className="et-barra">{am.barra}</div></div>
      </div>
      <dl className="detail">
        <div><dt>Laboratório</dt><dd>{cfg.empresa || "MinasLab"}{cfg.cnpj ? ` · CNPJ ${cfg.cnpj}` : ""}<br />{[cfg.endereco, cfg.cidade, cfg.estado].filter(Boolean).join(", ")}{cfg.telefone ? ` · ${cfg.telefone}` : ""}</dd></div>
        <div><dt>Cliente</dt><dd>{cli.razao}{cli.doc ? ` · ${cli.doc}` : ""}<br />{[cli.endereco, cli.numero, cli.bairro, cli.cidade, cli.uf].filter(Boolean).join(", ")}</dd></div>
        <div><dt>Amostra</dt><dd>{am.ref} · OS {am.os}</dd></div><div><dt>Matriz</dt><dd>{am.servico}{am.matriz ? ` — ${am.matriz}` : ""}</dd></div>
        <div><dt>Identificação / ponto</dt><dd>{am.identificacao || "—"}{am.local ? ` · ${am.local}` : ""}</dd></div><div><dt>Legislação de referência</dt><dd>{am.legislacao || "—"}</dd></div>
        <div><dt>Coleta</dt><dd>{quandoBR(am.dataColeta)} · {am.respAmostra === "Cliente" ? "realizada pelo cliente" : `MinasLab${am.coletor ? ` (${am.coletor})` : ""}`}</dd></div><div><dt>Recebimento</dt><dd>{quandoBR(am.dataEntrada)}{am.inspecao?.temperatura ? ` · ${am.inspecao.temperatura} °C` : ""}</dd></div>
        <div><dt>Período de ensaio</dt><dd>{datas.length ? `${quandoBR(datas[0])} a ${quandoBR(datas[datas.length - 1])}` : "—"}</dd></div><div><dt>Emissão</dt><dd>{previa ? "—" : quandoBR(cert.emitidoEm)}</dd></div>
      </dl>
      {am.inspecao?.desvios?.length > 0 && <p className="doc-rodape" style={{ borderTop: 0 }}><b>Desvio no recebimento:</b> {am.inspecao.desvios.join("; ")}. {am.inspecao.observacoes} Os resultados podem ter sido afetados.</p>}
      <table className="doc-tab">
        <thead><tr><th>Parâmetro</th><th>Resultado</th><th>Unidade</th><th>LQ</th><th>VMP</th><th>Parecer</th><th>Método</th></tr></thead>
        <tbody>{analises.map((x, i) => <tr key={i}><td>{x.nome}{x.acred ? " *" : ""}{x.subcontratado ? " **" : ""}</td><td><b>{x.resultado}</b></td><td>{x.un}</td><td>{x.lq}</td><td>{x.vmp}</td><td className={x.parecer === "Não conforme" ? "nc" : ""}>{x.parecer}</td><td>{x.metodo}</td></tr>)}</tbody>
      </table>
      <div className="doc-rodape">
        {temAcred && <div>* Ensaio acreditado pela Cgcre conforme ABNT NBR ISO/IEC 17025.</div>}
        {temSub && <div>** Ensaio realizado por laboratório subcontratado: {[...new Set(analises.filter((x) => x.subcontratado).map((x) => x.subcontratado))].join(", ")}.</div>}
        {am.legislacao && <div>Declaração de conformidade com {am.legislacao}: {temNC ? "a amostra NÃO atende a todos os limites avaliados." : "a amostra atende aos limites avaliados."} Regra de decisão: aceitação simples, sem considerar a incerteza de medição, conforme acordado com o cliente.</div>}
        <div>Os resultados referem-se exclusivamente à amostra ensaiada{am.respAmostra === "Cliente" ? ", conforme recebida (amostragem de responsabilidade do cliente)" : ""}. Este certificado só pode ser reproduzido por completo, sem autorização do laboratório para reprodução parcial.</div>
        {anterior && <div>Este certificado substitui o nº {anterior.numero}{anterior.revisao ? ` rev. ${anterior.revisao}` : ""}. Motivo: {cert.motivoRevisao}.</div>}
      </div>
      {!previa && <div className="assinatura"><div><b>{cert.signatario}</b><br />{cert.cargo || "Signatário autorizado"}<br />Assinado eletronicamente em {quandoBR(cert.emitidoEm)}</div></div>}
    </div>
  );
}

export function CertificadoOS({ param }) {
  const ctx = useDados();
  const { dados, salvar, proximo, eu } = ctx;
  const avisar = useAviso();
  const [ver, setVer] = useState(null);
  const [reemitir, setReemitir] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const os = dados.ordens.find((o) => o.id === param);
  if (!os) return <NaoAchou />;
  const cfg = configSistema(dados);
  const amostras = dados.amostras.filter((a) => a.osId === os.id).sort((a, b) => a.num - b.num);
  const vigente = (a) => dados.certificados.find((c) => c.amostraId === a.id && !c.substituidoPor);
  const signatarios = dados.funcionarios.filter((f) => estaAtivo(f) && f.signatario === "Sim");
  const eu_ = signatarios.find((f) => f.usuario === eu?.usuario);
  const contrato = dados.contratos.find((c) => c.id === os.contratoId);
  const emitir = async (a, anterior = null, motivoRevisao = "") => {
    if (!eu_) { avisar(signatarios.length ? "Você não é signatário autorizado (Configurações → Funcionários)." : "Cadastre o signatário autorizado em Configurações → Funcionários (Signatário de certificado = Sim, ligado à sua conta).", "err"); return false; }
    setOcupado(a.id);
    try {
      const ano = new Date().getFullYear();
      const agora = agoraLocal();
      const n = anterior ? anterior.num : await proximo(`certificado:${ano}`);
      const anoCert = anterior ? anterior.ano : ano;
      const cert = await salvar("certificados", {
        num: n, ano: anoCert, numero: `${String(n).padStart(6, "0")}/${anoCert}`, revisao: anterior ? (anterior.revisao || 0) + 1 : 0, substitui: anterior?.id || null, motivoRevisao,
        amostraId: a.id, osId: os.id, clienteId: a.clienteId, contratoId: a.contratoId, emitidoEm: agora, emitidoPor: eu?.usuario, signatario: eu_.nome, cargo: eu_.cargo || "",
        conteudo: montarConteudo(dados, a),
      }, { numerar: true, motivo: anterior ? `Reemissão: ${motivoRevisao}` : "Emissão do certificado" });
      if (anterior) await salvar("certificados", { ...anterior, substituidoPor: cert.id }, { motivo: `Substituído pela revisão ${cert.revisao}` });
      if (!anterior) {
        const faturar = cfg.sistemaFaturamento !== "Não" && contrato?.ciclo !== "Parcelado";
        if (faturar) {
          const valor = valorAmostra(contrato, a);
          await salvar("contas_receber", { origem: "Amostra", amostraId: a.id, referencia: referenciaAmostra(a), osId: os.id, os: a.os, clienteId: a.clienteId, contratoId: a.contratoId, contrato: os.contrato, descricao: `${a.servico} · ${referenciaAmostra(a)}`, valor, venc: isoDia(30), status: "Em aberto" }, { numerar: true });
        }
        await salvar("amostras", { ...a, status: faturar ? "Faturamento" : "Concluída", dataAssinatura: agora, certificadoId: cert.id }, { motivo: "Certificado emitido" });
      } else await salvar("amostras", { ...a, certificadoId: cert.id }, { motivo: `Certificado reemitido (rev. ${cert.revisao})` });
      avisar(`Certificado ${cert.numero}${cert.revisao ? ` rev. ${cert.revisao}` : ""} emitido.`, "ok");
      setVer(cert.id);
    } catch (e) { avisar(e.message, "err"); return false; } finally { setOcupado(""); }
  };
  const certVer = ver && dados.certificados.find((c) => c.id === ver);
  const previa = ver && !certVer ? amostras.find((a) => a.id === ver) : null;
  return (
    <>
      <div className="box nao-imprimir">
        <div className="box-head-row"><h2 className="box-title">Certificados · {numeroOS(os)}</h2><div className="acoes"><a className="btn btn-default" href={link("list-revisions")}>Voltar</a>{ver && <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir</button>}</div></div>
        {!eu_ && <p className="aviso alerta">{signatarios.length ? "Você não é signatário autorizado: pode ver as prévias, mas não assinar." : "Nenhum signatário cadastrado. Em Configurações → Funcionários marque “Signatário de certificado” e ligue à conta do painel."}</p>}
        <div className="tw"><table>
          <thead><tr><th>Referência</th><th>Serviço / Matriz</th><th>Status</th><th>Resultados revisados</th><th>Certificado</th><th /></tr></thead>
          <tbody>{amostras.map((a) => {
            const c = vigente(a);
            const rev = a.analises.filter((x) => x.etapa === "Revisado").length;
            return (
              <tr key={a.id}>
                <td>{referenciaAmostra(a)}</td><td>{a.servico}{a.matriz ? ` — ${a.matriz}` : ""}</td><td><RotuloOS s={a.status} /></td><td>{rev}/{a.analises.length}</td>
                <td>{c ? `${c.numero}${c.revisao ? ` rev. ${c.revisao}` : ""}` : "—"}</td>
                <td><div className="acoes">
                  {c ? <button type="button" className="btn btn-default btn-sm" onClick={() => setVer(c.id)}>Visualizar</button> : rev === a.analises.length && a.analises.length ? <button type="button" className="btn btn-default btn-sm" onClick={() => setVer(a.id)}>Prévia</button> : null}
                  {!c && a.status === "Assinatura" && <button type="button" className="btn btn-success btn-sm" disabled={!!ocupado} onClick={() => emitir(a)}>{ocupado === a.id ? "Emitindo…" : "Assinar e emitir"}</button>}
                  {c && <button type="button" className="btn btn-warning btn-sm" disabled={!!ocupado} onClick={() => setReemitir({ a, c, motivo: "" })}>Reemitir</button>}
                </div></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </div>
      {certVer && <DocCertificado cert={certVer} dados={dados} />}
      {previa && <DocCertificado cert={{ clienteId: previa.clienteId, conteudo: montarConteudo(dados, previa) }} dados={dados} previa />}
      {reemitir && (
        <Modal titulo={`Reemitir ${reemitir.c.numero}`} onFechar={() => setReemitir(null)} rotuloOk="Reemitir" aoConfirmar={() => (reemitir.motivo.trim() ? emitir(reemitir.a, reemitir.c, reemitir.motivo.trim()) : (avisar("Informe o motivo da reemissão.", "err"), false))}>
          <p style={{ marginTop: 0 }}>A nova revisão substitui a atual e cita o motivo no certificado (ISO/IEC 17025 7.8.8). Para corrigir um resultado, devolva-o antes na Revisão de resultados.</p>
          <div className="fg"><label htmlFor="reMot">Motivo da reemissão</label><input id="reMot" value={reemitir.motivo} onChange={(e) => setReemitir({ ...reemitir, motivo: e.target.value })} /></div>
        </Modal>
      )}
    </>
  );
}

