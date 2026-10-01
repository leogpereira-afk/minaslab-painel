// MinasLab Academy — aprendizagem (colaborador): treinamentos atribuídos, aulas,
// progresso, prova automática, certificados e notificações.
//
// Regras que NÃO se negociam aqui:
//  - a pessoa é sempre a vinculada à conta do crachá (ml_ac_vinculos); nenhum
//    id de pessoa vem do navegador;
//  - nota, aprovação e conclusão nascem só nas funções SQL ml_ac_*;
//  - o gabarito nunca é lido por esta função (as consultas de questões e
//    opções não incluem ml_ac_gabaritos).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { autenticar, CORS, out, pessoasRH, type PessoaRH, type Sessao } from "../_shared/academy-auth.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

class Erro extends Error { constructor(m: string, public status = 400) { super(m); } }

async function pessoaDe(s: Sessao): Promise<PessoaRH | null> {
  if (!s.caps.colaborador) throw new Erro("Você não tem acesso à área do colaborador da Academy.", 403);
  const { data, error } = await sb.from("ml_ac_vinculos").select("pessoa_id").eq("usuario", s.usuario).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const p = (await pessoasRH(sb)).find((x) => x.id === data.pessoa_id);
  if (!p) throw new Erro("Seu cadastro de colaborador não está ativo. Procure o RH.", 409);
  return p;
}
const exigirPessoa = async (s: Sessao) => {
  const p = await pessoaDe(s);
  if (!p) throw new Erro("Sua conta ainda não está vinculada a um colaborador. Peça à direção para vincular.", 409);
  return p;
};

// A atribuição tem de ser DA pessoa; qualquer outra devolve "não encontrado".
async function atribuicaoDe(pessoa: PessoaRH, id: unknown) {
  if (!uuid(id)) throw new Erro("Treinamento inválido.");
  const { data, error } = await sb.from("ml_ac_atribuicoes").select("*").eq("id", id).eq("pessoa_id", pessoa.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Erro("Treinamento não encontrado.", 404);
  return data;
}

// Emite o certificado quando (e só quando) a atribuição está concluída.
async function certificarSeConcluido(s: Sessao, pessoa: PessoaRH, atribuicaoId: string) {
  const { data: a } = await sb.from("ml_ac_atribuicoes").select("status,treinamento_id").eq("id", atribuicaoId).single();
  if (!a || a.status !== "concluida") return null;
  const { data: t } = await sb.from("ml_ac_treinamentos").select("responsavel_pessoa_id").eq("id", a.treinamento_id).single();
  const resp = t?.responsavel_pessoa_id ? (await pessoasRH(sb, { inativos: true })).find((x) => x.id === t.responsavel_pessoa_id)?.nome ?? "" : "";
  const { data, error } = await sb.rpc("ml_ac_certificado_emitir", { p_usuario: s.usuario, p_pessoa: pessoa.id, p_atribuicao: atribuicaoId, p_pessoa_nome: pessoa.nome, p_responsavel_nome: resp });
  if (error) throw error;
  return data as string;
}

function situacao(a: Record<string, unknown>, tentativasEsgotadas: boolean) {
  if (a.status === "concluida") return a.valida_ate && String(a.valida_ate) < hoje() ? "validade_vencida" : "concluida";
  if (a.prazo_em && String(a.prazo_em) < hoje()) return "atrasada";
  if (tentativasEsgotadas) return "tentativas_esgotadas";
  return a.status as string;
}

// Mesmo critério do banco (ml_ac_atribuir), só para MOSTRAR o catálogo; quem
// decide a matrícula é ml_ac_matricular.
function noPublico(p: PessoaRH, publico: { tipo: string; valor: string }[], grupos: Set<string>) {
  const n = (x: string) => x.trim().toLowerCase();
  return publico.some((x) => x.tipo === "todos" || (x.tipo === "colaborador" && x.valor === p.id) || (x.tipo === "setor" && n(x.valor) === n(p.setor))
    || (x.tipo === "cargo" && n(x.valor) === n(p.cargo)) || (x.tipo === "grupo" && grupos.has(x.valor)));
}

async function acao(action: string, b: Record<string, unknown>, s: Sessao) {
  switch (action) {
    case "minha": {
      const pessoa = await pessoaDe(s);
      if (!pessoa) return { semVinculo: true };
      // Aplica o público (novo colaborador, público alterado) antes de listar.
      const { error: ea } = await sb.rpc("ml_ac_atribuir", { p_pessoas: [{ id: pessoa.id, cargo: pessoa.cargo, setor: pessoa.setor }] });
      if (ea) throw ea;
      const { data: atrs, error } = await sb.from("ml_ac_atribuicoes").select("*").eq("pessoa_id", pessoa.id).order("atribuida_em", { ascending: false });
      if (error) throw error;
      const ids = (atrs ?? []).map((a) => a.id), vids = [...new Set((atrs ?? []).map((a) => a.versao_id))], tids = [...new Set((atrs ?? []).map((a) => a.treinamento_id))];
      const vazio = { data: [] as Record<string, unknown>[], error: null };
      const [vs, ts, au, pr, te, ce, no] = await Promise.all([
        vids.length ? sb.from("ml_ac_versoes").select("id,numero,titulo,descricao,modalidade,nota_minima,max_tentativas").in("id", vids) : vazio,
        tids.length ? sb.from("ml_ac_treinamentos").select("id,categoria_id,status").in("id", tids) : vazio,
        vids.length ? sb.from("ml_ac_aulas").select("id,versao_id").in("versao_id", vids) : vazio,
        ids.length ? sb.from("ml_ac_progresso").select("atribuicao_id,aula_id,concluida_em").in("atribuicao_id", ids) : vazio,
        ids.length ? sb.from("ml_ac_tentativas").select("atribuicao_id,numero,nota,aprovado,enviada_em").in("atribuicao_id", ids).order("numero") : vazio,
        sb.from("ml_ac_certificados").select("id,atribuicao_id,codigo").eq("pessoa_id", pessoa.id),
        sb.from("ml_ac_notificacoes").select("id", { count: "exact", head: true }).eq("pessoa_id", pessoa.id).is("lida_em", null),
      ]);
      for (const x of [vs, ts, au, pr, te, ce, no]) if (x.error) throw x.error;
      const lista = (atrs ?? []).map((a) => {
        const v = (vs.data ?? []).find((x) => x.id === a.versao_id) ?? {};
        const total = (au.data ?? []).filter((x) => x.versao_id === a.versao_id).length;
        const feitas = (pr.data ?? []).filter((x) => x.atribuicao_id === a.id && x.concluida_em).length;
        const tents = (te.data ?? []).filter((x) => x.atribuicao_id === a.id && x.enviada_em);
        const esgot = v.modalidade === "automatica" && !tents.some((x) => x.aprovado) && tents.length >= Number(v.max_tentativas ?? 0);
        return { id: a.id, treinamentoId: a.treinamento_id, titulo: v.titulo, versao: v.numero, categoriaId: (ts.data ?? []).find((x) => x.id === a.treinamento_id)?.categoria_id,
          modalidade: v.modalidade, obrigatorio: a.obrigatorio, prazoEm: a.prazo_em, validaAte: a.valida_ate, concluidaEm: a.concluida_em, status: a.status, situacao: situacao(a, esgot),
          aulasTotal: total, aulasFeitas: feitas, tentativasUsadas: tents.length, maxTentativas: v.max_tentativas ?? null,
          ultimaNota: tents.length ? tents[tents.length - 1].nota : null, aprovado: tents.some((x) => x.aprovado),
          certificadoId: (ce.data ?? []).find((x) => x.atribuicao_id === a.id)?.id ?? null };
      });
      return { pessoa: { nome: pessoa.nome }, atribuicoes: lista, naoLidas: no.count ?? 0, hoje: hoje() };
    }
    case "catalogo": {
      const pessoa = await exigirPessoa(s);
      const { data: ts, error } = await sb.from("ml_ac_treinamentos").select("id,categoria_id").eq("status", "publicado");
      if (error) throw error;
      const ids = (ts ?? []).map((t) => t.id);
      if (!ids.length) return { treinamentos: [] };
      const [vs, pu, gm, at, cat] = await Promise.all([
        sb.from("ml_ac_versoes").select("treinamento_id,numero,titulo,descricao,modalidade,obrigatorio,validade_meses").in("treinamento_id", ids).eq("status", "publicada"),
        sb.from("ml_ac_publico").select("treinamento_id,tipo,valor").in("treinamento_id", ids),
        sb.from("ml_ac_grupo_membros").select("grupo_id,ml_ac_grupos!inner(ativo)").eq("pessoa_id", pessoa.id).eq("ml_ac_grupos.ativo", true),
        sb.from("ml_ac_atribuicoes").select("id,treinamento_id").eq("pessoa_id", pessoa.id),
        sb.from("ml_ac_categorias").select("id,nome"),
      ]);
      for (const x of [vs, pu, gm, at, cat]) if (x.error) throw x.error;
      const grupos = new Set((gm.data ?? []).map((g) => String(g.grupo_id)));
      const lista = (ts ?? []).flatMap((t) => {
        const v = (vs.data ?? []).find((x) => x.treinamento_id === t.id);
        const publico = (pu.data ?? []).filter((x) => x.treinamento_id === t.id);
        const minha = (at.data ?? []).find((x) => x.treinamento_id === t.id);
        if (!v || !(minha || publico.length === 0 || noPublico(pessoa, publico, grupos))) return [];
        return [{ treinamentoId: t.id, titulo: v.titulo, descricao: v.descricao, categoria: (cat.data ?? []).find((c) => c.id === t.categoria_id)?.nome ?? "", modalidade: v.modalidade,
          obrigatorio: v.obrigatorio, validadeMeses: v.validade_meses, atribuicaoId: minha?.id ?? null }];
      });
      return { treinamentos: lista };
    }
    case "catalogoMatricular": {
      const pessoa = await exigirPessoa(s);
      if (!uuid(b.treinamentoId)) throw new Erro("Treinamento inválido.");
      const { data, error } = await sb.rpc("ml_ac_matricular", { p_usuario: s.usuario, p_pessoa: { id: pessoa.id, cargo: pessoa.cargo, setor: pessoa.setor }, p_treinamento: b.treinamentoId });
      if (error) throw error;
      return { atribuicaoId: data };
    }
    case "treinamentoAbrir": {
      const pessoa = await exigirPessoa(s);
      const a = await atribuicaoDe(pessoa, b.atribuicaoId);
      const [v, mod, aul, mat, pro, ten, que, cer] = await Promise.all([
        sb.from("ml_ac_versoes").select("numero,titulo,descricao,modalidade,nota_minima,max_tentativas,validade_meses").eq("id", a.versao_id).single(),
        sb.from("ml_ac_modulos").select("id,ordem,titulo,descricao").eq("versao_id", a.versao_id).order("ordem"),
        sb.from("ml_ac_aulas").select("id,modulo_id,ordem,titulo,tipo,conteudo,duracao_min").eq("versao_id", a.versao_id).order("ordem"),
        sb.from("ml_ac_materiais").select("titulo,url").eq("versao_id", a.versao_id).order("ordem"),
        sb.from("ml_ac_progresso").select("aula_id,concluida_em,resposta").eq("atribuicao_id", a.id),
        sb.from("ml_ac_tentativas").select("numero,nota,aprovado,iniciada_em,enviada_em").eq("atribuicao_id", a.id).order("numero"),
        sb.from("ml_ac_questoes").select("id", { count: "exact", head: true }).eq("versao_id", a.versao_id),
        sb.from("ml_ac_certificados").select("id,codigo").eq("atribuicao_id", a.id).maybeSingle(),
      ]);
      for (const x of [v, mod, aul, mat, pro, ten, que, cer]) if (x.error) throw x.error;
      const feito = new Map((pro.data ?? []).map((p) => [p.aula_id, p]));
      const modulos = (mod.data ?? []).map((m) => ({ id: m.id, titulo: m.titulo, descricao: m.descricao,
        aulas: (aul.data ?? []).filter((x) => x.modulo_id === m.id).map((x) => ({ id: x.id, titulo: x.titulo, tipo: x.tipo, conteudo: x.conteudo, duracaoMin: x.duracao_min,
          concluida: !!feito.get(x.id)?.concluida_em, resposta: feito.get(x.id)?.resposta ?? "" })) }));
      const enviadas = (ten.data ?? []).filter((t) => t.enviada_em);
      return { atribuicao: { id: a.id, status: a.status, prazoEm: a.prazo_em, obrigatorio: a.obrigatorio, ultimaAulaId: a.ultima_aula_id, concluidaEm: a.concluida_em, validaAte: a.valida_ate },
        versao: v.data, modulos, materiais: mat.data ?? [], certificado: cer.data ?? null,
        prova: { existe: v.data!.modalidade === "automatica" && (que.count ?? 0) > 0, questoes: que.count ?? 0, usadas: enviadas.length, maxTentativas: v.data!.max_tentativas,
          notaMinima: v.data!.nota_minima, aprovado: enviadas.some((t) => t.aprovado), aberta: (ten.data ?? []).some((t) => !t.enviada_em), historico: enviadas } };
    }
    case "aulaRegistrar": {
      const pessoa = await exigirPessoa(s);
      const a = await atribuicaoDe(pessoa, b.atribuicaoId);
      if (!uuid(b.aulaId)) throw new Erro("Aula inválida.");
      const { error } = await sb.rpc("ml_ac_aula_registrar", { p_usuario: s.usuario, p_pessoa: pessoa.id, p_atribuicao: a.id, p_aula: b.aulaId, p_concluir: b.concluir === true,
        p_resposta: typeof b.resposta === "string" ? b.resposta.slice(0, 10000) : null });
      if (error) throw error;
      const cert = b.concluir === true ? await certificarSeConcluido(s, pessoa, a.id) : null;
      const { data: atual } = await sb.from("ml_ac_atribuicoes").select("status").eq("id", a.id).single();
      return { ok: true, status: atual?.status, certificadoId: cert };
    }
    case "tentativaIniciar": {
      const pessoa = await exigirPessoa(s);
      const a = await atribuicaoDe(pessoa, b.atribuicaoId);
      const { data, error } = await sb.rpc("ml_ac_tentativa_iniciar", { p_usuario: s.usuario, p_pessoa: pessoa.id, p_atribuicao: a.id });
      if (error) throw error;
      // Questões SEM gabarito e SEM feedback (o feedback só vem depois do envio).
      const [q, o] = await Promise.all([
        sb.from("ml_ac_questoes").select("id,ordem,tipo,enunciado").eq("versao_id", a.versao_id).order("ordem"),
        sb.from("ml_ac_opcoes").select("id,questao_id,ordem,texto").eq("versao_id", a.versao_id).order("ordem"),
      ]);
      if (q.error) throw q.error; if (o.error) throw o.error;
      return { ...data, questoes: (q.data ?? []).map((x) => ({ id: x.id, tipo: x.tipo, enunciado: x.enunciado,
        opcoes: (o.data ?? []).filter((y) => y.questao_id === x.id).map((y) => ({ id: y.id, texto: y.texto })) })) };
    }
    case "tentativaEnviar": {
      const pessoa = await exigirPessoa(s);
      if (!uuid(b.tentativaId) || !Array.isArray(b.respostas) || b.respostas.length > 200) throw new Erro("Respostas inválidas.");
      const { data, error } = await sb.rpc("ml_ac_tentativa_enviar", { p_usuario: s.usuario, p_pessoa: pessoa.id, p_tentativa: b.tentativaId, p_respostas: b.respostas });
      if (error) throw error;
      let certificadoId: string | null = null;
      if (data?.aprovado) {
        const { data: t } = await sb.from("ml_ac_tentativas").select("atribuicao_id").eq("id", b.tentativaId).single();
        if (t) certificadoId = await certificarSeConcluido(s, pessoa, t.atribuicao_id);
      }
      return { ...data, certificadoId };
    }
    case "certificados": {
      const pessoa = await exigirPessoa(s);
      const { data, error } = await sb.from("ml_ac_certificados").select("id,codigo,treinamento_titulo,versao_numero,emitido_em").eq("pessoa_id", pessoa.id).order("emitido_em", { ascending: false });
      if (error) throw error;
      return { certificados: data ?? [] };
    }
    case "certificadoObter": {
      const pessoa = await exigirPessoa(s);
      if (!uuid(b.id)) throw new Erro("Certificado inválido.");
      const { data, error } = await sb.from("ml_ac_certificados").select("*").eq("id", b.id).eq("pessoa_id", pessoa.id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Erro("Certificado não encontrado.", 404);
      return { certificado: data };
    }
    case "notificacoes": {
      const pessoa = await exigirPessoa(s);
      const { data, error } = await sb.from("ml_ac_notificacoes").select("id,tipo,titulo,corpo,link,criada_em,lida_em").eq("pessoa_id", pessoa.id).order("criada_em", { ascending: false }).limit(30);
      if (error) throw error;
      return { notificacoes: data ?? [] };
    }
    case "notificacaoLer": {
      const pessoa = await exigirPessoa(s);
      let q = sb.from("ml_ac_notificacoes").update({ lida_em: new Date().toISOString() }).eq("pessoa_id", pessoa.id).is("lida_em", null);
      if (uuid(b.id)) q = q.eq("id", b.id);
      const { error } = await q;
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
    console.error("ml-academy", e);
    if (x?.code === "P0001" && x.message) return out({ erro: x.message }, 400);
    return out({ erro: "Não foi possível concluir a operação." }, 500);
  }
});
