// A visão "Lista": uma linha por tarefa, na ordem do prazo.
import { Flame } from "lucide-react";
import { Empty } from "../ui.jsx";
import Avatar from "./Avatar.jsx";
import { ChipPrazo } from "./CartaoTarefa.jsx";
import { STATUS_TAREFA, progressoChecklist } from "../../lib/tarefas.js";

export default function ListaTarefas({ tarefas, nomes, agora, aoAbrir, aoCriar }) {
  if (tarefas.length === 0) {
    return (
      <Empty className="py-10">
        <span className="font-display font-semibold text-slate-700">Nenhuma tarefa por aqui.</span>
        <button type="button" className="btn-primary mt-3" onClick={aoCriar}>Criar tarefa</button>
      </Empty>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: "var(--hairline)" }}>
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr><th className="px-3 py-2">Tarefa</th><th className="px-3 py-2">Prazo</th><th className="px-3 py-2">Responsável</th><th className="px-3 py-2">Proprietário</th><th className="px-3 py-2">Situação</th></tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--hairline)" }}>
          {tarefas.map((t) => {
            const st = STATUS_TAREFA[t.status] || STATUS_TAREFA.nova;
            return (
              <tr key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => aoAbrir(t.id)}>
                <td className="px-3 py-2.5">
                  <button type="button" className="flex items-start gap-1.5 text-left font-medium text-slate-900" onClick={(e) => { e.stopPropagation(); aoAbrir(t.id); }}>
                    {t.urgente && <Flame size={14} className="mt-0.5 shrink-0 text-orange-500" aria-label="Urgente" />}
                    <span className="[overflow-wrap:anywhere]">{t.titulo}</span>
                    {t.naoLidas > 0 && <span className="ml-1 grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{t.naoLidas}</span>}
                  </button>
                  {t.checklist.total > 0 && (
                    <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200"><span className="block h-full bg-emerald-500" style={{ width: `${progressoChecklist(t.checklist)}%` }} /></span>
                      {t.checklist.feitos}/{t.checklist.total}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5"><ChipPrazo tarefa={t} agora={agora} /></td>
                <td className="px-3 py-2.5"><span className="flex items-center gap-2"><Avatar usuario={t.responsavel} nome={nomes[t.responsavel]} tamanho={24} />{nomes[t.responsavel] || t.responsavel}</span></td>
                <td className="px-3 py-2.5"><span className="flex items-center gap-2"><Avatar usuario={t.proprietario} nome={nomes[t.proprietario]} tamanho={24} />{nomes[t.proprietario] || t.proprietario}</span></td>
                <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.classe}`}>{st.rotulo}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
