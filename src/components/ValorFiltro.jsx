import { useEffect, useRef, useState } from "react";
import { CircleDollarSign, X } from "lucide-react";

const fmt=v=>v!==""&&v!=null?Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}):"";

export default function ValorFiltro({min="",max="",onApply,label="Valor"}){
  const [aberto,setAberto]=useState(false),[minimo,setMinimo]=useState(min),[maximo,setMaximo]=useState(max);
  const ref=useRef(null);
  useEffect(()=>{if(!aberto){setMinimo(min||"");setMaximo(max||"")}},[min,max,aberto]);
  useEffect(()=>{if(!aberto)return;const fechar=e=>{if(ref.current&&!ref.current.contains(e.target))setAberto(false)};document.addEventListener("mousedown",fechar);return()=>document.removeEventListener("mousedown",fechar)},[aberto]);
  const ativo=!!(min||max),texto=ativo?`${min?`R$ ${fmt(min)}`:"…"} → ${max?`R$ ${fmt(max)}`:"…"}`:label;
  return <div ref={ref} className="relative inline-block">
    <button type="button" onClick={()=>setAberto(v=>!v)} className={`flex h-7 min-w-[78px] items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-medium ${ativo?"border-blue-300 bg-blue-50 text-blue-700":"border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`} title={texto}><CircleDollarSign size={12}/><span className="max-w-[90px] truncate">{texto}</span></button>
    {aberto&&<div className="absolute right-0 top-9 z-50 w-[270px] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
      <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-700">Faixa de valor</span>{ativo&&<button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100" title="Limpar valores" onClick={()=>{setMinimo("");setMaximo("");onApply("","");setAberto(false)}}><X size={13}/></button>}</div>
      <div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-semibold uppercase text-slate-500">Mínimo<input type="number" step="0.01" className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[11px] font-normal text-slate-700" value={minimo} onChange={e=>setMinimo(e.target.value)}/></label><label className="text-[9px] font-semibold uppercase text-slate-500">Máximo<input type="number" step="0.01" className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[11px] font-normal text-slate-700" value={maximo} onChange={e=>setMaximo(e.target.value)}/></label></div>
      <div className="mt-3 flex justify-end gap-2"><button type="button" className="rounded-md border px-3 py-1.5 text-[10px] font-semibold text-slate-600" onClick={()=>setAberto(false)}>Cancelar</button><button type="button" className="rounded-md bg-teal-600 px-3 py-1.5 text-[10px] font-semibold text-white" onClick={()=>{onApply(minimo,maximo);setAberto(false)}}>Aplicar valor</button></div>
    </div>}
  </div>
}
