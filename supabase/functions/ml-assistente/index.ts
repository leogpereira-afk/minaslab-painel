// ml-assistente — o assistente de IA do painel (Claude, da Anthropic), para todos os usuários ativos.
//
// Etapa 1 (10/11/2026): conversa livre — escrever, tirar dúvidas, se organizar — com pesquisa na internet
// (ferramenta web_search da API, com as fontes).
// Etapa 2 (11/11/2026): LÊ dados do painel por ferramentas (ferramentas.ts) — compromissos, agenda da equipe,
// tarefas, licitações e manutenções — sempre com a mesma régua de visão das telas. Ainda NÃO grava nada.
//
// Segurança e custo:
// - A chave fica só no servidor (segredo ANTHROPIC_API_KEY). Sem ela, a função responde que a IA não está ligada.
// - Cada pessoa só vê e apaga as próprias conversas (tudo filtrado pelo usuário do crachá).
// - Limite por pessoa por dia (perguntas e buscas) e teto de gasto estimado do mês para a casa toda.
//   Os créditos da API são do Plano Max da Ana (US$ 100/mês); o teto fica abaixo disso.
//
// Ações: estado, conversas, abrir, enviar, renomear, apagar.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { FERRAMENTAS, executarFerramenta, type CtxDados } from "./ferramentas.ts";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY")!;
const J = Deno.env.get("ML_JWT_SECRET") ?? "";
// Tira espaços, quebras de linha e aspas que às vezes vêm junto ao colar a chave.
const CHAVE_IA = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
const sb = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder(), dec = new TextDecoder();
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const txt = (v: unknown) => String(v ?? "").trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Modelos e preços (US$ por milhão de tokens) — platform.claude.com/docs/en/about-claude/pricing, 10/11/2026.
const MODELOS = {
  rapido: { id: "claude-haiku-5-5", entrada: 0.10, saida: 0.50, rotulo: "Rápido" },
  avancado: { id: "claude-sonnet-5-5", entrada: 2, saida: 10, rotulo: "Avançado" },
} as const;
const CUSTO_BUSCA = 0.01; // US$ 10 por 1.000 pesquisas
const LIMITE_DIA = { perguntas: 40, avancado: 10, buscas: 30 };
const TETO_MES_USD = 85;
const MAX_TEXTO = 12000;
const HISTORICO = 24; // últimas mensagens enviadas como contexto
const MAX_SAIDA = 4000;

class Falha extends Error { constructor(public status: number, msg: string) { super(msg); } }
const erro = (status: number, msg: string): never => { throw new Falha(status, msg); };

function b64u(s: string) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }
async function crachaDoPainel(req: Request) {
  const t = txt(req.headers.get("authorization")).replace(/^Bearer\s+/i, "");
  if (!t || !J) return null;
  const p = t.split(".");
  if (p.length !== 3) return null;
  try {
    const k = await crypto.subtle.importKey("raw", enc.encode(J), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify("HMAC", k, b64u(p[2]), enc.encode(`${p[0]}.${p[1]}`))) return null;
    const x = JSON.parse(dec.decode(b64u(p[1])));
    if (x.sis !== "minaslab" || (typeof x.exp === "number" && x.exp < Math.floor(Date.now() / 1000))) return null;
    return x;
  } catch { return null; }
}

type Ctx = CtxDados;
async function carregarCtx(cracha: any): Promise<Ctx> {
  // Papel e páginas lidos AGORA na conta (não no crachá): acesso retirado vale na hora, como no ml-sync.
  const { data: contas, error } = await sb.from("ml_contas").select("usuario,nome,papel,ativo,paginas_consulta");
  if (error) throw error;
  const nomes = new Map<string, string>();
  let mim: any = null;
  for (const x of contas ?? []) {
    if (x.ativo) nomes.set(x.usuario, txt(x.nome) || x.usuario);
    if (x.usuario === txt(cracha.sub)) mim = x;
  }
  if (!mim?.ativo) erro(401, "Sua conta do painel está inativa. Entre de novo.");
  return {
    eu: mim.usuario, nome: txt(mim.nome) || mim.usuario, direcao: mim.papel === "direcao",
    paginas: Array.isArray(mim.paginas_consulta) ? mim.paginas_consulta : [], nomes,
  };
}

const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dataLongaSP = () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

async function usoDoDia(eu: string) {
  const { data } = await sb.from("ml_assistente_uso").select("perguntas,buscas").eq("usuario", eu).eq("dia", hojeSP()).maybeSingle();
  return { perguntas: data?.perguntas ?? 0, buscas: data?.buscas ?? 0 };
}
async function avancadosDoDia(eu: string) {
  const inicio = `${hojeSP()}T00:00:00-03:00`;
  const { data: convs } = await sb.from("ml_assistente_conversas").select("id").eq("usuario", eu).gte("atualizada_em", inicio);
  const ids = (convs ?? []).map((c: any) => c.id);
  if (!ids.length) return 0;
  const { count } = await sb.from("ml_assistente_mensagens").select("id", { count: "exact", head: true })
    .in("conversa_id", ids).eq("papel", "assistant").eq("modelo", MODELOS.avancado.id).gte("criada_em", inicio);
  return count ?? 0;
}
async function gastoDoMes() {
  const mes = hojeSP().slice(0, 7);
  const { data } = await sb.from("ml_assistente_uso").select("custo_usd").gte("dia", `${mes}-01`);
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.custo_usd || 0), 0);
}

async function minhaConversa(c: Ctx, id: string) {
  if (!UUID.test(id)) erro(400, "Conversa inválida.");
  const { data, error } = await sb.from("ml_assistente_conversas").select("*").eq("id", id).eq("usuario", c.eu).maybeSingle();
  if (error) throw error;
  if (!data) erro(404, "Conversa não encontrada.");
  return data;
}

function sistema(c: Ctx) {
  return [
    `Você é o Assistente MinasLab, a IA do Painel de Gestão da MinasLab, um laboratório de controle de qualidade (análises de água, efluentes e afins) em Minas Gerais, Brasil.`,
    `Você está conversando com ${c.nome} (usuário "${c.eu}"). Hoje é ${dataLongaSP()}.`,
    `Responda sempre em português do Brasil, de forma clara, cordial e objetiva. Use Markdown simples (títulos curtos, listas, **negrito**, tabelas pequenas) quando ajudar a leitura.`,
    `Você ajuda a escrever (e-mails, propostas, comunicados, mensagens a clientes), tira dúvidas sobre qualquer assunto, explica normas e cálculos e ajuda a pessoa a se organizar (planos, listas, prioridades, resumos).`,
    `Quando a pergunta depender de informação atual, de preços, de leis e normas vigentes ou de fatos que você não tenha certeza, use a pesquisa na internet e cite as fontes. Não invente números, leis ou referências.`,
    `Você TEM ferramentas para LER dados do painel desta pessoa: compromissos, agenda da equipe (treinamentos, reuniões, férias e ausências), tarefas, licitações e manutenções. Use-as sempre que a pergunta for sobre a agenda, os prazos ou o trabalho dela — não chute. As ferramentas já trazem só o que esta pessoa pode ver; nunca diga que existe algo além disso.`,
    `Ao responder com dados do painel: datas no formato DD/MM, destaque o que está atrasado ou é para hoje, e diga em qual tela a pessoa encontra (Compromissos, Calendário, Tarefas, Licitações, Manutenções). Se a ferramenta avisar que a pessoa não tem acesso, diga isso com educação.`,
    `Você ainda NÃO grava nada no painel (não cria nem altera compromissos ou tarefas) e não tem acesso a clientes, financeiro, RH ou estoque. Se pedirem isso, explique que ainda não está disponível e indique a tela certa.`,
    `Você também ainda não gera imagens. Pode descrever ou sugerir ideias de imagem em texto.`,
    `Não peça nem aceite senhas, chaves ou dados bancários. Em temas jurídicos, contábeis ou de saúde, dê a informação e lembre que um profissional deve confirmar.`,
  ].join("\n");
}

type Fonte = { url: string; titulo: string };
function extrair(conteudo: any[]): { texto: string; fontes: Fonte[]; buscas: number } {
  let texto = "";
  const fontes: Fonte[] = [];
  let buscas = 0;
  const vistos = new Set<string>();
  for (const b of conteudo ?? []) {
    if (b?.type === "text") {
      texto += b.text ?? "";
      for (const ci of b.citations ?? []) {
        const url = txt(ci?.url);
        if (url && !vistos.has(url)) { vistos.add(url); fontes.push({ url, titulo: txt(ci?.title) || url }); }
      }
    } else if (b?.type === "server_tool_use" && b?.name === "web_search") {
      buscas++;
    }
  }
  return { texto: texto.trim(), fontes, buscas };
}

async function chamarClaude(modelo: string, mensagens: any[], c: Ctx, pesquisar: boolean, buscasRestantes: number) {
  const tools: any[] = [...FERRAMENTAS];
  if (pesquisar && buscasRestantes > 0) {
    tools.push({ type: "web_search_20250305", name: "web_search", max_uses: Math.min(3, buscasRestantes), user_location: { type: "approximate", country: "BR", region: "Minas Gerais", timezone: "America/Sao_Paulo" } });
  }
  const hoje = hojeSP();
  const conversa = [...mensagens];
  const todos: any[] = [];   // todos os blocos (para fontes e contagem de buscas)
  let finais: any[] = [];    // blocos da resposta final (depois da última consulta ao painel)
  let tokEntrada = 0, tokSaida = 0, buscasCobradas = 0;
  // Ciclo: o Claude pode pedir dados do painel (tool_use) ou pausar um turno longo de pesquisa (pause_turn).
  for (let volta = 0; volta < 8; volta++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": CHAVE_IA, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: modelo, max_tokens: MAX_SAIDA, system: sistema(c), messages: conversa, tools }),
      signal: AbortSignal.timeout(120_000),
    });
    const corpo = await r.json().catch(() => null);
    if (!r.ok) {
      const tipo = txt(corpo?.error?.type), msg = txt(corpo?.error?.message);
      console.error("anthropic", r.status, tipo, msg);
      // Diagnóstico sem expor nada da chave: só se tem o formato esperado e o tamanho.
      if (r.status === 401) console.error("chave recusada: formato sk-ant-api =", CHAVE_IA.startsWith("sk-ant-api"), "tamanho", CHAVE_IA.length);
      if (r.status === 401) erro(503, "A chave da IA não foi aceita. Avise a direção para conferir o segredo ANTHROPIC_API_KEY.");
      if (r.status === 429 || r.status === 529) erro(503, "A IA está muito ocupada agora. Tente de novo em alguns segundos.");
      if (/credit|billing|balance/i.test(msg)) erro(503, "Os créditos da IA deste mês acabaram. Eles renovam no próximo ciclo do plano.");
      erro(502, "A IA não conseguiu responder agora. Tente de novo.");
    }
    const conteudo = corpo.content ?? [];
    todos.push(...conteudo);
    tokEntrada += Number(corpo.usage?.input_tokens ?? 0) + Number(corpo.usage?.cache_creation_input_tokens ?? 0) + Number(corpo.usage?.cache_read_input_tokens ?? 0);
    tokSaida += Number(corpo.usage?.output_tokens ?? 0);
    buscasCobradas += Number(corpo.usage?.server_tool_use?.web_search_requests ?? 0);

    if (corpo.stop_reason === "tool_use") {
      // O texto de antes da consulta ("vou verificar…") não entra na resposta final.
      finais = [];
      conversa.push({ role: "assistant", content: conteudo });
      const resultados = [];
      for (const b of conteudo.filter((x: any) => x?.type === "tool_use")) {
        const res = await executarFerramenta(sb, c, b.name, b.input, hoje);
        resultados.push({ type: "tool_result", tool_use_id: b.id, content: res.texto, ...(res.erro ? { is_error: true } : {}) });
      }
      conversa.push({ role: "user", content: resultados });
      continue;
    }
    finais.push(...conteudo);
    if (corpo.stop_reason === "pause_turn") { conversa.push({ role: "assistant", content: conteudo }); continue; }
    break;
  }
  const fontes = extrair(todos).fontes;
  const ex = extrair(finais);
  return { texto: ex.texto, fontes, buscas: Math.max(extrair(todos).buscas, buscasCobradas), tokEntrada, tokSaida };
}

async function enviar(c: Ctx, b: any) {
  if (!CHAVE_IA) erro(503, "A IA ainda não foi ligada no servidor. Falta cadastrar a chave (segredo ANTHROPIC_API_KEY).");
  const texto = txt(b.texto);
  if (!texto) erro(400, "Escreva a sua pergunta.");
  if (texto.length > MAX_TEXTO) erro(400, `Texto muito longo (máximo de ${MAX_TEXTO} caracteres).`);
  const avancado = b.modo === "avancado";
  const pesquisar = b.pesquisar !== false;
  const modelo = avancado ? MODELOS.avancado : MODELOS.rapido;

  const uso = await usoDoDia(c.eu);
  if (uso.perguntas >= LIMITE_DIA.perguntas) erro(429, `Você chegou ao limite de ${LIMITE_DIA.perguntas} perguntas por dia. Amanhã libera de novo.`);
  if (avancado && await avancadosDoDia(c.eu) >= LIMITE_DIA.avancado) erro(429, `O modo Avançado tem limite de ${LIMITE_DIA.avancado} respostas por dia. Use o modo Rápido ou tente amanhã.`);
  if (await gastoDoMes() >= TETO_MES_USD) erro(429, "O uso da IA deste mês chegou ao teto combinado. Libera de novo no começo do mês que vem.");

  // Conversa: a escolhida (se for minha) ou uma nova, com o título tirado da primeira pergunta.
  let conversa: any;
  if (txt(b.conversaId)) conversa = await minhaConversa(c, txt(b.conversaId));
  else {
    const titulo = texto.replace(/\s+/g, " ").slice(0, 60) + (texto.length > 60 ? "…" : "");
    const { data, error } = await sb.from("ml_assistente_conversas").insert({ usuario: c.eu, titulo }).select("*").single();
    if (error) throw error;
    conversa = data;
  }

  const { data: anteriores, error: e1 } = await sb.from("ml_assistente_mensagens").select("papel,texto")
    .eq("conversa_id", conversa.id).order("id", { ascending: false }).limit(HISTORICO);
  if (e1) throw e1;
  const historico = (anteriores ?? []).reverse().map((m: any) => ({ role: m.papel, content: m.texto }));
  // A API exige que a conversa comece pelo usuário e alterne os papéis.
  while (historico.length && historico[0].role !== "user") historico.shift();
  const mensagens = [...historico, { role: "user", content: texto }];

  const { data: pergunta, error: e2 } = await sb.from("ml_assistente_mensagens").insert({ conversa_id: conversa.id, papel: "user", texto }).select("id").single();
  if (e2) throw e2;

  let r;
  try {
    r = await chamarClaude(modelo.id, mensagens, c, pesquisar, LIMITE_DIA.buscas - uso.buscas);
  } catch (e) {
    // Sem resposta, a pergunta não fica órfã no histórico (a alternância de papéis quebraria a próxima chamada);
    // conversa nova que não chegou a ter resposta também sai.
    await sb.from("ml_assistente_mensagens").delete().eq("id", pergunta.id);
    if (!txt(b.conversaId)) await sb.from("ml_assistente_conversas").delete().eq("id", conversa.id).eq("usuario", c.eu);
    throw e;
  }
  const resposta = r.texto || "Não consegui formular uma resposta. Pode reformular a pergunta?";
  const custo = (r.tokEntrada * modelo.entrada + r.tokSaida * modelo.saida) / 1_000_000 + r.buscas * CUSTO_BUSCA;

  const { data: msg, error: e3 } = await sb.from("ml_assistente_mensagens")
    .insert({ conversa_id: conversa.id, papel: "assistant", texto: resposta, fontes: r.fontes, modelo: modelo.id }).select("*").single();
  if (e3) throw e3;
  await sb.from("ml_assistente_conversas").update({ atualizada_em: new Date().toISOString() }).eq("id", conversa.id);
  await sb.rpc("ml_assistente_registrar_uso", { p_usuario: c.eu, p_perguntas: 1, p_buscas: r.buscas, p_tokens_entrada: r.tokEntrada, p_tokens_saida: r.tokSaida, p_custo: custo });

  return { conversa: { id: conversa.id, titulo: conversa.titulo }, mensagem: formatarMsg(msg) };
}

const formatarMsg = (m: any) => ({ id: m.id, papel: m.papel, texto: m.texto, fontes: m.fontes ?? [], modelo: m.modelo, criadaEm: m.criada_em });

async function estado(c: Ctx) {
  const uso = await usoDoDia(c.eu);
  return {
    ligado: !!CHAVE_IA,
    nome: c.nome,
    limites: LIMITE_DIA,
    uso: { ...uso, avancado: await avancadosDoDia(c.eu) },
  };
}

async function conversas(c: Ctx) {
  const { data, error } = await sb.from("ml_assistente_conversas").select("id,titulo,atualizada_em").eq("usuario", c.eu).order("atualizada_em", { ascending: false }).limit(100);
  if (error) throw error;
  return { conversas: (data ?? []).map((x: any) => ({ id: x.id, titulo: x.titulo, atualizadaEm: x.atualizada_em })) };
}

async function abrir(c: Ctx, b: any) {
  const conv = await minhaConversa(c, txt(b.id));
  const { data, error } = await sb.from("ml_assistente_mensagens").select("*").eq("conversa_id", conv.id).order("id", { ascending: true }).limit(500);
  if (error) throw error;
  return { conversa: { id: conv.id, titulo: conv.titulo }, mensagens: (data ?? []).map(formatarMsg) };
}

async function renomear(c: Ctx, b: any) {
  const conv = await minhaConversa(c, txt(b.id));
  const titulo = txt(b.titulo).slice(0, 80);
  if (!titulo) erro(400, "Dê um nome para a conversa.");
  const { error } = await sb.from("ml_assistente_conversas").update({ titulo }).eq("id", conv.id).eq("usuario", c.eu);
  if (error) throw error;
  return { ok: true };
}

async function apagar(c: Ctx, b: any) {
  const conv = await minhaConversa(c, txt(b.id));
  const { error } = await sb.from("ml_assistente_conversas").delete().eq("id", conv.id).eq("usuario", c.eu);
  if (error) throw error;
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  try {
    const cracha = await crachaDoPainel(req);
    if (!cracha) return json({ erro: "Sua sessão expirou. Entre de novo." }, 401);
    const c = await carregarCtx(cracha);
    const b = await req.json().catch(() => ({}));
    switch (txt(b.action)) {
      case "estado": return json(await estado(c));
      case "conversas": return json(await conversas(c));
      case "abrir": return json(await abrir(c, b));
      case "enviar": return json(await enviar(c, b));
      case "renomear": return json(await renomear(c, b));
      case "apagar": return json(await apagar(c, b));
      default: return json({ erro: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    if (e instanceof Falha) return json({ erro: e.message }, e.status);
    console.error("ml-assistente", e);
    return json({ erro: "Não consegui concluir agora. Tente de novo em instantes." }, 500);
  }
});
