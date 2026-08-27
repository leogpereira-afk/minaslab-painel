// Ajudantes do RH usados por mais de uma aba (e pela casca). Moram aqui para
// nenhuma aba importar da outra — a casca e as abas puxam deste arquivo.

import { diasEntre, moedaCheia } from "../../lib/format.js";

// O ano digitado com dígito a mais (20266) passa no input de data e andaria
// 18 mil anos calado. Se o ano não tem 4 dígitos, devolve o ano para a frase.
export function anoRuim(data) {
  const ano = String(data || "").split("-")[0];
  return ano && ano.length !== 4 ? ano : null;
}

export function tempoDeCasa(admissao, hojeISO) {
  const [a1, m1, d1] = String(admissao).split("-").map(Number);
  const [a2, m2, d2] = String(hojeISO).split("-").map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (meses < 0) return "";
  if (meses < 1) return "menos de 1 mês de casa";
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const pa = anos ? `${anos} ${anos === 1 ? "ano" : "anos"}` : "";
  const pm = resto ? `${resto} ${resto === 1 ? "mês" : "meses"}` : "";
  return `${[pa, pm].filter(Boolean).join(" e ")} de casa`;
}

// A frase do radar: vencido grita, 60 dias acende — é o prazo que a casa usa
// para agendar ASO e reciclagem sem correria.
export function chipVenc(dias) {
  if (dias === null) return { texto: "sem data", chip: "chip" };
  if (dias < 0) {
    const d = -dias;
    return { texto: `venceu há ${d} ${d === 1 ? "dia" : "dias"}`, chip: "chip-bad" };
  }
  if (dias === 0) return { texto: "vence HOJE", chip: "chip-bad" };
  if (dias <= 60) return { texto: `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`, chip: "chip-warn" };
  return { texto: `em ${dias} dias`, chip: "chip" };
}

// ---- Exames ocupacionais ---------------------------------------------------

/* LEITURA TOLERANTE — a MESMA régua da AbaExames (venceDe/dataDe de lá). O
   radar e a aba falam do mesmo exame: régua mais estreita aqui faz o registro
   gravado só com `vence` (sem o espelho `validade`) sumir da cobrança do cartão
   e aparecer na lista logo abaixo dele. */
const txt = (v) => String(v ?? "").trim();
const venceDe = (e) => txt(e.vence) || txt(e.validade);
const dataDe = (e) => txt(e.data) || txt(e.realizadoEm);

/* Qual dos dois exames vale: o feito por ÚLTIMO. A validade só DESEMPATA os do
   mesmo dia — é a ordem que a AbaExames já usa no histórico da pessoa. */
const maisRecente = (a, b) =>
  dataDe(a).localeCompare(dataDe(b)) || venceDe(a).localeCompare(venceDe(b));

/**
 * O radar de exames (coleção "rh_exames"): qual exame de cada pessoa CONTA hoje.
 *
 * Uma pessoa acumula exames — o admissional de 2023, o periódico de 2026. O
 * vencido antigo NÃO é pendência quando já existe um mais novo do mesmo tipo:
 * contar todos acenderia alarme falso justamente para quem está em dia. Por
 * isso a régua é por PESSOA E TIPO, e vale o exame mais RECENTE — nunca o de
 * maior validade. O formulário da aba manda deixar o vencimento em branco
 * enquanto o laudo não voltou ("Aguardando laudo"), e "" perde de qualquer data
 * na comparação: pela validade, o exame NOVO sumia e o VELHO continuava sendo
 * cobrado — em poucos dias virava "vencido" e cartão vermelho para quem JÁ fez
 * o exame. Pior: sumia junto o laudo novo "inapto"/"apto com restrição" de
 * prazo mais curto, e com ele a restrição, que é o dado que muda a escala.
 *
 * Desligado sai da conta: exame de quem não trabalha mais aqui não é tarefa de
 * ninguém. Mas só sai quem SABIDAMENTE está desligado — exame cujo pessoaId não
 * resolve na lista de pessoas FICA, porque descartar o desconhecido em silêncio
 * é como se esconde problema (lição paga na Impresilk: filtro que joga fora o
 * que não reconhece falha calado).
 *
 * Exame sem validade não entra em `emRisco`: ausência de data não é vencimento
 * — sai separado em `semData`, para a aba cobrar o preenchimento.
 *
 * O cartão da casca e a aba usam ESTE MESMO cálculo. Duas réguas para a mesma
 * pergunta fazem o número do cartão brigar com a lista logo abaixo dele.
 */
export function radarExames(exames, pessoas, hojeISO) {
  const desligados = new Set((pessoas || []).filter((p) => p.ativo === false).map((p) => p.id));

  const porChave = new Map();
  for (const e of exames || []) {
    if (e.pessoaId && desligados.has(e.pessoaId)) continue;
    const chave = `${e.pessoaId || "?"}|${e.tipo || "?"}`;
    const atual = porChave.get(chave);
    if (!atual || maisRecente(e, atual) > 0) {
      porChave.set(chave, e);
    }
  }

  const vigentes = [...porChave.values()]
    .map((e) => {
      const vence = venceDe(e);
      const dias = vence ? diasEntre(hojeISO, vence) : null;
      return { ...e, dias, cv: chipVenc(dias) };
    })
    // Sem data vai para o fim: o que tem prazo é o que precisa ser agendado.
    .sort((a, b) => (venceDe(a) || "9999-99-99").localeCompare(venceDe(b) || "9999-99-99"));

  const emRisco = vigentes.filter((e) => e.dias !== null && e.dias <= 60);
  return {
    vigentes,
    emRisco,
    vencidos: emRisco.filter((e) => e.dias < 0),
    semData: vigentes.filter((e) => e.dias === null),
  };
}

// ---- Histórico da pessoa ---------------------------------------------------

// O que a ficha carimba sozinha quando muda. Só estes três: são os que mudam a
// vida da pessoa e a folha, e são os que alguém vai querer reconstituir depois.
const CAMPOS_MARCO = [
  { chave: "cargo", tipo: "cargo", titulo: "Mudança de cargo", dinheiro: false },
  { chave: "setor", tipo: "setor", titulo: "Mudança de setor", dinheiro: false },
  { chave: "salario", tipo: "salario", titulo: "Mudança de salário", dinheiro: true },
];

/* valorDe/valorPara são TEXTO JÁ LEGÍVEL de propósito: a mesma coluna guarda
   cargo, setor e salário, e coluna que mistura tipos não pode ser número.
   Campo vazio vira "sem registro" — nunca "R$ 0,00", que afirmaria salário
   zero onde houve ausência de dado. */
function valorLegivel(v, dinheiro) {
  if (v === null || v === undefined || v === "") return "sem registro";
  return dinheiro ? moedaCheia(v) : String(v);
}

function mesmoValor(a, b, dinheiro) {
  if (dinheiro) {
    // "3500" gravado como texto e 3500 gravado como número são o MESMO salário:
    // comparar cru inventaria um aumento a cada vez que a ficha fosse aberta.
    const n = (v) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));
    return n(a) === n(b);
  }
  return String(a ?? "").trim() === String(b ?? "").trim();
}

/**
 * CARIMBO NO ATO, NÃO DEDUÇÃO DEPOIS.
 *
 * Na Impresilk, deduzir "isto foi editado à mão" olhando o autor do registro
 * produziu 118 falsos positivos. O sistema só sabe o que gravou — então a
 * mudança de cargo, setor ou salário vira um REGISTRO no momento em que
 * acontece, com o valor de antes e o de depois dentro dele.
 *
 * Correção de grafia ("Analista " → "Analista") não entra: comparação por texto
 * aparado. Já trocar maiúscula por minúscula entra, e entra de propósito — o
 * histórico conta o que a ficha passou a dizer, e decidir por conta própria que
 * "isso aí foi só grafia" é exatamente a dedução que produz falso.
 *
 * @param {Object|null} antes  registro como estava no servidor (null = ficha nova)
 * @param {Object} depois      registro como o servidor confirmou que ficou
 * @param {string} hojeISO     "AAAA-MM-DD" local
 * @returns {Object[]} registros prontos para a coleção "rh_historico"
 */
export function marcosDaFicha(antes, depois, hojeISO) {
  const base = {
    pessoaId: depois.id,
    // Nome é CARIMBO: guardado junto, o histórico continua legível depois de a
    // pessoa ser desligada ou de a ficha mudar de nome.
    pessoaNome: depois.nome || "",
    data: hojeISO,
    titulo: "",
    detalhe: "",
    valorDe: "",
    valorPara: "",
    obs: "",
  };

  // Ficha nova: o marco é a entrada no quadro, na data da admissão. Sem data de
  // admissão fica o dia do cadastro — e a frase diz isso, porque afirmar
  // "admitido hoje" sem saber seria inventar um fato trabalhista.
  if (!antes) {
    return [
      {
        ...base,
        tipo: "admissao",
        data: depois.admissao || hojeISO,
        titulo: "Entrada no quadro",
        valorPara: valorLegivel(depois.cargo, false),
        detalhe: depois.admissao ? "" : "Sem data de admissão na ficha — registrado no dia do cadastro.",
      },
    ];
  }

  const marcos = [];
  for (const c of CAMPOS_MARCO) {
    if (mesmoValor(antes[c.chave], depois[c.chave], c.dinheiro)) continue;
    marcos.push({
      ...base,
      tipo: c.tipo,
      titulo: c.titulo,
      valorDe: valorLegivel(antes[c.chave], c.dinheiro),
      valorPara: valorLegivel(depois[c.chave], c.dinheiro),
    });
  }
  return marcos;
}
