// Portado de rh/src/lib/ferias.test.ts (Impresilk) em 27/08/2026 — regras idênticas, campos adaptados à MinasLab.
// "Está de férias hoje" tem que sair das datas, não do texto do status — o
// status é preenchido à mão e envelhece. Os casos abaixo são os reais do banco
// da origem em 31/07/2026, que é quando o defeito apareceu: dois períodos em
// curso ainda escritos como agendados e três já terminados ainda escritos como
// em andamento. Na MinasLab os status "Agendada" e "Em andamento" viram ambos
// "marcada" (único status não-terminal); "Concluída"→"concluida" e
// "Cancelada"→"cancelada". Todos os 6 casos da origem foram portados — nenhum
// caiu. Rodar com TZ=UTC (teste que só passa no fuso de quem escreveu não é
// teste).
import test from "node:test";
import assert from "node:assert/strict";
import { feriasEmCurso } from "./ferias.js";

const HOJE = new Date(2026, 6, 31); // 31/07/2026
const periodo = (inicio, retorno, status) => ({ id: "f", pessoaId: "c", inicio, retorno, status });

test("feriasEmCurso: conta quem está fora agora mesmo que o status ainda diga marcada", () => {
  // Raphael 07/07→06/08 e Daniel 08/07→07/08, ambos gravados como agendados ("marcada").
  assert.equal(feriasEmCurso(periodo("2026-07-07", "2026-08-06", "marcada"), HOJE), true);
  assert.equal(feriasEmCurso(periodo("2026-07-08", "2026-08-07", "marcada"), HOJE), true);
});

test("feriasEmCurso: não conta período já terminado, mesmo ainda marcado como não concluído", () => {
  // Origem: status "Em andamento" envelhecido; equivalente MinasLab é "marcada".
  assert.equal(feriasEmCurso(periodo("2026-06-21", "2026-07-21", "marcada"), HOJE), false);
});

test("feriasEmCurso: não conta período que ainda vai começar", () => {
  assert.equal(feriasEmCurso(periodo("2026-08-10", "2026-09-09", "marcada"), HOJE), false);
});

test("feriasEmCurso: no dia do retorno a pessoa já está de volta", () => {
  assert.equal(feriasEmCurso(periodo("2026-07-01", "2026-07-31", "marcada"), HOJE), false);
  assert.equal(feriasEmCurso(periodo("2026-07-01", "2026-08-01", "marcada"), HOJE), true);
});

test("feriasEmCurso: respeita a decisão de quem lançou — concluida/cancelada não estão de férias", () => {
  assert.equal(feriasEmCurso(periodo("2026-07-07", "2026-08-06", "concluida"), HOJE), false);
  assert.equal(feriasEmCurso(periodo("2026-07-07", "2026-08-06", "cancelada"), HOJE), false);
});

test("feriasEmCurso: sem data de retorno não afirma que a pessoa está fora", () => {
  assert.equal(feriasEmCurso(periodo("2026-07-07", null, "marcada"), HOJE), false);
});
