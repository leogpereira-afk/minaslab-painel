import { ChevronLeft, ChevronRight } from "lucide-react";

export default function PaginacaoFinanceiro({
  total = 0,
  pagina = 1,
  paginas = 1,
  porPagina = 25,
  itensNaPagina = 0,
  onPagina,
  onPorPagina,
  extra = null,
}) {
  const totalPaginas = Math.max(1, Number(paginas) || 1);
  const paginaAtual = Math.min(Math.max(1, Number(pagina) || 1), totalPaginas);
  const inicio = total > 0 ? (paginaAtual - 1) * porPagina + 1 : 0;
  const fim = total > 0 ? Math.min(inicio + Math.max(0, itensNaPagina) - 1, total) : 0;

  return (
    <div className="financeiro-paginacao flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-xs text-slate-600">
      <div>
        {total > 0 ? `${inicio}–${fim} de ${total}` : "0 registros"}
        {extra}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px]">Por página</span>
        <select
          aria-label="Registros por página"
          className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[10px]"
          value={porPagina}
          onChange={(e) => onPorPagina?.(Number(e.target.value))}
          disabled={!onPorPagina}
        >
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button
          type="button"
          aria-label="Página anterior"
          title="Página anterior"
          className="rounded-md border border-slate-200 bg-white p-1 disabled:opacity-40"
          disabled={paginaAtual <= 1}
          onClick={() => onPagina?.(paginaAtual - 1)}
        >
          <ChevronLeft size={14} />
        </button>
        <span className="min-w-[62px] text-center text-[10px]">{paginaAtual} / {totalPaginas}</span>
        <button
          type="button"
          aria-label="Próxima página"
          title="Próxima página"
          className="rounded-md border border-slate-200 bg-white p-1 disabled:opacity-40"
          disabled={paginaAtual >= totalPaginas}
          onClick={() => onPagina?.(paginaAtual + 1)}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
