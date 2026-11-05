import { precoUnitario } from "./propostas.js";

// Regras do caminho da amostra depois da OS: coleta, inspeção de recebimento,
// análise, revisão, certificado e descarte. Puro e testado.
//
// Etapa de cada análise (parâmetro de uma amostra):
//   Aguardando → Em análise → Revisão → Revisado
//   (a revisão pode devolver: volta a "Em análise" com o motivo do retorno)
// O status da amostra acompanha as análises (ver statusPelasAnalises).

export const ETAPAS_ANALISE = ["Aguardando", "Em análise", "Revisão", "Revisado"];
export const COR_ETAPA = { Aguardando: "default", "Em análise": "info", Revisão: "primary", Revisado: "ok" };

// Número em português ("6,5" → 6.5). Texto que não é número devolve null.
export function numero(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = String(v ?? "").trim().replace(/\s/g, "");
  if (!/^[-+]?\d{1,3}(\.\d{3})*(,\d+)?$|^[-+]?\d+([.,]\d+)?$/.test(t)) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : null;
}

const fmt = (n, casas) => (casas === "" || casas == null || Number.isNaN(Number(casas)) ? String(n).replace(".", ",") : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: Number(casas), maximumFractionDigits: Number(casas) }));

// Resultado como sai no certificado: abaixo do LQ vira "< LQ" (ISO/IEC 17025
// 7.8.3: o resultado é informado com a unidade e, quando cabe, o limite).
export function resultadoExibido(valor, { lq = "", casas = "" } = {}) {
  const t = String(valor ?? "").trim();
  if (!t) return "";
  const n = numero(t), q = numero(lq);
  if (n === null) return t;
  if (q !== null && n < q) return `< ${fmt(q, casas)}`;
  return fmt(n, casas);
}

// Conformidade com o limite da legislação (VMP). Limite: { minimo, maximo, texto }.
// Resultado textual ("Ausente"/"Presente") é comparado com o texto do limite.
export function parecer(valor, limite, lq = "") {
  if (!limite || String(valor ?? "").trim() === "") return "";
  const n = numero(valor);
  const min = numero(limite.minimo), max = numero(limite.maximo);
  if (n !== null && (min !== null || max !== null)) {
    const q = numero(lq);
    const v = q !== null && n < q ? 0 : n; // abaixo do LQ conta como não detectado
    if (min !== null && v < min) return "Não conforme";
    if (max !== null && v > max) return "Não conforme";
    return "Conforme";
  }
  const r = String(valor).toLowerCase(), lt = String(limite.texto || "").toLowerCase();
  if (/aus[eê]n/.test(lt)) return /aus[eê]n/.test(r) ? "Conforme" : /presen/.test(r) ? "Não conforme" : "";
  return "";
}

// Limite do parâmetro na legislação da amostra (Resultado Legislação Aplicável).
export function limiteDe(dados, amostra, pid) {
  const leg = dados.legislacoes.find((l) => l.nome === amostra.legislacao);
  if (!leg) return null;
  for (const r of dados.resultado_la.filter((x) => x.legislacao === leg.id)) {
    const l = (r.limites || []).find((x) => x.parametro === pid);
    if (l) return l;
  }
  return null;
}

// Status da amostra a partir das análises (sem mexer em Cancelado e afins).
export function statusPelasAnalises(amostra) {
  if (["Cancelado", "Processo de cancelamento", "Faturamento", "Concluída"].includes(amostra.status)) return amostra.status;
  const an = amostra.analises || [];
  if (!an.length) return amostra.status;
  if (an.every((a) => a.etapa === "Revisado")) return "Assinatura";
  if (an.every((a) => a.etapa === "Revisão" || a.etapa === "Revisado")) return "Em Revisão";
  return "Laboratório";
}

// Lança o resultado de uma análise; quem e quando ficam registrados (7.5).
export function lancarResultado(analise, { resultado, equipamento = "", analista, quando }) {
  if (analise.etapa === "Revisão" || analise.etapa === "Revisado") throw new Error(`${analise.nome}: já foi enviado para revisão. Peça o retorno ao revisor para alterar.`);
  return { ...analise, resultado: String(resultado ?? "").trim(), equipamento, analista, inicio: analise.inicio || quando, termino: String(resultado ?? "").trim() ? quando : "", etapa: "Em análise" };
}

// Manda para a revisão as análises com resultado. Sem resultado não vai.
export function enviarRevisao(amostra, quando) {
  const faltam = amostra.analises.filter((a) => a.etapa !== "Revisado" && a.etapa !== "Revisão" && !String(a.resultado || "").trim());
  if (faltam.length) throw new Error(`Falta resultado em: ${faltam.map((a) => a.nome).join(", ")}.`);
  const analises = amostra.analises.map((a) => (a.etapa === "Em análise" || a.etapa === "Aguardando" ? { ...a, etapa: "Revisão", enviadoRevisao: quando, motivoRetorno: "" } : a));
  const nova = { ...amostra, analises };
  return { ...nova, status: statusPelasAnalises(nova) };
}

// Revisão de resultado: quem lançou não revisa o próprio resultado.
export function revisar(amostra, pids, { aprovar, revisor, quando, motivo = "", independente = true }) {
  const alvo = new Set(pids);
  const analises = amostra.analises.map((a) => {
    if (!alvo.has(a.pid)) return a;
    if (a.etapa !== "Revisão") throw new Error(`${a.nome}: não está aguardando revisão.`);
    if (independente && a.analista && revisor && a.analista === revisor) throw new Error(`${a.nome}: quem lançou o resultado não pode revisá-lo.`);
    if (aprovar) return { ...a, etapa: "Revisado", revisor, revisadoEm: quando };
    if (!motivo.trim()) throw new Error("Informe o motivo do retorno.");
    return { ...a, etapa: "Em análise", motivoRetorno: motivo.trim(), retornos: (a.retornos || 0) + 1, revisor: "", revisadoEm: "" };
  });
  const nova = { ...amostra, analises };
  return { ...nova, status: statusPelasAnalises(nova) };
}

// Inspeção de recebimento (7.4): perguntas padrão + campos da configuração.
export const PERGUNTAS_INSPECAO = [
  ["temperaturaOk", "A temperatura de recebimento está de acordo?"],
  ["identificadoOk", "Os frascos ou produtos estão identificados corretamente de acordo com a ordem de serviço?"],
  ["prazoOk", "O prazo entre a coleta e o recebimento está adequado?"],
  ["integraOk", "As amostras ou produtos estão sem sinais de violação?"],
  ["armazenadoOk", "As amostras estão armazenadas e separadas de forma a evitar contaminação cruzada?"],
];

export function inspecionar(amostra, insp, { quando, statusFinal = "Laboratório" }) {
  const desvios = PERGUNTAS_INSPECAO.filter(([k]) => insp[k] === "Não").map(([, p]) => p);
  if (!insp.responsavel) throw new Error("Informe o responsável pelo recebimento.");
  if (desvios.length && !String(insp.observacoes || "").trim()) throw new Error("Houve desvio no recebimento: descreva nas observações da amostra (o cliente deve ser consultado).");
  return { ...amostra, status: statusFinal, dataEntrada: insp.dataEntrada || quando, inspecao: { ...insp, desvios, em: quando } };
}

// Coleta registrada: data, coletor, campos da ficha e resultados in loco.
export function registrarColeta(amostra, { coletor, dataColeta, campos = {}, inloco = {} }, statusFinal = "Aguardando Inspeção") {
  if (!coletor) throw new Error("Informe o responsável pela coleta.");
  if (!dataColeta) throw new Error("Informe a data e hora da coleta.");
  const analises = amostra.analises.map((a) => (inloco[a.pid] !== undefined && String(inloco[a.pid]).trim() !== "" ? { ...a, resultado: String(inloco[a.pid]).trim(), analista: coletor, inicio: dataColeta, termino: dataColeta, etapa: "Em análise", inloco: true } : a));
  return { ...amostra, status: statusFinal, coletor, dataColeta, fichaColeta: campos, analises };
}

// Descarte: data prevista = entrada + dias de guarda.
export function dataParaDescarte(amostra, dias = 30) {
  const base = amostra.dataEntrada || amostra.dataColeta;
  if (!base) return "";
  const d = new Date(`${String(base).slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
}

// Valor da amostra para faturar: soma dos preços dos parâmetros contratados.
export function valorAmostra(contrato, amostra) {
  const sv = contrato?.servicos?.find((s) => s.sid === amostra.sid);
  return sv ? precoUnitario(sv) : 0;
}

// Progresso do certificado de uma OS: amostras prontas para assinar/assinadas.
export function progressoOS(amostras) {
  const vivas = amostras.filter((a) => a.status !== "Cancelado" && a.status !== "Processo de cancelamento");
  const prontas = vivas.filter((a) => ["Assinatura", "Faturamento", "Concluída"].includes(a.status));
  return { total: vivas.length, prontas: prontas.length, pct: vivas.length ? Math.round((prontas.length * 100) / vivas.length) : 0 };
}
