import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, AlertTriangle, FileText, RefreshCw, Landmark, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";
import { financeiroOpcoes, finRecebimentosListar, finDespesasListar, finNotasListar, finMovimentosListar } from "../services/financeiro.js";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => `${Number(v || 0).toFixed(1).replace(".", ",")}%`;
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const noPeriodo = (data, de, ate) => !!data && String(data).slice(0,10) >= de && String(data).slice(0,10) <= ate;
function mesAtual() { const d = new Date(); const ini = new Date(d.getFullYear(),d.getMonth(),1); const fim = new Date(d.getFullYear(),d.getMonth()+1,0); return { de:isoLocal(ini), ate:isoLocal(fim) }; }
function periodoRapido(tipo){
 const h=new Date();
 if(tipo==="mes"){return mesAtual()}
 if(tipo==="anterior"){const ini=new Date(h.getFullYear(),h.getMonth()-1,1),fim=new Date(h.getFullYear(),h.getMonth(),0);return{de:isoLocal(ini),ate:isoLocal(fim)}}
 if(tipo==="3meses"){const ini=new Date(h.getFullYear(),h.getMonth()-2,1),fim=new Date(h.getFullYear(),h.getMonth()+1,0);return{de:isoLocal(ini),ate:isoLocal(fim)}}
 return{de:`${h.getFullYear()}-01-01`,ate:`${h.getFullYear()}-12-31`};
}

function Card({ titulo, valor, subtitulo, Icone, destaque = "text-slate-900", onClick }) {
  const corpo = <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p><p className={`mt-2 text-2xl font-bold ${destaque}`}>{valor}</p>{subtitulo && <p className="mt-1 text-xs text-slate-500">{subtitulo}</p>}</div><span className="rounded-xl bg-slate-50 p-2.5 text-slate-600"><Icone size={20}/></span></div>;
  if (!onClick) return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{corpo}</div>;
  return <button type="button" onClick={onClick} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">{corpo}<div className="mt-3 flex items-center gap-1 text-xs font-medium text-teal-700">Ver detalhes <ChevronRight size={13}/></div></button>;
}

function realizadoRecebimentoManual(r,de,ate){
 const baixas=(r.baixas||[]).filter(b=>!b.estornada&&noPeriodo(b.data_pagamento,de,ate));
 return baixas.reduce((s,b)=>s+Number(b.valor||0),0);
}
function realizadoDespesaManual(d,de,ate){
 const baixas=(d.baixas||[]).filter(b=>!b.estornada&&noPeriodo(b.data_pagamento,de,ate));
 return baixas.reduce((s,b)=>s+Number(b.valor||0),0);
}
const movimentoOmieRecebido=m=>String(m?.origem||'').toUpperCase()==='OMIE'&&String(m?.tipo||'').toUpperCase()==='CREDITO'&&String(m?.dados_omie?.cOrigem||'')==='Conta Recebida';
const movimentoOmiePago=m=>String(m?.origem||'').toUpperCase()==='OMIE'&&String(m?.tipo||'').toUpperCase()==='DEBITO'&&String(m?.dados_omie?.cOrigem||'')==='Conta Paga';

export default function FinanceiroDashboard() {
  const navigate = useNavigate();
  const periodo = mesAtual();
  const [empresaId, setEmpresaId] = useState("");
  const [de, setDe] = useState(periodo.de);
  const [ate, setAte] = useState(periodo.ate);
  const [opcoes, setOpcoes] = useState({ empresas:[], contas:[] });
  const [recebimentos,setRecebimentos]=useState([]);
  const [despesas,setDespesas]=useState([]);
  const [notas,setNotas]=useState([]);
  const [movimentos,setMovimentos]=useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true); setErro("");
    try {
      const [o,r,d,n,m] = await Promise.all([financeiroOpcoes(),finRecebimentosListar(empresaId),finDespesasListar(empresaId),finNotasListar(empresaId),finMovimentosListar(empresaId)]);
      setOpcoes(o);setRecebimentos(r);setDespesas(d);setNotas(n);setMovimentos(m);
    } catch (e) { setErro(e.message || "Falha ao carregar o dashboard."); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); }, [empresaId]);
  function aplicarRapido(tipo){const p=periodoRapido(tipo);setDe(p.de);setAte(p.ate)}

  const dados=useMemo(()=>{
    const recAbertos=recebimentos.filter(r=>r.status!=="CANCELADO"&&r.data_vencimento&&String(r.data_vencimento).slice(0,10)<=ate);
    const desAbertas=despesas.filter(d=>d.status!=="CANCELADO"&&d.data_vencimento&&String(d.data_vencimento).slice(0,10)<=ate);
    const manualRecebido=recebimentos.filter(r=>String(r.origem||'').toUpperCase()!=='OMIE').reduce((s,r)=>s+realizadoRecebimentoManual(r,de,ate),0);
    const manualPago=despesas.filter(d=>String(d.origem||'').toUpperCase()!=='OMIE').reduce((s,d)=>s+realizadoDespesaManual(d,de,ate),0);
    const omieRecebido=movimentos.filter(m=>movimentoOmieRecebido(m)&&noPeriodo(m.data_movimento,de,ate)).reduce((s,m)=>s+Number(m.valor||0),0);
    const omiePago=movimentos.filter(m=>movimentoOmiePago(m)&&noPeriodo(m.data_movimento,de,ate)).reduce((s,m)=>s+Number(m.valor||0),0);
    const totalRecebido=manualRecebido+omieRecebido;
    const totalPago=manualPago+omiePago;
    const totalReceber=recAbertos.reduce((s,r)=>s+Number(r.valor_pendente||0),0);
    const totalPagar=desAbertas.reduce((s,d)=>s+Number(d.valor_pendente||0),0);
    const empresasAtivas=(opcoes.empresas||[]).filter(e=>e.ativa!==false&&(!empresaId||e.id===empresaId));
    const contas=(opcoes.contas||[]).filter(c=>c.ativa!==false&&(!empresaId||c.empresa_id===empresaId));
    const empresasComConta=new Set(contas.map(c=>c.empresa_id));
    const todasEmpresasTemConta=empresasAtivas.length>0&&empresasAtivas.every(e=>empresasComConta.has(e.id));
    const saldoRealDisponivel=todasEmpresasTemConta&&contas.length>0&&contas.every(c=>c.saldo_atual!==null&&c.saldo_atual!==undefined);
    const saldoBancario=saldoRealDisponivel?contas.reduce((s,c)=>s+Number(c.saldo_atual||0),0):null;
    const hoje=isoLocal(new Date());
    const recebimentosVencidos=recebimentos.filter(r=>r.status!=="CANCELADO"&&Number(r.valor_pendente)>0&&r.data_vencimento&&String(r.data_vencimento).slice(0,10)<hoje);
    const despesasVencidas=despesas.filter(d=>d.status!=="CANCELADO"&&Number(d.valor_pendente)>0&&d.data_vencimento&&String(d.data_vencimento).slice(0,10)<hoje);
    const vencidos=recebimentosVencidos.reduce((s,r)=>s+Number(r.valor_pendente||0),0);
    const baseInad=totalRecebido+totalReceber;
    const notasPeriodo=notas.filter(n=>noPeriodo(n.data_emissao,de,ate));
    const valorNotas=notasPeriodo.reduce((s,n)=>s+Number(n.valor_total||0),0);
    const saldoProjetado=saldoRealDisponivel?saldoBancario+totalReceber-totalPagar:null;
    return{totalRecebido,totalPago,totalReceber,totalPagar,saldoBancario,saldoRealDisponivel,saldoProjetado,inadimplencia:baseInad>0?vencidos/baseInad*100:0,notas:valorNotas,recebimentosVencidos:recebimentosVencidos.length,despesasVencidas:despesasVencidas.length,notasQuantidade:notasPeriodo.length,contas};
  },[recebimentos,despesas,notas,movimentos,opcoes.contas,opcoes.empresas,empresaId,de,ate]);

  const serie = useMemo(() => {
    const mapa=new Map();
    const add=(data,campo,valor)=>{if(!noPeriodo(data,de,ate))return;const k=String(data).slice(0,7);const a=mapa.get(k)||{mes:k,entradas:0,saidas:0};a[campo]+=Number(valor||0);mapa.set(k,a)};
    for(const r of recebimentos.filter(x=>String(x.origem||'').toUpperCase()!=='OMIE')){for(const b of (r.baixas||[]).filter(b=>!b.estornada))add(b.data_pagamento,"entradas",b.valor)}
    for(const d of despesas.filter(x=>String(x.origem||'').toUpperCase()!=='OMIE')){for(const b of (d.baixas||[]).filter(b=>!b.estornada))add(b.data_pagamento,"saidas",b.valor)}
    for(const m of movimentos){if(movimentoOmieRecebido(m))add(m.data_movimento,"entradas",m.valor);else if(movimentoOmiePago(m))add(m.data_movimento,"saidas",m.valor)}
    return[...mapa.values()].sort((a,b)=>a.mes.localeCompare(b.mes));
  },[recebimentos,despesas,movimentos,de,ate]);
  const maxSerie=Math.max(1,...serie.flatMap(x=>[x.entradas,x.saidas]));

  const categorias=useMemo(()=>{const m=new Map();for(const d of despesas.filter(x=>String(x.origem||'').toUpperCase()!=='OMIE')){const v=realizadoDespesaManual(d,de,ate);if(!v)continue;const nome=d.categoria?.nome||d.categoria_texto||"Sem categoria";m.set(nome,(m.get(nome)||0)+v)}for(const x of movimentos.filter(mv=>movimentoOmiePago(mv)&&noPeriodo(mv.data_movimento,de,ate))){const nome=x?.dados_omie?.cDesCategoria||x?.dados_omie?.cCodCategoria||"Sem categoria";m.set(nome,(m.get(nome)||0)+Number(x.valor||0))}return[...m.entries()].map(([nome,valor])=>({nome,valor})).sort((a,b)=>b.valor-a.valor).slice(0,8)},[despesas,movimentos,de,ate]);
  const maxCat=Math.max(1,...categorias.map(x=>x.valor));

  const evolucao=useMemo(()=>{
    if(!dados.saldoRealDisponivel)return[];
    const hoje=isoLocal(new Date());
    const limite=ate>=hoje?ate:hoje;
    const porDia=new Map();
    for(const r of recebimentos){if(r.status==="CANCELADO"||Number(r.valor_pendente||0)<=0||!r.data_vencimento)continue;const data=String(r.data_vencimento).slice(0,10);if(data>=hoje&&data<=limite)porDia.set(data,(porDia.get(data)||0)+Number(r.valor_pendente||0));}
    for(const d of despesas){if(d.status==="CANCELADO"||Number(d.valor_pendente||0)<=0||!d.data_vencimento)continue;const data=String(d.data_vencimento).slice(0,10);if(data>=hoje&&data<=limite)porDia.set(data,(porDia.get(data)||0)-Number(d.valor_pendente||0));}
    let saldo=Number(dados.saldoBancario||0);
    const pontos=[{data:hoje,saldo}];
    for(const [data,delta] of [...porDia.entries()].sort(([a],[b])=>a.localeCompare(b))){saldo+=delta;pontos.push({data,saldo});}
    return pontos;
  },[recebimentos,despesas,ate,dados.saldoRealDisponivel,dados.saldoBancario]);
  const minSaldo=Math.min(0,...evolucao.map(x=>x.saldo)),maxSaldo=Math.max(1,...evolucao.map(x=>x.saldo));

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><PageTitle titulo="Visão Geral Financeira" descricao="Posição financeira consolidada, alertas e principais movimentos de MinasLab e M Lab."/><button type="button" className="btn-outline self-start" onClick={()=>navigate("/financas/extrato")}><Landmark size={15}/> Bancos & Conciliação</button></div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap gap-2"><button className="btn-outline" onClick={()=>aplicarRapido("mes")}>Este mês</button><button className="btn-outline" onClick={()=>aplicarRapido("anterior")}>Mês anterior</button><button className="btn-outline" onClick={()=>aplicarRapido("3meses")}>Últimos 3 meses</button><button className="btn-outline" onClick={()=>aplicarRapido("ano")}>Ano atual</button></div>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="block"><span className="label">Empresa</span><select className="input" value={empresaId} onChange={e=>setEmpresaId(e.target.value)}><option value="">Consolidado</option>{(opcoes.empresas||[]).map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>
        <label className="block"><span className="label">De</span><input className="input" type="date" value={de} onChange={e=>setDe(e.target.value)}/></label>
        <label className="block"><span className="label">Até</span><input className="input" type="date" value={ate} onChange={e=>setAte(e.target.value)}/></label>
        <div className="flex items-end"><button className="btn-outline w-full" onClick={carregar} disabled={carregando}><RefreshCw size={15} className={carregando?"animate-spin":""}/>{carregando?"Carregando...":"Atualizar"}</button></div>
      </div>
    </div>
    {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card titulo="Saldo Bancário" valor={dados.saldoRealDisponivel?moeda(dados.saldoBancario):"A informar"} subtitulo={dados.saldoRealDisponivel?"Saldo real das contas ativas":"Há conta ou empresa ativa sem saldo informado"} Icone={Wallet} destaque={dados.saldoRealDisponivel?"text-slate-900":"text-amber-700"} onClick={()=>navigate("/financas/extrato")}/>
      <Card titulo="A Receber" valor={moeda(dados.totalReceber)} subtitulo="Saldo aberto até o fim do período" Icone={TrendingUp} destaque="text-sky-700" onClick={()=>navigate("/financas/recebimentos")}/>
      <Card titulo="A Pagar" valor={moeda(dados.totalPagar)} subtitulo="Saldo aberto até o fim do período" Icone={Wallet} destaque="text-amber-700" onClick={()=>navigate("/financas/despesas")}/>
      <Card titulo="Inadimplência" valor={pct(dados.inadimplencia)} subtitulo={`${dados.recebimentosVencidos} recebimento(s) vencido(s)`} Icone={AlertTriangle} destaque={Number(dados.inadimplencia)>0?"text-red-700":"text-emerald-700"} onClick={()=>navigate("/financas/recebimentos")}/>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Atenção financeira</h2><p className="text-xs text-slate-500">Pendências que merecem acompanhamento.</p></div><AlertTriangle size={19} className="text-amber-600"/></div>
        <div className="space-y-2">
          <button type="button" onClick={()=>navigate("/financas/recebimentos")} className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-left hover:bg-slate-50"><div><p className="text-sm font-medium text-slate-800">Recebimentos vencidos</p><p className="text-xs text-slate-500">{dados.recebimentosVencidos} título(s) em atraso</p></div><ChevronRight size={16} className="text-slate-400"/></button>
          <button type="button" onClick={()=>navigate("/financas/despesas")} className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-left hover:bg-slate-50"><div><p className="text-sm font-medium text-slate-800">Despesas vencidas</p><p className="text-xs text-slate-500">{dados.despesasVencidas} título(s) pendente(s)</p></div><ChevronRight size={16} className="text-slate-400"/></button>
          <button type="button" onClick={()=>navigate("/financas/notas-fiscais")} className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-left hover:bg-slate-50"><div><p className="text-sm font-medium text-slate-800">Notas fiscais no período</p><p className="text-xs text-slate-500">{dados.notasQuantidade} nota(s) · {moeda(dados.notas)}</p></div><ChevronRight size={16} className="text-slate-400"/></button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Contas bancárias</h2><p className="text-xs text-slate-500">Saldos cadastrados no Financeiro.</p></div><Landmark size={19} className="text-teal-700"/></div>
        {dados.contas.length===0?<p className="py-8 text-center text-sm text-slate-500">Nenhuma conta ativa para o filtro atual.</p>:<div className="space-y-3">{dados.contas.map(c=><div key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{c.nome||c.banco||"Conta bancária"}</p><p className="text-xs text-slate-500">{c.banco||c.tipo||"Conta ativa"}</p></div><p className={`shrink-0 text-sm font-semibold ${c.saldo_atual===null||c.saldo_atual===undefined?"text-amber-700":"text-slate-900"}`}>{c.saldo_atual===null||c.saldo_atual===undefined?"A informar":moeda(c.saldo_atual)}</p></div>)}</div>}
        <button type="button" className="mt-4 flex items-center gap-1 text-sm font-medium text-teal-700" onClick={()=>navigate("/financas/extrato")}>Abrir bancos e conciliação <ChevronRight size={14}/></button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card titulo="Total Recebido" valor={moeda(dados.totalRecebido)} subtitulo="Baixas manuais + Conta Recebida Omie no período" Icone={ArrowDownCircle} destaque="text-emerald-700" onClick={()=>navigate("/financas/recebimentos")}/>
      <Card titulo="Total Pago" valor={moeda(dados.totalPago)} subtitulo="Baixas manuais + Conta Paga Omie no período" Icone={ArrowUpCircle} destaque="text-rose-700" onClick={()=>navigate("/financas/despesas")}/>
      <Card titulo="Saldo Projetado" valor={dados.saldoRealDisponivel?moeda(dados.saldoProjetado):"A informar"} subtitulo={dados.saldoRealDisponivel?"Saldo atual + receber - pagar":"Complete os saldos bancários"} Icone={TrendingUp} destaque={dados.saldoRealDisponivel?"text-slate-900":"text-amber-700"}/>
      <Card titulo="Notas no período" valor={moeda(dados.notas)} subtitulo={`${dados.notasQuantidade} documento(s) fiscal(is)`} Icone={FileText} onClick={()=>navigate("/financas/notas-fiscais")}/>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-semibold text-slate-900">Entradas x Saídas</h2><p className="text-xs text-slate-500">Valores efetivamente pagos/recebidos.</p></div>{serie.length===0?<p className="py-8 text-center text-sm text-slate-500">Sem movimentação realizada.</p>:<div className="space-y-4">{serie.map(x=><div key={x.mes}><div className="mb-1 flex justify-between text-xs text-slate-500"><span>{x.mes.split("-").reverse().join("/")}</span><span>{moeda(x.entradas)} · {moeda(x.saidas)}</span></div><div className="grid gap-1"><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-500" style={{width:`${x.entradas/maxSerie*100}%`}}/></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-rose-500" style={{width:`${x.saidas/maxSerie*100}%`}}/></div></div></div>)}</div>}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-semibold text-slate-900">Despesas por categoria</h2><p className="text-xs text-slate-500">Composição das despesas pagas no período.</p></div>{categorias.length===0?<p className="py-8 text-center text-sm text-slate-500">Sem despesas realizadas.</p>:<div className="space-y-3">{categorias.map(x=><div key={x.nome}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-slate-600">{x.nome}</span><span className="font-medium">{moeda(x.valor)}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-slate-700" style={{width:`${x.valor/maxCat*100}%`}}/></div></div>)}</div>}</div>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-semibold text-slate-900">Projeção do saldo</h2><p className="text-xs text-slate-500">Parte do saldo bancário atual e considera somente pendências futuras por vencimento.</p></div>{!dados.saldoRealDisponivel?<p className="py-8 text-center text-sm text-amber-700">Projeção indisponível enquanto houver saldo bancário não informado.</p>:evolucao.length<=1?<p className="py-8 text-center text-sm text-slate-500">Sem pendências futuras para montar a projeção.</p>:<div className="flex h-48 items-end gap-1 overflow-x-auto border-b border-slate-200 pb-1">{evolucao.map(x=>{const faixa=Math.max(maxSaldo-minSaldo,1),h=Math.max(4,Math.abs(x.saldo-minSaldo)/faixa*170);return <div key={x.data} className="group relative flex min-w-3 flex-1 items-end justify-center" title={`${x.data.split("-").reverse().join("/")} · ${moeda(x.saldo)}`}><div className="w-full max-w-6 rounded-t bg-sky-500" style={{height:`${h}px`}}/><span className="pointer-events-none absolute -top-6 hidden whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">{moeda(x.saldo)}</span></div>})}</div>}</div>
  </div>;
}
