// O quadro "Prazo": colunas Vencido, Vence hoje, Esta semana, Próxima semana, Mais tarde e Sem prazo.
import { useMemo } from "react";
import { Empty } from "../ui.jsx";
import CartaoTarefa from "./CartaoTarefa.jsx";
import { agruparPorPrazo } from "../../lib/tarefas.js";

export default function QuadroPrazo({ tarefas, nomes, agora, aoAbrir, aoCriar }) {
  const colunas = useMemo(() => agruparPorPrazo(tarefas, agora), [tarefas, agora]);
  const total = colunas.reduce((n, c) => n + c.tarefas.length, 0);
  if (total === 0) {
    return (
      <Empty className="py-10">
        <span className="font-display font-semibold text-slate-700">Nenhuma tarefa por aqui.</span>
        <span className="mt-1">Crie uma tarefa ou mude o filtro para ver as concluídas.</span>
        <button type="button" className="btn-primary mt-3" onClick={aoCriar}>Criar tarefa</button>
      </Empty>
    );
  }
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3" role="list" aria-label="Tarefas por prazo">
      {colunas.map((c) => (
        <section key={c.id} role="listitem" aria-label={`${c.titulo}: ${c.tarefas.length}`} className="w-[17.5rem] shrink-0 snap-start sm:w-72">
          <header className="mb-2 flex items-center justify-between rounded-lg px-3 py-2 font-display text-sm font-bold" style={{ backgroundColor: c.cor, color: c.texto }}>
            <span>{c.titulo}</span>
            <span className="rounded-full bg-white/60 px-2 text-xs">{c.tarefas.length}</span>
          </header>
          <div className="space-y-2">
            {c.tarefas.map((t) => <CartaoTarefa key={t.id} tarefa={t} nomes={nomes} agora={agora} corFaixa={c.cor} aoAbrir={aoAbrir} />)}
            {c.tarefas.length === 0 && <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-slate-400" style={{ borderColor: "var(--hairline)" }}>Nada aqui</p>}
          </div>
        </section>
      ))}
    </div>
  );
}
