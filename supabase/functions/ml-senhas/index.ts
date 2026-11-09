// ml-senhas — cofre "Senhas e acessos" do painel (logins dos sites e sistemas da MinasLab).
//
// Segurança:
// - a senha fica CIFRADA (AES-256-GCM, chave no Vault: ml_senhas_chave) e só sai do servidor na ação
//   "revelar" (mostrar ou copiar), sempre registrada no histórico;
// - a lista nunca leva senha; a exportação também não;
// - cada acesso diz quem vê: setores (grupos de pessoas definidos aqui) e/ou pessoas. A direção vê tudo;
// - alterar a senha guarda a anterior cifrada no histórico (só a direção consegue ver a anterior).
// Crachá conferido e conta lida AO VIVO a cada chamada. Entra a direção ou quem tem a página "senhas".
//
// Ações: listar · revelar · salvar · alterarSenha · historico · verAnterior · permissoes ·
//        setorSalvar · setorApagar · importar · apagar
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SECRET_KEY")!;
const J = Deno.env.get("ML_JWT_SECRET") ?? "";
const sb = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder(), dec = new TextDecoder();
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const txt = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const uuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(txt(v)) ? txt(v) : null;
const lista = (v: unknown) => Array.isArray(v) ? [...new Set(v.map((x) => txt(x, 80)).filter(Boolean))].slice(0, 100) : [];
const CATEGORIAS = ["BANCOS", "FISCAL", "FORNECEDORES", "CLIENTES", "SISTEMAS", "EMAIL", "REDES", "OUTROS"];

function b64u(s: string) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }
const b64 = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const deB64 = (s: string) => { const b = atob(s), o = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; };

async function crachaDoPainel(req: Request) {
  const t = txt(req.headers.get("authorization"), 4000).replace(/^Bearer\s+/i, "");
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

// ---------------------------------------------------------------- cifra
let chaveCache: CryptoKey | null = null;
async function chave() {
  if (chaveCache) return chaveCache;
  const { data, error } = await sb.rpc("ml_senhas_chave");
  if (error || !data) throw new Error("Chave do cofre indisponível.");
  chaveCache = await crypto.subtle.importKey("raw", deB64(String(data)), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return chaveCache;
}
// A cifra fica presa ao id do acesso (AAD): copiar a cifra para outro registro não abre.
async function cifrar(senha: string, id: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(id) }, await chave(), enc.encode(senha)));
  const o = new Uint8Array(12 + c.length); o.set(iv); o.set(c, 12);
  return `v1:${b64(o)}`;
}
async function decifrar(cifra: string, id: string) {
  const u = deB64(cifra.replace(/^v1:/, ""));
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12), additionalData: enc.encode(id) }, await chave(), u.slice(12)));
}

// Categoria sugerida pelo endereço/nome (a pessoa ajusta depois).
function categoriaDe(nome: string, url: string) {
  const s = `${nome} ${url}`.toLowerCase();
  if (/banco|bb\.com|itau|bradesco|caixa\.gov|santander|sicoob|sicredi|bancointer|inter\.co|nubank|c6bank|mercadopago|pagseguro|stone|cielo|getnet/.test(s)) return "BANCOS";
  if (/\.gov|receita|prefeitura|nfse|nfe|sefaz|esocial|inmetro|cgcre|ibama|semad|feam|igam|anvisa|mapa\b|crq|cfq|cnpj|simples|fgts|detran|tjmg|pje|licita|compras/.test(s)) return "FISCAL";
  if (/instagram|facebook|linkedin|youtube|tiktok|twitter|x\.com|meta\.com|business\.facebook/.test(s)) return "REDES";
  if (/webmail|outlook|gmail|mail\.|hostinger|zoho|roundcube|titan/.test(s)) return "EMAIL";
  if (/omie|gerencialab|google|microsoft|office|docusign|chatpro|supabase|github|vercel|canva|adobe|dropbox|zoom|anydesk|registro\.br|godaddy|wix|wordpress|hostgator|locaweb|claude|openai|rdstation|trello|notion|asana/.test(s)) return "SISTEMAS";
  if (/loja|shop|store|merck|sigma|labsynth|alfakit|hach|macherey|nalgon|vidrolabor|interlab|neogen|3m|kasvi|cral|fornecedor|compra/.test(s)) return "FORNECEDORES";
  return "OUTROS";
}

type Item = Record<string, unknown> & { id: string; setores: string[]; pessoas: string[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const cracha = await crachaDoPainel(req);
  if (!cracha) return json({ erro: "Sua sessão expirou. Entre de novo.", semSessao: true }, 401);
  try {
    const usuario = txt(cracha.sub, 80);
    const { data: conta, error: erroConta } = await sb.from("ml_contas").select("ativo,papel,paginas_consulta").eq("usuario", usuario).maybeSingle();
    if (erroConta) throw erroConta;
    if (!conta || conta.ativo !== true) return json({ erro: "Esta conta foi desativada.", semSessao: true }, 401);
    // Papel lido da conta (ao vivo), não do crachá: tirar alguém da direção vale na hora.
    const direcao = conta.papel === "direcao";
    const perms: string[] = Array.isArray(conta.paginas_consulta) ? conta.paginas_consulta : [];
    if (!direcao && !(perms.includes("__matriz_v1") && perms.includes("senhas")))
      return json({ erro: "Senhas e acessos não está liberado para sua conta.", semPermissao: true }, 403);
    const podeEscrever = direcao || conta.papel === "equipe";

    const body = await req.json().catch(() => ({}));
    const acao = txt(body.acao, 40);
    const soDirecao = () => direcao ? null : json({ erro: "Só a direção pode fazer isso.", semPermissao: true }, 403);
    const exigeEscrita = () => podeEscrever ? null : json({ erro: "Seu acesso é só de consulta.", semPermissao: true }, 403);

    const { data: setoresTab, error: es } = await sb.from("ml_senhas_setores").select("nome,membros,atualizado_em").order("nome");
    if (es) throw es;
    const meusSetores = new Set((setoresTab ?? []).filter((s) => (s.membros ?? []).includes(usuario)).map((s) => s.nome));
    const vejo = (i: Item) => direcao || (i.pessoas ?? []).includes(usuario) || (i.setores ?? []).some((s) => meusSetores.has(s));
    const registrar = (senha_id: string, acao_: string, detalhe: string | null = null, senha_anterior_cifra: string | null = null) =>
      sb.from("ml_senhas_historico").insert({ senha_id, acao: acao_, usuario, detalhe, senha_anterior_cifra }).then(({ error }) => { if (error) throw error; });
    async function pegar(id: unknown) {
      const i = uuid(id);
      if (!i) return null;
      const { data, error } = await sb.from("ml_senhas").select("*").eq("id", i).eq("apagado", false).maybeSingle();
      if (error) throw error;
      return data && vejo(data as Item) ? data as Item : null;
    }

    if (acao === "listar") {
      const { data, error } = await sb.from("ml_senhas").select("id,nome,url,usuario_login,categoria,observacao,dois_fatores,setores,pessoas,senha_cifra,senha_trocada_em,criado_em,criado_por,atualizado_em,atualizado_por").eq("apagado", false).order("nome");
      if (error) throw error;
      const todos = (data ?? []) as Item[];
      const itens = todos.filter(vejo).map(({ senha_cifra, ...r }) => ({ ...r, temSenha: !!senha_cifra }));
      const semana = new Date(Date.now() - 7 * 86400000).toISOString();
      const ids = itens.map((i) => i.id);
      const { data: rev } = ids.length ? await sb.from("ml_senhas_historico").select("usuario").in("acao", ["REVELOU", "COPIOU"]).gte("em", semana).in("senha_id", ids) : { data: [] };
      const contas = direcao ? (await sb.from("ml_contas").select("usuario,nome").eq("ativo", true).order("nome")).data ?? [] : [];
      return json({
        ok: true, usuario, direcao, podeEscrever, total: todos.length, itens,
        setores: (setoresTab ?? []).map((s) => ({ nome: s.nome, membros: direcao || meusSetores.has(s.nome) ? s.membros : [] })),
        meusSetores: [...meusSetores], contas,
        revelados: { vezes: (rev ?? []).length, pessoas: new Set((rev ?? []).map((r) => r.usuario)).size },
      });
    }

    if (acao === "revelar") {
      const i = await pegar(body.id);
      if (!i) return json({ erro: "Acesso não encontrado ou não liberado para você." }, 404);
      if (!i.senha_cifra) return json({ ok: true, senha: "" });
      const senha = await decifrar(String(i.senha_cifra), i.id);
      await registrar(i.id, body.modo === "copiar" ? "COPIOU" : "REVELOU");
      return json({ ok: true, senha });
    }

    if (acao === "historico") {
      const i = await pegar(body.id);
      if (!i) return json({ erro: "Acesso não encontrado ou não liberado para você." }, 404);
      const { data, error } = await sb.from("ml_senhas_historico").select("id,acao,usuario,em,detalhe,senha_anterior_cifra").eq("senha_id", i.id).order("em", { ascending: false }).limit(200);
      if (error) throw error;
      return json({ ok: true, historico: (data ?? []).map(({ senha_anterior_cifra, ...h }) => ({ ...h, temAnterior: !!senha_anterior_cifra })) });
    }

    if (acao === "verAnterior") {
      const negado = soDirecao(); if (negado) return negado;
      const h = uuid(body.historico_id);
      const { data, error } = h ? await sb.from("ml_senhas_historico").select("senha_id,senha_anterior_cifra").eq("id", h).maybeSingle() : { data: null, error: null };
      if (error) throw error;
      if (!data?.senha_anterior_cifra) return json({ erro: "Não há senha anterior neste registro." }, 404);
      const senha = await decifrar(data.senha_anterior_cifra, data.senha_id);
      await registrar(data.senha_id, "VIU_ANTERIOR");
      return json({ ok: true, senha });
    }

    if (acao === "salvar") {
      const negado = exigeEscrita(); if (negado) return negado;
      const d = body.registro ?? {};
      const dados = {
        nome: txt(d.nome, 200), url: txt(d.url, 500) || null, usuario_login: txt(d.usuario_login, 200) || null,
        categoria: CATEGORIAS.includes(txt(d.categoria)) ? txt(d.categoria) : "OUTROS",
        observacao: txt(d.observacao, 2000) || null, dois_fatores: txt(d.dois_fatores, 300) || null,
      };
      if (!dados.nome) return json({ erro: "Informe o nome do site ou sistema." }, 400);
      if (d.id) {
        const atual = await pegar(d.id);
        if (!atual) return json({ erro: "Acesso não encontrado ou não liberado para você." }, 404);
        const ROT: Record<string, string> = { nome: "nome", url: "link", usuario_login: "usuário", categoria: "categoria", observacao: "observação", dois_fatores: "verificação em 2 etapas" };
        const mudou = Object.entries(dados).filter(([k, v]) => (atual[k] ?? null) !== v);
        if (!mudou.length) return json({ ok: true, id: atual.id });
        const { error } = await sb.from("ml_senhas").update({ ...dados, atualizado_em: new Date().toISOString(), atualizado_por: usuario }).eq("id", atual.id);
        if (error) throw error;
        const det = mudou.map(([k, v]) => k === "usuario_login" ? `usuário de “${atual[k] ?? ""}” para “${v ?? ""}”` : ROT[k]).join(", ");
        await registrar(atual.id, "ALTEROU_DADOS", `Alterou ${det}`);
        return json({ ok: true, id: atual.id });
      }
      const id = crypto.randomUUID();
      const senha = typeof d.senha === "string" ? d.senha.slice(0, 500) : "";
      const novo = {
        id, ...dados,
        // Quem cria (fora da direção) já fica entre os que veem; a direção decide o resto.
        setores: direcao ? lista(d.setores) : lista(d.setores).filter((s) => meusSetores.has(s)),
        pessoas: direcao ? lista(d.pessoas) : [...new Set([usuario, ...lista(d.pessoas)])],
        senha_cifra: senha ? await cifrar(senha, id) : null, senha_trocada_em: senha ? new Date().toISOString() : null,
        origem: "manual", criado_por: usuario, atualizado_por: usuario,
      };
      const { error } = await sb.from("ml_senhas").insert(novo);
      if (error) throw error;
      await registrar(id, "CRIOU");
      return json({ ok: true, id });
    }

    if (acao === "alterarSenha") {
      const negado = exigeEscrita(); if (negado) return negado;
      const i = await pegar(body.id);
      if (!i) return json({ erro: "Acesso não encontrado ou não liberado para você." }, 404);
      const senha = typeof body.senha === "string" ? body.senha.slice(0, 500) : "";
      if (!senha) return json({ erro: "Digite a nova senha." }, 400);
      if (i.senha_cifra && await decifrar(String(i.senha_cifra), i.id) === senha) return json({ erro: "A nova senha é igual à atual." }, 400);
      const agora = new Date().toISOString();
      const { error } = await sb.from("ml_senhas").update({ senha_cifra: await cifrar(senha, i.id), senha_trocada_em: agora, atualizado_em: agora, atualizado_por: usuario }).eq("id", i.id);
      if (error) throw error;
      await registrar(i.id, "ALTEROU_SENHA", txt(body.motivo, 300) || null, (i.senha_cifra as string) || null);
      return json({ ok: true });
    }

    if (acao === "permissoes") {
      const negado = soDirecao(); if (negado) return negado;
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(uuid).filter(Boolean) as string[];
      if (!ids.length) return json({ erro: "Escolha ao menos um acesso." }, 400);
      const setores = lista(body.setores), pessoas = lista(body.pessoas);
      const { data, error } = await sb.from("ml_senhas").select("id,setores,pessoas").in("id", ids).eq("apagado", false);
      if (error) throw error;
      for (const r of data ?? []) {
        const novo = body.modo === "adicionar"
          ? { setores: [...new Set([...(r.setores ?? []), ...setores])], pessoas: [...new Set([...(r.pessoas ?? []), ...pessoas])] }
          : { setores, pessoas };
        const { error: e } = await sb.from("ml_senhas").update({ ...novo, atualizado_em: new Date().toISOString(), atualizado_por: usuario }).eq("id", r.id);
        if (e) throw e;
        await registrar(r.id, "PERMISSAO", `Quem vê: ${[...novo.setores.map((s) => `setor ${s}`), ...novo.pessoas].join(", ") || "só a direção"}`);
      }
      return json({ ok: true, alterados: (data ?? []).length });
    }

    if (acao === "setorSalvar") {
      const negado = soDirecao(); if (negado) return negado;
      const nome = txt(body.nome, 60), antigo = txt(body.nomeAntigo, 60);
      if (!nome) return json({ erro: "Informe o nome do setor." }, 400);
      const { error } = await sb.from("ml_senhas_setores").upsert({ nome, membros: lista(body.membros), atualizado_em: new Date().toISOString(), atualizado_por: usuario });
      if (error) throw error;
      if (antigo && antigo !== nome) {
        // Renomear: troca o nome nos acessos e apaga o antigo.
        const { data } = await sb.from("ml_senhas").select("id,setores").contains("setores", [antigo]);
        for (const r of data ?? []) await sb.from("ml_senhas").update({ setores: [...new Set((r.setores as string[]).map((s) => s === antigo ? nome : s))] }).eq("id", r.id);
        await sb.from("ml_senhas_setores").delete().eq("nome", antigo);
      }
      return json({ ok: true });
    }

    if (acao === "setorApagar") {
      const negado = soDirecao(); if (negado) return negado;
      const nome = txt(body.nome, 60);
      const { data } = await sb.from("ml_senhas").select("id,setores").contains("setores", [nome]);
      for (const r of data ?? []) await sb.from("ml_senhas").update({ setores: (r.setores as string[]).filter((s) => s !== nome) }).eq("id", r.id);
      const { error } = await sb.from("ml_senhas_setores").delete().eq("nome", nome);
      if (error) throw error;
      return json({ ok: true });
    }

    if (acao === "importar") {
      const negado = soDirecao(); if (negado) return negado;
      const linhas = Array.isArray(body.linhas) ? body.linhas.slice(0, 2000) : [];
      const { data: exist, error } = await sb.from("ml_senhas").select("url,nome,usuario_login").eq("apagado", false);
      if (error) throw error;
      const chaveDup = (n: string, u: string, l: string) => `${(u || n).toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "")}|${(l || "").toLowerCase()}`;
      const ja = new Set((exist ?? []).map((r) => chaveDup(r.nome, r.url ?? "", r.usuario_login ?? "")));
      let novos = 0, repetidos = 0, vazios = 0;
      for (const l of linhas) {
        const nome = txt(l.nome, 200), url = txt(l.url, 500), login = txt(l.usuario_login, 200);
        if (!nome && !url) { vazios++; continue; }
        const k = chaveDup(nome, url, login);
        if (ja.has(k)) { repetidos++; continue; }
        ja.add(k);
        const id = crypto.randomUUID();
        const senha = typeof l.senha === "string" ? l.senha.slice(0, 500) : String(l.senha ?? "").slice(0, 500);
        const { error: e } = await sb.from("ml_senhas").insert({
          id, nome: nome || url, url: url || null, usuario_login: login || null, observacao: txt(l.observacao, 2000) || null,
          categoria: categoriaDe(nome, url), setores: [], pessoas: [],
          senha_cifra: senha ? await cifrar(senha, id) : null, senha_trocada_em: null,
          origem: txt(body.arquivo, 120) || "planilha", criado_por: usuario, atualizado_por: usuario,
        });
        if (e) throw e;
        await registrar(id, "IMPORTOU", `Da planilha ${txt(body.arquivo, 120) || ""}`.trim());
        novos++;
      }
      return json({ ok: true, novos, repetidos, vazios });
    }

    if (acao === "apagar") {
      const negado = soDirecao(); if (negado) return negado;
      const i = await pegar(body.id);
      if (!i) return json({ erro: "Acesso não encontrado." }, 404);
      const { error } = await sb.from("ml_senhas").update({ apagado: true, atualizado_em: new Date().toISOString(), atualizado_por: usuario }).eq("id", i.id);
      if (error) throw error;
      await registrar(i.id, "APAGOU");
      return json({ ok: true });
    }

    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("ml-senhas", e);
    return json({ erro: "Não foi possível concluir agora. Tente de novo." }, 500);
  }
});
