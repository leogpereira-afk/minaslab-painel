import { useRef, useState } from 'react'
import { Camera, ImageUp, Trash2 } from 'lucide-react'
import { supabase } from '../../services/supabase'
import { UserAvatar } from './UserAvatar'

const MAX_SIZE=2*1024*1024
const ALLOWED=['image/jpeg','image/png','image/webp']

type Props={
  userId:string
  name:string
  avatarUrl?:string|null
  onChanged:(avatarUrl:string|null)=>void|Promise<void>
}

function storagePathFromPublicUrl(url?:string|null){
  if(!url)return null
  const marker='/storage/v1/object/public/avatars/'
  const index=url.indexOf(marker)
  if(index<0)return null
  try{return decodeURIComponent(url.slice(index+marker.length).split('?')[0])}catch{return null}
}

export function AdminUserAvatarEditor({userId,name,avatarUrl,onChanged}:Props){
  const input=useRef<HTMLInputElement|null>(null)
  const[busy,setBusy]=useState(false)
  const[error,setError]=useState('')
  const[ok,setOk]=useState('')

  async function upload(file:File){
    setError('');setOk('')
    if(!ALLOWED.includes(file.type)){setError('Formato não permitido. Use JPG, PNG ou WebP.');return}
    if(file.size>MAX_SIZE){setError('A foto deve ter no máximo 2 MB.');return}
    setBusy(true)
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase()
    const path=`${userId}/avatar-${Date.now()}.${ext}`
    const {error:uploadError}=await supabase.storage.from('avatars').upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false})
    if(uploadError){setError(uploadError.message);setBusy(false);return}
    const {data}=supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl=`${data.publicUrl}?v=${Date.now()}`
    const {error:updateError}=await supabase.from('profiles').update({avatar_url:publicUrl,updated_at:new Date().toISOString()}).eq('id',userId)
    if(updateError){await supabase.storage.from('avatars').remove([path]);setError(updateError.message);setBusy(false);return}
    const oldPath=storagePathFromPublicUrl(avatarUrl)
    if(oldPath&&oldPath!==path)await supabase.storage.from('avatars').remove([oldPath])
    await onChanged(publicUrl)
    setOk('Foto atualizada com sucesso.')
    setBusy(false)
  }

  async function remove(){
    setBusy(true);setError('');setOk('')
    const {error:updateError}=await supabase.from('profiles').update({avatar_url:null,updated_at:new Date().toISOString()}).eq('id',userId)
    if(updateError){setError(updateError.message);setBusy(false);return}
    const oldPath=storagePathFromPublicUrl(avatarUrl)
    if(oldPath)await supabase.storage.from('avatars').remove([oldPath])
    await onChanged(null)
    setOk('Foto removida.')
    setBusy(false)
  }

  return <div className="sm:col-span-2 rounded-2xl border bg-slate-50 p-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative w-fit"><UserAvatar name={name} avatarUrl={avatarUrl} size="lg" className="h-24 w-24"/><button type="button" onClick={()=>input.current?.click()} disabled={busy} className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-teal-700 text-white shadow disabled:opacity-50" title="Alterar foto"><Camera className="h-4 w-4"/></button></div>
      <div className="flex-1"><div className="font-semibold text-slate-800">Foto do usuário</div><p className="mt-1 text-xs text-slate-500">Somente administradores podem adicionar, trocar ou remover. JPG, PNG ou WebP, até 2 MB.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>input.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><ImageUp className="h-4 w-4"/>{busy?'Processando...':avatarUrl?'Alterar foto':'Adicionar foto'}</button>{avatarUrl&&<button type="button" onClick={()=>void remove()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"><Trash2 className="h-4 w-4"/>Remover foto</button>}</div></div>
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.currentTarget.value=''}}/>
    {error&&<div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}{ok&&<div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</div>}
  </div>
}
