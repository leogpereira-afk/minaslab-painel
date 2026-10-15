import test from "node:test";
import assert from "node:assert/strict";
import { conferirStatusPagamento } from "./conferenciaStatusPagamento.js";

const E = "emp1";
const os = (o) => ({ id: o.os_numero, empresa_id: E, status_faturamento: "FATURADO", cliente: "Cliente", valor_faturar: 100, numero_nf: "1", ...o });
const tit = (id, status, extra = {}) => ({ id, status, valor_previsto: 100, data_vencimento: "2026-12-31", ...extra });
const quant = (r, id) => r.itens.find((i) => i.id === id).quantidade;

test("título pago e OS VENCIDO vira erro", () => {
  const r = conferirStatusPagamento({ servicos: [os({ os_numero: "A", status_pagamento: "VENCIDO", recebimento_id: "t1" })], recebimentos: [tit("t1", "PAGO")], empresaId: E, hoje: "2026-10-15" });
  assert.equal(quant(r, "pgto-titulo-pago-os-nao"), 1);
  assert.equal(r.erros, 1);
});

test("OS paga com título vencido e com título cancelado", () => {
  const r = conferirStatusPagamento({
    servicos: [os({ os_numero: "A", status_pagamento: "PAGO", recebimento_id: "t1" }), os({ os_numero: "B", status_pagamento: "A RECEBER", recebimento_id: "t2" })],
    recebimentos: [tit("t1", "VENCIDO"), tit("t2", "CANCELADO")], empresaId: E, hoje: "2026-10-15",
  });
  assert.equal(quant(r, "pgto-os-paga-titulo-aberto"), 1);
  assert.equal(quant(r, "pgto-titulo-cancelado"), 1);
});

test("vencida e A RECEBER: usa o vencimento do título (prorrogado não conta)", () => {
  const r = conferirStatusPagamento({
    servicos: [os({ os_numero: "A", status_pagamento: "A RECEBER", recebimento_id: "t1", data_vencimento: "2026-06-01" }), os({ os_numero: "B", status_pagamento: "A RECEBER", recebimento_id: "t2", data_vencimento: "2026-12-01" })],
    recebimentos: [tit("t1", "A RECEBER", { data_vencimento: "2026-11-20" }), tit("t2", "A RECEBER", { data_vencimento: "2026-09-01" })], empresaId: E, hoje: "2026-10-15",
  });
  assert.equal(quant(r, "pgto-vencida-sem-marca"), 1);
  assert.match(r.itens.find((i) => i.id === "pgto-vencida-sem-marca").lista[0].texto, /^B /);
});

test("PAGO sem título e divergência são atenção; cancelada e não faturada ficam de fora", () => {
  const r = conferirStatusPagamento({
    servicos: [
      os({ os_numero: "A", status_pagamento: "PAGO", pagamento_manual: true }),
      os({ os_numero: "B", status_pagamento: "DIVERGENCIA", recebimento_id: "t1" }),
      os({ os_numero: "C", status_pagamento: "CANCELADO" }),
      os({ os_numero: "D", status_pagamento: "AGUARDANDO", status_faturamento: "PRONTO PARA FATURAR" }),
    ],
    recebimentos: [tit("t1", "A RECEBER", { valor_previsto: 90 })], empresaId: E, hoje: "2026-10-15",
  });
  assert.equal(quant(r, "pgto-pago-sem-titulo"), 1);
  assert.equal(quant(r, "pgto-divergencia"), 1);
  assert.equal(r.erros, 0);
  assert.equal(r.atencoes, 2);
  assert.equal(r.totalOs, 3); // A, B e a cancelada C (faturada); a D ainda não foi faturada
});

test("linha agrupada é conferida OS por OS e outra empresa é ignorada", () => {
  const grupo = { id: "g", empresa_id: E, status_faturamento: "FATURADO", grupo_itens: [os({ os_numero: "A", status_pagamento: "VENCIDO", recebimento_id: "t1" }), os({ os_numero: "B", status_pagamento: "PAGO", recebimento_id: "t1" })] };
  const outra = os({ os_numero: "X", status_pagamento: "PAGO", empresa_id: "outra" });
  const r = conferirStatusPagamento({ servicos: [grupo, outra], recebimentos: [tit("t1", "PAGO")], empresaId: E, hoje: "2026-10-15" });
  assert.equal(quant(r, "pgto-titulo-pago-os-nao"), 1);
  assert.equal(r.totalOs, 2);
});

test("tudo certo não gera alerta", () => {
  const r = conferirStatusPagamento({ servicos: [os({ os_numero: "A", status_pagamento: "PAGO", recebimento_id: "t1" })], recebimentos: [tit("t1", "PAGO")], empresaId: E, hoje: "2026-10-15" });
  assert.equal(r.erros + r.atencoes, 0);
});

test("OS com título que não veio na lista não vira 'sem título'", () => {
  const r = conferirStatusPagamento({ servicos: [os({ os_numero: "A", status_pagamento: "PAGO", recebimento_id: "sumido" })], recebimentos: [], empresaId: E, hoje: "2026-10-15" });
  assert.equal(r.erros + r.atencoes, 0);
});
