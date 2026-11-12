// FM-LAB-113 · Registro de Reclamações de Clientes (antigo RRC rev. 01, PG 013). Mesmo desenho do
// formulário em planilha, com os campos que o 7.9 pede e o RRC não tinha: canal, OS/relatório,
// classificação, validação, confirmação do recebimento, prazos, NC vinculada e quem estava envolvido.
import { CANAIS, CLASSIFICACOES } from "../../../supabase/functions/_shared/reclamacoes-regras.mjs";
import { dataBr, esc, texto } from "./formularioQualidade.js";

export const FORM_RRC = { codigo: "FM-LAB-113", titulo: "Registro de Reclamações de Clientes", revisao: "00", emissao: null, emitente: "Comitê da Qualidade" };

export function corpoRrc(r, { nome = (u) => u, nc = null } = {}) {
  const rot = (lista, v) => lista.find((x) => x[0] === v)?.[1] || "";
  const pessoa = (u) => esc(u ? nome(u) : "");
  const linha = (a, va, b, vb) => `<tr><td class="rot">${a}</td><td>${va || ""}</td><td class="rot">${b}</td><td>${vb || ""}</td></tr>`;
  const secao = (t) => `<tr><td colspan="4" class="sec">${t}</td></tr>`;
  const caixa = (v) => `<tr><td colspan="4" class="caixa">${texto(v) || "&nbsp;"}</td></tr>`;
  const procede = r.procedente === true ? "Procede" : r.procedente === false ? "Não procede" : "";
  return `<table>
<tr><td class="sp" colspan="4"></td></tr>
${linha(`${r.tipo === "SUGESTAO" ? "Sugestão" : "Reclamação"} Nº:`, esc(r.codigo), "Data Reclamação:", esc(dataBr(r.recebida_em)))}
${linha("Reclamante:", esc(r.reclamante), "CNPJ/CPF:", esc(r.cnpj_cpf))}
${linha("Cliente:", esc(r.cliente_nome), "Canal:", esc(rot(CANAIS, r.canal)))}
${linha("Contato:", esc(r.contato), "E-mail:", esc(r.email))}
${linha("OS / Relatório:", esc(r.os_referencia), "Data do ocorrido:", esc(dataBr(r.ocorrido_em)))}
${linha("Classificação:", esc(rot(CLASSIFICACOES, r.classificacao)), "Prazo de resposta:", esc(dataBr(r.prazo_resposta)))}
${secao("Descrição Detalhada da Reclamação")}
${caixa(r.descricao)}
${linha("Recebida por:", pessoa(r.recebida_por), "Data:", esc(dataBr(r.recebida_em)))}
${r.acao_imediata ? `${secao("Ação Imediata (reclamação crítica)")}${caixa(r.acao_imediata)}` : ""}
${secao("Validação e Confirmação do Recebimento ao Reclamante")}
${linha("Resultado da validação:", esc(procede), "Recebimento confirmado em:", esc([dataBr(r.confirmada_em), r.confirmada_meio].filter(Boolean).join(" · ")))}
${caixa(r.validacao)}
${secao("Análise Preliminar / Investigação / Causa Raiz Identificada")}
${caixa(r.analise)}
${nc ? linha("Não conformidade:", esc(nc.codigo), "Situação da NC:", esc(nc.etapa === "ENCERRADA" ? `Encerrada em ${dataBr(nc.encerrada_em)}` : "Em tratamento")) : ""}
${secao("Ação Corretiva / Verificação da Eficácia / Resposta ao Cliente")}
${caixa([r.acao && `Ação: ${r.acao}`, r.eficacia && `Eficácia: ${r.eficacia}`, r.resposta && `Resposta ao cliente: ${r.resposta}`].filter(Boolean).join("\n\n"))}
${linha("Resposta enviada em:", esc([dataBr(r.respondida_em), r.respondida_meio].filter(Boolean).join(" · ")), "Envolvidos no serviço:", esc((r.envolvidos || []).map(nome).join(", ")))}
<tr><td class="sp" colspan="4"></td></tr>
<tr><td class="rot">Analisado Por:</td><td>${pessoa(r.analisado_por)}</td><td class="rot">Data:</td><td>${esc(dataBr(r.analisado_em))}</td></tr>
<tr><td class="rot">Aprovado Por:</td><td>${pessoa(r.aprovado_por)}</td><td class="rot">Data:</td><td>${esc(dataBr(r.aprovado_em))}</td></tr>
<tr><td class="rot ass">Observação:</td><td colspan="3">${texto(r.observacao) || "NA"}</td></tr>
<tr><td class="rot ass">Encerramento / Análise de Tendência:</td><td colspan="3">${texto(r.encerramento)}${r.encerrada_em ? `<br><small>Encerrada em ${esc(dataBr(r.encerrada_em))}</small>` : ""}</td></tr>
</table>`;
}
