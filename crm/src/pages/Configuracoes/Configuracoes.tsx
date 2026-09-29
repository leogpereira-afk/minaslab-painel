import { useEffect, useMemo, useState } from 'react'
import { Building2, Edit3, KeyRound, Link2, ListChecks, Plus, ShieldCheck, ToggleLeft, ToggleRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PageShell } from '../../components/ui/PageShell'
import { Modal } from '../../components/ui/Modal'
import { UserAvatar } from '../../components/users/UserAvatar'
import { AdminUserAvatarEditor } from '../../components/users/AdminUserAvatarEditor'

type Tab='usuarios'|'perfis'|'listas'|'laboratorios'|'integracoes'
type ListType='ORIGEM_ATENDIMENTO'|'OPORTUNIDADE_SERVICO'
type Role={id:string;codigo:string;nome:string;descricao:string|null;ativo:boolean}
type AdminUser={id:string;email:string;nome:string;ativo:boolean;created_at:string;last_sign_in_at:string|null;role:Role|null;avatar_url:string|null}
type ListRow={id:string;tipo:string;valor:string;ordem:number;ativo:boolean}
type LabRow={id:string;nome:string;cpf_cnpj:string|null;contato:string|null;email:string|null;telefone:string|null;ativo:boolean;observacoes:string|null}
type UserForm={id:string;nome:string;email:string;password:string;role_id:string;ativo:boolean}
const emptyUser:UserForm={id:'',nome:'',email:'',password:'',role_id:'',ativo:true}
const emptyLab={id:'',nome:'',cpf_cnpj:'',contato:'',email:'',telefone:'',observacoes:'',ativo:true}
const roleOrder=['direcao','equipe','leitura']
const listTypeMeta:Record<ListType,{title:string;description:string;newLabel:string;fieldLabel:string}>={
  ORIGEM_ATENDIMENTO:{title:'Origem do primeiro atendimento',description:'Usada no Primeiro Atendimento, Clientes e Oportunidades.',newLabel:'Nova origem',fieldLabel:'Nome da origem'},
  OPORTUNIDADE_SERVICO:{title:'Oportunidade / Serviço de interesse',description:'Usada ao criar uma oportunidade a partir do atendimento comercial.',newLabel:'Novo serviço',fieldLabel:'Nome do serviço / oportunidade'},
}
const permissionLabels:Record<string,string>={
  'admin.manage':'Administrar usuários e configurações',
  'audit.read':'Consultar auditoria',
  'crm.deactivate':'Inativar registros do CRM',
  'crm.read':'Consultar o CRM',
  'crm.write':'Criar e editar o CRM',
  'imports.manage':'Gerenciar importações',
  'operational.import':'Aplicar importação operacional',
  'operational.read':'Consultar OS, contratos e dados operacionais',
}

export function Configuracoes(){
  const{profile,hasPermission,refreshProfile}=useAuth()
  const canAdmin=hasPermission('admin.manage')
  const[tab,setTab]=useState<Tab>('usuarios')
  const[users,setUsers]=useState<AdminUser[]>([])
  const[roles,setRoles]=useState<Role[]>([])
  const[rolePermissions,setRolePermissions]=useState<Record<string,string[]>>({})
  const[listType,setListType]=useState<ListType>('ORIGEM_ATENDIMENTO')
  const[listRows,setListRows]=useState<ListRow[]>([])
  const[labs,setLabs]=useState<LabRow[]>([])
  const[error,setError]=useState('')
  const[loading,setLoading]=useState(false)
  const[userOpen,setUserOpen]=useState(false)
  const[userForm,setUserForm]=useState<UserForm>(emptyUser)
  const[listOpen,setListOpen]=useState(false)
  const[listForm,setListForm]=useState({id:'',valor:'',ordem:'0',ativo:true})
  const[labOpen,setLabOpen]=useState(false)
  const[labForm,setLabForm]=useState(emptyLab)
  const[saving,setSaving]=useState(false)

  async function loadUsers(){
    if(!canAdmin)return [] as AdminUser[]
    setLoading(true);setError('')
    const {data,error}=await supabase.functions.invoke('admin-users',{body:{action:'list'}})
    if(error){setError(error.message);setLoading(false);return [] as AdminUser[]}
    if(data?.error){setError(String(data.error));setLoading(false);return [] as AdminUser[]}
    const base=((data?.users??[]) as Omit<AdminUser,'avatar_url'>[])
    const available=((data?.roles??[]) as Role[]).filter(r=>roleOrder.includes(r.codigo.toLowerCase()))
    setRoles(available.sort((a,b)=>roleOrder.indexOf(a.codigo.toLowerCase())-roleOrder.indexOf(b.codigo.toLowerCase())))
    let merged:AdminUser[]=base.map(u=>({...u,avatar_url:null}))
    if(base.length){
      const {data:profileRows,error:profileError}=await supabase.from('profiles').select('id,avatar_url').in('id',base.map(u=>u.id))
      if(profileError)setError(profileError.message)
      else{
        const avatarById=new Map((profileRows??[]).map(row=>[String(row.id),row.avatar_url?String(row.avatar_url):null]))
        merged=base.map(u=>({...u,avatar_url:avatarById.get(u.id)??null}))
      }
    }
    setUsers(merged);setLoading(false);return merged
  }
  async function loadRolePermissions(){
    const [r,p,rp]=await Promise.all([supabase.from('roles').select('id,codigo,nome,descricao,ativo').eq('ativo',true),supabase.from('permissions').select('id,codigo'),supabase.from('role_permissions').select('role_id,permission_id')])
    const err=r.error||p.error||rp.error
    if(err){setError(err.message);return}
    const roleRows=(r.data??[]) as Role[]
    const permissionById=Object.fromEntries((p.data??[]).map(x=>[String(x.id),String(x.codigo)]))
    const map:Record<string,string[]>={}
    for(const link of rp.data??[]){const code=permissionById[String(link.permission_id)];if(code)(map[String(link.role_id)]??=[]).push(code)}
    setRolePermissions(map)
    if(roles.length===0)setRoles(roleRows.filter(x=>roleOrder.includes(x.codigo.toLowerCase())).sort((a,b)=>roleOrder.indexOf(a.codigo.toLowerCase())-roleOrder.indexOf(b.codigo.toLowerCase())))
  }
  async function loadLists(){const {data,error}=await supabase.from('crm_listas').select('id,tipo,valor,ordem,ativo').eq('tipo',listType).order('ordem').order('valor');if(error)setError(error.message);else setListRows((data??[]) as ListRow[])}
  async function loadLabs(){const {data,error}=await supabase.from('laboratorios_parceiros').select('id,nome,cpf_cnpj,contato,email,telefone,ativo,observacoes').is('deleted_at',null).order('nome');if(error)setError(error.message);else setLabs((data??[]) as LabRow[])}
  useEffect(()=>{void loadUsers();void loadRolePermissions();void loadLabs()},[canAdmin])
  useEffect(()=>{void loadLists()},[listType])

  function newUser(){setUserForm({...emptyUser,role_id:roles[1]?.id||roles[0]?.id||''});setUserOpen(true)}
  function editUser(user:AdminUser){setUserForm({id:user.id,nome:user.nome||'',email:user.email,password:'',role_id:user.role?.id||'',ativo:user.ativo});setUserOpen(true)}
  async function saveUser(e:React.FormEvent){
    e.preventDefault();if(!canAdmin)return
    setSaving(true);setError('')
    const isNew=!userForm.id
    const body=userForm.id?{action:'update',...userForm}:{action:'create',...userForm}
    const {data,error}=await supabase.functions.invoke('admin-users',{body})
    if(error)setError(error.message)
    else if(data?.error)setError(String(data.error))
    else{
      const refreshed=await loadUsers()
      if(isNew){
        const created=refreshed.find(u=>u.email.trim().toLowerCase()===userForm.email.trim().toLowerCase())
        if(created){setUserForm({id:created.id,nome:created.nome||userForm.nome,email:created.email,password:'',role_id:created.role?.id||userForm.role_id,ativo:created.ativo});setUserOpen(true)}
        else setUserOpen(false)
      }else setUserOpen(false)
    }
    setSaving(false)
  }

  async function handleAvatarChanged(userId:string,avatarUrl:string|null){
    setUsers(current=>current.map(u=>u.id===userId?{...u,avatar_url:avatarUrl}:u))
    if(userId===profile?.id)await refreshProfile()
  }

  function newList(){setListForm({id:'',valor:'',ordem:String((listRows[listRows.length-1]?.ordem??0)+10),ativo:true});setListOpen(true)}
  function editList(row:ListRow){setListForm({id:row.id,valor:row.valor,ordem:String(row.ordem),ativo:row.ativo});setListOpen(true)}
  async function saveList(e:React.FormEvent){e.preventDefault();if(!canAdmin||!listForm.valor.trim())return;setSaving(true);setError('');const payload={tipo:listType,valor:listForm.valor.trim(),ordem:Number(listForm.ordem||0),ativo:listForm.ativo,updated_at:new Date().toISOString()};const response=listForm.id?await supabase.from('crm_listas').update(payload).eq('id',listForm.id):await supabase.from('crm_listas').insert(payload);if(response.error)setError(response.error.message);else{setListOpen(false);await loadLists()}setSaving(false)}

  function newLab(){setLabForm({...emptyLab});setLabOpen(true)}
  function editLab(row:LabRow){setLabForm({id:row.id,nome:row.nome,cpf_cnpj:row.cpf_cnpj||'',contato:row.contato||'',email:row.email||'',telefone:row.telefone||'',observacoes:row.observacoes||'',ativo:row.ativo});setLabOpen(true)}
  async function saveLab(e:React.FormEvent){e.preventDefault();if(!canAdmin||!labForm.nome.trim())return;setSaving(true);setError('');const payload={nome:labForm.nome.trim(),cpf_cnpj:labForm.cpf_cnpj.trim()||null,contato:labForm.contato.trim()||null,email:labForm.email.trim()||null,telefone:labForm.telefone.trim()||null,observacoes:labForm.observacoes.trim()||null,ativo:labForm.ativo,updated_at:new Date().toISOString()};const response=labForm.id?await supabase.from('laboratorios_parceiros').update(payload).eq('id',labForm.id):await supabase.from('laboratorios_parceiros').insert(payload);if(response.error)setError(response.error.message);else{setLabOpen(false);await loadLabs()}setSaving(false)}
  async function toggleLab(row:LabRow){if(!canAdmin)return;const {error}=await supabase.from('laboratorios_parceiros').update({ativo:!row.ativo,updated_at:new Date().toISOString()}).eq('id',row.id);if(error)setError(error.message);else await loadLabs()}

  const currentUser=useMemo(()=>users.find(u=>u.id===profile?.id),[users,profile?.id])
  const editingUser=useMemo(()=>users.find(u=>u.id===userForm.id),[users,userForm.id])
  const visibleRoles=useMemo(()=>roles.filter(r=>roleOrder.includes(r.codigo.toLowerCase())),[roles])
  const listMeta=listTypeMeta[listType]

  return <PageShell title="Configurações" description="Administração do CRM em linguagem simples: acessos, perfis, listas, laboratórios parceiros e integrações.">
    {error&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="flex flex-wrap gap-2">{([['usuarios','Acessos / Usuários',Users],['perfis','Perfis de acesso',ShieldCheck],['listas','Listas do CRM',ListChecks],['laboratorios','Laboratórios parceiros',Building2],['integracoes','Integrações',Link2]] as const).map(([key,label,Icon])=><button key={key} onClick={()=>setTab(key)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${tab===key?'bg-teal-700 text-white':'border bg-white text-slate-600'}`}><Icon className="h-4 w-4"/>{label}</button>)}</div>

    {tab==='usuarios'&&<section className="rounded-3xl border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">Contas de acesso</h3><p className="mt-1 text-sm text-slate-500">Crie e edite os usuários que entram no CRM. A foto de perfil é gerenciada somente pelo administrador.</p></div>{canAdmin&&<button onClick={newUser} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Criar conta</button>}</div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Foto</th><th className="px-5 py-3">Nome</th><th className="px-5 py-3">Login / e-mail</th><th className="px-5 py-3">Perfil</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Último acesso</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y">{loading?<tr><td colSpan={7} className="p-10 text-center text-slate-500">Carregando...</td></tr>:users.length===0?<tr><td colSpan={7} className="p-10 text-center text-slate-500">Sem usuários.</td></tr>:users.map(u=><tr key={u.id}><td className="px-5 py-3"><UserAvatar name={u.nome||u.email.split('@')[0]} avatarUrl={u.avatar_url} size="md"/></td><td className="px-5 py-4 font-semibold">{u.nome||u.email.split('@')[0]}{u.id===profile?.id&&<span className="ml-2 rounded-full bg-teal-50 px-2 py-1 text-[11px] text-teal-700">você</span>}</td><td className="px-5 py-4">{u.email}</td><td className="px-5 py-4">{u.role?.nome||'Sem perfil'}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.ativo?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{u.ativo?'ATIVO':'INATIVO'}</span></td><td className="px-5 py-4 text-slate-500">{u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleString('pt-BR'):'Nunca'}</td><td className="px-5 py-4 text-right"><button onClick={()=>editUser(u)} className="rounded-lg border p-2" title="Editar usuário e foto"><Edit3 className="h-4 w-4"/></button></td></tr>)}</tbody></table></div>{currentUser&&<div className="border-t bg-slate-50 px-5 py-3 text-xs text-slate-500">Seu acesso atual: <strong>{currentUser.role?.nome||'Administrador inicial'}</strong>.</div>}</section>}
    {tab==='perfis'&&<section className="grid gap-4 lg:grid-cols-3">{visibleRoles.map(r=><article key={r.id} className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-teal-700"/><h3 className="text-lg font-semibold">{r.nome}</h3></div><p className="mt-2 text-sm text-slate-600">{r.descricao}</p><div className="mt-5 space-y-2">{(rolePermissions[r.id]??[]).sort().map(code=><div key={code} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{permissionLabels[code]||code}</div>)}</div></article>)}</section>}
    {tab==='listas'&&<section className="space-y-5"><div className="flex flex-wrap gap-2"><button onClick={()=>setListType('ORIGEM_ATENDIMENTO')} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${listType==='ORIGEM_ATENDIMENTO'?'bg-teal-700 text-white':'border bg-white text-slate-600'}`}>Origens do atendimento</button><button onClick={()=>setListType('OPORTUNIDADE_SERVICO')} className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${listType==='OPORTUNIDADE_SERVICO'?'bg-teal-700 text-white':'border bg-white text-slate-600'}`}>Oportunidades / Serviços</button></div><section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><article className="rounded-3xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b p-5"><div><h3 className="font-semibold">{listMeta.title}</h3><p className="mt-1 text-sm text-slate-500">{listMeta.description}</p></div>{canAdmin&&<button onClick={newList} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4"/>{listMeta.newLabel}</button>}</div><div className="divide-y">{listRows.length===0?<div className="p-10 text-center text-sm text-slate-500">Nenhum item cadastrado nesta lista.</div>:listRows.map(row=><div key={row.id} className="flex items-center justify-between gap-3 p-4"><div><div className="font-semibold">{row.valor}</div><div className="text-xs text-slate-500">Ordem {row.ordem}</div></div><div className="flex items-center gap-2"><span className={`text-xs font-semibold ${row.ativo?'text-emerald-700':'text-slate-400'}`}>{row.ativo?'ATIVA':'INATIVA'}</span>{canAdmin&&<button onClick={()=>editList(row)} className="rounded-lg border p-2"><Edit3 className="h-4 w-4"/></button>}</div></div>)}</div></article><article className="rounded-3xl border bg-white p-6 shadow-sm"><ListChecks className="h-5 w-5 text-teal-700"/><h3 className="mt-4 font-semibold">Tipos / grupos de análise</h3><p className="mt-2 text-sm text-slate-600">O campo “Tipo de análise” usa diretamente os <strong>Grupos</strong> do Catálogo.</p><Link to="/catalogo" className="mt-5 inline-flex rounded-xl border px-4 py-2.5 text-sm font-semibold">Abrir Catálogo</Link></article></section></section>}
    {tab==='laboratorios'&&<section className="rounded-3xl border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">Rede de Laboratórios Parceiros</h3><p className="mt-1 text-sm text-slate-500">Cadastre, edite e inative os laboratórios disponíveis para seleção nas propostas. Uma proposta pode usar vários laboratórios.</p></div>{canAdmin&&<button onClick={newLab} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Novo laboratório</button>}</div><div className="divide-y">{labs.length===0?<div className="p-10 text-center text-sm text-slate-500">Sem laboratórios cadastrados.</div>:labs.map(l=><div key={l.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">{l.nome}</div><div className="mt-1 text-sm text-slate-500">{[l.cpf_cnpj,l.contato,l.telefone,l.email].filter(Boolean).join(' · ')||'Sem dados complementares'}</div></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${l.ativo?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{l.ativo?'ATIVO':'INATIVO'}</span>{canAdmin&&<><button onClick={()=>editLab(l)} className="rounded-lg border p-2"><Edit3 className="h-4 w-4"/></button><button onClick={()=>void toggleLab(l)} className="rounded-lg border p-2">{l.ativo?<ToggleRight className="h-4 w-4 text-teal-700"/>:<ToggleLeft className="h-4 w-4"/>}</button></>}</div></div>)}</div></section>}
    {tab==='integracoes'&&<section className="grid gap-5 lg:grid-cols-2"><article className="rounded-3xl border bg-white p-6 shadow-sm"><Link2 className="h-5 w-5 text-teal-700"/><h3 className="mt-4 font-semibold">ChatPro</h3><p className="mt-2 text-sm text-slate-600">A integração será ativada após validar o formato real dos eventos e a segurança do endpoint.</p><Link to="/integracoes" className="mt-5 inline-flex rounded-xl border px-4 py-2.5 text-sm font-semibold">Ver integrações</Link></article><article className="rounded-3xl border bg-white p-6 shadow-sm"><KeyRound className="h-5 w-5 text-teal-700"/><h3 className="mt-4 font-semibold">Google Agenda</h3><p className="mt-2 text-sm text-slate-600">Para criar, alterar e cancelar coletas será usada a API oficial com autorização.</p><Link to="/agenda" className="mt-5 inline-flex rounded-xl border px-4 py-2.5 text-sm font-semibold">Abrir Agenda do CRM</Link></article></section>}

    <Modal open={userOpen} onClose={()=>setUserOpen(false)} title={userForm.id?'Editar usuário':'Criar conta'}><form onSubmit={saveUser} className="grid gap-4 sm:grid-cols-2">{userForm.id&&canAdmin&&<AdminUserAvatarEditor userId={userForm.id} name={userForm.nome||userForm.email} avatarUrl={editingUser?.avatar_url||null} onChanged={avatarUrl=>handleAvatarChanged(userForm.id,avatarUrl)}/>} {!userForm.id&&<div className="sm:col-span-2 rounded-2xl border border-dashed bg-slate-50 p-4 text-sm text-slate-600"><strong>Foto do usuário:</strong> crie a conta primeiro. Assim que ela for criada, este mesmo cadastro ficará aberto para você adicionar a foto antes de sair.</div>}<label><span className="mb-1 block text-sm font-medium">Nome</span><input required value={userForm.nome} onChange={e=>setUserForm({...userForm,nome:e.target.value})} className="w-full rounded-xl border px-3 py-2.5"/></label><label><span className="mb-1 block text-sm font-medium">E-mail / login</span><input required type="email" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} className="w-full rounded-xl border px-3 py-2.5"/></label><label><span className="mb-1 block text-sm font-medium">{userForm.id?'Nova senha (opcional)':'Senha inicial'}</span><input required={!userForm.id} type="password" minLength={8} value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})} className="w-full rounded-xl border px-3 py-2.5"/></label><label><span className="mb-1 block text-sm font-medium">Perfil de acesso</span><select required value={userForm.role_id} disabled={userForm.id===profile?.id} onChange={e=>setUserForm({...userForm,role_id:e.target.value})} className="w-full rounded-xl border bg-white px-3 py-2.5"><option value="">Selecione</option>{visibleRoles.map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>{userForm.id&&<label className="sm:col-span-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3"><input type="checkbox" checked={userForm.ativo} disabled={userForm.id===profile?.id} onChange={e=>setUserForm({...userForm,ativo:e.target.checked})} className="h-5 w-5"/><span className="text-sm font-medium">Usuário ativo</span></label>}<div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={()=>setUserOpen(false)} className="rounded-xl border px-4 py-2.5">Cancelar</button><button disabled={saving} className="rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white">{saving?'Salvando...':userForm.id?'Salvar usuário':'Criar conta e adicionar foto'}</button></div></form></Modal>
    <Modal open={listOpen} onClose={()=>setListOpen(false)} title={listForm.id?`Editar: ${listMeta.title}`:listMeta.newLabel}><form onSubmit={saveList} className="space-y-4"><label><span className="mb-1 block text-sm font-medium">{listMeta.fieldLabel}</span><input required value={listForm.valor} onChange={e=>setListForm({...listForm,valor:e.target.value})} className="w-full rounded-xl border px-3 py-2.5"/></label><label><span className="mb-1 block text-sm font-medium">Ordem</span><input type="number" value={listForm.ordem} onChange={e=>setListForm({...listForm,ordem:e.target.value})} className="w-full rounded-xl border px-3 py-2.5"/></label><label className="flex items-center gap-3"><input type="checkbox" checked={listForm.ativo} onChange={e=>setListForm({...listForm,ativo:e.target.checked})} className="h-5 w-5"/><span className="text-sm font-medium">Item ativo</span></label><div className="flex justify-end gap-2"><button type="button" onClick={()=>setListOpen(false)} className="rounded-xl border px-4 py-2.5">Cancelar</button><button disabled={saving} className="rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white">Salvar</button></div></form></Modal>
    <Modal open={labOpen} onClose={()=>setLabOpen(false)} title={labForm.id?'Editar laboratório':'Novo laboratório parceiro'}><form onSubmit={saveLab} className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Nome do laboratório</span><input required value={labForm.nome} onChange={e=>setLabForm({...labForm,nome:e.target.value})} className="w-full rounded-xl border px-3 py-2.5"/></label><label><span className="mb-1 block text-sm font-medium">CNPJ/CPF</span><input value={labForm.cpf_cnpj} onChange={e=>setLabForm({...labForm,cpf_cnpj:e.target.value})} className="w-full rounded-xl border px-3 py-2.5"/></label><label><span className="mb-1 block text-sm font-medium">Contato</span><input value={labForm.contato} onChange={e=>setLabForm({...labForm,contato:e.target.value})} className="w-full rounded-xl border px-3 py-2.5"/></label><label><span className="mb-1 block text-sm font-medium">Telefone</span><input value={labForm.telefone} onChange={e=>setLabForm({...labForm,telefone:e.target.value})} className="w-full rounded-xl border px-3 py-2.5"/></label><label><span className="mb-1 block text-sm font-medium">E-mail</span><input type="email" value={labForm.email} onChange={e=>setLabForm({...labForm,email:e.target.value})} className="w-full rounded-xl border px-3 py-2.5"/></label><label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium">Observações</span><textarea value={labForm.observacoes} onChange={e=>setLabForm({...labForm,observacoes:e.target.value})} className="min-h-24 w-full rounded-xl border px-3 py-2.5"/></label><label className="sm:col-span-2 flex items-center gap-3"><input type="checkbox" checked={labForm.ativo} onChange={e=>setLabForm({...labForm,ativo:e.target.checked})} className="h-5 w-5"/><span className="text-sm font-medium">Laboratório ativo</span></label><div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={()=>setLabOpen(false)} className="rounded-xl border px-4 py-2.5">Cancelar</button><button disabled={saving} className="rounded-xl bg-teal-700 px-4 py-2.5 font-semibold text-white">Salvar laboratório</button></div></form></Modal>
  </PageShell>
}
