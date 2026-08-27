// Vocabulario visual do painel MinasLab. Todos os modulos compoem a partir
// daqui, para o layout ficar consistente. Marca verde-agua, Poppins nos
// titulos e numeros, Inter no corpo.

import { forwardRef, useEffect, useRef } from "react";
import { clsx } from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus, CheckCircle2, AlertTriangle } from "lucide-react";

const TOM = {
  brand: { texto: "text-brand-700", bg: "bg-brand-50", barra: "bg-brand", ponto: "bg-brand" },
  ok: { texto: "text-ok-700", bg: "bg-ok-50", barra: "bg-ok-600", ponto: "bg-ok-600" },
  warn: { texto: "text-warn-700", bg: "bg-warn-50", barra: "bg-warn-600", ponto: "bg-warn-600" },
  bad: { texto: "text-bad-700", bg: "bg-bad-50", barra: "bg-bad-600", ponto: "bg-bad-600" },
  neutral: { texto: "text-slate-600", bg: "bg-slate-100", barra: "bg-slate-400", ponto: "bg-slate-400" },
};

export const Card = forwardRef(function Card({ className, children, ...rest }, ref) {
  return (
    <div ref={ref} className={clsx("card p-5 sm:p-6", className)} {...rest}>
      {children}
    </div>
  );
});

// KPI. valor ja formatado (string). Com onClick vira botao de recorte;
// `ativo` destaca o card quando o filtro dele esta ligado.
export function StatCard({ rotulo, valor, sub, tom = "neutral", icone: Icone, tendencia, onClick, ativo }) {
  const t = TOM[tom] || TOM.neutral;
  const clicavel = typeof onClick === "function";
  const Comp = clicavel ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      aria-pressed={clicavel ? !!ativo : undefined}
      className={clsx(
        "card w-full p-5 text-left transition-all",
        clicavel && "card-hover cursor-pointer",
        ativo && "ring-2 ring-brand ring-offset-2 ring-offset-transparent"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="label mb-0">{rotulo}</p>
        {Icone && (
          <span className={clsx("grid h-9 w-9 place-items-center rounded-xl", t.bg, t.texto)}>
            <Icone size={18} strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="font-display text-3xl font-semibold tnum text-slate-900">{valor}</span>
        {tendencia && <TrendArrow tendencia={tendencia} />}
      </div>
      {sub && <p className={clsx("mt-1.5 text-sm", tom === "neutral" ? "text-slate-500" : t.texto)}>{sub}</p>}
    </Comp>
  );
}

export function TrendArrow({ tendencia }) {
  if (tendencia === "baixa") return <ArrowDownRight size={18} className="mb-1 text-ok-600" strokeWidth={2.4} />;
  if (tendencia === "alta") return <ArrowUpRight size={18} className="mb-1 text-bad-600" strokeWidth={2.4} />;
  return <Minus size={18} className="mb-1 text-slate-400" strokeWidth={2.4} />;
}

export function PageTitle({ titulo, descricao, acao }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{titulo}</h1>
        {descricao && <p className="mt-1 max-w-2xl text-slate-500">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function SectionTitle({ titulo, sub, acao, className }) {
  return (
    // flex-wrap: no celular a acao nao cabe ao lado do titulo. Sem quebrar, a
    // PAGINA INTEIRA passava a rolar de lado.
    <div className={clsx("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold text-slate-900">{titulo}</h2>
        {sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}
      </div>
      {acao && <div className="min-w-0 max-w-full overflow-x-auto">{acao}</div>}
    </div>
  );
}

// Alternador de opcoes (ex.: lista x calendario).
export function Segmented({ opcoes, valor, onChange, className }) {
  return (
    <div className={clsx("inline-flex rounded-xl border bg-white p-1", className)} style={{ borderColor: "var(--hairline)" }}>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          aria-pressed={valor === o.valor}
          className={clsx(
            "rounded-lg px-3 py-1.5 font-display text-sm font-medium transition-all",
            valor === o.valor ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children, className }) {
  return (
    <div
      className={clsx("grid place-items-center rounded-xl border border-dashed py-10 text-center text-sm text-slate-500", className)}
      style={{ borderColor: "var(--hairline)" }}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={clsx("animate-pulse rounded-xl bg-slate-100", className)} />;
}

export function CarregandoModulo() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function ErroModulo({ mensagem, aoTentar }) {
  return (
    <Card className="text-center">
      <p className="font-display text-lg font-semibold text-bad-700">Não foi possível carregar</p>
      <p className="mt-1 text-sm text-slate-500">{mensagem}</p>
      {aoTentar && (
        <button onClick={aoTentar} className="btn-primary mx-auto mt-4">
          Tentar de novo
        </button>
      )}
    </Card>
  );
}

/* AVISO ONDE A PESSOA ESTA OLHANDO (licao paga na Impresilk: o servidor
   recusou e avisou, mas o aviso morava no topo de uma pagina longa e quem
   clicou estava la embaixo — dois dias procurando na tela errada).
   Este aviso e FIXO no alto da area visivel, com aria-live, e o SUCESSO
   tambem fala: sucesso mudo e indistinguivel de falha muda.
   Uso: <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
   com aviso = { tipo: "ok" | "erro", texto } ou null. */
export function Aviso({ aviso, aoFechar, duracaoMs = 5000 }) {
  // aoFechar vem sempre como arrow inline; se entrasse nas dependências, cada
  // re-render do pai (cada tecla digitada num form) recriava o timer do zero e
  // o aviso ficava preso na tela. Callback de prop vai em ref, não em deps.
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => fecharRef.current?.(), aviso.tipo === "erro" ? duracaoMs * 2 : duracaoMs);
    return () => clearTimeout(t);
  }, [aviso, duracaoMs]);

  if (!aviso) return null;
  const ok = aviso.tipo !== "erro";
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "fixed left-1/2 top-4 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-2.5 rounded-xl border px-4 py-3 shadow-card-hover",
        ok ? "border-ok-200 bg-ok-50 text-ok-800" : "border-bad-200 bg-bad-50 text-bad-800"
      )}
    >
      {ok ? <CheckCircle2 size={18} className="shrink-0 text-ok-600" /> : <AlertTriangle size={18} className="shrink-0 text-bad-600" />}
      <span className="text-sm font-medium">{aviso.texto}</span>
      {aoFechar && (
        <button type="button" onClick={aoFechar} className="ml-1 font-display text-xs font-semibold underline opacity-70 hover:opacity-100">
          fechar
        </button>
      )}
    </div>
  );
}

/* Modal padrao dos formularios. SEMPRE declarado fora da pagina que o usa
   (componente dentro de componente remonta a subarvore a cada render — o campo
   perdia o foco a cada letra, em tres telas ao mesmo tempo, com lint verde). */
export function Modal({ titulo, aberto, aoFechar, children, largura = "max-w-lg" }) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e) => {
      if (e.key === "Escape") aoFechar?.();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && aoFechar?.()}>
      <div className={clsx("card w-full p-5 sm:p-6", largura)} role="dialog" aria-modal="true" aria-label={titulo}>
        <h3 className="mb-4 font-display text-lg font-semibold text-slate-900">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}

export { TOM };
