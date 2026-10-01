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

// Calibração sem periodicidade cadastrada no bem vale 12 meses.
export const PERIODO_CALIBRACAO_PADRAO = 12;

// 'YYYY-MM-DD' + n meses => 'YYYY-MM-DD'. Dia que não existe no mês de
// destino (31/01 + 1) cai no último dia dele (28 ou 29/02), não em março.
export function somarMeses(ymd, meses) {
  const [a, m, d] = String(ymd).split("-").map(Number);
  if (!a || !m || !d || !Number.isFinite(Number(meses))) return "";
  const alvo = m - 1 + Number(meses);
  const ano = a + Math.floor(alvo / 12);
  const mes = ((alvo % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const p2 = (n) => String(n).padStart(2, "0");
  return `${ano}-${p2(mes + 1)}-${p2(Math.min(d, ultimo))}`;
}

// Bens do patrimônio (mapa id => dados) como alvos de manutenção. Bem baixado
// sai da lista de escolha; o nome leva o código da etiqueta, que é o que está
// colado no equipamento.
export function bensComoAlvos(mapa) {
  return Object.entries(mapa || {})
    .map(([id, b]) => ({
      ...b,
      id,
      nome: [b.codigo, b.nomeGenerico, b.volume].filter(Boolean).join(" · ") || id,
      ativo: b.situacao !== "baixado",
    }))
    .sort((x, y) => String(x.codigo || "").localeCompare(String(y.codigo || ""), "pt-BR", { numeric: true }));
}
