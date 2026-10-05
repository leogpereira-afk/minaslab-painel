import test from "node:test";
import assert from "node:assert/strict";
import { valorPorExtenso, lerValor, dataExtenso, dataCurta, horasDecimais, horasHMS, horasTexto, calcularHoraExtra, calcularDescontoDano, somarItens, periodoExtenso, competenciaDe } from "./recibos.js";

test("valor por extenso confere com os recibos de modelo", () => {
  assert.equal(valorPorExtenso(3000), "três mil reais");
  assert.equal(valorPorExtenso(500), "quinhentos reais");
  assert.equal(valorPorExtenso(800), "oitocentos reais");
  assert.equal(valorPorExtenso(1942), "mil novecentos e quarenta e dois reais");
  assert.equal(valorPorExtenso(2500), "dois mil e quinhentos reais");
  assert.equal(valorPorExtenso(2110.29), "dois mil cento e dez reais e vinte e nove centavos");
  assert.equal(valorPorExtenso(470.61), "quatrocentos e setenta reais e sessenta e um centavos");
  assert.equal(valorPorExtenso(707.14), "setecentos e sete reais e quatorze centavos");
  assert.equal(valorPorExtenso(1056.82), "mil e cinquenta e seis reais e oitenta e dois centavos");
  assert.equal(valorPorExtenso(128.24), "cento e vinte e oito reais e vinte e quatro centavos");
  assert.equal(valorPorExtenso(631.51), "seiscentos e trinta e um reais e cinquenta e um centavos");
  assert.equal(valorPorExtenso(208.61), "duzentos e oito reais e sessenta e um centavos");
  assert.equal(valorPorExtenso(289.53), "duzentos e oitenta e nove reais e cinquenta e três centavos");
});

test("valor por extenso nos casos de borda", () => {
  assert.equal(valorPorExtenso(1), "um real");
  assert.equal(valorPorExtenso(100), "cem reais");
  assert.equal(valorPorExtenso(0.01), "um centavo");
  assert.equal(valorPorExtenso(0), "zero reais");
  assert.equal(valorPorExtenso(1000), "mil reais");
  assert.equal(valorPorExtenso(1_000_000), "um milhão de reais");
  assert.equal(valorPorExtenso(12345.67), "doze mil trezentos e quarenta e cinco reais e sessenta e sete centavos");
});

test("lerValor aceita formato brasileiro e americano", () => {
  assert.equal(lerValor("1.234,56"), 1234.56);
  assert.equal(lerValor("R$ 800,00"), 800);
  assert.equal(lerValor("1234.56"), 1234.56);
  assert.equal(lerValor(""), 0);
});

test("datas por extenso e curta", () => {
  assert.equal(dataExtenso("2026-09-03"), "03 de setembro de 2026");
  assert.equal(dataCurta("2026-08-31"), "31/08/2026");
  assert.equal(dataExtenso(""), "");
});

test("horas: conversões", () => {
  assert.ok(Math.abs(horasDecimais("51:40") - 51.6667) < 0.0001);
  assert.ok(Math.abs(horasDecimais("51h40min") - 51.6667) < 0.0001);
  assert.equal(horasDecimais("10"), 10);
  assert.equal(horasTexto("51:40"), "51h40min");
  assert.equal(horasHMS(15.3941), "15:23:39");
});

test("hora extra reproduz os valores impressos no recibo de modelo", () => {
  const r = calcularHoraExtra({ salario: 2300, horasPagas: "40:16" });
  assert.equal(r.horaNormal, 10.45);
  assert.equal(r.horaExtra, 15.68);
  const v = calcularHoraExtra({ salario: 1800, horasPagas: "10:27" });
  assert.equal(v.horaNormal, 8.18);
  assert.equal(v.horaExtra, 12.27);
  assert.equal(v.total, 128.22);
});

test("desconto por danos usa o valor da hora extra", () => {
  const d = calcularDescontoDano({ valorItem: "196,38", frete: "45,00", salario: 2300 });
  assert.equal(d.total, 241.38);
  assert.equal(d.horaNormal, 10.45);
  assert.equal(d.horaExtra, 15.68);
  assert.equal(d.hms, "15:23:39");
});

test("somarItens soma créditos e subtrai descontos", () => {
  assert.equal(somarItens([{ valor: "1800" }, { tipo: "desconto", valor: "126,88" }, { valor: "48" }]), 1721.12);
});

test("período e competência por extenso", () => {
  assert.equal(periodoExtenso("2026-08-01", "2026-08-31"), "01 a 31 de agosto de 2026");
  assert.equal(periodoExtenso("2026-07-15", "2026-08-14"), "15 de julho a 14 de agosto de 2026");
  assert.equal(periodoExtenso("2025-12-01", "2026-01-31"), "01 de dezembro de 2025 a 31 de janeiro de 2026");
  assert.equal(periodoExtenso("", "2026-08-31"), "");
  assert.equal(competenciaDe("2026-08-31"), "agosto de 2026");
});
