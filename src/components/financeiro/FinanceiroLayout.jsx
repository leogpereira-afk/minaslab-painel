import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, FileText, Landmark, LineChart, Settings, Plus, ReceiptText, UploadCloud, Ban, Link2, WalletCards, BookOpen, Tags, PlugZap } from "lucide-react";
import "./financeiro-redesign.css";

const itens = [
  { label: "Visão Geral", to: "/financas", end: true, icon: LayoutDashboard },
  { label: "Recebimentos", to: "/financas/recebimentos", icon: ArrowDownCircle },
  { label: "Despesas", to: "/financas/despesas", icon: ArrowUpCircle },
  { label: "Notas Fiscais", to: "/financas/notas-fiscais", icon: FileText },
  { label: "Bancos & Conciliação", to: "/financas/bancos", icon: Landmark },
  { label: "Fluxo de Caixa", to: "/financas/fluxo-caixa", icon: LineChart },
  { label: "Configurações", to: "/financas/configuracoes", icon: Settings },
];

const fiscal = [
  { label: "Todas as notas", to: "/financas/notas-fiscais", end: true, icon: FileText, descricao: "Notas emitidas e recebidas, XML, PDF e vínculo financeiro." },
  { label: "Emitir NFS-e", to: "/financas/notas-fiscais/emitir", icon: ReceiptText, descricao: "Emissão da M Lab pelo fluxo fiscal já homologado." },
  { label: "Importar histórico", to: "/financas/notas-fiscais/importar-historico", icon: UploadCloud, descricao: "Importação de XMLs já emitidos sem duplicação." },
  { label: "Cancelamento", to: "/financas/notas-fiscais/cancelar", icon: Ban, descricao: "Cancelamento fiscal com histórico e proteção do financeiro." },
];

const bancos = [
  { label: "Central bancária", to: "/financas/bancos", end: true, icon: Landmark, descricao: "Visão organizada dos fluxos bancários do Financeiro.", destaque: "central" },
  { label: "Extrato & Conciliação", to: "/financas/extrato", icon: Link2, descricao: "Movimentos, filtros, candidatos e conciliação.", destaque: "extrato" },
  { label: "Importar OFX / CSV", to: "/financas/extrato", icon: UploadCloud, descricao: "Importação bancária pelo fluxo já validado no Extrato." },
  { label: "Contas bancárias", to: "/financas/configuracoes", icon: WalletCards, descricao: "Cadastros, vínculos por empresa e saldos informados." },
];

const configuracoes = [
  { label: "Cadastros financeiros", to: "/financas/configuracoes", end: true, icon: Tags, descricao: "Categorias, contas bancárias, centros de custo e formas de pagamento.", destaque: "cadastros" },
  { label: "Plano de Contas", to: "/financas/plano-contas", icon: BookOpen, descricao: "Estrutura oficial por fluxo, agrupamento, grupo e conta.", destaque: "plano" },
  { label: "Integração Omie", to: "/financas/configuracoes", icon: PlugZap, descricao: "Pré-validação e sincronização seletiva da MinasLab." },
  { label: "Contas bancárias", to: "/financas/configuracoes", icon: WalletCards, descricao: "Contas por empresa, dados bancários, saldo inicial e situação." },
];

export default function FinanceiroLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const emFiscal = location.pathname.startsWith("/financas/notas-fiscais");
  const emBancos = location.pathname === "/financas/bancos" || location.pathname.startsWith("/financas/extrato");
  const emConfig = location.pathname.startsWith("/financas/configuracoes") || location.pathname.startsWith("/financas/plano-contas");

  const ativoBanco = (item) => item.destaque === "central"
    ? location.pathname === "/financas/bancos"
    : item.destaque === "extrato" && location.pathname.startsWith("/financas/extrato");
  const ativoConfig = (item) => item.destaque === "cadastros"
    ? location.pathname === "/financas/configuracoes"
    : item.destaque === "plano" && location.pathname.startsWith("/financas/plano-contas");

  return (
    <div className="financeiro-shell space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Módulo Financeiro</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Financeiro</h1>
            <p className="mt-1 text-sm text-slate-500">Gestão integrada de MinasLab e M Lab.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline" onClick={() => navigate("/financas/recebimentos")}><ArrowDownCircle size={16}/> Recebimento</button>
            <button type="button" className="btn-outline" onClick={() => navigate("/financas/despesas")}><ArrowUpCircle size={16}/> Despesa</button>
            <button type="button" className="btn-primary" onClick={() => navigate(emFiscal ? "/financas/notas-fiscais/emitir" : emBancos ? "/financas/extrato" : emConfig ? "/financas/configuracoes" : "/financas/notas-fiscais")}>
              <Plus size={16} /> {emFiscal ? "Emitir NFS-e" : emBancos ? "Importar / Conciliar" : emConfig ? "Abrir cadastros" : "Mais ações"}
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 py-2" aria-label="Navegação interna do Financeiro">
          {itens.map(({ label, to, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive || (label === "Bancos & Conciliação" && emBancos) || (label === "Configurações" && emConfig)
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

      {emFiscal && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 px-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Central Fiscal</p>
            <p className="mt-1 text-sm text-slate-500">Notas, emissão, histórico e cancelamento reunidos no mesmo espaço.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {fiscal.map(({ label, to, end, icon: Icon, descricao }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `rounded-xl border p-3 transition ${isActive ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon size={16} />{label}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{descricao}</p>
              </NavLink>
            ))}
          </div>
        </section>
      )}

      {emBancos && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 px-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Central Bancária</p>
            <p className="mt-1 text-sm text-slate-500">Extratos, importações, contas e conciliação reunidos no mesmo espaço.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {bancos.map(({ label, to, icon: Icon, descricao, destaque }) => {
              const ativo = ativoBanco({ destaque });
              return <NavLink key={`${label}-${to}`} to={to} className={`rounded-xl border p-3 transition ${ativo ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon size={16} />{label}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{descricao}</p>
              </NavLink>;
            })}
          </div>
        </section>
      )}

      {emConfig && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 px-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Central de Configurações</p>
            <p className="mt-1 text-sm text-slate-500">Cadastros, plano de contas e integrações organizados sem alterar suas regras.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {configuracoes.map(({ label, to, icon: Icon, descricao, destaque }) => {
              const ativo = ativoConfig({ destaque });
              return <NavLink key={`${label}-${to}`} to={to} className={`rounded-xl border p-3 transition ${ativo ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon size={16} />{label}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{descricao}</p>
              </NavLink>;
            })}
          </div>
        </section>
      )}

      <Outlet />
    </div>
  );
}
