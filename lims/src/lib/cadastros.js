// Cadastros de Configurações, um por tela do GerenciaLab (mesmas colunas e
// campos, conferidos na instância da MinasLab em 04/11/2026). O motor em
// components/Cadastro.jsx desenha lista + janela de adicionar/editar a partir
// daqui. Coleção = nome no servidor (ml_lims_registros.colecao).
//
// Campo: { c: chave, r: rótulo, t: tipo, obrig?, op?, ref?, larg?, padrao?, dica? }
// Tipos: text · textarea · number · date · color · email · senha (só escrita)
//   · select (op) · simnao · ativo (Ativo/Inativo) · ref (outro cadastro)
//   · refmulti (vários de outro cadastro) · conta (usuário do painel)
//   · precos (valor por parâmetro) · limites (VMP por parâmetro)

export const SIM_NAO = ["Sim", "Não"];
export const TIPOS_CAMPO = ["Texto", "Numero", "Data", "Data e Hora", "SelectBox", "RadioBox", "CheckBox", "Calculo"];
export const GRUPOS_PADRAO = ["Água", "Efluente", "Alimento", "Solo", "Resíduo Sólido", "Adicionais", "Ar", "Controle de qualidade"];

const nome = (c = "nome", r = "Nome") => ({ c, r, t: "text", obrig: true, larg: "s6" });
const ativoSimNao = (r = "Ativo") => ({ c: "ativo", r, t: "simnao", padrao: "Sim", larg: "s3" });
const status = (r = "Status") => ({ c: "status", r, t: "ativo", padrao: "Ativo", larg: "s3" });
const campoDinamico = (extra = []) => [
  ...extra,
  { c: "titulo", r: "Título", t: "text", obrig: true, larg: "s6" },
  { c: "tipo", r: "Tipo", t: "select", op: TIPOS_CAMPO, padrao: "Texto", larg: "s3" },
  { c: "celula", r: "Célula", t: "text", larg: "s3", dica: "Referência da célula na planilha de cálculo, se houver." },
  { c: "valores", r: "Valores", t: "text", larg: "s6", dica: "SelectBox e RadioBox: separe as opções por ; (ponto e vírgula)." },
  { c: "ordem", r: "Ordem de exibição", t: "number", larg: "s3" },
  ativoSimNao(),
];

// ref: { colecao, rotulo: campo ou função, vazio?: texto da opção "nenhum" }
// filtroPor: [campo deste formulário, campo do registro referenciado] — ex.:
// a Matriz só lista as do Grupo escolhido.
function ref(c, r, colecao, rotulo = "nome", extra = {}) {
  const { ref: rx, ...resto } = extra;
  return { c, r, t: "ref", larg: "s4", ...resto, ref: { colecao, rotulo, ...(rx || {}) } };
}

export const CADASTROS = {
  /* ---------- Configurações (gerais) ---------- */
  employees: { titulo: "Funcionários", secoes: [{
    colecao: "funcionarios", botao: "Adicionar funcionário", janela: "Funcionário",
    colunas: ["nome", "cargo", "setor", "usuario", "status"],
    campos: [nome(), { c: "cargo", r: "Cargo", t: "text", larg: "s6" }, { c: "email", r: "E-mail", t: "email", larg: "s6" }, { c: "telefone", r: "Telefone", t: "text", larg: "s3" },
      ref("setor", "Setor", "setores", "nome", { larg: "s3" }), { c: "usuario", r: "Usuário do painel", t: "conta", larg: "s4", dica: "Liga o funcionário à conta de login do painel (assinaturas, revisão, permissões)." },
      { c: "revisor", r: "Revisor de resultados", t: "simnao", padrao: "Não", larg: "s4" }, { c: "signatario", r: "Signatário de certificado", t: "simnao", padrao: "Não", larg: "s4" }, status()],
  }] },
  "configuracao-plano-amostragem": { titulo: "Plano de Amostragem", secoes: [{
    colecao: "plano_amostragem", botao: "Adicionar", janela: "Campo do plano de amostragem",
    colunas: ["titulo", "tipo", "valores", "ordem", "resultadoFinal", "ativo"],
    campos: campoDinamico([{ c: "resultadoFinal", r: "Resultado final", t: "select", op: ["Condições ambientais", "Dados da coleta", "Nenhum"], padrao: "Nenhum", larg: "s6" }]),
  }] },
  "configuracao-coleta": { titulo: "Coleta", secoes: [{
    colecao: "campos_coleta", botao: "Adicionar", janela: "Campo da ficha de coleta",
    colunas: ["grupo", "titulo", "tipo", "valores", "ordem", "ativo"],
    campos: campoDinamico([ref("grupo", "Grupo", "grupos_servico", "nome", { larg: "s6", ref: { vazio: "Todos" } })]),
  }] },
  "configuracao-proposta": { titulo: "Proposta", subtitulo: "Condições de pagamento oferecidas na proposta.", secoes: [{
    colecao: "condicoes_pagamento", botao: "Adicionar forma de pagamento", janela: "Condição de pagamento",
    colunas: ["descricao"], campos: [{ c: "descricao", r: "Descrição", t: "text", obrig: true, larg: "s12" }],
  }] },
  "configuracao-proposta-analise-critica": { titulo: "Proposta Análises Críticas", subtitulo: "Perguntas da análise crítica do pedido (ISO/IEC 17025 7.1), respondidas em cada proposta.", secoes: [{
    colecao: "analise_critica_itens", botao: "Adicionar pergunta", janela: "Pergunta da análise crítica",
    colunas: ["pergunta", "resposta", "obrigatoria", "ordem", "ativo"],
    campos: [{ c: "pergunta", r: "Pergunta", t: "text", obrig: true, larg: "s12" }, { c: "resposta", r: "Tipo de resposta", t: "select", op: ["Sim/Não", "Sim/Não/Não se aplica", "Texto"], padrao: "Sim/Não", larg: "s4" },
      { c: "obrigatoria", r: "Obrigatória", t: "simnao", padrao: "Sim", larg: "s3" }, { c: "ordem", r: "Ordem", t: "number", larg: "s2" }, ativoSimNao()],
  }] },
  servicearea: { titulo: "Áreas de Serviço", secoes: [{ colecao: "areas_servico", botao: "Adicionar", janela: "Área de serviço", colunas: ["nome", "ativo"], campos: [nome(), ativoSimNao()] }] },
  "configuracao-unidade-de-medida": { titulo: "Unidade de medida", secoes: [{
    colecao: "unidades", botao: "Adicionar", janela: "Unidade de medida", colunas: ["sigla", "descricao"],
    campos: [{ c: "sigla", r: "Sigla", t: "text", obrig: true, larg: "s3", unico: true }, { c: "descricao", r: "Descrição", t: "text", larg: "s9" }],
  }] },
  "configuracao-inspecao-tecnica": { titulo: "Inspeção técnica", subtitulo: "Campos do protocolo de inspeção no recebimento da amostra (ISO/IEC 17025 7.4).", secoes: [{
    colecao: "campos_inspecao", botao: "Adicionar", janela: "Campo da inspeção técnica", colunas: ["titulo", "tipo", "valores", "ordem", "ativo"], campos: campoDinamico(),
  }] },
  equipamentos: { titulo: "Controle de Equipamentos", subtitulo: "Calibração e validade dos equipamentos (ISO/IEC 17025 6.4 e 6.5).", secoes: [{
    colecao: "equipamentos", botao: "Adicionar equipamento", janela: "Equipamento",
    colunas: ["equipamento", "codigo", "local", "periodicidade", "ultimaCalibracao", "_validade", "certificado", "emUso"],
    campos: [{ c: "equipamento", r: "Equipamento", t: "text", obrig: true, larg: "s6" }, { c: "codigo", r: "Código interno", t: "text", larg: "s3", unico: true }, { c: "local", r: "Local", t: "text", larg: "s3" },
      { c: "periodicidade", r: "Periodicidade (meses)", t: "number", larg: "s3" }, { c: "ultimaCalibracao", r: "Data da última calibração", t: "date", larg: "s3" },
      { c: "certificado", r: "Nº certificado", t: "text", larg: "s3" }, { c: "emUso", r: "Em uso", t: "simnao", padrao: "Sim", larg: "s3" }],
  }] },
  gruporeginal: { titulo: "Grupo regional", secoes: [{ colecao: "grupos_regionais", botao: "Adicionar grupo regional", janela: "Grupo regional", colunas: ["nome"], campos: [nome()] }] },
  "config-email": { titulo: "Configuração email", subtitulo: "E-mails que recebem os avisos do sistema.", secoes: [{
    colecao: "emails_notificacao", botao: "Adicionar email", janela: "E-mail", colunas: ["email", "identificacao"],
    campos: [{ c: "email", r: "E-mail", t: "email", obrig: true, larg: "s6" }, { c: "identificacao", r: "Identificação", t: "text", larg: "s6" }],
  }] },
  "config-centro-servico": { titulo: "Configuração Centro de serviços", secoes: [{ colecao: "centros_servico", botao: "Adicionar Centro de Serviço", janela: "Centro de serviço", colunas: ["nome", "status"], campos: [nome(), status()] }] },
  whatsapp: { titulo: "Whatsapp", subtitulo: "Números usados para avisos. A conexão com o WhatsApp é feita numa etapa seguinte.", secoes: [{
    colecao: "whatsapp", botao: "Adicionar Número WhatsApp", janela: "Número WhatsApp", colunas: ["nome", "numero", "status"],
    campos: [nome(), { c: "numero", r: "Número", t: "text", obrig: true, larg: "s3" }, status()],
  }] },
  reasonschange: { titulo: "Motivos de Alteração", subtitulo: "Motivos oferecidos quando alguém altera ou exclui um registro. Ficam gravados na Auditoria LOG.", secoes: [{
    colecao: "motivos_alteracao", botao: "Adicionar", janela: "Motivo de alteração", colunas: ["identificacao", "status"],
    campos: [{ c: "identificacao", r: "Identificação", t: "text", obrig: true, larg: "s9" }, status()],
  }] },
  plugins: { titulo: "Plugins", subtitulo: "Integrações instaladas no LIMS.", secoes: [{
    colecao: "plugins", botao: "Adicionar", janela: "Plugin", colunas: ["nome", "descricao", "ativo"],
    campos: [nome(), { c: "descricao", r: "Descrição", t: "textarea", larg: "s12" }, ativoSimNao()],
  }] },
  listsmtp: { titulo: "Configuração Email", subtitulo: "Contas de e-mail de envio. As senhas ficam guardadas só no servidor e nunca voltam para a tela.", secoes: [{
    colecao: "smtp", botao: "Adicionar Email", janela: "Conta de e-mail",
    colunas: ["nome", "email", "hostSmtp", "portaSmtp", "usuarioSmtp", "sslSmtp", "ativo"],
    campos: [{ c: "nome", r: "Identificação", t: "text", obrig: true, larg: "s6" }, { c: "email", r: "Email", t: "email", obrig: true, larg: "s6" },
      { c: "hostImap", r: "Host IMAP", t: "text", larg: "s4" }, { c: "portaImap", r: "Porta IMAP", t: "number", larg: "s2" }, { c: "usuarioImap", r: "Usuário IMAP", t: "text", larg: "s3" }, { c: "senhaImap", r: "Senha IMAP", t: "senha", larg: "s3" }, { c: "sslImap", r: "SSL IMAP", t: "simnao", padrao: "Sim", larg: "s2" },
      { c: "hostSmtp", r: "Host SMTP", t: "text", larg: "s4" }, { c: "portaSmtp", r: "Porta SMTP", t: "number", larg: "s2" }, { c: "usuarioSmtp", r: "Usuário SMTP", t: "text", larg: "s3" }, { c: "senhaSmtp", r: "Senha SMTP", t: "senha", larg: "s3" }, { c: "sslSmtp", r: "SSL SMTP", t: "simnao", padrao: "Sim", larg: "s2" },
      ativoSimNao()],
  }] },
  holidays: { titulo: "Feriados", subtitulo: "Considerados no cálculo de prazos e de cobrança por dia útil.", secoes: [{
    colecao: "feriados", botao: "Adicionar Feriado", janela: "Feriado", colunas: ["identificacao", "data", "ativo"],
    campos: [{ c: "identificacao", r: "Identificação", t: "text", obrig: true, larg: "s6" }, { c: "data", r: "Data do feriado", t: "date", obrig: true, larg: "s3" }, ativoSimNao()],
  }] },
  "config-costcenter": { titulo: "Centro de custo", secoes: [{
    colecao: "centros_custo", botao: "Adicionar Centro de Custo", janela: "Centro de custo", colunas: ["nome", "componente", "descricao"],
    campos: [{ c: "nome", r: "Nome do Grupo", t: "text", obrig: true, larg: "s6" }, ref("componente", "Grupo de Componentes", "componentes_custo", "nome", { obrig: true, larg: "s6" }), { c: "descricao", r: "Descrição", t: "textarea", larg: "s12" }],
  }] },
  "config-costcomponents": { titulo: "Centro de custo componentes", secoes: [{ colecao: "componentes_custo", botao: "Adicionar Grupo de Componentes", janela: "Grupo de componentes", colunas: ["nome"], campos: [nome("nome", "Nome do Grupo")] }] },

  /* ---------- Configuração Serviços ---------- */
  "servicos-produtos": { titulo: "Serviços / Matriz", secoes: [
    { colecao: "matrizes", botao: "Adicionar Serviços/Produtos", janela: "Serviço / Matriz", colunas: ["nome", "grupo", "status"],
      campos: [nome("nome", "Nome do Serviço"), ref("grupo", "Grupo", "grupos_servico", "nome", { obrig: true }), status()] },
    { colecao: "grupos_servico", titulo: "Lista de Grupo serviços", botao: "Adicionar grupo", janela: "Grupo de serviços", colunas: ["nome", "status"], campos: [nome(), status()], padroes: GRUPOS_PADRAO.map((n) => ({ nome: n, status: "Ativo" })) },
  ] },
  lacoleta: { titulo: "Legislação Aplicável / Coleta", secoes: [
    { colecao: "legislacoes", titulo: "Legislação aplicável", botao: "Adicionar legislação aplicável", janela: "Legislação aplicável", colunas: ["nome", "abreviacao"],
      campos: [nome(), { c: "abreviacao", r: "Abreviação", t: "text", larg: "s4" }, { c: "orgao", r: "Órgão / emissor", t: "text", larg: "s4" }, { c: "vigencia", r: "Vigente desde", t: "date", larg: "s4" }] },
    { colecao: "tipos_coleta", titulo: "Coleta", botao: "Adicionar coleta", janela: "Coleta", colunas: ["nome", "abreviacao"], campos: [nome(), { c: "abreviacao", r: "Abreviação", t: "text", larg: "s4" }] },
  ] },
  parameters: { titulo: "Especificação Serviços", subtitulo: "Parâmetros (ensaios) com LQ, LD, incerteza, método e acreditação.", secoes: [{
    colecao: "parametros", botao: "Adicionar parâmetro", janela: "Parâmetro", largo: true,
    colunas: ["status", "parametro", "descricao", "abreviacao", "grupo", "lq", "ld", "incerteza", "unidade", "metodo", "classificacao", "etiqueta", "inloco", "casasDecimais", "horasInicio", "acreditado"],
    campos: [
      { c: "parametro", r: "Parâmetro", t: "text", obrig: true, larg: "s6" }, { c: "abreviacao", r: "Abreviação", t: "text", larg: "s3" }, status(),
      { c: "descricao", r: "Descrição", t: "text", larg: "s12" },
      ref("grupo", "Grupo", "grupos_servico", "nome", { obrig: true, larg: "s3" }), { c: "classificacao", r: "Classificação", t: "text", larg: "s3" }, { c: "tipo", r: "Tipo", t: "select", op: ["Ensaio", "Calculado", "Informativo"], padrao: "Ensaio", larg: "s3" }, ref("setor", "Setor", "setores", "nome", { larg: "s3" }),
      { c: "lq", r: "LQ", t: "text", larg: "s2" }, { c: "ld", r: "LD", t: "text", larg: "s2" }, { c: "incerteza", r: "Incerteza", t: "text", larg: "s2" }, ref("unidade", "Unidade", "unidades", "sigla", { larg: "s3" }), { c: "casasDecimais", r: "Casas decimais", t: "number", larg: "s3" },
      ref("metodo", "Método", "metodos", "nome", { larg: "s6" }), { c: "metodologia", r: "Metodologia", t: "text", larg: "s6" },
      { c: "procedimento", r: "Procedimento (POP)", t: "text", larg: "s4" }, { c: "versao", r: "Versão", t: "text", larg: "s2" },
      { c: "acreditado", r: "Acreditado", t: "simnao", padrao: "Não", larg: "s3" }, { c: "acreditacao", r: "Acreditação", t: "text", larg: "s3", dica: "Ex.: CRL 0000 (Cgcre)." },
      { c: "etiqueta", r: "Etiqueta", t: "text", larg: "s3" }, { c: "etiquetaSeparada", r: "Etiqueta separada", t: "simnao", padrao: "Não", larg: "s3" }, { c: "inloco", r: "In loco", t: "simnao", padrao: "Não", larg: "s3" }, { c: "italico", r: "Itálico no certificado", t: "simnao", padrao: "Não", larg: "s3" },
      { c: "horasInicio", r: "Prazo limite para iniciar (horas)", t: "number", larg: "s3" }, { c: "prazoDias", r: "Prazo limite (dias)", t: "number", larg: "s3" },
      { c: "embalagem", r: "Embalagem", t: "text", larg: "s3" }, ref("preservante", "Preservante", "preservantes", "nome", { larg: "s3" }), { c: "quantidade", r: "Quantidade para análise", t: "text", larg: "s3" },
      ref("subcontratado", "Subcontratado", "subcontratados", "empresa", { larg: "s3", ref: { vazio: "Realizado pela MinasLab" } }),
    ],
  }] },
  "configuracao-resultado-la": { titulo: "Resultado Legislação Aplicável", subtitulo: "Limites (VMP) de cada legislação por parâmetro, usados na proposta e no certificado.", secoes: [{
    colecao: "resultado_la", botao: "Adicionar", janela: "Resultado da legislação aplicável", largo: true,
    colunas: ["legislacao", "titulo", "abreviacao", "_limites"],
    campos: [ref("legislacao", "Legislações Aplicáveis", "legislacoes", "nome", { obrig: true, larg: "s6" }), { c: "titulo", r: "Título Proposta / Certificado", t: "text", larg: "s4" }, { c: "abreviacao", r: "Abreviação", t: "text", larg: "s2" },
      { c: "limites", r: "Limites por parâmetro", t: "limites", larg: "s12" }],
  }] },
  methods: { titulo: "Métodos", secoes: [{
    colecao: "metodos", botao: "Adicionar Método", janela: "Método", colunas: ["nome", "descricao", "ativo"],
    campos: [nome("nome", "Nome método"), { c: "descricao", r: "Descrição Método", t: "text", larg: "s12" }, ativoSimNao()],
  }] },
  "tabela-preco": { titulo: "Tabela de preço", secoes: [{
    colecao: "tabelas_preco", botao: "Adicionar tabela de preço", janela: "Tabela de preço", largo: true, colunas: ["nome", "_qtdPrecos", "status"],
    campos: [nome("nome", "Nome da tabela"), status(), { c: "precos", r: "Preço por parâmetro (R$)", t: "precos", larg: "s12" }],
  }] },
  "service-package": { titulo: "Pacote de Serviços", subtitulo: "O que entra na proposta: matriz, legislação, parâmetros e tabela de preço.", secoes: [{
    colecao: "pacotes", botao: "Adicionar Pacote", janela: "Pacote de serviços", largo: true,
    colunas: ["descricao", "legislacao", "legislacao2", "grupo", "matriz", "tabelaPreco", "_qtdParametros", "status"],
    campos: [{ c: "descricao", r: "Descrição Pacote", t: "text", obrig: true, larg: "s9" }, status(),
      ref("legislacao", "Legislação Aplicável Principal", "legislacoes", "nome", { larg: "s6", ref: { vazio: "Selecione a legislação" } }), ref("legislacao2", "Legislação Aplicável Comparativa", "legislacoes", "nome", { larg: "s6", ref: { vazio: "Não Aplicável" } }),
      ref("grupo", "Grupo de serviços", "grupos_servico", "nome", { obrig: true }), ref("matriz", "Matriz", "matrizes", "nome", { obrig: true, ref: { filtroPor: ["grupo", "grupo"] } }), ref("tabelaPreco", "Tabela de preço", "tabelas_preco", "nome", { ref: { vazio: "Sem tabela de preço" } }),
      { c: "parametros", r: "Especificação (parâmetros do pacote)", t: "refmulti", ref: { colecao: "parametros", rotulo: "parametro", filtroPor: ["grupo", "grupo"] }, larg: "s12" }],
  }] },
  "config-revisao": { titulo: "Configuração Revisão", subtitulo: "Quem revisa os resultados de cada grupo ou parâmetro antes da emissão do certificado.", secoes: [{
    colecao: "config_revisao", botao: "Adicionar", janela: "Revisor", colunas: ["analista", "grupo", "parametro", "status"],
    campos: [ref("analista", "Analista revisor", "funcionarios", "nome", { obrig: true, larg: "s6" }), ref("grupo", "Grupo", "grupos_servico", "nome", { larg: "s6", ref: { vazio: "Todos" } }),
      ref("parametro", "Parâmetro", "parametros", "parametro", { larg: "s6", ref: { vazio: "Todos do grupo", filtroPor: ["grupo", "grupo"] } }), status()],
  }] },
  sector: { titulo: "Setores", secoes: [{
    colecao: "setores", botao: "Adicionar Setor", janela: "Setor", colunas: ["nome", "sigla", "ativo"],
    campos: [nome(), { c: "sigla", r: "Sigla", t: "text", larg: "s3", unico: true }, ativoSimNao("Ativo?")],
  }] },

  /* ---------- Preservante, Templates, Subcontratado, financeiro, Gestão ---------- */
  preservante: { titulo: "Preservante", secoes: [{
    colecao: "preservantes", botao: "Adicionar preservante", janela: "Preservante", colunas: ["nome", "consumivel"],
    campos: [nome(), { c: "consumivel", r: "Consumível", t: "text", larg: "s6", dica: "Na integração, este campo passa a vir da Gestão de Estoque do painel." }],
  }] },
  "config-templates": { titulo: "Modelos", subtitulo: "Modelos de documento. Use variáveis entre chaves, como {cliente.razao} ou {proposta.numero}.", secoes: [{
    colecao: "modelos", botao: "Adicionar modelo", janela: "Modelo", largo: true, colunas: ["titulo", "tipo", "status"],
    campos: [{ c: "titulo", r: "Título", t: "text", obrig: true, larg: "s6" }, { c: "tipo", r: "Tipo", t: "select", op: ["Proposta", "Certificado / Laudo", "Contrato", "Ordem de serviço", "Cadeia de custódia", "E-mail", "Etiqueta"], padrao: "Proposta", larg: "s3" }, status(),
      { c: "conteudo", r: "Conteúdo", t: "textarea", linhas: 14, larg: "s12" }],
  }] },
  subcontratados: { titulo: "Subcontratados", subtitulo: "Laboratórios provedores de ensaio (ISO/IEC 17025 6.6).", secoes: [{
    colecao: "subcontratados", botao: "Adicionar subcontratado", janela: "Subcontratado", colunas: ["empresa", "descricao", "indice"],
    campos: [{ c: "empresa", r: "Nome da empresa", t: "text", obrig: true, larg: "s6" }, { c: "descricao", r: "Descrição", t: "text", larg: "s6" }, { c: "indice", r: "Índice", t: "number", larg: "s3", dica: "Fator aplicado ao custo do serviço subcontratado." }],
  }] },
  "config-nfs": { titulo: "Configuração NFs", subtitulo: "Dados da empresa emissora de NFS-e. Na integração, a emissão usa o módulo Finanças do painel.", secoes: [{
    colecao: "config_nfs", botao: "Adicionar Empresa", janela: "Empresa emissora", largo: true, colunas: ["empresa", "cnpj", "cidade", "estado", "status"],
    campos: [{ c: "empresa", r: "Empresa", t: "text", obrig: true, larg: "s6" }, { c: "cnpj", r: "CNPJ", t: "text", obrig: true, larg: "s3" }, { c: "im", r: "Inscrição municipal", t: "text", larg: "s3" },
      { c: "cidade", r: "Cidade", t: "text", larg: "s4" }, { c: "estado", r: "Estado", t: "text", larg: "s2" }, { c: "codMunicipio", r: "Código do Município (IBGE)", t: "text", larg: "s3" }, { c: "codTributario", r: "Código Tributário municipal", t: "text", larg: "s3" },
      { c: "lc116", r: "Serviço LC 116", t: "text", larg: "s3" }, { c: "cnae", r: "CNAE", t: "text", larg: "s3" }, { c: "descricaoCnae", r: "Descrição do serviço CNAE", t: "text", larg: "s6" }, status()],
  }] },
  "config-formapagamento": { titulo: "Configuração forma de pagamento", secoes: [{
    colecao: "formas_pagamento", botao: "Adicionar Forma de pagamento", janela: "Forma de pagamento", colunas: ["tipoContrato", "descricao", "dias", "tipo", "status"],
    campos: [{ c: "tipoContrato", r: "Tipo de contrato", t: "select", op: ["Contrato Padrão", "Contrato Parcelado"], padrao: "Contrato Padrão", larg: "s4" }, { c: "descricao", r: "Descrição", t: "text", obrig: true, larg: "s8" },
      { c: "dias", r: "Dias", t: "number", larg: "s3" }, { c: "tipo", r: "Tipo", t: "select", op: ["Por período", "Por dia Fixo", "Por dia Útil"], padrao: "Por período", larg: "s3" }, status()],
  }] },
  "formularios-verificacao": { titulo: "Formulários de lista de verificação", secoes: [{
    colecao: "checklists", botao: "Adicionar Título CheckList", janela: "Lista de verificação", colunas: ["nome", "pontos", "tipo", "ativo"],
    campos: [nome("nome", "Nome CheckList"), { c: "pontos", r: "Pontos CheckList", t: "number", larg: "s3" }, { c: "tipo", r: "Tipo", t: "select", op: ["Homologação", "Capacitação"], padrao: "Homologação", larg: "s3" }, ativoSimNao("Ativo?")],
  }] },
  "gestao-frequencia": { titulo: "Gestão Frequência", secoes: [{
    colecao: "frequencias", botao: "Adicionar Frequência", janela: "Frequência", colunas: ["descricao", "dias", "status"],
    campos: [{ c: "descricao", r: "Descrição", t: "text", obrig: true, larg: "s6" }, { c: "dias", r: "Dias", t: "number", larg: "s3" }, status()],
  }] },
};

// Cadastros dos menus Financeiro e Gestão da qualidade (mesmo motor; "menu"
// só muda o caminho exibido no topo da tela).
const data = (c, r, larg = "s3", extra = {}) => ({ c, r, t: "date", larg, ...extra });
const sel = (c, r, op, padrao = op[0], larg = "s3") => ({ c, r, t: "select", op, padrao, larg });
const txt = (c, r, larg = "s6", extra = {}) => ({ c, r, t: "text", larg, ...extra });
const pessoa = (c, r, larg = "s4") => ref(c, r, "funcionarios", "nome", { larg, ref: { vazio: "—" } });

Object.assign(CADASTROS, {
  "nota-fiscal-entrada": { menu: "Financeiro", titulo: "Notas fiscais de Entrada", subtitulo: "Notas de compra de insumos, reagentes e serviços (base para a avaliação de fornecedores, ISO/IEC 17025 6.6).", secoes: [{
    colecao: "notas_entrada", botao: "Adicionar nota fiscal", janela: "Nota fiscal de entrada", largo: true,
    colunas: ["numero", "fornecedor", "emissao", "valor", "centroCusto", "status"],
    campos: [ref("fornecedor", "Fornecedor", "clientes", "razao", { obrig: true, larg: "s6" }), txt("numero", "Número", "s3", { obrig: true }), txt("serie", "Série", "s3"),
      data("emissao", "Data de emissão", "s3", { obrig: true }), { c: "valor", r: "Valor (R$)", t: "number", larg: "s3", obrig: true }, ref("centroCusto", "Centro de custo", "centros_custo", "nome", { larg: "s6", ref: { vazio: "—" } }),
      txt("chave", "Chave de acesso", "s12"), { c: "descricao", r: "Itens / descrição", t: "textarea", larg: "s12" }, sel("status", "Status", ["Lançada", "Conferida", "Cancelada"])],
  }] },
  costcenter: { menu: "Financeiro", titulo: "Centro de custos", subtitulo: "Lançamentos por centro de custo (grupos em Configurações → Centro de custo).", secoes: [{
    colecao: "lancamentos_custo", botao: "Adicionar lançamento", janela: "Lançamento de centro de custo",
    colunas: ["data", "centroCusto", "componente", "descricao", "tipo", "valor"],
    campos: [data("data", "Data", "s3", { obrig: true }), ref("centroCusto", "Centro de custo", "centros_custo", "nome", { obrig: true, larg: "s5" }), ref("componente", "Componente", "componentes_custo", "nome", { larg: "s4", ref: { vazio: "—" } }),
      txt("descricao", "Descrição", "s8", { obrig: true }), sel("tipo", "Tipo", ["Despesa", "Receita"], "Despesa"), { c: "valor", r: "Valor (R$)", t: "number", obrig: true, larg: "s3" }, txt("documento", "Documento", "s4")],
  }] },

  /* ---------- Gestão da qualidade ---------- */
  occurrence: { menu: "Gestão da qualidade", titulo: "Ocorrências", subtitulo: "Trabalho não conforme, reclamações e ações corretivas (ISO/IEC 17025 7.9, 7.10 e 8.7).", secoes: [{
    colecao: "ocorrencias", botao: "Abrir Ocorrência", janela: "Ocorrência", largo: true,
    colunas: ["titulo", "inicio", "finalizarAte", "prioridade", "cliente", "local", "tipo", "responsavel", "situacao"],
    campos: [txt("titulo", "Titulo da ocorrência", "s9", { obrig: true }), sel("prioridade", "Prioridade", ["Baixa", "Média", "Alta", "Urgente"], "Média"),
      data("inicio", "Data inicio", "s3", { obrig: true }), data("finalizarAte", "Finalizar até"), ref("cliente", "Cliente", "clientes", "razao", { larg: "s6", ref: { vazio: "Interna (sem cliente)" } }),
      sel("tipo", "Tipo de ocorrência", ["Não conformidade (trabalho)", "Reclamação de cliente", "Auditoria interna", "Auditoria externa", "Desvio de método", "Equipamento", "Fornecedor", "Oportunidade de melhoria", "Risco"], "Não conformidade (trabalho)", "s4"),
      txt("local", "Local da ocorrência", "s4"), pessoa("responsavel", "Responsável"), pessoa("aprovador", "Aprovador"), txt("equipe", "Equipe / envolvidos", "s8"),
      { c: "descricao", r: "Descrição", t: "textarea", larg: "s12", obrig: true },
      sel("impacto", "Afetou resultados já emitidos?", ["Não", "Sim — avaliar e comunicar o cliente", "Em avaliação"], "Não", "s6"), sel("trabalhoSuspenso", "Trabalho suspenso / retido?", ["Não", "Sim"], "Não", "s6"),
      { c: "acaoImediata", r: "Ação imediata (correção)", t: "textarea", larg: "s12" }, { c: "causaRaiz", r: "Análise de causa raiz", t: "textarea", larg: "s12" },
      { c: "acaoCorretiva", r: "Ação corretiva", t: "textarea", larg: "s12" }, data("verificacaoEficacia", "Verificação de eficácia em"), sel("eficaz", "Ação eficaz?", ["Pendente", "Sim", "Não"], "Pendente"),
      sel("situacao", "Situação da ocorrência", ["Aberta", "Em tratamento", "Aguardando eficácia", "Concluída", "Cancelada"], "Aberta")],
  }] },
  filemanagement: { menu: "Gestão da qualidade", titulo: "Gestão de arquivos", subtitulo: "Documentos do sistema de gestão com versão, elaboração, aprovação e validade (ISO/IEC 17025 8.3).", secoes: [{
    colecao: "documentos", botao: "Adicionar arquivos", janela: "Documento", largo: true,
    colunas: ["codigo", "nome", "categoria", "versao", "elaboracao", "aprovacao", "situacao", "validade", "arquivo"],
    campos: [txt("codigo", "Código", "s3", { unico: true }), txt("nome", "Nome do arquivo", "s6", { obrig: true }), txt("versao", "Versão", "s3", { obrig: true }),
      { c: "descricao", r: "Descrição do arquivo", t: "textarea", larg: "s12" }, sel("categoria", "Categoria/Pasta", ["Manual da qualidade", "Procedimento (POP)", "Instrução de trabalho", "Formulário", "Registro", "Documento externo / norma", "Política"], "Procedimento (POP)", "s4"),
      pessoa("elaboracao", "Elaboração"), { c: "prazo", r: "Prazo (dias)", t: "number", larg: "s4" }, pessoa("aprovacao", "Aprovação"), data("dataAprovacao", "Data de aprovação", "s4"),
      sel("situacao", "Situação", ["Em elaboração", "Em aprovação", "Vigente", "Obsoleto"], "Em elaboração", "s4"), sel("download", "Download disponível para", ["Todos", "Qualidade", "Laboratório", "Administradores"], "Todos", "s4"),
      data("validade", "Data válidade documento", "s4"), txt("arquivo", "Arquivo (nome ou link)", "s8", { dica: "A guarda do arquivo no servidor entra numa próxima etapa." })],
  }] },
  "samples-cq": { menu: "Gestão da qualidade", titulo: "Amostras controle de qualidade", subtitulo: "Materiais de referência e amostras de controle usados na Carta controle (ISO/IEC 17025 7.7.1).", secoes: [{
    colecao: "amostras_cq", botao: "Adicionar amostra CQ", janela: "Amostra de controle de qualidade", largo: true,
    colunas: ["identificacao", "uniqueId", "maxAmostras", "parametro", "equipamento", "valorReferencia", "inicio", "expiracao"],
    campos: [txt("identificacao", "Identificação", "s6", { obrig: true }), txt("uniqueId", "Unique ID / lote", "s3", { unico: true }), { c: "maxAmostras", r: "Máximo de Amostras", t: "number", larg: "s3" },
      ref("parametro", "Parâmetro", "parametros", "parametro", { obrig: true, larg: "s6" }), ref("equipamento", "Equipamento", "equipamentos", "equipamento", { larg: "s6", ref: { vazio: "—" } }),
      { c: "valorReferencia", r: "Valor de referência", t: "number", larg: "s3", dica: "Em branco: a carta usa a média dos resultados." }, { c: "desvioReferencia", r: "Desvio padrão de referência", t: "number", larg: "s3" },
      data("inicio", "Data inicio"), data("expiracao", "Data expiração"), txt("fabricante", "Fabricante / certificado do MR", "s12")],
  }] },
  homologation: { menu: "Gestão da qualidade", titulo: "Homologação", subtitulo: "Avaliação e aprovação de fornecedores, equipamentos e insumos (ISO/IEC 17025 6.6).", secoes: [{
    colecao: "homologacoes", botao: "Criar", janela: "Homologação", largo: true,
    colunas: ["tipo", "fornecedor", "equipamento", "insumo", "responsavel", "pontos", "checklist", "validade", "status"],
    campos: [sel("tipo", "Tipo de Homologação", ["Fornecedor", "Cliente", "Equipamento", "Insumo"], "Fornecedor", "s4"), ref("fornecedor", "Fornecedor / Cliente", "clientes", "razao", { larg: "s8", ref: { vazio: "—" } }),
      ref("equipamento", "Equipamento", "equipamentos", "equipamento", { larg: "s6", ref: { vazio: "—" } }), txt("insumo", "Insumo/Lote", "s6"),
      data("solicitacao", "Data solicitação"), data("validade", "Data validade"), pessoa("responsavel", "Responsável", "s3"), pessoa("aprovacao", "Aprovação", "s3"),
      ref("checklist", "Checklist", "checklists", "nome", { larg: "s6", ref: { vazio: "—" } }), { c: "pontos", r: "Pontos obtidos", t: "number", larg: "s3" },
      sel("status", "Status", ["Em avaliação", "Aprovado", "Aprovado com restrição", "Reprovado", "Cancelado"], "Em avaliação"), { c: "observacoes", r: "Observações / motivo cancelamento", t: "textarea", larg: "s12" }, txt("anexo", "Anexo (nome ou link)", "s12")],
  }] },
  "training-management": { menu: "Gestão da qualidade", titulo: "Gestão de Capacitação", subtitulo: "Treinamento, autorização e eficácia do pessoal (ISO/IEC 17025 6.2).", secoes: [{
    colecao: "capacitacoes", botao: "Criar Capacitação", janela: "Capacitação", largo: true,
    colunas: ["identificacao", "profissional", "interno", "local", "horas", "inicio", "termino", "frequencia", "eficacia", "status", "forma"],
    campos: [txt("identificacao", "Identificação", "s6", { obrig: true }), ref("profissional", "Profissional", "funcionarios", "nome", { obrig: true, larg: "s6" }),
      sel("tipo", "Tipo Capacitação", ["Treinamento inicial", "Reciclagem", "Autorização para ensaio", "Ensaio de proficiência", "Curso externo", "Integração"], "Treinamento inicial", "s4"), txt("objeto", "Objeto (POP, método, equipamento)", "s5"), txt("versao", "Versão", "s3"),
      { c: "descricao", r: "Descrição", t: "textarea", larg: "s12" }, sel("interno", "Interno", ["Sim", "Não"], "Sim", "s2"), txt("local", "Local", "s4"), sel("forma", "Forma de Capacitação", ["Presencial", "Eletrônica / EAD", "Prática supervisionada", "Leitura de documento"], "Presencial", "s3"),
      { c: "horas", r: "Tempo Capacitação ( Horas )", t: "number", larg: "s3" }, data("inicio", "Data Inicio"), data("termino", "Data Término"), { c: "frequencia", r: "Frequência (%)", t: "number", larg: "s3" },
      sel("eficacia", "Eficácia", ["Pendente", "Eficaz", "Não eficaz"], "Pendente"), data("avaliacaoEficacia", "Avaliação da eficácia em"), sel("status", "Status", ["Planejada", "Em andamento", "Concluída", "Cancelada"], "Planejada")],
  }] },
});

// Valor "ativo" de um registro, qualquer que seja o rótulo usado no cadastro.
export const estaAtivo = (r) => !(r.status === "Inativo" || r.ativo === "Não");

// Validade da calibração: última calibração + periodicidade (meses).
export function validadeCalibracao(r) {
  if (!r.ultimaCalibracao || !(Number(r.periodicidade) > 0)) return "";
  const [a, m, d] = r.ultimaCalibracao.split("-").map(Number);
  const v = new Date(Date.UTC(a, m - 1 + Number(r.periodicidade), d));
  return v.toISOString().slice(0, 10);
}

// Primeiro problema do formulário, ou null. Recebe os registros já gravados
// da coleção para conferir campos únicos.
export function erroFormulario(campos, valor, existentes = []) {
  for (const f of campos) {
    const v = valor[f.c];
    const vazio = v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
    if (f.obrig && vazio) return [f.c, `Informe ${f.r}.`];
    if (f.t === "number" && !vazio && !Number.isFinite(Number(v))) return [f.c, `${f.r} precisa ser um número.`];
    if (f.t === "email" && !vazio && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return [f.c, `Confira o e-mail em ${f.r}.`];
    if (f.unico && !vazio) {
      const igual = existentes.find((e) => e.id !== valor.id && String(e[f.c] ?? "").trim().toLowerCase() === String(v).trim().toLowerCase());
      if (igual) return [f.c, `Já existe um cadastro com ${f.r} "${v}".`];
    }
  }
  return null;
}

// Valores iniciais de um formulário novo.
export const padroes = (campos) => Object.fromEntries(campos.filter((f) => f.padrao !== undefined).map((f) => [f.c, f.padrao]));
