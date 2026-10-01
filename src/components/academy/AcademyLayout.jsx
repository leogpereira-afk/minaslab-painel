// Moldura da Academy: submenu no topo (padrão do Financeiro) + conteúdo.
// Só aparece o que a pessoa pode abrir; o que ainda não foi construído aparece
// desabilitado e só para a direção, para acompanhar o andamento.
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Home, BookOpen, Route as Trilha, ClipboardCheck, UserCheck, Award, Grid3x3, Settings2, Bell } from "lucide-react";
import { notificacoesListar, notificacaoLer } from "../../services/academy.js";
import { capacidadesAcademy, ehDirecao } from "../../lib/sessao.js";
import "./academy.css";

const ITENS = [
  { chave: "minha", rotulo: "Minha Academy", to: "/academy/minha", icone: Home, pronto: true, vale: (c) => c.colaborador },
  { chave: "catalogo", rotulo: "Catálogo de Treinamentos", to: "/academy/catalogo", icone: BookOpen, pronto: true, vale: (c) => c.colaborador },
  { chave: "trilhas", rotulo: "Trilhas de Aprendizagem", to: "/academy/trilhas", icone: Trilha, pronto: false },
  { chave: "avaliacoes", rotulo: "Avaliações", to: "/academy/avaliacoes", icone: ClipboardCheck, pronto: true, vale: (c) => c.colaborador },
  { chave: "gestor", rotulo: "Avaliações do Gestor", to: "/academy/avaliacoes-gestor", icone: UserCheck, pronto: false },
  { chave: "certificados", rotulo: "Meus Certificados", to: "/academy/certificados", icone: Award, pronto: true, vale: (c) => c.colaborador },
  { chave: "matriz", rotulo: "Matriz de Competências", to: "/academy/matriz", icone: Grid3x3, pronto: false },
  { chave: "gestao", rotulo: "Gestão Academy", to: "/academy/gestao", icone: Settings2, pronto: true, vale: (c) => c.gestao || c.qualidade },
];

// Sino de notificações internas (atribuição, resultado, conclusão).
function Sino() {
  const navigate = useNavigate();
  const [lista, setLista] = useState([]), [aberto, setAberto] = useState(false), [falhou, setFalhou] = useState(false);
  const carregar = useCallback(() => notificacoesListar().then((l) => { setLista(l); setFalhou(false); }).catch(() => setFalhou(true)), []);
  useEffect(() => { carregar(); }, [carregar]);
  const naoLidas = lista.filter((n) => !n.lida_em).length;
  const abrir = async (n) => { setAberto(false); if (!n.lida_em) { await notificacaoLer(n.id).catch(() => {}); carregar(); } if (n.link) navigate(n.link); };
  return (
    <div className="relative">
      <button type="button" className="btn-ghost relative h-10 w-10 p-0" aria-label={`Notificações${naoLidas ? `: ${naoLidas} não lida(s)` : ""}`} aria-expanded={aberto} onClick={() => { setAberto(!aberto); if (!aberto) carregar(); }}>
        <Bell size={18} />{naoLidas > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad-600 px-1 text-[10px] font-bold text-white">{naoLidas}</span>}</button>
      {aberto && <div className="absolute right-0 z-30 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border bg-white p-2 shadow-card" style={{ borderColor: "var(--hairline)" }}>
        {falhou && <p className="p-3 text-sm text-slate-500">Não foi possível carregar as notificações.</p>}
        {!falhou && lista.length === 0 && <p className="p-3 text-sm text-slate-500">Nenhuma notificação.</p>}
        <ul className="max-h-80 space-y-1 overflow-y-auto">{lista.map((n) => (<li key={n.id}><button type="button" onClick={() => abrir(n)} className={`w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-brand-50 ${n.lida_em ? "text-slate-500" : "font-semibold text-slate-900"}`}>{n.titulo}{n.corpo && <span className="block text-xs font-normal text-slate-500">{n.corpo}</span>}</button></li>))}</ul>
        {naoLidas > 0 && <button type="button" className="mt-1 w-full rounded-xl p-2 text-center text-xs font-semibold text-brand-700 hover:bg-brand-50" onClick={async () => { await notificacaoLer().catch(() => {}); carregar(); }}>Marcar todas como lidas</button>}
      </div>}
    </div>
  );
}

export default function AcademyLayout() {
  const caps = capacidadesAcademy();
  const direcao = ehDirecao();
  const { pathname } = useLocation();
  const visiveis = ITENS.filter((i) => (i.pronto ? i.vale(caps) : direcao));
  if (pathname === "/academy" || pathname === "/academy/") {
    const primeiro = ITENS.find((i) => i.pronto && i.vale(caps));
    return <Navigate to={primeiro ? primeiro.to : "/"} replace />;
  }
  return (
    <div className="space-y-4">
      <nav className="academy-nav" aria-label="Menu da Academy">
        {caps.colaborador && <div className="mb-1 flex justify-end"><Sino /></div>}
        <div className="academy-nav-grade">
          {visiveis.map(({ chave, rotulo, to, icone: Icone, pronto }) => pronto
            ? <NavLink key={chave} to={to} className={({ isActive }) => `academy-nav-link${isActive ? " academy-nav-ativo" : ""}`}><Icone size={18} aria-hidden="true" /><span>{rotulo}</span></NavLink>
            : <span key={chave} aria-disabled="true" title={`${rotulo} — em desenvolvimento`} className="academy-nav-link academy-nav-off"><Icone size={18} aria-hidden="true" /><span>{rotulo}</span></span>)}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
