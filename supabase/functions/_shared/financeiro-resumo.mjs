export const cancelado = item => ['CANCELADO','CANCELADA'].includes(String(item.status || '').toUpperCase());
export function resumoTitulos(itens, tipo) {
 const campos = tipo === 'recebimentos' ? {previsto:'valor_previsto',recebido:'valor_recebido',pendente:'valor_pendente'} : {total:'valor_original',pago:'valor_pago',pendente:'valor_pendente'};
 const out = Object.fromEntries(Object.keys(campos).map(k=>[k,0]));
 let cancelados=0,valorCancelado=0;
 for(const item of itens) {
  if(cancelado(item)){cancelados++;valorCancelado+=Math.round(Number(item.valor_previsto ?? item.valor_original ?? 0)*100);continue;}
  for(const [k,campo] of Object.entries(campos)) { const n=Number(item[campo]); if(Number.isFinite(n))out[k]+=Math.round(n*100); }
 }
 for(const k of Object.keys(campos))out[k]/=100;
 return {...out,cancelados,valorCancelado:valorCancelado/100};
}
export function filtrarRecebimentos(itens, filtros={}) {
 const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const moeda=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const campos={empresa:x=>x.empresa?.nome,cliente:x=>[x.cliente,x.numero_nf,x.cnpj_cpf,x.descricao].join(' '),vencimento:x=>String(x.data_vencimento||'').slice(0,10).split('-').reverse().join('/'),previsto:x=>moeda(x.valor_previsto),recebido:x=>moeda(x.valor_recebido),pendente:x=>moeda(x.valor_pendente),status:x=>x.status,origem:x=>x.importacao_origem==='C6_BOLETOS'?'C6':x.origem};
 return itens.filter(x=>Object.entries(filtros).every(([k,v])=>!v||!campos[k]||(k==='status'?normalizar(campos[k](x))===normalizar(v==='RECEBIDO'?'PAGO':v):normalizar(campos[k](x)).includes(normalizar(v)))));
}
