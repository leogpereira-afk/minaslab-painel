// Plano de cargos e carreira da MinasLab (PCC).
//
// Montado sobre as funções do sistema de gestão (Funções e cargos) e as
// funções e setores de risco do PCMSO 2026. Regras puras, testadas em
// planoCarreira.test.mjs: a tela só mostra e grava.
//
// - Trilhas: caminhos de crescimento por área (laboratório, coleta,
//   comercial, administrativo), cada uma com níveis em ordem.
// - Movimentos laterais: troca de trilha (ex.: coleta → laboratório).
// - Grupo de risco do PCMSO: se a mudança troca de grupo, o ASO de mudança
//   de risco vem ANTES de começar na função nova; se não troca, basta o
//   formulário de alteração de cargo (sem ASO), como diz o PCMSO.
// - Critérios de promoção: tirados do próprio sistema (tempo no cargo,
//   avaliação, treinamentos e eficácia, PDI, ocorrências e estágio).
// Os dados ficam na coleção "carreira" (uma só para os dois setores):
//   tipo "enquadramento" (id enq_<pessoa>): em que nível a pessoa está e desde quando;
//   tipo "movimentacao": promoção, movimento lateral ou enquadramento registrado;
//   tipo "nivel" (id nivel_<nível>): faixa salarial e ajustes da direção.

export const DOC_PCC = { codigo: "PCC", titulo: "PLANO DE CARGOS E CARREIRA", rev: "REV. 00", emissao: "04/11/2026", origem: "PCC" };
export const DOC_RMC = { codigo: "RMC", titulo: "REGISTRO DE MOVIMENTAÇÃO DE CARGO", rev: "REV. 00", emissao: "04/11/2026", origem: "PCC" };

// Grupos de risco do PCMSO 2026 (exames por grupo; o detalhe fica no PCMSO).
export const GRUPOS_RISCO = {
  administrativo: { nome: "Administrativo", riscos: "Ergonômicos e psicossociais", exames: "Clínico e avaliação psicossocial" },
  laboratorio: { nome: "Laboratório", riscos: "Biológicos, físicos, químicos, ergonômicos e de acidentes", exames: "Clínico, laboratoriais e complementares do PCMSO" },
  coleta: { nome: "Coleta", riscos: "Biológicos, físicos (umidade), químicos e ergonômicos", exames: "Clínico, laboratoriais e complementares do PCMSO" },
};

// Níveis (cargos). funcao = nome da função no sistema (para ligar a pessoa);
// pcmso = como a função aparece no PCMSO; novo = ainda não existe no sistema.
const N = (id, o) => ({ id, tempoMinimo: 12, treinamentos: [], ...o });
export const NIVEIS = [
  // Laboratório
  N("lab-aux", {
    cargo: "Auxiliar de Laboratório", funcao: "Auxiliar de Laboratório", pcmso: "Auxiliar de Laboratório", grupo: "coleta", novo: true, tempoMinimo: 6,
    escopo: "Prepara vidrarias, soluções, meios e materiais; apoia os ensaios sob supervisão e organiza o laboratório. Não libera resultado.",
    requisitos: ["Ensino médio completo; desejável curso técnico em química, biologia ou farmácia em andamento", "Boas práticas de laboratório (POP-LAB-044) e armazenamento (PG 011)"],
    treinamentos: ["integracao", "qualidade-5s", "pg011-armazenamento"],
  }),
  N("lab-an1", {
    cargo: "Analista de Laboratório I", funcao: "Analista de Laboratório I", pcmso: "Analista I", grupo: "laboratorio", tempoMinimo: 12,
    escopo: "Executa os ensaios de rotina em que está autorizado, registra em planilhas e cartas controle e comunica desvios antes de liberar o resultado.",
    requisitos: ["Curso técnico em química (FQ) ou química, biologia ou farmácia (Micro), ou curso profissionalizante de até 400 h", "Autorização formal nos ensaios que executa (ISO/IEC 17025, 6.2.5 e 6.2.6)", "Treinamentos obrigatórios da função (Manual da Qualidade, PG e PT)"],
    treinamentos: ["integracao", "qualidade-5s", "qualidade-programa", "pg010-recebimento", "pg011-armazenamento"],
  }),
  N("lab-an2", {
    cargo: "Analista de Laboratório II", funcao: "Analista de Laboratório II", pcmso: "Analista II", grupo: "laboratorio", tempoMinimo: 18,
    escopo: "Executa todos os ensaios do seu setor (FQ ou Micro) com autonomia, prepara padrões, analisa cartas controle, participa de ensaios de proficiência e treina o Analista I e estagiários.",
    requisitos: ["Autorizado em todos os ensaios do seu setor", "Participou de ensaio de proficiência ou comparação interlaboratorial", "Ministrou ao menos um treinamento técnico registrado"],
    treinamentos: ["pg013-reclamacoes", "gestao-tempo"],
  }),
  N("lab-an3", {
    cargo: "Analista de Laboratório III", funcao: "Analista de Laboratório III", pcmso: "Analista III", grupo: "laboratorio", novo: true, tempoMinimo: 24,
    escopo: "Referência técnica: valida e verifica métodos, estima incerteza, faz a análise crítica dos resultados, investiga não conformidades (PG 014) e substitui a supervisão.",
    requisitos: ["Superior completo ou em curso em química, biologia, farmácia, engenharias ou afins", "Conduziu ao menos uma validação ou verificação de método", "Investigou e encerrou não conformidades com causa raiz"],
    treinamentos: ["analise-critica", "gestora"],
  }),
  N("lab-sup", {
    cargo: "Supervisor de Laboratório", funcao: "Supervisor de Laboratório", pcmso: "Supervisor de Laboratório", grupo: "laboratorio", novo: true, tempoMinimo: 24,
    escopo: "Coordena a rotina e a escala do laboratório, libera resultados como signatário autorizado e planeja manutenção, calibração e insumos.",
    requisitos: ["Superior completo na área", "Signatário autorizado", "Experiência de liderança (trilha da gestora concluída)"],
    treinamentos: ["gestora", "analise-critica"],
  }),
  N("qual-sup", {
    cargo: "Supervisor da Qualidade", funcao: "Supervisor da Qualidade", pcmso: "Supervisor de Qualidade", grupo: "laboratorio", tempoMinimo: 24,
    escopo: "Mantém o Sistema de Gestão da Qualidade (ISO/IEC 17025): não conformidades, auditorias, análise crítica, documentos e acreditação.",
    requisitos: ["Superior completo ou em curso na área", "ISO/IEC 17025 e ISO 9001, acreditação INMETRO", "Desejável 1 ano em laboratório"],
    treinamentos: ["analise-critica", "pg012-satisfacao", "pg013-reclamacoes", "gestora"],
  }),
  // Coleta
  N("col-op", {
    cargo: "Operador de Coletas e Logística", funcao: "Operador de Coletas e Logística", pcmso: "Aux. Administrativo Logística", grupo: "administrativo", tempoMinimo: 12,
    alerta: "Se a pessoa faz coletas em campo, confira com a clínica se o enquadramento no PCMSO não deveria ser Técnico de Amostragem e Coleta (grupo Coleta, com exames).",
    escopo: "Executa as coletas agendadas e a logística das amostras: rota, materiais, preservação, transporte e cadeia de custódia.",
    requisitos: ["Ensino médio completo", "CNH categoria B", "POPs de amostragem e de cadeia de custódia"],
    treinamentos: ["integracao", "qualidade-5s", "os-correta", "am-amostragem"],
  }),
  N("col-tec", {
    cargo: "Técnico de Amostragem e Coleta", funcao: "Técnico de Amostragem e Coleta", pcmso: "Técnico de Amostragem e Coleta", grupo: "coleta", novo: true, tempoMinimo: 18,
    escopo: "Faz amostragens com autonomia (POP-AM-001 a 006), inclusive coletas especiais e purga de baixa vazão, medições de campo e controles de qualidade; orienta quem está começando.",
    requisitos: ["Curso técnico em química, meio ambiente ou afins (concluído ou em andamento)", "NR-35 quando houver trabalho em altura", "Autorizado nas amostragens que executa"],
    treinamentos: ["am-amostragem", "am-coletas-especiais", "am-purga"],
  }),
  // Comercial
  N("com-est", {
    cargo: "Estagiário de Suporte Operacional", funcao: "Estagiário de Suporte Operacional", pcmso: "", grupo: "administrativo", tempoMinimo: 6,
    alerta: "Não aparece no PCMSO: confirme com a clínica o enquadramento do estagiário.",
    escopo: "Apoia o recebimento de amostras, o protocolo, os materiais e o atendimento, com plano de atividades e supervisão (Lei 11.788/2008, estágio de até 2 anos).",
    requisitos: ["Estudante de curso técnico ou superior compatível", "Termo de compromisso e plano de atividades"],
    treinamentos: ["integracao", "qualidade-5s", "os-correta", "atendimento"],
  }),
  N("com-ass", {
    cargo: "Auxiliar Administrativo Comercial", funcao: "Auxiliar Administrativo Comercial", antigos: ["Assistente de Suporte Operacional, Atendimento e Licitações"], pcmso: "Aux. Administrativo Comercial", grupo: "administrativo", tempoMinimo: 12,
    escopo: "Atendimento, recebimento de amostras e OS, controle de provedores, licitações e apoio às propostas.",
    requisitos: ["Ensino médio completo; desejável técnico ou superior em administração", "POPs de recebimento de amostras e emissão de OS"],
    treinamentos: ["integracao", "qualidade-5s", "os-correta", "atendimento", "licitacoes", "crm-sem-furos"],
  }),
  N("com-an1", {
    cargo: "Analista Administrativo Comercial", funcao: "Analista Administrativo Comercial", antigos: ["Analista Comercial"], pcmso: "Aux. Administrativo Comercial", grupo: "administrativo", tempoMinimo: 18,
    escopo: "Propostas, follow-up, CRM, atendimento e agendamento de coletas, com metas mensais de propostas e aprovação.",
    requisitos: ["Ensino médio completo; desejável técnico ou superior", "Análise crítica de pedidos e propostas (PG 006)"],
    treinamentos: ["crm-sem-furos", "follow-up", "proposta-sem-erro", "analise-critica", "atendimento"],
  }),
  N("com-an2", {
    cargo: "Analista Administrativo Comercial Sênior", funcao: "Analista Administrativo Comercial Sênior", pcmso: "Aux. Administrativo Comercial", grupo: "administrativo", novo: true, tempoMinimo: 24,
    escopo: "Cuida dos clientes-chave e das licitações mais complexas, faz propostas de escopo novo com a análise crítica, treina quem chega e responde pela meta de valor.",
    requisitos: ["Superior completo ou em curso", "Taxa de aprovação na meta em dois trimestres seguidos", "Conhecimento técnico dos ensaios e venda consultiva"],
    treinamentos: ["spin", "tecnico", "pg012-satisfacao", "pg013-reclamacoes"],
  }),
  N("adm-sup", {
    cargo: "Supervisor Administrativo", funcao: "Supervisor Administrativo", pcmso: "Supervisor Administrativo", grupo: "administrativo", tempoMinimo: 24,
    escopo: "Coordena o comercial, o suporte e o administrativo: metas, rotina, indicadores e pessoas.",
    requisitos: ["Superior completo ou em curso", "Experiência de liderança (trilha da gestora concluída)"],
    treinamentos: ["gestora", "gestao-tempo"],
  }),
  // Administrativo
  N("adm-fin", {
    cargo: "Auxiliar Administrativo Financeiro", funcao: "Auxiliar Administrativo Financeiro", pcmso: "Aux. Administrativo Financeiro", grupo: "administrativo", novo: true, tempoMinimo: 18,
    escopo: "Documentos e classificação contábil, contas, guias, notas e arquivo.",
    requisitos: ["Ensino médio completo; desejável técnico ou superior em administração ou contabilidade"],
    treinamentos: ["integracao", "qualidade-5s"],
  }),
];

export const TRILHAS_CARREIRA = [
  { id: "laboratorio", nome: "Laboratório", desc: "Dos ensaios de apoio à supervisão técnica.", niveis: ["lab-aux", "lab-an1", "lab-an2", "lab-an3", "lab-sup"] },
  { id: "coleta", nome: "Coleta e amostragem", desc: "Da coleta agendada à amostragem com autonomia.", niveis: ["col-op", "col-tec"] },
  { id: "comercial", nome: "Comercial e atendimento", desc: "Do estágio à supervisão administrativa.", niveis: ["com-est", "com-ass", "com-an1", "com-an2", "adm-sup"] },
  { id: "administrativo", nome: "Administrativo e financeiro", desc: "Rotina administrativa e financeira.", niveis: ["adm-fin", "adm-sup"] },
  { id: "qualidade", nome: "Qualidade", desc: "Chega-se pelo laboratório (Analista III ou Supervisor de Laboratório).", niveis: ["qual-sup"] },
];

// Trocas de trilha previstas (além de subir na própria trilha).
export const LATERAIS = [
  { de: "col-op", para: "com-ass", obs: "Para quem quer ir para o atendimento e o suporte." },
  { de: "com-ass", para: "col-op", obs: "Para quem quer ir para as coletas (CNH B)." },
  { de: "lab-aux", para: "col-tec", obs: "Do apoio do laboratório para a amostragem em campo." },
  { de: "col-tec", para: "lab-an1", obs: "Da amostragem para os ensaios, com a formação exigida." },
  { de: "col-op", para: "lab-aux", obs: "Da coleta para o apoio do laboratório." },
  { de: "lab-an3", para: "qual-sup", obs: "Da referência técnica para a Qualidade." },
  { de: "lab-sup", para: "qual-sup", obs: "Da supervisão técnica para a Qualidade." },
];

export const FORA_DO_PLANO = ["Gerente", "Diretora"];

// Regras gerais (números que a direção pode rever na revisão do plano).
export const REGRAS = {
  mesesAvaliacao: 6, // janela da avaliação de desempenho
  minimoAvaliacoes: 3, // meses avaliados na janela
  notaMinima: 8, // média mínima (0 a 10), a faixa "Muito bom" da Avaliação e bônus
  ocorrenciasMax: 2, // ocorrências nos últimos 6 meses
  estagio: "autonomo", // estágio na função (Pessoas e feedback)
  ciclos: [1, 7], // análise das promoções em janeiro e julho
};

export const nivelPorId = (id) => NIVEIS.find((n) => n.id === id) || null;
const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
/** Nível do plano pela função do sistema (nome da função). */
export const nivelDaFuncao = (nomeFuncao) => (nomeFuncao ? NIVEIS.find((n) => [n.funcao, ...(n.antigos || [])].some((x) => norm(x) === norm(nomeFuncao))) || null : null);
export const trilhasDoNivel = (id) => TRILHAS_CARREIRA.filter((t) => t.niveis.includes(id));

/** Próximos passos a partir de um nível: subir na trilha e trocas laterais. */
export function proximosPassos(id) {
  const out = [];
  for (const t of trilhasDoNivel(id)) {
    const i = t.niveis.indexOf(id);
    const prox = t.niveis[i + 1];
    if (prox && !out.some((x) => x.para === prox)) out.push({ para: prox, tipo: "promocao", trilha: t.id });
  }
  for (const l of LATERAIS.filter((x) => x.de === id)) if (!out.some((x) => x.para === l.para)) out.push({ para: l.para, tipo: "lateral", obs: l.obs });
  return out;
}

/** O que o PCMSO pede para a mudança de cargo. */
export function exigenciaPCMSO(deId, paraId) {
  const de = nivelPorId(deId), para = nivelPorId(paraId);
  if (!para) return null;
  if (de && de.grupo === para.grupo) {
    return { aso: false, texto: "Mesmo grupo de risco: emitir o formulário de alteração de cargo, sem ASO (PCMSO, mudança de risco)." };
  }
  const g = GRUPOS_RISCO[para.grupo];
  return {
    aso: true,
    texto: `Muda o grupo de risco${de ? ` (${GRUPOS_RISCO[de.grupo].nome} → ${g.nome})` : ` (para ${g.nome})`}: fazer o ASO de mudança de risco ANTES de começar na função nova (NR-7). Exames: ${g.exames.toLowerCase()}.`,
  };
}

/** Meses completos entre duas datas ISO (AAAA-MM-DD). */
export function mesesEntre(de, ate) {
  if (!de || !ate) return null;
  const [a1, m1, d1] = String(de).slice(0, 10).split("-").map(Number);
  const [a2, m2, d2] = String(ate).slice(0, 10).split("-").map(Number);
  let m = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) m -= 1;
  return Math.max(0, m);
}

/** Próximo ciclo de análise (1º de janeiro ou de julho). */
export function proximoCiclo(hoje) {
  const [a, m] = String(hoje).split("-").map(Number);
  const prox = REGRAS.ciclos.find((c) => c > m);
  return prox ? `${a}-${String(prox).padStart(2, "0")}-01` : `${a + 1}-${String(REGRAS.ciclos[0]).padStart(2, "0")}-01`;
}

const mesMenos = (hoje, n) => {
  const [a, m] = String(hoje).split("-").map(Number);
  const t = a * 12 + (m - 1) - n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

/**
 * Prontidão para o próximo passo. Entradas já tiradas do sistema:
 *  nivel (atual), tempoMinimo (do nível, com o ajuste da direção), desde,
 *  hoje, notas [{mes, final}], ocorrencias [{mes}], pdi [{status, prazo,
 *  trimestre}], obrigatorios [{id, nome, feito}], naoEficazes (AVETs não
 *  eficazes em aberto), estagio.
 * Devolve { criterios: [{id, nome, ok, detalhe}], prontos, total, situacao }.
 * ok: true, false ou null (sem dado para conferir).
 */
export function prontidao({ nivel, tempoMinimo, desde, hoje, notas = [], ocorrencias = [], pdi = [], obrigatorios = [], naoEficazes = 0, estagio = "" }) {
  const r = REGRAS;
  const ini = mesMenos(hoje, r.mesesAvaliacao - 1);
  const crit = [];

  const meses = mesesEntre(desde, hoje);
  const tm = tempoMinimo ?? nivel?.tempoMinimo ?? 12;
  crit.push({ id: "tempo", nome: "Tempo no cargo", ok: meses == null ? null : meses >= tm, detalhe: meses == null ? `informe desde quando está no cargo (mínimo ${tm} meses)` : `${meses} de ${tm} meses` });

  const ns = notas.filter((n) => n.mes >= ini && n.mes <= String(hoje).slice(0, 7) && n.final != null);
  const media = ns.length ? ns.reduce((s, n) => s + n.final, 0) / ns.length : null;
  crit.push({
    id: "desempenho", nome: "Avaliação de desempenho",
    ok: ns.length < r.minimoAvaliacoes ? (ns.length ? false : null) : media >= r.notaMinima,
    detalhe: ns.length ? `média ${media.toFixed(1).replace(".", ",")} em ${ns.length} mês(es) (mínimo ${r.notaMinima} em ${r.minimoAvaliacoes} meses)` : `sem avaliação nos últimos ${r.mesesAvaliacao} meses`,
  });

  const faltam = obrigatorios.filter((t) => !t.feito);
  crit.push({ id: "treinamentos", nome: "Treinamentos da função", ok: obrigatorios.length ? !faltam.length : null, detalhe: !obrigatorios.length ? "a função não tem treinamentos obrigatórios" : faltam.length ? `faltam: ${faltam.map((t) => t.nome).join(", ")}` : `${obrigatorios.length} de ${obrigatorios.length} feitos` });

  crit.push({ id: "eficacia", nome: "Eficácia dos treinamentos", ok: naoEficazes === 0, detalhe: naoEficazes ? `${naoEficazes} avaliação(ões) de eficácia não eficaz em aberto` : "nenhuma avaliação não eficaz em aberto" });

  const tri = (m) => `${m.slice(0, 4)}-T${Math.ceil(Number(m.slice(5, 7)) / 3)}`;
  const triIni = tri(mesMenos(hoje, 5));
  const recentes = pdi.filter((p) => String(p.trimestre || "") >= triIni);
  const vencidos = pdi.filter((p) => p.status !== "concluido" && p.prazo && p.prazo < hoje);
  const concl = recentes.filter((p) => p.status === "concluido").length;
  crit.push({ id: "pdi", nome: "PDI", ok: !recentes.length && !vencidos.length ? null : concl > 0 && !vencidos.length, detalhe: `${concl} item(ns) concluído(s) nos últimos 2 trimestres${vencidos.length ? `, ${vencidos.length} vencido(s) em aberto` : ""}` });

  const oc = ocorrencias.filter((o) => String(o.mes || o.data || "").slice(0, 7) >= ini).length;
  crit.push({ id: "ocorrencias", nome: "Ocorrências", ok: oc <= r.ocorrenciasMax, detalhe: `${oc} nos últimos ${r.mesesAvaliacao} meses (máximo ${r.ocorrenciasMax})` });

  crit.push({ id: "estagio", nome: "Estágio na função", ok: estagio ? estagio === r.estagio : null, detalhe: estagio === r.estagio ? "autônomo" : estagio ? "ainda não está autônomo" : "estágio não avaliado em Pessoas e feedback" });

  const prontos = crit.filter((c) => c.ok === true).length;
  const falhos = crit.filter((c) => c.ok === false).length;
  const semDado = crit.filter((c) => c.ok == null).length;
  const situacao = falhos === 0 && semDado === 0 ? "pronta" : falhos === 0 ? "conferir" : falhos === 1 ? "quase" : "desenvolvimento";
  return { criterios: crit, prontos, total: crit.length, situacao };
}

export const SITUACOES = {
  pronta: { nome: "Pronta para o próximo passo", tom: "ok" },
  conferir: { nome: "Sem falhas, falta informação", tom: "marca" },
  quase: { nome: "Falta um critério", tom: "alerta" },
  desenvolvimento: { nome: "Em desenvolvimento", tom: "neutro" },
  sem: { nome: "Sem nível no plano", tom: "ruim" },
  topo: { nome: "No topo da trilha", tom: "neutro" },
};

export const TIPOS_MOV = [
  ["promocao", "Promoção (sobe na trilha)"],
  ["lateral", "Movimento lateral (outra trilha)"],
  ["enquadramento", "Enquadramento (registro do cargo atual)"],
];
export const nomeTipoMov = (id) => TIPOS_MOV.find((t) => t[0] === id)?.[1] || "";

// Texto do plano (vai para a tela e para o documento impresso).
export const TEXTO_PLANO = {
  objetivo: "Mostrar a cada pessoa da MinasLab como crescer na empresa: quais cargos existem, o que cada um exige e o que é preciso mostrar para subir, com critérios iguais para todos e conferidos nos registros do sistema de gestão.",
  principios: [
    "Mérito comprovado: a promoção depende de resultado, treinamento e comportamento registrados, não de pedido.",
    "Competência antes do cargo: a pessoa só assume ensaio, amostragem ou liberação de resultado em que está treinada e autorizada (ISO/IEC 17025, 6.2).",
    "Transparência: os critérios, os níveis e a situação de cada um ficam visíveis para a gestão e são conversados no feedback.",
    "Saúde e segurança: toda mudança de cargo segue o PCMSO (ASO de mudança de risco quando troca o grupo de risco).",
    "Vaga e orçamento: estar pronto não garante a promoção; ela depende da necessidade da vaga e da aprovação da direção.",
  ],
  movimentos: [
    "Promoção: subir um nível na própria trilha.",
    "Movimento lateral: mudar de trilha (ex.: da coleta para o laboratório), quando a pessoa tem os requisitos do novo cargo.",
    "Enquadramento: registrar o cargo atual de quem já está na empresa quando o plano começa.",
  ],
  ciclo: "As promoções são analisadas duas vezes por ano, em janeiro e em julho, pela gerência com a liderança direta. A mudança vale a partir do mês seguinte à aprovação, com registro no RMC, atualização do cargo no eSocial pela contabilidade e, quando muda o grupo de risco, ASO de mudança de risco antes de começar.",
  salario: "Cada nível tem uma faixa salarial definida pela direção. Sugestão: diferença de 8% a 15% entre um nível e o seguinte da mesma trilha.",
  legal: "O plano é norma interna da empresa (CLT, art. 461, §§ 2º e 3º): as promoções seguem critérios de merecimento e de tempo no cargo descritos aqui. Confirme a redação final com a contabilidade ou o jurídico.",
  revisao: "O plano é revisto uma vez por ano ou quando um cargo for criado ou mudar; toda mudança sobe a revisão do documento.",
};
