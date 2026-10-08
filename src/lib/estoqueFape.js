// Pontuação da FAPE (avaliação de provedores externos): cada critério responde SIM / NÃO / NÃO SE APLICA.
// SIM vale 2 pontos, NÃO vale 0 e NÃO SE APLICA sai da conta (nem pontos nem máximo), então o fornecedor
// não é punido por uma pergunta que não cabe ao tipo dele. A classificação usa o percentual dos pontos possíveis,
// nas mesmas faixas do modelo antigo (nota 0–2 de 8 = RUIM, 3–5 = BOM, 6–8 = ÓTIMO): até 25% RUIM, até 62,5% BOM, acima ÓTIMO.
export const RESPOSTAS_FAPE = ["SIM", "NÃO", "NÃO SE APLICA"];
export const PONTOS_SIM = 2;

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
// Aceita "sim", "nao", "NÃO SE APLICA", "nao se aplica"... e devolve a forma canônica, ou "" se não reconhecer.
export function normalizarRespostaFape(v) {
  const k = semAcento(v);
  if (k === "SIM") return "SIM";
  if (k === "NAO") return "NÃO";
  if (k === "NAO SE APLICA" || k === "N/A") return "NÃO SE APLICA";
  return "";
}
// Contas com inteiros (nota×4 ≤ máximo é o mesmo que ≤ 25%), sem erro de ponto flutuante.
export function classificarFape(nota, maximo) {
  if (!(maximo > 0)) return "";
  if (nota * 4 <= maximo) return "RUIM";
  if (nota * 8 <= maximo * 5) return "BOM";
  return "ÓTIMO";
}
// respostas = de 1 a 12 valores (um por critério). Devolve null se alguma resposta for inválida/vazia ou se nenhum critério se aplicar.
export function pontuarFape(respostas) {
  const lista = (respostas || []).map(normalizarRespostaFape);
  if (!lista.length || lista.length > 12 || lista.some((r) => !r)) return null;
  const aplicaveis = lista.filter((r) => r !== "NÃO SE APLICA").length;
  if (!aplicaveis) return null;
  const notas = lista.map((r) => (r === "SIM" ? PONTOS_SIM : r === "NÃO" ? 0 : null));
  const nota = notas.reduce((t, x) => t + (x || 0), 0), maximo = aplicaveis * PONTOS_SIM;
  return { respostas: lista, notas, nota, maximo, aplicaveis, percentual: Math.round((nota / maximo) * 1000) / 10, classificacao: classificarFape(nota, maximo) };
}
// Avaliações antigas não têm notaMaxima: eram sempre x/8.
export function textoNotaFape(av) {
  const nota = av?.notaFinal, tem = av?.notaMaxima != null && av.notaMaxima !== "";
  if (nota == null || nota === "") return "—";
  const max = tem ? Number(av.notaMaxima) : 8;
  return tem && max > 0 ? `${nota} / ${max} (${String(Math.round((Number(nota) / max) * 1000) / 10).replace(".", ",")}%)` : `${nota} / ${max}`;
}
// Quantos critérios a avaliação tem: o gravado (qtdCriterios) ou, nas avaliações sem esse campo, os que aparecem nos campos criterioN.
export function qtdCriteriosAvaliacao(av) {
  const q = Number(av?.qtdCriterios);
  if (Number.isInteger(q) && q >= 1 && q <= 12) return q;
  let n = 0;
  for (let i = 1; i <= 12; i++) if (av && (av["criterio" + i + "Resposta"] != null || av["criterio" + i + "Nota"] != null || av["criterio" + i] != null || av["criterio" + i + "Pergunta"] != null)) n = i;
  return n || 4;
}
