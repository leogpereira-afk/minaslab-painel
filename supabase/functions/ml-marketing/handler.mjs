import { autorizar, validarPedido, ErroAcesso } from './acesso.mjs';
import { FalhaDireta, MENSAGENS } from './marketing-direto.mjs';
import { detalharFortemais } from './marketing-fortemais.mjs';
const ORIGENS = new Set(['https://leogpereira-afk.github.io', 'https://minaslab.net', 'https://www.minaslab.net', 'http://localhost:5175', 'http://127.0.0.1:5175']);
export function criarHandler({ direto, lerFontes, verificar = autorizar, agora = () => Date.now() }) {
  return async req => {
    const origem = req.headers.get('origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...(origem && ORIGENS.has(origem) ? { 'Access-Control-Allow-Origin': origem } : {}), 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    const responder = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (origem && !ORIGENS.has(origem)) return responder({ erro: 'Origem não permitida.' }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return responder({ erro: 'Método não permitido.' }, 405);
    try {
      await verificar(req.headers.get('authorization'));
      const texto = await req.text();
      if (texto.length > 4096) return responder({ erro: 'Pedido muito grande.' }, 413);
      let entrada;
      try { entrada = JSON.parse(texto); } catch { return responder({ erro: 'Pedido inválido.' }, 400); }
      const body = validarPedido(entrada);
      if (body.action === 'painel') {
        const [linhas, conexoes] = await Promise.all([lerFontes(), direto.status()]);
        return responder({ ok: true, empresa: 'minaslab', lidoEm: new Date(agora()).toISOString(), fontes: detalharFortemais(linhas, agora(), 'minaslab').fontes, conexoes });
      }
      if (body.action === 'listar') return responder(await direto.listar(body.fonte));
      if (body.action === 'vincular') return responder(await direto.vincular(body.fonte, body.ativo));
      return responder(await direto.coletar(body.fonte));
    } catch (e) {
      if (e instanceof ErroAcesso) return responder({ erro: e.message, ...(e.status === 401 ? { semSessao: true } : {}) }, e.status);
      if (e instanceof FalhaDireta) return responder({ erro: MENSAGENS[e.codigo] || 'Não foi possível consultar o canal.', codigo: e.codigo }, 422);
      return responder({ erro: 'Não foi possível consultar Marketing. Tente novamente.' }, 503);
    }
  };
}
