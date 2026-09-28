import test from "node:test";
import assert from "node:assert/strict";
import { minutosDaFolha, previstoDoDia, diaAbonado, normaisDoDia, extraDoDia, saldoDoDia } from "./folhaMensal.js";

// 29/09/2026 é terça (previsto 8h); 02/10/2026 é sexta (previsto 7h).
const jibble = (extra) => ({ data: "2026-09-29", origem: "jibble", ...extra });

test("O DEFEITO: atestado de dia inteiro NÃO vira 8h de hora extra", () => {
  // o relógio informa as 8h PAGAS do atestado em trabalhadoMin
  const d = jibble({ trabalhadoMin: 480, ausencia: { tipo: "atestado" } });
  assert.equal(minutosDaFolha(d), 480, "a coluna de horas pagas continua mostrando o que o relógio pagou");
  assert.equal(extraDoDia(d), 0, "era 480 antes do conserto");
  assert.equal(saldoDoDia(d), 0, "era +480 no banco de horas");
  assert.equal(diaAbonado(d), true);
});

test("atestado parcial: nem extra nem crédito", () => {
  const d = jibble({ trabalhadoMin: 314, ausencia: { tipo: "atestado" } }); // 1h14 + 4h pagas
  assert.equal(extraDoDia(d), 0, "era 5h14 de extra");
  assert.equal(saldoDoDia(d), 0);
});

test("atestado lançado no painel, sem horas do relógio, também não vira falta", () => {
  const d = { data: "2026-09-29", ausencia: { tipo: "atestado" } };
  assert.equal(minutosDaFolha(d), 0);
  assert.equal(saldoDoDia(d), 0, "neutro: previsto cheio aqui daria −8h");
});

test("férias, folga e justificada seguem a mesma regra de abono", () => {
  for (const tipo of ["ferias", "folga", "justificada"]) {
    const d = jibble({ trabalhadoMin: 480, ausencia: { tipo } });
    assert.equal(extraDoDia(d), 0, tipo);
    assert.equal(saldoDoDia(d), 0, tipo);
  }
});

test("FALTA continua descontando — o conserto não abona o que não é abonado", () => {
  const d = { data: "2026-09-29", ausencia: { tipo: "falta" } };
  assert.equal(diaAbonado(d), false);
  assert.equal(previstoDoDia(d), 480);
  assert.equal(saldoDoDia(d), -480);
});

test("dia comum: a conta de antes continua igual", () => {
  const cheio = jibble({ trabalhadoMin: 480 });
  assert.equal(extraDoDia(cheio), 0);
  assert.equal(saldoDoDia(cheio), 0);
  const comExtra = jibble({ trabalhadoMin: 540 });
  assert.equal(extraDoDia(comExtra), 60);
  assert.equal(saldoDoDia(comExtra), 60);
  assert.equal(normaisDoDia(comExtra), 480);
  const curto = jibble({ trabalhadoMin: 420 });
  assert.equal(extraDoDia(curto), 0);
  assert.equal(saldoDoDia(curto), -60);
});

test("sexta tem previsto de 7h", () => {
  const d = { data: "2026-10-02", origem: "jibble", trabalhadoMin: 480 };
  assert.equal(previstoDoDia(d), 420);
  assert.equal(extraDoDia(d), 60);
});

test("feriado trabalhado continua sendo extra (regra própria, não é abono)", () => {
  const d = jibble({ trabalhadoMin: 240, feriado: true });
  assert.equal(diaAbonado(d), false);
  assert.equal(extraDoDia(d), 240);
});

test("dia em aberto não conta horas", () => {
  assert.equal(minutosDaFolha(jibble({ trabalhadoMin: 480, emAberto: true })), 0);
});
