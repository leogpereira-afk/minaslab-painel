// Escolher uma ou várias pessoas (usuários do painel), com busca — como o seletor de pessoas do Bitrix24.
// `unico`: escolhe uma e fecha (responsável). Sem `unico`: lista de pessoas (participantes, observadores).
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { clsx } from "clsx";
import Avatar from "./Avatar.jsx";

const normalizar = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function SeletorPessoas({ usuarios, valor, onChange, unico = false, ocultar = [], desabilitado = false, vazio = "Ninguém", rotuloBotao }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const raiz = useRef(null);
  const selecionados = unico ? (valor ? [valor] : []) : (valor || []);
  const nomeDe = (u) => usuarios.find((x) => x.usuario === u)?.nome || u;

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAberto(false); };
    const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); setAberto(false); } };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla, true);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", tecla, true); };
  }, [aberto]);

  const lista = useMemo(() => {
    const q = normalizar(busca);
    return usuarios.filter((u) => !ocultar.includes(u.usuario)).filter((u) => !q || normalizar(u.nome).includes(q) || normalizar(u.usuario).includes(q));
  }, [usuarios, ocultar, busca]);

  const alternar = (u) => {
    if (unico) { onChange(u); setAberto(false); setBusca(""); return; }
    onChange(selecionados.includes(u) ? selecionados.filter((x) => x !== u) : [...selecionados, u]);
  };

  return (
    <div ref={raiz} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {selecionados.length === 0 && <span className="text-sm text-slate-400">{vazio}</span>}
        {selecionados.map((u) => (
          <span key={u} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 py-0.5 pl-0.5 pr-2 text-sm text-sky-900">
            <Avatar usuario={u} nome={nomeDe(u)} tamanho={22} />
            <span className="max-w-[160px] truncate">{nomeDe(u)}</span>
            {!unico && !desabilitado && (
              <button type="button" className="rounded-full p-0.5 text-sky-700 hover:bg-sky-100" aria-label={`Retirar ${nomeDe(u)}`} onClick={() => alternar(u)}><X size={12} /></button>
            )}
          </span>
        ))}
        {!desabilitado && (
          <button type="button" className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs font-medium text-slate-600 hover:border-brand-400 hover:text-brand-700" style={{ borderColor: "var(--hairline)" }} onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
            <Plus size={12} aria-hidden="true" />{rotuloBotao || (unico ? "Alterar" : "Adicionar")}
          </button>
        )}
      </div>
      {aberto && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 max-w-[85vw] rounded-xl border bg-white p-2 shadow-lg" style={{ borderColor: "var(--hairline)" }}>
          <input autoFocus className="input mb-2 h-9 min-h-0 text-sm" placeholder="Pesquisar pessoa" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Pesquisar pessoa" />
          <ul className="max-h-56 overflow-auto" role="listbox" aria-multiselectable={!unico}>
            {lista.length === 0 && <li className="px-2 py-3 text-center text-sm text-slate-500">Ninguém encontrado.</li>}
            {lista.map((u) => {
              const marcado = selecionados.includes(u.usuario);
              return (
                <li key={u.usuario} role="option" aria-selected={marcado}>
                  <button type="button" onClick={() => alternar(u.usuario)} className={clsx("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50", marcado && "bg-sky-50")}>
                    <Avatar usuario={u.usuario} nome={u.nome} tamanho={26} />
                    <span className="min-w-0 flex-1 truncate">{u.nome}</span>
                    {marcado && <Check size={15} className="text-sky-700" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
