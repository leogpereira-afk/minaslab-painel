// Autorização da MinasLab Academy. Mesma régua do ml-patrimonio: o crachá é
// conferido pelo ml-sync (assinatura, validade, conta ativa) e as permissões
// são RELIDAS do banco a cada chamada — retirar acesso vale na hora.
//
// Chaves da matriz (paginas_consulta) da Academy — nomes planos, de propósito:
// o módulo "academy" NÃO herda as demais (quem tem só a base não administra).
//   academy-gestao     criar/editar/publicar treinamentos e públicos
//   academy-qualidade  validar conteúdo técnico, versões e carga horária
//   academy            área do colaborador (etapas seguintes)
//   academy-gestor     avaliações práticas da equipe (etapas seguintes)
//   academy-matriz     matriz de competências e indicadores (etapas seguintes)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const out = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export type Sessao = {
  usuario: string; nome: string; direcao: boolean;
  caps: { gestao: boolean; qualidade: boolean; colaborador: boolean; gestor: boolean; matriz: boolean };
};

export async function autenticar(req: Request, sb: SupabaseClient, supabaseUrl: string): Promise<{ sessao: Sessao } | { resposta: Response }> {
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer .+/.test(auth)) return { resposta: out({ erro: "Entre no sistema.", semSessao: true }, 401) };
  const r = await fetch(`${supabaseUrl}/functions/v1/ml-sync`, {
    method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify({ action: "rev" }),
  });
  if (!r.ok) return { resposta: out({ erro: "Sessão inválida ou indisponível.", semSessao: r.status === 401 }, r.status === 401 ? 401 : 503) };
  let p: Record<string, unknown>;
  try { p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); }
  catch { return { resposta: out({ erro: "Sessão inválida.", semSessao: true }, 401) }; }
  if (p.sis !== "minaslab" || !p.sub || !Number.isFinite(p.exp) || (p.exp as number) <= Date.now() / 1000)
    return { resposta: out({ erro: "Sessão inválida.", semSessao: true }, 401) };
  const usuario = String(p.sub);
  const { data: conta, error } = await sb.from("ml_contas").select("nome,papel,ativo,paginas_consulta").eq("usuario", usuario).maybeSingle();
  if (error || !conta || conta.ativo !== true) return { resposta: out({ erro: "Não foi possível confirmar sua permissão.", semPermissao: true }, 403) };
  const direcao = conta.papel === "direcao"; // papel relido do banco, não do crachá
  const paginas: string[] = Array.isArray(conta.paginas_consulta) ? conta.paginas_consulta : [];
  const matriz = paginas.includes("__matriz_v1");
  const tem = (k: string) => direcao || (matriz && paginas.includes(k));
  return { sessao: { usuario, nome: String(conta.nome ?? usuario), direcao, caps: {
    gestao: tem("academy-gestao"), qualidade: tem("academy-qualidade"), colaborador: tem("academy"), gestor: tem("academy-gestor"), matriz: tem("academy-matriz"),
  } } };
}

export type PessoaRH = { id: string; nome: string; cargo: string; setor: string; ativo: boolean };

// Colaboradores do RH: só o mínimo (sem CPF, salário etc.).
export async function pessoasRH(sb: SupabaseClient, { inativos = false } = {}): Promise<PessoaRH[]> {
  const { data, error } = await sb.from("ml_registros").select("registro,apagado").eq("colecao", "rh_pessoas");
  if (error) throw error;
  return (data ?? []).filter((r) => !r.apagado).map((r) => r.registro as Record<string, unknown>)
    .map((p) => ({ id: String(p.id), nome: String(p.nome ?? ""), cargo: String(p.cargo ?? ""), setor: String(p.setor ?? ""), ativo: p.ativo !== false }))
    .filter((p) => inativos || p.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
