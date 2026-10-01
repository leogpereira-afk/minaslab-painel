// Vocabulário e regras leves da Academy no navegador. A regra que vale (o que
// impede publicar, o que é imutável) mora no banco — aqui só rótulos e ajudas
// de tela, para o texto ser o mesmo em todas as telas.

export const TIPOS_AULA = [
  { valor: "texto", rotulo: "Texto", campo: "texto" },
  { valor: "imagem", rotulo: "Imagem (link)", campo: "url" },
  { valor: "video", rotulo: "Vídeo (link)", campo: "url" },
  { valor: "pdf", rotulo: "PDF (link)", campo: "url" },
  { valor: "apresentacao", rotulo: "Apresentação (link)", campo: "url" },
  { valor: "link", rotulo: "Link externo", campo: "url" },
  { valor: "caso", rotulo: "Estudo de caso", campo: "enunciado" },
  { valor: "pratica", rotulo: "Atividade prática", campo: "enunciado" },
];
export const tipoAula = (v) => TIPOS_AULA.find((t) => t.valor === v) || TIPOS_AULA[0];

export const MODALIDADES = [
  { valor: "nenhuma", rotulo: "Somente conclusão das aulas", disponivel: true },
  { valor: "automatica", rotulo: "Prova automática (próxima etapa)", disponivel: false },
  { valor: "gestor", rotulo: "Avaliação do gestor (próxima etapa)", disponivel: false },
  { valor: "hibrida", rotulo: "Híbrida: prova + prática (próxima etapa)", disponivel: false },
];

export const STATUS_TREINAMENTO = { rascunho: "Rascunho", publicado: "Publicado", arquivado: "Arquivado" };
export const STATUS_VERSAO = { rascunho: "Rascunho", publicada: "Publicada", substituida: "Substituída", arquivada: "Arquivada" };
export const TOM_STATUS = { rascunho: "bg-warn-50 text-warn-800", publicado: "bg-ok-50 text-ok-800", publicada: "bg-ok-50 text-ok-800", substituida: "bg-slate-100 text-slate-600", arquivada: "bg-slate-100 text-slate-600", arquivado: "bg-slate-100 text-slate-600" };

export const EVENTOS = {
  TREINAMENTO_CRIADO: "Treinamento criado", TREINAMENTO_DADOS_ALTERADOS: "Dados do treinamento alterados", VERSAO_SALVA: "Versão salva",
  VERSAO_VALIDADA_QUALIDADE: "Versão validada pela Qualidade", VERSAO_PUBLICADA: "Versão publicada", NOVA_VERSAO_CRIADA: "Nova versão criada",
  TREINAMENTO_ARQUIVADO: "Treinamento arquivado", PUBLICO_ALTERADO: "Público alterado",
};

export const novaAula = () => ({ titulo: "", tipo: "texto", conteudo: {}, duracaoMin: "" });
export const novoModulo = () => ({ titulo: "", descricao: "", aulas: [novaAula()] });

// Move um item de lista (ordem dos módulos/aulas/materiais), sem mutar.
export function mover(lista, de, para) {
  if (de === para || para < 0 || para >= lista.length) return lista;
  const c = [...lista];
  const [x] = c.splice(de, 1);
  c.splice(para, 0, x);
  return c;
}

// Versão do servidor → formulário de edição.
export function formularioDaVersao(det) {
  const v = det.versao;
  return {
    titulo: v.titulo || "", descricao: v.descricao || "", modalidade: v.modalidade, notaMinima: v.nota_minima ?? "", maxTentativas: v.max_tentativas ?? "",
    obrigatorio: !!v.obrigatorio, prazoDias: v.prazo_dias ?? "", validadeMeses: v.validade_meses ?? "", cargaHorariaMin: v.carga_horaria_min ?? "",
    exigeQualidade: !!v.exige_qualidade, notasVersao: v.notas_versao || "",
    modulos: det.modulos.map((m) => ({ titulo: m.titulo, descricao: m.descricao || "", aulas: m.aulas.map((a) => ({ titulo: a.titulo, tipo: a.tipo, conteudo: a.conteudo || {}, duracaoMin: a.duracaoMin ?? "" })) })),
    materiais: det.materiais.map((m) => ({ titulo: m.titulo, url: m.url })),
  };
}

// Carga horária total sugerida (soma das durações informadas), só como ajuda.
export const duracaoTotalMin = (modulos) =>
  modulos.reduce((t, m) => t + m.aulas.reduce((s, a) => s + (Number(a.duracaoMin) || 0), 0), 0);
