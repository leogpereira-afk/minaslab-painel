// Treinamentos de uma pessoa: as aplicações registradas em que ela esteve
// presente. A pessoa pode ter sido marcada pelo cadastro da equipe (id da
// equipe) ou pela lista geral da MinasLab (id do RH): as duas contam.
export function treinamentosDaPessoa(registros, membro) {
  if (!membro) return [];
  const ids = new Set([membro.id, membro.rhPessoaId].filter(Boolean));
  const out = [];
  for (const r of registros || []) {
    const p = (r.participantes || []).find((x) => x.presente !== false && (ids.has(x.pessoaId) || (x.rhPessoaId && ids.has(x.rhPessoaId))));
    if (p) out.push({ id: r.id, data: r.data, trilhaId: r.trilhaId, titulo: r.titulo || "", nota: p.nota ?? null, obs: r.obs || "", instrutor: r.instrutor || "" });
  }
  return out.sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

/**
 * Lista para marcar presença: primeiro a equipe do setor, depois todos os
 * colaboradores ativos do RH que não estão nela. Cada um com o id que deve
 * ser gravado e o id do RH (para aparecer no perfil em qualquer setor).
 */
export function pessoasParaTreinamento(equipe, elenco) {
  const ligados = new Set((equipe || []).map((m) => m.rhPessoaId).filter(Boolean));
  const daEquipe = (equipe || []).map((m) => ({ id: m.id, nome: m.nome, rhPessoaId: m.rhPessoaId || "", daEquipe: true }));
  const outros = (elenco || []).filter((p) => !ligados.has(p.id)).map((p) => ({ id: p.id, nome: p.nome, rhPessoaId: p.id, daEquipe: false }));
  return [...daEquipe, ...outros.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))];
}

/** Nota mínima no teste para o treinamento valer (e liberar o certificado). */
export const NOTA_MINIMA = 7;

/** Nota de 0 a 10. Registros antigos podem estar em 0–100: esses viram 0–10. */
export function notaDe(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return null;
  const v = Number(n);
  return v > 10 ? Math.round(v) / 10 : v;
}
export const fmtNota = (n) => { const v = notaDe(n); return v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 1 : 0, maximumFractionDigits: 1 }); };

/** Média das notas da aplicação (0 a 10) ou null. */
export function mediaNotas(participantes) {
  const ns = (participantes || []).filter((p) => p.presente !== false).map((p) => notaDe(p.nota)).filter((n) => n != null);
  return ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : null;
}

/** Certificado liberado: esteve presente e, se fez teste, atingiu a nota mínima. */
export function aprovado(p) {
  if (!p || p.presente === false) return false;
  const n = notaDe(p.nota);
  return n == null || n >= NOTA_MINIMA;
}
