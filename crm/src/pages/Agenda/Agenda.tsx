import { ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageShell } from '../../components/ui/PageShell'

const CALENDAR_EMBED = 'https://calendar.google.com/calendar/embed?src=c_fc05ad6b0b6ee0011e0c0a4e01ef618ff1446117a9d663e77bcc7926c4f807e6%40group.calendar.google.com&ctz=America%2FSao_Paulo'

export function Agenda(){
  return <PageShell title="Agenda de Coletas" description="Calendário Google da equipe de coletas, sincronizado com os agendamentos do CRM." action={<Link to="/coletas" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"><ClipboardList className="h-4 w-4"/>Lista de coletas</Link>}>
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <iframe
        title="Agenda de Coletas - MinasLab"
        src={CALENDAR_EMBED}
        className="h-[760px] w-full border-0"
        loading="lazy"
      />
    </section>
  </PageShell>
}
