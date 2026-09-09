import { useNavigate } from "react-router-dom";
import { Landmark, Link2, Upload, WalletCards, ArrowRight } from "lucide-react";
import { PageTitle } from "../components/ui.jsx";

const itens = [
  {
    titulo: "Extrato bancário",
    descricao: "Consulte créditos, débitos, saldos, origem dos movimentos e filtros por empresa, conta e período.",
    rota: "/financas/extrato",
    icone: Landmark,
  },
  {
    titulo: "Conciliação",
    descricao: "Abra os movimentos pendentes, encontre recebimentos ou despesas compatíveis e registre a conciliação.",
    rota: "/financas/extrato",
    icone: Link2,
  },
  {
    titulo: "Importar OFX / extrato",
    descricao: "Importe OFX bancário ou CSV compatível usando o fluxo já validado do Extrato, com proteção contra duplicidade.",
    rota: "/financas/extrato",
    icone: Upload,
  },
  {
    titulo: "Contas bancárias",
    descricao: "Cadastre e revise as contas usadas por MinasLab e M Lab, incluindo saldos e vínculo por empresa.",
    rota: "/financas/configuracoes",
    icone: WalletCards,
  },
];

export default function BancosConciliacao() {
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <PageTitle
        titulo="Bancos & Conciliação"
        descricao="Central bancária do Financeiro: extratos, importações, contas e conciliação em um único ponto de acesso."
      />

      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        A lógica bancária existente permanece intacta. Esta central apenas reorganiza o acesso aos fluxos já validados de Extrato, OFX/CSV e Conciliação.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {itens.map(({ titulo, descricao, rota, icone: Icone }) => (
          <button
            type="button"
            key={titulo}
            onClick={() => navigate(rota)}
            className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Icone size={21} />
              </span>
              <ArrowRight size={18} className="mt-2 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-slate-900">{titulo}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{descricao}</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Fluxo recomendado</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span className="rounded-xl bg-slate-50 px-3 py-2">Importar extrato</span>
          <span>→</span>
          <span className="rounded-xl bg-slate-50 px-3 py-2">Revisar movimentos</span>
          <span>→</span>
          <span className="rounded-xl bg-slate-50 px-3 py-2">Conciliar recebimentos/despesas</span>
          <span>→</span>
          <span className="rounded-xl bg-slate-50 px-3 py-2">Conferir saldo</span>
        </div>
      </div>
    </div>
  );
}
