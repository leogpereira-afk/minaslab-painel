// ml-qualidade — porta de dados de Laboratório › Qualidade (hoje: Pesquisa de satisfação de clientes, PG 012 · PSC).
// Mesmos dados do CRM (Pós-venda › Pesquisa de satisfação): tabelas satisfacao_envios, satisfacao_respostas e
// satisfacao_tratativas. Aqui entra quem tem o crachá do painel, sem precisar de usuário no CRM.
// Crachá conferido, conta ativa e permissão lidos AO VIVO a cada chamada (mesma régua do ml-laboratorio):
// lê quem é da direção, quem tem a página "laboratorio" inteira ou a seção "laboratorio/qualidade".
//
// Ações: satisfacao (tudo da tela) · vinculos (contratos, OS e contatos de um cliente) · enviar · canal ·
//        cancelar · melhoria · tratativa · perguntaSalvar · perguntasOrdem · revisao (editor de perguntas, só aqui)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY")!;
const J = Deno.env.get("ML_JWT_SECRET") ?? "";
const sb = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder(), dec = new TextDecoder();
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const txt = (v: unknown) => String(v ?? "").trim();
const uuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(txt(v)) ? txt(v) : null;
const MELHORIA = ["AVALIAR", "EM ANDAMENTO", "IMPLEMENTADA", "DESCARTADA", "SEM SUGESTAO"];
const STATUS_TRAT = ["ABERTA", "EM ANDAMENTO", "CONCLUIDA"];
const CANAIS = ["LINK", "WHATSAPP", "EMAIL"];
const TIPOS = ["ESCALA", "TEXTO", "SERVICO"];
const slug = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

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

async function todos<T>(q: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await q(de, de + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const cracha = await crachaDoPainel(req);
  if (!cracha) return json({ erro: "Sua sessão expirou. Entre de novo.", semSessao: true }, 401);
  try {
    const usuario = txt(cracha.sub);
    const papel = txt(cracha.papel);
    const { data: conta, error: erroConta } = await sb.from("ml_contas").select("ativo,paginas_consulta").eq("usuario", usuario).maybeSingle();
    if (erroConta) throw erroConta;
    if (conta && conta.ativo !== true) return json({ erro: "Esta conta foi desativada.", semSessao: true }, 401);
    const direcao = papel === "direcao";
    const perms: string[] = Array.isArray(conta?.paginas_consulta) ? conta!.paginas_consulta : [];
    const matriz = perms.includes("__matriz_v1");
    const temSecao = perms.includes("laboratorio") || perms.includes("laboratorio/qualidade");
    const podeLer = direcao || !matriz || temSecao;
    const podeEscrever = direcao || (papel === "equipe" && podeLer);
    if (!podeLer) return json({ erro: "Seu acesso não inclui a Qualidade do Laboratório.", semPermissao: true }, 403);

    const body = await req.json().catch(() => ({}));
    const acao = txt(body.acao);
    const exigeEscrita = () => podeEscrever ? null : json({ erro: "Seu acesso à Qualidade é só de consulta.", semPermissao: true }, 403);

    if (acao === "satisfacao") {
      const [envios, respostas, tratativas, clientes, perguntas, cfg] = await Promise.all([
        todos((a, b) => sb.from("satisfacao_envios").select("id,token,cliente_id,contrato_id,ordem_servico_id,contato_id,empresa_nome,canal,destino,enviado_por,enviado_por_painel,enviado_em,expira_em,respondido_em,cancelado_em").order("enviado_em", { ascending: false }).range(a, b)),
        todos((a, b) => sb.from("satisfacao_respostas").select("*").is("deleted_at", null).order("respondido_em", { ascending: false }).range(a, b)),
        todos((a, b) => sb.from("satisfacao_tratativas").select("*").order("prazo").range(a, b)),
        todos((a, b) => sb.from("clientes").select("id,razao_social,nome_fantasia").is("deleted_at", null).order("razao_social").range(a, b)),
        sb.from("satisfacao_perguntas").select("id,chave,texto,tipo,permite_na,obrigatoria,ordem,ativa,atualizado_em,atualizado_por").order("tipo").order("ordem").order("criado_em").then((r) => r.data ?? []),
        sb.from("satisfacao_config").select("revisao,atualizado_em,atualizado_por").eq("id", 1).maybeSingle().then((r) => r.data),
      ]);
      const ativas = new Set((respostas as { id: string }[]).map((r) => r.id));
      const trats = (tratativas as { resposta_id: string }[]).filter((t) => ativas.has(t.resposta_id));
      const ids = (campo: string, ...listas: Record<string, unknown>[][]) => [...new Set(listas.flat().map((x) => x[campo]).filter(Boolean) as string[])];
      const listaE = envios as Record<string, unknown>[], listaR = respostas as Record<string, unknown>[], listaT = trats as Record<string, unknown>[];
      const ctIds = ids("contrato_id", listaE, listaR), osIds = ids("ordem_servico_id", listaE, listaR);
      const perfis = ids("enviado_por", listaE).concat(ids("responsavel_id", listaT));
      const [ct, os, pf, contas] = await Promise.all([
        ctIds.length ? sb.from("contratos").select("id,numero_contrato").in("id", ctIds) : Promise.resolve({ data: [] }),
        osIds.length ? sb.from("ordens_servico").select("id,numero_os").in("id", osIds) : Promise.resolve({ data: [] }),
        perfis.length ? sb.from("profiles").select("id,nome").in("id", perfis) : Promise.resolve({ data: [] }),
        sb.from("ml_contas").select("usuario,nome"),
      ]);
      return json({
        podeEscrever, envios, respostas, tratativas: trats, perguntas, revisao: cfg?.revisao ?? "01",
        clientes: (clientes as { id: string; razao_social: string | null; nome_fantasia: string | null }[]).map((c) => ({ id: c.id, nome: c.nome_fantasia || c.razao_social || "", razao: c.razao_social || "" })),
        contratos: Object.fromEntries(((ct.data ?? []) as { id: string; numero_contrato: string }[]).map((x) => [x.id, x.numero_contrato])),
        os: Object.fromEntries(((os.data ?? []) as { id: string; numero_os: string }[]).map((x) => [x.id, x.numero_os])),
        perfis: Object.fromEntries(((pf.data ?? []) as { id: string; nome: string }[]).map((x) => [x.id, x.nome])),
        contas: Object.fromEntries(((contas.data ?? []) as { usuario: string; nome: string }[]).map((x) => [x.usuario, x.nome || x.usuario])),
      });
    }

    if (acao === "vinculos") {
      const cliente = uuid(body.cliente_id);
      if (!cliente) return json({ erro: "Cliente inválido." }, 400);
      const [ct, os, co] = await Promise.all([
        sb.from("contratos").select("id,numero_contrato,status").eq("cliente_id", cliente).is("deleted_at", null).order("numero_contrato"),
        sb.from("ordens_servico").select("id,numero_os,data_recepcao").eq("cliente_id", cliente).is("deleted_at", null).order("data_recepcao", { ascending: false }).limit(40),
        sb.from("contatos").select("id,nome,email,whatsapp_e164,telefone_e164").eq("cliente_id", cliente).is("deleted_at", null).order("nome"),
      ]);
      return json({ contratos: ct.data ?? [], os: os.data ?? [], contatos: co.data ?? [] });
    }

    if (acao === "enviar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const cliente = uuid(body.cliente_id);
      if (!cliente) return json({ erro: "Escolha o cliente." }, 400);
      const canal = CANAIS.includes(txt(body.canal)) ? txt(body.canal) : "LINK";
      const { data: cli } = await sb.from("clientes").select("razao_social,nome_fantasia").eq("id", cliente).maybeSingle();
      if (!cli) return json({ erro: "Cliente não encontrado." }, 404);
      const contato = uuid(body.contato_id);
      const { data: ct } = contato ? await sb.from("contatos").select("email,whatsapp_e164,telefone_e164").eq("id", contato).maybeSingle() : { data: null };
      const { data: vinc } = await sb.from("crm_sso_vinculos").select("crm_user_id").eq("usuario_painel", usuario).maybeSingle();
      const destino = canal === "WHATSAPP" ? (ct?.whatsapp_e164 || ct?.telefone_e164 || null) : canal === "EMAIL" ? (ct?.email || null) : null;
      const { data, error } = await sb.from("satisfacao_envios").insert({
        cliente_id: cliente, contrato_id: uuid(body.contrato_id), ordem_servico_id: uuid(body.ordem_servico_id), contato_id: contato,
        empresa_nome: cli.nome_fantasia || cli.razao_social, canal, destino,
        enviado_por: vinc?.crm_user_id ?? null, enviado_por_painel: usuario,
      }).select("id,token").single();
      if (error) throw error;
      return json({ ok: true, id: data.id, token: data.token, destino });
    }

    if (acao === "canal") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const id = uuid(body.id), canal = CANAIS.includes(txt(body.canal)) ? txt(body.canal) : "LINK";
      if (!id) return json({ erro: "Envio inválido." }, 400);
      const { error } = await sb.from("satisfacao_envios").update({ canal, destino: txt(body.destino) || null }).eq("id", id).is("respondido_em", null);
      if (error) throw error;
      return json({ ok: true });
    }

    if (acao === "cancelar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const id = uuid(body.id);
      if (!id) return json({ erro: "Envio inválido." }, 400);
      const { error } = await sb.from("satisfacao_envios").update({ cancelado_em: new Date().toISOString() }).eq("id", id).is("respondido_em", null);
      if (error) throw error;
      return json({ ok: true });
    }

    if (acao === "melhoria") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const id = uuid(body.id), status = txt(body.status);
      if (!id || !MELHORIA.includes(status)) return json({ erro: "Dados inválidos." }, 400);
      const { error } = await sb.from("satisfacao_respostas").update({ melhoria_status: status }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (acao === "tratativa") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const id = uuid(body.id), status = txt(body.status);
      if (!id || !STATUS_TRAT.includes(status)) return json({ erro: "Dados inválidos." }, 400);
      const causa = txt(body.causa).slice(0, 4000), acaoTomada = txt(body.acao_tomada).slice(0, 4000), retorno = txt(body.retorno_cliente).slice(0, 4000);
      if (status === "CONCLUIDA" && (!causa || !acaoTomada || !retorno)) return json({ erro: "Para concluir, preencha causa, ação e retorno ao cliente." }, 400);
      const { data: atual } = await sb.from("satisfacao_tratativas").select("status,concluida_em,tarefa_id,tarefa_painel_id").eq("id", id).maybeSingle();
      if (!atual) return json({ erro: "Tratativa não encontrada." }, 404);
      if (atual.status === "CONCLUIDA") return json({ erro: "Esta tratativa já foi concluída." }, 409);
      const agora = new Date().toISOString(), concl = status === "CONCLUIDA";
      const { data: vinc } = await sb.from("crm_sso_vinculos").select("crm_user_id").eq("usuario_painel", usuario).maybeSingle();
      const { error } = await sb.from("satisfacao_tratativas").update({
        status, causa: causa || null, acao: acaoTomada || null, retorno_cliente: retorno || null,
        concluida_em: concl ? agora : null, concluida_por: concl ? (vinc?.crm_user_id ?? null) : null, updated_at: agora,
      }).eq("id", id);
      if (error) throw error;
      if (concl && atual.tarefa_id) await sb.from("tarefas").update({ status: "CONCLUIDA", updated_at: agora }).eq("id", atual.tarefa_id);
      if (concl && atual.tarefa_id) await sb.from("tarefa_responsaveis").update({ status: "CONCLUIDA", concluida_em: agora, updated_at: agora }).eq("tarefa_id", atual.tarefa_id);
      if (concl && atual.tarefa_painel_id) await sb.from("ml_tarefas").update({ status: "concluida", concluida_em: agora, concluida_por: usuario, atualizado_em: agora }).eq("id", atual.tarefa_painel_id);
      return json({ ok: true });
    }

    if (acao === "perguntaSalvar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const texto = txt(body.texto).slice(0, 300);
      const tipo = txt(body.tipo);
      if (!texto) return json({ erro: "Escreva o texto da pergunta." }, 400);
      if (!TIPOS.includes(tipo)) return json({ erro: "Tipo de pergunta inválido." }, 400);
      const dados = { texto, permite_na: body.permite_na === true, obrigatoria: body.obrigatoria === true, ativa: body.ativa !== false, atualizado_em: new Date().toISOString(), atualizado_por: usuario };
      const id = uuid(body.id);
      if (id) {
        const { error } = await sb.from("satisfacao_perguntas").update(dados).eq("id", id);
        if (error) throw error;
        return json({ ok: true, id });
      }
      const { data: ult } = await sb.from("satisfacao_perguntas").select("ordem").eq("tipo", tipo).order("ordem", { ascending: false }).limit(1).maybeSingle();
      let chave = `${tipo === "SERVICO" ? "srv_" : ""}${slug(texto) || "pergunta"}`;
      const { data: existe } = await sb.from("satisfacao_perguntas").select("id").eq("chave", chave).maybeSingle();
      if (existe) chave = `${chave}_${Date.now().toString(36)}`;
      const { data, error } = await sb.from("satisfacao_perguntas").insert({ ...dados, chave, tipo, ordem: (ult?.ordem ?? 0) + 10 }).select("id").single();
      if (error) throw error;
      return json({ ok: true, id: data.id });
    }

    if (acao === "perguntasOrdem") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(uuid).filter(Boolean) as string[];
      for (let i = 0; i < ids.length; i++) await sb.from("satisfacao_perguntas").update({ ordem: (i + 1) * 10, atualizado_em: new Date().toISOString(), atualizado_por: usuario }).eq("id", ids[i]);
      return json({ ok: true });
    }

    if (acao === "revisao") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const revisao = txt(body.revisao).slice(0, 20);
      if (!revisao) return json({ erro: "Informe a revisão." }, 400);
      const { error } = await sb.from("satisfacao_config").update({ revisao, atualizado_em: new Date().toISOString(), atualizado_por: usuario }).eq("id", 1);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("ml-qualidade", e);
    return json({ erro: "Não foi possível concluir agora. Tente de novo." }, 500);
  }
});
