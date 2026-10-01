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
  { valor: "automatica", rotulo: "Prova automática (nota mínima e tentativas)", disponivel: true },
  { valor: "gestor", rotulo: "Avaliação do gestor (próxima etapa)", disponivel: false },
  { valor: "hibrida", rotulo: "Híbrida: prova + prática (próxima etapa)", disponivel: false },
];

export const TIPOS_QUESTAO = [
  { valor: "multipla", rotulo: "Múltipla escolha (1 correta)" },
  { valor: "vf", rotulo: "Verdadeiro ou falso" },
  { valor: "multiplas", rotulo: "Múltiplas respostas (1 ou mais corretas)" },
];
export const novaQuestao = (tipo = "multipla") => ({
  tipo, enunciado: "", feedback: "",
  opcoes: tipo === "vf" ? [{ texto: "Verdadeiro", correta: true }, { texto: "Falso", correta: false }] : [{ texto: "", correta: true }, { texto: "", correta: false }],
});
// Trocar o tipo ajusta as opções: V/F volta a ter as duas opções; "1 correta" mantém só a primeira marcada.
export function trocarTipoQuestao(q, tipo) {
  if (tipo === "vf") return { ...q, tipo, opcoes: novaQuestao("vf").opcoes };
  if (tipo === "multipla" || q.tipo === "vf") {
    const opcoes = q.tipo === "vf" ? [{ texto: "", correta: true }, { texto: "", correta: false }] : q.opcoes;
    const primeira = opcoes.findIndex((o) => o.correta);
    return { ...q, tipo, opcoes: opcoes.map((o, i) => ({ ...o, correta: i === Math.max(primeira, 0) })) };
  }
  return { ...q, tipo };
}

export const SITUACAO = {
  pendente: { rotulo: "Não iniciado", tom: "bg-slate-100 text-slate-700" },
  em_andamento: { rotulo: "Em andamento", tom: "bg-brand-50 text-brand-800" },
  concluida: { rotulo: "Concluído", tom: "bg-ok-50 text-ok-800" },
  atrasada: { rotulo: "Prazo vencido", tom: "bg-bad-50 text-bad-800" },
  validade_vencida: { rotulo: "Reciclagem necessária", tom: "bg-bad-50 text-bad-800" },
  tentativas_esgotadas: { rotulo: "Tentativas esgotadas", tom: "bg-bad-50 text-bad-800" },
};

// Dias entre hoje e uma data (AAAA-MM-DD); negativo = vencido.
export function diasAte(data, hoje) {
  if (!data || !hoje) return null;
  const d = (x) => Date.UTC(+String(x).slice(0, 4), +String(x).slice(5, 7) - 1, +String(x).slice(8, 10));
  return Math.round((d(data) - d(hoje)) / 86400000);
}
export const dataBR = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : "—");

export function textoPrazo(data, hoje) {
  const n = diasAte(data, hoje);
  if (n === null) return "Sem prazo";
  if (n < 0) return `Venceu há ${-n} dia${n === -1 ? "" : "s"} (${dataBR(data)})`;
  if (n === 0) return `Vence hoje (${dataBR(data)})`;
  return `Vence em ${n} dia${n === 1 ? "" : "s"} (${dataBR(data)})`;
}

// Linhas do certificado (a tela e o PDF usam a mesma fonte). Carga horária só
// aparece quando o servidor a entregou (cadastrada E validada pela Qualidade).
export function linhasCertificado(c) {
  const data = new Date(c.emitido_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const l = [
    ["Colaborador", c.pessoa_nome], ["Treinamento", c.treinamento_titulo], ["Versão do conteúdo", String(c.versao_numero)],
    ["Data de emissão", data], ["Responsável pelo conteúdo", c.responsavel_nome || "—"],
  ];
  if (c.carga_horaria_min) l.push(["Carga horária", `${(c.carga_horaria_min / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h (${c.carga_horaria_min} min)`]);
  if (c.nota != null) l.push(["Nota na avaliação", Number(c.nota).toLocaleString("pt-BR")]);
  l.push(["Código de verificação", c.codigo]);
  return l;
}
export const AVISO_CERTIFICADO = "Este documento registra a conclusão do treinamento conforme os critérios da versão indicada. Não substitui a validação de competência prática, quando exigida.";

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
    questoes: (det.questoes || []).map((q) => ({ tipo: q.tipo, enunciado: q.enunciado, feedback: q.feedback || "", opcoes: q.opcoes.map((o) => ({ texto: o.texto, correta: !!o.correta })) })),
  };
}

// Carga horária total sugerida (soma das durações informadas), só como ajuda.
export const duracaoTotalMin = (modulos) =>
  modulos.reduce((t, m) => t + m.aulas.reduce((s, a) => s + (Number(a.duracaoMin) || 0), 0), 0);

// Importa um modelo de curso (.json) para o formulário do rascunho. Só valida o
// formato; o conteúdo continua passando pelas regras do servidor ao salvar.
const TIPOS = TIPOS_AULA.map((t) => t.valor);
export function formularioDeModelo(modelo, atual) {
  if (!modelo || typeof modelo !== "object" || !Array.isArray(modelo.modulos)) throw new Error("Arquivo inválido: não é um modelo de treinamento da Academy.");
  if (modelo.modulos.length > 50) throw new Error("Modelo com módulos demais.");
  const txt = (v) => (v == null ? "" : String(v));
  const modulos = modelo.modulos.map((m, i) => {
    if (!Array.isArray(m?.aulas)) throw new Error(`Módulo ${i + 1} sem lista de aulas.`);
    return { titulo: txt(m.titulo), descricao: txt(m.descricao), aulas: m.aulas.map((a, j) => {
      if (!TIPOS.includes(a?.tipo)) throw new Error(`Aula ${i + 1}.${j + 1}: tipo "${txt(a?.tipo)}" não é aceito.`);
      return { titulo: txt(a.titulo), tipo: a.tipo, conteudo: a.conteudo && typeof a.conteudo === "object" ? a.conteudo : {}, duracaoMin: a.duracaoMin ?? "" };
    }) };
  });
  const questoes = (Array.isArray(modelo.questoes) ? modelo.questoes : []).map((q, i) => {
    if (!TIPOS_QUESTAO.some((t) => t.valor === q?.tipo) || !Array.isArray(q.opcoes)) throw new Error(`Questão ${i + 1}: formato inválido.`);
    return { tipo: q.tipo, enunciado: txt(q.enunciado), feedback: txt(q.feedback), opcoes: q.opcoes.map((o) => ({ texto: txt(o?.texto), correta: o?.correta === true })) };
  });
  const materiais = (Array.isArray(modelo.materiais) ? modelo.materiais : []).map((m) => ({ titulo: txt(m?.titulo), url: txt(m?.url) }));
  // Critérios de avaliação vindos do arquivo só valem se a modalidade existir e estiver disponível.
  const modalidade = MODALIDADES.some((m) => m.valor === modelo.modalidade && m.disponivel) ? modelo.modalidade : "nenhuma";
  return { ...atual, titulo: txt(modelo.titulo) || atual.titulo, descricao: txt(modelo.descricao), modalidade,
    obrigatorio: modelo.obrigatorio === true, prazoDias: modelo.prazoDias ?? "", validadeMeses: modelo.validadeMeses ?? "",
    cargaHorariaMin: modelo.cargaHorariaMin ?? "", exigeQualidade: modelo.exigeQualidade === true, notasVersao: txt(modelo.notasVersao),
    notaMinima: modelo.notaMinima ?? "", maxTentativas: modelo.maxTentativas ?? "", modulos, materiais, questoes };
}
