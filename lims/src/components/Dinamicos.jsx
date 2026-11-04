// Campos configuráveis (Configurações → Coleta, Plano de Amostragem, Inspeção
// técnica): cada registro vira um campo do formulário, na ordem definida.
import { estaAtivo } from "../lib/cadastros.js";
import { opcoes } from "./ui.jsx";

export const camposAtivos = (lista, filtro = () => true) => lista.filter(estaAtivo).filter(filtro).sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));

export function CamposDinamicos({ defs, valor, set, prefixo = "d" }) {
  if (!defs.length) return null;
  const mudar = (id, v) => set({ ...valor, [id]: v });
  return (
    <div className="frm">
      {defs.map((d) => {
        const id = `${prefixo}-${d.id}`;
        const v = valor[d.id] ?? "";
        const ops = String(d.valores || "").split(";").map((x) => x.trim()).filter(Boolean);
        let ctrl;
        if (d.tipo === "Numero" || d.tipo === "Calculo") ctrl = <input id={id} type="text" inputMode="decimal" value={v} onChange={(e) => mudar(d.id, e.target.value)} />;
        else if (d.tipo === "Data") ctrl = <input id={id} type="date" value={v} onChange={(e) => mudar(d.id, e.target.value)} />;
        else if (d.tipo === "Data e Hora") ctrl = <input id={id} type="datetime-local" value={v} onChange={(e) => mudar(d.id, e.target.value)} />;
        else if (d.tipo === "SelectBox") ctrl = <select id={id} value={v} onChange={(e) => mudar(d.id, e.target.value)}>{opcoes([["", "Selecione"], ...ops])}</select>;
        else if (d.tipo === "RadioBox") ctrl = <div className="radios">{ops.map((o) => <label key={o}><input type="radio" name={id} checked={v === o} onChange={() => mudar(d.id, o)} /> {o}</label>)}</div>;
        else if (d.tipo === "CheckBox") ctrl = <div className="radios">{(ops.length ? ops : ["Sim"]).map((o) => { const sel = String(v).split(";").filter(Boolean); return <label key={o}><input type="checkbox" checked={sel.includes(o)} onChange={(e) => mudar(d.id, (e.target.checked ? [...sel, o] : sel.filter((x) => x !== o)).join(";"))} /> {o}</label>; })}</div>;
        else ctrl = <input id={id} value={v} onChange={(e) => mudar(d.id, e.target.value)} />;
        return <div key={d.id} className="fg s4"><label htmlFor={id}>{d.titulo}</label>{ctrl}</div>;
      })}
    </div>
  );
}

// Para documentos impressos: [título, valor] na ordem da configuração.
export const valoresDinamicos = (defs, valor = {}) => defs.map((d) => [d.titulo, valor[d.id] ?? ""]).filter(([, v]) => String(v).trim() !== "");
