import {marcaMarketing} from './marketing-marcas.mjs';
import {descobrirAds,contaAds,coletarAds} from './marketing-direto-google-ads.mjs';
import {FalhaDireta} from './marketing-direto.mjs';
const GRAPH='https://graph.facebook.com/v26.0';
const host=s=>{try{return new URL(s).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}};
const falha=c=>{throw new FalhaDireta(c)};
const num=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const url=(base,p)=>{const u=new URL(base);for(const [k,v]of Object.entries(p))if(v!==undefined)u.searchParams.set(k,v);return u.href};
async function paginas(api,base,key,params={}){let token,rows=[];for(let i=0;i<10;i++){const r=await api(url(base,{...params,...(base.startsWith(GRAPH)?{after:token}:{pageToken:token})}));rows.push(...(r[key]||[]));token=r.nextPageToken||(r.paging?.next?r.paging?.cursors?.after:null);if(!token)return rows}falha('coleta')}
export async function descobrirAtivos(f,api,{paginaInstagram,empresa='fortemais'}={}){const marca=marcaMarketing(empresa);if(f==='google_ads')return descobrirAds(api);let ativos=[];
 if(f==='ga4'){const contas=await paginas(api,'https://analyticsadmin.googleapis.com/v1beta/accountSummaries','accountSummaries',{pageSize:'200'});ativos=contas.flatMap(c=>(c.propertySummaries||[]).map(p=>({id:p.property,nome:p.displayName||p.property})));}
 if(f==='search'){const r=await api('https://www.googleapis.com/webmasters/v3/sites');ativos=(r.siteEntry||[]).filter(p=>host(p.siteUrl)===marca.host||p.siteUrl==='sc-domain:'+marca.host).map(p=>({id:p.siteUrl,nome:p.siteUrl}));}
 if(f==='perfil'){const contas=await paginas(api,'https://mybusinessaccountmanagement.googleapis.com/v1/accounts','accounts',{pageSize:'20'});for(const c of contas){if(!/^accounts\/\d+$/.test(c.name))continue;const ls=await paginas(api,'https://mybusinessbusinessinformation.googleapis.com/v1/'+c.name+'/locations','locations',{pageSize:'100',readMask:'name,title,websiteUri'});ativos.push(...ls.filter(p=>host(p.websiteUri)===marca.host).map(p=>({id:p.name,nome:p.title||p.name,site:p.websiteUri})));}}
 if(f==='instagram'){
  const ps=await paginas(api,GRAPH+'/me/accounts','data',{fields:'id,name,instagram_business_account{id,username}',limit:'100'});
  ativos=ps.filter(p=>p.instagram_business_account?.username?.toLowerCase()===marca.instagram).map(p=>({id:p.instagram_business_account.id,nome:'@'+p.instagram_business_account.username}));
  if(!ativos.length&&paginaInstagram){
   if(!/^\d{5,30}$/.test(paginaInstagram))falha('vinculo');
   const p=await api(url(GRAPH+'/'+paginaInstagram,{fields:'instagram_business_account{id,username}'}));
   const ig=p.instagram_business_account;
   if(ig?.username?.toLowerCase()===marca.instagram&&/^\d+$/.test(String(ig.id)))ativos=[{id:String(ig.id),nome:'@'+ig.username}];
  }
  if(!ativos.length){
   let permissoes=null;
   try{const r=await api(GRAPH+'/me/permissions');permissoes=Object.fromEntries(['pages_show_list','pages_read_engagement','instagram_basic','instagram_manage_insights','business_management'].map(k=>[k,(r.data||[]).some(x=>x.permission===k&&x.status==='granted')]))}catch{}
   console.warn('marketing_instagram_descoberta',JSON.stringify({paginas:ps.length,comInstagram:ps.filter(p=>p.instagram_business_account?.id).length,correspondencias:ativos.length,permissoes}));
  }
 }
 if(f==='meta_ads'){const as=await paginas(api,GRAPH+'/me/adaccounts','data',{fields:'id,name',limit:'100'});ativos=as.map(a=>({id:a.id,nome:a.name||a.id}));}
 return {ativos:ativos.slice(0,200).map(a=>({...a,nome:String(a.nome).slice(0,160)})),limitado:ativos.length>200};
}
export async function validarAtivo(f,a,api,empresa='fortemais'){const marca=marcaMarketing(empresa);if(!a?.id)falha('ativo');
 if(f==='ga4'){if(!/^properties\/\d+$/.test(a.id))falha('vinculo');const ds=await paginas(api,'https://analyticsadmin.googleapis.com/v1beta/'+a.id+'/dataStreams','dataStreams',{pageSize:'200'});if(!ds.some(s=>host(s.webStreamData?.defaultUri)===marca.host))falha('vinculo');}
 else if(f==='search'){if(host(a.id)!==marca.host&&a.id!=='sc-domain:'+marca.host)falha('vinculo');}
 else if(f==='perfil'){if(!/^locations\/\d+$/.test(a.id))falha('vinculo');const l=await api(url('https://mybusinessbusinessinformation.googleapis.com/v1/'+a.id,{readMask:'name,title,websiteUri'}));if(host(l.websiteUri)!==marca.host)falha('vinculo');}
 else if(f==='instagram'){if(!/^\d+$/.test(a.id))falha('vinculo');const u=await api(url(GRAPH+'/'+a.id,{fields:'username'}));if(u.username?.toLowerCase()!==marca.instagram)falha('vinculo');}
 else if(f==='google_ads'){const c=await contaAds(api,a.id);if(c.manager)falha('vinculo');}
 else if(f==='meta_ads'){if(!/^act_\d+$/.test(a.id))falha('vinculo');await api(url(GRAPH+'/'+a.id,{fields:'id,name'}));}
 else falha('invalido');
}
export function janela(agora){const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(agora));const d=new Date(hoje+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-3);const fim=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()-27);return {inicio:d.toISOString().slice(0,10),fim}}
const proximo=s=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)};
const GA={usuarios:'activeUsers',novos_usuarios:'newUsers',sessoes:'sessions',sessoes_engajadas:'engagedSessions',taxa_engajamento:'engagementRate',visualizacoes:'screenPageViews',eventos:'eventCount',eventos_chave:'keyEvents'};
export async function coletarFonte(f,a,api,agora,empresa='fortemais'){const marca=marcaMarketing(empresa);const j=janela(agora),p={...j,completo:true,metricas:{},tabelas:{},serie:[]};const saida={empresa:marca.id,estado:'ok',identidade:f==='instagram'?{usuario:marca.instagram}:f.endsWith('_ads')?{conta:a.id.replace('act_','').replace('customers/',''),vinculo_confirmado:true}:{site:marca.site},coletadoEm:new Date(agora).toISOString(),periodos:[p],qualidade:{}};
 async function opcional(fn){try{await fn()}catch{saida.estado='parcial';saida.qualidade.limitado=true}}
 if(f==='google_ads'){return {...saida,...await coletarAds(api,a,j)}}
 if(f==='ga4'){
  const rel=async (keys,dim)=>{const r=await api('https://analyticsdata.googleapis.com/v1beta/'+a.id+':runReport',{dateRanges:[{startDate:j.inicio,endDate:j.fim}],metrics:keys.map(k=>({name:GA[k]||k})),...(dim?{dimensions:[{name:dim}]}:{}),dimensionFilter:{filter:{fieldName:'hostName',inListFilter:{values:[marca.host,'www.'+marca.host],caseSensitive:false}}},limit:'100',keepEmptyRows:true});if(r.metadata?.subjectToThresholding)saida.qualidade.limiar_privacidade=true;if(r.metadata?.samplingMetadatas?.length)saida.qualidade.amostragem=true;if((r.rowCount||0)>100)saida.qualidade.limitado=true;return (r.rows||[]).map(row=>({...Object.fromEntries(keys.map((k,i)=>[k,num(row.metricValues?.[i]?.value)])),...(dim?{nome:row.dimensionValues?.[0]?.value||''}:{})}));};
  const keys=Object.keys(GA),tot=await rel(keys);p.metricas=tot[0]||Object.fromEntries(keys.map(k=>[k,null]));
  for(const [t,d,ks]of [['paginas','pagePath',['visualizacoes','usuarios']],['canais','sessionDefaultChannelGroup',['sessoes','eventos_chave']],['cidades','city',['usuarios']],['dispositivos','deviceCategory',['usuarios']],['eventos','eventName',['eventos']]])await opcional(async()=>p.tabelas[t]=await rel(ks,d));
  await opcional(async()=>p.serie=(await rel(['usuarios','sessoes','visualizacoes'],'date')).map(r=>({dia:r.nome.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),usuarios:r.usuarios,sessoes:r.sessoes,visualizacoes:r.visualizacoes})));
 }else if(f==='search'){
  const q=async dims=>{const r=await api('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(a.id)+'/searchAnalytics/query',{startDate:j.inicio,endDate:j.fim,type:'web',dataState:'final',...(dims?{dimensions:[dims]}:{}),rowLimit:100});if(r.rows?.length===100)saida.qualidade.limitado=true;return (r.rows||[]).map(x=>({nome:x.keys?.[0]||'',cliques:num(x.clicks),impressoes:num(x.impressions),ctr:num(x.ctr),posicao:num(x.position)}))};
  const total=await q();p.metricas=total[0]||{};delete p.metricas.nome;
  for(const [t,d]of [['consultas','query'],['paginas','page'],['paises','country'],['dispositivos','device']])await opcional(async()=>p.tabelas[t]=await q(d));await opcional(async()=>p.serie=(await q('date')).map(({nome,...r})=>({dia:nome,...r})));
 }else if(f==='perfil'){
  const nomes=['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH','BUSINESS_IMPRESSIONS_MOBILE_SEARCH','BUSINESS_IMPRESSIONS_DESKTOP_MAPS','BUSINESS_IMPRESSIONS_MOBILE_MAPS','WEBSITE_CLICKS','CALL_CLICKS','BUSINESS_DIRECTION_REQUESTS'];const u=new URL('https://businessprofileperformance.googleapis.com/v1/'+a.id+':fetchMultiDailyMetricsTimeSeries');for(const n of nomes)u.searchParams.append('dailyMetrics',n);for(const [prefix,d]of [['startDate',j.inicio],['endDate',j.fim]])for(const [i,k]of ['year','month','day'].entries())u.searchParams.set('dailyRange.'+prefix+'.'+k,String(Number(d.split('-')[i])));const r=await api(u.href),tot={};for(const group of r.multiDailyMetricTimeSeries||[])for(const ts of group.dailyMetricTimeSeries||[]){const vs=ts.timeSeries?.datedValues||[];if(vs.length)tot[ts.dailyMetric]=vs.reduce((s,v)=>s+Number(v.value||0),0)}const soma=(a,b)=>tot[a]===undefined||tot[b]===undefined?null:tot[a]+tot[b];p.metricas={impressoes_busca:soma(nomes[0],nomes[1]),impressoes_maps:soma(nomes[2],nomes[3]),cliques_site:tot.WEBSITE_CLICKS??null,ligacoes:tot.CALL_CLICKS??null,rotas:tot.BUSINESS_DIRECTION_REQUESTS??null};
 }else if(f==='instagram'){
  const map={alcance:'reach',visualizacoes:'views',interacoes:'total_interactions',curtidas:'likes',comentarios:'comments',compartilhamentos:'shares',salvos:'saves',toques_links:'profile_links_taps'};let recebidos=0;
  for(const [k,m]of Object.entries(map))await opcional(async()=>{const r=await api(url(GRAPH+'/'+a.id+'/insights',{metric:m,period:'day',metric_type:'total_value',since:String(Date.parse(j.inicio+'T00:00:00-03:00')/1000),until:String(Date.parse(proximo(j.fim)+'T00:00:00-03:00')/1000)}));p.metricas[k]=num(r.data?.find(x=>x.name===m)?.total_value?.value);if(p.metricas[k]!==null)recebidos++});if(!recebidos)falha('coleta');
 }else if(f==='meta_ads'){
  const info=await api(url(GRAPH+'/'+a.id,{fields:'currency'}));saida.moeda=info.currency;
  const metrics=r=>{const gasto=num(r.spend),cliques=num(r.inline_link_clicks),leads=num(r.actions?.find(x=>x.action_type==='lead')?.value);return {gasto,alcance:num(r.reach),impressoes:num(r.impressions),frequencia:num(r.frequency),cliques,ctr:num(r.inline_link_click_ctr)===null?null:Number(r.inline_link_click_ctr)/100,cpc:gasto!==null&&cliques>0?gasto/cliques:null,cpm:num(r.cpm),leads,custo_lead:gasto!==null&&leads>0?gasto/leads:null,conversas:num(r.actions?.find(x=>x.action_type==='onsite_conversion.messaging_conversation_started_7d')?.value)}};
  const q=async level=>await api(url(GRAPH+'/'+a.id+'/insights',{fields:'spend,reach,impressions,frequency,inline_link_clicks,inline_link_click_ctr,cpm,actions'+(level==='campaign'?',campaign_name':level==='ad'?',ad_name':''),time_range:JSON.stringify({since:j.inicio,until:j.fim}),level,limit:'100'}));const r=await q('account');p.metricas=r.data?.[0]?metrics(r.data[0]):{};
  for(const [t,l]of [['campanhas','campaign'],['anuncios','ad']])await opcional(async()=>{const x=await q(l);if(x.paging?.next)saida.qualidade.limitado=true;p.tabelas[t]=(x.data||[]).map(v=>({nome:v[l+'_name']||'',...metrics(v)}))});
 }else falha('invalido');
 if(Object.values(saida.qualidade).some(Boolean))saida.estado='parcial';return saida;
}
