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
  return <ConciliacaoMovimentoDireta movimentoId={movimentoId} tipoParam={params.get("tipo")||""}/>;
}

function ConciliacaoMovimentoDireta({movimentoId,tipoParam}){
  const navigate=useNavigate();
  const [movimento,setMovimento]=useState(null),[titulos,setTitulos]=useState([]),[titulo,setTitulo]=useState(null),[busca,setBusca]=useState("");
  const [valorTituloConc,setValorTituloConc]=useState(""),[desconto,setDesconto]=useState(""),[juros,setJuros]=useState(""),[multa,setMulta]=useState(""),[ajuste,setAjuste]=useState(""),[observacao,setObservacao]=useState("");
  const [loading,setLoading]=useState(true),[salvando,setSalvando]=useState(false),[erro,setErro]=useState("");
  const tipo=String(tipoParam||"").toUpperCase()==="DESPESA"?"DESPESA":"RECEBIMENTO";

  useEffect(()=>{let vivo=true;(async()=>{setLoading(true);setErro("");try{const m=await buscarMovimento(movimentoId);if(!vivo)return;setMovimento(m);const tipoReal=String(m?.tipo).toUpperCase()==="DEBITO"?"DESPESA":"RECEBIMENTO";const lista=tipoReal==="RECEBIMENTO"?await finRecebimentosListar(m.empresa_id):await finDespesasListar(m.empresa_id);if(!vivo)return;setTitulos((lista||[]).filter(x=>String(x.status||"").toUpperCase()!=="CANCELADO"&&restanteTitulo(x,tipoReal)>.005));}catch(e){if(vivo)setErro(e.message)}finally{if(vivo)setLoading(false)}})();return()=>{vivo=false}},[movimentoId]);

  const tipoReal=String(movimento?.tipo).toUpperCase()==="DEBITO"?"DESPESA":"RECEBIMENTO";
  const valorBanco=num(movimento?.valor_disponivel??movimento?.valor);
  const filtrados=useMemo(()=>{const t=normaliza(busca);return titulos.filter(x=>!t||normaliza(`${nomeTitulo(x,tipoReal)} ${documentoTitulo(x)} ${x?.descricao||""} ${x?.cnpj_cpf||""} ${restanteTitulo(x,tipoReal).toFixed(2)}`).includes(t)).sort((a,b)=>Math.abs(restanteTitulo(a,tipoReal)-valorBanco)-Math.abs(restanteTitulo(b,tipoReal)-valorBanco));},[titulos,busca,tipoReal,valorBanco]);
  const restante=titulo?restanteTitulo(titulo,tipoReal):0;
  const valorTituloAtual=titulo?(valorTituloConc===""?Math.min(restante,valorBanco):num(valorTituloConc)):0;
  const esperado=valorTituloAtual-num(desconto)+num(juros)+num(multa)+num(ajuste);
  const diferenca=valorBanco-esperado;
  const pode=titulo&&valorTituloAtual>.005&&valorTituloAtual<=restante+.01&&Math.abs(diferenca)<=.01;

  function fechar(){navigate("/financas/movimentacao-conta",{replace:true});}
  function escolher(x){setTitulo(x);setValorTituloConc(String(Math.min(restanteTitulo(x,tipoReal),valorBanco).toFixed(2)));setDesconto("");setJuros("");setMulta("");setAjuste("");setObservacao("");setErro("");}
  async function confirmar(){if(!pode||!titulo||!movimento)return;setSalvando(true);setErro("");try{await finConciliarAjustado({movimentoId:movimento.id,recebimentoId:tipoReal==="RECEBIMENTO"?titulo.id:null,despesaId:tipoReal==="DESPESA"?titulo.id:null,valorTitulo:valorTituloAtual,valorMovimento:valorBanco,desconto:num(desconto),juros:num(juros),multa:num(multa),ajuste:num(ajuste),observacao,dataLiquidacao:String(movimento.data_movimento||"").slice(0,10)});fechar();}catch(e){setErro(e.message)}finally{setSalvando(false)}}

  return <>
    <MovimentacaoContaNova/>
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-2 sm:p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4"><h2 className="text-xl font-bold text-emerald-800">{tipoReal==="RECEBIMENTO"?"Conciliar Recebimento":"Conciliar Pagamento"}</h2><button className="btn-ghost h-9 w-9 p-0" onClick={fechar}><X size={18}/></button></div>
        <div className="overflow-y-auto p-5">
          {erro&&<div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
          {loading?<div className="p-12 text-center text-slate-500">Carregando conciliação...</div>:<div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 border-b pb-3 font-bold text-emerald-800"><FileText size={18}/>Informações do Título</h3>{titulo?<div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-sm"><span className="text-slate-500">{tipoReal==="RECEBIMENTO"?"Cliente":"Favorecido"}</span><b>{nomeTitulo(titulo,tipoReal)||"—"}</b><span className="text-slate-500">Descrição</span><span>{titulo.descricao||documentoTitulo(titulo)||"—"}</span><span className="text-slate-500">Vencimento</span><span>{dataBR(titulo.data_vencimento)}</span><span className="text-slate-500">Valor original</span><b>{moeda(valorTitulo(titulo,tipoReal))}</b><span className="text-slate-500">Já conciliado</span><span>{moeda(conciliadoTitulo(titulo))}</span></div>:<div className="grid min-h-[150px] place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">Selecione um título abaixo.</div>}</section>
              <section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 border-b pb-3 font-bold text-emerald-800"><Landmark size={18}/>Movimento no Banco</h3><div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm"><span className="text-slate-500">Data</span><b>{dataBR(movimento?.data_movimento)}</b><span className="text-slate-500">Descrição</span><span className="break-words">{movimento?.descricao||"—"}</span><span className="text-slate-500">Conta</span><span>{movimento?.conta?.nome||"—"}</span><span className="text-slate-500">Valor no banco</span><b>{moeda(valorBanco)}</b></div></section>
            </div>
            {!titulo&&<section className="rounded-xl border p-4"><h3 className="mb-3 flex items-center gap-2 font-bold text-emerald-800"><Building2 size={18}/>Selecionar título para conciliar</h3><div className="relative mb-3"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className="input pl-9" value={busca} onChange={e=>setBusca(e.target.value)} placeholder={tipoReal==="RECEBIMENTO"?"Cliente, NF, CNPJ, descrição ou valor":"Favorecido, documento, CNPJ, descrição ou valor"}/></div><div className="max-h-[310px] space-y-2 overflow-y-auto pr-1">{filtrados.length?filtrados.map(x=><button key={x.id} className="flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/40" onClick={()=>escolher(x)}><div className="min-w-0"><b className="block truncate">{nomeTitulo(x,tipoReal)||"Sem nome"}</b><span className="block truncate text-xs text-slate-500">{documentoTitulo(x)||x.descricao||"Sem documento"} · Venc. {dataBR(x.data_vencimento)}</span></div><b className="whitespace-nowrap">{moeda(restanteTitulo(x,tipoReal))}</b></button>):<div className="p-8 text-center text-sm text-slate-500">Nenhum título disponível para conciliação.</div>}</div></section>}
            {titulo&&<><section className="rounded-xl border p-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold text-emerald-800">{tipoReal==="RECEBIMENTO"?"Ajuste do Recebimento":"Ajuste do Pagamento"}</h3><button className="text-sm font-semibold text-emerald-700 hover:underline" onClick={()=>setTitulo(null)}>Trocar título</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Campo label="Valor do título nesta conciliação" value={valorTituloConc} onChange={setValorTituloConc}/><Campo label="Desconto (-)" value={desconto} onChange={setDesconto}/><Campo label="Juros (+)" value={juros} onChange={setJuros}/><Campo label="Multa (+)" value={multa} onChange={setMulta}/><Campo label="Outros ajustes (+/-)" value={ajuste} onChange={setAjuste}/></div><div className={`mt-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-3 ${Math.abs(diferenca)<=.01?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}><Resumo k="Valor calculado" v={moeda(esperado)}/><Resumo k="Valor no banco" v={moeda(valorBanco)}/><Resumo k="Diferença" v={moeda(diferenca)} ok={Math.abs(diferenca)<=.01}/></div>{Math.abs(diferenca)<=.01&&<div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16}/>Valores conferem.</div>}<label className="mt-4 block"><span className="label">Observação (opcional)</span><textarea className="input min-h-[80px]" value={observacao} onChange={e=>setObservacao(e.target.value)} placeholder="Ex.: juros por atraso, desconto comercial..."/></label><div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">O valor original do título é preservado. Descontos, juros, multas e outros ajustes ficam registrados separadamente na conciliação.</div></section></>}
          </div>}
        </div>
        <div className="flex justify-end gap-2 border-t bg-white px-5 py-4"><button className="btn-outline" onClick={fechar}>Cancelar</button><button className="btn-primary" disabled={!pode||salvando} onClick={confirmar}>{salvando?"Conciliando...":"Confirmar conciliação"}</button></div>
      </div>
    </div>
  </>;
}

function Campo({label,value,onChange}){return <label><span className="label">{label}</span><input className="input text-right" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value.replace(",","."))}/></label>}
function Resumo({k,v,ok}){return <div><span className="text-xs text-slate-500">{k}</span><p className={`font-bold ${ok?"text-emerald-700":""}`}>{v}</p></div>}
