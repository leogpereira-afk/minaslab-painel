import type { HTMLAttributes, ReactNode } from 'react'
import { AlertTriangle, LoaderCircle, PackageOpen } from 'lucide-react'

export function Toolbar({children,className='',...props}:HTMLAttributes<HTMLDivElement>&{children:ReactNode}){
  return <div {...props} className={`ds-toolbar ${className}`.trim()}>{children}</div>
}

export function TableShell({children,className='',...props}:HTMLAttributes<HTMLDivElement>&{children:ReactNode}){
  return <div {...props} className={`ds-table-shell ${className}`.trim()}>{children}</div>
}

export function TableFooter({children,className='',...props}:HTMLAttributes<HTMLDivElement>&{children:ReactNode}){
  return <div {...props} className={`ds-table-footer ${className}`.trim()}>{children}</div>
}

export function InlineAlert({children,variant='danger',className=''}:{children:ReactNode;variant?:'danger'|'warning'|'info'|'success';className?:string}){
  return <div className={`ds-alert ds-alert-${variant} ${className}`.trim()}>{variant==='danger'&&<AlertTriangle className="h-4 w-4 shrink-0"/>}<span>{children}</span></div>
}

export function TableLoading({label='Carregando...'}:{label?:string}){
  return <div className="ds-table-state"><LoaderCircle className="h-5 w-5 animate-spin text-[var(--brand-600)]"/><span>{label}</span></div>
}

export function TableEmpty({label='Sem dados'}:{label?:string}){
  return <div className="ds-table-state"><PackageOpen className="h-5 w-5 text-[var(--text-muted)]"/><span>{label}</span></div>
}
