// Quem vê qual compromisso. A direção vê todos; os demais veem só o que foi DELEGADO para a pessoa
// (ou o que ela mesma criou/mexeu por último). Compromisso sem responsável só aparece para a direção e para quem o gravou.
//
// IMPORTANTE: é um recorte da TELA (esconder é conforto, não segurança — quem manda é o servidor).
// O servidor ainda entrega a coleção "compromissos" inteira a quem tem a página; travar lá fica para o ml-sync.
import { nomeCurto } from "./nomes.js";

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const mesmoNome = (a, b) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || norm(nomeCurto(a)) === norm(nomeCurto(b));
};

/** O id da ficha do RH desta pessoa no elenco (por nome); "" se não achar. */
export function meuIdNoElenco(sessao, equipe) {
  const p = (equipe || []).find((x) => mesmoNome(x.nome, sessao?.nome) || (x.apelido && mesmoNome(x.apelido, sessao?.nome)));
  return p?.id || "";
}

export function compromissoEhMeu(c, sessao, meuId = "") {
  if (!c || !sessao) return false;
  if (meuId && c.responsavelId === meuId) return true;
  if (c.atualizadoPor && sessao.usuario && c.atualizadoPor === sessao.usuario) return true;
  return mesmoNome(c.responsavelNome, sessao.nome);
}

export function compromissosVisiveis(lista, sessao, equipe = []) {
  if (!Array.isArray(lista)) return lista;
  if (!sessao) return [];
  if (sessao.papel === "direcao") return lista;
  const meuId = meuIdNoElenco(sessao, equipe);
  return lista.filter((c) => compromissoEhMeu(c, sessao, meuId));
}
