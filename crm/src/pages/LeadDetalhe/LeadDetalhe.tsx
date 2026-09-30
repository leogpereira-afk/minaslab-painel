import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, Edit3, Handshake } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageShell } from '../../components/ui/PageShell'
import { TimelinePanel } from '../../components/timeline/TimelinePanel'
import { Modal } from '../../components/ui/Modal'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'

type Lead={id:string;nome:string|null;telefone_whatsapp:string|null;origem:string|null;assunto:string|null;resumo:string|null;status:string|null;tipo_analise:string|null;cliente_convertido_id:string|null;contato_convertido_id:string|null}
type Client={id:string;razao_social:string|null;nome_fantasia:string|null;cpf_cnpj_original:string|null}
const leadStatuses=['EM ATENDIMENTO','QUALIFICADO','CONVERTIDO','ENCERRADO']

export function LeadDetalhe(){
  const{id}=useParams()
  const navigate=useNavigate()
  const{profile,hasPermission}=useAuth()
  const canWrite=hasPermission('crm.write')
  const[lead,setLead]=useState<Lead|null>(null)
  const[clients,setClients]=useState<Client[]>([])
  const[analysisTypes,setAnalysisTypes]=useState<string[]>([])
  const[open,setOpen]=useState(false)
  const[editOpen,setEditOpen]=useState(false)
  const[editStatus,setEditStatus]=useState('EM ATENDIMENTO')
  const[editAnalyses,setEditAnalyses]=useState<string[]>([])
  const[clientId,setClientId]=useState('')
  const[title,setTitle]=useState('')
  const[error,setError]=useState('')
  const[saving,setSaving]=useState(false)
  const[editSaving,setEditSaving]=useState(false)
  const[creatingClient,setCreatingClient]=useState(false)

  async function load(){
    if(!id)return
    const[a,b,g]=await Promise.all([
      supabase.from('leads').select('id,nome,telefone_whatsapp,origem,assunto,resumo,status,tipo_analise,cliente_convertido_id,contato_convertido_id').eq('id',id).single(),
      supabase.from('clientes').select('id,razao_social,nome_fantasia,cpf_cnpj_original').is('deleted_at',null).eq('ativo',true).order('razao_social',{ascending:true}).limit(500),
      supabase.from('grupos').select('nome').eq('ativo',true).is('deleted_at',null).order('nome'),
    ])
    if(a.error||b.error||g.error)setError(a.error?.message||b.error?.message||g.error?.message||'Erro')
    else{
      setLead(a.data as Lead)
      setClients((b.data??[]) as Client[])
      setAnalysisTypes((g.data??[]).map(x=>String(x.nome)))
    }
  }

  useEffect(()=>{void load()},[id])

  function startConversion(){
    if(String(lead?.status||'').toUpperCase()==='CONVERTIDO'){
      setError('Este atendimento já foi convertido. Para uma nova negociação, crie outra oportunidade diretamente no módulo Oportunidades.')
      return
    }
    setClientId(lead?.cliente_convertido_id||'')
    setTitle('')
    setOpen(true)
  }

  function startEdit(){
    if(!lead)return
    setEditStatus(lead.status||'EM ATENDIMENTO')
    setEditAnalyses(String(lead.tipo_analise||'').split(',').map(x=>x.trim()).filter(Boolean))
    setEditOpen(true)
  }

  function toggleAnalysis(value:string){
    setEditAnalyses(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value])
  }

  async function saveLeadChanges(e:React.FormEvent){
    e.preventDefault()
    if(!canWrite||!id||!lead)return
    if(editAnalyses.length===0){setError('Selecione ao menos um tipo de análise.');return}
    setEditSaving(true);setError('')
    const nextAnalysis=editAnalyses.join(', ')
    const changes:string[]=[]
    if(editStatus!==lead.status)changes.push(`Status alterado de ${lead.status||'NÃO INFORMADO'} para ${editStatus}`)
    if(nextAnalysis!==String(lead.tipo_analise||''))changes.push(`Tipo de análise atualizado para: ${nextAnalysis}`)
    const{error:updateError}=await supabase.from('leads').update({status:editStatus,tipo_analise:nextAnalysis,updated_by:profile?.id??null}).eq('id',id)
    if(updateError){setError(updateError.message);setEditSaving(false);return}
    if(changes.length){
      const{error:interactionError}=await supabase.from('interacoes').insert({lead_id:id,cliente_id:lead.cliente_convertido_id||null,usuario_id:profile?.id??null,tipo:'STATUS',descricao:changes.join(' · ')})
      if(interactionError)setError(`Atendimento atualizado, mas o registro na Timeline falhou: ${interactionError.message}`)
    }
    setEditOpen(false);await load();setEditSaving(false)
  }

  async function createClientFromLead(){
    if(!canWrite||!id||!lead)return
    if(lead.cliente_convertido_id){navigate(`/clientes/${lead.cliente_convertido_id}`);return}
    setCreatingClient(true);setError('')
    const name=lead.nome?.trim()||'Cliente sem nome'
    const {data,error:createError}=await supabase.from('clientes').insert({razao_social:name,nome_fantasia:name,telefone_principal:lead.telefone_whatsapp||null,origem:lead.origem||null,status_comercial:'PROSPECT',observacoes_comerciais:[lead.assunto,lead.resumo].filter(Boolean).join(' — ')||null,responsavel_comercial_id:profile?.id??null,ativo:true,created_by:profile?.id??null}).select('id').single()
    if(createError){setError(createError.message);setCreatingClient(false);return}
    const newClientId=String(data.id)
    const {error:leadError}=await supabase.from('leads').update({cliente_convertido_id:newClientId,updated_by:profile?.id??null}).eq('id',id)
    if(leadError){
      const rollback=await supabase.from('clientes').delete().eq('id',newClientId)
      setError(rollback.error?`O cliente foi criado (${newClientId}), mas o atendimento não pôde ser vinculado e a reversão automática também falhou. ${leadError.message} · Rollback: ${rollback.error.message}`:`O cadastro não foi concluído e o cliente criado foi revertido com segurança. ${leadError.message}`)
      setCreatingClient(false)
      return
    }
    setCreatingClient(false);navigate(`/clientes/${newClientId}`)
  }

  async function convert(e:React.FormEvent){
    e.preventDefault()
    if(!canWrite||!id||!clientId||!title||!lead)return
    if(String(lead.status||'').toUpperCase()==='CONVERTIDO'){
      setError('Este atendimento já foi convertido e não pode gerar outra oportunidade por esta tela.')
      setOpen(false)
      return
    }
    setSaving(true);setError('')
    const proposalNumber=title.trim()
    const{data:opp,error:oppError}=await supabase.from('oportunidades').insert({cliente_id:clientId,titulo:proposalNumber,numero_proposta_gerencialab:proposalNumber,origem:lead.origem??'LEAD',status:'ABERTA',estagio:'QUALIFICAÇÃO',ativo:true,responsavel_id:profile?.id??null,created_by:profile?.id??null}).select('id').single()
    if(oppError){setError(oppError.message);setSaving(false);return}

    const opportunityId=String(opp.id)
    const{error:leadError}=await supabase.from('leads').update({cliente_convertido_id:clientId,status:'CONVERTIDO',updated_by:profile?.id??null}).eq('id',id)
    if(leadError){
      const rollback=await supabase.from('oportunidades').delete().eq('id',opportunityId)
      setError(rollback.error?`A oportunidade foi criada (${opportunityId}), mas o atendimento não pôde ser atualizado e a reversão automática também falhou. ${leadError.message} · Rollback: ${rollback.error.message}`:`A conversão não foi concluída e a oportunidade criada foi revertida com segurança. ${leadError.message}`)
      setSaving(false)
      return
    }

    const{error:timelineError}=await supabase.from('interacoes').insert({lead_id:id,oportunidade_id:opportunityId,cliente_id:clientId,usuario_id:profile?.id??null,tipo:'CONVERSAO',descricao:`Atendimento convertido em oportunidade com proposta GerenciaLab nº ${proposalNumber}`})
    if(timelineError)setError(`Conversão concluída, mas o histórico não pôde ser registrado: ${timelineError.message}`)

    setOpen(false)
    await load()
    setSaving(false)
    navigate(`/oportunidades/${opportunityId}`)
  }

  return <PageShell title={lead?.nome||'Atendimento'} description="Triagem, histórico e conversão para cliente e oportunidade." action={<Link to="/primeiro-atendimento" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"><ArrowLeft className="h-4 w-4"/>Voltar</Link>}>
    {error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {lead&&<>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Card label="WhatsApp" value={lead.telefone_whatsapp||'—'}/><Card label="Origem" value={lead.origem||'—'}/><Card label="Tipo de análise" value={lead.tipo_analise||'—'}/><Card label="Status" value={lead.status||'—'}/></section>
      <section className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold text-slate-900">Conversão comercial</div><p className="mt-1 text-sm text-slate-500">Cadastre o cliente e depois informe o número da proposta gerada no GerenciaLab.</p></div><div className="flex flex-wrap gap-2">{canWrite&&<button onClick={startEdit} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700"><Edit3 className="h-4 w-4"/>Editar atendimento</button>}{lead.cliente_convertido_id?<Link to={`/clientes/${lead.cliente_convertido_id}`} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-teal-700"><Building2 className="h-4 w-4"/>Cliente 360</Link>:canWrite&&<button onClick={()=>void createClientFromLead()} disabled={creatingClient} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><Building2 className="h-4 w-4"/>{creatingClient?'Cadastrando...':'Cadastrar cliente'}</button>}{canWrite&&String(lead.status||'').toUpperCase()!=='CONVERTIDO'&&<button onClick={startConversion} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"><Handshake className="h-4 w-4"/>Criar oportunidade</button>}</div></div></section>
      <section className="rounded-3xl border bg-white p-5 shadow-sm"><h3 className="font-semibold">Resumo do atendimento</h3><p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{lead.resumo||lead.assunto||'Sem resumo.'}</p></section>
      {id&&<TimelinePanel leadId={id} clientId={lead.cliente_convertido_id||undefined}/>} 
    </>}
    <Modal open={editOpen} onClose={()=>setEditOpen(false)} title="Editar atendimento"><form onSubmit={saveLeadChanges} className="space-y-5"><label><span className="mb-1.5 block text-sm font-medium">Status do atendimento *</span><select required value={editStatus} onChange={e=>setEditStatus(e.target.value)} className="w-full rounded-xl border px-3 py-2.5">{leadStatuses.map(status=><option key={status} value={status}>{status}</option>)}</select></label><div><div className="mb-2 text-sm font-medium">Tipos de análise *</div><p className="mb-3 text-xs text-slate-500">Marque todos os escopos de interesse. É possível acrescentar ou remover opções.</p><div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">{analysisTypes.map(item=><label key={item} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-slate-700"><input type="checkbox" checked={editAnalyses.includes(item)} onChange={()=>toggleAnalysis(item)} className="h-4 w-4 rounded border-slate-300 accent-teal-700"/>{item}</label>)}</div></div><div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditOpen(false)} className="rounded-xl border px-4 py-2.5">Cancelar</button><button disabled={editSaving} className="rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{editSaving?'Salvando...':'Salvar alterações'}</button></div></form></Modal>
    <Modal open={open} onClose={()=>setOpen(false)} title="Criar oportunidade"><form onSubmit={convert} className="space-y-4"><label><span className="mb-1 block text-sm font-medium">Cliente *</span><select required value={clientId} onChange={e=>setClientId(e.target.value)} className="w-full rounded-xl border px-3 py-2.5"><option value="">Selecione...</option>{clients.map(c=><option key={c.id} value={c.id}>{c.nome_fantasia||c.razao_social||c.cpf_cnpj_original||c.id}</option>)}</select></label><label><span className="mb-1 block text-sm font-medium">Número da proposta no GerenciaLab *</span><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Digite o número da proposta" autoComplete="off" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400"/></label><div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Ao salvar, a oportunidade entra automaticamente em QUALIFICAÇÃO no Pipeline Comercial e o atendimento passa para CONVERTIDO.</div><div className="flex justify-end gap-2"><button type="button" onClick={()=>setOpen(false)} className="rounded-xl border px-4 py-2.5">Cancelar</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{saving?'Criando...':<>Criar oportunidade <ArrowRight className="h-4 w-4"/></>}</button></div></form></Modal>
  </PageShell>
}

function Card({label,value}:{label:string;value:string}){return <article className="rounded-3xl border bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase text-slate-400">{label}</div><div className="mt-2 text-lg font-semibold">{value}</div></article>}