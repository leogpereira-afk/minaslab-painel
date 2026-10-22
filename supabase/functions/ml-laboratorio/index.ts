// ml-laboratorio — porta de dados do módulo Laboratório (hoje: Entradas de amostras).
// Os registros moram em ml_registros (colecao "lab_entradas"), como o resto do painel,
// mas passam por aqui: crachá conferido, conta ativa e permissão "laboratorio" lidos
// AO VIVO a cada chamada (mesma régua do ml-sync), e cada gravação deixa rastro
// (quem, quando, o quê) no próprio registro — exigência de rastreabilidade de laboratório.
//
// Ações: listar · salvar (um registro) · lote (liberar | descartar vários de uma vez) · apagar (lápide)
//        · importar (direção) · setores / setoresSalvar (direção define quem é Administrativo e quem é Laboratório).
//
// SETORES: cada campo pertence a um setor (mesma lista de src/lib/laboratorioEntradas.js).
// Administrativo lança OS, amostras, recebimento, responsáveis, tipo, imediato e origem;
// Laboratório lança retirada, finalizações, liberação e descarte (provedor: retirada também pelo Administrativo). Observação: os dois.
// A direção edita tudo. Quem não está em setor nenhum só consulta.
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
const COLECAO = "lab_entradas";
const PAGINA = "laboratorio";
const MAX_HISTORICO = 60;
const DATA_OK = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/;
const CAMPOS_SETOR: Record<string, string[]> = {
  administrativo: ["os", "amostras", "recebidoEm", "recebidoPor", "tipos", "parametroImediato", "origem", "retiradoPor", "cancelada"],
  laboratorio: ["retiradaLabEm", "retiradaComercialEm", "finalizadoLab", "finalizadoMb", "finalizadoMbEm", "finalizadoFq", "finalizadoFqEm", "liberadoCliente", "liberadoEm", "descartado", "descartadoEm"],
  ambos: ["observacao"],
  // Etapa fixada à mão: exige os DOIS setores (a direção tem os dois).
  todos: ["etapaManual"],
};
const ETAPAS_OK = ["", "RECEBIDA", "EM_ANALISE", "FINALIZADA", "LIBERADA", "DESCARTE_PENDENTE", "DESCARTADA", "CANCELADA"];
const comparavel = (v: unknown) => Array.isArray(v) ? JSON.stringify(v) : (v === null || v === undefined || v === false || v === "") ? "" : String(v).trim();
function camposBloqueados(antes: Record<string, unknown> | null, depois: Record<string, unknown>, setores: string[]) {
  const todos = [...CAMPOS_SETOR.administrativo, ...CAMPOS_SETOR.laboratorio, ...CAMPOS_SETOR.ambos, ...CAMPOS_SETOR.todos];
  return todos.filter((c) => comparavel(antes?.[c]) !== comparavel(depois?.[c])).filter((c) => {
    if (CAMPOS_SETOR.todos.includes(c)) return !(setores.includes("administrativo") && setores.includes("laboratorio"));
    // Amostra de PROVEDOR: a retirada é do Administrativo (o Laboratório também pode lançar).
    const provedor = Array.isArray(depois?.origem) && (depois.origem as unknown[]).some((o) => String(o).toUpperCase() === "PROVEDOR");
    const s = provedor && ["retiradaLabEm", "retiradaComercialEm"].includes(c) ? "ambos"
      : CAMPOS_SETOR.administrativo.includes(c) ? "administrativo" : CAMPOS_SETOR.laboratorio.includes(c) ? "laboratorio" : "ambos";
    return s === "ambos" ? !setores.length : !setores.includes(s);
  });
}
async function lerSetores(): Promise<{ administrativo: string[]; laboratorio: string[] }> {
  const { data } = await sb.from("ml_registros").select("registro").eq("colecao", "lab_config").eq("id", "setores").maybeSingle();
  const r = (data?.registro ?? {}) as { administrativo?: string[]; laboratorio?: string[] };
  return { administrativo: Array.isArray(r.administrativo) ? r.administrativo : [], laboratorio: Array.isArray(r.laboratorio) ? r.laboratorio : [] };
}

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

// Mesmo carimbo de versão do ml-sync: a tela usa o "rev" da coleção para saber se baixa de novo.
async function bump() {
  const agora = Date.now();
  const { data } = await sb.from("ml_meta").select("valor").eq("chave", "rev").maybeSingle();
  const atual = (data?.valor as { porColecao?: Record<string, number> }) ?? {};
  await sb.from("ml_meta").upsert({ chave: "rev", valor: { rev: agora, porColecao: { ...(atual.porColecao ?? {}), [COLECAO]: agora } }, atualizado_em: new Date().toISOString() });
}

const CAMPOS_DATA = ["recebidoEm", "retiradaLabEm", "retiradaComercialEm", "finalizadoMbEm", "finalizadoFqEm", "liberadoEm", "descartadoEm"];
const ROTULOS: Record<string, string> = {
  os: "OS", amostras: "amostras", recebidoEm: "recebimento", recebidoPor: "recebido por", tipos: "tipo", parametroImediato: "parâmetro imediato",
  origem: "interno/provedor", retiradoPor: "retirado por", retiradaLabEm: "retirada lab.", retiradaComercialEm: "retirada comercial",
  finalizadoLab: "finalizado", finalizadoMb: "finalizado MB", finalizadoMbEm: "final. MB", finalizadoFq: "finalizado FQ", finalizadoFqEm: "final. FQ", liberadoCliente: "liberado", liberadoEm: "liberação",
  descartado: "descartado", descartadoEm: "data descarte", cancelada: "cancelada", observacao: "observação",
  etapaManual: "etapa (ajuste manual)",
};
function oQueMudou(antes: Record<string, unknown> | null, depois: Record<string, unknown>) {
  if (!antes) return "Entrada criada";
  const m = Object.keys(ROTULOS).filter((c) => JSON.stringify(antes[c] ?? null) !== JSON.stringify(depois[c] ?? null)).map((c) => ROTULOS[c]);
  return m.length ? `Alterou: ${m.join(", ")}` : "Gravou sem mudanças";
}
function conferir(r: Record<string, unknown>) {
  if (!txt(r.os)) return "Informe o número da OS.";
  if (!txt(r.recebidoEm)) return "Informe a data de recebimento.";
  for (const c of CAMPOS_DATA) if (!DATA_OK.test(txt(r[c]))) return `Data inválida em ${ROTULOS[c] ?? c}.`;
  if (!ETAPAS_OK.includes(txt(r.etapaManual))) return "Etapa inválida.";
  for (const c of ["finalizadoMb", "finalizadoFq"]) if (!["", "SIM", "NAO", "NA"].includes(txt(r[c]))) return `Valor inválido em ${ROTULOS[c]}.`;
  for (const c of ["recebidoPor", "tipos", "origem", "retiradoPor"]) if (r[c] != null && !Array.isArray(r[c])) return `Campo ${ROTULOS[c]} inválido.`;
  if (JSON.stringify(r).length > 20000) return "Registro grande demais.";
  return "";
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
    // Conta que não existe no banco: só a mestra (bootstrap), que é direção — mesma regra do ml-sync.
    if (conta && conta.ativo !== true) return json({ erro: "Esta conta foi desativada.", semSessao: true }, 401);
    const direcao = papel === "direcao";
    const perms: string[] = Array.isArray(conta?.paginas_consulta) ? conta!.paginas_consulta : [];
    const matriz = perms.includes("__matriz_v1");
    const podeLer = direcao || !matriz || perms.includes(PAGINA);
    const podeEscreverPagina = direcao || (papel === "equipe" && (!matriz || perms.includes(PAGINA)));
    if (!podeLer) return json({ erro: "Seu acesso não inclui o Laboratório.", semPermissao: true }, 403);
    const cfgSetores = await lerSetores();
    const meusSetores = direcao ? ["administrativo", "laboratorio"]
      : !podeEscreverPagina ? [] : ["administrativo", "laboratorio"].filter((s) => (cfgSetores as Record<string, string[]>)[s].includes(usuario));
    const podeEscrever = meusSetores.length > 0;

    const body = await req.json().catch(() => ({}));
    const acao = txt(body.acao);

    if (acao === "listar") {
      const itens: unknown[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await sb.from("ml_registros").select("registro").eq("colecao", COLECAO).eq("apagado", false).order("id").range(de, de + 999);
        if (error) throw error;
        for (const l of data ?? []) itens.push(l.registro);
        if (!data || data.length < 1000) break;
      }
      // Pessoas do sistema (Recebido por / Retirado por) e quem está em cada setor (para sugerir no formulário).
      const { data: contas } = await sb.from("ml_contas").select("usuario,nome,ativo").order("nome");
      return json({ ok: true, itens, podeEditar: podeEscrever, setores: meusSetores, pessoas: contas ?? [], setoresConfig: cfgSetores });
    }

    if (acao === "setores" || acao === "setoresSalvar") {
      if (!direcao) return json({ erro: "Só a direção define os setores.", semPermissao: true }, 403);
      if (acao === "setoresSalvar") {
        const limpa = (v: unknown) => Array.isArray(v) ? [...new Set(v.map(txt).filter(Boolean))].slice(0, 200) : [];
        const reg = { id: "setores", administrativo: limpa(body.administrativo), laboratorio: limpa(body.laboratorio), atualizadoPor: usuario, atualizadoEm: new Date().toISOString() };
        const { error } = await sb.from("ml_registros").upsert({ colecao: "lab_config", id: "setores", registro: reg, apagado: false, atualizado_em: reg.atualizadoEm });
        if (error) throw error;
        return json({ ok: true, ...reg });
      }
      const { data: contas, error } = await sb.from("ml_contas").select("usuario,nome,papel,ativo").order("nome");
      if (error) throw error;
      return json({ ok: true, ...cfgSetores, contas: (contas ?? []).filter((c: { ativo: boolean }) => c.ativo) });
    }

    if (!podeEscrever) return json({ erro: "Seu usuário não está em nenhum setor do Laboratório (Administrativo ou Laboratório). Peça à direção para incluir.", semPermissao: true }, 403);
    const recusa = (campos: string[]) => json({ erro: `Seu setor não edita: ${campos.map((c) => ROTULOS[c] ?? c).join(", ")}.`, semPermissao: true, campos }, 403);
    const agora = new Date().toISOString();

    const gravar = async (reg: Record<string, unknown>, acaoTexto?: string) => {
      const id = txt(reg.id);
      const { data: atual } = await sb.from("ml_registros").select("registro,apagado").eq("colecao", COLECAO).eq("id", id).maybeSingle();
      const antes = atual && !atual.apagado ? atual.registro as Record<string, unknown> : null;
      const historico = Array.isArray(antes?.historico) ? antes!.historico as unknown[] : [];
      const novo = {
        ...reg, id,
        criadoEm: antes?.criadoEm ?? reg.criadoEm ?? agora,
        criadoPor: antes?.criadoPor ?? (antes ? undefined : usuario),
        atualizadoPor: usuario, atualizadoEm: agora,
        historico: [...historico, { em: agora, por: usuario, acao: acaoTexto ?? oQueMudou(antes, reg) }].slice(-MAX_HISTORICO),
      };
      const { data, error } = await sb.from("ml_registros")
        .upsert({ colecao: COLECAO, id, registro: novo, apagado: false, atualizado_em: agora }).select("registro").maybeSingle();
      if (error) throw error;
      return data?.registro;
    };

    if (acao === "salvar") {
      const reg = (body.registro ?? {}) as Record<string, unknown>;
      if (!txt(reg.id)) reg.id = `labent-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      if (!/^labent-[\w-]{3,60}$/.test(txt(reg.id))) return json({ erro: "Identificador inválido." }, 400);
      delete reg.historico;
      const problema = conferir(reg);
      if (problema) return json({ erro: problema }, 400);
      const { data: atualReg } = await sb.from("ml_registros").select("registro,apagado").eq("colecao", COLECAO).eq("id", txt(reg.id)).maybeSingle();
      const antesReg = atualReg && !atualReg.apagado ? atualReg.registro as Record<string, unknown> : null;
      if (!antesReg && !meusSetores.includes("administrativo")) return json({ erro: "Só o Administrativo lança entrada nova.", semPermissao: true }, 403);
      const bloqueados = camposBloqueados(antesReg, reg, meusSetores);
      if (bloqueados.length) return recusa(bloqueados);
      if (antesReg?.importacao) reg.importacao = antesReg.importacao; else delete reg.importacao;
      const registro = await gravar(reg);
      await bump();
      return json({ ok: true, registro });
    }

    if (acao === "lote") {
      const tipo = txt(body.tipo);
      const ids: string[] = Array.isArray(body.ids) ? body.ids.map(txt).filter(Boolean) : [];
      const quando = txt(body.quando);
      if (!["liberar", "descartar"].includes(tipo)) return json({ erro: "Ação em lote desconhecida." }, 400);
      if (!meusSetores.includes("laboratorio")) return recusa(tipo === "liberar" ? ["liberadoEm"] : ["descartado"]);
      if (!ids.length || ids.length > 500) return json({ erro: "Selecione de 1 a 500 entradas." }, 400);
      if (!quando || !DATA_OK.test(quando)) return json({ erro: "Data/hora inválida." }, 400);
      const { data, error } = await sb.from("ml_registros").select("id,registro").eq("colecao", COLECAO).eq("apagado", false).in("id", ids);
      if (error) throw error;
      let feitos = 0;
      for (const l of data ?? []) {
        const r = l.registro as Record<string, unknown>;
        if (tipo === "liberar" && (r.liberadoEm || r.liberadoCliente === true)) continue;
        if (tipo === "descartar" && r.descartado === true) continue;
        const novo = tipo === "liberar"
          ? { ...r, liberadoCliente: true, liberadoEm: quando, finalizadoLab: true }
          : { ...r, descartado: true, descartadoEm: quando };
        await gravar(novo, tipo === "liberar" ? "Liberada para o cliente (em lote)" : "Descartada (em lote)");
        feitos += 1;
      }
      if (feitos) await bump();
      return json({ ok: true, feitos, ignorados: ids.length - feitos });
    }

    // Importação da planilha antiga: só a direção; só INSERE. Pula linha já importada (mesmo id)
    // e OS+amostras+recebimento já cadastrados — importar de novo não duplica.
    if (acao === "importar") {
      if (!direcao) return json({ erro: "Só a direção importa a planilha.", semPermissao: true }, 403);
      const regs = Array.isArray(body.registros) ? body.registros as Record<string, unknown>[] : [];
      if (!regs.length || regs.length > 500) return json({ erro: "Envie de 1 a 500 linhas por vez." }, 400);
      const chave = (r: Record<string, unknown>) => `${txt(r.os).toUpperCase()}|${txt(r.amostras).toUpperCase()}|${txt(r.recebidoEm)}`;
      const ids = new Set<string>(), chaves = new Set<string>();
      for (let de = 0; ; de += 1000) {
        const { data, error } = await sb.from("ml_registros").select("id,registro,apagado").eq("colecao", COLECAO).order("id").range(de, de + 999);
        if (error) throw error;
        for (const l of data ?? []) { ids.add(l.id); if (!l.apagado) chaves.add(chave(l.registro as Record<string, unknown>)); }
        if (!data || data.length < 1000) break;
      }
      const novos = [];
      let invalidos = 0;
      for (const r of regs) {
        const id = txt(r.id);
        if (!/^labent-imp-\d{5}$/.test(id) || !DATA_OK.test(txt(r.recebidoEm))) { invalidos += 1; continue; }
        // Linha já importada (mesmo que corrigida depois na tela) não volta a entrar.
        if (ids.has(id) || chaves.has(chave(r))) continue;
        delete r.historico;
        ids.add(id); chaves.add(chave(r));
        novos.push({
          colecao: COLECAO, id, apagado: false, atualizado_em: agora,
          registro: { ...r, id, criadoEm: agora, criadoPor: usuario, atualizadoPor: usuario, atualizadoEm: agora, historico: [{ em: agora, por: usuario, acao: `Importada da planilha (linha ${(r.importacao as { linha?: number })?.linha ?? "?"})` }] },
        });
      }
      if (novos.length) {
        const { error } = await sb.from("ml_registros").upsert(novos, { onConflict: "colecao,id", ignoreDuplicates: true });
        if (error) throw error;
        await bump();
      }
      return json({ ok: true, inseridos: novos.length, existentes: regs.length - novos.length - invalidos, invalidos });
    }

    if (acao === "apagar") {
      const id = txt(body.id);
      if (!id) return json({ erro: "Informe a entrada." }, 400);
      if (!meusSetores.includes("administrativo")) return json({ erro: "Só o Administrativo exclui entradas.", semPermissao: true }, 403);
      // Lápide, nunca DELETE: quem estava com a tela aberta precisa saber que sumiu.
      const { error } = await sb.from("ml_registros").update({ apagado: true, atualizado_em: agora }).eq("colecao", COLECAO).eq("id", id);
      if (error) throw error;
      await bump();
      return json({ ok: true });
    }

    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("ml-laboratorio", e);
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
