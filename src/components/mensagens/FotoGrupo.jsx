// Foto do grupo (ou ícone de grupo quando não tem foto).
import { useEffect, useState } from "react";
import { Users } from "lucide-react";

export default function FotoGrupo({ foto, tamanho = 40, className = "" }) {
  const [quebrada, setQuebrada] = useState(false);
  useEffect(() => { setQuebrada(false); }, [foto]);
  const estilo = { width: tamanho, height: tamanho };
  if (foto && !quebrada) return <img src={foto} alt="" width={tamanho} height={tamanho} style={estilo} className={`shrink-0 rounded-full object-cover ${className}`} onError={() => setQuebrada(true)} />;
  return <span style={estilo} className={`grid shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 ${className}`} aria-hidden="true"><Users size={Math.round(tamanho * 0.45)} /></span>;
}
