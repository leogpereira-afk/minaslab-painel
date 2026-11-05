import { useEffect, useState } from "react";
import { aoMudarSessao, getSessao, podeUsarLims, sair } from "./lib/sessao.js";
import { useRota, link } from "./lib/rota.js";
import { ITEM_DA_TELA } from "./lib/menu.js";
import { DadosProvider, useDados } from "./lib/dados.jsx";
import { CADASTROS } from "./lib/cadastros.js";
import { AvisoProvider, Caixa } from "./components/ui.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { ListaClientes, FormCliente, VerCliente } from "./pages/Clientes.jsx";
import ListaSolicitantes, { FormSolicitante, VerSolicitante } from "./pages/Solicitantes.jsx";
import ListaPropostas from "./pages/Propostas.jsx";
import PropostaForm from "./pages/PropostaForm.jsx";
import PropostaServicos from "./pages/PropostaServicos.jsx";
import PropostaVer from "./pages/PropostaVer.jsx";
import TelaCadastro from "./components/Cadastro.jsx";
import ConfigSistema from "./pages/ConfigSistema.jsx";
import Permissoes from "./pages/Permissoes.jsx";
import AuditoriaLog from "./pages/AuditoriaLog.jsx";
import { ListaOS, FichaOS, Etiquetas, Rastreabilidade } from "./pages/Ordens.jsx";
import { DocumentoOS } from "./pages/DocumentosOS.jsx";
import { EscopoAcreditacao } from "./pages/Escopo.jsx";
import { Logistica, Coletas, RegistrarColeta, FichaCustodia, Agenda, Descarte } from "./pages/Coletas.jsx";
import { Inspecao, Protocolo, AnalisePorAmostra, AnaliseAmostra, AnalisePorParametro } from "./pages/Laboratorio.jsx";
import { RevisaoResultado, RevisaoCertificado, CertificadoOS } from "./pages/Revisao.jsx";
import { ContasReceber, BoletimMedicao } from "./pages/Financeiro.jsx";
import { RelatorioAmostras, RelatorioCentroCusto, DashboardFinanceiro } from "./pages/Relatorios.jsx";
import { ContratosPendentes, ListaContratos, FichaContrato, DetalhesContrato, PlanoColeta, PlanoColetaAutomatico } from "./pages/Contratos.jsx";

// Tela → [componente, migalhas]. Telas do menu ainda não construídas abrem
// "Tela em construção". Tela nova entra aqui e em lib/menu.js.
const TELAS = {
  dashboard: [Dashboard, () => [["Dashboard"]]],
  customers: [ListaClientes, () => [["Clientes"]]],
  "customer-register": [FormCliente, () => [["Clientes", link("customers")], ["Adiciona Cliente"]]],
  cliente: [VerCliente, () => [["Clientes", link("customers")], ["Detalhes da Cliente"]]],
  "cliente-editar": [FormCliente, () => [["Clientes", link("customers")], ["Editar Cliente"]]],
  solicitantes: [ListaSolicitantes, () => [["Solicitantes"]]],
  "adicionar-solicitante": [FormSolicitante, () => [["Solicitantes", link("solicitantes")], ["Adicionar Solicitante"]]],
  solicitante: [VerSolicitante, () => [["Solicitantes", link("solicitantes")], ["Visualizar Solicitante"]]],
  proposedlist: [ListaPropostas, () => [["Propostas"], ["Listar Propostas"]]],
  "criar-proposta": [PropostaForm, (param) => [["Propostas", link("proposedlist")], [param ? "Editar Proposta" : "Criar Proposta"]]],
  "proposta-servicos": [PropostaServicos, () => [["Propostas", link("proposedlist")], ["Serviços e amostras"]]],
  proposta: [PropostaVer, () => [["Propostas", link("proposedlist")], ["Visualizar Proposta"]]],
  "notification-pedents": [ContratosPendentes, () => [["Contratos"], ["Contratos Pendentes"]]],
  contracts: [ListaContratos, () => [["Contratos"]]],
  contract: [FichaContrato, () => [["Contratos", link("contracts")], ["Contrato"]]],
  "services-contract": [DetalhesContrato, (param) => [["Contratos", link("contracts")], ["Contrato", link("contract", param)], ["Detalhes do contrato"]]],
  "collection-plan": [PlanoColeta, (param) => [["Contratos", link("contracts")], ["Contrato", link("contract", param)], ["Plano de Coleta"]]],
  "service-order": [ListaOS, () => [["Ordem serviços"]]],
  ordem: [FichaOS, () => [["Ordem serviços", link("service-order")], ["Ordem de serviço"]]],
  etiquetas: [Etiquetas, () => [["Ordem serviços", link("service-order")], ["Etiqueta"]]],
  "escopo-acreditacao": [EscopoAcreditacao, () => [["Configurações"], ["Escopo de acreditação"]]],
  "doc-os": [DocumentoOS, () => [["Ordem serviços", link("service-order")], ["Documento"]]],
  traceability: [Rastreabilidade, () => [["Rastreabilidade"]]],
  logistics: [Logistica, () => [["Coletas"], ["Logística"]]],
  collections: [Coletas, () => [["Coletas"], ["Coletas"]]],
  coleta: [RegistrarColeta, () => [["Coletas", link("collections")], ["Edição Dinâmica"]]],
  "ficha-coleta": [FichaCustodia, () => [["Coletas", link("collections")], ["Cadeia de custódia"]]],
  calendar: [Agenda, () => [["Coletas"], ["Agenda"]]],
  discardsamples: [Descarte, () => [["Coletas"], ["Descarte amostras"]]],
  "technical-inspection": [Inspecao, () => [["Laboratório"], ["Inspeção técnica de amostra"]]],
  protocolo: [Protocolo, () => [["Laboratório", link("technical-inspection")], ["Protocolo de recebimento"]]],
  "laboratory-order-services": [AnalisePorAmostra, () => [["Laboratório"], ["Análise por Amostra"]]],
  analise: [AnaliseAmostra, () => [["Laboratório", link("laboratory-order-services")], ["Análise da amostra"]]],
  "analysis-methods": [AnalisePorParametro, () => [["Laboratório"], ["Análise por Parâmetro"]]],
  "list-revisions-result": [RevisaoResultado, () => [["Revisão"], ["Resultado"]]],
  "list-revisions": [RevisaoCertificado, () => [["Revisão"], ["Certificado"]]],
  certificado: [CertificadoOS, () => [["Revisão", link("list-revisions")], ["Certificado"]]],
  "bills-to-receive": [ContasReceber, () => [["Financeiro"], ["Contas a receber"]]],
  boletim: [BoletimMedicao, () => [["Financeiro", link("bills-to-receive")], ["Boletim de Medição"]]],
  "report-sample": [RelatorioAmostras, () => [["Relatórios"], ["Relatórios de amostras"]]],
  "report-cost-center": [RelatorioCentroCusto, () => [["Relatórios"], ["Relatórios de centro de custos"]]],
  "dashboard-financeiro": [DashboardFinanceiro, () => [["Relatórios"], ["Dashboard Financeiro"]]],
  "collection-plan-auto": [PlanoColetaAutomatico, (param) => [["Contratos", link("contracts")], ["Contrato", link("contract", param)], ["Plano de Coleta automático"]]],
  configs: [ConfigSistema, () => [["Configurações"], ["Configuração do sistema"]]],
  "permissoes-de-acesso": [Permissoes, () => [["Configurações"], ["Permissões de acesso"]]],
  auditoria: [AuditoriaLog, () => [["Configurações"], ["Auditoria LOG"]]],
  // Todos os cadastros de Configurações usam o mesmo motor (lib/cadastros.js).
  ...Object.fromEntries(Object.entries(CADASTROS).map(([tela, def]) => [tela, [TelaCadastro, () => [[def.menu || "Configurações"], [def.titulo]]]])),
};

function EmConstrucao({ tela }) {
  const it = ITEM_DA_TELA[tela];
  return (
    <Caixa titulo={it.rotulo}>
      <div className="soonbox"><b>Tela em construção</b>Este item do menu {it.menu} entra numa próxima etapa. Já estão prontos: Dashboard, Cadastro, Propostas, Contratos e Configurações.</div>
    </Caixa>
  );
}
function NaoEncontrada() {
  return <Caixa titulo="Página não encontrada"><p style={{ margin: 0 }}>Este endereço não existe no LIMS. <a href={link("dashboard")}>Voltar ao Dashboard</a></p></Caixa>;
}

function Telas({ sessao }) {
  const { tela, param } = useRota();
  const { carregando, erro, recarregar } = useDados();
  const def = TELAS[tela];
  const Tela = def ? def[0] : ITEM_DA_TELA[tela] ? EmConstrucao : NaoEncontrada;
  const migalhas = def ? def[1](param) : ITEM_DA_TELA[tela] ? [[ITEM_DA_TELA[tela].menu], [ITEM_DA_TELA[tela].rotulo]] : [["Não encontrada"]];
  // key: trocar de registro (#/proposta/941 → /942) recria a tela do zero.
  return (
    <Layout sessao={sessao} tela={tela} migalhas={migalhas}>
      {erro ? <Caixa titulo="Não consegui carregar o LIMS"><p className="aviso ruim">{erro}</p><button type="button" className="btn btn-primary" onClick={recarregar}>Tentar de novo</button></Caixa>
        : carregando ? <Caixa titulo="Carregando"><p className="suave" style={{ margin: 0 }}>Carregando os dados do LIMS…</p></Caixa>
        : <Tela key={`${tela}/${param}`} tela={tela} param={param} sessao={sessao} />}
    </Layout>
  );
}

export default function App() {
  const [sessao, setSessao] = useState(getSessao);
  useEffect(() => aoMudarSessao(() => setSessao(getSessao())), []);
  if (!sessao) return <Login />;
  if (!podeUsarLims(sessao)) {
    return (
      <div className="login"><div className="cartao" style={{ textAlign: "center" }}>
        <h1>MinasLab LIMS</h1>
        <p style={{ margin: 0 }}>O LIMS está em fase piloto e, por enquanto, está liberado só para a direção. A equipe será liberada pelas Permissões de acesso.</p>
        <button type="button" className="btn btn-default" onClick={() => sair()}>Entrar com outro usuário</button>
      </div></div>
    );
  }
  return <AvisoProvider><DadosProvider><Telas sessao={sessao} /></DadosProvider></AvisoProvider>;
}
