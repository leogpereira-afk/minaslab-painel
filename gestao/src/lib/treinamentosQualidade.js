// Programa de Qualidade MinasLab, a partir da apresentação da casa
// (PROGRAMA DE QUALIDADE · ISO 17025), no padrão colorido com quiz.
// Dividido em dois treinamentos:
//  - 5S, os cinco sensos: para o Comercial e o Laboratório;
//  - Programa de Qualidade e Boas Práticas de Laboratório: para o Laboratório.
import { perguntasDoModelo } from "./treinamentosPG.js";

const S = (layout, campos = {}, notas = "") => ({ layout, ...campos, notas });
const FIM = (frase, destaque) => [
  S("compromissos", { titulo: "Compromissos" }, "Feche com 1 a 3 compromissos práticos, com dono e data."),
  S("encerramento", { titulo: "Dúvidas?", subtitulo: frase, texto: "Registre a aplicação deste treinamento em Treinamentos › Trilhas › Registrar aplicação.", destaque }),
];

// ------------------------------------------------------------ 5S
export const CINCO_S = () => [
  S("capa", { titulo: "5S · Os cinco sensos", subtitulo: "Programa de Qualidade MinasLab · Comercial e Laboratório", texto: "Cinco passos para um trabalho de qualidade: o local organizado, limpo, saudável e com disciplina para manter.", destaque: "Utilização · Ordenação · Limpeza · Saúde · Autodisciplina" }, "Abertura (2 min): peça para cada um pensar quanto tempo perdeu esta semana procurando alguma coisa (um frasco, um arquivo, uma proposta)."),
  S("frase", { titulo: "Em uma frase", frase: "Um lugar para cada coisa. Cada coisa em seu lugar.", texto: "O 5S é uma ferramenta da qualidade para organizar o local de trabalho, mantê-lo limpo e arrumado e cuidar da saúde, da higiene e da autodisciplina necessárias para um trabalho com qualidade." }),
  S("topicos", { titulo: "De onde vem", texto: "# Origem\nJapão, anos 1950: na reconstrução do país depois da Segunda Guerra, as empresas japonesas receberam orientação de especialistas americanos em controle de qualidade.\n# No Brasil\nOs cinco “S” do japonês viraram cinco sensos: utilização, ordenação, limpeza, saúde e autodisciplina.", destaque: "Vale para a bancada do laboratório, para a mesa do comercial e também para as pastas do computador." }),
  S("fluxo", { titulo: "Os cinco sensos", itens: "Seiri | Utilização: só o necessário\nSeiton | Ordenação: cada coisa no seu lugar\nSeisou | Limpeza: sempre limpo\nSeiketsu | Saúde: ambiente saudável\nShitsuke | Autodisciplina: manter e melhorar" }),

  S("frase", { titulo: "1º · Senso de utilização (Seiri)", frase: "Ter o necessário, na quantidade certa.", texto: "Aquilo que não se utiliza só atrapalha." }),
  S("colunas", { titulo: "Utilização na prática", itens: "## Sentido\n- Usar os recursos conforme a necessidade\n- Evitar excessos, desperdício e mau uso\n- Manter no local só objetos e dados necessários\n## Benefícios\n- Libera espaço\n- Reaproveita recursos\n- Diminui custos" }),

  S("frase", { titulo: "2º · Senso de ordenação (Seiton)", frase: "Aquilo que preciso, devo encontrar de forma fácil.", texto: "As coisas e os objetos permanecem nos seus devidos lugares." }),
  S("tabela", { titulo: "Como ordenar: pela frequência de uso", itens: "Com que frequência é usado? | Onde guardar\nConstantemente (todo dia) | Ao alcance da mão, no posto de trabalho\nOcasionalmente (toda semana ou mês) | Perto, no mesmo setor\nRaramente | Em arquivo ou almoxarifado, identificado", destaque: "Guardar de forma sistemática e pensar na imagem do setor: quem chega precisa entender a organização." }, "Peça exemplos de cada linha no setor de cada um."),
  S("colunas", { titulo: "Ordenação: como fazer", itens: "## Passo a passo\n- Mantenha a limpeza\n- Escolha um lugar para cada coisa\n- Identifique esses locais de forma visível\n- Mantenha cada coisa no seu lugar\n- Ordene documentos, informações e a sua forma de trabalhar\n## Benefícios\n- Economia de tempo\n- Menos cansaço físico\n- Mais facilidade para achar objetos e informações" }),

  S("frase", { titulo: "3º · Senso de limpeza (Seisou)", frase: "Sempre limpo é diferente de sempre limpando. E meio limpo é algo que não existe.", texto: "A limpeza cria um ambiente limpo e agradável, que satisfaz todas as pessoas." }),
  S("colunas", { titulo: "Limpeza: como fazer", itens: "## Como fazer\n- Educar-se para não sujar\n- Limpar o que está sujo\n- Inspecionar enquanto limpa\n- Descobrir e eliminar as fontes de sujeira\n- Bancadas e piso limpos no fim da tarde\n## Benefícios\n- Bem-estar\n- Conservação dos equipamentos\n- Prevenção de acidentes\n- Boa imagem do setor" }),

  S("frase", { titulo: "4º · Senso de saúde (Seiketsu)", frase: "O lugar onde vivemos e trabalhamos deve ser sempre favorável à saúde e à higiene.", texto: "Engloba os três sensos anteriores (utilização, ordenação e limpeza) e cuida da saúde física e mental." }),
  S("colunas", { titulo: "Saúde: o que fazer", itens: "## Ambiente\n- Iluminação, ventilação e segurança adequadas\n- Evitar poluição do ar, da água, sonora e visual\n- Primeiros socorros sempre em condições de uso\n## Manutenção\n- Respeitar as orientações de segurança\n- Consertar pisos, torneiras, fiações soltas e portas empenadas\n- Manutenção em dia de equipamentos e extintores\n## Benefícios\n- Corpo e mente sadios\n- Menos acidentes\n- Mais disposição\n- Ambiente agradável" }),
  S("topicos", { titulo: "Dicas de saúde", texto: "Reforce o café da manhã\nNão exagere no almoço e seja moderado no jantar\nDurma bem\nCaminhe todos os dias, aumentando aos poucos\nAprenda a relaxar nos momentos de tensão, com pequenas pausas" }),

  S("frase", { titulo: "5º · Senso de autodisciplina (Shitsuke)", frase: "Cumprir padrões e metas é ter disciplina.", texto: "É a busca da melhoria contínua, pessoal e da empresa: estar em constante aperfeiçoamento." }),
  S("colunas", { titulo: "Autodisciplina na prática", itens: "## Compromisso com\n- Padrões éticos e técnicos\n- Melhoria contínua, pessoal e da empresa\n- Criatividade, paciência, persistência e comprometimento\n- Aperfeiçoar o local de trabalho e compartilhar o que aprendeu\n- Colocar-se no lugar do cliente, interno ou externo\n## Benefícios\n- Novos hábitos\n- Disciplina para crescer\n- Incentivo à criatividade\n- Melhor qualidade de vida" }),

  S("colunas", { titulo: "5S no dia a dia", itens: "## No Comercial\n- Mesa só com o que está em uso\n- Pastas e e-mails organizados por cliente\n- Propostas e contatos registrados no CRM, não em papel solto\n- Arquivos com nome padrão, fáceis de achar\n## No Laboratório\n- Bancada só com o material do ensaio do dia\n- Frascos e soluções identificados\n- Vidraria limpa e guardada no lugar\n- Bancadas e piso limpos no fim da tarde" }, "Peça para cada setor dizer um ponto que vai mudar já nesta semana."),
  S("colunas", { titulo: "Como mudar a qualidade de vida", itens: "## Mudando o ambiente físico\nClassificando, ordenando e limpando: as coisas começam a melhorar.\n## Mudando o ambiente social\nCom paciência e persistência para manter um ambiente agradável e seguro, colocando-se no lugar do outro e passando adiante o que aprendeu.", destaque: "O trabalho em equipe é fundamental para o sucesso do programa." }),

  S("quiz", { titulo: "Quiz", texto: "Na sua mesa há três calculadoras, dois grampeadores e pilhas de papéis antigos. Qual senso começa a resolver?", itens: "* Utilização: ficar só com o necessário, na quantidade certa\nLimpeza: passar um pano na mesa\nSaúde: melhorar a iluminação", destaque: "Seiri, o senso de utilização: o que não se usa só atrapalha. Libera espaço e reaproveita recursos." }),
  S("quiz", { titulo: "Quiz", texto: "Um material é usado só duas vezes por ano. Onde guardar?", itens: "Em cima da bancada, para não esquecer\n* Em arquivo ou almoxarifado, em local identificado\nNa gaveta de quem usou por último", destaque: "Ordenação pela frequência de uso: o que é usado raramente fica guardado e identificado, fora do posto de trabalho." }),
  S("quiz", { titulo: "Quiz", texto: "O que quer dizer “sempre limpo é diferente de sempre limpando”?", itens: "Que não precisa limpar\n* Que o melhor é não sujar e eliminar as fontes de sujeira\nQue a limpeza é só da equipe de limpeza", destaque: "Seisou: educar-se para não sujar, inspecionar enquanto limpa e eliminar as fontes de sujeira." }),
  S("quiz", { titulo: "Quiz", texto: "Qual senso garante que os outros quatro continuem funcionando?", itens: "Utilização\nOrdenação\n* Autodisciplina\nLimpeza", destaque: "Shitsuke, a autodisciplina: cumprir os padrões todos os dias e buscar a melhoria contínua." }),
  S("quiz", { titulo: "Caso real", texto: "A torneira da pia está pingando há uma semana e o extintor está com a recarga vencida. Qual senso foi esquecido?", itens: "Utilização\n* Saúde: manutenção em dia e ambiente seguro\nOrdenação", destaque: "Seiketsu inclui consertar torneiras, fiações e portas e manter em dia a manutenção de equipamentos e extintores." }),
  ...FIM("Você é fundamental para o sucesso do 5S.", "Utilização · Ordenação · Limpeza · Saúde · Autodisciplina"),
];

// ------------------------------------------------------------ Programa de Qualidade (Laboratório)
export const PROGRAMA_QUALIDADE = () => [
  S("capa", { titulo: "Programa de Qualidade", subtitulo: "Boas Práticas de Laboratório · ISO/IEC 17025", texto: "Política da qualidade, responsabilidades, conduta e segurança, higiene, limpeza, pragas, resíduos e água.", destaque: "Política · BPL · Conduta · Higiene · Limpeza · Resíduos" }, "Abertura: leia a política da qualidade em voz alta e pergunte se, na semana passada, a equipe praticou o que ela diz."),
  S("frase", { titulo: "Política da Qualidade", frase: "Entender e atender as necessidades dos nossos clientes, através de boas práticas profissionais e da qualidade dos ensaios.", texto: "Será que estamos praticando a política de qualidade da empresa?" }),
  S("colunas", { titulo: "O que o Programa de Qualidade abrange", itens: "## Instalações\n- Instalações e área externa\n- Instalações sanitárias\n- Layout\n## Água e resíduos\n- Potabilidade da água\n- Controle de resíduos\n- Controle de pragas\n## Equipamentos\n- Equipamentos e maquinário\n- Utensílios\n- Limpeza e desinfecção\n## Pessoas e processos\n- Higiene pessoal\n- Fluxograma\n- Coleta e armazenamento\n- Manuais e procedimentos" }),
  S("colunas", { titulo: "Responsabilidades", itens: "## Da empresa\n- Prédio e instalações adequados, com fluxos lógicos\n- Instalações hidráulicas e elétricas, piso e paredes conservados\n- Tratamento do lixo e potabilidade da água\n- Equipamentos e utensílios em perfeitas condições\n- Procedimento de limpeza e desinfecção\n- Treinar toda a equipe e dar condições para cumprir os procedimentos\n## Dos colaboradores\n- Conhecer todos os procedimentos da sua função\n- Adequar a rotina e o comportamento às Boas Práticas de Laboratório e às normas internas" }),
  S("topicos", { titulo: "O que são as BPL", texto: "# Boas Práticas de Laboratório\nConjunto de normas para que os ensaios sejam organizados, planejados, monitorados, registrados e relatados.\n# Origem\nAs BPL surgiram em lei na Nova Zelândia (1972) e na Dinamarca (1973), para dar credibilidade ao trabalho dos laboratórios.\n# No Brasil\nEm 2011 o INMETRO foi avaliado por inspetores da OCDE, e o Brasil foi reconhecido no sistema de aceitação mútua de dados (MAD).", destaque: "Laboratório que segue as BPL transmite confiança, qualidade e respeito: ganha credibilidade no mercado." }),
  S("colunas", { titulo: "Microrganismos: o básico", itens: "## Onde estão\nNo ar, na água, no solo, nas superfícies, nas mãos e no nosso corpo.\n## O que precisam para se multiplicar\n- Temperatura\n- Nutrientes\n- Tempo\n- Umidade", destaque: "Controlar essas condições é o que protege a amostra, o resultado e quem trabalha." }, "Pergunte onde, na rotina do laboratório, essas quatro condições aparecem juntas."),
  S("colunas", { titulo: "Perigos no laboratório", itens: "## Biológicos\nMicrorganismos das amostras e do ambiente.\n## Químicos\nReagentes, solventes, ácidos e padrões.\n## Físicos\nVidraria quebrada, arestas cortantes, calor de estufas e autoclaves." }),

  S("colunas", { titulo: "Normas de conduta e segurança (1)", itens: "## Antes de começar\n- Planejamento e conhecimento do ensaio\n- Uniforme completo: roupa, sapato e touca\n- Máscara descartável no contato direto com amostra (coleta e micro)\n- EPIs corretos e todos os dias: máscara com filtro, luvas e óculos\n## Nunca no laboratório\n- Comer, beber ou fumar\n- Trocar de roupa\n- Identificar substância pela cor, sabor ou textura\n- Pôr a mão na boca ou nos olhos durante o trabalho" }),
  S("colunas", { titulo: "Normas de conduta e segurança (2)", itens: "## Segurança\n- Identificar todos os frascos com solução: nome, concentração, data de fabricação e de validade\n- Não trabalhar com instrumentos com arestas cortantes\n- Não permitir a entrada de estranhos\n- Usar pera ou pipetador\n- Sem acessórios, celular, esmalte ou perfume\n## Rotina técnica\n- Fazer as análises conforme o POP\n- Registrar todos os procedimentos realizados\n- Cuidado com balanças, estufas, blocos e demais equipamentos\n- Lavar e esterilizar a vidraria corretamente\n- Fazer a avaliação crítica dos resultados e registrar" }),

  S("topicos", { titulo: "Higiene das mãos: quando lavar", texto: "Ao entrar no setor\nAo trocar de atividade\nDepois de usar o sanitário\nDepois de tossir, espirrar ou assoar o nariz\nDepois de usar materiais de limpeza\nDepois de recolher lixo ou outros resíduos\nSempre que tocar em algo que não está limpo" }),
  S("fluxo", { titulo: "Higiene das mãos: como lavar", itens: "Molhar | Mãos e punhos com água\nSabonete | Cobrir toda a superfície das mãos\nEsfregar | Palmas, dorso, entre os dedos, polegares, pontas dos dedos e punhos\nEnxaguar | Retirar todo o sabonete\nSecar | Papel toalha descartável\nFechar | A torneira com o papel, sem tocar de novo" }),
  S("colunas", { titulo: "Higiene pessoal e uniforme", itens: "## Higiene corporal\n- Banho diário\n- Unhas curtas, limpas e sem esmalte\n- Cabelos presos e protegidos pela touca\n- Sem acessórios e sem perfume\n## Botas\n- Usadas somente dentro do setor\n- Na microbiologia: bota e propé\n## Visitantes\n- Retiram os acessórios\n- Entram devidamente uniformizados" }),
  S("colunas", { titulo: "Limpeza e sanitização", itens: "## Sempre\nOrganização e limpeza do ambiente, mesmo nas horas de maior produção.\n## O que limpar\n- Piso e bancadas\n- Equipamentos\n- Utensílios\n- Retirar o lixo\n## Como\nConforme o procedimento de limpeza descrito no POP." }),
  S("colunas", { titulo: "Saúde dos colaboradores", itens: "## No dia a dia\nUsar os EPIs todos os dias e corretamente.\n## Exames\nFazer o exame periódico.\n## Atestado\nEntregar em até 24 horas.\n## Lesões leves\nTransferência de função até a recuperação." }),

  S("colunas", { titulo: "Controle de pragas", itens: "## Por que as pragas são atraídas\n- Água\n- Alimento e restos\n- Abrigo: frestas, caixas e entulho\n## O que fazer\n- Não deixar alimento nem água parada\n- Manter tudo fechado e organizado\n- Registrar na planilha de controle de pragas" }),
  S("colunas", { titulo: "Controle de resíduos", itens: "## O que são\nMateriais ou restos de materiais, recicláveis ou não.\n## Separação\n- Papel\n- Plástico\n- Vidro\n- Metal\n- Orgânico\n- Soro\n- Entulho\n## Perigosos\nAlguns resíduos exigem cuidados especiais na coleta, no transporte e na destinação final." }),
  S("frase", { titulo: "Controle da água", frase: "A potabilidade da água é obrigatória para todas as finalidades.", texto: "Use só o necessário!" }),
  S("frase", { titulo: "O custo da não qualidade", frase: "Clientes insatisfeitos, prejuízo para a empresa e risco ao emprego de todos.", texto: "Os laboratórios que seguem as BPL transmitem confiança, qualidade e respeito e ganham credibilidade no mercado." }),
  S("colunas", { titulo: "Não será permitido", itens: "## Laboratório\nSujo e desorganizado.\n## Relatório\nPassado errado.\n## Planilhas\nAtrasadas.\n## Folgas\nProgramadas em cima da hora.\n## Ponto\nFora do horário (17h).", destaque: "Não conformidades são registradas e tratadas (PG 014)." }),
  S("topicos", { titulo: "E o 5S?", texto: "Os cinco sensos (utilização, ordenação, limpeza, saúde e autodisciplina) fazem parte do Programa de Qualidade e têm um treinamento próprio, para o Comercial e o Laboratório.", destaque: "Treinamentos › 5S · Os cinco sensos." }),

  S("quiz", { titulo: "Quiz", texto: "Qual é a política da qualidade da MinasLab?", itens: "Fazer o maior número de ensaios possível\n* Entender e atender as necessidades dos clientes, com boas práticas profissionais e qualidade dos ensaios\nCobrar o menor preço do mercado", destaque: "É a política da qualidade da casa. Pergunta para a turma: estamos praticando?" }),
  S("quiz", { titulo: "Quiz", texto: "Quais condições favorecem a multiplicação dos microrganismos?", itens: "Só a temperatura\n* Temperatura, nutrientes, tempo e umidade\nLuz e barulho", destaque: "As quatro condições juntas: por isso a amostra é refrigerada, o tempo é controlado e o ambiente fica limpo e seco." }),
  S("quiz", { titulo: "Caso real", texto: "Um analista preparou uma solução e colocou no frasco só o nome. Está certo?", itens: "Sim, o nome basta\n* Não: o frasco deve ter nome, concentração, data de fabricação e de validade\nSó se for usar no mesmo dia", destaque: "Norma de conduta: identificar todos os frascos com nome, concentração e datas de fabricação e validade." }),
  S("quiz", { titulo: "Quiz", texto: "Quando lavar as mãos?", itens: "Só no fim do dia\nSó depois de usar o sanitário\n* Ao entrar no setor, ao trocar de atividade e sempre depois de tocar em algo não limpo, lixo ou material de limpeza", destaque: "A higiene das mãos acontece várias vezes ao dia, em cada troca de atividade." }),
  S("quiz", { titulo: "Quiz", texto: "Um visitante quer conhecer a microbiologia. O que é preciso?", itens: "Nada, é só uma visita rápida\n* Retirar os acessórios e entrar devidamente uniformizado (na micro, com bota e propé)\nEntrar só com o celular desligado", destaque: "Visitantes seguem as mesmas regras de uniforme e acessórios da equipe." }),
  ...FIM("O sucesso do Programa de Qualidade depende da direção e de todos os colaboradores.", "Política · BPL · Conduta · Higiene · Limpeza"),
];

const T = (setor) => ({ categoria: "treinamento", setor, tema: "colorido" });
export const MODELOS_QUALIDADE = [
  { id: "qualidade-5s", ...T(""), nome: "5S · Os cinco sensos", desc: "Utilização, ordenação, limpeza, saúde e autodisciplina, com exemplos do Comercial e do Laboratório. Com quiz.", titulo: "5S · Os cinco sensos", slides: CINCO_S },
  { id: "qualidade-programa", ...T("laboratorio"), nome: "Programa de Qualidade e BPL", desc: "Política da qualidade, responsabilidades, BPL, conduta e segurança, higiene, limpeza, pragas, resíduos e água. Com quiz.", titulo: "Programa de Qualidade · BPL", slides: PROGRAMA_QUALIDADE },
];

const roteiro = (abertura, min) => {
  const a = Math.round(min * 0.45), b = Math.round(min * 0.7);
  return [
    { min: "0–5", passo: abertura },
    { min: `5–${a}`, passo: "Apresentação colorida: os pontos principais, com exemplos do setor." },
    { min: `${a}–${b}`, passo: "Quizzes em grupo: a turma vota em cada caso antes de você revelar a resposta." },
    { min: `${b}–${min}`, passo: "Exercício prático e teste individual. Registre as notas em Registrar aplicação." },
  ];
};

export const TRILHAS_QUALIDADE = [
  {
    id: "qualidade-5s", setores: ["comercial", "laboratorio"], tema: "qualidade", modelo: "qualidade-5s", minutos: 40,
    nome: "5S · Os cinco sensos", publico: "Toda a equipe (Comercial e Laboratório)",
    objetivo: "Cada posto de trabalho com só o necessário, cada coisa no seu lugar e identificada, limpo no fim do dia e com a rotina mantida por todos.",
    gatilho: "manual", indicador: "Itens fora do lugar ou sem identificação encontrados nas inspeções do setor",
    slides: ["Utilização (Seiri): só o necessário, na quantidade certa.", "Ordenação (Seiton): um lugar para cada coisa, pela frequência de uso.", "Limpeza (Seisou): sempre limpo é diferente de sempre limpando.", "Saúde (Seiketsu): ambiente seguro, manutenção em dia, corpo e mente sadios.", "Autodisciplina (Shitsuke): cumprir padrões e buscar a melhoria contínua."],
    roteiro: roteiro("Abertura: peça para cada um contar quanto tempo perdeu esta semana procurando alguma coisa.", 40),
    exercicio: "Em dupla, façam o 5S de um posto de trabalho (mesa, bancada ou pasta do computador): separem o que não é usado, definam o lugar de cada coisa, identifiquem e tirem foto do antes e depois.",
    perguntas: perguntasDoModelo(CINCO_S),
  },
  {
    id: "qualidade-programa", setores: ["laboratorio"], tema: "qualidade", modelo: "qualidade-programa", minutos: 50,
    nome: "Programa de Qualidade e BPL", publico: "Laboratório (analistas, coletores e apoio)",
    objetivo: "Equipe conhecendo a política da qualidade e aplicando as Boas Práticas de Laboratório: conduta e EPIs, identificação de frascos, higiene das mãos, limpeza, pragas, resíduos e água.",
    gatilho: "ocorrencia:Não conformidade POP", indicador: "Ocorrências “Não conformidade POP” e não conformidades de conduta, limpeza e identificação",
    slides: ["Política da qualidade e responsabilidades da empresa e dos colaboradores.", "BPL: ensaios organizados, planejados, monitorados, registrados e relatados.", "Conduta e segurança: uniforme, EPIs, frascos identificados, nada de comer ou beber.", "Higiene das mãos e pessoal, botas e propé, visitantes.", "Limpeza, pragas, resíduos e água; o que não será permitido."],
    roteiro: roteiro("Abertura: leia a política da qualidade e pergunte se a equipe praticou o que ela diz na última semana.", 50),
    exercicio: "Façam uma ronda de 10 minutos no laboratório com a lista de normas de conduta: frascos sem identificação, EPIs, limpeza das bancadas, lixo e pontos de pragas. Cada dupla registra o que achou e o que vai corrigir.",
    perguntas: perguntasDoModelo(PROGRAMA_QUALIDADE),
  },
];
