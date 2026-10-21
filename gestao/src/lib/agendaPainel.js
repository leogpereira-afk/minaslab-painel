// Ponte Gestão → Agenda do painel: quando um compromisso da Gestão tem
// participantes escolhidos, ele vira um evento na Agenda do painel (ml-agenda),
// e cada participante vê no Calendário dele e recebe aviso no sino.
// Regras puras (o envio fica em services/agendaPainel.js).

const TIPO_PAINEL = { treinamento: "treinamento", reuniao: "reuniao", outro: "evento" };

/** Tem alguém escolhido para receber no painel? */
export const temConvidados = (p) => !!p && (p.paraTodos === true || (Array.isArray(p.participantes) && p.participantes.length > 0));

/**
 * Monta o evento do painel a partir do registro da Gestão.
 * reg: { data, hora, horaFim, local, responsavel, obs, tipoReuniao }
 * tipo: treinamento | reuniao | outro; titulo: nome do compromisso.
 */
export function eventoParaPainel(reg, { tipo, titulo, participantes = [], paraTodos = false }) {
  const linhas = [];
  if (reg.tipoReuniao) linhas.push(`Tipo: ${reg.tipoReuniao}`);
  if (reg.responsavel) linhas.push(`${tipo === "treinamento" ? "Quem aplica" : "Responsável"}: ${reg.responsavel}`);
  if (reg.obs) linhas.push(String(reg.obs));
  linhas.push("Marcado pela Gestão.");
  const horaInicio = /^\d{2}:\d{2}$/.test(reg.hora || "") ? reg.hora : "";
  const horaFim = horaInicio && /^\d{2}:\d{2}$/.test(reg.horaFim || "") && reg.horaFim >= horaInicio ? reg.horaFim : "";
  return {
    tipo: TIPO_PAINEL[tipo] || "evento",
    titulo: String(titulo || "Compromisso").slice(0, 120),
    descricao: linhas.join("\n").slice(0, 1000),
    local: String(reg.local || "").slice(0, 120),
    diaInicio: reg.data, diaFim: reg.data, horaInicio, horaFim,
    paraTodos: !!paraTodos,
    participantes: paraTodos ? [] : [...new Set(participantes)],
  };
}

/** O que fazer no painel ao salvar: criar, atualizar, cancelar ou nada. */
export function acaoNoPainel(painelAtual, convite) {
  const tem = temConvidados(convite);
  if (painelAtual?.id) return tem ? "atualizar" : "cancelar";
  return tem ? "criar" : "nada";
}

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e"]);
/** "ANA CLAUDIA GONÇALVES PESSOA" → "Ana Pessoa" (só para mostrar). */
export function nomeCurto(nome) {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  const uteis = partes.filter((w) => !PARTICULAS.has(w.toLocaleLowerCase("pt-BR")));
  const cap = (w) => w.toLocaleLowerCase("pt-BR").replace(/(^|[-'])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase("pt-BR"));
  return (uteis.length >= 2 ? [uteis[0], uteis[uteis.length - 1]] : [partes[0]]).map(cap).join(" ");
}
