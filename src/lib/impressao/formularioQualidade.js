// Impressão dos formulários da Qualidade no layout dos FM-LAB (cabeçalho com logo, nome do formulário,
// código, emissão, revisão, página e emitente; rodapé de cópia controlada). O código, o nome e a revisão
// vêm da Lista Mestra (Documentos e POPs) quando o formulário está cadastrado lá; senão, do padrão passado.
import logo from "../../assets/logo-minaslab.webp";

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const dataBr = (v) => (v ? new Date(String(v).length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");
export const texto = (v) => esc(v).replace(/\n/g, "<br>");

/** Cabeçalho do formulário: o cadastro da Lista Mestra prevalece sobre o padrão. */
export function dadosDoFormulario(documentos, padrao) {
  const doc = (documentos || []).find((d) => String(d.codigo).replace(/\s+/g, "").toUpperCase() === padrao.codigo.replace(/\s+/g, "").toUpperCase());
  return doc
    ? { ...padrao, codigo: doc.codigo, titulo: doc.titulo || padrao.titulo, revisao: doc.revisao || padrao.revisao, emissao: doc.vigencia_inicio || padrao.emissao, naListaMestra: true }
    : { ...padrao, naListaMestra: false };
}

const css = (rodape, paisagem) => `
@page { size: A4${paisagem ? " landscape" : ""}; margin: 12mm 12mm 16mm;
  @bottom-left { content: "${rodape.replace(/["\\]/g, "'")}"; font: 8pt Arial, sans-serif; color: #444; }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Arial, sans-serif; color: #444; } }
* { box-sizing: border-box; }
body { margin: 0; font: 9.5pt/1.35 Arial, Helvetica, sans-serif; color: #000; }
table { width: 100%; border-collapse: collapse; }
td, th { border: 1px solid #000; padding: 3px 5px; vertical-align: top; }
.cab td { vertical-align: middle; }
.cab .logo { width: 26%; text-align: center; }
.cab .logo img { max-width: 150px; max-height: 52px; }
.cab .nome { width: 48%; text-align: center; font-size: 12.5pt; font-weight: bold; }
.cab .meta { width: 26%; padding: 0; }
.cab .meta div { border-bottom: 1px solid #000; padding: 2px 5px; font-weight: bold; font-size: 8.5pt; }
.cab .meta div:last-child { border-bottom: 0; }
.sec { background: #eee; text-align: center; font-weight: bold; }
.rot { font-weight: bold; width: 22%; white-space: nowrap; }
.caixa { min-height: 16mm; text-align: justify; }
.marca { margin-top: 6px; text-align: center; font-weight: bold; font-size: 8pt; letter-spacing: .5px; }
.sp { height: 6px; border: 0; padding: 0; }
.ass { height: 12mm; }
@media screen { body { max-width: ${paisagem ? 277 : 190}mm; margin: 10mm auto; } .barra { position: sticky; top: 0; background: #fff; padding: 8px 0; text-align: right; } .barra button { font: 10pt Arial; padding: 6px 14px; } }
@media print { .barra { display: none; } }
`;

/**
 * Abre a impressão numa janela própria. `corpo` é o HTML das linhas do formulário (já escapado).
 * `controlada`: true imprime "CÓPIA CONTROLADA" (registro oficial); false, "CÓPIA NÃO CONTROLADA".
 */
export function htmlDoFormulario({ form, corpo, impressoPor, controlada = true, paisagem = false }) {
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const rodape = `${form.codigo} · Rev. ${form.revisao} · ${controlada ? "CÓPIA CONTROLADA – REPRODUÇÃO PROIBIDA" : "CÓPIA NÃO CONTROLADA"} · impresso em ${agora}${impressoPor ? ` por ${impressoPor}` : ""}`;
  const logoUrl = new URL(logo, window.location.href).href;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(form.codigo)} - ${esc(form.titulo)}</title>
<style>${css(rodape, paisagem)}</style></head><body>
<div class="barra"><button onclick="window.print()">Imprimir</button></div>
<table class="cab"><tr>
  <td class="logo"><img src="${esc(logoUrl)}" alt="MinasLab"></td>
  <td class="nome">${esc(form.titulo)}</td>
  <td class="meta"><div>${esc(form.codigo)}</div><div>Emissão: ${esc(dataBr(form.emissao)) || "—"}</div><div>Rev. ${esc(form.revisao)}${form.emissao ? ` - ${esc(dataBr(form.emissao))}` : ""}</div><div>${esc(form.extra || `Emitente: ${form.emitente || "Comitê da Qualidade"}`)}</div></td>
</tr></table>
${corpo}
<div class="marca">${controlada ? "CÓPIA CONTROLADA – REPRODUÇÃO PROIBIDA" : "CÓPIA NÃO CONTROLADA"}</div>
</body></html>`;
}

export function abrirImpressao(args) {
  const html = htmlDoFormulario(args);
  const w = window.open("", "_blank");
  if (!w) throw new Error("O navegador bloqueou a janela de impressão. Libere pop-ups para o painel.");
  w.document.open(); w.document.write(html); w.document.close();
  w.addEventListener("load", () => { try { w.focus(); w.print(); } catch { /* o botão Imprimir continua na página */ } });
}
