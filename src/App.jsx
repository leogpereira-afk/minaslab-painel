// As rotas do painel. Modulo novo: entra AQUI e no MODULOS do Layout — e em
// nenhum outro lugar (lista copiada falha calada).

import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import FinanceiroLayout from "./components/financeiro/FinanceiroLayout.jsx";
import { CarregandoModulo } from "./components/ui.jsx";
import { getSessao, aoMudarSessao, podeAbrir } from "./lib/sessao.js";

const Login = lazy(() => import("./pages/Login.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const Calendario = lazy(() => import("./pages/Calendario.jsx"));
const Compromissos = lazy(() => import("./pages/Compromissos.jsx"));
const Licitacoes = lazy(() => import("./pages/Licitacoes.jsx"));
const Marketing = lazy(() => import("./pages/Marketing.jsx"));
const Compras = lazy(() => import("./pages/Compras.jsx"));
const Manutencoes = lazy(() => import("./pages/Manutencoes.jsx"));
const Laboratorio = lazy(() => import("./pages/Laboratorio.jsx"));
const RH = lazy(() => import("./pages/RH.jsx"));
const Ponto = lazy(() => import("./pages/Ponto.jsx"));
const FinanceiroDashboard = lazy(() => import("./pages/FinanceiroDashboard.jsx"));
const Recebimentos = lazy(() => import("./pages/RecebimentosFinanceiro.jsx"));
const Despesas = lazy(() => import("./pages/Despesas.jsx"));
const NotasFiscais = lazy(() => import("./pages/NotasFiscais.jsx"));
const EmitirNfse = lazy(() => import("./pages/EmitirNfse.jsx"));
const CancelarNfse = lazy(() => import("./pages/CancelarNfse.jsx"));
const ImportarNfseHistorico = lazy(() => import("./pages/ImportarNfseHistorico.jsx"));
const ClientesFinanceiro = lazy(() => import("./pages/ClientesFinanceiro.jsx"));
const RelatoriosFinanceiro = lazy(() => import("./pages/RelatoriosFinanceiro.jsx"));
const MovimentacaoConta = lazy(() => import("./pages/MovimentacaoConta.jsx"));
const Extrato = lazy(() => import("./pages/Extrato.jsx"));
const ConciliacaoTitulos = lazy(() => import("./pages/ConciliacaoTitulos.jsx"));
const FluxoCaixa = lazy(() => import("./pages/FluxoCaixa.jsx"));
const PlanoContas = lazy(() => import("./pages/PlanoContas.jsx"));
const ConfigFinanceiroHub = lazy(() => import("./pages/ConfigFinanceiroHub.jsx"));
const ConfigCadastrosFinanceiro = lazy(() => import("./pages/ConfigCadastrosFinanceiro.jsx"));
const ConfigOmieFinanceiro = lazy(() => import("./pages/ConfigOmieFinanceiro.jsx"));
const CurvaAbc = lazy(() => import("./pages/CurvaAbc.jsx"));
const Acessos = lazy(() => import("./pages/Acessos.jsx"));

function Guarda({ modulo, children }) { const sessao=getSessao(); const location=useLocation(); if(!sessao)return <Navigate to="/entrar" replace state={{de:location.pathname}}/>; if(modulo&&!podeAbrir(modulo,sessao))return <Navigate to="/" replace/>; return children; }
export default function App(){const[,setVersao]=useState(0);useEffect(()=>aoMudarSessao(()=>setVersao(v=>v+1)),[]);return <BrowserRouter basename={import.meta.env.BASE_URL}><Suspense fallback={<div className="p-8"><CarregandoModulo/></div>}><Routes><Route path="/entrar" element={<Login/>}/><Route element={<Guarda><Layout/></Guarda>}><Route path="/" element={<Home/>}/><Route path="/calendario" element={<Calendario/>}/><Route path="/compromissos" element={<Compromissos/>}/><Route path="/licitacoes" element={<Licitacoes/>}/><Route path="/marketing" element={<Marketing/>}/><Route path="/compras" element={<Compras/>}/><Route path="/manutencoes" element={<Manutencoes/>}/><Route path="/laboratorio" element={<Laboratorio/>}/><Route path="/rh" element={<Guarda modulo="rh"><RH/></Guarda>}/><Route path="/ponto" element={<Guarda modulo="ponto"><Ponto/></Guarda>}/><Route path="/financas" element={<Guarda modulo="financas"><FinanceiroLayout/></Guarda>}><Route index element={<FinanceiroDashboard/>}/><Route path="dashboard" element={<Navigate to="/financas" replace/>}/><Route path="contas-a-receber" element={<Recebimentos/>}/><Route path="recebimentos" element={<Recebimentos/>}/><Route path="contas-a-pagar" element={<Despesas/>}/><Route path="despesas" element={<Despesas/>}/><Route path="notas-fiscais" element={<NotasFiscais/>}/><Route path="notas-fiscais/emitir" element={<EmitirNfse/>}/><Route path="notas-fiscais/cancelar" element={<CancelarNfse/>}/><Route path="notas-fiscais/importar-historico" element={<ImportarNfseHistorico/>}/><Route path="clientes" element={<ClientesFinanceiro/>}/><Route path="relatorios" element={<RelatoriosFinanceiro/>}/><Route path="movimentacao-conta" element={<MovimentacaoConta/>}/><Route path="bancos" element={<Extrato/>}/><Route path="extrato" element={<Extrato/>}/><Route path="conciliacao" element={<ConciliacaoTitulos/>}/><Route path="conciliacao-titulos" element={<ConciliacaoTitulos/>}/><Route path="fluxo-caixa" element={<FluxoCaixa/>}/><Route path="plano-contas" element={<PlanoContas/>}/><Route path="configuracoes" element={<ConfigFinanceiroHub/>}/><Route path="configuracoes/omie" element={<ConfigOmieFinanceiro/>}/><Route path="configuracoes/:secao" element={<ConfigCadastrosFinanceiro/>}/></Route><Route path="/curva-abc" element={<Guarda modulo="curva-abc"><CurvaAbc/></Guarda>}/><Route path="/acessos" element={<Guarda modulo="acessos"><Acessos/></Guarda>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></Suspense></BrowserRouter>}
