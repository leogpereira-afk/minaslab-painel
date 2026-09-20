// Compare the full record, including joined settlements and bank reconciliation.
function canonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonico).sort().join(',')}]`;
  if (valor && typeof valor === 'object') return `{${Object.keys(valor).sort().map(k => `${JSON.stringify(k)}:${canonico(valor[k])}`).join(',')}}`;
  return JSON.stringify(valor);
}
export async function respostaDelta(itens, conhecidos) {
  if (!conhecidos || typeof conhecidos !== 'object' || Array.isArray(conhecidos)) throw new Error('Mapa de sincronização inválido.');
  const hashes = Object.create(null), alterados = [];
  for (const item of itens) {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonico(item)))), b => b.toString(16).padStart(2, '0')).join('');
    hashes[item.id] = hash;
    if (conhecidos[item.id] !== hash) alterados.push(item);
  }
  return { delta: true, itens: alterados, hashes, cobertura: { completa: true, registros: itens.length } };
}
