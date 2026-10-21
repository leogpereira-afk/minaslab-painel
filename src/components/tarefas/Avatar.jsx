// Círculo com a foto da pessoa (cadastrada em Acessos) ou, sem foto, as iniciais. A cor das iniciais é sempre a mesma para a mesma pessoa.
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { corDoAvatar, iniciais } from "../../lib/tarefas.js";
import { useFotoDe } from "../../services/perfis.js";

export default function Avatar({ usuario, nome, tamanho = 28, className }) {
  const foto = useFotoDe(usuario);
  const [quebrada, setQuebrada] = useState(false);
  useEffect(() => { setQuebrada(false); }, [foto]);
  const comFoto = foto && !quebrada;
  return (
    <span
      className={clsx("inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-bold text-white", className)}
      style={{ width: tamanho, height: tamanho, fontSize: Math.max(10, Math.round(tamanho * 0.38)), backgroundColor: comFoto ? "#e2e8f0" : corDoAvatar(usuario) }}
      title={nome || usuario}
      aria-label={nome || usuario}
    >
      {comFoto ? <img src={foto} alt="" width={tamanho} height={tamanho} loading="lazy" className="h-full w-full object-cover" onError={() => setQuebrada(true)} /> : iniciais(nome || usuario)}
    </span>
  );
}
