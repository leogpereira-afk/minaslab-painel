// Formatação e datas. Mês sempre como "AAAA-MM", no fuso de Brasília.

const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function mesDeData(d = new Date()) {
  // Brasília é UTC-3 o ano todo desde 2019.
  const br = new Date(d.getTime() - 3 * 3600 * 1000);
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}`;
}
export const mesAtual = () => mesDeData(new Date());

export function hojeBR() {
  const br = new Date(Date.now() - 3 * 3600 * 1000);
  return br.toISOString().slice(0, 10);
}

export function somarMeses(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function mesesAte(mes, quantos) {
  const out = [];
  for (let i = quantos - 1; i >= 0; i--) out.push(somarMeses(mes, -i));
  return out;
}

export function mesLongo(mes) {
  const [a, m] = mes.split("-").map(Number);
  const n = NOMES.at(m - 1) || "";
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${a}`;
}
export const mesNome = (mes) => NOMES.at(Number(mes.split("-")[1]) - 1) || "";
export const mesCurto = (mes) => CURTOS.at(Number(mes.split("-")[1]) - 1) || "";

export function brl(n, compacto = false) {
  const v = Number(n || 0);
  if (compacto && Math.abs(v) >= 1000) {
    return `R$ ${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
  }
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const pct = (n) => (n == null || !isFinite(n) ? "—" : `${Math.round(n)}%`);
export const nota = (n) => (n == null || !isFinite(n) ? "—" : n.toFixed(1).replace(".", ","));

export function dataCurta(iso) {
  if (!iso) return "";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function novoId(prefixo = "id") {
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefixo}_${Date.now().toString(36)}${r}`;
}

export function numero(v) {
  if (v === "" || v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

/** "MARIA DA SILVA" → "Maria da Silva" (para certificados e documentos). */
export function nomeProprio(nome) {
  return String(nome || "").trim().replace(/\s+/g, " ").toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
    .replace(/(?<=\s)(Da|De|Do|Das|Dos|E)(?=\s)/g, (m) => m.toLowerCase());
}
