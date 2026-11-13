// Formulários do PT 001 (Capacitação do pessoal · ISO/IEC 17025 · 6.2), no desenho dos atuais:
// RT – Registro de treinamento · AVET – Avaliação da eficácia do treinamento · AUTZ – Autorização
// MC – Matriz de competências · RELP – Relação de pessoal.
// Código, nome e revisão vêm da Lista Mestra quando cadastrados lá (dadosDoFormulario); senão, destes padrões.
import { PERGUNTAS_AVET, ORIGENS_TREINAMENTO, STATUS_MATRIZ } from "../../../supabase/functions/_shared/pessoal-regras.mjs";
import { dataBr, esc, texto } from "./formularioQualidade.js";

const ORIGEM = "Documento de origem: PT 001";
export const FORM_RT = { codigo: "RT", titulo: "Registro de Treinamento", revisao: "00", emissao: "2023-11-01", extra: ORIGEM };
export const FORM_AVET = { codigo: "AVET", titulo: "Avaliação da Eficácia do Treinamento", revisao: "00", emissao: "2023-11-01", extra: ORIGEM };
export const FORM_AUTZ = { codigo: "AUTZ", titulo: "Autorização", revisao: "01", emissao: "2023-11-01", extra: ORIGEM };
export const FORM_MC = { codigo: "MC", titulo: "Matriz de Competências", revisao: "00", emissao: "2023-11-01", extra: ORIGEM };
export const FORM_RELP = { codigo: "RELP", titulo: "Relação de Pessoal", revisao: "00", emissao: "2023-11-01", extra: ORIGEM };

const rot = (lista, v) => lista.find((x) => x[0] === v)?.[1] || v || "";
const sp = '<tr><td class="sp" colspan="6"></td></tr>';

/** RT: um treinamento com os participantes e o espaço para assinatura de cada um. */
export function corpoRt(t, { tituloDoc = () => "" } = {}) {
  const part = t.participantes || [];
  const linhas = Math.max(part.length, 8);
  return `<table style="table-layout:fixed"><colgroup><col style="width:24%"><col style="width:16%"><col style="width:14%"><col style="width:12%"><col style="width:10%"><col></colgroup>
${sp}
<tr><td class="rot">Nº do registro:</td><td>${esc(t.codigo)}</td><td class="rot">Origem:</td><td colspan="3">${esc(rot(ORIGENS_TREINAMENTO, t.origem))}${t.tipo === "EXTERNO" ? " · externo" : ""}</td></tr>
<tr><td class="rot" style="white-space:normal">Responsável(is) pelo treinamento e capacitação:</td><td colspan="5">${esc(t.instrutor)}</td></tr>
<tr><td class="rot">Data:</td><td>${esc(dataBr(t.data))}</td><td class="rot">Carga horária:</td><td>${esc(t.carga_horaria)}</td><td class="rot">Local:</td><td>${esc(t.local)}</td></tr>
<tr><td class="rot">Treinamento:</td><td colspan="5">${texto(t.tema)}</td></tr>
<tr><td class="rot">Objetivo:</td><td colspan="5">${texto(t.objetivo)}</td></tr>
${(t.documentos || []).length ? `<tr><td class="rot">Documentos treinados:</td><td colspan="5">${(t.documentos || []).map((c) => esc([c, tituloDoc(c)].filter(Boolean).join(" – "))).join("<br>")}</td></tr>` : ""}
${sp}
<tr><td colspan="3" class="sec">Participantes</td><td colspan="3" class="sec">Assinatura</td></tr>
${Array.from({ length: linhas }, (_, i) => { const p = part[i]; return `<tr><td colspan="3" style="height:9mm">${p ? esc(p.nome) + (p.cargo ? ` <small>(${esc(p.cargo)})</small>` : "") : ""}</td><td colspan="3"></td></tr>`; }).join("")}
${sp}
<tr><td colspan="6" class="sec">Observações</td></tr>
<tr><td colspan="6" class="caixa">${texto(t.observacao) || "&nbsp;"}</td></tr>
<tr><td colspan="6" style="text-align:center;font-weight:bold">Realizar avaliação da eficácia 1 mês após a data do treinamento${t.eficacia_prevista ? ` (até ${esc(dataBr(t.eficacia_prevista))})` : ""}.</td></tr>
</table>`;
}

/** AVET: uma avaliação por participante, com as quatro perguntas na escala de 1 a 5 e o plano de ação. */
export function corpoAvet(a, t, { nome = (u) => u } = {}) {
  const marca = (k, n) => (Number(a?.[k]) === n ? "X" : "");
  const na = a && a.eficaz;
  const pergunta = ([k, titulo, opcoes], i) => opcoes
    ? `<table style="margin-top:4px"><colgroup><col style="width:7%"><col><col style="width:9%"></colgroup>
<tr><td colspan="3" class="sec" style="text-align:left">${["I", "II", "III"][i]}) ${esc(titulo)}</td></tr>
${opcoes.map((o, j) => `<tr><td style="text-align:center">${j + 1}</td><td>${esc(o)}</td><td style="text-align:center;font-weight:bold">${marca(k, j + 1)}</td></tr>`).join("")}</table>`
    : `<table style="margin-top:4px"><tr><td colspan="6" class="sec" style="text-align:left">IV) ${esc(titulo)}</td></tr>
<tr>${[1, 2, 3, 4, 5].map((n) => `<td style="text-align:center;width:15%">${n} ${marca(k, n) ? "<b>[X]</b>" : "[ &nbsp; ]"}</td>`).join("")}<td style="text-align:center">${a ? (a.eficaz ? "<b>EFICAZ</b>" : "<b>NÃO EFICAZ</b>") : "Eficaz [ ] Não eficaz [ ]"}</td></tr></table>`;
  return `<table style="margin-top:6px"><colgroup><col style="width:16%"><col style="width:38%"><col style="width:18%"><col></colgroup>
<tr><td class="rot">Nome:</td><td>${esc(a?.nome)}</td><td class="rot">Função:</td><td>${esc(a?.cargo)}</td></tr>
<tr><td class="rot">Treinamento:</td><td>${esc(t ? `${t.codigo} – ${t.tema}` : "")}</td><td class="rot">Data da avaliação:</td><td>${esc(dataBr(a?.data_avaliacao))}</td></tr>
<tr><td class="rot">Responsáveis pela avaliação:</td><td colspan="3">${esc((a?.avaliadores || []).map(nome).join(" · ")) || "&nbsp;"}</td></tr></table>
${PERGUNTAS_AVET.map(pergunta).join("")}
<table style="margin-top:4px"><colgroup><col style="width:22%"><col><col style="width:10%"><col style="width:16%"></colgroup>
<tr><td colspan="4" class="rot">Descrever as melhorias obtidas</td></tr>
<tr><td colspan="4" class="caixa">${texto(a?.melhorias) || "&nbsp;"}</td></tr>
<tr><td class="rot">Aprovação – Gerente:</td><td>${esc(a?.aprovado_por ? nome(a.aprovado_por) : "")}</td><td class="rot">Data:</td><td>${esc(dataBr(a?.aprovado_em))}</td></tr></table>
<table style="margin-top:6px"><colgroup><col style="width:28%"><col><col style="width:22%"></colgroup>
<tr><td colspan="3" class="sec">Plano de Ação para Não Eficácia de Treinamento</td></tr>
<tr><td class="rot">Descrição e causa da não eficácia:</td><td colspan="2">${na ? "NA" : texto(a?.plano_causa)}</td></tr>
<tr><td class="rot">Ação a ser tomada:</td><td>${na ? "NA" : texto(a?.plano_acao)}</td><td>${na ? "" : esc([a?.plano_responsavel, dataBr(a?.plano_data)].filter(Boolean).join(" · "))}</td></tr>
<tr><td class="rot">Verificação da eficácia da ação tomada:</td><td>${na ? "NA" : texto(a?.plano_verificacao)}</td><td>${na ? "" : esc(dataBr(a?.plano_verificado_em))}</td></tr></table>`;
}

/** AUTZ: declaração de autorização de atividades, no texto do modelo rev. 01. */
export function corpoAutz(z, { gerente = "", empresa = "Minas Lab", cnpj = "", nome = (u) => u } = {}) {
  const atividades = String(z?.atividades || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const quem = z?.autorizado_por ? nome(z.autorizado_por) : gerente;
  return `<div style="padding:4mm 2mm">
<p style="text-align:right;margin:0 0 4mm"><b>${esc(z?.codigo || "")}</b></p>
<h3 style="text-align:center;margin:2mm 0 6mm">DECLARAÇÃO DE AUTORIZAÇÃO DE ATIVIDADES</h3>
<p style="text-align:justify">Eu, <b>${esc(quem) || "______________________"}</b>, na qualidade de Gerente da empresa ${esc(empresa)}${cnpj ? `, inscrita no CNPJ sob o nº ${esc(cnpj)}` : ""}, declaro para os devidos fins que o(a) colaborador(a) <b>${esc(z?.nome) || "______________________"}</b>, no cargo/função de <b>${esc(z?.cargo) || "__________"}</b>, encontra-se devidamente qualificado(a), treinado(a) e competente para o desempenho das atividades abaixo descritas, estando formalmente autorizado(a) no âmbito do Sistema de Gestão da Qualidade da organização, em conformidade com a ABNT NBR ISO/IEC 17025:2017.</p>
<p>Declaro que o(a) referido(a) colaborador(a) está autorizado(a) a realizar as seguintes atividades:</p>
<ul style="margin:2mm 0 4mm 6mm">${atividades.length ? atividades.map((x) => `<li>${esc(x)}</li>`).join("") : "<li>&nbsp;</li><li>&nbsp;</li><li>&nbsp;</li>"}</ul>
${z?.fundamentacao ? `<p style="text-align:justify"><b>Fundamentação:</b> ${texto(z.fundamentacao)}</p>` : ""}
<p style="text-align:justify">As atividades acima deverão ser executadas em conformidade com os procedimentos estabelecidos no Sistema de Gestão da Qualidade, assegurando a rastreabilidade, a integridade das informações, o controle de versões e o atendimento aos requisitos da ABNT NBR ISO/IEC 17025:2017.</p>
<p style="text-align:justify">Por ser expressão da verdade e para fins de evidência em auditorias e controles internos, firmo a presente declaração. Declaro ainda que esta autorização está fundamentada em avaliação de competência, treinamentos realizados e evidências documentadas, podendo ser revisada, atualizada ou revogada conforme necessidade organizacional ou reavaliação de desempenho do(a) colaborador(a).${z?.revisar_em ? ` Próxima reavaliação prevista para ${esc(dataBr(z.revisar_em))}.` : ""}</p>
${z?.revogada_em ? `<p style="border:1px solid #000;padding:2mm"><b>REVOGADA em ${esc(dataBr(z.revogada_em))}.</b> Motivo: ${texto(z.revogada_motivo)}</p>` : ""}
<table style="margin-top:18mm;border:0"><tr>
<td style="border:0;border-top:1px solid #000;text-align:center;width:45%">${esc(z?.nome || "Colaborador(a)")}${z?.data_autorizacao ? `, ${esc(dataBr(z.data_autorizacao))}` : ""}</td><td style="border:0;width:10%"></td>
<td style="border:0;border-top:1px solid #000;text-align:center;width:45%">${esc(quem || "Gerente")}${z?.data_autorizacao ? `, ${esc(dataBr(z.data_autorizacao))}` : ""}</td></tr></table>
</div>`;
}

/** MC: por colaborador, os documentos da Lista Mestra e a situação (liberado, em treinamento). */
export function corpoMc(pessoa, linhas, { aprovadoPor = "", data = "" } = {}) {
  return `<table>
${sp}
<tr><td class="rot">Nome do colaborador:</td><td colspan="3">${esc(pessoa?.nome)}</td></tr>
<tr><td class="rot">Função:</td><td colspan="3">${esc(pessoa?.cargo)}</td></tr>
${sp}
<tr><th style="width:52%">Lista Mestra</th><th style="width:14%">Status</th><th style="width:14%">Data de liberação</th><th>Detalhes e observações</th></tr>
${(linhas.length ? linhas : Array.from({ length: 12 }, () => ({}))).map((l) => `<tr><td>${esc([l.documento, l.documento_titulo].filter(Boolean).join(" - "))}</td><td>${esc(l.status ? rot(STATUS_MATRIZ, l.status) : "")}</td><td>${esc(dataBr(l.liberado_em))}</td><td>${esc([l.origem, l.observacao].filter(Boolean).join(" · ") || (l.status ? "NA" : ""))}</td></tr>`).join("")}
<tr><td class="rot">Aprovação:</td><td>${esc(aprovadoPor)}</td><td class="rot">Data:</td><td>${esc(dataBr(data))}</td></tr>
</table>`;
}

/** RELP: lista do pessoal com função, formação e situação de autorização/supervisão. */
export function corpoRelp(pessoas) {
  return `<table>
${sp}
<tr><th>Nome</th><th>Função / cargo</th><th>Setor</th><th>Admissão</th><th>Formação</th><th>Registro no conselho</th><th>Autorização vigente</th></tr>
${pessoas.map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.cargo)}</td><td>${esc(p.setor)}</td><td>${esc(dataBr(p.admissao))}</td><td>${esc([p.escolaridade, p.formacao].filter(Boolean).join(" · "))}</td><td>${esc(p.registroConselho)}</td><td>${esc(p.autz || "—")}</td></tr>`).join("")}
</table>`;
}
