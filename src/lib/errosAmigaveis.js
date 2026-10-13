// Mensagens cruas do banco (Postgres) em português claro. As mensagens já escritas para a pessoa pelo servidor passam sem mudar.
const REGRAS = [
  [/duplicate key value|unique constraint/i, "Já existe um registro com esse código ou número. Atualize a página (F5) e tente de novo. Se o erro continuar, avise o suporte."],
  [/foreign key constraint/i, "Este registro está ligado a outros dados e não pode ser alterado ou removido assim."],
  [/violates check constraint/i, "Algum valor informado não é aceito. Confira os campos e tente de novo."],
  [/null value in column|not-null constraint/i, "Falta preencher um campo obrigatório."],
  [/invalid input syntax/i, "Algum campo está em formato inválido (número ou data). Confira os valores."],
  [/value too long|out of range/i, "Algum valor informado é grande demais. Confira os campos."],
  [/deadlock detected|could not serialize|could not obtain lock/i, "Outra pessoa estava salvando ao mesmo tempo. Tente de novo em instantes."],
  [/statement timeout|canceling statement|timeout/i, "O servidor demorou demais para responder. Tente de novo em instantes."],
  [/permission denied|row-level security/i, "Seu acesso não permite esta operação. Fale com a direção."],
];
export const mensagemAmigavel = (texto) => {
  const t = String(texto ?? "");
  const achou = REGRAS.find(([re]) => re.test(t));
  return achou ? achou[1] : t;
};
