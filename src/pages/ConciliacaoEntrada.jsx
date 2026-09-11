import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, FileText, Landmark, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MovimentacaoContaNova from "./MovimentacaoContaNova.jsx";
import ConciliacaoTitulos from "./ConciliacaoTitulos.jsx";
import { finDespesasListar, finRecebimentosListar } from "../services/financeiro.js";
import { finConciliarAjustado } from "../services/conciliacaoAjustes.js";
import { API } from "../lib/api.js";
import { comCracha } from "../lib/sessao.js";

const moeda=(v)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dataBR=(v)=>{if(!v)return"—";const p=String(v).slice(0,10).split("-");return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:String(v)};
const normaliza=(v)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const num=(v)=>Number.isFinite(Number(v))?Number(v):0;
const valorTitulo=(x,tipo)=>Math.max(0,Number(tipo==="RECEBIMENTO"?x?.valor_previsto:x?.valor_original)||0);
const conciliadoTitulo=(x)=>Math.max(0,Number(x?.valor_conciliado||0));
const restanteTitulo=(x,tipo)=>Math.max(0,valorTitulo(x,tipo)-conciliadoTitulo(x));
const nomeTitulo=(x,tipo)=>tipo==="RECEBIMENTO"?x?.cliente:x?.fornecedor;
const documentoTitulo=(x)=>x?.numero_nf||x?.documento||x?.cnpj_cpf||"";
const ajusteVazio=()=>({valorTitulo:"",desconto:"",juros:"",multa:"",ajuste:"",observacao:""});

async function buscarMovimento(movimentoId){
  const r=await comCracha(`${API}/ml-financeiro-movimento-contexto`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({movimentoId})});
  const b=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(b?.erro||"Não foi possível carregar o movimento bancário.");
  return b?.movimento;
}

export default function ConciliacaoEntrada(){
  const [params]=useSearchParams();
  const movimentoId=params.get("movimentoId")||"";
  if(!movimentoId)return <ConciliacaoTitulos/>;
  return <ConciliacaoMovimentoDireta movimentoId={movimentoId}/>;
}

function ConciliacaoMovimentoDireta({movimentoId}){
  const navigate=useNavigate();
  const [movimento,setMovimento]=useState(null),[titulos,setTitulos]=useState([]),[selecionados,setSelecionados]=useState([]),[busca,setBusca]=useState("");
  const [ajustes,setAjustes]=useState({});
  const [loading,setLoading]=useState(true),[salvando,setSalvando]=useState(false),[erro,setErro]=useState("");

  useEffect(()=>{let vivo=true;(async()=>{setLoading(true);setErro("");try{const m=await buscarMovimento(movimentoId);if(!vivo)return;setMovimento(m);const tipo=String(m?.tipo).toUpperCase()==="DEBITO"?"DESPESA":"RECEBIMENTO";const lista=tipo==="RECEBIMENTO"?await finRecebimentosListar(m.empresa_id):await finDespesasListar(m.empresa_id);if(!vivo)return;setTitulos((lista||[]).filter(x=>String(x.status||"").toUpperCase()!=="CANCELADO"&&restanteTitulo(x,tipo)>.005));}catch(e){if(vivo)setErro(e.message)}finally{if(vivo)setLoading(false)}})();return()=>{vivo=false}},[movimentoId]);

  const tipoReal=String(movimento?.tipo).toUpperCase()==="DEBITO"?"DESPESA":"RECEBIMENTO";
  const valorBanco=Math.abs(num(movimento?.valor_disponivel??movimento?.valor));
  const filtrados=useMemo(()=>{const t=normaliza(busca);return titulos.filter(x=>!t||normaliza(`${nomeTitulo(x,tipoReal)} ${documentoTitulo(x)} ${x?.descricao||""} ${x?.cnpj_cpf||""} ${restanteTitulo(x,tipoReal).toFixed(2)}`).includes(t)).sort((a,b)=>Math.abs(restanteTitulo(a,tipoReal)-valorBanco)-Math.abs(restanteTitulo(b,tipoReal)-valorBanco));},[titulos,busca,tipoReal,valorBanco]);
  const selecionadosObj=useMemo(()=>titulos.filter(x=>selecionados.includes(x.id)),[titulos,selecionados]);

  function dadosAjuste(t){const a=ajustes[t.id]||ajusteVazio(),restante=restanteTitulo(t,tipoReal),valor=a.valorTitulo===""?restante:num(a.valorTitulo),esperado=valor-num(a.desconto)+num(a.juros)+num(a.multa)+num(a.ajuste);return{...a,valor,esperado,restante}}
  const calculos=selecionadosObj.map(t=>({titulo:t,...dadosAjuste(t)}));
  const totalTitulos=calculos.reduce((s,x)=>s+x.valor,0),totalEsperado=calculos.reduce((s,x)=>s+x.esperado,0),diferenca=valorBanco-totalEsperado;
  const valoresValidos=calculos.every(x=>x.valor>.005&&x.valor<=x.restante+.01&&x.esperado>=-.005);
  const pode=selecionadosObj.length>0&&valoresValidos&&Math.abs(diferenca)<=.01;

  function fechar(){navigate("/financas/movimentacao-conta",{replace:true});}
  function alternar(x){setErro("");setSelecionados(atual=>{const existe=atual.includes(x.id);const prox=existe?atual.filter(id=>id!==x.id):[...atual,x.id];setAjustes(a=>{const n={...a};if(existe)delete n[x.id];else n[x.id]={...ajusteVazio(),valorTitulo:restanteTitulo(x,tipoReal).toFixed(2)};return n});return prox})}
  function setCampo(id,campo,valor){setAjustes(a=>({...a,[id]:{...(a[id]||ajusteVazio()),[campo]:valor}}))}

  async function confirmar(){
    if(!pode||!movimento)return;
    setSalvando(true);setErro("");
    try{
      for(const c of calculos){
        await finConciliarAjustado({movimentoId:movimento.id,recebimentoId:tipoReal==="RECEBIMENTO"?c.titulo.id:null,despesaId:tipoReal==="DESPESA"?c.titulo.id:null,valorTitulo:c.valor,valorMovimento:c.esperado,desconto:num(c.desconto),juros:num(c.juros),multa:num(c.multa),ajuste:num(c.ajuste),observacao:c.observacao||`Conciliação${calculos.length>1?` em lote de ${calculos.length} títulos`:""}`,dataLiquidacao:String(movimento.data_movimento||"").slice(0,10)});
      }
      fechar();
    }catch(e){setErro(e.message)}finally{setSalvando(false)}
  }

  return <>
    <MovimentacaoContaNova/>
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-2 sm:p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-xl font-bold text-emerald-800">{tipoReal==="RECEBIMENTO"?"Conciliar Recebimento":"Conciliar Pagamento"}</h2><button className="btn-ghost h-9 w-9 p-0" onClick={fechar}><X size={18}/></button></div>
        <div className="overflow-y-auto p-5">
          {erro&&<div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
          {loading?<div className="p-12 text-center text-slate-500">Carregando conciliação...</div>:<div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 border-b pb-3 font-bold text-emerald-800"><FileText size={18}/>Títulos selecionados</h3>{selecionadosObj.length?<div className="grid min-h-[130px] place-items-center rounded-xl bg-emerald-50 p-5 text-center"><div><b className="text-lg text-emerald-800">{selecionadosObj.length} título(s) selecionado(s)</b><p className="mt-2 text-sm text-slate-600">Valor original selecionado: <strong>{moeda(selecionadosObj.reduce((s,t)=>s+restanteTitulo(t,tipoReal),0))}</strong></p></div></div>:<div className="grid min-h-[130px] place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Selecione um ou mais títulos abaixo.</div>}</section>
              <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 border-b pb-3 font-bold text-emerald-800"><Landmark size={18}/>Movimento no Banco</h3><div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm"><span className="text-slate-500">Data</span><b>{dataBR(movimento?.data_movimento)}</b><span className="text-slate-500">Descrição</span><span className="break-words">{movimento?.descricao||"—"}</span><span className="text-slate-500">Conta</span><span>{movimento?.conta?.nome||"—"}</span><span className="text-slate-500">Valor no banco</span><b>{moeda(valorBanco)}</b></div></section>
            </div>
            <section className="rounded-xl border p-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-bold text-emerald-800"><Building2 size={18}/>Selecionar título para conciliar</h3>{selecionadosObj.length>0&&<span className="text-sm font-semibold text-slate-600">{selecionadosObj.length} selecionado(s)</span>}</div><div className="relative mb-3"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className="input pl-9" value={busca} onChange={e=>setBusca(e.target.value)} placeholder={tipoReal==="RECEBIMENTO"?"Cliente, NF, CNPJ, descrição ou valor":"Favorecido, documento, CNPJ, descrição ou valor"}/></div><div className="max-h-[310px] space-y-2 overflow-y-auto pr-1">{filtrados.length?filtrados.map(x=>{const marcado=selecionados.includes(x.id);return <label key={x.id} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition ${marcado?"border-emerald-300 bg-emerald-50/60":"hover:border-emerald-200 hover:bg-slate-50"}`}><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={marcado} onChange={()=>alternar(x)}/><div className="min-w-0 flex-1"><b className="block truncate">{nomeTitulo(x,tipoReal)||"Sem nome"}</b><span className="block truncate text-xs text-slate-500">{documentoTitulo(x)||x.descricao||"Sem documento"} · Venc. {dataBR(x.data_vencimento)}</span></div><b className="whitespace-nowrap">{moeda(restanteTitulo(x,tipoReal))}</b></label>}):<div className="p-8 text-center text-sm text-slate-500">Nenhum título disponível para conciliação.</div>}</div></section>
            {calculos.length>0&&<section className="rounded-xl border p-4"><div className="mb-4"><h3 className="font-bold text-emerald-800">{calculos.length>1?"Ajustes individuais do lote":tipoReal==="RECEBIMENTO"?"Ajuste do Recebimento":"Ajuste do Pagamento"}</h3><p className="mt-1 text-xs text-slate-500">{calculos.length>1?"Informe juros, multa, desconto ou outros ajustes separadamente em cada título. A soma calculada deve conferir com o crédito/débito único liberado pelo banco.":"Informe os ajustes deste título, quando houver."}</p></div><div className="space-y-4">{calculos.map((c,i)=><AjusteTitulo key={c.titulo.id} indice={i+1} total={calculos.length} tipo={tipoReal} titulo={c.titulo} dados={c} onChange={(campo,valor)=>setCampo(c.titulo.id,campo,valor)}/>)}</div><div className={`mt-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-4 ${Math.abs(diferenca)<=.01?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}><Resumo k="Total dos títulos" v={moeda(totalTitulos)}/><Resumo k="Total com ajustes" v={moeda(totalEsperado)}/><Resumo k="Valor no banco" v={moeda(valorBanco)}/><Resumo k="Diferença" v={moeda(diferenca)} ok={Math.abs(diferenca)<=.01}/></div>{Math.abs(diferenca)<=.01?<div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16}/>Valores conferem. Cada ajuste será gravado no respectivo título.</div>:<div className="mt-2 text-sm font-semibold text-amber-700">Ajuste os valores de cada título até a diferença do lote ficar em R$ 0,00.</div>}<div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">O valor original de cada título é preservado. Descontos, juros, multas e outros ajustes ficam registrados separadamente em cada conciliação.</div></section>}
          </div>}
        </div>
        <div className="flex flex-col gap-2 border-t bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm text-slate-600">{selecionadosObj.length>0&&<><strong>{selecionadosObj.length}</strong> título(s) · Com ajustes <strong>{moeda(totalEsperado)}</strong> · Banco <strong>{moeda(valorBanco)}</strong></>}</div><div className="flex justify-end gap-2"><button className="btn-outline" onClick={fechar}>Cancelar</button><button className="btn-primary" disabled={!pode||salvando} onClick={confirmar}>{salvando?"Conciliando...":"Confirmar conciliação"}</button></div></div>
      </div>
    </div>
  </>;
}

function AjusteTitulo({indice,total,tipo,titulo,dados,onChange}){return <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"><div className="mb-3 flex flex-col gap-1 border-b pb-3 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-slate-800">{total>1?`${indice}. `:""}{nomeTitulo(titulo,tipo)||"Sem nome"}</b><div className="text-xs text-slate-500">{documentoTitulo(titulo)||titulo.descricao||"Sem documento"} · Venc. {dataBR(titulo.data_vencimento)}</div></div><div className="text-sm text-slate-600">Saldo do título: <strong>{moeda(dados.restante)}</strong></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Campo label="Valor do título nesta conciliação" value={dados.valorTitulo} onChange={v=>onChange("valorTitulo",v)}/><Campo label="Desconto (-)" value={dados.desconto} onChange={v=>onChange("desconto",v)}/><Campo label="Juros (+)" value={dados.juros} onChange={v=>onChange("juros",v)}/><Campo label="Multa (+)" value={dados.multa} onChange={v=>onChange("multa",v)}/><Campo label="Outros ajustes (+/-)" value={dados.ajuste} onChange={v=>onChange("ajuste",v)}/></div><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"><div className="grid flex-1 gap-3 rounded-lg bg-white p-3 sm:grid-cols-2"><Resumo k="Valor do título" v={moeda(dados.valor)}/><Resumo k="Valor calculado no banco" v={moeda(dados.esperado)}/></div><label className="flex-[2]"><span className="label">Observação deste título (opcional)</span><input className="input" value={dados.observacao} onChange={e=>onChange("observacao",e.target.value)} placeholder="Ex.: juros por atraso, desconto comercial..."/></label></div></div>}
function Campo({label,value,onChange}){return <label><span className="label">{label}</span><input className="input text-right" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value.replace(",","."))}/></label>}
function Resumo({k,v,ok}){return <div><span className="text-xs text-slate-500">{k}</span><p className={`font-bold ${ok?"text-emerald-700":""}`}>{v}</p></div>}
