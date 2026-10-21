export const CANAIS_MARKETING = [
  { id: 'ga4', nome: 'Visitas ao site', origem: 'Google Analytics', principal: 'usuarios', destaque: ['usuarios', 'sessoes', 'visualizacoes', 'eventos_chave'], nota: 'Usuários são pessoas ativas no período. Sessões representam visitas, incluindo retornos.' },
  { id: 'search', nome: 'Busca Google', origem: 'Search Console', principal: 'cliques', destaque: ['cliques', 'impressoes', 'ctr', 'posicao'], nota: 'Desempenho nos resultados orgânicos da busca Google.' },
  { id: 'perfil', nome: 'Google Meu Negócio', origem: 'Perfil da Empresa', principal: 'cliques_site', destaque: ['impressoes_busca', 'impressoes_maps', 'ligacoes', 'rotas'], nota: 'Cliques para ligar e solicitações de rota indicam interesse; não comprovam atendimento ou venda.' },
  { id: 'instagram', nome: 'Instagram', origem: '@minaslab_', principal: 'alcance', destaque: ['alcance', 'visualizacoes', 'interacoes', 'toques_links'], nota: 'Alcance vem do total informado pelo Instagram para o período, sem somar alcances diários.' },
  { id: 'google_ads', nome: 'Google Ads', origem: 'Anúncios Google', principal: 'gasto', destaque: ['gasto', 'cliques', 'conversoes', 'custo_conversao'], nota: 'Relatórios da conta vinculada. Conversões seguem a configuração do Google Ads.' },
  { id: 'meta_ads', nome: 'Meta Ads', origem: 'Anúncios Meta', principal: 'gasto', destaque: ['gasto', 'alcance', 'cliques', 'leads'], nota: 'Relatórios da conta vinculada. Leads seguem os eventos atribuídos pela Meta.' },
];
export const ROTULOS_METRICAS = {
  usuarios: 'Usuários ativos', novos_usuarios: 'Novos usuários', sessoes: 'Visitas (sessões)', sessoes_engajadas: 'Sessões engajadas', taxa_engajamento: 'Taxa de engajamento', tempo_engajamento: 'Tempo de engajamento', visualizacoes: 'Visualizações', eventos: 'Eventos', eventos_chave: 'Eventos principais', cliques_whatsapp: 'Cliques no WhatsApp', formularios: 'Formulários', cliques: 'Cliques', impressoes: 'Impressões', ctr: 'Taxa de cliques', posicao: 'Posição média', impressoes_busca: 'Exibições na busca', impressoes_maps: 'Exibições no Maps', cliques_site: 'Cliques no site', ligacoes: 'Cliques para ligar', rotas: 'Solicitações de rota', conversas: 'Conversas', reservas: 'Reservas', alcance: 'Contas alcançadas', visitas_perfil: 'Visitas ao perfil', interacoes: 'Interações', curtidas: 'Curtidas', comentarios: 'Comentários', compartilhamentos: 'Compartilhamentos', salvos: 'Salvamentos', toques_links: 'Toques em links', seguidores: 'Seguidores', novos_seguidores: 'Novos seguidores', deixaram_seguir: 'Deixaram de seguir', gasto: 'Investimento', cpc: 'Custo por clique', conversoes: 'Conversões', custo_conversao: 'Custo por conversão', frequencia: 'Frequência', cpm: 'Custo por mil impressões', leads: 'Leads', custo_lead: 'Custo por lead', nome: 'Nome', dia: 'Data', pageview: 'Visualizações de página', lead: 'Leads', contact: 'Contatos', cliques_saida: 'Cliques de saída', salvamentos: 'Salvamentos', reacoes: 'Reações', visitas: 'Visitas',
};
export const TABELAS_MARKETING = { paginas: 'Páginas', canais: 'Origem das visitas', cidades: 'Cidades', dispositivos: 'Dispositivos', eventos: 'Eventos', consultas: 'Pesquisas no Google', paises: 'Países', termos: 'Termos de pesquisa', conteudos: 'Conteúdos', formatos: 'Formatos', campanhas: 'Campanhas', anuncios: 'Anúncios' };
export const STATUS_MARKETING = { ok: 'Leitura confirmada', parcial: 'Leitura parcial', pendente: 'Aguardando leitura', reconectar: 'Reconectar', sem_permissao: 'Revisar permissão', erro: 'Falha na leitura', aguardando_provedor: 'Aguardando provedor', vinculo_divergente: 'Revisar vínculo', projeto_ads: 'Aguardando acesso Google Ads', renovar: 'Reconectar autorização', coleta: 'Falha na coleta', temporario: 'Serviço indisponível', api_desativada: 'API não ativada', escopo: 'Revisar autorização', permissao: 'Permissão insuficiente', vinculo: 'Revisar vínculo', ativo: 'Selecione uma conta' };
const DINHEIRO = new Set(['gasto', 'cpc', 'cpm', 'custo_conversao', 'custo_lead']);
export function formatarMetrica(chave, valor, moeda) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—';
  if (DINHEIRO.has(chave)) return moeda ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(valor) : valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' (moeda não informada)';
  if (['ctr', 'taxa_engajamento'].includes(chave)) return (valor * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
export const dataMarketing = valor => /^\d{4}-\d{2}-\d{2}$/.test(valor || '') ? valor.split('-').reverse().join('/') : 'Sem data';
export const horaMarketing = valor => valor && Number.isFinite(Date.parse(valor)) ? new Date(valor).toLocaleString('pt-BR') : 'Ainda não coletado';
export const periodoMarketing = p => p ? `${dataMarketing(p.inicio)} a ${dataMarketing(p.fim)}` : 'Sem período disponível';
export function periodoDaFonte(fonte, id = '') {
  if (!['ok', 'parcial'].includes(fonte?.estado)) return null;
  return fonte.periodos?.find(p => p.id === id) || fonte.periodos?.[0] || null;
}
export const provedorDoCanal = id => id === 'google_ads' ? 'google_ads' : ['ga4', 'search', 'perfil'].includes(id) ? 'google' : 'meta';
