// Apresentação compartilhada entre a lista de exames e a ficha da pessoa.
const txt = (v) => String(v ?? "").trim();
export const dataDe = (e) => txt(e.data) || txt(e.realizadoEm);

// Hífen e sublinhado do mesmo valor são o MESMO resultado: normalizar na
// leitura evita que "apto-com-restricao" apareça como resultado desconhecido e
// perca o destaque da restrição, que é justamente o que não pode sumir.
export const resultadoDe = (e) => txt(e.resultado).toLowerCase().replace(/-/g, "_");

export const TIPOS = [
  { valor: "admissional", rotulo: "Admissional" },
  { valor: "periodico", rotulo: "Periódico" },
  { valor: "retorno", rotulo: "Retorno ao trabalho" },
  { valor: "mudanca_funcao", rotulo: "Mudança de função" },
  { valor: "demissional", rotulo: "Demissional" },
  { valor: "complementar", rotulo: "Complementar" },
];

// Mesma normalização do resultado, mais os dois nomes longos que já circularam.
export const tipoDe = (e) => {
  const t = txt(e.tipo).toLowerCase().replace(/-/g, "_");
  if (t === "retorno_trabalho") return "retorno";
  if (t === "mudanca_de_funcao") return "mudanca_funcao";
  return t;
};

// Tipo fora da lista aparece CRU, não some: a lista da tela é uma escolha de
// hoje, o banco pode ter o que veio de antes.
export const rotuloTipo = (t) => TIPOS.find((x) => x.valor === t)?.rotulo || t || "tipo sem registro";

export const RESULTADOS = {
  apto: { rotulo: "Apto", chip: "chip-ok" },
  apto_com_restricao: { rotulo: "Apto com restrição", chip: "chip-warn" },
  inapto: { rotulo: "Inapto", chip: "chip-bad" },
  // Chip PRÓPRIO: laudo que não voltou não pode se parecer com apto.
  aguardando: { rotulo: "Aguardando laudo", chip: "chip-brand" },
};

export const metaResultado = (r) =>
  RESULTADOS[r] || { rotulo: r ? `${r} (fora da lista)` : "resultado sem registro", chip: "chip" };
