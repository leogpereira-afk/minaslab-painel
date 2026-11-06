// ml-qualidade — porta de dados de Laboratório › Qualidade (hoje: Pesquisa de satisfação de clientes, PG 012 · PSC).
// Mesmos dados do CRM (Pós-venda › Pesquisa de satisfação): tabelas satisfacao_envios, satisfacao_respostas e
// satisfacao_tratativas. Aqui entra quem tem o crachá do painel, sem precisar de usuário no CRM.
// Crachá conferido, conta ativa e permissão lidos AO VIVO a cada chamada (mesma régua do ml-laboratorio):
// lê quem é da direção, quem tem a página "laboratorio" inteira ou a seção "laboratorio/qualidade".
//
// Ações: satisfacao (tudo da tela) · vinculos (contratos, OS e contatos de um cliente) · enviar · canal ·
//        cancelar · melhoria · tratativa · perguntaSalvar · perguntasOrdem · revisao (editor de perguntas, só aqui)
// Demais páginas da Qualidade: qualidade (tudo) · salvar {modulo} · excluir · ler (documento) · calibrar ·
//        metaSalvar · arquivoEnviar · arquivoBaixar · arquivoApagar · verificarExternos (documentos externos/CDOE)
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


// ---------------------------------------------------------------- páginas da Qualidade
const MODULOS: Record<string, { t: string; campos: string[] }> = {
  documento: { t: "qualidade_documentos", campos: ["codigo", "titulo", "tipo", "setor", "revisao", "vigencia_inicio", "proxima_revisao", "elaborado_por", "aprovado_por", "status", "leitores", "observacao"] },
  equipamento: { t: "qualidade_equipamentos", campos: ["codigo", "nome", "setor", "local", "fabricante", "modelo", "serie", "controle", "periodicidade_meses", "proxima", "criterio", "faixa_uso", "ensaios_afetados", "situacao", "bloqueado", "bloqueio_motivo", "observacao"] },
  nc: { t: "qualidade_nc", campos: ["titulo", "descricao", "origem", "etapa", "responsavel", "prazo", "trabalho_afetado", "impacto", "porques", "causa_raiz", "acao", "eficacia_em", "eficacia_resultado", "eficaz"] },
  auditoria: { t: "qualidade_auditorias", campos: ["ano", "requisito", "mes", "data", "status", "auditor", "constatacoes", "n_constatacoes"] },
  proficiencia: { t: "qualidade_proficiencia", campos: ["provedor", "rodada", "matriz", "parametro", "data", "z", "resultado", "observacao"] },
  // Documentos externos (CDOE, PG 005): a planilha de normas e legislação, com verificação trimestral.
  externo: { t: "qualidade_documentos_externos", campos: ["item", "documento", "controlado_por", "data_registro", "data_verificacao", "proxima_verificacao", "local_uso", "resultado", "versao_vigente", "observacao", "fonte", "ativo"] },
};
const RESULTADOS_EXT = ["VIGENTE", "ATUALIZAR", "CANCELADA", "CONFERIR", "VALIDADE"];
const DATAS = ["vigencia_inicio", "proxima_revisao", "proxima", "prazo", "eficacia_em", "data", "data_registro", "data_verificacao", "proxima_verificacao"];
const NUMEROS = ["periodicidade_meses", "ano", "mes", "n_constatacoes", "z", "item"];
const BUCKET = "ml-arquivos";
const TIPOS_ARQ: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", txt: "text/plain" };
function limpar(campos: string[], r: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const c of campos) {
    if (!(c in r)) continue;
    const v = r[c];
    if (c === "leitores" || c === "porques") out[c] = (Array.isArray(v) ? v : []).map((x) => txt(x).slice(0, 500)).filter(Boolean).slice(0, 40);
    else if (c === "trabalho_afetado") out[c] = v === true;
    else if (c === "ativo") out[c] = v !== false;
    else if (c === "eficaz") out[c] = v === true ? true : v === false ? false : null;
    else if (DATAS.includes(c)) out[c] = /^\d{4}-\d{2}-\d{2}$/.test(txt(v)) ? txt(v) : null;
    else if (NUMEROS.includes(c)) { const n = Number(String(v ?? "").replace(",", ".")); out[c] = txt(v) === "" || !Number.isFinite(n) ? null : n; }
    else out[c] = txt(v).slice(0, 4000) || null;
  }
  return out;
}
const somaMeses = (ymd: string, m: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString().slice(0, 10); };
async function proximoCodigoNc() {
  const ano = new Date().getFullYear();
  const { data } = await sb.from("qualidade_nc").select("codigo").like("codigo", `NC ${ano}-%`);
  const max = Math.max(0, ...((data ?? []) as { codigo: string }[]).map((x) => Number(x.codigo.split("-")[1]) || 0));
  return `NC ${ano}-${String(max + 1).padStart(2, "0")}`;
}
async function abrirNc(dados: Record<string, unknown>, usuario: string) {
  const codigo = await proximoCodigoNc();
  const { data, error } = await sb.from("qualidade_nc").insert({ ...dados, codigo, registrada_por: usuario, atualizado_por: usuario }).select("id,codigo,titulo,responsavel").single();
  if (error) throw error;
  if (data.responsavel && data.responsavel !== usuario) {
    await sb.from("ml_notificacoes").insert({ usuario: data.responsavel, tipo: "qualidade_nc", titulo: `Não conformidade ${data.codigo} para você`, corpo: String(data.titulo).slice(0, 200), link: "/laboratorio?secao=qualidade&aba=nc", ref_tipo: "qualidade_nc", ref_id: data.id });
  }
  return data;
}
const resultadoDoZ = (z: number) => Math.abs(z) <= 2 ? "SATISFATORIO" : Math.abs(z) < 3 ? "QUESTIONAVEL" : "INSATISFATORIO";

// Patrimônio é o cadastro único do equipamento. Todo bem que "requer calibração" ou "qualificação" ganha aqui
// uma ficha metrológica (critério, faixa, ensaios, calibrações). Código, nome, área e periodicidade vêm do bem.
type Bem = { id: string; dados: Record<string, unknown> };
async function sincronizarPatrimonio() {
  const bensLinhas = await todos<Bem>((a, b) => sb.from("ml_patrimonio").select("id,dados").eq("tipo", "bem").eq("apagado", false).order("id").range(a, b));
  const { data: fichas, error } = await sb.from("qualidade_equipamentos").select("id,bem_id,codigo,nome,setor,periodicidade_meses,situacao");
  if (error) throw error;
  const porBem = new Map((fichas ?? []).filter((f) => f.bem_id).map((f) => [String(f.bem_id), f]));
  const bens = new Map<string, Record<string, unknown>>();
  const novos: Record<string, unknown>[] = [];
  const mudancas: Record<string, unknown>[] = [];
  for (const { id, dados: d } of bensLinhas) {
    const metro = d.reqCalibracao === "sim" || d.reqQualificacao === "sim";
    const f = porBem.get(id);
    bens.set(id, { situacao: d.situacao ?? null, responsavel: d.responsavel ?? null, area: d.areaLab ?? null, descricao: d.descricaoTecnica ?? null, reqCalibracao: d.reqCalibracao ?? null, reqQualificacao: d.reqQualificacao ?? null, reqManutencao: d.reqManutencao ?? null });
    if (!f && !metro) continue;
    const per = Number(d.periodicidadeCalibracaoMeses);
    const base: Record<string, unknown> = { codigo: String(d.codigo || id), nome: [d.nomeGenerico, d.volume].filter(Boolean).join(" · ") || id, setor: (d.areaLab as string) || null };
    if (per > 0) base.periodicidade_meses = Math.round(per);
    const baixado = d.situacao === "baixado";
    if (!f) novos.push({ ...base, bem_id: id, controle: d.reqCalibracao === "sim" ? "CALIBRACAO" : "VALIDACAO", situacao: baixado ? "INATIVO" : "ATIVO", criado_por: "patrimonio" });
    else {
      const alvo = { ...base, ...(baixado && f.situacao !== "INATIVO" ? { situacao: "INATIVO" } : {}) };
      if (Object.entries(alvo).some(([k, v]) => (f as Record<string, unknown>)[k] !== v)) mudancas.push({ id: f.id, ...alvo });
    }
  }
  // Bem apagado do Patrimônio: a ficha fica (histórico auditável), mas inativa.
  for (const f of fichas ?? []) if (f.bem_id && !bens.has(String(f.bem_id)) && f.situacao !== "INATIVO") mudancas.push({ id: f.id, situacao: "INATIVO" });
  if (novos.length) { const { error: e } = await sb.from("qualidade_equipamentos").upsert(novos, { onConflict: "bem_id", ignoreDuplicates: true }); if (e) throw e; }
  for (const { id, ...m } of mudancas) { const { error: e } = await sb.from("qualidade_equipamentos").update({ ...m, atualizado_em: new Date().toISOString() }).eq("id", id); if (e) throw e; }
  // Manutenções dos bens (somente leitura aqui): a Qualidade vê o serviço feito e cobra a análise/verificação.
  const regs = await todos<{ id: string; registro: Record<string, unknown> }>((a, b) => sb.from("ml_registros").select("id,registro").eq("colecao", "manutencoes").eq("apagado", false).range(a, b));
  const manutencoes = regs.map(({ id, registro: r }) => ({ id, alvoTipo: r.alvoTipo, alvoId: r.alvoId, tipo: r.tipo, status: r.status, data: r.data || null, proxima: r.proxima || null, descricao: r.descricao || "", fornecedor: r.fornecedor || "" }))
    .filter((m) => m.alvoTipo === "bem" && bens.has(String(m.alvoId)));
  return { bens, manutencoes };
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

    if (acao === "qualidade") {
      const umAno = new Date(Date.now() - 400 * 86400000).toISOString();
      const { bens, manutencoes } = await sincronizarPatrimonio();
      const [docs, revs, leits, eqs, cals, ncs, auds, profs, metas, arqs, contas, entradas, externos] = await Promise.all([
        sb.from("qualidade_documentos").select("*").order("codigo"),
        sb.from("qualidade_documento_revisoes").select("*").order("data", { ascending: false }),
        sb.from("qualidade_documento_leituras").select("documento_id,revisao,usuario,confirmado_em"),
        sb.from("qualidade_equipamentos").select("*").order("codigo"),
        sb.from("qualidade_calibracoes").select("*").order("data", { ascending: false }).limit(2000),
        sb.from("qualidade_nc").select("*").order("criado_em", { ascending: false }),
        sb.from("qualidade_auditorias").select("*").order("ano").order("mes"),
        sb.from("qualidade_proficiencia").select("*").order("data", { ascending: false }),
        sb.from("qualidade_metas").select("*"),
        sb.from("qualidade_arquivos").select("id,ref_tipo,ref_id,nome,tamanho,autor,criado_em").eq("apagado", false).order("criado_em", { ascending: false }),
        sb.from("ml_contas").select("usuario,nome,ativo").order("nome"),
        todos((a, b) => sb.from("ml_registros").select("registro").eq("colecao", "lab_entradas").eq("apagado", false).gte("atualizado_em", umAno).range(a, b)),
        sb.from("qualidade_documentos_externos").select("*").order("item", { nullsFirst: false }).order("documento"),
      ]);
      for (const r of [docs, revs, leits, eqs, cals, ncs, auds, profs, metas, arqs, contas, externos]) if (r.error) throw r.error;
      return json({
        podeEscrever, eu: usuario,
        documentos: docs.data, revisoes: revs.data, leituras: leits.data, calibracoes: cals.data, manutencoes,
        equipamentos: (eqs.data ?? []).map((e: Record<string, unknown>) => ({ ...e, bem: e.bem_id ? bens.get(String(e.bem_id)) ?? null : null })),
        externos: externos.data,
        ncs: ncs.data, auditorias: auds.data, proficiencia: profs.data, metas: metas.data, arquivos: arqs.data,
        contas: ((contas.data ?? []) as { usuario: string; nome: string; ativo: boolean }[]).filter((c) => c.ativo !== false).map((c) => ({ usuario: c.usuario, nome: c.nome || c.usuario })),
        entradas: (entradas as { registro: Record<string, unknown> }[]).map((x) => x.registro).filter((r) => r && r.cancelada !== true)
          .map((r) => ({ rec: r.recebidoEm || null, lib: r.liberadoEm || null })).filter((r) => r.rec),
      });
    }

    if (acao === "salvar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const mod = MODULOS[txt(body.modulo)];
      if (!mod) return json({ erro: "Página inválida." }, 400);
      const reg = (body.registro ?? {}) as Record<string, unknown>;
      const dados = limpar(mod.campos, reg);
      const id = uuid(reg.id);
      const agora = new Date().toISOString();
      const modulo = txt(body.modulo);
      if (modulo === "documento" && (!dados.codigo || !dados.titulo) && !id) return json({ erro: "Informe código e título." }, 400);
      if (modulo === "equipamento" && (!dados.codigo || !dados.nome) && !id) return json({ erro: "Informe código e nome do equipamento." }, 400);
      if (modulo === "externo") {
        if (!id && !dados.documento) return json({ erro: "Informe o documento (norma, legislação ou guia)." }, 400);
        if ("resultado" in dados && !RESULTADOS_EXT.includes(String(dados.resultado))) dados.resultado = "VIGENTE";
        if (!id && dados.item == null) {
          const { data: ult } = await sb.from("qualidade_documentos_externos").select("item").order("item", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
          dados.item = (Number(ult?.item) || 0) + 1;
        }
      }
      if (modulo === "nc" && !id && !dados.titulo) return json({ erro: "Descreva a não conformidade." }, 400);
      if (modulo === "nc" && dados.etapa === "ENCERRADA" && !txt(reg.acao) && !id) return json({ erro: "Para encerrar, registre a ação." }, 400);
      if (modulo === "proficiencia") {
        if (typeof dados.z === "number" && !["CORRETO", "INCORRETO"].includes(String(dados.resultado))) dados.resultado = resultadoDoZ(dados.z);
      }
      let salvo: Record<string, unknown>;
      if (id) {
        const { data: antes } = await sb.from(mod.t).select("*").eq("id", id).maybeSingle();
        if (!antes) return json({ erro: "Registro não encontrado." }, 404);
        if (modulo === "nc") {
          if (dados.etapa === "ENCERRADA" && antes.etapa !== "ENCERRADA") {
            if (!txt(dados.acao ?? antes.acao)) return json({ erro: "Para encerrar, registre a ação corretiva." }, 400);
            Object.assign(dados, { encerrada_em: agora, encerrada_por: usuario });
          }
          if (dados.etapa && dados.etapa !== "ENCERRADA") Object.assign(dados, { encerrada_em: null, encerrada_por: null });
        }
        const { data, error } = await sb.from(mod.t).update({ ...dados, atualizado_em: agora, atualizado_por: usuario }).eq("id", id).select("*").single();
        if (error) throw error;
        salvo = data;
        if (modulo === "documento" && dados.revisao && dados.revisao !== antes.revisao) {
          await sb.from("qualidade_documento_revisoes").insert({ documento_id: id, revisao: dados.revisao, data: (dados.vigencia_inicio as string) || agora.slice(0, 10), descricao: txt(reg.motivo_revisao).slice(0, 2000) || null, autor: usuario });
        }
        if (modulo === "nc" && dados.responsavel && dados.responsavel !== antes.responsavel && dados.responsavel !== usuario) {
          await sb.from("ml_notificacoes").insert({ usuario: dados.responsavel, tipo: "qualidade_nc", titulo: `Não conformidade ${antes.codigo} para você`, corpo: String(salvo.titulo).slice(0, 200), link: "/laboratorio?secao=qualidade&aba=nc", ref_tipo: "qualidade_nc", ref_id: id });
        }
      } else if (modulo === "nc") {
        salvo = await abrirNc({ ...dados, ref_tipo: txt(reg.ref_tipo) || null, ref_id: uuid(reg.ref_id) }, usuario);
      } else {
        const { data, error } = await sb.from(mod.t).insert({ ...dados, criado_por: usuario, atualizado_por: usuario }).select("*").single();
        if (error) {
          if (String((error as { code?: string }).code) === "23505") return json({ erro: "Já existe um registro com esse código." }, 409);
          throw error;
        }
        salvo = data;
        if (modulo === "documento") await sb.from("qualidade_documento_revisoes").insert({ documento_id: data.id, revisao: data.revisao, data: data.vigencia_inicio || agora.slice(0, 10), descricao: "Cadastro no sistema", autor: usuario });
      }
      // Proficiência questionável/insatisfatória ou resultado incorreto: abre não conformidade (uma por ensaio).
      if (modulo === "proficiencia" && ["QUESTIONAVEL", "INSATISFATORIO", "INCORRETO"].includes(String(salvo.resultado)) && !salvo.nc_id) {
        const nc = await abrirNc({ titulo: `${salvo.parametro}${salvo.z != null ? ` com z = ${String(salvo.z).replace(".", ",")}` : " com resultado incorreto"} na ${salvo.rodada}`, origem: "PROFICIENCIA", etapa: "ABERTA", trabalho_afetado: false, prazo: somaMeses(agora.slice(0, 10), 1), ref_tipo: "proficiencia", ref_id: salvo.id, descricao: `Ensaio de proficiência ${salvo.provedor ? `(${salvo.provedor}) ` : ""}— matriz ${salvo.matriz || "—"}.` }, usuario);
        await sb.from("qualidade_proficiencia").update({ nc_id: nc.id }).eq("id", salvo.id);
        salvo.nc_id = nc.id;
      }
      return json({ ok: true, registro: salvo });
    }

    // Documentos externos: registra a verificação de atualização (data de hoje, próxima em +3 meses) de várias linhas de uma vez.
    if (acao === "verificarExternos") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(uuid).filter(Boolean).slice(0, 1000) as string[];
      const data = /^\d{4}-\d{2}-\d{2}$/.test(txt(body.data)) ? txt(body.data) : new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      if (!ids.length) return json({ erro: "Selecione os documentos verificados." }, 400);
      const { data: feitos, error } = await sb.from("qualidade_documentos_externos")
        .update({ data_verificacao: data, proxima_verificacao: somaMeses(data, 3), atualizado_em: new Date().toISOString(), atualizado_por: usuario })
        .in("id", ids).select("id");
      if (error) throw error;
      return json({ ok: true, feitos: (feitos ?? []).length });
    }

    if (acao === "excluir") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const modulo = txt(body.modulo), id = uuid(body.id);
      if (!id || !["auditoria", "proficiencia", "calibracao"].includes(modulo)) return json({ erro: "Esse registro não pode ser excluído; use o status." }, 400);
      const t = modulo === "calibracao" ? "qualidade_calibracoes" : MODULOS[modulo].t;
      const { error } = await sb.from(t).delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (acao === "ler") {
      const id = uuid(body.id);
      const { data: doc } = id ? await sb.from("qualidade_documentos").select("revisao").eq("id", id).maybeSingle() : { data: null };
      if (!doc) return json({ erro: "Documento não encontrado." }, 404);
      const { error } = await sb.from("qualidade_documento_leituras").upsert({ documento_id: id, revisao: doc.revisao, usuario, confirmado_em: new Date().toISOString() }, { onConflict: "documento_id,revisao,usuario" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (acao === "calibrar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const eqId = uuid(body.equipamento_id);
      const { data: eq } = eqId ? await sb.from("qualidade_equipamentos").select("*").eq("id", eqId).maybeSingle() : { data: null };
      if (!eq) return json({ erro: "Equipamento não encontrado." }, 404);
      const tipo = ["CALIBRACAO", "VERIFICACAO", "VALIDACAO", "DIARIA"].includes(txt(body.tipo)) ? txt(body.tipo) : "CALIBRACAO";
      const data = /^\d{4}-\d{2}-\d{2}$/.test(txt(body.data)) ? txt(body.data) : new Date().toISOString().slice(0, 10);
      const resultado = txt(body.resultado) === "REPROVADO" ? "REPROVADO" : "APROVADO";
      const reg = { equipamento_id: eqId, manutencao_id: txt(body.manutencao_id).slice(0, 100) || null, tipo, data, resultado, leitura: txt(body.leitura).slice(0, 300) || null, certificado: txt(body.certificado).slice(0, 200) || null, laboratorio: txt(body.laboratorio).slice(0, 200) || null, observacao: txt(body.observacao).slice(0, 2000) || null, registrado_por: usuario };
      const { data: cal, error } = await sb.from("qualidade_calibracoes").insert(reg).select("*").single();
      if (error) throw error;
      const mudar: Record<string, unknown> = { atualizado_em: new Date().toISOString(), atualizado_por: usuario };
      // Reprovado deixa o equipamento "não apto" (aparece também no Patrimônio e em Manutenções); aprovado libera.
      if (resultado === "REPROVADO") Object.assign(mudar, { bloqueado: true, bloqueio_motivo: `${tipo === "DIARIA" ? "Verificação diária" : tipo === "CALIBRACAO" ? "Calibração" : "Verificação"} reprovada em ${data.split("-").reverse().join("/")}${reg.leitura ? ` (${reg.leitura})` : ""}` });
      else Object.assign(mudar, { bloqueado: false, bloqueio_motivo: null });
      if (resultado === "APROVADO" && tipo !== "DIARIA" && eq.periodicidade_meses) mudar.proxima = somaMeses(data, eq.periodicidade_meses);
      await sb.from("qualidade_equipamentos").update(mudar).eq("id", eqId);
      let nc = null;
      if (resultado === "REPROVADO") {
        nc = await abrirNc({ titulo: `${eq.codigo} · ${eq.nome}: ${tipo === "DIARIA" ? "verificação diária" : tipo.toLowerCase()} reprovada${reg.leitura ? ` (${reg.leitura})` : ""}`, origem: "EQUIPAMENTO", etapa: "ABERTA", trabalho_afetado: true, impacto: eq.ensaios_afetados ? `Ensaios que usam o equipamento: ${eq.ensaios_afetados}` : null, prazo: somaMeses(data, 0), ref_tipo: "calibracao", ref_id: cal.id }, usuario);
        await sb.from("qualidade_calibracoes").update({ nc_id: nc.id }).eq("id", cal.id);
      }
      return json({ ok: true, calibracao: cal, nc });
    }

    if (acao === "metaSalvar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const meta = Number(String(body.meta ?? "").replace(",", "."));
      if (!txt(body.chave) || !Number.isFinite(meta)) return json({ erro: "Meta inválida." }, 400);
      const { error } = await sb.from("qualidade_metas").update({ meta, atualizado_em: new Date().toISOString(), atualizado_por: usuario }).eq("chave", txt(body.chave));
      if (error) throw error;
      return json({ ok: true });
    }

    if (acao === "arquivoEnviar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const refTipo = txt(body.ref_tipo), refId = uuid(body.ref_id);
      if (!refId || !["documento", "equipamento", "calibracao", "nc", "auditoria", "proficiencia"].includes(refTipo)) return json({ erro: "Anexo inválido." }, 400);
      const nome = txt(body.nome).replace(/[\\/]/g, "_").slice(-150);
      const ext = nome.includes(".") ? nome.split(".").pop()!.toLowerCase() : "";
      const tipo = TIPOS_ARQ[ext];
      if (!tipo) return json({ erro: "Aceito PDF, imagens, Word, Excel, CSV e TXT." }, 400);
      let bytes: Uint8Array;
      try { const bin = atob(String(body.base64 ?? "").replace(/^data:[^;]+;base64,/, "")); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); } catch { return json({ erro: "Arquivo inválido." }, 400); }
      if (!bytes.length) return json({ erro: "O arquivo está vazio." }, 400);
      if (bytes.length > 8 * 1024 * 1024) return json({ erro: "O arquivo passa de 8 MB." }, 400);
      const caminho = `qualidade/${refTipo}/${refId}/${crypto.randomUUID()}-${nome.normalize("NFD").replace(/[^\w.\-]+/g, "_")}`;
      const { error: eUp } = await sb.storage.from(BUCKET).upload(caminho, bytes, { contentType: tipo, upsert: false });
      if (eUp) throw eUp;
      const { data, error } = await sb.from("qualidade_arquivos").insert({ ref_tipo: refTipo, ref_id: refId, nome, tipo, tamanho: bytes.length, caminho, autor: usuario }).select("id,ref_tipo,ref_id,nome,tamanho,autor,criado_em").single();
      if (error) { await sb.storage.from(BUCKET).remove([caminho]); throw error; }
      return json({ ok: true, arquivo: data });
    }

    if (acao === "arquivoBaixar") {
      const id = uuid(body.id);
      const { data: a } = id ? await sb.from("qualidade_arquivos").select("nome,caminho").eq("id", id).eq("apagado", false).maybeSingle() : { data: null };
      if (!a) return json({ erro: "Arquivo não encontrado." }, 404);
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(a.caminho, 120, { download: a.nome });
      if (error || !data?.signedUrl) throw error ?? new Error("sem link");
      return json({ ok: true, url: data.signedUrl, nome: a.nome });
    }

    if (acao === "arquivoApagar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const id = uuid(body.id);
      if (!id) return json({ erro: "Arquivo inválido." }, 400);
      const { error } = await sb.from("qualidade_arquivos").update({ apagado: true }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("ml-qualidade", e);
    return json({ erro: "Não foi possível concluir agora. Tente de novo." }, 500);
  }
});
