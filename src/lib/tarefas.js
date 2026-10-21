// Regras puras das Tarefas (sem tela, sem rede): colunas por prazo, atraso, rótulos e datas.
// Todas as datas são lidas no horário de São Paulo (o Brasil não tem horário de verão desde 2019: UTC-3 fixo).

const FUSO = "America/Sao_Paulo";
const OFFSET = "-03:00";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const partes = (data) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(data).map((x) => [x.type, x.value]));
  return { ano: Number(p.year), mes: Number(p.month), dia: Number(p.day), hora: p.hour, minuto: p.minute };
};
const doisDigitos = (n) => String(n).padStart(2, "0");

/** "AAAA-MM-DD" do dia de São Paulo em que o instante cai. */
export function diaLocal(valor) {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  const p = partes(d);
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}`;
}
export const horaLocal = (valor) => { const d = new Date(valor); if (Number.isNaN(d.getTime())) return ""; const p = partes(d); return `${p.hora}:${p.minuto}`; };

const somarDias = (iso, n) => { const [a, m, d] = iso.split("-").map(Number); const x = new Date(Date.UTC(a, m - 1, d + n)); return `${x.getUTCFullYear()}-${doisDigitos(x.getUTCMonth() + 1)}-${doisDigitos(x.getUTCDate())}`; };
const diaDaSemana = (iso) => { const [a, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d)).getUTCDay(); }; // 0 = domingo

/** Semana de segunda a domingo (como no Bitrix24): devolve [segunda, domingo] do dia informado. */
export function semanaDe(iso) {
  const dow = diaDaSemana(iso);
  const segunda = somarDias(iso, dow === 0 ? -6 : 1 - dow);
  return [segunda, somarDias(segunda, 6)];
}

export const COLUNAS_PRAZO = [
  { id: "vencido", titulo: "Vencido", cor: "#ef5350", texto: "#ffffff" },
  { id: "hoje", titulo: "Vence hoje", cor: "#9ccc00", texto: "#1f2d00" },
  { id: "semana", titulo: "Vence esta semana", cor: "#29b6f6", texto: "#00263a" },
  { id: "proxima", titulo: "Vence na próxima semana", cor: "#26c6da", texto: "#00292e" },
  { id: "depois", titulo: "Vence mais tarde", cor: "#9fa8da", texto: "#1a1f4a" },
  { id: "sem_prazo", titulo: "Sem prazo", cor: "#b0bec5", texto: "#1c262b" },
];

/** Em que coluna do quadro "Prazo" a tarefa cai. Tarefa concluída não tem coluna (null). */
export function colunaDoPrazo(tarefa, agora = new Date()) {
  if (!tarefa || tarefa.status === "concluida") return null;
  if (!tarefa.prazo) return "sem_prazo";
  const prazo = new Date(tarefa.prazo);
  if (Number.isNaN(prazo.getTime())) return "sem_prazo";
  if (prazo.getTime() < agora.getTime()) return "vencido";
  const hoje = diaLocal(agora), dia = diaLocal(prazo);
  if (dia === hoje) return "hoje";
  const [, fimSemana] = semanaDe(hoje);
  if (dia <= fimSemana) return "semana";
  const [iniProx, fimProx] = semanaDe(somarDias(fimSemana, 1));
  if (dia >= iniProx && dia <= fimProx) return "proxima";
  return "depois";
}

/** Agrupa as tarefas nas colunas, na ordem fixa. Dentro de cada coluna: urgentes primeiro, depois por prazo. */
export function agruparPorPrazo(tarefas, agora = new Date()) {
  const mapa = new Map(COLUNAS_PRAZO.map((c) => [c.id, []]));
  for (const t of tarefas || []) { const col = colunaDoPrazo(t, agora); if (col) mapa.get(col).push(t); }
  return COLUNAS_PRAZO.map((c) => ({
    ...c,
    tarefas: mapa.get(c.id).sort((a, b) => Number(b.urgente) - Number(a.urgente) || String(a.prazo || "9999").localeCompare(String(b.prazo || "9999")) || String(a.titulo).localeCompare(String(b.titulo), "pt-BR")),
  }));
}

/** Quanto tempo passou do prazo, em texto curto: "3 horas", "5 dias", "2 semanas", "3 meses". Vazio se não venceu. */
export function atrasoTexto(prazo, agora = new Date()) {
  if (!prazo) return "";
  const ms = agora.getTime() - new Date(prazo).getTime();
  if (!(ms > 0)) return "";
  const min = Math.floor(ms / 60000), horas = Math.floor(min / 60), dias = Math.floor(horas / 24);
  const plural = (n, u, pl) => `${n} ${n === 1 ? u : pl}`;
  if (min < 60) return plural(Math.max(min, 1), "minuto", "minutos");
  if (horas < 24) return plural(horas, "hora", "horas");
  if (dias < 14) return plural(dias, "dia", "dias");
  if (dias < 60) return plural(Math.floor(dias / 7), "semana", "semanas");
  return plural(Math.floor(dias / 30), "mês", "meses");
}
export const diasDeAtraso = (prazo, agora = new Date()) => { if (!prazo) return 0; const ms = agora.getTime() - new Date(prazo).getTime(); return ms > 0 ? Math.max(1, Math.floor(ms / 86400000)) : 0; };

/** Rótulo do prazo no cartão: "Hoje, 18:00", "Amanhã, 09:00", "24 de outubro, 18:00" (com o ano se for outro ano). */
export function rotuloPrazo(prazo, agora = new Date()) {
  if (!prazo) return "Sem prazo";
  const d = new Date(prazo);
  if (Number.isNaN(d.getTime())) return "Sem prazo";
  const dia = diaLocal(d), hoje = diaLocal(agora), hora = horaLocal(d);
  if (dia === hoje) return `Hoje, ${hora}`;
  if (dia === somarDias(hoje, 1)) return `Amanhã, ${hora}`;
  if (dia === somarDias(hoje, -1)) return `Ontem, ${hora}`;
  const [a, m, n] = dia.split("-").map(Number);
  const [anoHoje] = hoje.split("-").map(Number);
  return `${n} de ${MESES[m - 1]}${a !== anoHoje ? ` de ${a}` : ""}, ${hora}`;
}

/** Valor para <input type="datetime-local"> (hora de São Paulo). */
export function paraInputLocal(prazo) {
  if (!prazo) return "";
  const d = new Date(prazo);
  if (Number.isNaN(d.getTime())) return "";
  const p = partes(d);
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}T${p.hora}:${p.minuto}`;
}
/** Do <input type="datetime-local"> para o instante (ISO). Vazio vira null. */
export function deInputLocal(valor) {
  const v = String(valor || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Atalhos de prazo para o formulário: hoje 18:00, amanhã 18:00 e a próxima segunda 18:00. */
export function atalhosDePrazo(agora = new Date()) {
  const hoje = diaLocal(agora);
  const dow = diaDaSemana(hoje);
  const proxSegunda = somarDias(hoje, dow === 1 ? 7 : (8 - dow) % 7 || 7);
  const mk = (dia) => `${dia}T18:00`;
  return [
    { id: "hoje", rotulo: "Hoje, 18:00", valor: mk(hoje) },
    { id: "amanha", rotulo: "Amanhã, 18:00", valor: mk(somarDias(hoje, 1)) },
    { id: "segunda", rotulo: "Próxima segunda, 18:00", valor: mk(proxSegunda) },
  ];
}

export const STATUS_TAREFA = {
  nova: { rotulo: "Nova", classe: "bg-slate-100 text-slate-700" },
  em_andamento: { rotulo: "Em andamento", classe: "bg-sky-100 text-sky-700" },
  aguardando: { rotulo: "Aguardando", classe: "bg-amber-100 text-amber-800" },
  concluida: { rotulo: "Concluída", classe: "bg-emerald-100 text-emerald-700" },
};

export const PAPEIS_FILTRO = [
  { id: "todas", rotulo: "Todas as funções" },
  { id: "responsavel", rotulo: "Responsável" },
  { id: "proprietario", rotulo: "Proprietário" },
  { id: "participante", rotulo: "Participante" },
  { id: "observador", rotulo: "Observador" },
];

/** Iniciais para o círculo da pessoa: "ANA CLAUDIA PESSOA" → "AP" (primeira e última palavras). */
export function iniciais(nome) {
  const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase();
}
const PALETA = ["#2563eb", "#0f766e", "#7c3aed", "#c2410c", "#db2777", "#0891b2", "#4f46e5", "#15803d", "#a16207", "#be123c"];
/** Cor estável por usuário: a mesma pessoa tem sempre a mesma cor. */
export function corDoAvatar(usuario) {
  let h = 0;
  for (const ch of String(usuario || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

export const progressoChecklist = (cl) => (cl && cl.total > 0 ? Math.round((cl.feitos / cl.total) * 100) : 0);

/** Resumo do topo: quantas abertas estão atrasadas, quantas vencem hoje e quantas têm novidade. */
export function resumoDasTarefas(tarefas, agora = new Date()) {
  let atrasadas = 0, hoje = 0, naoLidas = 0;
  for (const t of tarefas || []) {
    if (t.status === "concluida") continue;
    const c = colunaDoPrazo(t, agora);
    if (c === "vencido") atrasadas++;
    if (c === "hoje") hoje++;
    if (t.naoLidas > 0) naoLidas++;
  }
  return { atrasadas, hoje, naoLidas };
}

/** Texto do aviso do sino: "Fulano comentou..." → tempo relativo curto. */
export function tempoRelativo(iso, agora = new Date()) {
  const ms = agora.getTime() - new Date(iso).getTime();
  if (!(ms >= 0)) return "agora";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  return diaLocal(iso).split("-").reverse().join("/");
}

/** Opções do lembrete: minutos ANTES do prazo (null = sem lembrete). Os mesmos valores que o servidor aceita. */
export const LEMBRETES = [
  { valor: null, rotulo: "Sem lembrete" },
  { valor: 0, rotulo: "Na hora do prazo" },
  { valor: 15, rotulo: "15 minutos antes" },
  { valor: 30, rotulo: "30 minutos antes" },
  { valor: 60, rotulo: "1 hora antes" },
  { valor: 120, rotulo: "2 horas antes" },
  { valor: 1440, rotulo: "1 dia antes" },
  { valor: 2880, rotulo: "2 dias antes" },
];
export const rotuloLembrete = (min) => LEMBRETES.find((l) => l.valor === (min ?? null))?.rotulo ?? "Sem lembrete";
/** Valor do <select> (texto) para o que vai ao servidor (número ou null). */
export const lembreteDoSelect = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
/** Quando o aviso toca: prazo menos os minutos do lembrete. Null se faltar um dos dois. */
export function quandoAvisa(prazo, lembrete) {
  if (!prazo || lembrete === null || lembrete === undefined) return null;
  const d = new Date(new Date(prazo).getTime() - Number(lembrete) * 60000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Repetição das tarefas. Dias da semana: 0 = domingo ... 6 = sábado (igual ao servidor). */
export const TIPOS_REPETICAO = [
  { id: "", rotulo: "Não repetir" },
  { id: "diaria", rotulo: "Todo dia" },
  { id: "dias_uteis", rotulo: "Dias úteis (segunda a sexta)" },
  { id: "semanal", rotulo: "Toda semana" },
  { id: "mensal", rotulo: "Todo mês" },
];
export const DIAS_SEMANA = [
  { id: 1, curto: "Seg", nome: "segunda" }, { id: 2, curto: "Ter", nome: "terça" }, { id: 3, curto: "Qua", nome: "quarta" },
  { id: 4, curto: "Qui", nome: "quinta" }, { id: 5, curto: "Sex", nome: "sexta" }, { id: 6, curto: "Sáb", nome: "sábado" }, { id: 0, curto: "Dom", nome: "domingo" },
];
/** "Todo dia às 08:00", "Toda segunda e quarta às 09:30", "Todo dia 5 do mês às 08:00". */
export function resumoRecorrencia(r) {
  if (!r) return "";
  const hora = String(r.hora || "08:00").slice(0, 5);
  if (r.tipo === "diaria") return `Todo dia às ${hora}`;
  if (r.tipo === "dias_uteis") return `Dias úteis às ${hora}`;
  if (r.tipo === "semanal") {
    const nomes = [...(r.dias_semana || [])].sort((a, b) => (a || 7) - (b || 7)).map((d) => DIAS_SEMANA.find((x) => x.id === d)?.nome).filter(Boolean);
    if (!nomes.length) return "";
    const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
    return `Toda ${lista} às ${hora}`;
  }
  if (r.tipo === "mensal") return `Todo dia ${r.dia_mes} do mês às ${hora}`;
  return "";
}
