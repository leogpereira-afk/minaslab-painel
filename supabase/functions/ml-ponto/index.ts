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

/* identity.PROD.jibble.io — o "prod" não é enfeite: identity.jibble.io não
   existe (nem resolve em DNS), e sem ele a ponte morria antes de pedir a
   primeira batida. Medido em 27/08/2026 pela ação `diagnostico`, que existe
   exatamente para isto: perguntar, em vez de o código apostar num endereço. */
const IDENTITY = "https://identity.prod.jibble.io/connect/token";
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
  /* DUAS FORMAS DE APRESENTAR A CREDENCIAL, nesta ordem. O padrão OAuth aceita
     as duas e servidores diferentes preferem uma: no corpo do pedido
     (client_secret_post) ou no cabeçalho Basic (client_secret_basic). Como as
     duas devolvem o MESMO "invalid_client" quando falham, tentar só uma deixa
     a dúvida entre "segredo errado" e "forma errada" — e a dúvida custou uma
     ida e volta com o usuário. */
  const tentar = async (comBasic: boolean) => {
    const corpo = new URLSearchParams({ grant_type: "client_credentials" });
    const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
    if (comBasic) {
      headers.Authorization = "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    } else {
      corpo.set("client_id", CLIENT_ID);
      corpo.set("client_secret", CLIENT_SECRET);
    }
    const r = await fetch(IDENTITY, { method: "POST", headers, body: corpo.toString() });
    const dados = await r.json().catch(() => ({} as Record<string, unknown>));
    return { ok: r.ok && !!dados.access_token, dados, status: r.status };
  };

  let tentativa = await tentar(false);
  if (!tentativa.ok) tentativa = await tentar(true);
  const { ok, dados, status } = tentativa;
  if (!ok) {
    /* A mensagem do Jibble volta como error/error_description e NÃO carrega o
       segredo — mas o corpo inteiro poderia. Repassamos só o essencial. */
    const erro = String(dados.error_description ?? dados.error ?? status);
    throw new Error("Jibble · autenticação: " + erro + " (tentado no corpo e em Basic)");
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

/* Duração ISO 8601 do Jibble → minutos. "PT8H12M21S" = 492 min;
   "P1DT6H23M53S" = 1823 min. Devolve null para o que não entende — 0 minuto
   seria indistinguível de "não trabalhou", e a diferença entre as duas coisas
   é justamente o que o RH precisa ver. */
function duracaoISO(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return null;
  const [, d, h, min, seg] = m;
  const total = (Number(d) || 0) * 1440 + (Number(h) || 0) * 60 + (Number(min) || 0) + (Number(seg) || 0) / 60;
  return Math.round(total);
}

/* "2026-08-17T08:03:36.18107-03:00" → "08:03".
   O Jibble já devolve o instante NO FUSO DA PESSOA (o offset vem junto), então
   a hora local são os caracteres 11..16 — sem conversão nenhuma. Converter à
   mão foi o que jogava a batida das 22h para o dia seguinte. */
const horaLocal = (iso: unknown): string => {
  const s = String(iso ?? "");
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(11, 16) : "";
};

/* POR QUE NÃO REAGREGAMOS AS BATIDAS CRUAS.
   A primeira versão daqui montava o dia a partir dos pares entra→sai do
   TimeEntries. Media-se, então descobriu-se (27/08/2026, pela ação
   `diagnostico`) que o Jibble já entrega o dia FECHADO em TimesheetsSummary,
   respeitando a escala de cada pessoa: primeira entrada, última saída, pausa
   paga e não paga, horas da folha e hora extra SEPARADA POR TIPO (dia normal,
   dia de descanso, feriado — que na CLT valem adicionais diferentes).
   É a mesma decisão que a Impresilk tomou com o cartão do Secullum: quando o
   relógio já apurou, o painel usa o número DELE. Refazer a conta aqui criaria
   um segundo resultado, e o número do painel passaria a divergir do que a
   própria pessoa vê no aplicativo — e número em que o RH não confia manda todo
   mundo de volta para a planilha. */

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
        if (!autenticou) {
          /* O FORMATO do que foi gravado, NUNCA o valor. "invalid_client" tem
             três causas comuns e indistinguíveis pela mensagem do Jibble:
             segredo colado pela metade, espaço invisível no começo/fim, ou o
             par trocado (o ID é de um cliente e o segredo é de outro). Estes
             três números respondem qual é, sem revelar nada: o Client ID não é
             segredo (aparece na tela do Jibble) e do segredo só sai o tamanho. */
          return resp({
            autenticou,
            erro: erroAuth,
            credencial: {
              clientId: CLIENT_ID,
              idTemEspacos: CLIENT_ID !== CLIENT_ID.trim(),
              segredoTamanho: CLIENT_SECRET.length,
              segredoTemEspacos: CLIENT_SECRET !== CLIENT_SECRET.trim(),
              segredoTemQuebraDeLinha: /[\r\n]/.test(CLIENT_SECRET),
              /* As pontas do segredo — 3 caracteres de cada lado, e só quando a
                 autenticação JÁ falhou. É o que distingue "colei o pedaço que
                 aparecia na tela" de "colei o valor inteiro": se o fim bate com
                 onde o campo estava cortado, o segredo veio truncado. Três
                 caracteres de 46 não abrem porta nenhuma. */
              segredoComeca: CLIENT_SECRET.slice(0, 3),
              segredoTermina: CLIENT_SECRET.slice(-3),
            },
            fontes,
          });
        }

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
      /* AS PESSOAS DO RELÓGIO, já casadas com as fichas do RH.
         Devolve a lista pronta para a tela criar as fichas que faltam — mas
         NÃO cria nada aqui. Quem manda no cadastro é o RH: se a ponte criasse
         ficha sozinha, um nome digitado diferente no relógio viraria um
         funcionário novo que nunca existiu, e ninguém descobriria até a folha.
         O casamento é por jibbleId, NUNCA por nome (nome igual entre duas
         pessoas cria sósia; nome que mudou some com a pessoa). */
      case "pessoas": {
        const r = await jibble(`${HOST_WORKSPACE}/People?$top=200&$count=true`);
        const doRelogio = ((r.value ?? []) as Record<string, any>[]).map((p) => {
          const removido = !!p.removedAt || String(p.status ?? "") === "Removed";
          return {
            jibbleId: String(p.id ?? ""),
            nome: String(p.fullName ?? p.name ?? "").trim(),
            apelido: String(p.preferredName ?? "").trim(),
            email: String(p.email ?? "").trim(),
            telefone: String(p.phoneNumber ?? "").trim(),
            matricula: String(p.code ?? "").trim(),
            // joinDate é o dia em que a pessoa entrou NO RELÓGIO. Vira sugestão
            // de admissão, não verdade: quem entrou na empresa antes de o
            // Jibble existir tem admissão anterior, e é o RH que sabe.
            entrouNoRelogio: String(p.joinDate ?? p.workStartDate ?? "").slice(0, 10),
            statusRelogio: String(p.status ?? ""),
            removidoEm: String(p.removedAt ?? "").slice(0, 10),
            ativoNoRelogio: !removido,
          };
        }).filter((p) => p.jibbleId);

        // O de-para com as fichas que já existem (por jibbleId).
        const { data: fichas } = await sb.from(T_REG)
          .select("registro").eq("colecao", "rh_pessoas").eq("apagado", false);
        const porJibble = new Map<string, Record<string, any>>();
        for (const l of fichas ?? []) {
          const f = l.registro as Record<string, any>;
          if (f?.jibbleId) porJibble.set(String(f.jibbleId), f);
        }

        const pessoas = doRelogio.map((p) => {
          const ficha = porJibble.get(p.jibbleId);
          return {
            ...p,
            pessoaId: ficha?.id ?? "",
            temFicha: !!ficha,
            fichaAtiva: ficha ? ficha.ativo !== false : null,
            /* DIVERGÊNCIA, não correção automática: pessoa removida no relógio
               com ficha ativa (ou o contrário) é apontada para o RH decidir.
               Desligar alguém é ato trabalhista, com data e verbas — nunca a
               consequência silenciosa de um cadastro em outro sistema. */
            divergeAtivo: ficha ? (ficha.ativo !== false) !== p.ativoNoRelogio : false,
          };
        });

        return resp({
          pessoas,
          total: numero(r["@odata.count"]) || pessoas.length,
          semFicha: pessoas.filter((p) => !p.temFicha).length,
          divergentes: pessoas.filter((p) => p.divergeAtivo).length,
        });
      }

      /* IMPORTAR o resumo diário de um período. A unidade da paginação é a
         PESSOA (cada item traz o mês inteiro dela), então 20 pessoas cabem em
         uma ou duas chamadas — bem abaixo do teto de 150s. */
      case "importar": {
        const de = String(body.de ?? "");
        const ate = String(body.ate ?? "");
        const skip = Math.max(0, numero(body.skip));
        const tamanho = 10;
        if (!de || !ate) return resp({ erro: "Informe o período (de, ate)." }, 400);

        const url = `${HOST_ATTENDANCE}/TimesheetsSummary` +
          `?date=${de}&endDate=${ate}&period=Custom&$top=${tamanho}&$skip=${skip}`;
        const r = await jibble(url);
        const pessoas = (r.value ?? []) as Record<string, any>[];

        /* Um registro por pessoa/dia, com o que o RELÓGIO apurou. Os nomes dos
           campos do Jibble e o que fazemos com cada um:
             firstIn/lastOut  → entrada/saida (já vêm no fuso da pessoa)
             unpaidBreak      → pausaMin (o almoço, que não é tempo trabalhado)
             payrollHours     → trabalhadoMin, o que vai para a folha
             tracked          → trackedMin, o tempo de crachá aberto (só leitura)
             dailyOvertime    → extraMin, hora extra de dia normal (+50%)
             restDay/publicHoliday/doubleOvertime → extraDobroMin (+100%)
           Guardamos os dois adicionais SEPARADOS porque a CLT os paga
           diferente: somá-los aqui obrigaria a tela a adivinhar depois qual
           fator usar, e adivinhar erra em dinheiro. */
        const linhas: Record<string, any>[] = [];
        for (const p of pessoas) {
          const jibbleId = String(p.personId ?? "");
          const nome = String(p.person?.fullName ?? "");
          if (!jibbleId) continue;
          for (const d of (p.daily ?? []) as Record<string, any>[]) {
            const dia = String(d.date ?? "").slice(0, 10);
            if (!dia || dia < de || dia > ate) continue;
            const trabalhado = duracaoISO(d.payrollHours);
            const tracked = duracaoISO(d.tracked);
            /* DIA SEM MOVIMENTO NÃO VIRA REGISTRO. Gravar o dia vazio encheria
               a tela de zeros e faria "sem batida" parecer "trabalhou 0h" — e
               falta quem decide é a escala, não a ausência de linha aqui. */
            if (!d.firstIn && !tracked) continue;
            linhas.push({
              id: `pd_${jibbleId}_${dia}`,
              jibbleId,
              pessoaNome: nome,
              data: dia,
              entrada: horaLocal(d.firstIn),
              saida: horaLocal(d.lastOut),
              pausaMin: duracaoISO(d.unpaidBreak) ?? 0,
              pausaPagaMin: duracaoISO(d.paidBreak) ?? 0,
              trabalhadoMin: trabalhado,
              trackedMin: tracked,
              extraMin: duracaoISO(d.dailyOvertime) ?? 0,
              extraDobroMin:
                (duracaoISO(d.dailyDoubleOvertime) ?? 0) +
                (duracaoISO(d.restDayOvertime) ?? 0) +
                (duracaoISO(d.publicHolidayOvertime) ?? 0),
              // Entrou e não saiu: o dia não afirma total nenhum, e a tela
              // mostra "em aberto" — o esquecimento é o que o RH precisa ver.
              emAberto: !!d.firstIn && !d.lastOut,
              origem: "jibble",
              corrigido: false,
            });
          }
        }

        // Dia corrigido à mão pelo RH manda: a importação não o toca.
        const jaGravados = await diasJaGravados(linhas.map((l) => String(l.id)));
        const dias: Record<string, any>[] = [];
        let preservados = 0;
        for (const l of linhas) {
          const antigo = jaGravados.get(String(l.id));
          if (antigo?.corrigido === true) { preservados++; continue; }
          // O vínculo pessoa↔ficha é da tela; a ponte não mexe nele.
          dias.push(antigo?.pessoaId ? { ...l, pessoaId: antigo.pessoaId } : l);
        }

        const gravados = await gravarVarios("rh_ponto_dia", dias);
        const proximaSkip = pessoas.length === tamanho ? skip + tamanho : null;
        return resp({
          lidos: pessoas.length,
          dias: dias.length,
          gravados,
          preservados,
          skip,
          proximaSkip,
        });
      }

      /* SINCRONIZAR — o botão único do topo da tela: "Puxar do relógio".
         Faz, numa chamada só, o que antes eram três passos manuais:
           1) traz as pessoas do relógio e CRIA no RH a ficha de quem não tem;
           2) o vínculo nasce pronto (a ficha já guarda o jibbleId) — não existe
              mais tela de "vincular", que era o passo que ninguém completava:
              numa casa com o RH vazio, o seletor de ficha aparecia sem opção
              nenhuma e a pessoa ficava sem saber o que fazer;
           3) importa o resumo diário do período e CARIMBA o pessoaId nos dias,
              inclusive nos que já estavam importados sem vínculo.
         Continua valendo o que não se automatiza: ficha que já existe não é
         sobrescrita (o RH sabe mais que o relógio), e ninguém é DESLIGADO por
         estar removido no relógio — isso vira aviso, porque desligar tem data
         e verbas. */
      case "sincronizar": {
        const de = String(body.de ?? "");
        const ate = String(body.ate ?? "");
        if (!de || !ate) return resp({ erro: "Informe o período (de, ate)." }, 400);

        // ---- 1. as pessoas do relógio
        const rp = await jibble(`${HOST_WORKSPACE}/People?$top=200&$count=true`);
        const doRelogio = ((rp.value ?? []) as Record<string, any>[]).map((p) => {
          const removido = !!p.removedAt || String(p.status ?? "") === "Removed";
          return {
            jibbleId: String(p.id ?? ""),
            nome: String(p.fullName ?? p.name ?? "").trim(),
            apelido: String(p.preferredName ?? "").trim(),
            email: String(p.email ?? "").trim(),
            telefone: String(p.phoneNumber ?? "").trim(),
            matricula: String(p.code ?? "").trim(),
            entrouNoRelogio: String(p.joinDate ?? p.workStartDate ?? "").slice(0, 10),
            removidoEm: String(p.removedAt ?? "").slice(0, 10),
            ativoNoRelogio: !removido,
          };
        }).filter((p) => p.jibbleId && p.nome);

        // ---- 2. as fichas que já existem (casadas por jibbleId, NUNCA por nome)
        const { data: fichasBrutas } = await sb.from(T_REG)
          .select("id, registro").eq("colecao", "rh_pessoas").eq("apagado", false);
        const fichaPorJibble = new Map<string, Record<string, any>>();
        for (const l of fichasBrutas ?? []) {
          const f = l.registro as Record<string, any>;
          if (f?.jibbleId) fichaPorJibble.set(String(f.jibbleId), f);
        }

        const agora = new Date().toISOString();
        const novas: Record<string, unknown>[] = [];
        const completadas: Record<string, unknown>[] = [];
        const divergencias: Record<string, unknown>[] = [];

        for (const p of doRelogio) {
          const ficha = fichaPorJibble.get(p.jibbleId);
          if (!ficha) {
            novas.push({
              id: `pes_${p.jibbleId}`,
              nome: p.nome,
              apelido: p.apelido,
              email: p.email,
              telefone: p.telefone,
              matricula: p.matricula,
              jibbleId: p.jibbleId,
              /* A ADMISSÃO É SUGESTÃO, e o campo ao lado diz isso. joinDate é o
                 dia em que a pessoa entrou NO RELÓGIO, não na empresa: quem
                 trabalhava antes de o Jibble existir tem admissão anterior, e
                 admissão errada estraga férias, experiência e 13º. */
              admissao: p.entrouNoRelogio,
              admissaoConferida: false,
              ativo: p.ativoNoRelogio,
              desligadoEm: p.ativoNoRelogio ? "" : p.removidoEm,
              origem: "jibble",
              criadoEm: agora,
            });
            continue;
          }
          // Ficha existente: só preenche o que está VAZIO. A ficha do RH tem
          // mais informação que o relógio e é a verdade.
          const faltando: Record<string, unknown> = {};
          if (!ficha.jibbleId) faltando.jibbleId = p.jibbleId;
          if (!ficha.email && p.email) faltando.email = p.email;
          if (!ficha.telefone && p.telefone) faltando.telefone = p.telefone;
          if (!ficha.matricula && p.matricula) faltando.matricula = p.matricula;
          if (!ficha.apelido && p.apelido) faltando.apelido = p.apelido;
          if (Object.keys(faltando).length) completadas.push({ ...ficha, ...faltando });
          // Situação divergente é AVISO, nunca correção automática.
          if ((ficha.ativo !== false) !== p.ativoNoRelogio) {
            /* O jibbleId VAI JUNTO, e é ele a chave de quem lê. Sem
               identificador, duas "Maria Silva" na mesma situação viravam UMA
               linha na tela (a dedução por nome funde), o RH resolvia uma,
               achava que acabou, e a segunda seguia ativa na folha. Homonímia
               em folha de pagamento é comum, e a fusão é silenciosa. */
            divergencias.push({
              jibbleId: p.jibbleId,
              pessoaId: ficha.id ?? "",
              nome: ficha.nome ?? p.nome,
              noRelogio: p.ativoNoRelogio ? "ativa" : "removida",
              naFicha: ficha.ativo !== false ? "ativa" : "desligada",
            });
          }
        }

        const fichasCriadas = await gravarVarios("rh_pessoas", novas);
        const fichasCompletadas = await gravarVarios("rh_pessoas", completadas);

        // ---- 3. o resumo diário do período (uma janela por chamada)
        const skip = Math.max(0, numero(body.skip));
        const tamanho = 10;
        const ru = `${HOST_ATTENDANCE}/TimesheetsSummary` +
          `?date=${de}&endDate=${ate}&period=Custom&$top=${tamanho}&$skip=${skip}`;
        const rr = await jibble(ru);
        const pessoasResumo = (rr.value ?? []) as Record<string, any>[];

        // O de-para completo depois das criações: é ele que carimba o vínculo.
        const idFichaPorJibble = new Map<string, string>();
        for (const [j, f] of fichaPorJibble) idFichaPorJibble.set(j, String(f.id));
        for (const n of novas) idFichaPorJibble.set(String(n.jibbleId), String(n.id));

        const linhas: Record<string, any>[] = [];
        for (const pr of pessoasResumo) {
          const jibbleId = String(pr.personId ?? "");
          if (!jibbleId) continue;
          for (const d of (pr.daily ?? []) as Record<string, any>[]) {
            const dia = String(d.date ?? "").slice(0, 10);
            if (!dia || dia < de || dia > ate) continue;
            const trabalhado = duracaoISO(d.payrollHours);
            const tracked = duracaoISO(d.tracked);
            if (!d.firstIn && !tracked) continue;
            linhas.push({
              id: `pd_${jibbleId}_${dia}`,
              jibbleId,
              pessoaId: idFichaPorJibble.get(jibbleId) ?? "",
              pessoaNome: String(pr.person?.fullName ?? ""),
              data: dia,
              entrada: horaLocal(d.firstIn),
              saida: horaLocal(d.lastOut),
              pausaMin: duracaoISO(d.unpaidBreak) ?? 0,
              pausaPagaMin: duracaoISO(d.paidBreak) ?? 0,
              trabalhadoMin: trabalhado,
              trackedMin: tracked,
              extraMin: duracaoISO(d.dailyOvertime) ?? 0,
              extraDobroMin:
                (duracaoISO(d.dailyDoubleOvertime) ?? 0) +
                (duracaoISO(d.restDayOvertime) ?? 0) +
                (duracaoISO(d.publicHolidayOvertime) ?? 0),
              emAberto: !!d.firstIn && !d.lastOut,
              origem: "jibble",
              corrigido: false,
            });
          }
        }

        const jaGravados = await diasJaGravados(linhas.map((l) => String(l.id)));
        const dias: Record<string, any>[] = [];
        let preservados = 0;
        for (const l of linhas) {
          const antigo = jaGravados.get(String(l.id));
          if (antigo?.corrigido === true) { preservados++; continue; }
          dias.push(l);
        }
        const diasGravados = await gravarVarios("rh_ponto_dia", dias);

        /* ---- 4. carimba o vínculo nos dias que JÁ estavam importados sem ele.
           Sem este passo, os 120 dias trazidos antes de existirem as fichas
           continuariam como "pessoa não vinculada" para sempre — e a tela
           mostraria identificador no lugar de gente. */
        let vinculados = 0;
        if (idFichaPorJibble.size) {
          const { data: semVinculo } = await sb.from(T_REG)
            .select("id, registro").eq("colecao", "rh_ponto_dia").eq("apagado", false)
            .limit(2000);
          const ajustar = (semVinculo ?? [])
            .map((l) => l.registro as Record<string, any>)
            .filter((r) => !r.pessoaId && r.jibbleId && idFichaPorJibble.has(String(r.jibbleId)))
            .map((r) => ({ ...r, pessoaId: idFichaPorJibble.get(String(r.jibbleId)) }));
          vinculados = await gravarVarios("rh_ponto_dia", ajustar);
        }

        const proximaSkip = pessoasResumo.length === tamanho ? skip + tamanho : null;
        await gravarMeta("jibble:ultimaImportacao", {
          em: agora, por: String(cracha?.sub ?? "maquina"), de, ate,
          fichasCriadas, diasGravados, vinculados,
        });

        return resp({
          ok: true,
          pessoasNoRelogio: doRelogio.length,
          ativas: doRelogio.filter((p) => p.ativoNoRelogio).length,
          removidas: doRelogio.filter((p) => !p.ativoNoRelogio).length,
          fichasCriadas,
          fichasCompletadas,
          diasGravados,
          preservados,
          vinculados,
          divergencias,
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
