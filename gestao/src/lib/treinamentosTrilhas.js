// Apresentações didáticas (estilo colorido, com quiz) das trilhas do
// Comercial que antes só tinham tópicos, e o treinamento de gestão de tempo.
// O teste de cada trilha sai dos quizzes da própria apresentação.

const S = (layout, campos = {}, notas = "") => ({ layout, ...campos, notas });
const FIM = (frase, destaque) => [
  S("compromissos", { titulo: "Compromissos" }, "Feche com 1 a 3 compromissos práticos, com dono e data."),
  S("encerramento", { titulo: "Dúvidas?", subtitulo: frase, texto: "Registre a aplicação em Treinamentos › Trilhas › Registrar aplicação.", destaque }),
];
const PRATICA = (texto, notas = "") => S("topicos", { titulo: "Mão na massa", texto, destaque: "Use casos reais da casa: exemplo genérico ensina menos." }, notas);

const CRM = () => [
  S("capa", { titulo: "CRM sem Furos", subtitulo: "Registro completo, meta justa", texto: "Toda proposta com responsável, toda conversa e toda ligação registradas no CRM.", destaque: "Responsável · Interação · Ligação · Histórico" }, "Abertura: mostre o número do mês de propostas sem responsável, sem expor ninguém."),
  S("frase", { titulo: "Por que isso importa", frase: "O que não está no CRM não aconteceu.", texto: "Sem responsável, a proposta não conta na meta de ninguém e ninguém é reconhecido pelo que fez." }),
  S("tabela", { titulo: "O que é obrigatório em toda proposta", itens: "Campo | Por quê\nResponsável | Conta na meta e no reconhecimento\nCliente | Histórico e carteira\nValor | Funil e previsão do mês\nData de envio | Mede o tempo de retorno\nSituação | Aberta, aprovada ou perdida" }),
  S("fluxo", { titulo: "A vida de uma proposta no CRM", itens: "Criar | Com responsável definido\nEnviar | Data registrada\nConversar | Cada contato vira interação\nLigar | Interação tipo ligação\nFechar | Aprovada ou perdida com motivo" }),
  S("colunas", { titulo: "Interação ou ligação?", itens: "## Interação\nToda conversa relevante: e-mail, WhatsApp, reunião. Uma linha no histórico da proposta.\n## Ligação\nRegistrar como interação do tipo ligação, com uma frase do que foi falado.\n## Responsável\nQuem cria é responsável até passar adiante, combinando com a colega." }),
  S("numero", { titulo: "Meta da equipe", numero: "< 5%", rotulo: "de propostas sem responsável no mês", texto: "Acompanhe na tela Qualidade do dado.\nCombinado: proposta não sai sem responsável." }),
  S("quiz", { titulo: "Quiz", texto: "Uma proposta foi criada por você e enviada pela colega. Quem é o responsável?", itens: "Ninguém, tanto faz\n* Quem vai acompanhar até o fechamento, combinado entre as duas\nSempre a gestora", destaque: "O responsável é quem acompanha até o fechamento. Combinem e registrem no CRM." }),
  S("quiz", { titulo: "Quiz", texto: "O cliente ligou perguntando o prazo. O que registrar?", itens: "Nada, foi só uma dúvida\n* Uma interação do tipo ligação com uma frase do que foi falado\nSó se ele aprovar", destaque: "Toda ligação vira histórico: ajuda quem atender depois." }),
  S("quiz", { titulo: "Quiz", texto: "Por que proposta sem responsável prejudica você?", itens: "Não prejudica\n* Ela não conta na sua meta nem no seu reconhecimento\nPorque o sistema trava", destaque: "A meta e o destaque do mês saem do CRM." }),
  PRATICA("Abram a tela Qualidade do dado do mês\nDividam a lista de propostas sem responsável\nCada pessoa atribui o responsável certo no CRM\nConfiram juntas o novo percentual", "Exercício de 10 minutos, ao vivo no CRM."),
  ...FIM("Registro completo é meta justa.", "Responsável · Interação · Ligação"),
];

const FOLLOW = () => [
  S("capa", { titulo: "Follow-up que Fecha", subtitulo: "Cadência e objetivo em cada contato", texto: "Toda proposta enviada recebe retorno em até 7 dias, com motivo registrado quando é perdida.", destaque: "Dia 2 · Dia 7 · Dia 15 · Dia 30 · Motivo" }, "Abertura: mostre as propostas abertas por idade na tela Funil."),
  S("frase", { titulo: "Por que isso importa", frase: "A chance de aprovar cai a cada dia que a proposta fica parada.", texto: "Follow-up não é cobrança: é descobrir o que está travando a decisão do cliente." }),
  S("fluxo", { titulo: "A cadência", itens: "Dia 2 | Confirmar recebimento\nDia 7 | Tirar dúvidas\nDia 15 | Pedir a decisão\nDia 30 | Encerrar ou reformular!", destaque: "Cada contato com data no CRM e uma pergunta preparada." }),
  S("colunas", { titulo: "Objeções comuns no laboratório", itens: "## Preço\nMostre o que está incluso e o risco de um laudo recusado.\n## Prazo de resultado\nExplique o prazo real e o que acelera.\n## Escopo\nConfira se os parâmetros atendem à exigência do cliente.\n## Coleta\nCombine logística, frascos e quem coleta." }),
  S("tabela", { titulo: "Perguntas que destravam", itens: "Situação | Pergunte\nSem resposta | Ficou alguma dúvida sobre os parâmetros ou o prazo?\nAchou caro | O que pesa mais na decisão: preço, prazo ou escopo?\nVai pensar | Quem mais participa da decisão e até quando?\nPerdida | O que fez você escolher outra opção?" }),
  S("numero", { titulo: "Regra de ouro", numero: "7 dias", rotulo: "prazo máximo para o primeiro retorno", texto: "Perdeu? Registre o motivo: é o que ensina a próxima proposta." }),
  S("quiz", { titulo: "Quiz", texto: "Proposta enviada há 9 dias sem resposta. Qual o objetivo do próximo contato?", itens: "Perguntar se já aprovou\n* Descobrir a dúvida ou objeção que está travando\nEsperar mais uma semana", destaque: "Contato com objetivo: entender a objeção." }),
  S("quiz", { titulo: "Quiz", texto: "O cliente recusou por preço. O que fazer?", itens: "Encerrar sem registrar\n* Registrar o motivo e avaliar escopo ou condição alternativa\nDar desconto sem consultar", destaque: "Motivo registrado vira aprendizado; desconto passa pela gestão." }),
  S("quiz", { titulo: "Quiz", texto: "Quando encerrar uma proposta parada?", itens: "Nunca\n* Por volta de 30 dias, com motivo registrado ou proposta reformulada\nNo mesmo dia", destaque: "Dia 30: encerrar com motivo ou reformular." }),
  PRATICA("Peguem as 10 propostas abertas de maior valor\nPara cada uma: próximo contato, data e pergunta\nEm dupla: uma faz o cliente com uma objeção real, a outra conduz"),
  ...FIM("Proposta acompanhada é proposta que fecha.", "Cadência · Objetivo · Motivo"),
];

const PROPOSTA = () => [
  S("capa", { titulo: "Proposta sem Erro", subtitulo: "Checklist antes de enviar", texto: "Nenhuma proposta sai faltando parâmetro, prazo, condição de coleta ou escopo pedido pelo cliente.", destaque: "Parâmetros · Matriz · Método · Prazo · Coleta · Valor" }),
  S("frase", { titulo: "Por que isso importa", frase: "Erro em proposta custa duas vezes: retrabalho agora e confiança do cliente depois." }),
  S("tabela", { titulo: "Checklist antes de enviar", itens: "Item | Conferir\nParâmetros | Os pedidos são os que estão na proposta?\nMatriz | Água, efluente, solo... está certa?\nMétodo | Adequado e confirmado com o laboratório\nPrazo | Prazo real de resultado\nColeta | Quem coleta, frascos, logística\nValidade e valor | Corretos e conferidos" }),
  S("fluxo", { titulo: "Conferência em 3 passos", itens: "Pedido | Leia de novo o que o cliente pediu\nChecklist | Item por item\nDúvida técnica | Laboratório antes do envio!\nConferência cruzada | Colega confere as maiores" }),
  S("colunas", { titulo: "Conferência cruzada", itens: "## Quando\nProposta nova ou acima do valor combinado pela equipe.\n## Quem\nUma colega que não elaborou a proposta.\n## Como\nO mesmo checklist, com o pedido do cliente ao lado." }),
  S("quiz", { titulo: "Caso real", texto: "O cliente pediu 12 parâmetros e a proposta tem 11. O que fazer?", itens: "Enviar assim\n* Conferir com o pedido e corrigir antes de enviar\nEnviar e corrigir se ele reclamar", destaque: "Pedido × proposta é o primeiro item do checklist." }),
  S("quiz", { titulo: "Quiz", texto: "Dúvida sobre o método de um ensaio. O que fazer?", itens: "Escolher qualquer um\n* Confirmar com o laboratório antes do envio\nDeixar sem método", destaque: "Dúvida técnica se resolve antes de enviar, não depois." }),
  S("quiz", { titulo: "Quiz", texto: "Qual proposta passa pela conferência cruzada?", itens: "Nenhuma, atrasa o envio\n* Proposta nova ou acima do valor combinado\nSó as que o cliente reclamar", destaque: "A equipe combina o valor; acima dele, uma colega confere." }),
  PRATICA("Cada pessoa recebe uma proposta enviada no mês por outra\nPassa o checklist item por item\nAnota o que faltaria e o que pode virar regra da equipe"),
  ...FIM("Conferir antes é mais rápido que corrigir depois.", "Checklist · Laboratório · Conferência"),
];

const SPIN = () => [
  S("capa", { titulo: "Venda Consultiva (SPIN)", subtitulo: "Entender antes de mandar preço", texto: "Perguntas de situação, problema, implicação e necessidade para propor o que o cliente realmente precisa.", destaque: "Situação · Problema · Implicação · Necessidade" }),
  S("frase", { titulo: "Por que isso importa", frase: "Laboratório vende confiança, não só preço.", texto: "Quando o cliente percebe que você entendeu o risco dele, a proposta faz sentido." }),
  S("tabela", { titulo: "As quatro perguntas", itens: "Tipo | Objetivo | Exemplo\nSituação | Entender o hoje | Com que frequência vocês analisam o efluente?\nProblema | Achar o incômodo | Já tiveram laudo recusado ou atraso?\nImplicação | Mostrar o custo | Se o laudo atrasar, o que acontece com a licença?\nNecessidade | Levar à solução | Um cronograma fixo de coletas ajudaria?" }),
  S("fluxo", { titulo: "A conversa", itens: "Situação | Poucas e objetivas\nProblema | Ouça mais que fale\nImplicação | O risco fica claro\nNecessidade | O cliente diz o que quer\nProposta | Agora sim, com preço" }),
  S("colunas", { titulo: "Cuidados", itens: "## Não interrogue\nPoucas perguntas de situação; o cliente se cansa.\n## Use o que ele disse\nRepita as palavras dele na proposta.\n## Exigência legal\nLicença, órgão ambiental e auditoria são implicações fortes." }),
  S("quiz", { titulo: "Quiz", texto: "“Se o laudo atrasar, o que acontece com a sua licença?” é uma pergunta de:", itens: "Situação\n* Implicação\nNecessidade", destaque: "Implicação mostra o custo de não resolver o problema." }),
  S("quiz", { titulo: "Quiz", texto: "Quando falar de preço?", itens: "Na primeira frase\n* Depois de entender o problema e o que ele precisa\nNunca", destaque: "Preço depois do valor: aí a proposta faz sentido." }),
  S("quiz", { titulo: "Quiz", texto: "“Vocês já tiveram algum laudo recusado pelo órgão ambiental?” é uma pergunta de:", itens: "Situação\n* Problema\nNecessidade", destaque: "Pergunta de problema: procura o incômodo do cliente." }),
  PRATICA("Em dupla, escolham um cliente que pediu orçamento esta semana\nEscrevam duas perguntas de cada tipo\nTreinem a conversa e montem o banco de perguntas da equipe"),
  ...FIM("Quem entende o problema do cliente vende a solução.", "S · P · I · N"),
];

const TECNICO = () => [
  S("capa", { titulo: "Conhecimento Técnico dos Ensaios", subtitulo: "Explicar com segurança o que o laboratório faz", texto: "O que analisamos, por que, em quanto tempo e com qual exigência legal.", destaque: "Ensaios · Matrizes · Legislação · Prazos · Coleta" }, "Ideal: alguém do laboratório apresenta e responde perguntas."),
  S("frase", { titulo: "Por que isso importa", frase: "O cliente confia em quem explica com segurança.", texto: "Saber o básico de cada ensaio evita proposta errada e promessa de prazo impossível." }),
  S("colunas", { titulo: "Matrizes que atendemos", itens: "## Água\nBruta, tratada, consumo humano, subterrânea, mineral.\n## Efluentes\nIndustriais e domésticos, ETE, entrada e saída.\n## Solo e sedimento\nFísico-química e microbiologia.\n## Outras\nConforme escopo e laboratórios parceiros." }),
  S("tabela", { titulo: "Para que serve cada grupo", itens: "Grupo | Exemplos | O cliente usa para\nFísico-química | pH, turbidez, DBO, DQO | Licença e controle da ETE\nMicrobiologia | Coliformes, E. coli | Potabilidade e balneabilidade\nMetais | Ferro, manganês, chumbo | Padrão de lançamento e potabilidade\nCampo | Cloro, OD, temperatura | Parâmetros que vencem rápido" }),
  S("colunas", { titulo: "O que o cliente costuma citar", itens: "## Potabilidade\nPortaria de potabilidade do Ministério da Saúde.\n## Efluentes\nResoluções CONAMA e normas estaduais.\n## Licenças\nCondicionantes do órgão ambiental." , destaque: "Na dúvida sobre qual norma vale para o cliente, confirme com o laboratório." }),
  S("fluxo", { titulo: "Prazo real", itens: "Coleta | Agendada e com frascos certos\nRecebimento | Temperatura e conferência\nAnálise | Tempo de cada ensaio\nRelatório | Revisão e emissão", destaque: "Microbiologia precisa chegar em até 24 h; parâmetros de campo em até 15 min." }),
  S("quiz", { titulo: "Quiz", texto: "O cliente pergunta o prazo do resultado. Você não sabe. O que fazer?", itens: "Chutar um prazo\n* Confirmar com o laboratório e retornar\nDizer que é rápido", destaque: "Prometer só o que o laboratório confirma." }),
  S("quiz", { titulo: "Quiz", texto: "Qual grupo de parâmetros precisa ser medido em campo ou em poucos minutos?", itens: "Metais\n* Cloro, pH, oxigênio dissolvido e temperatura\nDQO", destaque: "Pelo POP de amostragem, cloro, pH, OD e temperatura em até 15 minutos." }),
  S("quiz", { titulo: "Quiz", texto: "Em quanto tempo uma amostra de microbiologia deve chegar ao laboratório?", itens: "Até 72 horas\n* Até 24 horas, refrigerada\nNão tem prazo", destaque: "Microbiologia: até 24 horas, abaixo de 6 °C." }),
  PRATICA("Cada pessoa explica um ensaio para a outra como se fosse o cliente\nMonte com o laboratório uma folha por tipo de análise: para que serve, prazo e legislação"),
  ...FIM("Segurança técnica vende mais que desconto.", "Ensaio · Prazo · Legislação"),
];

const ATENDIMENTO = () => [
  S("capa", { titulo: "Atendimento e Pós-venda", subtitulo: "Responder rápido, avisar antes, ouvir depois", texto: "Cliente atendido no prazo combinado, informado do andamento e ouvido depois da entrega.", destaque: "Resposta · Andamento · Entrega · NPS · Detrator" }),
  S("frase", { titulo: "Por que isso importa", frase: "Cliente sem retorno é cliente procurando outro laboratório." }),
  S("fluxo", { titulo: "A jornada do cliente", itens: "Pedido | Primeira resposta rápida\nProposta | No prazo combinado\nColeta e análise | Andamento informado\nEntrega | Relatório explicado\nPós-venda | Nota de 0 a 10" }),
  S("colunas", { titulo: "Avisar antes de atrasar", itens: "## Quando\nAssim que souber que o prazo não será cumprido.\n## Como\nTelefone ou e-mail, com a nova data e o motivo.\n## Por quê\nA maioria das reclamações vem da falta de aviso, não do atraso." }),
  S("tabela", { titulo: "Nota de 0 a 10 (NPS)", itens: "Nota | Quem é | O que fazer\n9 e 10 | Promotor | Agradecer e pedir indicação\n7 e 8 | Neutro | Perguntar o que faltou para 10\n0 a 6 | Detrator | Contato em até 48 horas!" }),
  S("fluxo", { titulo: "Ligação para um detrator", itens: "Ouvir | Sem interromper\nResumir | Mostre que entendeu\nCombinar | Solução e prazo\nRegistrar | Em Satisfação\nRetornar | Confirmar que resolveu" }),
  S("quiz", { titulo: "Quiz", texto: "Cliente deu nota 5. O que fazer?", itens: "Nada\n* Contato em até 48 horas para entender e resolver\nPedir para mudar a nota", destaque: "Detrator (0 a 6): contato em até 48 horas." }),
  S("quiz", { titulo: "Quiz", texto: "O resultado vai atrasar dois dias. Quando avisar o cliente?", itens: "Só no dia da entrega\n* Assim que souber, com a nova data e o motivo\nNão precisa avisar", destaque: "Avisar antes evita a maioria das reclamações." }),
  S("quiz", { titulo: "Quiz", texto: "Cliente deu nota 8. O que perguntar?", itens: "Nada, a nota é boa\n* O que faltou para ser 10\nSe ele quer desconto", destaque: "Neutro tem a pista do que melhorar." }),
  PRATICA("Liguem para 3 clientes atendidos no mês\nPerguntem a nota de 0 a 10 e o porquê\nRegistrem em Clientes › Satisfação"),
  ...FIM("Atendimento bom é o que o cliente lembra.", "Responder · Avisar · Ouvir"),
];

const LICITACOES = () => [
  S("capa", { titulo: "Licitações: Edital e Documentação", subtitulo: "Nenhuma licitação perdida por papel ou prazo", texto: "Leitura do edital, checklist de habilitação, calendário e registro do resultado.", destaque: "Edital · Habilitação · Certidões · Prazos · Resultado" }),
  S("frase", { titulo: "Por que isso importa", frase: "Perder por documento é perder uma licitação que já estava ganha." }),
  S("colunas", { titulo: "O que ler primeiro no edital", itens: "## Objeto\nO que será contratado, quantidades e locais.\n## Habilitação\nDocumentos exigidos e validade.\n## Prazos\nSessão, esclarecimento, impugnação, recurso.\n## Julgamento\nMenor preço, técnica e preço, lote ou item.\n## Visita técnica\nObrigatória? Quando?" }),
  S("tabela", { titulo: "Checklist de habilitação", itens: "Documento | Conferir\nCertidões fiscais | Validade na data da sessão\nAtestados técnicos | Compatíveis com o objeto\nAcreditação e escopo | Parâmetros pedidos no escopo\nDeclarações | Modelos do edital, assinadas" }),
  S("fluxo", { titulo: "Calendário no CRM", itens: "Publicação | Ler e decidir participar\nEsclarecimento | Dúvidas por escrito\nImpugnação | Se houver exigência indevida\nSessão | Documentos e proposta prontos!\nRecurso | Prazo curto" }),
  S("quiz", { titulo: "Quiz", texto: "Uma certidão vence um dia antes da sessão. O que fazer?", itens: "Esperar\n* Renovar antes e conferir a validade na data da sessão\nMandar a vencida", destaque: "Validade conta na data da sessão." }),
  S("quiz", { titulo: "Quiz", texto: "O edital pede um parâmetro fora do nosso escopo. O que fazer?", itens: "Ignorar e participar\n* Avaliar com a gestão: esclarecimento, parceiro informado ou não participar\nPrometer que vamos acreditar", destaque: "Escopo é requisito: decida antes, com a gestão." }),
  S("quiz", { titulo: "Quiz", texto: "Perdemos a licitação. O que registrar?", itens: "Nada\n* O motivo da perda e o preço do vencedor\nSó o nome do vencedor", destaque: "Motivo e preço ensinam a próxima disputa." }),
  PRATICA("Peguem a próxima licitação em análise\nPreencham o checklist de habilitação com as validades\nLancem todos os prazos no CRM com lembrete"),
  ...FIM("Licitação se ganha também no papel.", "Edital · Certidões · Prazos"),
];

const OS = () => [
  S("capa", { titulo: "OS Correta", subtitulo: "Comunicação certa com o laboratório", texto: "Ordem de serviço completa e o laboratório recebendo a informação certa da primeira vez.", destaque: "Cliente · Ponto · Matriz · Parâmetros · Prazo · Observações" }),
  S("frase", { titulo: "Por que isso importa", frase: "OS incompleta vira retrabalho no laboratório e atraso para o cliente." }),
  S("tabela", { titulo: "O que a OS precisa ter", itens: "Campo | Por quê\nCliente e ponto de coleta | Rastreabilidade\nMatriz | Define frascos e preservação\nParâmetros | Iguais à proposta aprovada\nPrazo | Planejamento do laboratório\nObservações do cliente | Exigências especiais" }),
  S("fluxo", { titulo: "Antes de liberar", itens: "Proposta aprovada | Ao lado da OS\nCampo a campo | Conferir\nDivergência? | Resolver antes!\nLiberar | E avisar o laboratório" }),
  S("colunas", { titulo: "Mudou depois de aberta?", itens: "## Registrar\nA mudança na OS e na proposta, se afetar escopo ou preço.\n## Avisar\nO laboratório no mesmo dia, pelo canal combinado.\n## Confirmar\nQue o laboratório recebeu." }),
  S("quiz", { titulo: "Quiz", texto: "O cliente pediu um parâmetro a mais depois da OS aberta. O que fazer?", itens: "Ignorar\n* Registrar a mudança e avisar o laboratório no mesmo dia\nAvisar só na entrega", destaque: "Mudança registrada e laboratório avisado no mesmo dia." }),
  S("quiz", { titulo: "Quiz", texto: "Contra o que conferir a OS antes de liberar?", itens: "Contra a OS anterior do cliente\n* Contra a proposta aprovada, campo a campo\nNão precisa conferir", destaque: "A proposta aprovada é o contrato." }),
  S("quiz", { titulo: "Quiz", texto: "A matriz está errada na OS. Qual o risco?", itens: "Nenhum\n* Frasco e preservação errados, e a amostra pode ser perdida\nSó o relatório sai com nome errado", destaque: "A matriz define frasco, preservação e método." }),
  PRATICA("Confiram as 5 últimas OS abertas contra as propostas aprovadas\nAnotem divergências e combinem o canal único de aviso ao laboratório"),
  ...FIM("OS certa da primeira vez.", "Conferir · Registrar · Avisar"),
];

const GESTORA = () => [
  S("capa", { titulo: "Trilha da Gestora", subtitulo: "Feedback, 1:1 e reuniões que terminam em compromisso", texto: "Conversa individual todo mês, com número na mão, e reuniões curtas.", destaque: "Feedback · 1:1 · Reunião · Estilo" }),
  S("frase", { titulo: "A ideia", frase: "Importe-se pessoalmente e desafie diretamente.", texto: "Elogio específico e crítica clara, sem rodeio e com respeito." }),
  S("fluxo", { titulo: "Feedback em 4 passos", itens: "Situação | Quando e onde\nComportamento | O que a pessoa fez\nImpacto | O efeito no resultado\nCombinado | O que muda e até quando" }),
  S("colunas", { titulo: "A conversa 1:1", itens: "## É da pessoa\nComece perguntando o que está atrapalhando.\n## Com número\nResultado do mês na tela Pessoas e feedback.\n## Termina em combinado\nCom prazo, registrado no sistema." }),
  S("tabela", { titulo: "Estilo conforme a maturidade", itens: "A pessoa | Estilo\nNova na tarefa | Direcionar: passo a passo\nAprendendo | Orientar: explicar o porquê\nCapaz, insegura | Apoiar: ouvir e encorajar\nCapaz e segura | Delegar: acompanhar o resultado" }),
  S("quiz", { titulo: "Quiz", texto: "Qual a melhor forma de dar um ponto a melhorar?", itens: "Genérico, para não magoar\n* Com o fato, o impacto e uma pergunta, combinando prazo\nSó na avaliação anual", destaque: "Fato, impacto, pergunta e combinado com prazo." }),
  S("quiz", { titulo: "Quiz", texto: "Como começar uma 1:1?", itens: "Com a lista de erros do mês\n* Perguntando o que está atrapalhando\nFalando das metas da empresa", destaque: "A 1:1 é da pessoa." }),
  S("quiz", { titulo: "Quiz", texto: "Uma colaboradora nova numa tarefa precisa de qual estilo?", itens: "Delegar\n* Direcionar, com passo a passo\nDeixar descobrir sozinha", destaque: "Quem é novo na tarefa precisa de direção clara." }),
  PRATICA("Para cada pessoa: um elogio específico e um ponto a melhorar com o número do mês\nPrepare a próxima 1:1 com o roteiro da tela Pessoas e feedback"),
  ...FIM("Equipe cresce com conversa frequente e honesta.", "Feedback · 1:1 · Combinado"),
];

// ------------------------------------------------------------ gestão de tempo
const TEMPO = () => [
  S("capa", { titulo: "Gestão do Tempo", subtitulo: "Prioridade, foco e rotina no dia a dia da MinasLab", texto: "Técnicas simples para decidir o que fazer primeiro, proteger o foco e cumprir prazos sem correria.", destaque: "Prioridade · Bloco de tempo · Foco · Pausa · Revisão" }, "Abertura (3 min): peça para cada pessoa anotar as 3 coisas que mais roubaram seu tempo ontem."),
  S("frase", { titulo: "Por que isso importa", frase: "Quem não decide o que é importante deixa o dia decidir por você.", texto: "Uma meta-análise de 158 estudos (Aeon e colegas, PLOS ONE, 2021) mostrou que gestão do tempo melhora o desempenho no trabalho e, ainda mais, o bem-estar e a satisfação com a vida." }),
  S("tabela", { titulo: "Matriz de Eisenhower", itens: "Quadrante | O que é | O que fazer\n1. Urgente e importante | Prazo vencendo, NC crítica, cliente parado | Fazer agora\n2. Importante, não urgente | Planejar, treinar, conferir, follow-up | Agendar (é aqui que se ganha)\n3. Urgente, não importante | Interrupções, muitas mensagens | Delegar ou limitar\n4. Nem urgente nem importante | Distrações, rede social | Eliminar", destaque: "Quem vive no quadrante 1 apaga incêndio. Quem cuida do 2 evita o incêndio." }, "Peça exemplos reais de cada quadrante no laboratório e no comercial."),
  S("colunas", { titulo: "Exemplos da casa", itens: "## Laboratório\n- Q1: amostra de micro chegando no limite de 24 h\n- Q2: conferir validade dos reagentes (PG 011)\n- Q3: chamado que outra pessoa resolve\n## Comercial\n- Q1: licitação com sessão amanhã\n- Q2: follow-up do dia 7\n- Q3: e-mail que só pede cópia\n## Todos\n- Q4: celular sem motivo no meio da tarefa" }),
  S("colunas", { titulo: "Planejar o dia em 10 minutos", itens: "## 1. Liste\nTudo o que precisa ser feito, fora da cabeça (papel ou sistema).\n## 2. Escolha 3\nAs três tarefas mais importantes do dia.\n## 3. Comece pela mais difícil\nDe manhã, com energia, antes das interrupções.\n## 4. Bloque horários\nReserve na agenda o tempo de cada uma." }),
  S("fluxo", { titulo: "Técnica Pomodoro", itens: "Escolha 1 tarefa | Só uma\n25 min | Foco total, sem celular\n5 min | Pausa de verdade\nRepita | 4 ciclos\nPausa longa | 15 a 30 min" , destaque: "Adapte: no laboratório o bloco pode seguir o tempo do ensaio. O que importa é foco sem interrupção." }),
  S("colunas", { titulo: "Ladrões de tempo", itens: "## Interrupções\nCombine horários para responder mensagens que não são urgentes.\n## Celular por perto\nUm estudo de 2017 (Ward e colegas) mostrou que só ter o celular por perto, mesmo desligado, já reduz a capacidade de atenção.\n## Retrabalho\nFazer certo da primeira vez é o maior ganho de tempo.\n## Reunião sem pauta\nPauta, horário de fim e compromissos." }),
  S("colunas", { titulo: "Regras rápidas", itens: "## Regra dos 2 minutos\nSe leva menos de 2 minutos, faça agora.\n## 80/20\nPoucas tarefas trazem a maior parte do resultado: comece por elas.\n## Agrupe\nResponda e-mails, ligações e lançamentos em blocos.\n## Diga não com alternativa\n“Agora não consigo; posso às 15h?”" }),
  S("numero", { titulo: "Revisão da semana", numero: "15 min", rotulo: "toda sexta-feira", texto: "O que foi feito e o que ficou\nO que entra na próxima semana\nO que pode ser delegado ou eliminado" }),
  S("quiz", { titulo: "Quiz", texto: "Conferir a validade dos reagentes do estoque é uma tarefa de qual quadrante?", itens: "Urgente e importante\n* Importante, não urgente: agendar\nNem urgente nem importante", destaque: "Quadrante 2: importante, evita problema, mas não grita. Por isso precisa estar agendada." }),
  S("quiz", { titulo: "Quiz", texto: "Um colega pede ajuda com algo que leva 1 minuto. O que fazer?", itens: "Anotar para amanhã\n* Fazer agora: regra dos 2 minutos\nRecusar sempre", destaque: "Menos de 2 minutos: resolva na hora e libere a cabeça." }),
  S("quiz", { titulo: "Caso real", texto: "Você tem uma proposta grande para fechar e o WhatsApp não para. Qual a melhor estratégia?", itens: "Responder tudo na hora\n* Reservar um bloco de foco, silenciar notificações e responder em seguida\nDeixar a proposta para o fim do dia", destaque: "Bloco de foco sem interrupção; mensagens em lote depois." }),
  S("quiz", { titulo: "Quiz", texto: "Qual tarefa fazer primeiro de manhã?", itens: "A mais fácil, para aquecer\n* A mais importante e difícil do dia\nResponder todos os e-mails", destaque: "Comece pela tarefa mais importante, antes das interrupções." }),
  PRATICA("Cada pessoa pega a lista que fez na abertura\nClassifica cada item nos 4 quadrantes da matriz\nEscolhe as 3 tarefas mais importantes de amanhã e reserva horário para elas", "Recolha ou fotografe as matrizes para acompanhar na próxima 1:1."),
  ...FIM("Tempo bem usado é resultado e qualidade de vida.", "Prioridade · Foco · Pausa · Revisão"),
];

const T = (setor) => ({ categoria: "treinamento", tema: "colorido", ...(setor ? { setor } : {}) });
export const MODELOS_TRILHAS = [
  { id: "crm-sem-furos", ...T("comercial"), nome: "CRM sem furos", desc: "Campos obrigatórios, interação e ligação, responsável e meta de menos de 5% sem responsável. Com quiz.", titulo: "CRM sem Furos", slides: CRM },
  { id: "follow-up", ...T("comercial"), nome: "Follow-up que fecha", desc: "Cadência de 2, 7, 15 e 30 dias, objeções do laboratório e perguntas que destravam. Com quiz.", titulo: "Follow-up que Fecha", slides: FOLLOW },
  { id: "proposta-sem-erro", ...T("comercial"), nome: "Proposta sem erro", desc: "Checklist antes de enviar e conferência cruzada. Com quiz.", titulo: "Proposta sem Erro", slides: PROPOSTA },
  { id: "spin", ...T("comercial"), nome: "Venda consultiva (SPIN)", desc: "Situação, problema, implicação e necessidade com exemplos do laboratório. Com quiz.", titulo: "Venda Consultiva (SPIN)", slides: SPIN },
  { id: "tecnico", ...T("comercial"), nome: "Conhecimento técnico dos ensaios", desc: "Matrizes, grupos de ensaio, legislação e prazo real. Com quiz.", titulo: "Conhecimento Técnico dos Ensaios", slides: TECNICO },
  { id: "atendimento", ...T("comercial"), nome: "Atendimento e pós-venda", desc: "Jornada do cliente, avisar antes de atrasar, NPS e ligação para detrator. Com quiz.", titulo: "Atendimento e Pós-venda", slides: ATENDIMENTO },
  { id: "licitacoes", ...T("comercial"), nome: "Licitações: edital e documentação", desc: "Leitura do edital, habilitação, certidões e calendário. Com quiz.", titulo: "Licitações: Edital e Documentação", slides: LICITACOES },
  { id: "os-correta", ...T(), nome: "OS correta e comunicação com o laboratório", desc: "O que a OS precisa ter, conferência com a proposta e mudanças. Com quiz.", titulo: "OS Correta", slides: OS },
  { id: "gestora", ...T(), nome: "Trilha da gestora: feedback, 1:1 e reuniões", desc: "Feedback em 4 passos, conversa 1:1 e estilo conforme a maturidade. Com quiz.", titulo: "Trilha da Gestora", slides: GESTORA },
  { id: "gestao-tempo", ...T(), nome: "Gestão do tempo", desc: "Matriz de Eisenhower, planejamento do dia, Pomodoro, ladrões de tempo e revisão semanal. Com quiz.", titulo: "Gestão do Tempo", slides: TEMPO },
];

export const TRILHA_GESTAO_TEMPO = {
  id: "gestao-tempo", modelo: "gestao-tempo", minutos: 40, tema: "gestao", setores: ["comercial", "laboratorio"],
  nome: "Gestão do tempo", publico: "Toda a equipe",
  objetivo: "Cada pessoa planeja o dia pelas prioridades, protege blocos de foco e revisa a semana, reduzindo atrasos e retrabalho.",
  gatilho: "ocorrencia:Prazo perdido", indicador: "Ocorrências do tipo “Prazo perdido”",
  slides: ["Matriz de Eisenhower: fazer, agendar, delegar, eliminar.", "Planejar o dia: listar, escolher 3, começar pela mais difícil, bloquear horário.", "Pomodoro: 25 min de foco e 5 de pausa.", "Ladrões de tempo: interrupções, celular por perto, retrabalho, reunião sem pauta.", "Revisão semanal de 15 minutos."],
  exercicio: "Cada pessoa classifica a própria lista de tarefas nos 4 quadrantes e reserva horário para as 3 mais importantes de amanhã.",
  fontes: ["Aeon, Faber e Panaccio (2021). Does time management work? A meta-analysis. PLOS ONE 16(1): e0245066.", "Ward, Duke, Gneezy e Bos (2017). Brain Drain. Journal of the Association for Consumer Research 2(2)."],
};
