// Tela inicial do Laboratório: o que pede atenção hoje (tirado das Entradas
// de amostras) e os atalhos para cada área. Cada número leva direto à aba
// correspondente das Entradas.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, ClipboardList, Clock3, FlaskConical, Microscope, ShieldCheck, Timer, Trash2, Inbox } from "lucide-react";
import { listarEntradas } from "../../services/laboratorio.js";
import { contagens, tempoMedio, PRAZO_ALERTA_DIAS } from "../../lib/laboratorioEntradas.js";
import { ymdLocal } from "../../lib/format.js";
import { StatCard } from "../ui.jsx";

export const AREAS = [
  { valor: "entradas", rotulo: "Entradas de amostras", icone: ClipboardList, cor: "bg-sky-50 text-sky-700",
    texto: "Recebimento, retirada, finalização, liberação e descarte das amostras.", pronta: true },
  { valor: "qualidade", rotulo: "Qualidade", icone: ShieldCheck, cor: "bg-emerald-50 text-emerald-700",
    texto: "Documentos, equipamentos, não conformidades e auditorias." },
  { valor: "microbiologia", rotulo: "Microbiologia", icone: Microscope, cor: "bg-violet-50 text-violet-700",
    texto: "Fila de análises MB, resultados, meios de cultura e estufas." },
  { valor: "fisicoquimico", rotulo: "Físico-Químico", icone: FlaskConical, cor: "bg-amber-50 text-amber-700",
    texto: "Fila de análises FQ, resultados por parâmetro, reagentes e padrões." },
];

export default function InicioLaboratorio({ irPara }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const hoje = ymdLocal(new Date());
  const carregar = useCallback(async () => {
    setErro("");
    try { const r = await listarEntradas(); setLista(r.itens || []); }
    catch (e) { setErro(e.message || "Não foi possível carregar as entradas."); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const c = useMemo(() => (lista ? contagens(lista, hoje) : null), [lista, hoje]);
  const media = useMemo(() => (lista ? tempoMedio(lista, hoje) : null), [lista, hoje]);
  const n = (v) => (c ? v : "…");
  const abrir = (aba) => irPara("entradas", aba);

  return (
    <div className="space-y-5">
      <section aria-labelledby="lab-hoje">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 id="lab-hoje" className="font-display text-sm font-semibold uppercase tracking-wide text-slate-500">Pede atenção</h2>
          {erro ? <button type="button" onClick={carregar} className="text-xs text-bad-700 underline">Não carregou — tentar de novo</button>
            : <span className="text-xs text-slate-400">Clique num número para abrir a lista</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard rotulo="Em aberto" valor={n(c?.ABERTAS)} sub="ainda não liberadas" icone={Inbox} onClick={() => abrir("ABERTAS")} />
          <StatCard rotulo={`Mais de ${PRAZO_ALERTA_DIAS} dias`} valor={n(c?.ATRASADAS)} sub="sem liberação" tom={c?.ATRASADAS ? "bad" : "neutral"} icone={Clock3} onClick={() => abrir("ATRASADAS")} />
          <StatCard rotulo="Parâmetro imediato" valor={n(c?.IMEDIATO)} sub="em aberto" tom={c?.IMEDIATO ? "warn" : "neutral"} icone={Timer} onClick={() => abrir("IMEDIATO")} />
          <StatCard rotulo="Descartar" valor={n(c?.DESCARTE_PENDENTE)} sub="prazo de 5 dias vencido" tom={c?.DESCARTE_PENDENTE ? "warn" : "neutral"} icone={Trash2} onClick={() => abrir("DESCARTE_PENDENTE")} />
          <StatCard rotulo="Com pendência" valor={n(c?.PENDENCIAS)} sub="dados a corrigir" tom={c?.PENDENCIAS ? "warn" : "neutral"} icone={AlertTriangle} onClick={() => abrir("PENDENCIAS")} />
          <StatCard rotulo="Tempo médio" valor={c ? (media === null ? "—" : `${String(media).replace(".", ",")} d`) : "…"} sub="recebimento → liberação (30 dias)" icone={Clock3} />
        </div>
      </section>

      <section aria-labelledby="lab-areas">
        <h2 id="lab-areas" className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-slate-500">Áreas do laboratório</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {AREAS.map((a) => {
            const Icone = a.icone;
            return (
              <button key={a.valor} type="button" onClick={() => irPara(a.valor)} className="card card-hover group flex flex-col gap-3 p-4 text-left">
                <div className="flex items-center justify-between">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${a.cor}`}><Icone className="h-5 w-5" aria-hidden /></span>
                  {a.pronta
                    ? <span className="rounded-full bg-ok-50 px-2 py-0.5 text-[11px] font-semibold text-ok-700">Em uso</span>
                    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Em breve</span>}
                </div>
                <div>
                  <p className="font-display text-base font-semibold text-slate-900">{a.rotulo}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{a.texto}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-brand">
                  {a.pronta ? "Abrir" : "Ver o que vai ter"} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
