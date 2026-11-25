import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, RefreshCw, X } from "lucide-react";
import { PageTitle } from "../components/ui.jsx";
import { carregarCopiaFinanceira } from "../services/financeiroCache.js";
import { lancamentosDaCelula, montarDre } from "../lib/dre.js";
import { baixarPlanilha } from "../lib/planilha.js";
import { hojeSaoPaulo } from "../lib/tituloVencido.js";

// DRE mensal por empresa (ou consolidado), por competência ou caixa. Regras em src/lib/dre.js.
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
const valorTexto = (v) => (Math.abs(v) < 0.005 ? "—" : v < 0 ? `− ${moeda(-v)}` : moeda(v));

function Celula({ valor, onClick, forte }) {
  const cor = forte ? (valor < -0.005 ? "text-red-700" : valor > 0.005 ? "text-emerald-700" : "text-slate-500") : valor < -0.005 ? "text-red-700" : "text-slate-800";
  const conteudo = <span className={`${cor} ${forte ? "font-bold" : ""}`}>{valorTexto(valor)}</span>;
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
      {onClick && Math.abs(valor) > 0.005 ? (
        <button type="button" className="rounded px-1 hover:bg-slate-100 hover:underline" onClick={onClick}>{conteudo}</button>
      ) : conteudo}
    </td>
  );
}

function TabelaDre({ linhas, abertas, alternar, abrirCelula, titulo }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="sticky left-0 z-10 min-w-[260px] bg-slate-50 px-3 py-2 text-left font-semibold">{titulo}</th>
            {MESES.map((m) => <th key={m} className="px-3 py-2 text-right font-semibold">{m}</th>)}
            <th className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            if (l.tipo === "margem")
              return (
                <tr key={l.id} className="border-t text-slate-500">
                  <td className="sticky left-0 bg-white px-3 py-2">{l.rotulo}</td>
                  {l.valores.map((v, i) => <td key={i} className="px-3 py-2 text-right tabular-nums">{pct(v)}</td>)}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{pct(l.total)}</td>
                </tr>
              );
            const sub = l.tipo === "subtotal";
            const temCats = l.categorias?.length > 0;
            const aberta = abertas.has(l.id);
            return [
              <tr key={l.id} className={`border-t ${sub ? "bg-slate-50" : ""}`}>
                <td className={`sticky left-0 px-3 py-2 ${sub ? "bg-slate-50 font-bold text-slate-900" : "bg-white text-slate-800"}`}>
                  {temCats ? (
                    <button type="button" className="flex items-center gap-1 text-left" onClick={() => alternar(l.id)} aria-expanded={aberta}>
                      {aberta ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                      {l.rotulo}
                    </button>
                  ) : <span className={sub ? "" : "pl-5"}>{l.rotulo}</span>}
                </td>
                {l.valores.map((v, i) => <Celula key={i} valor={v} forte={sub} onClick={sub ? null : () => abrirCelula(l, i)} />)}
                <Celula valor={l.total} forte onClick={sub ? null : () => abrirCelula(l, null)} />
              </tr>,
              ...(aberta ? l.categorias.map((c) => (
                <tr key={`${l.id}:${c.nome}`} className="border-t border-dashed text-slate-600">
                  <td className="sticky left-0 bg-white py-1.5 pl-10 pr-3 text-xs">{c.nome}</td>
                  {c.valores.map((v, i) => <Celula key={i} valor={v} onClick={() => abrirCelula(l, i, c.nome)} />)}
                  <Celula valor={c.total} onClick={() => abrirCelula(l, null, c.nome)} />
                </tr>
              )) : []),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function Lancamentos({ painel, onFechar }) {
  const fechar = useRef(null);
  useEffect(() => {
    fechar.current?.focus();
    const tecla = (e) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);
  const total = painel.itens.reduce((s, x) => s + Math.round(x.valor * 100), 0) / 100;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25" onClick={onFechar}>
      <aside role="dialog" aria-modal="true" aria-labelledby="dre-lanc-titulo" className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">{painel.periodo}</p>
            <h2 id="dre-lanc-titulo" className="mt-1 text-lg font-bold">{painel.titulo}</h2>
            <p className="mt-1 text-sm text-slate-600">{painel.itens.length} lançamento(s) · {valorTexto(total)}</p>
          </div>
          <button ref={fechar} type="button" aria-label="Fechar lançamentos" className="rounded-lg p-2 hover:bg-slate-100" onClick={onFechar}><X size={20} aria-hidden="true" /></button>
        </div>
        <ul className="mt-4 divide-y rounded-xl border text-sm">
          {[...painel.itens].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)).map((x, k) => (
            <li key={`${x.id}-${k}`} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block font-medium text-slate-800">{x.nome || "Sem nome"}</span>
                <span className="block text-xs text-slate-500">{x.tipo === "REC" ? "Recebimento" : "Despesa"}{x.nf ? ` · NF ${x.nf}` : ""} · {x.categoria}</span>
              </span>
              <b className={`shrink-0 tabular-nums ${x.valor < 0 ? "text-red-700" : "text-slate-900"}`}>{valorTexto(x.valor)}</b>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export default function Dre() {
  const anoAtual = Number(hojeSaoPaulo().slice(0, 4));
  const [copia, setCopia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [ano, setAno] = useState(anoAtual);
  const [regime, setRegime] = useState("competencia");
  const [abertas, setAbertas] = useState(() => new Set());
  const [painel, setPainel] = useState(null);
  const pedido = useRef(0);

  const carregar = useCallback(async (atualizar = false) => {
    const id = ++pedido.current;
    setLoading(true);
    setErro("");
    try {
      const c = await carregarCopiaFinanceira({ atualizar });
      if (id === pedido.current) setCopia(c);
    } catch (e) {
      if (id === pedido.current) setErro(e.message || "Não foi possível carregar o financeiro.");
    } finally {
      if (id === pedido.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    carregar();
    const p = pedido;
    return () => { p.current++; };
  }, [carregar]);
  const fecharPainel = useCallback(() => setPainel(null), []);

  const empresas = useMemo(() => (copia?.opcoes?.empresas || []).filter((e) => e.ativa !== false), [copia]);
  const semAcesso = ["recebimentosListar", "despesasListar"].some((n) => copia?.listas?.[n]?.semAcesso);
  const anos = useMemo(() => {
    const s = new Set([anoAtual]);
    for (const n of ["recebimentosListar", "despesasListar"])
      for (const t of copia?.listas?.[n]?.itens || []) {
        const a = Number(String(t.data_vencimento || "").slice(0, 4));
        if (a > 2000 && a <= anoAtual + 1) s.add(a);
      }
    return [...s].sort((a, b) => b - a);
  }, [copia, anoAtual]);
  const dre = useMemo(() => {
    if (!copia) return null;
    return montarDre({
      receber: copia.listas?.recebimentosListar?.itens || [],
      pagar: copia.listas?.despesasListar?.itens || [],
      notas: copia.listas?.notasListar?.itens || [],
      categorias: copia.opcoes?.categorias || [],
      empresas,
      empresaId,
      ano,
      regime,
    });
  }, [copia, empresas, empresaId, ano, regime]);

  const linha = (id) => dre?.linhas.find((l) => l.id === id);
  const nomeEmpresa = empresaId ? empresas.find((e) => e.id === empresaId)?.nome || "Empresa" : "Consolidado";
  const alternar = (id) => setAbertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const abrirCelula = (l, mes, categoria = null) =>
    setPainel({
      titulo: categoria ? `${l.rotulo.replace(/^[(=−)\s]+/, "")} · ${categoria}` : l.rotulo.replace(/^[(=−)\s]+/, ""),
      periodo: `${mes === null ? `Ano ${ano}` : `${MESES[mes]}/${ano}`} · ${regime === "caixa" ? "caixa" : "competência"} · ${nomeEmpresa}`,
      itens: lancamentosDaCelula(dre, l.id, mes, categoria),
    });

  function exportar() {
    const colunas = [{ chave: "linha", rotulo: "Linha" }, ...MESES.map((m, i) => ({ chave: `m${i}`, rotulo: m, tipo: "dinheiro" })), { chave: "total", rotulo: "Total", tipo: "dinheiro" }];
    const linhas = [];
    const empurrar = (rotulo, valores, total) => linhas.push({ linha: rotulo, ...Object.fromEntries(valores.map((v, i) => [`m${i}`, v])), total });
    for (const l of dre.linhas) {
      if (l.tipo === "margem") continue;
      empurrar(l.rotulo, l.valores, l.total);
      for (const c of l.categorias || []) empurrar(`    ${c.nome}`, c.valores, c.total);
    }
    if (dre.fora.length) {
      linhas.push({ linha: "Fora do resultado" });
      for (const l of dre.fora) {
        empurrar(l.rotulo, l.valores, l.total);
        for (const c of l.categorias) empurrar(`    ${c.nome}`, c.valores, c.total);
      }
    }
    baixarPlanilha({ nome: `dre-${nomeEmpresa}-${ano}-${regime}`, titulo: `DRE ${ano} · ${nomeEmpresa} · ${regime === "caixa" ? "caixa" : "competência"}`, colunas, linhas });
  }

  const rl = linha("receitaLiquida"), res = linha("resultado"), mg = linha("margem"), sem = linha("semCategoria");
  return (
    <div className="space-y-5">
      <PageTitle
        titulo="DRE"
        descricao="Demonstrativo de resultado por mês, pelo plano de contas. Clique numa linha para ver as categorias e num valor para ver os lançamentos."
        acao={
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={() => carregar(true)} disabled={loading}>
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              {loading ? "Atualizando..." : "Atualizar dados"}
            </button>
            <button type="button" className="btn-outline" onClick={exportar} disabled={!dre}>
              <Download size={15} aria-hidden="true" />
              Exportar planilha
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <label className="min-w-[200px]">
          <span className="label">Empresa</span>
          <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            <option value="">Consolidado</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
        <label className="w-28">
          <span className="label">Ano</span>
          <select className="input" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <div>
          <span className="label">Regime</span>
          <div className="inline-flex overflow-hidden rounded-xl border" role="group" aria-label="Regime">
            {[["competencia", "Competência"], ["caixa", "Caixa"]].map(([v, r]) => (
              <button key={v} type="button" aria-pressed={regime === v} onClick={() => setRegime(v)} className={`px-4 py-2 text-sm ${regime === v ? "bg-slate-900 font-semibold text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>{r}</button>
            ))}
          </div>
        </div>
        <p className="min-w-[240px] flex-1 text-xs text-slate-500">
          {regime === "caixa"
            ? "Caixa: pela data em que o dinheiro entrou ou saiu (baixas e conciliações)."
            : "Competência: receita no mês de emissão da NF; despesa no mês do lançamento."}
        </p>
      </div>

      {erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{erro}</div>}
      {semAcesso && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" role="alert">Contas a receber ou a pagar não estão liberadas para você (tela Acessos): o DRE fica incompleto.</div>}
      {!dre && loading && <p className="p-8 text-center text-sm text-slate-500">Carregando o financeiro…</p>}

      {dre && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Receita líquida {ano}</p><p className="mt-1 text-2xl font-bold">{moeda(rl.total)}</p></div>
            <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Resultado operacional {ano}</p><p className={`mt-1 text-2xl font-bold ${res.total < 0 ? "text-red-700" : "text-emerald-700"}`}>{valorTexto(res.total)}</p></div>
            <div className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Margem {ano}</p><p className="mt-1 text-2xl font-bold">{pct(mg.total)}</p></div>
          </div>

          {(dre.aproximados > 0 || Math.abs(sem.total) > 0.005 || dre.eliminado.receita + dre.eliminado.despesa > 0.005) && (
            <ul className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {regime === "competencia" && dre.aproximados > 0 && <li>{dre.aproximados} recebimento(s) sem NF nem data de emissão: entraram pelo mês do vencimento.</li>}
              {Math.abs(sem.total) > 0.005 && <li>{valorTexto(sem.total)} em lançamentos sem categoria do plano de contas: estão no resultado, na linha “Sem categoria”. Classifique-os em Receber/Pagar.</li>}
              {dre.eliminado.receita + dre.eliminado.despesa > 0.005 && <li>Consolidado sem as operações entre as empresas: {moeda(dre.eliminado.receita)} de receita e {moeda(dre.eliminado.despesa)} de despesa tirados (o que uma empresa fatura para a outra).</li>}
            </ul>
          )}

          <TabelaDre titulo={`${nomeEmpresa} · ${ano}`} linhas={dre.linhas} abertas={abertas} alternar={alternar} abrirCelula={abrirCelula} />

          {dre.fora.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-bold text-slate-900">Fora do resultado</h2>
              <p className="text-sm text-slate-500">Investimentos, sócios, empréstimos e transferências: mexem no caixa, mas não são lucro nem prejuízo.</p>
              <TabelaDre titulo="Movimentação" linhas={dre.fora.map((l) => ({ ...l, tipo: "valor" }))} abertas={abertas} alternar={alternar} abrirCelula={abrirCelula} />
            </section>
          )}
        </>
      )}
      {painel && <Lancamentos painel={painel} onFechar={fecharPainel} />}
    </div>
  );
}
