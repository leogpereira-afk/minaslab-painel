// Formulários de equipamentos (ISO/IEC 17025 · 6.4 e 6.5; PT 007 e PT 008):
// PLCAL – Plano de calibração e qualificação (no desenho da planilha atual, rev. 02);
// FM-LAB-114 – Ficha e histórico do equipamento (registros do 6.4.13, novo);
// FM-LAB-115 – Etiqueta de situação do equipamento (6.4.8, novo).
import { dataBr, esc, texto } from "./formularioQualidade.js";

export const FORM_PLCAL = { codigo: "PLCAL", titulo: "Plano de Calibração e Qualificação", revisao: "02", emissao: "2023-11-01", extra: "Documento de origem: PT 008" };
export const FORM_FICHA_EQ = { codigo: "FM-LAB-114", titulo: "Ficha e Histórico do Equipamento", revisao: "00", emissao: null, extra: "Documento de origem: PT 007 / PT 008" };
export const FORM_ETIQUETA_EQ = { codigo: "FM-LAB-115", titulo: "Etiqueta de Situação do Equipamento", revisao: "00", emissao: null, extra: "Documento de origem: PT 008" };

const CONTROLES = { CALIBRACAO: "Calibração externa", VERIFICACAO: "Verificação com padrão", VALIDACAO: "Validação", DIARIA: "Verificação diária", NENHUM: "Sem controle" };
const dias = (ymd, hojeYmd) => (ymd ? Math.round((new Date(`${ymd}T12:00:00`) - new Date(`${hojeYmd}T12:00:00`)) / 864e5) : null);

/** Situação para o plano e a etiqueta: APTO, FORA DE USO, VENCIDO ou AGUARDANDO. */
export function statusPlano(e, hojeYmd) {
  if (e.situacao === "INATIVO") return "INATIVO";
  if (e.bloqueado || e.situacao === "MANUTENCAO") return "FORA DE USO";
  if (["DIARIA", "NENHUM"].includes(e.controle) || !e.proxima) return "APTO PARA USO";
  return dias(e.proxima, hojeYmd) < 0 ? "VENCIDO" : "APTO PARA USO";
}
const ultimaCal = (e, calibracoes) => calibracoes.filter((c) => c.equipamento_id === e.id && c.tipo !== "DIARIA" && c.resultado === "APROVADO").sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];

/** PLCAL: um equipamento por linha, com a última calibração, a próxima e os dias que faltam. */
export function corpoPlcal(equipamentos, calibracoes, { hojeYmd, responsavel = "" }) {
  const linhas = equipamentos.filter((e) => e.situacao !== "INATIVO" && e.controle !== "NENHUM").sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true }));
  const cor = (s) => (s === "APTO PARA USO" ? "" : s === "VENCIDO" ? "background:#fde2e2" : "background:#fff3cd");
  return `<table style="margin-top:6px"><tr><td class="rot">Data de hoje:</td><td>${esc(dataBr(hojeYmd))}</td><td class="rot">Responsável e data de atualização:</td><td>${esc(responsavel)} ${esc(dataBr(hojeYmd))}</td></tr></table>
<table style="margin-top:4px;font-size:8.5pt">
<tr><th rowspan="2">Instrumento</th><th colspan="4">Dados da última calibração / verificação</th><th rowspan="2">Próxima calibração / qualificação</th><th rowspan="2">Dias</th><th rowspan="2">Status</th><th rowspan="2">Critério de aceitação</th></tr>
<tr><th>Data</th><th>Realizada por</th><th>Nº do certificado</th><th>Período</th></tr>
${linhas.map((e) => { const c = ultimaCal(e, calibracoes); const st = statusPlano(e, hojeYmd); const d = dias(e.proxima, hojeYmd); const diaria = e.controle === "DIARIA"; return `<tr style="${cor(st)}">
<td><b>${esc(e.codigo)}</b> ${esc(e.nome)}</td><td>${esc(dataBr(c?.data))}</td><td>${esc(c?.laboratorio || "")}</td><td>${esc(c?.certificado || "")}</td>
<td>${diaria ? "Diária" : e.periodicidade_meses ? `${e.periodicidade_meses} mês(es)` : "Indeterminado"}</td><td>${diaria ? "—" : esc(dataBr(e.proxima))}</td><td style="text-align:right">${diaria || d == null ? "—" : d}</td><td><b>${esc(st)}</b></td><td>${esc(e.criterio || "")}</td></tr>`; }).join("")}
</table>
<table style="margin-top:6px;width:60%"><tr><td colspan="2" class="sec">Legenda</td></tr><tr><td style="width:14mm"></td><td>APTO PARA USO</td></tr><tr><td style="background:#fff3cd"></td><td>FORA DE USO / AGUARDANDO CALIBRAÇÃO OU RETORNO</td></tr><tr><td style="background:#fde2e2"></td><td>VENCIDO — não usar nos ensaios</td></tr></table>`;
}

/** FM-LAB-114: identificação (6.4.13 a–c), critério, faixa e todo o histórico de calibração, verificação, manutenção e NC. */
export function corpoFichaEquip(e, { calibracoes = [], manutencoes = [], ncs = [], hojeYmd }) {
  const cals = calibracoes.filter((c) => c.equipamento_id === e.id).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const mans = manutencoes.filter((m) => m.alvoId && m.alvoId === e.bem_id).sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  const ncsEq = ncs.filter((n) => cals.some((c) => c.nc_id === n.id));
  const linha = (a, va, b, vb) => `<tr><td class="rot">${a}</td><td>${va || ""}</td><td class="rot">${b}</td><td>${vb || ""}</td></tr>`;
  return `<table style="margin-top:6px"><colgroup><col style="width:20%"><col style="width:30%"><col style="width:20%"><col></colgroup>
${linha("Código:", `<b>${esc(e.codigo)}</b>`, "Situação:", `<b>${esc(statusPlano(e, hojeYmd))}</b>`)}
${linha("Equipamento:", esc(e.nome), "Setor / local:", esc([e.setor, e.local].filter(Boolean).join(" · ")))}
${linha("Fabricante:", esc(e.fabricante), "Modelo / nº de série:", esc([e.modelo, e.serie].filter(Boolean).join(" · ")))}
${linha("Controle:", esc(CONTROLES[e.controle] || e.controle), "Periodicidade:", esc(e.periodicidade_meses ? `${e.periodicidade_meses} mês(es)` : "—"))}
${linha("Próximo vencimento:", esc(dataBr(e.proxima)), "Faixa de uso:", esc(e.faixa_uso))}
<tr><td class="rot">Critério de aceitação:</td><td colspan="3">${esc(e.criterio)}</td></tr>
<tr><td class="rot">Ensaios que usam:</td><td colspan="3">${esc(e.ensaios_afetados)}</td></tr>
${e.bloqueado ? `<tr><td class="rot">Não apto:</td><td colspan="3">${texto(e.bloqueio_motivo)}</td></tr>` : ""}
${e.observacao ? `<tr><td class="rot">Observação:</td><td colspan="3">${texto(e.observacao)}</td></tr>` : ""}
</table>
<table style="margin-top:6px;font-size:8.5pt"><tr><td colspan="6" class="sec">Calibrações, verificações e qualificações</td></tr>
<tr><th>Data</th><th>Tipo</th><th>Leitura / erro</th><th>Certificado</th><th>Laboratório</th><th>Resultado</th></tr>
${cals.length ? cals.map((c) => `<tr><td>${esc(dataBr(c.data))}</td><td>${esc(CONTROLES[c.tipo] || c.tipo)}</td><td>${esc(c.leitura)}</td><td>${esc(c.certificado)}</td><td>${esc(c.laboratorio)}</td><td>${c.resultado === "REPROVADO" ? "<b>Reprovado</b>" : "Aprovado"}</td></tr>`).join("") : '<tr><td colspan="6">Nenhum registro.</td></tr>'}
</table>
<table style="margin-top:6px;font-size:8.5pt"><tr><td colspan="4" class="sec">Manutenções (danos, defeitos, modificações e reparos)</td></tr>
<tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Executado por</th></tr>
${mans.length ? mans.map((m) => `<tr><td>${esc(dataBr(m.data))}</td><td>${esc(m.tipo)}</td><td>${esc(m.descricao)}</td><td>${esc(m.fornecedor)}</td></tr>`).join("") : '<tr><td colspan="4">Nenhum registro.</td></tr>'}
</table>
${ncsEq.length ? `<table style="margin-top:6px;font-size:8.5pt"><tr><td colspan="3" class="sec">Não conformidades ligadas</td></tr>${ncsEq.map((n) => `<tr><td>${esc(n.codigo)}</td><td>${esc(n.titulo)}</td><td>${esc(n.etapa === "ENCERRADA" ? `Encerrada em ${dataBr(n.encerrada_em)}` : "Em tratamento")}</td></tr>`).join("")}</table>` : ""}`;
}

/** FM-LAB-115: etiquetas de situação, várias por folha, para colar no equipamento. */
export function corpoEtiquetas(lista, calibracoes, { hojeYmd }) {
  const cor = { "APTO PARA USO": "#0f7a4a", "VENCIDO": "#b42318", "FORA DE USO": "#b54708", "INATIVO": "#555" };
  return `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4mm;margin-top:6mm">${lista.map((e) => { const st = statusPlano(e, hojeYmd); const c = ultimaCal(e, calibracoes); return `
<div style="border:2px solid ${cor[st]};border-radius:2mm;padding:3mm;page-break-inside:avoid">
<div style="background:${cor[st]};color:#fff;font-weight:bold;text-align:center;padding:1.5mm;font-size:11pt">${esc(st)}</div>
<table style="margin-top:2mm;font-size:8.5pt"><tr><td class="rot">Equipamento</td><td><b>${esc(e.codigo)}</b> ${esc(e.nome)}</td></tr>
<tr><td class="rot">${e.controle === "DIARIA" ? "Controle" : "Última calibração"}</td><td>${e.controle === "DIARIA" ? "Verificação diária" : esc([dataBr(c?.data), c?.certificado].filter(Boolean).join(" · ")) || "—"}</td></tr>
<tr><td class="rot">Próxima</td><td><b>${e.controle === "DIARIA" ? "—" : esc(dataBr(e.proxima)) || "—"}</b></td></tr>
<tr><td class="rot">Responsável</td><td style="height:7mm"></td></tr></table>
<div style="font-size:6.5pt;text-align:right;margin-top:1mm">FM-LAB-115</div></div>`; }).join("")}</div>`;
}
