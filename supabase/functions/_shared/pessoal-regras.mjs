// Pessoal e competência (ISO/IEC 17025 · 6.2; PT 001). Regras usadas pelo servidor e pela tela,
// testadas em src/lib/pessoalQualidade.test.mjs.

export const ORIGENS_TREINAMENTO = [
  ["PAT", "Plano anual (PAT)"], ["EVENTUAL", "Eventual (COTRE)"], ["INTEGRACAO", "Integração de novo colaborador"],
  ["NC", "Não conformidade"], ["DOCUMENTO", "Revisão de documento"], ["EXTERNO", "Curso externo"],
];
export const STATUS_MATRIZ = [["LIBERADO", "Liberado"], ["EM_TREINAMENTO", "Em treinamento"], ["NAO_APLICA", "Não se aplica"]];
// AVET: as quatro perguntas e a escala de 1 a 5 do formulário atual.
export const PERGUNTAS_AVET = [
  ["nota_conhecimento", "Com relação ao grau de conhecimento atual da metodologia provida pelo treinamento", ["Não possui o conhecimento mínimo da metodologia para sua aplicação.", "Apresenta deficiências nos conceitos, o que compromete a aplicação.", "Possui noções básicas, mas necessita acompanhamento e suporte na aplicação.", "Possui o domínio necessário da metodologia e a utiliza adequadamente.", "Possui o completo domínio e a utiliza dentro de uma perspectiva de excelência."]],
  ["nota_aplicacao", "Com relação à aplicação, quando necessário, dos conceitos da metodologia", ["Está muito abaixo do esperado.", "Aplicação está abaixo do esperado.", "Aplicação é razoável, mas não dentro do esperado.", "Boa aplicação da metodologia; corresponde às expectativas.", "Aplicação excede as expectativas."]],
  ["nota_resultados", "Com relação aos resultados obtidos com a aplicação na melhoria das atividades, processos ou serviços", ["Nenhum resultado foi obtido efetivamente até o momento.", "As melhorias obtidas estão muito abaixo do esperado.", "As melhorias obtidas são consideráveis, mas não dentro do esperado.", "As melhorias obtidas são boas e estão dentro do esperado.", "As melhorias obtidas excederam as expectativas."]],
  ["nota_geral", "De forma geral, como foi avaliada a eficácia do treinamento? (1 pouco eficaz · 5 muito eficaz)", null],
];
export const DIAS_EFICACIA = 30;        // PT 001: avaliar a eficácia 1 mês após o treinamento
export const DIAS_SUPERVISAO = 90;      // PT 001: novo colaborador treinado e supervisionado em até 90 dias
export const META_PAT = 80;             // PT 001: realizar no mínimo 80% do PAT no ano

const ymd = (d) => d.toISOString().slice(0, 10);
export const somaDias = (dataYmd, dias) => { const d = new Date(`${dataYmd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return ymd(d); };

/** Próximo número do ano para um prefixo: "TRE 001/2026", "AUTZ 001/2026". */
export function proximoCodigoAno(prefixo, codigosExistentes, ano) {
  const re = new RegExp(`^${prefixo} (\\d+)/${ano}$`);
  const max = Math.max(0, ...codigosExistentes.map((c) => Number(String(c).match(re)?.[1]) || 0));
  return `${prefixo} ${String(max + 1).padStart(3, "0")}/${ano}`;
}

/** Participantes ainda sem avaliação de eficácia, e se o prazo (1 mês) já passou. */
export function pendenciasEficacia(treinamento, avaliacoes, hojeYmd) {
  if (treinamento.status !== "REALIZADO") return { pendentes: [], atrasada: false };
  const feitos = new Set(avaliacoes.filter((a) => a.treinamento_id === treinamento.id).map((a) => String(a.pessoa_id)));
  const pendentes = (treinamento.participantes || []).filter((p) => !feitos.has(String(p.id)));
  const prazo = treinamento.eficacia_prevista || (treinamento.data ? somaDias(treinamento.data, DIAS_EFICACIA) : null);
  return { pendentes, prazo, atrasada: pendentes.length > 0 && !!prazo && prazo < hojeYmd };
}

/** Novo colaborador ainda no período de treinamento e supervisão (até 90 dias da admissão). */
export function emSupervisao(pessoa, hojeYmd) {
  if (!pessoa?.admissao || pessoa.ativo === false) return null;
  const fim = somaDias(String(pessoa.admissao).slice(0, 10), DIAS_SUPERVISAO);
  return fim >= hojeYmd ? fim : null;
}

/** Cumprimento do PAT no ano: realizados ÷ (planejados + realizados que vieram do PAT), cancelados fora. */
export function cumprimentoPat(treinamentos, ano) {
  const doPat = treinamentos.filter((t) => t.origem === "PAT" && String(t.data || "").startsWith(String(ano)) && t.status !== "CANCELADO");
  const feitos = doPat.filter((t) => t.status === "REALIZADO").length;
  return { previstos: doPat.length, realizados: feitos, pct: doPat.length ? Math.round((feitos / doPat.length) * 100) : null };
}

/** Validação da avaliação de eficácia (AVET). Devolve a mensagem do problema, ou null. */
export function faltaNaEficacia(a) {
  for (const [k, rot] of PERGUNTAS_AVET) {
    const n = Number(a[k]);
    if (!(n >= 1 && n <= 5)) return `Responda: ${rot}.`;
  }
  if (a.eficaz !== true && a.eficaz !== false) return "Diga se o treinamento foi eficaz.";
  if (a.eficaz === false && !String(a.plano_acao || "").trim()) return "Treinamento não eficaz: registre o plano de ação.";
  return null;
}
