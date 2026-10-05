// Funções puras da página Finanças > Recibos: valor por extenso, datas, horas extras e desconto por danos.

export const EMPRESAS_RECIBO = [
  { chave: "minaslab", nome: "Minaslab Brasil LTDA", cnpj: "52.657.257/0001-14" },
  { chave: "mlab", nome: "M Lab Serviços Ltda", cnpj: "65.312.061/0001-30" },
];

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

const arred = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function ate999(n) {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100, partes = [];
  if (c) partes.push(CENTENAS[c]);
  if (r) partes.push(r < 20 ? UNIDADES[r] : DEZENAS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNIDADES[r % 10]}` : ""));
  return partes.join(" e ");
}

function inteiroPorExtenso(n) {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000), milhares = Math.floor((n % 1_000_000) / 1000), resto = n % 1000, partes = [];
  if (milhoes) partes.push(milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`);
  if (milhares) partes.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
  if (resto) partes.push(ate999(resto));
  // "e" antes da última parte só quando ela é até dois dígitos ou centena redonda (mil e quinhentos; mil novecentos e quarenta e dois).
  if (partes.length === 1) return partes[0];
  const ultima = partes.pop(), base = resto || milhares;
  return `${partes.join(" ")}${base < 100 || base % 100 === 0 ? " e " : " "}${ultima}`;
}

// 1942 -> "mil novecentos e quarenta e dois reais"; 2110.29 -> "dois mil cento e dez reais e vinte e nove centavos"
export function valorPorExtenso(valor) {
  const v = arred(Math.abs(Number(valor) || 0)), reais = Math.floor(v), cent = Math.round((v - reais) * 100);
  const textoReais = `${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : reais !== 0 && reais % 1_000_000 === 0 ? "de reais" : "reais"}`;
  if (!cent) return textoReais;
  const textoCent = `${inteiroPorExtenso(cent)} ${cent === 1 ? "centavo" : "centavos"}`;
  return reais ? `${textoReais} e ${textoCent}` : textoCent;
}

export const moeda = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const numeroBR = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Aceita "1.234,56", "1234.56" ou número.
export function lerValor(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim().replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : 0;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeMes = (i) => MESES[i] || "";

// "2026-09-03" -> "03 de setembro de 2026"
export function dataExtenso(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

// "2026-09-03" -> "03/09/2026"
export function dataCurta(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// "51:40", "51h40min" ou "51" -> horas decimais (51,6667)
export function horasDecimais(txt) {
  const m = String(txt ?? "").trim().match(/^(\d+)\s*(?:[:hH]\s*(\d{1,2})\s*(?:m(?:in)?)?)?$/);
  if (!m) return 0;
  return Number(m[1]) + Number(m[2] || 0) / 60;
}

// 15.3941 -> "15:23:39"
export function horasHMS(decimal) {
  const total = Math.round((Number(decimal) || 0) * 3600);
  const h = Math.floor(total / 3600), min = Math.floor((total % 3600) / 60), s = total % 60;
  return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// "51:40" -> "51h40min"
export function horasTexto(txt) {
  const m = String(txt ?? "").trim().match(/^(\d+)\s*(?:[:hH]\s*(\d{1,2}))?/);
  return m ? `${m[1]}h${String(m[2] || 0).padStart(2, "0")}min` : "";
}

// Valor da hora e da hora extra arredondados a 2 casas, como aparecem no recibo; o total é a hora extra impressa × horas pagas.
export function calcularHoraExtra({ salario, jornada = 220, adicional = 50, horasPagas }) {
  const s = lerValor(salario), j = Number(jornada) || 220, a = Number(adicional) || 0;
  const horaNormal = arred(s / j), horaExtra = arred(horaNormal * (1 + a / 100)), horas = horasDecimais(horasPagas);
  return { horaNormal, horaExtra, horas, total: arred(horaExtra * horas) };
}

// Horas de hora extra necessárias para quitar o prejuízo.
export function calcularDescontoDano({ valorItem, frete, salario, jornada = 220, adicional = 50 }) {
  const total = arred(lerValor(valorItem) + lerValor(frete));
  const { horaNormal, horaExtra } = calcularHoraExtra({ salario, jornada, adicional, horasPagas: "0" });
  const horas = horaExtra > 0 ? total / horaExtra : 0;
  return { total, horaNormal, horaExtra, horas, hms: horasHMS(horas) };
}

export function somarItens(itens = []) {
  return arred(itens.reduce((s, i) => s + (i.tipo === "desconto" ? -1 : 1) * lerValor(i.valor), 0));
}

// ("2026-08-01","2026-08-31") -> "01 a 31 de agosto de 2026"; meses/anos diferentes repetem o necessário.
export function periodoExtenso(inicio, fim) {
  const a = String(inicio || "").match(/^(\d{4})-(\d{2})-(\d{2})/), b = String(fim || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!a || !b) return "";
  if (a[1] === b[1] && a[2] === b[2]) return `${a[3]} a ${dataExtenso(fim)}`;
  if (a[1] === b[1]) return `${a[3]} de ${MESES[Number(a[2]) - 1]} a ${dataExtenso(fim)}`;
  return `${dataExtenso(inicio)} a ${dataExtenso(fim)}`;
}

// "2026-08-31" -> "agosto de 2026"
export function competenciaDe(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})/);
  return m ? `${MESES[Number(m[2]) - 1]} de ${m[1]}` : "";
}
