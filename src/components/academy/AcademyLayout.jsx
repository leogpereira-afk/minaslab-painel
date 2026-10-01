// Moldura da Academy: submenu no topo (padrão do Financeiro) + conteúdo.
// Só aparece o que a pessoa pode abrir; o que ainda não foi construído aparece
// desabilitado e só para a direção, para acompanhar o andamento.
import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { Home, BookOpen, Route as Trilha, ClipboardCheck, UserCheck, Award, Grid3x3, Settings2 } from "lucide-react";
import { capacidadesAcademy, ehDirecao } from "../../lib/sessao.js";
import "./academy.css";

const ITENS = [
  { chave: "minha", rotulo: "Minha Academy", to: "/academy/minha", icone: Home, pronto: false },
  { chave: "catalogo", rotulo: "Catálogo de Treinamentos", to: "/academy/catalogo", icone: BookOpen, pronto: false },
  { chave: "trilhas", rotulo: "Trilhas de Aprendizagem", to: "/academy/trilhas", icone: Trilha, pronto: false },
  { chave: "avaliacoes", rotulo: "Avaliações", to: "/academy/avaliacoes", icone: ClipboardCheck, pronto: false },
  { chave: "gestor", rotulo: "Avaliações do Gestor", to: "/academy/avaliacoes-gestor", icone: UserCheck, pronto: false },
  { chave: "certificados", rotulo: "Meus Certificados", to: "/academy/certificados", icone: Award, pronto: false },
  { chave: "matriz", rotulo: "Matriz de Competências", to: "/academy/matriz", icone: Grid3x3, pronto: false },
  { chave: "gestao", rotulo: "Gestão Academy", to: "/academy/gestao", icone: Settings2, pronto: true, vale: (c) => c.gestao || c.qualidade },
];

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
