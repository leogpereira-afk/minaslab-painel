// Lançamentos pelo Assistente (etapa 3, 12/11/2026): a IA PROPÕE, a pessoa CONFIRMA.
//
// - As ferramentas propor_compromisso / propor_tarefa só validam os dados e guardam uma proposta
//   (ml_assistente_propostas, status "pendente"). Nada é gravado no painel nesse momento.
// - Ao clicar em Confirmar, quem grava é a MESMA função que a tela usa, chamada com o crachá da pessoa:
//     compromisso → ml-sync  (action "upsert", coleção "compromissos")
//     tarefa      → ml-tarefas (action "criar")
//   Assim valem as mesmas permissões, carimbos, avisos e notificações das telas.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { CtxDados as CtxBase } from "./ferramentas.ts";

// O papel da conta (direcao, equipe, leitura) decide quem pode lançar.
export type CtxDados = CtxBase & { papel: string };

const txt = (v: unknown) => String(v ?? "").trim();
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIPOS_COMPROMISSO = ["reuniao", "visita", "retorno", "entrega", "cobranca", "outro"];
const ROTULO_TIPO: Record<string, string> = { reuniao: "Reunião", visita: "Visita", retorno: "Retorno ao cliente", entrega: "Entrega de laudo", cobranca: "Cobrança", outro: "Outro" };
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

class Recusa extends Error {}

/** Aceita usuário ("brenda") ou nome ("Brenda", "Brenda Kailany"); devolve o usuário ou recusa. */
function acharUsuario(c: CtxDados, valor: unknown): string {
  const v = norm(valor);
  if (!v) throw new Recusa("Pessoa vazia.");
  if (c.nomes.has(v)) return v;
  const porUsuario = [...c.nomes.keys()].find((u) => norm(u) === v);
  if (porUsuario) return porUsuario;
  const candidatos = [...c.nomes.entries()].filter(([, nome]) => norm(nome) === v || norm(nome).startsWith(v + " ") || norm(nome).split(" ")[0] === v);
  if (candidatos.length === 1) return candidatos[0][0];
  if (candidatos.length > 1) throw new Recusa(`"${valor}" combina com mais de uma pessoa: ${candidatos.map(([, n]) => n).join(", ")}. Pergunte qual delas.`);
  throw new Recusa(`Não achei "${valor}" entre os usuários ativos do painel.`);
}
const listaUsuarios = (c: CtxDados, l: unknown) => [...new Set((Array.isArray(l) ? l : []).map((x) => acharUsuario(c, x)))];

function podeLancarCompromisso(c: CtxDados) {
  // Mesma régua do podeEscreverColecao do ml-sync para "compromissos" (a confirmação passa por lá de novo).
  if (c.direcao) return true;
  if (c.papel !== "equipe") return false;
  if (!c.paginas.includes("__matriz_v1")) return true;
  return c.paginas.includes("compromissos");
}

function validarCompromisso(c: CtxDados, b: any) {
  if (!podeLancarCompromisso(c)) throw new Recusa("Esta pessoa não tem permissão para lançar compromissos no painel.");
  const titulo = txt(b.titulo).slice(0, 200);
  if (!titulo) throw new Recusa("Falta o título do compromisso.");
  const tipo = TIPOS_COMPROMISSO.includes(txt(b.tipo)) ? txt(b.tipo) : "outro";
  const data = txt(b.data);
  if (data && !DIA.test(data)) throw new Recusa("Data inválida (use AAAA-MM-DD).");
  const hora = txt(b.hora);
  if (hora && !HORA.test(hora)) throw new Recusa("Hora inválida (use HH:MM).");
  const paraTodos = b.para_toda_a_equipe === true;
  const participantes = paraTodos ? [] : listaUsuarios(c, b.participantes).filter((u) => u !== c.eu);
  return { titulo, tipo, cliente: txt(b.cliente).slice(0, 200), data, hora, obs: txt(b.obs).slice(0, 2000), paraTodos, participantes };
}

function prazoISO(v: unknown): string {
  const s = txt(v);
  if (!s) return "";
  // Só a data: fim do expediente em Brasília. Data e hora sem fuso: hora de Brasília.
  const comFuso = DIA.test(s) ? `${s}T18:00:00-03:00` : /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.length === 16 ? s + ":00" : s}-03:00`;
  const d = new Date(comFuso);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2020 || d.getUTCFullYear() > 2100) throw new Recusa("Prazo inválido (use AAAA-MM-DD ou AAAA-MM-DDTHH:MM).");
  return d.toISOString();
}

function validarTarefa(c: CtxDados, b: any) {
  if (c.papel === "leitura") throw new Recusa("Contas só de leitura não criam tarefas.");
  const titulo = txt(b.titulo).slice(0, 200);
  if (!titulo) throw new Recusa("Falta o título da tarefa.");
  const responsavel = txt(b.responsavel) ? acharUsuario(c, b.responsavel) : c.eu;
  const participantes = listaUsuarios(c, b.participantes).filter((u) => u !== responsavel && u !== c.eu);
  return { titulo, descricao: txt(b.descricao).slice(0, 5000), responsavel, participantes, prazo: prazoISO(b.prazo), urgente: b.urgente === true };
}

/** Texto curto para a IA e para o cartão. */
export function resumoProposta(c: CtxDados, tipo: string, d: any) {
  const nome = (u: string) => c.nomes.get(u) ?? u;
  if (tipo === "compromisso") {
    const quando = d.data ? `${d.data.split("-").reverse().join("/")}${d.hora ? ` às ${d.hora}` : ""}` : "sem data";
    const quem = d.paraTodos ? "toda a equipe" : d.participantes.length ? `você e ${d.participantes.map(nome).join(", ")}` : "só você";
    return `Compromisso (${ROTULO_TIPO[d.tipo]}): "${d.titulo}" — ${quando}${d.cliente ? ` — cliente ${d.cliente}` : ""} — quem vê: ${quem}`;
  }
  const prazo = d.prazo ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d.prazo)) : "sem prazo";
  return `Tarefa: "${d.titulo}" — responsável ${nome(d.responsavel)} — prazo ${prazo}${d.urgente ? " — urgente" : ""}${d.participantes.length ? ` — participantes: ${d.participantes.map(nome).join(", ")}` : ""}`;
}

// ------------------------------------------------------------------ ferramentas para a IA
export const FERRAMENTAS_LANCAMENTO = [
  {
    name: "ver_pessoas",
    description: "Lista os usuários ativos do painel (usuário e nome). Use antes de propor um lançamento que envolva outras pessoas, para acertar quem é quem.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "propor_compromisso",
    description: "PROPÕE um novo compromisso no módulo Compromissos. NÃO grava: a pessoa vê um cartão e decide se confirma. Use quando ela pedir para marcar/agendar/lançar um compromisso (reunião, visita, retorno, entrega de laudo, cobrança). Se faltar algo essencial (o que é, ou a data quando ela citou uma), pergunte antes.",
    input_schema: { type: "object", required: ["titulo"], properties: {
      titulo: { type: "string" },
      tipo: { type: "string", enum: TIPOS_COMPROMISSO },
      data: { type: "string", description: "AAAA-MM-DD" },
      hora: { type: "string", description: "HH:MM (24h)" },
      cliente: { type: "string" },
      obs: { type: "string" },
      para_toda_a_equipe: { type: "boolean", description: "true = aparece para todos" },
      participantes: { type: "array", items: { type: "string" }, description: "Usuários ou nomes de quem também deve ver. Vazio = só quem criou." },
    } },
  },
  {
    name: "propor_tarefa",
    description: "PROPÕE uma nova tarefa no módulo Tarefas. NÃO grava: a pessoa vê um cartão e decide se confirma. Use quando ela pedir para criar/delegar uma tarefa.",
    input_schema: { type: "object", required: ["titulo"], properties: {
      titulo: { type: "string" },
      descricao: { type: "string" },
      responsavel: { type: "string", description: "Usuário ou nome de quem vai fazer. Vazio = a própria pessoa." },
      participantes: { type: "array", items: { type: "string" } },
      prazo: { type: "string", description: "AAAA-MM-DD ou AAAA-MM-DDTHH:MM (horário de Brasília)" },
      urgente: { type: "boolean" },
    } },
  },
];

export async function executarLancamento(sb: SupabaseClient, c: CtxDados, nome: string, entrada: any, conversaId: string, propostas: string[]) {
  try {
    if (nome === "ver_pessoas") {
      return { texto: JSON.stringify({ pessoas: [...c.nomes.entries()].map(([usuario, n]) => ({ usuario, nome: n })), voce: c.eu }), erro: false };
    }
    const tipo = nome === "propor_compromisso" ? "compromisso" : nome === "propor_tarefa" ? "tarefa" : "";
    if (!tipo) return null;
    if (propostas.length >= 5) throw new Recusa("Limite de 5 propostas por resposta.");
    const dados = tipo === "compromisso" ? validarCompromisso(c, entrada ?? {}) : validarTarefa(c, entrada ?? {});
    const { data, error } = await sb.from("ml_assistente_propostas").insert({ usuario: c.eu, conversa_id: conversaId, tipo, dados }).select("id").single();
    if (error) throw error;
    propostas.push(data.id);
    return {
      texto: JSON.stringify({ ok: true, proposta: resumoProposta(c, tipo, dados), aviso: "Ainda NÃO foi gravado. A pessoa vai ver um cartão com os botões Confirmar e Descartar logo abaixo da sua resposta. Diga isso a ela em uma frase, sem repetir todos os detalhes." }),
      erro: false,
    };
  } catch (e) {
    if (e instanceof Recusa) return { texto: JSON.stringify({ erro: e.message }), erro: true };
    console.error("lancamento", nome, e);
    return { texto: JSON.stringify({ erro: "Não consegui preparar o lançamento agora." }), erro: true };
  }
}

// ------------------------------------------------------------------ confirmar / descartar
const URL_FUNCOES = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
const novoId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function chamarFuncao(nome: string, autorizacao: string, corpo: unknown) {
  const r = await fetch(`${URL_FUNCOES}/${nome}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: autorizacao },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(30_000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Recusa(txt(j?.erro) || `O painel recusou o lançamento (${r.status}).`);
  return j;
}

export async function decidirProposta(sb: SupabaseClient, c: CtxDados, id: string, confirmar: boolean, autorizacao: string) {
  const { data: p, error } = await sb.from("ml_assistente_propostas").select("*").eq("id", id).eq("usuario", c.eu).maybeSingle();
  if (error) throw error;
  if (!p) throw new Recusa("Proposta não encontrada.");
  if (p.status !== "pendente") return p;
  // Trava contra clique duplo: só segue quem conseguir tirar do "pendente".
  const { data: travada } = await sb.from("ml_assistente_propostas").update({ status: confirmar ? "confirmada" : "descartada", decidida_em: new Date().toISOString() })
    .eq("id", id).eq("status", "pendente").select("*").maybeSingle();
  if (!travada) { const { data: atual } = await sb.from("ml_assistente_propostas").select("*").eq("id", id).maybeSingle(); return atual; }
  if (!confirmar) return travada;

  try {
    const d = p.dados;
    let resultado: unknown;
    if (p.tipo === "compromisso") {
      const registro = {
        id: novoId("com"), criadoEm: new Date().toISOString(), titulo: d.titulo, tipo: d.tipo, cliente: d.cliente, data: d.data, hora: d.hora,
        telefone: "", obs: d.obs, feito: false, criador: c.eu, paraTodos: d.paraTodos, participantes: d.participantes,
      };
      const r = await chamarFuncao("ml-sync", autorizacao, { action: "upsert", colecao: "compromissos", registro });
      if (!r?.registro?.id) throw new Recusa("O painel não confirmou a gravação do compromisso.");
      resultado = { onde: "Compromissos", id: r.registro.id };
    } else {
      const r = await chamarFuncao("ml-tarefas", autorizacao, {
        action: "criar", titulo: d.titulo, descricao: d.descricao, responsavel: d.responsavel, participantes: d.participantes,
        prazo: d.prazo || null, urgente: d.urgente,
      });
      resultado = { onde: "Tarefas", id: r?.tarefa?.id ?? r?.id ?? null };
    }
    const { data: ok } = await sb.from("ml_assistente_propostas").update({ resultado }).eq("id", id).select("*").single();
    return ok;
  } catch (e) {
    const msg = e instanceof Recusa ? e.message : "Não consegui gravar agora.";
    if (!(e instanceof Recusa)) console.error("confirmar proposta", e);
    const { data: falhou } = await sb.from("ml_assistente_propostas").update({ status: "falhou", resultado: { erro: msg } }).eq("id", id).select("*").single();
    return falhou;
  }
}

export const formatarProposta = (c: CtxDados, p: any) => ({
  id: p.id, tipo: p.tipo, status: p.status, resumo: resumoProposta(c, p.tipo, p.dados), resultado: p.resultado ?? null,
});

export { Recusa };
