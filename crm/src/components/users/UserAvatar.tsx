type Props={name?:string|null;avatarUrl?:string|null;size?:'sm'|'md'|'lg';className?:string}
const sizes={sm:'h-8 w-8 text-xs',md:'h-10 w-10 text-sm',lg:'h-20 w-20 text-xl'}
export function UserAvatar({name,avatarUrl,size='md',className=''}:Props){
 const initials=(name||'U').trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase()||'U'
 return avatarUrl?<img src={avatarUrl} alt={name?`Foto de ${name}`:'Foto do usuário'} className={`${sizes[size]} shrink-0 rounded-full border border-slate-200 object-cover ${className}`}/>:<span className={`${sizes[size]} grid shrink-0 place-items-center rounded-full bg-[#08a99e] font-semibold text-white ${className}`}>{initials}</span>
}
