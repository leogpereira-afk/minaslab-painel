// Conciliação manual da M Lab: só os movimentos do banco que ainda faltam, cada um com os títulos mais prováveis
// já sugeridos (NF na descrição, valor, nome). A pessoa confere e confirma; nada é conciliado sozinho.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Link2, ReceiptText, RefreshCw, Sparkles } from "lucide-react";
import { PageTitle } from "../components/ui.jsx";
import { financeiroOpcoes, finDespesasListar, finMovimentosListar, finRecebimentosListar } from "../services/financeiro.js";
import { finComplementarDiferenca, finConciliarAjustado } from "../services/conciliacaoAjustes.js";
import { invalidarCopiaFinanceira } from "../services/financeiroCache.js";
import { repassesPorMes, restanteMovimento, sugerirLotes, sugerirTodos } from "../lib/conciliacaoSugestao.js";
import { depositosBoletoSemC6, sugerirBoletosC6 } from "../lib/conciliacaoBoletosC6.js";

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
  // Repasses da MinasLab (Pix) que ainda não fecham nenhuma NF: no fim do mês você emite a NFS-e com o total.
  const repasses = useMemo(() => repassesPorMes(pendentes.filter((m) => !idsEmLote.has(m.id)), "minaslab"), [pendentes, idsEmLote]);
  const idsRepasse = useMemo(() => new Set(repasses.flatMap((r) => r.movimentos.map((m) => m.id))), [repasses]);
  // Depósitos de boleto que o relatório do C6 (Receber → Importar C6) explica nota por nota, já com os juros.
  // Ficam num bloco próprio, acima, e saem da lista de baixo para não aparecerem com sugestões por valor.
  const boletosC6 = useMemo(() => sugerirBoletosC6(pendentes.filter((m) => !idsEmLote.has(m.id)), receber), [pendentes, idsEmLote, receber]);
  const semRelatorioC6 = useMemo(() => depositosBoletoSemC6(pendentes, boletosC6), [pendentes, boletosC6]);

  const visiveis = linhas.filter(({ m, sugestoes }) => {
    if (boletosC6.has(m.id)) return false;
    if (filtro === "exatas") return sugestoes[0]?.exato;
    if (filtro === "sem") return !sugestoes.length && !idsEmLote.has(m.id);
    return true;
  });
  const totalPendente = pendentes.reduce((s, m) => s + restanteMovimento(m), 0);
  const comSugestao = linhas.filter(({ m, sugestoes }) => sugestoes.length || idsEmLote.has(m.id) || boletosC6.has(m.id)).length;

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

  // Movimento já conciliado em parte (banco acima do título): a sobra é juros ou multa da conciliação que já existe.
  function registrarSobra(m) {
    const restMov = restanteMovimento(m);
    const tipo = ajusteEscolhido[m.id] || "juros";
    return (async () => {
      if (salvando) return;
      if (!window.confirm(`Registrar ${moeda(restMov)} como ${tipo} na conciliação já feita deste movimento (${dataBR(m.data_movimento)})? O movimento passa a ficar conciliado.`)) return;
      setSalvando(`sobra-${m.id}`);
      setErro("");
      setAviso("");
      try {
        await finComplementarDiferenca({ movimentoId: m.id, tipoAjuste: tipo });
        setAviso(`${moeda(restMov)} registrados como ${tipo}.`);
      } catch (e) {
        setErro(e.message);
      } finally {
        setSalvando("");
        await carregar(true);
      }
    })();
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

  const nomeMes = (aaaamm) => {
    const [a, m] = aaaamm.split("-");
    return `${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(m) - 1]}/${a}`;
  };
  function emitirNotaDoMes(r) {
    navigate("/financas/notas-fiscais/emitir", { state: { notaMes: { clienteNome: "MINASLAB LTDA", valor: r.total, descricao: `Serviços prestados em ${nomeMes(r.mes)}`, referencia: `Repasses recebidos em ${nomeMes(r.mes)}: ${r.movimentos.map((m) => `${dataBR(m.data_movimento)} ${moeda(restanteMovimento(m))}`).join("; ")}` } } });
  }

  // Um passo por nota: o banco recebeu o valor liquidado do boleto; a diferença para o saldo da nota é
  // juros/multa do boleto (ou desconto, se o C6 liquidou a menos).
  function passosBoletoC6(m, s) {
    return s.itens.map((b) => ({
      movimentoId: m.id,
      recebimentoId: b.titulo.id,
      despesaId: null,
      valorTitulo: b.restante,
      valorMovimento: b.liquidacao,
      desconto: b.juros < 0 ? arred(-b.juros) : 0,
      juros: b.juros > 0 ? arred(b.juros) : 0,
      multa: 0,
      ajuste: 0,
      dataLiquidacao: String(m.data_movimento).slice(0, 10),
      observacao: `Boleto C6 creditado em ${dataBR(m.data_movimento)} (relatório de boletos)`,
    }));
  }
  const notasBoleto = (s) => s.itens.map((b) => `NF ${b.titulo.numero_nf || "s/n"} (${nomeTitulo(b.titulo)})`).join(", ");
  const jurosBoleto = (s) => arred(s.itens.reduce((t, b) => t + Math.max(0, b.juros), 0));
  function conciliarBoletoC6(m, s) {
    const j = jurosBoleto(s);
    return gravar(
      `c6-${m.id}`,
      passosBoletoC6(m, s),
      `Conciliar o depósito de ${moeda(restanteMovimento(m))} (${dataBR(m.data_movimento)}) com ${s.itens.length === 1 ? "o boleto" : `os ${s.itens.length} boletos`} do relatório C6: ${notasBoleto(s)}${j > 0.005 ? `, com ${moeda(j)} de juros/multa` : ""}?`,
    );
  }
  function conciliarTodosBoletosC6() {
    const lista = pendentes.filter((m) => boletosC6.has(m.id));
    const passos = lista.flatMap((m) => passosBoletoC6(m, boletosC6.get(m.id)));
    return gravar(
      "c6-todos",
      passos,
      `Conciliar os ${lista.length} depósitos de boleto (${moeda(lista.reduce((t, m) => t + restanteMovimento(m), 0))}) com as ${passos.length} notas indicadas pelo relatório C6?`,
    );
  }

  function abrirTelaCompleta(m) {
    const tipo = m.tipo === "CREDITO" ? "RECEBIMENTO" : "DESPESA";
    navigate(`/financas/conciliacao?tipo=${tipo}&empresaId=${encodeURIComponent(m.empresa_id || empresa?.id || "")}&movimentoId=${encodeURIComponent(m.id)}&voltar=${encodeURIComponent("/financas/conciliacao-mlab")}`);
  }

  return (
    <div className="space-y-5">
      <PageTitle titulo="Conciliar" descricao="O que ainda falta conciliar no banco da M Lab, com o título provável já sugerido. Você confere e confirma." />

      {erro && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {aviso && <div role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={16} />{aviso}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Movimentos pendentes</p><p className="mt-1 text-2xl font-bold">{loading ? "…" : pendentes.length}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Valor a conciliar</p><p className="mt-1 text-2xl font-bold">{loading ? "…" : moeda(totalPendente)}</p></div>
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs uppercase text-slate-500">Com título sugerido</p><p className="mt-1 text-2xl font-bold">{loading ? "…" : `${comSugestao} de ${pendentes.length}`}</p></div>
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

      {boletosC6.size > 0 && filtro !== "sem" && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-label="Depósitos de boletos (relatório C6)">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold text-emerald-900">
              <ReceiptText size={16} aria-hidden="true" />
              Depósitos de boleto explicados pelo relatório do C6
            </h2>
            {boletosC6.size > 1 && (
              <button type="button" className="btn-primary" disabled={!!salvando} onClick={conciliarTodosBoletosC6}>
                {salvando === "c6-todos" ? "Conciliando…" : `Conciliar os ${boletosC6.size}`}
              </button>
            )}
          </div>
          <p className="mb-2 text-sm text-emerald-900/80">O C6 informou quais boletos entraram em cada depósito. A soma fecha o valor do banco no centavo; a diferença de cada nota é juros/multa do boleto.</p>
          <div className="space-y-2">
            {pendentes.filter((m) => boletosC6.has(m.id)).map((m) => {
              const s = boletosC6.get(m.id);
              return (
                <div key={m.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <b>{dataBR(m.data_movimento)} · {moeda(restanteMovimento(m))}</b> <span className="text-slate-500">{m.descricao}</span>
                    <ul className="mt-1 space-y-0.5 text-slate-700">
                      {s.itens.map((b) => (
                        <li key={b.titulo.id}>
                          NF {b.titulo.numero_nf || "s/n"} · {nomeTitulo(b.titulo)} · {moeda(b.restante)}
                          {b.juros > 0.005 && <span className="text-emerald-700"> + {moeda(b.juros)} juros/multa</span>}
                          {b.juros < -0.005 && <span className="text-amber-700"> − {moeda(-b.juros)} desconto</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button type="button" className="btn-primary shrink-0" disabled={!!salvando} onClick={() => conciliarBoletoC6(m, s)}>
                    {salvando === `c6-${m.id}` ? "Conciliando…" : "Conciliar"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {semRelatorioC6.length > 0 && filtro !== "exatas" && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" aria-label="Relatório de boletos do C6">
          <p>
            <b>{semRelatorioC6.length === 1 ? "1 depósito de boleto" : `${semRelatorioC6.length} depósitos de boleto`}</b> sem o relatório do C6 que diga quais notas entraram
            ({semRelatorioC6.map((m) => `${dataBR(m.data_movimento)} ${moeda(restanteMovimento(m))}`).join(" · ")}). Baixe o relatório de boletos no C6 e importe em Receber → Importar C6: esta tela passa a mostrar as notas exatas.
          </p>
          <button type="button" className="btn-outline mt-2" onClick={() => navigate("/financas/contas-a-receber")}>Abrir Receber</button>
        </section>
      )}

      {repasses.length > 0 && filtro !== "sem" && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-label="Repasses da MinasLab">
          <h2 className="font-bold text-amber-900">Repasses da MinasLab aguardando a NF do mês</h2>
          <p className="mb-2 text-sm text-amber-900/80">Pix recebidos da MinasLab que ainda não têm NF. Emita a NFS-e com o total do mês; depois dela criada, esta tela oferece conciliar todos de uma vez.</p>
          <div className="space-y-2">
            {repasses.map((r) => (
              <div key={r.mes} className="flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <b className="capitalize">{nomeMes(r.mes)}</b> · {r.movimentos.length} {r.movimentos.length === 1 ? "repasse" : "repasses"} · total <b>{moeda(r.total)}</b>
                  <p className="text-slate-600">{r.movimentos.map((m) => `${dataBR(m.data_movimento)} ${moeda(restanteMovimento(m))}`).join("  ·  ")}</p>
                </div>
                <button type="button" className="btn-primary shrink-0" onClick={() => emitirNotaDoMes(r)}>Emitir NFS-e de {moeda(r.total)}</button>
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
                    {parcial && restMov <= (Math.abs(Number(m.valor)) - restMov) * 0.2 && (
                      <div className="mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="group" aria-label="Sobra de valor">
                        Sobraram <b>{moeda(restMov)}</b> depois da conciliação já feita. Se for juros ou multa, registre aqui, na conciliação existente:
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select aria-label="Tipo da sobra" className="select w-auto py-1" value={ajusteEscolhido[m.id] || "juros"} onChange={(e) => setAjusteEscolhido((a) => ({ ...a, [m.id]: e.target.value }))}><option value="juros">juros</option><option value="multa">multa</option></select>
                          <button type="button" className="btn-primary" disabled={!!salvando} onClick={() => registrarSobra(m)}>{salvando === `sobra-${m.id}` ? "Registrando…" : `Registrar ${moeda(restMov)}`}</button>
                        </div>
                      </div>
                    )}
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
                        {idsEmLote.has(m.id) ? "Faz parte de uma sugestão em lote (acima)." : idsRepasse.has(m.id) ? "Repasse da MinasLab: aguardando a NF do mês (acima)." : "Nenhum título parecido encontrado."}
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
