import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const J = Deno.env.get("ML_JWT_SECRET") || "";
const sb = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder();
const dec = new TextDecoder();
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const txt = (v: any) => String(v ?? "").trim();
const num = (v: any) => Number(v || 0);

function b64u(s: string) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }
async function auth(req: Request) { const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); if (!t || !J) return null; const p = t.split("."); if (p.length !== 3) return null; try { const k = await crypto.subtle.importKey("raw", enc.encode(J), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]); if (!await crypto.subtle.verify("HMAC", k, b64u(p[2]), enc.encode(`${p[0]}.${p[1]}`))) return null; const x = JSON.parse(dec.decode(b64u(p[1]))); if (x.sis !== "minaslab" || (x.exp && x.exp < Math.floor(Date.now() / 1000)) || txt(x.papel) !== "direcao") return null; return x; } catch { return null; } }
function pag(b: any) { const limite = Math.min(100, Math.max(10, Number(b.limite) || 25)), pagina = Math.max(1, Number(b.pagina) || 1), ini = (pagina - 1) * limite; return { limite, pagina, ini, fim: ini + limite - 1 }; }
function periodoMes(b: any) { let de = txt(b.de), ate = txt(b.ate); const ano = Number(b.ano), mes = Number(b.mes); if (!de && !ate && ano && mes >= 1 && mes <= 12) { const mm = String(mes).padStart(2, "0"), ultimo = new Date(ano, mes, 0).getDate(); de = `${ano}-${mm}-01`; ate = `${ano}-${mm}-${String(ultimo).padStart(2, "0")}`; } else if (!de && !ate && ano && !mes) { de = `${ano}-01-01`; ate = `${ano}-12-31`; } return { de, ate }; }
function buscaLike(v: string) { return v.replace(/[%_]/g, m => `\\${m}`); }

function filtrosBase(q: any, a: string, empresa: string, status: string, busca: string, de: string, ate: string, contaId = "") {
  if (empresa) q = q.eq("empresa_id", empresa);
  if (a === "movimentos" && contaId) q = q.eq("conta_bancaria_id", contaId);
  if (a === "recebimentos" || a === "despesas") {
    if (status) q = q.eq("status", status);
    if (de) q = q.gte("data_vencimento", de);
    if (ate) q = q.lte("data_vencimento", ate);
  } else if (a === "notas") {
    if (status) q = q.eq("status_fiscal", status);
    if (de) q = q.gte("data_emissao", de);
    if (ate) q = q.lte("data_emissao", ate);
  } else if (a === "movimentos") {
    if (status === "CONCILIADO") q = q.eq("conciliado", true);
    else if (status === "PENDENTE") q = q.eq("conciliado", false);
    if (de) q = q.gte("data_movimento", de);
    if (ate) q = q.lte("data_movimento", ate);
  }
  if (busca) {
    const s = buscaLike(busca);
    if (a === "recebimentos") q = q.or(`cliente.ilike.%${s}%,cnpj_cpf.ilike.%${s}%,descricao.ilike.%${s}%,numero_nf.ilike.%${s}%`);
    else if (a === "despesas") q = q.or(`fornecedor.ilike.%${s}%,cnpj_cpf.ilike.%${s}%,descricao.ilike.%${s}%`);
    else if (a === "notas") q = q.or(`numero_nf.ilike.%${s}%,nome_emitente.ilike.%${s}%,nome_destinatario.ilike.%${s}%,cnpj_emitente.ilike.%${s}%,cnpj_destinatario.ilike.%${s}%`);
    else if (a === "movimentos") q = q.or(`descricao.ilike.%${s}%,documento.ilike.%${s}%,fitid.ilike.%${s}%`);
  }
  return q;
}

async function resumo(a: string, empresa: string, status: string, busca: string, de: string, ate: string, contaId = "") {
  let q: any;
  if (a === "recebimentos") q = sb.from("recebimentos").select("valor_previsto,valor_recebido,valor_pendente,status").eq("apagado", false);
  else if (a === "despesas") q = sb.from("despesas").select("valor_original,valor_pago,valor_pendente,status").eq("apagado", false);
  else if (a === "notas") q = sb.from("notas_fiscais").select("valor_total,pdf_url,xml_url,status_fiscal,origem").eq("apagado", false);
  else if (a === "movimentos") q = sb.from("movimentos_bancarios").select("tipo,valor,conciliado");
  else return null;
  q = filtrosBase(q, a, empresa, status, busca, de, ate, contaId);
  const r = await q;
  if (r.error) throw r.error;
  const d = r.data || [];
  if (a === "recebimentos") return d.reduce((s: any, x: any) => ({ previsto: s.previsto + num(x.valor_previsto), recebido: s.recebido + num(x.valor_recebido), pendente: s.pendente + num(x.valor_pendente) }), { previsto: 0, recebido: 0, pendente: 0 });
  if (a === "despesas") return d.reduce((s: any, x: any) => ({ total: s.total + num(x.valor_original), pago: s.pago + num(x.valor_pago), pendente: s.pendente + num(x.valor_pendente) }), { total: 0, pago: 0, pendente: 0 });
  if (a === "notas") return d.reduce((s: any, x: any) => { const origem = String(x.origem || "").toUpperCase(); const exigePdfLocal = origem !== "OMIE"; return ({ total: s.total + 1, valor: s.valor + num(x.valor_total), comPdf: s.comPdf + (x.pdf_url ? 1 : 0), semPdf: s.semPdf + (!x.pdf_url && exigePdfLocal ? 1 : 0), comXml: s.comXml + (x.xml_url ? 1 : 0), autorizadas: s.autorizadas + (String(x.status_fiscal || "").toUpperCase() === "AUTORIZADA" ? 1 : 0), canceladas: s.canceladas + (String(x.status_fiscal || "").toUpperCase() === "CANCELADA" ? 1 : 0) }); }, { total: 0, valor: 0, comPdf: 0, semPdf: 0, comXml: 0, autorizadas: 0, canceladas: 0 });
  return d.reduce((s: any, x: any) => { const v = Math.abs(num(x.valor)); if (String(x.tipo).toUpperCase() === "CREDITO") s.entradas += v; else s.saidas += v; if (x.conciliado) s.conciliados++; else s.pendentes++; return s; }, { entradas: 0, saidas: 0, conciliados: 0, pendentes: 0 });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!await auth(req)) return json({ erro: "Sessão inválida ou sem permissão." }, 401);
  try {
    const b = await req.json(), a = txt(b.action), { limite, pagina, ini, fim } = pag(b), { de, ate } = periodoMes(b), empresa = txt(b.empresaId), contaId = txt(b.contaId), status = txt(b.status).toUpperCase(), busca = txt(b.busca);
    let q: any;
    if (a === "recebimentos") q = sb.from("recebimentos").select("*,empresa:empresas(id,nome),categoria:categorias_financeiras(id,nome),conta_bancaria:contas_bancarias(id,nome),baixas:baixas_recebimentos(*)", { count: "exact" }).eq("apagado", false);
    else if (a === "despesas") q = sb.from("despesas").select("*,empresa:empresas(id,nome),categoria:categorias_financeiras(id,nome),conta_bancaria:contas_bancarias(id,nome),centro:centros_custo(id,nome),baixas:baixas_despesas(*)", { count: "exact" }).eq("apagado", false);
    else if (a === "notas") q = sb.from("notas_fiscais").select("*,empresa:empresas(id,nome)", { count: "exact" }).eq("apagado", false);
    else if (a === "movimentos") q = sb.from("movimentos_bancarios").select("*,empresa:empresas(id,nome),conta:contas_bancarias(id,nome),conciliacoes(*)", { count: "exact" });
    else if (a === "clientes") {
      q = sb.from("clientes_financeiro").select("*", { count: "exact" });
      if (status === "ATIVO") q = q.eq("ativo", true); else if (status === "INATIVO") q = q.eq("ativo", false);
      if (busca) { const s = buscaLike(busca); q = q.or(`nome.ilike.%${s}%,nome_fantasia.ilike.%${s}%,cnpj_cpf.ilike.%${s}%`); }
      q = q.order("nome", { ascending: true });
      const r = await q.range(ini, fim); if (r.error) throw r.error; const total = Number(r.count || 0); return json({ itens: r.data || [], pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)), de, ate });
    } else return json({ erro: "Ação inválida." }, 400);

    q = filtrosBase(q, a, empresa, status, busca, de, ate, contaId);
    if (a === "recebimentos" || a === "despesas") q = q.order("data_vencimento", { ascending: false, nullsFirst: false });
    else if (a === "notas") q = q.order("data_emissao", { ascending: false, nullsFirst: false });
    else q = q.order("data_movimento", { ascending: false });

    const [r, cards] = await Promise.all([q.range(ini, fim), resumo(a, empresa, status, busca, de, ate, contaId)]);
    if (r.error) throw r.error;
    const total = Number(r.count || 0);
    return json({ itens: r.data || [], pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)), de, ate, resumo: cards });
  } catch (e) { return json({ erro: e instanceof Error ? e.message : String(e) }, 500); }
});