// O menu do LIMS é o do GerenciaLab, na mesma ordem e com os mesmos nomes.
// Cada item é [rótulo, tela, pronto?]. As telas usam os caminhos do
// GerenciaLab (customers, proposedlist...). Item ainda não construído abre
// "Tela em construção".
//
// MENU É UMA LISTA SÓ: tela nova entra aqui e em TELAS do App.jsx.

export const MENU = [
  ["Relatórios", [["Relatórios de amostras", "report-sample", true], ["Relatórios de centro de custos", "report-cost-center", true], ["Dashboard Financeiro", "dashboard-financeiro", true]]],
  ["Financeiro", [["Contas a receber", "bills-to-receive", true]]],
  ["Cadastro", [["Solicitantes", "solicitantes", true], ["Cliente / Fornecedor", "customers", true]]],
  ["Propostas", [["Criar Proposta", "criar-proposta", true], ["Listar Propostas", "proposedlist", true]]],
  ["Contratos", [["Contratos Pendentes", "notification-pedents", true], ["Contratos", "contracts", true]]],
  ["Ordem serviços", [["Ordem serviços", "service-order", true], ["Rastreabilidade", "traceability", true]]],
  ["Coletas", [["Logística", "logistics", true], ["Coletas", "collections", true], ["Agenda", "calendar", true], ["Descarte amostras", "discardsamples", true]]],
  ["Laboratório", [["Inspeção técnica de amostra", "technical-inspection", true], ["Análise por Amostra", "laboratory-order-services", true], ["Análise por Parâmetro", "analysis-methods", true]]],
  ["Revisão", [["Resultado", "list-revisions-result", true], ["Certificado", "list-revisions", true]]],
  // Configurações em grupos, como no GerenciaLab ("## " abre um grupo).
  // Ficam de fora de propósito: Configuração Estoque (o painel já tem a
  // Gestão de Estoque), CQ - Configuração e CQ - Não Conformidades.
  ["Configurações", [
    ["## Configurações"],
    ["Configuração do sistema", "configs", true], ["Funcionários", "employees", true], ["Plano de Amostragem", "configuracao-plano-amostragem", true], ["Coleta", "configuracao-coleta", true], ["Proposta", "configuracao-proposta", true], ["Proposta Análises Críticas", "configuracao-proposta-analise-critica", true], ["Áreas de Serviço", "servicearea", true], ["Unidade de medida", "configuracao-unidade-de-medida", true], ["Inspeção técnica", "configuracao-inspecao-tecnica", true], ["Controle de Equipamentos", "equipamentos", true], ["Grupo regional", "gruporeginal", true], ["Permissões de acesso", "permissoes-de-acesso", true], ["Configuração email", "config-email", true], ["Configuração Centro de serviços", "config-centro-servico", true], ["Auditoria LOG", "auditoria", true], ["Whatsapp", "whatsapp", true], ["Motivos de Alteração", "reasonschange", true], ["Plugins", "plugins", true], ["Configuração Email (SMTP)", "listsmtp", true], ["Feriados", "holidays", true], ["Centro de custo", "config-costcenter", true], ["Centro de custo componentes", "config-costcomponents", true],
    ["## Configuração Serviços"],
    ["Serviços / Matriz", "servicos-produtos", true], ["Legislação Aplicável / Coleta", "lacoleta", true], ["Especificação Serviços", "parameters", true], ["Resultado Legislação Aplicável", "configuracao-resultado-la", true], ["Métodos", "methods", true], ["Tabela de preço", "tabela-preco", true], ["Pacote de Serviços", "service-package", true], ["Configuração Revisão", "config-revisao", true], ["Setores", "sector", true], ["Escopo de acreditação", "escopo-acreditacao", true],
    ["## Configuração Preservante"], ["Preservante", "preservante", true],
    ["## Configuração Templates"], ["Modelos", "config-templates", true],
    ["## Configuração Subcontratado"], ["Subcontratados", "subcontratados", true],
    ["## Configuração financeiro"], ["Configuração NFs", "config-nfs", true], ["Configuração forma de pagamento", "config-formapagamento", true],
    ["## Configuração Gestão"], ["Formulários de lista de verificação", "formularios-verificacao", true], ["Gestão Frequência", "gestao-frequencia", true],
  ]],
];

export const ehGrupo = (item) => item[0].startsWith("## ");

export const ITEM_DA_TELA = Object.fromEntries(MENU.flatMap(([menu, itens]) => itens.filter((i) => !ehGrupo(i)).map(([rotulo, tela, pronto]) => [tela, { menu, rotulo, pronto: !!pronto }])));
