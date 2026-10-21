// Lista de emojis para pôr na mensagem (ou reagir): recentes, categorias e busca por palavra. Fecha com Esc ou clicando fora.
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { clsx } from "clsx";
import { CATEGORIAS, buscarEmojis, comRecente, gravarRecentes, lerRecentes } from "../../lib/emojis.js";

export default function SeletorEmoji({ aoEscolher, aoFechar, className }) {
  const raiz = useRef(null);
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("recentes");
  const [recentes, setRecentes] = useState(lerRecentes);

  useEffect(() => {
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) aoFechar(); };
    const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); aoFechar(); } };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla, true);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla, true); };
  }, [aoFechar]);

  const escolher = (emoji) => {
    const novos = comRecente(recentes, emoji);
    setRecentes(novos); gravarRecentes(novos);
    aoEscolher(emoji);
  };
  const lista = useMemo(() => {
    if (busca.trim()) return buscarEmojis(busca);
    if (cat === "recentes") return recentes;
    return CATEGORIAS.find((c) => c.id === cat)?.itens.map(([e]) => e) || [];
  }, [busca, cat, recentes]);

  return (
    <div ref={raiz} className={clsx("z-40 w-80 max-w-[92vw] rounded-2xl border bg-white p-2 shadow-xl", className)} style={{ borderColor: "var(--hairline)" }} role="dialog" aria-label="Escolher emoji">
      <div className="relative mb-2">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input autoFocus className="input h-9 min-h-0 pl-8 text-sm" placeholder="Buscar emoji (ex.: coração, café)" aria-label="Buscar emoji" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {!busca.trim() && (
        <div className="mb-1 flex gap-0.5 overflow-x-auto border-b pb-1" style={{ borderColor: "var(--hairline)" }} role="tablist" aria-label="Categorias">
          {[{ id: "recentes", rotulo: "Recentes", icone: "🕘" }, ...CATEGORIAS].map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} title={c.rotulo} aria-label={c.rotulo} onClick={() => setCat(c.id)} className={clsx("shrink-0 rounded-lg px-2 py-1 text-lg", cat === c.id ? "bg-sky-100" : "hover:bg-slate-100")}>{c.icone}</button>
          ))}
        </div>
      )}
      <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto" role="listbox" aria-label="Emojis">
        {lista.map((e) => <button key={e} type="button" role="option" aria-selected="false" onClick={() => escolher(e)} className="grid h-9 place-items-center rounded-lg text-xl hover:bg-slate-100" aria-label={e}>{e}</button>)}
        {lista.length === 0 && <p className="col-span-8 py-6 text-center text-xs text-slate-400">{busca.trim() ? "Nenhum emoji com essa palavra." : "Os emojis que você usar aparecem aqui."}</p>}
      </div>
    </div>
  );
}
