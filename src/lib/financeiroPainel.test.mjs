import { test } from "node:test";
import assert from "node:assert/strict";
import { emAberto, totalEmAberto, realizadoNoMes, resumoPainel, pendentesConciliar, acaoAlteraDados } from "./financeiroPainel.js";

const HOJE = "2026-11-25";
const MLAB = { id: "m", nome: "M Lab", usa_omie: false };
const MINAS = { id: "n", nome: "MinasLab", usa_omie: true };

test("em aberto: mesma regra do vencido (status em aberto e saldo)", () => {
  assert.equal(emAberto({ status: "A RECEBER", valor_pendente: 10 }), true);
  assert.equal(emAberto({ status: "PARCIAL", valor_pendente: 10 }), true);
  assert.equal(emAberto({ status: "VENCIDO", valor_pendente: 10 }), true);
  assert.equal(emAberto({ status: "PAGO", valor_pendente: 10 }), false);
  assert.equal(emAberto({ status: "CANCELADO", valor_pendente: 10 }), false);
  assert.equal(emAberto({ status: "A PAGAR", valor_pendente: 0 }), false);
});

test("recebido no mês vem da data do pagamento, não do vencimento", () => {
  const pagoEmNovVenceuOut = { status: "PAGO", data_vencimento: "2026-10-20", data_pagamento: "2026-11-03", valor_recebido: 100 };
  const pagoEmOutVenceNov = { status: "PAGO", data_vencimento: "2026-11-20", data_pagamento: "2026-10-30", valor_recebido: 50 };
  assert.equal(realizadoNoMes(pagoEmNovVenceuOut, "valor_recebido", "2026-11"), 100);
  assert.equal(realizadoNoMes(pagoEmOutVenceNov, "valor_recebido", "2026-11"), 0);
});

test("com baixas, soma só as baixas do mês e ignora estornadas", () => {
  const t = {
    status: "PARCIAL", valor_recebido: 300, data_pagamento: null,
    baixas: [
      { valor: 100, data_pagamento: "2026-10-10" },
      { valor: 120, data_pagamento: "2026-11-02" },
      { valor: 80, data_pagamento: "2026-11-05", estornada: true },
    ],
  };
  assert.equal(realizadoNoMes(t, "valor_recebido", "2026-11"), 120);
  assert.equal(realizadoNoMes({ ...t, status: "CANCELADO" }, "valor_recebido", "2026-11"), 0);
});

test("resumo: cartões do mês, vencidos e saldo", () => {
  const rec = [
    { empresa_id: "m", status: "A RECEBER", valor_pendente: 200, data_vencimento: "2026-11-28" },
    { empresa_id: "m", status: "A RECEBER", valor_pendente: 70, data_vencimento: "2026-11-02" },
    { empresa_id: "n", status: "VENCIDO", valor_pendente: 30, data_vencimento: "2026-10-01" },
    { empresa_id: "n", status: "PAGO", valor_pendente: 0, valor_recebido: 40, data_vencimento: "2026-10-30", data_pagamento: "2026-11-01" },
  ];
  const des = [{ empresa_id: "m", status: "A PAGAR", valor_pendente: 15, data_vencimento: "2026-11-10" }];
  const contas = [{ empresa_id: "m", saldo_atual: 1000 }, { empresa_id: "n", saldo_atual: 500 }];
  const r = resumoPainel({ rec, des, mov: [], contas, empresas: [MLAB, MINAS], hoje: HOJE });
  assert.equal(r.aReceber, 270);
  assert.equal(r.rMes.length, 2);
  assert.equal(r.recebidoMes, 40);
  assert.equal(r.rV.length, 2);
  assert.equal(r.dV.length, 1);
  assert.equal(r.vencidos, 70 + 30 + 15);
  assert.equal(r.saldo, 1500);
  assert.equal(r.contasSemSaldo.length, 0);
});

test("resumo: soma em centavos, sem resíduo de ponto flutuante", () => {
  const rec = [0.1, 0.2].map((v) => ({ status: "A RECEBER", valor_pendente: v, data_vencimento: "2026-11-30" }));
  assert.equal(resumoPainel({ rec, des: [], mov: [], contas: [], empresas: [], hoje: HOJE }).aReceber, 0.3);
});

test("resumo: saldo parcial continua aparecendo e aponta as contas sem saldo", () => {
  const contas = [{ id: 1, empresa_id: "m", saldo_atual: 1000 }, { id: 2, empresa_id: "n", saldo_atual: null }];
  const r = resumoPainel({ rec: [], des: [], mov: [], contas, empresas: [MLAB, MINAS], hoje: HOJE });
  assert.equal(r.saldo, 1000);
  assert.equal(r.saldoCompleto, false);
  assert.deepEqual(r.contasSemSaldo.map((c) => c.id), [2]);
  const vazio = resumoPainel({ rec: [], des: [], mov: [], contas: [{ id: 3, saldo_atual: null }], empresas: [], hoje: HOJE });
  assert.equal(vazio.saldo, null);
});

test("conciliar: só movimentos das empresas operadas aqui (a MinasLab concilia na Omie)", () => {
  const mov = [
    { empresa_id: "m", conciliado: false },
    { empresa_id: "m", conciliado: true },
    { empresa_id: "m", conciliado: false, classificacao_bancaria: "TARIFA" },
    { empresa_id: "n", conciliado: false },
  ];
  assert.equal(pendentesConciliar(mov, [MLAB, MINAS]), 1);
});

test("cache: toda ação que não é só de leitura renova a cópia do navegador", () => {
  for (const a of ["recebimentosListar", "opcoes", "omieEstado", "configListar", "preview", "analisar", "urlAssinada", "testarConexao", "verificarCertificado", "validarDps", "cep", "dashboard"])
    assert.equal(acaoAlteraDados(a), false, a);
  for (const a of ["recebimentoSalvar", "recebimentoBaixar", "upload", "emailEnviar", "conciliar", "emitirProducao", "acaoNovaQualquer"])
    assert.equal(acaoAlteraDados(a), true, a);
});

test("total em aberto por empresa ignora pagos e cancelados", () => {
  assert.equal(totalEmAberto([
    { status: "A RECEBER", valor_pendente: 10.1 },
    { status: "VENCIDO", valor_pendente: 0.2 },
    { status: "PAGO", valor_pendente: 0 },
    { status: "CANCELADO", valor_pendente: 99 },
  ]), 10.3);
});
