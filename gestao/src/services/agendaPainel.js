// Envia os compromissos da Gestão para a Agenda do painel (função ml-agenda),
// com o mesmo crachá do login. Quem recebe vê no Calendário do painel e
// recebe aviso no sino; o lembrete do dia sai às 8h.
import { API } from "../lib/api.js";
import { comCracha } from "../lib/sessao.js";
import { eventoParaPainel, acaoNoPainel } from "../lib/agendaPainel.js";

const chamar = (action, corpo = {}) => comCracha(`${API}/ml-agenda`, { action, ...corpo });

let cacheUsuarios = null;
/** Contas ativas do painel (quem pode receber o convite). */
export function usuariosPainel() {
  if (!cacheUsuarios) cacheUsuarios = chamar("usuarios").catch((e) => { cacheUsuarios = null; throw e; });
  return cacheUsuarios;
}

export async function cancelarNoPainel(painel) {
  if (!painel?.id) return;
  try { await chamar("cancelar", { id: painel.id }); } catch (e) { if (e.status !== 404) throw e; }
}

/**
 * Cria, atualiza ou cancela o evento do painel ligado a um registro da Gestão.
 * Devolve { painel, erro }: painel é o que gravar no registro ({ id, participantes, paraTodos } ou null).
 * Se o painel falhar, o compromisso continua salvo na Gestão e o erro volta para a tela.
 */
export async function sincronizarNoPainel(reg, { tipo, titulo, participantes = [], paraTodos = false }) {
  const convite = { participantes, paraTodos };
  try {
    const acao = acaoNoPainel(reg.painel, convite);
    if (acao === "nada") return { painel: null };
    if (acao === "cancelar") { await cancelarNoPainel(reg.painel); return { painel: null }; }
    const corpo = eventoParaPainel(reg, { tipo, titulo, participantes, paraTodos });
    if (acao === "criar") {
      const r = await chamar("criar", corpo);
      return { painel: { id: r.id, participantes, paraTodos } };
    }
    try {
      await chamar("atualizar", { id: reg.painel.id, ...corpo });
      return { painel: { id: reg.painel.id, participantes, paraTodos } };
    } catch (e) {
      if (e.status !== 404) throw e; // evento sumiu no painel: cria de novo
      const r = await chamar("criar", corpo);
      return { painel: { id: r.id, participantes, paraTodos } };
    }
  } catch (e) {
    return { painel: reg.painel ?? null, erro: e.message };
  }
}
