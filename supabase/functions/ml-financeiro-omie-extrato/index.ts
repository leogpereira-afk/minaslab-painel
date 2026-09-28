import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT = Deno.env.get("ML_JWT_SECRET") || "";
const OMIE_KEY = Deno.env.get("ML_OMIE_APP_KEY") || "";
const OMIE_SECRET = Deno.env.get("ML_OMIE_APP_SECRET") || "";
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder();
const dec = new TextDecoder();
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const resp = (body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const text = (v:any)=>String(v ?? "").trim();
const digits = (v:any)=>text(v).replace(/\D/g,"");
const now = ()=>new Date().toISOString();

function num(v:any){
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = text(v).replace(/R\$\s*/gi,"").replace(/\s/g,"");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g,"").replace(",",".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function valueOf(m:any){
  for (const k of ["nValorDocumento","nValor","nValorMovimento","nValorLancamento","nValPago","nValLiquido","nValorTitulo","valor","vValor"]) {
    if (m?.[k] !== undefined && m?.[k] !== null && text(m[k]) !== "") {
      const n = num(m[k]);
      if (n !== 0) return n;
    }
  }
  for (const [k,v] of Object.entries(m || {})) {
    if (/valor|^nval/i.test(k) && !/saldo|limite/i.test(k)) {
      const n = num(v);
      if (n !== 0) return n;
    }
  }
  return 0;
}

function movements(obj:any, depth=0):any[]{
  if (!obj || typeof obj !== "object" || depth > 4) return [];
  for (const k of ["listaMovimentos","movimentos","lista_movimentos","movimentosLista","movimentos_lista","listaLancamentos","lancamentos","lista_lancamentos"]) {
    if (Array.isArray(obj[k])) return obj[k];
  }
  for (const [k,v] of Object.entries(obj)) {
    if (Array.isArray(v) && /mov|lanc|extrato|item/i.test(k) && v.some((x:any)=>x && typeof x === "object")) return v as any[];
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const found = movements(v, depth + 1);
      if (found.length) return found;
    }
  }
  return [];
}

function b64u(s:string){
  s=s.replace(/-/g,"+").replace(/_/g,"/");
  while(s.length%4)s+="=";
  const b=atob(s),o=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);
  return o;
}

async function auth(req:Request){
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token || !JWT) return null;
  const p=token.split(".");
  if(p.length!==3) return null;
  try{
    const key=await crypto.subtle.importKey("raw",enc.encode(JWT),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    if(!await crypto.subtle.verify("HMAC",key,b64u(p[2]),enc.encode(`${p[0]}.${p[1]}`))) return null;
    const x=JSON.parse(dec.decode(b64u(p[1])));
    if(x.sis!=="minaslab" || text(x.papel)!=="direcao" || (x.exp && x.exp<Math.floor(Date.now()/1000))) return null;
    return x;
  }catch{return null;}
}

const toBR=(v:string)=>{const m=String(v||"").slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:"";};
const toISO=(v:any)=>{const s=text(v);const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:(/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):null);};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

async function omie(mod:string,call:string,param:any){
  if(!OMIE_KEY || !OMIE_SECRET) throw new Error("Integração Omie não configurada.");
  for(let i=0;i<3;i++){
    const r=await fetch(`https://app.omie.com.br/api/v1/${mod}/`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({call,app_key:OMIE_KEY,app_secret:OMIE_SECRET,param:[param]})});
    const body=await r.json().catch(()=>({}));
    const fault=text(body?.faultstring || body?.message || "");
    if(r.ok && !fault) return body;
    if(/não existem registros|nao existem registros/i.test(fault)) return {vazio:true};
    if(/REDUNDANT|Consumo redundante|rate limit|limite de consumo|Too many requests/i.test(fault) && i<2){await wait(3000);continue;}
    throw new Error(`Omie · ${call}: ${fault || r.status}`);
  }
  throw new Error(`Omie · ${call}: limite de tentativas excedido.`);
}

function accountList(r:any){return r.ListarContasCorrentes || r.conta_corrente_lista || r.contaCorrenteLista || [];}
const norm=(v:any)=>text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");

async function company(){
  const q=await sb.from("empresas").select("id,nome").eq("usa_omie",true).eq("ativa",true).maybeSingle();
  if(q.error) throw new Error(q.error.message);
  if(!q.data) throw new Error("MinasLab com Omie ativa não encontrada.");
  return q.data;
}

async function findAccount(empresaId:string,idOmie:string,nome:string,banco:string,agencia:string,conta:string){
  const q=await sb.from("contas_bancarias").select("id,nome,banco,agencia,conta,id_omie,ativa").eq("empresa_id",empresaId);
  if(q.error) throw new Error(q.error.message);
  const rows=[...(q.data||[])].sort((a:any,b:any)=>Number(!!b.ativa)-Number(!!a.ativa));
  return rows.find((x:any)=>text(x.id_omie)===idOmie)
    || rows.find((x:any)=>digits(conta) && digits(x.conta)===digits(conta) && digits(x.banco)===digits(banco) && (!agencia || !x.agencia || digits(x.agencia)===digits(agencia)))
    || rows.find((x:any)=>norm(x.nome)===norm(nome))
    || null;
}

function doc(m:any){return text(m?.cDocumentoFiscal||m?.cNumero||m?.cNumDocumento||m?.cDocumento||m?.numero_documento);}
function desc(m:any){return text(m?.cRazCliente||m?.cDesCliente||m?.cObservacoes||m?.cOrigem||m?.descricao);}

async function syncExtrato(de:string,ate:string){
  if(!de || !ate || de>ate) throw new Error("Período inválido para o extrato Omie.");
  const emp=await company();
  let page=1, contas:any[]=[];
  for(;;){
    const r=await omie("geral/contacorrente","ListarContasCorrentes",{pagina:page,registros_por_pagina:100,apenas_importado_api:"N"});
    if(r.vazio) break;
    contas.push(...accountList(r));
    if(page >= (num(r.total_de_paginas)||1)) break;
    page++;
  }

  let contasAtivas=0, recebidos=0, inseridos=0, atualizados=0, ignorados=0;
  const detalhes:any[]=[];
  for(const c of contas){
    const id=text(c.nCodCC||c.codigo);
    const fora=text(c.inativo).toUpperCase()==="S" || text(c.nao_fluxo).toUpperCase()==="S" || text(c.nao_resumo).toUpperCase()==="S" || text(c.tipo_conta_corrente||c.tipo).toUpperCase()==="CX";
    if(!id || fora){ignorados++;continue;}

    const ext=await omie("financas/extrato","ListarExtrato",{nCodCC:Number(id),dPeriodoInicial:toBR(de),dPeriodoFinal:toBR(ate),cExibirApenasSaldo:"N"});
    if(ext.vazio){detalhes.push({conta:id,movimentos:0,vazio:true});continue;}

    const nome=text(ext.cDescricao)||text(c.descricao)||`Conta Omie ${id}`;
    const banco=text(ext.nCodBanco)||text(c.codigo_banco)||"";
    const agencia=text(ext.nCodAgencia)||text(c.codigo_agencia)||"";
    const numeroConta=text(ext.nNumConta)||text(c.numero_conta_corrente)||"";
    let acc=await findAccount(emp.id,id,nome,banco,agencia,numeroConta);
    const saldoRaw=[ext.nSaldoDisponivel,ext.nSaldoAtual,ext.nSaldoConciliado].find(v=>v!==undefined&&v!==null&&v!=="");
    const patch:any={id_omie:id,ativa:true,updated_at:now(),dados_omie:{...c,extrato_saldo:{nSaldoAnterior:ext.nSaldoAnterior??null,nSaldoAtual:ext.nSaldoAtual??null,nSaldoDisponivel:ext.nSaldoDisponivel??null,nSaldoConciliado:ext.nSaldoConciliado??null,nSaldoProvisorio:ext.nSaldoProvisorio??null}}};
    if(saldoRaw!==undefined){patch.saldo_atual=num(saldoRaw);patch.saldo_atualizado_em=now();}
    let contaId:string;
    if(acc){
      const u=await sb.from("contas_bancarias").update(patch).eq("id",acc.id).select("id").single();
      if(u.error) throw new Error(u.error.message);
      contaId=u.data.id;
    }else{
      const i=await sb.from("contas_bancarias").insert({empresa_id:emp.id,nome,banco:banco||null,agencia:agencia||null,conta:numeroConta||null,saldo_inicial:0,...patch,created_at:now()}).select("id").single();
      if(i.error) throw new Error(i.error.message);
      contaId=i.data.id;
    }
    contasAtivas++;

    const ms=movements(ext);
    recebidos+=ms.length;
    let validos=0;
    for(const m of ms){
      const val=valueOf(m);
      const data=toISO(m?.dDataLancamento||m?.dData||m?.data);
      if(!data || Math.abs(val)<=0) continue;
      validos++;
      const nat=text(m?.cNatureza||m?.natureza).toUpperCase();
      const tipo=(nat==="S"||nat==="P"||nat==="D"||val<0)?"DEBITO":"CREDITO";
      const naturalId=text(m?.nCodLancamento||m?.codigo_lancamento||m?.nCodLanc);
      const idMov=naturalId || `${id}|${data}|${Math.abs(val).toFixed(2)}|${doc(m)}|${desc(m)}`;
      const payload={empresa_id:emp.id,conta_bancaria_id:contaId,data_movimento:data,descricao:desc(m)||null,tipo,valor:Math.abs(val),documento:doc(m)||null,origem:"OMIE",id_omie:idMov,dados_omie:m,updated_at:now()};
      const q=await sb.from("movimentos_bancarios").select("id").eq("empresa_id",emp.id).eq("origem","OMIE").eq("id_omie",idMov).maybeSingle();
      if(q.error) throw new Error(q.error.message);
      if(q.data){
        const u=await sb.from("movimentos_bancarios").update(payload).eq("id",q.data.id);
        if(u.error) throw new Error(u.error.message);
        atualizados++;
      }else{
        const i=await sb.from("movimentos_bancarios").insert({...payload,conciliado:false,created_at:now()});
        if(i.error) throw new Error(i.error.message);
        inseridos++;
      }
    }
    detalhes.push({conta:nome,idOmie:id,movimentosRecebidos:ms.length,movimentosValidos:validos,chavesResposta:Object.keys(ext).slice(0,25)});
  }
  return {ok:true,contas:contasAtivas,contasIgnoradas:ignorados,movimentosRecebidos:recebidos,movimentosInseridos:inseridos,movimentosAtualizados:atualizados,detalhes};
}

Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(!await auth(req)) return resp({erro:"Sessão inválida ou sem permissão."},401);
  try{
    const b=await req.json();
    if(text(b.action)!=="extrato") return resp({erro:"Ação inválida."},400);
    return resp(await syncExtrato(text(b.de),text(b.ate)));
  }catch(e){
    console.error(e);
    return resp({erro:e instanceof Error?e.message:String(e)},500);
  }
});