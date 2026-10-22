// Reações de uma mensagem: botão para reagir (🙂 com os rápidos e "mais") e as bolinhas de emoji com contagem; clicar numa bolinha alterna a sua.
import { useState } from "react";
import { Plus, SmilePlus } from "lucide-react";
import { clsx } from "clsx";
import SeletorEmoji from "./SeletorEmoji.jsx";
import { RAPIDAS } from "../../lib/emojis.js";

export function BotaoReagir({ aoReagir, lado = "esquerda" }) {
  const [aberto, setAberto] = useState(false);
  const [completo, setCompleto] = useState(false);
  const fechar = () => { setAberto(false); setCompleto(false); };
  const escolher = (e) => { fechar(); aoReagir(e); };
  return (
    <span className="relative">
      <button type="button" className="mb-1 hidden rounded p-1 text-slate-400 hover:bg-sky-50 hover:text-sky-600 group-hover:block group-focus-within:block [@media(hover:none)]:block" onClick={() => setAberto((v) => !v)} aria-label="Reagir à mensagem" aria-expanded={aberto} title="Reagir"><SmilePlus size={14} /></button>
      {aberto && !completo && (
        <div className={clsx("absolute bottom-full z-40 mb-1 flex items-center gap-0.5 rounded-full border bg-white px-1.5 py-1 shadow-lg", lado === "esquerda" ? "right-0" : "left-0")} style={{ borderColor: "var(--hairline)" }} role="menu" aria-label="Reações rápidas">
          {RAPIDAS.map((e) => <button key={e} type="button" role="menuitem" className="grid h-8 w-8 place-items-center rounded-full text-xl hover:bg-slate-100" onClick={() => escolher(e)} aria-label={`Reagir com ${e}`}>{e}</button>)}
          <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100" onClick={() => setCompleto(true)} aria-label="Mais emojis"><Plus size={16} /></button>
        </div>
      )}
      {aberto && completo && <SeletorEmoji aoEscolher={escolher} aoFechar={fechar} className={clsx("absolute bottom-full mb-1", lado === "esquerda" ? "right-0" : "left-0")} />}
    </span>
  );
}

export default function ReacoesMensagem({ reacoes, eu, nomes, aoAlternar, minha }) {
  if (!reacoes?.length) return null;
  return (
    <div className={clsx("mt-1 flex flex-wrap gap-1", minha ? "justify-end" : "justify-start")} aria-label="Reações">
      {reacoes.map((r) => {
        const eu_ = r.usuarios.includes(eu);
        const quem = r.usuarios.map((u) => (u === eu ? "você" : (nomes[u] || u).split(" ")[0])).join(", ");
        return (
          <button key={r.emoji} type="button" onClick={() => aoAlternar(r.emoji)} title={`${quem} reagiu com ${r.emoji}`} aria-pressed={eu_} aria-label={`${r.emoji} ${r.usuarios.length}: ${quem}`} className={clsx("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs shadow-sm", eu_ ? "border-sky-300 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
            <span className="text-sm leading-none">{r.emoji}</span><span className="font-semibold">{r.usuarios.length}</span>
          </button>
        );
      })}
    </div>
  );
}
