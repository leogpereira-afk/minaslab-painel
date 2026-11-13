// Promoção registrada no plano de carreira → ficha e histórico do RH.
// Regra pura (o servidor ml-comercial lê e grava). Só aplica, nunca desfaz.
// - Data futura é recusada: a mudança é registrada quando passa a valer.
// - Cada marco tem id derivado da movimentação: reenviar não duplica.
// - Registro retroativo entra no histórico, mas só troca a ficha se não houver
//   marco do mesmo tipo com data posterior (não desfaz mudança mais nova).
import { CARGO_POR_NIVEL } from "./cargosPlano.mjs";

const moeda = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const legivel = (v, dinheiro) => (v === null || v === undefined || v === "" ? "sem registro" : dinheiro ? moeda(v) : String(v));
// Aceita 2300, "2300", "2300.5" e "2.300,00" (como a ficha às vezes guarda).
const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const t = String(v).replace(/R\$|\s/g, "");
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};

export function aplicarCarreiraRH({ pessoa, historico = [], nivelId, salario = null, data, movId, hoje, usuario = "" }) {
  const cargo = CARGO_POR_NIVEL[nivelId];
  if (!cargo) return { erro: "Cargo do plano desconhecido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) return { erro: "Data inválida." };
  if (data > hoje) return { erro: "A data não pode ser futura: registre a mudança quando ela passar a valer." };
  const sal = num(salario);
  if (sal !== null && !(sal > 0)) return { erro: "Salário inválido." };

  const daPessoa = (tipo) => historico.filter((h) => h.pessoaId === pessoa.id && h.tipo === tipo && h.id !== `rhc_${movId}_${tipo}`);
  const maisNovo = (tipo) => daPessoa(tipo).some((h) => String(h.data || "") > data);
  // Valor "de": com mudança mais nova na ficha, o valor que valia na data é o
  // do último marco até ela (a ficha atual já é posterior).
  const deNaData = (tipo, atual, dinheiro) => {
    if (!maisNovo(tipo)) return legivel(atual, dinheiro);
    const antes = daPessoa(tipo).filter((h) => String(h.data || "") <= data).sort((a, b) => String(a.data).localeCompare(String(b.data))).at(-1);
    return antes?.valorPara || "sem registro";
  };
  const base = { pessoaId: pessoa.id, pessoaNome: pessoa.nome || "", data, detalhe: "Registrado no plano de carreira.", obs: "", criadoEm: new Date().toISOString(), atualizadoPor: usuario };
  const marcos = [];
  const nova = { ...pessoa };
  let mudou = false;

  let mantida = false;
  const cargoDe = deNaData("cargo", pessoa.cargo, false);
  if (String(pessoa.cargo ?? "").trim() !== cargo || (maisNovo("cargo") && cargoDe !== cargo)) {
    marcos.push({ ...base, id: `rhc_${movId}_cargo`, tipo: "cargo", titulo: "Mudança de cargo", valorDe: cargoDe, valorPara: cargo });
    if (!maisNovo("cargo")) { nova.cargo = cargo; mudou = true; } else mantida = true;
  }
  if (sal !== null && (num(pessoa.salario) !== sal || maisNovo("salario"))) {
    const salDe = deNaData("salario", pessoa.salario, true);
    if (salDe !== moeda(sal)) {
      marcos.push({ ...base, id: `rhc_${movId}_salario`, tipo: "salario", titulo: "Mudança de salário", valorDe: salDe, valorPara: moeda(sal) });
      if (!maisNovo("salario")) { nova.salario = sal; mudou = true; } else mantida = true;
    }
  }
  return { pessoa: mudou ? nova : null, marcos, fichaMantida: mantida };
}
