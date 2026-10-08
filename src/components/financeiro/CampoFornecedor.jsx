// Fornecedor da despesa: digite para buscar entre os clientes cadastrados (nome, fantasia, CPF/CNPJ). Escolher já
// preenche o CNPJ/CPF. Fornecedor que não está no cadastro continua valendo: o que foi digitado é gravado como está.
import { useEffect, useId, useMemo, useState } from "react";
import { buscarClientes } from "../../lib/buscaClientes.js";
import { finClientesListar } from "../../services/financeiro.js";

let copia = null; // a lista de clientes é carregada uma vez por sessão da tela, não a cada "Nova despesa"
const carregarClientes = () => (copia ||= finClientesListar("").catch((e) => { copia = null; throw e; }));

export default function CampoFornecedor({ valor, aoDigitar, aoEscolher }) {
  const id = useId();
  const [clientes, setClientes] = useState([]);
  const [falhou, setFalhou] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(-1);
  useEffect(() => {
    let vivo = true;
    carregarClientes().then((l) => vivo && setClientes(l)).catch(() => vivo && setFalhou(true));
    return () => { vivo = false; };
  }, []);
  const { itens, total } = useMemo(() => buscarClientes(clientes, valor), [clientes, valor]);
  // Já é exatamente um cliente cadastrado: não precisa mais sugerir.
  const igual = clientes.some((c) => String(c.nome || "").trim().toLowerCase() === String(valor || "").trim().toLowerCase());
  const mostrar = aberto && itens.length > 0 && !(igual && itens.length === 1);
  const escolher = (c) => { aoEscolher(c); setAberto(false); setIndice(-1); };

  return (
    <div className="relative">
      <label className="label" htmlFor={id}>Fornecedor</label>
      <input
        id={id} className="input w-full" required autoComplete="off" role="combobox" aria-expanded={mostrar} aria-controls={`${id}-lista`} aria-autocomplete="list"
        placeholder="Digite para buscar um cadastrado ou escreva um novo"
        value={valor}
        onChange={(e) => { aoDigitar(e.target.value); setAberto(true); setIndice(-1); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && mostrar) { e.preventDefault(); setIndice((i) => Math.min(itens.length - 1, i + 1)); }
          else if (e.key === "ArrowUp" && mostrar) { e.preventDefault(); setIndice((i) => Math.max(0, i - 1)); }
          else if (e.key === "Enter" && mostrar && indice >= 0) { e.preventDefault(); escolher(itens[indice]); }
          else if (e.key === "Escape" && mostrar) { e.preventDefault(); e.stopPropagation(); setAberto(false); }
        }}
      />
      {mostrar && (
        <ul id={`${id}-lista`} role="listbox" aria-label="Clientes cadastrados" className="mt-1 max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {itens.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === indice}>
              <button
                type="button" tabIndex={-1}
                // mouseDown (não click): o clique tira o foco do campo e fecharia a lista antes de escolher.
                onMouseDown={(e) => { e.preventDefault(); escolher(c); }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50 ${i === indice ? "bg-brand-50" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900">{c.nome}</span>
                  {c.nome_fantasia && c.nome_fantasia !== c.nome && <span className="block truncate text-xs text-slate-500">{c.nome_fantasia}</span>}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{c.cnpj_cpf || "sem CPF/CNPJ"}</span>
              </button>
            </li>
          ))}
          {total > itens.length && <li className="px-3 py-2 text-center text-xs text-slate-500">Mostrando {itens.length} de {total}. Digite mais para afinar.</li>}
        </ul>
      )}
      <p className="mt-1 text-xs text-slate-500">
        {falhou ? "Não foi possível carregar os cadastros; digite o nome normalmente." : "Não achou? Pode digitar o nome do fornecedor mesmo sem cadastro."}
      </p>
    </div>
  );
}
