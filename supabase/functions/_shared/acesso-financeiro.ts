// Acesso ao financeiro por página (pedido da Ana, 06/11/2026).
//
// Antes, toda função do financeiro aceitava só o crachá da direção. Agora a direção
// libera páginas do financeiro por pessoa na tela Acessos, e cada função pergunta aqui
// se quem chamou pode fazer aquilo.
//
// Regras (falha fechada: qualquer erro nega):
// - Sem crachá, crachá de outro sistema ou vencido → 401.
// - Crachá da direção → libera, exatamente como antes.
// - Demais: lê a conta AO VIVO em ml_contas (não confia no papel do crachá para gravar).
//   Conta inexistente ou desativada → 401.
//   Precisa da matriz (__matriz_v1) e de pelo menos uma das páginas pedidas, com a chave
//   exata (liberar "financas/notas" não libera "financas/notas/emitir").
//   Gravação exige papel "equipe" na conta; "leitura" só consulta.

export const PAGINAS_FINANCEIRO = [
  "financas/visao-geral",
  "financas/servicos-gerados",
  "financas/receber",
  "financas/pagar",
  "financas/bancos",
  "financas/conciliacao",
  "financas/notas",
  "financas/notas/emitir",
  "financas/notas/cancelar",
  "financas/notas/importar-historico",
  "financas/recibos",
  "financas/aplicacoes",
  "financas/socios",
  "financas/conferencia",
  "financas/fluxo-caixa",
  "financas/relatorios",
  "financas/clientes",
  "financas/configuracoes",
  "financas/configuracoes/categorias",
  "financas/configuracoes/contas",
  "financas/configuracoes/centros",
  "financas/configuracoes/formas",
  "financas/configuracoes/plano-contas",
  "financas/configuracoes/omie",
];

// Páginas de visão geral: leem as listas do financeiro sem gravar nada.
export const PAGINAS_VISAO = [
  "financas/visao-geral",
  "financas/relatorios",
  "financas/fluxo-caixa",
  "financas/socios",
  "financas/aplicacoes",
  "financas/conferencia",
];

export type AcessoFinanceiro =
  | { ok: true; usuario: string; direcao: boolean }
  | { ok: false; status: number; erro: string };

const txt = (v: unknown) => String(v ?? "").trim();

export async function acessoFinanceiro(
  sb: any,
  cracha: any,
  paginas: string[],
  escrita: boolean,
): Promise<AcessoFinanceiro> {
  try {
    if (!cracha || typeof cracha !== "object" || cracha.sis !== "minaslab") return { ok: false, status: 401, erro: "Entre no sistema." };
    if (typeof cracha.exp === "number" && cracha.exp < Math.floor(Date.now() / 1000)) return { ok: false, status: 401, erro: "Entre no sistema." };
    const usuario = txt(cracha.sub);
    if (txt(cracha.papel) === "direcao") return { ok: true, usuario, direcao: true };
    if (!usuario || !sb) return { ok: false, status: 401, erro: "Entre no sistema." };
    const { data, error } = await sb.from("ml_contas").select("ativo,papel,paginas_consulta").eq("usuario", usuario).maybeSingle();
    if (error) return { ok: false, status: 403, erro: "Não foi possível conferir seu acesso. Tente de novo." };
    if (!data || data.ativo !== true) return { ok: false, status: 401, erro: "Esta conta foi desativada." };
    const papel = txt(data.papel);
    const permissoes: string[] = Array.isArray(data.paginas_consulta) ? data.paginas_consulta.map(txt) : [];
    const pedidas = Array.isArray(paginas) ? paginas.filter((p) => PAGINAS_FINANCEIRO.includes(p)) : [];
    const liberada = (papel === "equipe" || papel === "leitura")
      && permissoes.includes("__matriz_v1")
      && pedidas.some((p) => permissoes.includes(p));
    if (!liberada) return { ok: false, status: 403, erro: "Esta página do financeiro não está liberada para você. Peça à direção (tela Acessos)." };
    if (escrita && papel !== "equipe") return { ok: false, status: 403, erro: "Seu acesso a esta página é só de consulta." };
    return { ok: true, usuario, direcao: false };
  } catch {
    return { ok: false, status: 403, erro: "Não foi possível conferir seu acesso. Tente de novo." };
  }
}
