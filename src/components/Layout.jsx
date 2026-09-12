// A moldura do painel: menu lateral no computador, gaveta no celular.
// O menu so MOSTRA o que o papel abre — quem barra de verdade e o servidor.

import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { clsx } from "clsx";
import {
  BarChart3,
  CalendarDays,
  CalendarCheck,
  Clock,
  Gavel,
  Megaphone,
  ShoppingCart,
  Wrench,
  Users,
  Wallet,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
} from "lucide-react";
import { getSessao, sair, podeAbrir } from "../lib/sessao.js";
import { trocarMinhaSenha } from "../services/dados.js";
import { LimiteModulo } from "./LimiteModulo.jsx";
import { Modal, Aviso, CarregandoModulo } from "./ui.jsx";

/* O MENU E UMA LISTA SO. A Impresilk pagou dois dias de procura porque a lista
   de modulos vivia copiada em tres arquivos e a copia envelhecia calada. Aqui:
   modulo novo entra NESTE array e na rota do App.jsx — e em nenhum outro
   lugar. */
const MODULOS = [
  { id: "inicio", rotulo: "Início", caminho: "/", icone: LayoutDashboard },
  { id: "calendario", rotulo: "Calendário", caminho: "/calendario", icone: CalendarDays },
  { id: "compromissos", rotulo: "Compromissos", caminho: "/compromissos", icone: CalendarCheck },
  { id: "licitacoes", rotulo: "Licitações", caminho: "/licitacoes", icone: Gavel },
  { id: "marketing", rotulo: "Marketing", caminho: "/marketing", icone: Megaphone },
  { id: "compras", rotulo: "Compras", caminho: "/compras", icone: ShoppingCart },
  { id: "manutencoes", rotulo: "Manutenções", caminho: "/manutencoes", icone: Wrench },
  { id: "laboratorio", rotulo: "Laboratório", caminho: "/laboratorio", icone: FlaskConical },
  { id: "rh", rotulo: "RH", caminho: "/rh", icone: Users },
  { id: "ponto", rotulo: "Ponto", caminho: "/ponto", icone: Clock },
  { id: "financas", rotulo: "Finanças", caminho: "/financas", icone: Wallet },
  { id: "curva-abc", rotulo: "Curva ABC", caminho: "/curva-abc", icone: BarChart3 },
  { id: "acessos", rotulo: "Acessos", caminho: "/acessos", icone: KeyRound },
];

const PAPEL_ROTULO = { direcao: "Direção", equipe: "Equipe", leitura: "Leitura" };

function Marca() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-ink text-white">
        <FlaskConical size={18} strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-base font-bold leading-tight text-slate-900">
          Minas<span className="text-brand-600">Lab</span>
        </span>
        <span className="block truncate text-[11px] text-slate-500">Painel de Gestão</span>
      </span>
    </div>
  );
}

function ItensMenu({ sessao, aoNavegar }) {
  return (
    <nav aria-label="Módulos do MinasLab" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
      {MODULOS.filter((mo) => podeAbrir(mo.id, sessao)).map((mo) => {
        const Icone = mo.icone;
        return (
          <NavLink
            key={mo.id}
            to={mo.caminho}
            end={mo.caminho === "/"}
            onClick={aoNavegar}
            className={({ isActive }) =>
              clsx(
                "menu-item flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 font-display text-sm font-medium transition-colors",
                isActive ? "bg-brand-50 text-brand-900 ring-1 ring-inset ring-brand-200" : "text-slate-600 hover:bg-brand-50 hover:text-brand-800"
              )
            }
          >
            <Icone size={17} strokeWidth={2.2} />
            {mo.rotulo}
          </NavLink>
        );
      })}
    </nav>
  );
}

function RodapeSessao({ sessao, aoSair, aoTrocarSenha }) {
  return (
    <div className="border-t px-3 py-3" style={{ borderColor: "var(--hairline)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-semibold text-slate-800">{sessao?.nome || sessao?.usuario}</span>
          <span className="block text-xs text-slate-500">{PAPEL_ROTULO[sessao?.papel] || sessao?.papel}</span>
        </span>
        <span className="flex shrink-0 items-center">
          <button type="button" onClick={aoTrocarSenha} className="btn-ghost h-9 w-9 p-0 text-slate-500 hover:text-brand-700" title="Trocar minha senha" aria-label="Trocar minha senha">
            <KeyRound size={15} />
          </button>
          <button type="button" onClick={aoSair} className="btn-ghost h-9 w-9 p-0 text-slate-500 hover:text-bad-700" title="Sair do painel" aria-label="Sair do painel">
            <LogOut size={16} />
          </button>
        </span>
      </div>
    </div>
  );
}

/* Trocar a PRÓPRIA senha mora aqui, no rodapé, porque todo papel precisa dela:
   quem recebe a senha inicial da direção tem de conseguir trocá-la sozinho —
   senha inicial que ninguém troca vira senha eterna em post-it. */
function TrocaSenha({ aberto, aoFechar }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [aviso, setAviso] = useState(null);
  const [gravando, setGravando] = useState(false);

  const trocar = async (e) => {
    e.preventDefault();
    setGravando(true);
    try {
      await trocarMinhaSenha(atual, nova);
      setAviso({ tipo: "ok", texto: "Senha trocada. Use a nova no próximo login." });
      setAtual("");
      setNova("");
      aoFechar();
    } catch (ex) {
      setAviso({ tipo: "erro", texto: ex.message });
    } finally {
      setGravando(false);
    }
  };

  return (
    <>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <Modal titulo="Trocar minha senha" aberto={aberto} aoFechar={aoFechar} largura="max-w-sm">
        <form onSubmit={trocar} className="space-y-4">
          <div>
            <label className="label" htmlFor="ts-atual">Senha atual</label>
            <input id="ts-atual" type="password" className="input" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="ts-nova">Senha nova (mínimo 6)</label>
            <input id="ts-nova" type="password" className="input" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={gravando || !atual || nova.length < 6}>
              {gravando ? "Trocando..." : "Trocar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function Layout() {
  const sessao = getSessao();
  const navigate = useNavigate();
  const location = useLocation();
  const atual = [...MODULOS].reverse().find(m => m.caminho !== "/" && location.pathname.startsWith(m.caminho)) || MODULOS[0];
  useEffect(() => {
    document.title = `${atual.rotulo} · MinasLab`;
    document.getElementById("conteudo-principal")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, atual.rotulo]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);

  const aoSair = () => {
    sair();
    navigate("/entrar", { replace: true });
  };
  const aoTrocarSenha = () => {
    setMenuAberto(false);
    setTrocandoSenha(true);
  };

  return (
    <div className="app-shell flex min-h-screen">
      <a className="skip-link" href="#conteudo-principal">Ir para o conteúdo</a>
      {/* Menu fixo no computador */}
      <aside className="sem-impressao sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-white lg:flex" style={{ borderColor: "var(--hairline)" }}>
        <Marca />
        <ItensMenu sessao={sessao} />
        <RodapeSessao sessao={sessao} aoSair={aoSair} aoTrocarSenha={aoTrocarSenha} />
      </aside>

      <Modal titulo="MinasLab · Menu" aberto={menuAberto} aoFechar={() => setMenuAberto(false)} largura="max-w-xs" gaveta>
        <ItensMenu sessao={sessao} aoNavegar={() => setMenuAberto(false)} />
        <RodapeSessao sessao={sessao} aoSair={aoSair} aoTrocarSenha={aoTrocarSenha} />
      </Modal>

      <TrocaSenha aberto={trocandoSenha} aoFechar={() => setTrocandoSenha(false)} />

      <div className="min-w-0 flex-1">
        {/* Barra do celular */}
        <header className="sem-impressao sticky top-0 z-20 flex items-center gap-2 border-b bg-white/90 px-3 py-2 backdrop-blur lg:hidden" style={{ borderColor: "var(--hairline)" }}>
          <button type="button" onClick={() => setMenuAberto(true)} className="btn-ghost h-9 w-9 p-0" title="Abrir menu" aria-label="Abrir menu" aria-expanded={menuAberto}>
            <Menu size={18} />
          </button>
          <span className="font-display text-sm font-bold text-slate-900">
            {atual.rotulo}
          </span>
          <span className="ml-auto text-xs text-slate-500">MinasLab</span>
        </header>

        <main id="conteudo-principal" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <LimiteModulo key={location.pathname}>
            <Suspense fallback={<CarregandoModulo />}><Outlet /></Suspense>
          </LimiteModulo>
        </main>
      </div>
    </div>
  );
}
