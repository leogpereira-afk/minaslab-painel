// Promoção registrada no plano de carreira → ficha e histórico do RH.
// Regra pura (o servidor ml-comercial lê e grava). Só aplica, nunca desfaz.
// - Data futura é recusada: a mudança é registrada quando passa a valer.
// - Cada marco tem id derivado da movimentação: reenviar não duplica.
// - Registro retroativo entra no histórico, mas só troca a ficha se não houver
//   marco do mesmo tipo com data posterior (não desfaz mudança mais nova).
import { CARGO_POR_NIVEL } from "./cargosPlano.mjs";

const moeda = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const legivel = (v, dinheiro) => (v === null || v === undefined || v === "" ? "sem registro" : dinheiro ? moeda(v) : String(v));
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

export function aplicarCarreiraRH({ pessoa, historico = [], nivelId, salario = null, data, movId, hoje, usuario = "" }) {
  const cargo = CARGO_POR_NIVEL[nivelId];
  if (!cargo) return { erro: "Cargo do plano desconhecido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) return { erro: "Data inválida." };
  if (data > hoje) return { erro: "A data não pode ser futura: registre a mudança quando ela passar a valer." };
  const sal = num(salario);
  if (sal !== null && !(sal > 0)) return { erro: "Salário inválido." };

  const maisNovo = (tipo) => historico.some((h) => h.pessoaId === pessoa.id && h.tipo === tipo && String(h.data || "") > data);
  const base = { pessoaId: pessoa.id, pessoaNome: pessoa.nome || "", data, detalhe: "Registrado no plano de carreira.", obs: "", criadoEm: new Date().toISOString(), atualizadoPor: usuario };
  const marcos = [];
  const nova = { ...pessoa };
  let mudou = false;

  if (String(pessoa.cargo ?? "").trim() !== cargo) {
    marcos.push({ ...base, id: `rhc_${movId}_cargo`, tipo: "cargo", titulo: "Mudança de cargo", valorDe: legivel(pessoa.cargo, false), valorPara: cargo });
    if (!maisNovo("cargo")) { nova.cargo = cargo; mudou = true; }
  }
  if (sal !== null && num(pessoa.salario) !== sal) {
    marcos.push({ ...base, id: `rhc_${movId}_salario`, tipo: "salario", titulo: "Mudança de salário", valorDe: legivel(pessoa.salario, true), valorPara: moeda(sal) });
    if (!maisNovo("salario")) { nova.salario = sal; mudou = true; }
  }
  return { pessoa: mudou ? nova : (marcos.length ? { ...pessoa } : null), marcos };
}
