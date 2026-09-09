import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, FileText, Landmark, LineChart, Settings, Plus } from "lucide-react";

const itens = [
  { label: "Visão Geral", to: "/financas", end: true, icon: LayoutDashboard },
  { label: "Recebimentos", to: "/financas/recebimentos", icon: ArrowDownCircle },
  { label: "Despesas", to: "/financas/despesas", icon: ArrowUpCircle },
  { label: "Notas Fiscais", to: "/financas/notas-fiscais", icon: FileText },
  { label: "Bancos & Conciliação", to: "/financas/extrato", icon: Landmark },
  { label: "Fluxo de Caixa", to: "/financas/fluxo-caixa", icon: LineChart },
  { label: "Configurações", to: "/financas/configuracoes", icon: Settings },
];

export default function FinanceiroLayout() {
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Módulo Financeiro</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Financeiro</h1>
            <p className="mt-1 text-sm text-slate-500">Gestão integrada de MinasLab e M Lab.</p>
          </div>
          <button type="button" className="btn-primary self-start lg:self-auto" onClick={() => navigate("/financas/recebimentos")}>
            <Plus size={16} /> Novo lançamento
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 py-2" aria-label="Navegação interna do Financeiro">
          {itens.map(({ label, to, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </section>

      <Outlet />
    </div>
  );
}
