import type { ReactNode } from 'react'

export function PageShell({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <div className="ds-page" data-page={title}>
    <section className="ds-page-header">
      <div>
        <p className="ds-page-eyebrow">CRM MinasLab</p>
        <h1 className="ds-page-title">{title}</h1>
        <p className="ds-page-description">{description}</p>
      </div>
      {action}
    </section>
    {children}
  </div>
}
