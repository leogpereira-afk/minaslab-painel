// Padrão dos cadastros: nomes e endereços sempre em MAIÚSCULAS (com acento), e-mail sempre em minúsculas.
// Vale mesmo que a pessoa digite em minúsculo; fica igual ao que vem da Omie.
// Enquanto digita: só troca as letras (não corta espaços, senão não dá para escrever "JOAO SILVA").
export const digitandoMaiusculas = (v) => String(v ?? "").toLocaleUpperCase("pt-BR");
// Ao gravar: maiúsculas e sem espaços sobrando.
export const maiusculas = (v) => String(v ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");

const CAMPOS_MAIUSCULOS = ["nome", "nome_fantasia", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"];

export function padronizarCliente(c) {
  if (!c || typeof c !== "object") return c;
  const r = { ...c };
  for (const k of CAMPOS_MAIUSCULOS) if (typeof r[k] === "string") r[k] = maiusculas(r[k]);
  if (typeof r.email === "string") r.email = r.email.trim().toLowerCase();
  return r;
}
