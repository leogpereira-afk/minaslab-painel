import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {montarPatrimonial,naturezaPatrimonial,NATUREZAS_PATRIMONIAIS,SENTIDO_APLICACAO,MOTIVOS_PATRIMONIAIS} from './financeiroPatrimonial.js';
import {gerarPdfPatrimonial} from './pdfPatrimonial.js';
const base={tipo:'socios',de:'2026-01-01',ate:'2026-12-31'};
const mov=(id,categoria,valor=100,extras={})=>({id,empresa_id:'e1',conta_bancaria_id:'c1',data_movimento:'2026-09-01',tipo:'DEBITO',valor,dados_omie:{cDesCategoria:categoria,cRazCliente:'Pessoa exemplo',nCodCliente:1},...extras});
test('mútuo de sócio preserva natureza, não vira lucro distribuído',()=>{assert.deepEqual(naturezaPatrimonial('SAÍDA DE MÚTUOS SÓCIOS'),['socios','Saída de mútuo']);});
test('investimentos em melhorias, adiantamentos e reembolsos genéricos não são classificados por suposição',()=>{for(const nome of ['Investimento','INVESTIMENTO EM MELHORIAS','ADIANTAMENTO','Reembolso de Despesas'])assert.equal(naturezaPatrimonial(nome),null);});
test('título pago e movimento bancário não são somados em duplicidade',()=>{const r=montarPatrimonial({...base,movimentos:[mov('m','SAÍDA DE MÚTUOS SÓCIOS')],despesas:[{id:'d',categoria_texto:'SAÍDA DE MÚTUOS SÓCIOS',valor_pago:100,valor_pendente:0,data_vencimento:'2026-09-01'}]});assert.equal(r.saidas,100);assert.equal(r.itens.length,1);});
test('filtros empresa, conta, pessoa e data isolam os valores',()=>{const movimentos=[mov('a','SAÍDA DE MÚTUOS SÓCIOS'),mov('b','SAÍDA DE MÚTUOS SÓCIOS',999,{empresa_id:'e2'}),mov('c','SAÍDA DE MÚTUOS SÓCIOS',999,{conta_bancaria_id:'c2'}),mov('d','SAÍDA DE MÚTUOS SÓCIOS',999,{data_movimento:'2025-01-01'})];const r=montarPatrimonial({...base,movimentos,empresa:'e1',conta:'c1'});assert.equal(r.saidas,100);assert.equal(montarPatrimonial({...base,movimentos,pessoa:'inexistente'}).saidas,0);});
test('aportes, resgates, rendimentos e impostos ficam separados sem inventar saldo',()=>{const r=montarPatrimonial({...base,tipo:'aplicacoes',movimentos:[mov('a','APLICAÇÕES REALIZADAS',1000),mov('b','RESGATE DE TÍTULOS',200,{tipo:'CREDITO'}),mov('c','RENDIMENTO SOBRE APLICAÇÕES IMEDIATAS',10,{tipo:'CREDITO'}),mov('d','IMPOSTOS SOBRE APLICAÇÕES FINANCEIRAS IMEDIATAS',2)]});assert.equal(r.saidas,1002);assert.equal(r.entradas,210);assert.equal(r.saldoAplicado,null);assert.equal(r.saldo,null);assert.equal(r.naturezas.length,4);});
test('nome do sócio em texto livre não classifica lançamento e descrição sugestiva vai para revisão',()=>{const r=montarPatrimonial({...base,movimentos:[mov('a','FOLHA DE PAGAMENTO'),mov('b','OUTRAS SAÍDAS',500,{descricao:'Retirada socio'})]});assert.equal(r.itens.length,0);assert.equal(r.candidatos.length,1);});
test('valores inválidos e datas inválidas não contaminam totais',()=>{const r=montarPatrimonial({...base,movimentos:[mov('a','SAÍDA DE MÚTUOS SÓCIOS',null),mov('b','SAÍDA DE MÚTUOS SÓCIOS',100,{data_movimento:'2026-02-30'})]});assert.equal(r.saidas,0);assert.equal(r.candidatos.length,1);});
test('entradas de mútuos não são retiradas e centavos fecham',()=>{const r=montarPatrimonial({...base,movimentos:[mov('a','SAÍDA DE MÚTUOS SÓCIOS',0.1),mov('b','SAÍDA DE MÚTUOS SÓCIOS',0.2),mov('c','ENTRADA DE MÚTUOS SÓCIOS',0.1,{tipo:'CREDITO'})]});assert.equal(r.saidas,0.3);assert.equal(r.entradas,0.1);assert.equal(r.porPessoa[0].nome,'Pessoa exemplo');});
test('títulos pendentes ficam separados de pagamentos; cancelados excluídos',()=>{const d={categoria_texto:'SAÍDA DE MÚTUOS SÓCIOS',valor_pendente:40,data_vencimento:'2026-09-01'};const r=montarPatrimonial({...base,despesas:[{id:'a',...d},{id:'b',...d,status:'CANCELADO'}]});assert.equal(r.saidas,0);assert.equal(r.pendentes.length,1);});
test('PDF inclui todas as páginas e o último registro',()=>{const r=montarPatrimonial({...base,movimentos:Array.from({length:301},(_,i)=>mov(`UNICO-${i}`,'SAÍDA DE MÚTUOS SÓCIOS'))});const doc=gerarPdfPatrimonial(r,{titulo:'Retiradas dos sócios',empresa:'Exemplo',conta:'Todas'});assert.ok(doc.getNumberOfPages()>1);assert.ok(doc.output().includes('UNICO-300'));assert.ok(!doc.output().includes('NaN'));});
test('conciliação parcial não transforma todo o débito em retirada',()=>{const t={id:'d',categoria_texto:'SAÍDA DE MÚTUOS SÓCIOS'};const r=montarPatrimonial({...base,despesas:[t],movimentos:[mov('a','',100,{conciliacoes:[{despesa_id:'d',valor_conciliado:40}]})]});assert.equal(r.saidas,0);assert.equal(r.candidatos.length,1);});
test('conciliação integral identifica a categoria manual sem somar o título',()=>{const t={id:'d',categoria_texto:'SAÍDA DE MÚTUOS SÓCIOS',fornecedor:'Pessoa manual'};const r=montarPatrimonial({...base,despesas:[t],movimentos:[mov('a','',100,{dados_omie:null,conciliacoes:[{despesa_id:'d',valor_conciliado:100}]})]});assert.equal(r.saidas,100);assert.equal(r.itens[0].pessoa,'Pessoa manual');});

// ---- Saldo informado, evolução e chips (28/09/2026) ----
const HOJE='2026-09-28';
const aplBase={tipo:'aplicacoes',de:'2026-01-01',ate:'2026-12-31',hoje:HOJE};
const aporte=(id,data,valor,extras={})=>mov(id,'APLICAÇÕES REALIZADAS',valor,{data_movimento:data,...extras});
const resgate=(id,data,valor,extras={})=>mov(id,'RESGATE DE APLICAÇÕES',valor,{data_movimento:data,tipo:'CREDITO',...extras});
const rendimento=(id,data,valor,extras={})=>mov(id,'RENDIMENTO SOBRE APLICAÇÕES IMEDIATAS',valor,{data_movimento:data,tipo:'CREDITO',...extras});

test('sem saldo informado o saldo é null, nunca R$ 0,00',()=>{
 const movimentos=[aporte('a','2026-03-10',1000)];
 for(const saldosInformados of [undefined,[],null]){const r=montarPatrimonial({...aplBase,movimentos,saldosInformados});assert.equal(r.saldo,null);assert.deepEqual(r.saldosInformados,[]);assert.deepEqual(r.saldosIgnorados,[]);}
 assert.equal(montarPatrimonial({...aplBase,movimentos}).capitalAportado,1000);
});
test('saldo com valor ou data inválidos não vira número',()=>{
 const saldosInformados=[{id:'s1',data:'2026-06-30',valor:''},{id:'s2',data:'2026-06-30',valor:null},{id:'s3',data:'2026-06-30',valor:'abc'},{id:'s4',data:'2026-06-30',valor:-5},{id:'s5',data:'2026-02-30',valor:100},{id:'s6',valor:100},null,'lixo'];
 const r=montarPatrimonial({...aplBase,movimentos:[aporte('a','2026-03-10',1000)],saldosInformados});
 assert.equal(r.saldo,null);
 assert.deepEqual(r.saldosIgnorados.map(s=>[s.id,s.motivo]),[['s1',MOTIVOS_PATRIMONIAIS.saldoValorInvalido],['s2',MOTIVOS_PATRIMONIAIS.saldoValorInvalido],['s3',MOTIVOS_PATRIMONIAIS.saldoValorInvalido],['s4',MOTIVOS_PATRIMONIAIS.saldoValorInvalido],['s5',MOTIVOS_PATRIMONIAIS.saldoDataInvalida],['s6',MOTIVOS_PATRIMONIAIS.saldoDataInvalida]]);
 const zerada=montarPatrimonial({...aplBase,movimentos:[aporte('a','2026-03-10',1000)],saldosInformados:[{id:'z',data:'2026-06-30',valor:-0}]});
 assert.ok(Object.is(zerada.saldo.informado.valor,0)&&Object.is(zerada.saldo.estimadoHoje,0),'aplicação zerada é 0, nunca -0 ("-R$ 0,00")');
});
test('saldo informado antes de aportes posteriores: estimado soma aportes e desconta resgates depois da data, até hoje',()=>{
 const movimentos=[aporte('antes','2026-06-15',400),aporte('mesmo-dia','2026-06-30',300),aporte('b','2026-07-10',1000),aporte('c','2026-08-05',500.55),resgate('d','2026-08-20',200),rendimento('r','2026-08-31',7),aporte('futuro','2026-10-01',9999)];
 const r=montarPatrimonial({...aplBase,movimentos,saldosInformados:[{id:'s',data:'2026-06-30',valor:10000,observacao:'Extrato Sicoob',atualizadoPor:'leo',atualizadoEm:'2026-07-01T10:00:00Z'}]});
 assert.deepEqual(r.saldo,{informado:{id:'s',data:'2026-06-30',valor:10000,observacao:'Extrato Sicoob',atualizadoPor:'leo',atualizadoEm:'2026-07-01T10:00:00Z',empresa_id:'',conta_bancaria_id:''},origem:'exato',hoje:HOJE,aportesDepois:1500.55,resgatesDepois:200,movimentosDepois:3,estimadoHoje:11300.55,estimadoBruto:11300.55,abaixoDeZero:false,anteriorABase:false,possiveisResgatesDepois:{quantidade:0,total:0}});
 assert.deepEqual(r.saldosInformados.map(s=>[s.id,s.mes,s.origem]),[['s','2026-06','exato']]);
});
test('saldo com data depois de hoje é ignorado; vale o mais recente até hoje',()=>{
 const movimentos=[aporte('a','2026-03-10',1000),aporte('b','2026-06-10',250)];
 const saldosInformados=[{id:'novo-demais',data:'2026-12-31',valor:99999},{id:'velho',data:'2026-04-30',valor:1200},{id:'recente',data:'2026-05-31',valor:1300}];
 const r=montarPatrimonial({...aplBase,movimentos,saldosInformados});
 assert.equal(r.saldo.informado.id,'recente');
 assert.equal(r.saldo.estimadoHoje,1550);
 assert.deepEqual(r.saldosInformados.map(s=>s.id),['velho','recente']);
 assert.deepEqual(r.saldosIgnorados,[{id:'novo-demais',data:'2026-12-31',valor:99999,motivo:MOTIVOS_PATRIMONIAIS.saldoFuturo}]);
 assert.equal(montarPatrimonial({...aplBase,movimentos,saldosInformados:[saldosInformados[0]]}).saldo,null);
 const empate=montarPatrimonial({...aplBase,movimentos,saldosInformados:[{id:'z',data:'2026-05-31',valor:1,atualizadoEm:'2026-06-02T00:00:00Z'},{id:'a',data:'2026-05-31',valor:2,atualizadoEm:'2026-06-01T00:00:00Z'}]});
 assert.equal(empate.saldo.informado.id,'z');
});
test('mês sem movimento no meio da evolução aparece com zeros e a evolução vai até o mês de hoje',()=>{
 const r=montarPatrimonial({...aplBase,movimentos:[aporte('a','2026-05-10',1000),rendimento('r','2026-07-31',5.5),aporte('b','2026-07-02',300),resgate('c','2026-08-15',100)]});
 assert.deepEqual(r.evolucao.map(e=>e.mes),['2026-05','2026-06','2026-07','2026-08','2026-09']);
 assert.deepEqual(r.evolucao[1],{mes:'2026-06',aportes:0,resgates:0,rendimentos:0,impostos:0,capital:1000,registros:0});
 assert.deepEqual(r.evolucao.map(e=>e.capital),[1000,1000,1300,1200,1200]);
 assert.deepEqual(r.evolucao[2],{mes:'2026-07',aportes:300,resgates:0,rendimentos:5.5,impostos:0,capital:1300,registros:2});
 assert.equal(r.capitalAportado,1200);
 for(const e of r.evolucao)for(const v of Object.values(e))assert.ok(!Object.is(v,-0),`-0 em ${e.mes}`);
});
test('evolução dos sócios respeita sócio, conta e empresa; saídas e entradas pela direção',()=>{
 const outro={dados_omie:{cDesCategoria:'SAÍDA DE MÚTUOS SÓCIOS',cRazCliente:'Outra pessoa',nCodCliente:2}};
 const movimentos=[mov('a','SAÍDA DE MÚTUOS SÓCIOS',1000,{data_movimento:'2025-11-05'}),mov('b','ENTRADA DE MÚTUOS SÓCIOS',300,{data_movimento:'2026-01-10',tipo:'CREDITO'}),mov('c','SAÍDA DE MÚTUOS SÓCIOS',50,{data_movimento:'2026-01-20',conta_bancaria_id:'c2'}),mov('d','',700,{data_movimento:'2025-12-01',...outro}),mov('e','SAÍDA DE MÚTUOS SÓCIOS',999,{data_movimento:'2025-10-01',empresa_id:'e2'})];
 const s={...base,movimentos,hoje:'2026-03-15'};
 const todos=montarPatrimonial(s);
 assert.deepEqual(todos.evolucao.map(e=>[e.mes,e.saidas,e.entradas,e.liquido,e.acumulado]),[['2025-10',999,0,999,999],['2025-11',1000,0,1000,1999],['2025-12',700,0,700,2699],['2026-01',50,300,-250,2449],['2026-02',0,0,0,2449],['2026-03',0,0,0,2449]]);
 assert.deepEqual(montarPatrimonial({...s,pessoa:'e1|1'}).evolucao.map(e=>[e.mes,e.acumulado]),[['2025-11',1000],['2025-12',1000],['2026-01',750],['2026-02',750],['2026-03',750]]);
 assert.deepEqual(montarPatrimonial({...s,conta:'c2'}).evolucao.map(e=>[e.mes,e.saidas,e.acumulado]),[['2026-01',50,50],['2026-02',0,50],['2026-03',0,50]]);
 assert.equal(montarPatrimonial({...s,empresa:'e1'}).evolucao[0].mes,'2025-11');
 assert.deepEqual(montarPatrimonial({...s,pessoa:'inexistente'}).evolucao,[]);
});
test('o período escolhido não altera a evolução nem o saldo, só o recorte do período',()=>{
 const movimentos=[aporte('a','2025-05-10',1000),aporte('b','2026-02-10',500),resgate('c','2026-08-15',100)];
 const saldosInformados=[{id:'s',data:'2026-03-31',valor:1510}];
 const curto=montarPatrimonial({...aplBase,de:'2026-09-01',ate:'2026-09-28',movimentos,saldosInformados});
 const longo=montarPatrimonial({...aplBase,de:'2020-01-01',ate:'2026-12-31',movimentos,saldosInformados});
 assert.deepEqual(curto.evolucao,longo.evolucao);
 assert.deepEqual(curto.saldo,longo.saldo);
 assert.equal(curto.capitalAportado,longo.capitalAportado);
 assert.deepEqual([curto.itens.length,longo.itens.length],[0,3]);
 assert.deepEqual(curto.noPeriodo,{de:'2026-09-01',ate:'2026-09-28',mesDe:'2026-09',mesAte:'2026-09'});
 assert.deepEqual([curto.evolucao.length,curto.evolucao[0].mes,curto.evolucao.at(-1).mes],[17,'2025-05','2026-09']);
 assert.equal(curto.saldo.estimadoHoje,1410);
});
test('saldo de outro escopo não vale aqui; o consolidado só vale onde estão todas as aplicações',()=>{
 const movimentos=[aporte('a','2026-03-10',1000),aporte('b','2026-04-10',500)];
 const consolidado=[{id:'s',data:'2026-05-31',valor:1600}];
 assert.equal(montarPatrimonial({...aplBase,movimentos,saldosInformados:consolidado}).saldo.origem,'exato');
 const c1=montarPatrimonial({...aplBase,conta:'c1',movimentos,saldosInformados:consolidado});
 assert.deepEqual([c1.saldo.origem,c1.saldo.estimadoHoje],['equivalente',1600]);
 const c2=montarPatrimonial({...aplBase,conta:'c2',movimentos,saldosInformados:consolidado});
 assert.deepEqual([c2.saldo,c2.capitalAportado,c2.evolucao,c2.saldosInformados],[null,null,[],[]]);
 const mistas=[...movimentos,aporte('c','2026-04-20',200,{conta_bancaria_id:'c2'})];
 assert.equal(montarPatrimonial({...aplBase,conta:'c1',movimentos:mistas,saldosInformados:consolidado}).saldo,null);
 const daC1=[{id:'s1',data:'2026-05-31',valor:1500,conta_bancaria_id:'c1'}];
 assert.equal(montarPatrimonial({...aplBase,movimentos:mistas,saldosInformados:daC1}).saldo,null);
 assert.equal(montarPatrimonial({...aplBase,conta:'c1',movimentos:mistas,saldosInformados:daC1}).saldo.origem,'exato');
 assert.equal(montarPatrimonial({...aplBase,empresa:'e1',movimentos,saldosInformados:consolidado}).saldo,null,'com empresa filtrada a base chega recortada: o consolidado não pode ser provado');
 assert.equal(montarPatrimonial({...aplBase,empresa:'e1',movimentos,saldosInformados:[{...consolidado[0],empresa_id:'e1'}]}).saldo.origem,'exato');
 assert.equal(montarPatrimonial({...aplBase,movimentos,saldosInformados:[{...consolidado[0],empresa_id:'e1'}]}).saldo.origem,'equivalente');
 assert.equal(montarPatrimonial({...aplBase,movimentos:[...movimentos,aporte('x','2026-04-01',1,{empresa_id:'e2'})],saldosInformados:[{...consolidado[0],empresa_id:'e1'}]}).saldo,null);
 assert.deepEqual(montarPatrimonial({...aplBase,empresa:'e1',conta:'c1',movimentos}).escopoSaldo,{empresa_id:'e1',conta_bancaria_id:'c1'});
 assert.equal(montarPatrimonial({...aplBase,pessoa:'e1|1',movimentos,saldosInformados:consolidado}).saldo.origem,'equivalente');
 assert.equal(montarPatrimonial({...aplBase,pessoa:'e1|99',movimentos,saldosInformados:consolidado}).saldo,null);
});
test('crédito do banco com resgate só na observação vira possível resgate, fora do capital e do estimado',()=>{
 const sicoob=(id,data,valor,obs='Resgate aplicação RDC')=>({id,empresa_id:'e1',conta_bancaria_id:'c1',data_movimento:data,tipo:'CREDITO',valor,descricao:'SICOOB CREDICOM',dados_omie:{cDesCategoria:'OUTRAS ENTRADAS',cRazCliente:'SICOOB CREDICOM',cObservacoes:obs,nCodCliente:9}});
 const saidaSuspeita={id:'d1',empresa_id:'e1',conta_bancaria_id:'c1',data_movimento:'2026-05-10',tipo:'DEBITO',valor:70,descricao:'SICOOB CREDICOM',dados_omie:{cDesCategoria:'OUTRAS SAÍDAS',cObservacoes:'Aplicação programada'}};
 const movimentos=[aporte('a','2026-01-10',50000),sicoob('r1','2026-03-05',20000),sicoob('r2','2026-05-06',18793.84),sicoob('x','2026-04-01',10,'Tarifa estornada'),saidaSuspeita,sicoob('outra-conta','2026-04-02',5,'resgate'),];
 movimentos[5].conta_bancaria_id='c9';
 const r=montarPatrimonial({...aplBase,conta:'c1',de:'2026-05-01',ate:'2026-05-31',movimentos,saldosInformados:[{id:'s',data:'2026-02-28',valor:50100,conta_bancaria_id:'c1'}]});
 assert.equal(r.capitalAportado,50000);
 assert.equal(r.saldo.estimadoHoje,50100,'possível resgate não é descontado sem categoria');
 assert.deepEqual(r.saldo.possiveisResgatesDepois,{quantidade:2,total:38793.84});
 const {itens,...resumo}=r.possiveisResgates;
 assert.deepEqual(resumo,{quantidade:2,total:38793.84,primeiraData:'2026-03-05',ultimaData:'2026-05-06',noPeriodo:{quantidade:1,total:18793.84}});
 assert.deepEqual(itens.map(m=>m.id),['r1','r2']);
 assert.deepEqual(r.candidatos.map(m=>m.id),['r2','d1']);
 assert.deepEqual([r.entradas,r.saidas],[0,0]);
 assert.equal(montarPatrimonial({...base,movimentos,hoje:HOJE}).possiveisResgates,null);
});
test('aporte estornado (crédito na categoria de aporte) desconta do capital em vez de somar',()=>{
 const r=montarPatrimonial({...aplBase,movimentos:[aporte('a','2026-03-10',1000),aporte('estorno','2026-03-12',100,{tipo:'CREDITO'})]});
 assert.equal(r.capitalAportado,900);
 assert.equal(r.evolucao[0].aportes,900);
});
test('sem aporte nem resgate reconhecido o capital é null, não R$ 0,00',()=>{
 const r=montarPatrimonial({...aplBase,movimentos:[rendimento('r','2026-08-31',12.34)]});
 assert.equal(r.capitalAportado,null);
 assert.deepEqual(r.evolucao,[{mes:'2026-08',aportes:0,resgates:0,rendimentos:12.34,impostos:0,capital:null,registros:1},{mes:'2026-09',aportes:0,resgates:0,rendimentos:0,impostos:0,capital:null,registros:0}]);
 const vazio=montarPatrimonial({...aplBase,movimentos:[]});
 assert.deepEqual([vazio.capitalAportado,vazio.saldo,vazio.evolucao],[null,null,[]]);
 assert.deepEqual(vazio.possiveisResgates,{quantidade:0,total:0,primeiraData:null,ultimaData:null,noPeriodo:{quantidade:0,total:0},itens:[]});
});
test('sócios não recebem saldo, capital nem possíveis resgates',()=>{
 const r=montarPatrimonial({...base,movimentos:[mov('a','SAÍDA DE MÚTUOS SÓCIOS')],saldosInformados:[{id:'s',data:'2026-01-01',valor:5}],hoje:HOJE});
 assert.deepEqual([r.saldo,r.capitalAportado,r.possiveisResgates,r.escopoSaldo,r.saldosInformados,r.saldosIgnorados],[null,null,null,null,[],[]]);
});
test('movimento datado depois de hoje estende a evolução em vez de sumir; data absurda não estica',()=>{
 const r=montarPatrimonial({...aplBase,movimentos:[aporte('velho','0001-01-01',5),aporte('a','2026-08-10',100),aporte('f','2026-11-03',50)]});
 assert.deepEqual(r.evolucao.map(e=>e.mes),['2026-08','2026-09','2026-10','2026-11']);
 assert.equal(r.capitalAportado,100,'posição de hoje: o aporte de novembro está na evolução, não no capital de hoje');
});
test('chips: natureza na ordem fixa com quantidade; sócio ignora o próprio filtro e marca o ativo',()=>{
 const outro={dados_omie:{cDesCategoria:'SAÍDA DE MÚTUOS SÓCIOS',cRazCliente:'Outra pessoa',nCodCliente:2}};
 const movimentos=[mov('a','ENTRADA DE MÚTUOS SÓCIOS',10,{tipo:'CREDITO',data_movimento:'2026-02-01'}),mov('b','SAÍDA DE MÚTUOS SÓCIOS',100),mov('c','SAÍDA DE MÚTUOS SÓCIOS',50),mov('d','',500,outro)];
 const r=montarPatrimonial({...base,movimentos,pessoa:'e1|1',hoje:HOJE});
 assert.deepEqual(r.chips.naturezas,[{nome:'Saída de mútuo',quantidade:2,entradas:0,saidas:150},{nome:'Entrada de mútuo',quantidade:1,entradas:10,saidas:0}]);
 assert.deepEqual(r.chips.pessoas.map(p=>[p.id,p.nome,p.quantidade,p.entradas,p.saidas,p.ativo]),[['e1|2','Outra pessoa',1,0,500,false],['e1|1','Pessoa exemplo',3,10,150,true]]);
 assert.equal(r.porPessoa[0].quantidade,3);
 assert.equal(r.naturezas.find(n=>n.nome==='Saída de mútuo').quantidade,2);
 const fora=montarPatrimonial({...base,de:'2026-03-01',ate:'2026-03-31',movimentos,pessoa:'e1|1',hoje:HOJE});
 assert.deepEqual(fora.chips.pessoas,[{id:'e1|1',nome:'Pessoa exemplo',empresa:'',quantidade:0,entradas:0,saidas:0,ativo:true}]);
});
test('rótulos e textos sem travessão',()=>{
 assert.deepEqual(naturezaPatrimonial('ENTRADA DE MÚTUOS SÓCIOS'),['socios','Entrada de mútuo']);
 assert.deepEqual(naturezaPatrimonial('RETIRADA DE SÓCIOS'),['socios','Retirada (natureza a conferir)']);
 for(const t of [...NATUREZAS_PATRIMONIAIS.aplicacoes,...NATUREZAS_PATRIMONIAIS.socios,...Object.values(MOTIVOS_PATRIMONIAIS)])assert.ok(!/[–—]/.test(t),t);
 for(const arquivo of ['financeiroPatrimonial.js','pdfPatrimonial.js'])assert.ok(!/[–—]/.test(readFileSync(new URL(arquivo,import.meta.url),'utf8')),`travessão em ${arquivo}`);
});
test('toda natureza de aplicação tem sentido natural (senão a evolução somaria em campo nenhum)',()=>{for(const n of NATUREZAS_PATRIMONIAIS.aplicacoes)assert.ok(SENTIDO_APLICACAO[n],n);});
test('hoje inválido cai no dia local em vez de derrubar a tela',()=>{assert.equal(montarPatrimonial({...aplBase,hoje:'2026-13-45'}).hoje,new Date().toLocaleDateString('en-CA'));});
test('PDF das aplicações continua fechando com saldo e evolução no resultado',()=>{
 const r=montarPatrimonial({...aplBase,movimentos:[aporte('APL-1','2026-03-10',1000),resgate('RSG-1','2026-04-10',100)],saldosInformados:[{id:'s',data:'2026-05-31',valor:950}]});
 const saida=gerarPdfPatrimonial(r,{titulo:'Aplicações financeiras',empresa:'Exemplo',conta:'Todas'}).output();
 assert.ok(saida.includes('APL-1')&&saida.includes('RSG-1'));
 assert.ok(!saida.includes('NaN')&&!saida.includes('undefined'));
});
test('saldo antes do primeiro aporte vira ponto no gráfico, mas a evolução não começa antes da base',()=>{
 const tarifa=mov('tarifa','TARIFAS BANCÁRIAS',5,{data_movimento:'2025-01-15'});
 const r=montarPatrimonial({...aplBase,movimentos:[tarifa,aporte('a','2025-05-10',1000)],saldosInformados:[{id:'antes-da-base',data:'2024-12-31',valor:300},{id:'s',data:'2025-03-31',valor:300}]});
 assert.equal(r.baseDesde,'2025-01-15');
 assert.deepEqual(r.evolucao.slice(0,3).map(e=>[e.mes,e.aportes,e.capital]),[['2025-03',0,0],['2025-04',0,0],['2025-05',1000,1000]]);
 assert.deepEqual(r.saldosInformados.map(s=>s.mes),['2024-12','2025-03']);
 const soSaldo=montarPatrimonial({...aplBase,movimentos:[tarifa],saldosInformados:[{id:'s',data:'2026-07-31',valor:300}]});
 assert.deepEqual(soSaldo.evolucao.map(e=>[e.mes,e.capital]),[['2026-07',null],['2026-08',null],['2026-09',null]]);
 const semBase=montarPatrimonial({...aplBase,movimentos:[],saldosInformados:[{id:'s',data:'2026-07-31',valor:300}]});
 assert.deepEqual([semBase.evolucao,semBase.baseDesde,semBase.saldo.estimadoHoje],[[],null,300]);
});

// ---- Consertos da revisão da tela (28/09/2026) ----
test('resgatar tudo depois do extrato (com o rendimento de dentro do banco) não vira saldo negativo',()=>{
 const r=montarPatrimonial({...aplBase,movimentos:[aporte('a','2026-01-10',100000),resgate('d','2026-06-30',103030.10)],saldosInformados:[{id:'s',data:'2026-03-31',valor:100000}]});
 assert.equal(r.saldo.estimadoHoje,null,'-R$ 3.030,10 não é saldo');
 assert.equal(r.saldo.abaixoDeZero,true);
 assert.equal(r.saldo.estimadoBruto,-3030.1);
});
test('saldo gravado só com a conta vale na vista da conta com a empresa escolhida',()=>{
 const movimentos=[aporte('a','2026-03-10',1000),aporte('c','2026-04-20',200,{conta_bancaria_id:'c2'})];
 const daConta=[{id:'s',data:'2026-05-31',valor:900,empresa_id:'',conta_bancaria_id:'c1'}];
 assert.equal(montarPatrimonial({...aplBase,empresa:'e1',conta:'c1',movimentos,saldosInformados:daConta}).saldo.origem,'exato');
 assert.equal(montarPatrimonial({...aplBase,conta:'c1',movimentos,saldosInformados:daConta}).saldo.origem,'exato');
 assert.equal(montarPatrimonial({...aplBase,empresa:'e1',movimentos,saldosInformados:daConta}).saldo,null,'a empresa inteira tem outra conta com aplicação');
});
test('crédito suspeito de aplicação fora da vista impede o consolidado de valer numa conta só',()=>{
 const movimentos=[aporte('a','2026-03-10',1000),mov('x','OUTRAS ENTRADAS',5000,{tipo:'CREDITO',conta_bancaria_id:'c2',data_movimento:'2026-04-02',dados_omie:{cDesCategoria:'OUTRAS ENTRADAS',cObservacoes:'RESGATE RDC'}})];
 const consolidado=[{id:'s',data:'2026-05-31',valor:80000}];
 assert.equal(montarPatrimonial({...aplBase,conta:'c1',movimentos,saldosInformados:consolidado}).saldo,null);
 assert.equal(montarPatrimonial({...aplBase,movimentos,saldosInformados:consolidado}).saldo.origem,'exato');
});
test('na mesma data, o saldo exato do recorte ganha do consolidado gravado depois',()=>{
 const movimentos=[aporte('a','2026-03-10',1000)];
 const saldosInformados=[{id:'exato',data:'2026-06-30',valor:50000,conta_bancaria_id:'c1',atualizadoEm:'2026-07-01T10:00:00Z'},{id:'consolidado',data:'2026-06-30',valor:80000,atualizadoEm:'2026-07-02T10:00:00Z'}];
 const r=montarPatrimonial({...aplBase,conta:'c1',movimentos,saldosInformados});
 assert.deepEqual([r.saldo.informado.id,r.saldo.origem,r.saldo.estimadoHoje],['exato','exato',50000]);
});
test('extrato anterior ao início da base é avisado: os movimentos entre os dois não existem aqui',()=>{
 const r=montarPatrimonial({...aplBase,movimentos:[aporte('a','2026-03-10',1000)],saldosInformados:[{id:'s',data:'2025-12-31',valor:500}]});
 assert.equal(r.saldo.anteriorABase,true);
 assert.equal(montarPatrimonial({...aplBase,movimentos:[aporte('a','2026-03-10',1000)],saldosInformados:[{id:'s',data:'2026-04-30',valor:500}]}).saldo.anteriorABase,false);
});
