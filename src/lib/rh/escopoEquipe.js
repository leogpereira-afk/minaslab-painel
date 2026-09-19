// Classificação informada expressamente pela direção em 19/09/2026.
// Não inferir propriedade por cargo, salário ausente ou dispensa de ponto.
const PROPRIETARIOS_CONFIRMADOS = new Set(['LIDYANE ALVES OLIVEIRA']);
const nomeNormalizado = valor => String(valor || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase();

export function ehProprietario(pessoa) {
  return pessoa?.ehDirecao === true || PROPRIETARIOS_CONFIRMADOS.has(nomeNormalizado(pessoa?.nome));
}

// Recorte de leitura apenas. Cadastro, histórico e vínculos ficam no servidor.
// Filtrar os registros relacionados evita gerar pendências órfãs artificiais.
export function escopoEquipe(dados) {
  const fora = new Set((dados.pessoas || []).filter(ehProprietario).map(p => p.id));
  return {
    ...dados,
    pessoas: (dados.pessoas || []).filter(p => !fora.has(p.id)),
    ...Object.fromEntries(['ferias', 'feedbacks', 'exames', 'vencimentos', 'historico'].map(colecao => [
      colecao, (dados[colecao] || []).filter(r => !fora.has(r.pessoaId)),
    ])),
  };
}
