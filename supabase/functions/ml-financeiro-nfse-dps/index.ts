import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const digits=(v:any)=>String(v||"").replace(/\D/g,"");
const norm=(v:any)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();

/* A PORTA CONFERE A ASSINATURA (auditoria de 28/09/2026).
   A auth() anterior abria o crachá e olhava só a validade: qualquer token com
   formato de JWT e data futura passava — até a chave pública do Supabase. Esta
   é a MESMA verificação da ml-financeiro-nfse-producao, que a tela já chama com
   o mesmo crachá: assinatura HMAC com ML_JWT_SECRET, sistema "minaslab",
   validade e papel de direção (o financeiro inteiro é só da direção). */
const __ML_JWT_SECRET=Deno.env.get("ML_JWT_SECRET")||"",__enc=new TextEncoder(),__dec=new TextDecoder();
function __b64urlBytes(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
async function auth(req:Request){const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!t||!__ML_JWT_SECRET)return null;const p=t.split(".");if(p.length!==3)return null;try{const k=await crypto.subtle.importKey("raw",__enc.encode(__ML_JWT_SECRET),{name:"HMAC",hash:"SHA-256"},false,["verify"]);if(!await crypto.subtle.verify("HMAC",k,__b64urlBytes(p[2]),__enc.encode(`${p[0]}.${p[1]}`)))return null;const x=JSON.parse(__dec.decode(__b64urlBytes(p[1])));if(x.sis!=="minaslab"||(x.exp&&x.exp<Math.floor(Date.now()/1000))||String(x.papel||"")!=="direcao")return null;return x}catch{return null}}

function verificarA1Local(){
  const b64=String(Deno.env.get("MLAB_NFSE_CERT_PFX_B64")||"").replace(/\s/g,"");
  const senha=String(Deno.env.get("MLAB_NFSE_CERT_PASSWORD")||"");
  if(!b64||!senha)return {ok:false,mensagem:"Certificado A1 e/ou senha não configurados."};
  try{
    const asn1=forge.asn1.fromDer(forge.util.createBuffer(atob(b64),"raw"));
    const p12=forge.pkcs12.pkcs12FromAsn1(asn1,false,senha);
    const cert=(p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[]).find((x:any)=>x.cert)?.cert;
    const sh=p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[];
    const pl=p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[];
    const key=[...sh,...pl].find((x:any)=>x.key)?.key;
    if(!cert||!key)return {ok:false,mensagem:"Certificado/chave privada não encontrados no A1."};
    const agora=new Date(),ini=new Date(cert.validity.notBefore),fim=new Date(cert.validity.notAfter);
    if(agora<ini)return {ok:false,mensagem:"Certificado A1 ainda não está válido."};
    if(agora>fim)return {ok:false,mensagem:"Certificado A1 expirado."};
    return {ok:true,mensagem:`A1 válido até ${fim.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})}.`};
  }catch(e){return {ok:false,mensagem:"Não foi possível abrir o certificado A1 com a senha configurada."}}
}

async function municipioIbge(cliente:any){
  const cep=digits(cliente?.cep);
  if(cep.length===8){
    try{
      const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`,{headers:{"User-Agent":"MinasLab-NFSe/1.0"}});
      const j=await r.json().catch(()=>null);
      const ibge=digits(j?.ibge);
      if(r.ok&&!j?.erro&&ibge.length===7)return {ok:true,ibge,cidade:j.localidade||cliente?.cidade,uf:j.uf||cliente?.uf,fonte:"CEP"};
    }catch{}
  }
  if(norm(cliente?.cidade)==="MONTES CLAROS"&&norm(cliente?.uf||"MG")==="MG")return {ok:true,ibge:"3143302",cidade:"Montes Claros",uf:"MG",fonte:"FALLBACK"};
  return {ok:false,ibge:"",cidade:cliente?.cidade||"",uf:cliente?.uf||"",fonte:"NAO_IDENTIFICADO"};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(!await auth(req))return json({erro:"Sessão inválida ou sem permissão.",semSessao:true},401);
  let b:any={};try{b=await req.json()}catch{return json({erro:"JSON inválido."},400)}
  if(b.action!=="validarDps")return json({erro:"Ação inválida."},400);
  const id=String(b.id||b.registro?.id||"");if(!id)return json({erro:"Salve o rascunho antes de pré-validar."},400);
  const ambiente=String(Deno.env.get("MLAB_NFSE_AMBIENTE")||"HOMOLOGACAO").toUpperCase();
  try{
    const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:nota,error}=await sb.from("notas_fiscais").select("*,cliente:clientes_financeiro(*)").eq("id",id).eq("origem","NFSE_NACIONAL").eq("apagado",false).maybeSingle();
    if(error)throw error;if(!nota)throw new Error("Rascunho NFS-e não encontrado.");
    if(!["RASCUNHO","REJEITADA"].includes(String(nota.status_fiscal||"")))throw new Error(`A nota está em ${nota.status_fiscal} e não pode ser pré-validada como rascunho.`);
    const cliente=nota.cliente||{};const dados=nota.nfse_dados||{},serv=dados.servico||{},trib=dados.tributacao||{},fin=dados.financeiro||{};
    const a1=verificarA1Local();const mun=await municipioIbge(cliente);
    const etapas:any[]=[];
    const add=(chave:string,titulo:string,ok:boolean,detalhe:string)=>etapas.push({chave,titulo,status:ok?"OK":"ERRO",detalhe});
    const emitenteOk=digits(nota.cnpj_emitente).length===14&&digits(Deno.env.get("MLAB_NFSE_MUNICIPIO_IBGE")).length===7&&Boolean(Deno.env.get("MLAB_NFSE_INSCRICAO_MUNICIPAL"));
    add("empresa","Dados da M Lab",emitenteOk,emitenteOk?"CNPJ, inscrição municipal e município do emitente configurados.":"Revise CNPJ, inscrição municipal ou município IBGE da M Lab.");
    add("certificado","Certificado Digital",a1.ok,a1.mensagem);
    const doc=digits(cliente.cnpj_cpf);const clienteOk=Boolean(cliente.nome)&&[11,14].includes(doc.length)&&digits(cliente.cep).length===8&&Boolean(cliente.logradouro)&&Boolean(cliente.numero)&&Boolean(cliente.bairro)&&Boolean(cliente.cidade)&&Boolean(cliente.uf)&&mun.ok;
    add("cliente","Informações do Cliente",clienteOk,clienteOk?`${cliente.cidade}/${cliente.uf} · IBGE ${mun.ibge} identificado pelo ${mun.fonte==="CEP"?"CEP":"cadastro"}.`:`Revise documento/endereço do cliente. Município ${cliente.cidade||"não informado"}/${cliente.uf||""} não pôde ser identificado pelo CEP.`);
    const servOk=digits(serv.codigo).length===6&&(!serv.nbs||digits(serv.nbs).length===9)&&Boolean(String(serv.descricao||"").trim())&&Number(nota.valor_total)>0;
    add("servico","Dados da OS / Serviço",servOk,servOk?`Serviço ${serv.codigo} · NBS ${serv.nbs||"—"} · valor ${Number(nota.valor_total).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}.`:"Revise código do serviço, NBS, descrição ou valor.");
    const aliq=Number(trib.aliquotaSimplesNacional);const tribOk=aliq>0&&aliq<=100;
    add("tributacao","Dados da Prestação / Tributação",tribOk,tribOk?`Simples Nacional ${aliq.toFixed(2)}% · prestação em Montes Claros/MG.`:"Alíquota do Simples Nacional inválida.");
    const pagOk=Boolean(fin.vencimento)&&Number(nota.valor_total)>0;
    add("pagamento","Pagamento",pagOk,pagOk?`Vencimento ${fin.vencimento} · ${fin.formaPagamento||"forma não informada"}.`:"Informe vencimento e valor antes de emitir.");
    const erros=etapas.filter(x=>x.status==="ERRO");
    const prevalidacao={ambiente,transmitiu:false,municipioTomadorIbge:mun.ibge||null,etapas,validadoEm:new Date().toISOString(),valido:erros.length===0};
    await sb.from("notas_fiscais").update({nfse_dados:{...dados,prevalidacao},updated_at:new Date().toISOString()}).eq("id",nota.id);
    return json({valido:erros.length===0,ambiente,cliente,etapas,erros:erros.map(x=>x.detalhe),municipioTomador:mun.ok?{ibge:mun.ibge,cidade:mun.cidade,uf:mun.uf}:null,transmitiu:false,mensagem:erros.length?"A pré-validação encontrou ajustes necessários.":"Pré-validação concluída localmente. Nenhuma DPS/NFS-e foi transmitida."});
  }catch(e){return json({erro:e instanceof Error?e.message:String(e),ambiente,transmitiu:false},409)}
});