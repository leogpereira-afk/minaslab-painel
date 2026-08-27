// Portado de rh/src/lib/feedbackCadencia.ts (Impresilk) em 27/08/2026 — regras idênticas, campos adaptados à MinasLab.
//
// ============================================================================
// DE QUANTO EM QUANTO TEMPO CADA PESSOA PRECISA DE FEEDBACK.
//
// A coleção de feedbacks existe desde sempre e tinha QUATRO registros, para três
// pessoas, num quadro de trinta. Não é que ninguém converse — é que a conversa
// não fica registrada, e sem registro não há como saber de quem faz meses que
// não se fala. A tela de feedback não é um arquivo: é a FILA de quem está
// esperando.
//
// A cadência de 90 dias é uma escolha, não uma lei. É o intervalo em que a
// conversa ainda tem contexto (o que aconteceu no trimestre) e cabe na rotina de
// um líder com dez pessoas. Se quiser outro ritmo, muda aqui.
//
// O relógio começa na ADMISSÃO, não no zero. Quem entrou há uma semana não está
// "atrasado" por nunca ter recebido feedback — está no prazo, e tratar isso como
// dívida encheria a fila de gente que acabou de chegar e esvaziaria o sentido do
// aviso.
//
// Adaptação MinasLab: conversa com a equipe é `tipo === "equipe"` (na origem era
// `grupoId`); fala de curso é `origem === "treinamento"` (na origem, qualquer
// `origem` preenchida). A regra é a mesma; só o nome do campo muda.
// ============================================================================

// --- Dependências da origem, implementadas locais (sem import de fora de rh/) ---

// Parser de datas robusto a fuso horário. Strings "AAAA-MM-DD" (date-only, como
// admissão) são lidas como data LOCAL — senão o JS as interpreta como meia-noite
// UTC e, em fusos atrás de UTC (Brasil), o dia/mês "voltam" um dia (ex.:
// admissão 02/06 vira 01/06). Datas com hora/Z seguem o parse nativo.
// @param {Date|string|null|undefined} data
// @returns {Date|null}
function parseData(data) {
  if (!data) return null;
  if (data instanceof Date) return isNaN(data.getTime()) ? null : data;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data).trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(data);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Diferença em DIAS DE CALENDÁRIO entre `de` e uma data (negativo = passado).
 *
 * Por que não subtrair os instantes: `parseData("2026-08-05")` devolve
 * MEIA-NOITE local e `new Date()` carrega a hora atual. Depois do meio-dia a
 * diferença passava de -0,4 para -0,6 dia e o arredondamento virava -1: um
 * prazo que vence HOJE aparecia como "vencido há 1 dia" a partir das 12h, e
 * quem lê às 9h e às 15h via números diferentes para o mesmo dado. Ancorando
 * os dois no início do dia, "vence hoje" dá 0 o dia inteiro.
 * @param {Date|string|null|undefined} ate
 * @param {Date} [de]
 * @returns {number} NaN quando `ate` é ilegível
 */
function diasDeCalendario(ate, de = new Date()) {
  const d = parseData(ate);
  if (!d) return NaN;
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(de.getFullYear(), de.getMonth(), de.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

export const CADENCIA_FEEDBACK_DIAS = 90;
/** Quantos dias antes do prazo a pessoa já aparece como "chegando a hora". */
const JANELA_AVISO_DIAS = 15;

/**
 * @typedef {Object} FeedbackLike
 * @property {string} id
 * @property {string} pessoaId
 * @property {string} criadoEm
 * @property {"individual"|"equipe"} [tipo]  Conversa com a EQUIPE: mesmo texto em várias fichas.
 * @property {string|null} [autorId]
 * @property {string} [conteudo]
 * @property {"trabalho"|"treinamento"|null} [origem]  "treinamento" = fala do curso, não do serviço do dia a dia.
 * @property {string|null} [preparadoEm]   As três etapas — ver jaFoiDado.
 * @property {string|null} [agendadaPara]
 * @property {string|null} [ocorridoEm]
 */

/** @typedef {"nunca"|"atrasado"|"a-vencer"|"em-dia"} SituacaoFeedback */

/**
 * Esta conversa ACONTECEU?
 *
 * Feedback preparado ou agendado ainda não é feedback dado, e tratar como se
 * fosse seria o pior defeito possível nesta tela: preparar tiraria a pessoa da
 * fila sem ninguém ter falado com ela, e o sistema passaria a dizer "em dia"
 * para quem está esperando há meses.
 *
 * Registro ANTIGO não tem nenhuma das datas novas — e esse conta como dado,
 * porque na época só se registrava depois da conversa. Exigir `ocorridoEm`
 * jogaria o histórico inteiro para "nunca recebeu".
 * @param {{preparadoEm?: string|null, agendadaPara?: string|null, ocorridoEm?: string|null}} f
 * @returns {boolean}
 */
export function jaFoiDado(f) {
  if (f.ocorridoEm) return true;
  // Só está "em preparo" quem foi explicitamente preparado ou agendado.
  return !f.preparadoEm && !f.agendadaPara;
}

/**
 * @typedef {Object} Cadencia
 * @property {FeedbackLike|null} ultimo  O feedback mais recente desta pessoa, se houver.
 * @property {number|null} diasDesde  Dias desde o último feedback — ou desde a admissão, quando nunca houve.
 * @property {number|null} diasParaProximo  Dias até o próximo (negativo = já passou).
 * @property {SituacaoFeedback} situacao
 */

/**
 * O mais recente da lista, por `criadoEm`. Empate: o último da lista.
 * @param {readonly FeedbackLike[]} lista
 * @returns {FeedbackLike|null}
 */
/* A DATA de um feedback é a da CONVERSA (ocorridoEm); criadoEm só vale para o
   registro antigo, de antes das etapas. Sem isso, o fluxo preparar→registrar
   reaproveitava o registro do preparo e o relógio contava do dia do PREPARO:
   quem preparou em maio e conversou em agosto voltava para a fila "atrasado"
   no mesmo instante em que registrava a conversa. */
export const dataDoFeedback = (f) => f?.ocorridoEm || f?.criadoEm || "";

export function ultimoFeedback(lista) {
  let melhor = null;
  for (const f of lista) {
    if (!dataDoFeedback(f)) continue;
    if (!melhor || dataDoFeedback(f) >= dataDoFeedback(melhor)) melhor = f;
  }
  return melhor;
}

/**
 * A situação de UMA pessoa.
 *
 * `admissao` é o marco de quem nunca recebeu feedback: sem ela não há como
 * dizer se o silêncio é dívida ou se a pessoa acabou de chegar, e nesse caso a
 * resposta honesta é "nunca" sem cobrar prazo.
 * @param {readonly FeedbackLike[]} feedbacksDaPessoa
 * @param {string|null} [admissao]
 * @param {Date} [hoje]
 * @param {number} [cadenciaDias] Cada pessoa pode ter um ritmo próprio (30 dias
 *   em experiência, 45 com plano aberto) — ver cadenciaDaPessoa. Sem passar,
 *   vale o padrão de 90.
 * @returns {Cadencia}
 */
export function cadenciaDe(
  feedbacksDaPessoa,
  admissao,
  hoje = new Date(),
  cadenciaDias = CADENCIA_FEEDBACK_DIAS,
) {
  /* CONVERSA COM A EQUIPE conta menos que conversa individual, e a diferença
     importa: ela tira a pessoa de "nunca recebeu" — porque de fato houve
     conversa e ela ouviu —, mas NÃO zera o relógio da cadência. Se zerasse,
     bastaria um elogio coletivo por trimestre para o quadro inteiro aparecer
     "em dia" sem ninguém nunca ter tido uma conversa sobre o próprio trabalho.
     O relógio individual segue contando a partir do último feedback INDIVIDUAL. */
  // Só conversa que ACONTECEU move o relógio — ver jaFoiDado.
  const dados = feedbacksDaPessoa.filter(jaFoiDado);
  const ultimo = ultimoFeedback(dados);
  /* O relógio da cadência conta só a CONVERSA SOBRE O TRABALHO: individual e
     que não veio de treinamento. Feedback de treinamento fala do curso que a
     pessoa fez; tratá-lo como conversa de trabalho faria o histórico dizer que
     houve conversa quando o que houve foi um elogio no fim de um treinamento —
     e o RH leria a ficha errado na hora de decidir efetivação ou promoção. */
  const ultimoIndividual = ultimoFeedback(
    dados.filter((f) => f.tipo !== "equipe" && f.origem !== "treinamento"),
  );
  // O relógio conta da CONVERSA, não do registro — ver dataDoFeedback.
  const marco = dataDoFeedback(ultimoIndividual) || admissao || null;
  if (!marco) return { ultimo, diasDesde: null, diasParaProximo: null, situacao: "nunca" };

  // `diasDeCalendario` ancora no início do dia — a conta crua de milissegundos
  // faria o mesmo registro dizer "89 dias" de manhã e "90" depois do almoço.
  const desde = -diasDeCalendario(marco, hoje);
  if (isNaN(desde)) return { ultimo, diasDesde: null, diasParaProximo: null, situacao: "nunca" };

  const diasParaProximo = cadenciaDias - desde;
  const situacao = !ultimoIndividual && diasParaProximo > 0
    // Nunca recebeu, mas ainda dentro do prazo desde que entrou: é "nunca" como
    // fato, não como cobrança. Quem lê precisa saber que não há histórico.
    ? "nunca"
    : diasParaProximo < 0 ? "atrasado"
      : diasParaProximo <= JANELA_AVISO_DIAS ? "a-vencer"
        : "em-dia";
  return { ultimo, diasDesde: desde, diasParaProximo, situacao };
}

/**
 * Ordem da fila: quem está esperando há mais tempo aparece primeiro.
 * @type {Record<SituacaoFeedback, number>}
 */
export const PESO_SITUACAO = {
  atrasado: 0, nunca: 1, "a-vencer": 2, "em-dia": 3,
};

/**
 * @param {Cadencia} a
 * @param {Cadencia} b
 * @returns {number}
 */
export function compararFila(a, b) {
  const p = PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao];
  if (p !== 0) return p;
  // Dentro do mesmo grupo, quem espera há mais tempo primeiro.
  return (b.diasDesde ?? -1) - (a.diasDesde ?? -1);
}

// ============================================================================
// O REGISTRO ESTRUTURADO — regras vindas da pesquisa e das duas críticas.
// ============================================================================

/** @typedef {"grave"|"sensivel"|null} MotivoBloqueio */

/* O QUE NÃO ENTRA NESTE REGISTRO.
 *
 * Duas listas que BLOQUEIAM a gravação e não deixam vestígio do texto. Avisar,
 * permitir e guardar seria a pior das três opções.
 *
 * GRAVE: assédio e agressão têm canal próprio — empresa com CIPA (NR-5) tem
 * dever de canal de recebimento e apuração com sigilo desde a Lei 14.457/2022,
 * art. 23. Denúncia colada no histórico de desempenho de qualquer uma das duas
 * pessoas é o pior desenho possível.
 *
 * SENSÍVEL: art. 11 da LGPD — saúde, religião, sindicato e deficiência são dado
 * pessoal SENSÍVEL, com base legal própria. Não entram num registro de conversa
 * sobre trabalho. */
export const PALAVRAS_BLOQUEIO_GRAVE = [
  "assédio", "assedio", "agrediu", "agressão", "agressao", "ameaçou", "ameacou",
  "ameaça", "ameaca", "brigou", "briga", "bêbado", "bebado", "embriagado",
  "droga", "roubou", "roubo", "furto", "furtou", "sem epi", "recusou o epi",
  "acidente",
];

export const PALAVRAS_BLOQUEIO_SENSIVEL = [
  "inss", "atestado", "médico", "medico", "doença", "doenca", "depressão",
  "depressao", "gravidez", "grávida", "gravida", "tratamento", "remédio",
  "remedio", "laudo", "psicólogo", "psicologo", "psiquiatra", "igreja",
  "religião", "religiao", "sindicato", "deficiência", "deficiencia",
];

export const EFEITO_ROTA_SEGURANCA = "Risco de segurança";

/**
 * Este texto pode ser gravado aqui?
 *
 * Avisar, permitir e guardar é a pior das três opções: assédio e agressão têm
 * canal próprio (Lei 14.457/2022, art. 23, para empresa com CIPA), e saúde,
 * religião, sindicato e deficiência são dado SENSÍVEL com base legal própria
 * (art. 11 da LGPD). Nos dois casos a gravação é BLOQUEADA e o texto não é
 * guardado em lugar nenhum.
 *
 * O que NÃO foi feito de propósito: aviso suave sobre adjetivos ("preguiçoso",
 * "relaxado", "vive fazendo"). Corrigir o jeito de falar de quem escreve produz
 * "conversamos, ok" — e o sistema perde o conteúdo. A proteção contra julgar a
 * pessoa é o RÓTULO do campo ("O que aconteceu", não "como ele é").
 * @param {string} texto
 * @returns {MotivoBloqueio}
 */
export function bloqueio(texto) {
  const t = ` ${String(texto ?? "").toLowerCase()} `;
  // Fronteira de palavra: sem isto "acidente" acha "acidentalmente" e
  // "droga" acha "drogaria" — bloqueio falso ensina a contornar a tela.
  const acha = (lista) =>
    lista.some((p) => new RegExp(`(^|[^a-zà-ú])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zà-ú]|$)`, "i").test(t));
  if (acha(PALAVRAS_BLOQUEIO_GRAVE)) return "grave";
  if (acha(PALAVRAS_BLOQUEIO_SENSIVEL)) return "sensivel";
  return null;
}

/** "Risco de segurança" não é etiqueta, é rota: fecha o feedback e abre o
 *  registro de segurança. Um combinado "usar o cinto" sem medida nenhuma é,
 *  numa ação de acidente, prova de que a empresa conhecia o risco e tolerou.
 *  @param {string|null} [efeito] */
export const ehRotaSeguranca = (efeito) => efeito === EFEITO_ROTA_SEGURANCA;

/**
 * @typedef {Object} CombinadoLike
 * @property {string} [combinado]
 * @property {string|null} [combinadoPrazo]
 * @property {string|null} [combinadoGatilho]
 * @property {string|null} [desfecho]
 * @property {string} [ocorridoEm]
 * @property {string} criadoEm
 */

/**
 * O combinado mais recente que ainda não teve desfecho.
 * @param {readonly CombinadoLike[]} lista
 * @returns {CombinadoLike|null}
 */
export function combinadoEmAberto(lista) {
  const abertos = lista.filter((f) => f.combinado && !f.desfecho);
  if (!abertos.length) return null;
  return [...abertos].sort((a, b) =>
    (b.ocorridoEm ?? b.criadoEm).localeCompare(a.ocorridoEm ?? a.criadoEm))[0];
}

/**
 * Venceu? "Na próxima peça" NUNCA vence por calendário — vence no encontro.
 * @param {CombinadoLike|null} f
 * @param {Date} [hoje]
 * @returns {boolean}
 */
export function combinadoVencido(f, hoje = new Date()) {
  if (!f?.combinado || f.desfecho) return false;
  if (f.combinadoGatilho === "proxima-peca") return false;
  if (!f.combinadoPrazo) return false;
  return diasDeCalendario(f.combinadoPrazo, hoje) < 0;
}

/* CADÊNCIA POR SITUAÇÃO. Os 90 dias uniformes faziam o primeiro feedback de um
   recém-contratado cair no dia 90 — o MESMO dia em que o contrato de
   experiência vira indeterminado sozinho, e a decisão de efetivar chegava sem
   nenhuma conversa escrita para sustentá-la. */
export const CADENCIA_EXPERIENCIA_DIAS = 30;
export const CADENCIA_PLANO_DIAS = 45;

/**
 * @param {{emExperiencia?: boolean, comPlanoAberto?: boolean}} opts
 *   `comPlanoAberto` vem de `pessoa.planoAberto` na MinasLab.
 * @returns {number}
 */
export function cadenciaDaPessoa(opts) {
  if (opts.emExperiencia) return CADENCIA_EXPERIENCIA_DIAS;
  if (opts.comPlanoAberto) return CADENCIA_PLANO_DIAS;
  return CADENCIA_FEEDBACK_DIAS;
}

/**
 * Monta o texto que as telas antigas leem e que a pessoa vê na ficha dela.
 * Sem "Ele respondeu: …" — anotação unilateral rotulada como fala do
 * trabalhador convida à alegação de falsidade e derruba o registro inteiro.
 * @param {{oQueAconteceu?: string, efeito?: string, combinado?: string,
 *   combinadoPrazo?: string|null, combinadoGatilho?: string|null}} r
 * @returns {string}
 */
export function montarConteudo(r) {
  const partes = [String(r.oQueAconteceu ?? "").trim()];
  if (r.efeito) partes.push(`No que deu: ${r.efeito}.`);
  if (r.combinado) {
    const quando = r.combinadoGatilho === "proxima-peca"
      ? "na próxima peça"
      : r.combinadoPrazo ? `até ${r.combinadoPrazo.slice(8, 10)}/${r.combinadoPrazo.slice(5, 7)}` : null;
    partes.push(`Combinado: ${r.combinado.trim()}${quando ? ` (${quando})` : ""}.`);
  }
  return partes.filter(Boolean).join(" ");
}
