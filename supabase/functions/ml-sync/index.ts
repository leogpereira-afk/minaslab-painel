// ============================================================================
// ml-sync — a porta de dados do Painel MinasLab.
//
// UMA function para o sistema inteiro: login, contas e dados. O painel manda
// POST { action, ... } com o crachá (Bearer <jwt>) e recebe JSON.
//
// PROJETO COMPARTILHADO ("Projetos Léo", ref reoghclxripktzpdwhiy): este
// projeto hospeda bsq_, domo_, dmd_ e pdb_. Todo objeto daqui leva o prefixo
// ml_ — publicar sem prefixo pisaria em produção alheia sem avisar.
//
// verify_jwt = false DE PROPÓSITO: o preflight CORS chega sem token e o
// gateway barraria antes de a função rodar. A autorização é feita AQUI DENTRO.
// Deploy sempre com --no-verify-jwt.
//
// AS QUATRO CONFERÊNCIAS (Dre/PADRAO-DOS-SISTEMAS.md):
//   1) assinatura (HS256 com ML_JWT_SECRET)   2) validade (12h)
//   3) p.sis === "minaslab"                   4) o PAPEL, em cada ação
//
// Papéis (decididos com o Léo em 27/08/2026):
//   direcao — tudo, inclusive coleções rh_* e fin_*, config e contas
//   equipe  — lê e edita o operacional; NÃO lê rh_* nem fin_* (a régua vale na
//             porta de dados, não só na tela — folha de pagamento já vazou na
//             Impresilk por porta larga com tela estreita)
//   leitura — só lê (e também não lê rh_* nem fin_*)
//
// Regras herdadas (cada uma custou horas na Impresilk):
//  - lápide (apagado=true), nunca DELETE
//  - rev bump em ml_meta a cada escrita
//  - list pagina NO BANCO (keyset), nunca "carrega tudo e fatia"
//  - upsert devolve o registro COMO FICOU: "não deu erro" não é "gravou"
//  - freio de login ATÔMICO no banco (ml_freio): consumir a ficha na operação
//    que confere, senão 16 senhas no mesmo segundo passam
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Token de MÁQUINA (backup, servidor a servidor). Nunca vai a navegador.
const TOKEN = Deno.env.get("ML_TOKEN") ?? "";
// O segredo que assina os crachás. Próprio da MinasLab — não é o da Impresilk.
const JWT_SECRET = Deno.env.get("ML_JWT_SECRET") ?? "";
// Senha-mestra INICIAL da direção: vale só enquanto a conta "leo" não existir
// em ml_contas (mesmo desenho do Painel da Impresilk). Criada a conta, ela cala.
const SENHA_MESTRA = Deno.env.get("ML_SENHA_MESTRA") ?? "";

const T_REG = "ml_registros";
const T_CFG = "ml_config_global";
const T_META = "ml_meta";
const T_CONTAS = "ml_contas";
const SIS = "minaslab";
const VALIDADE_SEG = 12 * 60 * 60;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------------------------------------------------------------- criptografia
// Portado de painel/supabase/functions/_shared/cripto.ts SEM mudar o mecanismo:
// reescrever mecanismo de senha é a forma mais fácil de enfraquecer um.
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlFromBytes(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64urlFromString = (s: string) => b64urlFromBytes(enc.encode(s));
const stringFromB64url = (s: string) => dec.decode(bytesFromB64url(s));

const hexFromBytes = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
function bytesFromHex(h: string) {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function chaveHmac(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function assinarJwt(payload: Record<string, unknown>, secret: string, expSeg = VALIDADE_SEG) {
  const agora = Math.floor(Date.now() / 1000);
  const corpo = { ...payload, iat: agora, exp: agora + expSeg };
  const cabecalho = b64urlFromString(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const dados = `${cabecalho}.${b64urlFromString(JSON.stringify(corpo))}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await chaveHmac(secret), enc.encode(dados)));
  return `${dados}.${b64urlFromBytes(sig)}`;
}

async function verificarJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const partes = String(token || "").split(".");
  if (partes.length !== 3) return null;
  const dados = `${partes[0]}.${partes[1]}`;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await chaveHmac(secret), bytesFromB64url(partes[2]), enc.encode(dados));
  } catch {
    return null;
  }
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(stringFromB64url(partes[1]));
  } catch {
    return null;
  }
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function hashSenha(senha: string, saltHex?: string, iter = 120000) {
  const salt = saltHex ? bytesFromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey("raw", enc.encode(senha), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, km, 256);
  return { hash: hexFromBytes(new Uint8Array(bits)), salt: hexFromBytes(salt), iter };
}

async function conferirSenha(senha: string, reg: { hash?: string; salt?: string; iter?: number }) {
  if (!reg?.hash || !reg?.salt) return false;
  const { hash } = await hashSenha(senha, reg.salt, reg.iter || 120000);
  // Tempo constante: comparar com === vazaria, pelo tempo, quantos caracteres bateram.
  if (hash.length !== reg.hash.length) return false;
  let dif = 0;
  for (let i = 0; i < hash.length; i++) dif |= hash.charCodeAt(i) ^ reg.hash.charCodeAt(i);
  return dif === 0;
}

// "José  Silva" e "jose silva" viram a mesma chave, senão a pessoa não entra.
const normalizarUsuario = (s: unknown): string =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------- infra
// Rev bump: um número por coleção + um global; o cliente compara e só baixa o
// que mudou.
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

/* Desativar tem de fechar a porta ANTES de o crachá vencer: a cada chamada
   conferimos se a conta segue ativa, com cache de 60s. Banco fora do ar
   ACEITA e não guarda no cache — trancar a casa por uma consulta que falhou é
   pior que um crachá durar mais um pouco. */
const CACHE_ATIVA = new Map<string, { ate: number; ativa: boolean }>();
async function contaSegueAtiva(usuario: string): Promise<boolean> {
  const agora = Date.now();
  const emCache = CACHE_ATIVA.get(usuario);
  if (emCache && emCache.ate > agora) return emCache.ativa;
  try {
    const { data, error } = await sb.from(T_CONTAS).select("ativo").eq("usuario", usuario).maybeSingle();
    if (error) throw new Error(error.message);
    // Conta que não existe no banco: só a mestra (bootstrap) — segue valendo.
    const ativa = data ? data.ativo === true : true;
    CACHE_ATIVA.set(usuario, { ate: agora + 60_000, ativa });
    return ativa;
  } catch {
    return true;
  }
}

/* Coleções da DIREÇÃO: a régua vale AQUI, na porta — não só no menu da tela.
   RH (folha, ficha, ponto) e FINANCEIRO (vendas, títulos, impostos) têm a
   mesma natureza: tela estreita com porta larga já vazou folha de pagamento
   na Impresilk. Quem esconde de verdade é o servidor. */
const ehColecaoRH = (c: string) => c.startsWith("rh_") || c.startsWith("fin_");

// O freio ATÔMICO do login (função SQL ml_freio): consome a ficha na mesma
// operação que confere a janela. >8 tentativas em 15 min = espera.
async function freioEstourado(usuario: string): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("ml_freio", { p_chave: `freio:${usuario}` });
    if (error) throw new Error(error.message);
    return Number(data) > 8;
  } catch {
    // Freio indisponível não tranca o login: a senha continua sendo conferida.
    return false;
  }
}
async function soltarFreio(usuario: string) {
  try {
    await sb.from(T_META).delete().eq("chave", `freio:${usuario}`);
  } catch { /* melhor esforço */ }
}

// A conta como vai para a tela: NUNCA com hash/salt. A porta larga que devolve
// o registro cru é exatamente o vazamento que a Impresilk já pagou.
const contaLimpa = (c: Record<string, unknown>) => ({
  usuario: c.usuario,
  nome: c.nome,
  papel: c.papel,
  ativo: c.ativo,
  criado_em: c.criado_em,
  paginas_consulta: c.paginas_consulta ?? [],
});

const PAPEIS = ["direcao", "equipe", "leitura"];
const PAGINAS_VALIDAS = new Set(["__matriz_v1", "inicio", "calendario", "compromissos", "licitacoes", "marketing", "google-drive", "crm", "gestao-estoque", "gestao-estoque/dashboard", "gestao-estoque/cadastro-insumo", "gestao-estoque/entrada-lote", "gestao-estoque/retirada-baixa", "gestao-estoque/fornecedores", "gestao-estoque/etiquetas", "gestao-estoque/relatorios", "gestao-estoque/configuracoes", "gestao-estoque/pedido-compra", "compras", "compras/estoque", "compras/pedidos", "compras/ordens", "compras/retiradas", "patrimonio", "patrimonio/inventario", "patrimonio/setores", "patrimonio/pendencias", "curva-abc", "curva-abc/clientes", "curva-abc/produtos", "curva-abc/vendedores", "manutencoes", "laboratorio", "financas/servicos-gerados"]);
const COLECOES_ESTOQUE: Record<string, string[]> = {
  estoque_produtos_base: ["dashboard", "cadastro-insumo", "entrada-lote", "retirada-baixa", "pedido-compra"],
  estoque_lotes: ["dashboard", "entrada-lote", "retirada-baixa", "etiquetas", "relatorios"],
  estoque_movimentos: ["entrada-lote", "retirada-baixa", "relatorios"],
  estoque_fornecedores: ["dashboard", "entrada-lote", "fornecedores", "pedido-compra"],
  estoque_pedidos: ["dashboard", "pedido-compra"],
  estoque_inspecoes: ["pedido-compra", "relatorios"],
  estoque_avaliacoes_fornecedor: ["fornecedores"],
  estoque_fapes: ["fornecedores"],
  estoque_tipos_documentos_fornecedor: ["fornecedores", "configuracoes"],
  estoque_regras_documentos_fornecedor: ["fornecedores", "configuracoes"],
  estoque_documentos_fornecedor: ["fornecedores"],
  estoque_logs_compras: ["pedido-compra"],
  estoque_historico_produto_base: ["cadastro-insumo"],
  estoque_config: ["configuracoes"],
};
const COLECOES_COMPRA: Record<string, string[]> = {
  compras: ["pedidos", "ordens"],
  produtos: ["estoque", "pedidos", "ordens", "retiradas"],
  estoque_mov: ["estoque", "pedidos", "retiradas"],
  ordens: ["pedidos", "ordens"],
};
const COLECAO_PAGINA: Record<string, string> = {
  compromissos: "compromissos", licitacoes: "licitacoes",
  manutencoes: "manutencoes", equipamentos: "manutencoes", carros: "manutencoes",
  compras: "compras", produtos: "compras", estoque_mov: "compras", ordens: "compras",
  estoque_produtos_base: "gestao-estoque", estoque_lotes: "gestao-estoque", estoque_movimentos: "gestao-estoque", estoque_fornecedores: "gestao-estoque", estoque_pedidos: "gestao-estoque", estoque_inspecoes: "gestao-estoque", estoque_avaliacoes_fornecedor: "gestao-estoque", estoque_fapes: "gestao-estoque", estoque_tipos_documentos_fornecedor: "gestao-estoque", estoque_regras_documentos_fornecedor: "gestao-estoque", estoque_documentos_fornecedor: "gestao-estoque", estoque_logs_compras: "gestao-estoque", estoque_historico_produto_base: "gestao-estoque", estoque_config: "gestao-estoque",
  mkt: "marketing", drive_atalhos: "google-drive",
};



/* RH + PONTO — extensões aditivas. As coleções ml_registros/rh_* e a
   autenticação desta função continuam sendo a fonte existente. Dados
   documentais, banco de horas e snapshots ficam em tabelas próprias para
   preservar auditoria e impedir que o JSON genérico vire uma segunda verdade. */
const RH_DOC_BUCKET = "ml-arquivos";
const RH_DOC_MAX_BYTES = 25 * 1024 * 1024;

function nomeStorageSeguro(nome: string) {
  return String(nome || "documento").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160);
}
function bytesDoBase64(valor: string) {
  const texto = String(valor || "").replace(/^data:[^;]+;base64,/, "");
  const bin = atob(texto);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function saldoBancoPessoa(pessoaId: string) {
  const { data, error } = await sb.from("rh_banco_horas_movimentos")
    .select("credito_minutos, debito_minutos")
    .eq("pessoa_id", pessoaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).reduce((n, m) => n + Number(m.credito_minutos || 0) - Number(m.debito_minutos || 0), 0);
}
async function gravarPontoAuditoria(evento: string, dados: Record<string, unknown>, usuario: string) {
  const { error } = await sb.from("rh_ponto_auditoria").insert({
    pessoa_id: dados.pessoa_id ?? null,
    empresa: dados.empresa ?? null,
    folha_id: dados.folha_id ?? null,
    movimento_id: dados.movimento_id ?? null,
    documento_id: dados.documento_id ?? null,
    evento,
    dados,
    usuario,
  });
  if (error) throw error;
}


const RH_CAMPOS_CONFIRMAVEIS = new Set([
  "nome","cpf","rg","uf","dataNascimento","estadoCivil","sexo","nacionalidade","naturalidade",
  "telefone","email","endereco","numero","complemento","bairro","cidade","cep",
  "nomeMae","nomePai","pis","ctps","serieCtps","admissao","numeroFicha","matriculaEsocial",
  "cargo","cbo","salario","tipoSalario","tipoContrato","jornada","escala","horasSemanais",
  "empresa","setor","centroCusto","vinculo","escolaridade","formacao","registroConselho",
  "contatoEmergencia"
]);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return resp({ erro: "JSON inválido." }, 400);
  }
  const action = String(body.action ?? "");

  try {
    // ---------------- ping: aberto (é o "está no ar?") ----------------
    if (action === "ping") return resp({ ok: true, agora: new Date().toISOString() });

    // ---------------- entrar: a única outra ação sem crachá ----------------
    if (action === "entrar") {
      if (!JWT_SECRET) return resp({ erro: "O sistema ainda não foi ligado (falta o segredo do crachá)." }, 503);
      const usuario = normalizarUsuario(body.usuario);
      const senha = String(body.senha ?? "");
      if (!usuario || !senha) return resp({ erro: "Informe usuário e senha." }, 400);
      if (await freioEstourado(usuario)) {
        return resp({ erro: "Muitas tentativas seguidas. Espere 15 minutos e tente de novo." }, 429);
      }

      // Banco fora do ar NÃO é "senha errada": engolir o erro aqui mandava a
      // pessoa pedir redefinição por uma falha que era do servidor — e ainda
      // ressuscitava a senha-mestra com a conta já criada.
      const { data: conta, error: erroConta } = await sb.from(T_CONTAS).select("*").eq("usuario", usuario).maybeSingle();
      if (erroConta) return resp({ erro: "O servidor falhou agora. Tente de novo em instantes." }, 503);

      if (conta) {
        if (conta.ativo !== true) return resp({ erro: "Esta conta está desativada. Fale com a direção." }, 403);
        const ok = await conferirSenha(senha, conta.senha ?? {});
        if (!ok) return resp({ erro: "Usuário ou senha errados." }, 401);
        await soltarFreio(usuario);
        const paginas_consulta = Array.isArray(conta.paginas_consulta) ? conta.paginas_consulta : [];
        const token = await assinarJwt({ sub: usuario, nome: conta.nome, papel: conta.papel, sis: SIS }, JWT_SECRET);
        return resp({ token, usuario, nome: conta.nome, papel: conta.papel, paginas_consulta });
      }

      /* BOOTSTRAP: a senha-mestra vale SÓ para "leo" e SÓ enquanto a conta
         dele não existir no banco (mesmo desenho do Painel da Impresilk:
         MASTER_SENHA é a inicial; depois, vale a conta gravada). */
      if (usuario === "leo" && SENHA_MESTRA && senha === SENHA_MESTRA) {
        await soltarFreio(usuario);
        const token = await assinarJwt({ sub: "leo", nome: "Léo", papel: "direcao", sis: SIS }, JWT_SECRET);
        return resp({ token, usuario: "leo", nome: "Léo", papel: "direcao", mestra: true });
      }

      return resp({ erro: "Usuário ou senha errados." }, 401);
    }

    // ---------------- daqui para baixo: crachá ou token de máquina ----------------
    const m = String(req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
    const cracha = m && JWT_SECRET ? await verificarJwt(m[1], JWT_SECRET) : null;
    const crachaValido = cracha && cracha.sis === SIS ? cracha : null;
    const ehMaquina = !!TOKEN && req.headers.get("x-token") === TOKEN;
    if (!crachaValido && !ehMaquina) return resp({ erro: "Entre no sistema.", semSessao: true }, 401);

    const usuario = String(crachaValido?.sub ?? "");
    const papel = ehMaquina ? "maquina" : String(crachaValido?.papel ?? "");
    if (crachaValido && !(await contaSegueAtiva(usuario))) {
      return resp({ erro: "Esta conta foi desativada.", semSessao: true }, 401);
    }

    const ehDirecao = papel === "direcao" || ehMaquina;
    // Permissões retiradas passam a valer imediatamente, inclusive com token antigo.
    let permissoes: string[] = [];
    if (!ehDirecao) {
      const { data: contaPermissoes, error: erroPermissoes } = await sb.from(T_CONTAS)
        .select("paginas_consulta").eq("usuario", usuario).maybeSingle();
      if (erroPermissoes || !contaPermissoes) return resp({ erro: "Não foi possível confirmar suas permissões.", semPermissao: true }, 403);
      permissoes = Array.isArray(contaPermissoes.paginas_consulta) ? contaPermissoes.paginas_consulta : [];
    }
    const matrizAtiva = permissoes.includes("__matriz_v1");
    const podeConsultarColecao = (colecao: string) => {
      if (ehDirecao) return true;
      if (ehColecaoRH(colecao)) return matrizAtiva &&
        ["fin_receber", "fin_clientes", "fin_categorias"].includes(colecao) &&
        permissoes.some(p => p === "curva-abc" || p.startsWith("curva-abc/"));
      if (!matrizAtiva) return true;
      const pagina = COLECAO_PAGINA[colecao];
      return !!pagina && (
        permissoes.includes(pagina) ||
        (pagina === "compras" && (COLECOES_COMPRA[colecao] || []).some(tab => permissoes.includes("compras/" + tab))) ||
        (pagina === "gestao-estoque" && (COLECOES_ESTOQUE[colecao] || []).some(tab => permissoes.includes("gestao-estoque/" + tab))) ||
        (permissoes.includes("calendario") && ["compromissos", "licitacoes", "manutencoes", "equipamentos", "carros"].includes(colecao)) ||
        (permissoes.includes("inicio") && ["compromissos", "licitacoes", "manutencoes", "compras"].includes(colecao))
      );
    };
    const podeEscrever = ehDirecao || (papel === "equipe" && !matrizAtiva);
    const podeEditarEstoque = (secao: string) => ehDirecao || (papel === "equipe" && (
      !matrizAtiva || permissoes.includes("gestao-estoque") || permissoes.includes("gestao-estoque/" + secao)
    ));

    switch (action) {
      case "rev": {
        const { data } = await sb.from(T_META).select("valor").eq("chave", "rev").maybeSingle();
        return resp({ rev: data?.valor ?? { rev: 0, porColecao: {} } });
      }

      case "list": {
        const colecao = String(body.colecao ?? "");
        if (!colecao) return resp({ erro: "Informe a coleção." }, 400);
        if (!podeConsultarColecao(colecao)) {
          return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);
        }
        const desde = String(body.desde ?? "") || "1970-01-01";
        // Cursor COMPOSTO (atualizado_em, id): só o timestamp deixava sumir,
        // em silêncio, o registro que dividia o mesmo instante com a fronteira
        // da página (gravação em lote, restauração de backup).
        const desdeId = String(body.desdeId ?? "");
        const limite = Math.min(Number(body.limite ?? 200), 500);
        let q = sb
          .from(T_REG)
          .select("id, registro, apagado, atualizado_em")
          .eq("colecao", colecao);
        q = desdeId
          ? q.or(`atualizado_em.gt."${desde}",and(atualizado_em.eq."${desde}",id.gt."${desdeId}")`)
          : q.gt("atualizado_em", desde);
        const { data, error } = await q
          .order("atualizado_em", { ascending: true })
          .order("id", { ascending: true })
          .limit(limite);
        if (error) throw error;
        const ultimo = data.length === limite ? data[data.length - 1] : null;
        return resp({ itens: data, proximo: ultimo?.atualizado_em ?? null, proximoId: ultimo?.id ?? null });
      }

      /* VÁRIAS COLEÇÕES NUMA CHAMADA — o conserto da lentidão, medido antes
         de escrito: cada ida e volta ao servidor custa ~0,2s daqui do Brasil, e
         rh_ponto_dia sozinha eram 3 páginas SEQUENCIAIS (~2,1s). Abrir o Ponto
         somava 6+ chamadas. Aqui o banco é vizinho da função: varrer tudo do
         lado de cá custa milissegundos, e a tela paga UMA viagem.
         O que a porta recusa, ela DEVOLVE em `recusadas` — filtro silencioso é
         concessão que nunca aconteceu, e a tela precisa saber o que não veio. */
      case "listarVarias": {
        const pedidas = Array.isArray(body.colecoes) ? body.colecoes.map(String) : [];
        if (!pedidas.length || pedidas.length > 20) {
          return resp({ erro: "Informe de 1 a 20 coleções." }, 400);
        }
        const colecoes: Record<string, unknown[]> = {};
        const recusadas: string[] = [];
        for (const nome of pedidas) {
          if (!podeConsultarColecao(nome)) { recusadas.push(nome); continue; }
          const itens: unknown[] = [];
          let desde = "1970-01-01";
          let desdeId = "";
          for (;;) {
            let q = sb.from(T_REG)
              .select("id, registro, apagado, atualizado_em")
              .eq("colecao", nome)
              .order("atualizado_em", { ascending: true })
              .order("id", { ascending: true })
              .limit(1000);
            // Mesmo cursor composto do list: registro que divide o instante
            // com a fronteira da página não pode sumir calado.
            q = desdeId
              ? q.or(`atualizado_em.gt.${desde},and(atualizado_em.eq.${desde},id.gt.${desdeId})`)
              : q.gt("atualizado_em", desde);
            const { data, error } = await q;
            if (error) throw error;
            for (const l of data ?? []) {
              if (!l.apagado) itens.push(l.registro);
            }
            if (!data || data.length < 1000) break;
            desde = String(data[data.length - 1].atualizado_em);
            desdeId = String(data[data.length - 1].id);
          }
          colecoes[nome] = itens;
        }
        const { data: revLinha } = await sb.from(T_META).select("valor").eq("chave", "rev").maybeSingle();
        return resp({ colecoes, recusadas, rev: revLinha?.valor ?? { rev: 0, porColecao: {} } });
      }

      case "get": {
        const colecao = String(body.colecao ?? "");
        if (!podeConsultarColecao(colecao)) {
          return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);
        }
        const { data } = await sb
          .from(T_REG)
          .select("registro, apagado")
          .eq("colecao", colecao)
          .eq("id", String(body.id))
          .maybeSingle();
        return resp({ registro: data && !data.apagado ? data.registro : null });
      }

      case "estoqueFapeUpload": {
        if (!podeEditarEstoque("fornecedores")) return resp({erro:"Seu acesso lê, mas não edita fornecedores.",semPermissao:true},403);
        const fornecedorId=String(body.fornecedorId??""),base64=String(body.arquivoBase64??"");if(!fornecedorId||!base64)return resp({erro:"Fornecedor e PDF são obrigatórios."},400);
        const {data:fr,error:fe}=await sb.from(T_REG).select("registro,apagado").eq("colecao","estoque_fornecedores").eq("id",fornecedorId).maybeSingle();if(fe)throw fe;if(!fr||fr.apagado)return resp({erro:"Fornecedor não localizado."},404);
        const {data:avs,error:ae}=await sb.from(T_REG).select("registro").eq("colecao","estoque_avaliacoes_fornecedor").eq("apagado",false);if(ae)throw ae;
        const lista=(avs??[]).map(x=>x.registro as Record<string,unknown>).filter(a=>String(a.fornecedorId??"")===fornecedorId),inicial=lista.find(a=>String(a.tipoAvaliacao??"").toUpperCase()==="INICIAL");
        if(!inicial)return resp({erro:"A FAPE exige uma avaliação inicial do fornecedor."},409);
        const reavs=lista.filter(a=>String(a.tipoAvaliacao??"").toUpperCase()==="REAVALIACAO_SEMESTRAL"),bytes=bytesDoBase64(base64);if(bytes.byteLength>RH_DOC_MAX_BYTES)return resp({erro:"O PDF excede 25 MB."},413);
        const agora=new Date().toISOString(),id="FAPE-"+agora.replace(/\D/g,"").slice(0,14)+"-"+crypto.randomUUID().slice(0,6).toUpperCase(),nome=nomeStorageSeguro(`FAPE_${fornecedorId}_${agora.slice(0,10)}.pdf`),storagePath=`estoque/fornecedores/${fornecedorId}/fapes/${id}-${nome}`;
        const up=await sb.storage.from(RH_DOC_BUCKET).upload(storagePath,bytes,{contentType:"application/pdf",upsert:false});if(up.error)throw up.error;
        const fornecedor=fr.registro as Record<string,unknown>,registro:Record<string,unknown>={id,fornecedorId,cnpj:String(fornecedor.cnpj??""),nomeArquivo:nome,storageBucket:RH_DOC_BUCKET,storagePath,dataGeracao:agora,usuario,avaliacaoInicialId:String(inicial.id??""),qtdReavaliacoes:reavs.length,createdAt:agora};
        const {error:ie}=await sb.from(T_REG).insert({colecao:"estoque_fapes",id,registro,apagado:false,atualizado_em:agora});if(ie){await sb.storage.from(RH_DOC_BUCKET).remove([storagePath]);throw ie}await bump("estoque_fapes");return resp({ok:true,fape:registro});
      }

      case "estoqueDocumentoUpload": {
        if (!podeEditarEstoque("fornecedores")) return resp({ erro:"Seu acesso lê, mas não edita fornecedores.", semPermissao:true },403);
        const fornecedorId=String(body.fornecedorId??""), tipoDocumentoId=String(body.tipoDocumentoId??""), nomeOriginal=String(body.nomeOriginal??"").trim(), base64=String(body.arquivoBase64??"");
        if(!fornecedorId||!tipoDocumentoId||!nomeOriginal||!base64) return resp({erro:"Fornecedor, tipo documental e arquivo são obrigatórios."},400);
        const lerReg=async(colecao:string,id:string)=>{const {data,error}=await sb.from(T_REG).select("registro,apagado").eq("colecao",colecao).eq("id",id).maybeSingle();if(error)throw error;return data&&!data.apagado?data.registro as Record<string,unknown>:null};
        const fornecedor=await lerReg("estoque_fornecedores",fornecedorId); if(!fornecedor)return resp({erro:"Fornecedor não localizado."},404);
        const tipo=await lerReg("estoque_tipos_documentos_fornecedor",tipoDocumentoId); if(!tipo)return resp({erro:"Tipo documental não localizado."},404);
        const {data:rr,error:re}=await sb.from(T_REG).select("registro").eq("colecao","estoque_regras_documentos_fornecedor").eq("apagado",false);if(re)throw re;
        const regra=(rr??[]).map(x=>x.registro as Record<string,unknown>).find(r=>String(r.tipoFornecedor??"").toUpperCase()===String(fornecedor.tipoFornecedor??"").toUpperCase()&&String(r.tipoDocumentoId??"")===tipoDocumentoId&&String(r.ativo??"SIM").toUpperCase()!=="NÃO");
        if(!regra||String(regra.regra??"").toUpperCase()==="NÃO SE APLICA")return resp({erro:"Documento não aplicável ou sem regra para este tipo de fornecedor."},409);
        if(String(tipo.possuiValidade??"NÃO").toUpperCase()==="SIM"&&!body.dataValidade)return resp({erro:"Data de validade é obrigatória para este tipo documental."},400);
        const extOriginal=(nomeOriginal.split(".").pop()||"").toLowerCase(),mime=String(body.mimeType||"").toLowerCase();const extPermitida=["pdf","jpg","jpeg","png"].includes(extOriginal),mimePermitido=["application/pdf","image/jpeg","image/png"].includes(mime);if(!extPermitida||!mimePermitido)return resp({erro:"Formato não permitido. Envie PDF, JPG, JPEG ou PNG."},415);const bytes=bytesDoBase64(base64);if(bytes.byteLength>RH_DOC_MAX_BYTES)return resp({erro:"O documento excede o limite de 25 MB."},413);
        const {data:docs,error:de}=await sb.from(T_REG).select("registro").eq("colecao","estoque_documentos_fornecedor").eq("apagado",false);if(de)throw de;
        const versoes=(docs??[]).map(x=>x.registro as Record<string,unknown>).filter(d=>String(d.fornecedorId??"")===fornecedorId&&String(d.tipoDocumentoId??"")===tipoDocumentoId).map(d=>Number(d.versao)||0);
        const versao=(versoes.length?Math.max(...versoes):0)+1,id="DOC-"+crypto.randomUUID().slice(0,10).toUpperCase(),agora=new Date().toISOString();
        const ext=nomeOriginal.includes(".")?"."+nomeOriginal.split(".").pop():"", nomeNovo=nomeStorageSeguro(`${fornecedorId}_${String(tipo.nomeDocumento??"DOCUMENTO")}_V${versao}_${agora.slice(0,10).replaceAll("-","")}${ext}`);
        const storagePath=`estoque/fornecedores/${fornecedorId}/${id}-${nomeNovo}`;
        const up=await sb.storage.from(RH_DOC_BUCKET).upload(storagePath,bytes,{contentType:mime,upsert:false});if(up.error)throw up.error;
        const registro:Record<string,unknown>={id,fornecedorId,cnpj:String(body.cnpj??fornecedor.cnpj??""),tipoDocumentoId,tipoDocumento:String(tipo.nomeDocumento??""),dataEmissao:body.dataEmissao||"",dataValidade:body.dataValidade||"",possuiValidade:String(tipo.possuiValidade??"NÃO"),versao,observacao:String(body.observacao??""),ativo:"SIM",usuarioRegistro:usuario,dataRegistro:agora,createdAt:agora,referencia:String(body.referencia??""),storageBucket:RH_DOC_BUCKET,storagePath,nomeArquivo:nomeNovo,tipoMime:mime,tamanhoArquivo:bytes.byteLength,dataUpload:agora,atualizadoPor:usuario,atualizadoEm:agora};
        const {error:ie}=await sb.from(T_REG).insert({colecao:"estoque_documentos_fornecedor",id,registro,apagado:false,atualizado_em:agora});if(ie){await sb.storage.from(RH_DOC_BUCKET).remove([storagePath]);throw ie}
        await bump("estoque_documentos_fornecedor");return resp({ok:true,documento:registro});
      }

      case "estoqueDocumentoUrl": {
        if (!podeConsultarColecao("estoque_documentos_fornecedor")) return resp({erro:"Sem acesso aos documentos.",semPermissao:true},403);
        const id=String(body.id??"");const {data,error}=await sb.from(T_REG).select("registro,apagado").eq("colecao","estoque_documentos_fornecedor").eq("id",id).maybeSingle();if(error)throw error;if(!data||data.apagado)return resp({erro:"Documento não encontrado."},404);
        const d=data.registro as Record<string,unknown>;if(d.storageBucket&&d.storagePath){const {data:u,error:ue}=await sb.storage.from(String(d.storageBucket)).createSignedUrl(String(d.storagePath),3600);if(ue)throw ue;return resp({url:u?.signedUrl??null,expiraEmSegundos:3600})}
        if(d.driveUrl)return resp({url:String(d.driveUrl),legado:true});return resp({erro:"Documento sem arquivo vinculado."},404);
      }

      case "estoqueSalvar": {
        const colecao = String(body.colecao ?? "");
        const registro = body.registro as Record<string, unknown>;
        const mapa: Record<string,string> = {
          estoque_produtos_base:"cadastro-insumo", estoque_fornecedores:"fornecedores",
          estoque_avaliacoes_fornecedor:"fornecedores", estoque_fapes:"fornecedores",
          estoque_tipos_documentos_fornecedor:"configuracoes", estoque_regras_documentos_fornecedor:"configuracoes",
          estoque_documentos_fornecedor:"fornecedores", estoque_pedidos:"pedido-compra",
          estoque_inspecoes:"pedido-compra", estoque_config:"configuracoes",
          estoque_historico_produto_base:"cadastro-insumo", estoque_logs_compras:"pedido-compra"
        };
        const secao = mapa[colecao];
        if (!secao || !podeEditarEstoque(secao) || !podeConsultarColecao(colecao)) return resp({ erro:"Seu acesso lê, mas não edita esta parte da Gestão de Estoque.", semPermissao:true },403);
        if (!registro?.id) registro.id = crypto.randomUUID();
        registro.atualizadoPor = usuario || "maquina"; registro.atualizadoEm = new Date().toISOString();
        const { data,error } = await sb.from(T_REG).upsert({colecao,id:String(registro.id),registro,apagado:false,atualizado_em:new Date().toISOString()}).select("registro").maybeSingle();
        if(error) throw error; await bump(colecao); return resp({ok:true,registro:data?.registro??registro});
      }

      case "estoquePedidoExcluir": {
        if (!podeEditarEstoque("pedido-compra")) return resp({ erro: "Seu acesso lê, mas não edita.", semPermissao: true }, 403);
        if (!podeConsultarColecao("estoque_pedidos")) return resp({ erro: "Você não tem acesso aos pedidos de compra.", semPermissao: true }, 403);
        const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String).filter(Boolean))] : [];
        if (!ids.length || ids.length > 100) return resp({ erro: "Informe de 1 a 100 itens do pedido." }, 400);
        const { data: linhas, error: buscaErro } = await sb.from(T_REG).select("id,registro,apagado").eq("colecao","estoque_pedidos").in("id",ids);
        if (buscaErro) throw buscaErro;
        const ativas = (linhas ?? []).filter(x => !x.apagado);
        if (ativas.length !== ids.length) return resp({ erro: "O pedido mudou ou possui item não encontrado. Atualize a tela e tente novamente." }, 409);
        if (ativas.some(x => String((x.registro as Record<string,unknown>)?.status ?? "PENDENTE").toUpperCase() !== "PENDENTE")) {
          return resp({ erro: "Somente pedidos PENDENTES podem ser excluídos." }, 409);
        }
        const agora = new Date().toISOString();
        for (const x of ativas) {
          const registro = { ...(x.registro as Record<string,unknown>), atualizadoPor: usuario || "maquina", atualizadoEm: agora };
          const { error } = await sb.from(T_REG).update({ registro, apagado:true, atualizado_em:agora }).eq("colecao","estoque_pedidos").eq("id",x.id).eq("apagado",false);
          if (error) throw error;
        }
        await bump("estoque_pedidos");
        return resp({ ok:true, excluidos:ativas.length });
      }

      case "estoqueEntrada": {
        if (!podeEditarEstoque("entrada-lote")) return resp({ erro: "Seu acesso lê, mas não edita.", semPermissao: true }, 403);
        if (!podeConsultarColecao("estoque_lotes") || !podeConsultarColecao("estoque_movimentos")) {
          return resp({ erro: "Você não tem acesso à entrada de estoque.", semPermissao: true }, 403);
        }
        const lote = body.lote as Record<string, unknown>;
        if (!lote?.id || !lote?.produto || !lote?.lote) return resp({ erro: "Produto, lote e identificador são obrigatórios." }, 400);
        const total = Number(lote.totalRecebido ?? lote.totalAtual ?? 0);
        if (!Number.isFinite(total) || total <= 0) return resp({ erro: "A quantidade recebida deve ser maior que zero." }, 400);
        const agora = new Date().toISOString();
        lote.totalRecebido = total; lote.qtdRetirada = 0; lote.totalAtual = total;
        lote.atualizadoPor = usuario; lote.atualizadoEm = agora;
        const movimento = {
          ...(body.movimento as Record<string, unknown> || {}),
          id: String((body.movimento as Record<string, unknown>)?.id || crypto.randomUUID()),
          loteId: String(lote.id), produto: lote.produto, lote: lote.lote,
          tipo: "ENTRADA", acao: "CADASTRO NOVO", quantidade: total,
          criadoEm: agora, atualizadoPor: usuario, atualizadoEm: agora,
        };
        const { data: gravado, error } = await sb.rpc("ml_estoque_movimentar", { p_acao: "entrada", p_lote: lote, p_movimento: movimento });
        if (error) throw error;
        await bump("estoque_lotes"); await bump("estoque_movimentos");
        return resp(gravado ?? { ok: true, lote, movimento });
      }

      case "estoqueRetirada": {
        if (!podeEditarEstoque("retirada-baixa")) return resp({ erro: "Seu acesso lê, mas não edita.", semPermissao: true }, 403);
        if (!podeConsultarColecao("estoque_lotes") || !podeConsultarColecao("estoque_movimentos")) {
          return resp({ erro: "Você não tem acesso à saída de estoque.", semPermissao: true }, 403);
        }
        const loteId = String(body.loteId ?? "");
        const quantidade = Number(body.quantidade ?? 0);
        if (!loteId || !Number.isFinite(quantidade) || quantidade <= 0) return resp({ erro: "Lote e quantidade válida são obrigatórios." }, 400);
        const { data: linha, error: buscaErro } = await sb.from(T_REG).select("registro, apagado").eq("colecao","estoque_lotes").eq("id",loteId).maybeSingle();
        if (buscaErro) throw buscaErro;
        if (!linha || linha.apagado) return resp({ erro: "Lote não encontrado." }, 404);
        const lote = { ...(linha.registro as Record<string, unknown>) };
        const saldo = Number(lote.totalAtual ?? lote.qtdAtual ?? 0);
        if (saldo <= 0) return resp({ erro: "Este lote está sem saldo." }, 409);
        if (quantidade > saldo) return resp({ erro: "Quantidade solicitada maior que o saldo disponível." }, 409);
        const hoje = new Date().toISOString().slice(0,10);
        if (lote.validade && String(lote.validade).slice(0,10) < hoje) return resp({ erro: "Lote vencido não pode ser utilizado." }, 409);
        const agora = new Date().toISOString();
        lote.qtdRetirada = Number(lote.qtdRetirada ?? 0) + quantidade;
        lote.totalAtual = saldo - quantidade;
        lote.ultimaRetirada = agora;
        if (body.dataAbertura && !lote.dataAbertura) lote.dataAbertura = String(body.dataAbertura);
        lote.atualizadoPor = usuario; lote.atualizadoEm = agora;
        const movimento = {
          id: crypto.randomUUID(), loteId, codigoID: lote.codigoID ?? lote.codigoAuto,
          produto: lote.produto, lote: lote.lote, unidade: lote.unidade,
          tipo: "SAIDA", acao: "RETIRADA (BAIXA)", quantidade,
          observacao: String(body.observacao ?? ""), dataAbertura: body.dataAbertura || null,
          criadoEm: agora, atualizadoPor: usuario, atualizadoEm: agora,
        };
        const { data: gravado, error } = await sb.rpc("ml_estoque_movimentar", { p_acao: "retirada", p_lote: lote, p_movimento: movimento });
        if (error) {
          if (String(error.message || "").includes("saldo")) return resp({ erro: error.message }, 409);
          throw error;
        }
        await bump("estoque_lotes"); await bump("estoque_movimentos");
        return resp(gravado ?? { ok:true, lote, movimento });
      }

      case "upsert": {
        if (!podeEscrever) return resp({ erro: "Seu acesso lê, mas não edita.", semPermissao: true }, 403);
        const colecao = String(body.colecao ?? "");
        const registro = body.registro as Record<string, unknown>;
        if (!colecao || !registro?.id) return resp({ erro: "colecao e registro.id obrigatórios." }, 400);
        if (ehColecaoRH(colecao) && !ehDirecao) {
          return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);
        }
        // Carimbo no ato: quem gravou e quando ficam NO registro, decididos
        // aqui — dedução depois já produziu 118 falsos positivos na Impresilk.
        registro.atualizadoPor = usuario || "maquina";
        registro.atualizadoEm = new Date().toISOString();
        const { data, error } = await sb
          .from(T_REG)
          .upsert({ colecao, id: String(registro.id), registro, apagado: false, atualizado_em: new Date().toISOString() })
          .select("registro")
          .maybeSingle();
        if (error) throw error;
        await bump(colecao);
        // Devolve o registro COMO FICOU: a tela confere o efeito, não a ausência de erro.
        return resp({ ok: true, registro: data?.registro ?? null });
      }

      case "delete": {
        if (!podeEscrever) return resp({ erro: "Seu acesso lê, mas não edita.", semPermissao: true }, 403);
        const colecao = String(body.colecao ?? "");
        const id = String(body.id ?? "");
        if (ehColecaoRH(colecao) && !ehDirecao) {
          return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);
        }
        const agora = new Date().toISOString();
        // Lápide, nunca DELETE: quem estava offline precisa saber que morreu.
        const { error } = await sb
          .from(T_REG)
          .upsert({ colecao, id, registro: { id, _apagado: true, atualizadoPor: usuario, atualizadoEm: agora }, apagado: true, atualizado_em: agora });
        if (error) throw error;
        await bump(colecao);
        return resp({ ok: true });
      }

      
      // ---------------- RH / PONTO — ações aditivas ----------------
      case "rhDocumentoListar": {
        if (!ehDirecao) return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);
        let q = sb.from("rh_documentos").select("*").neq("status", "SUBSTITUIDO").order("created_at", { ascending: false });
        if (body.pessoaId) q = q.eq("pessoa_id", String(body.pessoaId));
        if (body.tipo) q = q.eq("tipo", String(body.tipo));
        const { data, error } = await q;
        if (error) throw error;
        return resp({ documentos: data ?? [] });
      }

      case "rhDocumentoUpload": {
        if (!ehDirecao) return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);
        const pessoaId = String(body.pessoaId ?? "");
        const tipo = String(body.tipo ?? "").trim();
        const nomeOriginal = String(body.nomeOriginal ?? "").trim();
        const base64 = String(body.arquivoBase64 ?? "");
        if (!pessoaId || !tipo || !nomeOriginal || !base64) return resp({ erro: "pessoaId, tipo, nomeOriginal e arquivo são obrigatórios." }, 400);
        const bytes = bytesDoBase64(base64);
        if (bytes.byteLength > RH_DOC_MAX_BYTES) return resp({ erro: "O documento excede o limite de 25 MB." }, 413);
        const id = crypto.randomUUID();
        const path = `rh/${pessoaId}/${id}-${nomeStorageSeguro(nomeOriginal)}`;
        const upload = await sb.storage.from(RH_DOC_BUCKET).upload(path, bytes, { contentType: String(body.mimeType || "application/octet-stream"), upsert: false });
        if (upload.error) throw upload.error;
        const { data, error } = await sb.from("rh_documentos").insert({
          id, pessoa_id: pessoaId, empresa: body.empresa ? String(body.empresa) : null,
          tipo, nome_original: nomeOriginal, storage_bucket: RH_DOC_BUCKET, storage_path: path,
          mime_type: body.mimeType ? String(body.mimeType) : null, tamanho_bytes: bytes.byteLength,
          data_emissao: body.dataEmissao || null, data_realizacao: body.dataRealizacao || null,
          validade: body.validade || null, status: body.status || "PENDENTE",
          leitura_status: body.leituraStatus || "REQUER_CONFERENCIA",
          dados_extraidos: body.dadosExtraidos && typeof body.dadosExtraidos === "object" ? body.dadosExtraidos : {},
          observacoes: body.observacoes ? String(body.observacoes) : null, criado_por: usuario, atualizado_por: usuario
        }).select("*").single();
        if (error) {
          await sb.storage.from(RH_DOC_BUCKET).remove([path]);
          throw error;
        }
        await sb.from("rh_documento_eventos").insert({ documento_id: id, pessoa_id: pessoaId, evento: "DOCUMENTO_ENVIADO", dados: { nome_original: nomeOriginal, tipo }, usuario });
        await gravarPontoAuditoria("DOCUMENTO_ENVIADO", { documento_id: id, pessoa_id: pessoaId }, usuario);
        return resp({ ok: true, documento: data });
      }


      case "rhDocumentoExcluir": {
        if (!ehDirecao) return resp({ erro: "Somente a direção pode excluir documentos.", semPermissao: true }, 403);
        const id = String(body.documentoId ?? "");
        const { data: doc, error: de } = await sb.from("rh_documentos").select("id,pessoa_id,nome_original,tipo,status").eq("id", id).maybeSingle();
        if (de) throw de;
        if (!doc) return resp({ erro: "Documento não encontrado." }, 404);
        const { error } = await sb.from("rh_documentos").update({
          status: "SUBSTITUIDO", atualizado_por: usuario, observacoes: "Retirado pelo usuário; original preservado no Storage."
        }).eq("id", id);
        if (error) throw error;
        await sb.from("rh_documento_eventos").insert({ documento_id: id, pessoa_id: doc.pessoa_id, evento: "DOCUMENTO_RETIRADO", dados: { nome_original: doc.nome_original, tipo: doc.tipo }, usuario });
        await gravarPontoAuditoria("DOCUMENTO_RETIRADO", { documento_id: id, pessoa_id: doc.pessoa_id }, usuario);
        return resp({ ok: true, preservado: true });
      }

      case "rhDocumentoConfirmarPreenchimento": {
        if (!ehDirecao) return resp({ erro: "Somente a direção pode confirmar dados do RH.", semPermissao: true }, 403);
        const pessoaId = String(body.pessoaId ?? "");
        const documentoId = String(body.documentoId ?? "");
        const confirmados = body.dadosConfirmados && typeof body.dadosConfirmados === "object" ? body.dadosConfirmados : {};
        if (!pessoaId || !documentoId) return resp({ erro: "Documento e funcionário são obrigatórios." }, 400);
        const { data: atual, error: ae } = await sb.from(T_REG).select("registro,apagado").eq("colecao","rh_pessoas").eq("id",pessoaId).maybeSingle();
        if (ae) throw ae;
        if (!atual || atual.apagado) return resp({ erro: "Funcionário não encontrado." }, 404);
        const registro = { ...(atual.registro as Record<string, unknown>) };
        const alterados: Record<string, unknown> = {};
        for (const [campo, valor] of Object.entries(confirmados)) {
          if (!RH_CAMPOS_CONFIRMAVEIS.has(campo) || valor === null || valor === undefined || String(valor).trim() === "") continue;
          alterados[campo] = valor;
          registro[campo] = valor;
        }
        registro.admissaoConferida = true;
        registro.atualizadoPor = usuario;
        registro.atualizadoEm = new Date().toISOString();
        const { data: pessoa, error: pe } = await sb.from(T_REG).upsert({
          colecao:"rh_pessoas", id:pessoaId, registro, apagado:false, atualizado_em:new Date().toISOString()
        }).select("registro").single();
        if (pe) throw pe;
        const { error: de } = await sb.from("rh_documentos").update({
          status:"CONFIRMADO", leitura_status:"CONCLUIDA", dados_extraidos: alterados, atualizado_por: usuario
        }).eq("id", documentoId).eq("pessoa_id", pessoaId);
        if (de) throw de;
        await bump("rh_pessoas");
        await sb.from("rh_documento_eventos").insert({ documento_id:documentoId, pessoa_id:pessoaId, evento:"DADOS_CONFIRMADOS", dados:{alterados}, usuario });
        await gravarPontoAuditoria("DADOS_DOCUMENTAIS_CONFIRMADOS", { documento_id:documentoId, pessoa_id:pessoaId, campos:Object.keys(alterados) }, usuario);
        return resp({ ok:true, pessoa:pessoa?.registro ?? registro, camposAlterados:Object.keys(alterados) });
      }

      case "rhDocumentoUrl": {
        if (!ehDirecao) return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);
        const id = String(body.documentoId ?? "");
        const { data: doc, error: de } = await sb.from("rh_documentos").select("storage_bucket,storage_path").eq("id", id).maybeSingle();
        if (de) throw de;
        if (!doc) return resp({ erro: "Documento não encontrado." }, 404);
        const { data, error } = await sb.storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, 3600);
        if (error) throw error;
        return resp({ url: data?.signedUrl ?? null, expiraEmSegundos: 3600 });
      }

      case "rhDocumentoAtualizar": {
        if (!ehDirecao) return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);
        const id = String(body.documentoId ?? "");
        const campos: Record<string, unknown> = {};
        for (const k of ["tipo","empresa","data_emissao","data_realizacao","validade","status","leitura_status","observacoes","dados_extraidos","atualizado_por"]) {
          if (body[k] !== undefined) campos[k] = k === "atualizado_por" ? usuario : body[k];
        }
        const { data, error } = await sb.from("rh_documentos").update(campos).eq("id", id).select("*").maybeSingle();
        if (error) throw error;
        if (!data) return resp({ erro: "Documento não encontrado." }, 404);
        await sb.from("rh_documento_eventos").insert({ documento_id: id, pessoa_id: data.pessoa_id, evento: "DADOS_ATUALIZADOS", dados: campos, usuario });
        await gravarPontoAuditoria("DOCUMENTO_ATUALIZADO", { documento_id: id, pessoa_id: data.pessoa_id, campos }, usuario);
        return resp({ ok: true, documento: data });
      }

      case "rhBancoListar": {
        if (!ehDirecao) return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);
        let q = sb.from("rh_banco_horas_movimentos").select("*").order("data_movimento", { ascending: true }).order("created_at", { ascending: true });
        if (body.pessoaId) q = q.eq("pessoa_id", String(body.pessoaId));
        if (body.competencia) q = q.eq("competencia", String(body.competencia));
        const { data, error } = await q;
        if (error) throw error;
        const pessoaId = String(body.pessoaId || "");
        return resp({ movimentos: data ?? [], saldoMinutos: pessoaId ? await saldoBancoPessoa(pessoaId) : null });
      }

      case "rhBancoRegistrar": {
        if (!ehDirecao) return resp({ erro: "Somente a direção pode lançar banco de horas.", semPermissao: true }, 403);
        const pessoaId = String(body.pessoaId ?? "");
        const competencia = String(body.competencia ?? "");
        const dataMovimento = String(body.dataMovimento ?? "");
        const tipo = String(body.tipo ?? "").trim();
        const motivo = String(body.motivo ?? "").trim();
        const credito = Math.max(0, Number(body.creditoMinutos || 0));
        const debito = Math.max(0, Number(body.debitoMinutos || 0));
        if (!pessoaId || !competencia || !dataMovimento || !tipo || !motivo || (credito <= 0 && debito <= 0) || (credito > 0 && debito > 0)) return resp({ erro: "Informe funcionário, competência, data, tipo, motivo e uma única quantidade de crédito ou débito." }, 400);
        const { data, error } = await sb.from("rh_banco_horas_movimentos").insert({
          pessoa_id: pessoaId, empresa: body.empresa ? String(body.empresa) : null, competencia, data_movimento: dataMovimento,
          tipo, credito_minutos: credito, debito_minutos: debito, motivo, observacao: body.observacao ? String(body.observacao) : null,
          origem: body.origem || "MANUAL", estorna_id: body.estornaId || null, criado_por: usuario
        }).select("*").single();
        if (error) throw error;
        const saldoMinutos = await saldoBancoPessoa(pessoaId);
        await gravarPontoAuditoria("BANCO_HORAS_MOVIMENTADO", { movimento_id: data.id, pessoa_id: pessoaId, credito, debito, tipo, motivo }, usuario);
        return resp({ ok: true, movimento: data, saldoMinutos });
      }

      case "rhFolhaBuscar": {
        if (!ehDirecao) return resp({ erro: "Estas informações são só da direção.", semPermissao: true }, 403);
        const { data, error } = await sb.from("rh_folhas_ponto").select("*").eq("pessoa_id", String(body.pessoaId ?? "")).eq("competencia", String(body.competencia ?? "")).maybeSingle();
        if (error) throw error;
        return resp({ folha: data ?? null });
      }

      case "rhFolhaSalvar": {
        if (!ehDirecao) return resp({ erro: "Somente a direção pode gerar ou fechar a Folha.", semPermissao: true }, 403);
        const pessoaId = String(body.pessoaId ?? "");
        const competencia = String(body.competencia ?? "");
        const snapshot = body.dadosSnapshot && typeof body.dadosSnapshot === "object" ? body.dadosSnapshot : {};
        if (!pessoaId || !competencia) return resp({ erro: "pessoaId e competência são obrigatórios." }, 400);
        const status = body.status === "FECHADA" ? "FECHADA" : "ABERTA";
        const payload: Record<string, unknown> = {
          pessoa_id: pessoaId, empresa: body.empresa ? String(body.empresa) : null, competencia, status, dados_snapshot: snapshot,
          gerada_em: new Date().toISOString(), gerada_por: usuario
        };
        if (status === "FECHADA") { payload.fechada_em = new Date().toISOString(); payload.fechada_por = usuario; }
        const { data, error } = await sb.from("rh_folhas_ponto").upsert(payload, { onConflict: "pessoa_id,empresa,competencia" }).select("*").single();
        if (error) throw error;
        await gravarPontoAuditoria(status === "FECHADA" ? "FOLHA_FECHADA" : "FOLHA_GERADA", { folha_id: data.id, pessoa_id: pessoaId, competencia }, usuario);
        return resp({ ok: true, folha: data });
      }

      // ================================================================
      // FINANCEIRO — RECEBIMENTOS COMPLETO
      // MinasLab + M Lab.
      // Somente a direção acessa.
      // Registros OMIE não podem ser alterados/excluídos manualmente.
      // Exclusão sempre lógica.
      // ================================================================

      case "finRecebimentosOpcoes": {
        if (!ehDirecao) {
          return resp({ erro: "As informações financeiras são somente da direção.", semPermissao: true }, 403);
        }

        const [re, rc, rb] = await Promise.all([
          sb.from("empresas").select("*").order("nome"),
          sb.from("categorias_financeiras").select("*").order("nome"),
          sb.from("contas_bancarias").select("*").order("nome"),
        ]);

        if (re.error) throw re.error;
        if (rc.error) throw rc.error;
        if (rb.error) throw rb.error;

        return resp({
          empresas: re.data ?? [],
          categorias: rc.data ?? [],
          contas: rb.data ?? [],
        });
      }

      case "finRecebimentosListar": {
        if (!ehDirecao) {
          return resp({ erro: "As informações financeiras são somente da direção.", semPermissao: true }, 403);
        }

        const empresaId = String(body.empresaId ?? "").trim();
        const limite = Math.min(Math.max(Number(body.limite ?? 500), 1), 1000);

        let q = sb
          .from("recebimentos")
          .select(`
            *,
            empresa:empresas(id, nome),
            categoria:categorias_financeiras(id, nome),
            conta_bancaria:contas_bancarias(id, nome)
          `)
          .eq("apagado", false)
          .order("data_vencimento", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(limite);

        if (empresaId) q = q.eq("empresa_id", empresaId);

        const { data, error } = await q;
        if (error) throw error;
        return resp({ recebimentos: data ?? [] });
      }

      case "finRecebimentoSalvar": {
        if (!ehDirecao) {
          return resp({ erro: "Somente a direção pode alterar recebimentos.", semPermissao: true }, 403);
        }

        const registro = (body.registro ?? {}) as Record<string, unknown>;
        const id = String(registro.id ?? "").trim();
        const empresaId = String(registro.empresa_id ?? "").trim();
        const cliente = String(registro.cliente ?? "").trim();

        if (!empresaId) return resp({ erro: "Informe a empresa." }, 400);
        if (!cliente) return resp({ erro: "Informe o cliente." }, 400);

        const valorPrevisto = Number(registro.valor_previsto ?? 0);
        let valorRecebido = Number(registro.valor_recebido ?? 0);
        if (!Number.isFinite(valorPrevisto) || !Number.isFinite(valorRecebido)) {
          return resp({ erro: "Valor financeiro inválido." }, 400);
        }
        if (valorPrevisto < 0 || valorRecebido < 0) {
          return resp({ erro: "Os valores não podem ser negativos." }, 400);
        }

        let status = String(registro.status ?? "A RECEBER").trim().toUpperCase();
        if (["RECEBIDO", "LIQUIDADO"].includes(status)) status = "PAGO";
        if (["A_RECEBER", "ARECEBER", "EM ABERTO", "EMABERTO", "A VENCER", "AVENCER"].includes(status)) status = "A RECEBER";
        if (["CANCELADA"].includes(status)) status = "CANCELADO";
        if (!["A RECEBER", "PAGO", "PARCIAL", "VENCIDO", "CANCELADO"].includes(status)) status = "A RECEBER";

        let valorPendente = Math.max(valorPrevisto - valorRecebido, 0);
        let dataPagamento = registro.data_pagamento || null;

        if (status === "PAGO") {
          valorRecebido = valorPrevisto;
          valorPendente = 0;
        } else if (status === "CANCELADO") {
          valorRecebido = 0;
          valorPendente = 0;
          dataPagamento = null;
        } else if (status === "A RECEBER" || status === "VENCIDO") {
          valorRecebido = 0;
          valorPendente = valorPrevisto;
          dataPagamento = null;
        } else if (status === "PARCIAL") {
          if (valorRecebido <= 0 || valorRecebido >= valorPrevisto) {
            return resp({ erro: "Para status PARCIAL, informe um valor recebido maior que zero e menor que o valor previsto." }, 400);
          }
          valorPendente = valorPrevisto - valorRecebido;
        }

        const agora = new Date().toISOString();
        const base: Record<string, unknown> = {
          empresa_id: empresaId,
          cliente,
          cnpj_cpf: registro.cnpj_cpf || null,
          descricao: registro.descricao || null,
          valor_previsto: valorPrevisto,
          valor_recebido: valorRecebido,
          valor_pendente: valorPendente,
          data_vencimento: registro.data_vencimento || null,
          data_pagamento: dataPagamento,
          status,
          categoria_id: registro.categoria_id || null,
          conta_bancaria_id: registro.conta_bancaria_id || null,
          categoria_texto: registro.categoria_texto || null,
          conta_bancaria_texto: registro.conta_bancaria_texto || null,
          forma_pagamento: registro.forma_pagamento || null,
          numero_nf: registro.numero_nf || null,
          observacao: registro.observacao || null,
          updated_by: usuario || "maquina",
          updated_at: agora,
        };

        if (id) {
          const { data: atual, error: erroAtual } = await sb
            .from("recebimentos")
            .select("id, origem, apagado")
            .eq("id", id)
            .maybeSingle();

          if (erroAtual) throw erroAtual;
          if (!atual || atual.apagado) return resp({ erro: "Recebimento não encontrado." }, 404);
          if (String(atual.origem ?? "").toUpperCase() === "OMIE") {
            return resp({ erro: "Este recebimento é controlado pela Omie e não pode ser alterado manualmente." }, 409);
          }

          const { data, error } = await sb
            .from("recebimentos")
            .update(base)
            .eq("id", id)
            .eq("apagado", false)
            .select(`*, empresa:empresas(id,nome), categoria:categorias_financeiras(id,nome), conta_bancaria:contas_bancarias(id,nome)`)
            .maybeSingle();

          if (error) throw error;
          if (!data) return resp({ erro: "O servidor não confirmou a alteração." }, 500);
          return resp({ ok: true, recebimento: data });
        }

        const { data, error } = await sb
          .from("recebimentos")
          .insert({
            ...base,
            origem: "MANUAL",
            apagado: false,
            created_by: usuario || "maquina",
            created_at: agora,
          })
          .select(`*, empresa:empresas(id,nome), categoria:categorias_financeiras(id,nome), conta_bancaria:contas_bancarias(id,nome)`)
          .maybeSingle();

        if (error) throw error;
        if (!data) return resp({ erro: "O servidor não confirmou a gravação." }, 500);
        return resp({ ok: true, recebimento: data });
      }

      case "finRecebimentoLiquidar": {
        if (!ehDirecao) {
          return resp({ erro: "Somente a direção pode dar baixa em recebimentos.", semPermissao: true }, 403);
        }

        const id = String(body.id ?? "").trim();
        const dataPagamento = String(body.dataPagamento ?? "").trim();
        if (!id) return resp({ erro: "Informe o recebimento." }, 400);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) return resp({ erro: "Informe uma data de recebimento válida." }, 400);

        const { data: atual, error: erroAtual } = await sb
          .from("recebimentos")
          .select("id, origem, apagado, valor_previsto, status")
          .eq("id", id)
          .maybeSingle();

        if (erroAtual) throw erroAtual;
        if (!atual || atual.apagado) return resp({ erro: "Recebimento não encontrado." }, 404);
        if (String(atual.origem ?? "").toUpperCase() === "OMIE") {
          return resp({ erro: "Este recebimento é controlado pela Omie e deve ser atualizado pela integração." }, 409);
        }
        if (String(atual.status ?? "").toUpperCase() === "CANCELADO") {
          return resp({ erro: "Um recebimento cancelado não pode ser liquidado." }, 409);
        }

        const agora = new Date().toISOString();
        const { data, error } = await sb
          .from("recebimentos")
          .update({
            valor_recebido: Number(atual.valor_previsto || 0),
            valor_pendente: 0,
            data_pagamento: dataPagamento,
            status: "PAGO",
            updated_by: usuario || "maquina",
            updated_at: agora,
          })
          .eq("id", id)
          .eq("apagado", false)
          .select(`*, empresa:empresas(id,nome), categoria:categorias_financeiras(id,nome), conta_bancaria:contas_bancarias(id,nome)`)
          .maybeSingle();

        if (error) throw error;
        if (!data) return resp({ erro: "O servidor não confirmou a baixa." }, 500);
        return resp({ ok: true, recebimento: data });
      }

      case "finRecebimentoExcluir": {
        if (!ehDirecao) {
          return resp({ erro: "Somente a direção pode excluir recebimentos.", semPermissao: true }, 403);
        }

        const id = String(body.id ?? "").trim();
        if (!id) return resp({ erro: "Informe o recebimento." }, 400);

        const { data: atual, error: erroAtual } = await sb
          .from("recebimentos")
          .select("id, origem, apagado")
          .eq("id", id)
          .maybeSingle();

        if (erroAtual) throw erroAtual;
        if (!atual || atual.apagado) return resp({ erro: "Recebimento não encontrado." }, 404);
        if (String(atual.origem ?? "").toUpperCase() === "OMIE") {
          return resp({ erro: "Este recebimento é controlado pela Omie e não pode ser excluído manualmente." }, 409);
        }

        const agora = new Date().toISOString();
        const { data, error } = await sb
          .from("recebimentos")
          .update({
            apagado: true,
            apagado_em: agora,
            apagado_por: usuario || "maquina",
            updated_by: usuario || "maquina",
            updated_at: agora,
          })
          .eq("id", id)
          .eq("apagado", false)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) return resp({ erro: "O servidor não confirmou a exclusão." }, 500);
        return resp({ ok: true, id: data.id });
      }

      case "finRecebimentosImportar": {
        if (!ehDirecao) {
          return resp({ erro: "Somente a direção pode importar recebimentos.", semPermissao: true }, 403);
        }

        const empresaId = String(body.empresaId ?? "").trim();
        const origemArquivo = String(body.origemArquivo ?? "ARQUIVO").trim().toUpperCase().slice(0, 30);
        const itens = Array.isArray(body.itens) ? body.itens as Record<string, unknown>[] : [];

        if (!empresaId) return resp({ erro: "Selecione a empresa da importação." }, 400);
        if (!itens.length) return resp({ erro: "O arquivo não possui registros para importar." }, 400);
        if (itens.length > 1000) return resp({ erro: "Importe no máximo 1000 recebimentos por arquivo." }, 400);

        const agora = new Date().toISOString();
        const linhas: Record<string, unknown>[] = [];

        for (let i = 0; i < itens.length; i++) {
          const item = itens[i] || {};
          const cliente = String(item.cliente ?? "").trim();
          const valorPrevisto = Number(item.valor_previsto ?? 0);
          if (!cliente) return resp({ erro: `Linha ${i + 2}: cliente não informado.` }, 400);
          if (!Number.isFinite(valorPrevisto) || valorPrevisto < 0) return resp({ erro: `Linha ${i + 2}: valor inválido.` }, 400);

          let status = String(item.status ?? "A RECEBER").trim().toUpperCase();
          if (["RECEBIDO", "LIQUIDADO"].includes(status)) status = "PAGO";
          if (["A_RECEBER", "ARECEBER", "EM ABERTO", "EMABERTO", "A VENCER", "AVENCER"].includes(status)) status = "A RECEBER";
          if (status === "CANCELADA") status = "CANCELADO";
          if (!["A RECEBER", "PAGO", "PARCIAL", "VENCIDO", "CANCELADO"].includes(status)) status = "A RECEBER";

          let valorRecebido = Number(item.valor_recebido ?? 0);
          if (!Number.isFinite(valorRecebido) || valorRecebido < 0) valorRecebido = 0;
          let valorPendente = valorPrevisto;
          let dataPagamento = item.data_pagamento || null;

          if (status === "PAGO") {
            valorRecebido = valorPrevisto;
            valorPendente = 0;
            if (!dataPagamento) dataPagamento = item.data_vencimento || null;
          } else if (status === "CANCELADO") {
            valorRecebido = 0;
            valorPendente = 0;
            dataPagamento = null;
          } else if (status === "PARCIAL") {
            valorRecebido = Math.min(Math.max(valorRecebido, 0), valorPrevisto);
            if (valorRecebido <= 0 || valorRecebido >= valorPrevisto) {
              status = "A RECEBER";
              valorRecebido = 0;
              valorPendente = valorPrevisto;
              dataPagamento = null;
            } else {
              valorPendente = valorPrevisto - valorRecebido;
            }
          } else {
            valorRecebido = 0;
            valorPendente = valorPrevisto;
            dataPagamento = null;
          }

          linhas.push({
            empresa_id: empresaId,
            cliente,
            cnpj_cpf: item.cnpj_cpf || null,
            descricao: item.descricao || "Importação de recebimentos",
            valor_previsto: valorPrevisto,
            valor_recebido: valorRecebido,
            valor_pendente: valorPendente,
            data_vencimento: item.data_vencimento || null,
            data_pagamento: dataPagamento,
            status,
            categoria_id: item.categoria_id || null,
            conta_bancaria_id: item.conta_bancaria_id || null,
            categoria_texto: item.categoria_texto || null,
            conta_bancaria_texto: item.conta_bancaria_texto || null,
            forma_pagamento: item.forma_pagamento || null,
            numero_nf: item.numero_nf || null,
            observacao: item.observacao || null,
            origem: "MANUAL",
            importacao_origem: origemArquivo,
            apagado: false,
            created_by: usuario || "maquina",
            updated_by: usuario || "maquina",
            created_at: agora,
            updated_at: agora,
          });
        }

        const { data, error } = await sb
          .from("recebimentos")
          .insert(linhas)
          .select("id");

        if (error) throw error;
        return resp({ ok: true, inseridos: data?.length ?? linhas.length });
      }


      case "getCfg": {
        const { data } = await sb
          .from(T_CFG)
          .select("config")
          .eq("id", true)
          .maybeSingle();

        return resp({ config: data?.config ?? null });
      }

      case "setCfg": {
        if (!ehDirecao) {
          return resp(
            {
              erro: "Só a direção mexe na configuração.",
              semPermissao: true,
            },
            403,
          );
        }

        const { error } = await sb
          .from(T_CFG)
          .upsert({
            id: true,
            config: body.config ?? {},
            atualizado_em: new Date().toISOString(),
          });

        if (error) throw error;

        await bump("cfg");
        return resp({ ok: true });
      }

      /* elenco: porta ESTREITA de propósito. As coleções rh_* são da direção,
         mas a equipe precisa escolher QUEM vai na coleta — então esta ação
         devolve só id, nome e apelido dos ativos. Nome não é folha de
         pagamento; ficha completa continua trancada. */
      case "elenco": {
        const { data, error } = await sb
          .from(T_REG)
          .select("registro, apagado")
          .eq("colecao", "rh_pessoas");
        if (error) throw error;
        const pessoas = (data ?? [])
          .filter((r) => !r.apagado)
          .map((r) => r.registro as Record<string, unknown>)
          .filter((p) => p.ativo !== false)
          .map((p) => ({ id: p.id, nome: p.nome ?? "", apelido: p.apelido ?? "" }))
          .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
        return resp({ pessoas });
      }

      // ---------------- contas (só direção) ----------------
      case "contasListar": {
        if (!ehDirecao) return resp({ erro: "Só a direção administra contas.", semPermissao: true }, 403);
        const { data, error } = await sb.from(T_CONTAS).select("*").order("usuario");
        if (error) throw error;
        return resp({ contas: (data ?? []).map(contaLimpa) });
      }

      case "contaCriar": {
        if (!ehDirecao) return resp({ erro: "Só a direção administra contas.", semPermissao: true }, 403);
        const u = normalizarUsuario(body.usuario);
        const nome = String(body.nome ?? "").trim();
        const papelNovo = String(body.papel ?? "");
        const senha = String(body.senha ?? "");
        const paginas = Array.isArray(body.paginas_consulta) ? body.paginas_consulta : [];
        if (paginas.some((p: unknown) => !PAGINAS_VALIDAS.has(String(p)))) return resp({ erro: "Página não reconhecida." }, 400);
        if (!u || !nome) return resp({ erro: "Informe usuário e nome." }, 400);
        if (!PAPEIS.includes(papelNovo)) return resp({ erro: `Papel desconhecido: ${papelNovo}` }, 400);
        if (senha.length < 6) return resp({ erro: "A senha precisa de ao menos 6 caracteres." }, 400);
        const { data: jaTem } = await sb.from(T_CONTAS).select("usuario").eq("usuario", u).maybeSingle();
        if (jaTem) return resp({ erro: `Já existe a conta "${u}".` }, 409);
        const { data, error } = await sb
          .from(T_CONTAS)
          .insert({ usuario: u, nome, papel: papelNovo, senha: await hashSenha(senha), ativo: true, paginas_consulta: paginas })
          .select("*")
          .maybeSingle();
        if (error) throw error;
        CACHE_ATIVA.delete(u);
        return resp({ ok: true, conta: data ? contaLimpa(data) : null });
      }

      case "contaPaginas": {
        if (!ehDirecao) return resp({ erro: "Só a direção administra acessos.", semPermissao: true }, 403);
        const u = normalizarUsuario(body.usuario);
        const paginas = body.paginas_consulta;
        if (!Array.isArray(paginas) || paginas.some((p: unknown) => !PAGINAS_VALIDAS.has(String(p)))) return resp({ erro: "Selecione páginas válidas." }, 400);
        const { data, error } = await sb.from(T_CONTAS).update({ paginas_consulta: [...new Set(paginas)] }).eq("usuario", u).select("*").maybeSingle();
        if (error) throw error;
        if (!data) return resp({ erro: "Conta não encontrada." }, 404);
        return resp({ ok: true, conta: contaLimpa(data) });
      }

      case "contaSenha": {
        if (!ehDirecao) return resp({ erro: "Só a direção administra contas.", semPermissao: true }, 403);
        const u = normalizarUsuario(body.usuario);
        const senha = String(body.senha ?? "");
        if (senha.length < 6) return resp({ erro: "A senha precisa de ao menos 6 caracteres." }, 400);
        const { data, error } = await sb
          .from(T_CONTAS)
          .update({ senha: await hashSenha(senha) })
          .eq("usuario", u)
          .select("usuario")
          .maybeSingle();
        if (error) throw error;
        if (!data) return resp({ erro: `Não achei a conta "${u}".` }, 404);
        return resp({ ok: true });
      }

      case "contaAtiva": {
        if (!ehDirecao) return resp({ erro: "Só a direção administra contas.", semPermissao: true }, 403);
        const u = normalizarUsuario(body.usuario);
        const ativo = body.ativo === true;
        // A direção não desativa a si mesma: seria trancar a única chave por dentro.
        if (!ativo && u === usuario) return resp({ erro: "Você não pode desativar a própria conta." }, 400);
        const { data, error } = await sb
          .from(T_CONTAS)
          .update({ ativo })
          .eq("usuario", u)
          .select("usuario")
          .maybeSingle();
        if (error) throw error;
        if (!data) return resp({ erro: `Não achei a conta "${u}".` }, 404);
        CACHE_ATIVA.delete(u);
        return resp({ ok: true });
      }

      case "trocarSenha": {
        // A própria pessoa, qualquer papel. Confere a senha atual antes — e
        // com o MESMO freio do login: sem ele, um computador esquecido logado
        // virava oráculo ilimitado da senha vigente (o crachá vale 12h).
        if (ehMaquina) return resp({ erro: "Ação de pessoa, não de máquina." }, 400);
        const senhaAtual = String(body.senhaAtual ?? "");
        const senhaNova = String(body.senhaNova ?? "");
        if (senhaNova.length < 6) return resp({ erro: "A senha nova precisa de ao menos 6 caracteres." }, 400);
        if (await freioEstourado(usuario)) {
          return resp({ erro: "Muitas tentativas seguidas. Espere 15 minutos e tente de novo." }, 429);
        }
        const { data: conta, error: erroConta } = await sb.from(T_CONTAS).select("*").eq("usuario", usuario).maybeSingle();
        if (erroConta) return resp({ erro: "O servidor falhou agora. Tente de novo em instantes." }, 503);
        if (!conta) return resp({ erro: "Sua conta ainda não foi criada na tela de Acessos." }, 404);
        if (!(await conferirSenha(senhaAtual, conta.senha ?? {}))) {
          return resp({ erro: "A senha atual não confere." }, 401);
        }
        await soltarFreio(usuario);
        const { error } = await sb.from(T_CONTAS).update({ senha: await hashSenha(senhaNova) }).eq("usuario", usuario);
        if (error) throw error;
        return resp({ ok: true });
      }

      case "saude": {
        const { count } = await sb.from(T_REG).select("id", { count: "exact", head: true });
        return resp({ ok: true, registros: count ?? 0 });
      }

      default:
        return resp({ erro: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    // supabase-js: o query builder NÃO tem .catch (é thenable) — sempre try/await.
    return resp({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
