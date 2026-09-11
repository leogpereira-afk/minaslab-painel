import { useEffect, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";

const fmt=v=>v?new Date(`${v}T12:00:00`).toLocaleDateString("pt-BR"):"";

export default function PeriodoFiltro({de="",ate="",onApply,label="Período"}){
  const [aberto,setAberto]=useState(false),[inicio,setInicio]=useState(de),[fim,setFim]=useState(ate);
  const ref=useRef(null);
  useEffect(()=>{if(!aberto){setInicio(de||"");setFim(ate||"")}},[de,ate,aberto]);
  useEffect(()=>{if(!aberto)return;const fechar=e=>{if(ref.current&&!ref.current.contains(e.target))setAberto(false)};document.addEventListener("mousedown",fechar);return()=>document.removeEventListener("mousedown",fechar)},[aberto]);
  const ativo=!!(de||ate),texto=ativo?`${de?fmt(de):"…"} → ${ate?fmt(ate):"…"}`:label;
  return <div ref={ref} className="relative inline-block">
    <button type="button" onClick={()=>setAberto(v=>!v)} className={`flex h-7 min-w-[82px] items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-medium ${ativo?"border-blue-300 bg-blue-50 text-blue-700":"border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`} title={ativo?texto:label}><CalendarDays size={12}/><span className="max-w-[92px] truncate">{texto}</span></button>
    {aberto&&<div className="absolute left-0 top-9 z-50 w-[286px] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
      <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-700">{label}</span>{ativo&&<button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Limpar período" onClick={()=>{setInicio("");setFim("");onApply("","");setAberto(false)}}><X size={13}/></button>}</div>
      <div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-semibold uppercase text-slate-500">De<input type="date" className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[11px] font-normal text-slate-700" value={inicio} onChange={e=>setInicio(e.target.value)}/></label><label className="text-[9px] font-semibold uppercase text-slate-500">Até<input type="date" className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[11px] font-normal text-slate-700" value={fim} onChange={e=>setFim(e.target.value)}/></label></div>
      <div className="mt-3 flex justify-end gap-2"><button type="button" className="rounded-md border px-3 py-1.5 text-[10px] font-semibold text-slate-600" onClick={()=>setAberto(false)}>Cancelar</button><button type="button" className="rounded-md bg-teal-600 px-3 py-1.5 text-[10px] font-semibold text-white" onClick={()=>{onApply(inicio,fim);setAberto(false)}}>Aplicar período</button></div>
    </div>}
  </div>
}
