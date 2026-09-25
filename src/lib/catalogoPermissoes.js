// Catálogo único das páginas exibidas em Acessos. As chaves são caminhos reais.
// Páginas financeiras que exigem operações adicionais permanecem visíveis na
// matriz, mas só podem ser atribuídas após autorização também nas suas APIs.
export const GRUPOS_PERMISSOES = [
  { titulo: "Painel", paginas: [["inicio", "Início"], ["calendario", "Calendário"], ["compromissos", "Compromissos"], ["licitacoes", "Licitações"], ["marketing", "Marketing"], ["google-drive", "Google Drive"]] },
  { titulo: "Operação", paginas: [["compras", "Compras"], ["patrimonio", "Patrimônio"], ["manutencoes", "Manutenções"], ["laboratorio", "Laboratório"], ["rh", "RH"], ["ponto", "Ponto"], ["curva-abc", "Curva ABC"]] },
  { titulo: "Finanças", paginas: [["financas/visao-geral", "Visão Geral"], ["financas/servicos-gerados", "Serviços Gerados"], ["financas/receber", "Receber"], ["financas/pagar", "Pagar"], ["financas/bancos", "Bancos"], ["financas/conciliacao", "Conciliação"], ["financas/notas", "Notas"], ["financas/aplicacoes", "Aplicações"], ["financas/socios", "Sócios"], ["financas/conferencia", "Conferência"], ["financas/fluxo-caixa", "Fluxo de Caixa"], ["financas/relatorios", "Relatórios"], ["financas/clientes", "Clientes"], ["financas/configuracoes", "Configurações"]] },
];

// Abas de cada módulo, conferidas com as opções de navegação das respectivas
// páginas. Ficam explicitamente separadas do acesso à página: atribuí-las sem
// isolar também as consultas de dados da aba deixaria vazar outras seções.
export const SUBPAGINAS_PERMISSOES = {
  compras: [["estoque", "Estoque"], ["pedidos", "Pedidos"], ["ordens", "Ordens de compra"], ["retiradas", "Retiradas"]],
  patrimonio: [["inventario", "Inventário"], ["setores", "Por setor"], ["pendencias", "Pendências"]],
  rh: [["gestao", "Visão geral"], ["pessoas", "Pessoas"], ["ferias", "Férias"], ["feedback", "Feedback"], ["exames", "Exames"], ["vencimentos", "Vencimentos"], ["relatorios", "Relatórios"]],
  ponto: [["relatorios", "Conferência"], ["ponto", "Ajustes e fechamento"], ["faltas", "Faltas e abonos"], ["analises", "Relatórios"], ["folha", "Folha mensal"]],
  "curva-abc": [["clientes", "Clientes"], ["produtos", "Serviços"], ["vendedores", "Vendedores"]],
  "financas/notas": [["emitir", "Emitir NFS-e"], ["cancelar", "Cancelar NFS-e"], ["importar-historico", "Importar histórico"]],
  "financas/configuracoes": [["categorias", "Categorias"], ["contas", "Contas bancárias"], ["centros", "Centros de custo"], ["formas", "Formas de pagamento"], ["plano-contas", "Plano de contas"], ["omie", "Integração Omie"]],
};

// Liberações suportadas de ponta a ponta pelo servidor. Nunca marque uma página
// como concedida se suas chamadas de dados ainda exigem papel de direção.
export const PERMISSOES_DISPONIVEIS = new Set([
  "inicio", "calendario", "compromissos", "licitacoes", "marketing",
  "google-drive", "compras", "compras/estoque", "compras/pedidos",
  "compras/ordens", "compras/retiradas", "patrimonio",
  "patrimonio/inventario", "patrimonio/setores", "patrimonio/pendencias",
  "curva-abc", "curva-abc/clientes", "curva-abc/produtos", "curva-abc/vendedores",
  "manutencoes", "laboratorio",
  "financas/servicos-gerados",
]);
