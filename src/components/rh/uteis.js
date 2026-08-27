// Ajudantes do RH usados por mais de uma aba (e pela casca). Moram aqui para
// nenhuma aba importar da outra — a casca e as abas puxam deste arquivo.

// O ano digitado com dígito a mais (20266) passa no input de data e andaria
// 18 mil anos calado. Se o ano não tem 4 dígitos, devolve o ano para a frase.
export function anoRuim(data) {
  const ano = String(data || "").split("-")[0];
  return ano && ano.length !== 4 ? ano : null;
}

export function tempoDeCasa(admissao, hojeISO) {
  const [a1, m1, d1] = String(admissao).split("-").map(Number);
  const [a2, m2, d2] = String(hojeISO).split("-").map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (meses < 0) return "";
  if (meses < 1) return "menos de 1 mês de casa";
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const pa = anos ? `${anos} ${anos === 1 ? "ano" : "anos"}` : "";
  const pm = resto ? `${resto} ${resto === 1 ? "mês" : "meses"}` : "";
  return `${[pa, pm].filter(Boolean).join(" e ")} de casa`;
}

// A frase do radar: vencido grita, 60 dias acende — é o prazo que a casa usa
// para agendar ASO e reciclagem sem correria.
export function chipVenc(dias) {
  if (dias === null) return { texto: "sem data", chip: "chip" };
  if (dias < 0) {
    const d = -dias;
    return { texto: `venceu há ${d} ${d === 1 ? "dia" : "dias"}`, chip: "chip-bad" };
  }
  if (dias === 0) return { texto: "vence HOJE", chip: "chip-bad" };
  if (dias <= 60) return { texto: `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`, chip: "chip-warn" };
  return { texto: `em ${dias} dias`, chip: "chip" };
}
