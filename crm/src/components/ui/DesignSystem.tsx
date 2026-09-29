import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

type ButtonVariant='primary'|'secondary'|'danger'
type BadgeVariant='brand'|'success'|'warning'|'danger'|'info'

export function Button({variant='primary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:ButtonVariant}){
  return <button {...props} className={`ds-button ds-button-${variant} ${className}`.trim()}/>
}

export function Card({className='',children,...props}:HTMLAttributes<HTMLDivElement>&{children:ReactNode}){
  return <div {...props} className={`ds-card ${className}`.trim()}>{children}</div>
}

export function CardHeader({className='',children,...props}:HTMLAttributes<HTMLDivElement>&{children:ReactNode}){
  return <div {...props} className={`ds-card-header ${className}`.trim()}>{children}</div>
}

export function CardBody({className='',children,...props}:HTMLAttributes<HTMLDivElement>&{children:ReactNode}){
  return <div {...props} className={`ds-card-body ${className}`.trim()}>{children}</div>
}

export function Badge({variant='brand',className='',children,...props}:HTMLAttributes<HTMLSpanElement>&{variant?:BadgeVariant;children:ReactNode}){
  return <span {...props} className={`ds-badge ds-badge-${variant} ${className}`.trim()}>{children}</span>
}

export function FieldLabel({children,className=''}:{children:ReactNode;className?:string}){
  return <span className={`ds-label ${className}`.trim()}>{children}</span>
}

export function Input({className='',...props}:InputHTMLAttributes<HTMLInputElement>){
  return <input {...props} className={`ds-field ${className}`.trim()}/>
}

export function Select({className='',children,...props}:SelectHTMLAttributes<HTMLSelectElement>&{children:ReactNode}){
  return <select {...props} className={`ds-field ${className}`.trim()}>{children}</select>
}

export function SectionTitle({children,className=''}:{children:ReactNode;className?:string}){
  return <h3 className={`ds-section-title ${className}`.trim()}>{children}</h3>
}

export function Caption({children,className=''}:{children:ReactNode;className?:string}){
  return <span className={`ds-caption ${className}`.trim()}>{children}</span>
}
