// A moldura do painel: menu lateral no computador, gaveta no celular.
// O menu so MOSTRA o que o papel abre — quem barra de verdade e o servidor.

import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import {
  CalendarDays,
  CalendarCheck,
  Gavel,
  Megaphone,
  ShoppingCart,
  Wrench,
  Users,
  Wallet,
  FlaskConical,
  Truck,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { getSessao, sair, podeAbrir } from "../lib/sessao.js";
import { trocarMinhaSenha } from "../services/dados.js";
import { Modal, Aviso } from "./ui.jsx";

/* O MENU E UMA LISTA SO. A Impresilk pagou dois dias de procura porque a lista
   de modulos vivia copiada em tres arquivos e a copia envelhecia calada. Aqui:
   modulo novo entra NESTE array e na rota do App.jsx — e em nenhum outro
   lugar. */
const MODULOS = [
  { id: "inicio", rotulo: "Início", caminho: "/", icone: LayoutDashboard },
  { id: "calendario", rotulo: "Calendário", caminho: "/calendario", icone: CalendarDays },
  { id: "compromissos", rotulo: "Compromissos", caminho: "/compromissos", icone: CalendarCheck },
  { id: "coletas", rotulo: "Coletas de campo", caminho: "/coletas", icone: Truck },
  { id: "licitacoes", rotulo: "Licitações", caminho: "/licitacoes", icone: Gavel },
  { id: "marketing", rotulo: "Marketing", caminho: "/marketing", icone: Megaphone },
  { id: "compras", rotulo: "Compras", caminho: "/compras", icone: ShoppingCart },
  { id: "manutencoes", rotulo: "Manutenções", caminho: "/manutencoes", icone: Wrench },
  { id: "laboratorio", rotulo: "Laboratório", caminho: "/laboratorio", icone: FlaskConical },
  { id: "rh", rotulo: "RH", caminho: "/rh", icone: Users },
  { id: "financas", rotulo: "Finanças", caminho: "/financas", icone: Wallet },
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
    <nav className="flex-1 space-y-0.5 px-2">
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
                "flex items-center gap-2.5 rounded-xl px-3 py-2 font-display text-sm font-medium transition-colors",
                isActive ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-brand-50 hover:text-brand-800"
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
          <button type="button" onClick={aoTrocarSenha} className="btn-ghost h-9 w-9 p-0 text-slate-500 hover:text-brand-700" title="Trocar minha senha">
            <KeyRound size={15} />
          </button>
          <button type="button" onClick={aoSair} className="btn-ghost h-9 w-9 p-0 text-slate-500 hover:text-bad-700" title="Sair do painel">
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
    <div className="flex min-h-screen">
      {/* Menu fixo no computador */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-white lg:flex" style={{ borderColor: "var(--hairline)" }}>
        <Marca />
        <ItensMenu sessao={sessao} />
        <RodapeSessao sessao={sessao} aoSair={aoSair} aoTrocarSenha={aoTrocarSenha} />
      </aside>

      {/* Gaveta no celular */}
      {menuAberto && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMenuAberto(false)}>
          <aside className="flex h-full w-64 flex-col bg-white shadow-card-hover" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pr-2">
              <Marca />
              <button type="button" onClick={() => setMenuAberto(false)} className="btn-ghost h-9 w-9 p-0" title="Fechar menu">
                <X size={18} />
              </button>
            </div>
            <ItensMenu sessao={sessao} aoNavegar={() => setMenuAberto(false)} />
            <RodapeSessao sessao={sessao} aoSair={aoSair} aoTrocarSenha={aoTrocarSenha} />
          </aside>
        </div>
      )}

      <TrocaSenha aberto={trocandoSenha} aoFechar={() => setTrocandoSenha(false)} />

      <div className="min-w-0 flex-1">
        {/* Barra do celular */}
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-white/90 px-3 py-2 backdrop-blur lg:hidden" style={{ borderColor: "var(--hairline)" }}>
          <button type="button" onClick={() => setMenuAberto(true)} className="btn-ghost h-9 w-9 p-0" title="Abrir menu">
            <Menu size={18} />
          </button>
          <span className="font-display text-sm font-bold text-slate-900">
            Minas<span className="text-brand-600">Lab</span>
          </span>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
