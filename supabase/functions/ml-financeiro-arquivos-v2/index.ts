import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const URL=Deno.env.get("SUPABASE_URL")!;
const KEY=Deno.env.get("SB_SECRET_KEY")??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND=Deno.env.get("RESEND_API_KEY")??"";
const FROM_SECRET=Deno.env.get("FIN_EMAIL_FROM")??"";
const COPY_EMAIL="financeiro@minaslab.net";
const OLD=`${URL}/functions/v1/ml-financeiro-arquivos`;
const DANFSE=`${URL}/functions/v1/ml-financeiro-nfse-danfse`;
const sb=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, no-cache, must-revalidate"}});
const t=(v:any)=>String(v??"").trim();
const br=(v:any)=>{const s=t(v).slice(0,10),p=s.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:"—"};
const moeda=(v:any)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function emailFrom(){const m=FROM_SECRET.match(/<([^>]+)>/);const email=(m?.[1]||FROM_SECRET).trim();return `Financeiro <${email}>`}
function replyTo(){const m=FROM_SECRET.match(/<([^>]+)>/);return (m?.[1]||FROM_SECRET).trim()}
async function authOk(auth:string){const r=await fetch(OLD,{method:"POST",headers:{"Authorization":auth,"Content-Type":"application/json"},body:JSON.stringify({action:"emailEstado"})});return r.status}
// Só crachá recusado desloga (401). Um tropeço do serviço (503, 546, 429) não é sessão vencida.
async function porta(auth:string){const st=await authOk(auth);if(st===401)return out({erro:"Entre no sistema.",semSessao:true},401);if(st===403)return out({erro:"Sem permissão para os arquivos do financeiro."},403);if(st<200||st>=300)return out({erro:"O serviço de arquivos não respondeu. Tente de novo em instantes."},503);return null}
// A função de DANFSe só aceita o crachá de quem está logado como direção (ou o gatilho do banco para nota nova sem PDF).
// Por isso repassamos o crachá de quem abriu o arquivo; com a chave de serviço ela devolvia 401 ("Entre no sistema").
// Se a conta não for da direção (401/403), abre o PDF que já existe em vez de falhar.
async function regenerarPorPath(path:string,auth:string){
 if(!path||!path.toLowerCase().endsWith(".pdf"))return path;
 const {data:nota}=await sb.from("notas_fiscais").select("id,pdf_url,xml_url,origem,status_fiscal").eq("pdf_url",path).eq("apagado",false).maybeSingle();
 if(!nota?.id||!nota?.xml_url||t(nota.origem)!=="NFSE_NACIONAL")return path;
 const r=await fetch(DANFSE,{method:"POST",headers:{"Content-Type":"application/json","Authorization":auth},body:JSON.stringify({id:nota.id})});
 if(r.status===401||r.status===403)return path;
 if(!r.ok)throw new Error(`Falha ao atualizar DANFSe antes de abrir (HTTP ${r.status}).`);
 const j=await r.json().catch(()=>({}));
 if(!j?.ok)throw new Error(t(j?.erro)||"Falha ao atualizar DANFSe.");
 return t(j.pdfPath)||path;
}
async function regenerarNota(nota:any,auth:string){if(nota?.id&&nota?.xml_url&&t(nota.origem)==="NFSE_NACIONAL"){const r=await fetch(DANFSE,{method:"POST",headers:{"Content-Type":"application/json","Authorization":auth},body:JSON.stringify({id:nota.id})});if(r.status===401||r.status===403)return nota;if(!r.ok)throw new Error(`Falha ao atualizar DANFSe (HTTP ${r.status}).`);const j=await r.json().catch(()=>({}));if(!j?.ok)throw new Error(t(j?.erro)||"Falha ao atualizar DANFSe.");nota.pdf_url=t(j.pdfPath)||nota.pdf_url}return nota}
async function baixar(path:string){if(!path||!path.startsWith("financeiro/"))return null;const {data:u,error:se}=await sb.storage.from("ml-arquivos").createSignedUrl(path,60);if(se||!u?.signedUrl)return null;const r=await fetch(u.signedUrl,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});if(!r.ok)return null;return new Uint8Array(await r.arrayBuffer())}
function b64(bytes:Uint8Array){let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return out({erro:"Use POST."},405);
 let body:any;try{body=await req.json()}catch{return out({erro:"JSON inválido."},400)}
 const action=t(body.action),auth=t(req.headers.get("authorization"));
 if(!["emailEstado","emailEnviar"].includes(action)){
  if(action==="urlAssinada"&&t(body.path).toLowerCase().endsWith(".pdf")){
   /* CONFERE ANTES DE REGENERAR (auditoria de 28/09/2026). Antes a nota era
      regenerada no servidor e só DEPOIS a função antiga conferia o crachá:
      quem não tinha login não levava o link, mas disparava a gravação. */
   {const barrado=await porta(auth);if(barrado)return barrado}
   try{body={...body,path:await regenerarPorPath(t(body.path),auth)}}catch(e){return out({erro:e instanceof Error?e.message:String(e)},500)}
  }
  const r=await fetch(OLD,{method:"POST",headers:{"Authorization":auth,"Content-Type":"application/json","Cache-Control":"no-cache"},body:JSON.stringify(body),cache:"no-store"});
  return new Response(await r.text(),{status:r.status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, no-cache, must-revalidate"}})
 }
 {const barrado=await porta(auth);if(barrado)return barrado}
 if(action==="emailEstado")return out({configurado:!!RESEND&&!!FROM_SECRET});
 if(!RESEND||!FROM_SECRET)return out({erro:"Envio de e-mail ainda não configurado."},503);
 const notaId=t(body.notaId),destino=t(body.email);
 if(!notaId||!/^\S+@\S+\.\S+$/.test(destino))return out({erro:"Informe a nota e um e-mail válido."},400);
 const{data:nota0,error}=await sb.from("notas_fiscais").select("*,empresa:empresas(id,nome,cnpj)").eq("id",notaId).eq("apagado",false).maybeSingle();
 if(error)throw error;if(!nota0)return out({erro:"Nota não encontrada."},404);
 const nota=await regenerarNota(nota0,auth);
 const anexos:any[]=[];for(const[path,ext]of[[nota.xml_url,"xml"],[nota.pdf_url,"pdf"]]){const bytes=await baixar(t(path));if(bytes)anexos.push({filename:`NFS-e-${nota.numero_nf||nota.id}.${ext}`,content:b64(bytes)})}
 if(!anexos.length)return out({erro:"A nota não possui XML/PDF armazenado para anexar."},409);
 const emitente=t(nota.nome_emitente)||t(nota.empresa?.nome)||"M LAB SERVICOS LTDA",destinatario=t(nota.nome_destinatario)||"Cliente";
 const assunto=`NFS-e nº ${t(nota.numero_nf)||"—"} | ${emitente} → ${destinatario}`;
 const mensagem=`Olá,\n\nSegue a Nota Fiscal de Serviço Eletrônica.\n\nEmitente: ${emitente}\nCNPJ: ${t(nota.cnpj_emitente)||t(nota.empresa?.cnpj)||"—"}\nNº da NFS-e: ${t(nota.numero_nf)||"—"}\nData de Emissão: ${br(nota.data_emissao)}\nVencimento: ${br(nota.data_vencimento)}\nValor: ${moeda(nota.valor_total)}\n\nA Nota Fiscal segue anexa a este e-mail.\n\nAtenciosamente,\nMINASLAB LTDA`;
 const envio=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${RESEND}`,"Content-Type":"application/json"},body:JSON.stringify({from:emailFrom(),to:[destino],reply_to:replyTo(),bcc:[COPY_EMAIL],subject:assunto,text:mensagem,attachments:anexos})});
 const ret=await envio.json().catch(()=>({}));
 if(!envio.ok){await sb.from("log_envios_nf").insert({nota_fiscal_id:nota.id,empresa_id:nota.empresa_id,numero_nf:nota.numero_nf,email_destino:destino,status:"ERRO",observacao:t(ret?.message)||`HTTP ${envio.status}`,anexos:anexos.map(a=>a.filename),enviado_por:"direcao"});return out({erro:t(ret?.message)||`Falha ao enviar e-mail (HTTP ${envio.status}).`},envio.status)}
 await sb.from("log_envios_nf").insert({nota_fiscal_id:nota.id,empresa_id:nota.empresa_id,numero_nf:nota.numero_nf,email_destino:destino,status:"ENVIADO",observacao:t(ret?.id)||null,anexos:anexos.map(a=>a.filename),enviado_por:"direcao"});
 await sb.from("notas_fiscais").update({email_destino:destino,status_envio:"ENVIADO",enviado_em:new Date().toISOString(),enviado_por:"direcao",updated_at:new Date().toISOString()}).eq("id",nota.id);
 return out({ok:true,id:ret?.id||null,anexos:anexos.map(a=>a.filename),assunto,mensagem,from:emailFrom(),replyTo:replyTo(),copiaOculta:COPY_EMAIL});
});