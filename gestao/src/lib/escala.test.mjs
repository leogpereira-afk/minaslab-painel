import test from "node:test";
import assert from "node:assert/strict";
import { lerEscala, semanasUteis, mesesComNomes, dataISO } from "./escala.js";

const serie = (iso) => (Date.parse(iso + "T00:00:00Z") - Date.UTC(1899, 11, 30)) / 864e5;
const linhaDatas = (inicio) => [null, ...Array.from({ length: 7 }, (_, i) => serie(new Date(Date.parse(inicio) + i * 864e5).toISOString().slice(0, 10)))];

test("lê nomes e feriados só do próprio mês da aba", () => {
  const abas = {
    "Configurações": [["x"]],
    "Outubro": [
      [], [null, "ESCALA DE HIGIENIZAÇÃO DA CANTINA"], [null, "OUTUBRO 2026"], [],
      [null, "DOMINGO", "SEGUNDA"],
      linhaDatas("2026-09-27"), [null, null, "PESSOA X"],
      linhaDatas("2026-10-11"), [null, null, "FERIADO\nN. Sra. Aparecida", "ALFA", "beta"],
      [], [null, "✔  Limpar a bancada."], [null, "✔  Fazer o café."], [null, "Ambiente limpo é responsabilidade de todos."],
    ],
  };
  const e = lerEscala(abas);
  assert.deepEqual(e.meses["2026-10"].dias, { "2026-10-13": "ALFA", "2026-10-14": "BETA" });
  assert.deepEqual(e.meses["2026-10"].feriados, { "2026-10-12": "N. Sra. Aparecida" });
  assert.equal(e.meses["2026-09"], undefined); // 28/09 da aba de outubro não entra
  assert.deepEqual(e.tarefas, ["Limpar a bancada.", "Fazer o café."]);
  assert.match(e.rodape, /responsabilidade/);
  assert.deepEqual(mesesComNomes(e), ["2026-10"]);
});

test("semanas de segunda a sexta", () => {
  const s = semanasUteis("2026-11");
  assert.deepEqual(s[0], [null, null, null, null, null].map((_, i) => ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"][i]));
  assert.deepEqual(s.at(-1), ["2026-11-30", null, null, null, null]);
  assert.equal(dataISO(serie("2026-12-25")), "2026-12-25");
});
