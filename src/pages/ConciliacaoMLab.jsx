// Conciliação manual da M Lab: só os movimentos do banco que ainda faltam, cada um com os títulos mais prováveis
// já sugeridos (NF na descrição, valor, nome). A pessoa confere e confirma; nada é conciliado sozinho.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Link2, RefreshCw, Sparkles } from "lucide-react";
import { PageTitle } from "../components/ui.jsx";
import { financeiroOpcoes, finDespesasListar, finMovimentosListar, finRecebimentosListar } from "../services/financeiro.js";
import { finConciliarAjustado } from "../services/conciliacaoAjustes.js";
import { invalidarCopiaFinanceira } from "../services/financeiroCache.js";
import { restanteMovimento, sugerirLotes, sugerirTodos } from "../lib/conciliacaoSugestao.js";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v) => {
  const p = String(v || "").slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : "—";
};
const arred = (n) => Math.round(Number(n || 0) * 100) / 100;
const ehMLab = (e) => String(e?.nome || "").toLowerCase().replace(/[^a-z]/g, "").startsWith("mlab");
const nomeTitulo = (t) => t?.cliente ?? t?.fornecedor ?? "Sem nome";

export default function ConciliacaoMLab() {
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState(null);
  const [movimentos, setMovimentos] = useState([]);
  const [receber, setReceber] = useState([]);
  const [pagar, setPagar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | exatas | sem
  const [ajusteEscolhido, setAjusteEscolhido] = useState({}); // movimentoId -> "juros" | "multa"

  const carregar = useCallback(async (atualizar = false) => {
    setLoading(true);
    setErro("");
    try {
      if (atualizar) invalidarCopiaFinanceira();
      const op = await financeiroOpcoes();
      const mlab = (op?.empresas || []).find(ehMLab);
      if (!mlab) throw new Error("Empresa M Lab não encontrada no cadastro.");
      setEmpresa(mlab);
      const [m, r, d] = await Promise.all([finMovimentosListar(mlab.id), finRecebimentosListar(mlab.id), finDespesasListar(mlab.id)]);
      setMovimentos(m);
      setReceber(r);
      setPagar(d);
    } catch (e) {
      setErro(e.message || "Não foi possível carregar a conciliação.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const pendentes = useMemo(
    () => movimentos.filter((m) => !m.conciliado && Math.abs(Number(m.valor || 0)) > 0.005).sort((a, b) => String(a.data_movimento).localeCompare(String(b.data_movimento))),
    [movimentos],
  );
  const linhas = useMemo(() => {
    const todas = sugerirTodos(pendentes, receber, pagar);
    return pendentes.map((m) => ({ m, sugestoes: todas.get(m.id) || [] }));
  }, [pendentes, receber, pagar]);
  const lotes = useMemo(() => [...sugerirLotes(pendentes, receber, "CREDITO"), ...sugerirLotes(pendentes, pagar, "DEBITO")], [pendentes, receber, pagar]);
  const idsEmLote = useMemo(() => new Set(lotes.flatMap((l) => l.movimentos.map((x) => x.id))), [lotes]);

  const visiveis = linhas.filter(({ m, sugestoes }) => {
    if (filtro === "exatas") return sugestoes[0]?.exato;
    if (filtro === "sem") return !sugestoes.length && !idsEmLote.has(m.id);
    return true;
  });
  const totalPendente = pendentes.reduce((s, m) => s + restanteMovimento(m), 0);
  const comSugestao = linhas.filter((l) => l.sugestoes.length).length;

  async function gravar(chave, passos, texto) {
    if (salvando) return;
    if (!window.confirm(texto)) return;
    setSalvando(chave);
    setErro("");
    setAviso("");
    try {
      for (const p of passos) await finConciliarAjustado(p);
      setAviso("Conciliação gravada.");
      await carregar(true);
    } catch (e) {
      setErro(e.message);
      await carregar(true);
    } finally {
      setSalvando("");
    }
  }

  function conciliarSugestao(m, s) {
    const debito = m.tipo === "DEBITO";
    const restMov = restanteMovimento(m);
    const dif = arred(restMov - s.restante);
    const tipoAjuste = ajusteEscolhido[m.id] || "juros";
    const payload = {
      movimentoId: m.id,
      recebimentoId: debito ? null : s.titulo.id,
      despesaId: debito ? s.titulo.id : null,
      valorTitulo: s.restante,
      valorMovimento: restMov,
      desconto: dif < 0 ? -dif : 0,
      juros: dif > 0 && tipoAjuste === "juros" ? dif : 0,
      multa: dif > 0 && tipoAjuste === "multa" ? dif : 0,
      ajuste: 0,
      dataLiquidacao: String(m.data_movimento).slice(0, 10),
      observacao: "Conciliação sugerida (M Lab)",
    };
    const extra = dif > 0.005 ? ` com ${moeda(dif)} de ${tipoAjuste}` : dif < -0.005 ? ` com ${moeda(-dif)} de desconto` : "";
    return gravar(
      m.id,
      [payload],
      `Conciliar ${moeda(restMov)} do banco (${dataBR(m.data_movimento)}) com a NF ${s.titulo.numero_nf || s.titulo.documento || "s/n"} de ${nomeTitulo(s.titulo)}${extra}?`,
    );
  }

  function conciliarLote(l) {
    const debito = l.movimentos[0].tipo === "DEBITO";
    const passos = l.movimentos.map((m) => {
      const v = restanteMovimento(m);
      return {
        movimentoId: m.id, recebimentoId: debito ? null : l.titulo.id, despesaId: debito ? l.titulo.id : null,
        valorTitulo: v, valorMovimento: v, desconto: 0, juros: 0, multa: 0, ajuste: 0,
        dataLiquidacao: String(m.data_movimento).slice(0, 10), observacao: "Conciliação em lote sugerida (M Lab)",
      };
    });
    return gravar(
      `lote-${l.titulo.id}`,
      passos,
      `Conciliar os ${l.movimentos.length} movimentos (${l.movimentos.map((m) => moeda(restanteMovimento(m))).join(" + ")}) com a NF ${l.titulo.numero_nf || "s/n"} de ${nomeTitulo(l.titulo)}?`,
    );
  }

  function abrirTelaCompleta(m) {
    const tipo = m.tipo === "CREDITO" ? "RECEBIMENTO" : "DESPESA";
    navigate(`/financas/conciliacao?tipo=${tipo}&empresaId=${encodeURIComponent(m.empresa_id || empresa?.id || "")}&movimentoId=${encodeURIComponent(m.id)}&voltar=${encodeURIComponent("/financas/conciliacao-mlab")}`);
  }

  return (
    <div className="space-y-5">
      <PageTitle titulo="Conciliar M Lab" descricao="O que ainda falta conciliar no banco da M Lab, com o título provável já sugerido. Você confere e confirma." />

      {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {aviso && <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={16} />{aviso}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Movimentos pendentes</p><p className="mt-1 text-2xl font-bold">{loading ? "…" : pendentes.length}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Valor a conciliar</p><p className="mt-1 text-2xl font-bold">{loading ? "…" : moeda(totalPendente)}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Com título sugerido</p><p className="mt-1 text-2xl font-bold">{loading ? "…" : `${comSugestao + idsEmLote.size} de ${pendentes.length}`}</p></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar pendências">
          {[["todos", "Todos"], ["exatas", "Sugestão exata"], ["sem", "Sem sugestão"]].map(([v, r]) => (
            <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${filtro === v ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{r}</button>
          ))}
        </div>
        <button type="button" className="btn-outline" disabled={loading} onClick={() => carregar(true)}><RefreshCw size={15} />{loading ? "Atualizando…" : "Atualizar"}</button>
      </div>

      {lotes.length > 0 && filtro !== "sem" && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4" aria-label="Sugestões em lote">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-sky-900"><Sparkles size={16} />Mais de um movimento fecha o mesmo título</h2>
          <div className="space-y-2">
            {lotes.map((l) => (
              <div key={l.titulo.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <b>NF {l.titulo.numero_nf || "s/n"} · {nomeTitulo(l.titulo)} · {moeda(l.valor)}</b>
                  <p className="text-slate-600">{l.movimentos.map((m) => `${dataBR(m.data_movimento)} ${moeda(restanteMovimento(m))}`).join("  +  ")}</p>
                </div>
                <button type="button" className="btn-primary shrink-0" disabled={!!salvando} onClick={() => conciliarLote(l)}>{salvando === `lote-${l.titulo.id}` ? "Conciliando…" : "Conciliar os dois"}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3" aria-label="Movimentos pendentes">
        {loading ? <p className="rounded-2xl border bg-white p-8 text-center text-slate-500">Carregando…</p>
          : !visiveis.length ? <p className="rounded-2xl border bg-white p-8 text-center text-slate-500">{pendentes.length ? "Nenhum movimento neste filtro." : "Tudo conciliado na M Lab. 🎉"}</p>
          : visiveis.map(({ m, sugestoes }) => {
            const restMov = restanteMovimento(m);
            const parcial = restMov < Math.abs(Number(m.valor)) - 0.005;
            const [melhor, ...outras] = sugestoes;
            const dif = melhor ? arred(restMov - melhor.restante) : 0;
            return (
              <article key={m.id} className="rounded-2xl border bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase text-slate-500">{dataBR(m.data_movimento)} · {m.tipo === "CREDITO" ? "Entrada" : "Saída"}</p>
                    <p className="mt-0.5 break-words font-semibold text-slate-900">{m.descricao || "Sem descrição"}</p>
                    <p className="mt-0.5 text-lg font-bold">{moeda(Math.abs(Number(m.valor)))}{parcial && <span className="ml-2 text-sm font-medium text-amber-700">já conciliado {moeda(Math.abs(Number(m.valor)) - restMov)} · falta {moeda(restMov)}</span>}</p>
                  </div>
                  <div className="min-w-0 lg:w-[58%]">
                    {melhor ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                        <p className="text-sm"><b>NF {melhor.titulo.numero_nf || melhor.titulo.documento || "s/n"} · {nomeTitulo(melhor.titulo)}</b> · {moeda(melhor.restante)} · vence {dataBR(melhor.titulo.data_vencimento)}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{melhor.motivos.join(" · ")}</p>
                        {Math.abs(dif) > 0.005 && (
                          <p className="mt-1 text-sm text-amber-800">
                            {dif > 0 ? <>O banco veio <b>{moeda(dif)}</b> acima. Registrar como{" "}
                              <select aria-label="Tipo do acréscimo" className="select inline-block w-auto py-0.5" value={ajusteEscolhido[m.id] || "juros"} onChange={(e) => setAjusteEscolhido((a) => ({ ...a, [m.id]: e.target.value }))}><option value="juros">juros</option><option value="multa">multa</option></select>.</>
                              : <>O banco veio <b>{moeda(-dif)}</b> abaixo. Será registrado como desconto.</>}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" className="btn-primary" disabled={!!salvando} onClick={() => conciliarSugestao(m, melhor)}>{salvando === m.id ? "Conciliando…" : melhor.exato ? "Conciliar" : "Conciliar com ajuste"}</button>
                          <button type="button" className="btn-outline" disabled={!!salvando} onClick={() => abrirTelaCompleta(m)}><Link2 size={14} />Escolher outro título</button>
                        </div>
                        {outras.length > 0 && (
                          <details className="mt-2 text-sm">
                            <summary className="cursor-pointer text-slate-600">Outras opções ({outras.length})</summary>
                            <ul className="mt-1 space-y-1">
                              {outras.map((s) => (
                                <li key={s.titulo.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2">
                                  <span>NF {s.titulo.numero_nf || "s/n"} · {nomeTitulo(s.titulo)} · {moeda(s.restante)} <span className="text-xs text-slate-500">({s.motivos.join(", ")})</span></span>
                                  <button type="button" className="btn-outline" disabled={!!salvando} onClick={() => conciliarSugestao(m, s)}>Conciliar</button>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed p-3 text-sm text-slate-600">
                        {idsEmLote.has(m.id) ? "Faz parte de uma sugestão em lote (acima)." : "Nenhum título parecido encontrado."}
                        <div className="mt-2"><button type="button" className="btn-outline" disabled={!!salvando} onClick={() => abrirTelaCompleta(m)}><Link2 size={14} />Escolher título</button></div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
      </section>
    </div>
  );
}
