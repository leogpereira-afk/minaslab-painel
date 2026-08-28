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
});

const PAPEIS = ["direcao", "equipe", "leitura"];

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
        const token = await assinarJwt({ sub: usuario, nome: conta.nome, papel: conta.papel, sis: SIS }, JWT_SECRET);
        return resp({ token, usuario, nome: conta.nome, papel: conta.papel });
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
    const podeEscrever = ehDirecao || papel === "equipe";

    switch (action) {
      case "rev": {
        const { data } = await sb.from(T_META).select("valor").eq("chave", "rev").maybeSingle();
        return resp({ rev: data?.valor ?? { rev: 0, porColecao: {} } });
      }

      case "list": {
        const colecao = String(body.colecao ?? "");
        if (!colecao) return resp({ erro: "Informe a coleção." }, 400);
        if (ehColecaoRH(colecao) && !ehDirecao) {
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

      case "get": {
        const colecao = String(body.colecao ?? "");
        if (ehColecaoRH(colecao) && !ehDirecao) {
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

      // ================================================================
      // FINANCEIRO — RECEBIMENTOS
      // MinasLab + M Lab.
      // Somente a direção acessa.
      // Exclusão sempre lógica.
      // Registros OMIE não podem ser alterados/excluídos manualmente.
      // ================================================================

      case "finRecebimentosListar": {
        if (!ehDirecao) {
          return resp(
            {
              erro: "As informações financeiras são somente da direção.",
              semPermissao: true,
            },
            403,
          );
        }

        const empresaId = String(body.empresaId ?? "").trim();

        const limite = Math.min(
          Math.max(Number(body.limite ?? 100), 1),
          500,
        );

        let q = sb
          .from("recebimentos")
          .select(`
            *,
            empresa:empresas(id, nome),
            categoria:categorias_financeiras(id, nome),
            conta_bancaria:contas_bancarias(id, nome)
          `)
          .eq("apagado", false)
          .order("data_vencimento", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(limite);

        if (empresaId) {
          q = q.eq("empresa_id", empresaId);
        }

        const { data, error } = await q;

        if (error) throw error;

        return resp({
          recebimentos: data ?? [],
        });
      }

      case "finRecebimentoSalvar": {
        if (!ehDirecao) {
          return resp(
            {
              erro: "Somente a direção pode alterar recebimentos.",
              semPermissao: true,
            },
            403,
          );
        }

        const registro =
          (body.registro ?? {}) as Record<string, unknown>;

        const id = String(registro.id ?? "").trim();
        const empresaId = String(registro.empresa_id ?? "").trim();
        const cliente = String(registro.cliente ?? "").trim();

        if (!empresaId) {
          return resp({ erro: "Informe a empresa." }, 400);
        }

        if (!cliente) {
          return resp({ erro: "Informe o cliente." }, 400);
        }

        const valorPrevisto = Number(registro.valor_previsto ?? 0);
        const valorRecebido = Number(registro.valor_recebido ?? 0);

        if (
          !Number.isFinite(valorPrevisto) ||
          !Number.isFinite(valorRecebido)
        ) {
          return resp({ erro: "Valor financeiro inválido." }, 400);
        }

        if (valorPrevisto < 0 || valorRecebido < 0) {
          return resp(
            { erro: "Os valores não podem ser negativos." },
            400,
          );
        }

        if (valorRecebido > valorPrevisto) {
          return resp(
            {
              erro: "O valor recebido não pode ser maior que o valor previsto.",
            },
            400,
          );
        }

        const agora = new Date().toISOString();

        // ------------------------------------------------------------
        // EDIÇÃO
        // ------------------------------------------------------------

        if (id) {
          const { data: atual, error: erroAtual } = await sb
            .from("recebimentos")
            .select("id, origem, apagado")
            .eq("id", id)
            .maybeSingle();

          if (erroAtual) throw erroAtual;

          if (!atual || atual.apagado) {
            return resp(
              { erro: "Recebimento não encontrado." },
              404,
            );
          }

          // Título controlado pela Omie não deve ser alterado manualmente.
          if (String(atual.origem ?? "").toUpperCase() === "OMIE") {
            return resp(
              {
                erro:
                  "Este recebimento é controlado pela Omie e não pode ser alterado manualmente.",
              },
              409,
            );
          }

          const dadosAtualizacao: Record<string, unknown> = {
            empresa_id: empresaId,
            cliente,
            cnpj_cpf: registro.cnpj_cpf || null,
            descricao: registro.descricao || null,

            valor_previsto: valorPrevisto,
            valor_recebido: valorRecebido,
            valor_pendente: Math.max(
              valorPrevisto - valorRecebido,
              0,
            ),

            data_vencimento: registro.data_vencimento || null,
            data_pagamento: registro.data_pagamento || null,

            status: registro.status || "A RECEBER",

            categoria_id: registro.categoria_id || null,
            conta_bancaria_id: registro.conta_bancaria_id || null,

            numero_nf: registro.numero_nf || null,
            observacao: registro.observacao || null,

            updated_by: usuario || "maquina",
            updated_at: agora,
          };

          const { data, error } = await sb
            .from("recebimentos")
            .update(dadosAtualizacao)
            .eq("id", id)
            .eq("apagado", false)
            .select("*")
            .maybeSingle();

          if (error) throw error;

          if (!data) {
            return resp(
              { erro: "O servidor não confirmou a alteração." },
              500,
            );
          }

          return resp({
            ok: true,
            recebimento: data,
          });
        }

        // ------------------------------------------------------------
        // NOVO RECEBIMENTO MANUAL
        // ------------------------------------------------------------

        const dadosNovo: Record<string, unknown> = {
          empresa_id: empresaId,
          cliente,
          cnpj_cpf: registro.cnpj_cpf || null,
          descricao: registro.descricao || null,

          valor_previsto: valorPrevisto,
          valor_recebido: valorRecebido,
          valor_pendente: Math.max(
            valorPrevisto - valorRecebido,
            0,
          ),

          data_vencimento: registro.data_vencimento || null,
          data_pagamento: registro.data_pagamento || null,

          status: registro.status || "A RECEBER",

          categoria_id: registro.categoria_id || null,
          conta_bancaria_id: registro.conta_bancaria_id || null,

          numero_nf: registro.numero_nf || null,
          observacao: registro.observacao || null,

          origem: "MANUAL",

          apagado: false,

          created_by: usuario || "maquina",
          updated_by: usuario || "maquina",

          created_at: agora,
          updated_at: agora,
        };

        const { data, error } = await sb
          .from("recebimentos")
          .insert(dadosNovo)
          .select("*")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          return resp(
            { erro: "O servidor não confirmou a gravação." },
            500,
          );
        }

        return resp({
          ok: true,
          recebimento: data,
        });
      }

      case "finRecebimentoExcluir": {
        if (!ehDirecao) {
          return resp(
            {
              erro: "Somente a direção pode excluir recebimentos.",
              semPermissao: true,
            },
            403,
          );
        }

        const id = String(body.id ?? "").trim();

        if (!id) {
          return resp(
            { erro: "Informe o recebimento." },
            400,
          );
        }

        // Primeiro verifica o registro.
        const { data: atual, error: erroAtual } = await sb
          .from("recebimentos")
          .select("id, origem, apagado")
          .eq("id", id)
          .maybeSingle();

        if (erroAtual) throw erroAtual;

        if (!atual || atual.apagado) {
          return resp(
            { erro: "Recebimento não encontrado." },
            404,
          );
        }

        // A Omie é dona dos títulos que ela criou.
        if (String(atual.origem ?? "").toUpperCase() === "OMIE") {
          return resp(
            {
              erro:
                "Este recebimento é controlado pela Omie e não pode ser excluído manualmente.",
            },
            409,
          );
        }

        const agora = new Date().toISOString();

        // Exclusão lógica — nunca DELETE físico.
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

        if (!data) {
          return resp(
            { erro: "O servidor não confirmou a exclusão." },
            500,
          );
        }

        return resp({
          ok: true,
          id: data.id,
        });
      }

      case "getCfg": {
        const { data } = await sb.from(T_CFG).select("config").eq("id", true).maybeSingle();
        return resp({ config: data?.config ?? null });
      }
      case "setCfg": {
        if (!ehDirecao) return resp({ erro: "Só a direção mexe na configuração.", semPermissao: true }, 403);
        const { error } = await sb.from(T_CFG).upsert({ id: true, config: body.config ?? {}, atualizado_em: new Date().toISOString() });
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
        if (!u || !nome) return resp({ erro: "Informe usuário e nome." }, 400);
        if (!PAPEIS.includes(papelNovo)) return resp({ erro: `Papel desconhecido: ${papelNovo}` }, 400);
        if (senha.length < 6) return resp({ erro: "A senha precisa de ao menos 6 caracteres." }, 400);
        const { data: jaTem } = await sb.from(T_CONTAS).select("usuario").eq("usuario", u).maybeSingle();
        if (jaTem) return resp({ erro: `Já existe a conta "${u}".` }, 409);
        const { data, error } = await sb
          .from(T_CONTAS)
          .insert({ usuario: u, nome, papel: papelNovo, senha: await hashSenha(senha), ativo: true })
          .select("*")
          .maybeSingle();
        if (error) throw error;
        CACHE_ATIVA.delete(u);
        return resp({ ok: true, conta: data ? contaLimpa(data) : null });
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
