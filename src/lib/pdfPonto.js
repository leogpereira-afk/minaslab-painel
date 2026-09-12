import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { duracaoTexto } from './rh/ponto.js';

const valor = v => v === '' || v == null ? '—' : duracaoTexto(Number(v));
const soma = (registros, campo) => {
  const valores = registros.map(r => r[campo]).filter(v => v !== '' && v != null && Number.isFinite(Number(v)));
  return valores.length ? valores.reduce((total, v) => total + Number(v), 0) : null;
};

/** Documento independente da tela: filtros e datas pertencem ao recorte recebido. */
export function gerarPdfPonto({ titulo, subtitulo, registros, jornada, emitidoEm = new Date() }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const gerado = emitidoEm.toLocaleString('pt-BR');
  const resumo = `Horas consideradas: ${valor(soma(registros,'folha'))}   |   Intervalo não pago: ${valor(soma(registros,'intervalo'))}   |   Trabalho efetivo: ${valor(soma(registros,'efetivo'))}`;
  const cabecalho = () => {
    doc.setFillColor(29, 105, 99); doc.rect(0, 0, largura, 5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(24, 50, 58);
    doc.text('MinasLab | Relatório de ponto', 12, 15);
    doc.setFontSize(11); doc.text(titulo, 12, 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(70, 87, 96);
    doc.text(doc.splitTextToSize(subtitulo, largura - 24).slice(0, 3), 12, 28);
    doc.text(`Jornada de trabalho: ${jornada}. Intervalo fora dessas horas.`, 12, 42);
    doc.text('Regra: descontar somente o intervalo registrado, sem dedução adicional automática.', 12, 47);
    doc.setFont('helvetica', 'bold'); doc.text(resumo, 12, 53);
  };
  autoTable(doc, {
    startY: 59, margin: { top: 59, bottom: 22, left: 12, right: 12 },
    head: [['Pessoa', 'Dia', 'Entrada', 'Saída', 'Intervalo\nnão pago', 'Pausa\npaga', 'Trabalho\nefetivo', 'Total\nconsiderado', 'Total de\norigem', 'Situação']],
    body: registros.map(r => [r.nome, r.data, r.entrada || '—', r.saida || '—', valor(r.intervalo), valor(r.pago), valor(r.efetivo), valor(r.folha), valor(r.original), r.situacao + (r.diferenca ? `; diferença da origem: ${valor(Math.abs(r.diferenca))}` : '')]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.3, overflow: 'linebreak', textColor: [35, 52, 61], lineColor: [223, 231, 234], lineWidth: 0.1 },
    headStyles: { fillColor: [29, 105, 99], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 248, 249] },
    columnStyles: { 0: { cellWidth: 43 }, 1: { cellWidth: 22 }, 2: { cellWidth: 16 }, 3: { cellWidth: 16 }, 4: { cellWidth: 22 }, 5: { cellWidth: 19 }, 6: { cellWidth: 23 }, 7: { cellWidth: 24 }, 8: { cellWidth: 24 }, 9: { cellWidth: 'auto' } },
    rowPageBreak: 'avoid', showHead: 'everyPage',
    willDrawPage: cabecalho,
  });
  for (let pagina = 1; pagina <= doc.getNumberOfPages(); pagina++) {
    doc.setPage(pagina); const altura = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 96, 106); doc.setFontSize(8);
    doc.text('Totais somam apenas valores conhecidos. Intervalo ausente ou zerado exige conferência; sem registro não significa falta.', 12, altura - 14);
    doc.text(`Emitido em ${gerado}`, 12, altura - 9);
    doc.text(`${pagina} / ${doc.getNumberOfPages()}`, largura - 12, altura - 9, { align: 'right' });
  }
  return doc;
}
