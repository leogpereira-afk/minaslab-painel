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
import { proximoCodigoAno, somaDias as somaDiasP, faltaNaEficacia, DIAS_EFICACIA, ORIGENS_TREINAMENTO } from "../_shared/pessoal-regras.mjs";
import { proximoCodigo, prazoResposta, prazoConfirmacao, proximaEtapa, faltaParaSeguir, ETAPAS_RECLAMACAO, PRAZO_RESPOSTA_DIAS } from "../_shared/reclamacoes-regras.mjs";
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
const MELHORIA = ["AVALIAR", "EM ANDAMENTO", "VERIFICAR EFICACIA", "IMPLEMENTADA", "DESCARTADA", "SEM SUGESTAO"];
// Histórico da tratativa (Ana, 12/11/2026): cada mudança fica registrada — quem, quando, de/para e o texto.
const passo = (por: string, de: string | null, para: string, texto: string, extra: Record<string, unknown> = {}) => ({ em: new Date().toISOString(), por, de, para, texto: texto || null, ...extra });
const comPasso = (hist: unknown, p: Record<string, unknown>) => [...(Array.isArray(hist) ? hist : []), p].slice(-200);
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
        sb.from("ml_contas").select("usuario,nome,ativo"),
      ]);
      return json({
        podeEscrever, envios, respostas, tratativas: trats, perguntas, revisao: cfg?.revisao ?? "01",
        clientes: (clientes as { id: string; razao_social: string | null; nome_fantasia: string | null }[]).map((c) => ({ id: c.id, nome: c.nome_fantasia || c.razao_social || "", razao: c.razao_social || "" })),
        contratos: Object.fromEntries(((ct.data ?? []) as { id: string; numero_contrato: string }[]).map((x) => [x.id, x.numero_contrato])),
        os: Object.fromEntries(((os.data ?? []) as { id: string; numero_os: string }[]).map((x) => [x.id, x.numero_os])),
        perfis: Object.fromEntries(((pf.data ?? []) as { id: string; nome: string }[]).map((x) => [x.id, x.nome])),
        contas: Object.fromEntries(((contas.data ?? []) as { usuario: string; nome: string }[]).map((x) => [x.usuario, x.nome || x.usuario])),
        responsaveis: ((contas.data ?? []) as { usuario: string; nome: string; ativo: boolean }[]).filter((x) => x.ativo).map((x) => ({ usuario: x.usuario, nome: x.nome || x.usuario })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        eu: usuario,
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
      // Ana (12/11/2026): ao trocar o status da melhoria, confirma com as informações e a melhoria
      // passa a ser acompanhada em Tratativas (tipo MELHORIA), junto com as insatisfações.
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const id = uuid(body.id), status = txt(body.status);
      if (!id || !MELHORIA.includes(status)) return json({ erro: "Dados inválidos." }, 400);
      const acaoTxt = txt(body.acao_melhoria).slice(0, 4000), retorno = txt(body.retorno_cliente).slice(0, 4000);
      const prazo = /^\d{4}-\d{2}-\d{2}$/.test(txt(body.prazo)) ? txt(body.prazo) : null;
      const responsavel = txt(body.responsavel).slice(0, 80) || usuario;
      const evidencia = txt(body.eficacia_evidencia).slice(0, 4000);
      const dataVerif = /^\d{4}-\d{2}-\d{2}$/.test(txt(body.eficacia_data)) ? txt(body.eficacia_data) : new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      if ((status === "EM ANDAMENTO" || status === "VERIFICAR EFICACIA" || status === "IMPLEMENTADA") && !acaoTxt) return json({ erro: "Descreva a ação da melhoria." }, 400);
      if (status === "IMPLEMENTADA" && !evidencia) return json({ erro: "Para marcar como implementada, registre a evidência da eficácia." }, 400);
      if (status === "DESCARTADA" && !acaoTxt) return json({ erro: "Explique por que a melhoria foi descartada." }, 400);
      const { data: resp } = await sb.from("satisfacao_respostas").select("id,cliente_id,gostou,mudaria,melhorar,textos,melhoria_status").eq("id", id).is("deleted_at", null).maybeSingle();
      if (!resp) return json({ erro: "Resposta não encontrada." }, 404);
      const { error } = await sb.from("satisfacao_respostas").update({ melhoria_status: status }).eq("id", id);
      if (error) throw error;

      const { data: atual } = await sb.from("satisfacao_tratativas").select("id,status,historico").eq("resposta_id", id).eq("tipo", "MELHORIA").maybeSingle();
      const p = passo(usuario, resp.melhoria_status ?? null, status, acaoTxt, {
        ...(status === "IMPLEMENTADA" ? { evidencia, data_verificacao: dataVerif } : {}),
        ...(responsavel ? { responsavel } : {}), ...(prazo ? { prazo } : {}),
      });
      if (status === "SEM SUGESTAO") {
        // Sem sugestão: não há o que tratar; uma tratativa de melhoria ainda aberta é encerrada.
        if (atual && atual.status !== "CONCLUIDA") await sb.from("satisfacao_tratativas").update({ status: "CONCLUIDA", acao: "Marcada como sem sugestão de melhoria.", concluida_em: new Date().toISOString(), updated_at: new Date().toISOString(), historico: comPasso(atual.historico, p) }).eq("id", atual.id);
        return json({ ok: true, tratativaId: atual?.id ?? null });
      }
      const textos = { ...(resp.textos || {}), mudaria: resp.mudaria, melhorar: resp.melhorar } as Record<string, unknown>;
      const sug = Object.entries(textos).filter(([k, v]) => k !== "gostou" && txt(v)).map(([, v]) => txt(v)).join(" · ");
      const agora = new Date().toISOString();
      const concl = status === "IMPLEMENTADA" || status === "DESCARTADA";
      const statusTrat = concl ? "CONCLUIDA" : status === "EM ANDAMENTO" || status === "VERIFICAR EFICACIA" ? "EM ANDAMENTO" : "ABERTA";
      const padraoPrazo = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      const dadosTrat = {
        status: statusTrat, acao: acaoTxt || null, retorno_cliente: retorno || null,
        causa: status === "DESCARTADA" ? "Melhoria descartada" : status === "IMPLEMENTADA" ? "Melhoria implementada" : null,
        responsavel_painel: responsavel, prazo: prazo ?? padraoPrazo,
        concluida_em: concl ? agora : null, updated_at: agora,
        ...(status === "IMPLEMENTADA" ? { eficacia_evidencia: evidencia, eficacia_data: dataVerif } : {}),
      };
      if (atual) {
        if (atual.status === "CONCLUIDA" && !concl) Object.assign(dadosTrat, { concluida_em: null }); // reaberta (ex.: não foi eficaz)
        const { error: e2 } = await sb.from("satisfacao_tratativas").update({ ...dadosTrat, historico: comPasso(atual.historico, p) }).eq("id", atual.id);
        if (e2) throw e2;
        return json({ ok: true, tratativaId: atual.id });
      }
      const { data: nova, error: e3 } = await sb.from("satisfacao_tratativas").insert({
        ...dadosTrat, historico: [p], tipo: "MELHORIA", resposta_id: id, cliente_id: resp.cliente_id ?? null,
        motivo: `Sugestão de melhoria: ${sug || "(sem texto)"}`.slice(0, 1000),
      }).select("id").single();
      if (e3) throw e3;
      return json({ ok: true, tratativaId: nova.id });
    }

    if (acao === "tratativa") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const id = uuid(body.id), status = txt(body.status);
      if (!id || !STATUS_TRAT.includes(status)) return json({ erro: "Dados inválidos." }, 400);
      const causa = txt(body.causa).slice(0, 4000), acaoTomada = txt(body.acao_tomada).slice(0, 4000), retorno = txt(body.retorno_cliente).slice(0, 4000);
      const { data: atual } = await sb.from("satisfacao_tratativas").select("status,concluida_em,tarefa_id,tarefa_painel_id,tipo,resposta_id,historico").eq("id", id).maybeSingle();
      if (!atual) return json({ erro: "Tratativa não encontrada." }, 404);
      if (atual.status === "CONCLUIDA") return json({ erro: "Esta tratativa já foi concluída." }, 409);
      const ehMelhoria = atual.tipo === "MELHORIA";
      if (status === "CONCLUIDA" && !ehMelhoria && (!causa || !acaoTomada || !retorno)) return json({ erro: "Para concluir, preencha causa, ação e retorno ao cliente." }, 400);
      if (status === "CONCLUIDA" && ehMelhoria && !acaoTomada) return json({ erro: "Para concluir, descreva a ação da melhoria." }, 400);
      const agora = new Date().toISOString(), concl = status === "CONCLUIDA";
      const { data: vinc } = await sb.from("crm_sso_vinculos").select("crm_user_id").eq("usuario_painel", usuario).maybeSingle();
      const { error } = await sb.from("satisfacao_tratativas").update({
        status, causa: causa || null, acao: acaoTomada || null, retorno_cliente: retorno || null,
        concluida_em: concl ? agora : null, concluida_por: concl ? (vinc?.crm_user_id ?? null) : null, updated_at: agora,
        historico: comPasso(atual.historico, passo(usuario, atual.status, status, [causa && `Causa: ${causa}`, acaoTomada && `Ação: ${acaoTomada}`, retorno && `Retorno: ${retorno}`].filter(Boolean).join("\n"))),
      }).eq("id", id);
      if (error) throw error;
      // Melhoria: o status na aba Respostas acompanha a tratativa.
      if (ehMelhoria && atual.resposta_id) await sb.from("satisfacao_respostas").update({ melhoria_status: concl ? "IMPLEMENTADA" : status === "EM ANDAMENTO" ? "EM ANDAMENTO" : "AVALIAR" }).eq("id", atual.resposta_id);
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
      const [docs, revs, leits, eqs, cals, ncs, auds, profs, metas, arqs, contas, entradas, externos, recls, treins, efics, autzs, matriz, pessoasRh, estoque, desvios] = await Promise.all([
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
        sb.from("qualidade_reclamacoes").select("*").order("recebida_em", { ascending: false }).order("codigo", { ascending: false }),
        sb.from("qualidade_treinamentos").select("*").order("data", { ascending: false, nullsFirst: true }).order("codigo", { ascending: false }),
        sb.from("qualidade_treinamento_eficacia").select("*"),
        sb.from("qualidade_autorizacoes").select("*").order("data_autorizacao", { ascending: false }),
        sb.from("qualidade_matriz").select("*"),
        // Colaboradores do RH (6.2): só o que a Qualidade precisa — nada de salário, CPF ou endereço.
        sb.from("ml_registros").select("id,registro").eq("colecao", "rh_pessoas").eq("apagado", false),
        // Provedores externos (6.6): o cadastro, a FAPE, os documentos e a inspeção de recebimento ficam na Gestão de Estoque.
        sb.from("ml_registros").select("colecao,id,registro").in("colecao", ["estoque_fornecedores", "estoque_documentos_fornecedor", "estoque_inspecoes", "estoque_avaliacoes_fornecedor"]).eq("apagado", false),
        sb.from("qualidade_desvios_amostra").select("*").order("data", { ascending: false }).order("codigo", { ascending: false }),
      ]);
      for (const r of [docs, revs, leits, eqs, cals, ncs, auds, profs, metas, arqs, contas, externos, recls, treins, efics, autzs, matriz, pessoasRh, estoque, desvios]) if (r.error) throw r.error;
      const est = (c: string) => ((estoque.data ?? []) as { colecao: string; id: string; registro: Record<string, unknown> }[]).filter((x) => x.colecao === c).map((x) => ({ ...x.registro, id: x.id }));
      const anoAtras = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
      const provedores = {
        fornecedores: est("estoque_fornecedores").map((f) => ({ id: f.id, nome: f.nome, cnpj: f.cnpj, tipo: f.tipoFornecedor, servico: f.tipoServico, status: f.status, requerQualificacao: f.requerQualificacao, resultado: f.resultadoQualificacao, ultima: f.dataUltimaAvaliacao, proxima: f.dataProximaAvaliacao, periodicidade: f.periodicidade, statusReavaliacao: f.statusReavaliacao })),
        documentos: est("estoque_documentos_fornecedor").filter((d) => d.ativo !== false).map((d) => ({ fornecedorId: d.fornecedorId, tipo: d.tipoDocumento, validade: d.dataValidade, possuiValidade: d.possuiValidade })),
        inspecoes: est("estoque_inspecoes").filter((i) => String(i.dataRecebimento ?? "") >= anoAtras).map((i) => ({ id: i.id, fornecedor: i.fornecedor, produto: i.produto, data: i.dataRecebimento, parecer: i.parecer, status: i.statusQualidade, nota: i.notaFinal })),
        avaliacoes: est("estoque_avaliacoes_fornecedor").map((a) => ({ fornecedorId: a.fornecedorId, data: a.dataAvaliacao, resultado: a.resultadoFinal, classificacao: a.classificacaoNota, tipo: a.tipoAvaliacao })),
      };
      const pessoas = ((pessoasRh.data ?? []) as { id: string; registro: Record<string, unknown> }[]).map(({ id, registro: p }) => ({
        id, nome: p.nome ?? "", cargo: p.cargo ?? "", setor: p.setor ?? "", admissao: p.admissao ?? null, escolaridade: p.escolaridade ?? "",
        formacao: p.formacao ?? "", registroConselho: p.registroConselho ?? "", vinculo: p.vinculo ?? "", ativo: p.ativo !== false && !p.desligadoEm, desligadoEm: p.desligadoEm ?? null,
      })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
      return json({
        podeEscrever, eu: usuario,
        documentos: docs.data, revisoes: revs.data, leituras: leits.data, calibracoes: cals.data, manutencoes,
        equipamentos: (eqs.data ?? []).map((e: Record<string, unknown>) => ({ ...e, bem: e.bem_id ? bens.get(String(e.bem_id)) ?? null : null })),
        externos: externos.data, reclamacoes: recls.data,
        provedores, desvios: desvios.data,
        treinamentos: treins.data, eficacias: efics.data, autorizacoes: autzs.data, matriz: matriz.data, pessoas,
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
      if (!id || !["auditoria", "proficiencia", "calibracao", "externo"].includes(modulo)) return json({ erro: "Esse registro não pode ser excluído; use o status." }, 400);
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

    // Reclamações (7.9 · PG 013 · FM-LAB-113): registro com protocolo RRC NNN/AAAA, etapas com o que cada uma exige,
    // prazos (confirmação em 2 dias úteis; resposta por classificação) e histórico de quem fez o quê.
    if (acao === "reclamacaoSalvar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const reg = (body.registro ?? {}) as Record<string, unknown>;
      const id = uuid(reg.id);
      const TXT = ["canal", "cliente_nome", "cnpj_cpf", "reclamante", "contato", "email", "os_referencia", "descricao", "recebida_por", "acao_imediata", "validacao", "confirmada_meio", "responsavel", "analise", "acao", "eficacia", "resposta", "respondida_meio", "analisado_por", "aprovado_por", "observacao", "encerramento"];
      const DT = ["recebida_em", "ocorrido_em", "confirmada_em", "prazo_confirmacao", "prazo_resposta", "respondida_em", "analisado_em", "aprovado_em"];
      const d: Record<string, unknown> = {};
      for (const c of TXT) if (c in reg) d[c] = txt(reg[c]).slice(0, c === "descricao" || c === "analise" || c === "resposta" ? 8000 : 4000) || null;
      for (const c of DT) if (c in reg) d[c] = /^\d{4}-\d{2}-\d{2}$/.test(txt(reg[c])) ? txt(reg[c]) : null;
      if ("tipo" in reg) d.tipo = reg.tipo === "SUGESTAO" ? "SUGESTAO" : "RECLAMACAO";
      if ("classificacao" in reg) d.classificacao = String(reg.classificacao) in PRAZO_RESPOSTA_DIAS ? reg.classificacao : "MEDIA";
      if ("procedente" in reg) d.procedente = reg.procedente === true ? true : reg.procedente === false ? false : null;
      if ("cliente_id" in reg) d.cliente_id = uuid(reg.cliente_id);
      if ("envolvidos" in reg) d.envolvidos = (Array.isArray(reg.envolvidos) ? reg.envolvidos : []).map((x) => txt(x).slice(0, 80)).filter(Boolean).slice(0, 20);
      const agora = new Date().toISOString(), hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const rotulo = (e: string) => ETAPAS_RECLAMACAO.find((x) => x[0] === e)?.[1] ?? e;
      if (!id) {
        if (!txt(d.descricao)) return json({ erro: "Descreva a reclamação." }, 400);
        const recebida = (d.recebida_em as string) || hoje;
        const novo = {
          ...d, etapa: "RECEBIDA", recebida_em: recebida, recebida_por: d.recebida_por || usuario, classificacao: d.classificacao || "MEDIA",
          prazo_confirmacao: d.prazo_confirmacao || prazoConfirmacao(recebida),
          prazo_resposta: d.prazo_resposta || prazoResposta(recebida, String(d.classificacao || "MEDIA")),
          historico: [{ em: agora, por: usuario, para: "RECEBIDA", texto: "Reclamação registrada." }],
          criado_por: usuario, atualizado_por: usuario,
        };
        for (let tentativa = 0; tentativa < 3; tentativa++) {
          const ano = Number(recebida.slice(0, 4));
          const { data: cods } = await sb.from("qualidade_reclamacoes").select("codigo").like("codigo", `RRC %/${ano}`);
          const codigo = proximoCodigo(((cods ?? []) as { codigo: string }[]).map((x) => x.codigo), ano);
          const { data, error } = await sb.from("qualidade_reclamacoes").insert({ ...novo, codigo }).select("*").single();
          if (!error) {
            if (data.responsavel && data.responsavel !== usuario) await sb.from("ml_notificacoes").insert({ usuario: data.responsavel, tipo: "qualidade_reclamacao", titulo: `Reclamação ${data.codigo} para você`, corpo: String(data.descricao).slice(0, 200), link: "/laboratorio?secao=qualidade&aba=reclamacoes", ref_tipo: "qualidade_reclamacoes", ref_id: data.id });
            return json({ ok: true, registro: data });
          }
          if (String((error as { code?: string }).code) !== "23505") throw error; // número já usado por outro registro ao mesmo tempo: tenta o próximo
        }
        return json({ erro: "Não foi possível gerar o protocolo. Tente de novo." }, 409);
      }
      const { data: antes } = await sb.from("qualidade_reclamacoes").select("*").eq("id", id).maybeSingle();
      if (!antes) return json({ erro: "Reclamação não encontrada." }, 404);
      if (antes.etapa === "ENCERRADA" && reg.reabrir !== true) return json({ erro: "Esta reclamação já foi encerrada." }, 409);
      const junto = { ...antes, ...d } as Record<string, unknown>;
      const hist = Array.isArray(antes.historico) ? [...antes.historico] : [];
      if (reg.reabrir === true) {
        Object.assign(d, { etapa: "RESPOSTA", encerrada_em: null, encerrada_por: null });
        hist.push({ em: agora, por: usuario, de: "ENCERRADA", para: "RESPOSTA", texto: txt(reg.motivo).slice(0, 2000) || "Reaberta." });
      } else if (reg.seguir === true) {
        const para = proximaEtapa(junto as { etapa: string; procedente?: boolean });
        if (!para) return json({ erro: "Não há etapa seguinte." }, 400);
        const falta = faltaParaSeguir(junto, para);
        if (falta) return json({ erro: falta }, 400);
        d.etapa = para;
        if (para === "ENCERRADA") Object.assign(d, { encerrada_em: agora, encerrada_por: usuario });
        hist.push({ em: agora, por: usuario, de: antes.etapa, para, texto: null });
      } else {
        const mudou = Object.keys(d).filter((k) => JSON.stringify(d[k] ?? null) !== JSON.stringify(antes[k] ?? null));
        if (mudou.length) hist.push({ em: agora, por: usuario, para: antes.etapa, texto: `Atualizou: ${mudou.join(", ")}.` });
      }
      if ("classificacao" in d && d.classificacao !== antes.classificacao && !("prazo_resposta" in reg)) d.prazo_resposta = prazoResposta(antes.recebida_em, String(d.classificacao));
      const { data, error } = await sb.from("qualidade_reclamacoes").update({ ...d, historico: hist.slice(-300), atualizado_em: agora, atualizado_por: usuario }).eq("id", id).select("*").single();
      if (error) throw error;
      if (d.responsavel && d.responsavel !== antes.responsavel && d.responsavel !== usuario) await sb.from("ml_notificacoes").insert({ usuario: d.responsavel, tipo: "qualidade_reclamacao", titulo: `Reclamação ${antes.codigo} para você`, corpo: String(antes.descricao).slice(0, 200), link: "/laboratorio?secao=qualidade&aba=reclamacoes", ref_tipo: "qualidade_reclamacoes", ref_id: id });
      return json({ ok: true, registro: data, rotulo: rotulo(String(data.etapa)) });
    }

    // Pessoal e competência (6.2 · PT 001): RT/PAT (treinamento), AVET (eficácia), AUTZ (autorização) e MC (matriz).
    if (acao === "pessoalSalvar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const tipo = txt(body.tipo);
      const reg = (body.registro ?? {}) as Record<string, unknown>;
      const id = uuid(reg.id);
      const agora = new Date().toISOString(), hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const data = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(txt(v)) ? txt(v) : null);
      const pessoaLimpa = (x: unknown) => { const o = (x ?? {}) as Record<string, unknown>; return { id: txt(o.id).slice(0, 80), nome: txt(o.nome).slice(0, 160), cargo: txt(o.cargo).slice(0, 120) }; };
      const gerarCodigo = async (tabela: string, prefixo: string, ano: number) => {
        const { data: cods } = await sb.from(tabela).select("codigo").like("codigo", `${prefixo} %/${ano}`);
        return proximoCodigoAno(prefixo, ((cods ?? []) as { codigo: string }[]).map((x) => x.codigo), ano);
      };
      const inserirComCodigo = async (tabela: string, prefixo: string, ano: number, dados: Record<string, unknown>) => {
        for (let i = 0; i < 3; i++) {
          const codigo = await gerarCodigo(tabela, prefixo, ano);
          const { data: novo, error } = await sb.from(tabela).insert({ ...dados, codigo }).select("*").single();
          if (!error) return novo;
          if (String((error as { code?: string }).code) !== "23505") throw error;
        }
        throw new Error("Não foi possível gerar o número. Tente de novo.");
      };

      if (tipo === "treinamento") {
        const d: Record<string, unknown> = {};
        for (const c of ["tema", "objetivo", "carga_horaria", "local", "instrutor", "responsavel", "observacao"]) if (c in reg) d[c] = txt(reg[c]).slice(0, c === "tema" || c === "objetivo" || c === "observacao" ? 4000 : 200) || null;
        if ("status" in reg) d.status = ["PLANEJADO", "REALIZADO", "CANCELADO"].includes(String(reg.status)) ? reg.status : "REALIZADO";
        if ("origem" in reg) d.origem = ORIGENS_TREINAMENTO.some(([k]) => k === reg.origem) ? reg.origem : "EVENTUAL";
        if ("tipo" in reg) d.tipo = reg.tipo === "EXTERNO" ? "EXTERNO" : "INTERNO";
        if ("data" in reg) d.data = data(reg.data);
        if ("eficacia_prevista" in reg) d.eficacia_prevista = data(reg.eficacia_prevista);
        if ("nc_id" in reg) d.nc_id = uuid(reg.nc_id);
        if ("documentos" in reg) d.documentos = (Array.isArray(reg.documentos) ? reg.documentos : []).map((x) => txt(x).slice(0, 60)).filter(Boolean).slice(0, 60);
        if ("participantes" in reg) d.participantes = (Array.isArray(reg.participantes) ? reg.participantes : []).map(pessoaLimpa).filter((p) => p.id && p.nome).slice(0, 80);
        const status = String(d.status ?? "");
        if ((status === "REALIZADO" || (!id && !d.status)) && d.data && !("eficacia_prevista" in reg && d.eficacia_prevista)) d.eficacia_prevista = somaDiasP(String(d.data), DIAS_EFICACIA);
        if (!id) {
          if (!txt(d.tema)) return json({ erro: "Informe o treinamento (tema)." }, 400);
          if ((d.status ?? "REALIZADO") === "REALIZADO" && !d.data) return json({ erro: "Informe a data do treinamento." }, 400);
          const ano = Number(String(d.data || hoje).slice(0, 4));
          const novo = await inserirComCodigo("qualidade_treinamentos", "TRE", ano, { status: "REALIZADO", ...d, historico: [{ em: agora, por: usuario, texto: `Registrado (${d.status ?? "REALIZADO"}).` }], criado_por: usuario, atualizado_por: usuario });
          return json({ ok: true, registro: novo });
        }
        const { data: antes } = await sb.from("qualidade_treinamentos").select("*").eq("id", id).maybeSingle();
        if (!antes) return json({ erro: "Treinamento não encontrado." }, 404);
        const junto = { ...antes, ...d };
        if (junto.status === "REALIZADO" && !junto.data) return json({ erro: "Informe a data em que o treinamento foi realizado." }, 400);
        if (junto.status === "REALIZADO" && !junto.eficacia_prevista && junto.data) d.eficacia_prevista = somaDiasP(String(junto.data), DIAS_EFICACIA);
        const mudou = Object.keys(d).filter((k) => JSON.stringify(d[k] ?? null) !== JSON.stringify(antes[k] ?? null));
        const hist = [...(Array.isArray(antes.historico) ? antes.historico : [])];
        if (mudou.length) hist.push({ em: agora, por: usuario, texto: d.status && d.status !== antes.status ? `Status: ${antes.status} → ${d.status}.` : `Atualizou: ${mudou.join(", ")}.` });
        const { data: salvo, error } = await sb.from("qualidade_treinamentos").update({ ...d, historico: hist.slice(-200), atualizado_em: agora, atualizado_por: usuario }).eq("id", id).select("*").single();
        if (error) throw error;
        return json({ ok: true, registro: salvo });
      }

      if (tipo === "eficacia") {
        const treinamentoId = uuid(reg.treinamento_id);
        const { data: t } = await sb.from("qualidade_treinamentos").select("id,codigo,status,documentos,participantes,data").eq("id", treinamentoId).maybeSingle();
        if (!t) return json({ erro: "Treinamento não encontrado." }, 404);
        if (t.status !== "REALIZADO") return json({ erro: "A eficácia é avaliada depois que o treinamento é realizado." }, 400);
        const pessoa = ((t.participantes ?? []) as Record<string, unknown>[]).find((p) => String(p.id) === txt(reg.pessoa_id));
        if (!pessoa) return json({ erro: "Essa pessoa não participou do treinamento." }, 400);
        const a: Record<string, unknown> = {
          treinamento_id: t.id, pessoa_id: String(pessoa.id), nome: pessoa.nome ?? null, cargo: pessoa.cargo ?? null,
          data_avaliacao: data(reg.data_avaliacao) || hoje,
          avaliadores: (Array.isArray(reg.avaliadores) ? reg.avaliadores : []).map((x) => txt(x).slice(0, 80)).filter(Boolean).slice(0, 6),
          eficaz: reg.eficaz === true ? true : reg.eficaz === false ? false : null,
        };
        for (const c of ["nota_conhecimento", "nota_aplicacao", "nota_resultados", "nota_geral"]) { const n = Math.round(Number(reg[c])); a[c] = n >= 1 && n <= 5 ? n : null; }
        for (const c of ["melhorias", "plano_causa", "plano_acao", "plano_responsavel", "plano_verificacao", "aprovado_por"]) a[c] = txt(reg[c]).slice(0, 4000) || null;
        for (const c of ["plano_data", "plano_verificado_em", "aprovado_em"]) a[c] = data(reg[c]);
        const falta = faltaNaEficacia(a);
        if (falta) return json({ erro: falta }, 400);
        const { data: salvo, error } = await sb.from("qualidade_treinamento_eficacia").upsert({ ...a, atualizado_em: agora, atualizado_por: usuario, criado_por: usuario }, { onConflict: "treinamento_id,pessoa_id" }).select("*").single();
        if (error) throw error;
        // Eficaz: os documentos treinados passam a constar como LIBERADOS na matriz de competências da pessoa.
        const docsT = (t.documentos ?? []) as string[];
        if (a.eficaz === true && docsT.length) {
          const { data: tits } = await sb.from("qualidade_documentos").select("codigo,titulo").in("codigo", docsT);
          const titulo = new Map(((tits ?? []) as { codigo: string; titulo: string }[]).map((x) => [x.codigo, x.titulo]));
          await sb.from("qualidade_matriz").upsert(docsT.map((doc) => ({ pessoa_id: String(pessoa.id), documento: doc, documento_titulo: titulo.get(doc) ?? null, status: "LIBERADO", liberado_em: a.data_avaliacao, origem: t.codigo, atualizado_em: agora, atualizado_por: usuario })), { onConflict: "pessoa_id,documento" });
        }
        return json({ ok: true, registro: salvo });
      }

      if (tipo === "autorizacao") {
        const d: Record<string, unknown> = {};
        if ("pessoa" in reg) { const p = pessoaLimpa(reg.pessoa); if (!p.id) return json({ erro: "Escolha o colaborador." }, 400); Object.assign(d, { pessoa_id: p.id, nome: p.nome, cargo: p.cargo }); }
        if ("cargo" in reg) d.cargo = txt(reg.cargo).slice(0, 120) || null;
        for (const c of ["atividades", "fundamentacao", "autorizado_por", "revogada_motivo"]) if (c in reg) d[c] = txt(reg[c]).slice(0, 6000) || null;
        for (const c of ["data_autorizacao", "revisar_em", "revogada_em"]) if (c in reg) d[c] = data(reg[c]);
        if (d.revogada_em && !txt(d.revogada_motivo)) return json({ erro: "Informe o motivo da revogação." }, 400);
        if (!id) {
          if (!d.pessoa_id) return json({ erro: "Escolha o colaborador." }, 400);
          if (!txt(d.atividades)) return json({ erro: "Liste as atividades autorizadas." }, 400);
          const dt = (d.data_autorizacao as string) || hoje;
          const novo = await inserirComCodigo("qualidade_autorizacoes", "AUTZ", Number(dt.slice(0, 4)), { ...d, data_autorizacao: dt, autorizado_por: d.autorizado_por || usuario, criado_por: usuario, atualizado_por: usuario });
          return json({ ok: true, registro: novo });
        }
        const { data: salvo, error } = await sb.from("qualidade_autorizacoes").update({ ...d, atualizado_em: agora, atualizado_por: usuario }).eq("id", id).select("*").single();
        if (error) throw error;
        return json({ ok: true, registro: salvo });
      }

      if (tipo === "matriz") {
        const pessoaId = txt(reg.pessoa_id).slice(0, 80), doc = txt(reg.documento).slice(0, 60);
        if (!pessoaId || !doc) return json({ erro: "Informe colaborador e documento." }, 400);
        if (reg.remover === true) { await sb.from("qualidade_matriz").delete().eq("pessoa_id", pessoaId).eq("documento", doc); return json({ ok: true }); }
        const status = ["LIBERADO", "EM_TREINAMENTO", "NAO_APLICA"].includes(String(reg.status)) ? reg.status : "LIBERADO";
        const { data: salvo, error } = await sb.from("qualidade_matriz").upsert({
          pessoa_id: pessoaId, documento: doc, documento_titulo: txt(reg.documento_titulo).slice(0, 300) || null, status,
          liberado_em: data(reg.liberado_em) || (status === "LIBERADO" ? hoje : null), origem: txt(reg.origem).slice(0, 60) || null,
          observacao: txt(reg.observacao).slice(0, 1000) || null, atualizado_em: agora, atualizado_por: usuario,
        }, { onConflict: "pessoa_id,documento" }).select("*").single();
        if (error) throw error;
        return json({ ok: true, registro: salvo });
      }
      return json({ erro: "Tipo inválido." }, 400);
    }

    // Desvio no recebimento de item de ensaio (7.4.3): consulta ao cliente, decisão e ressalva no relatório.
    if (acao === "desvioSalvar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const reg = (body.registro ?? {}) as Record<string, unknown>;
      const id = uuid(reg.id);
      const agora = new Date().toISOString(), hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const TIPOS = ["TEMPERATURA", "INTEGRIDADE", "VOLUME", "PRAZO", "IDENTIFICACAO", "PRESERVACAO", "FRASCO", "OUTRO"];
      const d: Record<string, unknown> = {};
      for (const c of ["os_referencia", "cliente_nome", "matriz", "descricao", "condicao_encontrada", "condicao_especificada", "consulta_meio", "consulta_com", "ressalva", "responsavel", "observacao"]) if (c in reg) d[c] = txt(reg[c]).slice(0, 4000) || null;
      for (const c of ["data", "cliente_consultado_em"]) if (c in reg) d[c] = /^\d{4}-\d{2}-\d{2}$/.test(txt(reg[c])) ? txt(reg[c]) : null;
      if ("tipos" in reg) d.tipos = (Array.isArray(reg.tipos) ? reg.tipos : []).map(String).filter((t) => TIPOS.includes(t));
      if ("decisao" in reg) d.decisao = ["PROSSEGUIR_COM_RESSALVA", "NOVA_AMOSTRA", "CANCELAR", "AGUARDANDO"].includes(String(reg.decisao)) ? reg.decisao : null;
      if ("encerrado" in reg) d.encerrado = reg.encerrado === true;
      const { data: antes } = id ? await sb.from("qualidade_desvios_amostra").select("*").eq("id", id).maybeSingle() : { data: null };
      if (id && !antes) return json({ erro: "Registro não encontrado." }, 404);
      const junto = { ...(antes ?? {}), ...d } as Record<string, unknown>;
      if (!txt(junto.descricao)) return json({ erro: "Descreva o desvio." }, 400);
      if (junto.encerrado === true) {
        if (!junto.cliente_consultado_em) return json({ erro: "Para encerrar, registre quando o cliente foi consultado (7.4.3)." }, 400);
        if (!junto.decisao || junto.decisao === "AGUARDANDO") return json({ erro: "Para encerrar, registre a decisão do cliente." }, 400);
        if (junto.decisao === "PROSSEGUIR_COM_RESSALVA" && !txt(junto.ressalva)) return json({ erro: "O ensaio segue com o desvio: escreva a ressalva que vai no relatório." }, 400);
      }
      if (!id) {
        const data = (d.data as string) || hoje, ano = Number(data.slice(0, 4));
        for (let i = 0; i < 3; i++) {
          const { data: cods } = await sb.from("qualidade_desvios_amostra").select("codigo").like("codigo", `DES %/${ano}`);
          const codigo = proximoCodigoAno("DES", ((cods ?? []) as { codigo: string }[]).map((x) => x.codigo), ano);
          const { data: novo, error } = await sb.from("qualidade_desvios_amostra").insert({ ...d, data, codigo, responsavel: d.responsavel || usuario, historico: [{ em: agora, por: usuario, texto: "Desvio registrado." }], criado_por: usuario, atualizado_por: usuario }).select("*").single();
          if (!error) return json({ ok: true, registro: novo });
          if (String((error as { code?: string }).code) !== "23505") throw error;
        }
        return json({ erro: "Não foi possível gerar o número. Tente de novo." }, 409);
      }
      const mudou = Object.keys(d).filter((k) => JSON.stringify(d[k] ?? null) !== JSON.stringify((antes as Record<string, unknown>)[k] ?? null));
      const hist = [...(Array.isArray(antes!.historico) ? antes!.historico : [])];
      if (mudou.length) hist.push({ em: agora, por: usuario, texto: d.encerrado === true && !antes!.encerrado ? "Encerrado." : `Atualizou: ${mudou.join(", ")}.` });
      const { data: salvo, error } = await sb.from("qualidade_desvios_amostra").update({ ...d, historico: hist.slice(-200), atualizado_em: agora, atualizado_por: usuario }).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ ok: true, registro: salvo });
    }

    // Registros técnicos (7.5): trilha de alterações do LIMS — quem, quando, o que era e o que ficou (7.5.2).
    if (acao === "registrosTecnicos") {
      const de = /^\d{4}-\d{2}-\d{2}$/.test(txt(body.de)) ? txt(body.de) : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const ate = /^\d{4}-\d{2}-\d{2}$/.test(txt(body.ate)) ? txt(body.ate) : new Date().toISOString().slice(0, 10);
      let qy = sb.from("ml_lims_auditoria").select("id,em,usuario,colecao,registro_id,acao,antes,depois", { count: "exact" })
        .gte("em", `${de}T00:00:00-03:00`).lte("em", `${ate}T23:59:59-03:00`).order("em", { ascending: false });
      if (txt(body.colecao)) qy = qy.eq("colecao", txt(body.colecao).slice(0, 60));
      if (txt(body.usuario)) qy = qy.eq("usuario", txt(body.usuario).slice(0, 80));
      if (body.semImportacao !== false) qy = qy.not("acao", "ilike", "Importou%");
      const pagina = Math.max(1, Math.min(200, Number(body.pagina) || 1));
      const { data, count, error } = await qy.range((pagina - 1) * 100, pagina * 100 - 1);
      if (error) throw error;
      const { data: cols } = await sb.from("ml_lims_auditoria").select("colecao").limit(1000);
      return json({ itens: data ?? [], total: count ?? 0, pagina, colecoes: [...new Set(((cols ?? []) as { colecao: string }[]).map((c) => c.colecao))].sort() });
    }

    // Não conformidade de provedor externo (6.6 · 8.7): fornecimento fora do especificado, IR reprovada, documento vencido…
    if (acao === "fornecedorNc") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const fornecedorId = txt(body.fornecedorId).slice(0, 80), descricao = txt(body.descricao).slice(0, 4000);
      if (!fornecedorId || !descricao) return json({ erro: "Escolha o fornecedor e descreva o problema." }, 400);
      const { data: fr } = await sb.from("ml_registros").select("registro").eq("colecao", "estoque_fornecedores").eq("id", fornecedorId).eq("apagado", false).maybeSingle();
      if (!fr) return json({ erro: "Fornecedor não encontrado." }, 404);
      const nomeF = txt((fr.registro as Record<string, unknown>).nome) || fornecedorId;
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const nc = await abrirNc({ titulo: `Fornecedor ${nomeF}: ${descricao.split("\n")[0].slice(0, 140)}`, origem: "FORNECEDOR", etapa: "ABERTA", descricao, responsavel: txt(body.responsavel) || usuario, prazo: somaMeses(hoje, 1), trabalho_afetado: body.trabalhoAfetado === true, ref_tipo: "fornecedor", ref_id: null }, usuario);
      return json({ ok: true, nc });
    }

    // Reclamação procedente que pede ação corretiva: abre a NC (origem Reclamação) já ligada a ela (PG 013 → PG 014).
    if (acao === "reclamacaoNc") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const id = uuid(body.id);
      const { data: rec } = await sb.from("qualidade_reclamacoes").select("*").eq("id", id).maybeSingle();
      if (!rec) return json({ erro: "Reclamação não encontrada." }, 404);
      if (rec.nc_id) return json({ erro: "Esta reclamação já tem não conformidade." }, 409);
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const nc = await abrirNc({
        titulo: `${rec.codigo} · ${String(rec.descricao).split("\n")[0].slice(0, 160)}`, origem: "RECLAMACAO", etapa: "ABERTA",
        descricao: [`Reclamação ${rec.codigo}${rec.cliente_nome ? ` de ${rec.cliente_nome}` : ""}${rec.os_referencia ? ` (${rec.os_referencia})` : ""}.`, rec.descricao, rec.analise ? `Análise: ${rec.analise}` : ""].filter(Boolean).join("\n\n").slice(0, 4000),
        responsavel: rec.responsavel || usuario, prazo: rec.prazo_resposta || somaMeses(hoje, 1), trabalho_afetado: false,
        ref_tipo: "reclamacao", ref_id: rec.id,
      }, usuario);
      const hist = [...(Array.isArray(rec.historico) ? rec.historico : []), { em: new Date().toISOString(), por: usuario, para: rec.etapa, texto: `Abriu a não conformidade ${nc.codigo}.` }];
      await sb.from("qualidade_reclamacoes").update({ nc_id: nc.id, historico: hist, atualizado_em: new Date().toISOString(), atualizado_por: usuario }).eq("id", id);
      return json({ ok: true, nc });
    }

    if (acao === "arquivoEnviar") {
      const bloq = exigeEscrita(); if (bloq) return bloq;
      const refTipo = txt(body.ref_tipo), refId = uuid(body.ref_id);
      if (!refId || !["documento", "equipamento", "calibracao", "nc", "auditoria", "proficiencia", "reclamacao", "treinamento", "autorizacao", "desvio"].includes(refTipo)) return json({ erro: "Anexo inválido." }, 400);
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
