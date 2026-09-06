import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("ML_JWT_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FIN_EMAIL_FROM = Deno.env.get("FIN_EMAIL_FROM") ?? "";
const BUCKET = "ml-arquivos";
const SIS = "minaslab";
const MAX_BYTES = 8 * 1024 * 1024;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder();
const dec = new TextDecoder();
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const texto = (v: unknown) => String(v ?? "").trim();
const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const hoje = () => new Date().toISOString().slice(0, 10);
const agora = () => new Date().toISOString();
const digitos = (v: unknown) => texto(v).replace(/\D/g, "");

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
  const p = token.split(".");
  if (p.length !== 3) return null;
  try {
    const key = await crypto.subtle.importKey("raw", enc.encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key, bytesFromB64url(p[2]), enc.encode(`${p[0]}.${p[1]}`));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(bytesFromB64url(p[1])));
    if (payload.sis !== SIS) return null;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}
function b64ParaBytes(b64: string) {
  const limpo = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(limpo);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesParaB64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
function nomeSeguro(nome: string) {
  return (nome || "arquivo")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-").slice(0, 120) || "arquivo";
}
function statusReceber(valor: number, vencimento: string) {
  return vencimento && vencimento < hoje() ? "VENCIDO" : "A RECEBER";
}
function statusPagar(valor: number, vencimento: string) {
  return vencimento && vencimento < hoje() ? "VENCIDO" : "A PAGAR";
}
async function empresaPorId(id: string) {
  const { data, error } = await sb.from("empresas").select("id,nome,cnpj,usa_omie,ativa").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
async function baixar(path: string) {
  if (!path) return null;
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return resp({ erro: "JSON inválido." }, 400); }

  const auth = texto(req.headers.get("authorization")).match(/^Bearer\s+(.+)$/i);
  const cracha = auth ? await verificarJwt(auth[1]) : null;
  if (!cracha) return resp({ erro: "Entre no sistema.", semSessao: true }, 401);
  if (texto(cracha.papel) !== "direcao") return resp({ erro: "O financeiro é somente da direção.", semPermissao: true }, 403);
  const usuario = texto(cracha.sub) || "direcao";
  const action = texto(body.action);

  try {
    if (action === "estado") {
      return resp({ ok: true, emailConfigurado: !!RESEND_API_KEY && !!FIN_EMAIL_FROM, bucket: BUCKET, maxBytes: MAX_BYTES });
    }

    if (action === "upload") {
      const empresaId = texto(body.empresaId);
      const categoria = texto(body.categoria).toLowerCase();
      const nome = nomeSeguro(texto(body.nome));
      const mime = texto(body.mime).toLowerCase() || "application/octet-stream";
      const conteudo = texto(body.base64);
      if (!empresaId || !conteudo) return resp({ erro: "Informe empresa e arquivo." }, 400);
      if (!["xml", "pdf", "comprovante"].includes(categoria)) return resp({ erro: "Categoria de arquivo inválida." }, 400);
      const emp = await empresaPorId(empresaId);
      if (!emp || !emp.ativa) return resp({ erro: "Empresa não encontrada ou inativa." }, 404);
      if (categoria === "xml" && !["application/xml", "text/xml", "application/octet-stream"].includes(mime)) return resp({ erro: "O arquivo XML possui tipo inválido." }, 400);
      if (categoria === "pdf" && !["application/pdf", "application/octet-stream"].includes(mime)) return resp({ erro: "O arquivo PDF possui tipo inválido." }, 400);
      if (categoria === "comprovante" && !(mime === "application/pdf" || mime.startsWith("image/") || mime === "application/octet-stream")) return resp({ erro: "Formato de comprovante não permitido." }, 400);
      const bytes = b64ParaBytes(conteudo);
      if (!bytes.length) return resp({ erro: "Arquivo vazio." }, 400);
      if (bytes.length > MAX_BYTES) return resp({ erro: "Arquivo maior que 8 MB. Reduza o arquivo antes de enviar." }, 413);
      const ano = new Date().getUTCFullYear();
      const path = `financeiro/${empresaId}/${categoria}/${ano}/${crypto.randomUUID()}-${nome}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
      if (error) throw new Error(`Falha ao armazenar arquivo: ${error.message}`);
      return resp({ ok: true, path, nome, mime, tamanho: bytes.length });
    }

    if (action === "urlAssinada") {
      const path = texto(body.path);
      if (!path.startsWith("financeiro/")) return resp({ erro: "Caminho de arquivo inválido." }, 400);
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 600, { download: texto(body.nome) || undefined });
      if (error || !data?.signedUrl) throw new Error(error?.message || "Não foi possível abrir o arquivo.");
      return resp({ ok: true, url: data.signedUrl, expiraEmSegundos: 600 });
    }

    if (action === "salvarNotaXml") {
      const x = body.registro ?? {};
      const empresaId = texto(x.empresa_id);
      const chave = texto(x.chave_acesso);
      const numero = texto(x.numero_nf);
      const vencimento = texto(x.data_vencimento);
      const valor = n(x.valor_total);
      if (!empresaId) return resp({ erro: "Selecione a empresa." }, 400);
      if (!numero && !chave) return resp({ erro: "O XML não possui número/chave de NF identificável." }, 400);
      if (!vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) return resp({ erro: "Informe o vencimento antes de importar a nota." }, 400);
      if (valor <= 0) return resp({ erro: "O valor total da nota é inválido." }, 400);
      const emp = await empresaPorId(empresaId);
      if (!emp || !emp.ativa) return resp({ erro: "Empresa não encontrada ou inativa." }, 404);
      const cnpjEmpresa = digitos(emp.cnpj);
      if (!cnpjEmpresa) return resp({ erro: "A empresa selecionada está sem CNPJ configurado." }, 409);
      const cnpjEmit = digitos(x.cnpj_emitente);
      const cnpjDest = digitos(x.cnpj_destinatario);
      const ehSaida = cnpjEmit === cnpjEmpresa;
      const ehEntrada = cnpjDest === cnpjEmpresa;
      if (ehSaida === ehEntrada) return resp({ erro: "Não foi possível determinar se a NF é de entrada ou saída para a empresa selecionada." }, 409);

      if (chave) {
        const { data: existente } = await sb.from("notas_fiscais").select("id,numero_nf").eq("empresa_id", empresaId).eq("chave_acesso", chave).eq("apagado", false).maybeSingle();
        if (existente) return resp({ erro: `A NF ${existente.numero_nf || numero} já foi importada.`, duplicada: true, id: existente.id }, 409);
      }

      const notaBase = {
        empresa_id: empresaId,
        tipo: ehSaida ? "SAIDA" : "ENTRADA",
        numero_nf: numero || null,
        chave_acesso: chave || null,
        cnpj_emitente: texto(x.cnpj_emitente) || null,
        cnpj_destinatario: texto(x.cnpj_destinatario) || null,
        nome_emitente: texto(x.nome_emitente) || null,
        nome_destinatario: texto(x.nome_destinatario) || null,
        data_emissao: texto(x.data_emissao) || null,
        data_vencimento: vencimento,
        valor_total: valor,
        xml_url: texto(x.xml_url) || null,
        pdf_url: texto(x.pdf_url) || null,
        email_destino: texto(x.email_destino) || null,
        observacao: texto(x.observacao) || null,
        origem: "XML",
        apagado: false,
        created_at: agora(),
        updated_at: agora(),
      };

      const { data: nota, error: en } = await sb.from("notas_fiscais").insert(notaBase).select("*").maybeSingle();
      if (en) throw en;
      if (!nota) throw new Error("A nota não foi gravada.");

      try {
        let recebimentoId: string | null = null;
        let despesaId: string | null = null;
        if (ehSaida) {
          let q = sb.from("recebimentos").select("id").eq("empresa_id", empresaId).eq("apagado", false).eq("numero_nf", numero);
          if (cnpjDest) q = q.eq("cnpj_cpf", texto(x.cnpj_destinatario));
          const { data: ja } = await q.limit(1).maybeSingle();
          if (ja) recebimentoId = ja.id;
          else {
            const { data: r, error } = await sb.from("recebimentos").insert({
              empresa_id: empresaId,
              cliente: texto(x.nome_destinatario) || "Cliente da NF",
              cnpj_cpf: texto(x.cnpj_destinatario) || null,
              descricao: `NF-e ${numero || chave}`,
              valor_previsto: valor,
              valor_recebido: 0,
              valor_pendente: valor,
              data_vencimento: vencimento,
              status: statusReceber(valor, vencimento),
              numero_nf: numero || null,
              observacao: "Criado automaticamente pela importação do XML.",
              origem: "MANUAL",
              importacao_origem: "XML",
              apagado: false,
              created_by: usuario,
              updated_by: usuario,
              created_at: agora(),
              updated_at: agora(),
            }).select("id").maybeSingle();
            if (error) throw error;
            recebimentoId = r?.id ?? null;
          }
        } else {
          let q = sb.from("despesas").select("id").eq("empresa_id", empresaId).eq("apagado", false).eq("valor_original", valor);
          if (cnpjEmit) q = q.eq("cnpj_cpf", texto(x.cnpj_emitente));
          if (numero) q = q.ilike("descricao", `%${numero}%`);
          const { data: ja } = await q.limit(1).maybeSingle();
          if (ja) despesaId = ja.id;
          else {
            const { data: d, error } = await sb.from("despesas").insert({
              empresa_id: empresaId,
              fornecedor: texto(x.nome_emitente) || "Fornecedor da NF",
              cnpj_cpf: texto(x.cnpj_emitente) || null,
              descricao: `NF-e ${numero || chave}`,
              valor_original: valor,
              valor_pago: 0,
              valor_pendente: valor,
              data_lancamento: texto(x.data_emissao) || hoje(),
              data_vencimento: vencimento,
              status: statusPagar(valor, vencimento),
              observacao: "Criado automaticamente pela importação do XML.",
              origem: "MANUAL",
              importacao_origem: "XML",
              apagado: false,
              created_by: usuario,
              updated_by: usuario,
              created_at: agora(),
              updated_at: agora(),
            }).select("id").maybeSingle();
            if (error) throw error;
            despesaId = d?.id ?? null;
          }
        }
        const { data: ligada, error: el } = await sb.from("notas_fiscais").update({ recebimento_id: recebimentoId, despesa_id: despesaId, updated_at: agora() }).eq("id", nota.id).select("*").maybeSingle();
        if (el) throw el;
        return resp({ ok: true, item: ligada, recebimentoId, despesaId, tipo: ehSaida ? "SAIDA" : "ENTRADA" });
      } catch (e) {
        await sb.from("notas_fiscais").delete().eq("id", nota.id);
        throw e;
      }
    }

    if (action === "emailEstado") {
      return resp({ configurado: !!RESEND_API_KEY && !!FIN_EMAIL_FROM });
    }

    if (action === "emailEnviar") {
      if (!RESEND_API_KEY || !FIN_EMAIL_FROM) return resp({ erro: "Envio de e-mail ainda não configurado. Adicione RESEND_API_KEY e FIN_EMAIL_FROM nos Secrets do Supabase." }, 503);
      const notaId = texto(body.notaId);
      const destino = texto(body.email);
      if (!notaId || !destino || !/^\S+@\S+\.\S+$/.test(destino)) return resp({ erro: "Informe a nota e um e-mail válido." }, 400);
      const { data: nota, error } = await sb.from("notas_fiscais").select("*,empresa:empresas(id,nome)").eq("id", notaId).eq("apagado", false).maybeSingle();
      if (error) throw error;
      if (!nota) return resp({ erro: "Nota não encontrada." }, 404);

      const anexos: Array<{ filename: string; content: string }> = [];
      for (const [path, ext, nomeBase] of [[nota.xml_url, "xml", `NF-${nota.numero_nf || nota.id}`], [nota.pdf_url, "pdf", `NF-${nota.numero_nf || nota.id}`]] as const) {
        const p = texto(path);
        if (!p || !p.startsWith("financeiro/")) continue;
        const bytes = await baixar(p);
        if (!bytes) throw new Error(`O anexo ${ext.toUpperCase()} não foi encontrado no Storage.`);
        anexos.push({ filename: `${nomeBase}.${ext}`, content: bytesParaB64(bytes) });
      }
      if (!anexos.length) return resp({ erro: "A nota não possui XML/PDF armazenado para anexar." }, 409);

      const assunto = texto(body.assunto) || `Nota Fiscal ${nota.numero_nf || ""} - ${nota.empresa?.nome || "MinasLab"}`;
      const mensagem = texto(body.mensagem) || `Segue em anexo a Nota Fiscal ${nota.numero_nf || ""}.`;
      const envio = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FIN_EMAIL_FROM, to: [destino], subject: assunto, text: mensagem, attachments: anexos }),
      });
      const retorno = await envio.json().catch(() => ({}));
      if (!envio.ok) {
        await sb.from("log_envios_nf").insert({ nota_fiscal_id: nota.id, empresa_id: nota.empresa_id, numero_nf: nota.numero_nf, email_destino: destino, status: "ERRO", observacao: texto((retorno as any).message) || `HTTP ${envio.status}`, anexos: anexos.map(a => a.filename), enviado_por: usuario });
        throw new Error(texto((retorno as any).message) || `Falha ao enviar e-mail (HTTP ${envio.status}).`);
      }
      await sb.from("log_envios_nf").insert({ nota_fiscal_id: nota.id, empresa_id: nota.empresa_id, numero_nf: nota.numero_nf, email_destino: destino, status: "ENVIADO", observacao: texto((retorno as any).id) || null, anexos: anexos.map(a => a.filename), enviado_por: usuario });
      await sb.from("notas_fiscais").update({ email_destino: destino, status_envio: "ENVIADO", enviado_em: agora(), enviado_por: usuario, updated_at: agora() }).eq("id", nota.id);
      return resp({ ok: true, id: (retorno as any).id || null, anexos: anexos.map(a => a.filename) });
    }

    return resp({ erro: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("[ml-financeiro-arquivos]", e);
    return resp({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
