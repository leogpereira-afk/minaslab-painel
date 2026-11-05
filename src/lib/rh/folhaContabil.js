// LEITURA DOS RELATÓRIOS DA CONTABILIDADE (folha de pagamento), sem tela e sem rede.
//
// A contabilidade manda, todo mês, PDFs do sistema de folha dela. Dois servem para
// conferir a folha no painel:
//   · RELAÇÃO DE EVENTOS — um bloco por evento ("0001 - Horas Normais", "0302 - INSS",
//     "1003 - Líquido Folha"…) e, dentro dele, uma linha por colaborador com
//     cadastro, nome, situação, competência, pagamento, referência e valor. É o
//     relatório completo: dele saem salário, descontos, FGTS e líquido.
//   · RELAÇÃO DE LÍQUIDOS — só o líquido de cada um (serve de conferência rápida).
//
// A entrada são as LINHAS do PDF, com as células separadas por " | " (o leitor de
// PDF da tela monta as linhas pela posição do texto). A saída é a mesma para os
// dois relatórios: empresa, competência e, por colaborador, os eventos e o líquido.
//
// Classificar provento × desconto pelo NOME do evento tem risco, por isso a soma é
// CONFERIDA contra o "Líquido" que a própria contabilidade imprime: se não bater, a
// pessoa sai com `confere: false` e a tela avisa — número que não fecha não é
// apresentado como certo.

const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
export const numeroBR = (s) => {
  const t = String(s ?? "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;
const celulas = (linha) => String(linha ?? "").split("|").map((c) => c.trim()).filter(Boolean);

/** Que relatório é este: "eventos", "liquidos" ou null (não reconhecido). */
export function tipoDeRelatorio(linhas) {
  const t = normalizar((linhas || []).slice(0, 8).join(" "));
  if (/relacao (de )?eventos/.test(t)) return "eventos";
  if (/relacao (de )?liquidos/.test(t)) return "liquidos";
  return null;
}

/** Empresa do cabeçalho: "0423 - M Lab Servicos Ltda" → { codigo: "0423", nome: "M Lab Servicos Ltda" }. */
export function empresaDoRelatorio(linhas) {
  for (const l of (linhas || []).slice(0, 4)) {
    const m = String(l).replace(/\s*\|\s*/g, " ").match(/^\s*(\d{3,5})\s*-?\s*([^|]+?)\s+(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s*)?(?:Pág\.?:?.*)?$/i);
    if (m) return { codigo: m[1].padStart(4, "0"), nome: m[2].replace(/\s+Pág.*$/i, "").trim() };
  }
  return { codigo: "", nome: "" };
}

/** Competência "AAAA-MM" do "Período: 10/2026 a 10/2026" (ou da coluna Competência das linhas). */
export function competenciaDoRelatorio(linhas) {
  const texto = (linhas || []).join(" ");
  const m = texto.match(/Per[ií]odo:?\s*\|?\s*(?:\d{2}\/)?(\d{2})\/(\d{4})/i) || texto.match(/\|\s*(\d{2})\/(\d{4})\s*\|/);
  return m ? `${m[2]}-${m[1]}` : "";
}

/* O que é desconto, o que é só informativo (encargo da empresa) e o que é o líquido. */
export function classificarEvento(codigo, descricao) {
  const d = normalizar(descricao);
  if (/^liquido/.test(d)) return "liquido";
  if (/fgts/.test(d)) return "informativo";
  if (/inss|irrf|imposto|desconto|adiantamento|vale|falta|atraso|pensao|contribuicao|mensalidade|emprestimo|troco mes anterior|faltas|dsr s\/ faltas/.test(d)) return "desconto";
  return "provento";
}

const ehLinhaColaborador = (c) => c.length >= 4 && /^\d{1,6}$/.test(c[0]) && /[a-z]/i.test(c[1] || "") && numeroBR(c[c.length - 1]) !== null;

/**
 * Lê as linhas de um relatório. Devolve:
 * { tipo, empresa, competencia, pessoas: [{ cadastro, nome, situacao, eventos, proventos, descontos, informativos, liquido, liquidoCalculado, confere, salarioBase }] }
 */
export function lerRelatorioFolha(linhas) {
  const tipo = tipoDeRelatorio(linhas);
  const empresa = empresaDoRelatorio(linhas);
  const competencia = competenciaDoRelatorio(linhas);
  const porCadastro = new Map();
  const pessoa = (cadastro, nome, situacao) => {
    const k = String(Number(cadastro));
    if (!porCadastro.has(k)) porCadastro.set(k, { cadastro: k, nome: String(nome || "").trim(), situacao: situacao || "", eventos: [], liquido: null });
    return porCadastro.get(k);
  };

  if (tipo === "eventos") {
    let evento = null;
    for (const l of linhas || []) {
      const c = celulas(l);
      if (!c.length) continue;
      // "0001 | - | Horas Normais" (ou "0001 - Horas Normais" numa célula só)
      const cab = c.join(" ").match(/^(\d{4})\s*-\s*(.+)$/);
      if (cab && !ehLinhaColaborador(c)) {
        evento = { codigo: cab[1], descricao: cab[2].trim(), tipo: classificarEvento(cab[1], cab[2]) };
        continue;
      }
      if (!evento || !ehLinhaColaborador(c) || /^total/i.test(c[0])) continue;
      // cadastro | nome | sit | competência | pagamento | referência | valor
      const valor = numeroBR(c[c.length - 1]);
      const referencia = numeroBR(c[c.length - 2]);
      const situacao = /^\d{3}$/.test(c[2] || "") ? c[2] : "";
      const p = pessoa(c[0], c[1], situacao);
      if (evento.tipo === "liquido") p.liquido = arred((p.liquido || 0) + valor);
      else p.eventos.push({ codigo: evento.codigo, descricao: evento.descricao, tipo: evento.tipo, referencia, valor });
    }
  } else if (tipo === "liquidos") {
    for (const l of linhas || []) {
      const c = celulas(l);
      // ordem | cadastro | nome | situação | descrição | pagamento | valor
      if (c.length >= 5 && /^\d{3,6}$/.test(c[0]) && /^\d{1,6}$/.test(c[1]) && /[a-z]/i.test(c[2])) {
        const p = pessoa(c[1], c[2], /^\d{3}$/.test(c[3]) ? c[3] : "");
        p.liquido = numeroBR(c[c.length - 1]);
      }
    }
  }

  const pessoas = [...porCadastro.values()].map((p) => {
    const soma = (t) => arred(p.eventos.filter((e) => e.tipo === t).reduce((s, e) => s + e.valor, 0));
    const proventos = soma("provento"), descontos = soma("desconto"), informativos = soma("informativo");
    const liquidoCalculado = p.eventos.length ? arred(proventos - descontos) : null;
    /* SALÁRIO DE 220h: o valor-hora das "Horas Normais" (ou do pró-labore) vezes 220.
       Mês quebrado (admissão, atestado) não engana: é o valor-hora que se compara. */
    const horas = p.eventos.find((e) => /^horas (normais|pro-?labore)/.test(normalizar(e.descricao)) && e.referencia > 0);
    const salarioBase = horas ? arred((horas.valor / horas.referencia) * 220) : null;
    return {
      ...p,
      proventos, descontos, informativos,
      liquidoCalculado,
      confere: p.liquido === null || liquidoCalculado === null ? null : Math.abs(liquidoCalculado - p.liquido) < 0.05,
      salarioBase,
      fgts: arred(p.eventos.filter((e) => /fgts/.test(normalizar(e.descricao))).reduce((s, e) => s + e.valor, 0)),
      inss: arred(p.eventos.filter((e) => /inss/.test(normalizar(e.descricao))).reduce((s, e) => s + e.valor, 0)),
      rescisao: p.situacao === "007" || p.eventos.some((e) => /rescis/.test(normalizar(e.descricao))),
    };
  });
  return { tipo, empresa, competencia, pessoas };
}

/* ---------------------------------------------------------------- casar com o RH */
const PALAVRAS_FRACAS = new Set(["de", "da", "do", "das", "dos", "e"]);
const tokens = (s) => normalizar(s).split(" ").filter((t) => t && !PALAVRAS_FRACAS.has(t));

/**
 * A ficha do RH desta pessoa do relatório: nome igual (sem acento, sem maiúscula);
 * senão, todas as palavras de um nome dentro do outro, com UMA ficha só candidata
 * ("Ruth Oliveira" → "Ruth Dias Oliveira"). Ambíguo ou nada: null — melhor pedir
 * para escolher do que pôr o holerite na pessoa errada.
 */
export function casarPessoa(nome, fichas) {
  const alvo = tokens(nome);
  if (!alvo.length) return null;
  const chave = alvo.join(" ");
  const iguais = (fichas || []).filter((f) => tokens(f.nome).join(" ") === chave);
  if (iguais.length === 1) return iguais[0];
  if (iguais.length > 1) return null;
  const contem = (fichas || []).filter((f) => {
    const t = new Set(tokens(f.nome));
    const o = tokens(f.nome);
    return (alvo.length >= 2 && alvo.every((x) => t.has(x))) || (o.length >= 2 && o.every((x) => alvo.includes(x)));
  });
  return contem.length === 1 ? contem[0] : null;
}
