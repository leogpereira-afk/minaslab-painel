// Comissão do coletor por coleta do CRM (regra da Ana, 05/11/2026).
// Na coleta marca-se o tipo; a folha paga as COLETADAS do mês (a lista vem da
// Edge Function ml-rh-coletas, que já filtra status, mês e tipo).
//   · Coleta composta: R$ 100,00
//   · Viagem: até 50 km (ida e volta) R$ 50,00; acima de 50 km R$ 100,00
//   · Coleta comum: sem comissão
// Cada coleta é de um tipo só.
import { casarPessoa } from "./folhaContabil.js";

export const VALOR_COMPOSTA = 100;
export const VIAGEM = { limiteKm: 50, ateLimite: 50, acimaLimite: 100 };

export function valorDaColeta(coleta = {}) {
  if (coleta.tipo === "COMPOSTA") return VALOR_COMPOSTA;
  if (coleta.tipo === "VIAGEM") {
    const km = Number(coleta.km);
    if (!(km > 0)) return 0; // viagem sem km: não dá para saber a faixa
    return km <= VIAGEM.limiteKm ? VIAGEM.ateLimite : VIAGEM.acimaLimite;
  }
  return 0;
}

/** As coletas do mês feitas por esta pessoa (casada pelo nome do coletor no CRM), com o valor de cada uma. */
export function coletasDaPessoa(ficha, coletas = [], fichas = []) {
  const casamento = new Map();
  const dono = (nome) => {
    if (!casamento.has(nome)) casamento.set(nome, casarPessoa(nome, fichas)?.id ?? null);
    return casamento.get(nome);
  };
  return coletas
    .filter((c) => c && c.coletorNome && dono(c.coletorNome) === ficha.id)
    .map((c) => ({ ...c, valor: valorDaColeta(c), semKm: c.tipo === "VIAGEM" && !(Number(c.km) > 0) }));
}

/** Coletores do CRM que não casaram com nenhuma ficha do RH (para avisar na tela). */
export function coletoresSemFicha(coletas = [], fichas = []) {
  return [...new Set(coletas.map((c) => c.coletorNome).filter(Boolean))].filter((n) => !casarPessoa(n, fichas));
}
