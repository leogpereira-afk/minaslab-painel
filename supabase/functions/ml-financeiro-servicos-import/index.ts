import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "npm:xlsx@0.18.5";

const U=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SB_SECRET_KEY")??Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,T=Deno.env.get("ML_TOKEN")??"",J=Deno.env.get("ML_JWT_SECRET")??"";
const sb=createClient(U,K,{auth:{persistSession:false,autoRefreshToken:false}}),enc=new TextEncoder(),dec=new TextDecoder();
const C={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-token","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}}),txt=(v:any)=>String(v??"").trim(),now=()=>new Date().toISOString();
const key=(v:any)=>txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,""),doc=(v:any)=>txt(v).replace(/\D/g,"");
const EXC_DOC=new Set(["52657257000114","20044692000187"]),EXC_FAT=new Set(["FA00002/2025","FA00003/2025","FA00006/2025","FA00004/2025"]);
const CABECALHOS=["Id","Status Fatura","Fatura","Forma pagamento","Cliente","CNPJ/CPF","Solicitante","Contrato","Amostra Referência","Ordem de Serviço","Status Ordem serviço","Data do Agendamento","Data de Recepção","Data de Vencimento","Data de Pagamento","Total","Obs"];

function modelo(){
  const wb=XLSX.utils.book_new();
  const instrucoes=[["MODELO DE IMPORTAÇÃO — SERVIÇOS GERADOS"],["MinasLab / M Lab — Módulo Financeiro"],[],["COMO USAR"],["1. Preencha os dados na aba Serviços, a partir da linha 2."],["2. As duas linhas EXEMPLO são ignoradas automaticamente; apague-as antes de importar se desejar."],["3. Não renomeie, não reordene e não exclua colunas. O cabeçalho deve permanecer na linha 1."],["4. Salve em .xlsx e importe em Financeiro > Serviços Gerados."],["5. Datas inválidas ou 30/11/-0001 são tratadas como sem data."]];
  const exemplos=[CABECALHOS,[1,"Em Aberto","EXEMPLO-001","Boleto bancário, 10 dias","Cliente Exemplo Ltda","00.000.000/0001-00","Sem solicitante","00000001/2026","AM00000001/2026","OS00001/2026","Concluída","01/09/2026","01/09/2026","11/09/2026","30/11/-0001",150,"Linha de exemplo"],[2,"Pago","EXEMPLO-002","Pix ou a vista - 1 dia","Pessoa Exemplo","000.000.000-00","Sem solicitante","00000002/2026","AM00000002/2026","OS00002/2026","Concluída","02/09/2026","02/09/2026","02/09/2026","02/09/2026",200,"Linha de exemplo"]];
  const listas=[["Status Fatura","Status Ordem serviço","Forma pagamento"],["Em Aberto","Faturamento","Boleto bancário, 10 dias"],["Pago","Parcelado","Boleto bancário, 30 dias"],["Faturamento","Concluída","Pix ou a vista - 1 dia"],["Aguardando fechamento","Laboratorio","Cartão de Credito"],["Cancelada","Cancelada","Boleto bancário, 2 parcelas"]];
  const wi=XLSX.utils.aoa_to_sheet(instrucoes),ws=XLSX.utils.aoa_to_sheet(exemplos),wl=XLSX.utils.aoa_to_sheet(listas);
  ws["!cols"]=CABECALHOS.map((x:string)=>({wch:Math.max(12,Math.min(28,x.length+3))}));
  XLSX.utils.book_append_sheet(wb,wi,"Instruções");XLSX.utils.book_append_sheet(wb,ws,"Serviços");XLSX.utils.book_append_sheet(wb,wl,"Listas");
  const bytes=XLSX.write(wb,{type:"array",bookType:"xlsx"});let bin="";const u=new Uint8Array(bytes);for(let i=0;i<u.length;i+=8192)bin+=String.fromCharCode(...u.subarray(i,i+8192));
  return {arquivoNome:"MODELO_Importacao_ServicosGerados.xlsx",mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",base64:btoa(bin)};
}
function b64u(s:string){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o}
async function jwt(t:string){if(!J||!t)return null;const p=t.split(".");if(p.length!==3)return null;try{const k=await crypto.subtle.importKey("raw",enc.encode(J),{name:"HMAC",hash:"SHA-256"},false,["verify"]);if(!await crypto.subtle.verify("HMAC",k,b64u(p[2]),enc.encode(`${p[0]}.${p[1]}`)))return null;const x=JSON.parse(dec.decode(b64u(p[1])));if(x.sis!=="minaslab"||(typeof x.exp==="number"&&x.exp<Math.floor(Date.now()/1000)))return null;return x}catch{return null}}
const cab=(v:any)=>txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const get=(r:any,...ks:string[])=>{for(const k of ks){const v=r[cab(k)];if(v!==undefined&&txt(v)!=="")return v}return""};
function dt(v:any){if(v===null||v===undefined||v==="")return null;if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v);return d?`${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`:null}const s=txt(v);if(!s||s==="-"||s.includes("30/11/-0001"))return null;let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?s.slice(0,10):null}
function num(v:any){if(typeof v==="number")return Number.isFinite(v)?v:0;let s=txt(v).replace(/R\$/gi,"").replace(/\s/g,"");if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");const n=Number(s);return Number.isFinite(n)?n:0}
function statusGL(v:any){const s=cab(v).toUpperCase();if(s.includes("CANCEL"))return"CANCELADO";if(s==="PAGO")return"PAGO";if(s.includes("FATURAMENTO"))return"FATURAMENTO";return"EM_ABERTO"}
function prefKey(cnpj:string,nome:string){return cnpj?`DOC:${cnpj}`:`NOME:${key(nome)}`}
async function emLotes<T>(itens:T[],fn:(item:T)=>Promise<void>,tamanho=40){for(let i=0;i<itens.length;i+=tamanho)await Promise.all(itens.slice(i,i+tamanho).map(fn))}
async function listarTodosServicos(){const todos:any[]=[];const tamanho=1000;for(let inicio=0;;inicio+=tamanho){const{data,error}=await sb.from("servicos_gerados").select("id,os_numero,empresa_id,faturamento_manual,pagamento_manual,apagado").range(inicio,inicio+tamanho-1);if(error)throw error;const lote=data||[];todos.push(...lote);if(lote.length<tamanho)break}return todos}
function aplicarAutomaticos(base:any,ex:any,fat:string,pag:string,ref:any){if(!ex?.faturamento_manual){base.status_faturamento=fat;if(ref?.data_emissao)base.data_emissao=ref.data_emissao}if(!ex?.pagamento_manual){base.status_pagamento=pag;if(ref?.paga){base.pagamento_origem="HISTORICO PLANILHA";base.pagamento_referencia=ref.referencia||null;base.pagamento_identificado_em=ref.data_pagamento?`${ref.data_pagamento}T12:00:00-03:00`:null;base.referencia_pagamento=ref.referencia||null}}return base}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:C});
  if(req.method!=="POST")return out({erro:"Use POST."},405);
  const m=txt(req.headers.get("authorization")).match(/^Bearer\s+(.+)$/i),cr=m?await jwt(m[1]):null,maq=!!T&&req.headers.get("x-token")===T;
  if(!cr&&!maq)return out({erro:"Entre no sistema.",semSessao:true},401);
  if(!maq&&txt(cr?.papel)!=="direcao")return out({erro:"O financeiro é somente da direção.",semPermissao:true},403);
  const usuario=maq?"maquina":txt(cr?.sub)||"direcao";
  try{
    const body=await req.json();
    if(txt(body.action)==="modelo")return out({ok:true,...modelo()});
    const b64=txt(body.base64);if(!b64)throw new Error("Arquivo não informado.");
    const bin=atob(b64),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
    const wb=XLSX.read(arr,{type:"array",cellDates:false});
    if(wb.SheetNames.some((n:string)=>key(n)==="DADOS"))throw new Error("A planilha histórica não deve ser importada em Serviços Gerados. Use somente o GerenciaLab Dashboard.");
    const nomeServicos=wb.SheetNames.find((n:string)=>key(n)==="SERVICOS");
    if(!nomeServicos)throw new Error("A aba Serviços não foi encontrada. Baixe e use o modelo disponível nesta tela.");
    const ws=wb.Sheets[nomeServicos],raw=XLSX.utils.sheet_to_json(ws,{defval:"",raw:true}) as any[];
    if(!raw.length)throw new Error("Arquivo GerenciaLab sem registros.");
    const rows=raw.map(r=>{const x:any={};for(const[k,v]of Object.entries(r))x[cab(k)]=v;return x});
    if(!Object.keys(rows[0]).some(x=>x.includes("ordem de servico"))||!("fatura" in rows[0])||!("cnpj cpf" in rows[0]))throw new Error("Arquivo não corresponde ao modelo GerenciaLab Dashboard aprovado.");

    const [exist,{data:prefs,error:e2},{data:refs,error:e3}]=await Promise.all([
      listarTodosServicos(),
      sb.from("servicos_gerados_empresa_preferencia").select("chave,empresa_id").limit(5000),
      sb.from("servicos_gerados_referencia_historica").select("os_key,emitida,paga,data_emissao,data_pagamento,forma_pagamento,referencia").limit(5000)
    ]);
    if(e2||e3)throw(e2||e3);
    const porOS=new Map((exist??[]).map((x:any)=>[key(x.os_numero),x])),pm=new Map((prefs??[]).map((x:any)=>[x.chave,x.empresa_id])),rm=new Map((refs??[]).map((x:any)=>[x.os_key,x]));
    const unicos=new Map<string,any>();let excluidos=0,semOS=0;
    for(const r of rows){const f=txt(get(r,"fatura")),d=doc(get(r,"cnpj cpf")),os=txt(get(r,"ordem de servico")),ok=key(os);if(key(f).startsWith("EXEMPLO")||EXC_DOC.has(d)||EXC_FAT.has(f)){excluidos++;continue}if(!ok||os==="-"){semOS++;continue}unicos.set(ok,r)}

    let inseridos=0,atualizados=0,semEmpresa=0,reativados=0,conflitosRecuperados=0;
    await emLotes([...unicos.entries()],async([ok,r])=>{
      const f=txt(get(r,"fatura")),d=doc(get(r,"cnpj cpf")),nome=txt(get(r,"cliente"))||"Cliente não informado",ex=porOS.get(ok),ref=rm.get(ok),empresa=ex?.empresa_id||pm.get(prefKey(d,nome))||null;
      if(!empresa)semEmpresa++;
      const sg=statusGL(get(r,"status fatura")),venc=dt(get(r,"data de vencimento")),valor=num(get(r,"total excel","total"));
      let fat="AGUARDANDO",pag="AGUARDANDO";
      if(ref?.paga){fat="FATURADO";pag="PAGO"}else if(ref?.emitida){fat="FATURADO";pag="A RECEBER"}else if(sg==="PAGO"){fat="FATURADO";pag="PAGO"}else if(sg==="CANCELADO"){fat="CANCELADO";pag="CANCELADO"}else if(sg==="FATURAMENTO")fat="PRONTO PARA FATURAR";
      const base:any={empresa_id:empresa,os_numero:txt(get(r,"ordem de servico")),codigo_gerencialab:f||null,contrato_proposta:txt(get(r,"contrato"))||null,cliente:nome,cnpj_cpf:d||null,servico:txt(get(r,"amostra referencia"))||null,data_os:dt(get(r,"data de recepcao"))||dt(get(r,"data do agendamento")),valor_original:valor,data_vencimento:venc,forma_pagamento:ref?.forma_pagamento||txt(get(r,"forma pagamento"))||null,dados_origem:r,apagado:false,updated_at:now(),updated_by:usuario};
      if(ex){
        aplicarAutomaticos(base,ex,fat,pag,ref);
        const{error}=await sb.from("servicos_gerados").update(base).eq("id",ex.id);if(error)throw error;if(ex.apagado)reativados++;atualizados++;porOS.set(ok,{...ex,...base});
      }else{
        const novo:any={...base,valor_faturar:valor,data_emissao:ref?.data_emissao||null,status_faturamento:fat,status_pagamento:pag,pagamento_origem:ref?.paga?"HISTORICO PLANILHA":null,pagamento_referencia:ref?.referencia||null,pagamento_identificado_em:ref?.data_pagamento?`${ref.data_pagamento}T12:00:00-03:00`:null,referencia_pagamento:ref?.referencia||null,created_by:usuario};
        const{data,error}=await sb.from("servicos_gerados").insert(novo).select("id,os_numero,empresa_id,faturamento_manual,pagamento_manual,apagado").single();
        if(error){
          if(error.code!=="23505")throw error;
          const{data:ja,error:buscaErro}=await sb.from("servicos_gerados").select("id,os_numero,empresa_id,faturamento_manual,pagamento_manual,apagado").eq("os_numero",base.os_numero).maybeSingle();
          if(buscaErro||!ja)throw error;
          const patch:any={...base};aplicarAutomaticos(patch,ja,fat,pag,ref);
          const{error:updateErro}=await sb.from("servicos_gerados").update(patch).eq("id",ja.id);if(updateErro)throw updateErro;
          conflitosRecuperados++;if(ja.apagado)reativados++;atualizados++;porOS.set(ok,{...ja,...patch});
        }else{porOS.set(ok,data);inseridos++}
      }
    },40);

    await sb.from("servicos_gerados_importacoes").insert({arquivo_nome:txt(body.arquivoNome)||"GerenciaLab Dashboard",lidos:rows.length,inseridos,atualizados,excluidos_regra:excluidos,pendentes_empresa:semEmpresa,detalhes:{sem_os:semOS,unicas:unicos.size,lote:40,reativados,conflitos_recuperados:conflitosRecuperados,regras:{cnpjs:[...EXC_DOC],faturas:[...EXC_FAT]}},criado_por:usuario});
    return out({ok:true,lidos:rows.length,unicas:unicos.size,inseridos,atualizados,excluidosRegra:excluidos,semOS,semEmpresa,reativados,conflitosRecuperados});
  }catch(e){console.error(e);return out({erro:e instanceof Error?e.message:JSON.stringify(e)},500)}
});
