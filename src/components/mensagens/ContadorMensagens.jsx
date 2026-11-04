// Bolinha de mensagens não lidas no menu. Só mostra: quem consulta, toca o som e avisa é o VigiaMensagens (no Layout).
import { contadorTexto } from "../../lib/mensagens.js";
import { useContagemMensagens } from "./VigiaMensagens.jsx";

export default function ContadorMensagens() {
  const { totalNaoLidas: total } = useContagemMensagens();
  return <span className="ml-auto">{total > 0 && <span className="grid min-w-[20px] place-items-center rounded-full bg-sky-600 px-1.5 text-[11px] font-bold leading-5 text-white" aria-label={`${total} mensagens não lidas`}>{contadorTexto(total)}</span>}</span>;
}
