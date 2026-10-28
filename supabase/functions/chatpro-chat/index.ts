// chatpro-chat: ponte do CRM com a API do ChatPro Chat (sparks.chatpro.com.br),
// usando o token salvo no servidor (CHATPRO_CHAT_TOKEN).
//
// Ações (corpo { acao, ... }):
//   verificar       confere o token (usuários e motivos)
//   sincronizar     usuários, motivos, departamentos + reaplica eventos + confere sessões
//   sessoes         usuários, motivos, departamentos + confere sessões abertas
//   contatos        envia ao ChatPro o nome "Nome - Empresa" dos atendimentos com cadastro
//   finalizar       { lead_id, motivo_id }       finaliza a conversa aberta no ChatPro
//   atribuir        { lead_id, perfil_id }       transfere a conversa para o atendente
//   enviar_arquivo  { lead_id, caminho, legenda } envia um arquivo do bucket chatpro-envios
//
// Quem chama: rotina (cabeçalho x-rotina-token, conferido no cofre) ou usuário
// logado do CRM (Authorization: Bearer <jwt>); ações que alteram o ChatPro
// exigem a permissão crm.write.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const BASE = "https://sparks.chatpro.com.br";
const BUCKET = "chatpro-envios";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, x-rotina-token, apikey, x-client-info" };

function fromJson(name: string): string {
  try { return JSON.parse(Deno.env.get(name) ?? "{}")["default"] ?? ""; } catch { return ""; }
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEY = Deno.env.get("SB_SECRET_KEY") || fromJson("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function json(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS }); }

// Lista "embrulhada" de jeitos diferentes conforme o endpoint.
function lista(x: any): any[] {
  if (Array.isArray(x)) return x;
  for (const k of ["data", "users", "items", "results", "endings", "departments", "result", "rows"]) {
    if (Array.isArray(x?.[k])) return x[k];
    if (x?.[k] && typeof x[k] === "object") { const r = lista(x[k]); if (r.length) return r; }
  }
  return [];
}
// Objeto único (getSessionById etc.) embrulhado ou não.
function objeto(x: any): any {
  if (x && typeof x === "object" && !Array.isArray(x) && typeof x.id === "string") return x;
  for (const k of ["data", "session", "result", "item"]) if (x?.[k] && typeof x[k] === "object") { const r = objeto(x[k]); if (r) return r; }
  return null;
}
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const resumo = (d: unknown) => (typeof d === "string" ? d.slice(0, 160) : d && typeof d === "object" ? JSON.stringify(d).slice(0, 300) : d);

// Chama a API do ChatPro; se ela pedir calma (429), espera e tenta de novo.
async function chamar(token: string, caminho: string, corpo: Record<string, unknown>) {
  for (let tentativa = 0; ; tentativa++) {
    const r = await fetch(BASE + caminho, { method: "POST", headers: { "content-type": "application/json", "instance-token": token }, body: JSON.stringify(corpo) });
    const t = await r.text();
    if (r.status === 429 && tentativa < 4) { await espera(1500 * (tentativa + 1)); continue; }
    let dados: unknown = null;
    try { dados = JSON.parse(t); } catch { dados = t.slice(0, 300); }
    return { status: r.status, ok: r.ok, dados };
  }
}

// "Nome - Empresa" (sem repetir a empresa quando o nome já é ela).
function nomeParaChatPro(nome: string | null, empresa: string | null): string {
  const n = txt(nome), e = txt(empresa);
  if (n && e) {
    const a = n.toLowerCase(), b = e.toLowerCase();
    return (a.includes(b) || b.includes(a) ? (n.length >= e.length ? n : e) : `${n} - ${e}`).slice(0, 80);
  }
  return (n || e).slice(0, 80);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
  if (req.method !== "POST") return json(405, { ok: false, erro: "use POST" });
  if (!SUPABASE_URL || !SECRET_KEY) return json(503, { ok: false, erro: "ambiente do servidor incompleto" });
  const sb = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } });

  const rotina = req.headers.get("x-rotina-token") || "";
  let deRotina = false, usuarioId = "";
  if (rotina) { const { data } = await sb.rpc("ml_chatpro_conferir_rotina", { p_token: rotina }); deRotina = data === true; }
  if (!deRotina) {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (jwt) { const { data } = await sb.auth.getUser(jwt); usuarioId = data?.user?.id || ""; }
  }
  if (!deRotina && !usuarioId) return json(401, { ok: false, erro: "não autorizado" });

  const token = (Deno.env.get("CHATPRO_CHAT_TOKEN") || "").trim();
  if (!token) return json(200, { ok: false, erro: "CHATPRO_CHAT_TOKEN não está salvo nos segredos das funções" });

  let corpo: any = {};
  try { corpo = await req.json(); } catch { corpo = {}; }
  const acao = txt(corpo?.acao) || "sincronizar";

  const ALTERAM = ["contatos", "finalizar", "atribuir", "enviar_arquivo"];
  if (ALTERAM.includes(acao) && !deRotina) {
    const { data } = await sb.rpc("crm_usuario_tem_permissao", { p_usuario: usuarioId, p_permissao: "crm.write" });
    if (data !== true) return json(403, { ok: false, erro: "Seu usuário não tem permissão para alterar atendimentos." });
  }

  // Instância: a informada ou a que aparece nos eventos recebidos.
  let instancia = txt(corpo?.instancia);
  if (!instancia) {
    const { data } = await sb.from("chatpro_eventos").select("payload").like("event_type", "SESSION.%").order("recebido_em", { ascending: false }).limit(1);
    instancia = txt((data?.[0] as any)?.payload?.new?.instance_id) || "chatpro-85815d6bd1";
  }

  const registrar = async (sessao: any) => {
    const { error } = await sb.rpc("chatpro_registrar_sessao", { p_payload: { event: "sync.api", new: sessao }, p_recebido: new Date().toISOString() });
    return !error;
  };
  const atualizarSessao = async (id: string) => {
    const r = await chamar(token, "/sessions/getSessionById", { instanceId: instancia, sessionId: id });
    const s = objeto(r.dados);
    if (r.ok && s?.id === id) await registrar(s);
    return r.ok && s?.id === id ? s : null;
  };
  // Atendimento do CRM -> conversa (sessão) mais recente no ChatPro.
  const sessaoDoLead = async (leadId: string) => {
    const { data } = await sb.from("chatpro_sessoes").select("id,aberta,chatpro_lead_id").eq("lead_id", leadId)
      .order("aberta_em", { ascending: false, nullsFirst: false }).limit(1);
    return (data?.[0] as { id: string; aberta: boolean | null; chatpro_lead_id: string | null } | undefined) ?? null;
  };

  // ---------- Ações sobre um atendimento ----------
  if (acao === "finalizar" || acao === "atribuir" || acao === "enviar_arquivo") {
    const leadId = txt(corpo?.lead_id);
    if (!leadId) return json(400, { ok: false, erro: "Informe o atendimento." });
    const sessao = await sessaoDoLead(leadId);

    if (acao === "finalizar") {
      const motivo = txt(corpo?.motivo_id);
      if (!motivo) return json(400, { ok: false, erro: "Escolha o motivo da finalização." });
      if (!sessao?.id || sessao.aberta === false) return json(200, { ok: false, erro: "Este atendimento já está finalizado no ChatPro." });
      const r = await chamar(token, "/sessions/finish", { instanceId: instancia, sessionId: sessao.id, endingId: motivo });
      if (!r.ok) return json(200, { ok: false, erro: "O ChatPro não finalizou a conversa.", status_chatpro: r.status, resposta: resumo(r.dados) });
      const s = await atualizarSessao(sessao.id);
      return json(200, { ok: true, finalizado: s ? s.open === false : true });
    }

    if (acao === "atribuir") {
      const perfil = txt(corpo?.perfil_id);
      const { data: u } = await sb.from("chatpro_usuarios").select("id,nome").eq("perfil_id", perfil).eq("ativo", true).limit(1);
      const usuarioChat = (u?.[0] as { id: string; nome: string | null } | undefined) ?? null;
      if (!usuarioChat) return json(200, { ok: false, erro: "Essa pessoa não tem usuário ativo no ChatPro." });
      if (!sessao?.id || sessao.aberta === false) return json(200, { ok: false, erro: "Não há conversa aberta no ChatPro para transferir." });
      const r = await chamar(token, "/sessions/assignTo", { instanceId: instancia, sessionId: sessao.id, userId: usuarioChat.id });
      if (!r.ok) return json(200, { ok: false, erro: "O ChatPro não transferiu a conversa.", status_chatpro: r.status, resposta: resumo(r.dados) });
      await atualizarSessao(sessao.id);
      return json(200, { ok: true, atendente: usuarioChat.nome });
    }

    // enviar_arquivo
    const caminho = txt(corpo?.caminho), legenda = txt(corpo?.legenda).slice(0, 900);
    if (!caminho || caminho.includes("..")) return json(400, { ok: false, erro: "Arquivo inválido." });
    let sessionId = sessao?.id && sessao.aberta !== false ? sessao.id : "";
    let provider = "whatsapp";
    if (sessionId) {
      const s = await atualizarSessao(sessionId);
      if (s?.open === false) sessionId = "";
      else if (txt(s?.provider)) provider = txt(s.provider);
    }
    if (!sessionId) {
      // Sem conversa aberta: abre (ou reaproveita) a conversa pelo número.
      const { data: l } = await sb.from("leads").select("telefone_whatsapp").eq("id", leadId).single();
      const numero = txt((l as any)?.telefone_whatsapp).replace(/\D/g, "");
      if (numero.length < 10) return json(200, { ok: false, erro: "O atendimento não tem um telefone de WhatsApp válido." });
      const { data: eu } = usuarioId ? await sb.from("chatpro_usuarios").select("id").eq("perfil_id", usuarioId).eq("ativo", true).limit(1) : { data: null };
      const atribuir = (eu?.[0] as { id: string } | undefined)?.id;
      const r = await chamar(token, "/sessions/getOrCreateByNumber", { instanceId: instancia, provider, number: numero, ...(atribuir ? { assignTo: atribuir } : {}) });
      const s = objeto(r.dados);
      if (!r.ok || !s?.id) return json(200, { ok: false, erro: "O ChatPro não abriu a conversa com esse número.", status_chatpro: r.status, resposta: resumo(r.dados) });
      sessionId = s.id;
      if (txt(s?.provider)) provider = txt(s.provider);
      await registrar(s);
      // Liga a conversa nova ao atendimento (a mensagem enviada confirma depois).
      await sb.from("chatpro_sessoes").update({ lead_id: leadId }).eq("id", sessionId).is("lead_id", null);
      await sb.rpc("chatpro_sincronizar_lead", { p_lead: leadId });
    }
    const { data: link, error: errLink } = await sb.storage.from(BUCKET).createSignedUrl(caminho, 60 * 60 * 24 * 3);
    if (errLink || !link?.signedUrl) return json(200, { ok: false, erro: "Não encontrei o arquivo enviado." });
    const r = await chamar(token, "/messages/sendFileFromUrl", { instanceId: instancia, sessionId, url: link.signedUrl, provider, ...(legenda ? { caption: legenda } : {}) });
    if (!r.ok) return json(200, { ok: false, erro: "O ChatPro não enviou o arquivo.", status_chatpro: r.status, resposta: resumo(r.dados) });
    await sb.from("interacoes").insert({
      lead_id: leadId, usuario_id: usuarioId || null, tipo: "WHATSAPP",
      descricao: `Arquivo enviado pelo CRM via ChatPro: ${caminho.split("/").pop()}${legenda ? ` — ${legenda}` : ""}`,
    });
    return json(200, { ok: true, enviado: true });
  }

  // ---------- Contatos: nome e empresa do CRM no ChatPro ----------
  if (acao === "contatos") {
    const inicio = Date.now(), LIMITE_MS = corpo?.rapido ? 20_000 : 100_000;
    const { data: pend, error } = await sb.rpc("chatpro_contatos_pendentes", { p_limite: Number(corpo?.limite) || 300 });
    if (error) return json(500, { ok: false, erro: error.message });
    let enviados = 0, falhas = 0; let amostra: unknown = undefined;
    for (const p of (pend ?? []) as { lead_id: string; chatpro_lead_id: string; nome: string | null; empresa: string | null; email: string | null }[]) {
      if (Date.now() - inicio > LIMITE_MS) break;
      const nome = nomeParaChatPro(p.nome, p.empresa);
      if (!nome) continue;
      const metadata = { ...(p.empresa ? { empresa: p.empresa } : {}), ...(p.email ? { email: p.email } : {}), origem: "CRM MinasLab" };
      const r = await chamar(token, "/leads/update", { instanceId: instancia, leadId: p.chatpro_lead_id, name: nome, metadata });
      if (r.ok) {
        enviados++;
        // Mesma "assinatura" que chatpro_contatos_pendentes compara (concat_ws ignora nulos).
        await sb.from("leads").update({ chatpro_contato_enviado: [p.nome, p.empresa, p.email].filter((x) => x != null).join("|") }).eq("id", p.lead_id);
      } else { falhas++; amostra ??= { status: r.status, resposta: resumo(r.dados) }; if (r.status === 429) break; }
      await espera(300);
    }
    return json(200, { ok: true, pendentes: (pend ?? []).length, enviados, falhas, amostra_falha: amostra });
  }

  // ---------- Usuários, motivos e departamentos ----------
  const usuarios = await chamar(token, "/users/getAllInstanceUsers", { instanceId: instancia });
  if (acao === "verificar") {
    const l = lista(usuarios.dados);
    const m = await chamar(token, "/endings/list", { instanceId: instancia });
    return json(200, { ok: usuarios.ok, status_chatpro: usuarios.status, instancia, usuarios: l.length, motivos: lista(m.dados).length });
  }
  if (!usuarios.ok) return json(200, { ok: false, erro: "ChatPro recusou a consulta de usuários", status_chatpro: usuarios.status, resposta: resumo(usuarios.dados) });

  // Só os campos que interessam: o registro do ChatPro traz até segredo de MFA.
  const linhasU = lista(usuarios.dados).map((u: any) => {
    const p = u?.user && typeof u.user === "object" ? u.user : {};
    return {
      id: txt(u?.user_id ?? p?.id ?? p?.uid ?? u?.id),
      nome: txt(p?.name ?? p?.nome ?? p?.display_name ?? p?.displayName ?? u?.name) || null,
      email: txt(p?.email ?? u?.email).toLowerCase() || null,
      ativo: typeof u?.active === "boolean" ? u.active && !u?.deleted : null,
      papel: txt(u?.role) || null,
      atualizado_em: new Date().toISOString(),
    };
  }).filter((u) => u.id);
  if (linhasU.length) {
    const { error } = await sb.from("chatpro_usuarios").upsert(linhasU, { onConflict: "id" });
    if (error) return json(500, { ok: false, erro: "falha ao gravar usuários: " + error.message });
    // Quem saiu do ChatPro fica inativo (o histórico continua no nome dele).
    await sb.from("chatpro_usuarios").update({ ativo: false, atualizado_em: new Date().toISOString() })
      .not("id", "in", `(${linhasU.map((u) => `"${u.id}"`).join(",")})`).or("ativo.is.null,ativo.eq.true");
  }

  const motivos = await chamar(token, "/endings/list", { instanceId: instancia });
  const linhasM = lista(motivos.dados).map((m: any) => ({
    id: txt(m?.id ?? m?._id),
    nome: txt(m?.name ?? m?.nome ?? m?.title ?? m?.description) || null,
    ativo: typeof m?.deleted === "boolean" ? !m.deleted : null,
    atualizado_em: new Date().toISOString(),
  })).filter((m) => m.id);
  if (linhasM.length) {
    const { error } = await sb.from("chatpro_motivos").upsert(linhasM, { onConflict: "id" });
    if (error) return json(500, { ok: false, erro: "falha ao gravar motivos: " + error.message });
  }

  const deps = await chamar(token, "/departments/list", { instanceId: instancia });
  const linhasD = lista(deps.dados).map((d: any) => ({
    id: txt(d?.id ?? d?._id),
    nome: txt(d?.name ?? d?.nome ?? d?.title) || null,
    atualizado_em: new Date().toISOString(),
  })).filter((d) => d.id);
  if (linhasD.length) await sb.from("chatpro_departamentos").upsert(linhasD, { onConflict: "id" });

  let reaplicado: unknown = null;
  if (acao !== "sessoes") {
    const r = await sb.rpc("chatpro_reaplicar_tudo");
    if (r.error) return json(500, { ok: false, erro: "falha ao reaplicar: " + r.error.message });
    reaplicado = r.data;
  }

  // O ChatPro nem sempre avisa a finalização pelo webhook: confere na API o
  // estado real das sessões que o CRM ainda tem como abertas.
  // 1) Lista as sessões finalizadas desde a mais antiga aberta no CRM (100 por página).
  // 2) As que continuarem abertas no CRM são conferidas uma a uma, devagar
  //    (a API limita as chamadas por minuto); o que sobrar fica para a próxima rodada.
  const inicio = Date.now(), LIMITE_MS = corpo?.rapido ? 25_000 : 110_000;
  let amostraFalha: unknown = undefined;
  const { data: maisAntiga } = await sb.from("chatpro_sessoes").select("aberta_em,ultima_atualizacao").eq("aberta", true)
    .order("aberta_em", { ascending: true, nullsFirst: false }).limit(1);
  const desde = (maisAntiga?.[0] as any)?.aberta_em || (maisAntiga?.[0] as any)?.ultima_atualizacao;
  let listadas = 0, paginas = 0;
  if (desde) {
    for (let offset = 0; Date.now() - inicio < LIMITE_MS / 2 && paginas < 40; offset += 100) {
      const r = await chamar(token, "/sessions/list", { instanceId: instancia, open: false, start: new Date(desde).toISOString(), end: new Date().toISOString(), limit: 100, offset });
      paginas++;
      if (!r.ok) { amostraFalha ??= { etapa: "lista", status: r.status, resposta: resumo(r.dados) }; break; }
      const itens = lista(r.dados).filter((x: any) => x && typeof x.id === "string");
      for (const sessao of itens) if (await registrar(sessao)) listadas++;
      if (itens.length < 100) break;
      await espera(400);
    }
  }

  const { data: abertas } = await sb.from("chatpro_sessoes").select("id").eq("aberta", true)
    .order("ultima_atualizacao", { ascending: true, nullsFirst: true }).limit(Number(corpo?.limite) || 600);
  const ids: string[] = (abertas ?? []).map((x: any) => x.id as string);
  let conferidas = 0, finalizadas = 0, falhas = 0;
  for (const id of ids) {
    if (Date.now() - inicio > LIMITE_MS) break;
    try {
      const r = await chamar(token, "/sessions/getSessionById", { instanceId: instancia, sessionId: id });
      const sessao = objeto(r.dados);
      if (!r.ok || !sessao || sessao.id !== id) {
        falhas++;
        amostraFalha ??= { etapa: "sessao", status: r.status, resposta: resumo(r.dados) };
        if (r.status === 429) break;
        continue;
      }
      conferidas++;
      if (sessao.open === false) finalizadas++;
      if (!(await registrar(sessao))) falhas++;
    } catch { falhas++; }
    await espera(350);
  }
  return json(200, {
    ok: true, instancia,
    usuarios: linhasU.length, motivos: linhasM.length, departamentos: linhasD.length,
    reaplicado,
    sessoes: { listadas_finalizadas: listadas, paginas, em_aberto_no_crm: ids.length, conferidas, finalizadas_no_chatpro: finalizadas, falhas, restantes: Math.max(0, ids.length - conferidas - falhas), amostra_falha: amostraFalha },
  });
});
