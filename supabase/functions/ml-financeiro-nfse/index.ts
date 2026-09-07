import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const digits=(v:any)=>String(v||"").replace(/\D/g,"");
const hoje=()=>new Date().toISOString().slice(0,10);
async function auth(req:Request){const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!t)return null;const p=t.split(".");if(p.length!==3)return null;try{const s=p[1].replace(/-/g,"+").replace(/_/g,"/");const x=JSON.parse(atob(s+"=".repeat((4-s.length%4)%4)));if(x.exp&&x.exp*1000<Date.now())return null;return x}catch{return null}}

function validarFiscal(r:any,cliente:any){
  const erros:string[]=[];
  if(!cliente)erros.push("Selecione ou cadastre o cliente.");
  if(cliente&&!digits(cliente.cnpj_cpf))erros.push("CPF/CNPJ do cliente é obrigatório para emissão.");
  if(cliente&&!cliente.nome)erros.push("Razão social/nome do cliente é obrigatório.");
  if(!String(r.servico_descricao||"").trim())erros.push("Descrição do serviço é obrigatória.");
  if(!String(r.codigo_servico||"").trim())erros.push("Código nacional do serviço é obrigatório.");
  if(!(Number(r.valor_total)>0))erros.push("Valor da nota deve ser maior que zero.");
  if(!r.data_vencimento)erros.push("Vencimento do recebimento é obrigatório.");
  const aliqSn=Number(r.aliquota_simples_nacional??2.01);if(!(aliqSn>0&&aliqSn<=100))erros.push("Alíquota do Simples Nacional inválida.");
  return erros;
}

async function verificarA1(){
  const b64=String(Deno.env.get("MLAB_NFSE_CERT_PFX_B64")||"").replace(/\s/g,"");
  const senha=String(Deno.env.get("MLAB_NFSE_CERT_PASSWORD")||"");
  if(!b64||!senha)return {valido:false,erro:"Certificado A1 e/ou senha não configurados."};
  try{
    const bin=atob(b64);
    const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const asn1=forge.asn1.fromDer(forge.util.createBuffer(bin,"raw"));
    const p12=forge.pkcs12.pkcs12FromAsn1(asn1,false,senha);
    const certBags=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[];
    const cert=certBags.find((x:any)=>x.cert)?.cert;
    if(!cert)return {valido:false,erro:"O arquivo PFX foi aberto, mas nenhum certificado foi encontrado."};
    const attrs=cert.subject?.attributes||[];
    const attr=(nome:string)=>attrs.find((a:any)=>a.shortName===nome||a.name===nome)?.value||null;
    const agora=new Date();
    const notBefore=new Date(cert.validity.notBefore);const notAfter=new Date(cert.validity.notAfter);
    const hash=await crypto.subtle.digest("SHA-256",bytes);
    const fingerprint=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
    return {valido:agora>=notBefore&&agora<=notAfter,senhaValida:true,certificadoLegivel:true,titular:attr("CN")||attr("commonName"),organizacao:attr("O")||attr("organizationName"),numeroSerie:cert.serialNumber||null,validoDe:notBefore.toISOString(),validoAte:notAfter.toISOString(),expirado:agora>notAfter,aindaNaoValido:agora<notBefore,fingerprintSha256:fingerprint};
  }catch(e){return {valido:false,senhaValida:false,certificadoLegivel:false,erro:"Não foi possível abrir o PFX com a senha configurada. Verifique se o arquivo A1 e a senha correspondem.",detalhe:e instanceof Error?e.message:String(e)};}
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  const usuario=await auth(req);if(!usuario)return json({erro:"Sessão inválida."},401);
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let b:any={};try{b=await req.json()}catch{return json({erro:"JSON inválido."},400)}
  const ambiente=(Deno.env.get("MLAB_NFSE_AMBIENTE")||"HOMOLOGACAO").toUpperCase();
  const requisitos={
    certificado:Boolean(Deno.env.get("MLAB_NFSE_CERT_PFX_B64")),
    senha:Boolean(Deno.env.get("MLAB_NFSE_CERT_PASSWORD")),
    inscricaoMunicipal:Boolean(Deno.env.get("MLAB_NFSE_INSCRICAO_MUNICIPAL")),
    municipio:Boolean(Deno.env.get("MLAB_NFSE_MUNICIPIO_IBGE")),
    regime:Boolean(Deno.env.get("MLAB_NFSE_REGIME_TRIBUTARIO"))
  };
  const configurado=Object.values(requisitos).every(Boolean);
  const transmissaoAtiva=Deno.env.get("MLAB_NFSE_TRANSMISSAO_ATIVA")==="SIM";
  try{
    const {data:mlab,error:empresaErro}=await sb.from("empresas").select("id,nome,cnpj,usa_omie").eq("usa_omie",false).eq("ativa",true).limit(1).maybeSingle();
    if(empresaErro)throw empresaErro;
    if(!mlab)return json({erro:"Empresa M Lab não encontrada ou inativa."},409);

    if(b.action==="estado")return json({ambiente,configurado,requisitos,transmissaoAtiva,producaoLiberada:Deno.env.get("MLAB_NFSE_PRODUCAO_LIBERADA")==="SIM",empresa:{id:mlab.id,nome:mlab.nome,cnpj:mlab.cnpj},modo:"SEGURO_RASCUNHO"});

    if(b.action==="verificarCertificado"){
      const certificado=await verificarA1();
      return json({ambiente,configurado,requisitos,empresa:{id:mlab.id,nome:mlab.nome,cnpj:mlab.cnpj},certificado,transmissaoAtiva,producaoLiberada:Deno.env.get("MLAB_NFSE_PRODUCAO_LIBERADA")==="SIM"},certificado.valido?200:409);
    }

    if(b.action==="listar"){
      const {data,error}=await sb.from("notas_fiscais").select("*,cliente:clientes_financeiro(*)").eq("empresa_id",mlab.id).eq("origem","NFSE_NACIONAL").eq("apagado",false).order("created_at",{ascending:false}).limit(300);
      if(error)throw error;return json({itens:data||[]});
    }

    async function resolverCliente(reg:any){
      if(reg.cliente_id){const {data,error}=await sb.from("clientes_financeiro").select("*").eq("id",reg.cliente_id).maybeSingle();if(error)throw error;if(data){if(!data.usa_mlab)await sb.from("clientes_financeiro").update({usa_mlab:true,updated_at:new Date().toISOString()}).eq("id",data.id);return {...data,usa_mlab:true};}}
      const novo=reg.cliente||{};const doc=digits(novo.cnpj_cpf);if(!String(novo.nome||"").trim()||!doc)return null;
      const {data:todos,error:e1}=await sb.from("clientes_financeiro").select("*").not("cnpj_cpf","is",null).limit(5000);if(e1)throw e1;
      let existente=(todos||[]).find((x:any)=>digits(x.cnpj_cpf)===doc)||null;
      if(existente){const patch={usa_mlab:true,email:novo.email||existente.email,telefone:novo.telefone||existente.telefone,cep:novo.cep||existente.cep,logradouro:novo.logradouro||existente.logradouro,numero:novo.numero||existente.numero,complemento:novo.complemento||existente.complemento,bairro:novo.bairro||existente.bairro,cidade:novo.cidade||existente.cidade,uf:novo.uf||existente.uf,updated_at:new Date().toISOString()};const {data,error}=await sb.from("clientes_financeiro").update(patch).eq("id",existente.id).select().single();if(error)throw error;return data;}
      const payload={nome:String(novo.nome).trim(),nome_fantasia:novo.nome_fantasia||null,cnpj_cpf:novo.cnpj_cpf,email:novo.email||null,telefone:novo.telefone||null,inscricao_estadual:novo.inscricao_estadual||null,inscricao_municipal:novo.inscricao_municipal||null,cep:novo.cep||null,logradouro:novo.logradouro||null,numero:novo.numero||null,complemento:novo.complemento||null,bairro:novo.bairro||null,cidade:novo.cidade||null,uf:novo.uf||null,origem:"M_LAB",usa_minaslab:false,usa_mlab:true,ativo:true};const {data,error}=await sb.from("clientes_financeiro").insert(payload).select().single();if(error)throw error;return data;
    }

    if(b.action==="preparar"||b.action==="rascunhoSalvar"){
      const reg=b.registro||{};const cliente=await resolverCliente(reg);const erros=validarFiscal(reg,cliente);if(erros.length)return json({valido:false,erros},400);
      const dados={versaoLayout:"v1.01-20260727",servico:{codigo:String(reg.codigo_servico||"").trim(),nbs:String(reg.nbs||"").trim()||null,descricao:String(reg.servico_descricao||"").trim()},tributacao:{aliquotaIss:reg.aliquota_iss===""||reg.aliquota_iss==null?null:Number(reg.aliquota_iss),aliquotaSimplesNacional:Number(reg.aliquota_simples_nacional??2.01),issRetido:Boolean(reg.iss_retido),regimeEspecial:reg.regime_especial||null,ibsCbs:reg.ibs_cbs||null},financeiro:{vencimento:reg.data_vencimento,formaPagamento:reg.forma_pagamento||null},observacao:reg.observacao||null,preparadoEm:new Date().toISOString()};
      if(b.action==="preparar")return json({valido:true,ambiente,empresa:mlab,cliente,dados,alertas:configurado?[]:["Credenciais do certificado/dados fiscais ainda não estão completas no Supabase."]});
      const payload:any={empresa_id:mlab.id,tipo:"SAIDA",cliente_id:cliente.id,cnpj_emitente:mlab.cnpj,nome_emitente:mlab.nome,cnpj_destinatario:cliente.cnpj_cpf,nome_destinatario:cliente.nome,email_destino:cliente.email||null,data_emissao:reg.data_emissao||hoje(),data_vencimento:reg.data_vencimento,valor_total:Number(reg.valor_total),origem:"NFSE_NACIONAL",status_fiscal:"RASCUNHO",nfse_ambiente:ambiente,nfse_dados:dados,observacao:reg.observacao||null,updated_at:new Date().toISOString()};
      let res:any;
      if(reg.id){res=await sb.from("notas_fiscais").update(payload).eq("id",reg.id).eq("empresa_id",mlab.id).eq("origem","NFSE_NACIONAL").select().single();}
      else{res=await sb.from("notas_fiscais").insert(payload).select().single();}
      if(res.error)throw res.error;return json({item:res.data,cliente,ambiente});
    }

    if(b.action==="emitir"){
      const id=String(b.id||"");if(!id)return json({erro:"Informe o rascunho da NFS-e."},400);
      const {data:nota,error}=await sb.from("notas_fiscais").select("*,cliente:clientes_financeiro(*)").eq("id",id).eq("empresa_id",mlab.id).eq("origem","NFSE_NACIONAL").eq("apagado",false).maybeSingle();if(error)throw error;if(!nota)return json({erro:"Rascunho NFS-e não encontrado."},404);
      if(nota.status_fiscal&&nota.status_fiscal!=="RASCUNHO"&&nota.status_fiscal!=="REJEITADA")return json({erro:`A nota está em ${nota.status_fiscal} e não pode ser retransmitida como rascunho.`},409);
      if(!configurado)return json({erro:"A emissão fiscal está pronta no sistema, mas faltam configurar certificado A1 e/ou dados fiscais nos Secrets do Supabase.",requisitos},409);
      if(ambiente==="PRODUCAO"&&Deno.env.get("MLAB_NFSE_PRODUCAO_LIBERADA")!=="SIM")return json({erro:"Produção bloqueada. Faça e aprove primeiro a homologação."},409);
      if(!transmissaoAtiva)return json({erro:"Certificado/dados fiscais podem estar configurados, mas a transmissão permanece bloqueada até o teste de homologação da DPS assinada.",ambiente},409);
      return json({erro:"Bloqueio técnico de segurança: a transmissão direta ao Emissor Nacional só será liberada após validar o XML DPS assinado com o A1 da M Lab. Nenhuma NFS-e foi emitida por esta função."},409);
    }

    return json({erro:"Ação inválida."},400);
  }catch(e){return json({erro:e instanceof Error?e.message:String(e)},500)}
});
