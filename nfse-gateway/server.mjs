import http from 'node:http';
import https from 'node:https';
import { Buffer } from 'node:buffer';
import forge from 'node-forge';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = String(process.env.NFSE_GATEWAY_TOKEN || '');
const AMBIENTE = String(process.env.MLAB_NFSE_AMBIENTE || 'HOMOLOGACAO').toUpperCase();
const PFX_B64 = String(process.env.MLAB_NFSE_CERT_PFX_B64 || '').replace(/\s/g, '');
const PFX_PASSWORD = String(process.env.MLAB_NFSE_CERT_PASSWORD || '');

const SEFIN = {
  HOMOLOGACAO: { hostname: 'sefin.producaorestrita.nfse.gov.br', basePath: '/SefinNacional' },
  PRODUCAO: { hostname: 'sefin.nfse.gov.br', basePath: '/SefinNacional' }
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

function requestSefin({ method, path, body = null, headers = {} }) {
  const alvo = SEFIN[AMBIENTE];
  if (!alvo) throw new Error(`Ambiente ${AMBIENTE} não suportado.`);
  const agent = agenteMtls();
  const payload = body == null ? null : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: alvo.hostname,
      port: 443,
      path: `${alvo.basePath}${path}`,
      method,
      agent,
      servername: alvo.hostname,
      rejectUnauthorized: true,
      timeout: 25000,
      headers: {
        accept: 'application/json',
        'user-agent': 'MinasLab-NFSe-Gateway/1.1',
        connection: 'close',
        ...(payload ? { 'content-length': payload.length } : {}),
        ...headers
      }
    }, (resp) => {
      const chunks = [];
      resp.on('data', (chunk) => chunks.push(chunk));
      resp.on('end', () => {
        agent.destroy();
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        if (raw) { try { parsed = JSON.parse(raw); } catch { parsed = raw; } }
        resolve({ status: resp.statusCode || 0, headers: resp.headers, body: parsed });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout ao conectar à SEFIN Nacional.')));
    req.on('error', (err) => { agent.destroy(); reject(err); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function lerJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 1024 * 1024) throw new Error('Corpo da requisição excede 1 MB.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
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
      return json(res, 200, {
        ok: true,
        ambiente: AMBIENTE,
        mtls: true,
        http: '1.1',
        statusHttp: r.status,
        existeDpsNoSefin: r.status === 200,
        transmitiu: false
      });
    } catch (e) {
      return json(res, 502, {
        ok: false,
        ambiente: AMBIENTE,
        transmitiu: false,
        erro: e instanceof Error ? e.message : String(e),
        codigo: e?.code || null
      });
    }
  }
  if (req.method === 'POST' && req.url === '/v1/emitir') {
    return json(res, 423, { erro: 'Emissão bloqueada. O gateway está apenas em fase de homologação mTLS.', transmitiu: false });
  }
  return json(res, 404, { erro: 'Rota não encontrada.' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => json(res, 500, { erro: e instanceof Error ? e.message : String(e) }));
});

server.listen(PORT, HOST, () => {
  console.log(`MinasLab NFSe Gateway ativo em ${HOST}:${PORT} (${AMBIENTE})`);
});
