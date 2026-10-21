// Regras puras do Messenger (sem tela, sem rede): separadores de dia, "visualizado", busca e mesclagem de mensagens.
import { diaLocal } from "./tarefas.js";

const normalizar = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** "Hoje", "Ontem" ou "dd/mm/aaaa" para o separador entre dias da conversa. */
export function rotuloDoDia(iso, agora = new Date()) {
  const dia = diaLocal(iso);
  if (!dia) return "";
  const hoje = diaLocal(agora);
  if (dia === hoje) return "Hoje";
  const ontem = diaLocal(new Date(agora.getTime() - 86400000));
  if (dia === ontem) return "Ontem";
  return dia.split("-").reverse().join("/");
}

/** Intercala separadores de dia entre as mensagens: [{tipo:"dia",rotulo,chave} | {tipo:"msg",...}]. */
export function comSeparadores(mensagens, agora = new Date()) {
  const out = [];
  let ultimo = "";
  for (const m of mensagens || []) {
    const dia = diaLocal(m.criadoEm);
    if (dia && dia !== ultimo) { out.push({ tipo: "dia", chave: `dia-${dia}`, rotulo: rotuloDoDia(m.criadoEm, agora) }); ultimo = dia; }
    out.push({ tipo: "msg", chave: m.id || `seq-${m.seq}`, mensagem: m });
  }
  return out;
}

/** Junta mensagens novas às que já estão na tela (por seq), mantendo a ordem. Mensagens "enviando" (sem seq) ficam no fim. */
export function mesclarMensagens(atuais, novas) {
  const porSeq = new Map();
  const locais = [];
  for (const m of atuais || []) { if (m.seq != null) porSeq.set(m.seq, m); else locais.push(m); }
  for (const m of novas || []) porSeq.set(m.seq, m);
  const ordenadas = [...porSeq.values()].sort((a, b) => a.seq - b.seq);
  const idsNovos = new Set(ordenadas.map((m) => m.id));
  return [...ordenadas, ...locais.filter((m) => !idsNovos.has(m.id))];
}

/** Situação do tique de uma mensagem minha: "enviando" | "enviada" | "visualizada" (todos os outros membros já viram). */
export function situacaoDaMensagem(mensagem, membros, eu) {
  if (mensagem.seq == null) return "enviando";
  const outros = (membros || []).filter((m) => m.usuario !== eu);
  if (outros.length && outros.every((m) => Number(m.lidoAte) >= mensagem.seq)) return "visualizada";
  return "enviada";
}

/** Quem já viu a mensagem (para o "Visualizado por" dos grupos). */
export const quemViu = (mensagem, membros, eu) => (membros || []).filter((m) => m.usuario !== eu && Number(m.lidoAte) >= mensagem.seq).map((m) => m.usuario);

/** Filtra a lista de conversas por texto (título e última mensagem) e pelo filtro "só não lidas". */
export function filtrarConversas(conversas, { busca = "", soNaoLidas = false } = {}) {
  const q = normalizar(busca.trim());
  return (conversas || []).filter((c) => (!soNaoLidas || c.naoLidas > 0) && (!q || normalizar(c.titulo).includes(q) || normalizar(c.ultima?.texto).includes(q)));
}

/** Hora curta na lista: hoje → "14:05"; ontem → "Ontem"; antes → "21/10". */
export function horaNaLista(iso, agora = new Date(), horaLocal) {
  if (!iso) return "";
  const r = rotuloDoDia(iso, agora);
  if (r === "Hoje") return horaLocal(iso);
  if (r === "Ontem") return r;
  return r.slice(0, 5);
}

export const contadorTexto = (n) => (n > 99 ? "99+" : String(n));
