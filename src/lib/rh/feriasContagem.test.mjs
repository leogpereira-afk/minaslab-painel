// Portado de rh/src/lib/feriasContagem.test.ts (Impresilk) em 27/08/2026 —
// mesmos casos, campos adaptados à MinasLab. Rodar com TZ=UTC (o script npm
// test já fixa): teste que só passa no fuso de quem escreveu não é teste.
//
// Casos da origem que CAÍRAM aqui:
// - O bloco inteiro de prazoDeConcessao/limiteDeConcessao (7 casos): ancora em
//   periodoAquisitivoFim, campo que o registro de férias da MinasLab não tem.
// - "Agendada depois de o gozo ter começado" (statusIncoerente): na MinasLab
//   não existe "Em andamento" — "marcada" cobre o gozo em curso, então essa
//   incoerência não existe; o caso virou a asserção contrária (marcada em
//   curso é coerente), dentro de "o que está coerente não vira aviso".
// - Em statusSugerido, a metade "Agendada → Em andamento" de "gozo acontecendo
//   agora" caiu pelo mesmo motivo; a metade "Concluída → Em andamento" virou
//   "concluida" → "marcada".
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contagem, statusIncoerente, statusSugerido, proximaFerias, parseData,
} from "./feriasContagem.js";

/* Datas ancoradas no meio-dia LOCAL. Meia-noite escorrega de dia em fuso à
   frente de UTC, e foi assim que a CI (que roda em UTC) ficou vermelha enquanto
   tudo passava na máquina de quem escreveu. */
const dia = (s) => new Date(`${s}T12:00:00`);

const HOJE = dia("2026-08-04"); // terça

const gozo = (inicio, retorno) => ({ inicio, retorno });

describe("contagem — quanto falta para as férias", () => {
  it("gozo futuro conta os dias que faltam", () => {
    const c = contagem(gozo("2026-08-20", "2026-09-19"), HOJE);
    assert.equal(c.fase, "futuro");
    assert.equal(c.dias, 16);
    assert.equal(c.texto, "Faltam 16 dias");
  });

  it("um dia antes fala em português, não em número", () => {
    assert.equal(contagem(gozo("2026-08-05", "2026-09-04"), HOJE).texto, "Começa amanhã");
  });

  it("o próprio dia do início já é férias, não véspera", () => {
    const c = contagem(gozo("2026-08-04", "2026-09-03"), HOJE);
    assert.equal(c.fase, "em-curso");
    assert.equal(c.dias, 30);
  });

  it("no meio do gozo conta o que falta para voltar", () => {
    const c = contagem(gozo("2026-07-20", "2026-08-19"), HOJE);
    assert.equal(c.fase, "em-curso");
    assert.equal(c.texto, "De férias · volta em 15 dias");
  });

  it("volta amanhã", () => {
    assert.equal(contagem(gozo("2026-07-06", "2026-08-05"), HOJE).texto, "De férias · volta amanhã");
  });

  it("O DIA DO RETORNO já é dia de trabalho — não conta como férias", () => {
    // Regra que o app usa em todo lugar: `retorno` é o dia em que a pessoa
    // volta ao trabalho. Tratar como <= punha de férias quem já estava na mesa.
    const c = contagem(gozo("2026-07-05", "2026-08-04"), HOJE);
    assert.equal(c.fase, "voltou");
    assert.equal(c.texto, "Voltou hoje");
  });

  it("depois do retorno conta há quantos dias voltou", () => {
    const c = contagem(gozo("2026-06-19", "2026-07-19"), HOJE);
    assert.equal(c.fase, "voltou");
    assert.equal(c.dias, 16);
    assert.equal(c.texto, "Voltou há 16 dias");
  });

  it("sem data de gozo não inventa contagem", () => {
    const c = contagem(gozo(null, null), HOJE);
    assert.equal(c.fase, "sem-gozo");
    assert.equal(c.dias, 0);
  });

  it("com início e sem retorno, diz que está de férias sem chutar o fim", () => {
    // O caso "gozo sem dias" da base antiga: início lançado, retorno não.
    const c = contagem(gozo("2026-07-20", null), HOJE);
    assert.equal(c.fase, "em-curso");
    assert.ok(c.texto.includes("retorno não informado"));
  });

  it("RETORNO ANTES DO INÍCIO vira aviso, não número negativo", () => {
    // Já apareceu na tela como "-31 dia(s)".
    const c = contagem(gozo("2026-09-01", "2026-08-01"), HOJE);
    assert.equal(c.fase, "datas-trocadas");
    assert.equal(c.dias, 0);
  });

  it("a resposta não muda com a hora do dia", () => {
    // O bug clássico: subtrair instantes faz "faltam 16" virar "faltam 15"
    // depois do meio-dia. Manhã e noite têm de dar o mesmo número.
    const manha = contagem(gozo("2026-08-20", "2026-09-19"), new Date("2026-08-04T06:00:00"));
    const noite = contagem(gozo("2026-08-20", "2026-09-19"), new Date("2026-08-04T23:30:00"));
    assert.equal(manha.dias, noite.dias);
  });

  it("atravessa a virada do ano sem perder um dia", () => {
    const c = contagem(gozo("2027-01-05", "2027-02-04"), dia("2026-12-26"));
    assert.equal(c.dias, 10);
  });
});

describe("statusIncoerente — quando o status contradiz as datas", () => {
  it("o caso real da origem: gozo com retorno em julho ainda 'marcada'", () => {
    // Na base de origem (04/08/2026), três registros seguiam "Em andamento" com
    // retorno em julho — a tela dizia que três pessoas estavam de férias
    // enquanto trabalhavam. Na MinasLab o análogo é "marcada" que ninguém
    // avançou para "concluida".
    const aviso = statusIncoerente(
      { status: "marcada", inicio: "2026-06-21", retorno: "2026-07-21" },
      HOJE,
    );
    assert.ok(aviso.includes("marcada"));
    assert.ok(aviso.includes("21/07/2026"));
  });

  it("concluida durante o gozo também é contradição", () => {
    assert.ok(
      statusIncoerente({ status: "concluida", inicio: "2026-07-20", retorno: "2026-08-19" }, HOJE)
        .includes("acontecendo agora"),
    );
  });

  it("concluida para um gozo que nem começou", () => {
    assert.ok(
      statusIncoerente({ status: "concluida", inicio: "2026-09-01", retorno: "2026-10-01" }, HOJE)
        .includes("só começa"),
    );
  });

  it("o que está coerente não vira aviso", () => {
    // ADAPTAÇÃO: na origem, "Agendada" com gozo já começado era incoerente
    // (existia o status "Em andamento" para o gozo em curso). Na MinasLab
    // "marcada" cobre agendado E em curso — logo marcada durante o gozo é
    // coerente, não aviso.
    assert.equal(statusIncoerente({ status: "marcada", inicio: "2026-07-20", retorno: "2026-08-19" }, HOJE), null);
    assert.equal(statusIncoerente({ status: "concluida", inicio: "2026-06-19", retorno: "2026-07-19" }, HOJE), null);
    assert.equal(statusIncoerente({ status: "marcada", inicio: "2026-09-01", retorno: "2026-10-01" }, HOJE), null);
  });

  it("registro sem gozo e registro invertido não geram falso alarme", () => {
    assert.equal(statusIncoerente({ status: "marcada", inicio: null, retorno: null }, HOJE), null);
    assert.equal(statusIncoerente({ status: "marcada", inicio: "2026-09-01", retorno: "2026-08-01" }, HOJE), null);
  });

  it("cancelada nunca vira aviso: cancelar é decisão humana", () => {
    assert.equal(statusIncoerente({ status: "cancelada", inicio: "2026-07-20", retorno: "2026-08-19" }, HOJE), null);
    assert.equal(statusIncoerente({ status: "cancelada", inicio: "2026-06-19", retorno: "2026-07-19" }, HOJE), null);
  });
});

describe("proximaFerias — quanto falta para a próxima, por pessoa", () => {
  const reg = (id, ini, ret, status = "concluida") =>
    ({ id, pessoaId: "p1", inicio: ini, retorno: ret, status });

  it("o caso do Andre: dois períodos, os DOIS no passado", () => {
    // Era isto que a tela mostrava como "Voltou há 211 dias" em duas linhas.
    // A resposta útil é que não há próxima marcada.
    const p = proximaFerias([reg("a", "2025-12-25", "2026-01-05"), reg("b", "2024-12-23", "2025-01-02")], HOJE);
    assert.equal(p.fase, "sem-marcacao");
    assert.equal(p.texto, "Sem férias marcadas");
  });

  it("com uma futura, conta os dias que faltam", () => {
    const p = proximaFerias([reg("a", "2025-12-25", "2026-01-05"), reg("b", "2026-08-20", "2026-09-19", "marcada")], HOJE);
    assert.equal(p.fase, "futuro");
    assert.equal(p.dias, 16);
    assert.equal(p.texto, "Faltam 16 dias");
  });

  it("entre duas futuras, pega a MAIS PRÓXIMA", () => {
    const p = proximaFerias([
      reg("longe", "2026-12-01", "2026-12-31", "marcada"),
      reg("perto", "2026-08-20", "2026-09-19", "marcada"),
    ], HOJE);
    assert.equal(p.registro?.id, "perto");
  });

  it("quem está de férias AGORA vem antes de quem tem uma marcada", () => {
    // ADAPTAÇÃO: na origem o registro em curso tinha status "Em andamento";
    // na MinasLab o gozo em curso continua "marcada".
    const p = proximaFerias([
      reg("futura", "2026-08-20", "2026-09-19", "marcada"),
      reg("agora", "2026-07-20", "2026-08-19", "marcada"),
    ], HOJE);
    assert.equal(p.fase, "em-curso");
    assert.equal(p.registro?.id, "agora");
    assert.ok(p.texto.includes("volta em"));
  });

  it("período CANCELADO não conta como próxima", () => {
    const p = proximaFerias([reg("cancelada", "2026-08-20", "2026-09-19", "cancelada")], HOJE);
    assert.equal(p.fase, "sem-marcacao");
  });

  it("pessoa sem nenhum registro não quebra", () => {
    assert.equal(proximaFerias([], HOJE).fase, "sem-marcacao");
  });

  it("registro sem gozo não vira próxima", () => {
    // ADAPTAÇÃO: o status "Em aberto" da origem (13 pessoas com direito e nada
    // marcado) não existe na MinasLab; o análogo é um registro sem datas — a
    // fase "sem-gozo" segura a resposta, qualquer que seja o status.
    const p = proximaFerias([reg("aberto", null, null, "marcada")], HOJE);
    assert.equal(p.fase, "sem-marcacao");
  });
});

describe("statusSugerido — o conserto de um clique", () => {
  it("os três casos reais viram concluida", () => {
    // Ricardo, Sally e Thiago na origem: gozo terminado sem ninguém avançar o
    // status (lá "Em andamento", aqui "marcada").
    for (const [ini, ret] of [["2026-06-21", "2026-07-21"], ["2026-06-20", "2026-07-20"], ["2026-06-19", "2026-07-19"]]) {
      assert.equal(statusSugerido({ status: "marcada", inicio: ini, retorno: ret }, HOJE), "concluida");
    }
  });

  it("gozo acontecendo agora com 'concluida' volta para marcada", () => {
    // ADAPTAÇÃO: na origem sugeria "Em andamento"; na MinasLab o status do
    // gozo em curso é "marcada". A metade "Agendada → Em andamento" da origem
    // caiu: marcada em curso já é coerente e não gera sugestão.
    assert.equal(
      statusSugerido({ status: "concluida", inicio: "2026-07-20", retorno: "2026-08-19" }, HOJE),
      "marcada",
    );
  });

  it("gozo que ainda não começou marcado como concluida vira marcada", () => {
    // Na origem sugeria "Agendada" — o equivalente MinasLab é "marcada".
    assert.equal(
      statusSugerido({ status: "concluida", inicio: "2026-09-01", retorno: "2026-10-01" }, HOJE),
      "marcada",
    );
  });

  it("NÃO sugere nada quando o status já está coerente", () => {
    assert.equal(statusSugerido({ status: "concluida", inicio: "2026-06-19", retorno: "2026-07-19" }, HOJE), null);
    assert.equal(statusSugerido({ status: "marcada", inicio: "2026-07-20", retorno: "2026-08-19" }, HOJE), null);
    assert.equal(statusSugerido({ status: "marcada", inicio: "2026-09-01", retorno: "2026-10-01" }, HOJE), null);
  });

  it("NÃO sugere nada quando não dá para afirmar (sem gozo, datas trocadas)", () => {
    // Registro sem gozo é estado legítimo (na origem, 13 pessoas "Em aberto"):
    // sugerir qualquer status aqui seria inventar agendamento que ninguém fez.
    assert.equal(statusSugerido({ status: "marcada", inicio: null, retorno: null }, HOJE), null);
    assert.equal(statusSugerido({ status: "marcada", inicio: "2026-09-01", retorno: "2026-08-01" }, HOJE), null);
  });

  it("o sugerido é sempre um dos status que o formulário aceita", () => {
    const validos = ["marcada", "concluida", "cancelada"];
    const casos = [
      { status: "marcada", inicio: "2026-06-19", retorno: "2026-07-19" },
      { status: "concluida", inicio: "2026-07-20", retorno: "2026-08-19" },
      { status: "concluida", inicio: "2026-09-01", retorno: "2026-10-01" },
    ];
    for (const c of casos) assert.ok(validos.includes(statusSugerido(c, HOJE)));
  });
});

// parseData é dependência local do porte — uma sanidade para o formato ISO com T
// (a origem delegava isto a @/lib/format, coberto na suíte de lá).
describe("parseData — a porta de entrada das datas", () => {
  it("data pura vira meia-noite LOCAL, não UTC", () => {
    const d = parseData("2026-08-04");
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 7);
    assert.equal(d.getDate(), 4);
    assert.equal(d.getHours(), 0);
  });

  it("ISO com T usa só o dia; vazio e lixo viram null", () => {
    assert.equal(parseData("2026-08-04T23:59:00.000Z").getDate(), 4);
    assert.equal(parseData(null), null);
    assert.equal(parseData(""), null);
    assert.equal(parseData("não-é-data"), null);
  });
});
