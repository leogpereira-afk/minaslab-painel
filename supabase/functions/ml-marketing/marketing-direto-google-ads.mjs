// Somente relatórios. OAuth separado do Analytics; nenhuma rota de mutação.
import {FalhaDireta} from './marketing-direto.mjs';
const BASE='https://googleads.googleapis.com/v25';
const idValido=id=>/^customers\/\d{10}$/.test(id||'');
export async function pesquisarAds(api,id,query){
 if(!idValido(id))throw new FalhaDireta('vinculo');
 let pageToken,rows=[];
 for(let i=0;i<10;i++){
  const r=await api(BASE+'/'+id+'/googleAds:search',{query,...(pageToken?{pageToken}:{})});
  rows.push(...(r.results||[]));pageToken=r.nextPageToken;
  if(!pageToken)return rows;
 }
 throw new FalhaDireta('coleta'); // nunca apresentar soma incompleta como total
}
export async function contaAds(api,id){
 const rows=await pesquisarAds(api,id,'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1');
 const c=rows[0]?.customer;
 if(!c||'customers/'+c.id!==id)throw new FalhaDireta('vinculo');
 return c;
}
export async function descobrirAds(api){
 const r=await api(BASE+'/customers:listAccessibleCustomers');const ativos=[];let limitado=false;
 const ids=[...new Set(r.resourceNames||[])];
 for(const id of ids.slice(0,50)){
  let c;
  try{c=await contaAds(api,id)}catch(e){if(e instanceof FalhaDireta&&e.codigo==='conta_ads_inativa'){limitado=true;continue}throw e}
  if(c.manager){limitado=true;continue}
  ativos.push({id,nome:c.descriptiveName||id});
 }
 return {ativos,limitado:limitado||ids.length>50};
}
const n=x=>x!==undefined&&x!==null&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
export function metricasAds(m={}){
 const micros=n(m.costMicros),gasto=micros===null?null:micros/1e6,cliques=n(m.clicks),impressoes=n(m.impressions),conversoes=n(m.conversions);
 return {gasto,cliques,impressoes,conversoes,ctr:impressoes>0&&cliques!==null?cliques/impressoes:null,cpc:cliques>0&&gasto!==null?gasto/cliques:null,custo_conversao:conversoes>0&&gasto!==null?gasto/conversoes:null};
}
export async function coletarAds(api,a,j){
 const c=await contaAds(api,a.id);if(c.manager)throw new FalhaDireta('vinculo');
 const fields='metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions';
 const where=` WHERE segments.date BETWEEN '${j.inicio}' AND '${j.fim}'`;
 const total=await pesquisarAds(api,a.id,`SELECT ${fields} FROM customer${where}`);
 if(total.length>1)throw new FalhaDireta('coleta');
 const p={...j,completo:true,metricas:total.length?metricasAds(total[0].metrics):{},tabelas:{},serie:[]};let limitado=false;
 for(const [nome,query,label]of [
  ['campanhas',`SELECT campaign.name, ${fields} FROM campaign${where} ORDER BY metrics.cost_micros DESC LIMIT 101`,r=>r.campaign?.name],
  ['termos',`SELECT search_term_view.search_term, ${fields} FROM search_term_view${where} ORDER BY metrics.cost_micros DESC LIMIT 101`,r=>r.searchTermView?.searchTerm]
 ]){try{const rows=await pesquisarAds(api,a.id,query);if(rows.length>100)limitado=true;p.tabelas[nome]=rows.slice(0,100).map(r=>({nome:label(r)||'',...metricasAds(r.metrics)}))}catch{limitado=true}}
 try{p.serie=(await pesquisarAds(api,a.id,`SELECT segments.date, ${fields} FROM customer${where} ORDER BY segments.date`)).map(r=>({dia:r.segments?.date,...metricasAds(r.metrics)}))}catch{limitado=true}
 return {periodos:[p],moeda:c.currencyCode,qualidade:{limitado},estado:limitado?'parcial':'ok'};
}
