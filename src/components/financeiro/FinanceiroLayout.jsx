import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, FileText, Landmark, LineChart, Settings, ReceiptText, UploadCloud, Ban, Link2, WalletCards, Users, BarChart3, ChevronDown, MoreHorizontal } from "lucide-react";
import "./financeiro-redesign.css";

const principais = [
  { label: "Visão Geral", to: "/financas", end: true, icon: LayoutDashboard },
  { label: "Recebimentos", to: "/financas/recebimentos", icon: ArrowDownCircle },
  { label: "Despesas", to: "/financas/despesas", icon: ArrowUpCircle },
  { label: "Bancos & Conciliação", to: "/financas/bancos", icon: Landmark },
  { label: "Fluxo de Caixa", to: "/financas/fluxo-caixa", icon: LineChart },
];

const maisOpcoes = [
  { label: "Notas Fiscais", to: "/financas/notas-fiscais", icon: FileText, descricao: "Documentos fiscais, emissão, XML/PDF e cancelamentos." },
  { label: "Clientes", to: "/financas/clientes", icon: Users, descricao: "Cadastro financeiro isolado de clientes MinasLab e M Lab." },
  { label: "Relatórios", to: "/financas/relatorios", icon: BarChart3, descricao: "Exportações financeiras por banco, conta ou consolidado." },
  { label: "Configurações", to: "/financas/configuracoes", icon: Settings, descricao: "Cadastros auxiliares, contas, categorias e integração Omie." },
];

const fiscal = [
  { label: "Todas as notas", to: "/financas/notas-fiscais", end: true, icon: FileText, descricao: "Notas emitidas e recebidas, XML, PDF e vínculo financeiro." },
  { label: "Emitir NFS-e", to: "/financas/notas-fiscais/emitir", icon: ReceiptText, descricao: "Emissão da M Lab pelo fluxo fiscal já homologado." },
  { label: "Importar histórico", to: "/financas/notas-fiscais/importar-historico", icon: UploadCloud, descricao: "Importação de XMLs já emitidos sem duplicação." },
  { label: "Cancelamento", to: "/financas/notas-fiscais/cancelar", icon: Ban, descricao: "Cancelamento fiscal com histórico e proteção do financeiro." },
];

const bancos = [
  { label: "Extrato & Conciliação", to: "/financas/extrato", icon: Link2, descricao: "Movimentos, filtros, candidatos, importação OFX/CSV e conciliação." },
  { label: "Contas bancárias", to: "/financas/configuracoes", icon: WalletCards, descricao: "Cadastros, vínculos por empresa e saldos informados." },
];

export default function FinanceiroLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const [maisAberto, setMaisAberto] = useState(false);
  const emFiscal = location.pathname.startsWith("/financas/notas-fiscais");
  const emBancos = location.pathname === "/financas/bancos" || location.pathname.startsWith("/financas/extrato");
  const emMais = maisOpcoes.some((x) => location.pathname === x.to || location.pathname.startsWith(`${x.to}/`)) || location.pathname.startsWith("/financas/plano-contas");

  useEffect(() => setMaisAberto(false), [location.pathname]);
  useEffect(() => {
    const fechar = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMaisAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  return (
    <div className="financeiro-shell space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Módulo Financeiro</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Financeiro</h1>
            <p className="mt-1 text-sm text-slate-500">Gestão integrada de MinasLab e M Lab.</p>
          </div>
          {emFiscal && <button type="button" className="btn-primary self-start lg:self-auto" onClick={() => navigate("/financas/notas-fiscais/emitir")}><ReceiptText size={16}/> Emitir NFS-e</button>}
          {emBancos && <button type="button" className="btn-primary self-start lg:self-auto" onClick={() => navigate("/financas/extrato")}><Landmark size={16}/> Abrir extrato</button>}
        </div>

        <nav className="flex items-center gap-1 px-3 py-2" aria-label="Navegação interna do Financeiro">
          {principais.map(({ label, to, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive || (label === "Bancos & Conciliação" && emBancos)
                    ? "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <Icon size={16}/><span className="hidden xl:inline">{label}</span><span className="xl:hidden">{label === "Bancos & Conciliação" ? "Bancos" : label}</span>
            </NavLink>
          ))}

          <div className="relative ml-auto" ref={menuRef}>
            <button type="button" onClick={() => setMaisAberto((v) => !v)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${emMais ? "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <MoreHorizontal size={16}/> Mais <ChevronDown size={14} className={`transition ${maisAberto ? "rotate-180" : ""}`}/>
            </button>
            {maisAberto && <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              {maisOpcoes.map(({ label, to, icon: Icon, descricao }) => <button key={to} type="button" onClick={() => navigate(to)} className="flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50">
                <span className="mt-0.5 rounded-lg bg-slate-50 p-2 text-slate-600"><Icon size={16}/></span>
                <span><span className="block text-sm font-semibold text-slate-900">{label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{descricao}</span></span>
              </button>)}
            </div>}
          </div>
        </nav>
      </section>

      {emFiscal && <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 px-2 pt-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Central Fiscal</p><p className="mt-1 text-sm text-slate-500">Ações fiscais específicas, sem repetir os demais módulos financeiros.</p></div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {fiscal.map(({ label, to, end, icon: Icon, descricao }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `rounded-xl border p-3 transition ${isActive ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon size={16}/>{label}</div><p className="mt-1 text-xs leading-5 text-slate-500">{descricao}</p></NavLink>)}
        </div>
      </section>}

      {emBancos && <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 px-2 pt-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Central Bancária</p><p className="mt-1 text-sm text-slate-500">Somente os acessos bancários essenciais, sem duplicar importação e conciliação em cards separados.</p></div>
        <div className="grid gap-2 md:grid-cols-2">
          {bancos.map(({ label, to, icon: Icon, descricao }) => <NavLink key={label} to={to} className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:bg-slate-50"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon size={16}/>{label}</div><p className="mt-1 text-xs leading-5 text-slate-500">{descricao}</p></NavLink>)}
        </div>
      </section>}

      <Outlet/>
    </div>
  );
}
