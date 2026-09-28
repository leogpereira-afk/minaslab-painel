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

test("atestado parcial pago pelo relógio: a conta contra o dia cheio mostra o que faltou", () => {
  // 1h14 de batida + 4h de atestado pagas pelo relógio = 5h14 na folha, contra 8h
  const d = jibble({ trabalhadoMin: 314, trackedMin: 74, pausaMin: 0, horasAtestadoMin: 240, ausencia: { tipo: "atestado" } });
  assert.equal(extraDoDia(d), 0, "era 5h14 de extra antes do conserto");
  assert.equal(saldoDoDia(d), -166, "2h46 sem cobertura (a revisão pegou o 0 que o teste antigo fixava)");
});

test("atestado de 1h pago pelo relógio e 9h de batida: +2h, não zero", () => {
  const d = jibble({ trabalhadoMin: 600, trackedMin: 540, pausaMin: 0, horasAtestadoMin: 60, ausencia: { tipo: "atestado" } });
  assert.equal(saldoDoDia(d), 120);
  assert.equal(extraDoDia(d), 120);
});

test("folga lançada, mas a pessoa trabalhou o dia: a hora conta como normal, igual ao Fechamento", () => {
  const d = jibble({ trabalhadoMin: 480, trackedMin: 540, pausaMin: 60, ausencia: { tipo: "folga" } });
  assert.equal(normaisDoDia(d), 480, "as 8h aparecem, não somem da folha");
  assert.equal(saldoDoDia(d), 0);
  const aMais = jibble({ trabalhadoMin: 600, trackedMin: 660, pausaMin: 60, ausencia: { tipo: "folga" } });
  assert.equal(extraDoDia(aMais), 120, "o que passa do dia cheio é extra");
});

test("abono lançado no painel num dia com batida curta: nunca vira falta", () => {
  // sem horasAtestadoMin não se sabe o tamanho do abono
  const d = { data: "2026-09-29", entrada: "08:00", saida: "12:00", pausaMin: 0, ausencia: { tipo: "atestado" } };
  assert.equal(saldoDoDia(d), 0);
  assert.equal(extraDoDia(d), 0);
});

test("atestado de dia inteiro: as colunas fecham (pagas = normais + extras)", () => {
  const d = jibble({ trabalhadoMin: 480, trackedMin: 0, horasAtestadoMin: 480, ausencia: { tipo: "atestado" } });
  assert.equal(minutosDaFolha(d), 480);
  assert.equal(normaisDoDia(d) + extraDoDia(d), 480, "antes: 480 pagas, 0 normais, 0 extras");
  assert.equal(saldoDoDia(d), 0);
});

test("anotar o documento do atestado no painel (corrigido) não muda a conta do dia", () => {
  const base = { trabalhadoMin: 314, trackedMin: 74, pausaMin: 0, horasAtestadoMin: 240, ausencia: { tipo: "atestado" } };
  const anotado = jibble({ ...base, corrigido: true });
  assert.equal(minutosDaFolha(anotado), 314, "as 4h pagas continuam na coluna de horas pagas");
  assert.equal(saldoDoDia(anotado), saldoDoDia(jibble(base)), "era 0 depois de anotar, e −2h46 antes");
  assert.equal(saldoDoDia(anotado), -166);
});

test("atestado de dia inteiro anotado: sem batida, o total gravado vale uma vez só", () => {
  const semTracked = jibble({ trabalhadoMin: 480, horasAtestadoMin: 480, corrigido: true, ausencia: { tipo: "atestado" } });
  assert.equal(minutosDaFolha(semTracked), 480, "não soma o pago duas vezes");
  const trackedZero = jibble({ trabalhadoMin: 480, trackedMin: 0, horasAtestadoMin: 480, corrigido: true, ausencia: { tipo: "atestado" } });
  assert.equal(minutosDaFolha(trackedZero), 480);
  assert.equal(saldoDoDia(trackedZero), 0);
});

test("linha criada para dia sem registro não entra em conta nenhuma", () => {
  const d = { id: "vazio_2026-09-29", data: "2026-09-29" };
  assert.equal(saldoDoDia(d), 0, "era −8h na linha e na semana, e o mês não contava");
  assert.equal(extraDoDia(d), 0);
  assert.equal(normaisDoDia(d), 0);
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
