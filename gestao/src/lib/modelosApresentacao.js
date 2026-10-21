// Modelos de apresentação no estilo MinasLab. Cada slide tem um `layout` e
// campos de texto simples. Convenções dos campos de texto:
//   - uma linha por item; "# " no começo = subtítulo dentro da lista
//   - em cartões (layout "colunas"): "## Título" abre um cartão; as linhas
//     seguintes são o texto dele ("- " vira marcador)
//   - em fluxo e agenda: "Título | detalhe"
//   - em tabela: colunas separadas por "|", a primeira linha é o cabeçalho
// Marcadores trocados na hora de mostrar: {mes}, {mesAnterior}, {ano},
// {pesoEquipe}, {pesoLideranca}.

import { novoId } from "./format.js";
import { MODELOS_PG } from "./treinamentosPG.js";
import { MODELOS_TRILHAS } from "./treinamentosTrilhas.js";
import { MODELO_VISUAL } from "./treinamentoVisual.js";

export const LAYOUTS = {
  capa: { nome: "Capa", campos: ["titulo", "subtitulo", "texto", "destaque", "imagem"], ajuda: { destaque: "Só no estilo colorido: palavras separadas por · viram pílulas coloridas.", imagem: "Opcional: foto ao lado do título." } },
  agenda: { nome: "Agenda", campos: ["titulo", "itens"], ajuda: { itens: "Uma linha por tópico: Título | descrição" } },
  topicos: { nome: "Tópicos", campos: ["titulo", "texto", "destaque"], ajuda: { texto: "Uma linha por tópico. \"# \" no começo vira subtítulo." } },
  colunas: { nome: "Cartões", campos: ["titulo", "itens", "destaque"], ajuda: { itens: "\"## Título\" abre um cartão; as linhas abaixo são o texto. \"- \" vira marcador." } },
  numero: { nome: "Número em destaque", campos: ["titulo", "numero", "rotulo", "texto", "destaque"] },
  fluxo: { nome: "Fluxo / linha do tempo", campos: ["titulo", "itens", "destaque"], ajuda: { itens: "Uma etapa por linha: Etapa | detalhe. Termine com ! para marcar em vermelho." } },
  tabela: { nome: "Tabela", campos: ["titulo", "itens", "destaque"], ajuda: { itens: "Colunas separadas por |. A primeira linha é o cabeçalho." } },
  grafico: { nome: "Gráfico (dados livres)", campos: ["titulo", "tipoGrafico", "texto", "itens", "destaque"], ajuda: { itens: "Uma linha por item: Rótulo | valor. Para comparar séries, a 1ª linha é o cabeçalho: Mês | Micro | FQ", texto: "Subtítulo (opcional)" } },
  imagem: { nome: "Imagem (print, foto, gráfico de outro sistema)", campos: ["titulo", "imagem", "texto", "destaque"], ajuda: { texto: "Legenda (opcional)" } },
  imagemLado: { nome: "Imagem com texto ao lado", campos: ["titulo", "imagem", "texto", "destaque"], ajuda: { texto: "Uma linha por tópico. \"# \" no começo vira subtítulo." } },
  video: { nome: "Vídeo", campos: ["titulo", "video", "texto", "destaque"], ajuda: { video: "Link do YouTube, Vimeo, Google Drive (compartilhado com “qualquer pessoa com o link”) ou de um arquivo .mp4. O vídeo toca durante a apresentação.", texto: "Legenda (opcional)" } },
  aviso: { nome: "Aviso (fundo escuro)", campos: ["titulo", "texto", "destaque"] },
  frase: { nome: "Frase de impacto", campos: ["titulo", "frase", "texto"] },
  indicadores: { nome: "Indicadores comerciais (CRM)", auto: true, campos: ["titulo", "amostras", "amostrasAnterior", "texto"], ajuda: { amostras: "Em branco = total do CRM (amostras recebidas no mês). Preencha só para corrigir.", texto: "Comentário da gestão sobre o mês" } },
  tendencia: { nome: "Tendência de 6 meses (CRM)", auto: true, campos: ["titulo", "texto"] },
  setores: { nome: "Amostras por setor (CRM)", auto: true, campos: ["titulo", "texto"], ajuda: { texto: "Comentário da gestão sobre o mês (opcional)" } },
  ranking: { nome: "Ranking do destaque (votação)", auto: true, campos: ["titulo", "texto"] },
  destaque: { nome: "Destaque do mês", auto: true, campos: ["titulo", "nome", "setor", "foto", "itens"], ajuda: { nome: "Em branco = 1º lugar do ranking", itens: "Uma linha por qualidade: Rótulo: texto" } },
  escala: { nome: "Escala da cantina (planilha)", campos: ["titulo", "escala", "texto", "destaque"], ajuda: { texto: "Tarefas do responsável do dia, uma por linha (vêm da planilha)." } },
  labPrazos: { nome: "Prazos e ordens de serviço (CRM)", auto: true, campos: ["titulo", "texto"], ajuda: { texto: "Comentário da gestão (opcional). Mostra a situação do dia em que você apresenta." } },
  labNcs: { nome: "Não conformidades do mês", auto: true, campos: ["titulo", "texto"], ajuda: { texto: "Comentário da gestão (opcional). Os números vêm da página Não conformidades." } },
  labProdutividade: { nome: "Produtividade do mês", auto: true, campos: ["titulo", "texto"], ajuda: { texto: "Comentário da gestão (opcional). Os números vêm da página Produtividade." } },
  combinados: { nome: "Combinados da última reunião", auto: true, campos: ["titulo"] },
  compromissos: { nome: "Próximos passos (ata desta reunião)", auto: true, campos: ["titulo"] },
  encerramento: { nome: "Encerramento", campos: ["titulo", "subtitulo", "texto", "destaque"], ajuda: { destaque: "Só no estilo colorido: palavras separadas por · viram pílulas coloridas." } },
  quiz: { nome: "Quiz (pergunta com resposta)", campos: ["titulo", "texto", "itens", "destaque", "imagem"], ajuda: { imagem: "Opcional: foto ou ilustração ao lado da pergunta.", texto: "A pergunta ou o caso.", itens: "Uma alternativa por linha. Comece a certa com * (ex.: * Ligar para o cliente). Sem alternativas vira pergunta aberta.", destaque: "Resposta / explicação: aparece quando você revela a resposta." } },
};

export const ROTULOS_CAMPOS = {
  titulo: "Título", subtitulo: "Subtítulo", texto: "Texto", itens: "Itens", destaque: "Caixa de destaque",
  numero: "Número grande", rotulo: "Legenda do número", frase: "Frase", nome: "Nome", setor: "Setor",
  foto: "Foto", imagem: "Imagem", video: "Link do vídeo", tipoGrafico: "Tipo de gráfico", escala: "Escala do mês", amostras: "Amostras analisadas no mês", amostrasAnterior: "Amostras no mês anterior",
};

const S = (layout, campos = {}, notas = "") => ({ layout, ...campos, notas });

// ---------------------------------------------------------------- modelos
const MENSAL = () => [
  S("capa", { titulo: "Reunião mensal de resultados", subtitulo: "{mes}", texto: "MinasLab · Laboratório de Controle de Qualidade" }, "Comece no horário. Agradeça a presença e diga o objetivo: alinhar resultados, reconhecer quem se destacou e combinar o próximo mês."),
  S("agenda", { titulo: "Agenda do dia", itens: "Abertura | Calendário e combinados da última reunião\nReconhecimento | Ranking e destaque do mês\nProcessos | Organização, qualidade e avisos\nResultados | Indicadores comerciais de {mes}\nPróximos passos | Metas e compromissos" }, "Mostre a agenda e o tempo de cada parte. Peça que perguntas fiquem para o fim de cada bloco."),
  S("combinados", { titulo: "O que combinamos na última reunião" }, "Passe item por item: feito, não feito e por quê. O que não foi feito ganha nova data."),
  S("numero", { titulo: "Abertura & calendário", numero: "{ano}", rotulo: "Cultura de alinhamento", texto: "# Reunião geral\nToda primeira ou segunda segunda-feira do mês.\nReforçamos a importância da participação coletiva para o alinhamento das metas e a melhoria contínua dos processos internos." }),
  S("frase", { titulo: "Dinâmica", frase: "Minha peça no quebra-cabeça", texto: "Cada um conta, em uma frase, como o seu trabalho ajudou o resultado do mês." }, "Até 10 minutos. Comece você, para dar o exemplo."),
  S("colunas", { titulo: "Organização do ambiente", itens: "## Cantina\nLimpa e organizada após o uso.\n## Almoxarifado\nCada item no seu lugar, identificado.\n## Banheiros\nUso consciente e limpo.\n## Estações\nPosto de trabalho em ordem no fim do dia.", destaque: "Risco de segurança: proibido o uso de equipamentos laboratoriais no horário de almoço." }, "Dever de todos: a organização impacta diretamente a eficiência e a imagem profissional do laboratório."),
  S("escala", { titulo: "Escala de higienização da cantina", escala: null, mesEscala: "", texto: "Limpar a bancada, a pia e as mesas da cantina e do vestiário.\nRetirar o lixo dos ambientes na sexta-feira ou sempre que necessário.\nFazer o café quando necessário.", destaque: "Ambiente limpo é responsabilidade de todos. Obrigado pela colaboração!" }, "Mostre quem fica responsável em cada semana do mês. Quem não puder no dia combina a troca antes com um colega."),
  S("topicos", { titulo: "Qualidade do laboratório", texto: "# Principal objetivo\nGarantir a excelência e a conformidade dos processos, atendendo à ISO/IEC 17025.\n# Responsabilidades-chave\nConformidade dos processos e registros com a ISO/IEC 17025\nApoio à equipe nas rotinas e demandas da qualidade\nControle de estoques de materiais, reagentes e consumíveis\nAcompanhamento de compras e reposição de insumos\nMelhoria contínua e eficiência operacional", destaque: "Fortalecer a cultura da qualidade: resultados confiáveis, processos organizados e suporte ao crescimento do laboratório." }),
  S("topicos", { titulo: "Qualidade documental", texto: "# Comunicação interna\nObjetividade e clareza no registro de informações\nSem rasuras: folhas de análise devem ser impecáveis\nPrazos: entrega imediata após a finalização da análise", destaque: "“Erros de comunicação são a maior causa de retrabalho e atrasos.”" }),
  S("numero", { titulo: "Política de atestados", numero: "24h", rotulo: "Prazo limite", texto: "Importante: atestado não entregue no prazo gera desconto em folha e não pode ser compensado no banco de horas.\nProgramação: horas ausentes sem justificativa legal devem ser agendadas antes no banco de horas." }, "Fale da regra, nunca de casos de pessoas."),
  S("fluxo", { titulo: "Compras programadas", itens: "Identificação | Análise de estoque por setor\nSolicitação | Envio do pedido pela planilha\nDia 19 | Prazo máximo do mês!\nRecebimento | Conferência e organização", destaque: "Objetivo: evitar pedidos emergenciais, que atrapalham o fluxo e geram desperdício." }),
  S("aviso", { titulo: "Horas extras", texto: "As horas extras só podem ser feitas com AUTORIZAÇÃO PRÉVIA da liderança.", destaque: "O descumprimento será tratado como irregularidade administrativa." }),
  S("indicadores", { titulo: "Indicadores comerciais · {mes}", amostras: "", amostrasAnterior: "", texto: "" }, "Abra com o valor aprovado e a meta. Compare com o mês anterior. Explique a queda ou a alta com um motivo concreto."),
  S("setores", { titulo: "Amostras por setor · {mes}", texto: "" }, "Compare cada setor com o mês anterior. Onde cresceu, reconheça a equipe; onde caiu, explique o motivo (sazonalidade, cliente, coleta)."),
  S("tendencia", { titulo: "Propostas e valor aprovado · últimos 6 meses", texto: "" }, "Estamos subindo ou caindo? O que mudou nos meses de queda?"),
  S("colunas", { titulo: "Modelo híbrido do destaque", itens: "## Avaliação da equipe · {pesoEquipe}%\nVotação anônima por link, notas de 0 a 10\n- Trabalho em equipe\n- Comunicação\n- Colaboração com colegas\n- Organização do ambiente\n- Postura profissional\n## Avaliação da liderança · {pesoLideranca}%\n10 critérios de 0 a 5, convertidos para 0 a 10\n- Prazos e metas · Qualidade técnica\n- Normas sanitárias · Organização\n- Comunicação · Proatividade\n- Assiduidade · Materiais\n- Ética · Colaboração", destaque: "Total = equipe × {pesoEquipe}% + liderança × {pesoLideranca}%, as duas de 0 a 10. Advertência ou falha grave tira da disputa do mês." }, "Explique o cálculo uma vez por trimestre ou quando entrar gente nova. Transparência aumenta a confiança no resultado."),
  S("ranking", { titulo: "Ranking do mês · {mes}", texto: "Sempre mostramos os 3 primeiros." }, "Anuncie do 3º para o 1º. Diga o que cada um fez de concreto."),
  S("destaque", { titulo: "Destaque do mês", nome: "", setor: "", foto: "", itens: "Laboratório: excelência nos processos\nDesempenho: prontidão e agilidade operacional\nPrecisão: assertividade em todas as demandas" }, "Reconhecimento específico: o fato, o número e o impacto para a equipe."),
  S("colunas", { titulo: "Metas gerais", itens: "## Prazos de análise\nCumprimento rigoroso dos prazos acordados. O tempo é o nosso principal ativo.\n## Qualidade\nPadrão de excelência técnica nas entregas. Erro zero como meta.\n## Produtividade\nOrganização física e comunicação eficiente para produzir mais com menos esforço." }),
  S("compromissos", { titulo: "Próximos passos" }, "Leia a ata: cada compromisso com dono e prazo. Ela abre a próxima reunião."),
  S("encerramento", { titulo: "Obrigado!", subtitulo: "MinasLab · Compromisso com a Qualidade", texto: "Organização, Comunicação e União." }),
];

const INTEGRACAO = () => [
  S("capa", { titulo: "Integração e Capacitação Técnica", subtitulo: "Manual de padronização MinasLab", texto: "Bem-vindo ao time! Este treinamento alinha suas atividades à norma ABNT NBR ISO/IEC 17025, garantindo qualidade, conformidade técnica e integridade em todos os nossos ensaios." }, "Módulo 1: boas-vindas e visão geral. Apresente-se e peça que a pessoa conte a experiência anterior."),
  S("colunas", { titulo: "Introdução à ISO/IEC 17025", itens: "## O que é a norma?\nÉ o padrão internacional que define os requisitos para a competência de laboratórios de ensaio e calibração.\nEla garante que o laboratório trabalhe de forma consistente, com resultados tecnicamente válidos e a confiança dos clientes.\n## Por que é essencial?\n- Validade técnica: métodos e instrumentos calibrados e validados\n- Reconhecimento global: resultados aceitos em auditorias nacionais e internacionais\n- Proteção legal: resguardo jurídico para o laboratório e para os clientes" }),
  S("colunas", { titulo: "Os 4 pilares da ISO 17025", itens: "## Imparcialidade\nNenhuma decisão técnica, amostragem ou resultado sofre influência comercial, financeira ou pessoal.\n## Rastreabilidade\nTodo resultado pode ser relacionado a padrões de referência certificados.\n## Competência técnica\nTreinamento rigoroso, calibração de instrumentos e validação de pessoal para executar os métodos.\n## Garantia da qualidade\nCartas de controle, análises em duplicata e participação em ensaios de proficiência." }),
  S("topicos", { titulo: "Nosso escopo acreditado (CRL 1943)", texto: "Somos um laboratório acreditado pela CGCRE (Inmetro) sob o número CRL 1943.\nA acreditação comprova nossa conformidade em análises ambientais de águas brutas, tratadas, subterrâneas e residuais, além de amostragem em campo.", destaque: "Importante: para ensaios fora do escopo de acreditação, consulte a tabela atualizada na pasta Comercial › Portarias e Escopo." }),
  S("colunas", { titulo: "Matrizes analíticas e portfólio", itens: "## Água\nBruta, tratada, consumo humano, salina, salobra, subterrânea e mineral (artesianos, cisternas, hemodiálise).\n## Efluentes e ETE\nIndustriais e domésticos em ETEs, fossas, tanques sépticos, lodos ativados e caixas separadoras.\n## Solo\nMetais, classificação de resíduos sólidos (NBR 10.004), investigação de contaminação e lodos.\n## Ar\nQualidade do ar interno e externo, emissões gasosas e controle de fluxo.\n## Alimentos e lácteos\nFísico-químico e microbiológico de leite, queijos, ricota, mel, ovos e rações.\n## Hospitais e saúde\nHemodiálise, dialisato, água purificada e injetável, swab de superfícies e manipuladores." }),
  S("fluxo", { titulo: "Fluxo de excelência operacional", itens: "Coleta | Campo certificado\nTransporte | Logística controlada\nRecebimento | Triagem e codificação\nAnálise | Laboratório\nValidação | Dupla checagem\nRelatório | Laudo rastreável", destaque: "Cada etapa é monitorada para garantir a integridade da amostra e a precisão do resultado final." }),
  S("tabela", { titulo: "Ensaios químicos (CRL 1943)", itens: "Classe de ensaio | Parâmetros principais acreditados | Método de referência\nFísico-química básica | Acidez, alcalinidade, condutividade, cor aparente e verdadeira, turbidez | SMWW 24ª ed. · colorimétricos e titulométricos\nDureza e cálculos | Dureza total, cálcica e magnésio; cálculo de cálcio e magnésio | SMWW 24ª ed. · 2340 C / EDTA\nSólidos e resíduos | Sólidos totais, dissolvidos, suspensos (fixos e voláteis), sedimentáveis | SMWW 24ª ed. · 2540 B/C/D/E/F\nMetais | Fe, Mn, Cu, Cr, Ni, Zn, K | POP-LAB-013 a 019 · colorimetria e espectrofotometria\nCargas orgânicas | DBO, DQO, óleos e graxas, carbono orgânico total | SMWW · POP-LAB-021 · 5520 D/F" }),
  S("colunas", { titulo: "Ecológicos, biológicos e amostragem", itens: "## Ensaios biológicos acreditados\n- Coliformes totais e termotolerantes (NMP e membrana)\n- Escherichia coli e enterococos\n- Bactérias heterotróficas (inoculação em profundidade)\n- Esporos de bactérias aeróbias e endotoxina bacteriana\n## Amostragem acreditada em campo\n- ETA, reservatórios, caixas d'água e bebedouros\n- Efluentes industriais e domésticos em ETEs, fossas e tanques\n- Poços de monitoramento com amostrador Bailer" }),
  S("colunas", { titulo: "Dependências entre ensaios", itens: "## Ensaios solicitados\nDBO, óleos minerais, nitrogênio orgânico, cromo trivalente, cloro combinado\n## Exigem também\nDQO; óleos totais + animais + vegetais; N total + amoniacal; cromo hexa + total; cloro livre + total\n## Sódio e cloretos\nO sódio só é liberado depois do resultado de cloretos.\n## Dureza de magnésio\nExige dureza cálcica e total para aplicar a fórmula.\n## Metais totais × solúveis\nConfirme sempre na legislação antes de ofertar: os limites são muito diferentes." }, "Comercial: ao montar a proposta, inclua os ensaios dos quais o pedido depende."),
  S("numero", { titulo: "Recepção: temperatura (crítico)", numero: "6 °C", rotulo: "Limite máximo para águas", texto: "# Regra geral de recebimento\nAmostras de água devem chegar a até 6 °C.\nAcima disso, abra uma Não Conformidade (NC) de temperatura na triagem, na hora.", destaque: "Exceção: alguns clientes são isentos de NC automática por temperatura. Consulte a lista atualizada com a Qualidade." }),
  S("numero", { titulo: "Recepção: temperatura (crítico)", numero: "9 °C", rotulo: "Limite máximo para esponjas", texto: "# Regra geral de recebimento\nAmostras de esponjas devem chegar a até 9 °C.\nAcima disso, abra uma NC de temperatura na triagem, na hora." }),
  S("numero", { titulo: "Recepção: temperatura (crítico)", numero: "Vide rótulo", rotulo: "Limite para alimentos", texto: "# Temperatura\nAlimentos devem chegar na temperatura indicada no rótulo.\nAcima do valor do rótulo: abra NC na triagem.\nRótulo sem temperatura: NC não é obrigatória (não há referência para comparar).\n# Condições de recepção\nEmbalagem íntegra, sem vazamento · identificação correta · volume suficiente para todos os ensaios", destaque: "Gera NC: temperatura acima do rótulo, embalagem violada, volume insuficiente, cor ou aparência incompatível com o produto." }),
  S("numero", { titulo: "Recepção: temperatura (crítico)", numero: "N/A", rotulo: "Solo", texto: "Solo não tem exigência legal ou técnica de conservação térmica.\nNão registre NC por temperatura em solo.\nPode ser recebido em temperatura ambiente, sem sinais de degradação, vazamento ou contaminação externa.\n# Gera NC em solo\nOdor forte indicando contaminação não declarada · frasco ou saco violado ou aberto · volume insuficiente · misturado com água · identificação ausente ou incorreta" }),
  S("numero", { titulo: "Recepção: temperatura (crítico)", numero: "N/A", rotulo: "Placas de microbiologia", texto: "Placas de monitoramento NÃO devem ser refrigeradas.\nEntrega no mesmo dia do monitoramento, em temperatura ambiente.\nPlacas geladas: NC automática.\n# Condições de recepção\nPlacas íntegras, sem rachaduras · identificação correta (ponto, data, horário) · sem condensação · sem contaminação externa" }),
  S("colunas", { titulo: "Recepção: frascos, gelo e placas", itens: "## Frascos adequados\nUse sempre frascos do laboratório. Frasco do cliente causa interferência química ou biológica e abre NC automática.\n## Gelo individualizado\nOriente o cliente: gelo ensacado individualmente. A água do degelo nunca pode tocar tampas e frascos.\n## Placas de microbiologia\nNUNCA refrigerar. Enviar em temperatura ambiente no mesmo dia do monitoramento.", destaque: "Textos padrão no laudo: “Amostra chegou em temperatura superior a 6 °C, o que pode ou não interferir nos resultados.” · “Amostra entregue em frasco do cliente, o que pode ou não interferir nos resultados.”" }),
  S("topicos", { titulo: "Suas responsabilidades no time", texto: "Conferência completa: temperatura, tipos de frasco, lacres e se o volume cobre todas as análises\nRegistro rápido de NC: registre em detalhe toda não conformidade da triagem\nFaturamento correto: cobranças casadas (swab + placa de PCA; hemocultura + placa de PCA)\nPostura ISO 17025: técnica, confidencial e imparcial em toda comunicação" }),
  // Módulo 2: Declaração de Ética
  S("capa", { titulo: "Declaração de Ética", subtitulo: "Princípios, valores e regras de convivência", texto: "A Declaração de Ética apresenta os princípios, valores e regras de convivência da MinasLab, para garantir um ambiente de trabalho ético, seguro, organizado e focado na excelência dos serviços prestados." }, "Módulo 2. Explique que estas regras valem para todos, da direção ao estágio."),
  S("colunas", { titulo: "Quem é a MinasLab", itens: "## Nossa atuação\nLaboratório especializado em análises ambientais, alimentos, solos, ar e matérias-primas.\n- Ambientais · Alimentos · Solos · Ar · Matérias-primas\n## Nosso foco\n- Qualidade dos serviços prestados\n- Confiabilidade dos resultados\n- Atendimento ao cliente\n- Cumprimento dos requisitos da ISO/IEC 17025" }),
  S("colunas", { titulo: "Valores da empresa", itens: "## Imparcialidade\nDecisões técnicas sem influência comercial, financeira ou pessoal.\n## Ética e responsabilidade\nHonestidade em cada registro e em cada resultado.\n## Respeito às pessoas\nColegas, gestores, clientes e fornecedores.\n## Excelência técnica\nMétodo, cuidado e precisão em todos os ensaios.\n## Trabalho em equipe\nO resultado é de todos.\n## Qualidade e meio ambiente\nCompromisso com a qualidade e com o meio ambiente." }, "Os principais valores que orientam o nosso trabalho."),
  S("topicos", { titulo: "Comportamento esperado dos colaboradores", texto: "# Todo colaborador deve\nManter postura profissional e respeitosa\nTrabalhar com honestidade e ética\nRespeitar colegas, gestores, clientes e fornecedores\nZelar pelo patrimônio da empresa\nCompartilhar conhecimentos e colaborar com a equipe\nComunicar imediatamente erros, irregularidades ou situações que possam impactar a qualidade dos serviços" }),
  S("colunas", { titulo: "Relacionamento com clientes", itens: "## Cordial e respeitoso\nO atendimento deve ser sempre educado.\n## Ágil e eficiente\nResposta rápida e correta.\n## Empático e profissional\nEntender a necessidade do cliente.\n## Focado na solução\nResolver o que o cliente precisa.\n## Satisfação do cliente\nCompromisso com a satisfação em cada contato." }),
  S("topicos", { titulo: "Confidencialidade", texto: "# São informações confidenciais\nInformações técnicas\nDados de clientes\nMetodologias\nDemais informações estratégicas da empresa", destaque: "Atenção: a divulgação ou o uso indevido dessas informações pode gerar sanções disciplinares e responsabilidades legais." }),
  S("colunas", { titulo: "Horários e pontualidade", itens: "## Jornada de trabalho\nO cumprimento da jornada de trabalho é obrigatório.\n## Atrasos\nAtrasos frequentes podem gerar advertências.\n## Ponto biométrico\nTodos devem registrar corretamente seus horários no ponto biométrico.\n## Respeito à equipe\nO respeito aos horários demonstra responsabilidade e respeito pelos colegas." }),
  S("colunas", { titulo: "Segurança e uso de EPIs", itens: "## Uso obrigatório\nO uso dos Equipamentos de Proteção Individual (EPIs) é obrigatório quando exigido pela atividade.\n## Cuidado e higiene\nO colaborador deve cuidar, higienizar e guardar corretamente seus EPIs.\n## Segurança coletiva\nA segurança é responsabilidade de todos." }),
  S("colunas", { titulo: "Uniforme, apresentação e uso de celular", itens: "## Uniforme e apresentação\n- O uniforme deve ser usado conforme orientação da empresa\n- Mantenha boa higiene e apresentação pessoal\n- O uniforme representa a imagem da empresa perante os clientes\n## Uso de celular\n- O uso de celular é restrito durante o expediente\n- No laboratório, o uso fora dos horários de intervalo pode resultar em advertências\n- Os aparelhos devem ficar guardados nos armários disponibilizados pela empresa" }),
  S("colunas", { titulo: "Veículos da empresa", itens: "## Uso exclusivo profissional\nOs veículos devem ser usados exclusivamente para atividades profissionais.\n## Normas e regras\nRespeite as normas de trânsito e as regras internas de uso dos veículos.", destaque: "Atenção: multas e infrações são de responsabilidade do condutor." }),
  S("fluxo", { titulo: "Penalidades", itens: "1 | Advertência verbal\n2 | Advertência escrita\n3 | Nova advertência escrita\n4 | Suspensão\n5 | Nova suspensão\n6 | Demissão por justa causa!", destaque: "As medidas são aplicadas de forma progressiva, conforme a gravidade de cada ocorrência." }, "O descumprimento das normas pode resultar nestas medidas. Fale da regra, nunca de casos de pessoas."),
  S("quiz", { titulo: "Quiz", texto: "Até quantos graus uma amostra de água pode chegar sem abrir NC?", itens: "10 °C\n* 6 °C\n0 °C", destaque: "Águas: até 6 °C. Acima disso, NC de temperatura na triagem." }),
  S("quiz", { titulo: "Quiz", texto: "A placa de microbiologia chegou gelada. O que fazer?", itens: "Receber normalmente\n* Abrir NC: placa de monitoramento não deve ser refrigerada\nDeixar esquentar e receber", destaque: "Placas vão em temperatura ambiente e no mesmo dia. Gelada: NC automática." }),
  S("quiz", { titulo: "Quiz", texto: "Solo chegou em temperatura ambiente, sem sinais de degradação. Abre NC?", itens: "Sim, sempre\n* Não, solo não tem exigência de conservação térmica\nSó se for de cliente novo", destaque: "Solo pode ser recebido em temperatura ambiente." }),
  S("quiz", { titulo: "Quiz", texto: "Quais são os 4 pilares da ISO/IEC 17025?", itens: "Preço, prazo, qualidade e volume\n* Imparcialidade, rastreabilidade, competência técnica e garantia da qualidade\nVendas, coleta, análise e relatório", destaque: "Os 4 pilares do módulo 1." }),
  S("quiz", { titulo: "Quiz", texto: "Qual destas é uma informação confidencial?", itens: "O endereço do site da MinasLab\n* Os dados de clientes\nO horário de funcionamento", destaque: "Confidenciais: informações técnicas, dados de clientes, metodologias e informações estratégicas." }),
  S("quiz", { titulo: "Quiz", texto: "Onde o celular deve ficar durante o expediente no laboratório?", itens: "No bolso do jaleco\n* Guardado nos armários\nNa bancada, no silencioso", destaque: "Regra da Declaração de Ética: celular guardado nos armários."  }),
  S("encerramento", { titulo: "Seja bem-vindo ao time!", subtitulo: "A MinasLab espera que todos atuem com ética, responsabilidade, respeito, comprometimento e espírito de equipe.", texto: "O cumprimento dessas diretrizes contribui para um ambiente de trabalho seguro, harmonioso e focado na excelência dos serviços prestados aos clientes." }),
  S("encerramento", { titulo: "Dúvidas?", subtitulo: "A aplicação rigorosa dessas regras constrói nossa autoridade técnica e garante resultados incontestáveis.", texto: "MinasLab Análises Ambientais · Excelência, Precisão, Imparcialidade e Agilidade" }),
];

const COMERCIAL = () => [
  S("capa", { titulo: "Reunião do Comercial", subtitulo: "{mes}", texto: "MinasLab · Laboratório de Controle de Qualidade" }, "Objetivo: olhar os números do mês, decidir o que fazer com as propostas paradas e combinar as metas do próximo mês."),
  S("agenda", { titulo: "Agenda", itens: "Combinados | O que ficou da última reunião\nResultados | Propostas e aprovação de {mes}\nPropostas em aberto | Quem liga para quem\nClientes | Carteira, contratos e recorrências\nPróximo mês | Metas e compromissos" }),
  S("combinados", { titulo: "O que combinamos na última reunião" }, "Item por item: feito, não feito e por quê. O que não foi feito ganha nova data."),
  S("indicadores", { titulo: "Indicadores comerciais · {mes}", amostras: "", amostrasAnterior: "", texto: "" }, "Compare com o mês anterior. Explique a queda ou a alta com um motivo concreto (cliente, licitação, sazonalidade)."),
  S("tendencia", { titulo: "Propostas nos últimos 6 meses", texto: "" }, "Estamos subindo ou caindo? O que mudou nos meses de queda?"),
  S("setores", { titulo: "Amostras por setor · {mes}", texto: "" }, "Onde o volume cresceu ou caiu? Isso aponta onde vender mais."),
  S("topicos", { titulo: "Propostas em aberto", texto: "# Mais de 30 dias sem resposta\nFollow-up final ou encerrar: ____\n# Entre 8 e 30 dias\nLigar esta semana: ____\n# Propostas grandes\nQuem acompanha cada uma: ____", destaque: "Confira a lista no Cockpit do dia: quanto mais velha a proposta, menor a chance de aprovar." }, "Defina quem liga e até quando. Anote como compromisso."),
  S("colunas", { titulo: "Carteira de clientes", itens: "## Clientes em risco\nClientes A e B que passaram do próprio intervalo de compra: ____\n## Contratos vencendo\nRenovar nos próximos 90 dias: ____\n## Recorrências\nColetas e análises previstas para o mês: ____" }, "Use a página Carteira. Distribua os clientes entre a equipe."),
  S("topicos", { titulo: "Qualidade do registro no CRM", texto: "Toda proposta com responsável definido\nRegistrar cada contato com o cliente (interação)\nAtualizar o status: aprovada, recusada ou cancelada\nMotivo da recusa sempre preenchido", destaque: "Dado bem registrado é meta medida com justiça." }, "Mostre a página Qualidade do dado: quantas propostas ficaram sem responsável no mês."),
  S("colunas", { titulo: "Metas de {mesSeguinte}", itens: "## Propostas enviadas\nMeta da equipe: ____\n## Taxa de aprovação\nMeta: ____%\n## Prioridade do mês\n____" }, "Confirme as metas por pessoa em Equipe e metas."),
  S("compromissos", { titulo: "Próximos passos" }, "Cada compromisso com dono e prazo. Ele abre a próxima reunião."),
  S("encerramento", { titulo: "Obrigado!", subtitulo: "MinasLab · Compromisso com a Qualidade", texto: "Relacionamento, agilidade e confiança em cada proposta." }),
];

const LABORATORIO = () => [
  S("capa", { titulo: "Reunião do Laboratório", subtitulo: "{mes}", texto: "MinasLab · Laboratório de Controle de Qualidade" }, "Objetivo: olhar prazos, qualidade e produção do mês, tratar as não conformidades e combinar o próximo mês."),
  S("agenda", { titulo: "Agenda", itens: "Combinados | O que ficou da última reunião\nVolume | Amostras e ensaios por setor\nPrazos | OS atrasadas e ritmo do mês\nQualidade | Não conformidades e retrabalho\nPróximo mês | Metas e compromissos" }),
  S("combinados", { titulo: "O que combinamos na última reunião" }, "Item por item: feito, não feito e por quê. O que não foi feito ganha nova data."),
  S("setores", { titulo: "Amostras e ensaios por setor · {mes}", texto: "" }, "Onde o volume cresceu, reconheça a equipe; onde caiu, explique o motivo (sazonalidade, cliente, coleta)."),
  S("labPrazos", { titulo: "Prazos e ordens de serviço", texto: "" }, "Comece pelas OS mais atrasadas: o que está travando cada uma e quem resolve até quando. Anote como compromisso."),
  S("labNcs", { titulo: "Não conformidades · {mes}", texto: "" }, "Fale do processo, não das pessoas. O que se repete vira ação corretiva com dono e prazo."),
  S("labProdutividade", { titulo: "Produtividade · {mes}", texto: "" }, "Reconheça o esforço. Retrabalho alto é sinal de método ou de equipamento: investigue antes de cobrar."),
  S("colunas", { titulo: "Organização da bancada e do freezer", itens: "## Identificação\nToda amostra identificada, com data e validade.\n## Armazenamento\nCada compartimento no seu lugar; nada sem dono.\n## Descarte\nAmostras e materiais vencidos ou desnecessários saem da geladeira.\n## Bancada\nLimpa e organizada no fim do dia.", destaque: "A responsabilidade pela organização é de toda a equipe e deve ser exercida diariamente." }),
  S("topicos", { titulo: "Qualidade e ISO/IEC 17025", texto: "# Neste mês\nCartas de controle e análises em duplicata: ____\nCalibrações e verificações de equipamentos: ____\nEnsaios de proficiência: ____\nAuditorias e visitas: ____", destaque: "Folhas de análise sem rasura e entregues logo após a análise." }, "Atualize com os pontos do mês junto com a Qualidade."),
  S("fluxo", { titulo: "Compras programadas", itens: "Identificação | Análise de estoque por setor\nSolicitação | Envio do pedido pela planilha\nDia 19 | Prazo máximo do mês!\nRecebimento | Conferência e organização", destaque: "Planejar reagentes e consumíveis evita pedido emergencial e análise parada." }),
  S("colunas", { titulo: "Metas de {mesSeguinte}", itens: "## Prazos\nOS atrasadas: no máximo ____\n## Qualidade\nNão conformidades: no máximo ____\n## Retrabalho\nEnsaios repetidos: até ____%" }, "Defina metas com número e confira na próxima reunião."),
  S("compromissos", { titulo: "Próximos passos" }, "Cada compromisso com dono e prazo. Ele abre a próxima reunião."),
  S("encerramento", { titulo: "Obrigado!", subtitulo: "MinasLab · Compromisso com a Qualidade", texto: "Precisão, organização e prazo em cada resultado." }),
];


// Treinamento do Comercial: PG 006 (rev. 03) + ABNT NBR ISO/IEC 17025:2017, requisito 7.1.
const ANALISE_CRITICA = () => [
  S("capa", { titulo: "Análise Crítica de Propostas", subtitulo: "PG 006 · ABNT NBR ISO/IEC 17025 · requisito 7.1", texto: "Treinamento do Comercial MinasLab: como garantir que cada proposta pode ser cumprida, técnica e comercialmente, antes de chegar ao cliente.", destaque: "Requisitos · Capacidade · Método · Provedor externo · Registro · Aceite" }, "Abertura (2 min): pergunte quem já teve que refazer uma proposta depois de enviada. Use as respostas como gancho."),
  S("frase", { titulo: "Por que isso importa", frase: "Uma proposta bem analisada evita uma não conformidade lá na frente.", texto: "A proposta é o primeiro registro técnico do trabalho: o que prometemos ali é o que a auditoria vai cobrar." }, "Lembre um caso real da casa (sem citar nomes): proposta com parâmetro fora do escopo, prazo impossível, ponto de coleta errado."),
  S("colunas", { titulo: "O que a ISO/IEC 17025 exige (7.1)", itens: "## Requisitos claros\nO pedido do cliente está definido, documentado e entendido.\n## Capacidade e recursos\nO laboratório tem gente, equipamento e prazo para atender.\n## Método apropriado\nO método escolhido atende ao que o cliente precisa. Método inadequado ou desatualizado: avisar o cliente.\n## Provedor externo\nO que for feito por laboratório parceiro também passa pela análise, e o cliente é informado.\n## Diferenças resolvidas\nQualquer diferença entre pedido, proposta e contrato é resolvida antes de começar.\n## Registro\nA análise, as alterações e as conversas com o cliente ficam registradas." }, "Este é o slide-chave: cada cartão é um item que o auditor pode pedir para ver evidência."),
  S("topicos", { titulo: "PG 006 em uma frase", texto: "# Objetivo\nEstabelecer a sistemática para análise crítica das propostas, pedidos e contratos.\n# Aplicação\nTodos os processos comerciais do escopo de prestação de serviços.\n# Regra básica\nA proposta só é elaborada depois do cadastro do cliente no software\nCada proposta deve ser aceita pelo cliente e pelo laboratório\nQualquer desvio do contrato deve ser informado ao cliente", destaque: "As etapas de emissão estão no POP-CQ-005 (Elaboração e cadastro de propostas e ordem de serviço)." }),
  S("fluxo", { titulo: "O caminho de uma proposta", itens: "Contato | E-mail, telefone ou verbal\nCadastro | Cliente no software\nRequisitos | Entender e esclarecer\nProposta | Métodos, prazos e condições\nAnálise crítica | Gerência avalia!\nAprovação | No sistema, menu Proposta\nEnvio e aceite | Registrado e rastreável", destaque: "A proposta só vai para o cliente depois que a análise crítica é aprovada no sistema." }, "Percorra o fluxo no próprio sistema, se possível, mostrando onde fica cada etapa."),
  S("topicos", { titulo: "Checklist da análise crítica", texto: "Os métodos a serem utilizados estão definidos e documentados\nO laboratório tem capacidade e recursos para atender aos requisitos\nFoi selecionado o método de ensaio apropriado e capaz de atender ao cliente\nQualquer diferença entre a proposta e o contrato será resolvida antes do início do trabalho\nA análise cobre também o trabalho provido externamente (laboratório parceiro)", destaque: "Os 5 itens do PG 006 (seção 4.8). Se um deles não estiver OK, a proposta não segue." }, "Peça para cada pessoa ler um item em voz alta e dizer onde confere isso na prática."),
  S("colunas", { titulo: "Quem faz o quê", itens: "## Comercial\nRecebe o pedido, emite a proposta, apresenta métodos e condições à gerência e registra o aceite.\n## Gerência técnica\nAvalia condições técnicas (prazos, quantidades, métodos) e aprova a análise crítica.\n## Assistente administrativo\nPode fazer a análise crítica de serviços rotineiros, quando capacitado.\n## Gerente\nTem autoridade para fazer cumprir o PG 006 e disponibiliza pessoal treinado." }),
  S("numero", { titulo: "Regra de ouro", numero: "0", rotulo: "diferenças em aberto ao iniciar o trabalho", texto: "Quaisquer diferenças entre o pedido, a proposta ou o contrato devem ser resolvidas ANTES do início do trabalho.\nSe não tivermos capacidade ou recursos, o cliente deve ser informado.\nEm caso de dúvida técnica, o Comercial consulta a gerência técnica antes de enviar." }),
  S("colunas", { titulo: "Métodos de ensaio", itens: "## Normalizados\nDefinidos na proposta de serviços analíticos (ex.: SMWW). O MinasLab garante que atendem aos requisitos aceitos.\n## Não normalizados (validados)\nInformados na proposta. Se o cliente não pedir método específico, o método proposto pelo MinasLab é entendido como aceito.\n## Método do cliente inadequado\nPela 17025, o cliente deve ser avisado quando o método que ele pediu for inapropriado ou estiver desatualizado." }),
  S("colunas", { titulo: "Aceite do cliente", itens: "## E-mail\nForma preferencial: fica registrado.\n## Área do cliente\nAceite pelo site MinasLab.\n## Telefone\nVale, mas o Comercial precisa registrar o aceite no sistema." , destaque: "Datas, responsáveis e envios da proposta ficam no sistema: o processo é rastreável." }),
  S("topicos", { titulo: "Mudou depois de começar?", texto: "Repita a análise crítica do contrato\nComunique a alteração a todo o pessoal afetado, imediatamente\nMudanças com efeito financeiro, legal ou de prazo: registre na própria proposta e peça aprovação do cliente\nToda discussão com o cliente sobre requisitos ou resultados deve ser registrada" }),
  S("quiz", { titulo: "Caso real: ETE com ponto seco", texto: "O MinasLab foi contratado para coletar entrada e saída de uma ETE. O técnico chega e o ponto de saída está seco. O que fazer?", itens: "Coletar só a entrada e seguir com a OS\nCancelar a OS e voltar outro dia\n* O técnico liga para o assistente administrativo, que fala com o responsável do cliente; o acordo é repassado ao técnico\nColetar a saída no dia seguinte sem avisar ninguém", destaque: "É o exemplo do próprio PG 006: o contrato mudou depois de iniciado, então o cliente precisa concordar e o acordo deve ser registrado." }),
  S("quiz", { titulo: "Quiz", texto: "O cliente já aprovou a proposta e liga pedindo para incluir DBO. O que acontece?", itens: "Basta incluir na OS, já que ele pediu\n* Refaz a análise crítica, registra a alteração na proposta e o cliente aprova a revisão\nPede para ele mandar uma nova solicitação daqui a um mês", destaque: "Alteração de escopo = nova análise crítica (capacidade, método, prazo, preço) e registro da aprovação do cliente." }),
  S("quiz", { titulo: "Quiz", texto: "O cliente pede um parâmetro que o MinasLab não faz. E agora?", itens: "Enviar a proposta assim mesmo e resolver depois\n* Informar o cliente; se for a um laboratório parceiro, isso entra na análise crítica e o cliente fica sabendo\nTirar o parâmetro da proposta sem comentar", destaque: "PG 006 (4.1) e 17025 (7.1.1): sem capacidade ou recurso, o cliente deve ser informado. Trabalho de provedor externo segue o PG 007." }),
  S("quiz", { titulo: "Quiz", texto: "O cliente aceitou a proposta por telefone. Está valendo?", itens: "Não, só vale por e-mail\n* Sim, desde que o Comercial registre o aceite no sistema\nSim, e não precisa registrar nada", destaque: "Aceite por telefone é permitido pelo PG 006, mas precisa ficar registrado para ser rastreável." }),
  S("quiz", { titulo: "Quiz", texto: "Quem pode aprovar a análise crítica de um serviço rotineiro?", itens: "Qualquer pessoa da empresa\n* O assistente administrativo capacitado, o diretor ou o gerente\nSó o cliente", destaque: "Para serviços rotineiros, o PG 006 permite que o assistente administrativo que elaborou a proposta faça a análise, além do diretor ou gerente." }),
  S("colunas", { titulo: "Documentos relacionados", itens: "## PG 006\nAnálise crítica de propostas, pedidos ou contratos (rev. 03).\n## POP-CQ-005\nElaboração e cadastro de propostas e ordem de serviço.\n## PG 007\nAprovação de serviços providos externamente.\n## PG 013\nTratamento das reclamações.\n## Registro\nProposta de Serviços Analíticos (PSA) no software." }),
  S("compromissos", { titulo: "Compromissos" }, "Feche com 1 a 3 compromissos práticos (ex.: conferir o checklist antes de enviar; registrar aceite por telefone no mesmo dia)."),
  S("encerramento", { titulo: "Dúvidas?", subtitulo: "Proposta analisada é promessa que o laboratório consegue cumprir.", texto: "Registre a aplicação deste treinamento em Treinamentos › Registrar aplicação.", destaque: "Requisitos · Capacidade · Método · Registro" }),
];

const TREINAMENTO = () => [
  S("capa", { titulo: "Nome do treinamento", subtitulo: "Treinamento MinasLab", texto: "Para quem: ____ · Duração: 30 min" }),
  S("numero", { titulo: "Por que este treinamento", numero: "00%", rotulo: "o número que queremos mudar", texto: "Explique de onde vem o número e o que acontece se ele não mudar." }, "Todo treinamento ataca um número que o sistema mostra. Meça de novo 30 dias depois."),
  S("topicos", { titulo: "Objetivo", texto: "Ao final, cada pessoa será capaz de:\n____\n____" }),
  S("colunas", { titulo: "O que você precisa saber", itens: "## Ponto 1\nExplicação curta\n## Ponto 2\nExplicação curta\n## Ponto 3\nExplicação curta" }),
  S("numero", { titulo: "Regra de ouro", numero: "1", rotulo: "regra que ninguém pode esquecer", texto: "Escreva a regra em uma frase." }),
  S("fluxo", { titulo: "Passo a passo", itens: "Passo 1 | detalhe\nPasso 2 | detalhe\nPasso 3 | detalhe" }),
  S("topicos", { titulo: "Na prática", texto: "Exercício com um caso real da casa:\n____" }, "Use um caso do mês. Exemplo genérico ensina menos."),
  S("quiz", { titulo: "Quiz", texto: "Escreva a pergunta ou o caso", itens: "Alternativa errada\n* Alternativa certa\nOutra alternativa errada", destaque: "Explique por que essa é a resposta certa." }, "Copie este slide para cada pergunta. A turma vota antes de você revelar."),
  S("compromissos", { titulo: "Compromissos" }),
  S("encerramento", { titulo: "Dúvidas?", subtitulo: "Obrigado pela atenção!", texto: "MinasLab · Compromisso com a Qualidade" }),
];

const LIVRE = () => [
  S("capa", { titulo: "Título da apresentação", subtitulo: "{mes}", texto: "" }),
  S("topicos", { titulo: "Tópico", texto: "Primeiro ponto\nSegundo ponto" }),
  S("encerramento", { titulo: "Obrigado!", subtitulo: "MinasLab · Compromisso com a Qualidade", texto: "" }),
];

export const MODELOS = [
  { id: "mensal", categoria: "reuniao", nome: "Reunião mensal de resultados", desc: "A reunião geral do mês: calendário, avisos, indicadores do CRM, ranking e destaque. Você só completa o que mudou.", titulo: "Reunião mensal de resultados · {mes}", slides: MENSAL },
  { id: "comercial", categoria: "reuniao", setor: "comercial", nome: "Reunião do Comercial", desc: "Só a equipe comercial: indicadores do CRM, propostas em aberto, carteira, qualidade do registro e metas do próximo mês.", titulo: "Reunião do Comercial · {mes}", slides: COMERCIAL },
  { id: "laboratorio", categoria: "reuniao", setor: "laboratorio", nome: "Reunião do Laboratório", desc: "Só a equipe do laboratório: amostras por setor, prazos e OS atrasadas, não conformidades, produtividade e metas.", titulo: "Reunião do Laboratório · {mes}", slides: LABORATORIO },
  { id: "integracao", categoria: "treinamento", tema: "colorido", nome: "Integração de novos colaboradores", desc: "Módulo 1: ISO/IEC 17025, escopo CRL 1943, matrizes e recepção de amostras. Módulo 2: Declaração de Ética. Com teste no final.", titulo: "Integração e Capacitação Técnica", slides: INTEGRACAO },
  { id: "analise-critica", categoria: "treinamento", setor: "comercial", tema: "colorido", nome: "Análise crítica de propostas (ISO 17025)", desc: "PG 006 e requisito 7.1 da ISO/IEC 17025: checklist, fluxo da proposta, aceite do cliente e casos reais em quiz. Estilo colorido.", titulo: "Análise Crítica de Propostas · PG 006", slides: ANALISE_CRITICA },
  ...MODELOS_PG,
  ...MODELOS_TRILHAS,
  MODELO_VISUAL,
  { id: "treinamento", categoria: "treinamento", tema: "colorido", nome: "Novo treinamento", desc: "Estrutura pronta: o número que queremos mudar, objetivo, conteúdo, regra de ouro, prática e teste.", titulo: "Novo treinamento", slides: TREINAMENTO },
  { id: "livre", categoria: "ambos", nome: "Em branco", desc: "Capa, um slide e encerramento. Monte do seu jeito.", titulo: "Nova apresentação", slides: LIVRE },
];

export const modeloPorId = (id) => MODELOS.find((m) => m.id === id);

/** Slides novos (com id) de um modelo. */
export function slidesDoModelo(id) {
  return (modeloPorId(id)?.slides() || []).map((s) => ({ ...s, id: novoId("s") }));
}

export function slideEmBranco(layout) {
  const base = {
    capa: { titulo: "Título" }, encerramento: { titulo: "Obrigado!" },
    grafico: { titulo: "Título do gráfico", tipoGrafico: "colunas", itens: "Item A | 10\nItem B | 20\nItem C | 15" },
    tabela: { titulo: "Título da tabela", itens: "Coluna 1 | Coluna 2 | Coluna 3\nlinha | valor | valor" },
    topicos: { titulo: "Título", texto: "Primeiro ponto\nSegundo ponto" },
    imagem: { titulo: "Título", imagem: "" },
    quiz: { titulo: "Quiz", texto: "Escreva a pergunta", itens: "Alternativa A\n* Alternativa certa\nAlternativa C", destaque: "Explique por que essa é a resposta certa." },
  }[layout] || { titulo: LAYOUTS[layout]?.nome || "Slide" };
  return { id: novoId("s"), layout, notas: "", ...base };
}

// ---------------------------------------------------------------- texto
export const linhas = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);

/** "## Título" abre bloco; linhas seguintes são o corpo. */
export function blocos(t) {
  const out = [];
  for (const l of linhas(t)) {
    if (l.startsWith("## ")) out.push({ titulo: l.slice(3).trim(), linhas: [] });
    else if (out.length) out.at(-1).linhas.push(l);
    else out.push({ titulo: "", linhas: [l] });
  }
  return out;
}

/** "Título | detalhe" por linha. */
export const pares = (t) => linhas(t).map((l) => { const [a, ...b] = l.split("|"); return { titulo: a.trim(), texto: b.join("|").trim() }; });

/** Troca os marcadores {mes}, {ano}… por valores. */
export function preencher(texto, valores) {
  return String(texto ?? "").replace(/\{(\w+)\}/g, (m, k) => (valores[k] != null ? String(valores[k]) : m));
}
