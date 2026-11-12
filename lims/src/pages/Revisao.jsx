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
import { revisar, resultadoExibido, parecer, limiteDe, progressoOS, valorAmostra, statusPelasAnalises } from "../lib/laboratorio.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";
import { RotuloOS, CodigoBarras } from "./Ordens.jsx";
import { quandoBR } from "./Coletas.jsx";
import { textoLimite, prazoAnalitico } from "./Laboratorio.jsx";
import { acreditadoNoEscopo } from "../lib/escopo.js";
import { Documento, Bloco, dataExtenso, codigoValidacao } from "../components/Documento.jsx";
import { camposAtivos, valoresDinamicos } from "../components/Dinamicos.jsx";
import { emailDoTipo } from "../lib/clientes.js";
import { faturaDaAmostra, faturaPorOS } from "../lib/faturas.js";

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
  const [chave, setChave] = useState(0);
  const [janela, setJanela] = useState(null);
  const linhas = useMemo(() => dados.amostras.flatMap((a) => a.analises.filter((x) => statusRevisao(x)).map((x) => ({ id: `${a.id}|${x.pid}`, a, x }))), [dados.amostras]);
  const colunas = [
    { t: "ID", v: (r) => Number(r.a.cod) || 0 },
    { t: "Lote", v: (r) => r.x.lote || "", filtro: true },
    { t: "OS", v: (r) => r.a.os, filtro: true },
    { t: "Referência", v: (r) => referenciaAmostra(r.a), filtro: true },
    { t: "Descrição", v: (r) => r.a.identificacao || r.a.servico, filtro: true },
    { t: "Parâmetro", v: (r) => r.x.nome, filtro: true },
    { t: "Tipo Parâmetro", v: (r) => dados.parametros.find((p) => p.id === r.x.pid)?.classificacao || "", filtro: true },
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
    { t: "Data Limite da Análise", v: (r) => prazoAnalitico(dados, r.a, r.x.pid), h: (r) => quandoBR(prazoAnalitico(dados, r.a, r.x.pid)) },
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
      <Grade key={chave} id="rev-res" exportar="revisao-resultados" linhas={linhas} colunas={colunas} filtrosColuna multipla selecao={sel} aoSelecionar={setSel} ocultasPadrao={["Parecer"]}
        opcoesFiltro={{ 7: ["Aguardando", "Revisado", "Revisão LAB"], 8: PRIORIDADES }} aoAbrir={(r) => navegar("analise", r.a.id)}
        botoes={[
          { rotulo: "Selecionar todos", acao: () => setSel(new Set(linhas.filter((r) => r.x.etapa === "Revisão").map((r) => r.id))) },
          { rotulo: "Deselecionar todos", acao: () => setSel(new Set()) },
          { rotulo: "Retornar Laboratório", acao: () => (selecionadas.length ? setJanela({ motivo: "" }) : avisar("Selecione ao menos um resultado.", "err")) },
          { rotulo: "Revisar", acao: () => decidir(true) },
          { rotulo: "Obs amostra", acao: () => (selecionadas.length ? setJanela({ obs: selecionadas[0].a.obsLab || "" }) : avisar("Selecione ao menos um resultado.", "err")) },
          { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setChave((k) => k + 1); } },
        ]} />
      {janela?.obs !== undefined && (
        <Modal titulo="Obs amostra" onFechar={() => setJanela(null)} rotuloOk="Salvar" aoConfirmar={async () => {
          const ams = [...new Map(selecionadas.map((r) => [r.a.id, r.a])).values()];
          try { await salvarLote("amostras", ams.map((a) => ({ ...a, obsLab: janela.obs.trim() })), { motivo: "Observação da amostra (revisão)" }); setSel(new Set()); avisar("Observação salva.", "ok"); } catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="rObs">Observação da amostra ({[...new Set(selecionadas.map((r) => referenciaAmostra(r.a)))].join(", ")})</label><textarea id="rObs" rows={3} value={janela.obs} onChange={(e) => setJanela({ obs: e.target.value })} /></div>
        </Modal>
      )}
      {janela?.motivo !== undefined && (
        <Modal titulo="Informe o motivo do retorno" onFechar={() => setJanela(null)} rotuloOk="Retornar" aoConfirmar={() => (janela.motivo.trim() ? decidir(false, janela.motivo) : (avisar("Informe o motivo do retorno.", "err"), false))}>
          <div className="fg"><label htmlFor="rMot">Motivo do retorno</label><input id="rMot" list="mot-rev" value={janela.motivo} onChange={(e) => setJanela({ motivo: e.target.value })} />
            <datalist id="mot-rev">{dados.motivos_alteracao.filter(estaAtivo).map((m) => <option key={m.id} value={m.identificacao} />)}</datalist></div>
        </Modal>
      )}
    </Caixa>
  );
}

/* ---------- Certificado ---------- */

// Prazo da fatura pela condição de pagamento do contrato ("Boleto bancário, 10 dias" → 10).
const emAberto = (r) => r.status !== "Pago" && r.status !== "Cancelado" && r.status !== "Agrupada";

export function RevisaoCertificado() {
  const { dados } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [chave, setChave] = useState(0);
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
      <Grade key={chave} id="rev-cert" exportar="certificados" linhas={linhas} colunas={colunas} filtrosColuna opcoesFiltro={{ 7: ["Sim", "Não"] }} ocultasPadrao={["Certificados"]}
        selecao={sel} aoSelecionar={setSel} aoAbrir={(r) => navegar("certificado", r.id)}
        botoes={[
          { rotulo: "Visualizar", acao: () => { const r = linhas.find((x) => sel.has(x.id)); if (r) navegar("certificado", r.id); else avisar("Selecione uma ordem de serviço.", "err"); } },
          { rotulo: "Limpar Pesquisa", acao: () => { setSel(new Set()); setChave((k) => k + 1); } },
        ]} />
    </Caixa>
  );
}

// Conteúdo do certificado congelado na emissão (o que foi assinado não muda).
function montarConteudo(dados, a) {
  const os = dados.ordens.find((o) => o.id === a.osId) || {};
  const ct = dados.contratos.find((c) => c.id === a.contratoId) || {};
  const cli = dados.clientes.find((c) => c.id === a.clienteId) || {};
  const sol = dados.solicitantes.find((x) => x.id === (os.solicitanteId || ct.solicitanteId));
  const unidade = (cli.unidades || []).find((u) => u.id === ct.unidade || u.nome === ct.unidade);
  const defs = [...camposAtivos(dados.plano_amostragem), ...camposAtivos(dados.campos_coleta)];
  return {
    cliente: { nome: cli.razao || "", doc: cli.doc || "", tel: cli.tel || cli.cel || "", email: emailDoTipo(cli, "Resultados"), endereco: [cli.end, cli.num].filter(Boolean).join(" - "), bairro: cli.bairro || "", cidade: [cli.cidade, cli.uf].filter(Boolean).join("/"), cep: cli.cep || "", unidade: unidade?.nome || "", solicitante: sol ? (sol.razao || sol.nome) : "" },
    amostra: {
      ref: referenciaAmostra(a), barra: a.barra, os: a.os, proposta: ct.proposta || "", servico: a.servico, matriz: a.matriz, legislacao: a.legislacao, identificacao: a.identificacao, local: a.local,
      respAmostra: a.respAmostra, coletor: a.coletor || "", dataColeta: a.dataColeta, dataEntrada: a.dataEntrada, inspecao: a.inspecao || null, enderecoColeta: a.enderecoColeta || "",
      campos: valoresDinamicos(defs, a.fichaColeta || {}), obsLab: a.obsLab || "",
    },
    analises: a.analises.map((x) => {
      const p = dados.parametros.find((q) => q.id === x.pid) || {};
      const lim = limiteDe(dados, a, x.pid);
      const naoAcred = p.id ? p.acreditado !== "Sim" : !x.acred;
      return { nome: x.nome, resultado: resultadoExibido(x.resultado, { lq: x.lq, casas: p.casasDecimais }), un: x.un, lq: x.lq, vmp: textoLimite(lim), parecer: parecer(x.resultado, lim, x.lq), metodo: x.metodo, acred: acreditadoNoEscopo(dados.escopo_acreditacao, { parametro: p.id ? p : { acreditado: x.acred ? "Sim" : "Não", nome: x.nome, inloco: x.inloco ? "Sim" : "" }, metodoTexto: x.metodo, matriz: a.matriz || a.servico }), naoAcred, inloco: !!x.inloco || p.inloco === "Sim" || /in\s*situ/i.test(x.nome), subcontratado: p.subcontratado ? (dados.subcontratados.find((s) => s.id === p.subcontratado)?.empresa || "Subcontratado") : "", inicio: x.inicio, termino: x.termino, incerteza: p.incerteza || "" };
    }),
  };
}

const NOTAS_RE = [
  "A incerteza (U) relatada é baseada na incerteza padrão combinada, multiplicada por um fator de abrangência k=2, para um nível de confiança de 95%.",
  "As unidades do relatório de ensaio podem ser convertidas de acordo com a legislação solicitada.",
  "O MinasLab adota a seguinte regra de decisão para expressar os resultados obtidos: a incerteza da medição do método é informada, entretanto esta não faz parte da declaração de conformidade, ficando a critério do contratante a aplicabilidade das incertezas no cálculo final do resultado expresso no relatório.",
  "O relatório de ensaio só deve ser reproduzido por completo. A reprodução parcial requer aprovação por escrito deste laboratório.",
  "Os resultados referem-se exclusivamente às amostras analisadas, não sendo extensivo a quaisquer lotes.",
  "Este laboratório atende aos requisitos de competência da ABNT NBR ISO/IEC 17025:2017.",
  "Quando amostragem realizada pelo cliente, o MinasLab não se responsabiliza pelos resultados dos ensaios a partir da entrada das amostras no laboratório.",
  "A coleta realizada pelo MinasLab segue os procedimentos conforme POP-AM-01, e plano de amostragem com todas informações necessárias em formulário de ordem de serviços.",
];

const sup = (x) => (x.inloco ? "³" : x.acred ? "¹" : "²");

// Relatório de Ensaio no padrão MinasLab (modelo RE do GerenciaLab), com o
// conteúdo congelado na emissão.
export function DocCertificado({ cert, dados, previa = false }) {
  const cfg = configSistema(dados);
  const cliAtual = dados.clientes.find((c) => c.id === cert.clienteId) || {};
  const { amostra: am, analises } = cert.conteudo;
  const cli = cert.conteudo.cliente || { nome: cliAtual.razao, doc: cliAtual.doc, tel: cliAtual.tel, email: cliAtual.email, endereco: [cliAtual.end, cliAtual.num].filter(Boolean).join(" - "), bairro: cliAtual.bairro, cidade: [cliAtual.cidade, cliAtual.uf].filter(Boolean).join("/"), cep: cliAtual.cep };
  const nc = analises.filter((x) => x.parecer === "Não conforme");
  const temSub = analises.some((x) => x.subcontratado);
  const anterior = cert.substitui ? dados.certificados.find((c) => c.id === cert.substitui) : null;
  const signat = dados.funcionarios.find((f) => f.nome === cert.signatario);
  const insp = am.inspecao || {};
  const acred = dados.escopo_acreditacao[0]?.acreditacao;
  const obs = [
    ...(insp.desvios?.length ? [`Informações sobre o recebimento da amostra: ${insp.desvios.join("; ")}${insp.observacoes ? ` ${insp.observacoes}` : ""}. Os resultados podem ter sido afetados.`] : insp.observacoes ? [`Informações sobre o recebimento da amostra: ${insp.observacoes}`] : []),
    ...(am.obsLab ? [am.obsLab] : []),
    ...(anterior ? [`Este relatório substitui o nº ${anterior.numero}${anterior.revisao ? ` rev. ${anterior.revisao}` : ""}. Motivo: ${cert.motivoRevisao}.`] : []),
    ...(temSub ? [`Ensaio(s) realizado(s) por laboratório subcontratado: ${[...new Set(analises.filter((x) => x.subcontratado).map((x) => `${x.nome} (${x.subcontratado})`))].join(", ")}.`] : []),
    "Os resultados se restringem à amostra analisada e ensaios realizados.",
  ];
  const numero = previa ? "PRÉVIA — sem validade" : `${cert.numero}${cert.revisao ? ` rev. ${cert.revisao}` : ""}`;
  const pares = (lista) => lista.map(([r, v]) => [r, v]);
  return (
    <Documento dados={dados} titulo={cfg.tituloCertificado || "Relatório de Ensaio"} subtitulo={numero} codigoModelo={cfg.codigoRE}>
      <Bloco titulo="Identificação do Cliente" pares={pares([["Nome", cli.nome], ["CNPJ/CPF", cli.doc], ["Telefone", cli.tel], ["E-mail", cli.email], ["Endereço", cli.endereco], ["Bairro", cli.bairro], ["Cidade/UF", cli.cidade], ["CEP", cli.cep], ["Unidade", cli.unidade || "Não consta"], ["Solicitante", cli.solicitante || "-"]])} />
      <Bloco titulo="Dados da Amostragem" pares={[
        ["Proposta Comercial", am.proposta], ["Ordem de Serviço / Plano de amostragem", am.os], ["Referência da Amostra", am.ref], ["Descrição da Amostra", am.identificacao || am.matriz],
        ["Data Coleta", am.dataColeta ? `${quandoBR(am.dataColeta)} h` : ""], ["Data Recebimento", am.dataEntrada ? `${quandoBR(am.dataEntrada)} h` : ""],
        ["Tipo de Amostra", am.matriz || am.servico], ["Endereço da Coleta", am.enderecoColeta],
        ["Temperatura de recebimento", insp.temperatura ? `${insp.temperatura} °C` : ""], ["Responsável pela coleta", am.respAmostra === "Cliente" ? "Cliente" : am.coletor],
        ...(am.campos || []),
      ]} />
      <Bloco titulo="Resultados Analíticos">
        <table><thead><tr><th>Ensaio</th><th>Resultado</th><th>Unidade</th><th>LQ</th><th>Incerteza</th><th>VMP</th><th>Metodologia</th><th>Data do ensaio</th></tr></thead>
          <tbody>{analises.map((x, i) => <tr key={i}><td className="esq">{x.nome}<sup>{sup(x)}</sup>{x.subcontratado ? <sup>⁴</sup> : null}</td><td className={x.parecer === "Não conforme" ? "nc" : ""}>{x.resultado}</td><td>{x.un}</td><td>{x.lq}</td><td>{x.incerteza || "-"}</td><td>{x.vmp || "-"}</td><td>{x.metodo}</td><td>{x.termino ? quandoBR(String(x.termino).slice(0, 10)) : "-"}</td></tr>)}</tbody></table>
      </Bloco>
      {am.legislacao && <Bloco titulo="Legislação de referência"><p><b>VMP:</b> {am.legislacao}</p></Bloco>}
      <Bloco titulo="Legenda"><p><b>VMP</b> - Valor Máximo Permitido, <b>LQ</b> - Limite de Quantificação, <b>NA</b> - Não Aplicável, <sup>1</sup> Ensaio acreditado{acred ? ` (Cgcre ${acred})` : ""}, <sup>2</sup> Ensaio não acreditado, <sup>3</sup> Ensaio realizado in situ (realizado nas dependências do cliente){temSub ? <>, <sup>4</sup> Ensaio subcontratado</> : null}.</p></Bloco>
      <Bloco titulo="Notas">{NOTAS_RE.map((t) => <p key={t}>{t}</p>)}<p style={{ marginTop: 6 }}><b>Observações</b></p>{obs.map((t) => <p key={t}>- {t}</p>)}</Bloco>
      <Bloco titulo="Declaração de Conformidade">
        {am.legislacao ? (nc.length
          ? <p>Amostra em desacordo com os padrões estabelecidos pela Legislação citada acima, para o(s) parâmetro(s) <b>{nc.map((x) => x.nome).join(", ")}</b>.</p>
          : <p>Os resultados analíticos obtidos pelo laboratório, referente aos parâmetros avaliados na amostra analisada, demonstram conformidade com os limites e padrões estabelecidos pela legislação mencionada.</p>)
          : <p>Não foi solicitada declaração de conformidade com legislação para esta amostra.</p>}
        <p>As opiniões e interpretações expressas acima não fazem parte do escopo de reconhecimento de competência deste laboratório.</p>
      </Bloco>
      {previa ? <p className="docml-previa" style={{ textAlign: "center" }}>PRÉVIA — documento sem validade, ainda não assinado.</p> : <>
        <div className="docml-assin"><b>{dataExtenso(cert.emitidoEm, cfg.cidadeAssinatura)}</b><br /><span className="linha">{cert.signatario}<br />{signat?.registro || cert.cargo || "Signatário autorizado"}<br /><span style={{ fontSize: 9 }}>Assinado eletronicamente em {quandoBR(cert.emitidoEm)}</span></span></div>
        <div className="docml-valid"><b>Código de Validação:</b> {cert.codigoValidacao || codigoValidacao(cert.conteudo, cert.numero)}</div>
      </>}
    </Documento>
  );
}

// Amostras em revisão da OS (GerenciaLab): Revisar (confere o certificado),
// Revisar automático, Retornar para revisão de resultado, Liberar para
// assinatura; depois o signatário assina e emite.
export function CertificadoOS({ param }) {
  const ctx = useDados();
  const { dados, salvar, salvarLote, proximo, eu } = ctx;
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [ver, setVer] = useState(null);
  const [janela, setJanela] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const os = dados.ordens.find((o) => o.id === param);
  if (!os) return <NaoAchou />;
  const cfg = configSistema(dados);
  const amostras = dados.amostras.filter((a) => a.osId === os.id && a.status !== "Cancelado").sort((a, b) => a.num - b.num);
  const vigente = (a) => dados.certificados.find((c) => c.amostraId === a.id && !c.substituidoPor);
  const signatarios = dados.funcionarios.filter((f) => estaAtivo(f) && f.signatario === "Sim");
  const eu_ = signatarios.find((f) => f.usuario === eu?.usuario);
  const contrato = dados.contratos.find((c) => c.id === os.contratoId);
  const pronta = (a) => a.analises.length > 0 && a.analises.every((x) => x.etapa === "Revisado");
  const marcadas = amostras.filter((a) => sel.has(a.id));
  const quem = () => ({ por: eu?.nome || eu?.usuario || "", em: agoraLocal() });
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
        revisadoPor: a.certRevisao?.por || "", liberadoPor: a.liberadaAssinatura?.por || "",
        conteudo: montarConteudo(dados, a),
      }, { numerar: true, motivo: anterior ? `Reemissão: ${motivoRevisao}` : "Emissão do certificado" });
      if (anterior) await salvar("certificados", { ...anterior, substituidoPor: cert.id }, { motivo: `Substituído pela revisão ${cert.revisao}` });
      if (!anterior) {
        // A fatura já nasceu com a OS: paga → Concluída; em aberto → Faturamento.
        const fat = faturaDaAmostra(dados, a);
        const faturar = faturaPorOS(cfg, contrato) && fat?.status !== "Pago";
        await salvar("amostras", { ...a, status: faturar ? "Faturamento" : "Concluída", dataAssinatura: agora, certificadoId: cert.id }, { motivo: "Certificado emitido" });
      } else await salvar("amostras", { ...a, certificadoId: cert.id }, { motivo: `Certificado reemitido (rev. ${cert.revisao})` });
      avisar(`Certificado ${cert.numero}${cert.revisao ? ` rev. ${cert.revisao}` : ""} emitido.`, "ok");
      setVer(cert.id);
    } catch (e) { avisar(e.message, "err"); return false; } finally { setOcupado(""); }
  };
  const exigir = (fn) => () => (marcadas.length ? fn(marcadas) : avisar("Selecione ao menos uma amostra.", "err"));
  const gravarLote = async (lista, motivo, msg) => { try { await salvarLote("amostras", lista, { motivo }); setSel(new Set()); avisar(msg, "ok"); } catch (e) { avisar(e.message, "err"); return false; } };
  const situacao = (a) => (vigente(a) ? "Emitido" : a.liberadaAssinatura ? "Liberado para assinatura" : a.certRevisao ? "Certificado revisado" : pronta(a) ? "Aguardando revisão" : "Resultados em revisão");
  const colunas = [
    { t: "Amostra ID", v: (a) => Number(a.cod) || 0 },
    { t: "Referência", v: (a) => referenciaAmostra(a) },
    { t: "Código barra", v: (a) => a.barra },
    { t: "Descrição", v: (a) => `${a.matriz || a.servico}${a.identificacao ? ` - ${a.identificacao}` : ""}` },
    { t: "Data Coleta", v: (a) => a.dataColeta || "", h: (a) => quandoBR(a.dataColeta), fv: (a) => quandoBR(a.dataColeta) },
    { t: "Data entrega", v: (a) => a.dataEntrega || "", h: (a) => quandoBR(a.dataEntrega), fv: (a) => quandoBR(a.dataEntrega) },
    { t: "Revisado", v: (a) => a.analises.filter((x) => x.etapa === "Revisado").length, h: (a) => { const r = a.analises.filter((x) => x.etapa === "Revisado").length; return <span className={`lbl ${r === a.analises.length ? "ok" : "warn"}`}>{r}/{a.analises.length} Revisado</span>; } },
    { t: "Pendência", v: (a) => (pronta(a) ? "Não" : "Sim"), h: (a) => (pronta(a) ? "Não" : <span className="lbl warn">Sim</span>) },
    { t: "Situação", v: situacao, h: (a) => <span className={`lbl ${{ Emitido: "ok", "Liberado para assinatura": "primary", "Certificado revisado": "info" }[situacao(a)] || "default"}`}>{situacao(a)}</span> },
    { t: "Certificado", v: (a) => { const c = vigente(a); return c ? `${c.numero}${c.revisao ? ` rev. ${c.revisao}` : ""}` : ""; } },
  ];
  const certVer = ver && dados.certificados.find((c) => c.id === ver);
  const previa = ver && !certVer ? amostras.find((a) => a.id === ver) : null;
  return (
    <>
      <div className="box nao-imprimir">
        <div className="box-head-row"><h2 className="box-title">Amostras em revisão Ordem de Serviço {numeroOS(os)}</h2>{ver && <div className="acoes"><button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir / PDF</button><button type="button" className="btn btn-default" onClick={() => setVer(null)}>Fechar visualização</button></div>}</div>
        {!eu_ && <p className="aviso alerta">{signatarios.length ? "Você não é signatário autorizado: pode revisar e liberar, mas não assinar." : "Nenhum signatário cadastrado. Em Configurações → Funcionários marque “Signatário de certificado” e ligue à conta do painel."}</p>}
        <Grade id="rev-amostras" exportar="amostras-revisao" linhas={amostras} colunas={colunas} multipla selecao={sel} aoSelecionar={setSel} ordemInicial={[0, "asc"]} porPaginaInicial={100}
          aoAbrir={(a) => setVer(vigente(a)?.id || a.id)}
          botoes={[
            { rotulo: "Voltar", acao: () => navegar("list-revisions") },
            { rotulo: "Selecionar todos", acao: () => setSel(new Set(amostras.map((a) => a.id))) },
            { rotulo: "Deselecionar todos", acao: () => setSel(new Set()) },
            { rotulo: "Revisar", acao: exigir((l) => { const a = l[0]; if (!pronta(a)) { avisar("Há resultados desta amostra ainda sem revisão.", "err"); return; } setVer(a.id); setJanela({ revisar: a }); }) },
            { rotulo: "Revisar automático", acao: () => { const l = amostras.filter((a) => pronta(a) && !a.certRevisao && !vigente(a)); if (!l.length) { avisar("Nenhuma amostra pronta aguardando revisão do certificado.", "err"); return; } gravarLote(l.map((a) => ({ ...a, certRevisao: { ...quem(), automatico: true } })), "Revisão automática do certificado", `${l.length} certificado(s) revisado(s).`); } },
            { rotulo: "Retornar para revisão de resultado", acao: exigir((l) => { const v = l.filter((a) => vigente(a)); if (v.length) { avisar("Amostra com certificado emitido: use Reemitir.", "err"); return; } setJanela({ retornar: l, motivo: "" }); }) },
            { rotulo: "Liberar para assinatura", acao: exigir((l) => { const sem = l.filter((a) => !a.certRevisao); if (sem.length) { avisar(`Revise o certificado antes: ${sem.map(referenciaAmostra).join(", ")}.`, "err"); return; } gravarLote(l.filter((a) => !a.liberadaAssinatura).map((a) => ({ ...a, liberadaAssinatura: quem() })), "Liberado para assinatura", "Liberado para assinatura."); }) },
            { rotulo: "Assinar e emitir", acao: exigir(async (l) => { const ok = l.filter((a) => a.liberadaAssinatura && !vigente(a)); if (!ok.length) { avisar("Selecione amostras liberadas para assinatura e ainda sem certificado.", "err"); return; } for (const a of ok) if ((await emitir(a)) === false) break; setSel(new Set()); }) },
            { rotulo: "Certificado", menu: [
              { rotulo: "Visualizar", acao: exigir((l) => setVer(vigente(l[0])?.id || l[0].id)) },
              { rotulo: "Reemitir", acao: exigir((l) => { const c = vigente(l[0]); if (!c) { avisar("Esta amostra ainda não tem certificado.", "err"); return; } setJanela({ reemitir: { a: l[0], c, motivo: "" } }); }) },
            ] },
          ]} />
      </div>
      {certVer && <DocCertificado cert={certVer} dados={dados} />}
      {previa && <DocCertificado cert={{ clienteId: previa.clienteId, conteudo: montarConteudo(dados, previa) }} dados={dados} previa />}
      {janela?.revisar && (
        <Modal titulo={`Revisar certificado · ${referenciaAmostra(janela.revisar)}`} onFechar={() => setJanela(null)} rotuloOk="Confirmar revisão" aoConfirmar={() => gravarLote([{ ...janela.revisar, certRevisao: quem() }], "Certificado revisado", "Certificado revisado.")}>
          <p style={{ margin: 0 }}>Confira a prévia do certificado abaixo desta janela (cabeçalho, amostra, resultados, VMP e parecer). Confirmando, a amostra fica pronta para "Liberar para assinatura".</p>
        </Modal>
      )}
      {janela?.retornar && (
        <Modal titulo="Retornar para revisão de resultado" onFechar={() => setJanela(null)} rotuloOk="Retornar" aoConfirmar={() => {
          if (!janela.motivo.trim()) { avisar("Informe o motivo.", "err"); return false; }
          return gravarLote(janela.retornar.map((a) => { const n = { ...a, certRevisao: null, liberadaAssinatura: null, analises: a.analises.map((x) => (x.etapa === "Revisado" ? { ...x, etapa: "Revisão", revisor: "", revisadoEm: "", motivoRetornoCert: janela.motivo.trim() } : x)) }; return { ...n, status: statusPelasAnalises(n) }; }), `Retorno para revisão de resultado: ${janela.motivo.trim()}`, "Resultados voltaram para a Revisão de resultado.");
        }}>
          <div className="fg"><label htmlFor="rcMot">Motivo</label><input id="rcMot" list="mot-rc" value={janela.motivo} onChange={(e) => setJanela({ ...janela, motivo: e.target.value })} /><datalist id="mot-rc">{dados.motivos_alteracao.filter(estaAtivo).map((m) => <option key={m.id} value={m.identificacao} />)}</datalist></div>
        </Modal>
      )}
      {janela?.reemitir && (
        <Modal titulo={`Reemitir ${janela.reemitir.c.numero}`} onFechar={() => setJanela(null)} rotuloOk="Reemitir" aoConfirmar={() => (janela.reemitir.motivo.trim() ? emitir(janela.reemitir.a, janela.reemitir.c, janela.reemitir.motivo.trim()) : (avisar("Informe o motivo da reemissão.", "err"), false))}>
          <p style={{ marginTop: 0 }}>A nova revisão substitui a atual e cita o motivo no certificado (ISO/IEC 17025 7.8.8). Para corrigir um resultado, devolva-o antes na Revisão de resultados.</p>
          <div className="fg"><label htmlFor="reMot">Motivo da reemissão</label><input id="reMot" value={janela.reemitir.motivo} onChange={(e) => setJanela({ reemitir: { ...janela.reemitir, motivo: e.target.value } })} /></div>
        </Modal>
      )}
    </>
  );
}
