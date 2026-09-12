import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dataRelatorio as data, moedaRelatorio as moeda, notasRelatorio, variacaoFinanceira } from './relatorioFinanceiro.js';

const azul = [36, 66, 112], cinza = [80, 94, 112];
export function gerarPdfFinanceiro({ relatorio: r, tipo = 'executivo', empresa = 'Todas as empresas', conta = 'Todas as contas', empresas = [], contas = [], emitidoEm = new Date(), consultadoEm = emitidoEm }) {
  if (!['executivo', 'bancos', 'receber', 'pagar'].includes(tipo)) throw new Error('Tipo de relatório inválido.');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth(), altura = doc.internal.pageSize.getHeight();
  const nomes = { executivo: 'Análise financeira', bancos: 'Extrato bancário completo', receber: 'Contas a receber', pagar: 'Contas a pagar' };
  const empresasMap = new Map(empresas.map(e => [e.id, e.nome]));
  const contasMap = new Map(contas.map(c => [c.id, c.nome]));
  const empresaDo = t => t.empresa?.nome || empresasMap.get(t.empresa_id) || 'Empresa não informada';
  const contaDo = t => contasMap.get(t.conta_bancaria_id) || t.conta_bancaria?.nome || t.conta?.nome || t.conta_bancaria_texto || 'Sem conta';
  const titulo = `MinasLab | ${nomes[tipo]}`;
  const filtro = `${empresa} | ${conta} | ${data(r.periodo.de)} a ${data(r.periodo.ate)}`;
  const dataConsulta = new Date(consultadoEm).toLocaleString('pt-BR');
  doc.setFontSize(9);
  const linhasFiltro = doc.splitTextToSize(filtro, largura - 28);
  const topo = 29 + linhasFiltro.length * 4.2;
  const paginasComCabecalho = new Set();
  const cabecalho = () => {
    const pagina = doc.internal.getCurrentPageInfo().pageNumber;
    if (paginasComCabecalho.has(pagina)) return;
    paginasComCabecalho.add(pagina);
    doc.setFillColor(...azul); doc.rect(0, 0, largura, 4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...azul); doc.text(titulo, 14, 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...cinza); doc.text(linhasFiltro, 14, 22);
    doc.setFontSize(7.5); doc.text(`Base consultada em ${dataConsulta} | Valores em reais (BRL)`, 14, topo - 2);
  };
  cabecalho(); let y = topo + 6;
  const espaco = n => { if (y + n > altura - 20) { doc.addPage(); cabecalho(); y = topo + 6; } };
  const texto = (t, forte = false) => {
    doc.setFont('helvetica', forte ? 'bold' : 'normal'); doc.setFontSize(forte ? 11 : 8.5); doc.setTextColor(...(forte ? azul : cinza));
    const linhas = doc.splitTextToSize(t, largura - 28);
    for (const linha of linhas) { espaco(5); doc.text(linha, 14, y); y += 4.5; }
    y += forte ? 3 : 2;
  };
  const tabela = (head, body, numeric = [], widths = []) => {
    espaco(22);
    autoTable(doc, { startY: y, margin: { top: topo + 6, bottom: 21, left: 14, right: 14 }, head: [head], body,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.3, overflow: 'linebreak', textColor: [39, 53, 71], lineColor: [223, 230, 237], lineWidth: 0.1 },
      headStyles: { fillColor: azul, textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [246, 248, 251] },
      columnStyles: Object.fromEntries(head.map((_, i) => [i, { ...(numeric.includes(i) ? { halign: 'right', minCellWidth: 24 } : {}), ...(widths[i] ? { cellWidth: widths[i] } : {}) }])),
      rowPageBreak: 'avoid', showHead: 'everyPage', willDrawPage: cabecalho,
    });
    y = doc.lastAutoTable.finalY + 9;
  };
  if (tipo === 'executivo') {
    texto('1. Movimentação bancária do período', true);
    const base = r.bancoAnterior.validos;
    const variacao = campo => {
      if (r.periodoEmAberto) return 'Período em aberto';
      const v = variacaoFinanceira(r.banco[campo], r.bancoAnterior[campo], base);
      if (!v) return 'Sem base anterior';
      return `${moeda(v.valor)}${v.percentual == null ? ' | base zero' : ` | ${v.percentual.toFixed(1).replace('.', ',')}%`}`;
    };
    tabela(['Indicador', 'Período selecionado', 'Período anterior', 'Variação'], [
      ['Entradas no banco', moeda(r.banco.entradas), base ? moeda(r.bancoAnterior.entradas) : 'Sem registros', variacao('entradas')],
      ['Saídas do banco', moeda(r.banco.saidas), base ? moeda(r.bancoAnterior.saidas) : 'Sem registros', variacao('saidas')],
      ['Movimento líquido', moeda(r.banco.liquido), base ? moeda(r.bancoAnterior.liquido) : 'Sem registros', variacao('liquido')],
    ], [1, 2, 3]);
    texto(`${r.banco.registros} movimentos no período. Comparação: ${data(r.anterior.de)} a ${data(r.anterior.ate)} (mesma quantidade de dias). Líquido não é lucro ou saldo disponível.`);
    texto('2. Compromissos do período: situação atual', true);
    tabela(['Títulos por vencimento', 'Valor original / previsto', 'Já liquidado nos títulos', 'Ainda pendente', `Vencido em ${data(r.hoje)}`], [
      ['Contas a receber', moeda(r.receberResumo.total), moeda(r.receberResumo.liquidado), moeda(r.receberResumo.pendente), moeda(r.receberResumo.vencido)],
      ['Contas a pagar', moeda(r.pagarResumo.total), moeda(r.pagarResumo.liquidado), moeda(r.pagarResumo.pendente), moeda(r.pagarResumo.vencido)],
    ], [1, 2, 3, 4]);
    texto('Pagamentos podem ter ocorrido fora do período de vencimento selecionado. Não somar esta tabela ao extrato bancário.');
    texto('3. Evolução mensal do banco', true);
    const max = Math.max(1, ...r.meses.flatMap(m => [m.entradas, m.saidas]));
    texto('Gráfico: verde = entradas; vermelho = saídas. Meses sem registros não são exibidos.');
    for (const m of r.meses) {
      espaco(16); doc.setFontSize(8); doc.setTextColor(...cinza); doc.text(m.mes.split('-').reverse().join('/'), 14, y + 3);
      doc.setFillColor(20, 125, 103); doc.rect(40, y, m.entradas / max * 145, 3, 'F');
      doc.setFillColor(190, 67, 81); doc.rect(40, y + 5, m.saidas / max * 145, 3, 'F');
      doc.text(`Entrou ${moeda(m.entradas)}`, 192, y + 3); doc.text(`Saiu ${moeda(m.saidas)}`, 192, y + 8); y += 13;
    }
    tabela(['Mês', 'Entradas', 'Saídas', 'Movimento líquido', 'Movimentos'], r.meses.length ? r.meses.map(m => [m.mes.split('-').reverse().join('/'), moeda(m.entradas), moeda(m.saidas), moeda(m.liquido), m.registros]) : [['Sem registros', '—', '—', '—', 0]], [1, 2, 3, 4]);
    texto('4. Despesas por categoria', true);
    texto('Valor original dos títulos do período de vencimento, excluindo cancelados. A participação usa o total original dessas despesas.');
    tabela(['Categoria', 'Títulos', 'Valor original', 'Participação', 'Ainda pendente'], r.categorias.length ? r.categorias.map(c => [c.nome, c.registros, moeda(c.total), c.participacao == null ? '—' : `${c.participacao.toFixed(1).replace('.', ',')}%`, moeda(c.pendente)]) : [['Sem despesas', 0, moeda(0), '—', moeda(0)]], [1, 2, 3, 4]);
  } else if (tipo === 'bancos') {
    texto(`${r.bancos.length} registros | Entradas ${moeda(r.banco.entradas)} | Saídas ${moeda(r.banco.saidas)} | Líquido ${moeda(r.banco.liquido)}`, true);
    tabela(['Data', 'Empresa / conta', 'Descrição / documento / identificador', 'Tipo', 'Valor', 'Origem', 'Conciliado'], r.bancos.length ? r.bancos.map(m => [data(m.data_movimento), `${empresaDo(m)}\n${contaDo(m)}`, [m.descricao, m.documento, m.fitid || m.id_omie || m.id].filter(Boolean).join('\n'), m.tipo, m.valor == null || !Number.isFinite(Number(m.valor)) ? 'Valor inválido' : moeda(Math.abs(Number(m.valor))), m.origem || 'Não informada', m.conciliado ? 'Sim' : 'Não']) : [['Sem registros no período', '', '', '', '', '', '']], [4], [22, 47, 101, 22, 28, 25, 24]);
  } else {
    const receber = tipo === 'receber', lista = receber ? r.receber : r.pagar, resumo = receber ? r.receberResumo : r.pagarResumo;
    texto(`${lista.length} títulos | Total ${moeda(resumo.total)} | Liquidado ${moeda(resumo.liquidado)} | Pendente ${moeda(resumo.pendente)}`, true);
    texto('Seleção por vencimento (ou lançamento quando ausente). Situação atual dos títulos; cancelados no detalhe, fora dos totais.');
    tabela(['Vencimento / pagamento', 'Empresa / pessoa / conta', 'Descrição / categoria / documento', 'Original', 'Liquidado', 'Pendente', 'Status / origem'], lista.length ? lista.map(t => [
      `${data(t.data_vencimento)}\nPgto: ${data(t.data_pagamento)}`,
      [empresaDo(t), receber ? t.cliente : t.fornecedor, contaDo(t)].filter(Boolean).join('\n'),
      [t.descricao, t.categoria?.nome || t.categoria_texto || 'Sem categoria', !receber && (t.centro?.nome || t.centro_custo), t.numero_nf ? `NF ${t.numero_nf}` : t.documento, t.id_omie || t.id].filter(Boolean).join('\n'),
      moeda(receber ? t.valor_previsto : t.valor_original), moeda(receber ? t.valor_recebido : t.valor_pago), moeda(t.valor_pendente), [t.status, t.origem].filter(Boolean).join('\n'),
    ]) : [['Sem títulos no período', '', '', '', '', '', '']], [3, 4, 5]);
  }
  texto('Critérios e pontos de conferência', true);
  notasRelatorio(r).forEach(n => texto(n));
  for (let pagina = 1; pagina <= doc.getNumberOfPages(); pagina++) {
    doc.setPage(pagina); doc.setDrawColor(220, 226, 234); doc.line(14, altura - 16, largura - 14, altura - 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...cinza);
    doc.text(`Uso interno | Emitido em ${emitidoEm.toLocaleString('pt-BR')} | Fonte: Financeiro MinasLab`, 14, altura - 10);
    doc.text(`Página ${pagina} de ${doc.getNumberOfPages()}`, largura - 14, altura - 10, { align: 'right' });
  }
  return doc;
}
