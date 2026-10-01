// Histórico de Preços (aba da Gestão de Estoque) e o aviso de preço dentro do
// Pedido de Compra. Somente leitura: tudo vem dos itens de pedido já gravados,
// calculado em ../lib/historicoPrecos.js (onde estão as regras e os testes).

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, History, Search, Store, TrendingDown } from "lucide-react";
import { Modal } from "../components/ui.jsx";
import { avaliarValor, chaveTexto, dataBr, encontrarResumo, moeda, moedaUnitaria, percentual, precoNaBase, resumirPorProduto } from "../lib/historicoPrecos.js";

const POR_PAGINA = 25;

function PrecoCompra({ compra, destaque = false }) {
  if (!compra) return <span className="text-slate-400">—</span>;
  return (
    <div className="leading-tight">
      <b className={destaque ? "text-emerald-700" : "text-slate-900"}>{moeda(compra.valorKit)}</b>
      <span className="text-slate-400"> /kit</span>
      {compra.valorPorUnidade != null && (
        <span className="block text-[10px] text-slate-500">{moedaUnitaria(compra.valorPorUnidade)}/{compra.unidade} · kit {compra.conteudoKit.toLocaleString("pt-BR")} {compra.unidade}</span>
      )}
    </div>
  );
}

function OndeQuando({ compra }) {
  if (!compra) return null;
  return (
    <span className="block text-[10px] text-slate-500">
      <b className="text-slate-700">{compra.fornecedor || "—"}</b> · {dataBr(compra.data)}{compra.pedido ? ` · ${compra.pedido}` : ""}
    </span>
  );
}

function DetalheProduto({ resumo, aoFechar }) {
  const preco = (c) => precoNaBase(c, resumo.base);
  const menorPreco = resumo.menor ? preco(resumo.menor) : null;
  return (
    <Modal titulo={`Histórico de compras — ${resumo.produto}`} aberto aoFechar={aoFechar} largura="max-w-5xl">
      <div className="space-y-5 text-xs">
        <p className="text-slate-500">
          Comparação feita pelo {resumo.base === "unidade" ? `preço por ${resumo.unidade} (kits de tamanhos diferentes ficam comparáveis)` : "preço do kit"}.
          Pedidos pendentes aparecem como cotação em aberto e não entram no menor preço. Valores de R$ 0,01 (doação/brinde) também ficam de fora.
        </p>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700"><Store size={14} />Por fornecedor</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-slate-50 text-left text-[10px] uppercase text-slate-500">
                <tr><th className="p-2.5">Fornecedor</th><th className="p-2.5">Compras</th><th className="p-2.5">Menor valor pago</th><th className="p-2.5">Última compra</th><th className="p-2.5">Diferença p/ o mais barato</th></tr>
              </thead>
              <tbody className="divide-y">
                {resumo.fornecedores.map((f) => {
                  const dif = f.menor && menorPreco ? preco(f.menor) / menorPreco - 1 : null;
                  return (
                    <tr key={f.fornecedor + f.cnpj}>
                      <td className="p-2.5"><b>{f.fornecedor}</b>{f.cnpj && <span className="block font-mono text-[10px] text-slate-400">{f.cnpj}</span>}</td>
                      <td className="p-2.5">{f.qtdCompras}{f.emAberto > 0 && <span className="ml-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">{f.emAberto} em aberto</span>}</td>
                      <td className="p-2.5"><PrecoCompra compra={f.menor} destaque={f.menor && f.menor === resumo.menor} /></td>
                      <td className="p-2.5">{f.ultima ? <>{dataBr(f.ultima.data)}<span className="block text-[10px] text-slate-400">{f.ultima.pedido}</span></> : "—"}</td>
                      <td className="p-2.5">{dif == null ? "—" : dif <= 0.01 ? <span className="font-bold text-emerald-700">Mais barato</span> : <span className="font-bold text-amber-700">+{percentual(dif)}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700"><History size={14} />Todas as compras e cotações</h3>
          <div className="max-h-[45vh] overflow-auto rounded-lg border">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase text-slate-500">
                <tr><th className="p-2.5">Data</th><th className="p-2.5">Pedido</th><th className="p-2.5">Fornecedor</th><th className="p-2.5">Especificação</th><th className="p-2.5 text-right">Qtd</th><th className="p-2.5 text-right">Valor</th><th className="p-2.5">Situação</th></tr>
              </thead>
              <tbody className="divide-y">
                {resumo.compras.map((c) => (
                  <tr key={c.id || c.pedido + c.fornecedor + c.data} className={c.valida ? "" : "bg-slate-50/70 text-slate-500"}>
                    <td className="whitespace-nowrap p-2.5">{dataBr(c.data)}</td>
                    <td className="p-2.5 font-mono">{c.pedido || "—"}</td>
                    <td className="p-2.5 font-semibold">{c.fornecedor || "—"}</td>
                    <td className="p-2.5">{c.especificacao || "—"}</td>
                    <td className="whitespace-nowrap p-2.5 text-right">{c.quantidadeKits.toLocaleString("pt-BR")} kit(s)</td>
                    <td className="p-2.5 text-right"><PrecoCompra compra={c} destaque={c === resumo.menor} /></td>
                    <td className="p-2.5">
                      {c.status === "PENDENTE" ? <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">COTAÇÃO EM ABERTO</span>
                        : !c.efetiva ? <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">{c.status}</span>
                        : c.simbolico ? <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">VALOR SIMBÓLICO</span>
                        : <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{c.status}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default function HistoricoPrecos({ pedidos = [] }) {
  const resumos = useMemo(() => resumirPorProduto(pedidos), [pedidos]);
  const [busca, setBusca] = useState("");
  const [soAcima, setSoAcima] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState(null);

  const termo = chaveTexto(busca);
  const filtrados = resumos.filter((r) =>
    (!soAcima || r.ultimaAcimaDoMenor > 0) &&
    (!termo || chaveTexto([r.produto, r.grupo, ...r.compras.map((c) => `${c.fornecedor} ${c.especificacao} ${c.pedido}`)].join(" ")).includes(termo))
  );
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const atual = Math.min(pagina, totalPaginas);
  const itens = filtrados.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);
  const fornecedores = new Set(resumos.flatMap((r) => r.compras.filter((c) => c.valida).map((c) => c.chaveFornecedor)));
  const acima = resumos.filter((r) => r.ultimaAcimaDoMenor > 0).length;
  const detalhe = aberto ? resumos.find((r) => r.chave === aberto) : null;

  const cartoes = [
    ["PRODUTOS COM PREÇO", resumos.filter((r) => r.qtdCompras > 0).length, History, "bg-teal-50 text-teal-700"],
    ["FORNECEDORES USADOS", fornecedores.size, Store, "bg-indigo-50 text-indigo-600"],
    ["ÚLTIMA COMPRA ACIMA DO MENOR", acima, AlertTriangle, "bg-amber-50 text-amber-600"],
  ];

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-base font-bold uppercase tracking-wide text-slate-800"><span className="mr-2 text-blue-600">▰</span>Histórico de Preços</h2>
        <p className="mt-1 text-xs text-slate-400">Onde cada insumo foi comprado, quando e por quanto — consulte antes de fechar uma cotação para não pagar mais caro.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cartoes.map(([rotulo, valor, Icone, tom]) => (
          <div key={rotulo} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tom}`}><Icone size={17} /></span>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{rotulo}</p><b className="mt-0.5 block text-xl text-slate-950">{valor}</b></div>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" className="accent-amber-600" checked={soAcima} onChange={(e) => { setSoAcima(e.target.checked); setPagina(1); }} />
            Só produtos cuja última compra saiu acima do menor preço
          </label>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input className="input pl-9 uppercase" placeholder="Produto, fornecedor ou nº do pedido..." value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} />
          </div>
        </div>

        {filtrados.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">{resumos.length ? "Nenhum produto encontrado com esse filtro." : "Ainda não há pedidos de compra com valor registrado."}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1000px] text-xs">
              <thead className="bg-slate-100 text-left text-[10px] uppercase text-slate-600">
                <tr><th className="px-3 py-2.5">Produto</th><th className="px-3 py-2.5">Última compra</th><th className="px-3 py-2.5">Menor valor pago</th><th className="px-3 py-2.5">Fornecedores</th><th className="px-3 py-2.5">Alerta</th><th className="px-3 py-2.5" /></tr>
              </thead>
              <tbody className="divide-y">
                {itens.map((r) => (
                  <tr key={r.chave} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3"><b className="text-slate-900">{r.produto}</b>{r.grupo && <span className="block text-[10px] text-slate-400">{r.grupo}</span>}{r.compras.some((c) => c.especificacao) && <span className="block max-w-xs truncate text-[10px] text-slate-500" title={[...new Set(r.compras.map((c) => c.especificacao).filter(Boolean))].join(" · ")}>{[...new Set(r.compras.map((c) => c.especificacao).filter(Boolean))].join(" · ")}</span>}</td>
                    <td className="px-3 py-3">{r.ultima ? <><PrecoCompra compra={r.ultima} /><OndeQuando compra={r.ultima} /></> : <span className="text-slate-400">Só cotações em aberto</span>}</td>
                    <td className="px-3 py-3">{r.menor ? <><PrecoCompra compra={r.menor} destaque /><OndeQuando compra={r.menor} /></> : "—"}</td>
                    <td className="px-3 py-3">{r.fornecedores.length}</td>
                    <td className="px-3 py-3">
                      {r.ultimaAcimaDoMenor > 0
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800"><AlertTriangle size={11} />Última +{percentual(r.ultimaAcimaDoMenor)}</span>
                        : r.comparacaoDuvidosa ? <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600" title="Preços muito diferentes: provavelmente modelos ou tamanhos de kit diferentes com o mesmo nome. Confira o cadastro.">Conferir cadastro</span>
                        : r.menor ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><TrendingDown size={11} />No menor preço</span> : null}
                    </td>
                    <td className="px-3 py-3 text-right"><button type="button" className="btn-outline text-xs" onClick={() => setAberto(r.chave)}>Ver histórico</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-1 pt-3 text-sm">
            <span className="text-slate-500">{filtrados.length} produtos · página {atual} de {totalPaginas}</span>
            <div className="flex gap-2">
              <button type="button" className="btn-outline text-xs" disabled={atual <= 1} onClick={() => setPagina(atual - 1)}>Anterior</button>
              <button type="button" className="btn-outline text-xs" disabled={atual >= totalPaginas} onClick={() => setPagina(atual + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </section>

      {detalhe && <DetalheProduto resumo={detalhe} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

// Aviso mostrado no formulário do Pedido de Compra, logo abaixo do campo de
// valor: onde e por quanto esse produto já foi comprado, e se o valor digitado
// está acima do menor já pago.
export function AvisoPrecoPedido({ pedidos = [], produto, valor, conteudoKit, unidade, fornecedor }) {
  const resumos = useMemo(() => resumirPorProduto(pedidos), [pedidos]);
  if (!chaveTexto(produto)) return null;
  const r = encontrarResumo(resumos, produto);
  if (!r || !r.menor) {
    return <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">Sem compra anterior deste produto registrada no sistema — não há preço para comparar.</p>;
  }
  const av = avaliarValor(r, { valor, conteudoKit, unidade });
  const outroFornecedor = fornecedor && chaveTexto(fornecedor) !== r.menor.chaveFornecedor;
  const tom = av.situacao === "acima" ? "border-amber-300 bg-amber-50 text-amber-900" : av.situacao === "abaixo" || av.situacao === "igual" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-lg border px-3 py-2 text-[11px] ${tom}`} role={av.situacao === "acima" ? "alert" : "status"}>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <span><b>Última compra:</b> {moeda(r.ultima.valorKit)}/kit em {r.ultima.fornecedor} · {dataBr(r.ultima.data)}{r.ultima.pedido ? ` (${r.ultima.pedido})` : ""}</span>
        <span><b>Menor valor já pago:</b> {moeda(r.menor.valorKit)}/kit{r.menor.valorPorUnidade != null ? ` (${moedaUnitaria(r.menor.valorPorUnidade)}/${r.menor.unidade})` : ""} em {r.menor.fornecedor} · {dataBr(r.menor.data)}</span>
      </div>
      {av.situacao === "acima" && (
        <p className="mt-1.5 flex items-start gap-1.5 font-bold"><AlertTriangle size={13} className="mt-px shrink-0" />
          Este valor está {percentual(av.diferenca)} acima do menor já pago{av.base === "unidade" ? " (comparando o preço por unidade)" : ""}.{outroFornecedor ? ` Já compramos mais barato em ${r.menor.fornecedor} — vale pedir cotação lá.` : " Confira a cotação antes de fechar."}
        </p>
      )}
      {av.situacao === "duvidosa" && (
        <p className="mt-1.5 font-semibold">Valor bem diferente do histórico (mais que o dobro). Confira se é o mesmo item e o mesmo tamanho de kit.</p>
      )}
      {(av.situacao === "abaixo" || av.situacao === "igual") && (
        <p className="mt-1.5 flex items-center gap-1.5 font-semibold"><CheckCircle2 size={13} className="shrink-0" />{av.situacao === "abaixo" ? `Valor ${percentual(-av.diferenca)} abaixo do menor já pago.` : "Valor igual ao menor já pago."}</p>
      )}
    </div>
  );
}
