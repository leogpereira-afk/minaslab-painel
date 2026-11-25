// REGRAS DO PAINEL DO FINANCEIRO (auditoria de 25/11/2026).
//
// - Em aberto: a mesma regra do vencido (src/lib/tituloVencido.js), para os cartões e o
//   "Vencidos" nunca discordarem.
// - Recebido/pago no mês: pela data do dinheiro, como o servidor (ml-financeiro-listas,
//   realizadoR/realizadoD): baixas não estornadas do mês; sem baixas, a data de pagamento.
// - Somas em centavos, como liquidoBanco.
// - Conciliar: só empresas operadas aqui (usa_omie = false); a MinasLab concilia na Omie.
import { EM_ABERTO, estaVencido } from "./tituloVencido.js";
import { operacaoManual } from "./financeiroIntegridade.js";

const centavos = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const somar = (itens, valor) => itens.reduce((s, x) => s + centavos(valor(x)), 0) / 100;
const mesDe = (v) => String(v || "").slice(0, 7);

export function emAberto(titulo) {
  return EM_ABERTO.has(String(titulo?.status || "").toUpperCase()) && Number(titulo?.valor_pendente) > 0;
}

export function totalEmAberto(titulos = []) {
  return somar(titulos.filter(emAberto), (x) => x.valor_pendente);
}

export function realizadoNoMes(titulo, campo, mes) {
  if (String(titulo?.status || "").toUpperCase() === "CANCELADO") return 0;
  if (titulo?.baixas?.length)
    return somar(titulo.baixas.filter((b) => !b.estornada && mesDe(b.data_pagamento) === mes), (b) => b.valor);
  return mesDe(titulo?.data_pagamento) === mes ? Number(titulo?.[campo] || 0) : 0;
}

export function pendentesConciliar(mov = [], empresas = []) {
  const aqui = new Set(empresas.filter(operacaoManual).map((e) => e.id));
  return mov.filter((x) => aqui.has(x.empresa_id) && !x.conciliado && !x.classificacao_bancaria).length;
}

export function resumoPainel({ rec = [], des = [], mov = [], contas = [], empresas = [], hoje }) {
  const mes = hoje.slice(0, 7);
  const rA = rec.filter(emAberto), dA = des.filter(emAberto);
  const doMes = (x) => mesDe(x.data_vencimento) === mes;
  const rMes = rA.filter(doMes), dMes = dA.filter(doMes);
  const rV = rA.filter((x) => estaVencido(x, hoje)), dV = dA.filter((x) => estaVencido(x, hoje));
  const comSaldo = contas.filter((c) => c.saldo_atual != null);
  const pendente = (x) => x.valor_pendente;
  return {
    contas,
    saldo: comSaldo.length ? somar(comSaldo, (c) => c.saldo_atual) : null,
    saldoCompleto: contas.length > 0 && comSaldo.length === contas.length,
    contasSemSaldo: contas.filter((c) => c.saldo_atual == null),
    aReceber: somar(rMes, pendente),
    aPagar: somar(dMes, pendente),
    recebidoMes: somar(rec, (x) => realizadoNoMes(x, "valor_recebido", mes)),
    pagoMes: somar(des, (x) => realizadoNoMes(x, "valor_pago", mes)),
    rMes, dMes, rV, dV,
    vencidos: somar([...rV, ...dV], pendente),
    pendMov: pendentesConciliar(mov, empresas),
  };
}

// Ações que só leem. Qualquer outra (inclusive uma nova) renova a cópia salva no navegador:
// renovar sem precisar só custa uma consulta; deixar de renovar mostra valor velho.
const SO_LEITURA = new Set(["opcoes", "preview", "analisar", "urlAssinada", "testarConexao", "verificarCertificado", "validarDps", "cep", "dashboard"]);
export function acaoAlteraDados(action) {
  const a = String(action || "");
  return !(SO_LEITURA.has(a) || /Listar$|Estado$/.test(a));
}
