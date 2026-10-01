// ml-contas — edição do cadastro das contas (tela Acessos) e o padrão de
// nomes em MAIÚSCULAS. Só a direção. A sessão é conferida na porta canônica
// (ml-sync) e o papel de direção é reconferido AO VIVO em ml_contas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const URL = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const T_CONTAS = "ml_contas";
const T_CFG = "ml_config_global";
const T_META = "ml_meta";
const PAPEIS = ["direcao", "equipe", "leitura"];
const PAGINAS_VALIDAS = new Set(["__matriz_v1", "inicio", "calendario", "compromissos", "licitacoes", "marketing", "google-drive", "crm", "gestao-estoque", "gestao-estoque/dashboard", "gestao-estoque/cadastro-insumo", "gestao-estoque/entrada-lote", "gestao-estoque/retirada-baixa", "gestao-estoque/fornecedores", "gestao-estoque/etiquetas", "gestao-estoque/relatorios", "gestao-estoque/configuracoes", "gestao-estoque/pedido-compra", "compras", "compras/estoque", "compras/pedidos", "compras/ordens", "compras/retiradas", "patrimonio", "patrimonio/inventario", "patrimonio/setores", "patrimonio/pendencias", "curva-abc", "curva-abc/clientes", "curva-abc/produtos", "curva-abc/vendedores", "manutencoes", "laboratorio", "financas/servicos-gerados"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const out = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const normalizarUsuario = (s: unknown): string =>
  String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const limparNome = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");

async function lerConfig(): Promise<Record<string, unknown>> {
  const { data, error } = await sb.from(T_CFG).select("config").eq("id", true).maybeSingle();
  if (error) throw error;
  return (data?.config ?? {}) as Record<string, unknown>;
}
const flagMaiusculas = (cfg: Record<string, unknown>) =>
  ((cfg.contas ?? {}) as Record<string, unknown>).nomeMaiusculas === true;

async function bump(colecao: string) {
  const agora = Date.now();
  const { data } = await sb.from(T_META).select("valor").eq("chave", "rev").maybeSingle();
  const atual = (data?.valor as { rev?: number; porColecao?: Record<string, number> }) ?? {};
  await sb.from(T_META).upsert({
    chave: "rev",
    valor: { rev: agora, porColecao: { ...(atual.porColecao ?? {}), [colecao]: agora } },
    atualizado_em: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return out({ erro: "Use POST." }, 405);
  try {
    const auth = req.headers.get("authorization") || "";
    if (!/^Bearer .+/.test(auth)) return out({ erro: "Entre no sistema.", semSessao: true }, 401);
    // A porta canônica verifica assinatura, validade, sistema e conta ativa.
    const sessao = await fetch(`${URL}/functions/v1/ml-sync`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rev" }),
    });
    if (!sessao.ok) return out({ erro: "Sessão inválida ou indisponível.", semSessao: sessao.status === 401 }, sessao.status === 401 ? 401 : 503);
    // deno-lint-ignore no-explicit-any
    let p: any;
    try {
      const parte = auth.slice(7).split(".")[1];
      p = JSON.parse(atob(parte.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return out({ erro: "Sessão inválida.", semSessao: true }, 401);
    }
    if (p.sis !== "minaslab" || !p.sub || !Number.isFinite(p.exp) || p.exp <= Date.now() / 1000) {
      return out({ erro: "Sessão inválida.", semSessao: true }, 401);
    }
    const usuario = String(p.sub);
    if (p.papel !== "direcao") return out({ erro: "Só a direção administra contas.", semPermissao: true }, 403);
    // Reconfere ao vivo: um crachá antigo de direção não vale se o papel mudou.
    const { data: eu, error: erroEu } = await sb.from(T_CONTAS).select("papel,ativo").eq("usuario", usuario).maybeSingle();
    if (erroEu) throw erroEu;
    if (eu && (eu.ativo !== true || eu.papel !== "direcao")) {
      return out({ erro: "Seu papel de acesso foi alterado. Entre novamente.", semSessao: true }, 401);
    }

    // deno-lint-ignore no-explicit-any
    const body: any = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    switch (action) {
      case "padrao": {
        return out({ ok: true, nomeMaiusculas: flagMaiusculas(await lerConfig()) });
      }

      case "editar": {
        const u = normalizarUsuario(body.usuario);
        let nome = limparNome(body.nome);
        const papelNovo = String(body.papel ?? "");
        if (!u || !nome) return out({ erro: "Informe o nome." }, 400);
        if (!PAPEIS.includes(papelNovo)) return out({ erro: `Papel desconhecido: ${papelNovo}` }, 400);
        // A direção não tira o próprio papel: seria trancar a única chave por dentro.
        if (u === usuario && papelNovo !== "direcao") return out({ erro: "Você não pode tirar o papel de Direção da própria conta." }, 400);
        if (flagMaiusculas(await lerConfig())) nome = nome.toLocaleUpperCase("pt-BR");
        const mudancas: Record<string, unknown> = { nome, papel: papelNovo };
        if (body.paginas_consulta !== undefined) {
          const paginas = body.paginas_consulta;
          if (!Array.isArray(paginas) || paginas.some((x: unknown) => !PAGINAS_VALIDAS.has(String(x)))) return out({ erro: "Selecione páginas válidas." }, 400);
          mudancas.paginas_consulta = [...new Set(paginas)];
        }
        const { data, error } = await sb.from(T_CONTAS).update(mudancas).eq("usuario", u).select("usuario,nome,papel,ativo,criado_em,paginas_consulta").maybeSingle();
        if (error) throw error;
        if (!data) return out({ erro: `Não achei a conta "${u}".` }, 404);
        return out({ ok: true, conta: data });
      }

      case "padraoNome": {
        const ligado = body.maiusculas === true;
        const cfg = await lerConfig();
        const contasCfg = { ...((cfg.contas ?? {}) as Record<string, unknown>), nomeMaiusculas: ligado };
        const { error } = await sb.from(T_CFG).upsert({ id: true, config: { ...cfg, contas: contasCfg }, atualizado_em: new Date().toISOString() });
        if (error) throw error;
        await bump("cfg");
        let convertidas = 0;
        if (ligado && body.converterExistentes === true) {
          const { data: todas, error: erroTodas } = await sb.from(T_CONTAS).select("usuario,nome");
          if (erroTodas) throw erroTodas;
          for (const c of todas ?? []) {
            const maiusc = String(c.nome ?? "").toLocaleUpperCase("pt-BR");
            if (maiusc === c.nome) continue;
            const { error: e } = await sb.from(T_CONTAS).update({ nome: maiusc }).eq("usuario", c.usuario);
            if (e) throw e;
            convertidas++;
          }
        }
        return out({ ok: true, nomeMaiusculas: ligado, convertidas });
      }

      default:
        return out({ erro: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    console.error(e);
    return out({ erro: (e as Error)?.message || "Erro inesperado." }, 500);
  }
});
