import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {moedaRelatorio as moeda,dataRelatorio as data} from './relatorioFinanceiro.js';
export function gerarPdfPatrimonial(r, {titulo,empresa,conta,pessoa,consultadoEm=new Date()}) {
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),feitas=new Set();
 doc.setFontSize(9);const filtros=doc.splitTextToSize(`${empresa} | ${conta}${pessoa?` | ${pessoa}`:''} | ${data(r.de)} a ${data(r.ate)}`,269),topo=31+filtros.length*4;
 const header=()=>{const p=doc.internal.getCurrentPageInfo().pageNumber;if(feitas.has(p))return;feitas.add(p);doc.setFillColor(36,66,112);doc.rect(0,0,297,4,'F');doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(36,66,112);doc.text(`MinasLab | ${titulo}`,14,15);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(filtros,14,23);doc.setFontSize(8);doc.text(`Base consultada em ${new Date(consultadoEm).toLocaleString('pt-BR')}`,14,topo-2);};
 let y=topo+5;header();
 const tabela=(head,body)=>{autoTable(doc,{startY:y,margin:{top:topo+5,bottom:22,left:14,right:14},head:[head],body:body.length?body:[head.map((_,i)=>i?'':'Sem registros')],styles:{fontSize:8,cellPadding:2.5,overflow:'linebreak'},headStyles:{fillColor:[36,66,112]},alternateRowStyles:{fillColor:[246,248,251]},rowPageBreak:'avoid',willDrawPage:header});y=doc.lastAutoTable.finalY+8;};
 tabela(['Resumo do período','Entradas','Saídas','Registros'],[['Movimentações bancárias identificadas',moeda(r.entradas),moeda(r.saidas),r.itens.length]]);
 tabela(['Natureza','Entradas','Saídas'],r.naturezas.map(n=>[n.nome,moeda(n.entradas),moeda(n.saidas)]));
 tabela(['Mês','Entradas','Saídas'],r.meses.map(m=>[m.nome.split('-').reverse().join('/'),moeda(m.entradas),moeda(m.saidas)]));
 if(r.tipo==='socios')tabela(['Favorecido / empresa','Entradas','Saídas'],r.porPessoa.map(p=>[`${p.nome}\n${p.empresa}`,moeda(p.entradas),moeda(p.saidas)]));
 tabela(['Data','Favorecido / empresa / conta','Natureza / categoria','Direção / valor','Origem / identificador'],r.itens.map(m=>[data(m.data_movimento),[m.pessoa,m.empresa?.nome,m.conta?.nome].filter(Boolean).join('\n'),`${m.natureza}\n${m.categoria}`,`${m.tipo==='CREDITO'?'Entrada':'Saída'}\n${moeda(m.valor)}`,`${m.origem || 'Não informada'}\n${m.id_omie || m.fitid || m.id}`]));
 tabela(['Critérios e limites'],[
 ['Totais apenas de movimentos bancários com categoria específica, pela data do movimento. Os títulos não são somados novamente.'],
 [r.tipo==='aplicacoes'?'Saldo aplicado e disponibilidade para resgate não foram informados pela integração. Aportes menos resgates não comprovam a posição da carteira.':'Mútuos mantêm sua natureza de origem e não são tratados como distribuição de lucros. O nome do favorecido vem da origem.'],
 [`Fora dos totais: ${r.candidatos.length} movimentos para conferência e ${r.pendentes.length} títulos pendentes${pessoa?' (a conferência geral fica disponível sem filtro de favorecido)':''}. Ausência de registros não significa saldo zero.`]
 ]);
 if(r.candidatos.length)tabela(['Movimentos para conferência','Data','Valor','Motivo'],r.candidatos.map(m=>[m.descricao||m.id,data(m.data_movimento),moeda(m.valor),m.motivo]));
 if(r.pendentes.length)tabela(['Títulos pendentes, fora dos totais','Vencimento','Pendente'],r.pendentes.map(t=>[t.fornecedor||t.cliente||t.id,data(t.data_vencimento),moeda(t.valor_pendente)]));
 for(let i=1;i<=doc.getNumberOfPages();i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(90);doc.text(`Uso interno | Emitido em ${new Date().toLocaleString('pt-BR')}`,14,201);doc.text(`Página ${i} de ${doc.getNumberOfPages()}`,283,201,{align:'right'});}
 return doc;
}
