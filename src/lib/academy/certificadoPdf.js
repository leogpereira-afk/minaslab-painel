// Gera o PDF do certificado a partir do registro IMUTÁVEL emitido pelo servidor.
// O jsPDF é carregado só na hora de baixar (não pesa no resto do painel).
import { linhasCertificado, AVISO_CERTIFICADO } from "./regras.js";

export async function baixarCertificadoPdf(c) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  doc.setDrawColor(15, 118, 110); doc.setLineWidth(1.2); doc.rect(10, 10, W - 20, 190);
  doc.setTextColor(36, 68, 79); doc.setFont("helvetica", "bold"); doc.setFontSize(26);
  doc.text("MinasLab Academy", W / 2, 32, { align: "center" });
  doc.setTextColor(15, 118, 110); doc.setFontSize(18);
  doc.text("Certificado de conclusão de treinamento", W / 2, 44, { align: "center" });
  let y = 66;
  for (const [k, v] of linhasCertificado(c)) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(80, 95, 102); doc.text(`${k}:`, 40, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(12); doc.setTextColor(20, 40, 46);
    doc.text(doc.splitTextToSize(String(v), W - 120), 95, y);
    y += 12;
  }
  doc.setFontSize(9); doc.setTextColor(110, 120, 125);
  doc.text(doc.splitTextToSize(AVISO_CERTIFICADO, W - 60), 30, 185);
  doc.save(`certificado-${c.codigo}.pdf`);
}
