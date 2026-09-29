import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, Mail, MessageCircle, MessageSquarePlus, Phone } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import { UserAvatar } from '../users/UserAvatar'

type LeadSummary = { origem?:string|null; assunto?:string|null; status?:string|null; data_primeiro_atendimento?:string|null; responsavel_id?:string|null }
type Props = { proposalId?:string; opportunityId?:string; clientId?:string; leadId?:string; lead?:LeadSummary; compact?:boolean }
type Item = { id:string; ocorrido_em:string; tipo:string|null; descricao:string; usuario_id:string|null;source_system:string|null }
type ProfileName = { id:string; nome:string|null; avatar_url:string|null }
type QueryResult<T>={data:T[]|null;error:{message:string}|null}
const PAGE_SIZE=1000

function eventStyle(tipo:string|null){
  const value=String(tipo??'').toUpperCase()
  if(value.includes('WHATS')) return {Icon:MessageCircle,bg:'bg-emerald-500',label:'WhatsApp'}
  if(value.includes('LIGA')||value.includes('TELEF')) return {Icon:Phone,bg:'bg-sky-600',label:'Ligação'}
  if(value.includes('E-MAIL')||value.includes('EMAIL')) return {Icon:Mail,bg:'bg-violet-600',label:'E-mail'}
  if(value.includes('FOLLOW')) return {Icon:Clock3,bg:'bg-amber-500',label:'Follow-up'}
  if(value.includes('STATUS')||value.includes('CONCLU')) return {Icon:Check,bg:'bg-emerald-600',label:tipo||'Status alterado'}
  return {Icon:MessageCircle,bg:'bg-teal-600',label:tipo||'Interação registrada'}
}
function dateLabel(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}
async function fetchAll<T>(makeQuery:(from:number,to:number)=>PromiseLike<QueryResult<T>>){const rows:T[]=[];for(let from=0;;from+=PAGE_SIZE){const result=await makeQuery(from,from+PAGE_SIZE-1);if(result.error)return{data:rows,error:result.error};const batch=(result.data??[]) as T[];rows.push(...batch);if(batch.length<PAGE_SIZE)return{data:rows,error:null}}}
function sourceLabel(value:string|null){const v=(value||'CRM').toUpperCase();if(v==='CHATPRO')return'ChatPro';if(v==='CRM')return'CRM / Manual';return value||'CRM / Manual'}

export function TimelinePanel(props:Props){
  const {profile,hasPermission}=useAuth();const canWrite=hasPermission('crm.write')
  const[items,setItems]=useState<Item[]>([]);const[profiles,setProfiles]=useState<ProfileName[]>([]);const[tipo,setTipo]=useState('FOLLOW-UP');const[descricao,setDescricao]=useState('');const[error,setError]=useState('');const[saving,setSaving]=useState(false)
  async function load(){
    const interactions=await fetchAll<Item>((from,to)=>{let q=supabase.from('interacoes').select('id,ocorrido_em,tipo,descricao,usuario_id,source_system').order('ocorrido_em',{ascending:false});if(props.proposalId)q=q.eq('proposta_id',props.proposalId);if(props.opportunityId)q=q.eq('oportunidade_id',props.opportunityId);if(props.clientId)q=q.eq('cliente_id',props.clientId);if(props.leadId)q=q.eq('lead_id',props.leadId);return q.range(from,to) as unknown as PromiseLike<QueryResult<Item>>})
    const profileResult=await supabase.from('profiles').select('id,nome,avatar_url').eq('ativo',true)
    if(interactions.error)setError(interactions.error.message);else{setItems(interactions.data);setError('')}if(!profileResult.error)setProfiles((profileResult.data??[]) as ProfileName[])
  }
  useEffect(()=>{void load()},[props.proposalId,props.opportunityId,props.clientId,props.leadId])
  const profileInfo=(id:string|null|undefined)=>id?(profiles.find(item=>item.id===id)||{id,nome:'Usuário',avatar_url:null}):{id:'sistema',nome:'Sistema',avatar_url:null}
  const ordered=useMemo(()=>[...items].sort((a,b)=>new Date(b.ocorrido_em).getTime()-new Date(a.ocorrido_em).getTime()),[items])
  async function add(e:React.FormEvent){e.preventDefault();if(!descricao.trim())return;setSaving(true);setError('');const payload={descricao:descricao.trim(),tipo,usuario_id:profile?.id??null,proposta_id:props.proposalId??null,oportunidade_id:props.opportunityId??null,cliente_id:props.clientId??null,lead_id:props.leadId??null,source_system:'CRM'};const{error}=await supabase.from('interacoes').insert(payload);if(error)setError(error.message);else{setDescricao('');await load()}setSaving(false)}
  const hasCreation=Boolean(props.lead?.data_primeiro_atendimento)
  return <section className={props.compact?'bg-white':'rounded-2xl border border-slate-200 bg-white'}>
    {!props.compact&&<div className="border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><MessageSquarePlus className="h-5 w-5 text-teal-700"/><div><h3 className="font-semibold text-slate-900">Histórico completo do relacionamento</h3><p className="text-xs text-slate-500">Reúne lançamentos manuais do CRM e conversas vinculadas do ChatPro, identificando a origem de cada registro.</p></div></div></div>}
    {canWrite&&!props.compact&&<form onSubmit={add} className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[150px_1fr_auto]"><select value={tipo} onChange={e=>setTipo(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option>FOLLOW-UP</option><option>LIGAÇÃO</option><option>WHATSAPP</option><option>E-MAIL</option><option>REUNIÃO</option><option>OBSERVAÇÃO</option></select><input value={descricao} onChange={e=>setDescricao(e.target.value)} placeholder="Registrar nova interação..." className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500"/><button disabled={saving} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Salvando...':'Registrar'}</button></form>}
    {error&&<div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {!hasCreation&&ordered.length===0?<div className="p-8 text-center text-sm text-slate-500">Sem interações registradas.</div>:<div className="relative px-1 py-2 before:absolute before:bottom-7 before:left-[20px] before:top-7 before:w-px before:bg-slate-200">
      {hasCreation&&(()=>{const owner=profileInfo(props.lead?.responsavel_id);return <div className="relative grid grid-cols-[40px_1fr_auto] gap-3 border-b border-slate-100 py-4"><span className="z-10 grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-white shadow-sm"><Phone className="h-4 w-4"/></span><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">Novo atendimento criado</strong><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">CRM / Manual</span>{props.lead?.status&&<span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">{props.lead.status}</span>}</div><p className="mt-1 text-xs text-slate-500">Origem: {props.lead?.origem||'Não informada'}{props.lead?.assunto?<> <span className="px-1.5">•</span> Assunto: <strong className="text-slate-700">{props.lead.assunto}</strong></>:null}</p></div><div className="text-right text-xs text-slate-400"><div>{dateLabel(String(props.lead?.data_primeiro_atendimento))}</div><div className="mt-1 flex items-center justify-end gap-2 text-slate-500"><UserAvatar name={owner.nome} avatarUrl={owner.avatar_url} size="sm"/><span>{owner.nome}</span></div></div></div>})()}
      {ordered.map(i=>{const style=eventStyle(i.tipo);const Icon=style.Icon;const author=profileInfo(i.usuario_id);return <div key={i.id} className="relative grid grid-cols-[40px_1fr_auto] gap-3 border-b border-slate-100 py-4 last:border-b-0"><span className={`z-10 grid h-9 w-9 place-items-center rounded-full text-white shadow-sm ${style.bg}`}><Icon className="h-4 w-4"/></span><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{style.label}</strong><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{sourceLabel(i.source_system)}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{i.tipo||'INTERAÇÃO'}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{i.descricao}</p></div><div className="text-right text-xs text-slate-400"><div>{dateLabel(i.ocorrido_em)}</div><div className="mt-1 flex items-center justify-end gap-2 text-slate-500"><UserAvatar name={author.nome} avatarUrl={author.avatar_url} size="sm"/><span>{author.nome}</span></div></div></div>})}
    </div>}
  </section>
}
