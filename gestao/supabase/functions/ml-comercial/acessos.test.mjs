import test from "node:test";
import assert from "node:assert/strict";
import * as acessos from "./acessos.mjs";
import { permissoes, podeLer, podeGravar, podeAcao, colecaoDe, limparSetores, conteudoAssinado } from "./acessos.mjs";

test("dona vê tudo; quem não foi liberado não vê nada", () => {
  const dona = permissoes("ana", null);
  assert.equal(dona.admin, true);
  assert.ok(podeLer(dona, "laboratorio", "ncs"));
  assert.ok(podeAcao(dona, "resumo"));
  const ninguem = permissoes("fulano", null);
  assert.equal(ninguem.admin, false);
  assert.equal(podeLer(ninguem, "comercial", "equipe"), false);
  assert.equal(podeAcao(ninguem, "resumo"), false);
});

test("página libera só as próprias coleções; base é leitura", () => {
  const lider = permissoes("lab1", { setores: { laboratorio: ["lab", "ncs"] } });
  assert.ok(podeLer(lider, "laboratorio", "ncs"));
  assert.ok(podeGravar(lider, "laboratorio", "ncs"));
  assert.ok(podeLer(lider, "laboratorio", "equipe"));          // base: lê
  assert.equal(podeGravar(lider, "laboratorio", "equipe"), false); // mas não grava
  assert.equal(podeLer(lider, "laboratorio", "avaliacoes"), false); // avaliação não liberada
  assert.equal(podeLer(lider, "comercial", "equipe"), false);   // outro setor
  assert.ok(podeAcao(lider, "labPainel"));
  assert.equal(podeAcao(lider, "resumo"), false);
  assert.equal(podeAcao(lider, "pesquisaCriar"), false);
});

test("destaque libera votação e convites; reunião só lista votação", () => {
  const d = permissoes("x", { setores: { comercial: ["destaque"] } });
  assert.ok(podeAcao(d, "pesquisaCriar"));
  assert.ok(podeAcao(d, "conviteCriar"));
  const r = permissoes("y", { setores: { laboratorio: ["reunioes"] } });
  assert.ok(podeAcao(r, "pesquisaListar"));
  assert.equal(podeAcao(r, "pesquisaCriar"), false);
});

test("coleções por setor e compartilhadas", () => {
  assert.equal(colecaoDe("comercial", "equipe"), "rh_comercial_equipe");
  assert.equal(colecaoDe("laboratorio", "equipe"), "rh_lab_equipe");
  assert.equal(colecaoDe("laboratorio", "destaque"), "rh_comercial_destaque");
});

test("limpeza e assinatura estável", () => {
  assert.deepEqual(limparSetores({ laboratorio: ["ncs", "inventada", "ncs"], marte: ["x"] }), { laboratorio: ["ncs"] });
  assert.equal(conteudoAssinado("u", { laboratorio: ["ncs", "lab"] }), conteudoAssinado("u", { laboratorio: ["lab", "ncs"] }));
  assert.notEqual(conteudoAssinado("u", { laboratorio: ["lab"] }), conteudoAssinado("u", { laboratorio: ["lab", "ncs"] }));
});

test("laboratório nunca lê números comerciais do CRM", () => {
  const { PAGINAS } = acessos;
  const tudoLab = permissoes("lab", { setores: { laboratorio: PAGINAS.laboratorio.map((p) => p.id) } });
  for (const a of ["resumo", "cockpit", "carteira", "funil", "semResponsavel", "nps", "licitacoes"]) assert.equal(podeAcao(tudoLab, a), false, a);
  assert.ok(podeAcao(tudoLab, "labPainel"));
  assert.ok(podeAcao(tudoLab, "setores"));
});
