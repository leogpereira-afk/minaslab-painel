import test from "node:test";
import assert from "node:assert/strict";
import { setorDoEnsaio, somarSetores } from "./setores.mjs";

test("classifica o ensaio pelo nome e por quem executa", () => {
  assert.equal(setorDoEnsaio("Coliformes Totais P/A", "INTERNO"), "Microbiologia");
  assert.equal(setorDoEnsaio("Escherichia coli - UFC", "INTERNO"), "Microbiologia");
  assert.equal(setorDoEnsaio("Bolores e leveduras", "INTERNO"), "Microbiologia");
  assert.equal(setorDoEnsaio("pH", "INTERNO"), "Físico-química");
  assert.equal(setorDoEnsaio("Materiais Sedimentáveis P/A", "INTERNO"), "Físico-química");
  assert.equal(setorDoEnsaio("pH (In Situ)", "INTERNO"), "Campo");
  assert.equal(setorDoEnsaio("Coliformes Totais P/A", "TERCEIRIZADO"), "Parceiros");
});

test("soma amostras (uma vez por setor) e ensaios por mês", () => {
  const amostras = [{ id: "a1", mes: "2026-09", matriz: "Água" }, { id: "a2", mes: "2026-09", matriz: "Alimento" }, { id: "a3", mes: "2026-08" }];
  const ensaios = [
    { amostra_id: "a1", rotulo: "pH", tipo: "INTERNO" }, { amostra_id: "a1", rotulo: "Turbidez", tipo: "INTERNO" },
    { amostra_id: "a1", rotulo: "Coliformes Totais P/A", tipo: "INTERNO" }, { amostra_id: "a2", rotulo: "Salmonella spp P/A", tipo: "INTERNO" },
    { amostra_id: "x", rotulo: "pH", tipo: "INTERNO" },
  ];
  const r = somarSetores(amostras, ensaios);
  assert.equal(r["2026-09"].total, 2);
  assert.deepEqual(r["2026-09"].porSetor["Físico-química"], { amostras: 1, ensaios: 2 });
  assert.deepEqual(r["2026-09"].porSetor.Microbiologia, { amostras: 2, ensaios: 2 });
  assert.deepEqual(r["2026-09"].porMatriz, { "Água": 1, "Alimento": 1 });
  assert.equal(r["2026-08"].total, 1);
});

test("amostras da MinasLab: só as que têm ensaio feito na casa", () => {
  const r = somarSetores(
    [{ id: "a", mes: "2026-09" }, { id: "b", mes: "2026-09" }, { id: "c", mes: "2026-09" }],
    [
      { amostra_id: "a", rotulo: "Coliformes totais", tipo: "INTERNO" },
      { amostra_id: "a", rotulo: "pH", tipo: "INTERNO" },
      { amostra_id: "b", rotulo: "Metais", tipo: "TERCEIRIZADO" },
      { amostra_id: "c", rotulo: "pH", tipo: "INTERNO" },
      { amostra_id: "c", rotulo: "Dioxinas", tipo: "TERCEIRIZADO" },
    ],
  );
  assert.equal(r["2026-09"].total, 3);
  assert.equal(r["2026-09"].casa, 2); // b só foi para parceiro
});
