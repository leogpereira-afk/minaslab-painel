// Trilhas de treinamento prontas para aplicar. Cada uma: objetivo, roteiro de
// 20 a 40 minutos, pontos para os slides, exercício com casos reais da casa e
// teste rápido. `gatilho` diz qual número do sistema sugere a trilha.

import { TRILHAS_PG } from "./treinamentosPG.js";
import { TRILHA_GESTAO_TEMPO } from "./treinamentosTrilhas.js";
import { TRILHA_VISUAL } from "./treinamentoVisual.js";
import { modeloPorId } from "./modelosApresentacao.js";
import { perguntasDoModelo } from "./treinamentosPG.js";

const TRILHAS_COMERCIAL = [
  {
    id: "crm-sem-furos",
    nome: "CRM sem furos",
    publico: "Toda a equipe",
    minutos: 30,
    objetivo: "Toda proposta com responsável, toda conversa e toda ligação registradas no CRM.",
    gatilho: "semResponsavel",
    indicador: "Propostas sem responsável (% do mês)",
    slides: [
      "Por que o registro importa: sem responsável, a meta de cada um sai errada e ninguém é reconhecido pelo que fez.",
      "O que é obrigatório em toda proposta: responsável, cliente, valor, data de envio, situação.",
      "Interação: toda conversa relevante com o cliente vira uma linha no histórico da proposta.",
      "Ligação: registrar como interação do tipo ligação, com uma frase do que foi falado.",
      "Combinado da equipe: proposta não sai sem responsável; quem cria é responsável até passar adiante.",
    ],
    roteiro: [
      { min: "0–5", passo: "Mostre o número do mês: quantas propostas ficaram sem responsável e o que isso causa na meta de cada um." },
      { min: "5–15", passo: "No CRM, ao vivo: abrir uma proposta, definir responsável, registrar interação e ligação." },
      { min: "15–25", passo: "Exercício: cada pessoa corrige as propostas sem responsável da lista (tela Qualidade do dado)." },
      { min: "25–30", passo: "Teste rápido e combinado da semana." },
    ],
    exercicio: "Abra a tela Qualidade do dado do mês, divida a lista entre as pessoas e cada uma atribui o responsável certo no CRM.",
    perguntas: [
      { p: "Uma proposta foi criada por você e enviada pela colega. Quem é o responsável?", opcoes: ["Ninguém, tanto faz", "Quem vai acompanhar até o fechamento, combinado entre as duas", "Sempre a gestora"], certa: 1 },
      { p: "O cliente ligou perguntando prazo. O que registrar?", opcoes: ["Nada, foi só uma dúvida", "Uma interação do tipo ligação com uma frase do que foi falado", "Só se ele aprovar"], certa: 1 },
      { p: "Por que proposta sem responsável prejudica você?", opcoes: ["Não prejudica", "Ela não conta na sua meta nem no seu reconhecimento", "Porque o sistema trava"], certa: 1 },
    ],
  },
  {
    id: "follow-up",
    nome: "Follow-up que fecha",
    publico: "Propostas e atendimento",
    minutos: 40,
    objetivo: "Toda proposta enviada recebe retorno em até 7 dias, com motivo registrado quando é perdida.",
    gatilho: "aprovacao",
    indicador: "Taxa de aprovação e propostas abertas há mais de 15 dias",
    slides: [
      "A chance de aprovar cai com a idade da proposta: o sistema mostra isso na tela Funil.",
      "Cadência: dia 2 (confirmar recebimento), dia 7 (tirar dúvidas), dia 15 (proposta de decisão), dia 30 (encerrar ou reformular).",
      "Cada contato tem um objetivo: descobrir a objeção, não só “cobrar”.",
      "Objeções comuns no laboratório: preço, prazo de resultado, escopo de parâmetros, logística de coleta.",
      "Perdeu? Registre o motivo: é o que ensina a próxima proposta.",
    ],
    roteiro: [
      { min: "0–5", passo: "Mostre as propostas abertas por idade (tela Funil) e a chance de cada faixa." },
      { min: "5–15", passo: "Apresente a cadência de 2, 7, 15 e 30 dias e o objetivo de cada contato." },
      { min: "15–30", passo: "Dramatização em dupla: uma faz o cliente com uma objeção real, a outra conduz o follow-up." },
      { min: "30–40", passo: "Cada pessoa escolhe 5 propostas paradas e agenda o próximo contato. Teste rápido." },
    ],
    exercicio: "Pegue as 10 propostas abertas de maior valor da equipe e defina, para cada uma, o próximo contato, a data e a pergunta que vai fazer.",
    perguntas: [
      { p: "Proposta enviada há 9 dias sem resposta. Qual o objetivo do próximo contato?", opcoes: ["Perguntar se já aprovou", "Descobrir a dúvida ou objeção que está travando", "Esperar mais uma semana"], certa: 1 },
      { p: "O cliente recusou por preço. O que fazer?", opcoes: ["Encerrar sem registrar", "Registrar o motivo e avaliar escopo ou condição alternativa", "Dar desconto sem consultar"], certa: 1 },
      { p: "Quando encerrar uma proposta parada?", opcoes: ["Nunca", "Por volta de 30 dias, com motivo registrado ou proposta reformulada", "No mesmo dia"], certa: 1 },
    ],
  },
  {
    id: "analise-critica",
    nome: "Análise crítica de propostas (PG 006)",
    publico: "Comercial, administrativo, gerência técnica e coletores",
    minutos: 40,
    modelo: "analise-critica",
    objetivo: "Toda proposta passa pela análise crítica do PG 006 (ISO/IEC 17025, 7.1) antes de ir ao cliente, com aceite e alterações registrados.",
    gatilho: "ocorrencia:Erro em proposta",
    indicador: "Ocorrências do tipo “Erro em proposta”",
    slides: [
      "A ISO/IEC 17025 (7.1) exige: requisitos claros, capacidade e recursos, método apropriado, provedor externo informado, diferenças resolvidas antes de começar e registro.",
      "Fluxo da proposta: cadastro do cliente, requisitos, proposta (POP-CQ-005), análise crítica pela gerência, aprovação no sistema, envio e aceite registrado.",
      "Checklist do PG 006: métodos definidos; capacidade e recursos; método apropriado; diferenças resolvidas; trabalho externo coberto.",
      "Aceite por e-mail, área do cliente ou telefone (registrando no sistema).",
      "Mudou depois de começar: nova análise crítica, comunicar os envolvidos e registrar a aprovação do cliente.",
    ],
    roteiro: [
      { min: "0–5", passo: "Abertura: quem já precisou refazer uma proposta depois de enviada? Mostre as ocorrências de erro em proposta do período (sem expor ninguém)." },
      { min: "5–20", passo: "Apresentação colorida: o que a 17025 exige, o fluxo da proposta e o checklist do PG 006." },
      { min: "20–30", passo: "Quizzes em grupo: a turma vota em cada caso antes de você revelar a resposta." },
      { min: "30–40", passo: "Exercício com propostas reais e teste individual. Registre as notas em Registrar aplicação." },
    ],
    exercicio: "Cada pessoa pega uma proposta enviada no mês e passa os 5 itens do checklist do PG 006: onde está a evidência de cada um no sistema? O que faltou vira compromisso.",
    perguntas: [
      { p: "O técnico chega na ETE e o ponto de saída está seco. O que fazer?", opcoes: ["Coletar só a entrada e seguir", "Ligar para o assistente administrativo, que fala com o cliente; o acordo é registrado e repassado ao técnico", "Coletar no dia seguinte sem avisar"], certa: 1 },
      { p: "O cliente já aprovou e pede para incluir DBO. O que acontece?", opcoes: ["Basta incluir na OS", "Nova análise crítica, alteração registrada na proposta e aprovação do cliente", "Pedir nova solicitação daqui a um mês"], certa: 1 },
      { p: "O cliente pede um parâmetro que o MinasLab não faz. E agora?", opcoes: ["Enviar a proposta e resolver depois", "Informar o cliente; se for a um parceiro, isso entra na análise crítica e o cliente fica sabendo", "Tirar o parâmetro sem comentar"], certa: 1 },
      { p: "O cliente aceitou a proposta por telefone. Vale?", opcoes: ["Não, só por e-mail", "Sim, desde que o Comercial registre o aceite no sistema", "Sim, sem registrar"], certa: 1 },
      { p: "Quem pode aprovar a análise crítica de um serviço rotineiro?", opcoes: ["Qualquer pessoa da empresa", "Assistente administrativo capacitado, diretor ou gerente", "Só o cliente"], certa: 1 },
    ],
  },
  {
    id: "proposta-sem-erro",
    nome: "Proposta sem erro",
    publico: "Quem elabora propostas",
    minutos: 30,
    objetivo: "Nenhuma proposta sai faltando parâmetro, prazo, condição de coleta ou escopo pedido pelo cliente.",
    gatilho: "ocorrencia:Erro em proposta",
    indicador: "Ocorrências do tipo “Erro em proposta”",
    slides: [
      "Erro em proposta custa duas vezes: retrabalho agora e confiança do cliente depois.",
      "Checklist antes de enviar: parâmetros pedidos × parâmetros na proposta; matriz; método; prazo; coleta; validade; valor.",
      "Conferência cruzada: em proposta nova ou acima de um valor combinado, uma colega confere antes de sair.",
      "Dúvida técnica vai para o laboratório antes do envio, não depois.",
    ],
    roteiro: [
      { min: "0–5", passo: "Mostre as ocorrências de erro em proposta do período (sem expor ninguém)." },
      { min: "5–15", passo: "Passe o checklist item por item com uma proposta real." },
      { min: "15–25", passo: "Exercício: cada pessoa confere uma proposta de outra com o checklist." },
      { min: "25–30", passo: "Combinar o valor a partir do qual a conferência cruzada é obrigatória. Teste rápido." },
    ],
    exercicio: "Cada pessoa recebe uma proposta enviada no mês e confere com o checklist; anote o que faltaria.",
    perguntas: [
      { p: "O cliente pediu 12 parâmetros e a proposta tem 11. O que fazer?", opcoes: ["Enviar assim", "Conferir com o pedido e corrigir antes de enviar", "Enviar e corrigir se ele reclamar"], certa: 1 },
      { p: "Dúvida sobre o método de um ensaio:", opcoes: ["Escolher qualquer um", "Confirmar com o laboratório antes do envio", "Deixar sem método"], certa: 1 },
    ],
  },
  {
    id: "spin",
    nome: "Venda consultiva (SPIN)",
    publico: "Propostas e atendimento",
    minutos: 40,
    objetivo: "Entender a necessidade do cliente antes de mandar preço: perguntas de situação, problema, implicação e necessidade.",
    gatilho: "ticket",
    indicador: "Ticket médio e taxa de aprovação",
    slides: [
      "Situação: o que o cliente faz hoje (frequência de análises, exigência legal, auditorias).",
      "Problema: o que incomoda (prazo, retrabalho, laudo recusado, multa).",
      "Implicação: o que acontece se não resolver (auditoria, licença, parada de produção).",
      "Necessidade: o que resolveria — e aí a proposta faz sentido para ele.",
      "Laboratório vende confiança: mostre que entendeu o risco do cliente, não só o preço.",
    ],
    roteiro: [
      { min: "0–10", passo: "Apresente as quatro perguntas com exemplos de clientes da casa." },
      { min: "10–30", passo: "Em dupla: cada uma monta 2 perguntas de cada tipo para um cliente real e treina." },
      { min: "30–40", passo: "Compartilhar as melhores perguntas e montar um banco da equipe. Teste rápido." },
    ],
    exercicio: "Escolha um cliente que pediu orçamento esta semana e escreva duas perguntas de cada tipo antes de enviar a proposta.",
    perguntas: [
      { p: "“Se o laudo atrasar, o que acontece com a sua licença?” é uma pergunta de:", opcoes: ["Situação", "Implicação", "Necessidade"], certa: 1 },
      { p: "Quando falar de preço?", opcoes: ["Na primeira frase", "Depois de entender o problema e o que ele precisa", "Nunca"], certa: 1 },
    ],
  },
  {
    id: "tecnico",
    nome: "Conhecimento técnico dos ensaios",
    publico: "Comercial",
    minutos: 40,
    objetivo: "Explicar ao cliente o que o laboratório analisa, por que, em quanto tempo e com qual exigência legal.",
    gatilho: "perdaEscopo",
    indicador: "Aprovação e retrabalho em proposta",
    slides: [
      "Os principais tipos de análise que a casa faz e para que servem.",
      "Matrizes, parâmetros e as legislações que o cliente costuma citar.",
      "Prazos reais de resultado por tipo de análise e o que atrasa.",
      "Coleta: quem faz, como agendar, o que o cliente precisa preparar.",
    ],
    roteiro: [
      { min: "0–25", passo: "Alguém do laboratório apresenta os ensaios mais vendidos e responde perguntas." },
      { min: "25–40", passo: "Cada pessoa explica um ensaio para a outra como se fosse o cliente. Teste rápido." },
    ],
    exercicio: "Monte, com o laboratório, uma folha de uma página por tipo de análise: para que serve, prazo, legislação.",
    perguntas: [
      { p: "O cliente pergunta o prazo do resultado. Você não sabe. O que fazer?", opcoes: ["Chutar um prazo", "Confirmar com o laboratório e retornar", "Dizer que é rápido"], certa: 1 },
    ],
  },
  {
    id: "atendimento",
    nome: "Atendimento e pós-venda",
    publico: "Toda a equipe",
    minutos: 30,
    objetivo: "Cliente atendido no prazo combinado, informado do andamento e ouvido depois da entrega.",
    gatilho: "nps",
    indicador: "NPS e ocorrências de atendimento",
    slides: [
      "Tempo de primeira resposta: cliente sem retorno é cliente procurando outro laboratório.",
      "Avisar antes de atrasar: informar o andamento evita a maioria das reclamações.",
      "Depois da entrega: perguntar de 0 a 10 se recomendaria (NPS) e o porquê.",
      "Detrator (0 a 6): contato em até 48 horas, ouvir, registrar e resolver.",
    ],
    roteiro: [
      { min: "0–10", passo: "Mostre as reclamações e notas do período (tela Satisfação)." },
      { min: "10–25", passo: "Treine a ligação para um detrator: ouvir, resumir, combinar a solução." },
      { min: "25–30", passo: "Combinar quem pergunta o NPS e quando. Teste rápido." },
    ],
    exercicio: "Ligue para 3 clientes atendidos no mês, pergunte a nota de 0 a 10 e registre em Satisfação.",
    perguntas: [
      { p: "Cliente deu nota 5. O que fazer?", opcoes: ["Nada", "Contato em até 48 horas para entender e resolver", "Pedir para mudar a nota"], certa: 1 },
    ],
  },
  {
    id: "licitacoes",
    nome: "Licitações: edital e documentação",
    publico: "Licitações",
    minutos: 40,
    objetivo: "Nenhuma licitação perdida por documento ou prazo.",
    gatilho: "licitacao",
    indicador: "Taxa de vitória e perdas por documentação",
    slides: [
      "Leitura do edital: objeto, habilitação, prazos, critério de julgamento, visita técnica.",
      "Checklist de documentos de habilitação e validade de cada certidão.",
      "Calendário: sessão, esclarecimento, impugnação, recurso — todos no CRM com lembrete.",
      "Depois do resultado: registrar motivo de perda e preço do vencedor.",
    ],
    roteiro: [
      { min: "0–15", passo: "Leia junto um edital real e marque os pontos críticos." },
      { min: "15–30", passo: "Monte o checklist de documentos e confira validades." },
      { min: "30–40", passo: "Lance os prazos no CRM. Teste rápido." },
    ],
    exercicio: "Pegue a próxima licitação em análise e preencha o checklist de habilitação com as validades.",
    perguntas: [
      { p: "Certidão vence um dia antes da sessão. O que fazer?", opcoes: ["Esperar", "Renovar antes e conferir a validade na data da sessão", "Mandar a vencida"], certa: 1 },
    ],
  },
  {
    id: "os-correta",
    nome: "OS correta e comunicação com o laboratório",
    publico: "Suporte operacional",
    minutos: 30,
    objetivo: "Ordem de serviço sai completa e o laboratório recebe a informação certa da primeira vez.",
    gatilho: "ocorrencia:Retrabalho",
    indicador: "Ocorrências de retrabalho em OS",
    slides: [
      "O que a OS precisa ter: cliente, ponto de coleta, matriz, parâmetros, prazo, observações do cliente.",
      "Conferir a OS contra a proposta aprovada antes de liberar.",
      "Mudança pedida pelo cliente: registrar e avisar o laboratório no mesmo dia.",
    ],
    roteiro: [
      { min: "0–10", passo: "Mostre as ocorrências de retrabalho do período." },
      { min: "10–25", passo: "Confira uma OS real contra a proposta, campo a campo." },
      { min: "25–30", passo: "Combinar o canal único de aviso ao laboratório. Teste rápido." },
    ],
    exercicio: "Confira as 5 últimas OS abertas contra as propostas aprovadas e anote divergências.",
    perguntas: [
      { p: "Cliente pediu um parâmetro a mais depois da OS aberta:", opcoes: ["Ignorar", "Registrar a mudança e avisar o laboratório no mesmo dia", "Avisar só na entrega"], certa: 1 },
    ],
  },
  {
    id: "gestora",
    nome: "Trilha da gestora: feedback, 1:1 e reuniões",
    publico: "Gestora",
    minutos: 20,
    objetivo: "Conversa individual todo mês, com número na mão, e reuniões curtas que terminam em compromisso.",
    gatilho: "feedbacks",
    indicador: "Feedbacks em dia e compromissos cumpridos",
    slides: [
      "Feedback: fato, impacto, pergunta, combinado com prazo (modelo SCI: situação, comportamento, impacto).",
      "Importe-se pessoalmente e desafie diretamente: elogio específico e crítica clara, sem rodeio.",
      "1:1 é da pessoa: comece perguntando o que está atrapalhando.",
      "Reunião rápida de segunda: placar, compromisso de cada um, nada de discussão longa.",
      "Ajuste o estilo à maturidade: direcionar, orientar, apoiar ou delegar.",
    ],
    roteiro: [
      { min: "0–10", passo: "Revise os feedbacks do mês anterior e os combinados em aberto." },
      { min: "10–20", passo: "Prepare a próxima 1:1 de cada pessoa com o roteiro da tela Pessoas e feedback." },
    ],
    exercicio: "Escreva, para cada pessoa, um elogio específico e um ponto a melhorar com o número do mês.",
    perguntas: [
      { p: "Qual é a melhor forma de dar um ponto a melhorar?", opcoes: ["Genérico, para não magoar", "Com o fato, o impacto e uma pergunta, combinando prazo", "Só na avaliação anual"], certa: 1 },
    ],
  },
];

/** Temas em que as trilhas são agrupadas na tela. */
export const TEMAS = [
  { id: "integracao", nome: "Integração", desc: "Boas-vindas, ISO/IEC 17025, escopo e ética para quem chega." },
  { id: "qualidade", nome: "ISO/IEC 17025 e qualidade", desc: "Procedimentos gerais (PG): análise crítica, recebimento, armazenamento, reclamações." },
  { id: "amostragem", nome: "Amostragem e coleta", desc: "POPs de amostragem: controles de campo, altura, vazão, solo e água subterrânea." },
  { id: "vendas", nome: "Vendas, propostas e OS", desc: "CRM, follow-up, proposta, venda consultiva, licitações e ordem de serviço." },
  { id: "atendimento", nome: "Atendimento ao cliente", desc: "Atendimento, pós-venda e pesquisa de satisfação (PG 012)." },
  { id: "tecnico", nome: "Conhecimento técnico", desc: "Ensaios, matrizes, legislação e prazos." },
  { id: "gestao", nome: "Gestão e desenvolvimento", desc: "Gestão do tempo, feedback, 1:1 e reuniões." },
  { id: "proprios", nome: "Criados por você", desc: "Treinamentos cadastrados na tela." },
];

// Setores e tema de cada trilha do Comercial original. Os que também valem
// para o laboratório (gerência técnica, coletores) aparecem nos dois setores.
const EXTRA = {
  "crm-sem-furos": [["comercial"], "vendas"], "follow-up": [["comercial"], "vendas"],
  "analise-critica": [["comercial", "laboratorio"], "qualidade"], "proposta-sem-erro": [["comercial"], "vendas"],
  spin: [["comercial"], "vendas"], tecnico: [["comercial"], "tecnico"], atendimento: [["comercial"], "atendimento"],
  licitacoes: [["comercial"], "vendas"], "os-correta": [["comercial", "laboratorio"], "vendas"],
  gestora: [["comercial", "laboratorio"], "gestao"],
};

const INTEGRACAO = {
  id: "integracao", modelo: "integracao", minutos: 60, tema: "integracao", setores: ["comercial", "laboratorio"],
  nome: "Integração de novos colaboradores", publico: "Todo colaborador novo",
  objetivo: "Quem chega conhece a ISO/IEC 17025, o escopo acreditado (CRL 1943), as regras de recebimento e a Declaração de Ética.",
  gatilho: "novos", indicador: "Novos colaboradores integrados no prazo",
  slides: ["Os 4 pilares da ISO/IEC 17025.", "Escopo acreditado CRL 1943 e matrizes.", "Recepção: temperatura, frascos e placas.", "Declaração de Ética: comportamento, confidencialidade, segurança."],
  exercicio: "Acompanhe uma recepção de amostras com a pessoa nova e peça para ela conferir temperatura, frascos e lacres.",
};

const DOCUMENTOS = {
  "analise-critica": "PG 006 rev. 03", "pg012-satisfacao": "PG 012 rev. 02", "pg013-reclamacoes": "PG 013 rev. 03",
  "pg010-recebimento": "PG 010 rev. 02", "pg011-armazenamento": "PG 011 rev. 02",
  "am-amostragem": "POP-AM-001 rev. 04, PL AM-001 e POP-AM-006", "am-coletas-especiais": "POP-AM-002, POP-AM-003 e POP-AM-004",
  "am-purga": "POP-AM-005 (ABNT NBR 15847)", integracao: "Manual de integração e Declaração de Ética",
};

const comModelo = (t) => {
  const m = t.modelo || (modeloPorId(t.id) ? t.id : null);
  const perguntas = m && modeloPorId(m) ? perguntasDoModelo(modeloPorId(m).slides) : [];
  return { documento: DOCUMENTOS[t.id] || "", ...t, modelo: m, perguntas: perguntas.length ? perguntas : t.perguntas || [] };
};
const roteiroPadrao = (min) => {
  const a = Math.round(min * 0.45), b = Math.round(min * 0.7);
  return [
    { min: "0–5", passo: "Abertura com um caso real da casa." },
    { min: `5–${a}`, passo: "Apresentação colorida." },
    { min: `${a}–${b}`, passo: "Quizzes em grupo: a turma vota em cada caso antes de você revelar a resposta." },
    { min: `${b}–${min}`, passo: "Exercício prático e teste individual. Registre as notas em Registrar aplicação." },
  ];
};

/** Todas as trilhas. Cada uma vale para um ou mais setores e pertence a um tema. */
export const TRILHAS = [
  comModelo({ ...INTEGRACAO, roteiro: roteiroPadrao(60) }),
  ...TRILHAS_COMERCIAL.map((t) => comModelo({ ...t, setores: EXTRA[t.id]?.[0] || ["comercial"], tema: EXTRA[t.id]?.[1] || "vendas" })),
  ...TRILHAS_PG.map(comModelo),
  comModelo({ ...TRILHA_VISUAL, roteiro: roteiroPadrao(30) }),
  comModelo({ ...TRILHA_GESTAO_TEMPO, roteiro: roteiroPadrao(40) }),
];
export const trilhasDoSetor = (setor) => TRILHAS.filter((t) => t.setores.includes(setor));

export const trilhaPorId = (id) => TRILHAS.find((t) => t.id === id);
