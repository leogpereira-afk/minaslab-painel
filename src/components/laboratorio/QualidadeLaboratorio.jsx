// Laboratório › Qualidade. Primeira função no ar: Pesquisa de Satisfação de Clientes (PG 012 · PSC),
// que mora no CRM (Pós-venda › Pesquisa de satisfação) e fica acessível daqui para a Qualidade
// enviar o link e monitorar respostas, insatisfações (prazo 5 dias) e melhorias.
// O resto da área segue reservado (AreaEmBreve).

import { ExternalLink, Send, Smile } from "lucide-react";
import AreaEmBreve from "./AreaEmBreve.jsx";

const crm = (caminho) => `${import.meta.env.BASE_URL}crm${caminho}`;

export default function QualidadeLaboratorio({ voltar }) {
  return (
    <div className="space-y-4">
      <div className="card mx-auto max-w-2xl p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Smile className="h-5 w-5" aria-hidden /></span>
          <div>
            <p className="font-display text-lg font-semibold text-slate-900">Pesquisa de satisfação de clientes</p>
            <p className="text-sm text-slate-500">PG 012 · PSC. Envie o link ao cliente e acompanhe NPS, médias por pergunta, insatisfações e melhorias.</p>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
          <li>• Cada link vale para uma resposta e já vai com a empresa e a OS.</li>
          <li>• Nota de recomendação de 0 a 6 ou item com nota 1–2 abre tratativa com prazo de 5 dias e tarefa para quem enviou.</li>
          <li>• As respostas também aparecem no Cliente 360 e no NPS do Pós-venda.</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          <a className="btn-primary inline-flex items-center gap-2" href={crm("/pos-venda/satisfacao?enviar=1")}><Send className="h-4 w-4" aria-hidden /> Enviar pesquisa</a>
          <a className="btn-outline inline-flex items-center gap-2" href={crm("/pos-venda/satisfacao")}><ExternalLink className="h-4 w-4" aria-hidden /> Respostas e indicadores</a>
        </div>
      </div>
      <AreaEmBreve area="qualidade" voltar={voltar} />
    </div>
  );
}
