import test from "node:test";
import assert from "node:assert/strict";
import { diasProporcionais, salarioProporcional, ajudaDeCusto, camposDaFichaPeloHolerite, minutosAPagar, empresaPagadora, linhaDaFolha, saldoBancoAte, situacaoHolerite, totaisDaFolha, valorHoraExtra, vinculoDe, distribuirRelatorio } from "./folhaPagamento.js";

// Dados FICTÍCIOS — este repositório é público.
const clt = { id: "p1", nome: "MARIA TESTE DA SILVA", tipoContrato: "CLT", salario: "2200", kmIda: 5, kmVolta: 5, veiculo: "Moto" };

test("vínculo e empresa que paga", () => {
  assert.equal(vinculoDe(clt), "CLT");
  assert.equal(vinculoDe({ vinculo: "PRO LABORE" }), "Pró-labore");
  assert.equal(vinculoDe({ tipoContrato: "Prestador", vinculo: "PJ" }), "Contrato");
  assert.equal(empresaPagadora(clt), "M Lab");
  assert.equal(empresaPagadora({ vinculo: "PRO LABORE" }, { "0424": {} }), "MinasLab", "a empresa do holerite");
  assert.equal(empresaPagadora({ ...clt, empresaPagadora: "MinasLab" }), "MinasLab", "a ficha manda");
});

test("hora extra 50%: banco × salário/220 × 1,5, só liberada e só saldo positivo", () => {
  assert.equal(valorHoraExtra(600, 2200, true), 150); // 10h × 10 × 1,5
  assert.equal(valorHoraExtra(600, 2200, false), 0);
  assert.equal(valorHoraExtra(-120, 2200, true), 0);
});

test("ajuda de custo como na planilha (moto 35 km/l, arredonda para cima)", () => {
  assert.equal(ajudaDeCusto(clt, 6.66, 21), 40); // 10 km ÷ 35 × 6,66 × 21 = 39,96
  assert.equal(ajudaDeCusto({ kmIda: 3, kmVolta: 3 }, "6,66", 21), 24);
  assert.equal(ajudaDeCusto(clt, 6.66, 0), 0);
  assert.equal(ajudaDeCusto({}, 6.66, 21), 0);
});

test("banco de horas no fim do mês: dias do Ponto + lançamentos manuais", () => {
  const pontoDia = [
    { pessoaId: "p1", data: "2026-10-05", origem: "jibble", entrada: "08:00", saida: "18:30", trackedMin: 630, pausaMin: 60 }, // 9h30 em segunda: +30
    { pessoaId: "p1", data: "2026-11-02", origem: "jibble", entrada: "08:00", saida: "19:00", trackedMin: 660, pausaMin: 60 }, // fora do mês
  ];
  const movimentos = [{ pessoa_id: "p1", data_movimento: "2026-10-10", credito_minutos: 0, debito_minutos: 20, origem: "MANUAL" }];
  assert.equal(saldoBancoAte("p1", "2026-10", pontoDia, movimentos), 10);
});

test("holerite: confere, divergência de salário, aguardando, contrato sem holerite", () => {
  assert.equal(situacaoHolerite(clt, { "0423": { salarioBase: 2200, confere: true } }, "CLT").situacao, "confere");
  const div = situacaoHolerite(clt, { "0423": { salarioBase: 2500, confere: true } }, "CLT");
  assert.equal(div.situacao, "divergencia");
  assert.match(div.avisos[0], /ficha .*2\.200,00.*holerite .*2\.500,00/);
  assert.equal(situacaoHolerite(clt, { "0423": { salarioBase: 2202.26, confere: true } }, "CLT").situacao, "confere", "arredondamento de horas");
  assert.equal(situacaoHolerite(clt, {}, "CLT").situacao, "aguardando");
  assert.equal(situacaoHolerite({}, {}, "Contrato").situacao, "nao_se_aplica");
  assert.equal(situacaoHolerite(clt, { "0423": { confere: false } }, "CLT").situacao, "leitura");
});

test("linha da folha CLT: líquido do holerite pela M Lab, extras pela MinasLab, encargos 1,7", () => {
  const l = linhaDaFolha({
    ficha: clt, competencia: "2026-10",
    registro: { heLiberada: true, ajustes: [{ valor: 49, motivo: "reembolso exame" }], holerites: { "0423": { liquido: 2000, salarioBase: 2200, confere: true, fgts: 176 } } },
    mes: { gasolina: 6.66 },
    pontoDia: [{ pessoaId: "p1", data: "2026-10-05", origem: "jibble", entrada: "08:00", saida: "18:00", trackedMin: 600, pausaMin: 0 }], // +60 min
    comissoes: [{ tipo: "pagamento", nome: "Maria Silva", colaboradorId: "c1", folha: "2026-10", total: 100 }],
    fichas: [clt],
  });
  assert.equal(l.paga, "M Lab");
  assert.equal(l.pagarMLab, 2000);
  assert.equal(l.he, 15); // 1h × 10 × 1,5
  assert.equal(l.ajuda, 2); // 1 dia: 10/35 × 6,66 = 1,90 → 2
  assert.equal(l.comissao, 100);
  assert.equal(l.totalMinasLab, 166); // 15 + 2 + 100 + 49
  assert.equal(l.total, 2166);
  assert.equal(l.comEncargos, 2200 * 1.7 + 166);
});

test("linha de contrato: sem encargos, salário pela MinasLab, sem banco de horas", () => {
  const l = linhaDaFolha({ ficha: { id: "p2", nome: "X", tipoContrato: "Prestador", salario: 2500 }, competencia: "2026-10" });
  assert.equal(l.totalMinasLab, 2500);
  assert.equal(l.comEncargos, 2500);
  assert.equal(l.bancoMin, null);
  assert.equal(l.holerite.situacao, "nao_se_aplica");
  assert.equal(totaisDaFolha([l]).total, 2500);
});

test("distribuir o relatório pelas fichas e listar quem não foi encontrado", () => {
  const r = distribuirRelatorio({ tipo: "eventos", empresa: { codigo: "0423", nome: "E" }, pessoas: [{ cadastro: "7", nome: "Maria Teste da Silva", liquido: 10, eventos: [] }, { cadastro: "8", nome: "Ninguém Daqui", liquido: 5, eventos: [] }] }, [clt]);
  assert.deepEqual(Object.keys(r.porPessoa), ["p1"]);
  assert.deepEqual(r.naoEncontrados, ["Ninguém Daqui"]);
});

test("hora extra parcial: paga só as horas escolhidas, nunca mais que o saldo", () => {
  assert.equal(minutosAPagar(600, { heLiberada: true }), 600);
  assert.equal(minutosAPagar(600, { heLiberada: true, horasPagarMin: 240 }), 240);
  assert.equal(minutosAPagar(600, { heLiberada: true, horasPagarMin: 900 }), 600);
  assert.equal(minutosAPagar(600, { heLiberada: false, horasPagarMin: 240 }), 0);
});

test("bônus, comissão manual e ajuda fixa entram no total da MinasLab", () => {
  const l = linhaDaFolha({
    ficha: { id: "p3", nome: "Y", tipoContrato: "Prestador", salario: 1000, kmIda: 5, kmVolta: 5 }, competencia: "2026-10",
    registro: { bonus: [{ valor: 800, motivo: "8 coletas" }], comissaoManual: [{ valor: 99, motivo: "venda direta" }], ajudaFixa: 50 },
    mes: { gasolina: 6.66 },
  });
  assert.equal(l.bonus, 800);
  assert.equal(l.comissao, 99);
  assert.equal(l.ajuda, 50);
  assert.equal(l.totalMinasLab, 1949);
});

test("o relatório alimenta a ficha: salário de mês cheio corrige, mês quebrado não", () => {
  const cheio = { cadastro: "3", eventos: [{ descricao: "Horas Normais", referencia: 220, valor: 2500 }] };
  const r = camposDaFichaPeloHolerite({ salario: "1800" }, cheio, "0423");
  assert.deepEqual(r.campos, { cadastroFolha: "3", empresaPagadora: "M Lab", salario: "2500" });
  assert.equal(r.mudancas.length, 3);
  const quebrado = { cadastro: "9", eventos: [{ descricao: "Horas Normais", referencia: 212.4, valor: 1740 }] };
  assert.equal(camposDaFichaPeloHolerite({ salario: "1621", cadastroFolha: "9", empresaPagadora: "M Lab" }, quebrado, "0423").campos.salario, undefined);
  assert.deepEqual(camposDaFichaPeloHolerite({ salario: "2500", cadastroFolha: "3", empresaPagadora: "M Lab" }, cheio, "0423").campos, {}, "nada a mudar");
  assert.equal(camposDaFichaPeloHolerite({ salario: "1500" }, { ...cheio, rescisao: true }, "0423").campos.salario, undefined, "rescisão não ensina salário");
});

test("salário proporcional: 1.700 por 10 dias = 566,67 (mês comercial de 30)", () => {
  assert.equal(salarioProporcional(1700, 10), 566.67);
  assert.equal(salarioProporcional(1700, null), 1700);
  assert.equal(diasProporcionais({ admissao: "2026-10-21" }, "2026-10"), 10);
  assert.equal(diasProporcionais({ admissao: "2026-09-21" }, "2026-10"), null, "entrou antes: mês cheio");
  assert.equal(diasProporcionais({ desligadoEm: "2026-10-10" }, "2026-10"), 10);
  assert.equal(diasProporcionais({ admissao: "2026-10-01" }, "2026-10"), null);
  const ficha = { id: "p4", nome: "Z", tipoContrato: "Prestador", salario: 1700 };
  const l = linhaDaFolha({ ficha, competencia: "2026-10", registro: { diasPagar: 10, bonus: [{ valor: 100, motivo: "x" }] } });
  assert.equal(l.salarioMes, 566.67);
  assert.equal(l.extras, 100);
  assert.equal(l.total, 666.67);
  const clt10 = linhaDaFolha({ ficha: { ...clt, admissao: "2026-10-21" }, competencia: "2026-10" });
  assert.equal(clt10.diasPagar, 10);
  assert.equal(clt10.comEncargos, 1246.66, "encargos sobre o proporcional (733,33 × 1,7)");
});
