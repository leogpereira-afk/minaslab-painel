import http from 'node:http';
import https from 'node:https';
import { Buffer } from 'node:buffer';
import forge from 'node-forge';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = String(process.env.NFSE_GATEWAY_TOKEN || '');
const AMBIENTE = String(process.env.MLAB_NFSE_AMBIENTE || 'HOMOLOGACAO').toUpperCase();
const PRODUCAO_LIBERADA = String(process.env.MLAB_NFSE_PRODUCAO_LIBERADA || '').toUpperCase() === 'SIM';
const TRANSMISSAO_ATIVA = String(process.env.MLAB_NFSE_TRANSMISSAO_ATIVA || '').toUpperCase() === 'SIM';
const PFX_B64 = String(process.env.MLAB_NFSE_CERT_PFX_B64 || '').replace(/\s/g, '');
const PFX_PASSWORD = String(process.env.MLAB_NFSE_CERT_PASSWORD || '');

const SEFIN = {
  HOMOLOGACAO: { hostname: 'sefin.producaorestrita.nfse.gov.br', basePath: '/SefinNacional' },
  PRODUCAO: { hostname: 'sefin.nfse.gov.br', basePath: '/SefinNacional' }
};
const DANFSE = {
  HOMOLOGACAO: { hostname: 'adn.producaorestrita.nfse.gov.br', basePath: '/danfse' },
  PRODUCAO: { hostname: 'adn.nfse.gov.br', basePath: '/danfse' }
};

let A1_CACHE = null;

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store'
  });
  res.end(data);
}

function autorizado(req) {
  if (!TOKEN) return false;
  const auth = String(req.headers.authorization || '');
  return auth === `Bearer ${TOKEN}`;
}

function abrirA1() {
  if (A1_CACHE) return A1_CACHE;
  if (!PFX_B64 || !PFX_PASSWORD) throw new Error('Certificado A1 não configurado no gateway.');
  try {
    const bin = Buffer.from(PFX_B64, 'base64').toString('binary');
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(bin, 'raw'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, PFX_PASSWORD);
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    const certs = certBags.map((x) => x.cert).filter(Boolean);
    const shrouded = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
    const plain = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];
    const key = [...shrouded, ...plain].find((x) => x.key)?.key;
    if (!certs.length || !key) throw new Error('Certificado/chave privada não encontrados dentro do PFX.');
    A1_CACHE = {
      cert: certs.map((c) => forge.pki.certificateToPem(c)).join('\n'),
      key: forge.pki.privateKeyToPem(key)
    };
    return A1_CACHE;
  } catch (e) {
    throw new Error(`Falha ao abrir o certificado A1: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function configuracao() {
  const erros = [];
  if (!TOKEN) erros.push('NFSE_GATEWAY_TOKEN ausente');
  if (!PFX_B64) erros.push('MLAB_NFSE_CERT_PFX_B64 ausente');
  if (!PFX_PASSWORD) erros.push('MLAB_NFSE_CERT_PASSWORD ausente');
  if (!SEFIN[AMBIENTE]) erros.push('MLAB_NFSE_AMBIENTE inválido');
  let certificadoValido = false;
  if (PFX_B64 && PFX_PASSWORD) {
    try { abrirA1(); certificadoValido = true; }
    catch (e) { erros.push(e instanceof Error ? e.message : String(e)); }
  }
  return { ok: erros.length === 0, erros, certificadoValido };
}

function agenteMtls() {
  const a1 = abrirA1();
  return new https.Agent({
    cert: a1.cert,
    key: a1.key,
    keepAlive: false,
    maxCachedSessions: 0,
    minVersion: 'TLSv1.2',
    ALPNProtocols: ['http/1.1']
  });
}

function requestHttps({ hostname, method, path, body = null, headers = {}, mtls = true, timeout = 25000 }) {
  const agent = mtls ? agenteMtls() : undefined;
  const payload = body == null ? null : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname,
      port: 443,
      path,
      method,
      agent,
      servername: hostname,
      rejectUnauthorized: true,
      timeout,
      headers: {
        accept: '*/*',
        'user-agent': 'MinasLab-NFSe-Gateway/1.3',
        connection: 'close',
        ...(payload ? { 'content-length': payload.length } : {}),
        ...headers
      }
    }, (resp) => {
      const chunks = [];
      resp.on('data', (chunk) => chunks.push(chunk));
      resp.on('end', () => {
        if (agent) agent.destroy();
        const bytes = Buffer.concat(chunks);
        const contentType = String(resp.headers['content-type'] || '');
        let bodyOut = bytes;
        if (contentType.includes('application/json') || contentType.includes('text/json')) {
          const raw = bytes.toString('utf8');
          try { bodyOut = raw ? JSON.parse(raw) : null; } catch { bodyOut = raw; }
        }
        resolve({ status: resp.statusCode || 0, headers: resp.headers, body: bodyOut, bytes });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout ao conectar ao Sistema Nacional NFS-e.')));
    req.on('error', (err) => { if (agent) agent.destroy(); reject(err); });
    if (payload) req.write(payload);
    req.end();
  });
}

function requestSefin({ method, path, body = null, headers = {} }) {
  const alvo = SEFIN[AMBIENTE];
  if (!alvo) throw new Error(`Ambiente ${AMBIENTE} não suportado.`);
  return requestHttps({ hostname: alvo.hostname, method, path: `${alvo.basePath}${path}`, body, headers, mtls: true });
}

async function consultarDanfse(chave) {
  const alvo = DANFSE[AMBIENTE];
  if (!alvo) throw new Error(`Ambiente ${AMBIENTE} não suportado para DANFSe.`);
  const path = `${alvo.basePath}/${encodeURIComponent(String(chave))}`;
  let r = await requestHttps({ hostname: alvo.hostname, method: 'GET', path, headers: { accept: 'application/pdf' }, mtls: false, timeout: 30000 });
  if (r.status === 401 || r.status === 403) {
    r = await requestHttps({ hostname: alvo.hostname, method: 'GET', path, headers: { accept: 'application/pdf' }, mtls: true, timeout: 30000 });
  }
  return r;
}

async function lerJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 4 * 1024 * 1024) throw new Error('Corpo da requisição excede 4 MB.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function bloqueioProducao() {
  if (AMBIENTE !== 'PRODUCAO') return `Gateway está em ${AMBIENTE}; produção não pode ser usada.`;
  if (!PRODUCAO_LIBERADA) return 'Produção não liberada no gateway.';
  if (!TRANSMISSAO_ATIVA) return 'Transmissão de produção não ativada no gateway.';
  return null;
}

async function emitir({ idDps, dpsXmlGZipB64, producao }) {
  if (!idDps) return { status: 400, body: { erro: 'idDps é obrigatório.', transmitiu: false } };
  if (!dpsXmlGZipB64 || typeof dpsXmlGZipB64 !== 'string') return { status: 400, body: { erro: 'dpsXmlGZipB64 é obrigatório.', transmitiu: false } };
  if (dpsXmlGZipB64.length > 3_500_000) return { status: 413, body: { erro: 'Payload DPS excede o limite de segurança.', transmitiu: false } };

  const pre = await requestSefin({ method: 'HEAD', path: `/dps/${encodeURIComponent(String(idDps))}` });
  if (pre.status === 200) {
    const consulta = await requestSefin({ method: 'GET', path: `/dps/${encodeURIComponent(String(idDps))}` });
    const chave = consulta?.body?.chaveAcesso || null;
    return {
      status: 409,
      body: {
        ok: false,
        ambiente: AMBIENTE,
        statusHead: pre.status,
        existeDpsNoSefin: true,
        transmitiu: false,
        chaveAcessoExistente: chave,
        erro: 'A DPS já existe na SEFIN. POST bloqueado para evitar duplicidade.'
      }
    };
  }
  if (pre.status !== 404) {
    return { status: 409, body: { ok: false, ambiente: AMBIENTE, statusHead: pre.status, existeDpsNoSefin: false, transmitiu: false, erro: `Pré-checagem da SEFIN retornou HTTP ${pre.status}; transmissão bloqueada.` } };
  }

  const corpo = JSON.stringify({ dpsXmlGZipB64 });
  const r = await requestSefin({ method: 'POST', path: '/nfse', body: corpo, headers: { 'content-type': 'application/json; charset=utf-8', accept: 'application/json' } });
  return {
    status: 200,
    body: {
      ok: r.status >= 200 && r.status < 300,
      ambiente: AMBIENTE,
      mtls: true,
      http: '1.1',
      statusHttp: r.status,
      statusHead: pre.status,
      transmitiu: true,
      producao,
      resposta: r.body
    }
  };
}

async function handle(req, res) {
  if (req.method === 'GET' && req.url === '/health') {
    const cfg = configuracao();
    return json(res, cfg.ok ? 200 : 503, {
      ok: cfg.ok,
      ambiente: AMBIENTE,
      certificadoConfigurado: Boolean(PFX_B64 && PFX_PASSWORD),
      certificadoValido: cfg.certificadoValido,
      tokenConfigurado: Boolean(TOKEN),
      producaoLiberada: PRODUCAO_LIBERADA,
      transmissaoAtiva: TRANSMISSAO_ATIVA,
      producaoPronta: AMBIENTE === 'PRODUCAO' && PRODUCAO_LIBERADA && TRANSMISSAO_ATIVA,
      erros: cfg.erros
    });
  }

  if (!autorizado(req)) return json(res, 401, { erro: 'Não autorizado.' });

  if (req.method === 'POST' && req.url === '/v1/testar-conexao') {
    if (AMBIENTE !== 'HOMOLOGACAO') return json(res, 409, { erro: 'Teste bloqueado fora de HOMOLOGAÇÃO.' });
    try {
      const { idDps } = await lerJson(req);
      if (!idDps) return json(res, 400, { erro: 'idDps é obrigatório.' });
      const r = await requestSefin({ method: 'HEAD', path: `/dps/${encodeURIComponent(String(idDps))}` });
      return json(res, 200, { ok: true, ambiente: AMBIENTE, mtls: true, http: '1.1', statusHttp: r.status, existeDpsNoSefin: r.status === 200, transmitiu: false });
    } catch (e) {
      return json(res, 502, { ok: false, ambiente: AMBIENTE, transmitiu: false, erro: e instanceof Error ? e.message : String(e), codigo: e?.code || null });
    }
  }

  if (req.method === 'POST' && req.url === '/v1/emitir-homologacao') {
    if (AMBIENTE !== 'HOMOLOGACAO') return json(res, 409, { erro: 'Transmissão de homologação bloqueada fora de HOMOLOGAÇÃO.', transmitiu: false });
    try {
      const dados = await lerJson(req);
      const r = await emitir({ ...dados, producao: false });
      return json(res, r.status, r.body);
    } catch (e) {
      return json(res, 502, { ok: false, ambiente: AMBIENTE, transmitiu: false, erro: e instanceof Error ? e.message : String(e), codigo: e?.code || null });
    }
  }

  if (req.method === 'POST' && req.url === '/v1/emitir') {
    const bloqueio = bloqueioProducao();
    if (bloqueio) return json(res, 423, { erro: bloqueio, transmitiu: false, producaoLiberada: PRODUCAO_LIBERADA, transmissaoAtiva: TRANSMISSAO_ATIVA });
    try {
      const dados = await lerJson(req);
      const r = await emitir({ ...dados, producao: true });
      return json(res, r.status, r.body);
    } catch (e) {
      return json(res, 502, { ok: false, ambiente: AMBIENTE, transmitiu: false, erro: e instanceof Error ? e.message : String(e), codigo: e?.code || null });
    }
  }

  const mDanfse = req.method === 'GET' && req.url?.match(/^\/v1\/danfse\/([0-9]{50})$/);
  if (mDanfse) {
    const chave = mDanfse[1];
    if (AMBIENTE === 'PRODUCAO') {
      const bloqueio = bloqueioProducao();
      if (bloqueio) return json(res, 423, { erro: bloqueio });
    }
    try {
      const r = await consultarDanfse(chave);
      const contentType = String(r.headers?.['content-type'] || '');
      if (r.status < 200 || r.status >= 300 || !contentType.toLowerCase().includes('pdf')) {
        return json(res, 502, { erro: `DANFSe não disponível. HTTP ${r.status}.`, statusHttp: r.status, contentType });
      }
      return json(res, 200, { ok: true, ambiente: AMBIENTE, chaveAcesso: chave, mime: 'application/pdf', pdfBase64: r.bytes.toString('base64'), tamanho: r.bytes.length });
    } catch (e) {
      return json(res, 502, { erro: e instanceof Error ? e.message : String(e) });
    }
  }

  return json(res, 404, { erro: 'Rota não encontrada.' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => json(res, 500, { erro: e instanceof Error ? e.message : String(e) }));
});

server.listen(PORT, HOST, () => {
  console.log(`MinasLab NFSe Gateway ativo em ${HOST}:${PORT} (${AMBIENTE})`);
});
