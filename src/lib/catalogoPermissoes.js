// Catálogo único das páginas exibidas em Acessos. As chaves são caminhos reais.
// Páginas financeiras que exigem operações adicionais permanecem visíveis na
// matriz, mas só podem ser atribuídas após autorização também nas suas APIs.
// Os grupos seguem o menu lateral (Agenda, Operação, Negócios, Administração) e
// trazem TODOS os menus do painel (pedido da Ana, 05/11/2026). Alguns não se
// marcam aqui: veja PAGINAS_DE_TODOS, PAGINAS_SO_DIRECAO e PAGINAS_COM_ACESSO_PROPRIO.
export const GRUPOS_PERMISSOES = [
  { titulo: "Agenda", paginas: [["inicio", "Início"], ["canais", "Canais MinasLab"], ["tarefas", "Tarefas"], ["mensagens", "Mensagens"], ["calendario", "Calendário"], ["compromissos", "Compromissos"]] },
  { titulo: "Operação", paginas: [["compras", "Compras"], ["gestao-estoque", "Gestão de Estoque"], ["patrimonio", "Patrimônio"], ["manutencoes", "Manutenções"], ["laboratorio", "Laboratório"], ["lims", "MinasLab LIMS"]] },
  { titulo: "Negócios", paginas: [["licitacoes", "Licitações"], ["marketing", "Marketing"], ["crm", "CRM"], ["gestao", "Gestão"], ["curva-abc", "Curva ABC"]] },
  { titulo: "Administração", paginas: [["google-drive", "Google Drive"], ["rh", "RH"], ["folha-pagamento", "Folha de Pagamento"], ["ponto", "Ponto"], ["acessos", "Acessos"]] },
  { titulo: "Finanças", paginas: [["financas/visao-geral", "Visão Geral"], ["financas/servicos-gerados", "Serviços Gerados"], ["financas/receber", "Receber"], ["financas/pagar", "Pagar"], ["financas/bancos", "Bancos"], ["financas/conciliacao", "Conciliação"], ["financas/notas", "Notas"], ["financas/aplicacoes", "Aplicações"], ["financas/socios", "Sócios"], ["financas/conferencia", "Conferência"], ["financas/fluxo-caixa", "Fluxo de Caixa"], ["financas/relatorios", "Relatórios"], ["financas/clientes", "Clientes"], ["financas/configuracoes", "Configurações"]] },
];

// Menus que todo mundo do painel já tem (não dependem de liberação).
export const PAGINAS_DE_TODOS = new Set(["canais", "tarefas", "mensagens"]);
// Menus que ficam só com a direção, sem como liberar (quem tem Acessos libera tudo para todos).
export const PAGINAS_SO_DIRECAO = new Set(["acessos"]);
// Menus com tela de acessos própria: aqui só aparece onde liberar.
export const PAGINAS_COM_ACESSO_PROPRIO = { gestao: "Liberado na tela Acessos da própria Gestão (por setor e página)." };


// Abas de cada módulo, conferidas com as opções de navegação das respectivas
// páginas. Ficam explicitamente separadas do acesso à página: atribuí-las sem
// isolar também as consultas de dados da aba deixaria vazar outras seções.
export const SUBPAGINAS_PERMISSOES = {
  "gestao-estoque": [["dashboard", "Dashboard"], ["cadastro-insumo", "Cadastro de insumos"], ["entrada-lote", "Entrada de estoque"], ["retirada-baixa", "Saída / baixa"], ["fornecedores", "Fornecedores"], ["etiquetas", "Etiquetas"], ["relatorios", "Relatórios"], ["configuracoes", "Configurações"], ["pedido-compra", "Pedido de compra"]],
  compras: [["estoque", "Estoque"], ["pedidos", "Pedidos"], ["ordens", "Ordens de compra"], ["retiradas", "Retiradas"]],
  patrimonio: [["inventario", "Inventário"], ["setores", "Por setor"], ["pendencias", "Pendências"]],
  rh: [["gestao", "Visão geral"], ["pessoas", "Pessoas"], ["ferias", "Férias"], ["feedback", "Feedback"], ["exames", "Exames"], ["vencimentos", "Vencimentos"], ["relatorios", "Relatórios"]],
  ponto: [["relatorios", "Conferência"], ["ponto", "Ajustes e fechamento"], ["faltas", "Faltas e abonos"], ["analises", "Relatórios"], ["folha", "Folha mensal"]],
  "curva-abc": [["clientes", "Clientes"], ["produtos", "Serviços"], ["vendedores", "Vendedores"]],
  laboratorio: [["inicio", "Início"], ["entradas", "Entradas de amostras"], ["qualidade", "Qualidade"], ["microbiologia", "Microbiologia"], ["fisicoquimico", "Físico-Químico"]],
  "financas/notas": [["emitir", "Emitir NFS-e"], ["cancelar", "Cancelar NFS-e"], ["importar-historico", "Importar histórico"]],
  "financas/configuracoes": [["categorias", "Categorias"], ["contas", "Contas bancárias"], ["centros", "Centros de custo"], ["formas", "Formas de pagamento"], ["plano-contas", "Plano de contas"], ["omie", "Integração Omie"]],
};

// Liberações suportadas de ponta a ponta pelo servidor. Nunca marque uma página
// como concedida se suas chamadas de dados ainda exigem papel de direção.
export const PERMISSOES_DISPONIVEIS = new Set([
  "inicio", "calendario", "compromissos", "licitacoes", "marketing",
  "google-drive", "crm", "compras", "gestao-estoque", "gestao-estoque/dashboard", "gestao-estoque/cadastro-insumo", "gestao-estoque/entrada-lote", "gestao-estoque/retirada-baixa", "gestao-estoque/fornecedores", "gestao-estoque/etiquetas", "gestao-estoque/relatorios", "gestao-estoque/configuracoes", "gestao-estoque/pedido-compra", "compras/estoque", "compras/pedidos",
  "compras/ordens", "compras/retiradas", "patrimonio",
  "patrimonio/inventario", "patrimonio/setores", "patrimonio/pendencias",
  "curva-abc", "curva-abc/clientes", "curva-abc/produtos", "curva-abc/vendedores",
  "manutencoes", "laboratorio", "laboratorio/inicio", "laboratorio/entradas", "laboratorio/qualidade", "laboratorio/microbiologia", "laboratorio/fisicoquimico",
  "financas/servicos-gerados",
  // MinasLab LIMS inteiro (o servidor ml-lims confere esta liberação ao vivo).
  "lims",
  // RH (todas as abas, menos a Folha de Pagamento), a Folha de Pagamento (aba do RH,
  // exige o RH) e o Ponto. O ml-sync e o ml-ponto conferem ao vivo.
  "rh", "folha-pagamento", "ponto",
]);
