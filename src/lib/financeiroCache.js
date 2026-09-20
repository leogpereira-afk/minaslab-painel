export function aplicarDelta(anterior = { itens: [], hashes: {} }, resposta) {
  if (resposta?.cobertura?.completa !== true || !Array.isArray(resposta.itens)) throw new Error('A consulta financeira está incompleta. Os dados salvos foram preservados.');
  if (!resposta.delta) return { itens: resposta.itens, hashes: {} };
  const hashes = resposta.hashes;
  if (!hashes || typeof hashes !== 'object') throw new Error('Resposta de atualização inválida.');
  const mapa = new Map(anterior.itens.map(item => [String(item.id), item]));
  for (const item of resposta.itens) mapa.set(String(item.id), item);
  const itens = Object.keys(hashes).map(id => {
    if (!mapa.has(id)) throw new Error('A cópia local precisa ser atualizada novamente.');
    return mapa.get(id);
  });
  if (itens.length !== resposta.cobertura.registros) throw new Error('Quantidade de lançamentos divergente.');
  return { itens, hashes };
}

// One commit only after every list has succeeded. A partial refresh never replaces the snapshot.
export async function sincronizarCopia(anterior, consultar) {
  const nomes = ['recebimentosListar', 'despesasListar', 'notasListar', 'movimentosListar'];
  const respostas = await Promise.all(nomes.map(nome => consultar(nome, { conhecidos: anterior?.listas?.[nome]?.hashes || {} })));
  const opcoes = await consultar('opcoes', {});
  const listas = Object.fromEntries(nomes.map((nome, i) => [nome, aplicarDelta(anterior?.listas?.[nome], respostas[i])]));
  return { versao: 1, listas, opcoes, atualizadoEm: new Date().toISOString() };
}
