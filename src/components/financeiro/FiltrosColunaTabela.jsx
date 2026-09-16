import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";

const normalizar = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function useFiltrosColunaTabela(itens, campos) {
  const [filtros, setFiltros] = useState({});
  const filtrados = useMemo(
    () =>
      itens.filter((item) =>
        Object.entries(filtros).every(([chave, termo]) => {
          if (!termo) return true;
          const extrair = campos[chave];
          if (!extrair) return true;
          return normalizar(extrair(item)).includes(normalizar(termo));
        }),
      ),
    [itens, filtros, campos],
  );
  const quantidade = Object.values(filtros).filter(Boolean).length;
  const definir = (chave, valor) =>
    setFiltros((atual) => ({ ...atual, [chave]: valor }));
  const limpar = () => setFiltros({});
  return { filtros, filtrados, quantidade, definir, limpar };
}

export function LinhaFiltrosColuna({
  colunas,
  filtros,
  definir,
  limpar,
  quantidade,
  className = "",
}) {
  return (
    <tr
      className={`border-t border-slate-200 bg-white normal-case ${className}`}
    >
      {colunas.map((coluna, indice) => (
        <th
          key={coluna?.chave || `vazio-${indice}`}
        className={`px-2 py-2 font-normal ${coluna?.className || ""}`}
        >
          {!coluna ? null : coluna.acao ? (
            <button
              type="button"
              className="btn-ghost h-8 gap-1 px-2 text-xs"
              title="Limpar filtros das colunas"
              disabled={!quantidade}
              onClick={limpar}
            >
              <X size={13} />
              Limpar
            </button>
          ) : coluna.opcoes ? (
            <select
              aria-label={`Filtrar ${coluna.rotulo || coluna.chave}`}
              className="input h-8 min-w-[92px] px-2 text-xs"
              value={filtros[coluna.chave] || ""}
              onChange={(e) => definir(coluna.chave, e.target.value)}
            >
              <option value="">Todos</option>
              {coluna.opcoes.map((opcao) => {
                const valor = typeof opcao === "string" ? opcao : opcao.valor;
                const texto = typeof opcao === "string" ? opcao : opcao.texto;
                return (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                );
              })}
            </select>
          ) : (
            <div className="relative min-w-[92px]">
              <Filter
                className="absolute left-2 top-2 text-slate-400"
                size={13}
              />
              <input
                aria-label={`Filtrar ${coluna.rotulo || coluna.chave}`}
                className="input h-8 w-full pl-7 pr-2 text-xs"
                type={coluna.tipo || "text"}
                placeholder={coluna.placeholder || coluna.rotulo || "Filtrar"}
                value={filtros[coluna.chave] || ""}
                onChange={(e) => definir(coluna.chave, e.target.value)}
              />
            </div>
          )}
        </th>
      ))}
    </tr>
  );
}

export function ResumoFiltrosColuna({ quantidade, exibidos }) {
  if (!quantidade) return null;
  return (
    <span className="text-xs font-medium text-blue-700">
      {exibidos} resultado(s) nesta página
    </span>
  );
}
