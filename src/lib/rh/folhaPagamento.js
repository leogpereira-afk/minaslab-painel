// FOLHA DE PAGAMENTO (conferência do mês) — as contas, sem tela e sem rede.
//
// Nasceu da planilha "Funcionarios.xlsx" da MinasLab (05/11/2026), com as mesmas
// colunas, mas cada número com uma origem só:
//   · salário, vínculo, empresa que paga e km da ajuda de custo → ficha do RH;
//   · banco de horas → Ponto (a mesma conta da Folha de Ponto Mensal);
//   · comissão → fechamento de comissões do Gestão;
//   · líquido, descontos e FGTS → relatórios da contabilidade importados.
// Na planilha o salário estava diferente entre as abas e o PROCV sem "FALSO" podia
// pegar a pessoa errada; aqui a pessoa é a ficha, e todo ajuste leva motivo.
//
// Regras confirmadas pela Ana (05/11/2026):
//   · HE 50% = horas do banco × (salário ÷ 220) × 1,5, só quando liberada no mês;
//   · encargos: CLT = salário × 1,7; contrato e pró-labore sem encargos;
//   · ajuda de custo = (km ida + volta) ÷ consumo × gasolina × dias, arredondada
//     para cima (moto 35 km/l, carro 12 km/l, como na planilha).

import { saldoDoDia } from "./folhaMensal.js";
import { casarPessoa } from "./folhaContabil.js";
import { mesDaFolha, pagamentosDeComissao } from "../recibosComissao.js";

export const COLECAO_FOLHA = "rh_folha_pagamento";
export const FATOR_ENCARGOS_CLT = 1.7;
export const CONSUMO_PADRAO = { moto: 35, carro: 12 };
export const INICIO_BANCO = "2026-09-01"; // o mesmo início da Folha de Ponto Mensal
export const EMPRESAS = { "0423": "M Lab", "0424": "MinasLab" };

const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
};
const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;
const norm = (s) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export const idDaLinha = (competencia, pessoaId) => `fp_${competencia}_${pessoaId}`;
export const idDoMes = (competencia) => `fm_${competencia}`;

/** CLT, Pró-labore ou Contrato, pelo que a ficha já diz. */
export function vinculoDe(ficha = {}) {
  const t = norm(`${ficha.tipoContrato || ""} ${ficha.vinculo || ""}`);
  if (/pro.?labore/.test(t)) return "Pró-labore";
  if (/clt|aprendiz/.test(t)) return "CLT";
  if (/prestador|pj|contrato|estagio/.test(t)) return "Contrato";
  return "—";
}

/** Quem paga: o que a ficha diz; senão a empresa do holerite; senão CLT na M Lab e o resto na MinasLab. */
export function empresaPagadora(ficha = {}, holerites = {}) {
  if (ficha.empresaPagadora) return ficha.empresaPagadora;
  const codigos = Object.keys(holerites || {});
  if (codigos.length === 1 && EMPRESAS[codigos[0]]) return EMPRESAS[codigos[0]];
  return vinculoDe(ficha) === "CLT" ? "M Lab" : "MinasLab";
}

const fimDoMes = (competencia) => {
  const [a, m] = String(competencia).split("-").map(Number);
  return `${competencia}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
};

/** Saldo do banco de horas (minutos) no fim do mês: lançamentos manuais + saldo dos dias do Ponto desde 01/09/2026. */
export function saldoBancoAte(pessoaId, competencia, pontoDia = [], movimentos = []) {
  const fim = fimDoMes(competencia);
  const valor = (m) => Number(m.credito_minutos ?? m.creditoMinutos ?? 0) - Number(m.debito_minutos ?? m.debitoMinutos ?? 0);
  const manuais = movimentos
    .filter((m) => String(m.pessoa_id ?? m.pessoaId ?? "") === String(pessoaId) && m.origem !== "APURACAO_PONTO" && String(m.data_movimento || m.dataMovimento || "") <= fim)
    .reduce((n, m) => n + valor(m), 0);
  const dias = pontoDia
    .filter((d) => d.pessoaId === pessoaId && String(d.data || "") >= INICIO_BANCO && String(d.data || "") <= fim)
    .reduce((n, d) => n + saldoDoDia(d), 0);
  return Math.round(manuais + dias);
}

/** Dias com entrada no Ponto no mês (base da ajuda de custo). */
export const diasTrabalhados = (pessoaId, competencia, pontoDia = []) =>
  new Set(pontoDia.filter((d) => d.pessoaId === pessoaId && String(d.data || "").startsWith(competencia) && d.entrada).map((d) => d.data)).size;

/** Hora extra 50% do banco: só saldo positivo e só quando liberada. */
export function valorHoraExtra(saldoMin, salario, liberada) {
  const s = num(salario);
  if (!liberada || !s || !(saldoMin > 0)) return 0;
  return arred((saldoMin / 60) * (s / 220) * 1.5);
}

/** Minutos que vão ser pagos: o que foi escolhido na janela (nunca mais que o saldo), ou o saldo inteiro. */
export function minutosAPagar(saldoMin, registro = {}) {
  if (registro.heLiberada !== true || !(saldoMin > 0)) return 0;
  const escolhido = num(registro.horasPagarMin);
  return escolhido === null ? saldoMin : Math.max(0, Math.min(saldoMin, Math.round(escolhido)));
}

const somaLista = (lista) => arred((lista || []).reduce((s, a) => s + (num(a.valor) || 0), 0));

/** Ajuda de custo (combustível), arredondada para cima como na planilha. */
export function ajudaDeCusto(ficha = {}, gasolina, dias) {
  const km = (num(ficha.kmIda) || 0) + (num(ficha.kmVolta) || 0);
  const veiculo = norm(ficha.veiculo) === "carro" ? "carro" : "moto";
  const consumo = num(ficha.consumoKmL) || CONSUMO_PADRAO[veiculo];
  const preco = num(gasolina);
  if (!km || !consumo || !preco || !(dias > 0)) return 0;
  return Math.ceil((km / consumo) * preco * dias);
}

/** Comissão paga no mês da folha (fechamento do Gestão), casada com a ficha pelo nome. */
export function comissaoDoMes(ficha, competencia, registrosComissao = [], fichas = []) {
  return arred(pagamentosDeComissao(registrosComissao)
    .filter((p) => mesDaFolha(p) === competencia)
    .filter((p) => casarPessoa(p.nome, fichas)?.id === ficha.id)
    .reduce((s, p) => s + (Number(p.total) || 0), 0));
}

/**
 * A conferência do holerite: "confere", "divergencia", "leitura" (a soma do PDF não
 * fechou), "aguardando" ou "nao_se_aplica" (contrato sem holerite).
 */
export function situacaoHolerite(ficha, holerites = {}, vinculo) {
  const lista = Object.values(holerites || {});
  if (!lista.length) return { situacao: vinculo === "Contrato" ? "nao_se_aplica" : "aguardando", avisos: [] };
  const avisos = [];
  if (lista.some((h) => h.confere === false)) avisos.push("a soma dos eventos não fecha com o líquido do relatório");
  const salario = num(ficha.salario);
  for (const h of lista) {
    if (h.salarioBase && salario && Math.abs(h.salarioBase - salario) > 5) {
      avisos.push(`salário na ficha ${moeda(salario)}, no holerite ${moeda(h.salarioBase)}`);
    }
  }
  if (lista.some((h) => h.confere === false)) return { situacao: "leitura", avisos };
  return { situacao: avisos.length ? "divergencia" : "confere", avisos };
}

export const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * A linha da folha de uma pessoa no mês.
 * registro = o que foi gravado no mês para ela ({ heLiberada, ajustes, holerites }).
 */
export function linhaDaFolha({ ficha, competencia, registro = {}, mes = {}, pontoDia = [], movimentos = [], comissoes = [], fichas = [] }) {
  const vinculo = vinculoDe(ficha);
  const holerites = registro.holerites || {};
  const paga = empresaPagadora(ficha, holerites);
  const salario = num(ficha.salario) ?? Object.values(holerites).find((h) => h.salarioBase)?.salarioBase ?? 0;
  const liquidoHolerite = Object.values(holerites).reduce((s, h) => (h.liquido === null || h.liquido === undefined ? s : (s ?? 0) + h.liquido), null);
  const salarioPagar = liquidoHolerite ?? salario;
  const ehClt = vinculo === "CLT";
  const bancoMin = ehClt ? saldoBancoAte(ficha.id, competencia, pontoDia, movimentos) : null;
  const heMin = ehClt ? minutosAPagar(bancoMin, registro) : 0;
  const he = ehClt ? valorHoraExtra(heMin, salario, heMin > 0) : 0;
  const dias = diasTrabalhados(ficha.id, competencia, pontoDia);
  const ajudaCalculada = ajudaDeCusto(ficha, mes.gasolina, dias);
  // Valor fixo do mês, quando alguém digitou na janela, vale no lugar da conta por km.
  const ajuda = num(registro.ajudaFixa) ?? ajudaCalculada;
  const comissaoGestao = comissaoDoMes(ficha, competencia, comissoes, fichas);
  const comissaoManual = somaLista(registro.comissaoManual);
  const comissao = arred(comissaoGestao + comissaoManual);
  const bonus = somaLista(registro.bonus);
  const ajustes = somaLista(registro.ajustes);
  const variaveis = arred(he + ajuda + comissao + bonus + ajustes);
  const totalMinasLab = arred((paga === "MinasLab" ? salarioPagar : 0) + variaveis);
  const pagarMLab = arred(paga === "M Lab" ? salarioPagar : 0);
  const total = arred(totalMinasLab + pagarMLab);
  const comEncargos = arred(ehClt ? salario * FATOR_ENCARGOS_CLT + variaveis : total);
  const holerite = situacaoHolerite(ficha, holerites, vinculo);
  return {
    pessoaId: ficha.id, nome: ficha.nome, vinculo, paga, salario: arred(salario), liquidoHolerite,
    salarioEstimado: liquidoHolerite === null, bancoMin, heLiberada: registro.heLiberada === true, heMin, he,
    dias, ajuda, ajudaCalculada, ajudaFixa: num(registro.ajudaFixa) !== null, comissao, comissaoGestao, comissaoManual,
    bonus, ajustes, ajustesLista: registro.ajustes || [], bonusLista: registro.bonus || [], comissaoManualLista: registro.comissaoManual || [],
    totalMinasLab, pagarMLab, total, comEncargos,
    holerite, fgts: arred(Object.values(holerites).reduce((s, h) => s + (h.fgts || 0), 0)),
  };
}

export function totaisDaFolha(linhas = []) {
  const s = (k) => arred(linhas.reduce((n, l) => n + (Number(l[k]) || 0), 0));
  return {
    pessoas: linhas.length, salario: s("salario"), he: s("he"), ajuda: s("ajuda"), comissao: s("comissao"), bonus: s("bonus"), ajustes: s("ajustes"),
    totalMinasLab: s("totalMinasLab"), pagarMLab: s("pagarMLab"), total: s("total"), comEncargos: s("comEncargos"), fgts: s("fgts"),
    divergencias: linhas.filter((l) => ["divergencia", "leitura"].includes(l.holerite.situacao)).length,
    aguardando: linhas.filter((l) => l.holerite.situacao === "aguardando").length,
  };
}

/** O que gravar de um relatório importado, por ficha: { [pessoaId]: { codigoEmpresa, holerite } } + os não encontrados. */
export function distribuirRelatorio(relatorio, fichas = []) {
  const porPessoa = {};
  const naoEncontrados = [];
  for (const p of relatorio.pessoas || []) {
    const ficha = casarPessoa(p.nome, fichas);
    if (!ficha) { naoEncontrados.push(p.nome); continue; }
    porPessoa[ficha.id] = {
      cadastro: p.cadastro, nome: p.nome, empresa: relatorio.empresa?.nome || "", tipoRelatorio: relatorio.tipo,
      liquido: p.liquido, proventos: p.proventos, descontos: p.descontos, fgts: p.fgts, inss: p.inss,
      salarioBase: p.salarioBase, confere: p.confere, rescisao: p.rescisao,
      eventos: (p.eventos || []).map((e) => ({ codigo: e.codigo, descricao: e.descricao, tipo: e.tipo, referencia: e.referencia, valor: e.valor })),
    };
  }
  return { porPessoa, naoEncontrados };
}

/**
 * O que o relatório da contabilidade ensina à ficha do RH (alimentação automática).
 * Só preenche o que está VAZIO, com duas exceções explícitas:
 *   · salário: quando o mês é cheio (220h de Horas Normais / Pró-labore) o valor é o
 *     salário exato e corrige a ficha; mês quebrado (admissão, atestado) dá só o
 *     valor-hora, que tem arredondamento — esse vira aviso, nunca sobrescreve;
 *   · empresa que paga: vem do código da empresa do relatório quando a ficha não diz.
 * Devolve { campos, mudancas: ["salário 1.800 → 2.500", …] } — campos vazio = nada a mudar.
 */
export function camposDaFichaPeloHolerite(ficha = {}, holerite = {}, codigoEmpresa = "") {
  const campos = {};
  const mudancas = [];
  if (holerite.cadastro && !ficha.cadastroFolha) { campos.cadastroFolha = String(holerite.cadastro); mudancas.push(`cadastro na folha ${holerite.cadastro}`); }
  if (!ficha.empresaPagadora && EMPRESAS[codigoEmpresa]) { campos.empresaPagadora = EMPRESAS[codigoEmpresa]; mudancas.push(`paga pela ${EMPRESAS[codigoEmpresa]}`); }
  const cheio = (holerite.eventos || []).find((e) => /^horas (normais|pro-?labore)/.test(norm(e.descricao)) && Math.abs((e.referencia || 0) - 220) < 0.01);
  const atual = num(ficha.salario);
  if (cheio && !holerite.rescisao && (atual === null || Math.abs(atual - cheio.valor) >= 0.01)) {
    campos.salario = String(cheio.valor);
    mudancas.push(`salário ${atual === null ? "vazio" : moeda(atual)} → ${moeda(cheio.valor)}`);
  }
  return { campos, mudancas };
}
