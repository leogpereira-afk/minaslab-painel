// Fotos de perfil de quem usa o painel. Uma única consulta (função ml-perfis) abastece todos os Avatares do sistema;
// fica guardada por alguns minutos e é atualizada na hora quando a direção troca uma foto.
import { useEffect, useSyncExternalStore } from "react";
import { API } from "../lib/api.js";
import { atualizarPaginasDaSessao, comCracha } from "../lib/sessao.js";

const VALIDADE_MS = 5 * 60 * 1000;
let fotos = {};
let carregadoEm = 0;
let emVoo = null;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach((f) => f());

export async function carregarFotos(forcar = false) {
  if (emVoo) return emVoo;
  if (!forcar && Date.now() - carregadoEm < VALIDADE_MS) return fotos;
  emVoo = (async () => {
    try {
      const resp = await comCracha(`${API}/ml-perfis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const dados = await resp.json().catch(() => null);
      if (resp.ok && dados?.fotos) { fotos = dados.fotos; carregadoEm = Date.now(); avisar(); }
    } catch { /* sem foto o Avatar mostra as iniciais */ } finally { emVoo = null; }
    return fotos;
  })();
  return emVoo;
}

/** Atualiza uma foto já conhecida (depois que a direção troca ou remove na tela de Acessos). */
export function definirFoto(usuario, url) {
  fotos = { ...fotos };
  if (url) fotos[usuario] = url; else delete fotos[usuario];
  avisar();
}

const assinar = (f) => { ouvintes.add(f); return () => ouvintes.delete(f); };
const ler = () => fotos;

/** Endereço da foto de quem é `usuario` (ou vazio). Dispara a primeira carga sozinho. */
export function useFotoDe(usuario) {
  const todas = useSyncExternalStore(assinar, ler, ler);
  useEffect(() => { if (!carregadoEm) void carregarFotos(); }, []);
  return (usuario && todas[usuario]) || "";
}

export const fotosDeTeste = (novas) => { fotos = novas; carregadoEm = Date.now(); avisar(); };

/** Busca as páginas liberadas AGORA para a própria conta e atualiza a sessão (a direção mudou o acesso: vale sem sair e entrar). */
export async function atualizarMinhasPaginas() {
  try {
    const resp = await comCracha(`${API}/ml-perfis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "minhas" }) });
    const dados = await resp.json().catch(() => null);
    if (resp.ok && Array.isArray(dados?.paginas_consulta) && dados.papel !== "direcao") return atualizarPaginasDaSessao(dados.paginas_consulta);
  } catch { /* sem rede segue com o que a sessão já tem */ }
  return false;
}
