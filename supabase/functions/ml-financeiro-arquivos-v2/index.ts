import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const URL=Deno.env.get("SUPABASE_URL")!;
const KEY=Deno.env.get("SB_SECRET_KEY")??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND=Deno.env.get("RESEND_API_KEY")??"";
const FROM_SECRET=Deno.env.get("FIN_EMAIL_FROM")??"";
const COPY_EMAIL="financeiro@minaslab.net";
const OLD=`${URL}/functions/v1/ml-financeiro-arquivos`;
const sb=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const t=(v:any)=>String(v??"").trim();
const br=(v:any)=>{const s=t(v).slice(0,10),p=s.split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:"—"};
const moeda=(v:any)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function emailFrom(){const m=FROM_SECRET.match(/<([^>]+)>/);const email=(m?.[1]||FROM_SECRET).trim();return `Financeiro <${email}>`}
function replyTo(){const m=FROM_SECRET.match(/<([^>]+)>/);return (m?.[1]||FROM_SECRET).trim()}
async function authOk(auth:string){const r=await fetch(OLD,{method:"POST",headers:{"Authorization":auth,"Content-Type":"application/json"},body:JSON.stringify({action:"emailEstado"})});return r.ok}
async function baixar(path:string){if(!path||!path.startsWith("financeiro/"))return null;const{data,error}=await sb.storage.from("ml-arquivos").download(path);if(error||!data)return null;return new Uint8Array(await data.arrayBuffer())}
function b64(bytes:Uint8Array){let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return out({erro:"Use POST."},405);
 let body:any;try{body=await req.json()}catch{return out({erro:"JSON inválido."},400)}
 const action=t(body.action),auth=t(req.headers.get("authorization"));
 if(!["emailEstado","emailEnviar"].includes(action)){
  const r=await fetch(OLD,{method:"POST",headers:{"Authorization":auth,"Content-Type":"application/json"},body:JSON.stringify(body)});
  return new Response(await r.text(),{status:r.status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})
 }
 if(!(await authOk(auth)))return out({erro:"Entre no sistema.",semSessao:true},401);
 if(action==="emailEstado")return out({configurado:!!RESEND&&!!FROM_SECRET});
 if(!RESEND||!FROM_SECRET)return out({erro:"Envio de e-mail ainda não configurado."},503);
 const notaId=t(body.notaId),destino=t(body.email);
 if(!notaId||!/^\S+@\S+\.\S+$/.test(destino))return out({erro:"Informe a nota e um e-mail válido."},400);
 const{data:nota,error}=await sb.from("notas_fiscais").select("*,empresa:empresas(id,nome,cnpj)").eq("id",notaId).eq("apagado",false).maybeSingle();
 if(error)throw error;if(!nota)return out({erro:"Nota não encontrada."},404);
 const anexos:any[]=[];for(const[path,ext]of[[nota.xml_url,"xml"],[nota.pdf_url,"pdf"]]){const bytes=await baixar(t(path));if(bytes)anexos.push({filename:`NFS-e-${nota.numero_nf||nota.id}.${ext}`,content:b64(bytes)})}
 if(!anexos.length)return out({erro:"A nota não possui XML/PDF armazenado para anexar."},409);
 const emitente=t(nota.nome_emitente)||t(nota.empresa?.nome)||"M LAB SERVICOS LTDA";
 const destinatario=t(nota.nome_destinatario)||"Cliente";
 const assunto=`NFS-e nº ${t(nota.numero_nf)||"—"} | ${emitente} → ${destinatario}`;
 const mensagem=`Olá,\n\nSegue a Nota Fiscal de Serviço Eletrônica.\n\nEmitente: ${emitente}\nCNPJ: ${t(nota.cnpj_emitente)||t(nota.empresa?.cnpj)||"—"}\nNº da NFS-e: ${t(nota.numero_nf)||"—"}\nData de Emissão: ${br(nota.data_emissao)}\nVencimento: ${br(nota.data_vencimento)}\nValor: ${moeda(nota.valor_total)}\n\nA Nota Fiscal segue anexa a este e-mail.\n\nAtenciosamente,\nMINASLAB LTDA`;
 const envio=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${RESEND}`,"Content-Type":"application/json"},body:JSON.stringify({from:emailFrom(),to:[destino],reply_to:replyTo(),bcc:[COPY_EMAIL],subject:assunto,text:mensagem,attachments:anexos})});
 const ret=await envio.json().catch(()=>({}));
 if(!envio.ok){await sb.from("log_envios_nf").insert({nota_fiscal_id:nota.id,empresa_id:nota.empresa_id,numero_nf:nota.numero_nf,email_destino:destino,status:"ERRO",observacao:t(ret?.message)||`HTTP ${envio.status}`,anexos:anexos.map(a=>a.filename),enviado_por:"direcao"});return out({erro:t(ret?.message)||`Falha ao enviar e-mail (HTTP ${envio.status}).`},envio.status)}
 await sb.from("log_envios_nf").insert({nota_fiscal_id:nota.id,empresa_id:nota.empresa_id,numero_nf:nota.numero_nf,email_destino:destino,status:"ENVIADO",observacao:t(ret?.id)||null,anexos:anexos.map(a=>a.filename),enviado_por:"direcao"});
 await sb.from("notas_fiscais").update({email_destino:destino,status_envio:"ENVIADO",enviado_em:new Date().toISOString(),enviado_por:"direcao",updated_at:new Date().toISOString()}).eq("id",nota.id);
 return out({ok:true,id:ret?.id||null,anexos:anexos.map(a=>a.filename),assunto,mensagem,from:emailFrom(),replyTo:replyTo(),copiaOculta:COPY_EMAIL});
});