// Configuração do sistema: as 10 abas e os campos da tela /configs do
// GerenciaLab (conferidos em 04/11/2026). Grava num registro único
// (coleção "config", id "sistema"). Mesmo formato de campo de lib/cadastros.js.

const sn = (c, r, padrao = "Não") => ({ c, r, t: "simnao", padrao, larg: "s4" });
const sel = (c, r, op, padrao = op[0]) => ({ c, r, t: "select", op, padrao, larg: "s4" });
const txt = (c, r, larg = "s4") => ({ c, r, t: "text", larg });
const num = (c, r, padrao = "") => ({ c, r, t: "number", padrao, larg: "s4" });
const cor = (c, r, padrao) => ({ c, r, t: "color", padrao, larg: "s4" });

export const ABAS_SISTEMA = [
  { aba: "Geral", campos: [sn("multiEnderecos", "Cadastro multi endereços")] },
  { aba: "Empresa", campos: [txt("empresa", "Empresa", "s6"), txt("cnpj", "CNPJ", "s3"), txt("telefone", "Telefone", "s3"), txt("endereco", "Endereço", "s6"), txt("cidade", "Cidade", "s3"), txt("estado", "Estado", "s3")] },
  { aba: "Certificado", campos: [
    sel("validacaoA1", "Validação Certificado A1", ["Ativo", "Inativo"], "Inativo"),
    sel("envioRelatorio", "Envio do relatório", ["Envio padrão separado", "Enviar mesclado", "Escolher", "Não enviar"]),
    sn("separarAcreditado", "Separar bloco resultado acreditado", "Sim"), sn("agruparParametros", "Agrupar parâmetros certificado final"), txt("siglaAgrupado", "Sigla no parâmetros agrupado"),
    sn("destaqueResultado", "Destaque resultado certificado"), sel("formaDestaque", "Forma de destaque resultado certificado", ["Nenhum destaque", "Negrito", "Sublinhado", "Negrito e Sublinhado"]),
    sn("detalhesColeta", "Exibir detalhes da coleta"), sn("certificadoIngles", "Certificado Inglês"), sn("certificadoEspanhol", "Certificado Espanhol"),
    sel("exibirSubcontratado", "Exibir SubContratado", ["Exibir Empresa", "Exibir Descrição"]), sn("anexoCadeiaCustodia", "Anexo Cadeia de Custódia"),
    sel("padraoArquivo", "Padrão arquivo de download", ["Código de barras", "Referência da Amostra", "Referência da Amostra + Descrição do Ponto da Coleta", "Referência da Amostra + Descrição do Ponto da Coleta + Endereço da Amostra"]),
    sn("bloqueioEditorCertificado", "Bloqueio Editor de Certificado", "Sim"), sel("cronjobCertificado", "Cronjob Certificado", ["Ativo", "Inativo"], "Inativo"),
  ] },
  { aba: "Coleta", campos: [
    sel("coletaInlocoStatus", "Coleta Inloco Status", ["Status Revisão", "Status Laboratório"]), sel("coletaStatusFinal", "Coleta Status Após finalizar", ["Status Aguardando Inspeção", "Status Laboratório"]),
    sn("coletaSoColetador", "Coleta apenas por coletador"), sn("alterarParametroColeta", "Alterar parâmetro na coleta"),
    sn("liberarInspecaoSemColeta", "Liberar inspeção sem coleta"), sn("permitirInspecaoSemColeta", "Permitir inspeção sem coleta"), sn("permitirInspecaoSemInloco", "Permitir Inspeção sem Inloco"),
    num("diasDescarte", "Guarda da amostra antes do descarte (dias)", 30),
  ] },
  { aba: "Ordem de serviço", campos: [
    { c: "numeroInicialOS", r: "Numeração da OS começa em", t: "number", larg: "s4", dica: "Para seguir o GerenciaLab, informe o próximo número de OS de lá." },
    { c: "numeroInicialAmostra", r: "Numeração da amostra começa em", t: "number", larg: "s4", dica: "Próximo número de amostra (AM) do GerenciaLab." },
    { c: "codigoBarrasInicial", r: "Código de barras começa em", t: "number", larg: "s4", dica: "Próximo código de barras do GerenciaLab." },
    sel("statusOsAvulsa", "Status O.S Avulsa", ["Status Aguardando agendamento", "Status Aguardando coleta"]), sel("cronjobOs", "Cronjob Ordem serviço", ["Ativo", "Inativo"], "Inativo"),
    sn("alterarOsConcluida", "Alterar Ordem serviço concluída"), num("removerDiasVencimento", "Remover dias no vencimento"), sn("inicioAnaliseAutomatico", "Data inicio análise automática"),
    sn("opcaoAmostrasRecebidas", "Opção amostras recebidas"), sn("permitirAlterarStatus", "Permitir Alterar Status"), sn("permitirAlterarLegislacao", "Permitir alterar Legislação"),
  ] },
  { aba: "Proposta", campos: [
    { c: "numeroInicialProposta", r: "Numeração da proposta começa em", t: "number", larg: "s4", dica: "Para seguir a numeração do GerenciaLab, informe o próximo número de lá. Vale a partir da próxima proposta criada." },
    sn("seloAcreditacao", "Exibir Selo acreditação"), num("tamanhoLogo", "Tamanho logo"), txt("tituloProposta", "Titulo proposta"), cor("corLinhaCabecalho", "Cor Linha cabeçalho", "#16a897"), num("alturaCabecalho", "Altura cabeçalho em Px"),
    sn("analiseCritica", "Análise crítica", "Sim"), sel("analiseCriticaPosicao", "Análise crítica posição", ["Criação da proposta", "Final da proposta", "Final da proposta Antes de salvar"]), sn("analiseCriticaPreenchida", "Análise crítica preenchida"),
    sn("prazoAutomatico", "Prazo automático por Parâmetro"), sn("bloqueioEdicao", "Bloqueio edição", "Sim"), sn("verificarSubcontratacao", "Verificar Subcontratação", "Sim"), sn("verificarInloco", "Verificar Inloco"), sn("controleCarteira", "Controle de carteira"),
  ] },
  { aba: "Contrato", campos: [
    sn("cronjobContrato", "Ativar cronjob contrato"), sn("emailCronjobContrato", "Enviar email cronjob contrato"),
    sel("grupoEmailContrato", "Grupo email cronjob contrato", ["Administradores", "Comercial", "Financeiro", "Qualidade", "Laboratório", "Coletor", "Administradores Total"]),
    num("finalizarContrato", "Finalizar contrato (dias)"), sn("notificacaoContrato", "Notificação contrato"), num("primeiraNotificacao", "Primeira not. contrato (dias)"), num("segundaNotificacao", "Segunda not. contrato (dias)"), num("ultimaNotificacao", "Última not. contrato (dias)"),
    sn("inativarContratoVencido", "Inativar contrato vencido", "Sim"), sel("acessoInadimplencia", "Acesso com inadimplência", ["Não, acesso liberado", "Sim solicitar login"]),
  ] },
  { aba: "Documentos", campos: [
    sn("frascosFichaColeta", "Frascos documento ficha de coleta", "Sim"), sn("exibirBorda", "Exibir Borda", "Sim"), num("fonteOs", "Tamanho fonte OS/AM"), num("fonteCodigoBarra", "Tamanho fonte codigo barra"),
    sn("duplaEtiqueta", "Dupla etiqueta"), sn("etiquetaQrCode", "Etiqueta QrCode"), txt("tamanhoEtiqueta", "Tamanho etiqueta"), sel("fonte", "Fonte", ["Helvetica", "Times", "Dejavusans", "Cid0jp"]),
  ] },
  { aba: "Financeiro", campos: [sn("sistemaFaturamento", "Sistema de Faturamento", "Sim"), sn("sistemaParcelamento", "Sistema de Parcelamento", "Sim"), sn("pagamentoSemEntrada", "Confirmar pagamento sem entrada da amostra")] },
  { aba: "Laboratório", campos: [
    sn("converterUnidade", "Converter unidade medida", "Sim"), sn("revisaoIndependente", "Revisor deve ser diferente do analista", "Sim"), sn("marcaInlocoRevisao", "Marca Inloco na revisão"), num("diasProximoVencimento", "Dias próximo ao vencimento análise", 2),
    cor("corProximoVencimento", "Cor próximo ao vencimento análise", "#d97706"), cor("corAposVencimento", "Cor após o vencimento análise", "#dc2626"),
  ] },
];

export const PADROES_SISTEMA = Object.fromEntries(ABAS_SISTEMA.flatMap((a) => a.campos).filter((f) => f.padrao !== undefined && f.padrao !== "").map((f) => [f.c, f.padrao]));
