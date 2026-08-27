// Portado de rh/src/lib/clt.ts (Impresilk) em 27/08/2026 — regras idênticas, campos adaptados à MinasLab.
// ============================================================================
// Prazos da CLT que custam dinheiro se passarem batido.
//
// O app avisava sobre documento e NR vencendo, mas não sobre os dois prazos com
// multa direta:
//
// 1) FÉRIAS (CLT art. 134 e 137). A cada 12 meses trabalhados a pessoa ganha
//    direito a 30 dias ("período aquisitivo"). A empresa tem os 12 meses
//    SEGUINTES para conceder ("período concessivo"). Passou disso, paga as
//    férias EM DOBRO — e ainda cabe multa. Ninguém enxergava esse relógio.
//
// 2) CONTRATO DE EXPERIÊNCIA (CLT art. 445, § único). No máximo 90 dias, com no
//    máximo uma prorrogação. Se o dia 90 passa e a pessoa continua trabalhando,
//    o contrato vira automaticamente por prazo INDETERMINADO — some a saída sem
//    custo e passa a valer aviso prévio e multa do FGTS. É preciso decidir ANTES.
//
// Tudo é calculado a partir da data de admissão e dos períodos de férias já
// lançados. Nenhum campo novo é exigido de quem usa.
//
// Campos da MinasLab (a origem usava os da Impresilk):
//   pessoa: { admissao, desligadoEm, ativo, experienciaDecididaEm }
//   férias: { inicio, retorno (dia em que a pessoa VOLTA), abonoDias?,
//             status: "marcada" | "concluida" | "cancelada" }
// ============================================================================

const DIA = 86_400_000;
/** Dias de férias por período aquisitivo completo (CLT art. 130, I). */
export const DIAS_FERIAS = 30;

// Parser local (na origem vinha de "@/lib/format"). "AAAA-MM-DD" — pura ou como
// começo de um ISO com hora — vira Date LOCAL de meia-noite: senão o JS lê a
// data pura como meia-noite UTC e, em fusos atrás de UTC (Brasil), o dia
// "volta" um (admissão 02/06 vira 01/06). Vazio/inválido devolve null.
function parseData(data) {
  if (!data) return null;
  if (data instanceof Date) return isNaN(data.getTime()) ? null : data;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data).trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/* Ancorado no início do dia dos DOIS lados. Com a conta crua, `hoje` carrega a
   hora atual e o prazo mudava de resposta ao longo do dia: no 90º dia do
   contrato de experiência, de manhã faltava 1 dia para decidir e depois das 12h
   o app já declarava EXPIRADO — no dia em que ainda dava para agir. */
const dias = (de, ate) => {
  const a = new Date(de.getFullYear(), de.getMonth(), de.getDate()).getTime();
  const b = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate()).getTime();
  return Math.round((b - a) / DIA);
};
const somaMeses = (d, m) => {
  const r = new Date(d.getTime());
  r.setMonth(r.getMonth() + m);
  return r;
};
// "AAAA-MM-DD" do dia LOCAL — o mesmo formato do `inicio` dos registros, para
// quem consome `gozosCreditados` casar gozo com registro sem conta de fuso.
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ------------------------------- férias -------------------------------------
/**
 * @typedef {Object} SituacaoFerias
 * @property {Date} aquisitivoInicio Início do período aquisitivo aberto (o 12º mês mais recente já completado).
 * @property {Date} direitoDesde Data em que o direito nasceu (fim do aquisitivo).
 * @property {Date} limiteConcessao Último dia para a empresa conceder sem pagar em dobro.
 * @property {number} diasParaLimite Dias até o limite (negativo = já passou).
 * @property {boolean} jaGozou Já gozou férias dentro deste período concessivo?
 * @property {number} diasGozados Dias já gozados neste período (0 a 30).
 * @property {number} diasEmAberto Dias que ainda faltam conceder — é o que vira pagamento em dobro.
 * @property {number} diasAgendados Dias já LANÇADOS para uma data futura. Não quitam nada (agendar não é
 *   gozar), mas a tela precisa saber que existem: sem isso ela repetiria
 *   "VENCIDAS há 247 dias" para quem já tem as férias marcadas, e quem lançou
 *   acharia que o sistema não registrou.
 * @property {Date|null} agendadoPara A data agendada mais próxima, quando houver.
 * @property {string[]} gozosCreditados Inícios ("AAAA-MM-DD", dia LOCAL) dos gozos que o FIFO
 *   creditou A ESTE período. Existe para a tela contar frações pela ATRIBUIÇÃO,
 *   não pela data crua: um gozo atrasado do período ANTERIOR também tem início
 *   depois de `direitoDesde`, e contá-lo como fração do aberto barrava um
 *   agendamento legítimo com "a CLT não permite um quarto". Só expõe o que o
 *   laço do FIFO já sabia — nenhuma regra muda.
 * @property {"em-dia"|"a-vencer"|"vencida"|"sem-registro"} situacao
 */

/* MinasLab não guarda `diasGozados`: os dias saem do próprio registro — a
   diferença de dias de calendário entre `inicio` e `retorno` (retorno é o dia
   em que a pessoa VOLTA: 10→25 do mês = 15 dias), somada ao `abonoDias` quando
   houver. O abono pecuniário (CLT art. 143) sai do MESMO saldo de 30 dias;
   sem somá-lo, quem tirou 20 e vendeu 10 apareceria devendo 10 pagos em dobro.
   Registro com `inicio` e SEM `retorno` é o "gozo sem dias" da base antiga da
   origem: dias = 0 e vale a mesma regra (quita período intocado, não engole
   crédito parcial). */
const diasDoRegistro = (f) => {
  const ini = parseData(f.inicio);
  const ret = parseData(f.retorno);
  if (!ini || !ret) return 0; // sem retorno = "gozo sem dias" da base antiga
  return dias(ini, ret) + (Number(f.abonoDias) || 0);
};

/**
 * A partir de quando este sistema TEM histórico de férias.
 *
 * Existe porque a conta abaixo só sabe o que está lançado, e o app começou a
 * guardar férias muito depois de a empresa existir. Sem esse corte, quem tem
 * dez anos de casa aparecia com "férias VENCIDAS há 3.847 dias" — não porque
 * nunca tirou, mas porque as férias antigas nunca foram digitadas aqui.
 *
 * Medido em produção: das 12 pessoas apontadas como vencidas, TODAS as 12
 * tinham o limite de concessão anterior ao primeiro registro do banco. Ou seja,
 * o alerta era 100% ruído — e ruído em alerta de multa é pior que alerta
 * nenhum, porque ensina a ignorar.
 *
 * O corte sai do próprio dado: o registro de férias mais antigo que existe.
 * Conforme a empresa lançar histórico para trás, o corte anda junto sozinho.
 */
export function inicioDoHistorico(ferias) {
  let menor = null;
  for (const f of ferias) {
    const d = parseData(f.inicio);
    if (d && (!menor || d.getTime() < menor.getTime())) menor = d;
  }
  return menor;
}

/**
 * Situação das férias de uma pessoa hoje.
 * `null` quando não dá para calcular (sem admissão) ou ainda não completou 1 ano.
 *
 * @param {Object} p pessoa (admissao, desligadoEm)
 * @param {Object[]} feriasDaPessoa registros de férias dela
 * @param {Date} [hoje]
 * @param {Date|null} [desde] Antes desta data o sistema não tem histórico — ver inicioDoHistorico().
 * @returns {SituacaoFerias|null}
 */
export function situacaoFerias(p, feriasDaPessoa, hoje = new Date(), desde = null) {
  const adm = parseData(p.admissao);
  if (!adm) return null;
  // Quem saiu tem o relógio parado no último dia. Sem isto a ficha de um
  // desligado continuava abrindo período aquisitivo novo contra hoje e o
  // "vencidas há N dias" crescia sozinho todo dia — em 53 pessoas inativas.
  const saida = parseData(p.desligadoEm);
  const ate = saida && saida.getTime() < hoje.getTime() ? saida : hoje;
  const mesesDeCasa = Math.floor(dias(adm, ate) / 30.44);
  if (mesesDeCasa < 12) return null; // ainda no primeiro período aquisitivo

  // Cada gozo, com QUANTOS dias foram tirados. A conta antiga só perguntava se
  // EXISTIA um gozo na janela — quem tirou 15 dias dos 30 era marcado como
  // resolvido, o aviso sumia e o Resumo 360º estampava "Nada pendente" enquanto
  // a própria aba Férias mostrava "Saldo 15 dias". Esses 15 vencem no mesmo
  // prazo e também são pagos EM DOBRO. Agora só quita o período quem somou 30.
  const todosOsRegistros = feriasDaPessoa
    .filter((f) => f.status !== "cancelada")
    .map((f) => ({ inicio: parseData(f.inicio), dias: diasDoRegistro(f) }))
    .filter((g) => !!g.inicio);

  /* AGENDAR NÃO É GOZAR. Só quita o período o que JÁ COMEÇOU — quem decide isso
     é a DATA, não o texto do status: "marcada" é digitado à mão e ninguém volta
     para trocar depois que a pessoa saiu de férias.
     Sem esta separação, bastava lançar 30 dias para o ano que vem e o "VENCIDAS
     há N dias — por lei o pagamento é em dobro" sumia no mesmo instante da
     ficha, do sino e do calendário, com a dívida do art. 137 intacta. Pior: era
     mais fácil apagar o alerta do que resolvê-lo. */
  const gozos = todosOsRegistros.filter((g) => g.inicio.getTime() <= ate.getTime());
  const agendados = todosOsRegistros.filter((g) => g.inicio.getTime() > ate.getTime());

  // Percorre TODOS os períodos aquisitivos já completos, do mais antigo para o
  // mais novo, e reporta o PRIMEIRO que ainda não foi gozado — é ele que corre
  // risco de vencer. Olhar só o período mais recente escondia justamente o caso
  // grave: quem acumulou um período antigo nunca tirado (o que paga em dobro).
  const ciclos = Math.floor(mesesDeCasa / 12);
  const periodos = Array.from({ length: ciclos }, (_, k) => {
    const i = k + 1;
    const direitoDesde = somaMeses(adm, i * 12);
    return {
      aquisitivoInicio: somaMeses(adm, (i - 1) * 12),
      direitoDesde,
      limiteConcessao: somaMeses(direitoDesde, 12),
      creditados: 0,
      gozoSemDias: false,
      gozosCreditados: [], // inícios ("AAAA-MM-DD") dos gozos que o FIFO creditar aqui
    };
  });

  /* Cada dia gozado abate o período EM ABERTO MAIS ANTIGO cujo direito já havia
     nascido na data do gozo (FIFO — é assim que se acerta férias atrasadas).
     Férias partidas em 15+15 somam, e um gozo grande transborda para o período
     seguinte.
   *
   * Antes, cada período só olhava os gozos dentro de uma janela fixa de 24 meses
   * (12 de concessão + 12 de atraso tolerado). Quem regularizou com MAIS atraso
   * que isso — que é justamente quem estava pior — nunca quitava o período: o
   * gozo caía fora da janela, era creditado ao período seguinte, e a ficha
   * seguia estampando "Férias VENCIDAS há 940 dia(s)" para alguém que tinha
   * tirado as férias. O aviso não tinha como sair da tela, e ainda afirmava
   * "por lei, o pagamento é em dobro" sobre um período já concedido.
   *
   * A data do gozo continua importando para uma coisa só: ninguém goza um
   * período cujo direito ainda não nasceu. */
  /* Período que o sistema NÃO TEM COMO JULGAR, porque não enxergou a janela em
     que essas férias poderiam ter sido concedidas. Não está "em aberto": é
     DESCONHECIDO. Não recebe abatimento (senão um gozo de 2026 quitaria um
     período de 2015 sobre o qual não se sabe nada) e não vira alarme.
   *
   * A comparação é com o NASCIMENTO DO DIREITO, não com o limite de concessão.
   * A janela para gozar o período vai de `direitoDesde` até `limiteConcessao`;
   * se o histórico começa no meio dela, o sistema viu só o fim e não pode
   * afirmar que as férias não foram tiradas no trecho que lhe escapou.
   *
   * Medido em produção (10/08/2026): comparando com o limite, 12 das 32 pessoas
   * no quadro apareciam como VENCIDAS — e nas 12 o direito nascera ANTES do
   * primeiro registro da base. Pior, a regra era instável: bastou a base ganhar
   * um registro de 2023 para o corte recuar e rearmar os 12 alertas falsos de
   * uma vez. Uma pessoa admitida em 2014 recebia "VENCIDAS há 940 dias — o
   * pagamento é em dobro" por um período que o sistema nunca teve como conferir. */
  /* Até onde o sistema pode AFIRMAR que umas férias não foram tiradas.
   *
   * Duas situações, e elas são diferentes:
   *
   * a) Quem foi admitido DEPOIS de o sistema passar a registrar férias: a vida
   *    inteira dessa pessoa na empresa está sob observação. Não ter registro é
   *    achado de verdade — vale o alerta.
   *
   * b) Quem já estava na casa ANTES disso: o sistema perdeu os primeiros anos.
   *    Aí ele só responde por aquilo que enxergou, ou seja, a partir do primeiro
   *    registro DAQUELA pessoa. Antes disso a resposta honesta é "não sei".
   *
   * Sem essa distinção, o alerta era ruído: em 10/08/2026, `desde` valia
   * 23/11/2023 por causa de UM registro solto — a base inteira tinha 4 férias
   * concluídas e 25 registros sem data nenhuma. O sistema afirmava, sobre 12 das
   * 32 pessoas no quadro, que elas não tiraram férias, inferindo dívida
   * trabalhista da ausência de dado num sistema que mal começara a ser usado. */
  const inicios = todosOsRegistros.map((g) => g.inicio.getTime());
  const primeiroRegistroDaPessoa = inicios.length ? Math.min(...inicios) : null;
  const jaEstavaNaCasa = !!desde && adm.getTime() < desde.getTime();
  const desconhecido = (per) => {
    if (!desde) return false;      // sem corte informado, o chamador quer a conta crua
    if (!jaEstavaNaCasa) return false; // (a) entrou sob observação: julga tudo
    // (b) o sistema perdeu o começo: só responde a partir do 1º registro dela.
    if (primeiroRegistroDaPessoa === null) return true;
    return per.direitoDesde.getTime() < primeiroRegistroDaPessoa;
  };

  for (const g of [...gozos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime())) {
    let restante = g.dias;
    for (const per of periodos) {
      if (per.direitoDesde.getTime() > g.inicio.getTime()) break; // direito ainda não nascido
      if (desconhecido(per)) continue;
      const quitado = per.gozoSemDias || per.creditados >= DIAS_FERIAS;
      if (quitado) continue;
      /* Base antiga: gozo lançado sem `retorno` (não dá para derivar os dias).
         Não dá para somar nada, mas também não dá para ignorar — senão o
         sistema passaria a gritar com todo registro antigo. Vale como quitação
         do período mais antigo em aberto…
         …mas SÓ se o período estiver intocado. Num período que já recebeu 15
         dias, deixar o registro sem dias "quitar" apagava os outros 15 — que a
         empresa ainda deve, e que vencem pagos em dobro. */
      if (g.dias === 0) {
        if (per.creditados === 0) { per.gozoSemDias = true; per.gozosCreditados.push(ymd(g.inicio)); break; }
        continue;
      }
      if (restante <= 0) break;
      const usa = Math.min(DIAS_FERIAS - per.creditados, restante);
      per.creditados += usa;
      // Um gozo grande que transborda aparece em CADA período que abateu.
      per.gozosCreditados.push(ymd(g.inicio));
      restante -= usa;
    }
  }

  let ultimo = null;
  for (const per of periodos) {
    const jaGozou = per.gozoSemDias || per.creditados >= DIAS_FERIAS;
    const diasParaLimite = dias(ate, per.limiteConcessao);
    // Sem registro no período: não dá para dizer que venceu, só que não está
    // aqui. Afirmar "venceu" seria inventar; some do alerta e vira informação.
    const foraDoHistorico = !jaGozou && desconhecido(per);
    const situacao = jaGozou
      ? "em-dia"
      : foraDoHistorico ? "sem-registro"
      : diasParaLimite < 0 ? "vencida" : diasParaLimite <= 90 ? "a-vencer" : "em-dia";
    const atual = {
      aquisitivoInicio: per.aquisitivoInicio,
      direitoDesde: per.direitoDesde,
      limiteConcessao: per.limiteConcessao,
      diasParaLimite,
      jaGozou,
      diasGozados: per.gozoSemDias ? DIAS_FERIAS : per.creditados,
      diasEmAberto: Math.max(0, DIAS_FERIAS - (per.gozoSemDias ? DIAS_FERIAS : per.creditados)),
      diasAgendados: agendados.reduce((s, g) => s + g.dias, 0),
      agendadoPara: agendados.length
        ? agendados.reduce((a, b) => (a.inicio.getTime() <= b.inicio.getTime() ? a : b)).inicio
        : null,
      gozosCreditados: per.gozosCreditados,
      situacao,
    };
    // O mais antigo EM ABERTO é o que importa — mas um período sem histórico
    // não é "em aberto", é desconhecido. Parar nele escondia o período seguinte,
    // que o sistema tem como julgar de verdade.
    if (!jaGozou && situacao !== "sem-registro") return atual;
    ultimo = atual;
  }
  return ultimo; // todos gozados: devolve o último, marcado como em dia
}

// -------------------------- contrato de experiência --------------------------
export const LIMITE_EXPERIENCIA_DIAS = 90;
/**
 * Marcos usados no aviso: 45 dias (decidir prorrogar) e 90 (decidir efetivar).
 * @typedef {Object} SituacaoExperiencia
 * @property {number} diasDeCasa
 * @property {Date} fim Dia em que completa os 90 dias.
 * @property {number} diasParaFim
 * @property {"primeiro-periodo"|"decidir-prorrogacao"|"decidir-efetivacao"|"expirou"} situacao
 */

/**
 * O FIM DA EXPERIÊNCIA — que é o fim do onboarding.
 *
 * `situacaoExperiencia` existe para AVISAR e por isso devolve `null` em vários
 * casos (já decidida, desligado, mais de 15 dias do prazo). O onboarding
 * precisa de outra coisa: o fato cru de quando a experiência acaba, mesmo
 * quando não há mais nada a decidir — é esse o marco que encerra a integração
 * da pessoa e libera o cartão da tela.
 *
 * @typedef {Object} FimExperiencia
 * @property {Date|null} fim Dia em que os 90 dias se completam. `null` sem data de admissão.
 * @property {number} diasParaFim Dias até lá (negativo = já passou). NaN quando não dá para calcular.
 * @property {boolean} encerrada Os 90 dias já passaram?
 * @property {boolean} decidida A direção já decidiu (efetivou/prorrogou) ou a pessoa saiu.
 */
export function fimDaExperiencia(p, hoje = new Date()) {
  const adm = parseData(p.admissao);
  const decidida = !!p.experienciaDecididaEm || !!p.desligadoEm;
  if (!adm) return { fim: null, diasParaFim: NaN, encerrada: false, decidida };
  const fim = new Date(adm.getTime() + LIMITE_EXPERIENCIA_DIAS * DIA);
  const diasParaFim = dias(hoje, fim);
  return { fim, diasParaFim, encerrada: diasParaFim < 0, decidida };
}

/**
 * Situação do contrato de experiência. `null` se já passou dos 90 dias há muito
 * tempo (aí é contrato normal e não há o que avisar) ou sem data de admissão.
 * @returns {SituacaoExperiencia|null}
 */
export function situacaoExperiencia(p, hoje = new Date()) {
  const adm = parseData(p.admissao);
  if (!adm) return null;
  // Já decidido (efetivado/prorrogado) ou já fora do quadro: não há o que
  // decidir, e insistir fazia o RH clicar de novo em "Efetivar" — duplicando a
  // movimentação de carreira toda vez.
  if (p.experienciaDecididaEm || p.desligadoEm || p.ativo === false) return null;
  const diasDeCasa = dias(adm, hoje);
  if (diasDeCasa < 0) return null;
  const fim = new Date(adm.getTime() + LIMITE_EXPERIENCIA_DIAS * DIA);
  const diasParaFim = dias(hoje, fim);
  // Passou mais de 15 dias do prazo: o contrato já virou indeterminado, não há
  // mais decisão a tomar — para de avisar para não virar ruído eterno.
  if (diasParaFim < -15) return null;

  const situacao =
    diasParaFim < 0 ? "expirou"
      : diasDeCasa >= 45 - 10 && diasDeCasa <= 45 + 5 ? "decidir-prorrogacao"
        : diasParaFim <= 15 ? "decidir-efetivacao"
          : "primeiro-periodo";
  return { diasDeCasa, fim, diasParaFim, situacao };
}
