// Gastos com manutenção e busca de alvos — funções puras da página Manutenções.

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

// itens: todas as manutenções; hojeISO: 'YYYY-MM-DD'.
// gasto = FEITAS no ano corrente; previsto = AGENDADAS (o que ainda vamos gastar).
export function resumoGastos(itens = [], hojeISO = "") {
  const ano = String(hojeISO).slice(0, 4);
  const feitasAno = itens.filter((m) => m.status === "feita" && String(m.data || "").slice(0, 4) === ano);
  const agendadas = itens.filter((m) => m.status === "agendada");
  const atrasadas = agendadas.filter((m) => m.data && String(m.data) < hojeISO);
  return {
    ano,
    gasto: { ...somar(feitasAno), porCategoria: porCategoria(feitasAno) },
    previsto: { ...somar(agendadas), porCategoria: porCategoria(agendadas), atrasadas: somar(atrasadas) },
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
