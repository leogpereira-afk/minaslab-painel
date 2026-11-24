// Aba Produtos — o CADASTRO (Ana, 24/11/2026): nome, categoria, unidade, onde está
// guardado, mínimo, custo, fornecedor; editar, desativar e excluir. O controle
// (saldo, entrada, saída, extrato) fica na aba Estoque.

import { useMemo, useState } from "react";
import { Plus, Pencil, Search, Trash2, MapPin } from "lucide-react";
import { moedaCheia } from "../../lib/format.js";
import { Empty, Modal, Card } from "../ui.jsx";
import { CATEGORIAS, UNIDADES, rotuloCategoria, numeroOuNull, paraCampoNum, comUnidade } from "./comum.jsx";

export const produtoParaForm = (p) => ({
  id: p?.id || "",
  nome: p?.nome || "",
  unidade: p?.unidade || "un",
  categoria: p?.categoria || "outro",
  local: p?.local || "",
  minimo: paraCampoNum(p?.minimo),
  custoMedio: paraCampoNum(p?.custoMedio),
  fornecedorPadrao: p?.fornecedorPadrao || "",
  obs: p?.obs || "",
  ativo: p ? p.ativo !== false : true,
});

// EXCLUIR PRODUTO (Ana, 24/11/2026): só produto SEM lançamento no livro do
// estoque — com entrada/saída, apagar deixaria movimento órfão; aí o caminho
// é desativar (tira das escolhas novas e mantém o histórico legível).
export function FormProduto({ form, setForm, salvando, aoSalvar, aoExcluir, temLancamento, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  return (
    <Modal titulo={form.id ? "Editar produto" : "Novo produto"} aberto={!!form} aoFechar={aoFechar}>
      <form
        aria-busy={salvando}
        onSubmit={(e) => {
          e.preventDefault();
          if (salvando) return;
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="pr-nome">Nome do produto</label>
          <input id="pr-nome" type="text" className="input" value={form.nome} onChange={setCampo("nome")} autoFocus required />
        </div>
        <div>
          <label className="label" htmlFor="pr-local">Onde está guardado</label>
          <input
            id="pr-local" type="text" className="input"
            placeholder="Ex.: Almoxarifado, prateleira B3"
            value={form.local} onChange={setCampo("local")}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:min-w-0">
          <div>
            <label className="label" htmlFor="pr-cat">Categoria</label>
            <select id="pr-cat" className="select" value={form.categoria} onChange={setCampo("categoria")}>
              {Object.entries(CATEGORIAS).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pr-un">Unidade</label>
            <select id="pr-un" className="select" value={form.unidade} onChange={setCampo("unidade")}>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pr-min">Mínimo (ponto de reposição)</label>
            <input
              id="pr-min" type="text" inputMode="decimal" className="input"
              placeholder="em branco = sem mínimo"
              value={form.minimo} onChange={setCampo("minimo")}
            />
          </div>
          <div>
            <label className="label" htmlFor="pr-custo">Custo médio (R$)</label>
            <input
              id="pr-custo" type="text" inputMode="decimal" className="input"
              placeholder="em branco = sem registro"
              value={form.custoMedio} onChange={setCampo("custoMedio")}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="pr-forn">Fornecedor de costume</label>
          <input id="pr-forn" type="text" className="input" placeholder="opcional" value={form.fornecedorPadrao} onChange={setCampo("fornecedorPadrao")} />
        </div>
        <div>
          <label className="label" htmlFor="pr-obs">Observações</label>
          <textarea id="pr-obs" className="input" rows={2} value={form.obs} onChange={setCampo("obs")} />
        </div>
        {form.id && (
          <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="pr-ativo">
            <input
              id="pr-ativo" type="checkbox" className="h-4 w-4"
              checked={form.ativo !== false}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Produto ativo (desmarque para tirar das listas sem apagar o histórico)
          </label>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {form.id && aoExcluir && (
            <button
              type="button"
              className="mr-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-bad-700 hover:bg-bad-50 disabled:opacity-40"
              disabled={salvando || temLancamento}
              title={temLancamento ? "Tem entrada ou saída no estoque: desmarque “Produto ativo” em vez de excluir" : undefined}
              onClick={() => aoExcluir(form.id)}
            >
              <Trash2 size={15} /> Excluir produto
            </button>
          )}
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.nome.trim()}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
        {form.id && aoExcluir && temLancamento && (
          <p className="text-xs text-slate-500">Para excluir, o produto não pode ter entrada ou saída no estoque. Com lançamentos, desmarque “Produto ativo”.</p>
        )}
      </form>
    </Modal>
  );
}


export default function AbaProdutos({ produtos, movs, editavel, salvando, formProduto, setFormProduto, acoes }) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [verInativos, setVerInativos] = useState(false);
  const comLancamento = useMemo(() => new Set(movs.map((m) => m.produtoId)), [movs]);
  const ordenados = useMemo(
    () => [...produtos].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")),
    [produtos]
  );
  const inativos = ordenados.filter((p) => p.ativo === false).length;
  const q = busca.trim().toLowerCase();
  const visiveis = ordenados.filter((p) =>
    (verInativos || p.ativo !== false) &&
    (!categoria || p.categoria === categoria) &&
    (!q || `${p.nome || ""} ${p.local || ""}`.toLowerCase().includes(q))
  );

  return (
    <div>
      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="grid w-full min-w-0 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-end">
            <div className="relative">
              <label className="label" htmlFor="pr-busca">Buscar produto</label>
              <Search size={15} className="pointer-events-none absolute left-3 top-[2.15rem] text-slate-400" />
              <input id="pr-busca" type="search" className="input w-full min-w-0 pl-9 sm:w-56" placeholder="nome ou local"
                value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pr-fcat">Categoria</label>
              <select id="pr-fcat" className="select w-full min-w-0 sm:w-40" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(CATEGORIAS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {inativos > 0 && (
              <button type="button" className="btn-outline" aria-pressed={verInativos} onClick={() => setVerInativos((v) => !v)}>
                {verInativos ? "Esconder desativados" : `Ver desativados (${inativos})`}
              </button>
            )}
            {editavel && (
              <button type="button" className="btn-primary" onClick={() => acoes.abrirProduto(null)}>
                <Plus size={16} strokeWidth={2.5} /> Novo produto
              </button>
            )}
          </div>
        </div>

        {visiveis.length === 0 ? (
          <Empty>{produtos.length === 0 ? "Nenhum produto cadastrado ainda. Comece pelo “Novo produto”." : "Nenhum produto neste filtro."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Produto</th><th className="px-2 py-2">Categoria</th><th className="px-2 py-2">Unidade</th>
                  <th className="px-2 py-2">Onde está guardado</th><th className="px-2 py-2">Mínimo</th><th className="px-2 py-2">Custo médio</th>
                  <th className="px-2 py-2">Fornecedor</th>{editavel && <th className="px-2 py-2"><span className="sr-only">Ações</span></th>}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((p) => {
                  const minimo = numeroOuNull(p.minimo);
                  const custo = numeroOuNull(p.custoMedio);
                  return (
                    <tr key={p.id} className={`border-t ${p.ativo === false ? "text-slate-400" : ""}`} style={{ borderColor: "var(--hairline)" }}>
                      <td className="px-2 py-2">
                        <span className="font-medium text-slate-900">{p.nome}</span>
                        {p.ativo === false && <span className="chip ml-2">desativado</span>}
                        {p.obs && <span className="block text-xs text-slate-500">{p.obs}</span>}
                      </td>
                      <td className="px-2 py-2">{rotuloCategoria(p.categoria)}</td>
                      <td className="px-2 py-2">{p.unidade || "un"}</td>
                      <td className="px-2 py-2">
                        {p.local ? <span className="inline-flex items-center gap-1"><MapPin size={12} className="shrink-0 text-brand-600" />{p.local}</span> : <span className="text-xs text-slate-400">sem local</span>}
                      </td>
                      <td className="px-2 py-2 tabular-nums">{minimo === null ? <span className="text-xs text-slate-400">sem mínimo</span> : comUnidade(minimo, p.unidade)}</td>
                      <td className="px-2 py-2 tabular-nums">{custo === null ? <span className="text-xs text-slate-400">—</span> : moedaCheia(custo)}</td>
                      <td className="px-2 py-2">{p.fornecedorPadrao || <span className="text-xs text-slate-400">—</span>}</td>
                      {editavel && (
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          <button type="button" disabled={salvando} onClick={() => acoes.abrirProduto(p)}
                            className="inline-grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Editar produto" aria-label={`Editar produto: ${p.nome}`}><Pencil size={14} /></button>
                          <button type="button" disabled={salvando || comLancamento.has(p.id)} onClick={() => acoes.excluirProduto(p.id)}
                            className="inline-grid h-11 w-11 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700 disabled:opacity-30"
                            title={comLancamento.has(p.id) ? "Tem entrada ou saída no estoque: edite e desmarque “Produto ativo”" : "Excluir produto"}
                            aria-label={`Excluir produto: ${p.nome}`}><Trash2 size={14} /></button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <FormProduto
        form={formProduto}
        setForm={setFormProduto}
        salvando={salvando}
        aoSalvar={acoes.salvarProduto}
        aoExcluir={acoes.excluirProduto}
        temLancamento={!!formProduto?.id && comLancamento.has(formProduto.id)}
        aoFechar={() => setFormProduto(null)}
      />
    </div>
  );
}
