// Mostra o texto de uma mensagem com a formatação (negrito, itálico, sublinhado,
// riscado, links e pessoas marcadas com @). Regras em lib/textoRico.js.
import { Fragment } from "react";
import { clsx } from "clsx";
import { lerTextoRico } from "../../lib/textoRico.js";

export default function TextoRico({ texto, nomeDe, ehUsuario, eu, className }) {
  const nos = lerTextoRico(texto, ehUsuario);
  return <p className={clsx("whitespace-pre-wrap [overflow-wrap:anywhere]", className)}>{desenhar(nos, { nomeDe, eu })}</p>;
}

function desenhar(nos, ctx) {
  return nos.map((n, i) => {
    switch (n.t) {
      case "texto": return <Fragment key={i}>{n.v}</Fragment>;
      case "quebra": return <br key={i} />;
      case "b": return <strong key={i} className="font-semibold">{desenhar(n.filhos, ctx)}</strong>;
      case "i": return <em key={i}>{desenhar(n.filhos, ctx)}</em>;
      case "u": return <u key={i}>{desenhar(n.filhos, ctx)}</u>;
      case "s": return <s key={i}>{desenhar(n.filhos, ctx)}</s>;
      case "link": return <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:decoration-sky-700">{desenhar(n.filhos, ctx)}</a>;
      case "mencao": {
        const todos = n.usuario === "todos";
        const sou = todos || n.usuario === ctx.eu;
        const nome = todos ? "todos" : ctx.nomeDe?.(n.usuario) || n.usuario;
        const primeiro = String(nome).split(" ")[0];
        const curto = todos ? "todos" : primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
        return <span key={i} title={todos ? "Marcou todo o grupo" : nome} className={clsx("rounded px-0.5 font-semibold", sou ? "bg-amber-200/80 text-amber-900" : "bg-sky-200/60 text-sky-800")}>@{curto}</span>;
      }
      default: return null;
    }
  });
}
