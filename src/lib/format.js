// Formatacao PT-BR e regras de data. Portado do Painel da Impresilk — as
// regras de fuso ja pagaram o preco la (toISOString depois das 21h devolve o
// dia de AMANHA no Brasil).

export function moeda(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function moedaCheia(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function numero(v) {
  return (Number(v) || 0).toLocaleString("pt-BR");
}

// Regra de fuso: nunca slice(0,10) de timestamp UTC.
export function diaLocalISO(iso) {
  const s = String(iso);
  return s.includes("T") ? ymdLocal(new Date(s)) : s.slice(0, 10);
}

export function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function dataCurta(iso) {
  if (!iso) return "";
  const dia = diaLocalISO(iso);
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

export function dataLonga(iso) {
  if (!iso) return "";
  const dia = diaLocalISO(iso);
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

/* Le um valor digitado por gente e devolve numero.
   Duas reguas, porque os dois sinais nao sao ambiguos do mesmo jeito:

   VIRGULA em pt-BR e SEMPRE decimal — ninguem escreve milhar com virgula aqui.
   Foi o que quebrou no estoque do laboratorio: "0,125" (125 mL de acido) caia
   na regra do teto de 2 casas, virava milhar e gravava uma saida de 125 L. O
   aviso de saldo negativo ate aparecia, mas culpando a entrada, nao o numero.

   PONTO e ambiguo ("1.500" = milhar; "1500.50" = decimal). A regra antiga
   dizia "mais de 2 casas depois do ponto = milhar", e estava ERRADA na origem:
   separador de milhar agrupa EXATAMENTE 3 digitos. Com ela, o salario que a
   leitura do Kit Admissional entrega como "1621.0000" virava R$ 16.210.000, e
   "0.125" virava 125 (achado na auditoria de 28/09, antes de gravar estrago).

   Agora o ponto so e milhar quando o numero INTEIRO tem cara de agrupamento:
   primeiro grupo de 1 a 3 digitos que nao comeca em zero, e todos os grupos
   seguintes com exatamente 3 ("1.500", "85.000", "1.250.000"). Qualquer outra
   coisa com ponto e decimal ("1500.50", "1621.0000", "0.125", "12.5") — e
   continua valendo o que motivou a regra: 1500.5 nao vira 15005. */
const PARECE_MILHAR = /^-?[1-9]\d{0,2}(\.\d{3})+$/;

export function paraNumero(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const ultimaVirgula = s.lastIndexOf(",");
  const ultimoPonto = s.lastIndexOf(".");
  const corte = Math.max(ultimaVirgula, ultimoPonto);
  const casas = corte > -1 ? s.length - corte - 1 : 0;
  const ehDecimal =
    corte > -1 && casas > 0 && (corte === ultimaVirgula || !PARECE_MILHAR.test(s));
  const limpo = ehDecimal
    ? s.slice(0, corte).replace(/[.,]/g, "") + "." + s.slice(corte + 1)
    : s.replace(/[.,]/g, "");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

// Numero -> texto para EDITAR (pt-BR): 1500.5 vira "1500,5". Nao usar moeda()
// aqui: o campo tem que voltar do jeito que a pessoa digita.
export function paraCampo(n) {
  if (!n) return "";
  return String(n).replace(".", ",");
}

export function diasEntre(isoA, isoB) {
  const a = new Date(diaLocalISO(isoA) + "T00:00:00");
  const b = new Date(diaLocalISO(isoB) + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

// Id novo: data + aleatorio. Legivel no banco e sem colisao pratica.
export function novoId(prefixo = "r") {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
