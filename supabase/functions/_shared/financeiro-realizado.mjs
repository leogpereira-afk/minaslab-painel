// Quanto de um título manual já foi pago/recebido, e em que data.
// Duas fontes: as baixas (Dar baixa na tela) e as conciliações com o banco, que o banco de dados soma em
// valor_conciliado (trigger financeiro_atualizar_status_conciliacao_lancamento). Quando as duas existem é o
// mesmo dinheiro visto duas vezes (ex.: baixa por PIX depois conciliada), então vale a maior, nunca a soma.
// Usado por recalcularRecebimento/recalcularDespesa em ml-financeiro.
const valor = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x * 100) : 0;
};

export function realizadoTitulo({ baixas = [], conciliado = 0, dataAtual = null } = {}) {
  const somaBaixas = baixas.reduce((s, b) => s + valor(b.valor), 0);
  const conc = valor(conciliado);
  if (conc > somaBaixas) return { realizado: conc / 100, data: dataAtual || null };
  const ultima = [...baixas].sort((a, b) => String(b.data_pagamento || "").localeCompare(String(a.data_pagamento || "")))[0];
  return { realizado: somaBaixas / 100, data: ultima?.data_pagamento || null };
}
