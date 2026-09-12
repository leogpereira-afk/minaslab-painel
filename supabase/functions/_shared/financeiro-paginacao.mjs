// A página fica abaixo do teto padrão do PostgREST. Nunca devolve totais parciais.
export async function lerTodasPaginas(consultar, tamanho = 500) {
  const itens = [];
  for (let pagina = 0; pagina < 400; pagina++) {
    const inicio = pagina * tamanho;
    const { data, error } = await consultar(inicio, inicio + tamanho - 1);
    if (error) throw new Error(error.message || 'Falha ao consultar os registros.');
    if (!Array.isArray(data)) throw new Error('Resposta incompleta da consulta financeira.');
    itens.push(...data);
    if (data.length < tamanho) return itens;
  }
  throw new Error('Consulta muito extensa. Nenhum total parcial foi apresentado.');
}
