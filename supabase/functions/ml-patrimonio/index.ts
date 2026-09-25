import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.45.0';
const URL=Deno.env.get('SUPABASE_URL')!;
const sb=createClient(URL,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json','Cache-Control':'no-store'}});
const idOk=(id:unknown)=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
async function linhas(tipo:string){
 const todas:any[]=[];
 for(let i=0;;i+=500){const {data,error}=await sb.from('ml_patrimonio').select('id,dados').eq('tipo',tipo).eq('apagado',false).order('id').range(i,i+499);if(error)throw error;todas.push(...data);if(data.length<500)return todas;}
}
async function gravar(action:string,tipo:string,id:string,dados:unknown,usuario:string){const{data,error}=await sb.rpc('ml_patrimonio_gravar',{p_action:action,p_tipo:tipo,p_id:id,p_dados:dados,p_usuario:usuario});if(error)throw error;return data;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method!=='POST')return out({erro:'Use POST.'},405);
 try{
  const auth=req.headers.get('authorization')||'';
  if(!/^Bearer .+/.test(auth))return out({erro:'Entre no sistema.',semSessao:true},401);
  // A porta canônica verifica assinatura, validade, sistema e conta ativa.
  const sessao=await fetch(`${URL}/functions/v1/ml-sync`,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({action:'rev'})});
  if(!sessao.ok)return out({erro:'Sessão inválida ou indisponível.',semSessao:sessao.status===401},sessao.status===401?401:503);
  let p:any;try{const parte=auth.slice(7).split('.')[1];p=JSON.parse(atob(parte.replace(/-/g,'+').replace(/_/g,'/')));}catch{return out({erro:'Sessão inválida.',semSessao:true},401);}
  if(p.sis!=='minaslab'||!p.sub||!Number.isFinite(p.exp)||p.exp<=Date.now()/1000)return out({erro:'Sessão inválida.',semSessao:true},401);
  const direcao=p.papel==='direcao';
  if(!direcao){
   const {data:conta,error}=await sb.from('ml_contas').select('ativo,paginas_consulta').eq('usuario',p.sub).maybeSingle();
   if(error||!conta||conta.ativo!==true)return out({erro:'Não foi possível confirmar sua permissão.',semPermissao:true},403);
   const paginas=Array.isArray(conta.paginas_consulta)?conta.paginas_consulta:[];
   if(!paginas.includes('__matriz_v1')||!paginas.some((k:string)=>k==='patrimonio'||k.startsWith('patrimonio/')))return out({erro:'Patrimônio não liberado para sua conta.',semPermissao:true},403);
  }
  const b=await req.json();const action=String(b.action||'');
  if(!direcao&&!['listar','foto:resumo','foto:listar'].includes(action))return out({erro:'Esta conta pode consultar patrimônio, mas não alterar.',semPermissao:true},403);
  if(action==='listar'){
   if(!['bem','setor'].includes(b.tipo))return out({erro:'Tipo inválido.'},400);
   return out({ok:true,valor:Object.fromEntries((await linhas(b.tipo)).map(r=>[r.id,r.dados]))});
  }
  if(['salvar','remover'].includes(action)){
   if(!['bem','setor'].includes(b.tipo)||!idOk(b.id))return out({erro:'Cadastro inválido.'},400);
   return out({ok:true,valor:await gravar(action,b.tipo,b.id,b.dados||{},p.sub)});
  }
  if(action==='setoresIniciais'){
   if(!Array.isArray(b.lista)||b.lista.length>30)return out({erro:'Lista inválida.'},400);
   // Cada setor tem id estável e não sobrescreve um setor já cadastrado.
   let existentes=await linhas('setor');let valor=Object.fromEntries(existentes.map(r=>[r.id,r.dados]));
   for(const s of b.lista){if(existentes.some(r=>r.dados.sigla===s.sigla))continue;const id=`set-${String(s.sigla).toLowerCase()}`;if(!idOk(id))throw new Error('Sigla inválida.');valor=await gravar('iniciar','setor',id,s,p.sub);existentes=Object.entries(valor).map(([id,dados])=>({id,dados}));}
   return out({ok:true,valor});
  }
  if(action==='foto:resumo'){
   const porBem:Record<string,number>={};for(const f of await linhas('foto'))porBem[f.dados.bemId]=(porBem[f.dados.bemId]||0)+1;
   return out({ok:true,porBem});
  }
  if(!action.startsWith('foto:')||!idOk(b.bemId))return out({erro:'Operação inválida.'},400);
  const {data:bem,error:be}=await sb.from('ml_patrimonio').select('id').eq('tipo','bem').eq('id',b.bemId).eq('apagado',false).maybeSingle();if(be)throw be;if(!bem)return out({erro:'Bem não encontrado.'},404);
  const fotos=(await linhas('foto')).filter(f=>f.dados.bemId===b.bemId);
  if(action==='foto:listar'){
   const result=[];for(const f of fotos){const {data,error}=await sb.storage.from('ml-patrimonio').createSignedUrl(f.dados.path,3600);if(error)throw error;result.push({id:f.id,nome:f.dados.nome,url:data.signedUrl});}return out({ok:true,fotos:result});
  }
  if(action==='foto:adicionar'){
   if(typeof b.base64!=='string'||b.base64.length>4194304)return out({erro:'Foto acima do limite.'},400);
   const bytes=Uint8Array.from(atob(b.base64),c=>c.charCodeAt(0));if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return out({erro:'Envie uma foto JPEG válida.'},400);
   const id=crypto.randomUUID(),path=`${b.bemId}/${id}.jpg`;
   const{error}=await sb.storage.from('ml-patrimonio').upload(path,bytes,{contentType:'image/jpeg',upsert:false});if(error)throw error;
   try{await gravar('salvar','foto',id,{bemId:b.bemId,path,nome:String(b.nome||'Foto').slice(0,200)},p.sub);}catch(e){await sb.storage.from('ml-patrimonio').remove([path]);throw e;}
   return out({ok:true,id});
  }
  if(action==='foto:remover'){
   const foto=fotos.find(f=>f.id===b.id);if(!foto)return out({erro:'Foto não encontrada neste bem.'},404);
   // Lápide: conserva o arquivo privado para recuperação administrativa.
   await gravar('remover','foto',foto.id,{},p.sub);return out({ok:true});
  }
  return out({erro:'Operação desconhecida.'},400);
 }catch(e){console.error('ml-patrimonio',e);return out({erro:e instanceof Error?e.message:'Não foi possível concluir a operação.'},400);}
});

