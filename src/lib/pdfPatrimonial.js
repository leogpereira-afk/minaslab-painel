import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {moedaRelatorio as moeda,dataRelatorio as data} from './relatorioFinanceiro.js';
export function gerarPdfPatrimonial(r, {titulo,empresa,conta,pessoa,consultadoEm=new Date()}) {
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),feitas=new Set();
 doc.setFontSize(9);const filtros=doc.splitTextToSize(`${empresa} | ${conta}${pessoa?` | ${pessoa}`:''} | ${data(r.de)} a ${data(r.ate)}`,269),topo=31+filtros.length*4;
 const header=()=>{const p=doc.internal.getCurrentPageInfo().pageNumber;if(feitas.has(p))return;feitas.add(p);doc.setFillColor(36,66,112);doc.rect(0,0,297,4,'F');doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(36,66,112);doc.text(`MinasLab | ${titulo}`,14,15);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(filtros,14,23);doc.setFontSize(8);doc.text(`Base consultada em ${new Date(consultadoEm).toLocaleString('pt-BR')}`,14,topo-2);};
 let y=topo+5;header();
 const tabela=(head,body)=>{autoTable(doc,{startY:y,margin:{top:topo+5,bottom:22,left:14,right:14},head:[head],body:body.length?body:[head.map((_,i)=>i?'':'Sem registros')],styles:{fontSize:8,cellPadding:2.5,overflow:'linebreak'},headStyles:{fillColor:[36,66,112]},alternateRowStyles:{fillColor:[246,248,251]},rowPageBreak:'avoid',willDrawPage:header});y=doc.lastAutoTable.finalY+8;};
 // Posição de hoje: não muda com o período (histórico completo do recorte), como na tela.
 if(r.tipo==='aplicacoes'){const s=r.saldo,p=r.possiveisResgates;tabela(['Posição de hoje','Valor','Como foi obtido'],[
  ['Saldo estimado hoje',!s?'Não informado':s.abaixoDeZero?'Não estimado':moeda(s.estimadoHoje),!s?'Nenhum extrato informado para este recorte':s.abaixoDeZero?`Os resgates depois do extrato de ${data(s.informado.data)} (${moeda(s.resgatesDepois)}) passam do saldo informado (${moeda(s.informado.valor)}): informe um extrato mais recente`:`Extrato de ${data(s.informado.data)} (${moeda(s.informado.valor)}), mais ${moeda(s.aportesDepois)} de aportes e menos ${moeda(s.resgatesDepois)} de resgates depois dele; estimativa mínima`],
  ['Capital aportado líquido',r.capitalAportado==null?'Sem aportes':moeda(r.capitalAportado),'Aportes menos resgates reconhecidos em todo o histórico; não é saldo'],
  ['Possíveis resgates sem categoria',p?.quantidade?`${p.quantidade} · ${moeda(p.total)}`:'Nenhum','Créditos sem categoria de aplicação; fora de todos os totais'],
 ]);}
 else{const ultimo=r.evolucao?.[r.evolucao.length-1];tabela(['Posição de hoje','Valor','Como foi obtido'],[['Líquido com os sócios',ultimo?moeda(ultimo.acumulado):'Sem movimento','Saídas menos entradas em todo o histórico do recorte']]);}
 tabela(['Resumo do período','Entradas','Saídas','Registros'],[['Movimentações bancárias identificadas',moeda(r.entradas),moeda(r.saidas),r.itens.length]]);
 tabela(['Natureza','Entradas','Saídas'],r.naturezas.map(n=>[n.nome,moeda(n.entradas),moeda(n.saidas)]));
 tabela(['Mês','Entradas','Saídas'],r.meses.map(m=>[m.nome.split('-').reverse().join('/'),moeda(m.entradas),moeda(m.saidas)]));
 if(r.tipo==='socios')tabela(['Favorecido / empresa','Entradas','Saídas'],r.porPessoa.map(p=>[`${p.nome}\n${p.empresa}`,moeda(p.entradas),moeda(p.saidas)]));
 tabela(['Data','Favorecido / empresa / conta','Natureza / categoria','Direção / valor','Origem / identificador'],r.itens.map(m=>[data(m.data_movimento),[m.pessoa,m.empresa?.nome,m.conta?.nome].filter(Boolean).join('\n'),`${m.natureza}\n${m.categoria}`,`${m.tipo==='CREDITO'?'Entrada':'Saída'}\n${moeda(m.valor)}`,`${m.origem || 'Não informada'}\n${m.id_omie || m.fitid || m.id}`]));
 tabela(['Critérios e limites'],[
 ['Totais apenas de movimentos bancários com categoria específica, pela data do movimento. Os títulos não são somados novamente.'],
 [r.tipo==='aplicacoes'?(r.saldo?`Saldo estimado: extrato informado de ${data(r.saldo.informado.data)} mais aportes e menos resgates reconhecidos depois dele. É uma estimativa mínima: o rendimento de dentro da aplicação só aparece no próximo extrato. Rendimentos creditados na conta corrente e créditos sem categoria não entram.`:'Saldo não informado: nenhum extrato foi registrado para este recorte. Aportes menos resgates não comprovam a posição da carteira.'):'Mútuos mantêm sua natureza de origem e não são tratados como distribuição de lucros. O nome do favorecido vem da origem.'],
 [`Fora dos totais: ${r.candidatos.length} movimentos para conferência${r.tipo==='aplicacoes'&&r.possiveisResgates?.noPeriodo?.quantidade?` (${r.possiveisResgates.noPeriodo.quantidade} deles parecem resgate sem categoria, ${moeda(r.possiveisResgates.noPeriodo.total)})`:''} e ${r.pendentes.length} títulos pendentes${pessoa?' (a conferência geral fica disponível sem filtro de favorecido)':''}. Ausência de registros não significa saldo zero.`]
 ]);
 if(r.candidatos.length)tabela(['Movimentos para conferência','Data','Valor','Motivo'],r.candidatos.map(m=>[m.descricao||m.id,data(m.data_movimento),moeda(m.valor),m.motivo]));
 if(r.pendentes.length)tabela(['Títulos pendentes, fora dos totais','Vencimento','Pendente'],r.pendentes.map(t=>[t.fornecedor||t.cliente||t.id,data(t.data_vencimento),moeda(t.valor_pendente)]));
 for(let i=1;i<=doc.getNumberOfPages();i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(90);doc.text(`Uso interno | Emitido em ${new Date().toLocaleString('pt-BR')}`,14,201);doc.text(`Página ${i} de ${doc.getNumberOfPages()}`,283,201,{align:'right'});}
 return doc;
}
