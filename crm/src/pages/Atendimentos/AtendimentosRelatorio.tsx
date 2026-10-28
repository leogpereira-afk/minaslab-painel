// Relatório de atendimentos do ChatPro por atendente e período.
// Conta pelas sessões do ChatPro (uma por conversa aberta/finalizada), então o
// histórico de quem saiu continua no nome dela e quem entra conta a partir do
// dia em que passou a atender.
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageShell } from '../../components/ui/PageShell'
import { supabase } from '../../services/supabase'

type Sessao={id:string;lead_id:string|null;aberta:boolean|null;aberta_em:string|null;finalizada_em:string|null;responsavel_chatpro:string|null;finalizado_por_chatpro:string|null;motivo_id:string|null;nps:string|null;nps_nota:number|null}
type Usuario={id:string;nome:string|null;email:string|null;ativo:boolean|null}
type Motivo={id:string;nome:string|null}
type Lead={id:string;nome:string|null;empresa_contato:string|null;telefone_whatsapp:string|null}
type Linha={id:string;nome:string;inativo:boolean;recebidos:number;finalizados:number;abertosAgora:number;horas:number[];nps:number[];motivos:Record<string,number>}

const SEM='__sem__'
const CAMPOS='id,lead_id,aberta,aberta_em,finalizada_em,responsavel_chatpro,finalizado_por_chatpro,motivo_id,nps,nps_nota'
const hoje=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const inicioMes=()=>hoje().slice(0,8)+'01'
const quando=(v:string|null)=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v)):'—'
const media=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null
const duracao=(h:number|null)=>h==null?'—':h<1?`${Math.round(h*60)} min`:h<48?`${h.toFixed(1).replace('.',',')} h`:`${(h/24).toFixed(1).replace('.',',')} dias`
const notaNps=(s:Sessao)=>{const n=Number(s.nps);if(Number.isFinite(n)&&String(s.nps??'').trim()!=='')return n;return s.nps_nota&&s.nps_nota>0?s.nps_nota:null}

async function todas(montar:(de:number,ate:number)=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>){
 const linhas:Sessao[]=[]
 for(let de=0;;de+=1000){const r=await montar(de,de+999);if(r.error)throw new Error(r.error.message);const lote=(r.data??[]) as Sessao[];linhas.push(...lote);if(lote.length<1000)return linhas}
}
function baixarCsv(nome:string,linhas:(string|number)[][]){
 const csv=linhas.map(l=>l.map(c=>{const t=String(c??'');return /[";\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t}).join(';')).join('\n')
 const url=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}))
 const a=document.createElement('a');a.href=url;a.download=nome;a.click();URL.revokeObjectURL(url)
}

export function AtendimentosRelatorio(){
 const[de,setDe]=useState(inicioMes),[ate,setAte]=useState(hoje)
 const[sessoes,setSessoes]=useState<Sessao[]>([]),[abertas,setAbertas]=useState<Sessao[]>([]),[usuarios,setUsuarios]=useState<Usuario[]>([]),[motivos,setMotivos]=useState<Motivo[]>([]),[leads,setLeads]=useState<Record<string,Lead>>({})
 const[carregando,setCarregando]=useState(true),[erro,setErro]=useState(''),[atendente,setAtendente]=useState('')

 async function carregar(){
  setCarregando(true);setErro('')
  try{
   const ini=new Date(`${de}T00:00:00`).toISOString(),fim=new Date(`${ate}T23:59:59.999`).toISOString()
   const[s,a,u,m]=await Promise.all([
    todas((x,y)=>supabase.from('chatpro_sessoes').select(CAMPOS).or(`and(aberta_em.gte.${ini},aberta_em.lte.${fim}),and(finalizada_em.gte.${ini},finalizada_em.lte.${fim})`).order('id').range(x,y)),
    todas((x,y)=>supabase.from('chatpro_sessoes').select(CAMPOS).eq('aberta',true).order('id').range(x,y)),
    supabase.from('chatpro_usuarios').select('id,nome,email,ativo'),
    supabase.from('chatpro_motivos').select('id,nome'),
   ])
   if(u.error)throw new Error(u.error.message);if(m.error)throw new Error(m.error.message)
   setSessoes(s);setAbertas(a);setUsuarios((u.data??[]) as Usuario[]);setMotivos((m.data??[]) as Motivo[])
   // Nome/empresa dos atendimentos finalizados no período, para a lista de detalhe.
   const ids=[...new Set(s.map(x=>x.lead_id).filter((x):x is string=>!!x))],mapa:Record<string,Lead>={}
   for(let i=0;i<ids.length;i+=200){const r=await supabase.from('leads').select('id,nome,empresa_contato,telefone_whatsapp').in('id',ids.slice(i,i+200));if(r.error)throw new Error(r.error.message);for(const l of (r.data??[]) as Lead[])mapa[l.id]=l}
   setLeads(mapa)
  }catch(e){setErro(e instanceof Error?e.message:String(e))}
  setCarregando(false)
 }
 useEffect(()=>{void carregar()},[]) // eslint-disable-line react-hooks/exhaustive-deps

 const nomeUsuario=(id:string|null)=>{if(!id)return 'Sem atendente';const u=usuarios.find(x=>x.id===id);return u?.nome||u?.email||'Usuário removido do ChatPro'}
 const nomeMotivo=(id:string|null)=>id?(motivos.find(x=>x.id===id)?.nome||'Outro'):'Sem motivo'
 const ini=+new Date(`${de}T00:00:00`),fim=+new Date(`${ate}T23:59:59.999`)
 const noPeriodo=(v:string|null)=>!!v&&+new Date(v)>=ini&&+new Date(v)<=fim
 const finalizadas=useMemo(()=>sessoes.filter(s=>s.aberta===false&&noPeriodo(s.finalizada_em)),[sessoes,de,ate]) // eslint-disable-line react-hooks/exhaustive-deps

 const linhas=useMemo(()=>{
  const m=new Map<string,Linha>()
  const pegar=(id:string|null)=>{const k=id||SEM;let l=m.get(k);if(!l){const u=usuarios.find(x=>x.id===id);l={id:k,nome:nomeUsuario(id),inativo:u?.ativo===false,recebidos:0,finalizados:0,abertosAgora:0,horas:[],nps:[],motivos:{}};m.set(k,l)}return l}
  for(const s of sessoes)if(noPeriodo(s.aberta_em))pegar(s.responsavel_chatpro).recebidos++
  for(const s of finalizadas){const l=pegar(s.finalizado_por_chatpro||s.responsavel_chatpro);l.finalizados++;const mot=nomeMotivo(s.motivo_id);l.motivos[mot]=(l.motivos[mot]||0)+1;if(s.aberta_em&&s.finalizada_em){const h=(+new Date(s.finalizada_em)-+new Date(s.aberta_em))/36e5;if(h>=0)l.horas.push(h)}const n=notaNps(s);if(n!=null)l.nps.push(n)}
  for(const s of abertas)pegar(s.responsavel_chatpro).abertosAgora++
  return [...m.values()].sort((a,b)=>(a.id===SEM?1:0)-(b.id===SEM?1:0)||b.finalizados-a.finalizados||b.recebidos-a.recebidos)
 },[sessoes,abertas,finalizadas,usuarios,motivos]) // eslint-disable-line react-hooks/exhaustive-deps

 const nomesMotivos=useMemo(()=>[...new Set(linhas.flatMap(l=>Object.keys(l.motivos)))].sort(),[linhas])
 const total=linhas.reduce((t,l)=>({recebidos:t.recebidos+l.recebidos,finalizados:t.finalizados+l.finalizados,abertos:t.abertos+l.abertosAgora}),{recebidos:0,finalizados:0,abertos:0})
 const detalhe=finalizadas.filter(s=>!atendente||(s.finalizado_por_chatpro||s.responsavel_chatpro||SEM)===atendente).sort((a,b)=>+new Date(b.finalizada_em||0)-+new Date(a.finalizada_em||0))

 function exportarResumo(){baixarCsv(`atendimentos-por-atendente_${de}_a_${ate}.csv`,[['Atendente','Recebidos no período','Finalizados no período','Em aberto agora','Tempo médio até finalizar (h)','NPS médio',...nomesMotivos],...linhas.map(l=>[l.nome+(l.inativo?' (inativo)':''),l.recebidos,l.finalizados,l.abertosAgora,media(l.horas)?.toFixed(1).replace('.',',')??'',media(l.nps)?.toFixed(1).replace('.',',')??'',...nomesMotivos.map(n=>l.motivos[n]||0)])])}
 function exportarDetalhe(){baixarCsv(`atendimentos-finalizados_${de}_a_${ate}.csv`,[['Finalizado em','Aberto em','Atendente','Cliente / contato','Empresa','Telefone','Motivo','NPS'],...detalhe.map(s=>{const l=s.lead_id?leads[s.lead_id]:undefined;return[quando(s.finalizada_em),quando(s.aberta_em),nomeUsuario(s.finalizado_por_chatpro||s.responsavel_chatpro),l?.nome||'',l?.empresa_contato||'',l?.telefone_whatsapp||'',nomeMotivo(s.motivo_id),notaNps(s)??'']})])}

 return <PageShell title="Relatório de atendimentos" description="Atendimentos do ChatPro por atendente e período. O histórico de quem saiu continua no nome dela." action={<Link to="/atendimentos" className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700"><ArrowLeft className="h-3.5 w-3.5"/>Voltar aos atendimentos</Link>}>
  <div className="rounded-xl border bg-white p-3 shadow-sm"><div className="flex flex-wrap items-end gap-2">
   <label className="text-[11px] font-semibold text-slate-500">De<input type="date" value={de} max={ate} onChange={e=>setDe(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs"/></label>
   <label className="text-[11px] font-semibold text-slate-500">Até<input type="date" value={ate} min={de} onChange={e=>setAte(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs"/></label>
   <button onClick={()=>void carregar()} disabled={carregando||!de||!ate} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5"/>{carregando?'Carregando...':'Aplicar período'}</button>
   <button onClick={exportarResumo} disabled={carregando||!linhas.length} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><Download className="h-3.5 w-3.5"/>Exportar resumo (CSV)</button>
  </div>
  <p className="mt-2 text-[11px] text-slate-500"><strong>Recebidos</strong>: conversas abertas no período, no nome de quem está com elas. <strong>Finalizados</strong>: conversas finalizadas no período, no nome de quem finalizou. <strong>Em aberto agora</strong>: independe do período.</p></div>
  {erro&&<div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}
  <div className="grid gap-3 sm:grid-cols-3">{[['Recebidos no período',total.recebidos],['Finalizados no período',total.finalizados],['Em aberto agora',total.abertos]].map(([r,v])=><div key={r} className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{r}</div><div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{carregando?'…':v}</div></div>)}</div>
  <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-xs"><thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">Atendente</th><th className="px-3 py-2.5 text-right">Recebidos</th><th className="px-3 py-2.5 text-right">Finalizados</th><th className="px-3 py-2.5 text-right">Em aberto agora</th><th className="px-3 py-2.5 text-right">Tempo médio</th><th className="px-3 py-2.5 text-right">NPS médio</th>{nomesMotivos.map(n=><th key={n} className="px-3 py-2.5 text-right">{n}</th>)}</tr></thead>
   <tbody className="divide-y">{carregando?<tr><td colSpan={6+nomesMotivos.length} className="p-6 text-center text-slate-500">Carregando...</td></tr>:linhas.length===0?<tr><td colSpan={6+nomesMotivos.length} className="p-6 text-center text-slate-500">Nenhum atendimento no período.</td></tr>:linhas.map(l=><tr key={l.id} onClick={()=>setAtendente(a=>a===l.id?'':l.id)} className={`cursor-pointer ${atendente===l.id?'bg-blue-50':'hover:bg-slate-50'}`}><td className="px-3 py-2.5 font-semibold text-slate-800">{l.nome}{l.inativo&&<span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">inativo</span>}</td><td className="px-3 py-2.5 text-right tabular-nums">{l.recebidos}</td><td className="px-3 py-2.5 text-right tabular-nums font-semibold">{l.finalizados}</td><td className="px-3 py-2.5 text-right tabular-nums">{l.abertosAgora}</td><td className="px-3 py-2.5 text-right tabular-nums">{duracao(media(l.horas))}</td><td className="px-3 py-2.5 text-right tabular-nums">{media(l.nps)?.toFixed(1).replace('.',',')??'—'}</td>{nomesMotivos.map(n=><td key={n} className="px-3 py-2.5 text-right tabular-nums text-slate-600">{l.motivos[n]||''}</td>)}</tr>)}</tbody></table></div></section>
  <section className="rounded-xl border bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5"><h3 className="text-xs font-bold text-slate-800">Finalizados no período{atendente?` · ${linhas.find(l=>l.id===atendente)?.nome||''}`:''} <span className="font-normal text-slate-500">({detalhe.length})</span></h3><div className="flex gap-1.5">{atendente&&<button onClick={()=>setAtendente('')} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">Ver todos</button>}<button onClick={exportarDetalhe} disabled={!detalhe.length} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"><Download className="h-3.5 w-3.5"/>Exportar lista (CSV)</button></div></div>
   <div className="max-h-[480px] overflow-auto"><table className="min-w-full text-xs"><thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Finalizado em</th><th className="px-3 py-2">Atendente</th><th className="px-3 py-2">Cliente / contato</th><th className="px-3 py-2">Empresa</th><th className="px-3 py-2">Motivo</th><th className="px-3 py-2 text-right">NPS</th></tr></thead>
    <tbody className="divide-y">{detalhe.length===0?<tr><td colSpan={6} className="p-6 text-center text-slate-500">{carregando?'Carregando...':'Nada finalizado no período.'}</td></tr>:detalhe.slice(0,500).map(s=>{const l=s.lead_id?leads[s.lead_id]:undefined;return <tr key={s.id}><td className="whitespace-nowrap px-3 py-2 tabular-nums">{quando(s.finalizada_em)}</td><td className="px-3 py-2">{nomeUsuario(s.finalizado_por_chatpro||s.responsavel_chatpro)}</td><td className="px-3 py-2">{l?<Link to={`/leads/${l.id}`} className="text-blue-700 hover:underline">{l.nome||l.telefone_whatsapp||'Sem nome'}</Link>:<span className="text-slate-400">Não vinculado</span>}</td><td className="px-3 py-2 text-slate-600">{l?.empresa_contato||'—'}</td><td className="px-3 py-2">{nomeMotivo(s.motivo_id)}</td><td className="px-3 py-2 text-right tabular-nums">{notaNps(s)??'—'}</td></tr>})}</tbody></table>{detalhe.length>500&&<p className="px-3 py-2 text-[11px] text-slate-500">Mostrando 500 de {detalhe.length}. Use "Exportar lista" para ver todos.</p>}</div></section>
 </PageShell>
}
