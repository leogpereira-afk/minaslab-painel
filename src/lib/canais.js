// Canais MinasLab — formatação para a tela (as regras ficam no servidor,
// em supabase/functions/ml-canais/regras.mjs).

export const TIPOS_POST = {
  noticia: { rotulo: "Notícia", cor: "bg-sky-100 text-sky-800" },
  comunicado: { rotulo: "Comunicado", cor: "bg-amber-100 text-amber-800" },
  evento: { rotulo: "Evento", cor: "bg-violet-100 text-violet-800" },
  aniversario: { rotulo: "Aniversário", cor: "bg-pink-100 text-pink-800" },
};

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const pad = (n) => String(n).padStart(2, "0");
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function tempoRelativo(iso, agora = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = Math.round((agora.getTime() - d.getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 2 * 86400) return "ontem";
  if (s < 7 * 86400) return `há ${Math.floor(s / 86400)} dias`;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric" }).format(d);
}

/** Último dia de férias é a véspera do retorno. */
export function periodoFerias({ inicio, retorno }) {
  const [a, m, d] = retorno.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1, d - 1));
  const ultimo = `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  return `${ddmm(inicio)} a ${ddmm(ultimo)} · volta ${ddmm(retorno)}`;
}
