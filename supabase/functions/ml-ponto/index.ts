// ============================================================================
// ml-ponto — a ponte com o JIBBLE, o relógio de ponto da MinasLab.
//
// O Jibble é onde as batidas acontecem de verdade (celular e tablet da equipe).
// Esta ponte só LÊ de lá e guarda uma cópia local em rh_ponto_dia, para o RH
// fechar a competência dentro do painel sem abrir outro site. Nada é escrito
// no Jibble: o relógio é a fonte, e fonte não se corrige por fora.
//
// SEGREDOS (Supabase → Edge Functions → Secrets, gravados pelo Léo):
//   ML_JIBBLE_CLIENT_ID / ML_JIBBLE_CLIENT_SECRET
// Este repositório é PÚBLICO — credencial nenhuma mora aqui.
//
// QUEM ENTRA: as quatro conferências do padrão da casa, e o papel exigido é
// DIREÇÃO — ponto é dado de pessoa, mesma régua das coleções rh_*.
//
// TETO DE 150s: uma janela por chamada, com cursor. Quem comanda o laço é a
// tela, que mostra onde está e pode parar. O que já veio fica gravado.
//
// O QUE NÃO SE SABE AINDA: o Jibble tem hosts separados por produto
// (identidade, workspace, time-tracking) e a documentação muda de endereço com
// o tempo. Por isso existe a ação `diagnostico`: ela PERGUNTA a cada candidato
// e devolve quem respondeu, em vez de o código apostar num caminho e falhar em
// silêncio depois. Zero em toda fonte é instrumento quebrado, não empresa sem
// batida — a regra da casa para toda medição por rede.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("ML_TOKEN") ?? "";
const JWT_SECRET = Deno.env.get("ML_JWT_SECRET") ?? "";
const CLIENT_ID = Deno.env.get("ML_JIBBLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("ML_JIBBLE_CLIENT_SECRET") ?? "";

const T_REG = "ml_registros";
const T_META = "ml_meta";
const SIS = "minaslab";

const IDENTITY = "https://identity.jibble.io/connect/token";
const HOST_WORKSPACE = "https://workspace.prod.jibble.io/v1";
const HOST_TRACKING = "https://time-tracking.prod.jibble.io/v1";
const HOST_ATTENDANCE = "https://time-attendance.prod.jibble.io/v1";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------------------------------------------------------------- crachá
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
  if (!JWT_SECRET || !token) return null;
  const partes = String(token).split(".");
  if (partes.length !== 3) return null;
  try {
    const chave = await crypto.subtle.importKey(
      "raw", enc.encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify(
      "HMAC", chave, bytesFromB64url(partes[2]), enc.encode(`${partes[0]}.${partes[1]}`));
    if (!ok) return null;
    const p = JSON.parse(dec.decode(bytesFromB64url(partes[1])));
    if (typeof p.exp === "number" && p.exp < Math.floor(Date.now() / 1000)) return null;
    if (p.sis !== SIS) return null;
    return p;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Jibble
async function lerMeta(chave: string) {
  const { data } = await sb.from(T_META).select("valor").eq("chave", chave).maybeSingle();
  return data?.valor ?? null;
}
async function gravarMeta(chave: string, valor: unknown) {
  await sb.from(T_META).upsert({ chave, valor, atualizado_em: new Date().toISOString() });
}

/* O token do Jibble vale ~1h. Guardamos com a validade e reaproveitamos: pedir
   token novo a cada chamada é o caminho mais curto para o "consumo indevido"
   derrubar a credencial no meio de uma importação.
   Guardamos com 60s de folga — token que vence entre pedir e usar devolve 401
   no meio do laço, e a página perdida parece "mês sem batida". */
async function tokenJibble(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("O relógio ainda não foi ligado: faltam os segredos ML_JIBBLE_CLIENT_ID / ML_JIBBLE_CLIENT_SECRET.");
  }
  const guardado = await lerMeta("jibble:token") as { token?: string; ate?: number } | null;
  if (guardado?.token && typeof guardado.ate === "number" && guardado.ate > Date.now() + 60_000) {
    return guardado.token;
  }
  const corpo = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const r = await fetch(IDENTITY, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo.toString(),
  });
  const dados = await r.json().catch(() => ({} as Record<string, unknown>));
  if (!r.ok || !dados.access_token) {
    /* A mensagem do Jibble volta como error/error_description e NÃO carrega o
       segredo — mas o corpo inteiro poderia. Repassamos só o essencial. */
    const erro = String(dados.error_description ?? dados.error ?? r.status);
    throw new Error("Jibble · autenticação: " + erro);
  }
  const validade = Number(dados.expires_in) || 3600;
  await gravarMeta("jibble:token", {
    token: String(dados.access_token),
    ate: Date.now() + validade * 1000,
  });
  return String(dados.access_token);
}

async function jibble(url: string): Promise<Record<string, any>> {
  const token = await tokenJibble();
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const corpo = await r.json().catch(() => ({} as Record<string, unknown>));
  if (!r.ok) {
    const erro = String(
      (corpo as any)?.error?.message ?? (corpo as any)?.message ?? (corpo as any)?.title ?? r.status,
    );
    throw new Error(`Jibble ${r.status}: ${erro}`);
  }
  return corpo;
}

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// "2026-08-31" + 1 → "2026-09-01" (vira mês e ano sozinho).
function somaDias(iso: string, n: number): string {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

const minutosDe = (hhmm: string): number | null => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/* O DIA SAI DOS PARES, não de "primeira batida até a última".
   Numa jornada normal — 08:00 entra, 12:00 sai, 13:00 entra, 17:00 sai — a
   conta ingênua dava 9h (o almoço dentro) e a apuração acusava 12 min de hora
   extra POR DIA que não existiu: 22 dias viravam 4h24 de extra inventada, e o
   botão "usar o apurado" transformava isso em dinheiro.
   Aqui os intervalos entra→sai são somados um a um, e o que fica ENTRE eles é
   a pausa. Batida sem par (entrou e esqueceu de sair) NÃO vira zero: o dia
   fica com trabalhadoMin null e a tela mostra "em aberto" — é justamente o
   esquecimento que o RH precisa enxergar. */
function fecharDia(batidas: { hora: string; tipo: string }[]) {
  const ordenadas = [...batidas].sort((a, b) => a.hora.localeCompare(b.hora));
  let trabalhado = 0;
  let pausa = 0;
  let abertoEm: number | null = null;
  let ultimaSaida: number | null = null;
  let parImpar = false;
  for (const b of ordenadas) {
    const min = minutosDe(b.hora);
    if (min === null) continue;
    const entrando = b.tipo.includes("in");
    if (entrando) {
      if (abertoEm !== null) { parImpar = true; continue; } // duas entradas seguidas
      if (ultimaSaida !== null && min > ultimaSaida) pausa += min - ultimaSaida;
      abertoEm = min;
    } else {
      if (abertoEm === null) { parImpar = true; continue; }  // saída sem entrada
      if (min > abertoEm) trabalhado += min - abertoEm;
      ultimaSaida = min;
      abertoEm = null;
    }
  }
  const emAberto = abertoEm !== null;
  return {
    entrada: ordenadas.find((b) => b.tipo.includes("in"))?.hora ?? "",
    saida: [...ordenadas].reverse().find((b) => !b.tipo.includes("in"))?.hora ?? "",
    pausaMin: pausa,
    // Dia em aberto ou com batida solta não afirma total nenhum.
    trabalhadoMin: emAberto || trabalhado === 0 ? null : trabalhado,
    emAberto,
    inconsistente: parImpar,
  };
}

/* "2026-08-27T07:31:00Z" → { dia: "2026-08-27", hora: "07:31" } no fuso de
   Brasília. O relógio devolve UTC; ler o dia direto do texto ISO jogaria toda
   batida depois das 21h para o dia seguinte — a pessoa que entra às 22h no
   plantão apareceria trabalhando amanhã. */
const FUSO_MIN = -180; // America/Sao_Paulo (sem horário de verão desde 2019)
function localDe(iso: unknown): { dia: string; hora: string } | null {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + FUSO_MIN * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    dia: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    hora: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}

// ---------------------------------------------------------------- gravação
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

/* Grava e CONFERE O EFEITO: devolve quantas linhas o banco confirmou.
   Importação que mente sobre o que trouxe é pior que importação nenhuma. */
async function gravarVarios(colecao: string, registros: Record<string, unknown>[]) {
  if (!registros.length) return 0;
  const agora = new Date().toISOString();
  const linhas = registros.map((r) => ({
    colecao,
    id: String(r.id),
    registro: { ...r, atualizadoPor: "jibble", atualizadoEm: agora },
    apagado: false,
    atualizado_em: agora,
  }));
  const { data, error } = await sb.from(T_REG).upsert(linhas).select("id");
  if (error) throw error;
  await bump(colecao);
  return data?.length ?? 0;
}

/* O DIA CORRIGIDO À MÃO NÃO É SOBRESCRITO pela importação seguinte. Sem isto,
   o RH ajustava a batida esquecida de segunda e a sincronização da terça
   apagava o ajuste — em silêncio, e só o fechamento da folha mostraria. */
/* Lê SÓ os dias que esta janela vai gravar (.in nos ids). Trazer a coleção
   inteira parecia mais simples e era uma armadilha: o PostgREST corta em 1000
   linhas SEM AVISAR, e a partir do 4º mês de uso a correção feita à mão ficava
   fora da fatia devolvida — deixava de ser protegida e era apagada em silêncio,
   com a tela ainda dizendo "preservados: 0". */
async function diasJaGravados(ids: string[]): Promise<Map<string, Record<string, any>>> {
  const mapa = new Map<string, Record<string, any>>();
  for (let i = 0; i < ids.length; i += 200) {
    const fatia = ids.slice(i, i + 200);
    const { data, error } = await sb.from(T_REG)
      .select("id, registro").eq("colecao", "rh_ponto_dia").eq("apagado", false).in("id", fatia);
    if (error) throw error;
    for (const l of data ?? []) mapa.set(String(l.id), l.registro as Record<string, any>);
  }
  return mapa;
}

// ---------------------------------------------------------------- serviço
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return resp({ erro: "JSON inválido." }, 400);
  }
  const action = String(body.action ?? "");

  const m = String(req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  const cracha = m ? await verificarJwt(m[1]) : null;
  const ehMaquina = !!TOKEN && req.headers.get("x-token") === TOKEN;
  if (!cracha && !ehMaquina) return resp({ erro: "Entre no sistema.", semSessao: true }, 401);
  if (!ehMaquina && String(cracha?.papel ?? "") !== "direcao") {
    return resp({ erro: "O ponto é só da direção.", semPermissao: true }, 403);
  }

  try {
    switch (action) {
      case "estado": {
        const ultima = await lerMeta("jibble:ultimaImportacao");
        return resp({ ligado: !!CLIENT_ID && !!CLIENT_SECRET, ultima });
      }

      /* DIAGNÓSTICO — a primeira coisa a rodar depois de ligar os segredos.
         Confere a autenticação e PERGUNTA a cada endereço candidato, sem
         importar nada. É o caso de controle: se o token sai mas nenhuma fonte
         responde, o problema é o caminho, não a empresa. */
      case "diagnostico": {
        const de = String(body.de ?? "");
        const ate = String(body.ate ?? "");
        const fontes: Record<string, unknown>[] = [];

        let autenticou = false;
        let erroAuth = "";
        try {
          await tokenJibble();
          autenticou = true;
        } catch (e) {
          erroAuth = e instanceof Error ? e.message : "falhou";
        }
        if (!autenticou) return resp({ autenticou, erro: erroAuth, fontes });

        const tentar = async (nome: string, url: string) => {
          try {
            const r = await jibble(url);
            const lista = (r.value ?? r.data ?? []) as unknown[];
            fontes.push({
              nome,
              url,
              registros: Array.isArray(lista) ? lista.length : 0,
              total: r["@odata.count"] ?? null,
              // Uma amostra crua ajuda a ver os nomes reais dos campos sem
              // adivinhar — é o que decide como converter na importação.
              amostra: Array.isArray(lista) && lista.length ? lista[0] : null,
            });
          } catch (e) {
            fontes.push({ nome, url, erro: e instanceof Error ? e.message : "falhou" });
          }
        };

        await tentar("pessoas", `${HOST_WORKSPACE}/People?$top=5&$count=true`);
        if (de && ate) {
          await tentar(
            "batidas",
            `${HOST_TRACKING}/TimeEntries?$top=5&$count=true&$filter=time ge ${de}T00:00:00Z and time le ${ate}T23:59:59Z`,
          );
          await tentar(
            "resumo_diario",
            `${HOST_ATTENDANCE}/TimesheetsSummary?date=${de}&endDate=${ate}&period=Custom&$top=5`,
          );
          await tentar(
            "resumo_diario_alt",
            `${HOST_ATTENDANCE}/DailyTimesheets?date=${de}&endDate=${ate}&$top=5`,
          );
        }
        return resp({ autenticou: true, periodo: { de, ate }, fontes });
      }

      /* As pessoas do relógio, para a tela vincular a cada ficha do RH.
         Não gravamos ficha nenhuma aqui: quem manda no cadastro é o RH, e
         criar pessoa a partir do relógio encheria o quadro de gente que já
         existe com outro nome. */
      case "pessoas": {
        const r = await jibble(`${HOST_WORKSPACE}/People?$top=200&$count=true`);
        const lista = ((r.value ?? []) as Record<string, any>[]).map((p) => ({
          jibbleId: String(p.id ?? ""),
          nome: String(p.fullName ?? p.name ?? ""),
          email: String(p.email ?? ""),
          status: String(p.status ?? ""),
        }));
        return resp({ pessoas: lista, total: r["@odata.count"] ?? lista.length });
      }

      /* IMPORTAR as batidas de um período. Uma janela por chamada (teto de
         150s); a tela comanda o laço com o cursor `skip`. */
      case "importar": {
        const de = String(body.de ?? "");
        const ate = String(body.ate ?? "");
        const skip = Math.max(0, numero(body.skip));
        const tamanho = 500;
        if (!de || !ate) return resp({ erro: "Informe o período (de, ate)." }, 400);

        /* A JANELA PEDIDA AO JIBBLE É EM UTC; o dia que gravamos é LOCAL.
           Pedir de T00:00Z a ate T23:59Z parecia certo e errava nas duas
           pontas: a batida das 22h do último dia (já 01:00Z do dia seguinte)
           ficava de fora do mês, e a batida das 22h do último dia do mês
           ANTERIOR entrava — sobrescrevendo, pela metade, um dia que a
           importação anterior já tinha fechado. A janela agora é exatamente o
           intervalo de dias locais pedido. */
        const inicioUtc = `${de}T03:00:00Z`;              // 00:00 local
        const fimUtc = `${somaDias(ate, 1)}T03:00:00Z`;   // 00:00 local do dia seguinte (exclusivo)
        const url = `${HOST_TRACKING}/TimeEntries?$top=${tamanho}&$skip=${skip}&$count=true` +
          `&$filter=time ge ${inicioUtc} and time lt ${fimUtc}&$orderby=time asc`;
        const r = await jibble(url);
        const entradas = (r.value ?? []) as Record<string, any>[];

        // O Jibble entrega BATIDAS; a unidade com que o RH trabalha é o DIA.
        const porDia = new Map<string, Record<string, any>>();
        for (const e of entradas) {
          const jibbleId = String(e.personId ?? e.person?.id ?? "");
          const quando = localDe(e.time ?? e.startTime ?? e.date);
          if (!jibbleId || !quando) continue;
          // Fora da competência pedida (a folga do fuso pode trazer vizinhos).
          if (quando.dia < de || quando.dia > ate) continue;
          const chave = `pd_${jibbleId}_${quando.dia}`;
          const atual = porDia.get(chave) ?? {
            id: chave,
            jibbleId,
            pessoaNome: String(e.person?.fullName ?? e.personName ?? ""),
            data: quando.dia,
            origem: "jibble",
            corrigido: false,
            batidas: [] as { hora: string; tipo: string }[],
          };
          const tipo = String(e.type ?? e.entryType ?? "").toLowerCase();
          atual.batidas.push({ hora: quando.hora, tipo });
          porDia.set(chave, atual);
        }

        /* MESCLA COM O QUE JÁ ESTÁ GRAVADO — e é isto que salva o dia partido
           na fronteira das páginas. A janela 1 podia terminar no meio de um
           dia; a janela 2 trazia o resto e, gravando o registro inteiro, apagava
           a manhã: o dia valia 4h em vez de 8h e virava desconto na folha.
           Aqui as batidas das duas janelas se somam antes de fechar a conta. */
        const ids = [...porDia.keys()];
        const jaGravados = await diasJaGravados(ids);

        const dias: Record<string, any>[] = [];
        let preservados = 0;
        for (const [chave, novo] of porDia) {
          const antigo = jaGravados.get(chave);
          // Dia corrigido à mão pelo RH manda: a importação não o toca.
          if (antigo?.corrigido === true) { preservados++; continue; }
          const todas = [...((antigo?.batidas ?? []) as { hora: string; tipo: string }[]), ...novo.batidas];
          // Dedup: reimportar o mesmo período não pode duplicar batida.
          const vistas = new Set<string>();
          const batidas = todas.filter((b) => {
            const k = `${b.hora}|${b.tipo}`;
            if (vistas.has(k)) return false;
            vistas.add(k);
            return true;
          });
          const fechado = fecharDia(batidas);
          dias.push({
            ...novo,
            pessoaId: antigo?.pessoaId ?? undefined,  // o vínculo é da tela; a ponte não mexe
            pessoaNome: novo.pessoaNome || antigo?.pessoaNome || "",
            batidas,
            entrada: fechado.entrada,
            saida: fechado.saida,
            pausaMin: fechado.pausaMin,
            trabalhadoMin: fechado.trabalhadoMin,
            emAberto: fechado.emAberto,
            inconsistente: fechado.inconsistente,
          });
        }

        const gravados = await gravarVarios("rh_ponto_dia", dias);

        const total = numero(r["@odata.count"]);
        const proximaSkip = entradas.length === tamanho ? skip + tamanho : null;
        return resp({
          lidos: entradas.length,
          dias: dias.length,
          gravados,
          preservados,
          total,
          skip,
          proximaSkip,
        });
      }

      case "carimbarImportacao": {
        await gravarMeta("jibble:ultimaImportacao", {
          em: new Date().toISOString(),
          por: String(cracha?.sub ?? "maquina"),
          ...(body.resumo ?? {}),
        });
        return resp({ ok: true });
      }

      default:
        return resp({ erro: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return resp({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
