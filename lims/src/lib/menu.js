// O menu do LIMS é o do GerenciaLab, na mesma ordem e com os mesmos nomes.
// Cada item é [rótulo, tela, pronto?]. As telas usam os caminhos do
// GerenciaLab (customers, proposedlist...). Item ainda não construído abre
// "Tela em construção". Gestão da qualidade fica por último na construção.
//
// MENU É UMA LISTA SÓ: tela nova entra aqui e em TELAS do App.jsx.

export const MENU = [
  ["Relatórios", [["Relatórios de amostras", "report-sample"], ["Relatórios de centro de custos", "report-cost-center"], ["Dashboard Financeiro", "dashboard-financeiro"]]],
  ["Gestão da qualidade", [["Gestão de não conformidades", "occurrence"], ["Gestão de arquivos", "filemanagement"], ["Amostras Controle de Qualidade", "samples-cq"], ["Carta controle", "carta-controle"], ["Homologação", "homologation"], ["Gestão de Capacitação", "training-management"]]],
  ["Financeiro", [["Contas a receber", "bills-to-receive"], ["Contas a pagar", "bills-to-pay"], ["Fluxo de Caixa", "extract"], ["Notas fiscais de Serviços", "notas-fiscais"], ["Notas fiscais de Entrada", "nota-fiscal-entrada"], ["Centro de custos", "costcenter"]]],
  ["Cadastro", [["Solicitantes", "solicitantes", true], ["Cliente / Fornecedor", "customers", true]]],
  ["Propostas", [["Criar Proposta", "criar-proposta", true], ["Listar Propostas", "proposedlist", true]]],
  ["Contratos", [["Contratos Pendentes", "notification-pedents"], ["Contratos", "contracts"]]],
  ["Ordem serviços", [["Ordem serviços", "service-order"], ["Rastreabilidade", "traceability"]]],
  ["Coletas", [["Logística", "logistics"], ["Coletas", "collections"], ["Agenda", "calendar"], ["Descarte amostras", "discardsamples"]]],
  ["Laboratório", [["Inspeção técnica de amostra", "technical-inspection"], ["Análise por Amostra", "laboratory-order-services"], ["Análise por Parâmetro", "analysis-methods"]]],
  ["Revisão", [["Resultado", "list-revisions-result"], ["Certificado", "list-revisions"]]],
  // Configurações em grupos, como no GerenciaLab ("## " abre um grupo).
  // Ficam de fora de propósito: Configuração Estoque (o painel já tem a
  // Gestão de Estoque), CQ - Configuração e CQ - Não Conformidades.
  ["Configurações", [
    ["## Configurações"],
    ["Configuração do sistema", "configs"], ["Funcionários", "employees"], ["Plano de Amostragem", "configuracao-plano-amostragem"], ["Coleta", "configuracao-coleta"], ["Proposta", "configuracao-proposta"], ["Proposta Análises Críticas", "configuracao-proposta-analise-critica"], ["Áreas de Serviço", "servicearea"], ["Unidade de medida", "configuracao-unidade-de-medida"], ["Inspeção técnica", "configuracao-inspecao-tecnica"], ["Controle de Equipamentos", "equipamentos"], ["Grupo regional", "gruporeginal"], ["Permissões de acesso", "permissoes-de-acesso"], ["Configuração email", "config-email"], ["Configuração Centro de serviços", "config-centro-servico"], ["Auditoria LOG", "auditoria"], ["Whatsapp", "whatsapp"], ["Motivos de Alteração", "reasonschange"], ["Plugins", "plugins"], ["Configuração Email (SMTP)", "listsmtp"], ["Feriados", "holidays"], ["Centro de custo", "config-costcenter"], ["Centro de custo componentes", "config-costcomponents"],
    ["## Configuração Serviços"],
    ["Serviços / Matriz", "servicos-produtos"], ["Legislação Aplicável / Coleta", "lacoleta"], ["Especificação Serviços", "parameters"], ["Resultado Legislação Aplicável", "configuracao-resultado-la"], ["Métodos", "methods"], ["Tabela de preço", "tabela-preco"], ["Pacote de Serviços", "service-package"], ["Configuração Revisão", "config-revisao"], ["Setores", "sector"],
    ["## Configuração Preservante"], ["Preservante", "preservante"],
    ["## Configuração Templates"], ["Modelos", "config-templates"],
    ["## Configuração Subcontratado"], ["Subcontratados", "subcontratados"],
    ["## Configuração financeiro"], ["Configuração NFs", "config-nfs"], ["Configuração forma de pagamento", "config-formapagamento"],
    ["## Configuração Gestão"], ["Formulários de lista de verificação", "formularios-verificacao"], ["Gestão Frequência", "gestao-frequencia"],
  ]],
];

export const ehGrupo = (item) => item[0].startsWith("## ");

export const ITEM_DA_TELA = Object.fromEntries(MENU.flatMap(([menu, itens]) => itens.filter((i) => !ehGrupo(i)).map(([rotulo, tela, pronto]) => [tela, { menu, rotulo, pronto: !!pronto }])));
