// Portado de rh/src/lib/clt.test.ts (Impresilk) em 27/08/2026 — regras idênticas, campos adaptados à MinasLab.
// Regras da CLT — é aqui que erro custa dinheiro de verdade (férias pagas em
// dobro, contrato que vira indeterminado). Os testes fixam a data de "hoje" para
// o resultado não mudar conforme o dia em que rodarem. Rodar com TZ=UTC (como a
// suíte de format.test.mjs): teste que só passa no fuso de quem escreveu não é teste.
//
// Adaptações de campo neste porte (nenhum caso da origem caiu — 46/46):
// - dataAdmissao→admissao, dataDesligamento→desligadoEm, statusId "inativo"→ativo:false
// - dataInicio→inicio; diasGozados não existe: os dias saem de inicio→retorno
//   (retorno é o dia em que a pessoa VOLTA), então os helpers montam o retorno
//   somando os dias ao início. Registro SEM retorno = o "gozo sem dias" da base
//   antiga da origem (mesma regra).
// - status: "Concluída"→"concluida", "Cancelada"→"cancelada", "Agendada"→"marcada".
// - O caso da origem "base antiga sem diasGozados" (diasGozados: 0 COM retorno
//   preenchido) não é representável na MinasLab; o equivalente é registro sem
//   retorno — o teste foi adaptado assim, mesma regra exercitada.
// - Teste extra (só da MinasLab): abonoDias soma aos dias do registro (CLT art. 143).
import test from "node:test";
import assert from "node:assert/strict";
import { situacaoFerias, situacaoExperiencia, inicioDoHistorico } from "./clt.js";

const pessoa = (admissao) => ({ id: "p1", nome: "Teste", admissao, ativo: true });
// Registro sem retorno = o "gozo sem dias" da base antiga.
const feriasEm = (inicio, status = "concluida") => ({ id: "f1", pessoaId: "p1", inicio, status });
// "AAAA-MM-DD" + n dias, montado com Date local (nunca depende de fuso).
const mais = (iso, n) => {
  const [a, m, d] = iso.split("-").map(Number);
  const r = new Date(a, m - 1, d + n);
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, "0")}-${String(r.getDate()).padStart(2, "0")}`;
};
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Gozo de N dias: retorno = inicio + N (o dia em que a pessoa volta).
const gozo = (inicio, dias, status = "concluida") =>
  ({ id: "g" + inicio, pessoaId: "p1", inicio, retorno: mais(inicio, dias), status });

// ------------------------------ situacaoFerias ------------------------------

test("situacaoFerias: não calcula antes de 1 ano de casa (direito ainda não nasceu)", () => {
  const hoje = new Date(2026, 5, 1); // 01/06/2026
  assert.equal(situacaoFerias(pessoa("2025-10-01"), [], hoje), null);
});

test("situacaoFerias: sem admissão, não inventa prazo", () => {
  assert.equal(situacaoFerias(pessoa(""), [], new Date(2026, 5, 1)), null);
});

test("situacaoFerias: logo após o primeiro ano, o prazo de conceder é 1 ano à frente", () => {
  const hoje = new Date(2026, 0, 15); // 15/01/2026
  const s = situacaoFerias(pessoa("2025-01-01"), [], hoje);
  assert.equal(s.direitoDesde.getFullYear(), 2026);
  assert.equal(s.limiteConcessao.getFullYear(), 2027);
  assert.equal(s.jaGozou, false);
  assert.equal(s.situacao, "em-dia"); // ainda falta muito para o limite
});

test("situacaoFerias: marca A VENCER quando faltam 90 dias ou menos para o limite", () => {
  // direito nasceu em 01/01/2026, limite 01/01/2027; hoje 15/11/2026 (~47 dias)
  const s = situacaoFerias(pessoa("2025-01-01"), [], new Date(2026, 10, 15));
  assert.equal(s.situacao, "a-vencer");
  assert.ok(s.diasParaLimite > 0);
  assert.ok(s.diasParaLimite <= 90);
});

test("situacaoFerias: marca VENCIDA depois do limite — é o caso do pagamento em dobro", () => {
  // direito em 01/01/2026, limite 01/01/2027; hoje 01/03/2027
  const s = situacaoFerias(pessoa("2025-01-01"), [], new Date(2027, 2, 1));
  assert.equal(s.situacao, "vencida");
  assert.ok(s.diasParaLimite < 0);
});

test("situacaoFerias: quem já gozou dentro do período fica EM DIA mesmo perto do limite", () => {
  const s = situacaoFerias(pessoa("2025-01-01"), [feriasEm("2026-07-10")], new Date(2026, 10, 15));
  assert.equal(s.jaGozou, true);
  assert.equal(s.situacao, "em-dia");
});

test("situacaoFerias: férias CANCELADAS não contam como gozadas", () => {
  const s = situacaoFerias(pessoa("2025-01-01"), [feriasEm("2026-07-10", "cancelada")], new Date(2026, 10, 15));
  assert.equal(s.jaGozou, false);
  assert.equal(s.situacao, "a-vencer");
});

test("situacaoFerias: férias ANTERIORES ao direito atual não contam (é do período passado)", () => {
  // direito nasceu 01/01/2026; férias gozadas em 2025 são do ciclo anterior
  const s = situacaoFerias(pessoa("2024-01-01"), [feriasEm("2025-06-01")], new Date(2026, 10, 15));
  assert.equal(s.jaGozou, false);
});

// --------------------------- situacaoExperiencia ----------------------------

test("situacaoExperiencia: nos primeiros dias não incomoda ninguém", () => {
  const s = situacaoExperiencia(pessoa("2026-06-01"), new Date(2026, 5, 10));
  assert.equal(s.situacao, "primeiro-periodo");
});

test("situacaoExperiencia: perto dos 45 dias, avisa para decidir a prorrogação", () => {
  const s = situacaoExperiencia(pessoa("2026-05-01"), new Date(2026, 5, 14)); // ~44 dias
  assert.equal(s.situacao, "decidir-prorrogacao");
});

test("situacaoExperiencia: faltando 15 dias ou menos, avisa para efetivar ou desligar", () => {
  // admissão 01/04/2026 → 90 dias caem em 30/06; hoje 20/06 = 10 dias
  const s = situacaoExperiencia(pessoa("2026-04-01"), new Date(2026, 5, 20));
  assert.equal(s.situacao, "decidir-efetivacao");
  assert.ok(s.diasParaFim <= 15);
});

test("situacaoExperiencia: passou dos 90 dias: contrato virou indeterminado", () => {
  const s = situacaoExperiencia(pessoa("2026-01-01"), new Date(2026, 3, 5)); // ~94 dias
  assert.equal(s.situacao, "expirou");
  assert.ok(s.diasParaFim < 0);
});

test("situacaoExperiencia: para de avisar quando já passou muito tempo (não vira ruído eterno)", () => {
  assert.equal(situacaoExperiencia(pessoa("2024-01-01"), new Date(2026, 5, 1)), null);
});

test("situacaoExperiencia: O CASO QUE IMPORTA: quem foi admitido HOJE já está em experiência", () => {
  // O quadro de Colaboradores escondia o recém-admitido (só entrava a partir
  // de 35 dias de casa). Quem cadastrava alguém não via a pessoa no bloco e
  // concluía, com razão, que o cadastro tinha se perdido. O relógio dos 90
  // dias corre desde o primeiro dia — então a conta vale desde o primeiro dia.
  const s = situacaoExperiencia(pessoa("2026-06-10"), new Date(2026, 5, 10));
  assert.notEqual(s, null);
  assert.equal(s.diasDeCasa, 0);
  assert.equal(s.situacao, "primeiro-periodo");
  assert.equal(s.diasParaFim, 90);
});

test("situacaoExperiencia: quem entrou ontem ou anteontem também conta", () => {
  assert.equal(situacaoExperiencia(pessoa("2026-06-09"), new Date(2026, 5, 10)).diasDeCasa, 1);
  assert.equal(situacaoExperiencia(pessoa("2026-06-08"), new Date(2026, 5, 10)).diasDeCasa, 2);
});

test("situacaoExperiencia: admissão com data futura não entra (data digitada errada não vira aviso)", () => {
  assert.equal(situacaoExperiencia(pessoa("2026-07-01"), new Date(2026, 5, 10)), null);
});

// ---------------------------------------------------------------------------
// Achados da conferência das abas (2026-07-31): três buracos que custavam
// dinheiro ou poluíam o histórico. Ficam fixos aqui.
// ---------------------------------------------------------------------------
const pessoaX = (extra = {}) => ({ id: "x", nome: "Teste", admissao: "2023-01-10", ativo: true, ...extra });

test("correções: férias pela METADE não quitam o período (os 15 restantes também pagam em dobro)", () => {
  const hoje = new Date(2025, 0, 5); // 5/1/2025, dentro da janela de concessão
  const meio = situacaoFerias(pessoaX(), [
    { id: "f1", pessoaId: "x", inicio: "2024-03-10", retorno: "2024-03-25", status: "concluida" }, // 15 dias
  ], hoje);
  assert.equal(meio?.jaGozou, false);
  assert.equal(meio?.diasEmAberto, 15);

  const cheio = situacaoFerias(pessoaX(), [
    { id: "f1", pessoaId: "x", inicio: "2024-03-10", retorno: "2024-04-09", status: "concluida" }, // 30 dias
  ], hoje);
  assert.equal(cheio?.jaGozou, true);
  assert.equal(cheio?.diasEmAberto, 0);
});

test("correções: base antiga sem retorno continua contando como gozada (não vira alarme falso)", () => {
  // Na origem o caso era diasGozados: 0 com retorno preenchido; na MinasLab o
  // registro "sem dias" da base antiga é o que tem inicio e NÃO tem retorno.
  const s = situacaoFerias(pessoaX(), [
    { id: "f1", pessoaId: "x", inicio: "2024-03-10", status: "concluida" },
  ], new Date(2025, 0, 5));
  assert.equal(s?.jaGozou, true);
});

test("correções: quem foi desligado tem o relógio parado na saída, não em hoje", () => {
  const saiu = pessoaX({ desligadoEm: "2024-06-30", ativo: false });
  const a = situacaoFerias(saiu, [], new Date(2025, 0, 5));
  const b = situacaoFerias(saiu, [], new Date(2026, 6, 31)); // 18 meses depois
  assert.equal(a?.diasParaLimite, b?.diasParaLimite);
});

test("correções: experiência já decidida para de pedir decisão (não duplica a movimentação)", () => {
  const adm = "2026-05-20";
  const hoje = new Date(2026, 7, 5); // dia 77
  assert.notEqual(situacaoExperiencia(pessoaX({ admissao: adm }), hoje), null);
  assert.equal(situacaoExperiencia(pessoaX({ admissao: adm, experienciaDecididaEm: "2026-08-04", ativo: true }), hoje), null);
});

test("correções: desligado não recebe mais aviso de contrato de experiência", () => {
  const hoje = new Date(2026, 7, 5);
  assert.equal(situacaoExperiencia(pessoaX({ admissao: "2026-05-20", desligadoEm: "2026-07-15", ativo: false }), hoje), null);
});

// ---------------------------------------------------------------------------
// Férias tiradas COM MUITO ATRASO precisam quitar o período. A conta antiga só
// olhava os gozos dentro de uma janela fixa de 24 meses a partir do direito;
// quem regularizou depois disso — justamente quem estava pior — nunca saía do
// "VENCIDAS há N dias", e a ficha ainda afirmava "por lei, o pagamento é em
// dobro" sobre um período já concedido. Agora cada dia gozado abate o período
// em aberto MAIS ANTIGO (FIFO), que é como se acerta férias atrasadas.
// ---------------------------------------------------------------------------
const HOJE_F = new Date(2026, 7, 10); // 10/08/2026

test("FIFO: O CASO QUE IMPORTA: tirou as férias 2 anos atrasado — o período mais antigo sai da lista", () => {
  // Admitido 13/01/2022 → 1º período vence 13/01/2024. Tirou 30 dias em
  // março/2025 (14 meses depois do limite). Antes: seguia "vencida há 940
  // dias" no MESMO período, como se nunca tivesse tirado.
  const semGozo = situacaoFerias(pessoa("2022-01-13"), [], HOJE_F);
  const comGozo = situacaoFerias(pessoa("2022-01-13"), [gozo("2025-03-03", 30)], HOJE_F);
  assert.equal(semGozo.limiteConcessao.getFullYear(), 2024);
  assert.equal(comGozo.limiteConcessao.getFullYear(), 2025); // andou para o período seguinte
  assert.ok(comGozo.diasParaLimite > semGozo.diasParaLimite);
});

test("FIFO: quem tirou 30 dias todo ano está em dia", () => {
  const s = situacaoFerias(pessoa("2022-01-13"),
    [gozo("2023-06-01", 30), gozo("2024-06-01", 30), gozo("2025-06-01", 30)], HOJE_F);
  assert.equal(s.situacao, "em-dia");
});

test("FIFO: 15+15 no mesmo período somam 30 e quitam", () => {
  const s = situacaoFerias(pessoa("2022-01-13"),
    [gozo("2023-06-01", 15), gozo("2023-11-01", 15)], HOJE_F);
  // O 1º período (limite 13/01/2024) está quitado: o aberto agora é o seguinte.
  assert.equal(s.limiteConcessao.getFullYear(), 2025);
});

test("FIFO: meio período não quita: 15 dias deixam 15 em aberto", () => {
  const s = situacaoFerias(pessoa("2022-01-13"), [gozo("2023-06-01", 15)], HOJE_F);
  assert.equal(s.jaGozou, false);
  assert.equal(s.diasEmAberto, 15);
  assert.equal(s.limiteConcessao.getFullYear(), 2024); // ainda o 1º período
});

test("FIFO: gozo grande transborda para o período seguinte", () => {
  // 60 dias de uma vez quitam dois períodos.
  const s = situacaoFerias(pessoa("2022-01-13"), [gozo("2025-03-03", 60)], HOJE_F);
  assert.equal(s.limiteConcessao.getFullYear(), 2026);
});

test("FIFO: não quita período cujo direito ainda não tinha nascido na data do gozo", () => {
  // Gozo em 2023 não pode abater o período que só nasce em 2025.
  const s = situacaoFerias(pessoa("2022-01-13"), [gozo("2023-06-01", 30)], HOJE_F);
  assert.equal(s.limiteConcessao.getFullYear(), 2025);
  assert.equal(s.jaGozou, false);
});

test("FIFO: férias canceladas não quitam nada", () => {
  const cancelada = { ...gozo("2025-03-03", 30), status: "cancelada" };
  const s = situacaoFerias(pessoa("2022-01-13"), [cancelada], HOJE_F);
  assert.equal(s.limiteConcessao.getFullYear(), 2024);
});

// Só da MinasLab (a origem recebia `diasGozados` prontos): abono pecuniário
// (CLT art. 143) sai do MESMO saldo de 30 dias — soma aos dias derivados de
// inicio→retorno. Sem isso, quem tirou 20 e vendeu 10 apareceria devendo 10
// pagos em dobro.
test("FIFO: abonoDias soma aos dias do registro (20 gozados + 10 vendidos quitam o período)", () => {
  const comAbono = { id: "a1", pessoaId: "p1", inicio: "2023-06-01", retorno: mais("2023-06-01", 20), abonoDias: 10, status: "concluida" };
  const s = situacaoFerias(pessoa("2022-01-13"), [comAbono], HOJE_F);
  assert.equal(s.limiteConcessao.getFullYear(), 2025); // quitou o 1º período
  const semAbono = { ...comAbono, abonoDias: 0 };
  const s2 = situacaoFerias(pessoa("2022-01-13"), [semAbono], HOJE_F);
  assert.equal(s2.diasEmAberto, 10);
  assert.equal(s2.limiteConcessao.getFullYear(), 2024);
});

// ---------------------------------------------------------------------------
// AGENDAR NÃO É GOZAR. Achado bloqueador da revisão de 10/08/2026: o FIFO
// creditava qualquer registro de férias ao período em aberto mais antigo sem
// perguntar se o gozo JÁ ACONTECEU. Bastava o RH agendar 30 dias para o ano que
// vem e o "VENCIDAS há N dias — pagamento em dobro" sumia no mesmo instante da
// ficha, do sino e do calendário. A dívida do art. 137 continuava lá, invisível.
// ---------------------------------------------------------------------------
const HOJE_A = new Date(2026, 7, 10); // 10/08/2026

test("agendar: O CASO QUE IMPORTA: agendar para o ano que vem NÃO apaga o vencido", () => {
  const semNada = situacaoFerias(pessoa("2023-12-06"), [], HOJE_A);
  assert.equal(semNada.situacao, "vencida");
  const comAgendamento = situacaoFerias(
    pessoa("2023-12-06"), [gozo("2027-01-18", 30, "marcada")], HOJE_A);
  assert.equal(comAgendamento.situacao, "vencida");
  assert.equal(comAgendamento.limiteConcessao.getTime(), semNada.limiteConcessao.getTime());
});

test("agendar: o agendamento aparece na resposta, para a tela poder informar em vez de calar", () => {
  const s = situacaoFerias(pessoa("2023-12-06"), [gozo("2027-01-18", 30, "marcada")], HOJE_A);
  assert.equal(s.diasAgendados, 30);
  assert.equal(s.agendadoPara?.getFullYear(), 2027);
});

test("agendar: gozo que JÁ COMEÇOU continua quitando, mesmo em atraso", () => {
  const s = situacaoFerias(pessoa("2022-01-13"), [gozo("2025-03-03", 30)], HOJE_A);
  assert.equal(s.limiteConcessao.getFullYear(), 2025); // andou de período
});

test("agendar: gozo em curso (começou ontem, termina depois) já conta", () => {
  const s = situacaoFerias(pessoa("2022-01-13"), [gozo("2026-08-09", 30)], HOJE_A);
  assert.ok(s.limiteConcessao.getFullYear() > 2024);
});

test("agendar: status marcada mas com data JÁ PASSADA conta — o que vale é a data, não o rótulo", () => {
  // O texto do status é digitado à mão e ninguém volta para atualizá-lo.
  const s = situacaoFerias(pessoa("2022-01-13"), [gozo("2025-03-03", 30, "marcada")], HOJE_A);
  assert.equal(s.limiteConcessao.getFullYear(), 2025);
});

// ---------------------------------------------------------------------------
// A ATRIBUIÇÃO do FIFO precisa ser visível (gozosCreditados). Achado da revisão
// de 27/08/2026: o form de agendamento contava como "fração do aberto" qualquer
// registro com início >= direitoDesde — mas um gozo ATRASADO do período
// ANTERIOR também cai nesse filtro. Regularizar as vencidas e depois marcar a
// 3ª fração legítima de 10 dias (10+10+10 é legal) devolvia "a CLT não permite
// um quarto", travando gravação permitida por lei. A tela agora conta pela
// atribuição que o FIFO já fazia; aqui fica fixo o que ele expõe.
// ---------------------------------------------------------------------------

test("gozosCreditados: gozo ATRASADO do período anterior NÃO aparece no período em aberto", () => {
  // Admitida 01/06/2024: 1º período vence 01/06/2026. As férias vencidas foram
  // regularizadas com 30 dias em 01–31/07/2026 — o FIFO credita ao 1º período.
  // O aberto reportado é o 2º (direito desde 01/06/2026): o gozo de julho não
  // pode constar como fração dele, mesmo com início depois do direitoDesde.
  const hoje = new Date(2026, 7, 27); // 27/08/2026
  const s = situacaoFerias(pessoa("2024-06-01"), [
    gozo("2026-07-01", 30),            // regularização atrasada do 1º período
    gozo("2026-10-05", 10, "marcada"), // frações futuras do período atual
    gozo("2026-12-07", 10, "marcada"),
  ], hoje);
  // O 1º período foi quitado pelo gozo de julho: o aberto é o 2º.
  assert.equal(s.direitoDesde.getFullYear(), 2026);
  assert.equal(s.direitoDesde.getMonth(), 5); // junho
  assert.ok(!s.gozosCreditados.includes("2026-07-01"));
  assert.deepEqual(s.gozosCreditados, []); // nada gozado do aberto ainda
  assert.equal(s.diasAgendados, 20);       // os futuros continuam só agendados

  // Contraprova: quando o gozo abate o período REPORTADO, o início aparece —
  // com 15 dias o 1º período segue em aberto e o crédito fica visível nele.
  const parcial = situacaoFerias(pessoa("2024-06-01"), [gozo("2026-07-01", 15)], hoje);
  assert.equal(parcial.direitoDesde.getFullYear(), 2025); // ainda o 1º período
  assert.deepEqual(parcial.gozosCreditados, ["2026-07-01"]);
});

// ---------------------------------------------------------------------------
// Registro ANTIGO sem retorno (base importada, sem como derivar os dias) não
// pode apagar dias parciais já creditados: quem tirou 15 dos 30 continua
// devendo 15, e esses 15 também são pagos em dobro.
// ---------------------------------------------------------------------------
const HOJE_B = new Date(2026, 7, 10);

test("sem dias: 15 dias tirados + registro sem retorno = ainda faltam 15", () => {
  const s = situacaoFerias(pessoa("2022-01-13"), [gozo("2023-06-01", 15), feriasEm("2023-11-01")], HOJE_B);
  assert.equal(s.limiteConcessao.getFullYear(), 2024); // ainda o mesmo período
  assert.equal(s.jaGozou, false);
  assert.equal(s.diasEmAberto, 15);
});

test("sem dias: registro sem retorno em período INTOCADO continua quitando (não grita com base antiga)", () => {
  const s = situacaoFerias(pessoa("2022-01-13"), [feriasEm("2023-06-01")], HOJE_B);
  assert.equal(s.limiteConcessao.getFullYear(), 2025); // quitou o 1º e andou
});

// ---------------------------------------------------------------------------
// Corte de histórico: o sistema não pode afirmar "venceu" sobre um período do
// qual ele não tem registro nenhum. Medido em produção: das 12 pessoas
// apontadas como vencidas, as 12 tinham o limite anterior ao primeiro registro
// do banco — o alerta era 100% ruído.
// ---------------------------------------------------------------------------
const HOJE_TESTE = new Date(2026, 7, 4);          // 04/08/2026
const inicioBase = new Date(2025, 11, 6);         // 06/12/2025, como na produção

test("sem histórico: dez anos de casa e nenhum registro antigo: NÃO diz que venceu", () => {
  const adilson = pessoa("2014-01-13");
  const s = situacaoFerias(adilson, [feriasEm("2026-02-13")], HOJE_TESTE, inicioBase);
  assert.notEqual(s.situacao, "vencida");
});

test("sem histórico: sem o corte, o mesmo caso continua acusando vencida (o bug de antes)", () => {
  const adilson = pessoa("2014-01-13");
  const s = situacaoFerias(adilson, [feriasEm("2026-02-13")], HOJE_TESTE);
  assert.equal(s.situacao, "vencida");
});

test("sem histórico: período DENTRO do histórico continua vencendo normalmente", () => {
  // Admitido em 2024: direito em 2025, limite em 2026 — tudo depois do corte.
  const novato = pessoa("2024-01-10");
  const s = situacaoFerias(novato, [], new Date(2026, 6, 1), new Date(2023, 0, 1));
  assert.equal(s.situacao, "vencida");
});

test("sem histórico: O CASO DO ADILSON: 12 anos de casa, sem registro antigo, NÃO acusa dívida", () => {
  /* Medido na base real em 10/08/2026: o corte global valia 23/11/2023 por
     causa de UM registro solto, e o sistema acusava 12 das 32 pessoas no
     quadro. Adilson (admitido em 2014) recebia "VENCIDAS há 940 dias — o
     pagamento é em dobro" por períodos que o sistema nunca teve como conferir.
     Quem já estava na casa antes de o sistema existir só é julgado a partir do
     PRIMEIRO REGISTRO DELE. */
  const adilson = pessoa("2014-01-13");
  const cortePequeno = new Date(2023, 10, 23);      // 23/11/2023
  const hoje = new Date(2026, 7, 10);
  const s = situacaoFerias(adilson, [feriasEm("2026-12-14")], hoje, cortePequeno);
  assert.notEqual(s.situacao, "vencida");
});

test("sem histórico: mas a partir do 1º registro DELE, o sistema volta a julgar", () => {
  // Registro em 2023 → o período que nasce depois disso é observável.
  const antigo = pessoa("2014-01-13");
  const s = situacaoFerias(antigo, [feriasEm("2023-01-20")], new Date(2026, 7, 10), new Date(2023, 0, 1));
  assert.equal(s.situacao, "vencida");
});

test("sem histórico: quem entrou DEPOIS do corte é julgado normalmente, mesmo sem registro", () => {
  // A vida inteira dessa pessoa na empresa está sob observação: não ter
  // registro é achado de verdade, não falta de dado.
  const novato = pessoa("2024-01-10");
  const s = situacaoFerias(novato, [], new Date(2026, 6, 1), new Date(2023, 0, 1));
  assert.equal(s.situacao, "vencida");
});

test("sem histórico: sem corte informado, o comportamento é o de sempre", () => {
  const s = situacaoFerias(pessoa("2024-01-10"), [], new Date(2026, 6, 1));
  assert.equal(s.situacao, "vencida");
});

test("sem histórico: quem gozou de verdade segue em dia, com ou sem corte", () => {
  const c = pessoa("2024-01-10");
  const gozos = [feriasEm("2025-03-01"), feriasEm("2025-03-01")];
  const s = situacaoFerias(c, gozos, new Date(2026, 6, 1), inicioBase);
  assert.ok(["em-dia", "sem-registro"].includes(s.situacao));
});

// ------------------------------ inicioDoHistorico ---------------------------

test("inicioDoHistorico: é o registro de férias mais antigo que existe", () => {
  const fs = [feriasEm("2026-02-13"), feriasEm("2025-12-06"), feriasEm("2026-01-06")];
  assert.equal(ymd(inicioDoHistorico(fs)), "2025-12-06");
});

test("inicioDoHistorico: base vazia não tem histórico", () => {
  assert.equal(inicioDoHistorico([]), null);
});

test("inicioDoHistorico: registro sem data não atrapalha", () => {
  const f = { ...feriasEm("2026-02-13"), inicio: null };
  assert.equal(ymd(inicioDoHistorico([f, feriasEm("2025-12-06")])), "2025-12-06");
});
