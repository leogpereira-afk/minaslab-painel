// Regras puras da agenda da equipe (sem tela, sem rede): tipos, expansão em dias, "quem está fora hoje" e conferência do formulário.
import { diasEntre } from "./format.js";

export const TIPOS_AGENDA = [
  { id: "treinamento", rotulo: "Treinamento", cor: "brand", ausencia: false },
  { id: "reuniao", rotulo: "Reunião", cor: "brand", ausencia: false },
  { id: "evento", rotulo: "Evento", cor: "brand", ausencia: false },
  { id: "ferias", rotulo: "Férias", cor: "neutral", ausencia: true },
  { id: "ausencia", rotulo: "Ausência", cor: "neutral", ausencia: true },
];
export const tipoDaAgenda = (id) => TIPOS_AGENDA.find((t) => t.id === id) || TIPOS_AGENDA[2];
export const ehAusencia = (tipo) => tipoDaAgenda(tipo).ausencia;

const MAX_DIAS_EXPANDIDOS = 400;
const somaDias = (iso, n) => { const [a, m, d] = iso.split("-").map(Number); const x = new Date(Date.UTC(a, m - 1, d + n)); return x.toISOString().slice(0, 10); };
const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";
const nomeDe = (nomes, u) => nomes?.[u] || u;

/** "28/10/2026", "02/11 a 16/11/2026" ou "28/10/2026 às 14:00 até 16:00". */
export function periodoTexto(e) {
  const br = (d) => d.split("-").reverse().join("/");
  const dias = e.diaInicio === e.diaFim ? br(e.diaInicio) : `${br(e.diaInicio)} a ${br(e.diaFim)}`;
  if (!e.horaInicio) return e.diaInicio === e.diaFim ? `${dias} · dia inteiro` : dias;
  return `${dias} às ${e.horaInicio}${e.horaFim ? ` até ${e.horaFim}` : ""}`;
}

/** Título curto de linha do calendário: "Férias: Ruth (resp.: Caroline)" ou o próprio título. */
export function textoDoEvento(e, nomes) {
  if (ehAusencia(e.tipo)) {
    const quem = e.ausentes.map((u) => primeiroNome(nomeDe(nomes, u))).join(", ");
    const resp = e.responsaveis.map((u) => primeiroNome(nomeDe(nomes, u))).join(", ");
    return `${tipoDaAgenda(e.tipo).rotulo}: ${quem}${resp ? ` (resp.: ${resp})` : ""}`;
  }
  return `${tipoDaAgenda(e.tipo).rotulo}: ${e.titulo}`;
}

/** Um evento por dia do período, no formato do calendário. Fora de [de, ate] não entra; o teto evita semear anos por data errada. */
export function expandirEventos(eventos, nomes, de = "0000-00-00", ate = "9999-99-99") {
  const out = [];
  for (const e of eventos || []) {
    const ini = e.diaInicio < de ? de : e.diaInicio;
    const fim = e.diaFim > ate ? ate : e.diaFim;
    const total = Math.min(diasEntre(ini, fim) + 1, MAX_DIAS_EXPANDIDOS);
    for (let i = 0; i < total; i++) {
      out.push({ dia: somaDias(ini, i), hora: e.horaInicio || "", texto: textoDoEvento(e, nomes), cor: tipoDaAgenda(e.tipo).cor, origem: "equipe", agendaId: e.id, tipo: e.tipo });
    }
  }
  return out;
}

/** Quem está fora no dia, com quem responde: [{ usuario, nome, tipo, ate, responsaveis: [nome] }]. */
export function foraNoDia(eventos, dia, nomes) {
  const lista = [];
  for (const e of eventos || []) {
    if (!ehAusencia(e.tipo) || e.diaInicio > dia || e.diaFim < dia) continue;
    for (const u of e.ausentes) lista.push({ usuario: u, nome: nomeDe(nomes, u), tipo: e.tipo, ate: e.diaFim, responsaveis: e.responsaveis.map((r) => nomeDe(nomes, r)), agendaId: e.id });
  }
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Rascunho do formulário. Treinamento começa "para todos"; férias começam no dia escolhido. */
export function formVazio(tipo, dia, eu) {
  const aus = ehAusencia(tipo);
  return { tipo, titulo: "", descricao: "", local: "", diaInicio: dia, diaFim: dia, horaInicio: "", horaFim: "", paraTodos: tipo === "treinamento", participantes: [], ausentes: aus ? [eu] : [], responsaveis: [] };
}

/** Do evento salvo para o rascunho do formulário (editar). */
export const formDoEvento = (e) => ({ tipo: e.tipo, titulo: e.titulo, descricao: e.descricao || "", local: e.local || "", diaInicio: e.diaInicio, diaFim: e.diaFim, horaInicio: e.horaInicio || "", horaFim: e.horaFim || "", paraTodos: !!e.paraTodos, participantes: [...e.participantes], ausentes: [...e.ausentes], responsaveis: [...e.responsaveis] });

/** Texto do primeiro problema do rascunho, ou "" se está pronto. O servidor confere de novo; aqui é só para avisar antes. */
export function conferirForm(f) {
  if (!f.diaInicio || !f.diaFim) return "Informe as datas.";
  if (f.diaFim < f.diaInicio) return "A data final não pode ser antes da inicial.";
  if (f.horaFim && !f.horaInicio) return "Informe a hora de início.";
  if (f.horaInicio && f.horaFim && f.diaInicio === f.diaFim && f.horaFim < f.horaInicio) return "A hora final não pode ser antes da inicial.";
  if (ehAusencia(f.tipo)) {
    if (!f.ausentes.length) return "Escolha quem vai ficar ausente.";
    if (!f.responsaveis.length) return "Escolha quem fica responsável durante a ausência.";
    if (f.responsaveis.some((u) => f.ausentes.includes(u))) return "O responsável não pode ser a própria pessoa ausente.";
  } else if (!f.titulo.trim()) return "Dê um nome para o evento.";
  return "";
}
