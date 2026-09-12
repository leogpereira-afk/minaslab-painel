// O calendario mensal do painel — o MESMO componente serve a Agenda geral e o
// calendario das Coletas: um mapa de eventos por dia entra, uma grade de mes
// sai. Quem decide o que e "evento" e a tela que chama.
//
// Contrato:
//   eventosPorDia: { "2026-08-27": [{ cor: "brand"|"ok"|"warn"|"bad"|"neutral",
//                                     rotulo: "9h Coleta ETE Prefeitura" }, ...] }
//   diaSelecionado / aoEscolherDia: o clique no dia e da tela, nao daqui.
//
// Datas sempre em texto "AAAA-MM-DD" LOCAL (ymdLocal) — nunca toISOString():
// depois das 21h no Brasil o UTC ja virou amanha e o evento nasceria um dia
// a frente.

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ymdLocal, MESES_LONGOS } from "../lib/format.js";

const PONTO = {
  brand: "bg-brand",
  ok: "bg-ok-600",
  warn: "bg-warn-500",
  bad: "bg-bad-600",
  neutral: "bg-slate-400",
};

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function CalendarioMes({ eventosPorDia = {}, diaSelecionado, aoEscolherDia, aoMudarMes }) {
  const hoje = ymdLocal(new Date());
  // O mes exibido e estado PROPRIO: navegar o calendario nao mexe no dia
  // escolhido pela tela.
  const [ancora, setAncora] = useState(() => {
    const base = diaSelecionado || hoje;
    return base.slice(0, 7); // "AAAA-MM"
  });

  const [ano, mes] = ancora.split("-").map(Number);
  const primeiro = new Date(ano, mes - 1, 1);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const comecaEm = primeiro.getDay(); // 0 = domingo

  const mudarMes = (delta) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    setAncora(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  /* AVISA QUAL MÊS ESTÁ NA TELA. O mês continua sendo estado desta grade —
     quem navega o calendário não mexe no dia escolhido pela página. Mas há
     evento que só EXISTE depois de se saber o ano: aniversário se repete todo
     ano, e alguém tem de gerar a ocorrência de 2029 quando o dedo chega em
     2029. Sem este aviso, navegar para longe apagaria os aniversários da grade
     em silêncio — e sumiço silencioso se lê como sistema quebrado.

     `aoMudarMes` é opcional: quem não passa continua com a grade de sempre. */
  useEffect(() => {
    aoMudarMes?.(ancora);
  }, [ancora, aoMudarMes]);

  const celulas = [];
  for (let i = 0; i < comecaEm; i++) celulas.push(null);
  for (let dia = 1; dia <= diasNoMes; dia++) {
    celulas.push(`${ancora}-${String(dia).padStart(2, "0")}`);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-1">
        <button type="button" onClick={() => mudarMes(-1)} className="btn-ghost h-11 w-11 shrink-0 p-0" aria-label="Mês anterior" title="Mês anterior">
          <ChevronLeft size={18} />
        </button>
        <span aria-live="polite" aria-atomic="true" className="text-center font-display text-base font-semibold capitalize text-slate-900">
          {MESES_LONGOS[mes - 1]} de {ano}
        </span>
        <button type="button" onClick={() => mudarMes(1)} className="btn-ghost h-11 w-11 shrink-0 p-0" aria-label="Próximo mês" title="Próximo mês">
          <ChevronRight size={18} />
        </button>
      </div>

      <button
        type="button"
        className="btn-outline mb-3 min-h-11 w-full"
        onClick={() => {
          setAncora(hoje.slice(0, 7));
          aoEscolherDia?.(hoje);
        }}
      >
        Ir para hoje
      </button>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1" role="group" aria-label="Escolher dia do calendário">
        {DIAS_SEMANA.map((d) => (
          <span key={d} aria-hidden="true" className="pb-1 text-center font-display text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {d}
          </span>
        ))}
        {celulas.map((diaISO, i) => {
          if (!diaISO) return <span key={`v${i}`} />;
          const eventos = eventosPorDia[diaISO] || [];
          const ehHoje = diaISO === hoje;
          const escolhido = diaISO === diaSelecionado;
          return (
            <button
              key={diaISO}
              type="button"
              onClick={() => aoEscolherDia?.(escolhido ? null : diaISO)}
              aria-pressed={escolhido}
              aria-current={ehHoje ? "date" : undefined}
              aria-label={`${new Date(diaISO + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${ehHoje ? ", hoje" : ""}, ${eventos.length === 0 ? "sem eventos" : `${eventos.length} ${eventos.length === 1 ? "evento" : "eventos"}`}`}
              title={eventos.map((e) => e.rotulo).join("\n") || undefined}
              className={clsx(
                "flex min-h-[52px] min-w-0 flex-col items-center gap-1 rounded-xl border px-0.5 py-2 text-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-h-[60px]",
                escolhido
                  ? "border-brand bg-brand-50 ring-2 ring-brand"
                  : "hover:border-brand-300 hover:bg-brand-50/50",
                !escolhido && "bg-white"
              )}
              style={escolhido ? undefined : { borderColor: "var(--hairline)" }}
            >
              <span
                className={clsx(
                  "grid h-6 w-6 place-items-center rounded-full font-display text-xs font-semibold tnum",
                  ehHoje ? "bg-brand text-white" : "text-slate-700"
                )}
              >
                {Number(diaISO.slice(8, 10))}
              </span>
              {/* O total não disputa largura com as cores nos dias cheios. */}
              {eventos.length > 0 && (
                <span aria-hidden="true" className="flex max-w-full flex-col items-center gap-0.5">
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {eventos.slice(0, 4).map((evento, indice) => (
                      <span key={indice} className={clsx("h-1 w-1 shrink-0 rounded-full sm:h-1.5 sm:w-1.5", PONTO[evento.cor] || PONTO.neutral)} />
                    ))}
                  </span>
                  <span className="font-display text-[10px] font-semibold text-slate-600">{eventos.length}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
