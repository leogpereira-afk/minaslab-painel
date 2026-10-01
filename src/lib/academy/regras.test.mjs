import test from "node:test";
import assert from "node:assert/strict";
import { mover, formularioDaVersao, duracaoTotalMin, tipoAula, MODALIDADES, novoModulo, novaQuestao, trocarTipoQuestao, diasAte, textoPrazo, linhasCertificado, dataBR } from "./regras.js";

test("mover reordena sem mutar e ignora limites", () => {
  const l = ["a", "b", "c"];
  assert.deepEqual(mover(l, 0, 2), ["b", "c", "a"]);
  assert.deepEqual(l, ["a", "b", "c"]);
  assert.equal(mover(l, 0, -1), l);
  assert.equal(mover(l, 1, 3), l);
});

test("avaliação do gestor e híbrida seguem indisponíveis (próxima etapa)", () => {
  assert.deepEqual(MODALIDADES.filter((m) => m.disponivel).map((m) => m.valor), ["nenhuma", "automatica"]);
});

test("tipo de aula desconhecido cai em texto e cada tipo tem seu campo", () => {
  assert.equal(tipoAula("x").valor, "texto");
  assert.equal(tipoAula("video").campo, "url");
  assert.equal(tipoAula("pratica").campo, "enunciado");
});

test("formulário reflete a versão do servidor e soma durações", () => {
  const f = formularioDaVersao({
    versao: { titulo: "T", descricao: "D", modalidade: "nenhuma", nota_minima: null, max_tentativas: null, obrigatorio: true, prazo_dias: 30, validade_meses: 12, carga_horaria_min: null, exige_qualidade: false, notas_versao: "" },
    modulos: [{ titulo: "M", descricao: null, aulas: [{ titulo: "A", tipo: "texto", conteudo: { texto: "x" }, duracaoMin: 10 }, { titulo: "B", tipo: "video", conteudo: { url: "https://x.com" }, duracaoMin: null }] }],
    materiais: [{ titulo: "Apostila", url: "https://x.com/a.pdf" }],
  });
  assert.equal(f.prazoDias, 30);
  assert.equal(f.notaMinima, "");
  assert.equal(f.modulos[0].aulas.length, 2);
  assert.equal(duracaoTotalMin(f.modulos), 10);
  assert.equal(novoModulo().aulas.length, 1);
});

import { formularioDeModelo } from "./regras.js";
import { readFileSync } from "node:fs";

test("importar modelo: aceita o curso Gestão do Tempo e descarta modalidade indisponível (gestor)", () => {
  const m = JSON.parse(readFileSync(new URL("../../../docs/academy-cursos/gestao-do-tempo.json", import.meta.url), "utf8"));
  const f = formularioDeModelo({ ...m, modalidade: "gestor" }, { titulo: "x" });
  assert.equal(f.titulo, "Gestão do Tempo");
  assert.equal(f.modalidade, "nenhuma");
  assert.equal(f.modulos.length, 5);
});

test("importar modelo: rejeita formato e tipo de aula inválidos", () => {
  assert.throws(() => formularioDeModelo({}, {}), /não é um modelo/);
  assert.throws(() => formularioDeModelo({ modulos: [{ aulas: [{ tipo: "quiz" }] }] }, {}), /não é aceito/);
  assert.throws(() => formularioDeModelo({ modulos: [{}] }, {}), /sem lista de aulas/);
});

test("questões: V/F nasce com 2 opções; trocar tipo mantém 1 correta quando exigido", () => {
  const vf = novaQuestao("vf");
  assert.equal(vf.opcoes.length, 2);
  assert.equal(vf.opcoes.filter((o) => o.correta).length, 1);
  const m = { tipo: "multiplas", enunciado: "x", opcoes: [{ texto: "a", correta: false }, { texto: "b", correta: true }, { texto: "c", correta: true }] };
  const um = trocarTipoQuestao(m, "multipla");
  assert.deepEqual(um.opcoes.map((o) => o.correta), [false, true, false]);
  assert.equal(trocarTipoQuestao(m, "vf").opcoes[0].texto, "Verdadeiro");
  assert.equal(trocarTipoQuestao(vf, "multipla").opcoes.filter((o) => o.correta).length, 1);
});

test("prazos: dias, vencido e texto", () => {
  assert.equal(diasAte("2026-10-31", "2026-10-01"), 30);
  assert.equal(diasAte("2026-09-30", "2026-10-01"), -1);
  assert.equal(diasAte(null, "2026-10-01"), null);
  assert.match(textoPrazo("2026-10-31", "2026-10-01"), /Vence em 30 dias \(31\/10\/2026\)/);
  assert.match(textoPrazo("2026-09-29", "2026-10-01"), /Venceu há 2 dias/);
  assert.match(textoPrazo("2026-10-01", "2026-10-01"), /Vence hoje/);
  assert.equal(textoPrazo(null, "2026-10-01"), "Sem prazo");
  assert.equal(dataBR("2026-10-05"), "05/10/2026");
});

test("certificado: carga horária e nota só quando entregues pelo servidor", () => {
  const base = { pessoa_nome: "Fulano", treinamento_titulo: "Curso", versao_numero: 2, emitido_em: "2026-10-05T15:00:00Z", responsavel_nome: "Resp", codigo: "ML-2026-AAAA1111", carga_horaria_min: null, nota: null };
  const rotulos = (c) => linhasCertificado(c).map(([k]) => k);
  assert.ok(!rotulos(base).includes("Carga horária"));
  assert.ok(!rotulos(base).includes("Nota na avaliação"));
  assert.deepEqual(rotulos({ ...base, carga_horaria_min: 90, nota: 85 }).slice(5, 7), ["Carga horária", "Nota na avaliação"]);
  assert.equal(linhasCertificado(base).at(-1)[1], "ML-2026-AAAA1111");
  assert.equal(linhasCertificado({ ...base, responsavel_nome: "" })[4][1], "—");
});
