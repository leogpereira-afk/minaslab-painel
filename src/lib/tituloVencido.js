// VENCIDO PELA DATA, NÃO SÓ PELA MARCA (auditoria de 28/09/2026).
//
// A sincronização marca VENCIDO nos títulos da Omie, mas o título lançado à mão continua
// "A PAGAR/A RECEBER" depois do vencimento: nada recalcula o status com o passar dos dias.
// Por isso a marca gravada não serve para dizer o que está vencido.
//
// Regra única, usada pelo painel do Financeiro, pelo selo das listas e pelo filtro "VENCIDO"
// do servidor (ml-financeiro-listas, filtrosBase): título em aberto, com saldo, e vencimento
// antes de hoje em São Paulo. Vencer hoje ainda não é vencido. Sem data, não é vencido.

const EM_ABERTO = new Set(["VENCIDO", "A PAGAR", "A RECEBER", "PARCIAL"]);

export function hojeSaoPaulo(agora = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(agora)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

export function estaVencido(titulo, hojeISO) {
  const status = String(titulo?.status || "").toUpperCase();
  if (!EM_ABERTO.has(status)) return false;
  if (!(Number(titulo?.valor_pendente) > 0)) return false;
  const vencimento = String(titulo?.data_vencimento || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(vencimento) && vencimento < hojeISO;
}

// O que o selo da lista mostra: a marca gravada, trocada por VENCIDO quando a data já passou.
// O parcial vencido continua dizendo que é parcial.
export function statusVisto(titulo, hojeISO) {
  const status = String(titulo?.status || "").toUpperCase();
  if (status === "VENCIDO" || !estaVencido(titulo, hojeISO)) return titulo?.status;
  return status === "PARCIAL" ? "PARCIAL VENCIDO" : "VENCIDO";
}
