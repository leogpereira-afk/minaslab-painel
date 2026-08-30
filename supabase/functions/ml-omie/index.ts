// ============================================================================
// ml-omie — a ponte com o ERP Omie (app.omie.com.br) do Painel MinasLab.
//
// O painel existe para fazer o que o ERP NÃO faz: análise. Então esta ponte só
// LÊ do Omie e guarda uma cópia local para as telas de Finanças cruzarem —
// nunca escreve nada lá. O que o ERP manda continua sendo o ERP.
//
// SEGREDO: as credenciais (ML_OMIE_APP_KEY / ML_OMIE_APP_SECRET) vivem nos
// Secrets do Supabase e NUNCA saem daqui — nem em resposta, nem em log. Este
// repositório é público.
//
// QUEM ENTRA: as mesmas quatro conferências do ml-sync (assinatura, validade,
// sis="minaslab", papel) — e aqui o papel exigido é DIREÇÃO: dinheiro da casa
// não é assunto do operacional. O x-token de máquina é só para rotina/backup.
//
// TETO DE 150s (regra da casa): nada de varredura longa aqui. Cada chamada
// puxa UMA página e devolve o cursor; quem comanda o laço é a tela, que mostra
// onde está e pode parar. O que já veio fica gravado — nada se perde.
//
// FILA DE UM: o Omie derruba a chave por "consumo indevido" quando várias
// chamadas chegam juntas. Uma requisição por vez, com pausa curta entre
// páginas. Lentidão é preço; chave bloqueada é o sistema parado.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("ML_TOKEN") ?? "";
const JWT_SECRET = Deno.env.get("ML_JWT_SECRET") ?? "";
const APP_KEY = Deno.env.get("ML_OMIE_APP_KEY") ?? "";
const APP_SECRET = Deno.env.get("ML_OMIE_APP_SECRET") ?? "";

const T_REG = "ml_registros";
const T_META = "ml_meta";
const SIS = "minaslab";
const OMIE_URL = "https://app.omie.com.br/api/v1/";

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

// ---------------------------------------------------------------- Omie
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Uma conversa com o Omie. A mensagem de erro que sai daqui é a `faultstring`
   do ERP — NUNCA o corpo inteiro, que carrega o app_key de volta no eco. */
async function omie(modulo: string, call: string, param: Record<string, unknown>) {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error("O Omie ainda não foi ligado: faltam os segredos ML_OMIE_APP_KEY / ML_OMIE_APP_SECRET.");
  }
  const resposta = await fetch(OMIE_URL + modulo + "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ call, app_key: APP_KEY, app_secret: APP_SECRET, param: [param] }),
  });
  const corpo = await resposta.json().catch(() => ({} as Record<string, unknown>));
  if (!resposta.ok) {
    const falha = String((corpo as { faultstring?: string }).faultstring ?? resposta.status);
    /* "não existem registros" é RESPOSTA, não falha: o Omie devolve 500 com
       essa frase para período vazio. Tratar como erro faria a importação
       parar no primeiro mês sem movimento. */
    if (/não existem registros|nao existem registros/i.test(falha)) return { vazio: true } as Record<string, unknown>;
    throw new Error("Omie · " + call + ": " + falha);
  }
  return corpo as Record<string, unknown>;
}

// "2026-08-27" → "27/08/2026" (o formato que os filtros do Omie exigem).
const isoParaBR = (d: string) => {
  const p = String(d || "").slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : "";
};
// "27/08/2026" → "2026-08-27"; qualquer outra coisa → "".
const brParaISO = (d: unknown) => {
  const p = String(d || "").split("/");
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : "";
};
const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

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

/* Grava em lote e CONFERE O EFEITO: devolve quantas linhas o banco confirmou.
   "Não deu erro" não é "gravou" — e uma importação que mente sobre o que
   trouxe é pior que importação nenhuma. */
async function gravarVarios(colecao: string, registros: Record<string, unknown>[]) {
  if (!registros.length) return 0;
  const agora = new Date().toISOString();
  const linhas = registros.map((r) => ({
    colecao,
    id: String(r.id),
    registro: { ...r, atualizadoPor: "omie", atualizadoEm: agora },
    apagado: false,
    atualizado_em: agora,
  }));
  const { data, error } = await sb.from(T_REG).upsert(linhas).select("id");
  if (error) throw error;
  await bump(colecao);
  return data?.length ?? 0;
}

async function lerMeta(chave: string) {
  const { data } = await sb.from(T_META).select("valor").eq("chave", chave).maybeSingle();
  return data?.valor ?? null;
}
async function gravarMeta(chave: string, valor: unknown) {
  await sb.from(T_META).upsert({ chave, valor, atualizado_em: new Date().toISOString() });
}

// ---------------------------------------------------------------- conversões
/* Uma nota fiscal do Omie vira uma VENDA nossa, com os itens dentro — é dos
   itens que sai a curva ABC de produtos, e do cabeçalho a de clientes.
   Cancelada NÃO é apagada: ela vira `cancelada:true` e sai das somas. Apagar
   esconderia que a venda existiu, e o mês fecharia diferente do ERP sem
   ninguém entender por quê. */
function notaParaVenda(nf: Record<string, any>): Record<string, unknown> {
  const cab = nf.nfCabec ?? {};
  const dest = nf.nfDestInt ?? {};
  const info = nf.nfInfoCadastro ?? {};
  const total = nf.nfTotal ?? {};
  const itens = (nf.det ?? []).map((d: Record<string, any>) => ({
    codigo: String(d?.prod?.cProd ?? ""),
    descricao: String(d?.prod?.xProd ?? ""),
    quantidade: numero(d?.prod?.qCom),
    unitario: numero(d?.prod?.vUnCom),
    valor: numero(d?.prod?.vProd),
  }));
  const cancelada = String(info.cancelada ?? "N").toUpperCase() === "S" ||
    String(info.denegada ?? "N").toUpperCase() === "S";
  return {
    id: `nf_${cab.nIdNF ?? cab.nNF ?? ""}`,
    origem: "omie",
    omieId: String(cab.nIdNF ?? ""),
    documento: "NF",
    numero: String(cab.nNF ?? ""),
    data: brParaISO(cab.dEmi) || brParaISO(info.dEmi),
    clienteId: String(dest.nCodCli ?? dest.cCodInt ?? ""),
    clienteNome: String(dest.cRazao ?? dest.xNome ?? ""),
    clienteDoc: String(dest.cnpj_cpf ?? ""),
    valor: numero(total?.ICMSTot?.vNF ?? total?.vNF),
    itens,
    cancelada,
  };
}

/* Uma ordem de serviço do Omie vira venda também: laboratório fatura SERVIÇO,
   e é o serviço (o ensaio) que responde "o que mais vendemos". O painel trata
   os dois na mesma coleção para a análise não ter duas verdades. */
function osParaVenda(os: Record<string, any>): Record<string, unknown> {
  const cab = os.Cabecalho ?? {};
  const info = os.InformacoesAdicionais ?? {};
  const itens = (os.ServicosPrestados ?? []).map((s: Record<string, any>) => ({
    codigo: String(s?.cCodServico ?? s?.nCodServico ?? ""),
    descricao: String(s?.cDescServ ?? s?.cDescricao ?? ""),
    quantidade: numero(s?.nQtde) || 1,
    unitario: numero(s?.nValUnit),
    valor: numero(s?.nValTotal ?? s?.nValUnit),
  }));
  const status = String(cab.cEtapa ?? "");
  return {
    id: `os_${cab.nCodOS ?? ""}`,
    origem: "omie",
    omieId: String(cab.nCodOS ?? ""),
    documento: "OS",
    numero: String(cab.cNumOS ?? ""),
    data: brParaISO(cab.dDtPrevisao) || brParaISO(info.dDtInc),
    clienteId: String(cab.nCodCli ?? ""),
    clienteNome: "",  // o nome vem do cadastro de clientes (ver casarClientes)
    valor: itens.reduce((s: number, i: { valor: number }) => s + i.valor, 0),
    itens,
    etapa: status,
    // Etapa 50 = cancelada no Omie. Mesma regra da NF: sai da soma, fica no histórico.
    cancelada: status === "50",
  };
}

/* Um título a receber. `status_titulo` do Omie: RECEBIDO / A RECEBER /
   ATRASADO / CANCELADO. O painel NÃO deduz atraso pela data: usa o status do
   ERP e, quando ele diz "A RECEBER", compara a data — intenção não é fato,
   mas data vencida com título aberto é fato. */
function tituloParaReceber(t: Record<string, any>): Record<string, unknown> {
  const status = String(t.status_titulo ?? "").toUpperCase();
  return {
    id: `rec_${t.codigo_lancamento_omie ?? t.codigo_lancamento_integracao ?? ""}`,
    origem: "omie",
    omieId: String(t.codigo_lancamento_omie ?? ""),
    numero: String(t.numero_documento ?? t.numero_parcela ?? ""),
    clienteId: String(t.codigo_cliente_fornecedor ?? ""),
    clienteNome: "",
    emissao: brParaISO(t.data_emissao),
    vencimento: brParaISO(t.data_vencimento),
    pagoEm: brParaISO(t.data_pagamento),
    valor: numero(t.valor_documento),
    valorPago: numero(t.valor_pago),
    categoria: String(t.codigo_categoria ?? ""),
    status: status === "RECEBIDO" ? "pago" : status === "CANCELADO" ? "cancelado" : "aberto",
    statusOmie: status,
  };
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

  // Crachá da direção, ou token de máquina.
  const m = String(req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  const cracha = m ? await verificarJwt(m[1]) : null;
  const ehMaquina = !!TOKEN && req.headers.get("x-token") === TOKEN;
  if (!cracha && !ehMaquina) return resp({ erro: "Entre no sistema.", semSessao: true }, 401);
  if (!ehMaquina && String(cracha?.papel ?? "") !== "direcao") {
    return resp({ erro: "O financeiro é só da direção.", semPermissao: true }, 403);
  }

  try {
    switch (action) {
      /* Está ligado? Responde SEM chamar o Omie — é a pergunta que a tela faz
         antes de oferecer o botão de importar. */
      case "estado": {
        const ultima = await lerMeta("omie:ultimaImportacao");
        return resp({ ligado: !!APP_KEY && !!APP_SECRET, ultima });
      }

      /* DIAGNÓSTICO — a primeira coisa a rodar depois de ligar os segredos.
         Pergunta a cada fonte quantos registros existem no período, SEM
         importar nada. Serve de CASO DE CONTROLE: laboratório fatura serviço
         (OS/NFS-e), comércio fatura produto (NF) — e só o dado real diz de
         onde vem o faturamento desta casa. Zero em toda fonte é instrumento
         quebrado, não empresa parada. */
      case "diagnostico": {
        const de = String(body.de ?? "");
        const ate = String(body.ate ?? "");
        if (!de || !ate) return resp({ erro: "Informe o período (de, ate)." }, 400);
        const fontes: Record<string, unknown>[] = [];

        const tentar = async (nome: string, fn: () => Promise<Record<string, unknown>>) => {
          try {
            const r = await fn();
            fontes.push({ nome, ...r });
          } catch (e) {
            fontes.push({ nome, erro: e instanceof Error ? e.message : "falhou" });
          }
          await dormir(400);
        };

        await tentar("notas_fiscais", async () => {
          const r = await omie("produtos/nfconsultar", "ListarNF", {
            pagina: 1, registros_por_pagina: 50, apenas_importado_api: "N",
            dEmiInicial: isoParaBR(de), dEmiFinal: isoParaBR(ate),
          });
          const lista = (r.nfCadastro ?? []) as Record<string, any>[];
          const soma = lista.reduce((s, nf) => s + numero(nf?.nfTotal?.ICMSTot?.vNF), 0);
          return { registros: numero(r.nTotRegistros), paginas: numero(r.nTotPaginas), amostraSoma: soma };
        });

        /* AS ORDENS DE SERVIÇO: o nome do filtro de data varia entre as versões
           da API, e chutar custou uma rodada ("Tag [DDTPREVISAOATE] não faz
           parte da estrutura"). Em vez de apostar de novo, PERGUNTAMOS: sem
           filtro nenhum primeiro (isso já responde "existe OS?"), e depois cada
           nome candidato, reportando qual foi aceito. */
        await tentar("ordens_de_servico", async () => {
          const r = await omie("servicos/os", "ListarOS", {
            pagina: 1, registros_por_pagina: 50, apenas_importado_api: "N",
          });
          const lista = (r.osCadastro ?? []) as Record<string, any>[];
          return {
            registros: numero(r.nTotRegistros),
            paginas: numero(r.nTotPaginas),
            amostra: lista.length ? lista[0] : null,
          };
        });

        for (const par of [
          ["dDtPrevisaoInicial", "dDtPrevisaoFinal"],
          ["dDtInicial", "dDtFinal"],
          ["dDtFaturamentoInicial", "dDtFaturamentoFinal"],
        ]) {
          await tentar(`os_filtro_${par[0]}`, async () => {
            const r = await omie("servicos/os", "ListarOS", {
              pagina: 1, registros_por_pagina: 5, apenas_importado_api: "N",
              [par[0]]: isoParaBR(de), [par[1]]: isoParaBR(ate),
            });
            return { registros: numero(r.nTotRegistros), paginas: numero(r.nTotPaginas), aceito: true };
          });
        }

        /* O TÍTULO APONTA PARA UM PEDIDO — e pedido tem itens.
           A amostra crua de 30/08/2026 trouxe "numero_pedido": "1869" em título
           de RPS. Se houver pedido de venda no Omie, é ali que mora o SERVIÇO
           vendido, e a aba de Serviços deixa de ser um balde só ("SERVIÇOS
           REALIZADOS" concentra 99% do faturamento como categoria). Sondamos
           sem filtro de data primeiro: isso já responde "existe pedido?". */
        await tentar("pedidos_de_venda", async () => {
          const r = await omie("produtos/pedido", "ListarPedidos", {
            pagina: 1, registros_por_pagina: 5, apenas_importado_api: "N",
          });
          const lista = (r.pedido_venda_produto ?? []) as Record<string, any>[];
          return {
            registros: numero(r.total_de_registros),
            paginas: numero(r.total_de_paginas),
            amostra: lista.length ? lista[0] : null,
          };
        });

        /* O CADASTRO DE SERVIÇOS: mesmo sem pedido, se a casa mantém os ensaios
           cadastrados, o nome do serviço existe em algum lugar do Omie. */
        await tentar("cadastro_de_servicos", async () => {
          const r = await omie("servicos/servico", "ListarCadastroServico", {
            nPagina: 1, nRegPorPagina: 5,
          });
          const lista = (r.cadastros ?? r.servicoCadastro ?? []) as Record<string, any>[];
          return {
            registros: numero(r.nTotRegistros ?? r.total_de_registros),
            amostra: lista.length ? lista[0] : null,
          };
        });

        await tentar("contas_a_receber", async () => {
          const r = await omie("financas/contareceber", "ListarContasReceber", {
            pagina: 1, registros_por_pagina: 50, apenas_importado_api: "N",
            filtrar_por_data_de: isoParaBR(de), filtrar_por_data_ate: isoParaBR(ate),
          });
          const lista = (r.conta_receber_cadastro ?? []) as Record<string, any>[];
          const soma = lista.reduce((s, t) => s + numero(t.valor_documento), 0);
          /* A AMOSTRA CRUA importa: sem NF e sem O.S., a conta a receber é a
             ÚNICA fonte de faturamento desta casa — e o que ela carrega decide
             o que a curva consegue responder (cliente sim; produto, só se
             houver categoria ou descrição). */
          return {
            registros: numero(r.total_de_registros),
            paginas: numero(r.total_de_paginas),
            amostraSoma: soma,
            amostra: lista.length ? lista[0] : null,
          };
        });

        await tentar("clientes", async () => {
          const r = await omie("geral/clientes", "ListarClientes", {
            pagina: 1, registros_por_pagina: 50,
          });
          return { registros: numero(r.total_de_registros), paginas: numero(r.total_de_paginas) };
        });

        /* NFS-e E CATEGORIAS — o título a receber trouxe
           `numero_documento_fiscal` e `codigo_categoria`, então as duas coisas
           existem nesta casa: a nota é de SERVIÇO (a de produto deu zero) e a
           categoria é o que mais perto chega de "o que foi vendido". Perguntar
           antes de desenhar a tela: sem NFS-e, a curva de produtos não tem do
           que ser feita, e é melhor a tela dizer isso do que fingir. */
        await tentar("nfse_servico", async () => {
          const r = await omie("servicos/nfse", "ListarNFSe", {
            nPagina: 1, nRegPorPagina: 20,
            cCodIntServico: "", dEmiInicial: isoParaBR(de), dEmiFinal: isoParaBR(ate),
          });
          const lista = (r.nfseEncontradas ?? r.cadastros ?? []) as Record<string, any>[];
          return {
            registros: numero(r.nTotRegistros) || lista.length,
            paginas: numero(r.nTotPaginas),
            amostra: lista.length ? lista[0] : null,
          };
        });

        await tentar("categorias", async () => {
          const r = await omie("geral/categorias", "ListarCategorias", {
            pagina: 1, registros_por_pagina: 50,
          });
          const lista = (r.categoria_cadastro ?? []) as Record<string, any>[];
          return {
            registros: numero(r.total_de_registros),
            paginas: numero(r.total_de_paginas),
            amostra: lista.length ? lista[0] : null,
          };
        });

        return resp({ periodo: { de, ate }, fontes });
      }

      /* IMPORTAR — UMA PÁGINA por chamada (teto de 150s). A tela comanda o
         laço e mostra onde está; devolve `proxima` (null = acabou). */
      case "importar": {
        const fonte = String(body.fonte ?? "");
        const de = String(body.de ?? "");
        const ate = String(body.ate ?? "");
        const pagina = Math.max(1, numero(body.pagina) || 1);
        if (!de || !ate) return resp({ erro: "Informe o período (de, ate)." }, 400);

        if (fonte === "notas") {
          const r = await omie("produtos/nfconsultar", "ListarNF", {
            pagina, registros_por_pagina: 100, apenas_importado_api: "N",
            dEmiInicial: isoParaBR(de), dEmiFinal: isoParaBR(ate),
          });
          if (r.vazio) return resp({ gravados: 0, pagina, paginas: 0, proxima: null, vazio: true });
          const lista = ((r.nfCadastro ?? []) as Record<string, any>[]).map(notaParaVenda);
          const gravados = await gravarVarios("fin_vendas", lista);
          const paginas = numero(r.nTotPaginas) || 1;
          return resp({ gravados, lidos: lista.length, pagina, paginas, proxima: pagina < paginas ? pagina + 1 : null });
        }

        if (fonte === "os") {
          const r = await omie("servicos/os", "ListarOS", {
            pagina, registros_por_pagina: 100, apenas_importado_api: "N",
            dDtPrevisaoDe: isoParaBR(de), dDtPrevisaoAte: isoParaBR(ate),
          });
          if (r.vazio) return resp({ gravados: 0, pagina, paginas: 0, proxima: null, vazio: true });
          const lista = ((r.osCadastro ?? []) as Record<string, any>[]).map(osParaVenda);
          const gravados = await gravarVarios("fin_vendas", lista);
          const paginas = numero(r.nTotPaginas) || 1;
          return resp({ gravados, lidos: lista.length, pagina, paginas, proxima: pagina < paginas ? pagina + 1 : null });
        }

        if (fonte === "receber") {
          const r = await omie("financas/contareceber", "ListarContasReceber", {
            pagina, registros_por_pagina: 100, apenas_importado_api: "N",
            filtrar_por_data_de: isoParaBR(de), filtrar_por_data_ate: isoParaBR(ate),
          });
          if (r.vazio) return resp({ gravados: 0, pagina, paginas: 0, proxima: null, vazio: true });
          const lista = ((r.conta_receber_cadastro ?? []) as Record<string, any>[]).map(tituloParaReceber);
          const gravados = await gravarVarios("fin_receber", lista);
          const paginas = numero(r.total_de_paginas) || 1;
          return resp({ gravados, lidos: lista.length, pagina, paginas, proxima: pagina < paginas ? pagina + 1 : null });
        }

        if (fonte === "clientes") {
          const r = await omie("geral/clientes", "ListarClientes", { pagina, registros_por_pagina: 200 });
          if (r.vazio) return resp({ gravados: 0, pagina, paginas: 0, proxima: null, vazio: true });
          const lista = ((r.clientes_cadastro ?? []) as Record<string, any>[]).map((c) => ({
            id: `cli_${c.codigo_cliente_omie}`,
            origem: "omie",
            omieId: String(c.codigo_cliente_omie ?? ""),
            nome: String(c.razao_social ?? c.nome_fantasia ?? ""),
            fantasia: String(c.nome_fantasia ?? ""),
            doc: String(c.cnpj_cpf ?? ""),
            cidade: String(c.cidade ?? ""),
            uf: String(c.estado ?? ""),
            inativo: String(c.inativo ?? "N").toUpperCase() === "S",
          }));
          const gravados = await gravarVarios("fin_clientes", lista);
          const paginas = numero(r.total_de_paginas) || 1;
          return resp({ gravados, lidos: lista.length, pagina, paginas, proxima: pagina < paginas ? pagina + 1 : null });
        }

        /* AS CATEGORIAS dão NOME ao código que vem no título (1.01.02 → o que
           é). Medido em 29/08/2026: esta casa não emite NF de produto (0) nem
           usa ordem de serviço (0) — o faturamento inteiro está em conta a
           receber, e a categoria é o que mais perto chega de "o que foi
           vendido". Sem ela, a curva por serviço seria uma lista de códigos. */
        if (fonte === "categorias") {
          const r = await omie("geral/categorias", "ListarCategorias", {
            pagina, registros_por_pagina: 100,
          });
          if (r.vazio) return resp({ gravados: 0, pagina, paginas: 0, proxima: null, vazio: true });
          const lista = ((r.categoria_cadastro ?? []) as Record<string, any>[]).map((c) => ({
            id: `cat_${c.codigo}`,
            codigo: String(c.codigo ?? ""),
            descricao: String(c.descricao ?? c.descricao_padrao ?? ""),
            natureza: String(c.natureza ?? ""),
            receita: String(c.conta_receita ?? "") === "S",
            inativa: String(c.conta_inativa ?? "N") === "S",
          }));
          const gravados = await gravarVarios("fin_categorias", lista);
          const paginas = numero(r.total_de_paginas) || 1;
          return resp({ gravados, lidos: lista.length, pagina, paginas, proxima: pagina < paginas ? pagina + 1 : null });
        }

        return resp({ erro: `Fonte desconhecida: ${fonte}` }, 400);
      }

      /* O nome do cliente vem do cadastro, não do título: OS e conta a receber
         trazem só o código. Roda depois de importar clientes; sem ele a curva
         ABC agruparia por número. */
      case "casarClientes": {
        /* PAGINA TUDO. Ler a coleção de uma vez parecia simples e mentia: o
           PostgREST corta em 1000 linhas SEM AVISAR, e a resposta ainda dizia
           ok:true — com 3.000 notas, 2.000 ficavam sem nome e a curva ABC
           agrupava cliente por número, para sempre (rodar de novo devolvia as
           mesmas 1000). Aqui varre por cursor e devolve o que SOBROU sem nome,
           para a tela poder dizer que o casamento está incompleto. */
        const varrer = async (colecao: string) => {
          const linhas: { id: string; registro: Record<string, any> }[] = [];
          let cursor = "";
          for (;;) {
            let q = sb.from(T_REG)
              .select("id, registro").eq("colecao", colecao).eq("apagado", false)
              .order("id", { ascending: true }).limit(500);
            if (cursor) q = q.gt("id", cursor);
            const { data, error } = await q;
            if (error) throw error;
            if (!data?.length) break;
            linhas.push(...data.map((l) => ({ id: String(l.id), registro: l.registro as Record<string, any> })));
            if (data.length < 500) break;
            cursor = String(data[data.length - 1].id);
          }
          return linhas;
        };

        const nomePorId = new Map<string, string>();
        for (const l of await varrer("fin_clientes")) {
          const c = l.registro;
          if (c.omieId) nomePorId.set(String(c.omieId), String(c.nome || c.fantasia || ""));
        }
        let ajustados = 0;
        let semNome = 0;
        for (const colecao of ["fin_vendas", "fin_receber"]) {
          const todos = await varrer(colecao);
          const pendentes = todos
            .map((l) => l.registro)
            .filter((r) => !r.clienteNome && r.clienteId);
          const casaveis = pendentes
            .filter((r) => nomePorId.has(String(r.clienteId)))
            .map((r) => ({ ...r, clienteNome: nomePorId.get(String(r.clienteId)) }));
          semNome += pendentes.length - casaveis.length;
          ajustados += await gravarVarios(colecao, casaveis);
        }
        return resp({ ok: true, ajustados, semNome, clientes: nomePorId.size });
      }

      case "carimbarImportacao": {
        await gravarMeta("omie:ultimaImportacao", {
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
