// Regras do Comercial, num lugar só e sem tela: metas, pontos de atenção,
// avaliação e bônus. Tudo aqui é função pura, testada em calculos.test.mjs.
// Se uma regra mudar, muda AQUI — a tela só mostra.

import { mesesAte, somarMeses, numero } from "./format.js";

export const CRITERIOS_TECNICOS = [
  { id: "org", nome: "Organização", desc: "CRM, documentos e propostas em ordem" },
  { id: "com", nome: "Comunicação", desc: "Retorno ao cliente, alinhamento com a equipe" },
  { id: "atd", nome: "Atendimento ao cliente", desc: "Negociação, cordialidade, pós-venda" },
  { id: "iso", nome: "Conformidade ISO 17025", desc: "Registros, POPs, rastreabilidade" },
];
export const CRITERIOS_COMPORTAMENTAIS = [
  { id: "pro", nome: "Proatividade" },
  { id: "eq", nome: "Trabalho em equipe" },
  { id: "resp", nome: "Responsabilidade e pontualidade" },
  { id: "qual", nome: "Comprometimento com a qualidade" },
];

export const TIPOS_OCORRENCIA = [
  "Erro em proposta",
  "Retrabalho",
  "Comunicação",
  "Atendimento",
  "CRM desatualizado",
  "Não conformidade POP",
  "Prazo perdido",
  "Outra",
];

export const CONFIG_PADRAO = {
  id: "geral",
  bonus: { f1: 9, v1: 100, f2: 8, v2: 50 },
  pesos: { metas: 50, tec: 30, comp: 20 },
  desconto: 0.5,
  descontoMax: 2,
  metaValorMensal: null,
};

const VAZIO = { enviadas: 0, aprovadas: 0, recusadas: 0, abertas: 0, valorAprovado: 0 };

export function configCompleta(cfg) {
  const c = cfg || {};
  return {
    ...CONFIG_PADRAO,
    ...c,
    bonus: { ...CONFIG_PADRAO.bonus, ...(c.bonus || {}) },
    pesos: { ...CONFIG_PADRAO.pesos, ...(c.pesos || {}) },
  };
}

/** Números do CRM de UMA pessoa (pelo vínculo crmProfileId) em um mês. */
export function realizado(resumo, membro, mes) {
  const pid = membro?.crmProfileId;
  const v = (pid && resumo?.porMes?.[mes]?.porPessoa?.[pid]) || VAZIO;
  const r = { ...VAZIO, ...v };
  r.taxa = r.enviadas ? (r.aprovadas / r.enviadas) * 100 : null;
  return r;
}

/** Totais da equipe inteira no mês (inclui quem não está cadastrado e as sem responsável). */
export function totaisMes(resumo, mes) {
  const t = { ...VAZIO, ...(resumo?.porMes?.[mes]?.total || {}) };
  const sem = { ...VAZIO, ...(resumo?.porMes?.[mes]?.porPessoa?._sem || {}) };
  return {
    ...t,
    taxa: t.enviadas ? (t.aprovadas / t.enviadas) * 100 : null,
    semResponsavel: sem.enviadas,
    pctSemResponsavel: t.enviadas ? (sem.enviadas / t.enviadas) * 100 : 0,
  };
}

/** Média de propostas enviadas nos `n` meses anteriores que tiveram movimento. */
export function mediaAnterior(resumo, membro, mes, n = 6) {
  const meses = mesesAte(somarMeses(mes, -1), n);
  const vals = meses.map((m) => realizado(resumo, membro, m).enviadas).filter((x) => x > 0);
  if (!vals.length) return null;
  return vals.reduce((s, x) => s + x, 0) / vals.length;
}

export function metasDe(membro) {
  const m = membro?.metas || {};
  return { propostas: numero(m.propostas), aprovacao: numero(m.aprovacao), ligacoes: numero(m.ligacoes) };
}

/** Situação de uma pessoa frente às metas: na meta, atenção, abaixo ou sem meta. */
export function situacao(real, metas) {
  if (!metas.propostas) return { rotulo: "Sem meta", tom: "neutro" };
  const p = real.enviadas / metas.propostas;
  const aprovOk = !metas.aprovacao || (real.taxa != null && real.taxa >= metas.aprovacao);
  if (p >= 1 && aprovOk) return { rotulo: "Na meta", tom: "ok" };
  if (p >= 0.8) return { rotulo: "Atenção", tom: "alerta" };
  return { rotulo: "Abaixo", tom: "ruim" };
}

/**
 * Pontos fortes e a melhorar de uma pessoa no mês, a partir dos números.
 * Cada ponto: { tom: ok|alerta|ruim, tipo, titulo, texto }.
 */
export function pontos(resumo, membro, mes, nOcorrencias = 0) {
  const metas = metasDe(membro);
  const r = realizado(resumo, membro, mes);
  const avg = mediaAnterior(resumo, membro, mes);
  const out = [];

  if (!membro?.crmProfileId) {
    out.push({ tom: "alerta", tipo: "vinculo", titulo: "Sem vínculo com o CRM", texto: "Vincule a pessoa ao usuário do CRM em Equipe e metas para puxar os números." });
    return out;
  }

  if (metas.propostas) {
    if (r.enviadas >= metas.propostas) {
      out.push({ tom: "ok", tipo: "propostas", titulo: `Meta de propostas batida: ${r.enviadas} de ${metas.propostas}`, texto: "Reconheça na conversa do mês." });
    } else {
      const falta = metas.propostas - r.enviadas;
      out.push({
        tom: "ruim", tipo: "propostas",
        titulo: `${r.enviadas} de ${metas.propostas} propostas (${Math.round((r.enviadas / metas.propostas) * 100)}% da meta)`,
        texto: `Faltaram ${falta}. Em ritmo semanal, a meta pede cerca de ${Math.ceil(metas.propostas / 4)} por semana.`,
      });
    }
  } else {
    out.push({ tom: "alerta", tipo: "sem-meta", titulo: "Sem meta de propostas definida", texto: "Defina em Equipe e metas para acompanhar de verdade." });
  }

  if (r.taxa != null && metas.aprovacao) {
    if (r.taxa >= metas.aprovacao) {
      out.push({ tom: "ok", tipo: "aprovacao", titulo: `Aprovação de ${Math.round(r.taxa)}% (meta ${metas.aprovacao}%)`, texto: `${r.aprovadas} aprovadas de ${r.enviadas} enviadas.` });
    } else {
      out.push({ tom: "ruim", tipo: "aprovacao", titulo: `Aprovação de ${Math.round(r.taxa)}% (meta ${metas.aprovacao}%)`, texto: `${r.aprovadas} aprovadas de ${r.enviadas}; ${r.abertas} ainda sem resposta. Revisar as paradas e fazer follow-up.` });
    }
  } else if (r.taxa != null && r.taxa >= 60 && r.enviadas >= 5) {
    out.push({ tom: "ok", tipo: "aprovacao", titulo: `Boa aprovação: ${Math.round(r.taxa)}%`, texto: `${r.aprovadas} aprovadas de ${r.enviadas} enviadas.` });
  }

  if (avg != null && avg >= 5) {
    if (r.enviadas === 0) {
      out.push({ tom: "alerta", tipo: "queda", titulo: "Nenhuma proposta no mês", texto: `A média era ${Math.round(avg)} por mês. A função mudou ou as propostas ficaram sem responsável?` });
    } else if (r.enviadas < avg * 0.7) {
      out.push({ tom: "ruim", tipo: "queda", titulo: `Queda de ${Math.round((1 - r.enviadas / avg) * 100)}% em relação à média`, texto: `Média dos meses anteriores: ${Math.round(avg)} propostas. Parte pode estar entre as propostas sem responsável.` });
    } else if (r.enviadas > avg * 1.15) {
      out.push({ tom: "ok", tipo: "alta", titulo: `Acima da própria média (${Math.round(avg)} por mês)`, texto: "Crescimento consistente." });
    }
  }

  if (metas.ligacoes) {
    out.push({ tom: "alerta", tipo: "ligacoes", titulo: `Ligações sem medição (meta ${metas.ligacoes} por dia)`, texto: "As ligações ainda não são registradas no CRM." });
  }
  if (nOcorrencias > 0) {
    out.push({ tom: "ruim", tipo: "ocorrencias", titulo: `${nOcorrencias} ocorrência${nOcorrencias > 1 ? "s" : ""} no mês`, texto: "Veja os fatos em Ocorrências antes da conversa." });
  }
  return out;
}

const COMBINADOS = {
  propostas: (metas) => (metas.propostas ? `Meta semanal de ${Math.ceil(metas.propostas / 4)} propostas, conferida toda segunda.` : null),
  "sem-meta": () => "Acordar a meta de propostas do próximo mês.",
  aprovacao: () => "Revisar juntas as propostas paradas e fazer follow-up em até 7 dias.",
  queda: () => "Entender a causa da queda: mudança de função, propostas sem responsável ou menos demanda.",
  ligacoes: () => "Combinar como as ligações passam a ser registradas no CRM.",
  ocorrencias: () => "Repassar as ocorrências do mês e o que muda para não repetir.",
  vinculo: () => null,
};

/** Roteiro do feedback mensal: o que foi bem, o que melhorar, combinados sugeridos. */
export function roteiroFeedback(lista, membro) {
  const metas = metasDe(membro);
  const bom = lista.filter((p) => p.tom === "ok").map((p) => p.titulo);
  const melhorar = lista.filter((p) => p.tom !== "ok" && p.tipo !== "vinculo").map((p) => p.titulo);
  const combinar = [];
  for (const p of lista) {
    if (p.tom === "ok") continue;
    const c = COMBINADOS[p.tipo]?.(metas);
    if (c && !combinar.includes(c)) combinar.push(c);
  }
  return {
    bom: bom.length ? bom : ["Procure um fato positivo do mês: um cliente que elogiou, uma proposta difícil fechada."],
    melhorar: melhorar.length ? melhorar : ["Nenhum ponto crítico nos números."],
    combinar: combinar.length ? combinar : ["Manter o ritmo e definir um desafio para o próximo mês."],
  };
}

const media = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * Avaliação mensal. Nota base = média ponderada dos grupos que têm nota
 * (metas automáticas, técnicos, comportamentais); nota final = base − desconto
 * por ocorrência (com teto). Bônus pela NOTA FINAL e só com tudo preenchido.
 */
export function avaliar({ resumo, membro, mes, notas = {}, nOcorrencias = 0, config, criteriosTecnicos }) {
  const cfg = configCompleta(config);
  const metas = metasDe(membro);
  const r = realizado(resumo, membro, mes);

  // Meta em branco ou zero = não se aplica (o cadastro da equipe pede "deixe em
  // branco o que não se aplica"; ex.: coletor não envia propostas). O que não
  // se aplica não entra na nota nem trava a avaliação.
  const auto = [
    {
      id: "vol", nome: "Volume de propostas",
      desc: metas.propostas ? `${r.enviadas} de ${metas.propostas} no mês` : "não se aplica (sem meta de propostas)",
      nota: metas.propostas ? Math.min(10, (r.enviadas / metas.propostas) * 10) : null,
      naoAplica: !metas.propostas,
    },
    {
      id: "aprov", nome: "Taxa de aprovação",
      desc: !metas.aprovacao ? "não se aplica (sem meta de aprovação)" : r.taxa == null ? "sem propostas no mês" : `${Math.round(r.taxa)}% (meta ${metas.aprovacao}%)`,
      nota: metas.aprovacao && r.taxa != null ? Math.min(10, (r.taxa / metas.aprovacao) * 10) : null,
      naoAplica: !metas.aprovacao,
    },
  ];

  const val = (id) => {
    const n = numero(notas[id]);
    return n == null ? null : Math.max(0, Math.min(10, n));
  };
  const listaTec = criteriosTecnicos?.length ? criteriosTecnicos : CRITERIOS_TECNICOS;
  const tec = listaTec.map((c) => ({ ...c, nota: val(c.id) }));
  const comp = CRITERIOS_COMPORTAMENTAIS.map((c) => ({ ...c, nota: val(c.id) }));

  const grupos = [
    { peso: cfg.pesos.metas, m: media(auto.map((c) => c.nota).filter((x) => x != null)) },
    { peso: cfg.pesos.tec, m: media(tec.map((c) => c.nota).filter((x) => x != null)) },
    { peso: cfg.pesos.comp, m: media(comp.map((c) => c.nota).filter((x) => x != null)) },
  ].filter((g) => g.m != null && g.peso > 0);

  const somaPesos = grupos.reduce((s, g) => s + g.peso, 0);
  const base = somaPesos ? grupos.reduce((s, g) => s + g.m * g.peso, 0) / somaPesos : null;
  const desconto = Math.min(cfg.descontoMax, cfg.desconto * nOcorrencias);
  const final = base == null ? null : Math.max(0, base - desconto);

  const faltamManuais = [...tec, ...comp].filter((c) => c.nota == null).length;
  const faltamMetas = auto.filter((c) => c.nota == null && !c.naoAplica).length;
  const completa = faltamManuais === 0 && faltamMetas === 0;

  let faixa = { rotulo: "Preencha os critérios", tom: "neutro" };
  let bonus = null;
  if (final != null && completa) {
    if (final >= cfg.bonus.f1) { faixa = { rotulo: "Excelente: 100% das metas", tom: "ok" }; bonus = numero(cfg.bonus.v1) || 0; }
    else if (final >= cfg.bonus.f2) { faixa = { rotulo: "Muito bom: 80% das metas", tom: "alerta" }; bonus = numero(cfg.bonus.v2) || 0; }
    else { faixa = { rotulo: "Abaixo do mínimo esperado", tom: "ruim" }; bonus = 0; }
  }

  const pendencias = [];
  if (faltamMetas) pendencias.push(`${faltamMetas} meta${faltamMetas > 1 ? "s" : ""} sem resultado no mês`);
  if (faltamManuais) pendencias.push(`${faltamManuais} critério${faltamManuais > 1 ? "s" : ""} sem nota`);

  return { auto, tec, comp, base, desconto, final, nOcorrencias, faixa, bonus, completa, pendencias };
}

/** Série mensal (para gráficos) de uma pessoa ou da equipe ("equipe"). */
export function serie(resumo, membroOuEquipe, ateMes, n = 9) {
  return mesesAte(ateMes, n).map((mes) => {
    const r = membroOuEquipe === "equipe" ? totaisMes(resumo, mes) : realizado(resumo, membroOuEquipe, mes);
    return { mes, enviadas: r.enviadas, aprovadas: r.aprovadas, valorAprovado: r.valorAprovado };
  });
}

/** Critérios técnicos da função (cargo) da pessoa; sem função, os padrão. */
export function criteriosDaFuncao(funcao) {
  const lista = (funcao?.criterios || []).filter((c) => c?.nome?.trim());
  return lista.length ? lista.map((c, i) => ({ id: c.id || `f${i}`, nome: c.nome, desc: c.desc || "" })) : CRITERIOS_TECNICOS;
}

/** Estilo de liderança sugerido pelo estágio da pessoa na tarefa (Liderança Situacional). */
export const ESTAGIOS = [
  { id: "iniciante", nome: "Iniciante", estilo: "Direcionar", texto: "Diga o quê, como e quando. Acompanhe de perto e corrija rápido." },
  { id: "aprendendo", nome: "Aprendendo", estilo: "Orientar", texto: "Explique o porquê, ouça as dúvidas e siga dando direção com mais conversa." },
  { id: "capaz", nome: "Capaz, mas inseguro", estilo: "Apoiar", texto: "Ela sabe fazer: pergunte como pretende fazer e dê confiança, não instrução." },
  { id: "autonomo", nome: "Autônomo", estilo: "Delegar", texto: "Combine o resultado e o prazo e saia da frente. Acompanhe pelos números." },
];

/**
 * Previsão de fechamento do mês (valor aprovado).
 * base = já aprovado + Σ valor × chance das propostas abertas;
 * pessimista = aprovado + só as com chance ≥ 50%; otimista = base + metade do que falta.
 */
export function previsaoMes({ aprovado, abertas }) {
  const soma = (xs) => xs.reduce((s, a) => s + a.valor * a.chance, 0);
  const base = aprovado + soma(abertas);
  const pess = aprovado + soma(abertas.filter((a) => a.chance >= 0.5));
  const total = aprovado + abertas.reduce((s, a) => s + a.valor, 0);
  const otim = base + (total - base) / 2;
  return { pessimista: pess, base, otimista: otim, emAberto: total - aprovado };
}

/**
 * Metas próprias de cada função, tiradas dos indicadores da descrição de
 * cargo ("Indicador — como medir — meta"). Cada função tem as suas; as metas
 * do CRM (propostas, aprovação, ligações) só valem para quem vende.
 */
export function metasDaFuncao(funcao) {
  return String(funcao?.kpis || "").split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => { const [indicador, medida = "", meta = ""] = l.split(/\s+[—–]\s+/); return { indicador: indicador.trim(), medida: medida.trim(), meta: meta.trim() }; })
    .filter((k) => k.indicador);
}

/**
 * A pessoa faz parte da equipe no mês? Entra a partir do mês de entrada
 * (`entrouEm`, opcional) e sai a partir do mês do desligamento: aparece só
 * até o mês ANTERIOR ao `desligadoEm`.
 * Inativa sem data de saída não aparece em mês nenhum.
 */
export function naEquipeNoMes(m, mes) {
  if (!m) return false;
  const entrou = String(m.entrouEm || "").slice(0, 7);
  if (entrou && mes < entrou) return false;
  if (m.ativo !== false) return true;
  const saiu = String(m.desligadoEm || "").slice(0, 7);
  return !!saiu && mes < saiu;
}
