import { test } from "node:test";
import assert from "node:assert/strict";
import { diasPagamento, faturaPorOS, faturaDaOS, amostrasDaFatura, faturaDaAmostra } from "./faturas.js";

test("prazo pela condição de pagamento", () => {
  assert.equal(diasPagamento("Boleto bancário, 10 dias"), 10);
  assert.equal(diasPagamento("Pix ou a vista - 1 dia"), 1);
  assert.equal(diasPagamento("Cartão de Credito"), 30);
});

test("fatura nasce com a OS (uma por OS), salvo parcelado", () => {
  const contrato = { id: "k1", condicoes: "Boleto bancário, 10 dias", servicos: [{ sid: "s1", qtd: 2, params: [{ id: "p1", preco: 30 }, { id: "p2", preco: 20 }] }] };
  const am = [{ id: "a1", num: 1, ano: 2026, sid: "s1", os: "OS00001/2026", status: "Aguardando coleta" }, { id: "a2", num: 2, ano: 2026, sid: "s1", os: "OS00001/2026", status: "Cancelado" }];
  const f = faturaDaOS({ os: { id: "o1", clienteId: "c1", contrato: "00000001/2026" }, amostras: am, contrato, hoje: new Date(2026, 10, 12) });
  assert.equal(f.valor, 50);
  assert.deepEqual(f.amostraIds, ["a1"]);
  assert.equal(f.venc, "2026-11-22");
  assert.equal(f.status, "Em aberto");
  assert.equal(faturaPorOS({}, contrato), true);
  assert.equal(faturaPorOS({}, { ciclo: "Parcelado" }), false);
  assert.equal(faturaPorOS({ sistemaFaturamento: "Não" }, contrato), false);
  const dados = { amostras: am, contas_receber: [{ id: "f1", ...f }] };
  assert.deepEqual(amostrasDaFatura(dados, dados.contas_receber[0]).map((a) => a.id), ["a1"]);
  assert.equal(faturaDaAmostra(dados, am[0]).id, "f1");
});
