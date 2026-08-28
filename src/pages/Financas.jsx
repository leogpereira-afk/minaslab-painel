import { useNavigate } from "react-router-dom";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Landmark,
  LineChart,
  Settings
} from "lucide-react";
import { PageTitle } from "../components/ui.jsx";

const MODULOS_FINANCEIROS = [
  {
    titulo: "Dashboard",
    descricao: "Visão geral financeira da empresa.",
    rota: "/financas",
    icone: LineChart
  },
  {
    titulo: "Recebimentos",
    descricao: "Contas a receber, baixas e histórico.",
    rota: "/financas/recebimentos",
    icone: ArrowDownCircle
  },
  {
    titulo: "Despesas",
    descricao: "Contas a pagar, pagamentos e comprovantes.",
    rota: "/financas/despesas",
    icone: ArrowUpCircle
  },
  {
    titulo: "Notas Fiscais",
    descricao: "Notas fiscais, XML e vínculos financeiros.",
    rota: "/financas/notas-fiscais",
    icone: FileText
  },
  {
    titulo: "Extrato",
    descricao: "Movimentações e conciliação bancária.",
    rota: "/financas/extrato",
    icone: Landmark
  },
  {
    titulo: "Fluxo de Caixa",
    descricao: "Entradas, saídas e projeções financeiras.",
    rota: "/financas/fluxo-caixa",
    icone: Wallet
  },
  {
    titulo: "Configurações",
    descricao: "Categorias, contas bancárias e integração Omie.",
    rota: "/financas/configuracoes",
    icone: Settings
  }
];

export default function Financas() {
  const navigate = useNavigate();

  return (
    <div>
      <PageTitle
        titulo="Finanças"
        descricao="Gestão financeira MinasLab e M Lab."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODULOS_FINANCEIROS.map((modulo) => {
          const Icone = modulo.icone;

          return (
            <button
              key={modulo.titulo}
              type="button"
              onClick={() => navigate(modulo.rota)}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Icone size={22} />
              </div>

              <h2 className="text-base font-semibold text-slate-900">
                {modulo.titulo}
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                {modulo.descricao}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
