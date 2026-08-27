// Portado de rh/src/lib/feriasAgenda.test.ts (Impresilk) em 27/08/2026 —
// mesmos 34 casos, campos adaptados à MinasLab (dataInicio→inicio,
// dataRetorno→retorno, status "Agendada"/"Cancelada"→"marcada"/"cancelada";
// diasGozados/saldoDias não existem aqui e saíram do builder — nenhum caso
// dependia deles, então NENHUM caso caiu).
// Rodar com TZ=UTC (o script npm test já fixa): teste que só passa no fuso de
// quem escreveu não é teste.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validarAgendamento, validarPeriodo, retornoDe, diasEntre, inicioProibido,
  temErro, erros, MIN_FRACAO_DIAS, MAX_ABONO_DIAS,
} from "./feriasAgenda.js";

/* Compara pelo dia LOCAL, nunca por toISOString().
   toISOString() converte para UTC: em fuso à frente de UTC, a meia-noite local
   de 20/08 vira 19/08 e o teste reprova sem que nada esteja errado no código.
   Foi assim que a CI (que roda em UTC) ficou vermelha enquanto tudo passava
   na máquina de quem escreveu. O teste usa a mesma régua do app. */
const localISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;


// Segunda-feira, para os casos que não são sobre dia da semana.
const SEG = new Date("2026-09-07T12:00:00");
const dia = (s) => new Date(`${s}T12:00:00`);

// Registro de férias da MinasLab: inicio/retorno são "AAAA-MM-DD" (dias gozados
// derivam das duas datas — não há campo diasGozados aqui).
const periodo = (inicio, retorno, extra = {}) => ({
  id: "f" + inicio, pessoaId: "c1", inicio, retorno,
  status: "marcada", ...extra,
});

describe("contas de data", () => {
  it("30 dias a partir de 01/09 devolvem ao trabalho em 01/10", () => {
    assert.equal(localISO(retornoDe(dia("2026-09-01"), 30)), "2026-10-01");
  });

  it("atravessa a virada do ano sem perder um dia", () => {
    assert.equal(localISO(retornoDe(dia("2026-12-20"), 30)), "2027-01-19");
  });

  it("atravessa o horário de verão sem cair no dia anterior", () => {
    // A conta antiga somava dias com o relógio na meia-noite; numa virada de
    // fuso isso devolvia o dia anterior. Ancorada no meio-dia, não acontece.
    assert.equal(localISO(retornoDe(dia("2026-02-01"), 15)), "2026-02-16");
  });

  it("mede os dias entre as duas datas", () => {
    assert.equal(diasEntre(dia("2026-09-01"), dia("2026-10-01")), 30);
    assert.equal(diasEntre(dia("2026-09-01"), dia("2026-09-16")), 15);
  });
});

describe("art. 134 §3 — quando NÃO pode começar", () => {
  it("sexta, sábado e domingo são barrados", () => {
    assert.equal(inicioProibido(dia("2026-09-04")), true);  // sexta
    assert.equal(inicioProibido(dia("2026-09-05")), true);  // sábado
    assert.equal(inicioProibido(dia("2026-09-06")), true);  // domingo
  });
  it("de segunda a quinta pode", () => {
    for (const d of ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10"]) {
      assert.equal(inicioProibido(dia(d)), false);
    }
  });
  it("é aviso, não erro: a empresa pode ter feriado próprio", () => {
    const a = validarAgendamento({ inicio: dia("2026-09-04"), dias: 30 });
    assert.equal(temErro(a), false);
    assert.equal(a.some((x) => x.nivel === "aviso"), true);
  });
});

describe("quantidade de dias", () => {
  it("30 dias direto é o caso normal e passa limpo", () => {
    assert.deepEqual(validarAgendamento({ inicio: SEG, dias: 30 }), []);
  });

  it("mais de 30 é recusado", () => {
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: 45 })), true);
  });

  it("999 dias — o número que o formulário aceitava — é recusado", () => {
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: 999 })), true);
  });

  it("zero e negativo são recusados", () => {
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: 0 })), true);
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: -5 })), true);
  });

  it("meio dia de férias não existe", () => {
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: 7.5 })), true);
  });

  it("sem data de início, recusa e nem tenta o resto", () => {
    const a = validarAgendamento({ inicio: null, dias: 30 });
    assert.equal(erros(a).length, 1);
  });
});

describe("art. 134 §1 — fracionamento", () => {
  it("15 dias é período partido válido", () => {
    assert.deepEqual(validarAgendamento({ inicio: SEG, dias: 15 }), []);
  });

  it("menos de 5 dias não pode", () => {
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: MIN_FRACAO_DIAS - 1 })), true);
  });

  it("exatamente 5 dias pode", () => {
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: MIN_FRACAO_DIAS })), false);
  });

  it("um quarto período é recusado", () => {
    const a = validarAgendamento({ inicio: SEG, dias: 5, fracoesExistentes: 3, diasJaLancados: 25 });
    assert.equal(temErro(a), true);
  });

  it("15+15 fecha os 30 e o segundo passa", () => {
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: 15, diasJaLancados: 15, fracoesExistentes: 1 })), false);
  });
});

describe("saldo do período aquisitivo", () => {
  it("não deixa passar dos 30 somando com o que já foi lançado", () => {
    const a = validarAgendamento({ inicio: SEG, dias: 20, diasJaLancados: 15 });
    assert.equal(temErro(a), true);
    assert.ok(erros(a)[0].texto.includes("Sobram 15"));
  });

  it("o que sobra exato passa", () => {
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: 15, diasJaLancados: 15 })), false);
  });

  it("abono vendido desconta do que pode ser gozado", () => {
    // 10 vendidos + 20 gozados = 30. Pedir 25 estoura.
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: 25, abono: 10 })), true);
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: 20, abono: 10 })), false);
  });

  it("abono acima de um terço é recusado", () => {
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: 20, abono: MAX_ABONO_DIAS + 1 })), true);
  });
});

describe("sobreposição com outro período da mesma pessoa", () => {
  const outros = [periodo("2026-09-01", "2026-10-01")];

  it("período que cai dentro de outro é recusado", () => {
    assert.equal(temErro(validarAgendamento({ inicio: dia("2026-09-10"), dias: 5, outros })), true);
  });

  it("período que começa antes e invade também", () => {
    assert.equal(temErro(validarAgendamento({ inicio: dia("2026-08-25"), dias: 10, outros })), true);
  });

  it("começar no dia do retorno do outro está livre", () => {
    assert.equal(temErro(validarAgendamento({ inicio: dia("2026-10-01"), dias: 15, outros })), false);
  });

  it("período cancelado não atrapalha", () => {
    const cancelado = [periodo("2026-09-01", "2026-10-01", { status: "cancelada" })];
    assert.equal(temErro(validarAgendamento({ inicio: dia("2026-09-10"), dias: 5, outros: cancelado })), false);
  });

  it("editando, o registro não briga consigo mesmo", () => {
    const a = validarAgendamento({ inicio: dia("2026-09-01"), dias: 30, outros, ignorarId: outros[0].id });
    assert.equal(temErro(a), false);
  });

  it("registro sem datas não gera falso positivo", () => {
    // Na MinasLab, inicio sem retorno é o "gozo sem dias" da base antiga:
    // a conferência de sobreposição pula o registro, igual à origem.
    const semDatas = [periodo("2026-09-01", "2026-10-01", { inicio: null, retorno: null })];
    assert.equal(temErro(validarAgendamento({ inicio: SEG, dias: 30, outros: semDatas })), false);
  });
});

describe("validarPeriodo — o par de datas da edição", () => {
  it("RETORNO ANTES DO INÍCIO é recusado (era gravável)", () => {
    const a = validarPeriodo(dia("2026-09-01"), dia("2026-08-01"));
    assert.equal(temErro(a), true);
    assert.ok(erros(a)[0].texto.includes("depois do início"));
  });

  it("mesmo dia não é férias", () => {
    assert.equal(temErro(validarPeriodo(dia("2026-09-01"), dia("2026-09-01"))), true);
  });

  it("período normal de 30 dias passa", () => {
    assert.deepEqual(validarPeriodo(dia("2026-09-01"), dia("2026-10-01")), []);
  });

  it("mais de 30 dias entre as datas é recusado", () => {
    assert.equal(temErro(validarPeriodo(dia("2026-09-01"), dia("2026-10-15"))), true);
  });

  it("AS DUAS VAZIAS é período em aberto — não trava a gravação", () => {
    // Na base de origem, 13 dos 31 registros estavam assim: saldo de 30 dias,
    // nenhum gozo agendado. Exigir as datas deixava esses registros
    // impossíveis de salvar.
    assert.deepEqual(validarPeriodo(null, null), []);
    assert.equal(temErro(validarPeriodo(null, null)), false);
  });

  it("cobra as duas datas quando falta alguma", () => {
    assert.equal(erros(validarPeriodo(null, dia("2026-10-01"))).length, 1);
    assert.equal(erros(validarPeriodo(dia("2026-09-01"), null)).length, 1);
  });
});
