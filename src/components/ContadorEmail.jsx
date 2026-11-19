// Bolinha de e-mails não lidos no menu, igual à de Mensagens.
import { useNaoLidasEmail } from "../lib/emailContador.js";

export default function ContadorEmail() {
  const total = useNaoLidasEmail();
  return <span className="ml-auto">{total > 0 && <span className="grid min-w-[20px] place-items-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold leading-5 text-white" aria-label={`${total} e-mails não lidos`}>{total > 99 ? "99+" : total}</span>}</span>;
}
