// Catálogo único das páginas exibidas em Acessos. As chaves são caminhos reais.
// Páginas financeiras que exigem operações adicionais permanecem visíveis na
// matriz, mas só podem ser atribuídas após autorização também nas suas APIs.
export const GRUPOS_PERMISSOES = [
  { titulo: "Painel", paginas: [["inicio", "Início"], ["calendario", "Calendário"], ["compromissos", "Compromissos"], ["licitacoes", "Licitações"], ["marketing", "Marketing"], ["google-drive", "Google Drive"]] },
  { titulo: "Operação", paginas: [["compras", "Compras"], ["patrimonio", "Patrimônio"], ["manutencoes", "Manutenções"], ["laboratorio", "Laboratório"], ["rh", "RH"], ["ponto", "Ponto"], ["curva-abc", "Curva ABC"]] },
  { titulo: "Finanças", paginas: [["financas/visao-geral", "Visão Geral"], ["financas/servicos-gerados", "Serviços Gerados"], ["financas/receber", "Receber"], ["financas/pagar", "Pagar"], ["financas/bancos", "Bancos"], ["financas/conciliacao", "Conciliação"], ["financas/notas", "Notas"], ["financas/aplicacoes", "Aplicações"], ["financas/socios", "Sócios"], ["financas/conferencia", "Conferência"], ["financas/fluxo-caixa", "Fluxo de Caixa"], ["financas/relatorios", "Relatórios"], ["financas/clientes", "Clientes"], ["financas/configuracoes", "Configurações"]] },
];

// Liberações suportadas de ponta a ponta pelo servidor. Nunca marque uma página
// como concedida se suas chamadas de dados ainda exigem papel de direção.
export const PERMISSOES_DISPONIVEIS = new Set([
  "inicio", "calendario", "compromissos", "licitacoes", "marketing",
  "google-drive", "compras", "manutencoes", "laboratorio",
  "financas/servicos-gerados",
]);
