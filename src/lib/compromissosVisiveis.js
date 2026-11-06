// Quem vê qual compromisso — a mesma régua da Agenda da equipe, para TODOS (direção inclusive):
//   "Toda a equipe" (paraTodos)  → todo mundo vê;
//   pessoas escolhidas           → só elas e quem criou;
//   ninguém escolhido            → só quem criou.
//
// Compromissos antigos (antes de 06/11/2026) não têm `criador`/`participantes`: valem quem gravou por
// último (`atualizadoPor`) como criador e o responsável antigo (pelo nome) como participante.
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

/** Quem criou o compromisso (usuário do painel). */
export const criadorDe = (c) => String(c?.criador || c?.atualizadoPor || "");

/** Os usuários escolhidos para ver o compromisso ([] = só quem criou). */
export const participantesDe = (c) => (Array.isArray(c?.participantes) ? c.participantes.filter(Boolean) : []);

/** Compromisso do modelo antigo (só tem o "responsável" da ficha do RH). */
const ehAntigo = (c) => !Array.isArray(c?.participantes) && c?.paraTodos === undefined;

export function compromissoVisivelPara(c, sessao) {
  if (!c || !sessao?.usuario) return false;
  if (c.paraTodos === true) return true;
  if (criadorDe(c) === sessao.usuario) return true;
  if (participantesDe(c).includes(sessao.usuario)) return true;
  return ehAntigo(c) && mesmoNome(c.responsavelNome, sessao.nome);
}

export function compromissosVisiveis(lista, sessao) {
  if (!Array.isArray(lista)) return lista;
  if (!sessao) return [];
  return lista.filter((c) => compromissoVisivelPara(c, sessao));
}

/** "Toda a equipe", "Só você", "Só Ana" ou "Você, Thayna e Maria" — para a linha da lista. */
export function quemVeTexto(c, sessao, nomes = {}) {
  if (c?.paraTodos === true) return "Toda a equipe";
  if (ehAntigo(c)) return c?.responsavelNome || "";
  const primeiro = (u) => String(nomes[u] || u).trim().split(/\s+/)[0];
  const eu = sessao?.usuario;
  const gente = [criadorDe(c), ...participantesDe(c)].filter((u, i, a) => u && a.indexOf(u) === i);
  if (gente.length <= 1) return gente[0] === eu || !gente[0] ? "Só você" : `Só ${primeiro(gente[0])}`;
  const rotulos = gente.map((u) => (u === eu ? "Você" : primeiro(u)));
  return rotulos.length === 2 ? rotulos.join(" e ") : `${rotulos.slice(0, -1).join(", ")} e ${rotulos[rotulos.length - 1]}`;
}
