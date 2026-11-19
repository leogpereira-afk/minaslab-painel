// Lista de compras para imprimir e entregar a quem vai comprar (Léo, 19/11/2026).
// Agrupada por categoria (uma ida à papelaria, outra ao mercado), com a quantidade
// PEDIDA e a APROVADA, quem pediu e espaço para anotar fornecedor e valor na rua.
import logo from "../../assets/logo-minaslab.webp";
import { esc, dataBr } from "./formularioQualidade.js";
import {
  agruparPorCategoria, rotuloUrgencia, ROTULO_SITUACAO, quantidadePedida, textoQuantidade,
} from "../../../supabase/functions/_shared/compras-solicitacao.mjs";

// Pedida: a guardada na aprovação ou, sem aprovação, a do próprio pedido.
export const qtdePedidaTexto = (c) => c.qtdeSolicitada || c.qtde || (quantidadePedida(c) != null ? textoQuantidade(quantidadePedida(c), c.unidade) : "");
// Aprovada: só existe depois de aprovar (ou já em compra, que passou por aprovação ou não).
export const qtdeAprovadaTexto = (c) => (c.status === "solicitada" || c.status === "cancelada" ? "" : c.qtde || "");

export function htmlListaCompras({ pedidos, titulo, subtitulo, impressoPor }) {
  const grupos = agruparPorCategoria(pedidos);
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const logoUrl = new URL(logo, window.location.href).href;
  const total = pedidos.length;
  const linhas = grupos.map((g) => `
    <tr class="cat"><td colspan="9">${esc(g.rotulo)} <span>· ${g.itens.length} ${g.itens.length === 1 ? "item" : "itens"}</span></td></tr>
    ${g.itens.map((c) => `<tr>
      <td class="ck">☐</td>
      <td><b>${esc(c.item)}</b>${c.detalhes ? `<div class="det">${esc(c.detalhes)}</div>` : ""}${c.obs ? `<div class="det">Obs.: ${esc(c.obs)}</div>` : ""}</td>
      <td class="q">${esc(qtdePedidaTexto(c)) || "—"}</td>
      <td class="q ap">${esc(qtdeAprovadaTexto(c)) || "<span class='vazio'>&nbsp;</span>"}</td>
      <td class="urg ${c.urgencia === "alta" ? "alta" : ""}">${esc(rotuloUrgencia(c.urgencia))}</td>
      <td>${esc(c.solicitante || "—")}${c.setor ? `<div class="det">${esc(c.setor)}</div>` : ""}</td>
      <td class="dt">${esc(dataBr(c.data)) || "—"}</td>
      <td class="sit">${esc(ROTULO_SITUACAO[c.status] || c.status)}</td>
      <td class="anot">${c.fornecedor ? esc(c.fornecedor) : ""}</td>
    </tr>`).join("")}`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
@page { size: A4 landscape; margin: 10mm 10mm 14mm;
  @bottom-left { content: "MinasLab · ${esc(titulo).replace(/"/g, "'")} · impresso em ${esc(agora)}${impressoPor ? ` por ${esc(impressoPor).replace(/"/g, "'")}` : ""}"; font: 8pt Arial, sans-serif; color: #444; }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Arial, sans-serif; color: #444; } }
* { box-sizing: border-box; }
body { margin: 0; font: 9.5pt/1.3 Arial, Helvetica, sans-serif; color: #000; }
.topo { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
.topo img { height: 40px; }
.topo h1 { margin: 0; font-size: 15pt; }
.topo p { margin: 2px 0 0; font-size: 9pt; color: #333; }
.topo .dir { margin-left: auto; text-align: right; font-size: 8.5pt; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #000; padding: 3px 5px; vertical-align: top; }
th { background: #e8e8e8; font-size: 8.5pt; text-align: left; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
tr.cat td { background: #f2f2f2; font-weight: bold; font-size: 10pt; border-top: 2px solid #000; }
tr.cat span { font-weight: normal; color: #444; font-size: 8.5pt; }
.ck { width: 18px; text-align: center; font-size: 12pt; }
.det { font-size: 8pt; color: #333; }
.q { white-space: nowrap; width: 85px; }
.ap { font-weight: bold; }
.vazio { display: inline-block; width: 60px; border-bottom: 1px dotted #666; }
.urg { width: 50px; } .urg.alta { font-weight: bold; }
.dt { width: 62px; white-space: nowrap; } .sit { width: 70px; }
.anot { width: 150px; }
.ass { margin-top: 34px; display: flex; gap: 40px; font-size: 9pt; }
.ass div { flex: 1; border-top: 1px solid #000; padding-top: 3px; }
@media screen { body { max-width: 277mm; margin: 10mm auto; } .barra { position: sticky; top: 0; background: #fff; padding: 8px 0; text-align: right; } .barra button { font: 10pt Arial; padding: 6px 14px; } }
@media print { .barra { display: none; } }
</style></head><body>
<div class="barra"><button onclick="window.print()">Imprimir</button></div>
<div class="topo"><img src="${esc(logoUrl)}" alt="MinasLab"><div><h1>${esc(titulo)}</h1>${subtitulo ? `<p>${esc(subtitulo)}</p>` : ""}</div>
<div class="dir">${total} ${total === 1 ? "item" : "itens"}<br>emitida em ${esc(agora)}</div></div>
<table>
<thead><tr><th></th><th>Produto</th><th>Qtd. pedida</th><th>Qtd. aprovada</th><th>Urgência</th><th>Quem pediu</th><th>Pedido em</th><th>Situação</th><th>Fornecedor / valor</th></tr></thead>
<tbody>${linhas || `<tr><td colspan="9">Nenhum item.</td></tr>`}</tbody>
</table>
<div class="ass"><div>Aprovado por</div><div>Comprado por</div><div>Data</div></div>
</body></html>`;
}

export function imprimirListaCompras(args) {
  const w = window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela de impressão. Libere pop-ups para o painel.");
  w.document.open(); w.document.write(htmlListaCompras(args)); w.document.close();
  w.addEventListener("load", () => { try { w.focus(); w.print(); } catch { /* o botão Imprimir continua na página */ } });
}
