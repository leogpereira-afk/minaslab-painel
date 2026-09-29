import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Search, Users } from 'lucide-react'
import { PageShell } from '../../components/ui/PageShell'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'

type User={id:string;nome:string|null}

export function TarefasCadastro(){
 const nav=useNavigate();const{profile}=useAuth();
 const[users,setUsers]=useState<User[]>([]);const[selected,setSelected]=useState<string[]>([]);const[search,setSearch]=useState('');
 const[titulo,setTitulo]=useState('');const[descricao,setDescricao]=useState('');const[prazo,setPrazo]=useState('');const[prioridade,setPrioridade]=useState('NORMAL');
 const[saving,setSaving]=useState(false);const[error,setError]=useState('')
 useEffect(()=>{void(async()=>{const{data,error}=await supabase.from('profiles').select('id,nome').eq('ativo',true).order('nome');if(error)setError(error.message);else setUsers((data??[]) as User[])})()},[])
 const visible=useMemo(()=>users.filter(u=>(u.nome||'').toLowerCase().includes(search.toLowerCase())),[users,search])
 function toggle(id:string){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}
 async function save(e:React.FormEvent){e.preventDefault();if(!titulo.trim()||!selected.length){setError('Informe o título e selecione pelo menos um responsável.');return}setSaving(true);setError('');
  const{data,error}=await supabase.from('tarefas').insert({titulo:titulo.trim(),descricao:descricao.trim()||null,prazo:prazo?new Date(prazo).toISOString():null,status:'PENDENTE',prioridade,responsavel_id:selected.length===1?selected[0]:null,ativo:true,created_by:profile?.id??null}).select('id').single();
  if(error){setError(error.message);setSaving(false);return}
  const{error:jErr}=await supabase.from('tarefa_responsaveis').insert(selected.map(usuario_id=>({tarefa_id:data.id,usuario_id,status:'PENDENTE'})))
  if(jErr){setError(`Tarefa criada, mas houve erro na delegação: ${jErr.message}`);setSaving(false);return}nav('/tarefas')
 }
 return <PageShell title="Agendar tarefa" description="Crie a atividade, defina o prazo e distribua partes para um ou vários responsáveis." action={<Link to="/tarefas" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"><ArrowLeft className="h-4 w-4"/>Voltar</Link>}>
  <form onSubmit={save} className="mx-auto grid max-w-5xl gap-5 rounded-3xl border bg-white p-6 shadow-sm lg:grid-cols-[1fr_360px]">
   <div className="space-y-4"><label><span className="mb-1 block text-sm font-medium">Título *</span><input required value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Ex.: Retornar orçamento ao cliente" className="w-full rounded-xl border px-3 py-2.5"/></label><label><span className="mb-1 block text-sm font-medium">Descrição / orientações</span><textarea value={descricao} onChange={e=>setDescricao(e.target.value)} rows={6} className="w-full rounded-xl border px-3 py-2.5"/></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1 block text-sm font-medium">Prazo / data e hora</span><input type="datetime-local" value={prazo} onChange={e=>setPrazo(e.target.value)} className="w-full rounded-xl border px-3 py-2.5"/></label><label><span className="mb-1 block text-sm font-medium">Prioridade</span><select value={prioridade} onChange={e=>setPrioridade(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2.5"><option>BAIXA</option><option>NORMAL</option><option>ALTA</option><option>URGENTE</option></select></label></div><div className="rounded-2xl bg-teal-50 p-4 text-sm text-teal-900"><strong>Conclusão individual:</strong> cada pessoa marca sua própria parte. A tarefa será concluída automaticamente quando todos terminarem.</div></div>
   <div className="rounded-2xl border"><div className="border-b p-4"><div className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5 text-teal-700"/>Responsáveis *</div><div className="relative mt-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar usuário" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm"/></div><button type="button" onClick={()=>setSelected(selected.length===users.length?[]:users.map(u=>u.id))} className="mt-3 text-xs font-semibold text-teal-700">{selected.length===users.length?'Limpar seleção':'Selecionar todos'}</button></div><div className="max-h-72 divide-y overflow-auto">{visible.map(u=><button type="button" key={u.id} onClick={()=>toggle(u.id)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"><span className={`flex h-5 w-5 items-center justify-center rounded border ${selected.includes(u.id)?'border-teal-700 bg-teal-700 text-white':'bg-white'}`}>{selected.includes(u.id)&&<Check className="h-3.5 w-3.5"/>}</span><span className="text-sm font-medium">{u.nome||'Usuário sem nome'}</span></button>)}</div><div className="border-t p-3 text-xs text-slate-500">{selected.length} responsável(is) selecionado(s)</div></div>
   {error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 lg:col-span-2">{error}</div>}<div className="flex justify-end gap-2 lg:col-span-2"><Link to="/tarefas" className="rounded-xl border px-4 py-2.5">Cancelar</Link><button disabled={saving} className="rounded-xl bg-teal-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving?'Salvando...':'Agendar tarefa'}</button></div>
  </form>
 </PageShell>
}
