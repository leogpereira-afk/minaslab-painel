import { X } from "lucide-react";

export const FILTRO_COLUNA_CLASS = "table-filter";

export function FiltroTexto({ valor, onChange, placeholder = "Filtrar...", ariaLabel }) {
  return <input className={FILTRO_COLUNA_CLASS} value={valor ?? ""} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder} aria-label={ariaLabel||placeholder}/>;
}

export function FiltroSelect({ valor, onChange, opcoes = [], todos = "Todos", ariaLabel }) {
  return <select className={FILTRO_COLUNA_CLASS} value={valor ?? ""} onChange={e=>onChange?.(e.target.value)} aria-label={ariaLabel||"Filtrar coluna"}>
    <option value="">{todos}</option>
    {opcoes.map(o=>{const item=o&&typeof o==="object"?o:{valor:o,rotulo:String(o)};return <option key={String(item.valor)} value={item.valor}>{item.rotulo}</option>})}
  </select>;
}

export function FiltroData({ valor, onChange, ariaLabel = "Filtrar por data" }) {
  return <input type="date" className={FILTRO_COLUNA_CLASS} value={valor ?? ""} onChange={e=>onChange?.(e.target.value)} aria-label={ariaLabel}/>;
}

export function FiltroNumero({ valor, onChange, placeholder = "Valor", ariaLabel }) {
  return <input type="number" inputMode="decimal" className={FILTRO_COLUNA_CLASS} value={valor ?? ""} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder} aria-label={ariaLabel||placeholder}/>;
}

export function CabecalhoFiltro({ titulo, children, className = "" }) {
  return <th className={className}><span className="table-filter-label">{titulo}</span>{children}</th>;
}

export function LimparFiltros({ visivel, onClick }) {
  if(!visivel)return null;
  return <button type="button" className="btn-secondary text-xs" onClick={onClick}><X size={14}/>Limpar filtros</button>;
}

export function normalizaTexto(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}
export function contem(valor,filtro){return !filtro||normalizaTexto(valor).includes(normalizaTexto(filtro))}
export function dataNoIntervalo(valor,de,ate){const d=String(valor??"").slice(0,10);return (!de||d>=de)&&(!ate||d<=ate)}
export function numeroNoIntervalo(valor,min,max){const n=Number(valor||0);return (!min||n>=Number(min))&&(!max||n<=Number(max))}
