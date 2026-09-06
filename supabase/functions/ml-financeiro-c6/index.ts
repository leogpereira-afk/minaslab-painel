import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("ML_TOKEN") ?? "";
const JWT_SECRET = Deno.env.get("ML_JWT_SECRET") ?? "";
const SIS = "minaslab";
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession:false, autoRefreshToken:false } });
const enc = new TextEncoder();
const dec = new TextDecoder();
const CORS = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-token",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const resp = (data:unknown, status=200) => new Response(JSON.stringify(data), { status, headers:{ ...CORS, "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" } });
const texto = (v:unknown) => String(v ?? "").trim();
const agora = () => new Date().toISOString();
const hoje = () => agora().slice(0,10);
const soDigitos = (v:unknown) => texto(v).replace(/\D/g, "");

function bytesFromB64url(s:string) {
  s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4)s+="=";
  const bin=atob(s), out=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i); return out;
}
async function verificarJwt(token:string):Promise<Record<string,unknown>|null> {
  if(!JWT_SECRET||!token)return null; const p=token.split("."); if(p.length!==3)return null;
  try {
    const key=await crypto.subtle.importKey("raw",enc.encode(JWT_SECRET),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    if(!await crypto.subtle.verify("HMAC",key,bytesFromB64url(p[2]),enc.encode(`${p[0]}.${p[1]}`)))return null;
    const payload=JSON.parse(dec.decode(bytesFromB64url(p[1])));
    if(payload.sis!==SIS)return null;
    if(typeof payload.exp==="number"&&payload.exp<Math.floor(Date.now()/1000))return null;
    return payload;
  } catch { return null; }
}

function parseCSV(text:string) {
  const linhas:string[][]=[]; let linha:string[]=[]; let campo=""; let aspas=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(aspas && text[i+1]==='"'){campo+='"';i++;} else aspas=!aspas;
    } else if(c===';'&&!aspas){linha.push(campo);campo="";}
    else if((c==='\n'||c==='\r')&&!aspas){
      if(c==='\r'&&text[i+1]==='\n')i++;
      linha.push(campo); campo="";
      if(linha.some(x=>x.trim()!==""))linhas.push(linha);
      linha=[];
    } else campo+=c;
  }
  if(campo!==""||linha.length){linha.push(campo);if(linha.some(x=>x.trim()!==""))linhas.push(linha);}
  if(!linhas.length)return [];
  const cab=linhas[0].map(x=>normalCab(x));
  return linhas.slice(1).map(cols=>Object.fromEntries(cab.map((h,i)=>[h, cols[i] ?? ""])));
}
function normalCab(v:unknown){return texto(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function brISO(v:unknown){const s=texto(v);if(!s||/^n\/?a$/i.test(s))return null;const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:(/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):null);}
function numeroBR(v:unknown){let s=texto(v).replace(/R\$/gi,"").replace(/\s/g,"");if(!s)return 0;if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");const x=Number(s);return Number.isFinite(x)?x:0;}
function statusC6(v:unknown){const s=normalCab(v).toUpperCase();if(s.includes("CANCEL"))return "CANCELADO";if(s.includes("PAGO")||s.includes("LIQUID"))return "PAGO";if(s.includes("VENCIDO")||s.includes("ATRAS"))return "VENCIDO";return "A VENCER";}
function statusFinanceiro(venc:string|null, c6:string){if(c6==="CANCELADO")return "CANCELADO";return venc&&venc<hoje()?"VENCIDO":"A RECEBER";}

function mapear(row:Record<string,string>){
  const get=(...ks:string[])=>{for(const k of ks){const v=row[normalCab(k)];if(texto(v)!=="")return v;}return "";};
  return {
    cliente:texto(get("Quem pagara o boleto")),
    cnpj_cpf:soDigitos(get("CPF/CNPJ")),
    codigo_barras:soDigitos(get("Codigo de barras")),
    status_c6:statusC6(get("Status")),
    valor_emissao:numeroBR(get("Valor da Emissao")),
    valor_atualizado:numeroBR(get("Valor da cobranca atualizado")),
    valor_liquidacao:numeroBR(get("Valor de Liquidacao")),
    data_credito:brISO(get("Data de credito")),
    data_emissao:brISO(get("Data de emissao")),
    data_vencimento:brISO(get("Data de vencimento")),
    data_pagamento_boleto:brISO(get("Data de pagamento/cancelamento")),
    dias_atraso:Math.max(0, Math.trunc(numeroBR(get("Dias em atraso")))),
    nosso_numero:texto(get("Nosso numero"))||null,
    carteira:texto(get("Nome da carteira", "Carteira"))||null,
    numero_nf:texto(get("Numero do documento")),
  };
}

async function carregarEmpresa(empresaId:string){
  const {data,error}=await sb.from("empresas").select("id,nome,usa_omie,ativa").eq("id",empresaId).maybeSingle();
  if(error)throw error;if(!data||!data.ativa)throw new Error("Empresa não encontrada ou inativa.");
  if(data.usa_omie)throw new Error("A importação de boletos C6 é destinada à empresa manual (M Lab). Para MinasLab, os títulos devem vir da Omie.");
  return data;
}
async function carregarExistentes(empresaId:string){
  const {data,error}=await sb.from("recebimentos")
    .select("id,empresa_id,cliente,cnpj_cpf,numero_nf,valor_previsto,valor_recebido,valor_pendente,data_vencimento,status,origem,importacao_origem,c6_codigo_barras,apagado,baixas:baixas_recebimentos(id,valor,estornada)")
    .eq("empresa_id",empresaId).eq("apagado",false).limit(5000);
  if(error)throw error; return data??[];
}
function indices(existentes:any[]){
  const porBarra=new Map<string,any>(); const porNfDoc=new Map<string,any[]>();
  for(const x of existentes){const b=soDigitos(x.c6_codigo_barras);if(b)porBarra.set(b,x);const nf=texto(x.numero_nf);const d=soDigitos(x.cnpj_cpf);if(nf&&d){const k=`${nf}|${d}`;porNfDoc.set(k,[...(porNfDoc.get(k)||[]),x]);}}
  return {porBarra,porNfDoc};
}
function localizar(item:any, idx:any){
  if(item.codigo_barras&&idx.porBarra.has(item.codigo_barras))return {item:idx.porBarra.get(item.codigo_barras),tipo:"CODIGO_BARRAS"};
  if(item.numero_nf&&item.cnpj_cpf){const arr=idx.porNfDoc.get(`${item.numero_nf}|${item.cnpj_cpf}`)||[];if(arr.length===1)return {item:arr[0],tipo:"NF_CNPJ"};if(arr.length>1)return {conflito:true,motivo:"Mais de um recebimento encontrado para a mesma NF + CPF/CNPJ."};}
  return {item:null,tipo:"NOVO"};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return resp({erro:"Use POST."},405);
  let body:any;try{body=await req.json();}catch{return resp({erro:"JSON inválido."},400);}
  const m=texto(req.headers.get("authorization")).match(/^Bearer\s+(.+)$/i);const cracha=m?await verificarJwt(m[1]):null;const maquina=!!TOKEN&&req.headers.get("x-token")===TOKEN;
  if(!cracha&&!maquina)return resp({erro:"Entre no sistema.",semSessao:true},401);
  if(!maquina&&texto(cracha?.papel)!=="direcao")return resp({erro:"O financeiro é somente da direção.",semPermissao:true},403);
  const usuario=maquina?"maquina":texto(cracha?.sub)||"direcao";
  try{
    const action=texto(body.action); const empresaId=texto(body.empresaId); const csvText=String(body.csvText??"");
    if(!empresaId)return resp({erro:"Selecione a empresa."},400);
    if(!csvText.trim())return resp({erro:"Envie o conteúdo CSV do relatório C6."},400);
    const empresa=await carregarEmpresa(empresaId);
    const rows=parseCSV(csvText);if(!rows.length)return resp({erro:"O CSV não possui registros."},400);
    const obrig=["quem pagara o boleto","codigo de barras","status","cpf cnpj","valor da emissao","data de vencimento","numero do documento"];
    const cab=Object.keys(rows[0]||{});const faltam=obrig.filter(x=>!cab.includes(x));if(faltam.length)return resp({erro:`Arquivo não corresponde ao relatório de boletos C6. Colunas ausentes: ${faltam.join(", ")}.`},400);
    const itens=rows.map(mapear).filter(x=>x.cliente||x.codigo_barras||x.numero_nf);
    const existentes=await carregarExistentes(empresaId);const idx=indices(existentes);
    const contagem:Record<string,number>={};let novos=0,atualizaveis=0,conflitos=0;
    const amostra:any[]=[];
    for(const x of itens){contagem[x.status_c6]=(contagem[x.status_c6]||0)+1;const loc=localizar(x,idx);if(loc.conflito)conflitos++;else if(loc.item)atualizaveis++;else novos++;if(amostra.length<8)amostra.push({cliente:x.cliente,nf:x.numero_nf,valor:x.valor_emissao,vencimento:x.data_vencimento,statusC6:x.status_c6,acao:loc.conflito?"REVISAR":loc.item?"ATUALIZAR":"CRIAR"});}
    if(action==="preview")return resp({ok:true,empresa,itens:itens.length,status:contagem,novos,atualizaveis,conflitos,amostra});
    if(action!=="importar")return resp({erro:"Ação inválida."},400);

    let inseridos=0,atualizados=0,ignorados=0;const erros:any[]=[];
    for(const x of itens){
      try{
        if(!x.codigo_barras)throw new Error("Boleto sem código de barras.");
        if(!x.numero_nf)throw new Error("Boleto sem Número do documento/NF.");
        if(!x.cliente)throw new Error("Boleto sem pagador.");
        if(!(x.valor_emissao>0))throw new Error("Boleto sem valor de emissão válido.");
        const loc=localizar(x,idx);if(loc.conflito){ignorados++;erros.push({nf:x.numero_nf,cliente:x.cliente,erro:loc.motivo});continue;}
        const c6Base={
          c6_codigo_barras:x.codigo_barras,c6_status:x.status_c6,c6_data_emissao:x.data_emissao,c6_data_credito:x.data_credito,c6_data_pagamento_boleto:x.data_pagamento_boleto,
          c6_valor_atualizado:x.valor_atualizado,c6_valor_liquidacao:x.valor_liquidacao,c6_dias_atraso:x.dias_atraso,c6_nosso_numero:x.nosso_numero,c6_carteira:x.carteira,c6_ultima_importacao:agora(),
          updated_by:usuario,updated_at:agora(),
        };
        if(loc.item){
          const atual=loc.item;if(texto(atual.origem).toUpperCase()==="OMIE"){ignorados++;erros.push({nf:x.numero_nf,cliente:x.cliente,erro:"Título Omie não pode ser alterado pelo C6."});continue;}
          const baixasAtivas=(atual.baixas||[]).filter((b:any)=>!b.estornada);
          const patch:any={...c6Base,forma_pagamento:"BOLETO C6"};
          if(!texto(atual.numero_nf))patch.numero_nf=x.numero_nf;
          if(!texto(atual.cnpj_cpf))patch.cnpj_cpf=x.cnpj_cpf||null;
          if(!texto(atual.cliente))patch.cliente=x.cliente;
          if(texto(atual.importacao_origem)==="C6_BOLETOS"){
            patch.valor_previsto=x.valor_emissao;patch.data_vencimento=x.data_vencimento;patch.valor_pendente=baixasAtivas.length?atual.valor_pendente:(x.status_c6==="CANCELADO"?0:x.valor_emissao);
          }
          if(!baixasAtivas.length && !["PAGO","PARCIAL"].includes(texto(atual.status).toUpperCase()))patch.status=statusFinanceiro(x.data_vencimento,x.status_c6);
          const {data,error}=await sb.from("recebimentos").update(patch).eq("id",atual.id).select("id").maybeSingle();if(error)throw error;if(!data)throw new Error("Atualização não confirmada.");
          atualizados++;
        } else {
          const finStatus=statusFinanceiro(x.data_vencimento,x.status_c6);const pendente=finStatus==="CANCELADO"?0:x.valor_emissao;
          const novo:any={empresa_id:empresaId,cliente:x.cliente,cnpj_cpf:x.cnpj_cpf||null,descricao:`Boleto C6 · NF ${x.numero_nf}`,valor_previsto:x.valor_emissao,valor_recebido:0,valor_pendente:pendente,data_vencimento:x.data_vencimento,data_pagamento:null,status:finStatus,numero_nf:x.numero_nf,forma_pagamento:"BOLETO C6",origem:"MANUAL",importacao_origem:"C6_BOLETOS",created_by:usuario,updated_by:usuario,...c6Base};
          const {data,error}=await sb.from("recebimentos").insert(novo).select("*").single();if(error)throw error;inseridos++;idx.porBarra.set(x.codigo_barras,data);const k=`${x.numero_nf}|${x.cnpj_cpf}`;idx.porNfDoc.set(k,[...(idx.porNfDoc.get(k)||[]),data]);
        }
      } catch(e){ignorados++;erros.push({nf:x.numero_nf,cliente:x.cliente,erro:e instanceof Error?e.message:String(e)});}
    }
    return resp({ok:true,empresa,itens:itens.length,inseridos,atualizados,ignorados,erros:erros.slice(0,30),aviso:"Status PAGO do C6 não gera baixa financeira. A baixa será confirmada pela conciliação do OFX."});
  } catch(e){return resp({erro:e instanceof Error?e.message:String(e)},500);}
});
