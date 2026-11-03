// Banco de horas — regras puras compartilhadas pela Folha e pelo histórico.
// A origem dos lançamentos continua no backend ml-sync/rh_banco_horas_movimentos.
export const minutos = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

export function saldoMovimentos(movimentos = []) {
  return movimentos.reduce((saldo, m) => saldo + minutos(m.credito_minutos) - minutos(m.debito_minutos), 0);
}

export function resumoBanco(movimentos = [], competencia) {
  const anteriores = movimentos.filter((m) => !competencia || String(m.competencia) < String(competencia));
  const doMes = movimentos.filter((m) => !competencia || String(m.competencia) === String(competencia));
  const soma = (lista, campo) => lista.reduce((n, m) => n + minutos(m[campo]), 0);
  const saldoAnterior = saldoMovimentos(anteriores);
  const creditos = soma(doMes, "credito_minutos");
  const debitos = soma(doMes, "debito_minutos");
  return {
    saldoAnterior,
    creditos,
    debitos,
    saldoFinal: saldoAnterior + creditos - debitos,
    movimentos: doMes,
  };
}

export function validarMovimento({ tipo, competencia, dataMovimento, motivo, creditoMinutos = 0, debitoMinutos = 0 }) {
  const erros = [];
  if (!String(tipo || "").trim()) erros.push("Informe o tipo da movimentação.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(competencia || ""))) erros.push("Informe uma competência válida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataMovimento || ""))) erros.push("Informe uma data válida.");
  if (!String(motivo || "").trim()) erros.push("O motivo é obrigatório.");
  const credito = minutos(creditoMinutos);
  const debito = minutos(debitoMinutos);
  if ((credito > 0) === (debito > 0)) erros.push("Informe crédito ou débito, nunca os dois.");
  return erros;
}

export function formatarBanco(totalMinutos) {
  const total = minutos(totalMinutos);
  const sinal = total < 0 ? "-" : "+";
  const absoluto = Math.abs(total);
  return `${sinal}${String(Math.floor(absoluto / 60)).padStart(2, "0")}:${String(absoluto % 60).padStart(2, "0")}`;
}

// Compensação lançada no Ponto: o dia sai do banco de horas. O motivo leva uma marca com a data, e é por ela que
// se sabe o que já foi lançado para o dia: regravar a mesma ausência não debita duas vezes, e tirá-la estorna.
export const marcaCompensacaoPonto = (data) => `[ponto:${data}]`;

/**
 * O que falta lançar no banco para o dia ficar como a ausência manda.
 * `alvoMin` = minutos que o dia deve ter debitados (0 quando a ausência saiu ou mudou de tipo).
 * Devolve { tipo: "debito" | "credito", minutos } ou null quando já está certo.
 */
export function ajusteCompensacaoPonto(movimentos = [], data, alvoMin = 0) {
  const marca = marcaCompensacaoPonto(data);
  const jaDebitado = movimentos
    .filter((m) => String(m.motivo || "").includes(marca))
    .reduce((n, m) => n + minutos(m.debito_minutos) - minutos(m.credito_minutos), 0);
  const diferenca = minutos(alvoMin) - jaDebitado;
  if (diferenca === 0) return null;
  return diferenca > 0 ? { tipo: "debito", minutos: diferenca } : { tipo: "credito", minutos: -diferenca };
}
