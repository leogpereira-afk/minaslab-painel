import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("ML_TOKEN") ?? "";
const JWT_SECRET = Deno.env.get("ML_JWT_SECRET") ?? "";
const CERT_B64 = Deno.env.get("MLAB_NFSE_CERT_PFX_B64") ?? "";
const CERT_PASSWORD = Deno.env.get("MLAB_NFSE_CERT_PASSWORD") ?? "";
const AMBIENTE = (Deno.env.get("MLAB_NFSE_AMBIENTE") ?? "HOMOLOGACAO").toUpperCase();
const INSCRICAO_MUNICIPAL = Deno.env.get("MLAB_NFSE_INSCRICAO_MUNICIPAL") ?? "";
const MUNICIPIO_IBGE = Deno.env.get("MLAB_NFSE_MUNICIPIO_IBGE") ?? "";
const REGIME_TRIBUTARIO = Deno.env.get("MLAB_NFSE_REGIME_TRIBUTARIO") ?? "";
const SIS = "minaslab";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
const enc = new TextEncoder();
const dec = new TextDecoder();
const CORS = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-token",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const resp = (data:unknown,status=200) => new Response(JSON.stringify(data), { status, headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"} });

function bytesFromB64url(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
async function verificarJwt(token:string):Promise<Record<string,unknown>|null>{
  if(!JWT_SECRET||!token)return null;const p=token.split(".");if(p.length!==3)return null;
  try{const key=await crypto.subtle.importKey("raw",enc.encode(JWT_SECRET),{name:"HMAC",hash:"SHA-256"},false,["verify"]);if(!await crypto.subtle.verify("HMAC",key,bytesFromB64url(p[2]),enc.encode(`${p[0]}.${p[1]}`)))return null;const payload=JSON.parse(dec.decode(bytesFromB64url(p[1])));if(payload.sis!==SIS)return null;if(typeof payload.exp==="number"&&payload.exp<Math.floor(Date.now()/1000))return null;return payload;}catch{return null;}
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return resp({erro:"Use POST."},405);
  let body:Record<string,unknown>;try{body=await req.json();}catch{return resp({erro:"JSON inválido."},400);}
  const m=String(req.headers.get("authorization")??"").match(/^Bearer\s+(.+)$/i);
  const cracha=m?await verificarJwt(m[1]):null;
  const maquina=!!TOKEN&&req.headers.get("x-token")===TOKEN;
  if(!cracha&&!maquina)return resp({erro:"Entre no sistema.",semSessao:true},401);
  if(!maquina&&String(cracha?.papel??"")!=="direcao")return resp({erro:"O financeiro é somente da direção.",semPermissao:true},403);

  const action=String(body.action??"").trim();
  if(action!=="estado")return resp({erro:`Ação desconhecida: ${action}`},400);

  const { data:empresa, error } = await sb.from("empresas").select("id,nome,cnpj,usa_omie,ativa").eq("nome","M Lab").eq("ativa",true).maybeSingle();
  if(error)return resp({erro:error.message},500);
  const configuracao = {
    certificadoA1: !!CERT_B64,
    senhaCertificado: !!CERT_PASSWORD,
    inscricaoMunicipal: !!INSCRICAO_MUNICIPAL,
    municipioIbge: !!MUNICIPIO_IBGE,
    regimeTributario: !!REGIME_TRIBUTARIO,
  };
  const pronto = !!empresa && Object.values(configuracao).every(Boolean);
  return resp({
    ok:true,
    empresa: empresa ? { id:empresa.id,nome:empresa.nome,cnpj:empresa.cnpj } : null,
    ambiente: AMBIENTE === "PRODUCAO" ? "PRODUCAO" : "HOMOLOGACAO",
    configuracao,
    pronto,
    emissaoHabilitada:false,
    mensagem: pronto
      ? "Credenciais básicas presentes. A emissão permanece bloqueada até a homologação da DPS/NFS-e."
      : "Configure os dados fiscais e o certificado A1 nos Secrets do Supabase. Nenhum certificado é armazenado no frontend ou no banco.",
  });
});
