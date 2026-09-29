import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '../layouts/AppLayout'
import { Dashboard } from '../pages/Dashboard/Dashboard'
import { ForgotPassword } from '../pages/ForgotPassword/ForgotPassword'
import { Login } from '../pages/Login/Login'
import { ResetPassword } from '../pages/ResetPassword/ResetPassword'
import { NotFound } from '../pages/NotFound/NotFound'
import { ProtectedRoute } from './ProtectedRoute'
import { PermissionRoute } from './PermissionRoute'
import { Atendimentos } from '../pages/Atendimentos/Atendimentos'
import { Leads } from '../pages/Leads/Leads'
import { Clientes } from '../pages/Clientes/Clientes'
import { Contatos } from '../pages/Contatos/Contatos'
import { Oportunidades } from '../pages/Oportunidades/Oportunidades'
import { Propostas } from '../pages/Propostas/Propostas'
import { Contratos } from '../pages/Contratos/Contratos'
import { OrdensServico } from '../pages/OrdensServico/OrdensServicoPainel'
import { Agenda } from '../pages/Agenda/Agenda'
import { AgendaLista } from '../pages/Agenda/AgendaLista'
import { Tarefas } from '../pages/Tarefas/Tarefas'
import { TarefasCadastro } from '../pages/Tarefas/TarefasCadastro'
import { Relatorios } from '../pages/Relatorios/Relatorios'
import { Importacoes } from '../pages/Importacoes/Importacoes'
import { Configuracoes } from '../pages/Configuracoes/Configuracoes'
import { Pipeline } from '../pages/Pipeline/Pipeline'
import { ClienteDetalhe } from '../pages/ClienteDetalhe/ClienteDetalhe'
import { PropostaDetalhe } from '../pages/PropostaDetalhe/PropostaDetalhe'
import { OrdemServicoDetalhe } from '../pages/OrdemServicoDetalhe/OrdemServicoDetalhe'
import { ColetasPainel } from '../pages/Coletas/ColetasPainel'
import { PrimeiroAtendimento } from '../pages/PrimeiroAtendimento/PrimeiroAtendimento'
import { OportunidadeDetalhe } from '../pages/OportunidadeDetalhe/OportunidadeDetalhe'
import { Catalogo } from '../pages/Catalogo/Catalogo'
import { PosVenda } from '../pages/PosVenda/PosVenda'
import { PosVendaVisaoGeral } from '../pages/PosVenda/PosVendaVisaoGeral'
import { PosVendaAcompanhamentos } from '../pages/PosVenda/PosVendaAcompanhamentos'
import { PosVendaNps } from '../pages/PosVenda/PosVendaNps'
import { PosVendaHistorico } from '../pages/PosVenda/PosVendaHistorico'
import { ImportacaoDetalhe } from '../pages/ImportacaoDetalhe/ImportacaoDetalhe'
import { LeadDetalhe } from '../pages/LeadDetalhe/LeadDetalhe'
import { Inteligencia } from '../pages/Inteligencia/Inteligencia'
import { AmostrasParametros } from '../pages/AmostrasParametros/AmostrasParametros'
import { Workflows } from '../pages/Workflows/Workflows'
import { Integracoes } from '../pages/Importacoes/Integracoes'
import { GerenciaLabImportador } from '../pages/Importacoes/GerenciaLabImportador'
import { Auditoria } from '../pages/Auditoria/Auditoria'
import { MeuPerfil } from '../pages/MeuPerfil/MeuPerfil'
import { HomeRedirect } from './HomeRedirect'
import { Licitacoes } from '../pages/Licitacoes/Licitacoes'

function DevDashboardPreview(){ if(!import.meta.env.DEV) return <Navigate to="/login" replace/>; return <AppLayout/> }

export function AppRoutes(){return <Routes>
  <Route path="/login" element={<Login/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ResetPassword/>}/>
  <Route element={<ProtectedRoute/>}><Route element={<AppLayout/>}>
    <Route path="/" element={<HomeRedirect/>}/><Route path="/meu-perfil" element={<MeuPerfil/>}/>
    <Route element={<PermissionRoute anyOf={['crm.read','operational.read']}/>}>
      <Route path="/dashboard" element={<Dashboard/>}/><Route path="/catalogo" element={<Catalogo/>}/><Route path="/relatorios" element={<Relatorios/>}/>
      <Route path="/pos-venda/visao-geral" element={<PosVendaVisaoGeral/>}/><Route path="/pos-venda/clientes-recorrentes" element={<PosVenda/>}/><Route path="/pos-venda/acompanhamentos" element={<PosVendaAcompanhamentos/>}/><Route path="/pos-venda/nps" element={<PosVendaNps/>}/><Route path="/pos-venda/historico" element={<PosVendaHistorico/>}/>
    </Route>
    <Route element={<PermissionRoute anyOf={['crm.read']}/>}>
      <Route path="/licitacoes" element={<Licitacoes/>}/>
      <Route path="/agenda" element={<Agenda/>}/><Route path="/agenda/lista" element={<AgendaLista/>}/><Route path="/pos-venda/calendario" element={<Agenda/>}/><Route path="/coletas" element={<ColetasPainel/>}/><Route path="/primeiro-atendimento" element={<PrimeiroAtendimento/>}/><Route path="/atendimentos" element={<Atendimentos/>}/><Route path="/leads" element={<Leads/>}/><Route path="/leads/:id" element={<LeadDetalhe/>}/><Route path="/clientes" element={<Clientes/>}/><Route path="/clientes/:id" element={<ClienteDetalhe/>}/><Route path="/contatos" element={<Contatos/>}/><Route path="/oportunidades" element={<Oportunidades/>}/><Route path="/oportunidades/:id" element={<OportunidadeDetalhe/>}/><Route path="/pipeline" element={<Pipeline/>}/><Route path="/propostas" element={<Propostas/>}/><Route path="/propostas/:id" element={<PropostaDetalhe/>}/><Route path="/tarefas" element={<Tarefas/>}/><Route path="/tarefas/cadastro" element={<TarefasCadastro/>}/><Route path="/workflows" element={<Workflows/>}/><Route path="/inteligencia" element={<Inteligencia/>}/>
    </Route>
    <Route element={<PermissionRoute anyOf={['operational.read']}/>}>
      <Route path="/contratos" element={<Contratos/>}/><Route path="/ordens-servico" element={<OrdensServico/>}/><Route path="/ordens-servico/:id" element={<OrdemServicoDetalhe/>}/><Route path="/amostras-parametros" element={<AmostrasParametros/>}/><Route path="/pos-venda" element={<Navigate to="/pos-venda/visao-geral" replace/>}/>
    </Route>
    <Route element={<PermissionRoute anyOf={['imports.manage']}/>}>
      <Route path="/integracoes" element={<Integracoes/>}/><Route path="/integracoes/gerencialab" element={<GerenciaLabImportador/>}/><Route path="/importacoes" element={<Importacoes/>}/><Route path="/importacoes/:id" element={<ImportacaoDetalhe/>}/>
    </Route>
    <Route element={<PermissionRoute anyOf={['admin.manage']}/>}><Route path="/configuracoes" element={<Configuracoes/>}/></Route>
    <Route element={<PermissionRoute anyOf={['audit.read']}/>}><Route path="/auditoria" element={<Auditoria/>}/></Route>
  </Route></Route>
  <Route path="/preview" element={<DevDashboardPreview/>}><Route path="dashboard" element={<Dashboard/>}/></Route><Route path="*" element={<NotFound/>}/>
</Routes>}
