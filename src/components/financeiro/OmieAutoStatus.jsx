import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, Radio } from "lucide-react";
import { omieAutoEstado, omieAutoSincronizarAgora } from "../../services/omieAuto.js";

const dataHora=(v)=>v?new Date(v).toLocaleString("pt-BR") : "Ainda não concluída";

export default function OmieAutoStatus({compacto=false,onAtualizado}){
  const [estado,setEstado]=useState(null),[erro,setErro]=useState(""),[rodando,setRodando]=useState(false);
  const carregar=useCallback(async()=>{try{setErro("");setEstado(await omieAutoEstado())}catch(e){setErro(e.message)}},[]);
  useEffect(()=>{carregar();const t=setInterval(carregar,60000);return()=>clearInterval(t)},[carregar]);
  async function sincronizar(){setRodando(true);setErro("");try{await omieAutoSincronizarAgora();await carregar();onAtualizado?.()}catch(e){setErro(e.message);await carregar()}finally{setRodando(false)}}
  const executando=rodando||estado?.em_execucao,ok=estado?.status==="CONCLUIDO",falha=estado?.status==="ERRO";
  return <div className={`rounded-2xl border ${falha?"border-red-200 bg-red-50":"border-emerald-200 bg-emerald-50"} ${compacto?"p-3":"p-4"}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">Omie MinasLab</b><span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-semibold text-emerald-700"><Radio size={12}/>Automático · 15 min</span>{executando?<span className="text-xs font-semibold text-sky-700">Sincronizando...</span>:ok?<span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13}/>Atualizado</span>:falha?<span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700"><AlertTriangle size={13}/>Falha na última execução</span>:null}</div><p className="mt-1 text-xs text-slate-600">Última sincronização: {dataHora(estado?.finalizado_em)}</p>{erro&&<p className="mt-1 text-xs text-red-700">{erro}</p>}{falha&&estado?.mensagem&&<p className="mt-1 text-xs text-red-700">{estado.mensagem}</p>}</div><button type="button" className="btn-outline shrink-0" disabled={executando} onClick={sincronizar}><RefreshCw size={15} className={executando?"animate-spin":""}/>{executando?"Sincronizando...":"Sincronizar agora"}</button></div>
  </div>
}
