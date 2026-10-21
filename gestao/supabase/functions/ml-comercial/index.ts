// ============================================================================
// ml-comercial — a porta de dados do Comercial MinasLab (repositório gestao).
//
// SÓ LEITURA do CRM. As únicas escritas são as do Destaque do Mês em
// ml_registros: a votação da equipe (rh_comercial_pesquisas) e a avaliação da
// liderança por link (rh_comercial_convites → rh_comercial_destaque).
// Devolve números já somados (propostas por mês e por
// responsável) e a lista de propostas sem responsável. Nunca escreve no CRM,
// nunca devolve dado pessoal de cliente além do nome da empresa.
//
// AUTORIZAÇÃO: o mesmo crachá do painel MinasLab (JWT HS256 assinado pelo
// ml-sync com ML_JWT_SECRET). Conferências, em toda chamada:
//   1) assinatura  2) validade  3) sis === "minaslab"  4) a conta segue ativa
//   5) a PÁGINA liberada para o usuário em Acessos (acessos.mjs): cada leitura
//      e gravação de dados e cada leitura do CRM confere a página. Ninguém
//      entra sem liberação, exceto as donas (DONOS).
// Os dados do sistema (Comercial e Laboratório) passam TODOS por aqui
// (dadosCarregar/dadosGravar/dadosApagar), no mesmo padrão do ml-sync:
// carimbo de quem gravou, lápide em vez de DELETE e aviso de revisão.
// verify_jwt = false de propósito (o preflight CORS chega sem token); a
// autorização é feita aqui dentro. Deploy com --no-verify-jwt.
//
// PROJETO COMPARTILHADO ("Projetos Léo"): o nome leva o prefixo ml_ como o
// resto da MinasLab. Esta função não cria tabela nenhuma.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { agregarPropostas, mesBR, probabilidadesPorIdade, chanceDaIdade, carteiraClientes } from "./agregar.mjs";
import { CRITERIOS_LIDERANCA, MOTIVOS_ELIMINATORIOS, DIAS_CONVITE, conviteValido, validarAvaliacao } from "./lideranca.mjs";
import { somarSetores } from "./setores.mjs";
import { SETORES, CHAVES, PAGINAS, colecaoDe, permissoes, podeLer, podeGravar, podeAcao, limparSetores } from "./acessos.mjs";
import { PERGUNTAS_EQUIPE, PERGUNTAS_GESTAO, validarVoto, aplicarVoto, resultado, gerarCodigos, normalizarCodigo, codigoValido } from "./pesquisa.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("ML_JWT_SECRET") ?? "";
const SIS = "minaslab";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ------------------------------------------------- crachá (mesmo do ml-sync)
const enc = new TextEncoder();
const dec = new TextDecoder();
function bytesFromB64url(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function verificarJwt(token: string): Promise<Record<string, unknown> | null> {
  const partes = String(token || "").split(".");
  if (partes.length !== 3 || !JWT_SECRET) return null;
  try {
    const chave = await crypto.subtle.importKey("raw", enc.encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", chave, bytesFromB64url(partes[2]), enc.encode(`${partes[0]}.${partes[1]}`));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(bytesFromB64url(partes[1])));
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const CACHE_ATIVA = new Map<string, { ate: number; ativa: boolean }>();
async function contaSegueAtiva(usuario: string): Promise<boolean> {
  const agora = Date.now();
  const c = CACHE_ATIVA.get(usuario);
  if (c && c.ate > agora) return c.ativa;
  try {
    const { data, error } = await sb.from("ml_contas").select("ativo").eq("usuario", usuario).maybeSingle();
    if (error) throw error;
    const ativa = data ? data.ativo === true : true; // conta-mestra de bootstrap não existe no banco
    CACHE_ATIVA.set(usuario, { ate: agora + 60_000, ativa });
    return ativa;
  } catch {
    return true; // banco fora não tranca a casa; o crachá continua conferido
  }
}

// ------------------------------------------------- leituras
const CAMPOS_AGREGADO = "responsavel_comercial_id,status,valor,data_envio,data_aceite,created_at,ativo,deleted_at";

async function lerTudo(tabela: string, campos: string, filtro?: (q: any) => any) {
  const linhas: any[] = [];
  for (let de = 0; ; de += 1000) {
    let q = sb.from(tabela).select(campos).order("id", { ascending: true }).range(de, de + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw error;
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

async function nomesClientes(ids: unknown[]) {
  const unicos = [...new Set(ids.filter(Boolean) as string[])];
  const nomes: Record<string, string> = {};
  for (let i = 0; i < unicos.length; i += 200) {
    const { data, error } = await sb.from("clientes").select("id,razao_social,nome_fantasia").in("id", unicos.slice(i, i + 200));
    if (error) throw error;
    for (const c of data ?? []) nomes[c.id] = String(c.nome_fantasia || c.razao_social || "").replace(/\s+/g, " ").trim();
  }
  return nomes;
}

function mesAtualBR() {
  return mesBR(new Date().toISOString())!;
}
function somarMeses(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}


// ------------------------------------------------- votação do Destaque do Mês
// Duas ações PÚBLICAS (sem crachá): votoAbrir e votoEnviar. Só funcionam com
// o id de uma votação ABERTA e um código de uso único ainda não usado. O voto
// é somado nos totais (pesquisa.mjs) e nada que identifique quem votou é
// gravado. As demais ações (criar, listar, encerrar) exigem o crachá da direção.
const COL_PESQ = "rh_comercial_pesquisas";
const T_REG = "ml_registros";

async function hmacCodigo(pesquisa: string, codigo: string) {
  const chave = await crypto.subtle.importKey("raw", enc.encode(`pesquisa:${JWT_SECRET}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", chave, enc.encode(`${pesquisa}:${codigo}`)));
  return btoa(String.fromCharCode(...sig)).replace(/=+$/, "").slice(0, 32);
}

function bytesAleatorios(n: number) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}
function codigosNovos(n: number) {
  let pool = bytesAleatorios(n * 12 + 64);
  let base = 0;
  return gerarCodigos(n, (i: number) => {
    if (i - base >= pool.length) { base = i; pool = bytesAleatorios(256); }
    return pool[i - base];
  });
}
function embaralhar<T>(xs: T[]) {
  const a = [...xs];
  const r = bytesAleatorios(a.length * 4);
  for (let i = a.length - 1; i > 0; i--) {
    const j = new DataView(r.buffer).getUint32((i % a.length) * 4) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// COFRE: somas, marcas de "já votou" e códigos válidos ficam criptografados
// (AES-GCM, chave derivada do segredo do servidor). Assim nem quem lê o banco
// ou a coleção pelo painel vê as notas parciais durante a votação; o
// resultado só sai por esta função, depois de encerrar.
let chaveCofre: CryptoKey | null = null;
async function cofreChave() {
  if (!chaveCofre) {
    const h = await crypto.subtle.digest("SHA-256", enc.encode(`cofre:${JWT_SECRET}`));
    chaveCofre = await crypto.subtle.importKey("raw", h, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  return chaveCofre;
}
const paraB64 = (u8: Uint8Array) => { let t = ""; for (let i = 0; i < u8.length; i += 8192) t += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(t); };
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function fecharCofre(seg: unknown) {
  const iv = bytesAleatorios(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cofreChave(), enc.encode(JSON.stringify(seg))));
  return `${paraB64(iv)}.${paraB64(ct)}`;
}
async function abrirCofre(reg: any) {
  if (!reg?.cofre) return { somas: reg?.somas || {}, usados: reg?.usados || {}, validos: reg?.validos || [] };
  const [iv, ct] = String(reg.cofre).split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv) }, await cofreChave(), deB64(ct));
  return JSON.parse(dec.decode(pt));
}
/** Registro em memória (com somas/usados/validos) → registro gravado (com cofre). */
async function selar(reg: any) {
  const { somas, usados, validos, ...resto } = reg;
  return { ...resto, cofre: await fecharCofre({ somas: somas || {}, usados: usados || {}, validos: validos || [] }) };
}
async function abrirRegistro(gravado: any) {
  const { cofre, ...resto } = gravado || {};
  return { ...resto, ...(await abrirCofre(gravado)) };
}

async function lerPesquisa(id: string) {
  const { data, error } = await sb.from(T_REG).select("registro,atualizado_em,apagado").eq("colecao", COL_PESQ).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || data.apagado) return null;
  return { reg: await abrirRegistro(data.registro), versao: data.atualizado_em as string };
}

/** Grava só se ninguém gravou no meio (versão = atualizado_em lido). */
async function gravarPesquisa(id: string, regAberto: any, versao: string | null) {
  const agora = new Date().toISOString();
  const reg = await selar(regAberto);
  if (versao === null) {
    const { error } = await sb.from(T_REG).insert({ colecao: COL_PESQ, id, registro: reg, apagado: false, atualizado_em: agora });
    if (error) throw error;
    return true;
  }
  const { data, error } = await sb.from(T_REG).update({ registro: reg, atualizado_em: agora }).eq("colecao", COL_PESQ).eq("id", id).eq("atualizado_em", versao).select("id");
  if (error) throw error;
  return (data ?? []).length === 1;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Dois modos:
//  - "codigo": cada voto usa um código de uso único (sorteado em tirinhas);
//  - "aberto": link sem código; a pessoa diz quem é (só para travar o voto
//    repetido e tirar o próprio nome). O servidor guarda apenas um HMAC de
//    "esta pessoa já votou", separado das somas: dá para saber QUE votou,
//    nunca O QUE votou.
async function votar(action: string, body: Record<string, unknown>) {
  const id = String(body.pesquisa ?? "").slice(0, 40);
  if (!/^p[a-z0-9]{6,30}$/.test(id)) { await espera(400); return resp({ erro: "Link de votação inválido." }, 400); }

  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const lida = await lerPesquisa(id);
    if (!lida || lida.reg.status !== "aberta") return resp({ erro: "Esta votação não está aberta." }, 404);
    const { reg, versao } = lida;
    const aberto = reg.modo === "aberto";
    const votantes = [...(reg.avaliados || []), ...(reg.lideres || [])];
    let h = "";
    let eu = "";
    if (!aberto) {
      const codigo = normalizarCodigo(body.codigo);
      if (!codigoValido(codigo)) { await espera(400); return resp({ erro: "Esta votação pede o código de 8 letras e números.", precisaCodigo: true }, 400); }
      h = await hmacCodigo(id, codigo);
      if (!(reg.validos || []).includes(h)) { await espera(400); return resp({ erro: "Código não encontrado. Confira as letras e os números.", precisaCodigo: true }, 403); }
    }

    // Abrir não diz se o código ou a pessoa já votou: a resposta é igual para
    // todos, para ninguém usar o link para descobrir quem já votou.
    if (action === "votoAbrir") {
      const unicos = new Map(votantes.map((p: any) => [p.id, { id: p.id, nome: p.nome }]));
      return resp({
        titulo: reg.titulo, mes: reg.mes, modo: aberto ? "aberto" : "codigo", minimo: reg.minimo || 3,
        avaliados: (reg.avaliados || []).map((p: any) => ({ id: p.id, nome: p.nome })),
        lideres: (reg.lideres || []).map((p: any) => ({ id: p.id, nome: p.nome })),
        votantes: [...unicos.values()],
        perguntasEquipe: PERGUNTAS_EQUIPE, perguntasGestao: PERGUNTAS_GESTAO,
      });
    }

    if (aberto) {
      eu = String(body.eu ?? "");
      if (!votantes.some((p: any) => p.id === eu)) return resp({ erro: "Escolha o seu nome na lista." }, 400);
      h = await hmacCodigo(id, `pessoa:${eu}`);
    }
    // A cédula é conferida ANTES de dizer se já votou: quem só quer sondar
    // (cédula vazia) recebe sempre o mesmo erro.
    const v = validarVoto(reg, body.voto, eu);
    if (v.erro) return resp({ erro: v.erro }, 400);
    if (reg.usados?.[h]) return resp({ erro: aberto ? "Você já votou nesta votação. Se não foi você, fale com a gestão." : "Este código já foi usado. Cada código vale um voto." }, 409);

    const novo = {
      ...reg,
      somas: aplicarVoto(reg.somas, v.limpo, () => bytesAleatorios(1)[0] / 256),
      usados: { ...(reg.usados || {}), [h]: 1 },
      totalVotos: (reg.totalVotos || 0) + 1,
    };
    if (await gravarPesquisa(id, novo, versao)) return resp({ ok: true });
    await espera(80 + Math.floor(bytesAleatorios(1)[0] * 2)); // alguém votou no mesmo instante: lê de novo
  }
  return resp({ erro: "Muita gente votando agora. Tente enviar de novo." }, 503);
}

function semSegredos(reg: any) {
  return {
    id: reg.id, titulo: reg.titulo, mes: reg.mes, status: reg.status, minimo: reg.minimo, modo: reg.modo === "aberto" ? "aberto" : "codigo",
    criadaEm: reg.criadaEm, encerradaEm: reg.encerradaEm || "", criadaPor: reg.criadaPor || "",
    avaliados: reg.avaliados || [], lideres: reg.lideres || [],
    codigos: reg.codigos || [], totalVotos: reg.totalVotos || 0,
    resultado: reg.status === "encerrada" ? resultado(reg) : null,
  };
}

function listaPessoas(x: unknown, max: number) {
  if (!Array.isArray(x)) return [];
  const vistos = new Set<string>();
  return x.slice(0, max).map((p: any) => ({ id: String(p?.id ?? "").slice(0, 60), nome: String(p?.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 80) }))
    .filter((p) => p.id && p.nome && !vistos.has(p.id) && vistos.add(p.id));
}

async function pesquisaDirecao(action: string, body: Record<string, unknown>, usuario: string, perm: any) {
  switch (action) {
    case "pesquisaListar": {
      const { data, error } = await sb.from(T_REG).select("registro").eq("colecao", COL_PESQ).eq("apagado", false);
      if (error) throw error;
      // Os códigos de voto só vão para quem administra o Destaque do mês
      // (quem só vê Reuniões recebe os resultados, nunca os códigos).
      const veCodigos = podeAcao(perm, "pesquisaCodigos");
      const itens = (await Promise.all((data ?? []).map(async (d: any) => {
        const x = semSegredos(d.registro?.status === "encerrada" ? await abrirRegistro(d.registro) : d.registro);
        return veCodigos ? x : { ...x, codigos: [] };
      }))).sort((a, b) => String(b.criadaEm).localeCompare(String(a.criadaEm)));
      return resp({ itens });
    }
    case "pesquisaCriar": {
      const titulo = String(body.titulo ?? "").trim().slice(0, 120);
      const mes = String(body.mes ?? "");
      const avaliados = listaPessoas(body.avaliados, 80);
      const lideres = listaPessoas(body.lideres, 6);
      const modo = body.modo === "aberto" ? "aberto" : "codigo";
      const n = modo === "aberto" ? 0 : Math.min(Math.max(Number(body.codigos ?? 0) | 0, 1), 200);
      const minimo = Math.min(Math.max(Number(body.minimo ?? 3) | 0, 2), 10);
      if (!titulo || !/^\d{4}-\d{2}$/.test(mes)) return resp({ erro: "Informe o título e o mês." }, 400);
      if (!avaliados.length && !lideres.length) return resp({ erro: "Escolha quem será avaliado." }, 400);
      const id = "p" + [...bytesAleatorios(12)].map((b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
      const codigos = n ? codigosNovos(n) : [];
      const validos = embaralhar(await Promise.all(codigos.map((c) => hmacCodigo(id, c))));
      const reg = { id, titulo, mes, modo, status: "aberta", minimo, avaliados, lideres, codigos, validos, usados: {}, totalVotos: 0, somas: {}, criadaEm: new Date().toISOString(), criadaPor: usuario };
      await gravarPesquisa(id, reg, null);
      return resp({ pesquisa: semSegredos(reg) });
    }
    case "pesquisaCodigos":
    case "pesquisaStatus": {
      const id = String(body.id ?? "");
      for (let t = 0; t < 5; t++) {
        const lida = await lerPesquisa(id);
        if (!lida) return resp({ erro: "Votação não encontrada." }, 404);
        let reg = lida.reg;
        if (action === "pesquisaCodigos") {
          if (reg.status !== "aberta" || reg.modo === "aberto") return resp({ erro: "Só dá para gerar códigos em votação aberta com código." }, 400);
          const n = Math.min(Math.max(Number(body.n ?? 0) | 0, 1), 100);
          const novos = codigosNovos(n).filter((c) => !(reg.codigos || []).includes(c));
          const hs = await Promise.all(novos.map((c) => hmacCodigo(id, c)));
          reg = { ...reg, codigos: [...(reg.codigos || []), ...novos], validos: embaralhar([...(reg.validos || []), ...hs]) };
        } else {
          // Encerrar é definitivo: reabrir permitiria comparar o resultado antes
          // e depois de um único voto e descobrir o que aquela pessoa votou.
          if (body.status === "aberta") return resp({ erro: "Votação encerrada não pode ser reaberta (protege o anonimato). Crie uma nova." }, 400);
          if (reg.status === "encerrada") return resp({ pesquisa: semSegredos(reg) });
          reg = { ...reg, status: "encerrada", encerradaEm: new Date().toISOString() };
        }
        if (await gravarPesquisa(id, reg, lida.versao)) return resp({ pesquisa: semSegredos(reg) });
        await espera(100);
      }
      return resp({ erro: "Não consegui gravar agora. Tente de novo." }, 503);
    }
    case "pesquisaApagar": {
      const id = String(body.id ?? "");
      const { error } = await sb.from(T_REG).update({ apagado: true, atualizado_em: new Date().toISOString() }).eq("colecao", COL_PESQ).eq("id", id);
      if (error) throw error;
      return resp({ ok: true });
    }
  }
  return null;
}

// ------------------------------------------------------------------ liderança por link
// Convite = link para UMA pessoa da liderança avaliar UM mês, sem login no
// Comercial. O segredo do link fica só no cofre (criptografado); quem abre vê
// os nomes da lista e as PRÓPRIAS notas, nunca as de outra pessoa. Vence em
// DIAS_CONVITE dias e a direção pode revogar.
const COL_CONV = "rh_comercial_convites";
const COL_DEST = "rh_comercial_destaque";
const ALFA = "abcdefghijkmnpqrstuvwxyz23456789";
const sorteio = (n: number) => [...bytesAleatorios(n)].map((b) => ALFA[b % 32]).join("");

async function lerConviteDoLink(param: unknown) {
  const m = String(param ?? "").match(/^(c[a-z0-9]{12})\.([a-z0-9]{24})$/);
  if (!m) return null;
  const { data, error } = await sb.from(T_REG).select("registro,apagado").eq("colecao", COL_CONV).eq("id", m[1]).maybeSingle();
  if (error) throw error;
  if (!data || data.apagado) return null;
  const conv = data.registro;
  const h = await hmacCodigo(m[1], `convite:${m[2]}`);
  if (conv?.hash !== h || !conviteValido(conv)) return null;
  return conv;
}

async function avaliacoesDoAvaliador(conv: any) {
  const ids = (conv.pessoas || []).map((p: any) => `${conv.mes}_${p.id}_${conv.avaliador}`);
  if (!ids.length) return {};
  const { data, error } = await sb.from(T_REG).select("registro").eq("colecao", COL_DEST).eq("apagado", false).in("id", ids);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((d: any) => [d.registro.pessoaId, { notas: d.registro.notas || {}, eliminatorio: d.registro.eliminatorio || "", obs: d.registro.obs || "" }]));
}

async function liderancaPublica(action: string, body: Record<string, unknown>) {
  const conv = await lerConviteDoLink(body.convite);
  if (!conv) { await espera(400); return resp({ erro: "Este link não vale mais. Peça um novo para a gestão." }, 404); }
  if (action === "liderAbrir") {
    return resp({ avaliadorNome: conv.avaliadorNome, mes: conv.mes, validoAte: conv.validoAte, pessoas: conv.pessoas, criterios: CRITERIOS_LIDERANCA, motivos: MOTIVOS_ELIMINATORIOS, minhas: await avaliacoesDoAvaliador(conv) });
  }
  const v = validarAvaliacao(conv, body);
  if (v.erro) return resp({ erro: v.erro }, 400);
  const agora = new Date().toISOString();
  const { data: antes } = await sb.from(T_REG).select("registro").eq("colecao", COL_DEST).eq("id", v.limpo.id).maybeSingle();
  const registro = { ...v.limpo, criadoEm: antes?.registro?.criadoEm || agora, atualizadoEm: agora, atualizadoPor: conv.avaliador };
  const { error } = await sb.from(T_REG).upsert({ colecao: COL_DEST, id: v.limpo.id, registro, apagado: false, atualizado_em: agora }, { onConflict: "colecao,id" });
  if (error) throw error;
  return resp({ ok: true });
}

async function conviteDirecao(action: string, body: Record<string, unknown>, usuario: string) {
  const semSegredo = async (c: any) => {
    const { cofre, hash, ...resto } = c;
    let link = "";
    try { link = cofre ? `${c.id}.${(await abrirCofre({ cofre })).segredo}` : ""; } catch { link = ""; }
    return { ...resto, link, valido: conviteValido(c) };
  };
  switch (action) {
    case "conviteContas": {
      // Só nome e usuário das contas ativas da direção (para ligar o convite ao login).
      const { data, error } = await sb.from("ml_contas").select("usuario,nome").eq("ativo", true).eq("papel", "direcao");
      if (error) throw error;
      return resp({ contas: (data ?? []).map((c: any) => ({ usuario: c.usuario, nome: c.nome })) });
    }
    case "conviteListar": {
      const { data, error } = await sb.from(T_REG).select("registro").eq("colecao", COL_CONV).eq("apagado", false);
      if (error) throw error;
      const itens = await Promise.all((data ?? []).map((d: any) => semSegredo(d.registro)));
      return resp({ itens: itens.sort((a: any, b: any) => String(b.criadoEm).localeCompare(String(a.criadoEm))) });
    }
    case "conviteCriar": {
      const mes = String(body.mes ?? "");
      const avaliadorNome = String(body.avaliadorNome ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
      const login = String(body.avaliador ?? "").trim().toLowerCase();
      const pessoas = listaPessoas(body.pessoas, 80);
      if (!/^\d{4}-\d{2}$/.test(mes) || !avaliadorNome) return resp({ erro: "Informe o mês e quem vai avaliar." }, 400);
      if (!pessoas.length) return resp({ erro: "Escolha quem será avaliado." }, 400);
      let avaliador = "";
      if (login) {
        const { data } = await sb.from("ml_contas").select("usuario").eq("usuario", login).eq("ativo", true).maybeSingle();
        if (!data) return resp({ erro: "Esse login não existe ou está inativo." }, 400);
        avaliador = login;
      } else {
        avaliador = "link:" + avaliadorNome.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      if (avaliador === usuario) return resp({ erro: "Você já avalia pelo sistema; o link é para outra pessoa da liderança." }, 400);
      const id = "c" + sorteio(12);
      const segredo = sorteio(24);
      const agora = new Date();
      const conv = {
        id, mes, avaliador, avaliadorNome, pessoas, status: "ativo", criadoEm: agora.toISOString(), criadoPor: usuario,
        validoAte: new Date(agora.getTime() + DIAS_CONVITE * 864e5).toISOString(),
        hash: await hmacCodigo(id, `convite:${segredo}`), cofre: await fecharCofre({ segredo }),
      };
      const { error } = await sb.from(T_REG).insert({ colecao: COL_CONV, id, registro: conv, apagado: false, atualizado_em: agora.toISOString() });
      if (error) throw error;
      return resp({ convite: await semSegredo(conv) });
    }
    case "conviteRevogar": {
      const id = String(body.id ?? "");
      const { data, error } = await sb.from(T_REG).select("registro").eq("colecao", COL_CONV).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return resp({ erro: "Link não encontrado." }, 404);
      const reg = { ...data.registro, status: "revogado", revogadoEm: new Date().toISOString(), revogadoPor: usuario };
      const { error: e2 } = await sb.from(T_REG).update({ registro: reg, atualizado_em: new Date().toISOString() }).eq("colecao", COL_CONV).eq("id", id);
      if (e2) throw e2;
      return resp({ convite: await semSegredo(reg) });
    }
  }
  return null;
}

// ------------------------------------------------------------------ acessos e dados
// A lista de acessos fica em ml_meta (chave "gestao_acessos"), tabela que só
// a chave de serviço grava: o painel (ml-sync) grava ali apenas "rev" e o
// freio de login, então ninguém consegue se dar páginas — nem regravar uma
// liberação antiga — pela porta do painel.
const T_META = "ml_meta";
const META_ACESSOS = "gestao_acessos";

async function lerAcessos() {
  const { data, error } = await sb.from(T_META).select("valor,atualizado_em").eq("chave", META_ACESSOS).maybeSingle();
  if (error) throw error;
  const usuarios = data?.valor?.usuarios && typeof data.valor.usuarios === "object" ? data.valor.usuarios : {};
  return { usuarios, versao: (data?.atualizado_em as string) ?? null };
}

async function lerPermissoes(usuario: string) {
  const { usuarios } = await lerAcessos();
  const reg = Object.prototype.hasOwnProperty.call(usuarios, usuario) ? usuarios[usuario] : null;
  return permissoes(usuario, reg);
}

async function bump(colecao: string) {
  const agora = Date.now();
  const { data } = await sb.from(T_META).select("valor").eq("chave", "rev").maybeSingle();
  const atual = (data?.valor as { rev?: number; porColecao?: Record<string, number> }) ?? {};
  await sb.from(T_META).upsert({ chave: "rev", valor: { rev: agora, porColecao: { ...(atual.porColecao ?? {}), [colecao]: agora } }, atualizado_em: new Date().toISOString() });
}

async function listarColecao(nome: string) {
  const itens: unknown[] = [];
  let desde = "1970-01-01";
  let desdeId = "";
  for (;;) {
    let q = sb.from(T_REG).select("id, registro, apagado, atualizado_em").eq("colecao", nome)
      .order("atualizado_em", { ascending: true }).order("id", { ascending: true }).limit(1000);
    q = desdeId ? q.or(`atualizado_em.gt.${desde},and(atualizado_em.eq.${desde},id.gt.${desdeId})`) : q.gt("atualizado_em", desde);
    const { data, error } = await q;
    if (error) throw error;
    for (const l of data ?? []) if (!l.apagado) itens.push(l.registro);
    if (!data || data.length < 1000) break;
    desde = String(data[data.length - 1].atualizado_em);
    desdeId = String(data[data.length - 1].id);
  }
  return itens;
}

const ID_OK = /^[A-Za-z0-9_.:\-]{1,160}$/;

async function dadosAcao(action: string, body: Record<string, unknown>, usuario: string, perm: any) {
  const setor = String(body.setor ?? "");
  switch (action) {
    case "eu":
      return resp({ usuario, admin: perm.admin, setores: perm.setores });
    case "elenco": {
      // Porta estreita (igual à do painel): só id, nome e apelido dos ativos.
      const { data, error } = await sb.from(T_REG).select("registro, apagado").eq("colecao", "rh_pessoas");
      if (error) throw error;
      const pessoas = (data ?? []).filter((r: any) => !r.apagado).map((r: any) => r.registro).filter((p: any) => p?.ativo !== false)
        .map((p: any) => ({ id: p.id, nome: p.nome ?? "", apelido: p.apelido ?? "" }))
        .sort((a: any, b: any) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
      return resp({ pessoas });
    }
    case "dadosCarregar": {
      if (!Object.prototype.hasOwnProperty.call(SETORES, setor)) return resp({ erro: "Setor desconhecido." }, 400);
      const colecoes: Record<string, unknown[]> = {};
      const recusadas: string[] = [];
      await Promise.all(CHAVES.map(async (ch) => {
        if (!podeLer(perm, setor, ch)) { recusadas.push(ch); colecoes[ch] = []; return; }
        colecoes[ch] = await listarColecao(colecaoDe(setor, ch));
      }));
      return resp({ colecoes, recusadas });
    }
    case "dadosGravar": {
      const chave = String(body.chave ?? "");
      const registro = body.registro as Record<string, unknown>;
      if (!podeGravar(perm, setor, chave)) return resp({ erro: "Você não tem acesso para editar esta parte.", semPermissao: true }, 403);
      if (!registro || typeof registro !== "object" || Array.isArray(registro) || !ID_OK.test(String(registro.id ?? ""))) return resp({ erro: "Registro inválido." }, 400);
      if (JSON.stringify(registro).length > 3_000_000) return resp({ erro: "Registro grande demais (fotos e imagens precisam ser menores)." }, 413);
      const colecao = colecaoDe(setor, chave);
      const agora = new Date().toISOString();
      const reg = { ...registro, id: String(registro.id), atualizadoPor: usuario, atualizadoEm: agora };
      const { data, error } = await sb.from(T_REG).upsert({ colecao, id: reg.id, registro: reg, apagado: false, atualizado_em: agora }).select("registro").maybeSingle();
      if (error) throw error;
      await bump(colecao);
      return resp({ ok: true, registro: data?.registro ?? null });
    }
    case "dadosApagar": {
      const chave = String(body.chave ?? "");
      const id = String(body.id ?? "");
      if (!podeGravar(perm, setor, chave)) return resp({ erro: "Você não tem acesso para editar esta parte.", semPermissao: true }, 403);
      if (!ID_OK.test(id)) return resp({ erro: "Registro inválido." }, 400);
      const colecao = colecaoDe(setor, chave);
      const agora = new Date().toISOString();
      const { error } = await sb.from(T_REG).upsert({ colecao, id, registro: { id, _apagado: true, atualizadoPor: usuario, atualizadoEm: agora }, apagado: true, atualizado_em: agora });
      if (error) throw error;
      await bump(colecao);
      return resp({ ok: true });
    }
    case "dadosImportarVotacao": {
      // Histórico importado da planilha (votação já encerrada, somas abertas).
      if (!podeAcao(perm, "pesquisaCriar")) return resp({ erro: "Você não tem acesso ao Destaque do mês.", semPermissao: true }, 403);
      const r = body.registro as Record<string, unknown>;
      if (!r || !/^pimp\d{6}$/.test(String(r.id ?? "")) || r.status !== "encerrada" || r.modo !== "importada") return resp({ erro: "Votação importada inválida." }, 400);
      const agora = new Date().toISOString();
      const somas = r.somas && typeof r.somas === "object" ? r.somas : {};
      const reg = {
        id: String(r.id), titulo: String(r.titulo ?? "").slice(0, 120), mes: String(r.mes ?? "").slice(0, 7), modo: "importada", status: "encerrada",
        minimo: Math.min(Math.max(Number(r.minimo) || 3, 2), 10), avaliados: listaPessoas(r.avaliados, 80), lideres: [], codigos: [],
        somas, usados: {}, validos: [], totalVotos: Math.max(0, Number(r.totalVotos) || 0),
        criadaEm: String(r.criadaEm ?? agora).slice(0, 30), encerradaEm: String(r.encerradaEm ?? agora).slice(0, 30), importada: true,
        atualizadoPor: usuario, atualizadoEm: agora,
      };
      if (!/^\d{4}-\d{2}$/.test(reg.mes)) return resp({ erro: "Votação importada inválida." }, 400);
      const { data, error } = await sb.from(T_REG).upsert({ colecao: COL_PESQ, id: reg.id, registro: reg, apagado: false, atualizado_em: agora }).select("registro").maybeSingle();
      if (error) throw error;
      await bump(COL_PESQ);
      return resp({ ok: true, registro: data?.registro ?? null });
    }
    case "acessosListar": {
      if (!perm.admin) return resp({ erro: "Só a administração edita os acessos.", semPermissao: true }, 403);
      const [{ data: contas, error: e1 }, { usuarios }] = await Promise.all([
        sb.from("ml_contas").select("usuario,nome,papel").eq("ativo", true),
        lerAcessos(),
      ]);
      if (e1) throw e1;
      const acessos: Record<string, unknown> = {};
      for (const [u, r] of Object.entries(usuarios as Record<string, any>)) acessos[u] = { setores: limparSetores(r?.setores), valido: true, atualizadoEm: r?.atualizadoEm, atualizadoPor: r?.atualizadoPor };
      return resp({ contas: (contas ?? []).map((c: any) => ({ usuario: c.usuario, nome: c.nome, papel: c.papel })), acessos, paginas: PAGINAS, setores: SETORES });
    }
    case "acessosGravar": {
      if (!perm.admin) return resp({ erro: "Só a administração edita os acessos.", semPermissao: true }, 403);
      const alvo = String(body.usuario ?? "").trim().toLowerCase();
      if (!/^[a-z0-9._-]{2,40}$/.test(alvo)) return resp({ erro: "Usuário inválido." }, 400);
      const { data: conta } = await sb.from("ml_contas").select("usuario").eq("usuario", alvo).maybeSingle();
      if (!conta) return resp({ erro: "Esse login não existe no painel." }, 400);
      const setores = limparSetores(body.setores);
      for (let t = 0; t < 5; t++) {
        const { usuarios, versao } = await lerAcessos();
        const agora = new Date().toISOString();
        const novo = { ...usuarios, [alvo]: { setores, atualizadoEm: agora, atualizadoPor: usuario } };
        if (!Object.keys(setores).length) delete novo[alvo];
        const linha = { chave: META_ACESSOS, valor: { usuarios: novo }, atualizado_em: agora };
        // Grava só se ninguém gravou no meio (versão = atualizado_em lido).
        const q = versao === null
          ? sb.from(T_META).insert(linha).select("chave")
          : sb.from(T_META).update(linha).eq("chave", META_ACESSOS).eq("atualizado_em", versao).select("chave");
        const { data, error } = await q;
        if (!error && (data ?? []).length === 1) return resp({ ok: true, usuario: alvo, setores });
        await espera(120);
      }
      return resp({ erro: "Não consegui gravar agora. Tente de novo." }, 503);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return resp({ erro: "JSON inválido." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return resp({ erro: "JSON inválido." }, 400);
  const action = String(body.action ?? "");
  if (action === "ping") return resp({ ok: true, agora: new Date().toISOString() });
  if (action === "votoAbrir" || action === "votoEnviar") {
    try { return await votar(action, body); } catch (e) { console.error("ml-comercial voto", e); return resp({ erro: "O servidor falhou agora. Tente de novo em instantes." }, 500); }
  }
  if (action === "liderAbrir" || action === "liderSalvar") {
    try { return await liderancaPublica(action, body); } catch (e) { console.error("ml-comercial lider", e); return resp({ erro: "O servidor falhou agora. Tente de novo em instantes." }, 500); }
  }

  const m = String(req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  const cracha = m ? await verificarJwt(m[1]) : null;
  if (!cracha || cracha.sis !== SIS) return resp({ erro: "Entre no sistema.", semSessao: true }, 401);
  const usuario = String(cracha.sub ?? "");
  if (!(await contaSegueAtiva(usuario))) return resp({ erro: "Esta conta foi desativada.", semSessao: true }, 401);

  try {
    const perm = await lerPermissoes(usuario);
    const temAlgo = Object.keys(perm.setores).length > 0;
    if (!temAlgo) return resp({ erro: "Você ainda não tem acesso a este sistema. Peça a liberação à administração.", semPermissao: true }, 403);
    const d = await dadosAcao(action, body, usuario, perm);
    if (d) return d;
    // Daqui para baixo: leituras do CRM, votação e convites — cada uma pela página liberada.
    if (!podeAcao(perm, action)) return resp({ erro: "Você não tem acesso a esta parte.", semPermissao: true }, 403);
    if (action.startsWith("pesquisa")) {
      const r = await pesquisaDirecao(action, body, usuario, perm);
      if (r) return r;
    }
    if (action.startsWith("convite")) {
      const r = await conviteDirecao(action, body, usuario);
      if (r) return r;
    }
    switch (action) {
      // Propostas somadas por mês e por responsável + nomes dos usuários do CRM.
      case "resumo": {
        const meses = Math.min(Math.max(Number(body.meses) || 13, 1), 36);
        const desde = somarMeses(mesAtualBR(), -(meses - 1));
        const [propostas, perfis] = await Promise.all([
          lerTudo("propostas", CAMPOS_AGREGADO),
          lerTudo("profiles", "id,nome,ativo"),
        ]);
        const pessoas: Record<string, { nome: string; ativo: boolean }> = {};
        for (const p of perfis) pessoas[p.id] = { nome: String(p.nome ?? "").replace(/\s+/g, " ").trim(), ativo: p.ativo !== false };
        return resp({ geradoEm: new Date().toISOString(), desde, porMes: agregarPropostas(propostas, { desde }), pessoas });
      }

      // Propostas de um mês sem responsável: o que a gestora precisa atribuir.
      case "semResponsavel": {
        const mes = String(body.mes ?? "");
        if (!/^\d{4}-\d{2}$/.test(mes)) return resp({ erro: "Informe o mês (AAAA-MM)." }, 400);
        const linhas = await lerTudo(
          "propostas",
          "id,numero_proposta,cliente_id,status,valor,data_envio,created_at,ativo,deleted_at",
          (q) => q.is("responsavel_comercial_id", null),
        );
        const doMes = linhas.filter((p) =>
          p.ativo !== false && !p.deleted_at &&
          !["RASCUNHO", "CANCELADA"].includes(String(p.status || "").toUpperCase()) &&
          mesBR(p.data_envio || p.created_at) === mes
        );
        const ids = [...new Set(doMes.map((p) => p.cliente_id).filter(Boolean))];
        const nomes: Record<string, string> = {};
        for (let i = 0; i < ids.length; i += 200) {
          const { data, error } = await sb.from("clientes").select("id,razao_social,nome_fantasia").in("id", ids.slice(i, i + 200));
          if (error) throw error;
          for (const c of data ?? []) nomes[c.id] = String(c.nome_fantasia || c.razao_social || "").trim();
        }
        const itens = doMes
          .map((p) => ({
            id: p.id,
            numero: p.numero_proposta ?? "",
            cliente: nomes[p.cliente_id] ?? "",
            status: p.status,
            valor: Number(p.valor) || 0,
            data: String(p.data_envio || p.created_at || "").slice(0, 10),
          }))
          .sort((a, b) => b.data.localeCompare(a.data));
        return resp({ mes, itens });
      }

      // Propostas em aberto, com idade, última interação e chance de aprovação.
      case "cockpit": {
        const hoje = new Date().toISOString();
        const [props, inter] = await Promise.all([
          lerTudo("propostas", "id,numero_proposta,cliente_id,responsavel_comercial_id,status,valor,data_envio,data_aceite,data_recusa,created_at,ativo,deleted_at"),
          lerTudo("interacoes", "id,proposta_id,ocorrido_em", (q) => q.not("proposta_id", "is", null)),
        ]);
        const faixas = probabilidadesPorIdade(props, hoje);
        const ultimaInter: Record<string, string> = {};
        for (const i of inter) if (!ultimaInter[i.proposta_id] || i.ocorrido_em > ultimaInter[i.proposta_id]) ultimaInter[i.proposta_id] = i.ocorrido_em;
        const limite = Date.now() - 365 * 86400000;
        const abertas = props
          .filter((p) => p.ativo !== false && !p.deleted_at && String(p.status || "").toUpperCase() === "ENVIADA" && Date.parse(p.data_envio || p.created_at) >= limite)
          .map((p) => {
            const data = String(p.data_envio || p.created_at);
            const idade = Math.floor((Date.now() - Date.parse(data)) / 86400000);
            return {
              id: p.id, numero: p.numero_proposta ?? "", clienteId: p.cliente_id, responsavelId: p.responsavel_comercial_id,
              valor: Number(p.valor) || 0, data: data.slice(0, 10), idade, ultimaInteracao: ultimaInter[p.id]?.slice(0, 10) ?? null,
              chance: chanceDaIdade(faixas, idade),
            };
          })
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 500);
        const nomes = await nomesClientes(abertas.map((a) => a.clienteId));
        for (const a of abertas as any[]) { a.cliente = nomes[a.clienteId] ?? ""; delete a.clienteId; }
        return resp({ geradoEm: hoje, faixas, abertas });
      }

      // Funil: leads → oportunidades → propostas → aprovadas, num período.
      case "funil": {
        const meses = Math.min(Math.max(Number(body.meses) || 6, 1), 24);
        const desde = somarMeses(mesAtualBR(), -(meses - 1));
        const noPeriodo = (iso: string | null) => { const m = mesBR(iso); return !!m && m >= desde; };
        const [leads, opps, props] = await Promise.all([
          lerTudo("leads", "id,status,origem,created_at,data_primeiro_atendimento,cliente_convertido_id,ativo,deleted_at"),
          lerTudo("oportunidades", "id,estagio,status,valor_estimado,created_at,ativo,deleted_at"),
          lerTudo("propostas", "id,status,created_at,data_envio,ativo,deleted_at"),
        ]);
        const vivos = (x: any) => x.ativo !== false && !x.deleted_at;
        const L = leads.filter((l) => vivos(l) && noPeriodo(l.created_at));
        const st = (s: unknown) => String(s || "").trim().toUpperCase();
        const contar = (xs: any[], f: (x: any) => string) => xs.reduce((m: Record<string, number>, x) => { const k = f(x) || "—"; m[k] = (m[k] || 0) + 1; return m; }, {});
        const O = opps.filter((o) => vivos(o) && noPeriodo(o.created_at));
        const P = props.filter((p) => vivos(p) && !["RASCUNHO", "CANCELADA"].includes(st(p.status)) && noPeriodo(p.data_envio || p.created_at));
        const parados = leads.filter((l) => vivos(l) && st(l.status) === "EM ATENDIMENTO" && Date.now() - Date.parse(l.data_primeiro_atendimento || l.created_at) > 30 * 86400000).length;
        const serie: Record<string, { leads: number; convertidos: number }> = {};
        for (const l of L) { const m = mesBR(l.created_at)!; serie[m] ??= { leads: 0, convertidos: 0 }; serie[m].leads++; if (l.cliente_convertido_id || st(l.status) === "CONVERTIDO") serie[m].convertidos++; }
        return resp({
          desde, meses,
          leads: { total: L.length, porStatus: contar(L, (l) => st(l.status)), porOrigem: contar(L, (l) => String(l.origem || "—")), convertidos: L.filter((l) => l.cliente_convertido_id || st(l.status) === "CONVERTIDO").length, paradosMais30d: parados },
          oportunidades: { total: O.length, porEstagio: contar(O, (o) => `${st(o.estagio)}`), ganhas: O.filter((o) => ["GANHA", "APROVADA"].includes(st(o.status))).length, perdidas: O.filter((o) => ["PERDIDA", "RECUSADA"].includes(st(o.status))).length },
          propostas: { enviadas: P.length, aprovadas: P.filter((p) => st(p.status) === "APROVADA").length, recusadas: P.filter((p) => st(p.status) === "RECUSADA").length, abertas: P.filter((p) => st(p.status) === "ENVIADA").length },
          serieLeads: serie,
        });
      }

      // Carteira: clientes por valor aprovado (ABC), em risco, contratos e recorrências.
      case "carteira": {
        const hoje = new Date().toISOString();
        const hojeD = hoje.slice(0, 10);
        const mais = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
        const [props, contratos, recs] = await Promise.all([
          lerTudo("propostas", "id,cliente_id,status,valor,data_envio,data_aceite,created_at,ativo,deleted_at"),
          lerTudo("contratos", "id,numero_contrato,cliente_id,status,periodicidade,data_fim,ativo,deleted_at"),
          lerTudo("recorrencias_clientes", "id,cliente_id,periodicidade,proxima_previsao,ultima_execucao,status,ativo"),
        ]);
        const clientes = carteiraClientes(props, hoje).slice(0, 400);
        const vencendo = contratos
          .filter((c) => c.ativo !== false && !c.deleted_at && String(c.status || "").toUpperCase() === "ATIVO" && c.data_fim && c.data_fim >= mais(-30) && c.data_fim <= mais(90))
          .map((c) => ({ id: c.id, numero: c.numero_contrato ?? "", clienteId: c.cliente_id, periodicidade: c.periodicidade ?? "", dataFim: c.data_fim }))
          .sort((a, b) => a.dataFim.localeCompare(b.dataFim));
        const recAtivas = recs.filter((r) => r.ativo !== false && r.proxima_previsao);
        const proximas = recAtivas
          .filter((r) => r.proxima_previsao <= mais(30))
          .map((r) => ({ id: r.id, clienteId: r.cliente_id, periodicidade: r.periodicidade ?? "", proxima: r.proxima_previsao, ultima: r.ultima_execucao, atrasada: r.proxima_previsao < hojeD }))
          .sort((a, b) => a.proxima.localeCompare(b.proxima));
        const nomes = await nomesClientes([...clientes.map((c) => c.clienteId), ...vencendo.map((c) => c.clienteId), ...proximas.slice(0, 150).map((r) => r.clienteId)]);
        const comNome = (x: any) => { const { clienteId, ...r } = x; return { ...r, cliente: nomes[clienteId] ?? "" }; };
        return resp({
          geradoEm: hoje,
          clientes: clientes.map(comNome),
          contratosVencendo: vencendo.map(comNome),
          recorrencias: { ativas: recAtivas.length, atrasadas: proximas.filter((r) => r.atrasada).length, proximos30d: proximas.filter((r) => !r.atrasada).length, lista: proximas.slice(0, 150).map(comNome) },
        });
      }

      // Licitações e prazos.
      case "licitacoes": {
        const [lics, prazos] = await Promise.all([
          lerTudo("licitacoes", "id,numero,orgao,modalidade,objeto,municipio,uf,status,data_sessao,valor_estimado,valor_proposta,valor_homologado,responsavel_id,resultado,motivo_perda,deleted_at"),
          lerTudo("licitacao_prazos", "id,licitacao_id,tipo,titulo,prazo,status,responsavel_id"),
        ]);
        const vivas = lics.filter((l) => !l.deleted_at).map((l) => { const { deleted_at, ...r } = l; return r; });
        const ids = new Set(vivas.map((l) => l.id));
        const abertos = prazos
          .filter((p) => ids.has(p.licitacao_id) && p.prazo && !["CONCLUIDO", "CONCLUÍDO", "CANCELADO"].includes(String(p.status || "").toUpperCase()))
          .sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)));
        return resp({ licitacoes: vivas, prazos: abertos });
      }

      // Amostras e ensaios por setor do laboratório (mês pedido e o anterior).
      case "setores": {
        const mes = String(body.mes ?? "");
        if (!/^\d{4}-\d{2}$/.test(mes)) return resp({ erro: "Informe o mês (AAAA-MM)." }, 400);
        const meses = [somarMeses(mes, -1), mes];
        const [os, ams] = await Promise.all([
          lerTudo("ordens_servico", "id,data_recepcao,deleted_at"),
          lerTudo("amostras", "id,ordem_servico_id,data_entrada,grupo_snapshot,deleted_at"),
        ]);
        const recepcao = new Map(os.filter((o) => !o.deleted_at).map((o) => [o.id, o.data_recepcao]));
        const doPeriodo = ams
          .filter((a) => !a.deleted_at)
          .map((a) => ({ id: a.id, mes: mesBR(a.data_entrada || recepcao.get(a.ordem_servico_id) || null), matriz: a.grupo_snapshot || "Outros" }))
          .filter((a) => a.mes && meses.includes(a.mes));
        const ensaios: any[] = [];
        const ids = doPeriodo.map((a) => a.id);
        for (let i = 0; i < ids.length; i += 50) {
          for (let de = 0; ; de += 1000) {
            const { data, error } = await sb.from("amostra_parametros").select("amostra_id,parametro_rotulo_snapshot,tipo_execucao,deleted_at")
              .in("amostra_id", ids.slice(i, i + 50)).order("id", { ascending: true }).range(de, de + 999);
            if (error) throw error;
            for (const e of data ?? []) if (!e.deleted_at) ensaios.push({ amostra_id: e.amostra_id, rotulo: e.parametro_rotulo_snapshot, tipo: e.tipo_execucao });
            if (!data || data.length < 1000) break;
          }
        }
        const porMes = somarSetores(doPeriodo, ensaios);
        return resp({ geradoEm: new Date().toISOString(), meses, porMes });
      }

      // Painel do laboratório: OS em andamento (atrasadas e vencendo) e
      // envios a laboratórios parceiros (prazo). O CRM não tem a data do laudo
      // das análises internas; o prazo interno sai do vencimento da OS.
      case "labPainel": {
        const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); // dia em Brasília
        const mais = (d: number) => new Date(Date.parse(hoje) + d * 864e5).toISOString().slice(0, 10);
        const [os, envios] = await Promise.all([
          lerTudo("ordens_servico", "id,numero_os,cliente_id,status_os,data_recepcao,data_vencimento,deleted_at"),
          lerTudo("provedor_envios", "id,provedor_nome,numero_os,data_envio,data_prevista,previsao_resultado,data_resultado,status,ativo,deleted_at"),
        ]);
        const vivas = os.filter((o) => !o.deleted_at);
        const andamento = vivas.filter((o) => String(o.status_os || "").toUpperCase() === "EM ANDAMENTO");
        const atrasadas = andamento.filter((o) => o.data_vencimento && o.data_vencimento < hoje)
          .map((o) => ({ numero: o.numero_os ?? "", clienteId: o.cliente_id, vencimento: o.data_vencimento, recepcao: String(o.data_recepcao || "").slice(0, 10), dias: Math.round((Date.parse(hoje) - Date.parse(o.data_vencimento)) / 864e5) }))
          .sort((a, b) => b.dias - a.dias);
        const vencendo = andamento.filter((o) => o.data_vencimento && o.data_vencimento >= hoje && o.data_vencimento <= mais(3)).length;
        const semVencimento = andamento.filter((o) => !o.data_vencimento).length;
        const porMes: Record<string, { recebidas: number; concluidas: number; canceladas: number }> = {};
        for (const o of vivas) {
          const m = mesBR(o.data_recepcao);
          if (!m) continue;
          const x = (porMes[m] ??= { recebidas: 0, concluidas: 0, canceladas: 0 });
          const st = String(o.status_os || "").toUpperCase();
          x.recebidas++;
          if (st.startsWith("CONCLU")) x.concluidas++;
          if (st === "CANCELADA") x.canceladas++;
        }
        const env = envios.filter((e) => !e.deleted_at && e.ativo !== false && e.data_envio);
        const prev = (e: any) => e.data_prevista || e.previsao_resultado || null;
        const aguardando = env.filter((e) => !e.data_resultado);
        const parceirosAtrasados = aguardando.filter((e) => prev(e) && prev(e) < hoje)
          .map((e) => ({ provedor: e.provedor_nome ?? "", numero: e.numero_os ?? "", previsto: prev(e), dias: Math.round((Date.parse(hoje) - Date.parse(prev(e))) / 864e5) }))
          .sort((a, b) => b.dias - a.dias);
        const comResultado = env.filter((e) => e.data_resultado);
        const porProvedor: Record<string, { envios: number; comResultado: number; noPrazo: number; diasSoma: number }> = {};
        for (const e of env) {
          const k = String(e.provedor_nome || "Outro").trim().toUpperCase();
          const x = (porProvedor[k] ??= { envios: 0, comResultado: 0, noPrazo: 0, diasSoma: 0 });
          x.envios++;
          if (e.data_resultado) {
            x.comResultado++;
            x.diasSoma += Math.max(0, Math.round((Date.parse(e.data_resultado) - Date.parse(e.data_envio)) / 864e5));
            if (!prev(e) || e.data_resultado <= prev(e)) x.noPrazo++;
          }
        }
        const nomes = await nomesClientes(atrasadas.slice(0, 40).map((a) => a.clienteId));
        return resp({
          hoje, porMes,
          os: { andamento: andamento.length, atrasadas: atrasadas.length, vencendo, semVencimento, lista: atrasadas.slice(0, 40).map(({ clienteId, ...r }) => ({ ...r, cliente: nomes[clienteId] ?? "" })) },
          parceiros: {
            aguardando: aguardando.length, atrasados: parceirosAtrasados.length, comResultado: comResultado.length,
            lista: parceirosAtrasados.slice(0, 30),
            porProvedor: Object.entries(porProvedor).map(([nome, x]) => ({ nome, envios: x.envios, comResultado: x.comResultado, noPrazo: x.noPrazo, mediaDias: x.comResultado ? Math.round((x.diasSoma / x.comResultado) * 10) / 10 : null })).sort((a, b) => b.envios - a.envios),
          },
        });
      }

      // Pesquisas de satisfação registradas no CRM.
      case "nps": {
        const linhas = await lerTudo("satisfacao_nps", "id,cliente_id,nota,comentario,canal,respondido_em,created_at,deleted_at");
        const vivas = linhas.filter((n) => !n.deleted_at);
        const nomes = await nomesClientes(vivas.map((n) => n.cliente_id));
        return resp({ respostas: vivas.map((n) => ({ id: n.id, cliente: nomes[n.cliente_id] ?? "", nota: n.nota, comentario: n.comentario ?? "", canal: n.canal ?? "", data: String(n.respondido_em || n.created_at || "").slice(0, 10) })) });
      }

      default:
        return resp({ erro: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    console.error("ml-comercial", action, e);
    return resp({ erro: "O servidor falhou agora. Tente de novo em instantes." }, 500);
  }
});
