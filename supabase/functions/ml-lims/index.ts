// ml-lims — porta de dados do MinasLab LIMS (pasta lims/ do painel).
//
// Os dados moram em tabelas PRÓPRIAS (ml_lims_registros, ml_lims_auditoria,
// ml_lims_contadores), fora de ml_registros: o ml-sync deixa equipe sem matriz
// ler e gravar qualquer coleção daquela tabela, e catálogo, propostas e
// resultados do laboratório não podem passar por essa porta. Aqui o crachá do
// painel é conferido e a conta é lida AO VIVO a cada chamada (mesma régua do
// ml-laboratorio).
//
// Cada gravação deixa rastro na trilha de auditoria (quem, quando, o quê,
// antes e depois) — ISO/IEC 17025 7.5 e 7.11. A trilha só aceita inserção.
//
// Campos cujo nome começa com "senha" (ex.: senhaSmtp) são SÓ DE ESCRITA:
// nunca voltam para o navegador nem para a trilha; gravar vazio mantém a atual.
//
// Piloto: só a direção usa. A liberação por pessoa vem de Configurações →
// Permissões de acesso (coleção "permissoes"), numa etapa seguinte.
//
// Ações: carregar · salvar (numerar: dá o próximo "cod" da coleção ao criar)
//        · salvarLote (vários registros da mesma coleção numa chamada, cada um
//          auditado) · apagar · proximo (quantidade: reserva um bloco de números)
//        · auditoria · contas
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

const T_REG = "ml_lims_registros";
const T_AUD = "ml_lims_auditoria";
const COLECAO_OK = /^[a-z][a-z0-9_]{1,40}$/;
const ID_OK = /^[A-Za-z0-9][\w.:-]{0,79}$/;
const CHAVE_OK = /^(proposta|contrato|os|amostra|laudo|certificado|nc|cliente|solicitante):\d{4}$|^(proposta|contrato|os|amostra|laudo|certificado|nc|cliente|solicitante)$/;
const MAX_REGISTRO = 200_000;
const ehSenha = (k: string) => /^senha/i.test(k);

type Reg = Record<string, unknown>;
class ErroUso extends Error {}

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

// Tira as senhas do que sai do servidor; marca que existe uma gravada.
function semSenhas(r: Reg | null): Reg | null {
  if (!r || typeof r !== "object") return r;
  const o: Reg = {};
  for (const [k, v] of Object.entries(r)) {
    if (ehSenha(k)) { o[`${k}Definida`] = !!v; continue; }
    o[k] = v;
  }
  return o;
}

function oQueMudou(antes: Reg | null, depois: Reg): string {
  if (!antes) return "Criou";
  const ignorar = new Set(["atualizadoEm", "atualizadoPor", "criadoEm", "criadoPor"]);
  const chaves = [...new Set([...Object.keys(antes), ...Object.keys(depois)])].filter((k) => !ignorar.has(k));
  const mudou = chaves.filter((k) => JSON.stringify(antes[k] ?? null) !== JSON.stringify(depois[k] ?? null));
  if (!mudou.length) return "Gravou sem mudanças";
  return `Alterou: ${mudou.slice(0, 12).map((k) => (ehSenha(k) ? `${k} (senha)` : k)).join(", ")}${mudou.length > 12 ? "…" : ""}`;
}

async function lerTudo(colecoes: string[] | null) {
  const out: Record<string, Reg[]> = {};
  for (let de = 0; ; de += 1000) {
    let q = sb.from(T_REG).select("colecao,registro").eq("apagado", false).order("colecao").order("id").range(de, de + 999);
    if (colecoes) q = q.in("colecao", colecoes);
    const { data, error } = await q;
    if (error) throw error;
    for (const l of data ?? []) (out[l.colecao] ??= []).push(semSenhas(l.registro as Reg)!);
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const cracha = await crachaDoPainel(req);
  if (!cracha) return json({ erro: "Sua sessão expirou. Entre de novo.", semSessao: true }, 401);
  try {
    const usuario = txt(cracha.sub);
    const papel = txt(cracha.papel);
    const { data: conta, error: erroConta } = await sb.from("ml_contas").select("nome,ativo").eq("usuario", usuario).maybeSingle();
    if (erroConta) throw erroConta;
    if (conta && conta.ativo !== true) return json({ erro: "Esta conta foi desativada.", semSessao: true }, 401);
    if (papel !== "direcao") return json({ erro: "O LIMS está em piloto e, por enquanto, só a direção usa.", semPermissao: true }, 403);

    const body = await req.json().catch(() => ({}));
    const acao = txt(body.acao);
    const agora = new Date().toISOString();

    if (acao === "carregar") {
      const cols = Array.isArray(body.colecoes) ? body.colecoes.map(txt).filter((c: string) => COLECAO_OK.test(c)) : null;
      const dados = await lerTudo(cols && cols.length ? cols : null);
      return json({ ok: true, dados, eu: { usuario, nome: conta?.nome ?? usuario, papel }, em: agora });
    }

    if (acao === "contas") {
      const { data, error } = await sb.from("ml_contas").select("usuario,nome,papel,ativo").order("nome");
      if (error) throw error;
      return json({ ok: true, contas: data ?? [] });
    }

    if (acao === "proximo") {
      const chave = txt(body.chave);
      if (!CHAVE_OK.test(chave)) return json({ erro: "Numeração desconhecida." }, 400);
      const minimo = Math.max(0, Math.min(Number(body.minimo) || 0, 99_999_999));
      const quantidade = Math.max(1, Math.min(Math.floor(Number(body.quantidade) || 1), 500));
      const numeros: number[] = [];
      for (let i = 0; i < quantidade; i++) {
        const { data, error } = await sb.rpc("ml_lims_proximo", { p_chave: chave, p_minimo: i === 0 ? minimo : 0 });
        if (error) throw error;
        numeros.push(Number(data));
      }
      return json({ ok: true, numero: numeros[0], numeros });
    }

    if (acao === "auditoria") {
      const limite = Math.min(Math.max(Number(body.limite) || 200, 1), 500);
      let q = sb.from(T_AUD).select("id,em,usuario,colecao,registro_id,acao,antes,depois").order("id", { ascending: false }).limit(limite);
      if (txt(body.colecao)) q = q.eq("colecao", txt(body.colecao));
      if (txt(body.registroId)) q = q.eq("registro_id", txt(body.registroId));
      if (Number(body.antesDe) > 0) q = q.lt("id", Number(body.antesDe));
      const { data, error } = await q;
      if (error) throw error;
      return json({ ok: true, itens: data ?? [] });
    }

    const colecao = txt(body.colecao);
    if (!COLECAO_OK.test(colecao)) return json({ erro: "Coleção inválida." }, 400);
    const motivo = txt(body.motivo).slice(0, 500);

    // Grava um registro (cria ou atualiza), com histórico na trilha.
    const gravarUm = async (reg: Reg, numerar: boolean) => {
      if (typeof reg !== "object" || reg === null || Array.isArray(reg)) throw new ErroUso("Registro inválido.");
      if (!txt(reg.id)) reg.id = `${colecao.slice(0, 12)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const id = txt(reg.id);
      if (!ID_OK.test(id)) throw new ErroUso("Identificador inválido.");
      if (JSON.stringify(reg).length > MAX_REGISTRO) throw new ErroUso("Registro grande demais.");
      const { data: atual, error: e1 } = await sb.from(T_REG).select("registro,apagado").eq("colecao", colecao).eq("id", id).maybeSingle();
      if (e1) throw e1;
      const antes = atual && !atual.apagado ? atual.registro as Reg : null;
      // Senha em branco = manter a gravada. Marcadores "...Definida" não se gravam.
      for (const k of Object.keys(reg)) {
        if (/Definida$/.test(k) && ehSenha(k)) delete reg[k];
        else if (ehSenha(k) && !txt(reg[k])) { if (antes?.[k]) reg[k] = antes[k]; else delete reg[k]; }
      }
      // Código sequencial por coleção (a coluna "ID" das listas), dado só na criação.
      if (!antes && numerar && !reg.cod) {
        const { data: n, error: en } = await sb.rpc("ml_lims_proximo", { p_chave: `cad:${colecao}`, p_minimo: 0 });
        if (en) throw en;
        reg.cod = Number(n);
      } else if (antes?.cod) reg.cod = antes.cod;
      const novo: Reg = {
        ...reg, id,
        criadoEm: antes?.criadoEm ?? agora, criadoPor: antes?.criadoPor ?? usuario,
        atualizadoEm: agora, atualizadoPor: usuario,
      };
      const { error: e2 } = await sb.from(T_REG).upsert({ colecao, id, registro: novo, apagado: false, atualizado_em: agora, ...(antes ? {} : { criado_em: agora }) });
      if (e2) throw e2;
      const acaoTexto = oQueMudou(antes, novo) + (motivo ? ` · Motivo: ${motivo}` : "");
      const { error: e3 } = await sb.from(T_AUD).insert({ usuario, colecao, registro_id: id, acao: acaoTexto, antes: semSenhas(antes), depois: semSenhas(novo) });
      if (e3) throw e3;
      return semSenhas(novo);
    };

    if (acao === "salvar") {
      const registro = await gravarUm((body.registro ?? {}) as Reg, body.numerar === true);
      return json({ ok: true, registro });
    }

    if (acao === "salvarLote") {
      const lista = Array.isArray(body.registros) ? body.registros as Reg[] : [];
      if (!lista.length || lista.length > 300) return json({ erro: "Envie de 1 a 300 registros por vez." }, 400);
      const registros = [];
      for (const r of lista) registros.push(await gravarUm(r, body.numerar === true));
      return json({ ok: true, registros });
    }

    if (acao === "apagar") {
      const id = txt(body.id);
      if (!ID_OK.test(id)) return json({ erro: "Identificador inválido." }, 400);
      const { data: atual, error: e1 } = await sb.from(T_REG).select("registro,apagado").eq("colecao", colecao).eq("id", id).maybeSingle();
      if (e1) throw e1;
      if (!atual || atual.apagado) return json({ erro: "Registro não encontrado." }, 404);
      // Lápide, nunca DELETE: o histórico continua consultável.
      const { error: e2 } = await sb.from(T_REG).update({ apagado: true, atualizado_em: agora }).eq("colecao", colecao).eq("id", id);
      if (e2) throw e2;
      const { error: e3 } = await sb.from(T_AUD).insert({ usuario, colecao, registro_id: id, acao: `Excluiu${motivo ? ` · Motivo: ${motivo}` : ""}`, antes: semSenhas(atual.registro as Reg), depois: null });
      if (e3) throw e3;
      return json({ ok: true });
    }

    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    if (e instanceof ErroUso) return json({ erro: e.message }, 400);
    console.error("ml-lims", e);
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
