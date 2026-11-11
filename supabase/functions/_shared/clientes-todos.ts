// Lê TODOS os clientes do financeiro, de 1000 em 1000.
// O Supabase devolve no máximo 1000 linhas por consulta (mesmo com .limit(5000)); com mais de 1000
// clientes cadastrados, quem passava da linha 1000 sumia das listas e da conferência de CPF/CNPJ.
// deno-lint-ignore no-explicit-any
type Consulta = any;
export async function todosClientes(
  // deno-lint-ignore no-explicit-any
  sb: any,
  colunas = "*",
  montar: (q: Consulta) => Consulta = (q) => q,
  // deno-lint-ignore no-explicit-any
): Promise<any[]> {
  const LOTE = 1000;
  // deno-lint-ignore no-explicit-any
  const todos: any[] = [];
  for (let ini = 0; ini < 100000; ini += LOTE) {
    const { data, error } = await montar(sb.from("clientes_financeiro").select(colunas)).order("id").range(ini, ini + LOTE - 1);
    if (error) throw error;
    todos.push(...(data || []));
    if (!data || data.length < LOTE) break;
  }
  return todos;
}
