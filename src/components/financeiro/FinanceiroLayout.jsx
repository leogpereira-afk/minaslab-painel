import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, FileText, Landmark, LineChart, Settings, ReceiptText, Users, BarChart3, ListChecks, ClipboardList, CalendarRange, RotateCcw } from "lucide-react";
import "./financeiro-redesign.css";

const PERIODO_KEY="financeiro.periodo.global.v1";
const CONTEXTO_CARD_KEY="financeiro.card.contexto.v1";
const principais=[
 {label:"Visão Geral",to:"/financas",end:true,icon:LayoutDashboard},
 {label:"Serviços Gerados",to:"/financas/servicos-gerados",icon:ClipboardList},
 {label:"Receber",to:"/financas/contas-a-receber",icon:ArrowDownCircle},
 {label:"Pagar",to:"/financas/contas-a-pagar",icon:ArrowUpCircle},
 {label:"Bancos",to:"/financas/movimentacao-conta",icon:Landmark},
 {label:"Conciliação",to:"/financas/conciliacao",icon:ListChecks},
 {label:"Notas",to:"/financas/notas-fiscais",icon:FileText},
];
const complementares=[
 {label:"Aplicações financeiras",curto:"Aplicações",to:"/financas/aplicacoes",icon:Landmark,descricao:"Aportes, resgates e rendimentos."},
 {label:"Retiradas dos sócios",curto:"Sócios",to:"/financas/socios",icon:Users,descricao:"Movimentações por favorecido e natureza."},
 {label:"Conferência financeira",curto:"Conferência",to:"/financas/conferencia",icon:ListChecks,descricao:"Datas, históricos e documentos para revisão."},
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
function selectPorRotulo(rotulo){return [...document.querySelectorAll(".financeiro-shell label")].find(el=>el.querySelector(".label")?.textContent?.trim()===rotulo)?.querySelector("select")||null}
function valorSelect(rotulo){return selectPorRotulo(rotulo)?.value||""}
function aplicarSelect(rotulo,valor){const el=selectPorRotulo(rotulo);if(!el)return false;const novo=String(valor??"");if(el.value===novo)return true;const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")?.set;if(setter)setter.call(el,novo);else el.value=novo;el.dispatchEvent(new Event("change",{bubbles:true}));return true}
export default function FinanceiroLayout(){
 const navigate=useNavigate(),location=useLocation();const [periodo,setPeriodo]=useState(periodoSalvo);const usaPeriodo=rotaPeriodo(location.pathname),listaPeriodo=rotaListaPeriodo(location.pathname),conciliacaoPeriodo=location.pathname.startsWith("/financas/conciliacao-titulos"),fluxo=location.pathname==="/financas/fluxo-caixa";
 useEffect(()=>{try{sessionStorage.setItem(PERIODO_KEY,JSON.stringify(periodo))}catch{void 0}},[periodo]);
 useEffect(()=>{if(!(location.pathname==="/financas/contas-a-receber"||location.pathname==="/financas/recebimentos"||location.pathname==="/financas/contas-a-pagar"||location.pathname==="/financas/despesas"))return;let contexto=null;try{contexto=JSON.parse(sessionStorage.getItem(CONTEXTO_CARD_KEY)||"null")}catch{contexto=null}if(!contexto)return;const timer=setTimeout(()=>{if(contexto.empresa!==undefined)aplicarSelect("Empresa",contexto.empresa);if(contexto.status)aplicarSelect("Status",contexto.status);if(contexto.ano){aplicarSelect("Ano",contexto.ano);setTimeout(()=>{if(contexto.mes)aplicarSelect("Mês",contexto.mes);try{sessionStorage.removeItem(CONTEXTO_CARD_KEY)}catch{void 0}},0)}else{try{sessionStorage.removeItem(CONTEXTO_CARD_KEY)}catch{void 0}}},0);return()=>clearTimeout(timer)},[location.pathname]);
 function guardarPeriodo(n){try{sessionStorage.setItem(PERIODO_KEY,JSON.stringify(n))}catch{void 0}setPeriodo(n)}
 function setData(campo,valor){const n={...periodo,[campo]:valor};if(n.de&&n.ate&&n.de>n.ate){if(campo==="de")n.ate=valor;else n.de=valor}guardarPeriodo(n)}
 function definirMesAtual(){guardarPeriodo(mesAtual())}
 function limparPeriodo(){guardarPeriodo({de:"",ate:""})}
 function abrirContexto(destino,{status="",mes=false}={}){const empresa=valorSelect("Empresa");const atual=mesAtual();const contexto={empresa,status};if(mes){contexto.ano=atual.de.slice(0,4);contexto.mes=String(Number(atual.de.slice(5,7)));guardarPeriodo(atual)}else limparPeriodo();try{sessionStorage.setItem(CONTEXTO_CARD_KEY,JSON.stringify(contexto))}catch{void 0}navigate(destino)}
 function capturarCliqueContextual(e){if(location.pathname!=="/financas")return;const botao=e.target.closest("button");if(!botao)return;const texto=String(botao.textContent||"").replace(/\s+/g," ").trim();if(texto.includes("Contas a receber vencidas")){e.preventDefault();e.stopPropagation();abrirContexto("/financas/contas-a-receber",{status:"VENCIDO"});return}if(texto.includes("Contas a pagar vencidas")){e.preventDefault();e.stopPropagation();abrirContexto("/financas/contas-a-pagar",{status:"VENCIDO"});return}if(texto.includes("A receber no mês")){e.preventDefault();e.stopPropagation();abrirContexto("/financas/contas-a-receber",{mes:true});return}if(texto.includes("A pagar no mês")){e.preventDefault();e.stopPropagation();abrirContexto("/financas/contas-a-pagar",{mes:true});return}if(texto.includes("Vencidos")){e.preventDefault();e.stopPropagation();abrirContexto("/financas/contas-a-receber",{status:"VENCIDO"})}}
 const classes=["financeiro-shell","space-y-4",listaPeriodo?"financeiro-periodo-listas":"",conciliacaoPeriodo?"financeiro-periodo-conciliacao":"",fluxo?"financeiro-fluxo":""].filter(Boolean).join(" ");
 return <div className={classes} onClickCapture={capturarCliqueContextual}>
  <nav className="financeiro-navegacao" aria-label="Menu financeiro">
   {[principais,complementares].map((grupo,i)=><div className="financeiro-nav-linha" key={i}>
    {grupo.map(({label,curto,to,end,icon:Icon,descricao})=><NavLink key={to} to={to} end={end} aria-label={label} title={descricao?`${label}: ${descricao}`:label} className={`financeiro-nav-link${ativa(location,label,to)?" financeiro-nav-link-ativo":""}`}>
     <Icon size={18} aria-hidden="true"/><span>{curto||label}</span>
    </NavLink>)}
   </div>)}
  </nav>
  {usaPeriodo&&<section className="financeiro-periodo-bar flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600"><CalendarRange size={19}/></span><div><p className="text-sm font-bold text-slate-900">Período</p><p className="text-xs text-slate-500">Filtra os registros pela data da tela, sem limitar a um único mês.</p></div></div><div className="grid gap-2 sm:grid-cols-[160px_160px_auto_auto]"><label><span className="label">De</span><input className="input" type="date" value={periodo.de} onChange={e=>setData("de",e.target.value)}/></label><label><span className="label">Até</span><input className="input" type="date" value={periodo.ate} onChange={e=>setData("ate",e.target.value)}/></label><button type="button" className="btn-outline self-end" onClick={definirMesAtual}>Este mês</button><button type="button" className="btn-ghost self-end" onClick={limparPeriodo}><RotateCcw size={15}/>Todo período</button></div></section>}
  {location.pathname.startsWith("/financas/notas-fiscais")&&<section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm"><div><p className="font-bold text-slate-900">Central de Notas Fiscais</p><p className="text-sm text-slate-500">MinasLab acompanha as notas da Omie; M Lab emite e gerencia NFS-e pelo sistema.</p></div><button className="btn-primary" onClick={()=>navigate("/financas/notas-fiscais/emitir")}><ReceiptText size={16}/>Emitir NFS-e M Lab</button></section>}
  <Outlet key={`${location.pathname}|${usaPeriodo?periodo.de:""}|${usaPeriodo?periodo.ate:""}`}/>
 </div>;
}