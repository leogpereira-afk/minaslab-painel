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
  N("lab-est", {
    cbo: "",
    cargo: "Estagiário de Laboratório", funcao: "Estagiário de Laboratório", pcmso: "", grupo: "laboratorio", novo: true, tempoMinimo: 6,
    salario: { min: 800, max: 1100, obs: "bolsa-auxílio de estágio (Lei 11.788/2008)" },
    alerta: "Não aparece no PCMSO: confirme com a clínica o enquadramento do estagiário de laboratório (riscos biológicos e químicos).",
    escopo: "Acompanha a rotina do laboratório com plano de atividades e supervisão: prepara materiais, organiza amostras e apoia ensaios sem liberar resultado (Lei 11.788/2008, estágio de até 2 anos).",
    requisitos: ["Estudante de curso técnico ou superior em química, biologia, farmácia ou afins", "Termo de compromisso e plano de atividades", "Boas práticas de laboratório (POP-LAB-044)"],
    treinamentos: ["integracao", "qualidade-5s", "pg011-armazenamento"],
  }),
  N("lab-aux", {
    cbo: "8181-10",
    salario: { min: 1621, max: 1800 },
    cargo: "Auxiliar de Laboratório", funcao: "Auxiliar de Laboratório", pcmso: "Auxiliar de Laboratório", grupo: "coleta", novo: true, tempoMinimo: 6,
    escopo: "Prepara vidrarias, soluções, meios e materiais; apoia os ensaios sob supervisão e organiza o laboratório. Não libera resultado.",
    requisitos: ["Ensino médio completo; desejável curso técnico em química, biologia ou farmácia em andamento", "Boas práticas de laboratório (POP-LAB-044) e armazenamento (PG 011)"],
    treinamentos: ["integracao", "qualidade-5s", "pg011-armazenamento"],
  }),
  N("lab-an1", {
    cbo: "3111-05",
    salario: { min: 1800, max: 2000 },
    cargo: "Analista de Laboratório I", funcao: "Analista de Laboratório I", pcmso: "Analista I", grupo: "laboratorio", tempoMinimo: 12,
    escopo: "Executa os ensaios de rotina em que está autorizado, registra em planilhas e cartas controle e comunica desvios antes de liberar o resultado.",
    requisitos: ["Curso técnico em química (FQ) ou química, biologia ou farmácia (Micro), ou curso profissionalizante de até 400 h", "Autorização formal nos ensaios que executa (ISO/IEC 17025, 6.2.5 e 6.2.6)", "Treinamentos obrigatórios da função (Manual da Qualidade, PG e PT)"],
    treinamentos: ["integracao", "qualidade-5s", "qualidade-programa", "pg010-recebimento", "pg011-armazenamento"],
  }),
  N("lab-an2", {
    cbo: "3111-05",
    salario: { min: 2000, max: 2250 },
    cargo: "Analista de Laboratório II", funcao: "Analista de Laboratório II", pcmso: "Analista II", grupo: "laboratorio", tempoMinimo: 18,
    escopo: "Executa todos os ensaios do seu setor (FQ ou Micro) com autonomia, prepara padrões, analisa cartas controle, participa de ensaios de proficiência e treina o Analista I e estagiários.",
    requisitos: ["Autorizado em todos os ensaios do seu setor", "Participou de ensaio de proficiência ou comparação interlaboratorial", "Ministrou ao menos um treinamento técnico registrado"],
    treinamentos: ["pg013-reclamacoes", "gestao-tempo"],
  }),
  N("lab-an3", {
    cbo: "3111-05",
    salario: { min: 2250, max: 2550 },
    cargo: "Analista de Laboratório III", funcao: "Analista de Laboratório III", pcmso: "Analista III", grupo: "laboratorio", novo: true, tempoMinimo: 24,
    escopo: "Referência técnica: valida e verifica métodos, estima incerteza, faz a análise crítica dos resultados, investiga não conformidades (PG 014) e substitui a supervisão.",
    requisitos: ["Superior completo ou em curso em química, biologia, farmácia, engenharias ou afins", "Conduziu ao menos uma validação ou verificação de método", "Investigou e encerrou não conformidades com causa raiz"],
    treinamentos: ["analise-critica", "gestora"],
  }),
  N("lab-sup", {
    cbo: "3111-05",
    salario: { min: 2700, max: 3200 },
    cargo: "Supervisor de Laboratório", funcao: "Supervisor de Laboratório", pcmso: "Supervisor de Laboratório", grupo: "laboratorio", novo: true, tempoMinimo: 24,
    escopo: "Coordena a rotina e a escala do laboratório, libera resultados como signatário autorizado e planeja manutenção, calibração e insumos.",
    requisitos: ["Superior completo na área", "Signatário autorizado", "Experiência de liderança (trilha da gestora concluída)"],
    treinamentos: ["gestora", "analise-critica"],
  }),
  N("qual-est", {
    cbo: "",
    cargo: "Estagiário da Qualidade", funcao: "Estagiário da Qualidade", pcmso: "", grupo: "administrativo", novo: true, tempoMinimo: 6,
    salario: { min: 800, max: 1100, obs: "bolsa-auxílio de estágio (Lei 11.788/2008)" },
    alerta: "Não aparece no PCMSO: confirme com a clínica o enquadramento do estagiário da Qualidade.",
    escopo: "Apoia a Qualidade com plano de atividades e supervisão: controle de documentos, registros, indicadores e organização das auditorias.",
    requisitos: ["Estudante de curso técnico ou superior em química, biologia, engenharias, gestão da qualidade ou afins", "Termo de compromisso e plano de atividades"],
    treinamentos: ["integracao", "qualidade-5s", "qualidade-programa"],
  }),
  N("qual-an", {
    cbo: "3912-10",
    cargo: "Analista da Qualidade", funcao: "Analista da Qualidade", pcmso: "", grupo: "laboratorio", novo: true, tempoMinimo: 24,
    salario: { min: 2000, max: 2400 },
    alerta: "Não consta no PCMSO 2026: incluir na próxima revisão quando o cargo for criado.",
    escopo: "Opera o Sistema de Gestão da Qualidade no dia a dia: controle de documentos, registros de não conformidade e ações corretivas, calibrações, ensaios de proficiência, indicadores e preparação das auditorias.",
    requisitos: ["Superior completo ou em curso em química, biologia, farmácia, engenharias ou afins", "ISO/IEC 17025 (interpretação)", "Desejável 1 ano em laboratório (ex.: Analista II ou III)"],
    treinamentos: ["qualidade-programa", "analise-critica", "pg013-reclamacoes"],
  }),
  N("qual-sup", {
    cbo: "3912-10",
    salario: { min: 2500, max: 3000 },
    cargo: "Supervisor da Qualidade", funcao: "Supervisor da Qualidade", pcmso: "Supervisor de Qualidade", grupo: "laboratorio", tempoMinimo: 24,
    escopo: "Mantém o Sistema de Gestão da Qualidade (ISO/IEC 17025): não conformidades, auditorias, análise crítica, documentos e acreditação.",
    requisitos: ["Superior completo ou em curso na área", "ISO/IEC 17025 e ISO 9001, acreditação INMETRO", "Desejável 1 ano em laboratório"],
    treinamentos: ["analise-critica", "pg012-satisfacao", "pg013-reclamacoes", "gestora"],
  }),
  // Coleta
  N("col-op", {
    cbo: "",
    salario: { min: 1700, max: 1950 },
    cargo: "Operador de Coletas e Logística", funcao: "Operador de Coletas e Logística", pcmso: "Aux. Administrativo Logística", grupo: "administrativo", tempoMinimo: 12,
    alerta: "Se a pessoa faz coletas em campo, confira com a clínica se o enquadramento no PCMSO não deveria ser Técnico de Amostragem e Coleta (grupo Coleta, com exames).",
    escopo: "Executa as coletas agendadas e a logística das amostras: rota, materiais, preservação, transporte e cadeia de custódia.",
    requisitos: ["Ensino médio completo", "CNH categoria B", "POPs de amostragem e de cadeia de custódia"],
    treinamentos: ["integracao", "qualidade-5s", "os-correta", "am-amostragem"],
  }),
  N("col-tec", {
    cbo: "3115-05",
    salario: { min: 2100, max: 2600 },
    cargo: "Técnico de Amostragem e Coleta", funcao: "Técnico de Amostragem e Coleta", pcmso: "Técnico de Amostragem e Coleta", grupo: "coleta", novo: true, tempoMinimo: 18,
    escopo: "Faz amostragens com autonomia (POP-AM-001 a 006), inclusive coletas especiais e purga de baixa vazão, medições de campo e controles de qualidade; orienta quem está começando.",
    requisitos: ["Curso técnico em química, meio ambiente ou afins (concluído ou em andamento)", "NR-35 quando houver trabalho em altura", "Autorizado nas amostragens que executa"],
    treinamentos: ["am-amostragem", "am-coletas-especiais", "am-purga"],
  }),
  // Comercial
  N("com-est", {
    cbo: "",
    salario: { min: 800, max: 1100, obs: "bolsa-auxílio de estágio (Lei 11.788/2008)" },
    cargo: "Estagiário de Suporte Operacional", funcao: "Estagiário de Suporte Operacional", pcmso: "", grupo: "administrativo", tempoMinimo: 6,
    alerta: "Não aparece no PCMSO: confirme com a clínica o enquadramento do estagiário.",
    escopo: "Apoia o recebimento de amostras, o protocolo, os materiais e o atendimento, com plano de atividades e supervisão (Lei 11.788/2008, estágio de até 2 anos).",
    requisitos: ["Estudante de curso técnico ou superior compatível", "Termo de compromisso e plano de atividades"],
    treinamentos: ["integracao", "qualidade-5s", "os-correta", "atendimento"],
  }),
  N("com-ass", {
    cbo: "4110-05",
    salario: { min: 1621, max: 1850, obs: "mais comissão" },
    cargo: "Auxiliar Administrativo Comercial I", funcao: "Auxiliar Administrativo Comercial I", antigos: ["Auxiliar Administrativo Comercial", "Assistente de Suporte Operacional, Atendimento e Licitações"], pcmso: "Aux. Administrativo Comercial", grupo: "administrativo", tempoMinimo: 12,
    escopo: "Atendimento, recebimento de amostras e OS, controle de provedores, licitações e apoio às propostas.",
    requisitos: ["Ensino médio completo; desejável técnico ou superior em administração", "POPs de recebimento de amostras e emissão de OS"],
    treinamentos: ["integracao", "qualidade-5s", "os-correta", "atendimento", "licitacoes", "crm-sem-furos"],
  }),
  N("com-an1", {
    cbo: "4110-05",
    salario: { min: 1850, max: 2100, obs: "mais comissão" },
    cargo: "Auxiliar Administrativo Comercial II", funcao: "Auxiliar Administrativo Comercial II", antigos: ["Analista Comercial"], pcmso: "Aux. Administrativo Comercial", grupo: "administrativo", tempoMinimo: 18,
    escopo: "Propostas, follow-up, CRM, atendimento e agendamento de coletas, com metas mensais de propostas e aprovação.",
    requisitos: ["Ensino médio completo; desejável técnico ou superior", "Análise crítica de pedidos e propostas (PG 006)"],
    treinamentos: ["crm-sem-furos", "follow-up", "proposta-sem-erro", "analise-critica", "atendimento"],
  }),
  N("com-an2", {
    cbo: "4110-10",
    salario: { min: 2100, max: 2500 },
    cargo: "Analista Administrativo Comercial", funcao: "Analista Administrativo Comercial", pcmso: "Aux. Administrativo Comercial", grupo: "administrativo", novo: true, tempoMinimo: 24,
    escopo: "Cuida dos clientes-chave e das licitações mais complexas, faz propostas de escopo novo com a análise crítica, treina quem chega e responde pela meta de valor.",
    requisitos: ["Superior completo ou em curso", "Taxa de aprovação na meta em dois trimestres seguidos", "Conhecimento técnico dos ensaios e venda consultiva"],
    treinamentos: ["spin", "tecnico", "pg012-satisfacao", "pg013-reclamacoes"],
  }),
  N("adm-sup", {
    cbo: "4101-05",
    salario: { min: 2800, max: 3300 },
    cargo: "Supervisor Administrativo", funcao: "Supervisor Administrativo", pcmso: "Supervisor Administrativo", grupo: "administrativo", tempoMinimo: 24,
    escopo: "Coordena o comercial, o suporte e o administrativo: metas, rotina, indicadores e pessoas.",
    requisitos: ["Superior completo ou em curso", "Experiência de liderança (trilha da gestora concluída)"],
    treinamentos: ["gestora", "gestao-tempo"],
  }),
  // Administrativo
  N("adm-fin", {
    cbo: "4110-05",
    salario: { min: 1700, max: 1950 },
    cargo: "Auxiliar Administrativo Financeiro", funcao: "Auxiliar Administrativo Financeiro", pcmso: "Aux. Administrativo Financeiro", grupo: "administrativo", novo: true, tempoMinimo: 18,
    escopo: "Documentos e classificação contábil, contas, guias, notas e arquivo.",
    requisitos: ["Ensino médio completo; desejável técnico ou superior em administração ou contabilidade"],
    treinamentos: ["integracao", "qualidade-5s"],
  }),
  N("qual-ger", {
    cbo: "",
    cargo: "Gerente da Qualidade", funcao: "Gerente da Qualidade", pcmso: "", grupo: "laboratorio", novo: true, tempoMinimo: 24,
    salario: { min: 3300, max: 4000 },
    alerta: "Não consta no PCMSO 2026: incluir na próxima revisão quando o cargo for criado.",
    escopo: "Responde pelo Sistema de Gestão da Qualidade e pela acreditação: conduz a análise crítica pela direção, as auditorias externas e o relacionamento com o INMETRO/Cgcre, e define os objetivos da qualidade.",
    requisitos: ["Superior completo na área; desejável pós-graduação em gestão da qualidade", "Auditor interno ISO/IEC 17025", "Experiência como Supervisor da Qualidade"],
    treinamentos: ["gestora", "analise-critica"],
  }),
  N("fin-an", {
    cbo: "4110-10",
    cargo: "Analista Financeiro", funcao: "Analista Financeiro", pcmso: "", grupo: "administrativo", novo: true, tempoMinimo: 24,
    salario: { min: 2100, max: 2500 },
    alerta: "Não consta no PCMSO 2026: incluir na próxima revisão quando o cargo for criado.",
    escopo: "Contas a pagar e a receber, conciliação bancária, fluxo de caixa, cobrança e relatórios financeiros para a direção; interface com a contabilidade.",
    requisitos: ["Superior completo ou em curso em administração, contabilidade ou economia", "Domínio do ERP (Omie) e de planilhas"],
    treinamentos: ["gestao-tempo"],
  }),
  N("adm-ger", {
    cbo: "1421-05",
    cargo: "Gerente Administrativo", funcao: "Gerente Administrativo", pcmso: "", grupo: "administrativo", novo: true, tempoMinimo: 24,
    salario: { min: 3600, max: 4500 },
    alerta: "Não consta no PCMSO 2026: incluir na próxima revisão quando o cargo for criado.",
    escopo: "Responde pelo comercial, atendimento, suporte e administrativo: metas, orçamento da área, pessoas, contratos e indicadores.",
    requisitos: ["Superior completo", "Experiência como Supervisor Administrativo", "Trilha da gestora concluída"],
    treinamentos: ["gestora", "gestao-tempo"],
  }),
  N("fin-ger", {
    cbo: "1421-15",
    cargo: "Gerente Financeiro", funcao: "Gerente Financeiro", pcmso: "", grupo: "administrativo", novo: true, tempoMinimo: 24,
    salario: { min: 3600, max: 4500 },
    alerta: "Não consta no PCMSO 2026: incluir na próxima revisão quando o cargo for criado.",
    escopo: "Responde pelas finanças da empresa: orçamento, fluxo de caixa, custos e preços, indicadores financeiros e a relação com bancos e contabilidade.",
    requisitos: ["Superior completo em administração, contabilidade ou economia", "Experiência como Analista Financeiro ou em gestão financeira"],
    treinamentos: ["gestora", "gestao-tempo"],
  }),
];

export const TRILHAS_CARREIRA = [
  { id: "laboratorio", nome: "Laboratório", desc: "Do estágio à supervisão técnica.", niveis: ["lab-est", "lab-aux", "lab-an1", "lab-an2", "lab-an3", "lab-sup"] },
  { id: "qualidade", nome: "Qualidade", desc: "Do estágio à gerência da qualidade; também se chega pelo laboratório (Analista II ou III).", niveis: ["qual-est", "qual-an", "qual-sup", "qual-ger"] },
  { id: "coleta", nome: "Coleta e amostragem", desc: "Da coleta agendada à amostragem com autonomia.", niveis: ["col-op", "col-tec"] },
  { id: "comercial", nome: "Comercial e administrativo", desc: "Do estágio à gerência administrativa.", niveis: ["com-est", "com-ass", "com-an1", "com-an2", "adm-sup", "adm-ger"] },
  { id: "financeiro", nome: "Financeiro", desc: "Da rotina financeira à gerência financeira.", niveis: ["adm-fin", "fin-an", "fin-ger"] },
];

// Trocas de trilha previstas (além de subir na própria trilha).
export const LATERAIS = [
  { de: "col-op", para: "com-ass", obs: "Para quem quer ir para o atendimento e o suporte." },
  { de: "com-ass", para: "col-op", obs: "Para quem quer ir para as coletas (CNH B)." },
  { de: "lab-aux", para: "col-tec", obs: "Do apoio do laboratório para a amostragem em campo." },
  { de: "col-tec", para: "lab-an1", obs: "Da amostragem para os ensaios, com a formação exigida." },
  { de: "col-op", para: "lab-aux", obs: "Da coleta para o apoio do laboratório." },
  { de: "lab-an2", para: "qual-an", obs: "Do laboratório para a Qualidade." },
  { de: "lab-an3", para: "qual-an", obs: "Do laboratório para a Qualidade." },
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

// Cultura MinasLab: missão, visão e valores (resumo da página oficial
// minaslab.net/missao-e-valores — o texto completo está lá). A liderança
// confere os valores de cada pessoa; vale por REGRAS.mesesAvaliacao meses.
export const CULTURA = {
  fonte: "https://minaslab.net/missao-e-valores/",
  missao: "Contribuir para a proteção ambiental e a saúde pública com análises de água, efluentes, solos e alimentos, apoiando decisões sobre qualidade e segurança.",
  visao: "Ser referência em análises ambientais no Norte de Minas, reconhecida pela qualidade técnica e pela agilidade dos serviços.",
  valores: [
    { id: "imparcialidade", nome: "Imparcialidade", desc: "Independência e fidelidade aos dados." },
    { id: "responsabilidade", nome: "Responsabilidade", desc: "Cuidado com pessoas, amostras, informações e meio ambiente." },
    { id: "excelencia", nome: "Excelência técnica", desc: "Conhecimento, rigor, rastreabilidade e melhoria contínua." },
    { id: "principios", nome: "Princípios cristãos e respeito", desc: "Honestidade, humildade e respeito à dignidade de todos." },
    { id: "servir", nome: "Orgulho em servir", desc: "Atenção e respeito em cada demanda." },
    { id: "dono", nome: "Atitude de dono", desc: "Responsabilidade pelas decisões e pelos recursos." },
    { id: "cliente", nome: "Compromisso com o cliente", desc: "Informações que apoiam as decisões do cliente." },
    { id: "combinado", nome: "Cumprir o combinado", desc: "Escopo, condições e prazos claros e cumpridos." },
    { id: "presenca", nome: "Presença e disponibilidade", desc: "Diálogo próximo e canais de atendimento claros." },
    { id: "feedback", nome: "Abertura a feedback", desc: "Sugestões e críticas como oportunidades de melhoria." },
    { id: "solucoes", nome: "Foco em soluções", desc: "Investigar causas e agir com agilidade, respeitando os métodos." },
    { id: "concluir", nome: "Concluir com responsabilidade", desc: "Acompanhar o trabalho até a entrega e o esclarecimento de dúvidas." },
  ],
};

/** Critério "Cultura MinasLab": conferência da liderança ({ em, valores: [ids] }) dentro da janela. */
export function criterioCultura(conf, hoje) {
  const meses = conf?.em ? mesesEntre(conf.em, hoje) : null;
  if (meses == null || meses >= REGRAS.mesesAvaliacao) {
    return { id: "cultura", nome: "Cultura MinasLab", ok: null, detalhe: conf?.em ? `conferida em ${conf.em.split("-").reverse().join("/")}; conferir de novo (vale ${REGRAS.mesesAvaliacao} meses)` : "a liderança ainda não conferiu os valores" };
  }
  const marcados = new Set(conf.valores || []);
  const faltam = CULTURA.valores.filter((v) => !marcados.has(v.id));
  return { id: "cultura", nome: "Cultura MinasLab", ok: !faltam.length, detalhe: faltam.length ? `valores a desenvolver: ${faltam.map((v) => v.nome).join(", ")}` : `os ${CULTURA.valores.length} valores conferidos em ${conf.em.split("-").reverse().join("/")}` };
}

// CBO sugerido de cada cargo (Classificação Brasileira de Ocupações, usada no
// eSocial). Vazio = definir com a contabilidade (estágio não exige CBO; Gerente
// da Qualidade e Operador de Coletas dependem do conteúdo real do trabalho).
// O enquadramento final é da contabilidade: vale o que a pessoa faz, não o nome.
export const cboDoCargo = (cargo) => NIVEIS.find((n) => n.cargo === cargo)?.cbo || "";

// Política salarial: cada faixa tem 4 degraus (A a D), do mínimo ao máximo.
// Entrada no A; mérito sobe um degrau no ciclo (janeiro/julho) com os critérios
// atendidos e orçamento; promoção vai ao primeiro degrau do novo cargo que não
// reduz o salário; reajuste coletivo da data-base corrige todas as faixas.
const DEGRAUS = ["A", "B", "C", "D"];
const arred10 = (v) => Math.round(v / 10) * 10;
export function degrausDaFaixa(f) {
  if (!f) return [];
  const passo = (f.max - f.min) / (DEGRAUS.length - 1);
  return DEGRAUS.map((nome, i) => ({ nome, valor: i === 0 ? f.min : i === DEGRAUS.length - 1 ? f.max : arred10(f.min + passo * i) }));
}
export function degrauDoSalario(f, salario) {
  if (!f || salario == null) return "";
  if (salario < f.min) return "abaixo da faixa";
  if (salario > f.max) return "acima da faixa";
  return degrausDaFaixa(f).filter((d) => d.valor <= salario).at(-1).nome;
}
export function salarioNaPromocao(salarioAtual, faixaDestino) {
  const d = degrausDaFaixa(faixaDestino);
  if (!d.length) return null;
  if (salarioAtual == null) return d[0].valor;
  return (d.find((x) => x.valor >= salarioAtual) || { valor: salarioAtual }).valor;
}

export const nivelPorId = (id) => NIVEIS.find((n) => n.id === id) || null;
const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
/** Nível do plano pela função do sistema (nome da função). */
export const nivelDaFuncao = (nomeFuncao) => (nomeFuncao ? NIVEIS.find((n) => [n.funcao, ...(n.antigos || [])].some((x) => norm(x) === norm(nomeFuncao))) || null : null);
export const trilhasDoNivel = (id) => TRILHAS_CARREIRA.filter((t) => t.niveis.includes(id));

// ------------------------------------------------------- Faixas salariais
const vazio = (v) => v == null || v === "";
/** Lê um valor em reais digitado ("2.400,50", "R$ 2400"); null se vazio ou inválido. */
export function lerReais(texto) {
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : null;
  const t = String(texto ?? "").replace(/R\$|\s/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/\.(?=\d{3}(\D|$))/g, ""));
  return Number.isFinite(n) ? n : null;
}
const reais = (v) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
/** "R$ 2.250 a R$ 2.550". */
export const formatarFaixa = (f) => (f ? `${reais(f.min)} a ${reais(f.max)}` : "");
/** Mensagem de erro da faixa digitada ("" se estiver boa); null = usar o padrão. */
export function validarFaixa(min, max) {
  if ((min != null && min <= 0) || (max != null && max <= 0)) return "O salário deve ser maior que zero.";
  if (min != null && max != null && min > max) return "O salário mínimo não pode ser maior que o máximo.";
  return "";
}
/** Faixa do cargo: padrão do plano com o ajuste da direção por cima (campo vazio = padrão). */
export function faixaSalarial(id, ajustes = {}) {
  const n = nivelPorId(id);
  if (!n?.salario) return null;
  const aj = ajustes[id] || {};
  const amin = vazio(aj.salarioMin) ? null : lerReais(aj.salarioMin);
  const amax = vazio(aj.salarioMax) ? null : lerReais(aj.salarioMax);
  return {
    min: amin ?? n.salario.min,
    max: amax ?? n.salario.max,
    obs: [n.salario.obs, aj.faixa].filter(Boolean).join("; "),
    ajustada: amin != null || amax != null,
  };
}
/** Faixas para conferir: mínimo maior que o máximo, ou degrau que começa abaixo do anterior. */
export function avisosFaixas(ajustes = {}) {
  const out = [];
  for (const t of TRILHAS_CARREIRA) {
    t.niveis.forEach((id, i) => {
      const f = faixaSalarial(id, ajustes);
      if (f.min > f.max && !out.some((a) => a.para === id && !a.de)) out.push({ trilha: t.id, de: null, para: id, texto: `${nivelPorId(id).cargo}: o mínimo (${reais(f.min)}) está maior que o máximo (${reais(f.max)}).` });
      if (i === 0) return;
      const ant = faixaSalarial(t.niveis[i - 1], ajustes);
      if (f.min < ant.min) out.push({ trilha: t.id, de: t.niveis[i - 1], para: id, texto: `${t.nome}: ${nivelPorId(id).cargo} começa em ${reais(f.min)}, abaixo de ${nivelPorId(t.niveis[i - 1]).cargo} (${reais(ant.min)}).` });
    });
  }
  return out;
}

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
export function prontidao({ nivel, tempoMinimo, desde, hoje, notas = [], ocorrencias = [], pdi = [], obrigatorios = [], naoEficazes = 0, estagio = "", cultura = null }) {
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

  crit.push(criterioCultura(cultura, hoje));

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
    "Cultura MinasLab: só cresce quem vive a missão e os valores da empresa, conferidos pela liderança.",
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
  politica: [
    "Cada faixa tem 4 degraus (A, B, C e D), do mínimo ao máximo do cargo.",
    "Entrada: no degrau A do cargo; acima dele só com justificativa registrada pela direção.",
    "Mérito: nos ciclos de janeiro e julho, quem atende aos critérios do plano (avaliação, ocorrências e cultura) pode subir um degrau dentro da mesma faixa, conforme o orçamento.",
    "Promoção: a pessoa vai para o primeiro degrau do novo cargo que não reduza o salário atual.",
    "Reajuste coletivo: na data-base, o índice da convenção coletiva (ou o INPC, se não houver convenção) corrige os salários e todas as faixas, para todos.",
    "Ninguém fica abaixo do mínimo da faixa do próprio cargo; quem está acima do máximo mantém o salário, sem novos aumentos por mérito até a faixa alcançar.",
  ],
  salario: "Cada cargo tem uma faixa salarial (mínimo e máximo) definida pela direção, com referência no mercado de Montes Claros/MG em novembro de 2026. Dentro da mesma trilha, a faixa de um cargo começa acima da do cargo anterior. Estagiários recebem bolsa-auxílio (Lei 11.788/2008), não salário. As faixas são revistas uma vez por ano, junto com a revisão do plano.",
  legal: "O plano é norma interna da empresa (CLT, art. 461, §§ 2º e 3º): as promoções seguem critérios de merecimento e de tempo no cargo descritos aqui. Confirme a redação final com a contabilidade ou o jurídico.",
  revisao: "O plano é revisto uma vez por ano ou quando um cargo for criado ou mudar; toda mudança sobe a revisão do documento.",
};
