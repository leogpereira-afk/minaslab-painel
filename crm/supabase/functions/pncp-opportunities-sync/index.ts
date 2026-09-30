import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const keywords=['analis','laborator','potabil','microbiolog','fisico-quim','efluen','monitoramento ambiental','qualidade da agua','controle da qualidade da agua','portaria 888','coleta de amostra','balneabil','ensaio ambiental']
const cities=new Set(['montes claros','janauba','januaria','pirapora','bocaiuva','salinas','brasilia de minas','sao francisco','grao mogol','taiobeiras','porteirinha','espinosa','manga','jaiba','coracao de jesus','francisco sa','capitao eneas','pedras de maria da cruz','varzelandia','buritizeiro','juramento','mirabela','engenheiro navarro'])
const modalities=[1,2,3,4,5,6,7,8,9,12,13]
const normalize=(value:string)=>value.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const pncpDate=(date:Date)=>date.toISOString().slice(0,10).replaceAll('-','')
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))

async function fetchPncp(endpoint:string, attempts=2, timeoutMs=20000){
 let lastStatus=0
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const response=await fetch(endpoint,{headers:{accept:'application/json','user-agent':'CRM-MinasLab/1.1'},signal:AbortSignal.timeout(timeoutMs)})
   lastStatus=response.status
   if(response.ok)return response
   if(response.status!==408&&response.status!==429&&response.status<500)return response
  }catch{
   lastStatus=0
  }
  await wait(500*(attempt+1))
 }
 return new Response('',{status:lastStatus||599})
}

Deno.serve(async(req)=>{
 try{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
 if(req.method!=='POST')return json({error:'Método não permitido'},405)
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!key)return json({error:'Configuração interna ausente'},500)
 const admin=createClient(url,key,{auth:{persistSession:false}})
 const auth=req.headers.get('authorization')
 let authenticatedUser=false
 if(auth){const token=auth.replace(/^Bearer\s+/i,'');const{data}=await admin.auth.getUser(token);authenticatedUser=Boolean(data.user)}
 const lock=await admin.from('pncp_sync_controle').upsert({id:1,ultima_tentativa:new Date().toISOString()},{onConflict:'id'}).select('ultima_execucao').single()
 if(!authenticatedUser&&lock.data?.ultima_execucao&&Date.now()-new Date(lock.data.ultima_execucao).getTime()<15*60_000)return json({ok:true,ignorado:'Busca recente',processadas:0,compativeis:0})
 const initialDate=pncpDate(new Date())
 const finalDate=pncpDate(new Date(Date.now()+60*86400000))
 const publicationInitialDate=pncpDate(new Date(Date.now()-30*86400000))
 let processed=0,matched=0,failedRequests=0
 const failureStatuses:Record<string,number>={}
 const startedAt=Date.now()
 const rotation=Math.floor(Date.now()/86400000)%modalities.length
 const orderedModalities=[...modalities.slice(rotation),...modalities.slice(0,rotation)]
 for(const modality of orderedModalities){
  if(Date.now()-startedAt>80000){failureStatuses.deadline=(failureStatuses.deadline||0)+1;break}for(let page=1,total=1;page<=Math.min(total,10);page++){
  // Publicações recentes são mais estáveis que a busca por encerramento; o filtro abaixo mantém somente editais ainda abertos.
  const endpoint=`https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${publicationInitialDate}&dataFinal=${initialDate}&codigoModalidadeContratacao=${modality}&uf=MG&pagina=${page}&tamanhoPagina=50`
  const response=await fetchPncp(endpoint,2,12000)
  if(!response.ok){failedRequests++;const status=String(response.status);failureStatuses[status]=(failureStatuses[status]||0)+1;continue}
  const raw=await response.text();if(!raw)continue
  let body;try{body=JSON.parse(raw)}catch{failedRequests++;failureStatuses.invalid_json=(failureStatuses.invalid_json||0)+1;continue}
  total=Math.max(Number(body.totalPaginas||1),1)
  for(const item of body.data||[]){processed++;const city=normalize(item.unidadeOrgao?.municipioNome||'');const text=normalize(`${item.objetoCompra||''} ${item.informacaoComplementar||''}`);const hits=keywords.filter(k=>text.includes(k));const closes=item.dataEncerramentoProposta?new Date(item.dataEncerramentoProposta).getTime():null;if(!cities.has(city)||!hits.length||(closes!==null&&closes<Date.now()))continue;matched++
   const row={numero_controle_pncp:item.numeroControlePNCP,numero_compra:item.numeroCompra,processo:item.processo,orgao:item.orgaoEntidade?.razaoSocial,cnpj_orgao:item.orgaoEntidade?.cnpj,unidade:item.unidadeOrgao?.nomeUnidade,municipio:item.unidadeOrgao?.municipioNome,uf:item.unidadeOrgao?.ufSigla,modalidade:item.modalidadeNome,objeto:item.objetoCompra,data_publicacao:item.dataPublicacaoPncp,data_abertura_proposta:item.dataAberturaProposta,data_encerramento_proposta:item.dataEncerramentoProposta,valor_estimado:item.valorTotalEstimado,portal_url:item.linkSistemaOrigem||item.linkProcessoEletronico||null,pncp_url:`https://pncp.gov.br/app/editais/${item.orgaoEntidade?.cnpj}/${item.anoCompra}/${item.sequencialCompra}`,palavras_encontradas:hits,prioridade:city==='montes claros'?'ALTA':'MEDIA',payload:item,atualizada_em:new Date().toISOString()}
   const {error}=await admin.from('licitacao_oportunidades').upsert(row,{onConflict:'numero_controle_pncp',ignoreDuplicates:false})
   if(error){failedRequests++;failureStatuses.database=(failureStatuses.database||0)+1}
  }
 }
  await wait(1200)
 }
 const result={processadas:processed,compatíveis:matched,falhas_externas:failedRequests,status_falhas:failureStatuses,periodo:{data_inicial:initialDate,data_final:finalDate}}
 await admin.from('pncp_sync_controle').upsert({id:1,ultima_execucao:new Date().toISOString(),ultima_tentativa:new Date().toISOString(),ultimo_resultado:result},{onConflict:'id'})
 return json({ok:true,processadas:processed,compativeis:matched,falhas_externas:failedRequests,status_falhas:failureStatuses})
 }catch(error){console.error('Falha na sincronização PNCP',error);return json({error:error instanceof Error?error.message:String(error)},500)}
})
