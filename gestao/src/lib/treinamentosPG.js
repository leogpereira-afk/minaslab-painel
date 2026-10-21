// Treinamentos montados a partir dos procedimentos da casa (PG e POP), no
// estilo colorido com quiz. Cada um tem o modelo de apresentação e a trilha
// (roteiro, exercício e teste) que aparece em Treinamentos › Trilhas.

const S = (layout, campos = {}, notas = "") => ({ layout, ...campos, notas });
const FIM = (frase, destaque) => [
  S("compromissos", { titulo: "Compromissos" }, "Feche com 1 a 3 compromissos práticos, com dono e data."),
  S("encerramento", { titulo: "Dúvidas?", subtitulo: frase, texto: "Registre a aplicação deste treinamento em Treinamentos › Trilhas › Registrar aplicação.", destaque }),
];

// ------------------------------------------------------------ PG 012
const PG012 = () => [
  S("capa", { titulo: "Satisfação do Cliente", subtitulo: "PG 012 · Atendimento aos Clientes · ISO/IEC 17025 (8.6 e 7.1)", texto: "Como o MinasLab ouve o cliente, mede a satisfação e transforma nota baixa em melhoria.", destaque: "Pesquisa · Pesos · Meta 85% · Retorno · Tratativa" }, "Abertura (2 min): pergunte qual foi o último elogio e a última reclamação que cada um ouviu de um cliente."),
  S("frase", { titulo: "Por que isso importa", frase: "Cliente que não responde não está necessariamente satisfeito.", texto: "A pesquisa é a voz do cliente dentro do sistema de gestão: mostra o que melhorar antes de virar reclamação." }),
  S("topicos", { titulo: "PG 012 em uma frase", texto: "# Objetivo\nEstabelecer a sistemática de atendimento às necessidades dos clientes.\n# Aplicação\nSatisfação geral do cliente com os serviços prestados pelo MinasLab.\n# Regra básica\nTodo contato com o cliente passa pelo Atendimento ao Cliente, que registra e monitora.", destaque: "A ISO/IEC 17025 (8.6.2) pede buscar o retorno dos clientes, positivo e negativo, e usá-lo para melhorar." }),
  S("fluxo", { titulo: "Como funciona a pesquisa", itens: "Período | Semestral (ou eventual, se preciso)\nQuem recebe | Clientes que enviaram amostras no semestre\nEnvio | Automático, pelo ícone “Satisfação envio”\nRetorno | Abaixo de 10%? Retroalimentar!\nCálculo | Média ponderada pelos pesos\nTratativa | Ruim e regular viram melhoria ou NC", destaque: "O período é escolhido antes do envio. O controle das pesquisas enviadas é feito por e-mail." }),
  S("tabela", { titulo: "Os 7 itens e os seus pesos", itens: "Item avaliado | Peso\nContato (pessoal, telefone, e-mail) | 1\nRapidez no atendimento | 1\nPrazo de apresentação das propostas | 1\nQualidade dos serviços oferecidos | 3\nPreço dos serviços | 1\nPrazos e compromissos assumidos | 2\nClareza dos relatórios de ensaio | 2", destaque: "Qualidade vale 3; prazos e relatórios valem 2. É onde uma nota baixa pesa mais na média." }, "Pergunte: em quais desses itens o Comercial interfere diretamente? (contato, rapidez, prazo da proposta, compromissos)."),
  S("colunas", { titulo: "Como vira porcentagem", itens: "## Ruim\nGrau 1 = 25%\n## Regular\nGrau 2 = 50%\n## Bom\nGrau 3 = 75%\n## Excelente\nGrau 4 = 100%", destaque: "Média geral mínima: 85% de satisfação, considerando todos os itens e os pesos." }),
  S("numero", { titulo: "Meta do PG 012", numero: "85%", rotulo: "satisfação geral mínima", texto: "Retorno abaixo de 10%: a pesquisa deve ser reenviada (retroalimentada).\nSem retorno mesmo depois disso, a avaliação é considerada positiva em todos os itens.\nNotas ruins ou regulares procedentes podem abrir não conformidade; se não abrir, registre a justificativa." }),
  S("quiz", { titulo: "Quiz", texto: "Qual item tem o maior peso no cálculo da satisfação?", itens: "Preço dos serviços\nRapidez no atendimento\n* Qualidade dos serviços oferecidos\nContato telefônico", destaque: "Qualidade dos serviços tem peso 3. Prazos e compromissos e clareza dos relatórios têm peso 2." }),
  S("quiz", { titulo: "Quiz", texto: "A pesquisa do semestre teve 6% de retorno. O que o PG 012 manda fazer?", itens: "Nada, a pesquisa está encerrada\n* Retroalimentar: reenviar a pesquisa aos clientes\nAbrir uma não conformidade", destaque: "Retorno abaixo de 10% exige retroalimentação. Só depois disso, sem retorno, a avaliação é considerada positiva." }),
  S("quiz", { titulo: "Caso real", texto: "Um cliente marcou “Ruim” em Prazos e compromissos assumidos. O que fazer?", itens: "Ignorar, é só uma nota\n* Avaliar se procede: abrir não conformidade ou registrar a justificativa, e tratar a melhoria\nLigar e pedir para ele mudar a nota", destaque: "Nota ruim ou regular procedente pode abrir NC. Se não abrir, o MinasLab registra a justificativa. Nunca se pede para mudar a nota." }),
  S("quiz", { titulo: "Quiz", texto: "Qual a média mínima de satisfação geral exigida?", itens: "70%\n* 85%\n100%", destaque: "Meta do PG 012: no mínimo 85% na avaliação geral de todos os itens." }),
  S("colunas", { titulo: "No dia a dia do Comercial", itens: "## Contato\nResponda rápido e registre o contato.\n## Proposta\nCumpra o prazo de apresentação combinado.\n## Compromissos\nSó prometa prazo que o laboratório consegue cumprir.\n## Relatório\nAjude o cliente a entender o relatório de ensaio." }),
  S("colunas", { titulo: "Documentos relacionados", itens: "## PG 012\nAtendimento aos clientes (rev. 02).\n## PSC\nPesquisa de satisfação do cliente.\n## PG 013\nTratamento das reclamações.\n## PG 014\nControle de não conformidades." }),
  ...FIM("Ouvir o cliente é o primeiro passo para melhorar.", "Pesquisa · Pesos · 85% · Melhoria"),
];

// ------------------------------------------------------------ PG 013
const PG013 = () => [
  S("capa", { titulo: "Tratamento de Reclamações", subtitulo: "PG 013 · rev. 03 · ISO/IEC 17025 (7.9)", texto: "Da chegada da reclamação ao encerramento: registro, imparcialidade, causa raiz e resposta ao cliente.", destaque: "Registrar · Classificar · Investigar · Corrigir · Responder · Encerrar" }, "Abertura: reclamação bem tratada fideliza o cliente. Lembre que a rev. 03 nasceu de uma não conformidade de auditoria (NC 07 do RAV 450/2026)."),
  S("frase", { titulo: "Por que isso importa", frase: "Toda reclamação, formal ou informal, é registrada.", texto: "A ISO/IEC 17025 (7.9) exige um processo documentado, imparcial e rastreável para receber, avaliar e decidir sobre reclamações." }),
  S("colunas", { titulo: "O que pode virar reclamação", itens: "## Ensaios\nResultados e prazos dos ensaios ambientais.\n## Relatórios\nErros ou falta de clareza no relatório de ensaio.\n## Amostragem\nColeta, ponto, preservação.\n## Interpretação\nLeitura dos resultados.\n## Atendimento\nContato, retorno, postura." }),
  S("colunas", { titulo: "As regras do PG 013", itens: "## Canais formais\nE-mail, site, telefone ou presencial. Encaminhar imediatamente.\n## Imparcial\nAnalisada por quem NÃO participou do serviço reclamado.\n## Rastreável\nToda evidência documentada e arquivada no RRC.\n## Melhoria\nAções corretivas seguem o PG 014 e alimentam a melhoria contínua." }),
  S("topicos", { titulo: "O que registrar no RRC", texto: "Número de protocolo único\nData de recebimento\nDescrição detalhada da reclamação\nCliente envolvido\nData do ocorrido\nNome do reclamante", destaque: "Reclamação em aberto: o motivo do prazo fica escrito no campo de providências até fechar." }),
  S("tabela", { titulo: "Classificação", itens: "Classe | Quando\nCrítica | Impacto regulatório, legal ou técnico significativo\nAlta | Impacto relevante no resultado do cliente\nMédia | Impacto limitado\nBaixa | Impacto administrativo ou menor", destaque: "Crítica pede ação imediata, antes mesmo da análise preliminar." }),
  S("fluxo", { titulo: "O fluxo (Anexo I)", itens: "Recebimento | Pelos canais oficiais\nRegistro | Protocolo no RRC\nClassificação | Crítica pede ação imediata!\nInvestigação | 5 porquês, Ishikawa, registros\nAção corretiva | Pela causa raiz (PG 014)\nEficácia | Qualidade confirma\nResposta | Clara e com evidência\nEncerramento | E análise de tendências" }, "Percorra cada etapa com um caso real (sem identificar o cliente)."),
  S("colunas", { titulo: "Palavras-chave", itens: "## Reclamação\nExpressão de insatisfação do cliente com o serviço prestado.\n## Causa raiz\nOrigem fundamental do problema.\n## Ação corretiva\nElimina a causa de uma não conformidade.\n## Eficácia\nA ação resolveu o problema de forma definitiva?" }),
  S("colunas", { titulo: "Resposta e encerramento", itens: "## A resposta deve ser\n- Clara\n- Técnica\n- Baseada em evidências\n- Rastreável\n## Só encerra quando\n- A resolução foi confirmada\n- O cliente está satisfeito (quando aplicável)\n- O registro final está completo" , destaque: "Depois de concluir, o cliente é avisado do fechamento por telefone, WhatsApp, e-mail ou site." }),
  S("colunas", { titulo: "Quem faz o quê", itens: "## Comercial / Administrativo\nRecebe e cadastra a reclamação no RRC (quem não está envolvido no laboratório).\n## Gerente\nFaz a análise crítica, decide sobre NC e monitora o status.\n## Equipe de conclusão\nGerente + responsável administrativo/comercial, desde que não ligados à reclamação.\n## Qualidade\nVerifica a eficácia da ação corretiva." }),
  S("quiz", { titulo: "Caso real", texto: "Um cliente reclama por WhatsApp, informalmente, de um erro no relatório. Precisa registrar?", itens: "Não, só reclamação formal é registrada\n* Sim: toda reclamação, formal ou informal, é avaliada e registrada no RRC\nSó se ele mandar por e-mail depois", destaque: "Diretriz do PG 013: toda reclamação recebida, formal ou informal, deve ser avaliada e registrada no RRC." }),
  S("quiz", { titulo: "Quiz", texto: "A reclamação é sobre uma coleta. Quem pode analisar?", itens: "O próprio técnico que fez a coleta, que conhece o caso\n* Alguém não envolvido diretamente no serviço reclamado\nQualquer pessoa da coleta", destaque: "Imparcialidade: a análise é feita por pessoal não envolvido no serviço reclamado (PG 013 e ISO/IEC 17025 7.9)." }),
  S("quiz", { titulo: "Quiz", texto: "A reclamação procedeu e virou não conformidade. Onde fica a ação corretiva?", itens: "Só no e-mail ao cliente\n* No RNC, pelo PG 014 (Controle de não conformidades)\nEm lugar nenhum, basta corrigir", destaque: "Ações corretivas seguem o PG 014 e são registradas no Relatório de Não Conformidades (RNC)." }),
  S("quiz", { titulo: "Quiz", texto: "Quando a reclamação pode ser encerrada?", itens: "Assim que o cliente para de ligar\nQuando a resposta é enviada\n* Com a resolução confirmada, o cliente satisfeito (quando aplicável) e o registro final completo", destaque: "Os 3 critérios de encerramento do PG 013 (item 11)." }),
  S("colunas", { titulo: "Documentos relacionados", itens: "## PG 013\nTratamento das reclamações (rev. 03).\n## RRC\nRegistro de Reclamação dos Clientes.\n## PG 014\nControle de não conformidades (RNC).\n## Anexo I\nFluxograma do processo de reclamação." }),
  ...FIM("Reclamação bem tratada vira confiança.", "Registrar · Imparcial · Causa raiz · Resposta"),
];

// ------------------------------------------------------------ PG 010
const PG010 = () => [
  S("capa", { titulo: "Inspeção de Recebimento", subtitulo: "PG 010 · ISO/IEC 17025 (6.6)", texto: "Como conferir insumos críticos e serviços (como calibração) antes de usar.", destaque: "LISIR · IR · RIS · Certificado · Pré-teste" }, "Abertura: pergunte o que acontece com o resultado se um reagente vencido ou fora de especificação entrar na bancada."),
  S("frase", { titulo: "Por que isso importa", frase: "O resultado só é confiável se o que entra no laboratório é confiável.", texto: "A ISO/IEC 17025 (6.6) exige verificar que produtos e serviços externos atendem aos requisitos antes de serem usados." }),
  S("topicos", { titulo: "PG 010 em uma frase", texto: "# Objetivo\nEstabelecer critérios para inspeção de recebimento de materiais e serviços.\n# Aplicação\nTodos os produtos, materiais e serviços críticos.\n# Insumo crítico\nTodo aquele que interfere, de alguma forma, no processo de análise.", destaque: "Quais itens são inspecionados está na LISIR (Lista de itens sujeitos a inspeção de recebimento)." }),
  S("fluxo", { titulo: "Do recebimento à bancada", itens: "Recebimento | Entregue ao responsável e protocolado\nInspeção | Formulário IR, antes de usar!\nAnálise crítica | Aprovado ou reprovado, com registro\nArmazenamento | Conforme o fabricante (PG 011)\nBancada | Pré-teste ou primeiro uso do lote" }),
  S("colunas", { titulo: "Inspeção de insumos (IR)", itens: "## Quando\nAssim que recebido, antes da utilização.\n## Onde\nFormulário IR, com todos os dados do produto.\n## Sem pedido de compra?\nPode usar o número da nota fiscal no campo.\n## Reprovou?\nRegistre o desvio. Se abrir RNC, o código vai no campo de observações." }),
  S("colunas", { titulo: "Inspeção de serviços (RIS)", itens: "## Onde\nRIS · Relatório de Inspeção de Serviços.\n## Calibração\nO provedor deve ser acreditado na ISO/IEC 17025: confira o logotipo do organismo de acreditação no certificado.\n## Aprovação\nRIS de calibração só é aprovado depois da FM-LAB-019 (Verificação da Calibração).\n## Avaliação do provedor\nPG 009 · Avaliação de provedor externo." }),
  S("topicos", { titulo: "Verificação na bancada", texto: "Checagem registrada no caderno de ensaio de cada parâmetro\nCada lote de insumo crítico passa por pré-teste quando necessário\nO pré-teste pode ser o primeiro uso do lote na rotina\nPadrões de referência: FM-LAB-095 (checagem de material de referência)", destaque: "Problema no insumo? 1º repita com o mesmo insumo e a mesma amostra. Persistiu? Repita com outro lote ou outro fabricante." }),
  S("quiz", { titulo: "Quiz", texto: "Chegou um reagente crítico às 16h e a análise é amanhã cedo. Quando fazer a inspeção?", itens: "Depois de usar, se der problema\n* Assim que recebido, antes da utilização, no formulário IR\nSó na auditoria interna", destaque: "PG 010 (4.2): a inspeção é feita assim que o insumo é recebido e antes de ser usado." }),
  S("quiz", { titulo: "Caso real", texto: "O certificado de calibração da balança chegou sem o logotipo do organismo de acreditação. E agora?", itens: "Aprovar o RIS, o certificado é o que importa\n* Não aprovar: o provedor de calibração deve ser acreditado na ISO/IEC 17025, e a prova é o logotipo no certificado\nUsar a balança e ver se dá diferença", destaque: "A confirmação da acreditação do provedor é feita pelo logotipo do organismo de acreditação impresso no certificado." }),
  S("quiz", { titulo: "Quiz", texto: "O branco deu alto com um lote novo de reagente. Qual o primeiro passo?", itens: "Descartar o lote na hora\n* Repetir o ensaio com o mesmo insumo e a mesma amostra para descartar erro do analista, do equipamento ou do método\nTrocar de fabricante sem registrar", destaque: "Só se o problema persistir é que se repete com outro lote ou outro fabricante, registrando o desvio." }),
  S("quiz", { titulo: "Quiz", texto: "O produto chegou sem número de pedido de compra. Dá para fazer a inspeção?", itens: "Não, devolva ao fornecedor\n* Sim, pode identificar pela nota fiscal no campo\nSim, sem identificar nada", destaque: "Observação do PG 010: sem número de pedido, a nota fiscal pode identificar o produto no ato da inspeção." }),
  S("colunas", { titulo: "Registros", itens: "## IR\nInspeção de Recebimento.\n## RIS\nRelatório de Inspeção de Serviços.\n## LISIR\nLista de itens sujeitos a inspeção.\n## FM-LAB-019\nVerificação da calibração.\n## FM-LAB-095\nChecagem de material de referência.\n## CE\nControle de estoque." }),
  ...FIM("Inspecionou, registrou, aí sim usou.", "LISIR · IR · RIS · Pré-teste"),
];

// ------------------------------------------------------------ PG 011
const PG011 = () => [
  S("capa", { titulo: "Armazenamento de Materiais", subtitulo: "PG 011 · ISO/IEC 17025 (6.6)", texto: "Onde e como guardar reagentes e insumos, controlar validade e descartar com segurança.", destaque: "CAM · CEG · RAAM · Etiquetas · Descarte" }, "Abertura: leve um frasco com etiqueta amarela e um com vermelha e pergunte o que cada cor significa."),
  S("frase", { titulo: "Por que isso importa", frase: "Reagente mal guardado é resultado em risco.", texto: "Materiais e insumos que podem afetar o resultado do ensaio precisam de condições de armazenamento controladas e registradas." }),
  S("topicos", { titulo: "PG 011 em uma frase", texto: "# Objetivo\nEstabelecer critérios para o armazenamento de materiais.\n# Aplicação\nTodos os materiais e insumos que possam afetar o resultado dos ensaios.\n# Quem audita o estoque\nO setor de recepção de amostras é o responsável pela auditoria dos itens estocados." }),
  S("tabela", { titulo: "Os controles e a frequência", itens: "Registro | Para quê | Frequência\nCAM · Condições de armazenamento | Local, forma e cuidados de cada material | Anual ou quando mudar\nRAAM · Avaliação do armazenamento | Situação dos reagentes estocados | Trimestral\nCEG · Controle de estoque geral | Entrada, saída, lote e validade | A cada entrada e saída\nFM-LAB-032 · Organização do almoxarifado | Onde fica cada coisa | Anual ou quando mudar", destaque: "CEG é diário: toda entrada e toda saída de material é lançada na hora." }, "Mostre onde estão o CAM, o CEG e o FM-LAB-032 no laboratório."),
  S("colunas", { titulo: "Etiquetas de validade", itens: "## Vermelha\nVence dentro do mês. Prioridade de uso ou separar para descarte.\n## Amarela\nVence em até seis meses. Use antes dos mais novos.", destaque: "A inspeção da área de armazenamento é mensal, feita pelo responsável pelo descarte." }),
  S("fluxo", { titulo: "Descarte", itens: "Inspeção mensal | Responsável confere a área\nVencido? | Separar, não usar!\nRegistro | FM-LAB-083\nResíduos químicos | Coleta por empresa especializada" }),
  S("quiz", { titulo: "Quiz", texto: "Um reagente vence daqui a 4 meses. Qual etiqueta ele deve ter?", itens: "Vermelha\n* Amarela\nNenhuma", destaque: "Amarela: vence em até seis meses. Vermelha: vence dentro do mês." }),
  S("quiz", { titulo: "Quiz", texto: "Você tirou dois frascos de ácido do almoxarifado. O que registrar?", itens: "Nada, é só no fim do mês\n* A saída no CEG (Controle de Estoque Geral), na hora\nSó no RAAM", destaque: "O CEG controla entrada, saída, lotes e validade, a cada movimentação." }),
  S("quiz", { titulo: "Caso real", texto: "Encontrou um padrão vencido na geladeira. Qual o caminho certo?", itens: "Usar só mais uma vez\nJogar na pia\n* Separar, não usar, registrar no FM-LAB-083 e destinar pela coleta de resíduos", destaque: "Descarte é registrado no FM-LAB-083 e resíduos químicos vão para empresa especializada." }),
  S("quiz", { titulo: "Quiz", texto: "Com que frequência o RAAM avalia a situação dos reagentes estocados?", itens: "Diariamente\n* Trimestralmente\nA cada dois anos", destaque: "Pela descrição do PG 011, o RAAM é trimestral. O CAM e o FM-LAB-032 são anuais ou quando houver mudança." }),
  S("colunas", { titulo: "Registros", itens: "## CAM\nCondição de armazenamento de materiais e reagentes.\n## CEG\nControle de Estoque Geral.\n## RAAM\nRelatório de Avaliação de Armazenamento.\n## FM-LAB-032\nOrganização do almoxarifado.\n## FM-LAB-083\nControle de descarte." }),
  ...FIM("Cada coisa no lugar, na validade e registrada.", "CAM · CEG · RAAM · Vermelha · Amarela"),
];

// ------------------------------------------------------------ POP-AM-001 (+ PL AM-001, POP-AM-006)
const AMOSTRAGEM = () => [
  S("capa", { titulo: "Amostragem com Garantia da Validade", subtitulo: "POP-AM-001 rev. 04 · PL AM-001 · POP-AM-006 · ISO/IEC 17025 (7.3)", texto: "Coleta padronizada, rastreável e representativa: frascos, preservação, brancos, duplicatas e registros de campo.", destaque: "Frasco · Preservação · < 6 °C · Brancos · Duplicata · Registro" }, "Abertura: o resultado mais caro do laboratório não salva uma amostra mal coletada."),
  S("frase", { titulo: "Por que isso importa", frase: "A amostra é o resultado. Se ela não representa o ponto, nada depois conserta.", texto: "A ISO/IEC 17025 (7.3) e a NIT-DICLA-57 exigem plano de amostragem, controles e registro de tudo o que acontece em campo." }),
  S("colunas", { titulo: "Quem faz o quê", itens: "## Amostrador\n- Executa os controles do plano de amostragem\n- Registra na hora qualquer desvio ou branco não feito\n- Garante preservação, temperatura e transporte\n## Responsável técnico\n- Aprova o plano de amostragem\n- Avalia os brancos e aceita ou rejeita amostras\n- Abre e trata NC quando aplicável" }),
  S("fluxo", { titulo: "Antes de sair", itens: "Frascos limpos | POP de lavagem\nSeparação | Cadeia de custódia e etiquetas do comercial\nPreservação | Conforme FORPRES 001\nCaixas | Limpas e separadas por uso\nEPIs e material | Tudo no carro!" }),
  S("tabela", { titulo: "Controles de amostragem (PL AM-001)", itens: "Controle | Frequência mínima | Para quê\nBranco de viagem | 1 por dia de coleta | VOCs e microbiologia\nBranco de equipamento | 1 por equipamento/dia | Bailer, balde, frasco de transposição\nBranco de campo | 1 por ponto ou por campanha | Todas as matrizes\nBranco de amostragem | Substitui campo + equipamento | Quando aplicável\nDuplicata de campo | 1 a cada 10 pontos | Avaliar precisão\nBranco de temperatura | 1 por caixa térmica | Avaliar refrigeração" }, "Mostre um exemplo de cada branco montado de verdade, se possível."),
  S("colunas", { titulo: "Como fazer cada controle", itens: "## Branco de viagem\nÁgua reagente preparada no laboratório, viaja com as amostras. Identificar BV-dia/mês/ano-OS.\n## Branco de equipamento\nÚltimo enxágue do equipamento com água reagente, coletado no frasco do parâmetro.\n## Branco de campo\nÁgua reagente exposta no local pelo mesmo tempo da coleta, preservada como a amostra.\n## Duplicata de campo\nDuas amostras do mesmo ponto (R1 e R2), direto do ponto, nunca do mesmo frasco.\n## Branco de temperatura\nFrasco com água em cada caixa; temperatura medida na chegada." }),
  S("numero", { titulo: "Critérios de aceitação", numero: "≤ 6 °C", rotulo: "temperatura na chegada ao laboratório", texto: "Brancos: resultado ≤ ½ LQ (ou conforme o método).\nDuplicatas: DPR ≤ 20% (ou conforme o método).\nFora do critério, branco não feito, preservação errada ou frasco violado: registrar não conformidade." }),
  S("colunas", { titulo: "Na hora da coleta", itens: "## Ordem\nMicrobiologia primeiro, depois físico-químicos.\n## Torneiras\nDrenar 1 a 2 minutos. Não tocar na boca do frasco.\n## Superficial\nBoca contra a corrente, 15 a 30 cm abaixo da superfície.\n## Espaço\nDeixar cerca de 2 cm vazios no topo.\n## Em campo\nCloro, pH, OD e temperatura em até 15 minutos.\n## Micro\nÁlcool 70%, frasco estéril e laboratório em até 24 h." }),
  S("topicos", { titulo: "Coleta composta: a conta", texto: "Coleta de 12 horas, uma retirada a cada 1h30 = 8 retiradas\nFrasco de 1.000 mL ÷ 8 = 125 mL por retirada\nUse recipiente graduado e mantenha refrigerado entre as retiradas", destaque: "Volume por retirada = volume do frasco ÷ número de retiradas." }),
  S("colunas", { titulo: "Aspecto da amostra (POP-AM-006)", itens: "## Materiais sedimentáveis\nPartículas que depositam no fundo após repouso.\n## Materiais flutuantes\nO que fica na superfície.\n## Óleos e graxas (visual)\nFilme iridescente, manchas, camada oleosa.\n## Resíduos sólidos objetáveis\nPlásticos, fibras, detritos.", destaque: "Registre presença ou ausência de cada um no aplicativo de coletas, com boa iluminação." }),
  S("fluxo", { titulo: "Aplicativo de coletas", itens: "Abertas | Selecione a OS\nPlano de amostragem | Registre e salve\nAmostra | Lance e conclua\nSincronizar | O laboratório recebe os dados" , destaque: "Registre também condições ambientais: chuva no momento ou 48 h antes, ponto seco, vazão insuficiente." }),
  S("quiz", { titulo: "Quiz", texto: "No mesmo ponto você vai coletar microbiologia e físico-químicos. Qual a ordem?", itens: "Físico-químicos primeiro\n* Microbiologia primeiro\nTanto faz", destaque: "POP-AM-001 (7.1.8): microbiologia primeiro, depois os frascos de físico-químicos." }),
  S("quiz", { titulo: "Quiz", texto: "Você tem 20 pontos de coleta na campanha. Quantas duplicatas de campo, no mínimo?", itens: "1\n* 2\n20", destaque: "Duplicata de campo: 1 a cada 10 pontos (ou conforme o plano). 20 pontos = 2 duplicatas." }),
  S("quiz", { titulo: "Caso real", texto: "O branco de temperatura chegou ao laboratório a 9 °C. O que fazer?", itens: "Nada, o laboratório é perto\n* Registrar não conformidade; o RT avalia o impacto, rejeição ou recoleta, e o cliente é comunicado\nColocar mais gelo e medir de novo", destaque: "Critério: ≤ 6 °C na chegada. Temperatura inadequada é NC, com avaliação técnica e comunicação formal ao cliente." }),
  S("quiz", { titulo: "Quiz", texto: "Coleta composta de 12 h, uma retirada a cada 1h30, frasco de 1.000 mL. Quanto coletar por vez?", itens: "100 mL\n* 125 mL\n250 mL", destaque: "12 h ÷ 1h30 = 8 retiradas. 1.000 mL ÷ 8 = 125 mL." }),
  S("quiz", { titulo: "Quiz", texto: "Duplicata de campo: como coletar R1 e R2?", itens: "Encher um frasco e dividir em dois\n* Coletar as duas direto do ponto de amostragem\nColetar R2 no dia seguinte", destaque: "Não colete as duas do mesmo frasco: as duas saem direto do ponto e vão como amostras cegas." }),
  S("colunas", { titulo: "Documentos relacionados", itens: "## POP-AM-001\nAmostragem (rev. 04).\n## PL AM-001\nPlanejamento da amostragem.\n## POP-AM-006\nAspecto das amostras.\n## FORPRES 001\nPreservação de frascos.\n## Referências\nSMWW 1060 e 9060 · Guia CETESB 2023 · NIT-DICLA-57." }),
  ...FIM("Amostra representativa, preservada e registrada.", "Frasco · Preservação · Brancos · Registro"),
];

// ------------------------------------------------------------ POP-AM-002, 003 e 004
const COLETAS_ESPECIAIS = () => [
  S("capa", { titulo: "Coletas Especiais", subtitulo: "POP-AM-002 Altura · POP-AM-003 Vazão · POP-AM-004 Solo", texto: "Segurança no trabalho em altura, cálculo de vazão em campo e amostragem de solo.", destaque: "NR-35 · PT · Q = v × h × w · Gleba · Amostra composta" }, "Abertura: pergunte quem já fez coleta em altura, mediu vazão ou coletou solo, e o que foi mais difícil."),
  S("aviso", { titulo: "Trabalho em altura (POP-AM-002)", texto: "Acima de 2 m do nível inferior, com risco de queda, é trabalho em altura (NR-35).\nNunca saia para a coleta sem os EPIs obrigatórios.", destaque: "Mínimo de 2 coletores · Só começa com a PT (Permissão de Trabalho) liberada pela empresa" }),
  S("colunas", { titulo: "EPIs e materiais para altura", itens: "## Proteção\n- Capacete, óculos, botas, luvas\n- Calça de tecido grosso\n- Colete refletivo\n## Contra queda\n- Cinto tipo paraquedista\n- Talabarte e trava-queda\n- Cordas\n## Coleta\n- Frascos e coletor inox\n- Termômetro, oxímetro se preciso" }),
  S("fluxo", { titulo: "Passo a passo em altura", itens: "Conferir EPIs | Antes de sair, condição de uso\nPT liberada | Sem PT, não começa!\nParamentar | Os dois coletores\nUm desce | Com frascos na bolsa\nUm em prontidão | Apoia de cima\nSubir com segurança | E levar ao laboratório" }),
  S("topicos", { titulo: "Vazão em canal (POP-AM-003, método A)", texto: "Largura (w): trena de margem a margem. Ex.: 3,50 m\nProfundidade média (h): várias medidas na seção. Ex.: (0,40 + 0,85 + 0,70 + 0,30) ÷ 4 = 0,73 m\nVelocidade (v): flutuador numa pista de 2 m, média de 3 tempos. Ex.: 2 m ÷ 13 s = 0,15 m/s\nQ = v × h × w = 0,15 × 0,73 × 3,50 = 0,383 m³/s", destaque: "0,383 m³/s = 383 litros por segundo passando no trecho." }),
  S("numero", { titulo: "Vazão com balde (método B)", numero: "Q = V ÷ t", rotulo: "volume (m³) dividido pelo tempo (s)", texto: "Encha um balde de volume conhecido e cronometre.\nPara passar litros para m³, divida por 1.000." }),
  S("colunas", { titulo: "Solo (POP-AM-004)", itens: "## Profundidades\n0–20 e 20–40 cm, ou 0–25 e 25–50 cm.\n## Glebas\nDivida o terreno em glebas de até 20 hectares, homogêneas (cor, uso, cultivo, umidade).\n## Amostra composta\nNo mínimo 15 amostras simples por gleba, bem misturadas.\n## Quantidade\nCerca de 500 g em saco plástico limpo, identificado." }),
  S("topicos", { titulo: "Solo: cuidados", texto: "Retire detritos e restos de cultura do ponto antes de tradar\nFerramentas e baldes limpos, sem resíduo de calcário ou fertilizante\nMicronutrientes: trado de aço e nada de balde galvanizado\nEvite cupins, formigueiros, casas, estradas, currais, adubo e manchas de solo\nMicrobiologia: instrumento estéril, refrigerado e no laboratório em até 24 h" }),
  S("quiz", { titulo: "Caso real", texto: "Coleta num reservatório a 6 m de altura. A PT ainda não foi liberada, mas o cliente pede para adiantar. O que fazer?", itens: "Começar, a PT sai daqui a pouco\nSubir sozinho para ganhar tempo\n* Aguardar a PT e só começar com os dois coletores paramentados", destaque: "POP-AM-002: o início só é permitido com a PT liberada e com no mínimo dois coletores." }),
  S("quiz", { titulo: "Quiz", texto: "Um balde de 10 L encheu em 20 segundos. Qual a vazão?", itens: "2 L/s\n* 0,5 L/s (0,0005 m³/s)\n200 L/s", destaque: "Q = V ÷ t = 10 L ÷ 20 s = 0,5 L/s. Dividindo por 1.000: 0,0005 m³/s." }),
  S("quiz", { titulo: "Quiz", texto: "Quantas amostras simples, no mínimo, formam uma amostra composta de solo?", itens: "3\n5\n* 15", destaque: "POP-AM-004: pelo menos 15 amostras simples por amostra composta." }),
  S("quiz", { titulo: "Quiz", texto: "O cliente quer micronutrientes no solo. Que material evitar?", itens: "Trado de aço\n* Balde de metal galvanizado\nSaco plástico limpo", destaque: "Para micronutrientes: trado de aço e nada de balde galvanizado, que contamina a amostra com zinco." }),
  S("colunas", { titulo: "Documentos relacionados", itens: "## POP-AM-002\nAmostragem em altura · NR-35.\n## POP-AM-003\nDeterminação de vazão.\n## POP-AM-004\nAmostragem em solo · Embrapa 2006." }),
  ...FIM("Segurança primeiro, medida certa e amostra representativa.", "NR-35 · PT · Vazão · Solo"),
];

// ------------------------------------------------------------ POP-AM-005
const PURGA = () => [
  S("capa", { titulo: "Água Subterrânea: Purga de Baixa Vazão", subtitulo: "POP-AM-005 · ABNT NBR 15847:2010", texto: "Como purgar e amostrar poços de monitoramento sem rebaixar o nível e sem perder a representatividade.", destaque: "Nível estático · Bomba bexiga · 0,1 a 1 L/min · Estabilização · Coleta" }, "Abertura: por que não basta “tirar água do poço”? Porque a água parada no poço não é a água do aquífero."),
  S("frase", { titulo: "A ideia da purga", frase: "Primeiro estabiliza o nível; depois os parâmetros. Só então coleta.", texto: "A purga renova a água do poço numa vazão próxima à capacidade dele, com mínimo rebaixamento, pouca volatilização e pouco sólido em suspensão." }),
  S("colunas", { titulo: "Material de campo", itens: "## Bombeamento\n- Bomba de bexiga inox e bexigas\n- Controlador e compressor/cilindro\n- Mangueiras de teflon ou polietileno\n## Medição\n- Medidor de NA ou de interface\n- Multiparâmetro e célula de fluxo\n- Cronômetro, proveta\n## Registro e proteção\n- FM-LAB-050 (planilha do poço)\n- Luvas de nitrila e EPIs" , destaque: "Instrumentos calibrados e sempre na sombra." }),
  S("fluxo", { titulo: "Preparação", itens: "Área limpa | Espaço amplo em volta do poço\nCondições do poço | Limpeza e integridade\nNível estático | Probe com toques repetidos\nAnotar | FM-LAB-050, na hora" }),
  S("colunas", { titulo: "Montagem", itens: "## Bomba bexiga\nInsira a bexiga descartável e as mangueiras. Atenção: trocar as saídas de ar danifica o equipamento!\n## Posição\nNa metade da seção filtrante, descendo devagar para não ressuspender partículas.\n## Ponto de controle\nMedidor de NA 20 cm acima do nível estático, com sinal invertido: apita se o nível baixar até ali.\n## Nível de novo\nMeça o nível estático com a bomba dentro (fica maior)." }),
  S("numero", { titulo: "Rebaixamento máximo", numero: "25 cm", rotulo: "do nível estático (seção filtrante plena)", texto: "Nunca purgar o poço até secar.\nFiltro afogado: o nível deve ficar acima do topo do filtro ou, no máximo, 25 cm abaixo dele.\nRebaixou demais? Aumente o tempo de carga e diminua o de descarga no controlador." }),
  S("topicos", { titulo: "Vazões que você precisa lembrar", texto: "Purga de baixa vazão: entre 0,1 e 1,0 L/min\nComeço da purga do sistema: no máximo 300 mL/min\nEnchimento dos frascos: ≤ vazão de purga\nNunca acima de 250 mL/min para orgânicos e 500 mL/min para inorgânicos" }),
  S("tabela", { titulo: "Estabilização: 3 leituras seguidas dentro da faixa", itens: "Parâmetro | Variação aceita\nTemperatura | ± 0,5 °C\npH | ± 0,2 unidade\nCondutividade | ± 5% das leituras\nOxigênio dissolvido | ± 10% ou ± 0,2 mg/L (o maior)\nPotencial redox | ± 20 mV", destaque: "Condutividade e OD são os mais confiáveis; o OD é o mais conservador." }),
  S("topicos", { titulo: "Intervalo entre leituras", texto: "Tempo para renovar 1 volume da célula de fluxo, ou 3 minutos, o que for MAIOR\nCélula de 500 mL a 250 mL/min renova em 2 min → leia a cada 3 min\nCélula de 500 mL a 100 mL/min renova em 5 min → leia a cada 5 min", destaque: "Na planilha: hora, nível, temperatura, condutividade, ORP, OD, pH e vazão de cada leitura." }),
  S("topicos", { titulo: "Coleta", texto: "Com nível e parâmetros estáveis, desconecte a célula de fluxo\nColete durante a transferência: a mangueira não encosta dentro do frasco\nLuvas de nitrila durante toda a amostragem\nAnote o horário de término, o volume de purga e as últimas leituras" }),
  S("quiz", { titulo: "Quiz", texto: "Onde a bomba bexiga deve ficar dentro do poço?", itens: "Encostada no fundo\nLogo abaixo do nível da água\n* Na metade da seção filtrante", destaque: "POP-AM-005: bomba instalada na metade da seção filtrante, descida devagar." }),
  S("quiz", { titulo: "Quiz", texto: "Célula de fluxo de 500 mL, purga a 250 mL/min. De quanto em quanto tempo ler os parâmetros?", itens: "A cada 2 minutos\n* A cada 3 minutos\nA cada 10 minutos", destaque: "Renova em 2 min, mas o mínimo é 3 min: vale o maior." }),
  S("quiz", { titulo: "Caso real", texto: "Os parâmetros estabilizaram, mas o nível d'água continua caindo. Pode coletar?", itens: "Sim, os parâmetros é que importam\n* Não: primeiro o nível estabiliza, depois os parâmetros; ajuste a vazão e o intervalo de leitura\nSim, se o cliente estiver com pressa", destaque: "Parâmetro estável antes do nível indica intervalo de leitura mal programado (comum em poços com vazão ≤ 200 mL/min)." }),
  S("quiz", { titulo: "Quiz", texto: "Qual a vazão máxima para encher frascos de compostos orgânicos?", itens: "500 mL/min\n* 250 mL/min\n1 L/min", destaque: "Enchimento ≤ vazão de purga e nunca acima de 250 mL/min (orgânicos) ou 500 mL/min (inorgânicos)." }),
  S("colunas", { titulo: "Documentos relacionados", itens: "## POP-AM-005\nAmostragem por método de purga.\n## ABNT NBR 15847:2010\nAmostragem de água subterrânea em poços de monitoramento.\n## FM-LAB-050\nPlanilha de amostragem de poço de monitoramento." }),
  ...FIM("Nível estável, parâmetros estáveis, amostra representativa.", "Baixa vazão · 25 cm · 3 leituras · Coleta"),
];

const T = (setor) => ({ categoria: "treinamento", setor, tema: "colorido" });
export const MODELOS_PG = [
  { id: "pg012-satisfacao", ...T("comercial"), nome: "Satisfação do cliente (PG 012)", desc: "Pesquisa semestral, pesos dos itens, meta de 85%, retorno abaixo de 10% e tratativa de notas baixas. Com quiz.", titulo: "Satisfação do Cliente · PG 012", slides: PG012 },
  { id: "pg013-reclamacoes", ...T("comercial"), nome: "Tratamento de reclamações (PG 013)", desc: "RRC, imparcialidade, classificação, causa raiz, PG 014, resposta e encerramento. Com quiz.", titulo: "Tratamento de Reclamações · PG 013", slides: PG013 },
  { id: "pg010-recebimento", ...T("laboratorio"), nome: "Inspeção de recebimento (PG 010)", desc: "LISIR, IR, RIS, calibração acreditada, pré-teste de lote e investigação de insumo. Com quiz.", titulo: "Inspeção de Recebimento · PG 010", slides: PG010 },
  { id: "pg011-armazenamento", ...T("laboratorio"), nome: "Armazenamento de materiais (PG 011)", desc: "CAM, CEG, RAAM, etiquetas vermelha e amarela e descarte. Com quiz.", titulo: "Armazenamento de Materiais · PG 011", slides: PG011 },
  { id: "am-amostragem", ...T("laboratorio"), nome: "Amostragem e controles de campo (POP-AM-001)", desc: "Frascos, preservação, brancos, duplicatas, critérios de aceitação, coleta composta, aspecto (POP-AM-006) e aplicativo. Com quiz.", titulo: "Amostragem · POP-AM-001", slides: AMOSTRAGEM },
  { id: "am-coletas-especiais", ...T("laboratorio"), nome: "Coletas especiais: altura, vazão e solo", desc: "POP-AM-002 (NR-35 e PT), POP-AM-003 (cálculo de vazão) e POP-AM-004 (solo). Com quiz.", titulo: "Coletas Especiais · POP-AM-002, 003 e 004", slides: COLETAS_ESPECIAIS },
  { id: "am-purga", ...T("laboratorio"), nome: "Água subterrânea: purga de baixa vazão (POP-AM-005)", desc: "Montagem da bomba bexiga, rebaixamento, estabilização dos parâmetros e coleta (NBR 15847). Com quiz.", titulo: "Purga de Baixa Vazão · POP-AM-005", slides: PURGA },
];

// ------------------------------------------------------------ trilhas
/** Teste da trilha a partir dos quizzes do modelo (a certa vem marcada com *). */
export function perguntasDoModelo(fabrica) {
  return fabrica().filter((s) => s.layout === "quiz").map((s) => {
    const ops = String(s.itens).split("\n").map((x) => x.trim()).filter(Boolean);
    return { p: s.texto, opcoes: ops.map((o) => o.replace(/^\*\s*/, "")), certa: ops.findIndex((o) => o.startsWith("*")) };
  });
}
const roteiro = (abertura, min = 40) => {
  const a = Math.round(min * 0.45), b = Math.round(min * 0.7);
  return [
    { min: "0–5", passo: abertura },
    { min: `5–${a}`, passo: "Apresentação colorida: regras do documento, fluxo e registros." },
    { min: `${a}–${b}`, passo: "Quizzes em grupo: a turma vota em cada caso antes de você revelar a resposta." },
    { min: `${b}–${min}`, passo: "Exercício prático e teste individual. Registre as notas em Registrar aplicação." },
  ];
};

export const TRILHAS_PG = [
  {
    id: "pg012-satisfacao", setores: ["comercial"], tema: "atendimento", modelo: "pg012-satisfacao", minutos: 40,
    nome: "Satisfação do cliente (PG 012)", publico: "Comercial e atendimento",
    objetivo: "Aplicar a pesquisa de satisfação do PG 012: envio semestral, retorno mínimo, cálculo com pesos, meta de 85% e tratativa das notas ruins e regulares.",
    gatilho: "nps", indicador: "Satisfação geral (meta: 85%) e clientes com nota baixa",
    slides: ["Pesquisa semestral para os clientes que enviaram amostras no semestre.", "Pesos: qualidade 3; prazos e relatórios 2; demais 1.", "Graus 1 a 4 = 25%, 50%, 75%, 100%. Meta geral: 85%.", "Retorno abaixo de 10%: retroalimentar.", "Ruim ou regular procedente: NC ou justificativa registrada."],
    roteiro: roteiro("Abertura: qual foi o último elogio e a última reclamação que cada um ouviu? Mostre as notas recentes de satisfação (sem expor clientes).", 40),
    exercicio: "Com as respostas da última pesquisa (ou de Clientes › Satisfação), calcule a média ponderada de um cliente e diga qual ação o Comercial tomaria para o item com pior nota.",
    perguntas: perguntasDoModelo(PG012),
  },
  {
    id: "pg013-reclamacoes", setores: ["comercial", "laboratorio"], tema: "qualidade", modelo: "pg013-reclamacoes", minutos: 40,
    nome: "Tratamento de reclamações (PG 013)", publico: "Comercial, administrativo, gerência e laboratório",
    objetivo: "Toda reclamação, formal ou informal, registrada no RRC, analisada por quem não participou do serviço, tratada pela causa raiz e encerrada com o cliente informado.",
    gatilho: "ocorrencia:Atendimento", indicador: "Ocorrências do tipo “Atendimento” e reclamações em aberto",
    slides: ["Toda reclamação, formal ou informal, vai para o RRC.", "Imparcial: analisada por quem não participou do serviço.", "Classificação crítica, alta, média ou baixa; crítica pede ação imediata.", "Causa raiz (5 porquês, Ishikawa) e ação corretiva pelo PG 014.", "Resposta clara, técnica, com evidência e rastreável; só encerra com tudo registrado."],
    roteiro: roteiro("Abertura: lembre que a rev. 03 do PG 013 nasceu de uma não conformidade de auditoria. Pergunte como cada um recebe uma reclamação hoje.", 40),
    exercicio: "Em dupla, preencham um RRC fictício a partir de um caso real anonimizado: protocolo, classificação, quem analisa (não envolvido), causa raiz com 5 porquês e a resposta ao cliente.",
    perguntas: perguntasDoModelo(PG013),
  },
  {
    id: "pg010-recebimento", setores: ["laboratorio", "comercial"], tema: "qualidade", modelo: "pg010-recebimento", minutos: 30,
    nome: "Inspeção de recebimento (PG 010)", publico: "Laboratório, recepção, almoxarifado e administrativo (recebimento e compras)",
    objetivo: "Nenhum insumo crítico ou serviço (como calibração) é usado sem inspeção registrada no IR ou no RIS, com verificação do lote na bancada.",
    gatilho: "ocorrencia:Não conformidade POP", indicador: "Ocorrências “Não conformidade POP” ligadas a insumos e calibração",
    slides: ["Itens inspecionados: LISIR.", "Insumo: formulário IR assim que recebido, antes de usar.", "Serviço: RIS; calibração só com provedor acreditado ISO/IEC 17025 e FM-LAB-019.", "Bancada: pré-teste ou primeiro uso de cada lote crítico.", "Problema no insumo: repetir com o mesmo; persistiu, outro lote ou fabricante."],
    roteiro: roteiro("Abertura: mostre um certificado de calibração e peça para encontrarem o logotipo do organismo de acreditação.", 30),
    exercicio: "Cada pessoa faz a inspeção de recebimento de um insumo real do estoque no formulário IR, e o grupo confere um certificado de calibração contra a FM-LAB-019.",
    perguntas: perguntasDoModelo(PG010),
  },
  {
    id: "pg011-armazenamento", setores: ["laboratorio", "comercial"], tema: "qualidade", modelo: "pg011-armazenamento", minutos: 30,
    nome: "Armazenamento de materiais (PG 011)", publico: "Laboratório, recepção de amostras, almoxarifado e administrativo",
    objetivo: "Materiais armazenados conforme o CAM, estoque lançado no CEG a cada movimento, validade sinalizada por etiqueta e descarte registrado.",
    gatilho: "ocorrencia:Não conformidade POP", indicador: "Itens vencidos encontrados nas inspeções e ocorrências “Não conformidade POP”",
    slides: ["CAM: onde e como guardar (anual ou quando mudar).", "CEG: toda entrada e saída, na hora.", "RAAM: situação dos reagentes (trimestral).", "Etiqueta vermelha = vence no mês; amarela = até seis meses.", "Descarte no FM-LAB-083; resíduos por empresa especializada."],
    roteiro: roteiro("Abertura: leve frascos com etiqueta vermelha e amarela e pergunte o que cada cor significa.", 30),
    exercicio: "Em dupla, façam uma inspeção rápida de uma prateleira do almoxarifado: confiram etiquetas, validade e o lançamento no CEG, e registrem o que precisa de ação.",
    perguntas: perguntasDoModelo(PG011),
  },
  {
    id: "am-amostragem", setores: ["laboratorio", "comercial"], tema: "amostragem", modelo: "am-amostragem", minutos: 45,
    nome: "Amostragem e controles de campo (POP-AM-001)", publico: "Coletores, responsável técnico e comercial (cadeia de custódia e orientação de coleta)",
    objetivo: "Coletas padronizadas e rastreáveis, com os brancos e duplicatas do plano executados, temperatura ≤ 6 °C na chegada e tudo registrado no aplicativo.",
    gatilho: "ocorrencia:Não conformidade POP", indicador: "NC de amostragem (temperatura, preservação, brancos não feitos)",
    slides: ["Frascos limpos, preservação pelo FORPRES 001 e cadeia de custódia do comercial.", "Controles: branco de viagem, equipamento, campo, amostragem, duplicata (1 a cada 10) e temperatura (1 por caixa).", "Aceitação: brancos ≤ ½ LQ, DPR ≤ 20%, ≤ 6 °C na chegada.", "Micro primeiro; parâmetros de campo em até 15 min; micro no laboratório em até 24 h.", "Aspecto (POP-AM-006) e registro no aplicativo de coletas."],
    roteiro: roteiro("Abertura: monte na mesa um kit de coleta e pergunte o que falta para a coleta ser válida (brancos, gelo, etiquetas).", 45),
    exercicio: "Planejem uma campanha fictícia de 12 pontos com microbiologia e metais: quais controles, quantos de cada, ordem da coleta e o que registrar no aplicativo.",
    perguntas: perguntasDoModelo(AMOSTRAGEM),
  },
  {
    id: "am-coletas-especiais", setores: ["laboratorio"], tema: "amostragem", modelo: "am-coletas-especiais", minutos: 40,
    nome: "Coletas especiais: altura, vazão e solo", publico: "Amostragem (coletores)",
    objetivo: "Coleta em altura só com PT e dois coletores, vazão calculada corretamente em campo e amostras de solo compostas e representativas.",
    gatilho: "ocorrencia:Não conformidade POP", indicador: "Ocorrências em coletas de altura, vazão e solo",
    slides: ["Altura (> 2 m): NR-35, EPIs, PT liberada e mínimo de 2 coletores.", "Vazão em canal: Q = v × h × w.", "Vazão com balde: Q = V ÷ t (litros ÷ 1.000 = m³).", "Solo: glebas de até 20 ha, 15 simples por composta, 0–20 e 20–40 cm, ~500 g.", "Micronutrientes: trado de aço, sem balde galvanizado."],
    roteiro: roteiro("Abertura: confira um kit de EPI de altura com a turma, item por item.", 40),
    exercicio: "Com trena, cronômetro e balde, calculem a vazão de uma torneira (método B) e, com dados fictícios de um córrego, a vazão pelo método A.",
    perguntas: perguntasDoModelo(COLETAS_ESPECIAIS),
  },
  {
    id: "am-purga", setores: ["laboratorio"], tema: "amostragem", modelo: "am-purga", minutos: 45,
    nome: "Água subterrânea: purga de baixa vazão (POP-AM-005)", publico: "Amostragem (coletores) e responsável técnico",
    objetivo: "Purga com rebaixamento controlado (até 25 cm), parâmetros estabilizados em 3 leituras e coleta na vazão certa, tudo registrado na FM-LAB-050.",
    gatilho: "ocorrencia:Não conformidade POP", indicador: "Ocorrências em amostragem de água subterrânea",
    slides: ["Nível estático com probe e anotação na FM-LAB-050.", "Bomba bexiga na metade da seção filtrante; ponto de controle 20 cm acima do nível.", "Baixa vazão 0,1 a 1 L/min; rebaixamento máximo 25 cm.", "Estabilização: 3 leituras seguidas dentro da faixa; intervalo = maior entre 3 min e a renovação da célula.", "Enchimento ≤ vazão de purga; máx. 250 mL/min orgânicos e 500 mL/min inorgânicos."],
    roteiro: roteiro("Abertura: desenhe um poço no quadro (nível estático, seção filtrante) e peça para indicarem onde vai a bomba.", 45),
    exercicio: "Com uma planilha FM-LAB-050 preenchida com leituras fictícias, cada um indica quando a purga estabilizou e qual o intervalo de leitura correto.",
    perguntas: perguntasDoModelo(PURGA),
  },
];
