// Gastos com manutenção, orçamento e busca de alvos — funções puras da página Manutenções.
import { proximasPorAlvo } from "./manutencaoRegra.js";

export const CATEGORIAS_ALVO = [
  { valor: "carro", rotulo: "Carros", singular: "Carro" },
  { valor: "equipamento", rotulo: "Equipamentos", singular: "Equipamento" },
  { valor: "bem", rotulo: "Patrimônio", singular: "Patrimônio" },
];

const semAcento = (v) =>
  String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();

const temValor = (c) => c !== null && c !== undefined && c !== "" && Number.isFinite(Number(c));
const arred = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Soma o custo informado de uma lista de manutenções. Custo em branco NÃO entra como zero:
// ausente não é "de graça" — vai contado à parte em semValor.
function somar(lista) {
  let total = 0, comValor = 0;
  for (const m of lista) {
    if (!temValor(m.custo)) continue;
    total += Number(m.custo);
    comValor += 1;
  }
  return { total: arred(total), comValor, semValor: lista.length - comValor, qtd: lista.length };
}

function porCategoria(lista) {
  const r = {};
  for (const c of CATEGORIAS_ALVO) r[c.valor] = somar(lista.filter((m) => m.alvoTipo === c.valor));
  return r;
}

export const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Calibrações que vão vencer até o fim do ano e ainda não têm agendamento: contam como gasto FUTURO ESTIMADO,
// com o custo da última calibração feita do mesmo alvo (sem histórico de custo, ficam "sem valor").
export function estimarCalibracoes(itens = [], hojeISO = "") {
  const fim = `${String(hojeISO).slice(0, 4)}-12-31`;
  const agendadas = itens.filter((m) => m.status === "agendada");
  const estimadas = [];
  for (const m of proximasPorAlvo(itens).values()) {
    if (m.tipo !== "calibracao" || !m.proxima || String(m.proxima) > fim) continue;
    if (agendadas.some((a) => a.alvoTipo === m.alvoTipo && a.alvoId === m.alvoId && a.tipo === "calibracao")) continue;
    estimadas.push({
      id: `estimada|${m.alvoTipo}|${m.alvoId}`, alvoTipo: m.alvoTipo, alvoId: m.alvoId, alvoNome: m.alvoNome,
      tipo: "calibracao", status: "estimada", data: m.proxima, custo: temValor(m.custo) ? Number(m.custo) : null, estimado: true,
    });
  }
  return estimadas;
}

// itens: todas as manutenções; hojeISO: 'YYYY-MM-DD'.
// gasto = FEITAS no ano corrente; previsto (a gastar) = AGENDADAS + calibrações estimadas a vencer.
export function resumoGastos(itens = [], hojeISO = "") {
  const ano = String(hojeISO).slice(0, 4);
  const feitasAno = itens.filter((m) => m.status === "feita" && String(m.data || "").slice(0, 4) === ano);
  const agendadas = itens.filter((m) => m.status === "agendada");
  const estimadas = estimarCalibracoes(itens, hojeISO);
  const aGastar = [...agendadas, ...estimadas];
  const atrasadas = aGastar.filter((m) => m.data && String(m.data) < hojeISO);
  return {
    ano,
    gasto: { ...somar(feitasAno), porCategoria: porCategoria(feitasAno) },
    previsto: {
      ...somar(aGastar), porCategoria: porCategoria(aGastar), atrasadas: somar(atrasadas),
      agendadas: somar(agendadas), estimadas: somar(estimadas),
    },
    estimadas,
  };
}

// 12 meses do ano: feito (feitas), previsto (agendadas) e estimado (calibrações a vencer), só com custo informado.
export function gastoPorMes(itens = [], estimadas = [], ano = "") {
  const meses = MESES_ABREV.map((rotulo, mes) => ({ mes, rotulo, feito: 0, previsto: 0, estimado: 0 }));
  const indice = (data) => (String(data || "").slice(0, 4) === ano ? Number(String(data).slice(5, 7)) - 1 : -1);
  for (const m of itens) {
    if (!temValor(m.custo)) continue;
    const i = indice(m.data);
    if (i < 0 || i > 11) continue;
    if (m.status === "feita") meses[i].feito += Number(m.custo);
    else if (m.status === "agendada") meses[i].previsto += Number(m.custo);
  }
  for (const e of estimadas) {
    if (!temValor(e.custo)) continue;
    const i = indice(e.data);
    if (i >= 0 && i <= 11) meses[i].estimado += Number(e.custo);
  }
  return meses.map((m) => ({ ...m, feito: arred(m.feito), previsto: arred(m.previsto), estimado: arred(m.estimado) }));
}

// Quem mais custa: soma do custo das manutenções FEITAS por alvo (ano informado, ou todo o período se vazio).
export function rankingGastos(itens = [], { ano = "", limite = 8 } = {}) {
  const mapa = new Map();
  for (const m of itens) {
    if (m.status !== "feita") continue;
    if (ano && String(m.data || "").slice(0, 4) !== ano) continue;
    const chave = `${m.alvoTipo}|${m.alvoId}`;
    const a = mapa.get(chave) || { chave, alvoTipo: m.alvoTipo, alvoId: m.alvoId, nome: m.alvoNome || "(alvo sem nome)", total: 0, qtd: 0, semValor: 0, ultima: "" };
    a.qtd += 1;
    if (temValor(m.custo)) a.total += Number(m.custo); else a.semValor += 1;
    if (String(m.data || "") >= a.ultima) { a.ultima = String(m.data || ""); a.nome = m.alvoNome || a.nome; }
    mapa.set(chave, a);
  }
  return [...mapa.values()]
    .filter((a) => a.total > 0)
    .map((a) => ({ ...a, total: arred(a.total) }))
    .sort((x, y) => y.total - x.total || x.nome.localeCompare(y.nome, "pt-BR"))
    .slice(0, limite);
}

// Orçamento anual: guardado como registro de configuração na própria coleção de manutenções
// (status "config", ignorado por Home e Calendário, que só olham agendada/feita).
export const idOrcamento = (ano) => `orcamento-${ano}`;
export function orcamentoDoAno(registros = [], ano = "") {
  const r = registros.find((m) => m.id === idOrcamento(ano) && m.status === "config");
  return r && temValor(r.valor) && Number(r.valor) > 0 ? Number(r.valor) : null;
}
export function situacaoOrcamento(orcamento, gasto = 0, previsto = 0) {
  if (!(orcamento > 0)) return null;
  const pctGasto = Math.min(100, (gasto / orcamento) * 100);
  const pctPrevisto = Math.max(0, Math.min(100 - pctGasto, (previsto / orcamento) * 100));
  return {
    orcamento, gasto, previsto, restante: arred(orcamento - gasto - previsto),
    pctGasto: Math.round(pctGasto * 10) / 10, pctPrevisto: Math.round(pctPrevisto * 10) / 10,
    acima: gasto + previsto > orcamento, gastoAcima: gasto > orcamento,
  };
}

// Opções do seletor de "Manutenção de quê": carros, equipamentos e bens do patrimônio numa lista só.
export function montarOpcoesAlvo({ carros = [], equipamentos = [], bens = [] } = {}) {
  const detalheBem = (b) => [b.setor || b.setorSigla, b.situacao && b.situacao !== "ativo" ? b.situacao : ""].filter(Boolean).join(" · ");
  return [
    ...carros.map((c) => ({ ...c, tipoAlvo: "carro", detalhe: [c.placa, c.modelo].filter(Boolean).join(" · ") })),
    ...equipamentos.map((e) => ({ ...e, tipoAlvo: "equipamento", detalhe: "" })),
    ...bens.map((b) => ({ ...b, tipoAlvo: "bem", detalhe: detalheBem(b) })),
  ];
}

const CAMPOS_BUSCA = ["nome", "placa", "modelo", "codigo", "nomeGenerico", "marca", "serie", "numeroSerie", "setor", "setorSigla", "detalhe"];

// Filtra por categoria e por texto digitado (sem acento, sem diferença de maiúscula; todas as palavras precisam aparecer).
export function buscarAlvos(opcoes = [], termo = "", categoria = "") {
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean);
  return opcoes.filter((o) => {
    if (categoria && o.tipoAlvo !== categoria) return false;
    if (!palavras.length) return true;
    const palheiro = semAcento(CAMPOS_BUSCA.map((c) => o[c]).filter(Boolean).join(" "));
    return palavras.every((p) => palheiro.includes(p));
  });
}
