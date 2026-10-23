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

/** Frase de cada aniversariante na lista do mês: hoje, já passou ou ainda vem. Mesma pessoa, mesma frase (sem sorteio a cada tela). */
const FRASES_HOJE = ["Hoje é dia de parabéns! 🎉", "Dia de festa na MinasLab! 🎂", "Hoje o mural é só alegria! 🎈"];
export function fraseAniversario(a, diaHoje) {
  const dia = String(a.dia).padStart(2, "0");
  if (a.dia === diaHoje) {
    const n = [...String(a.pessoaId ?? a.nome)].reduce((t, ch) => (t + ch.charCodeAt(0)) % 997, 0);
    return FRASES_HOJE[n % FRASES_HOJE.length];
  }
  return a.dia < diaHoje ? `Aniversariou no dia ${dia} 🎉` : `Faz aniversário no dia ${dia} 🎈`;
}

/* ------------------------------------------------------------------ visual
   Paleta das apresentações coloridas (Guia de Frascos). Cada publicação pode
   escolher estilo e cor; sem escolha, o sistema varia sozinho pelo tipo e pela
   própria publicação (sempre a mesma cor para o mesmo post). */
export const PALETA = {
  amarelo: { nome: "amarelo", rotulo: "Amarelo", base: "#f5b800", escuro: "#8a6500", claro: "#fff8db", sobre: "#3d2f00" },
  verde: { nome: "verde", rotulo: "Verde", base: "#16a34a", escuro: "#0f6b32", claro: "#eaf8ee", sobre: "#ffffff" },
  vermelho: { nome: "vermelho", rotulo: "Vermelho", base: "#e5484d", escuro: "#a5232a", claro: "#fdeced", sobre: "#ffffff" },
  laranja: { nome: "laranja", rotulo: "Laranja", base: "#f97316", escuro: "#a8480b", claro: "#fff1e6", sobre: "#ffffff" },
  azul: { nome: "azul", rotulo: "Azul", base: "#2563eb", escuro: "#1e3fa8", claro: "#e8f0fe", sobre: "#ffffff" },
  roxo: { nome: "roxo", rotulo: "Roxo", base: "#7c3aed", escuro: "#4c1d95", claro: "#f1eafe", sobre: "#ffffff" },
};
export const ESTILOS = [
  { id: "auto", rotulo: "Automático", dica: "O sistema escolhe pelo tipo" },
  { id: "capa", rotulo: "Capa", dica: "Título grande sobre a cor" },
  { id: "citacao", rotulo: "Frase", dica: "Frase de destaque entre aspas" },
  { id: "aviso", rotulo: "Aviso", dica: "Comunicado com faixa e megafone" },
  { id: "evento", rotulo: "Evento", dica: "Data grande e título" },
  { id: "numero", rotulo: "Número", dica: "Um número em destaque" },
  { id: "simples", rotulo: "Simples", dica: "Só texto, sem arte" },
];
const ORDEM_CORES = ["azul", "verde", "roxo", "laranja", "vermelho", "amarelo"];
const hash = (s) => [...String(s ?? "")].reduce((t, ch) => (t * 31 + ch.charCodeAt(0)) % 100003, 7);

/** Estilo e cor efetivos de uma publicação (resolve o "automático"). */
export function visualDoPost(p) {
  const v = p?.visual || {};
  const h = hash(p?.id);
  let estilo = v.estilo;
  if (!estilo || estilo === "auto") {
    if (p?.imagem) estilo = "simples"; // a foto já é a arte
    else if (p?.tipo === "comunicado") estilo = "aviso";
    else if (p?.tipo === "evento") estilo = "evento";
    else estilo = ["capa", "citacao", "capa"][h % 3];
  }
  const corNome = v.cor && v.cor !== "auto" ? v.cor : ORDEM_CORES[h % ORDEM_CORES.length];
  return { estilo, cor: PALETA[corNome] || PALETA.azul, destaque: v.destaque || "", data: v.data || "" };
}
