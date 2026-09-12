import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
export default function ModalFinanceiro({titulo,onClose,children,ocupado=false,erro=''}){
 const ref=useRef(null),id=useId();
 useEffect(()=>{const anterior=document.activeElement;ref.current?.showModal();return()=>{anterior?.focus?.()}},[]);
 return <dialog ref={ref} aria-labelledby={id} aria-busy={ocupado} onCancel={e=>{e.preventDefault();if(!ocupado)onClose()}} className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl rounded-2xl p-0 shadow-2xl backdrop:bg-slate-950/45"><header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><h2 id={id} className="font-bold text-blue-900">{titulo}</h2><button type="button" aria-label="Fechar janela" disabled={ocupado} className="btn-ghost" onClick={onClose}><X size={18}/></button></header><div className="p-5">{erro&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}<fieldset disabled={ocupado} className="min-w-0">{children}</fieldset></div></dialog>
}
