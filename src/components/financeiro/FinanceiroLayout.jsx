import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, FileText, Landmark, LineChart, Settings, ReceiptText, UploadCloud, Ban, Users, BarChart3, ChevronDown, MoreHorizontal, ListChecks } from "lucide-react";
import "./financeiro-redesign.css";

const principais = [
  { label: "Visão Geral", to: "/financas", end: true, icon: LayoutDashboard },
  { label: "Contas a Receber", to: "/financas/contas-a-receber", icon: ArrowDownCircle },
  { label: "Contas a Pagar", to: "/financas/contas-a-pagar", icon: ArrowUpCircle },
  { label: "Movimentação da Conta", to: "/financas/movimentacao-conta", icon: Landmark },
  { label: "Conciliação", to: "/financas/conciliacao", icon: ListChecks },
  { label: "Notas Fiscais", to: "/financas/notas-fiscais", icon: FileText },
  { label: "Fluxo de Caixa", to: "/financas/fluxo-caixa", icon: LineChart },
  { label: "Configurações", to: "/financas/configuracoes", icon: Settings },
];

const maisOpcoes = [
  { label: "Clientes", to: "/financas/clientes", icon: Users, descricao: "Cadastro financeiro isolado de clientes MinasLab e M Lab." },
  { label: "Relatórios", to: "/financas/relatorios", icon: BarChart3, descricao: "Exportações financeiras por banco, conta ou consolidado." },
];

const fiscal = [
  { label: "Todas as notas", to: "/financas/notas-fiscais", end: true, icon: FileText, descricao: "Notas emitidas e recebidas, XML, PDF e vínculo financeiro." },
  { label: "Emitir NFS-e", to: "/financas/notas-fiscais/emitir", icon: ReceiptText, descricao: "Emissão da M Lab pelo fluxo fiscal já homologado." },
  { label: "Importar histórico", to: "/financas/notas-fiscais/importar-historico", icon: UploadCloud, descricao: "Importação de XMLs já emitidos sem duplicação." },
  { label: "Cancelamento", to: "/financas/notas-fiscais/cancelar", icon: Ban, descricao: "Cancelamento fiscal com histórico e proteção do financeiro." },
];

const bancario = [
  { label: "Movimentação da Conta", to: "/financas/movimentacao-conta", end: true, icon: Landmark, descricao: "Veja entradas, saídas, saldos e a situação de cada movimento em uma única conta corrente financeira." },
  { label: "Conciliação", to: "/financas/conciliacao", icon: ListChecks, descricao: "Associe movimentos às Contas a Receber ou Contas a Pagar, com sugestões e conferência antes de confirmar." },
];

function rotaAtiva(location, label, to) {
  const p = location.pathname;
  if (label === "Contas a Receber") return p === to || p === "/financas/recebimentos";
  if (label === "Contas a Pagar") return p === to || p === "/financas/despesas";
  if (label === "Movimentação da Conta") return p === to || p === "/financas/bancos" || p === "/financas/extrato";
  if (label === "Conciliação") return p === to || p.startsWith("/financas/conciliacao-titulos");
  if (label === "Notas Fiscais") return p.startsWith("/financas/notas-fiscais");
  if (label === "Configurações") return p.startsWith("/financas/configuracoes") || p.startsWith("/financas/plano-contas");
  return p === to;
}

export default function FinanceiroLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const [maisAberto, setMaisAberto] = useState(false);
  const emFiscal = location.pathname.startsWith("/financas/notas-fiscais");
  const emBancos = ["/financas/movimentacao-conta", "/financas/bancos", "/financas/extrato", "/financas/conciliacao"].includes(location.pathname) || location.pathname.startsWith("/financas/conciliacao-titulos");
  const emMais = maisOpcoes.some((x) => location.pathname === x.to || location.pathname.startsWith(`${x.to}/`));

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
            <p className="mt-1 text-sm text-slate-500">Contas, movimentações e conciliação organizadas para leitura rápida e operação simples.</p>
          </div>
          {emFiscal && <button type="button" className="btn-primary self-start lg:self-auto" onClick={() => navigate("/financas/notas-fiscais/emitir")}><ReceiptText size={16}/> Emitir NFS-e</button>}
        </div>

        <div className="flex items-center gap-2 px-3 py-2">
          <nav className="min-w-0 flex-1 overflow-x-auto" aria-label="Navegação interna do Financeiro">
            <div className="flex min-w-max items-center gap-1">
              {principais.map(({ label, to, end, icon: Icon }) => {
                const ativo = rotaAtiva(location, label, to);
                return <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
                    ativo
                      ? "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16}/><span>{label}</span>
                </NavLink>;
              })}
            </div>
          </nav>

          <div className="relative shrink-0" ref={menuRef}>
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
        </div>
      </section>

      {emFiscal && <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 px-2 pt-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Central Fiscal</p><p className="mt-1 text-sm text-slate-500">Ações fiscais específicas, sem repetir os demais módulos financeiros.</p></div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {fiscal.map(({ label, to, end, icon: Icon, descricao }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `rounded-xl border p-3 transition ${isActive ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon size={16}/>{label}</div><p className="mt-1 text-xs leading-5 text-slate-500">{descricao}</p></NavLink>)}
        </div>
      </section>}

      {emBancos && <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 px-2 pt-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Movimentação e Conciliação</p><p className="mt-1 text-sm text-slate-500">Primeiro acompanhe o que aconteceu na conta. Depois associe cada movimento ao título financeiro correto.</p></div>
        <div className="grid gap-2 md:grid-cols-2">
          {bancario.map(({ label, to, end, icon: Icon, descricao }) => {
            const ativo = rotaAtiva(location, label, to);
            return <NavLink key={to} to={to} end={end} className={`rounded-xl border p-3 transition ${ativo ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon size={16}/>{label}</div><p className="mt-1 text-xs leading-5 text-slate-500">{descricao}</p></NavLink>;
          })}
        </div>
      </section>}

      <Outlet/>
    </div>
  );
}
