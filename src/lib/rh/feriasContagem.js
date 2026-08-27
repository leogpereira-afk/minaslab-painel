// Portado de rh/src/lib/feriasContagem.ts (Impresilk) em 27/08/2026 — regras idênticas, campos adaptados à MinasLab.
//
// Adaptações além de nome de campo (detalhadas onde acontecem):
// - Status da MinasLab são só "marcada" | "concluida" | "cancelada". Não existe
//   "Em andamento": "marcada" vale tanto para gozo futuro quanto em curso, e a
//   incoerência "Agendada com gozo já começado" da origem deixa de existir.
// - A seção do prazo da CLT (limiteDeConcessao / prazoDeConcessao, art. 134)
//   NÃO veio: ela ancora no fim do período aquisitivo (periodoAquisitivoFim),
//   campo que o registro de férias da MinasLab não tem.
// ============================================================================
// O relógio das férias: quantos dias faltam, quantos já passaram.
//
// A tela mostrava datas cruas ("25/12/2025 → 05/01/2026") e deixava a conta
// para a cabeça de quem lê. Quem precisa saber "falta muito?" tinha de abrir o
// calendário e contar.
//
// Tudo aqui conta DIAS DE CALENDÁRIO, nunca instantes. Somar milissegundos
// contra `new Date()` faz a resposta mudar ao longo do dia: de manhã falta 1
// dia, depois das 12h o arredondamento vira 0 e a tela se contradiz entre a
// leitura das 9h e a das 15h.
// ============================================================================

/**
 * Converte "AAAA-MM-DD" (ou ISO com T) em Date LOCAL de meia-noite.
 * Devolve null para vazio/inválido. (Substitui o parseData de @/lib/format
 * da origem — mesma semântica para os formatos usados aqui.)
 * @param {Date|string|null|undefined} data
 * @returns {Date|null}
 */
export function parseData(data) {
  if (!data) return null;
  if (data instanceof Date) return isNaN(data.getTime()) ? null : data;
  if (typeof data !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(data.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(data);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Diferença em DIAS DE CALENDÁRIO entre `de` e uma data (negativo = passado).
 *
 * Por que não subtrair os instantes: parseData devolve MEIA-NOITE local e
 * `new Date()` carrega a hora atual. Depois do meio-dia a diferença passava de
 * -0,4 para -0,6 dia e o arredondamento virava -1: um prazo que vence HOJE
 * aparecia como "vencido há 1 dia" a partir das 12h, e quem lê às 9h e às 15h
 * via números diferentes para o mesmo dado. Ancorando os dois no início do
 * dia, "vence hoje" dá 0 o dia inteiro.
 * @param {Date|string|null|undefined} ate
 * @param {Date} [de]
 * @returns {number}
 */
export function diasDeCalendario(ate, de = new Date()) {
  const d = parseData(ate);
  if (!d) return NaN;
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(de.getFullYear(), de.getMonth(), de.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/**
 * "dd/mm/aaaa" a partir do dia LOCAL (substitui o formatDate da origem, que
 * usava Intl pt-BR — mesmo resultado, sem depender de locale instalado).
 * @param {Date|string|null|undefined} data
 * @returns {string}
 */
function formatData(data) {
  const d = parseData(data);
  if (!d) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/*
 * Fase — onde este período está na linha do tempo, comparado com hoje:
 *   "sem-gozo"       Não há gozo marcado — só o direito, esperando agenda.
 *   "futuro"         O gozo começa depois de hoje.
 *   "em-curso"       A pessoa está de férias agora.
 *   "voltou"         O gozo já terminou.
 *   "datas-trocadas" Retorno anterior ao início: o registro está errado,
 *                    não dá para contar.
 */

const plural = (n, um, muitos) => (n === 1 ? um : muitos);

/**
 * Quanto falta para as férias — ou quanto falta para voltar delas.
 *
 * Sem data de retorno mas com início, o período conta como começado: é o que a
 * data disponível sustenta. Dizer "voltou" sem saber quando seria inventar.
 * (Na base antiga era o caso "gozo sem dias"; na MinasLab, registro com
 * `inicio` e sem `retorno` — mesma regra.)
 *
 * @param {{inicio?: string|Date|null, retorno?: string|Date|null}} f
 * @param {Date} [hoje]
 * @returns {{fase: string, dias: number, texto: string}}
 *   `dias`: os que faltam (futuro / em curso) ou que já passaram (voltou).
 *   Nunca negativo. `texto`: frase curta e pronta para a célula da tabela.
 */
export function contagem(f, hoje = new Date()) {
  const inicio = parseData(f.inicio);
  const retorno = parseData(f.retorno);

  if (!inicio) return { fase: "sem-gozo", dias: 0, texto: "Sem gozo marcado" };

  // Registro invertido. Já apareceu na produção como "-31 dia(s)"; melhor dizer
  // que o dado está errado do que estampar um número impossível.
  if (retorno && retorno.getTime() < inicio.getTime()) {
    return { fase: "datas-trocadas", dias: 0, texto: "Datas trocadas" };
  }

  const paraOInicio = diasDeCalendario(inicio, hoje);
  if (paraOInicio > 0) {
    const texto =
      paraOInicio === 1 ? "Começa amanhã" : `Faltam ${paraOInicio} ${plural(paraOInicio, "dia", "dias")}`;
    return { fase: "futuro", dias: paraOInicio, texto };
  }

  // Sem retorno informado não há como dizer que terminou.
  if (!retorno) {
    return { fase: "em-curso", dias: 0, texto: "De férias · retorno não informado" };
  }

  // O dia do retorno é o dia em que a pessoa VOLTA a trabalhar: nele as férias
  // já acabaram. Por isso a comparação é "hoje < retorno", não "<=".
  const paraORetorno = diasDeCalendario(retorno, hoje);
  if (paraORetorno > 0) {
    const texto =
      paraORetorno === 1 ? "De férias · volta amanhã" : `De férias · volta em ${paraORetorno} dias`;
    return { fase: "em-curso", dias: paraORetorno, texto };
  }

  const desdeORetorno = -paraORetorno;
  const texto =
    desdeORetorno === 0
      ? "Voltou hoje"
      : desdeORetorno === 1
        ? "Voltou ontem"
        : `Voltou há ${desdeORetorno} dias`;
  return { fase: "voltou", dias: desdeORetorno, texto };
}

// -------------------------- a próxima, por pessoa ---------------------------

/**
 * A PRÓXIMA férias da pessoa — que é a pergunta que se faz olhando esta tela.
 *
 * A contagem por registro respondia "voltou há 211 dias", o que é verdade e não
 * serve para nada: quem abre o controle de férias quer saber quanto falta para
 * a próxima, não há quanto tempo foi a última.
 *
 * Ordem de prioridade: quem está de férias AGORA vem antes de quem tem uma
 * marcada, porque é o que muda a escala de hoje. Entre as futuras, a mais
 * próxima. Período cancelado não conta.
 *
 * @param {Array<{inicio?: string|null, retorno?: string|null, status?: string}>} registros
 * @param {Date} [hoje]
 * @returns {{fase: "em-curso"|"futuro"|"sem-marcacao", dias: number, texto: string, registro: object|null}}
 *   `fase`: "em-curso" = está de férias agora; "futuro" = já marcou;
 *   "sem-marcacao" = nada agendado. `dias`: para sair, ou para voltar (0
 *   quando não há o que contar). `registro`: o período que gerou a contagem,
 *   para a tela poder mostrar as datas.
 */
export function proximaFerias(registros, hoje = new Date()) {
  const vivos = (registros || []).filter((f) => f.status !== "cancelada");

  const emCurso = vivos
    .map((f) => ({ f, c: contagem(f, hoje) }))
    .filter((x) => x.c.fase === "em-curso")
    .sort((a, b) => a.c.dias - b.c.dias)[0];
  if (emCurso) {
    return { fase: "em-curso", dias: emCurso.c.dias, texto: emCurso.c.texto, registro: emCurso.f };
  }

  const futuras = vivos
    .map((f) => ({ f, c: contagem(f, hoje) }))
    .filter((x) => x.c.fase === "futuro")
    .sort((a, b) => a.c.dias - b.c.dias);
  if (futuras.length) {
    return { fase: "futuro", dias: futuras[0].c.dias, texto: futuras[0].c.texto, registro: futuras[0].f };
  }

  return { fase: "sem-marcacao", dias: 0, texto: "Sem férias marcadas", registro: null };
}

// --------------------------- status × datas ---------------------------------

/**
 * O status que as DATAS pedem — para oferecer o conserto de um clique.
 *
 * Devolve `null` quando o status já está coerente (ou quando não dá para
 * afirmar nada: sem gozo marcado, datas trocadas). Nunca aplica sozinho: quem
 * decide é quem cuida da folha, e um registro pode estar "errado" só porque as
 * férias foram antecipadas e ainda não lançaram.
 *
 * Adaptação MinasLab: sem o status "Em andamento" da origem, tanto o gozo em
 * curso quanto o futuro pedem "marcada" — só o que voltou pede "concluida".
 * @param {{status?: string, inicio?: string|null, retorno?: string|null}} f
 * @param {Date} [hoje]
 * @returns {string|null}
 */
export function statusSugerido(f, hoje = new Date()) {
  if (!statusIncoerente(f, hoje)) return null;
  const { fase } = contagem(f, hoje);
  if (fase === "voltou") return "concluida";
  if (fase === "em-curso") return "marcada";
  if (fase === "futuro") return "marcada";
  return null;
}

/**
 * O status gravado bate com o que as datas dizem?
 *
 * Ninguém volta na ficha para trocar o status quando a pessoa retorna — medido
 * na base de origem em 04/08/2026: três registros seguiam "Em andamento" com
 * retorno em julho, ou seja, a tela afirmava que três pessoas estavam de férias
 * enquanto elas trabalhavam. Devolve a frase do problema, ou `null` quando está
 * tudo coerente.
 *
 * Não corrige nada sozinho de propósito: mudar status é decisão de quem cuida
 * da folha, e um registro pode estar "errado" só porque as férias foram
 * antecipadas e ainda não lançaram.
 *
 * Adaptações MinasLab (statuses "marcada"|"concluida"|"cancelada"):
 * - "marcada" cobre agendado E em curso (não existe "Em andamento"), então a
 *   incoerência da origem "Agendada/Em aberto com gozo já começado" não existe
 *   aqui: "marcada" durante o gozo é coerente.
 * - "cancelada" nunca vira aviso (como "Cancelada" na origem): cancelar é
 *   decisão humana explícita; as datas não a contradizem.
 * @param {{status?: string, inicio?: string|null, retorno?: string|null}} f
 * @param {Date} [hoje]
 * @returns {string|null}
 */
export function statusIncoerente(f, hoje = new Date()) {
  const { fase } = contagem(f, hoje);
  const status = f.status;
  if (fase === "sem-gozo" || fase === "datas-trocadas") return null;

  if (fase === "voltou" && status === "marcada") {
    return `O status diz "${status}", mas o retorno foi em ${formatData(f.retorno)}.`;
  }
  if (fase === "em-curso" && status === "concluida") {
    return "O status diz \"concluida\", mas o período de gozo está acontecendo agora.";
  }
  if (fase === "futuro" && status === "concluida") {
    return `O status diz "${status}", mas o gozo só começa em ${formatData(f.inicio)}.`;
  }
  return null;
}
