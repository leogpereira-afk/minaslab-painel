import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, FileText, Landmark, LineChart, Settings, ReceiptText, Users, BarChart3, ChevronDown, MoreHorizontal, ListChecks } from "lucide-react";
import "./financeiro-redesign.css";

const principais=[
 {label:"Visão Geral",to:"/financas",end:true,icon:LayoutDashboard},
 {label:"Receber",to:"/financas/contas-a-receber",icon:ArrowDownCircle},
 {label:"Pagar",to:"/financas/contas-a-pagar",icon:ArrowUpCircle},
 {label:"Bancos",to:"/financas/movimentacao-conta",icon:Landmark},
 {label:"Conciliação",to:"/financas/conciliacao",icon:ListChecks},
 {label:"Notas",to:"/financas/notas-fiscais",icon:FileText},
];
const mais=[
 {label:"Fluxo de Caixa",to:"/financas/fluxo-caixa",icon:LineChart,descricao:"Previsto, realizado e projeção financeira."},
 {label:"Relatórios",to:"/financas/relatorios",icon:BarChart3,descricao:"Análises e exportações financeiras."},
 {label:"Clientes",to:"/financas/clientes",icon:Users,descricao:"Cadastro financeiro de clientes."},
 {label:"Configurações",to:"/financas/configuracoes",icon:Settings,descricao:"Contas, categorias e parâmetros do Financeiro."},
];
function ativa(location,label,to){const p=location.pathname;if(label==="Receber")return p===to||p==="/financas/recebimentos";if(label==="Pagar")return p===to||p==="/financas/despesas";if(label==="Bancos")return p===to||p==="/financas/bancos"||p==="/financas/extrato";if(label==="Conciliação")return p===to||p.startsWith("/financas/conciliacao-titulos");if(label==="Notas")return p.startsWith("/financas/notas-fiscais");return p===to||p.startsWith(`${to}/`)}
export default function FinanceiroLayout(){
 const navigate=useNavigate(),location=useLocation(),ref=useRef(null);const [aberto,setAberto]=useState(false);const emMais=mais.some(x=>ativa(location,x.label,x.to));
 useEffect(()=>setAberto(false),[location.pathname]);useEffect(()=>{const f=e=>{if(ref.current&&!ref.current.contains(e.target))setAberto(false)};document.addEventListener("mousedown",f);return()=>document.removeEventListener("mousedown",f)},[]);
 return <div className="financeiro-shell space-y-4">
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-1 px-3 py-2"><nav className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1">{principais.map(({label,to,end,icon:Icon})=>{const a=ativa(location,label,to);return <NavLink key={to} to={to} end={end} className={`flex min-w-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${a?"bg-blue-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={16}/><span>{label}</span></NavLink>})}</div></nav><div className="relative shrink-0" ref={ref}><button onClick={()=>setAberto(v=>!v)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${emMais?"bg-blue-50 text-blue-700":"text-slate-600 hover:bg-slate-50"}`}><MoreHorizontal size={16}/>Mais<ChevronDown size={14} className={aberto?"rotate-180":""}/></button>{aberto&&<div className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border bg-white p-2 shadow-xl">{mais.map(({label,to,icon:Icon,descricao})=><button key={to} onClick={()=>navigate(to)} className="flex w-full gap-3 rounded-xl p-3 text-left hover:bg-slate-50"><span className="rounded-lg bg-slate-50 p-2"><Icon size={16}/></span><span><b className="block text-sm">{label}</b><small className="text-slate-500">{descricao}</small></span></button>)}</div>}</div></div></section>
  {location.pathname.startsWith("/financas/notas-fiscais")&&<section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm"><div><p className="font-bold text-slate-900">Central de Notas Fiscais</p><p className="text-sm text-slate-500">MinasLab acompanha as notas da Omie; M Lab emite e gerencia NFS-e pelo sistema.</p></div><button className="btn-primary" onClick={()=>navigate("/financas/notas-fiscais/emitir")}><ReceiptText size={16}/>Emitir NFS-e M Lab</button></section>}
  <Outlet/>
 </div>;
}