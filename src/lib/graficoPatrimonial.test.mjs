import test from "node:test";
import assert from "node:assert/strict";
import {
  mesCurto, mesLongo, moedaCurta, escalaEixo, caminhoBarra, indicesDeRotulo,
  periodosRapidos, periodoAtivo, somasDoHistorico,
} from "./graficoPatrimonial.js";

test("ausência não vira R$ 0: valor vazio, nulo ou texto sai em branco", () => {
  for (const v of [null, undefined, "", "abc", NaN]) assert.equal(moedaCurta(v), "", String(v));
  assert.equal(moedaCurta(0), "R$ 0");
});

test("moeda abreviada para eixo e cartão", () => {
  assert.equal(moedaCurta(171368.82), "R$ 171 mil");
  assert.equal(moedaCurta(1250000), "R$ 1,3 mi");
  assert.equal(moedaCurta(5400), "R$ 5,4 mil");
  assert.equal(moedaCurta(-38793.84), "-R$ 39 mil");
  assert.equal(moedaCurta(576.69), "R$ 576,69", "abaixo de mil, com centavos: não se arredonda para o real");
  assert.equal(moedaCurta(-0.2), "-R$ 0,20");
  assert.equal(moedaCurta(-0.001), "R$ 0", "sem -R$ 0");
});

test("escala pequena: marcas com centavos, sem repetir nem arredondar para o mesmo real", () => {
  assert.equal(moedaCurta(0.5), "R$ 0,50");
  assert.equal(moedaCurta(1), "R$ 1");
  for (const max of [0.01, 0.5, 1, 3]) {
    const e = escalaEixo(0, max);
    const rotulos = e.marcas.map(moedaCurta);
    assert.equal(new Set(e.marcas).size, e.marcas.length, `marcas repetidas em ${max}: ${e.marcas}`);
    assert.equal(new Set(rotulos).size, rotulos.length, `rótulos repetidos em ${max}: ${rotulos}`);
  }
});

test("rótulos de mês", () => {
  assert.equal(mesCurto("2026-09"), "set/26");
  assert.equal(mesLongo("2026-03"), "março de 2026");
  assert.equal(mesCurto("lixo"), "lixo");
});

test("eixo sempre passa pelo zero e cobre os valores com marcas redondas", () => {
  const e = escalaEixo(0, 171368.82);
  assert.equal(e.min, 0);
  assert.ok(e.max >= 171368.82);
  assert.ok(e.marcas.includes(0));
  assert.ok(e.marcas.length >= 3 && e.marcas.length <= 6, e.marcas.join(","));
  const neg = escalaEixo(-12000, 30000);
  assert.ok(neg.min <= -12000 && neg.max >= 30000 && neg.marcas.includes(0));
  const soNeg = escalaEixo(-500, -100);
  assert.equal(soNeg.max, 0, "série só negativa ainda mostra o zero");
});

test("eixo sem variação não quebra (tudo zero ou valor inválido)", () => {
  assert.deepEqual(escalaEixo(0, 0).marcas.slice(0, 1), [0]);
  assert.ok(escalaEixo(0, 0).max > 0);
  assert.ok(escalaEixo(NaN, Infinity).max > 0);
});

test("barra: ponta arredondada, base reta, nada abaixo de meio pixel", () => {
  assert.equal(caminhoBarra(10, 20, 100, 99.8), null);
  assert.equal(caminhoBarra(10, 0, 100, 50), null);
  const sobe = caminhoBarra(10, 20, 100, 40);
  assert.match(sobe, /^M10,100 V44 Q10,40 14,40 H26 Q30,40 30,44 V100 Z$/);
  const desce = caminhoBarra(10, 20, 100, 160);
  assert.match(desce, /^M10,100 V156 Q10,160 14,160 H26 Q30,160 30,156 V100 Z$/);
  const baixa = caminhoBarra(0, 20, 100, 98);
  assert.match(baixa, /Q0,98 2,98/, "raio limitado pela altura da barra");
  assert.match(caminhoBarra(0, 20, 100, 40, false), /^M0,100 V40 Q0,40 0,40 H20/);
});

test("rótulos do eixo não se atropelam e o mês mais recente sempre tem o seu", () => {
  assert.deepEqual([...indicesDeRotulo(5, 100)].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
  const apertado = indicesDeRotulo(30, 12);
  assert.ok(apertado.has(29));
  const ordem = [...apertado].sort((a, b) => a - b);
  for (let i = 1; i < ordem.length; i++) assert.ok((ordem[i] - ordem[i - 1]) * 12 >= 46);
  assert.equal(indicesDeRotulo(0, 10).size, 0);
});

test("atalhos de período a partir do dia local", () => {
  const lista = periodosRapidos("2026-09-28", "2024-02-16");
  const por = Object.fromEntries(lista.map((p) => [p.valor, [p.de, p.ate]]));
  assert.deepEqual(por.mes, ["2026-09-01", "2026-09-28"]);
  assert.deepEqual(por["mes-anterior"], ["2026-08-01", "2026-08-31"]);
  assert.deepEqual(por.ano, ["2026-01-01", "2026-09-28"]);
  assert.deepEqual(por["12m"], ["2025-10-01", "2026-09-28"]);
  assert.deepEqual(por.tudo, ["2024-02-16", "2026-09-28"]);
  assert.equal(periodoAtivo(lista, "2026-01-01", "2026-09-28"), "ano");
  assert.equal(periodoAtivo(lista, "2026-01-02", "2026-09-28"), "");
});

test("atalhos na virada do ano e em fevereiro bissexto", () => {
  const jan = Object.fromEntries(periodosRapidos("2026-01-10", null).map((p) => [p.valor, [p.de, p.ate]]));
  assert.deepEqual(jan["mes-anterior"], ["2025-12-01", "2025-12-31"]);
  assert.deepEqual(jan["12m"], ["2025-02-01", "2026-01-10"]);
  assert.equal(jan.tudo, undefined, "sem início conhecido, não há Tudo");
  const mar = Object.fromEntries(periodosRapidos("2028-03-05", "2027-01-01").map((p) => [p.valor, [p.de, p.ate]]));
  assert.deepEqual(mar["mes-anterior"], ["2028-02-01", "2028-02-29"]);
  assert.equal(periodosRapidos("", null).length, 0);
  assert.equal(periodosRapidos("2026-09-28", "2027-01-01").some((p) => p.valor === "tudo"), false, "início depois de hoje não vira atalho");
});

test("somas do histórico: vazio é null, nunca zero", () => {
  assert.equal(somasDoHistorico("aplicacoes", []), null);
  assert.equal(somasDoHistorico("socios", null), null);
});

test("somas do histórico de aplicações e de sócios", () => {
  const apl = somasDoHistorico("aplicacoes", [
    { mes: "2026-07", aportes: 1000.1, resgates: 0, rendimentos: 0.2, impostos: 0, capital: 1000.1, registros: 2 },
    { mes: "2026-08", aportes: 0, resgates: 300, rendimentos: 0.1, impostos: 0, capital: 700.1, registros: 2 },
  ]);
  assert.deepEqual(apl, { aportes: 1000.1, resgates: 300, rendimentos: 0.3, impostos: 0, registros: 4, desde: "2026-07" });
  const meses = Array.from({ length: 14 }, (_, i) => ({ mes: `2025-${String(i + 1).padStart(2, "0")}`, saidas: i < 2 ? 5000 : 1200, entradas: 0, liquido: 0, acumulado: 0, registros: 1 }));
  meses[13].acumulado = 22000;
  const soc = somasDoHistorico("socios", meses);
  assert.equal(soc.saidas, 2 * 5000 + 12 * 1200);
  assert.equal(soc.liquido, 22000);
  assert.equal(soc.mediaSaidas, 1200, "média dos últimos 12 meses, não do histórico todo");
  assert.equal(soc.mesesDaMedia, 12);
});
