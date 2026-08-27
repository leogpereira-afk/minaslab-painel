// Portado de rh/src/lib/completudeCadastro.test.ts (Impresilk) em 27/08/2026 —
// regras idênticas, campos adaptados à MinasLab. Rodar com TZ=UTC (o script
// npm test já fixa).
/* A % DE PREENCHIMENTO DA FICHA.
 *
 * O que estes testes protegem: a porcentagem sozinha engana. Uma média simples
 * dos campos daria % alta para quem está sem CPF — e a direção leria "quase
 * pronto" numa ficha que não admite ninguém. Por isso os campos têm peso e o
 * essencial faltando estoura a cor independentemente do número.
 *
 * CASOS DA ORIGEM QUE CAÍRAM (e por quê):
 * - os 3 do bloco "campos que só valem para alguns" (filhos/qtdFilhos): a
 *   ficha MinasLab não tem campo condicional — filhos/qtdFilhos não existem e
 *   não têm equivalente. O mecanismo `soSe` foi portado no código, mas sem
 *   campo que o use não há caso real para testar.
 * - o bloco "pontos fortes e de melhoria" foi ADAPTADO (não caiu): pontosFortes
 *   e pontosMelhoria não existem na MinasLab; o caso virou o mesmo teste sobre
 *   a CNH, o complementar que existe aqui — a regra testada é a mesma
 *   (complementar ausente não trava nada).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  completudeDaFicha, preenchido, tomDaCompletude, CAMPOS_FICHA,
} from "./completudeCadastro.js";

const cheia = () => {
  const c = {};
  for (const campo of CAMPOS_FICHA) c[campo.chave] = "x";
  c.salario = 2000;
  return c;
};

describe("preenchido", () => {
  it("vazio, nulo e só espaço não contam", () => {
    assert.equal(preenchido(""), false);
    assert.equal(preenchido("   "), false);
    assert.equal(preenchido(null), false);
    assert.equal(preenchido(undefined), false);
    assert.equal(preenchido([]), false);
  });

  it("zero não conta — salário 0 é ficha incompleta, não salário zero", () => {
    assert.equal(preenchido(0), false);
  });

  it('FALSE conta — "não tem CNH" é resposta, não lacuna', () => {
    assert.equal(preenchido(false), true);
  });

  it("objeto só conta se tiver algo dentro", () => {
    assert.equal(preenchido({ nome: "", telefone: "" }), false);
    assert.equal(preenchido({ nome: "Maria", telefone: "" }), true);
  });
});

describe("a porcentagem", () => {
  it("ficha cheia dá 100 e nada faltando", () => {
    const r = completudeDaFicha(cheia());
    assert.equal(r.pct, 100);
    assert.deepEqual(r.faltam, []);
    assert.equal(r.essenciaisOk, true);
  });

  it("ficha vazia dá 0", () => {
    assert.equal(completudeDaFicha({}).pct, 0);
  });

  it("essencial pesa mais que complementar", () => {
    // Na origem o complementar era a foto; na MinasLab é a CNH.
    const semCpf = { ...cheia(), cpf: "" };
    const semCnh = { ...cheia(), cnh: "" };
    assert.ok(completudeDaFicha(semCpf).pct < completudeDaFicha(semCnh).pct);
  });

  it("SEM CPF a cor é vermelha mesmo com % alta", () => {
    /* É o caso que motivou o peso: sem isto, % alta com CPF faltando apareceria
       verde e ninguém iria atrás. A origem exigia pct > 90 (ficha de ~25
       campos); a ficha MinasLab tem 9, então um essencial a menos pesa mais na
       porcentagem — aqui dá 86%. A regra testada é a mesma: número alto, cor
       vermelha. */
    const r = completudeDaFicha({ ...cheia(), cpf: "" });
    assert.ok(r.pct > 80);
    assert.equal(r.faltamEssenciais, 1);
    assert.equal(tomDaCompletude(r), "ruim");
  });

  it("conta quantos essenciais faltam, não só se falta", () => {
    // Na origem o 3º essencial vazio era matriculaEsocial (não existe na
    // MinasLab); aqui é a admissão.
    const r = completudeDaFicha({ ...cheia(), cpf: "", salario: 0, admissao: "" });
    assert.equal(r.faltamEssenciais, 3);
  });

  it("diz QUAIS campos faltam, com o rótulo que a pessoa lê", () => {
    const r = completudeDaFicha({ ...cheia(), contatoEmergencia: null });
    assert.deepEqual(r.faltam.map((f) => f.rotulo), ["Contato de emergência"]);
  });
});

describe("a cor", () => {
  it("verde só com todos os essenciais e 90% ou mais", () => {
    assert.equal(tomDaCompletude(completudeDaFicha(cheia())), "bom");
  });
  it("amarelo quando falta coisa, mas nada essencial", () => {
    // Na origem caíam 4 importantes (email, telefone, endereço, CEP); a
    // MinasLab só tem 3 importantes, então caem telefone e contato de
    // emergência — o suficiente para ficar abaixo de 90% sem essencial faltando.
    const r = completudeDaFicha({ ...cheia(), telefone: "", contatoEmergencia: "" });
    assert.equal(r.essenciaisOk, true);
    assert.equal(tomDaCompletude(r), "atencao");
  });
});

describe("o complementar (CNH)", () => {
  // Adaptado da origem "os pontos fortes e de melhoria": mesma regra,
  // campo complementar que a MinasLab tem.
  it("entra na conta como complementar — ausência não trava nada", () => {
    const r = completudeDaFicha({ ...cheia(), cnh: "" });
    assert.equal(r.essenciaisOk, true);
    assert.ok(r.pct < 100);
    assert.deepEqual(r.faltam.map((f) => f.rotulo), ["CNH"]);
  });
});
