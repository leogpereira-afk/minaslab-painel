import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, FileText, Landmark, LineChart, Settings, ReceiptText, Users, BarChart3, ChevronDown, MoreHorizontal, ListChecks, ClipboardList, CalendarRange, RotateCcw } from "lucide-react";
import "./financeiro-redesign.css";

const PERIODO_KEY="financeiro.periodo.global.v1";
const principais=[
 {label:"Visão Geral",to:"/financas",end:true,icon:LayoutDashboard},
 {label:"Serviços Gerados",to:"/financas/servicos-gerados",icon:ClipboardList},
 {label:"Receber",to:"/financas/contas-a-receber",icon:ArrowDownCircle},
 {label:"Pagar",to:"/financas/contas-a-pagar",icon:ArrowUpCircle},
 {label:"Bancos",to:"/financas/movimentacao-conta",icon:Landmark},
 {label:"Conciliação",to:"/financas/conciliacao",icon:ListChecks},
 {label:"Notas",to:"/financas/notas-fiscais",icon:FileText},
];
const mais=[
 {label:"Aplicações financeiras",to:"/financas/aplicacoes",icon:Landmark,descricao:"Aportes, resgates e rendimentos."},
 {label:"Retiradas dos sócios",to:"/financas/socios",icon:Users,descricao:"Movimentações por favorecido e natureza."},
 {label:"Conferência financeira",to:"/financas/conferencia",icon:ListChecks,descricao:"Datas, históricos e documentos para revisão."},
 {label:"Fluxo de Caixa",to:"/financas/fluxo-caixa",icon:LineChart,descricao:"Previsto, realizado e projeção financeira."},
 {label:"Relatórios",to:"/financas/relatorios",icon:BarChart3,descricao:"Análises e exportações financeiras."},
 {label:"Clientes",to:"/financas/clientes",icon:Users,descricao:"Cadastro financeiro de clientes."},
 {label:"Configurações",to:"/financas/configuracoes",icon:Settings,descricao:"Contas, categorias e parâmetros do Financeiro."},
];
function ativa(location,label,to){const p=location.pathname;if(label==="Visão Geral")return p===to;if(label==="Receber")return p===to||p==="/financas/recebimentos";if(label==="Pagar")return p===to||p==="/financas/despesas";if(label==="Bancos")return p===to||p==="/financas/bancos"||p==="/financas/extrato";if(label==="Conciliação")return p===to||p.startsWith("/financas/conciliacao-titulos");if(label==="Notas")return p.startsWith("/financas/notas-fiscais");return p===to||p.startsWith(`${to}/`)}
function periodoSalvo(){try{const p=JSON.parse(sessionStorage.getItem(PERIODO_KEY)||"{}");return{de:String(p?.de||""),ate:String(p?.ate||"")}}catch{return{de:"",ate:""}}}
function mesAtual(){const d=new Date(),a=d.getFullYear(),m=d.getMonth()+1,mm=String(m).padStart(2,"0"),ultimo=new Date(a,m,0).getDate();return{de:`${a}-${mm}-01`,ate:`${a}-${mm}-${String(ultimo).padStart(2,"0")}`}}
function rotaPeriodo(p){return p==="/financas/contas-a-receber"||p==="/financas/recebimentos"||p==="/financas/contas-a-pagar"||p==="/financas/despesas"||p==="/financas/notas-fiscais"||p.startsWith("/financas/conciliacao-titulos")}
function rotaListaPeriodo(p){return p==="/financas/contas-a-receber"||p==="/financas/recebimentos"||p==="/financas/contas-a-pagar"||p==="/financas/despesas"||p==="/financas/notas-fiscais"}
export default function FinanceiroLayout(){
 const navigate=useNavigate(),location=useLocation(),ref=useRef(null);const [aberto,setAberto]=useState(false);const [periodo,setPeriodo]=useState(periodoSalvo);const emMais=mais.some(x=>ativa(location,x.label,x.to));const usaPeriodo=rotaPeriodo(location.pathname),listaPeriodo=rotaListaPeriodo(location.pathname),conciliacaoPeriodo=location.pathname.startsWith("/financas/conciliacao-titulos"),fluxo=location.pathname==="/financas/fluxo-caixa";
 useEffect(()=>setAberto(false),[location.pathname]);useEffect(()=>{const f=e=>{if(ref.current&&!ref.current.contains(e.target))setAberto(false)};document.addEventListener("mousedown",f);return()=>document.removeEventListener("mousedown",f)},[]);
 useEffect(()=>{try{sessionStorage.setItem(PERIODO_KEY,JSON.stringify(periodo))}catch{void 0}},[periodo]);
 function guardarPeriodo(n){try{sessionStorage.setItem(PERIODO_KEY,JSON.stringify(n))}catch{void 0}setPeriodo(n)}
 function setData(campo,valor){const n={...periodo,[campo]:valor};if(n.de&&n.ate&&n.de>n.ate){if(campo==="de")n.ate=valor;else n.de=valor}guardarPeriodo(n)}
 function definirMesAtual(){guardarPeriodo(mesAtual())}
 function limparPeriodo(){guardarPeriodo({de:"",ate:""})}
 const classes=["financeiro-shell","space-y-4",listaPeriodo?"financeiro-periodo-listas":"",conciliacaoPeriodo?"financeiro-periodo-conciliacao":"",fluxo?"financeiro-fluxo":""].filter(Boolean).join(" ");
 return <div className={classes}>
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-1 px-3 py-2"><nav className="min-w-0 flex-1 overflow-x-auto"><div className="flex min-w-max items-center gap-1">{principais.map(({label,to,end,icon:Icon})=>{const a=ativa(location,label,to);return <NavLink key={to} to={to} end={end} className={`flex min-w-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${a?"bg-blue-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={16}/><span>{label}</span></NavLink>})}</div></nav><div className="relative shrink-0" ref={ref}><button onClick={()=>setAberto(v=>!v)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${emMais?"bg-blue-50 text-blue-700":"text-slate-600 hover:bg-slate-50"}`}><MoreHorizontal size={16}/>Mais<ChevronDown size={14} className={aberto?"rotate-180":""}/></button>{aberto&&<div className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border bg-white p-2 shadow-xl">{mais.map(({label,to,icon:Icon,descricao})=><button key={to} onClick={()=>navigate(to)} className="flex w-full gap-3 rounded-xl p-3 text-left hover:bg-slate-50"><span className="rounded-lg bg-slate-50 p-2"><Icon size={16}/></span><span><b className="block text-sm">{label}</b><small className="text-slate-500">{descricao}</small></span></button>)}</div>}</div></div></section>
  {usaPeriodo&&<section className="financeiro-periodo-bar flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600"><CalendarRange size={19}/></span><div><p className="text-sm font-bold text-slate-900">Período</p><p className="text-xs text-slate-500">Filtra os registros pela data da tela, sem limitar a um único mês.</p></div></div><div className="grid gap-2 sm:grid-cols-[160px_160px_auto_auto]"><label><span className="label">De</span><input className="input" type="date" value={periodo.de} onChange={e=>setData("de",e.target.value)}/></label><label><span className="label">Até</span><input className="input" type="date" value={periodo.ate} onChange={e=>setData("ate",e.target.value)}/></label><button type="button" className="btn-outline self-end" onClick={definirMesAtual}>Este mês</button><button type="button" className="btn-ghost self-end" onClick={limparPeriodo}><RotateCcw size={15}/>Todo período</button></div></section>}
  {location.pathname.startsWith("/financas/notas-fiscais")&&<section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm"><div><p className="font-bold text-slate-900">Central de Notas Fiscais</p><p className="text-sm text-slate-500">MinasLab acompanha as notas da Omie; M Lab emite e gerencia NFS-e pelo sistema.</p></div><button className="btn-primary" onClick={()=>navigate("/financas/notas-fiscais/emitir")}><ReceiptText size={16}/>Emitir NFS-e M Lab</button></section>}
  <Outlet key={`${location.pathname}|${usaPeriodo?periodo.de:""}|${usaPeriodo?periodo.ate:""}`}/>
 </div>;
}