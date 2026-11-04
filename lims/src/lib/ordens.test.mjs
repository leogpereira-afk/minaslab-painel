import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroOS, referenciaAmostra, codigoBarras, statusDaOS, statusInicial, amostrasDosServicos, montarOS, code128, PADROES_CODE128 } from "./ordens.js";

const contrato = () => ({
  id: "ct1", num: 959, ano: 2026, clienteId: "c1", coleta: "MinasLab", grupoRegional: "",
  servicos: [{ sid: "s1", descricao: "Potabilidade", matriz: "Água tratada", legislacao: "Portaria 888", params: [{ id: "pH", nome: "pH", un: "—" }, { id: "tur", nome: "Turbidez", un: "uT", acred: true }] }],
});

test("números no formato do GerenciaLab", () => {
  assert.equal(numeroOS({ num: 1664, ano: 2026 }), "OS01664/2026");
  assert.equal(referenciaAmostra({ num: 4779, ano: 2026 }), "AM00004779/2026");
  assert.equal(codigoBarras(4822), "00000004822");
});

test("status da OS é a etapa mais atrasada das amostras vivas", () => {
  assert.equal(statusDaOS([{ status: "Laboratório" }, { status: "Aguardando Inspeção" }]), "Aguardando Inspeção");
  assert.equal(statusDaOS([{ status: "Cancelado" }, { status: "Laboratório" }]), "Laboratório");
  assert.equal(statusDaOS([{ status: "Cancelado" }]), "Cancelado");
});

test("status inicial: cliente coleta → inspeção; avulsa segue a configuração", () => {
  assert.equal(statusInicial({ coleta: "Cliente" }), "Aguardando Inspeção");
  assert.equal(statusInicial({ coleta: "MinasLab" }), "Aguardando coleta");
  assert.equal(statusInicial({ coleta: "MinasLab" }, {}, true), "Aguardando agendamento");
  assert.equal(statusInicial({ coleta: "MinasLab" }, { statusOsAvulsa: "Status Aguardando coleta" }, true), "Aguardando coleta");
});

test("uma amostra por unidade, com as análises do serviço", () => {
  const a = amostrasDosServicos(contrato(), [{ sid: "s1", qtd: 2 }]);
  assert.equal(a.length, 2);
  assert.deepEqual(a[0].analises.map((x) => [x.pid, x.etapa, x.acred]), [["pH", "Aguardando", false], ["tur", "Aguardando", true]]);
});

test("montar OS usa os números reservados", () => {
  const { os, amostras } = montarOS({ contrato: contrato(), servicos: [{ sid: "s1", qtd: 2 }], numOS: 1664, numsAmostra: [4779, 4780], numsBarra: [4822, 4823], ano: 2026, status: "Aguardando coleta" });
  assert.equal(numeroOS(os), "OS01664/2026");
  assert.equal(os.contrato, "00000959/2026");
  assert.deepEqual(amostras.map((x) => [referenciaAmostra(x), x.barra]), [["AM00004779/2026", "00000004822"], ["AM00004780/2026", "00000004823"]]);
  assert.throws(() => montarOS({ contrato: contrato(), servicos: [], numOS: 1, numsAmostra: [], numsBarra: [], ano: 2026, status: "x" }), /serviço/);
});

test("Code 128: tabela íntegra e dígito verificador", () => {
  assert.equal(PADROES_CODE128.length, 107);
  PADROES_CODE128.slice(0, 106).forEach((p, i) => assert.equal([...p].reduce((s, x) => s + Number(x), 0), 11, `padrão ${i}`));
  // "PJJ123C": 104 + P(48)·1 + J(42)·2 + J(42)·3 + 1(17)·4 + 2(18)·5 + 3(19)·6 + C(35)·7 = 879; 879 mod 103 = 55
  const larguras = code128("PJJ123C");
  const total = larguras.reduce((s, x) => s + x, 0);
  assert.equal(total, 11 * (1 + 7 + 1) + 13);
  const verificador = larguras.slice(6 * 8, 6 * 9).join(""); // 6 larguras por símbolo: início + 7 caracteres, depois o verificador
  assert.equal(verificador, PADROES_CODE128[55]);
  assert.throws(() => code128("ç"), /Code 128/);
});
