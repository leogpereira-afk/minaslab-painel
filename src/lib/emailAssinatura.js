// Assinatura padrão MinasLab (aprovada pelo Léo em 16/11/2026). Montada sozinha a partir do login
// (nome), do RH (cargo) e da caixa que envia (e-mail). Telefone, endereço, site, logo e selo da
// acreditação são iguais para todos e só mudam aqui.
//
// HTML de e-mail: tabela com estilos na linha (Outlook e Gmail ignoram <style>). As imagens vão
// como cid: — o servidor (ml-email) embute o logo e o selo dentro da mensagem.
export const EMPRESA_ASSINATURA = {
  telefone: "(38) 3015-2214",
  endereco: "Rua Imperatriz Leopoldina, 200 · Montes Claros/MG · 39.404-287",
  site: "www.minaslab.net",
  frase: "Laboratório acreditado pela Cgcre/Inmetro conforme ABNT NBR ISO/IEC 17025, sob o número CRL 1943.",
};
export const CID_LOGO = "ml-logo@minaslab";
export const CID_SELO = "ml-selo@minaslab";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// previa=true usa as imagens do próprio site (a tela não entende cid:).
export function assinaturaHtml({ nome, cargo, email }, { previa = false, base = "/" } = {}) {
  const e = EMPRESA_ASSINATURA;
  const logo = previa ? `${base}email/assinatura-logo.png` : `cid:${CID_LOGO}`;
  const selo = previa ? `${base}email/assinatura-selo-crl1943.png` : `cid:${CID_SELO}`;
  const linha = (icone, texto, link) => `<tr><td style="padding:1px 8px 1px 0;color:#13977b;font-weight:bold;font-size:13px;vertical-align:top">${icone}</td><td style="padding:1px 0;font-size:13px;color:#4b6066">${link ? `<a href="${esc(link)}" style="color:#4b6066;text-decoration:none">${esc(texto)}</a>` : esc(texto)}</td></tr>`;
  return `<table data-assinatura-minaslab="1" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;margin-top:8px">
<tr>
<td style="padding:0 18px 0 0;border-right:3px solid #13977b;vertical-align:middle"><img src="${logo}" alt="MinasLab" width="190" style="display:block;width:190px;height:auto;border:0"></td>
<td style="padding:0 18px;vertical-align:middle">
<div style="font-size:17px;font-weight:bold;color:#24444f;line-height:1.2">${esc(nome)}</div>
${cargo ? `<div style="font-size:13px;font-weight:bold;color:#0f766e;margin:2px 0 6px">${esc(cargo)}</div>` : `<div style="height:6px"></div>`}
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
${linha("✉", email, `mailto:${email}`)}
${linha("☎", e.telefone, `tel:+55${e.telefone.replace(/\D/g, "")}`)}
${linha("⌂", e.endereco)}
${linha("◎", e.site, `https://${e.site}`)}
</table>
</td>
<td style="padding:0 0 0 4px;vertical-align:middle"><table cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><img src="${selo}" alt="Acreditação ABNT NBR ISO/IEC 17025 · CRL 1943" width="56" style="display:block;width:56px;height:auto;border:0"></td>
<td style="padding-left:8px;vertical-align:middle;font-size:10px;line-height:1.35;color:#7d9195;width:120px">${esc(e.frase)}</td>
</tr></table></td>
</tr>
</table>`;
}

// Bloco citado da resposta/encaminhamento.
export function citacaoHtml(m, modo) {
  const quem = (x) => (x?.nome ? `${esc(x.nome)} &lt;${esc(x.email)}&gt;` : esc(x?.email || ""));
  const data = m.data ? new Date(m.data).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" }) : "";
  if (modo === "encaminhar") {
    return `<br><div style="color:#4b6066">---------- Mensagem encaminhada ----------<br>De: ${quem(m.de)}<br>Data: ${esc(data)}<br>Assunto: ${esc(m.assunto)}<br>Para: ${(m.para || []).map(quem).join(", ")}${m.cc?.length ? `<br>Cc: ${m.cc.map(quem).join(", ")}` : ""}</div><br>${m.html || ""}`;
  }
  return `<br><div style="color:#4b6066">Em ${esc(data)}, ${quem(m.de)} escreveu:</div><blockquote style="margin:6px 0 0 6px;padding-left:10px;border-left:2px solid #c9d6d3;color:#4b6066">${m.html || ""}</blockquote>`;
}
