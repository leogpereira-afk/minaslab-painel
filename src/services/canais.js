// Canais MinasLab: conversa com a função ml-canais. Quem pode publicar,
// comentar ou apagar é decidido no servidor; a tela só mostra os botões.
import { API } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

async function canais(action, corpo = {}) {
  const resp = await comCracha(`${API}/ml-canais`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...corpo }) });
  const dados = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(dados?.erro || mensagemDoStatus(resp.status));
  return dados || {};
}

export const canaisFeed = () => canais("feed");
export const canaisPublicar = (post) => canais("publicar", post);
export const canaisApagarPost = (id) => canais("apagarPost", { id });
export const canaisComentar = (ref, texto) => canais("comentar", { ref, texto });
export const canaisApagarComentario = (id) => canais("apagarComentario", { id });
export const canaisCurtir = (ref) => canais("curtir", { ref });
export const canaisConfig = () => canais("config");
export const canaisSalvarConfig = (cfg) => canais("salvarConfig", cfg);
export const canaisDestaqueOpcoes = () => canais("destaqueOpcoes");
export const canaisSalvarDestaque = (d) => canais("salvarDestaque", d);
