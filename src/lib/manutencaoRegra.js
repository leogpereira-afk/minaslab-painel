// A regra da "próxima manutenção por alvo" — num lugar só, de propósito.
// Ela decide o número na Home, o evento no Calendário e a Seção 1 de
// Manutenções; em três cópias ela divergiu: cada manutenção FEITA guarda a
// "proxima" que valia quando foi gravada, e quem lê o campo solto conta prazo
// que uma manutenção mais nova do mesmo alvo já superou (lista copiada falha
// calada).
//
// A regra: para cada alvo (alvoTipo + alvoId), vale APENAS a "proxima" da
// manutenção FEITA mais recente que tem "proxima" marcada. Agendadas têm a
// própria data e não passam por aqui; filtrar alvo ativo é conta de quem
// chama — o cadastro (carros/equipamentos) mora com ele.

export const chaveAlvo = (alvoTipo, alvoId) => `${alvoTipo}|${alvoId}`;

// => Map de chaveAlvo(alvoTipo, alvoId) para a manutenção feita mais recente
// com "proxima" marcada daquele alvo — a única cuja "proxima" ainda vale.
export function proximasPorAlvo(manutencoes) {
  const porAlvo = new Map();
  for (const m of manutencoes) {
    if (m.status !== "feita" || !m.proxima) continue;
    const chave = chaveAlvo(m.alvoTipo, m.alvoId);
    const atual = porAlvo.get(chave);
    // Empate de data mantém a primeira vista — o mesmo desempate do sort
    // estável que a tela de Manutenções sempre usou.
    if (!atual || String(m.data || "").localeCompare(String(atual.data || "")) > 0) {
      porAlvo.set(chave, m);
    }
  }
  return porAlvo;
}
