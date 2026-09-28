import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";
import { SignedXml } from "npm:xml-crypto@6.1.2";
import { DOMParser } from "npm:@xmldom/xmldom@0.9.8";

const URL=Deno.env.get('SUPABASE_URL')!, KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, JWT=Deno.env.get('ML_JWT_SECRET')||'', BUCKET='ml-arquivos';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const enc=new TextEncoder(),dec=new TextDecoder();
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const digits=(v:any)=>String(v||'').replace(/\D/g,'');
const esc=(v:any)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

function b64u(s:string){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
async function auth(req:Request){const t=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!t||!JWT)return null;const p=t.split('.');if(p.length!==3)return null;try{const k=await crypto.subtle.importKey('raw',enc.encode(JWT),{name:'HMAC',hash:'SHA-256'},false,['verify']);if(!await crypto.subtle.verify('HMAC',k,b64u(p[2]),enc.encode(`${p[0]}.${p[1]}`)))return null;const x=JSON.parse(dec.decode(b64u(p[1])));if(x.sis!=='minaslab'||String(x.papel||'')!=='direcao'||(x.exp&&x.exp<Math.floor(Date.now()/1000)))return null;return x}catch{return null}}
function a1(){const b64=String(Deno.env.get('MLAB_NFSE_CERT_PFX_B64')||'').replace(/\s/g,''),senha=String(Deno.env.get('MLAB_NFSE_CERT_PASSWORD')||'');if(!b64||!senha)throw new Error('Certificado A1 não configurado.');const asn1=forge.asn1.fromDer(forge.util.createBuffer(atob(b64),'raw')),p12=forge.pkcs12.pkcs12FromAsn1(asn1,false,senha);const cert=(p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[]).find((x:any)=>x.cert)?.cert;const sh=p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[],pl=p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[],key=[...sh,...pl].find((x:any)=>x.key)?.key;if(!cert||!key)throw new Error('Certificado/chave não encontrados.');return{certPem:forge.pki.certificateToPem(cert),keyPem:forge.pki.privateKeyToPem(key)}}
function agoraBrt(){const d=new Date(Date.now()-3*3600000);return d.toISOString().slice(0,19)+'-03:00'}

// Layout nacional v1.01 vigente: o identificador do pedido usa PRE + chave + tipo do evento.
// nPedRegEvento não faz mais parte do XML do pedido de registro de evento.
function montar(chave:string,cnpj:string,codigo:string,motivo:string){const id=`PRE${chave}101101`;return `<?xml version="1.0" encoding="UTF-8"?><pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infPedReg Id="${id}"><tpAmb>1</tpAmb><verAplic>MINASLAB-1.0</verAplic><dhEvento>${agoraBrt()}</dhEvento><CNPJAutor>${cnpj}</CNPJAutor><chNFSe>${chave}</chNFSe><e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>${codigo}</cMotivo><xMotivo>${esc(motivo)}</xMotivo></e101101></infPedReg></pedRegEvento>`}
function assinar(xml:string,keyPem:string,certPem:string){const s=new SignedXml({privateKey:keyPem,publicCert:certPem,canonicalizationAlgorithm:'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',signatureAlgorithm:'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'});s.addReference({xpath:"//*[local-name(.)='infPedReg']",transforms:['http://www.w3.org/2000/09/xmldsig#enveloped-signature','http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],digestAlgorithm:'http://www.w3.org/2001/04/xmlenc#sha256'});s.computeSignature(xml,{location:{reference:"//*[local-name(.)='infPedReg']",action:'after'}});const out=s.getSignedXml(),doc=new DOMParser().parseFromString(out,'text/xml'),node=doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#','Signature')[0];if(!node)throw new Error('Assinatura do evento não gerada.');const c=new SignedXml({publicCert:certPem});c.loadSignature(node);if(!c.checkSignature(out))throw new Error('Assinatura do evento não passou na validação local.');return out}
async function gzipB64(t:string){const st=new Blob([enc.encode(t)]).stream().pipeThrough(new CompressionStream('gzip')),b=new Uint8Array(await new Response(st).arrayBuffer());let bin='';for(let i=0;i<b.length;i+=8192)bin+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(bin)}
async function gunzipB64(s:string){const bin=atob(s),b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);const st=new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));return dec.decode(await new Response(st).arrayBuffer())}
async function gateway(path:string,body:any){const base=String(Deno.env.get('NFSE_GATEWAY_URL')||'').replace(/\/$/,''),token=String(Deno.env.get('NFSE_GATEWAY_TOKEN')||'');if(!base||!token)throw new Error('Gateway NFS-e não configurado.');const r=await fetch(base+path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)}),b=await r.json().catch(()=>null);return{ok:r.ok,status:r.status,body:b}}
function textoRejeicao(v:any):string{if(v==null)return'';if(typeof v==='string')return v;if(Array.isArray(v))return v.map(textoRejeicao).filter(Boolean).join(' | ');if(typeof v==='object'){const codigo=v.codigo||v.code||v.cStat||v.cod||'';const msg=v.descricao||v.mensagem||v.message||v.motivo||v.xMotivo||v.erro||v.error_description||'';const comp=v.complemento||v.detalhe||v.details||'';const principal=[codigo,msg,comp].filter(Boolean).join(' — ');if(principal)return principal;try{return JSON.stringify(v)}catch{return String(v)}}return String(v)}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  const u=await auth(req);if(!u)return json({erro:'Sessão inválida ou sem permissão.'},401);
  let b:any={};try{b=await req.json()}catch{return json({erro:'JSON inválido.'},400)}
  if(b.action!=='cancelarProducao')return json({erro:'Ação inválida.'},400);
  const id=String(b.id||''),codigo=String(b.codigoMotivo||''),motivo=String(b.motivo||'').trim();
  if(!id)return json({erro:'NFS-e não informada.'},400);
  if(!['1','2','9'].includes(codigo))return json({erro:'Motivo inválido. Use 1-Erro na emissão, 2-Serviço não prestado ou 9-Outros.'},400);
  if(motivo.length<15||motivo.length>255)return json({erro:'A descrição do motivo deve ter entre 15 e 255 caracteres.'},400);
  if(String(Deno.env.get('MLAB_NFSE_AMBIENTE')||'').toUpperCase()!=='PRODUCAO'||String(Deno.env.get('MLAB_NFSE_PRODUCAO_LIBERADA')||'').toUpperCase()!=='SIM'||String(Deno.env.get('MLAB_NFSE_TRANSMISSAO_ATIVA')||'').toUpperCase()!=='SIM')return json({erro:'Cancelamento em produção bloqueado.'},423);
  const sb=createClient(URL,KEY);
  try{
    const q=await sb.from('notas_fiscais').select('*,empresa:empresas(*)').eq('id',id).eq('apagado',false).maybeSingle();if(q.error)throw q.error;const n:any=q.data;
    if(!n)throw new Error('NFS-e não encontrada.');
    if(n.status_fiscal==='CANCELADA')return json({ok:true,jaCancelada:true,numeroNf:n.numero_nf});
    if(n.origem!=='NFSE_NACIONAL'||n.status_fiscal!=='AUTORIZADA')throw new Error('Somente NFS-e Nacional AUTORIZADA pode ser cancelada.');
    const chave=digits(n.chave_acesso),cnpj=digits(n.empresa?.cnpj||n.cnpj_emitente);if(chave.length!==50||cnpj.length!==14)throw new Error('Chave/CNPJ inválidos para cancelamento.');
    const cert=a1(),xml=montar(chave,cnpj,codigo,motivo),signed=assinar(xml,cert.keyPem,cert.certPem),gz=await gzipB64(signed);
    const g=await gateway(`/v1/nfse/${chave}/eventos`,{pedidoRegistroEventoXmlGZipB64:gz});
    const resp=g.body?.resposta||g.body;
    if(!g.ok||!g.body?.ok||!resp?.eventoXmlGZipB64){const erros=resp?.erros||resp?.erro||g.body?.erro||resp;const detalhe=textoRejeicao(erros);return json({erro:detalhe?`NFS-e Nacional rejeitou o cancelamento: ${detalhe}`:'Cancelamento não autorizado pela NFS-e Nacional.',detalhes:erros,statusHttp:g.body?.statusHttp||g.status,layoutEvento:'1.01',codigoEvento:'101101'},422)}
    const eventoXml=await gunzipB64(resp.eventoXmlGZipB64),ano=new Date().getFullYear(),path=`financeiro/${n.empresa_id}/nfse/${ano}/${chave}-cancelamento.xml`;
    const up=await sb.storage.from(BUCKET).upload(path,enc.encode(eventoXml),{contentType:'application/xml',upsert:true});if(up.error)throw up.error;
    const fin=await sb.rpc('finalizar_nfse_cancelamento',{p_nota_id:n.id,p_motivo_codigo:codigo,p_motivo:motivo,p_evento_path:path,p_evento_dados:{tipoEvento:'101101',resposta:resp},p_cancelada_em:new Date().toISOString()});if(fin.error)throw fin.error;
    return json({ok:true,numeroNf:n.numero_nf,chaveAcesso:chave,eventoPath:path,...fin.data});
  }catch(e){return json({erro:e instanceof Error?e.message:String(e)},500)}
});