// A moldura do painel: menu lateral no computador, gaveta no celular.
// O menu so MOSTRA o que o papel abre — quem barra de verdade e o servidor.

import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { clsx } from "clsx";
import { KeyRound, LogOut, Menu, Search, ArrowUpRight, X } from "lucide-react";
import logoMinasLab from "../assets/logo-minaslab.webp";
import "../styles/painel-visual.css";
import { getSessao, sair, podeAbrir } from "../lib/sessao.js";
import { useAcessoGestao } from "../lib/acessoGestao.js";
import { trocarMinhaSenha } from "../services/dados.js";
import { LimiteModulo } from "./LimiteModulo.jsx";
import { Modal, Aviso, CarregandoModulo } from "./ui.jsx";
import Notificacoes from "./Notificacoes.jsx";

/* O MENU E UMA LISTA SO. A Impresilk pagou dois dias de procura porque a lista
   de modulos vivia copiada em tres arquivos e a copia envelhecia calada. Aqui:
   modulo novo entra NESTE array e na rota do App.jsx — e em nenhum outro
   lugar. */
const MODULOS = [
  { id: "inicio", rotulo: "Início", caminho: "/", emoji: "🏠", grupo: "Agenda" },
  { id: "tarefas", rotulo: "Tarefas", caminho: "/tarefas", emoji: "✅", grupo: "Agenda" },
  { id: "calendario", rotulo: "Calendário", caminho: "/calendario", emoji: "🗓️", grupo: "Agenda" },
  { id: "compromissos", rotulo: "Compromissos", caminho: "/compromissos", emoji: "📌", grupo: "Agenda" },
  { id: "licitacoes", rotulo: "Licitações", caminho: "/licitacoes", emoji: "⚖️", grupo: "Negócios" },
  { id: "marketing", rotulo: "Marketing", caminho: "/marketing", emoji: "📣", grupo: "Negócios" },
  { id: "google-drive", rotulo: "Google Drive", caminho: "/google-drive", emoji: "📂", grupo: "Administração" },
  { id: "compras", rotulo: "Compras", caminho: "/compras", emoji: "🛒", grupo: "Operação" },
  { id: "gestao-estoque", rotulo: "Gestão de Estoque", caminho: "/gestao-estoque", emoji: "📦", grupo: "Operação" },
  { id: "patrimonio", rotulo: "Patrimônio", caminho: "/patrimonio", emoji: "🏢", grupo: "Operação" },
  { id: "manutencoes", rotulo: "Manutenções", caminho: "/manutencoes", emoji: "🛠️", grupo: "Operação" },
  { id: "laboratorio", rotulo: "Laboratório", caminho: "/laboratorio", emoji: "🧪", grupo: "Operação" },
  { id: "rh", rotulo: "RH", caminho: "/rh", emoji: "👥", grupo: "Administração" },
  { id: "ponto", rotulo: "Ponto", caminho: "/ponto", emoji: "⏱️", grupo: "Administração" },
  { id: "financas", rotulo: "Finanças", caminho: "/financas", emoji: "💰", grupo: "Negócios" },
  /* O CRM é um app à parte (pasta crm/), publicado junto em <base>/crm/ — por
     isso é <a> e não NavLink: o Router do painel não conhece essas rotas. */
  { id: "crm", rotulo: "CRM", caminho: `${import.meta.env.BASE_URL}crm/dashboard`, emoji: "🤝", grupo: "Negócios", externo: true },
  /* Gestão (Comercial e Laboratório): app à parte (pasta gestao/), em <base>/gestao/.
     Aparece só para quem tem acesso liberado na tela Acessos da própria Gestão. */
  { id: "gestao", rotulo: "Gestão", caminho: `${import.meta.env.BASE_URL}gestao/`, emoji: "💼", grupo: "Negócios", externo: true },
  { id: "curva-abc", rotulo: "Curva ABC", caminho: "/curva-abc", emoji: "📊", grupo: "Negócios" },
  { id: "acessos", rotulo: "Acessos", caminho: "/acessos", emoji: "🔐", grupo: "Administração" },
];

const CORES_MODULO = {
  patrimonio: ["#0369a1", "#e0f2fe"],
  inicio: ["#0f766e", "#d9f4ef"], tarefas: ["#0369a1", "#e0f2fe"], calendario: ["#2563eb", "#e5edff"],
  compromissos: ["#7c3aed", "#eee7ff"], licitacoes: ["#b45309", "#fff0cf"],
  marketing: ["#db2777", "#fce5f1"], "google-drive": ["#16803d", "#dcf5e4"],
  compras: ["#c2410c", "#ffeadc"], "gestao-estoque": ["#0f766e", "#d9f4ef"], manutencoes: ["#475569", "#e6edf5"],
  laboratorio: ["#0891b2", "#dcf5fc"], rh: ["#7c3aed", "#eee7ff"],
  ponto: ["#2563eb", "#e5edff"], financas: ["#15803d", "#dcf5e4"], crm: ["#2563eb", "#e5edff"], gestao: ["#0e7c66", "#d1fae5"],
  "curva-abc": ["#4f46e5", "#e9e7ff"], acessos: ["#a16207", "#fef3cd"],
};

const PAPEL_ROTULO = { direcao: "Direção", equipe: "Equipe", leitura: "Leitura" };

function Marca() {
  return <div className="ml-brand">
    <img src={logoMinasLab} alt="MinasLab, Laboratório de Controle de Qualidade" width="190" height="56" />
    <span className="ml-brand-caption">PAINEL DE GESTÃO</span>
  </div>;
}

function ItensMenu({ sessao, aoNavegar }) {
  const gestao = useAcessoGestao(sessao);
  const [busca, setBusca] = useState("");
  const pode = (id) => (id === "gestao" ? gestao : podeAbrir(id, sessao));
  const normalizar = (valor) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/coes\b/g, "cao");
  const modulos = MODULOS.filter(mo => pode(mo.id) && normalizar(mo.rotulo).includes(normalizar(busca.trim())));
  return <div className="ml-navigation">
    <div className="ml-menu-search">
      <Search size={16} aria-hidden="true" />
      <input aria-label="Buscar módulo" type="search" placeholder="Encontrar módulo..." value={busca} onChange={e => setBusca(e.target.value)} />
      {busca && <button type="button" aria-label="Limpar busca" onClick={() => setBusca("")}><X size={14}/></button>}
    </div>
    <nav aria-label="Módulos do MinasLab" className="ml-menu-scroll">
      {["Agenda", "Operação", "Negócios", "Administração"].map(grupo => {
        const itens = modulos.filter(mo => mo.grupo === grupo);
        if (!itens.length) return null;
        return <section key={grupo} className="ml-menu-group" aria-label={grupo}>
          <h2 className="ml-menu-label">{grupo}</h2>
          {itens.map(mo => {
            const conteudo = <>
              <span className="ml-emoji-tile" aria-hidden="true" style={{ "--tile-color": CORES_MODULO[mo.id][0], "--tile-bg": CORES_MODULO[mo.id][1] }}>{mo.emoji}</span>
              <span className="ml-menu-text">{mo.rotulo}</span>
              {mo.externo && <ArrowUpRight size={13} className="ml-external-icon" aria-hidden="true"/>}
            </>;
            return mo.externo ? <a key={mo.id} href={mo.caminho} target="_blank" rel="noopener noreferrer" onClick={aoNavegar} className="ml-menu-link" aria-label={`${mo.rotulo} (abre em nova aba)`}>{conteudo}</a> :
              <NavLink key={mo.id} to={mo.caminho} end={mo.caminho === "/"} onClick={aoNavegar} className={({ isActive }) => clsx("ml-menu-link", isActive && "ml-menu-link-active")}>{conteudo}</NavLink>;
          })}
        </section>;
      })}
      {modulos.length === 0 && <p className="ml-menu-empty" role="status">Nenhum módulo encontrado.</p>}
    </nav>
  </div>;
}

function RodapeSessao({ sessao, aoSair, aoTrocarSenha }) {
  return (
    <div className="ml-session">
      <div className="flex items-center justify-between gap-2">
        <span className="ml-avatar" aria-hidden="true">{(sessao?.nome || sessao?.usuario || "ML").split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-semibold text-slate-800">{sessao?.nome || sessao?.usuario}</span>
          <span className="block text-xs text-slate-500">{PAPEL_ROTULO[sessao?.papel] || sessao?.papel}</span>
        </span>
        <span className="flex shrink-0 items-center">
          <Notificacoes />
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
    <div className="app-shell ml-shell flex min-h-screen">
      <a className="skip-link" href="#conteudo-principal">Ir para o conteúdo</a>
      {/* Menu fixo no computador */}
      <aside className="ml-sidebar sem-impressao sticky top-0 hidden h-dvh shrink-0 flex-col lg:flex" style={{ borderColor: "var(--hairline)" }}>
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
        <div className="ml-desktop-context sem-impressao">
          <span>Painel de gestão <span aria-hidden="true">/</span> <strong><span aria-hidden="true">{atual.emoji}</span> {atual.rotulo}</strong></span>
          <span className="ml-context-label">MinasLab · Controle de qualidade</span>
        </div>
        {/* Barra do celular */}
        <header className="sem-impressao sticky top-0 z-20 flex items-center gap-2 border-b bg-white/90 px-3 py-2 backdrop-blur lg:hidden" style={{ borderColor: "var(--hairline)" }}>
          <button type="button" onClick={() => setMenuAberto(true)} className="btn-ghost h-9 w-9 p-0" title="Abrir menu" aria-label="Abrir menu" aria-expanded={menuAberto}>
            <Menu size={18} />
          </button>
          <span className="font-display text-sm font-bold text-slate-900">
            <span aria-hidden="true">{atual.emoji}</span> {atual.rotulo}
          </span>
          <span className="ml-auto flex items-center gap-1"><Notificacoes /><span className="text-xs text-slate-500">MinasLab</span></span>
        </header>

        <main id="conteudo-principal" tabIndex={-1} className="ml-main mx-auto w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <LimiteModulo key={location.pathname}>
            <Suspense fallback={<CarregandoModulo />}><Outlet /></Suspense>
          </LimiteModulo>
        </main>
      </div>
    </div>
  );
}
