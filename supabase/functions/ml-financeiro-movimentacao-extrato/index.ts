import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const U=Deno.env.get("SUPABASE_URL")!;
const K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const J=Deno.env.get("ML_JWT_SECRET")||"";
const sb=createClient(U,K,{auth:{persistSession:false,autoRefreshToken:false}});
const enc=new TextEncoder(),dec=new TextDecoder();
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const txt=(v:any)=>String(v??"").trim();
const num=(v:any)=>Number(v||0);
function b64u(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
async function auth(req:Request){const t=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!t||!J)return null;const p=t.split(".");if(p.length!==3)return null;try{const k=await crypto.subtle.importKey("raw",enc.encode(J),{name:"HMAC",hash:"SHA-256"},false,["verify"]);if(!await crypto.subtle.verify("HMAC",k,b64u(p[2]),enc.encode(`${p[0]}.${p[1]}`)))return null;const x=JSON.parse(dec.decode(b64u(p[1])));if(x.sis!=="minaslab"||(x.exp&&x.exp<Math.floor(Date.now()/1000))||txt(x.papel)!=="direcao")return null;return x}catch{return null}}
function buscaLike(v:string){return v.replace(/[%_]/g,m=>`\\${m}`)}
function periodo(b:any){let de=txt(b.de),ate=txt(b.ate);const ano=Number(b.ano),mes=Number(b.mes);if(!de&&!ate&&ano&&mes>=1&&mes<=12){const mm=String(mes).padStart(2,"0"),ultimo=new Date(ano,mes,0).getDate();de=`${ano}-${mm}-01`;ate=`${ano}-${mm}-${String(ultimo).padStart(2,"0")}`}return{de,ate}}
function aplicaFiltros(q:any,b:any){const empresa=txt(b.empresaId),conta=txt(b.contaId),status=txt(b.status).toUpperCase(),tipo=txt(b.tipoMovimento).toUpperCase(),busca=txt(b.busca),{de,ate}=periodo(b);if(empresa)q=q.eq("empresa_id",empresa);if(conta)q=q.eq("conta_bancaria_id",conta);if(status==="CONCILIADO")q=q.eq("conciliado",true);else if(status==="PENDENTE")q=q.eq("conciliado",false);if(tipo==="CREDITO"||tipo==="DEBITO")q=q.eq("tipo",tipo);if(de)q=q.gte("data_movimento",de);if(ate)q=q.lte("data_movimento",ate);if(busca){const s=buscaLike(busca);q=q.or(`descricao.ilike.%${s}%,documento.ilike.%${s}%,fitid.ilike.%${s}%`)}return q}
function categoriaMov(m:any){const cats=(m.conciliacoes||[]).flatMap((c:any)=>[c?.recebimento?.categoria?.nome,c?.despesa?.categoria?.nome]).filter(Boolean);if(cats.length)return [...new Set(cats)].join(" / ");const om=txt(m?.dados_omie?.cDesCategoria||m?.dados_omie?.cCodCategoria);return om||"—"}

async function carregarHistoricoCompleto(contaIds:string[]){
  const todos:any[]=[];
  const lote=1000;
  let inicio=0;
  while(true){
    const fim=inicio+lote-1;
    const r=await sb.from("movimentos_bancarios")
      .select("id,conta_bancaria_id,data_movimento,created_at,tipo,valor")
      .in("conta_bancaria_id",contaIds)
      .order("data_movimento",{ascending:true})
      .order("created_at",{ascending:true})
      .range(inicio,fim);
    if(r.error)throw new Error(r.error.message);
    const dados=r.data||[];
    todos.push(...dados);
    if(dados.length<lote)break;
    inicio+=lote;
    if(inicio>50000)throw new Error("Histórico bancário acima do limite de segurança.");
  }
  return todos;
}

Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});const cracha=await auth(req);if(!cracha)return json({erro:"Sessão inválida ou sem permissão."},401);try{const b=await req.json();const pagina=Math.max(1,Number(b.pagina)||1),limite=Math.min(100,Math.max(8,Number(b.limite)||8)),ini=(pagina-1)*limite,fim=ini+limite-1,{de,ate}=periodo(b);
let q=sb.from("movimentos_bancarios").select("*,empresa:empresas(id,nome),conta:contas_bancarias(id,nome,banco,agencia,conta,saldo_inicial,saldo_atual),conciliacoes(*,recebimento:recebimentos(id,categoria:categorias_financeiras(id,nome)),despesa:despesas(id,categoria:categorias_financeiras(id,nome)))",{count:"exact"});q=aplicaFiltros(q,b).order("data_movimento",{ascending:false}).order("created_at",{ascending:false}).range(ini,fim);const r=await q;if(r.error)throw new Error(r.error.message);
/* O RESUMO LÊ TODAS AS PÁGINAS (auditoria de 28/09/2026). Antes era uma consulta só, e o
   Supabase corta em 1.000 linhas sem avisar: com 7.046 lançamentos no banco, qualquer período
   largo fazia Entradas, Saídas, Resultado e os contadores somarem só os primeiros mil.
   A ordem por id deixa as páginas estáveis — sem ela, uma linha pode cair em duas páginas. */
const linhasResumo:any[]=[];for(let de=0;;de+=1000){let qr=sb.from("movimentos_bancarios").select("id,tipo,valor,conciliado");qr=aplicaFiltros(qr,{...b,busca:"",status:"",tipoMovimento:""}).order("id",{ascending:true}).range(de,de+999);const pg=await qr;if(pg.error)throw new Error(pg.error.message);const lote=pg.data||[];linhasResumo.push(...lote);if(lote.length<1000)break;}const rr={data:linhasResumo};const resumo=(rr.data||[]).reduce((s:any,x:any)=>{const v=Math.abs(num(x.valor));if(String(x.tipo).toUpperCase()==="CREDITO")s.entradas+=v;else s.saidas+=v;if(x.conciliado)s.conciliados++;else s.pendentes++;return s},{entradas:0,saidas:0,conciliados:0,pendentes:0});
let qc=sb.from("contas_bancarias").select("id,empresa_id,nome,banco,agencia,conta,saldo_inicial,saldo_atual").eq("ativa",true);if(txt(b.empresaId))qc=qc.eq("empresa_id",txt(b.empresaId));if(txt(b.contaId))qc=qc.eq("id",txt(b.contaId));const cr=await qc;if(cr.error)throw new Error(cr.error.message);const contas=cr.data||[];const ids=contas.map((x:any)=>x.id);const saldoMap=new Map<string,number>();if(ids.length){const historico=await carregarHistoricoCompleto(ids);const por=new Map<string,any[]>();for(const x of historico){const a=por.get(x.conta_bancaria_id)||[];a.push(x);por.set(x.conta_bancaria_id,a)}for(const c of contas){const movs=por.get(c.id)||[];let cur=num(c.saldo_inicial);const bruto=new Map<string,number>();for(const m of movs){cur+=(String(m.tipo).toUpperCase()==="CREDITO"?1:-1)*Math.abs(num(m.valor));bruto.set(m.id,cur)}const offset=c.saldo_atual===null||c.saldo_atual===undefined?0:num(c.saldo_atual)-cur;for(const [id,v] of bruto)saldoMap.set(id,v+offset)}}
const saldoAtual=contas.length&&contas.every((c:any)=>c.saldo_atual!==null&&c.saldo_atual!==undefined)?contas.reduce((s:number,c:any)=>s+num(c.saldo_atual),0):null;const itens=(r.data||[]).map((m:any)=>({...m,categoria_nome:categoriaMov(m),saldo_movimento:saldoMap.has(m.id)?saldoMap.get(m.id):null}));return json({itens,pagina,limite,total:Number(r.count||0),paginas:Math.max(1,Math.ceil(Number(r.count||0)/limite)),de,ate,resumo,saldoAtual,contas});}catch(e){return json({erro:e instanceof Error?e.message:String(e)},500)}});
