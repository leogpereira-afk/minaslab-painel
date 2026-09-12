// Busca de apresentação: preserva a ordem e os registros recebidos.
export function filtrarPessoasPorNome(pessoas, busca) {
  const normalizar = (valor) => String(valor ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  const termo = normalizar(busca);
  return pessoas.filter((pessoa) => !termo ||
    [pessoa.nome, pessoa.apelido].some((valor) => normalizar(valor).includes(termo)));
}
