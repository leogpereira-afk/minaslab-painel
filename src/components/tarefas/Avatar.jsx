// Círculo com as iniciais da pessoa. A cor é sempre a mesma para a mesma pessoa.
import { clsx } from "clsx";
import { corDoAvatar, iniciais } from "../../lib/tarefas.js";

export default function Avatar({ usuario, nome, tamanho = 28, className }) {
  return (
    <span
      className={clsx("inline-grid shrink-0 place-items-center rounded-full font-display font-bold text-white", className)}
      style={{ width: tamanho, height: tamanho, fontSize: Math.max(10, Math.round(tamanho * 0.38)), backgroundColor: corDoAvatar(usuario) }}
      title={nome || usuario}
      aria-label={nome || usuario}
    >
      {iniciais(nome || usuario)}
    </span>
  );
}
