import { test } from "node:test";
import assert from "node:assert/strict";
import { CADASTROS, erroFormulario, estaAtivo, padroes, validadeCalibracao } from "./cadastros.js";
import { MENU, ehGrupo } from "./menu.js";

const secoes = Object.values(CADASTROS).flatMap((d) => d.secoes);
const colecoes = new Set(secoes.map((s) => s.colecao));

test("cada coleção pertence a uma tela só", () => {
  assert.equal(colecoes.size, secoes.length);
});

test("toda coluna existe nos campos (ou é calculada, com _)", () => {
  for (const s of secoes) for (const col of s.colunas) {
    if (col.startsWith("_")) continue;
    assert.ok(s.campos.some((f) => f.c === col), `${s.colecao}: coluna ${col} sem campo`);
  }
});

test("toda referência aponta para um cadastro que existe", () => {
  for (const s of secoes) for (const f of s.campos) {
    if (f.t !== "ref" && f.t !== "refmulti") continue;
    assert.ok(colecoes.has(f.ref.colecao) || ["clientes"].includes(f.ref.colecao), `${s.colecao}.${f.c} → ${f.ref.colecao} não existe`);
    if (f.ref.filtroPor) assert.ok(s.campos.some((x) => x.c === f.ref.filtroPor[0]), `${s.colecao}.${f.c}: filtroPor sem campo`);
  }
});

test("todo cadastro tem item no menu (Configurações ou o menu indicado)", () => {
  for (const [t, def] of Object.entries(CADASTROS)) {
    const menu = MENU.find(([m]) => m === (def.menu || "Configurações"));
    assert.ok(menu && menu[1].filter((i) => !ehGrupo(i)).some((i) => i[1] === t), `${t} fora do menu`);
  }
});

test("formulário: obrigatório, número, e-mail e único", () => {
  const campos = [{ c: "sigla", r: "Sigla", t: "text", obrig: true, unico: true }, { c: "dias", r: "Dias", t: "number" }, { c: "email", r: "E-mail", t: "email" }];
  assert.deepEqual(erroFormulario(campos, { sigla: " " })[0], "sigla");
  assert.match(erroFormulario(campos, { sigla: "mg/L", dias: "x" })[1], /número/);
  assert.match(erroFormulario(campos, { sigla: "mg/L", email: "a@" })[1], /e-mail/);
  assert.match(erroFormulario(campos, { sigla: "MG/L" }, [{ id: "1", sigla: "mg/L" }])[1], /Já existe/);
  assert.equal(erroFormulario(campos, { id: "1", sigla: "mg/L" }, [{ id: "1", sigla: "mg/L" }]), null);
});

test("ativo, padrões e validade da calibração", () => {
  assert.equal(estaAtivo({ status: "Inativo" }), false);
  assert.equal(estaAtivo({ ativo: "Não" }), false);
  assert.equal(estaAtivo({ ativo: "Sim", status: "Ativo" }), true);
  assert.deepEqual(padroes([{ c: "a", padrao: "Sim" }, { c: "b" }]), { a: "Sim" });
  assert.equal(validadeCalibracao({ ultimaCalibracao: "2026-01-31", periodicidade: 12 }), "2027-01-31");
  assert.equal(validadeCalibracao({ ultimaCalibracao: "2026-03-10" }), "");
});
