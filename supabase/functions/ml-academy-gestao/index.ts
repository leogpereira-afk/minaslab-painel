// MinasLab Academy — gestão de treinamentos (cadastro, versões, público, vínculos).
// A regra de negócio e a escrita ficam em funções SQL (ml_ac_*); aqui só se
// autentica, autoriza por capacidade e traduz a resposta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { autenticar, CORS, out, pessoasRH as pessoasDoRH, type Sessao } from "../_shared/academy-auth.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const texto = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

class Erro extends Error { constructor(m: string, public status = 400) { super(m); } }
const exigir = (ok: boolean, msg = "Você não tem permissão para esta ação.") => { if (!ok) throw new Erro(msg, 403); };

// Pessoas do RH: só o mínimo para escolher responsável/público (sem CPF, salário etc.).
const pessoasRH = () => pessoasDoRH(sb).then((l) => l.map(({ id, nome, cargo, setor }) => ({ id, nome, cargo, setor })));

async function detalheVersao(versaoId: string) {
  const [v, mod, aul, mat, prob, que, opc, gab] = await Promise.all([
    sb.from("ml_ac_versoes").select("*").eq("id", versaoId).single(),
    sb.from("ml_ac_modulos").select("*").eq("versao_id", versaoId).order("ordem"),
    sb.from("ml_ac_aulas").select("*").eq("versao_id", versaoId).order("ordem"),
    sb.from("ml_ac_materiais").select("*").eq("versao_id", versaoId).order("ordem"),
    sb.rpc("ml_ac_problemas_versao", { p_versao: versaoId }),
    sb.from("ml_ac_questoes").select("id,ordem,tipo,enunciado,feedback").eq("versao_id", versaoId).order("ordem"),
    sb.from("ml_ac_opcoes").select("id,questao_id,ordem,texto").eq("versao_id", versaoId).order("ordem"),
    sb.from("ml_ac_gabaritos").select("opcao_id").eq("versao_id", versaoId),
  ]);
  for (const x of [v, mod, aul, mat, prob, que, opc, gab]) if (x.error) throw x.error;
  const certas = new Set((gab.data ?? []).map((g) => g.opcao_id));
  // O gabarito só sai por aqui, para quem GERENCIA o curso; o colaborador nunca o recebe (ml-academy).
  const questoes = (que.data ?? []).map((x) => ({ tipo: x.tipo, enunciado: x.enunciado, feedback: x.feedback,
    opcoes: (opc.data ?? []).filter((o) => o.questao_id === x.id).map((o) => ({ texto: o.texto, correta: certas.has(o.id) })) }));
  const modulos = (mod.data ?? []).map((m) => ({ id: m.id, titulo: m.titulo, descricao: m.descricao,
    aulas: (aul.data ?? []).filter((a) => a.modulo_id === m.id).map((a) => ({ id: a.id, titulo: a.titulo, tipo: a.tipo, conteudo: a.conteudo, duracaoMin: a.duracao_min })) }));
  return { versao: v.data, modulos, materiais: mat.data ?? [], questoes, problemas: prob.data ?? [] };
}

// Aplica o público às pessoas ATIVAS do RH (idempotente; não duplica nem reatribui versão nova).
async function atribuir(treinamentoId: string) {
  const pessoas = await pessoasDoRH(sb);
  const { data, error } = await sb.rpc("ml_ac_atribuir", { p_pessoas: pessoas.map(({ id, cargo, setor }) => ({ id, cargo, setor })), p_treinamento: treinamentoId });
  if (error) throw error;
  return Number(data ?? 0);
}

async function acao(action: string, b: Record<string, unknown>, s: Sessao) {
  switch (action) {
    case "contexto": {
      exigir(s.caps.gestao || s.caps.qualidade);
      const [cat, grp, mem, pes] = await Promise.all([
        sb.from("ml_ac_categorias").select("id,nome,ordem").eq("ativa", true).order("ordem"),
        sb.from("ml_ac_grupos").select("id,nome,descricao,ativo").order("nome"),
        sb.from("ml_ac_grupo_membros").select("grupo_id,pessoa_id"),
        pessoasRH(),
      ]);
      for (const x of [cat, grp, mem]) if (x.error) throw x.error;
      return { caps: s.caps, direcao: s.direcao, categorias: cat.data, pessoas: pes,
        cargos: [...new Set(pes.map((p) => p.cargo).filter(Boolean))].sort(), setores: [...new Set(pes.map((p) => p.setor).filter(Boolean))].sort(),
        grupos: (grp.data ?? []).map((g) => ({ ...g, membros: (mem.data ?? []).filter((m) => m.grupo_id === g.id).map((m) => m.pessoa_id) })) };
    }
    case "treinamentosListar": {
      exigir(s.caps.gestao || s.caps.qualidade);
      const [t, v] = await Promise.all([
        sb.from("ml_ac_treinamentos").select("id,categoria_id,titulo,status,responsavel_pessoa_id,atualizado_em").order("atualizado_em", { ascending: false }),
        sb.from("ml_ac_versoes").select("id,treinamento_id,numero,status,modalidade,obrigatorio,validade_meses,exige_qualidade,validada_qualidade_em"),
      ]);
      for (const x of [t, v]) if (x.error) throw x.error;
      return { treinamentos: (t.data ?? []).map((x) => ({ ...x, versoes: (v.data ?? []).filter((y) => y.treinamento_id === x.id).sort((a, c) => c.numero - a.numero) })) };
    }
    case "treinamentoCriar": {
      exigir(s.caps.gestao);
      const titulo = texto(b.titulo);
      if (titulo.length < 3) throw new Erro("Informe o título (mínimo 3 letras).");
      const { data, error } = await sb.rpc("ml_ac_treinamento_criar", { p_usuario: s.usuario, p_titulo: titulo, p_categoria: texto(b.categoriaId, 80) });
      if (error) throw error;
      return { id: data };
    }
    case "treinamentoObter": {
      exigir(s.caps.gestao || s.caps.qualidade);
      if (!uuid(b.id)) throw new Erro("Treinamento inválido.");
      const [t, v, p, e] = await Promise.all([
        sb.from("ml_ac_treinamentos").select("*").eq("id", b.id).single(),
        sb.from("ml_ac_versoes").select("id,numero,status,publicada_em,publicada_por").eq("treinamento_id", b.id).order("numero", { ascending: false }),
        sb.from("ml_ac_publico").select("tipo,valor").eq("treinamento_id", b.id),
        sb.from("ml_ac_eventos").select("em,usuario,evento,dados").eq("entidade_id", String(b.id)).order("em", { ascending: false }).limit(50),
      ]);
      for (const x of [t, v, p, e]) if (x.error) throw x.error;
      const versoes = v.data ?? [];
      const alvo = uuid(b.versaoId) && versoes.some((x) => x.id === b.versaoId) ? String(b.versaoId)
        : (versoes.find((x) => x.status === "rascunho") ?? versoes.find((x) => x.status === "publicada") ?? versoes[0])?.id;
      return { treinamento: t.data, versoes, publico: p.data ?? [], eventos: e.data ?? [], atual: alvo ? await detalheVersao(alvo) : null };
    }
    case "treinamentoMeta": {
      exigir(s.caps.gestao);
      if (!uuid(b.id)) throw new Erro("Treinamento inválido.");
      const { error } = await sb.rpc("ml_ac_treinamento_meta", { p_usuario: s.usuario, p_id: b.id, p_categoria: texto(b.categoriaId, 80), p_responsavel: texto(b.responsavelPessoaId, 100) });
      if (error) throw error;
      return { ok: true };
    }
    case "versaoSalvar": {
      exigir(s.caps.gestao);
      if (!uuid(b.versaoId) || typeof b.dados !== "object" || !b.dados) throw new Erro("Dados inválidos.");
      if (JSON.stringify(b.dados).length > 1_500_000) throw new Erro("Conteúdo grande demais.");
      const { error } = await sb.rpc("ml_ac_versao_salvar", { p_usuario: s.usuario, p_versao: b.versaoId, p_dados: b.dados });
      if (error) throw error;
      return { ok: true, ...(await detalheVersao(String(b.versaoId))) };
    }
    case "versaoValidarQualidade": {
      exigir(s.caps.qualidade, "Só a Qualidade (ou a direção) valida versões.");
      if (!uuid(b.versaoId)) throw new Erro("Versão inválida.");
      const { error } = await sb.rpc("ml_ac_versao_validar_qualidade", { p_usuario: s.usuario, p_versao: b.versaoId, p_carga_validada: b.cargaValidada === true });
      if (error) throw error;
      return { ok: true, ...(await detalheVersao(String(b.versaoId))) };
    }
    case "versaoPublicar": {
      exigir(s.caps.gestao);
      if (!uuid(b.versaoId)) throw new Erro("Versão inválida.");
      const { error } = await sb.rpc("ml_ac_versao_publicar", { p_usuario: s.usuario, p_versao: b.versaoId });
      if (error) throw error;
      const { data: vv } = await sb.from("ml_ac_versoes").select("treinamento_id").eq("id", b.versaoId).single();
      const atribuidas = vv ? await atribuir(vv.treinamento_id) : 0;
      return { ok: true, atribuidas };
    }
    case "novaVersao": {
      exigir(s.caps.gestao);
      if (!uuid(b.treinamentoId)) throw new Erro("Treinamento inválido.");
      const { data, error } = await sb.rpc("ml_ac_nova_versao", { p_usuario: s.usuario, p_treinamento: b.treinamentoId });
      if (error) throw error;
      return { versaoId: data };
    }
    case "treinamentoArquivar": {
      exigir(s.caps.gestao);
      if (!uuid(b.id)) throw new Erro("Treinamento inválido.");
      const { error } = await sb.rpc("ml_ac_treinamento_arquivar", { p_usuario: s.usuario, p_id: b.id });
      if (error) throw error;
      return { ok: true };
    }
    case "publicoSalvar": {
      exigir(s.caps.gestao);
      if (!uuid(b.treinamentoId) || !Array.isArray(b.itens) || b.itens.length > 500) throw new Erro("Público inválido.");
      const { error } = await sb.rpc("ml_ac_publico_salvar", { p_usuario: s.usuario, p_treinamento: b.treinamentoId, p_itens: b.itens });
      if (error) throw error;
      return { ok: true };
    }
    case "publicoAplicar": {
      exigir(s.caps.gestao);
      if (!uuid(b.treinamentoId)) throw new Erro("Treinamento inválido.");
      return { ok: true, atribuidas: await atribuir(String(b.treinamentoId)) };
    }
    case "grupoSalvar": {
      exigir(s.caps.gestao);
      if (!Array.isArray(b.membros) || b.membros.length > 300) throw new Erro("Membros inválidos.");
      const { data, error } = await sb.rpc("ml_ac_grupo_salvar", { p_usuario: s.usuario, p_id: uuid(b.id) ? b.id : null, p_nome: texto(b.nome), p_descricao: texto(b.descricao, 500), p_ativo: b.ativo !== false, p_membros: b.membros.map((m) => texto(m, 100)) });
      if (error) throw error;
      return { id: data };
    }
    // Vínculo conta↔colaborador: só a direção (é quem administra as contas).
    case "vinculosListar": {
      exigir(s.direcao, "Só a direção administra vínculos.");
      const [c, v, p] = await Promise.all([
        sb.from("ml_contas").select("usuario,nome,ativo").order("nome"),
        sb.from("ml_ac_vinculos").select("usuario,pessoa_id"), pessoasRH(),
      ]);
      for (const x of [c, v]) if (x.error) throw x.error;
      return { contas: (c.data ?? []).map((x) => ({ ...x, pessoaId: (v.data ?? []).find((y) => y.usuario === x.usuario)?.pessoa_id ?? "" })), pessoas: p };
    }
    case "vinculoSalvar": {
      exigir(s.direcao, "Só a direção administra vínculos.");
      const { error } = await sb.rpc("ml_ac_vinculo_salvar", { p_usuario: s.usuario, p_conta: texto(b.usuario, 100), p_pessoa: texto(b.pessoaId, 100) });
      if (error) throw error;
      return { ok: true };
    }
    default: throw new Erro("Operação desconhecida.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ erro: "Use POST." }, 405);
  try {
    const a = await autenticar(req, sb, URL_);
    if ("resposta" in a) return a.resposta;
    const b = await req.json().catch(() => ({}));
    return out(await acao(String(b.action ?? ""), b, a.sessao));
  } catch (e) {
    if (e instanceof Erro) return out({ erro: e.message, semPermissao: e.status === 403 }, e.status);
    const x = e as { code?: string; message?: string };
    console.error("ml-academy-gestao", e);
    // P0001 = erro de regra levantado de propósito pelas funções ml_ac_*.
    if (x?.code === "P0001" && x.message) return out({ erro: x.message }, 400);
    if (x?.code === "23505") return out({ erro: "Já existe um registro igual." }, 409);
    return out({ erro: "Não foi possível concluir a operação." }, 500);
  }
});
