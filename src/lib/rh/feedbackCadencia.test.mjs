// Portado de rh/src/lib/feedbackCadencia.test.ts (Impresilk) em 27/08/2026.
// Todos os 43 casos da origem foram portados — nenhum caiu. Adaptação de campos:
// colaboradorId→pessoaId; conversa de equipe era `grupoId: "g1"` e virou
// `tipo: "equipe"`; o tipo default "Contínuo" virou "individual"; treinamento
// segue `origem: "treinamento"`. Rodar com TZ=UTC (o script npm test já fixa):
// teste que só passa no fuso de quem escreveu não é teste.
import test from "node:test";
import assert from "node:assert/strict";
import {
  cadenciaDe, jaFoiDado, ultimoFeedback, compararFila, CADENCIA_FEEDBACK_DIAS,
  bloqueio, combinadoEmAberto, combinadoVencido, cadenciaDaPessoa, montarConteudo,
} from "./feedbackCadencia.js";

const HOJE = new Date(2026, 7, 10); // 10/08/2026
const diasAtras = (n) => new Date(HOJE.getTime() - n * 86_400_000).toISOString();
const fb = (id, dias, tipo = "individual") =>
  ({ id, pessoaId: "p1", criadoEm: diasAtras(dias), tipo });

// ---------------------------------------------------------------- ultimoFeedback

test("ultimoFeedback: pega o mais recente, não o último da lista", () => {
  assert.equal(ultimoFeedback([fb("velho", 200), fb("novo", 10), fb("meio", 90)])?.id, "novo");
});

test("ultimoFeedback: lista vazia devolve null", () => {
  assert.equal(ultimoFeedback([]), null);
});

test("ultimoFeedback: registro sem data não atrapalha", () => {
  const sujo = { id: "x", pessoaId: "p1", criadoEm: "" };
  assert.equal(ultimoFeedback([sujo, fb("bom", 5)])?.id, "bom");
});

// ---------------------------------------------------------------- cadenciaDe

test("cadenciaDe — O CASO QUE IMPORTA: quem entrou esta semana e nunca teve feedback NÃO está atrasado", () => {
  // Tratar isso como dívida encheria a fila de gente que acabou de chegar e
  // esvaziaria o sentido do aviso.
  const r = cadenciaDe([], diasAtras(7).slice(0, 10), HOJE);
  assert.equal(r.situacao, "nunca");
  assert.ok(r.diasParaProximo > 0);
});

test("cadenciaDe: quem está na casa há mais que a cadência e nunca teve feedback fica ATRASADO", () => {
  const r = cadenciaDe([], diasAtras(200).slice(0, 10), HOJE);
  assert.equal(r.situacao, "atrasado");
  assert.ok(r.diasParaProximo < 0);
});

test("cadenciaDe: feedback recente = em dia", () => {
  const r = cadenciaDe([fb("a", 10)], diasAtras(900).slice(0, 10), HOJE);
  assert.equal(r.situacao, "em-dia");
  assert.equal(r.diasDesde, 10);
  assert.equal(r.ultimo?.id, "a");
});

/* Caso da MinasLab (achado da revisão de 27/08/2026): o fluxo preparar→registrar
   reaproveita o registro do preparo, então criadoEm fica no dia do PREPARO e só
   ocorridoEm carrega o dia da CONVERSA. O relógio tem que contar da conversa —
   senão quem preparou em maio e conversou hoje voltava "atrasado" na hora. */
test("cadenciaDe: relógio conta do ocorridoEm, não do criadoEm do preparo", () => {
  const preparadoHaMuito = {
    id: "x", pessoaId: "p1", tipo: "individual",
    criadoEm: diasAtras(118), preparadoEm: diasAtras(118), ocorridoEm: diasAtras(0),
  };
  const r = cadenciaDe([preparadoHaMuito], diasAtras(900).slice(0, 10), HOJE);
  assert.equal(r.situacao, "em-dia");
  // === em vez de strict.equal: a conta devolve -0 no mesmo dia, e -0 === 0.
  assert.ok(r.diasDesde === 0);
});

test("ultimoFeedback: ordena pela data da CONVERSA quando o registro nasceu antes dela", () => {
  const preparadoAntes = { id: "conversa-nova", pessoaId: "p1", tipo: "individual", criadoEm: diasAtras(100), ocorridoEm: diasAtras(2) };
  assert.equal(ultimoFeedback([preparadoAntes, fb("registro-novo-conversa-velha", 30)])?.id, "conversa-nova");
});

test("cadenciaDe: passou da cadência desde o último = atrasado", () => {
  const r = cadenciaDe([fb("a", CADENCIA_FEEDBACK_DIAS + 5)], null, HOJE);
  assert.equal(r.situacao, "atrasado");
  assert.equal(r.diasParaProximo, -5);
});

test("cadenciaDe: chegando a hora avisa antes de estourar", () => {
  const r = cadenciaDe([fb("a", CADENCIA_FEEDBACK_DIAS - 10)], null, HOJE);
  assert.equal(r.situacao, "a-vencer");
});

test("cadenciaDe: no dia exato da cadência ainda não está atrasado", () => {
  const r = cadenciaDe([fb("a", CADENCIA_FEEDBACK_DIAS)], null, HOJE);
  assert.equal(r.diasParaProximo, 0);
  assert.equal(r.situacao, "a-vencer");
});

test("cadenciaDe: sem feedback E sem admissão: diz que não sabe, não inventa prazo", () => {
  const r = cadenciaDe([], null, HOJE);
  assert.equal(r.situacao, "nunca");
  assert.equal(r.diasDesde, null);
  assert.equal(r.diasParaProximo, null);
});

test("cadenciaDe: o feedback manda sobre a admissão", () => {
  // Admitida há 900 dias, mas com feedback há 5: está em dia.
  const r = cadenciaDe([fb("a", 5)], diasAtras(900).slice(0, 10), HOJE);
  assert.equal(r.situacao, "em-dia");
  assert.equal(r.diasDesde, 5);
});

test("cadenciaDe: data ilegível não derruba a conta", () => {
  const r = cadenciaDe([], "isso não é data", HOJE);
  assert.equal(r.situacao, "nunca");
  assert.equal(r.diasDesde, null);
});

// ---------------------------------------------------------------- compararFila

test("compararFila: atrasado vem antes de nunca, que vem antes de a-vencer e em-dia", () => {
  const ordem = [
    cadenciaDe([fb("x", 5)], null, HOJE),                          // em-dia
    cadenciaDe([], diasAtras(300).slice(0, 10), HOJE),             // atrasado
    cadenciaDe([], diasAtras(3).slice(0, 10), HOJE),               // nunca
    cadenciaDe([fb("y", CADENCIA_FEEDBACK_DIAS - 5)], null, HOJE), // a-vencer
  ].sort(compararFila).map((c) => c.situacao);
  assert.deepEqual(ordem, ["atrasado", "nunca", "a-vencer", "em-dia"]);
});

test("compararFila: dentro do mesmo grupo, quem espera há mais tempo vem primeiro", () => {
  const a = cadenciaDe([fb("a", 200)], null, HOJE);
  const b = cadenciaDe([fb("b", 400)], null, HOJE);
  assert.equal([a, b].sort(compararFila)[0].diasDesde, 400);
});

// ------------------------------------------- bloqueio — o que não entra aqui

test("bloqueio — O CASO QUE IMPORTA: assédio e agressão vão para o canal próprio, não para cá", () => {
  // Lei 14.457/2022, art. 23: empresa com CIPA tem canal com sigilo. Denúncia
  // colada no histórico de desempenho é o pior desenho possível.
  assert.equal(bloqueio("ele agrediu o colega na serralheria"), "grave");
  assert.equal(bloqueio("caso de assédio com a equipe"), "grave");
  assert.equal(bloqueio("chegou bêbado"), "grave");
  assert.equal(bloqueio("recusou o EPI de novo"), "grave");
});

test("bloqueio: dado SENSÍVEL da LGPD (art. 11) também não entra", () => {
  assert.equal(bloqueio("trouxe atestado médico"), "sensivel");
  assert.equal(bloqueio("está em tratamento de depressão"), "sensivel");
  assert.equal(bloqueio("entrou no sindicato"), "sensivel");
  assert.equal(bloqueio("por causa da gravidez"), "sensivel");
});

test("bloqueio: respeita FRONTEIRA de palavra — bloqueio falso ensina a contornar a tela", () => {
  // "acidentalmente" não é "acidente"; "drogaria" não é "droga".
  assert.equal(bloqueio("acidentalmente cortou a chapa menor"), null);
  assert.equal(bloqueio("entregou na drogaria do centro"), null);
  assert.equal(bloqueio("mediconhecimento"), null);
});

test("bloqueio: conversa normal de trabalho passa", () => {
  assert.equal(bloqueio("soldou fora do esquadro e voltou para retrabalho"), null);
  assert.equal(bloqueio("conferiu o projeto antes de cortar, ficou perfeito"), null);
});

test("bloqueio: texto vazio ou ausente não quebra", () => {
  assert.equal(bloqueio(""), null);
  assert.equal(bloqueio(undefined), null);
});

// ---------------------------------------------------------- combinado voltando

const reg = (id, dias, extra = {}) => ({
  id, pessoaId: "p1", criadoEm: diasAtras(dias),
  ocorridoEm: diasAtras(dias).slice(0, 10), ...extra,
});

test("combinado: pega o combinado aberto mais recente", () => {
  const lista = [
    reg("velho", 200, { combinado: "A" }),
    reg("novo", 10, { combinado: "B" }),
  ];
  assert.equal(combinadoEmAberto(lista)?.id, "novo");
});

test("combinado: combinado com desfecho não está mais em aberto", () => {
  const lista = [reg("x", 10, { combinado: "A", desfecho: "resolveu" })];
  assert.equal(combinadoEmAberto(lista), null);
});

test("combinado: registro sem combinado não conta", () => {
  assert.equal(combinadoEmAberto([reg("x", 5)]), null);
});

test("combinado: prazo passado = vencido", () => {
  const f = { combinado: "A", combinadoPrazo: diasAtras(5).slice(0, 10), criadoEm: diasAtras(40) };
  assert.equal(combinadoVencido(f, HOJE), true);
});

test('combinado — O CASO QUE IMPORTA: "na próxima peça" NUNCA vence por calendário', () => {
  // Foi o prazo que o encarregado pediu: vence no encontro, não no relógio.
  const f = { combinado: "A", combinadoPrazo: null, combinadoGatilho: "proxima-peca", criadoEm: diasAtras(400) };
  assert.equal(combinadoVencido(f, HOJE), false);
});

test("combinado: sem prazo e sem gatilho não vence", () => {
  assert.equal(combinadoVencido({ combinado: "A", criadoEm: diasAtras(400) }, HOJE), false);
});

// ------------------------------------------------------------ cadenciaDaPessoa

test("cadenciaDaPessoa: em experiência tem cadência mais curta que o padrão", () => {
  // Com 90 dias uniformes, o 1º feedback caía no MESMO dia em que o contrato
  // vira indeterminado — e a decisão de efetivar chegava sem conversa escrita.
  assert.equal(cadenciaDaPessoa({ emExperiencia: true }), 30);
  assert.ok(cadenciaDaPessoa({ emExperiencia: true }) < CADENCIA_FEEDBACK_DIAS);
});

test("cadenciaDaPessoa: com plano aberto, 45; sem nada, o padrão", () => {
  assert.equal(cadenciaDaPessoa({ comPlanoAberto: true }), 45);
  assert.equal(cadenciaDaPessoa({}), CADENCIA_FEEDBACK_DIAS);
});

test("cadenciaDaPessoa: experiência manda sobre plano — é o prazo mais curto e o mais caro", () => {
  assert.equal(cadenciaDaPessoa({ emExperiencia: true, comPlanoAberto: true }), 30);
});

// -------------------------------------------------------------- montarConteudo

test("montarConteudo: junta fato, efeito e combinado num texto legível", () => {
  const t = montarConteudo({
    oQueAconteceu: "Soldou fora do esquadro.", efeito: "Retrabalho",
    combinado: "Conferir o gabarito antes de soldar", combinadoPrazo: "2026-09-15",
  });
  assert.ok(t.includes("Soldou fora do esquadro."));
  assert.ok(t.includes("No que deu: Retrabalho."));
  assert.ok(t.includes("Conferir o gabarito"));
  assert.ok(t.includes("15/09"));
});

test('montarConteudo: NÃO escreve "ele respondeu" — anotação unilateral como fala do trabalhador derruba o registro', () => {
  const t = montarConteudo({ oQueAconteceu: "x", efeito: "Retrabalho" });
  assert.ok(!t.toLowerCase().includes("respondeu"));
});

test('montarConteudo: "na próxima peça" aparece como gatilho, não como data', () => {
  const t = montarConteudo({
    oQueAconteceu: "x", combinado: "conferir", combinadoGatilho: "proxima-peca", combinadoPrazo: null,
  });
  assert.ok(t.includes("na próxima peça"));
});

test("montarConteudo: elogio sem combinado não inventa combinado", () => {
  const t = montarConteudo({ oQueAconteceu: "Entrou de primeira.", efeito: "Entrou de primeira" });
  assert.ok(!t.includes("Combinado"));
});

// -------------------------------------------- conversa com a equipe conta diferente
// Na origem a marca era `grupoId: "g1"`; na MinasLab é `tipo: "equipe"`.

const eq = (id, dias) =>
  ({ id, pessoaId: "p1", criadoEm: diasAtras(dias), tipo: "equipe" });

test("equipe — O CASO QUE IMPORTA: elogio coletivo NÃO zera o relógio da cadência", () => {
  /* Se zerasse, bastaria um elogio à equipe por trimestre para o quadro
     inteiro aparecer "em dia" sem ninguém nunca ter tido uma conversa sobre o
     próprio trabalho — o módulo viraria teatro. */
  const so = cadenciaDe([eq("g", 5)], diasAtras(900).slice(0, 10), HOJE);
  assert.equal(so.situacao, "atrasado");
});

test('equipe: mas tira de "nunca recebeu" — houve conversa, e ela ouviu', () => {
  const nunca = cadenciaDe([], diasAtras(20).slice(0, 10), HOJE);
  assert.equal(nunca.situacao, "nunca");
  const comEquipe = cadenciaDe([eq("g", 5)], diasAtras(20).slice(0, 10), HOJE);
  assert.equal(comEquipe.ultimo?.id, "g"); // aparece como último contato
});

test("equipe: feedback individual manda sobre o coletivo no relógio", () => {
  const r = cadenciaDe([eq("g", 1), fb("ind", 10)], diasAtras(900).slice(0, 10), HOJE);
  assert.equal(r.situacao, "em-dia");
  assert.equal(r.diasDesde, 10); // conta do individual, não do coletivo
});

// -------------------------- feedback de TREINAMENTO não é conversa de trabalho

const trein = (id, dias) =>
  ({ id, pessoaId: "p1", criadoEm: diasAtras(dias), tipo: "individual", origem: "treinamento" });

test("treinamento — O CASO QUE IMPORTA: elogio no fim de um curso não zera o relógio da conversa", () => {
  /* Se zerasse, o RH abriria a ficha na hora de decidir efetivação e leria
     "conversou há 5 dias" — quando o que houve foi um elogio de turma. */
  const r = cadenciaDe([trein("t", 5)], diasAtras(900).slice(0, 10), HOJE);
  assert.equal(r.situacao, "atrasado");
});

test("treinamento: conversa de trabalho individual continua contando normalmente", () => {
  const r = cadenciaDe([trein("t", 1), fb("ind", 10)], diasAtras(900).slice(0, 10), HOJE);
  assert.equal(r.situacao, "em-dia");
  assert.equal(r.diasDesde, 10);
});

// ------------------------------------------------------ preparar não é conversar
/* A regra mais importante das três etapas. Se um feedback PREPARADO contasse
   como dado, preparar tiraria a pessoa da fila sem ninguém ter falado com
   ela — e a tela passaria a dizer "em dia" para quem espera há meses. É o
   pior defeito possível numa tela cuja função é lembrar de conversar. */

const basePreparo = { id: "f1", pessoaId: "ana", criadoEm: "2026-08-19T12:00:00Z" };

test("preparar: preparado NÃO conta como dado", () => {
  assert.equal(jaFoiDado({ ...basePreparo, preparadoEm: "2026-08-19" }), false);
});

test("preparar: agendado ainda NÃO conta", () => {
  assert.equal(jaFoiDado({ ...basePreparo, preparadoEm: "2026-08-19", agendadaPara: "2026-08-22" }), false);
});

test("preparar: com a conversa ocorrida, conta", () => {
  assert.equal(jaFoiDado({ ...basePreparo, preparadoEm: "2026-08-19", agendadaPara: "2026-08-22", ocorridoEm: "2026-08-22" }), true);
});

test("preparar: registro ANTIGO (sem nenhuma das datas novas) conta como dado", () => {
  /* Na época só se registrava depois da conversa. Exigir `ocorridoEm`
     jogaria o histórico inteiro para "nunca recebeu". */
  assert.equal(jaFoiDado({ ...basePreparo, ocorridoEm: undefined }), true);
});

test("preparar: a FILA ignora o preparado: quem só tem preparo continua atrasado", () => {
  const soPreparado = [{ ...basePreparo, preparadoEm: "2026-08-19", agendadaPara: "2026-08-22" }];
  const c = cadenciaDe(soPreparado, "2020-01-01", new Date(2026, 7, 19, 12));
  assert.equal(c.situacao, "atrasado");
  assert.equal(c.ultimo, null);
});

test("preparar: depois da conversa, a fila zera", () => {
  const dado = [{ ...basePreparo, preparadoEm: "2026-08-01", agendadaPara: "2026-08-05", ocorridoEm: "2026-08-05" }];
  const c = cadenciaDe(dado, "2020-01-01", new Date(2026, 7, 19, 12));
  assert.equal(c.situacao, "em-dia");
});
