// O cartão da tarefa no quadro e na lista: nome, lista de verificação, prazo, quem pediu e quem faz.
import { ChevronRight, Flame, ListChecks, MessageSquare } from "lucide-react";
import { clsx } from "clsx";
import Avatar from "./Avatar.jsx";
import { atrasoTexto, colunaDoPrazo, rotuloPrazo } from "../../lib/tarefas.js";

export function ChipPrazo({ tarefa, agora, className }) {
  if (tarefa.status === "concluida") return <span className={clsx("chip-prazo bg-emerald-50 text-emerald-700", className)}>Concluída</span>;
  const col = colunaDoPrazo(tarefa, agora);
  if (col === "vencido") return <span className={clsx("chip-prazo bg-red-50 text-red-700", className)}>- {atrasoTexto(tarefa.prazo, agora)}</span>;
  if (col === "sem_prazo") return <span className={clsx("chip-prazo bg-slate-100 text-slate-600", className)}>Sem prazo</span>;
  const cor = col === "hoje" ? "bg-amber-100 text-amber-800" : "bg-sky-50 text-sky-800";
  return <span className={clsx("chip-prazo", cor, className)}>{rotuloPrazo(tarefa.prazo, agora)}</span>;
}

export default function CartaoTarefa({ tarefa, nomes, agora, corFaixa, aoAbrir }) {
  const { checklist } = tarefa;
  return (
    <button
      type="button"
      onClick={() => aoAbrir(tarefa.id)}
      className="cartao-tarefa group block w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md"
      style={{ borderColor: "var(--hairline)", borderLeft: `4px solid ${corFaixa || "#cbd5e1"}` }}
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1 font-display text-sm font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">
          {tarefa.urgente && <Flame size={14} className="mr-1 inline -translate-y-px text-orange-500" aria-label="Urgente" />}
          {tarefa.titulo}
        </span>
        {tarefa.naoLidas > 0 && (
          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white" aria-label={`${tarefa.naoLidas} novidade${tarefa.naoLidas > 1 ? "s" : ""}`}>{tarefa.naoLidas}</span>
        )}
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        {checklist.total > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-slate-600" style={{ borderColor: "var(--hairline)" }}>
            <ListChecks size={12} aria-hidden="true" />{checklist.feitos}/{checklist.total}
          </span>
        )}
        <ChipPrazo tarefa={tarefa} agora={agora} />
        {tarefa.subtarefas > 0 && <span className="text-xs text-slate-500">{tarefa.subtarefas} subtarefa{tarefa.subtarefas > 1 ? "s" : ""}</span>}
        {tarefa.marcadores.slice(0, 2).map((m) => <span key={m} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">#{m}</span>)}
      </span>
      <span className="mt-2.5 flex items-center gap-1" aria-label={`De ${nomes[tarefa.proprietario] || tarefa.proprietario} para ${nomes[tarefa.responsavel] || tarefa.responsavel}`}>
        <Avatar usuario={tarefa.proprietario} nome={nomes[tarefa.proprietario]} tamanho={24} />
        <ChevronRight size={14} className="text-slate-400" aria-hidden="true" />
        <Avatar usuario={tarefa.responsavel} nome={nomes[tarefa.responsavel]} tamanho={24} />
        {(tarefa.participantes.length > 0 || tarefa.observadores.length > 0) && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-slate-500"><MessageSquare size={11} aria-hidden="true" />+{tarefa.participantes.length + tarefa.observadores.length}</span>
        )}
      </span>
    </button>
  );
}
