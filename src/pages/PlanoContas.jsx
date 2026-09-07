import {useEffect,useMemo,useState} from "react";
import {ArrowLeft,BookOpen,RefreshCw,Search,Settings} from "lucide-react";
import {useNavigate} from "react-router-dom";
import {PageTitle} from "../components/ui.jsx";
import {finConfigListar} from "../services/financeiro.js";

const normaliza=v=>(v||"").toString().toLocaleLowerCase("pt-BR");

export default function PlanoContas(){
  const navigate=useNavigate();
  const[dados,setDados]=useState({empresas:[],categorias:[]});
  const[empresa,setEmpresa]=useState("");
  const[tipo,setTipo]=useState("TODOS");
  const[busca,setBusca]=useState("");
  const[carregando,setCarregando]=useState(true);
  const[erro,setErro]=useState("");

  async function carregar(){
    setCarregando(true);setErro("");
    try{
      const d=await finConfigListar();
      setDados({empresas:d.empresas||[],categorias:d.categorias||[]});
      if(!empresa&&d.empresas?.[0]?.id)setEmpresa(d.empresas[0].id);
    }catch(e){setErro(e.message||"Não foi possível carregar o plano de contas.")}
    finally{setCarregando(false)}
  }
  useEffect(()=>{carregar()},[]);

  const categorias=useMemo(()=>{
    const q=normaliza(busca);
    return (dados.categorias||[]).filter(c=>{
      if(c.ativa===false)return false;
      if(empresa&&c.empresa_id!==empresa)return false;
      if(tipo!=="TODOS"&&c.tipo!==tipo)return false;
      if(!c.origem_plano||!c.fluxo||!c.agrupamento||!c.grupo)return false;
      if(q&&!normaliza([c.nome,c.fluxo,c.agrupamento,c.grupo].join(" ")).includes(q))return false;
      return true;
    }).sort((a,b)=>(a.ordem_plano??9999)-(b.ordem_plano??9999)||a.nome.localeCompare(b.nome,"pt-BR"));
  },[dados.categorias,empresa,tipo,busca]);

  const hierarquia=useMemo(()=>{
    const fluxos=new Map();
    for(const c of categorias){
      if(!fluxos.has(c.fluxo))fluxos.set(c.fluxo,new Map());
      const agrs=fluxos.get(c.fluxo);
      if(!agrs.has(c.agrupamento))agrs.set(c.agrupamento,new Map());
      const grupos=agrs.get(c.agrupamento);
      if(!grupos.has(c.grupo))grupos.set(c.grupo,[]);
      grupos.get(c.grupo).push(c);
    }
    return [...fluxos.entries()];
  },[categorias]);

  const receitas=categorias.filter(x=>x.tipo==="RECEITA").length;
  const despesas=categorias.filter(x=>x.tipo==="DESPESA").length;
  const empresaNome=dados.empresas.find(x=>x.id===empresa)?.nome||"Todas";

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><button className="btn-ghost h-9 w-9 p-0" onClick={()=>navigate("/financas")}><ArrowLeft size={18}/></button><PageTitle titulo="Plano de Contas" descricao="Estrutura oficial de classificação financeira da MinasLab e M Lab."/></div>
      <button className="btn-outline" onClick={()=>navigate("/financas/configuracoes")}><Settings size={16}/>Gerenciar cadastros</button>
    </div>

    {erro&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

    <section className="rounded-2xl border bg-white p-5">
      <div className="grid gap-3 md:grid-cols-4">
        <label><span className="label">Empresa</span><select className="input" value={empresa} onChange={e=>setEmpresa(e.target.value)}>{dados.empresas.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>
        <label><span className="label">Tipo</span><select className="input" value={tipo} onChange={e=>setTipo(e.target.value)}><option value="TODOS">Receitas e despesas</option><option value="RECEITA">Receitas</option><option value="DESPESA">Despesas</option></select></label>
        <label className="md:col-span-2"><span className="label">Pesquisar</span><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className="input pl-9" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Conta, grupo, agrupamento ou fluxo"/></div></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1 font-medium">{empresaNome}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{receitas} receitas</span><span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">{despesas} despesas</span><span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">{categorias.length} contas ativas</span><button className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-slate-800" onClick={carregar}><RefreshCw size={14}/>{carregando?"Atualizando...":"Atualizar"}</button></div>
    </section>

    {carregando?<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Carregando Plano de Contas...</div>:
    hierarquia.length===0?<div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Nenhuma conta encontrada para os filtros selecionados.</div>:
    <div className="space-y-4">{hierarquia.map(([fluxo,agrs])=><section key={fluxo} className="overflow-hidden rounded-2xl border bg-white">
      <div className="flex items-center gap-2 border-b bg-slate-900 px-5 py-3 text-white"><BookOpen size={17}/><h2 className="font-bold">{fluxo}</h2></div>
      <div className="divide-y">{[...agrs.entries()].map(([agrupamento,grupos])=><div key={agrupamento} className="p-4"><h3 className="mb-3 text-sm font-bold text-slate-800">{agrupamento}</h3><div className="grid gap-3 xl:grid-cols-2">{[...grupos.entries()].map(([grupo,itens])=><div key={grupo} className="rounded-xl border bg-slate-50 p-3"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{grupo}</div><div className="space-y-1">{itens.map(c=><div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm"><span><span className="mr-2 text-xs tabular-nums text-slate-400">{String(c.ordem_plano||"").padStart(2,"0")}</span>{c.nome}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.tipo==="RECEITA"?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>{c.tipo}</span></div>)}</div></div>)}</div></div>)}</div>
    </section>)}</div>}
  </div>
}
