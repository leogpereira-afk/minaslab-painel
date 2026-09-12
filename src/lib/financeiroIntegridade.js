export function caminhoFinanceiro(path = '') {
  const inicio = path.indexOf('/financas');
  return inicio < 0 ? path : path.slice(inicio);
}
export const operacaoManual = empresa => empresa?.usa_omie === false;

// O histórico importado já contém o valor liquidado. Só usar a data comprovada.
// Baixas existentes, inclusive estornadas, impedem reconstrução duplicada.
export function baixasManuais(titulo, campo) {
  if (String(titulo.origem).toUpperCase() === 'OMIE' || titulo.status === 'CANCELADO') return [];
  if (titulo.baixas?.length) return titulo.baixas.filter(b => !b.estornada);
  const valor = Number(titulo[campo] || 0);
  return valor > 0 ? [{ id: `historico-${titulo.id}`, valor, data_pagamento: titulo.data_pagamento || null, historico: true }] : [];
}
export function pendenciasFinanceiras(recebimentos = [], despesas = [], notas = [], hoje = new Date().toISOString().slice(0,10)) {
  const itens = [];
  const adicionar = (r, tipo, motivo) => itens.push({ id: `${tipo}-${r.id}-${motivo}`, registro: r, tipo, motivo });
  for (const [registros, tipo, campo] of [[recebimentos,'recebimentos','valor_recebido'],[despesas,'despesas','valor_pago']]) {
    for (const r of registros) {
      if (r.status === 'CANCELADO') continue;
      if (baixasManuais(r,campo).some(b=>!b.data_pagamento)) adicionar(r,tipo,'Liquidado sem data de pagamento');
      if (Number(String(r.data_vencimento||'').slice(0,4)) > Number(hoje.slice(0,4))+10) adicionar(r,tipo,'Vencimento improvável: conferir na origem');
      if (!r.categoria_id && !r.categoria_texto) adicionar(r,tipo,'Sem categoria');
    }
  }
  for (const n of notas) if (n.origem !== 'OMIE' && String(n.data_emissao||'').slice(0,10)>hoje) adicionar(n,'notas','Emissão futura: conferir documento');
  const grupos = new Map();
  for (const r of recebimentos) {
    if (!r.numero_nf || r.status === 'CANCELADO') continue;
    const chave = `${r.empresa_id}|${String(r.numero_nf).trim()}`;
    if (!grupos.has(chave)) grupos.set(chave,[]);
    grupos.get(chave).push(r);
  }
  for (const registros of grupos.values()) {
    if (registros.some(r=>r.origem==='OMIE') && registros.some(r=>r.origem!=='OMIE')) {
      for (const r of registros) adicionar(r,'recebimentos','Documento em origens diferentes: comparar parcelas');
    }
  }
  return itens;
}
