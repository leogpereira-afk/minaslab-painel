// As rotas do painel. Modulo novo: entra AQUI e no MODULOS do Layout — e em
// nenhum outro lugar (lista copiada falha calada).
//
// lazy() em cada pagina: quem abre o Calendario nao baixa o RH junto.

import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { CarregandoModulo } from "./components/ui.jsx";
import { getSessao, aoMudarSessao, podeAbrir } from "./lib/sessao.js";

const Login = lazy(() => import("./pages/Login.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const Calendario = lazy(() => import("./pages/Calendario.jsx"));
const Compromissos = lazy(() => import("./pages/Compromissos.jsx"));
const Coletas = lazy(() => import("./pages/Coletas.jsx"));
const Licitacoes = lazy(() => import("./pages/Licitacoes.jsx"));
const Marketing = lazy(() => import("./pages/Marketing.jsx"));
const Compras = lazy(() => import("./pages/Compras.jsx"));
const Manutencoes = lazy(() => import("./pages/Manutencoes.jsx"));
const Laboratorio = lazy(() => import("./pages/Laboratorio.jsx"));
const RH = lazy(() => import("./pages/RH.jsx"));
const Financas = lazy(() => import("./pages/Financas.jsx"));
const Acessos = lazy(() => import("./pages/Acessos.jsx"));

// Porta da rota: sem sessao vai para o login; sem papel para o modulo, volta
// para o inicio. E conforto de navegacao — a porta de verdade e o servidor.
function Guarda({ modulo, children }) {
  const sessao = getSessao();
  const location = useLocation();
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: location.pathname }} />;
  if (modulo && !podeAbrir(modulo, sessao)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  // Re-render quando a sessao muda (login, logout, cracha vencido).
  const [, setVersao] = useState(0);
  useEffect(() => aoMudarSessao(() => setVersao((v) => v + 1)), []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<div className="p-8"><CarregandoModulo /></div>}>
        <Routes>
          <Route path="/entrar" element={<Login />} />
          <Route
            element={
              <Guarda>
                <Layout />
              </Guarda>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/compromissos" element={<Compromissos />} />
            <Route path="/coletas" element={<Coletas />} />
            <Route path="/licitacoes" element={<Licitacoes />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/compras" element={<Compras />} />
            <Route path="/manutencoes" element={<Manutencoes />} />
            <Route path="/laboratorio" element={<Laboratorio />} />
            <Route path="/rh" element={<Guarda modulo="rh"><RH /></Guarda>} />
            <Route path="/financas" element={<Guarda modulo="financas"><Financas /></Guarda>} />
            <Route path="/acessos" element={<Guarda modulo="acessos"><Acessos /></Guarda>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
