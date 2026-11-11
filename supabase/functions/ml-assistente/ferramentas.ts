// Ferramentas de LEITURA do Assistente (etapa 2, 11/11/2026): o Claude pede, esta função busca no banco.
//
// Regra de ouro: cada ferramenta aplica a MESMA régua de visão das telas e das outras funções —
//   compromissos  → lib/compromissosVisiveis.js (toda a equipe / pessoas escolhidas / só quem criou)
//                    + acesso à coleção como no ml-sync (podeConsultarColecao)
//   agenda equipe → ml-agenda (para todos, criador ou pessoa ligada ao evento)
//   tarefas       → ml-tarefas (proprietário, responsável, participante, observador; direção pode ver todas)
//   licitações e manutenções → acesso à coleção como no ml-sync
// Nada aqui grava. Se a régua de uma tela mudar, mude aqui também.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type CtxDados = { eu: string; nome: string; direcao: boolean; paginas: string[]; nomes: Map<string, string> };

const txt = (v: unknown) => String(v ?? "").trim();
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const somaDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nomeDe = (c: CtxDados, u: string) => c.nomes.get(u) ?? u;
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const primeiroEUltimo = (s: unknown) => { const p = norm(s).split(" ").filter(Boolean); return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : p[0] ?? ""; };
const mesmoNome = (a: unknown, b: unknown) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || primeiroEUltimo(a) === primeiroEUltimo(b)); };

// Mesma lógica do podeConsultarColecao do ml-sync, para as coleções que o Assistente lê.
function podeColecao(c: CtxDados, colecao: "compromissos" | "licitacoes" | "manutencoes") {
  if (c.direcao) return true;
  const p = c.paginas;
  if (!p.includes("__matriz_v1")) return true;
  return p.includes(colecao) || p.includes("calendario") || p.includes("inicio");
}

function periodo(b: any, hoje: string, padraoDias: number) {
  const de = DIA.test(txt(b?.de)) ? txt(b.de) : hoje;
  let ate = DIA.test(txt(b?.ate)) ? txt(b.ate) : somaDias(de, padraoDias);
  if (ate < de) ate = de;
  if (ate > somaDias(de, 400)) ate = somaDias(de, 400);
  return { de, ate };
}

async function registros(sb: SupabaseClient, colecao: string) {
  const { data, error } = await sb.from("ml_registros").select("id,registro").eq("colecao", colecao).eq("apagado", false).limit(3000);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, ...(r.registro ?? {}) }));
}

// ------------------------------------------------------------------ compromissos
function compromissoVisivel(c: CtxDados, x: any) {
  if (x.paraTodos === true) return true;
  const criador = txt(x.criador || x.atualizadoPor);
  if (criador === c.eu) return true;
  const part = Array.isArray(x.participantes) ? x.participantes : [];
  if (part.includes(c.eu)) return true;
  const antigo = !Array.isArray(x.participantes) && x.paraTodos === undefined;
  return antigo && mesmoNome(x.responsavelNome, c.nome);
}

async function verCompromissos(sb: SupabaseClient, c: CtxDados, b: any, hoje: string) {
  if (!podeColecao(c, "compromissos")) return { aviso: "Esta pessoa não tem acesso a Compromissos no painel." };
  const { de, ate } = periodo(b, hoje, 30);
  const incluirFeitos = b?.incluir_feitos === true;
  const todos = (await registros(sb, "compromissos")).filter((x) => compromissoVisivel(c, x));
  const lista = todos.filter((x) => {
    if (x.feito && !incluirFeitos) return false;
    if (!x.data) return !x.feito; // sem data: só os abertos
    if (!x.feito && x.data < hoje) return true; // atrasados sempre aparecem
    return x.data >= de && x.data <= ate;
  }).sort((a, z) => String(a.data || "9999").localeCompare(String(z.data || "9999")) || String(a.hora || "99").localeCompare(String(z.hora || "99")));
  return {
    hoje, periodo: { de, ate },
    compromissos: lista.slice(0, 120).map((x) => ({
      titulo: x.titulo, tipo: x.tipo, cliente: x.cliente || undefined, data: x.data || "sem data", hora: x.hora || undefined,
      situacao: x.feito ? "feito" : !x.data ? "sem data" : x.data < hoje ? "atrasado" : x.data === hoje ? "hoje" : "a fazer",
      obs: x.obs ? String(x.obs).slice(0, 300) : undefined,
      quem_ve: x.paraTodos ? "toda a equipe" : [txt(x.criador || x.atualizadoPor), ...(Array.isArray(x.participantes) ? x.participantes : [])].filter(Boolean).map((u) => nomeDe(c, u)).join(", "),
    })),
    total: lista.length,
  };
}

// ------------------------------------------------------------------ agenda da equipe
async function verAgendaEquipe(sb: SupabaseClient, c: CtxDados, b: any, hoje: string) {
  const { de, ate } = periodo(b, hoje, 30);
  const { data: evs, error } = await sb.from("ml_agenda_eventos").select("*").eq("cancelado", false).lte("dia_inicio", ate).gte("dia_fim", de).order("dia_inicio", { ascending: true }).limit(500);
  if (error) throw error;
  const ids = (evs ?? []).map((e: any) => e.id);
  const pessoas: any[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error: e2 } = await sb.from("ml_agenda_pessoas").select("evento_id,usuario,papel").in("evento_id", ids.slice(i, i + 150));
    if (e2) throw e2;
    pessoas.push(...(data ?? []));
  }
  const visiveis = (evs ?? []).filter((e: any) => e.para_todos || e.criador === c.eu || pessoas.some((p) => p.evento_id === e.id && p.usuario === c.eu));
  const de_ = (id: string, papel: string) => pessoas.filter((p) => p.evento_id === id && p.papel === papel).map((p) => nomeDe(c, p.usuario));
  return {
    hoje, periodo: { de, ate },
    eventos: visiveis.map((e: any) => ({
      tipo: e.tipo, titulo: e.titulo, de: e.dia_inicio, ate: e.dia_fim,
      horario: e.hora_inicio ? `${String(e.hora_inicio).slice(0, 5)}${e.hora_fim ? `–${String(e.hora_fim).slice(0, 5)}` : ""}` : "dia inteiro",
      local: e.local || undefined,
      ausentes: de_(e.id, "ausente"), responsaveis: de_(e.id, "responsavel"), participantes: de_(e.id, "participante"),
      para_toda_a_equipe: !!e.para_todos, criado_por: nomeDe(c, e.criador),
    })),
  };
}

// ------------------------------------------------------------------ tarefas
async function verTarefas(sb: SupabaseClient, c: CtxDados, b: any, hoje: string) {
  const status = ["abertas", "concluidas", "atrasadas"].includes(txt(b?.status)) ? txt(b.status) : "abertas";
  const todas = b?.escopo === "todas" && c.direcao;
  let tarefas: any[] = [];
  if (todas) {
    const { data, error } = await sb.from("ml_tarefas").select("*").eq("apagada", false).order("criado_em", { ascending: false }).limit(1000);
    if (error) throw error;
    tarefas = data ?? [];
  } else {
    const [r1, r2, r3] = await Promise.all([
      sb.from("ml_tarefas").select("*").eq("apagada", false).eq("proprietario", c.eu),
      sb.from("ml_tarefas").select("*").eq("apagada", false).eq("responsavel", c.eu),
      sb.from("ml_tarefa_pessoas").select("tarefa_id").eq("usuario", c.eu),
    ]);
    if (r1.error) throw r1.error; if (r2.error) throw r2.error; if (r3.error) throw r3.error;
    const mapa = new Map<string, any>();
    for (const t of [...(r1.data ?? []), ...(r2.data ?? [])]) mapa.set(t.id, t);
    const faltam = [...new Set((r3.data ?? []).map((l: any) => l.tarefa_id))].filter((id) => !mapa.has(id as string)) as string[];
    for (let i = 0; i < faltam.length; i += 150) {
      const { data, error } = await sb.from("ml_tarefas").select("*").in("id", faltam.slice(i, i + 150)).eq("apagada", false);
      if (error) throw error;
      for (const t of data ?? []) mapa.set(t.id, t);
    }
    tarefas = [...mapa.values()];
  }
  const prazoDia = (t: any) => (t.prazo ? String(t.prazo).slice(0, 10) : "");
  if (status === "concluidas") tarefas = tarefas.filter((t) => t.status === "concluida").sort((a, z) => String(z.concluida_em).localeCompare(String(a.concluida_em))).slice(0, 50);
  else {
    tarefas = tarefas.filter((t) => t.status !== "concluida");
    if (status === "atrasadas") tarefas = tarefas.filter((t) => prazoDia(t) && prazoDia(t) < hoje);
    tarefas.sort((a, z) => (prazoDia(a) || "9999").localeCompare(prazoDia(z) || "9999"));
  }
  return {
    hoje, escopo: todas ? "todas as tarefas da casa" : "tarefas desta pessoa",
    tarefas: tarefas.slice(0, 120).map((t) => ({
      titulo: t.titulo, status: t.status, prazo: t.prazo || "sem prazo", urgente: !!t.urgente,
      atrasada: t.status !== "concluida" && !!prazoDia(t) && prazoDia(t) < hoje,
      dono: nomeDe(c, t.proprietario), responsavel: nomeDe(c, t.responsavel),
      papel_desta_pessoa: [t.proprietario === c.eu && "dono", t.responsavel === c.eu && "responsável"].filter(Boolean).join(", ") || "participante/observador",
    })),
    total: tarefas.length,
  };
}

// ------------------------------------------------------------------ licitações
const LIC_ANDAMENTO = ["estudando", "proposta_enviada", "em_sessao"];
async function verLicitacoes(sb: SupabaseClient, c: CtxDados, b: any, hoje: string) {
  if (!podeColecao(c, "licitacoes")) return { aviso: "Esta pessoa não tem acesso a Licitações no painel." };
  const soAndamento = b?.todas !== true;
  const lista = (await registros(sb, "licitacoes")).filter((l) => !soAndamento || LIC_ANDAMENTO.includes(l.status))
    .sort((a, z) => String(a.dataSessao || "9999").localeCompare(String(z.dataSessao || "9999")));
  return {
    hoje,
    licitacoes: lista.slice(0, 100).map((l) => ({
      orgao: l.orgao, objeto: l.objeto ? String(l.objeto).slice(0, 200) : undefined, numero: l.numero || l.edital || undefined,
      modalidade: l.modalidade || undefined, status: l.status,
      sessao: l.dataSessao ? `${l.dataSessao}${l.horaSessao ? ` ${l.horaSessao}` : ""}` : "sem data",
      sessao_passou: !!l.dataSessao && l.dataSessao < hoje && LIC_ANDAMENTO.includes(l.status),
      valor_estimado: l.valorEstimado || undefined,
    })),
    total: lista.length,
  };
}

// ------------------------------------------------------------------ manutenções
async function verManutencoes(sb: SupabaseClient, c: CtxDados, _b: any, hoje: string) {
  if (!podeColecao(c, "manutencoes")) return { aviso: "Esta pessoa não tem acesso a Manutenções no painel." };
  const todas = await registros(sb, "manutencoes");
  const agendadas = todas.filter((m) => m.status === "agendada" && m.data);
  // Próxima de cada alvo: a da última manutenção feita (mesma ideia de lib/manutencaoRegra.js).
  const ultimas = new Map<string, any>();
  for (const m of todas.filter((x) => x.status !== "agendada" && x.data)) {
    const k = `${m.alvoTipo}:${m.alvoId}`;
    if (!ultimas.has(k) || String(ultimas.get(k).data) < String(m.data)) ultimas.set(k, m);
  }
  const proximas = [...ultimas.values()].filter((m) => m.proxima);
  return {
    hoje,
    agendadas: agendadas.sort((a, z) => String(a.data).localeCompare(String(z.data))).slice(0, 80).map((m) => ({ alvo: m.alvoNome, tipo: m.tipo, o_que: m.descricao, data: m.data, atrasada: m.data < hoje })),
    proximas_previstas: proximas.sort((a, z) => String(a.proxima).localeCompare(String(z.proxima))).slice(0, 80).map((m) => ({ alvo: m.alvoNome, ultima: m.data, proxima: m.proxima, vencida: m.proxima < hoje })),
  };
}

// ------------------------------------------------------------------ catálogo para a API
export const FERRAMENTAS = [
  {
    name: "ver_compromissos",
    description: "Lista os compromissos do painel (reuniões, visitas, retornos, entregas, cobranças) que ESTA pessoa pode ver. Atrasados e sem data abertos sempre vêm. Use para perguntas como 'o que tenho esta semana', 'compromissos atrasados', 'o que tenho amanhã'.",
    input_schema: { type: "object", properties: {
      de: { type: "string", description: "Data inicial AAAA-MM-DD (padrão: hoje)" },
      ate: { type: "string", description: "Data final AAAA-MM-DD (padrão: 30 dias depois de 'de')" },
      incluir_feitos: { type: "boolean", description: "Incluir os já concluídos (padrão: não)" },
    } },
  },
  {
    name: "ver_agenda_equipe",
    description: "Lista a Agenda da equipe que ESTA pessoa pode ver: treinamentos, reuniões, eventos, férias e ausências (com quem está fora e quem responde por ela). Use para 'quem está de férias', 'quem está fora hoje', 'próximos treinamentos'.",
    input_schema: { type: "object", properties: {
      de: { type: "string", description: "Data inicial AAAA-MM-DD (padrão: hoje)" },
      ate: { type: "string", description: "Data final AAAA-MM-DD (padrão: 30 dias depois de 'de')" },
    } },
  },
  {
    name: "ver_tarefas",
    description: "Lista as tarefas do módulo Tarefas em que ESTA pessoa é dona, responsável, participante ou observadora. Direção pode pedir escopo 'todas'.",
    input_schema: { type: "object", properties: {
      status: { type: "string", enum: ["abertas", "atrasadas", "concluidas"], description: "Padrão: abertas" },
      escopo: { type: "string", enum: ["minhas", "todas"], description: "'todas' só funciona para a direção" },
    } },
  },
  {
    name: "ver_licitacoes",
    description: "Lista as licitações do painel (órgão, objeto, status, data da sessão). Por padrão só as em andamento.",
    input_schema: { type: "object", properties: { todas: { type: "boolean", description: "Incluir também as encerradas (ganhas, perdidas, desistidas)" } } },
  },
  {
    name: "ver_manutencoes",
    description: "Lista manutenções agendadas e as próximas previstas de carros e equipamentos, marcando as atrasadas/vencidas.",
    input_schema: { type: "object", properties: {} },
  },
];

const EXEC: Record<string, (sb: SupabaseClient, c: CtxDados, b: any, hoje: string) => Promise<unknown>> = {
  ver_compromissos: verCompromissos,
  ver_agenda_equipe: verAgendaEquipe,
  ver_tarefas: verTarefas,
  ver_licitacoes: verLicitacoes,
  ver_manutencoes: verManutencoes,
};

/** Roda uma ferramenta e devolve o texto do resultado (JSON, cortado para não estourar o contexto). */
export async function executarFerramenta(sb: SupabaseClient, c: CtxDados, nome: string, entrada: any, hoje: string) {
  const fn = EXEC[nome];
  if (!fn) return { texto: JSON.stringify({ erro: `Ferramenta desconhecida: ${nome}` }), erro: true };
  try {
    const r = await fn(sb, c, entrada ?? {}, hoje);
    const s = JSON.stringify(r);
    return { texto: s.length > 30000 ? s.slice(0, 30000) + "…(cortado)" : s, erro: false };
  } catch (e) {
    console.error("ferramenta", nome, e);
    return { texto: JSON.stringify({ erro: "Não consegui ler esses dados agora." }), erro: true };
  }
}
