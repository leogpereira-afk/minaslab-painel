// Resumos do laboratório usados nos slides automáticos e na ata.
// Regras puras, com testes.

const n = (v) => Number(v) || 0;
const RETRABALHO = "Ensaio repetido (retrabalho)";

/** NCs do mês: total, retrabalho, ainda abertas (de qualquer mês), por tipo e por setor. */
export function resumoNcs(ncs, mes) {
  const doMes = (ncs || []).filter((x) => x.mes === mes);
  const conta = (f) => Object.entries(doMes.reduce((m, x) => { const k = f(x) || "Outro"; m[k] = (m[k] || 0) + 1; return m; }, {})).map(([nome, q]) => ({ nome, n: q })).sort((a, b) => b.n - a.n);
  return {
    total: doMes.length,
    retrabalho: doMes.filter((x) => x.retrabalho || x.tipo === RETRABALHO).length,
    abertas: (ncs || []).filter((x) => x.situacao !== "encerrada" && String(x.mes || "") <= mes).length,
    encerradasNoMes: doMes.filter((x) => x.situacao === "encerrada").length,
    porTipo: conta((x) => x.tipo),
    porSetor: conta((x) => x.setor),
  };
}

/** Produtividade lançada no mês: por pessoa (maior número de ensaios primeiro) e totais. */
export function resumoProdutividade(regs, mes) {
  const pessoas = (regs || []).filter((x) => x.mes === mes && (n(x.ensaios) || n(x.laudos) || n(x.retrabalhos)))
    .map((x) => ({ id: x.pessoaId, nome: x.nome, ensaios: n(x.ensaios), laudos: n(x.laudos), retrabalhos: n(x.retrabalhos) }))
    .sort((a, b) => b.ensaios - a.ensaios);
  const soma = (k) => pessoas.reduce((s, p) => s + p[k], 0);
  const ensaios = soma("ensaios");
  const retrabalhos = soma("retrabalhos");
  return { pessoas, ensaios, laudos: soma("laudos"), retrabalhos, pctRetrabalho: ensaios ? Math.round((retrabalhos / ensaios) * 1000) / 10 : null };
}
