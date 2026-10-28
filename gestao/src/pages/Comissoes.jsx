// Comissões: extrato por PROPOSTA de cada colaborador. Lê o CRM (propostas)
// e Serviços gerados (OS) pelo ml-comercial; cadastro, planilha antiga e
// pagamentos ficam na coleção rh_comercial_comissoes.
// Regra e cálculo: src/lib/comissoesProposta.js.
import { Fragment, useMemo, useState } from "react";
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Kpi, Cabecalho, Abas, Modal, Paginacao, usePaginacao } from "../components/ui.jsx";
import { comissoesCRM } from "../services/crm.js";
import { brl, dataCurta, hojeBR, mesLongo, mesAtual, nomeProprio } from "../lib/format.js";
import { validarColaborador, taxaAtual, centavos } from "../lib/comissoes.js";
import {
  donosDasPropostas, pagosPorProposta, extratoColaborador, linhasPlanilha, geradaNoMes, itensPagamentoPropostas, csvExtrato,
  osDoExtrato, serieMensal, statusProposta, colaboradoresComAutomaticos, DESDE_PADRAO, STATUS_PROPOSTA, mesDoPagamentoItem, conferencia, TIPOS_CONFERENCIA,
} from "../lib/comissoesProposta.js";
import { lerXlsx } from "../lib/xlsxLeve.js";
import { lerLinhasPlanilha, planoImportacao } from "../lib/comissoesPlanilha.js";

const pctTxt = (p) => `${String(Number(p || 0)).replace(".", ",")}%`;
const nomeCurto = (n) => { const p = nomeProprio(n).split(" ").filter(Boolean); return p.length > 1 ? `${p[0]} ${p.at(-1)}` : p[0] || ""; };
const D = { textAlign: "right" };

function baixar(nome, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Comissoes() {
  const { dados, gravar, remover } = useBase();
  const [aba, setAba] = useState("resumo");
  const [editando, setEditando] = useState(null);
  const [vendo, setVendo] = useState(null);
  const [importando, setImportando] = useState(false);
  const [quem, setQuem] = useState("");

  const registros = dados.comissoes || [];
  const gravados = useMemo(() => registros.filter((r) => r.tipo === "colaborador"), [registros]);
  const pagamentos = useMemo(() => registros.filter((r) => r.tipo === "pagamento").sort((a, b) => String(b.pagoEm).localeCompare(String(a.pagoEm)) || String(b.criadoEm).localeCompare(String(a.criadoEm))), [registros]);
  // 1º: a lista de responsáveis do CRM; 2º: as propostas aprovadas de todos eles + as da planilha.
  const lista = useCRM("comissoes-pessoas", () => comissoesCRM([], []));
  const ids = (lista.dados?.pessoas || []).map((p) => p.id).sort();
  const numeros = useMemo(() => [...new Set(registros.filter((r) => r.tipo === "planilha").flatMap((r) => (r.linhas || []).map((l) => l.proposta)))].sort(), [registros]);
  const crmDados = useCRM(`comissoes:${ids.join(",")}:${numeros.length}`, () => (ids.length ? comissoesCRM(ids, numeros) : Promise.resolve(null)));
  const crm = lista.dados ? crmDados : lista;
  const pessoasCRM = crm.dados?.pessoas || lista.dados?.pessoas || [];
  const colabs = useMemo(() => {
    const todos = colaboradoresComAutomaticos(gravados, pessoasCRM, crm.dados?.propostas || []);
    // Dono de proposta da planilha sem cadastro (ex.: id auto_ de quem não tem proposta nova).
    for (const r of registros) if (r.tipo === "planilha" && !todos.some((c) => c.id === r.colaboradorId)) {
      const crmId = String(r.colaboradorId).replace(/^auto_/, "");
      todos.push({ id: r.colaboradorId, tipo: "colaborador", nome: String(r.nome || pessoasCRM.find((p) => p.id === crmId)?.nome || "Colaborador").toLocaleUpperCase("pt-BR"), crmId, desde: DESDE_PADRAO, taxas: [{ desde: DESDE_PADRAO, pct: 1 }], ativo: false, automatico: true });
    }
    return todos.sort((a, b) => (a.ativo === false) - (b.ativo === false) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }, [gravados, pessoasCRM, crm.dados, registros]);

  const contas = useMemo(() => {
    if (!crm.dados) return [];
    const osPorProposta = new Map();
    for (const o of crm.dados.os) osPorProposta.set(o.proposta, [...(osPorProposta.get(o.proposta) || []), o]);
    const base = {
      dono: donosDasPropostas(colabs, registros, crm.dados.propostas),
      propsPorNumero: new Map(crm.dados.propostas.map((p) => [p.numero, p])),
      osPorProposta, pagos: pagosPorProposta(pagamentos),
    };
    return colabs.map((c) => ({ c, ex: extratoColaborador(c, { ...base, planilha: linhasPlanilha(registros, c.id) }) }));
  }, [crm.dados, colabs, registros, pagamentos]);
  const recarregar = () => { lista.recarregar(); crmDados.recarregar(); };

  const soma = (f) => centavos(contas.reduce((s, x) => s + f(x), 0));
  const mes = mesAtual();
  const ano = mes.slice(0, 4);
  const pagoAno = centavos(pagamentos.filter((p) => String(p.pagoEm).startsWith(ano)).reduce((s, p) => s + Number(p.total || 0), 0));
  const atual = contas.find((x) => x.c.id === quem) || contas.find((x) => x.ex.totais.aPagar > 0) || contas[0];
  const nomeDe = (id) => nomeCurto(colabs.find((c) => c.id === id)?.nome || "") || "—";

  return (
    <>
      <Cabecalho sobre="Comissões" titulo="Comissões" sub={`1% de cada OS com nota emitida, das propostas aprovadas no CRM desde ${dataCurta(DESDE_PADRAO)} (por responsável comercial). OS sem nota aparece como prevista. Propostas da planilha de pagas ficam quitadas.`}>
        <button type="button" className="btn claro" onClick={recarregar}>Atualizar</button>
        <button type="button" className="btn" onClick={() => setEditando({ novo: true })}>Novo colaborador</button>
      </Cabecalho>
      {crm.erro && <div className="aviso ruim">{crm.erro}</div>}
      {crm.carregando && <div className="carregando">Lendo propostas e serviços gerados…</div>}
      {crm.dados && (
        <>
          {aba !== "resumo" && <div className="grade grade-kpi">
            <Kpi rotulo="Falta pagar" valor={brl(soma((x) => x.ex.totais.aPagar))} sub={`${contas.filter((x) => x.ex.totais.aPagar > 0).length} colaborador(es)`} />
            <Kpi rotulo={`Gerada em ${mesLongo(mes).toLowerCase()}`} valor={brl(soma((x) => geradaNoMes(x.ex, mes)))} sub="1% das notas emitidas no mês" />
            <Kpi rotulo="Vem por aí" valor={brl(soma((x) => x.ex.totais.previsao))} sub="OS prontas para faturar" />
            <Kpi rotulo={`Pago em ${ano}`} valor={brl(pagoAno)} sub="planilha e sistema" />
          </div>}
          <Abas valor={aba} aoMudar={setAba} abas={[
            ["resumo", "Resumo"],
            ["propostas", "Por colaborador"],
            ["pagamentos", "Pagamentos", pagamentos.length || ""],
            ["colaboradores", "Colaboradores", colabs.length || ""],
          ]} />
          {colabs.length === 0 && <div className="aviso marca">Nenhuma proposta aprovada no CRM desde {dataCurta(DESDE_PADRAO)} ainda.</div>}
          {aba === "resumo" && <Resumo contas={contas} pagamentos={pagamentos} />}
          {aba === "propostas" && atual && (
            <>
              <div className="pilulas" role="group" aria-label="Colaborador">
                {contas.map((x) => (
                  <button key={x.c.id} type="button" className={`pilula${x.c.id === atual.c.id ? " ativa" : ""}`} aria-pressed={x.c.id === atual.c.id} onClick={() => setQuem(x.c.id)}>
                    {nomeCurto(x.c.nome)}{x.ex.totais.aPagar > 0 ? ` · ${brl(x.ex.totais.aPagar)}` : ""}
                  </button>
                ))}
              </div>
              <Extrato key={atual.c.id} conta={atual} gravar={gravar} nomeDe={nomeDe} />
            </>
          )}
          {aba === "pagamentos" && <Pagamentos pagamentos={pagamentos} nomeDe={nomeDe} aoVer={setVendo} remover={remover} />}
          {aba === "colaboradores" && <Colaboradores contas={contas} pessoasCRM={pessoasCRM} aoEditar={setEditando} remover={remover} registros={registros} />}
        </>
      )}
      {editando && <EditarColaborador inicial={editando} pessoasCRM={pessoasCRM} aoFechar={() => setEditando(null)} gravar={gravar} remover={remover} colabs={colabs} temPagamento={(id) => registros.some((r) => (r.tipo === "pagamento" || r.tipo === "planilha") && r.colaboradorId === id)} />}
      {vendo && <VerPagamento {...vendo} aoFechar={() => setVendo(null)} />}
      {importando && <ImportarPlanilha colabs={colabs} pessoasCRM={pessoasCRM} gravar={gravar} aoFechar={() => setImportando(false)} />}
    </>
  );
}

const FILTROS = [
  ["todas", "Todas", () => true],
  ["aPagar", "Falta pagar", (l) => l.aPagar > 0],
  ["emDia", "Em dia", (l) => l.aPagar === 0 && l.adiantado === 0 && l.gerada > 0],
  ["adiantado", "Pago adiantado", (l) => l.adiantado > 0],
];
const STATUS_ORDEM = ["pendente", "andamento", "finalizada", "cancelada"];
const rotMes = (m) => (m === "sem" ? "Sem mês (planilha)" : mesLongo(m));

function Extrato({ conta, gravar, nomeDe }) {
  const { c, ex } = conta;
  const t = ex.totais;
  const [filtro, setFiltro] = useState(t.aPagar > 0 ? "aPagar" : "todas");
  const [status, setStatus] = useState("");
  const [mesPago, setMesPago] = useState("");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState("");
  const [desmarcadas, setDesmarcadas] = useState(() => new Set());
  const [pagando, setPagando] = useState(false);
  const [ver, setVer] = useState("propostas");
  const q = busca.trim().toLowerCase();
  const f = FILTROS.find((x) => x[0] === filtro)[2];
  const pagoNoMes = (l) => (mesPago ? centavos(l.pagamentos.filter((p) => mesDoPagamentoItem(p) === mesPago).reduce((s, p) => s + p.valor, 0)) : 0);
  const mesesPagos = [...new Set(ex.linhas.flatMap((l) => l.pagamentos.map(mesDoPagamentoItem)).filter(Boolean))].sort((a, b) => (a === "sem" ? 1 : b === "sem" ? -1 : b.localeCompare(a)));
  const lista = ex.linhas.filter((l) => f(l) && (!status || statusProposta(l) === status) && (!mesPago || pagoNoMes(l) !== 0) && (!q || l.numero.includes(q) || l.cliente.toLowerCase().includes(q)));
  const totalMes = mesPago ? centavos(lista.reduce((s, l) => s + pagoNoMes(l), 0)) : 0;
  const pag = usePaginacao(lista, 20, `${filtro}|${status}|${mesPago}|${q}`);
  const pagaveis = ex.linhas.filter((l) => l.aPagar > 0 && !desmarcadas.has(l.numero));
  const totalSel = centavos(pagaveis.reduce((s, l) => s + l.aPagar, 0));
  const alternar = (n) => setDesmarcadas((d) => { const x = new Set(d); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const Num = ({ rot, v, forte, tom }) => (
    <div style={{ minWidth: 120 }}><div className="suave peq">{rot}</div><div className="tnum" style={{ fontWeight: forte ? 700 : 600, fontSize: forte ? 18 : 15, color: tom ? `var(--${tom})` : undefined }}>{v}</div></div>
  );
  return (
    <Card semPad>
      <div style={{ padding: "18px 20px 6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <h2>{nomeCurto(c.nome)}</h2>
          <span className="suave peq">
            {c.ativo === false ? "Só as propostas da planilha antiga" : `Planilha antiga + propostas aprovadas desde ${dataCurta(c.desde)}`} · taxa {pctTxt(taxaAtual(c, hojeBR()))}
          </span>
        </div>
        <div style={{ display: "flex", gap: "14px 24px", flexWrap: "wrap", marginTop: 12 }}>
          <Num rot="Propostas" v={t.propostas} />
          <Num rot="Valor das propostas" v={brl(t.valorProposta)} />
          <Num rot="Já virou OS" v={brl(t.geradas)} />
          <Num rot="Faturado (NF)" v={brl(t.faturado)} />
          <Num rot="OS sem NF" v={brl(t.semNF)} tom={t.semNF > 0 ? "alerta" : undefined} />
          <Num rot="Cliente pagou" v={brl(t.pagoCliente)} />
          <Num rot="Comissão gerada" v={brl(t.gerada)} />
          <Num rot="Já pago" v={brl(t.pago)} />
          <Num rot="Falta pagar" v={brl(t.aPagar)} forte tom={t.aPagar > 0 ? "alerta-tx" : undefined} />
          {t.adiantado > 0 && <Num rot="Pago adiantado" v={brl(t.adiantado)} />}
        </div>
      </div>
      <div style={{ padding: "8px 20px 0" }}>
        <Abas valor={ver} aoMudar={setVer} abas={[["propostas", "Propostas", ex.linhas.length], ["os", "Todas as OS", ex.linhas.reduce((n, l) => n + l.os.length, 0)]]} />
      </div>
      {ver === "os" ? <ListaOS ex={ex} nome={nomeCurto(c.nome)} /> : <>
      <div style={{ display: "grid", gap: 8, padding: "12px 20px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="rotulo" style={{ minWidth: 92 }}>Proposta</span>
          <div className="pilulas" role="group" aria-label="Situação da proposta">
            <button type="button" className={`pilula${!status ? " ativa" : ""}`} aria-pressed={!status} onClick={() => setStatus("")}>Todas ({ex.linhas.length})</button>
            {STATUS_ORDEM.map((id) => <button key={id} type="button" className={`pilula${status === id ? " ativa" : ""}`} aria-pressed={status === id} onClick={() => setStatus(id)}>{STATUS_PROPOSTA[id].rotulo} ({ex.linhas.filter((l) => statusProposta(l) === id).length})</button>)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="rotulo" style={{ minWidth: 92 }}>Comissão</span>
          <div className="pilulas" role="group" aria-label="Situação da comissão">
            {FILTROS.map(([id, rot, fx]) => <button key={id} type="button" className={`pilula${filtro === id ? " ativa" : ""}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{rot} ({ex.linhas.filter(fx).length})</button>)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="rotulo" style={{ minWidth: 92 }}>Pago em</span>
          <select className="entrada" style={{ minHeight: 36, flex: "0 1 230px" }} value={mesPago} onChange={(e) => { setMesPago(e.target.value); if (e.target.value) setFiltro("todas"); }} aria-label="Pago no mês">
            <option value="">Qualquer mês</option>
            {mesesPagos.map((m) => <option key={m} value={m}>{rotMes(m)}</option>)}
          </select>
          <input className="entrada" style={{ flex: "1 1 200px", minHeight: 36 }} placeholder="Buscar proposta ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar proposta ou cliente" />
        </div>
        {mesPago && <div className="aviso marca peq">{lista.length} proposta(s) com pagamento em {rotMes(mesPago).toLowerCase()} · total pago no mês <b>{brl(totalMes)}</b></div>}
      </div>
      {lista.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma proposta neste filtro.</div> : (
        <div className="tabela-caixa tabela-comissao">
          <table>
            <thead><tr>
              <th style={{ width: 32 }} />
              <th>Proposta</th><th style={D}>Valor</th><th style={D}>Virou OS</th><th style={D}>Saldo</th><th style={D}>Faturado</th><th style={D}>Comissão</th><th style={D}>{mesPago ? "Pago no mês" : "Pago"}</th><th style={D}>Falta pagar</th>
            </tr></thead>
            <tbody>
              {pag.itens.map((l) => (
                <Fragment key={l.numero}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setAberta(aberta === l.numero ? "" : l.numero)}>
                    <td onClick={(e) => e.stopPropagation()}>{l.aPagar > 0 && <input type="checkbox" aria-label={`Pagar a proposta ${l.numero}`} checked={!desmarcadas.has(l.numero)} onChange={() => alternar(l.numero)} />}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <b className="tnum" style={{ fontWeight: 600 }}>{l.numero}</b>
                        <Chip tom={STATUS_PROPOSTA[statusProposta(l)].tom}>{STATUS_PROPOSTA[statusProposta(l)].rotulo}</Chip>
                        {l.quitada ? <Chip tom="ok">paga (planilha)</Chip> : l.origem === "planilha" && <Chip tom="neutro">planilha</Chip>}
                        {l.status && l.status !== "APROVADA" && <Chip tom="ruim">{l.status.toLowerCase()} no CRM · corrigir</Chip>}
                        <span className="suave peq">{aberta === l.numero ? "▾" : "▸"}</span>
                      </div>
                      <div className="suave peq" title={l.cliente} style={{ maxWidth: 230, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.cliente || "—"}</div>
                    </td>
                    <td className="tnum" style={D}>{brl(l.valorProposta)}</td>
                    <td className="tnum" style={D}>− {brl(l.geradas)}<div className="suave peq">{l.osGeradas} OS</div></td>
                    <td className="tnum" style={D}><Saldo l={l} /></td>
                    <td className="tnum" style={D}>{brl(l.faturado)}{l.semNF > 0 && <div className="peq" style={{ color: "var(--alerta)" }}>falta NF {brl(l.semNF)}</div>}{l.pagoCliente > 0 && <div className="suave peq">cliente pagou {brl(l.pagoCliente)}</div>}</td>
                    <td className="tnum" style={D}>{brl(l.gerada)}</td>
                    <td className="tnum" style={D}>{mesPago ? <>{brl(pagoNoMes(l))}<div className="suave peq">total {brl(l.pago)}</div></> : brl(l.pago)}</td>
                    <td className="tnum" style={{ ...D, fontWeight: 700 }}>{l.aPagar > 0 ? brl(l.aPagar) : l.adiantado > 0 ? <Chip tom="neutro">adiantado {brl(l.adiantado)}</Chip> : <Chip tom="ok">em dia</Chip>}</td>
                  </tr>
                  {aberta === l.numero && <tr><td colSpan={9} style={{ background: "var(--marca-50)", padding: 0 }}><DetalheProposta l={l} nomeDe={nomeDe} /></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacao pag={pag} rotulo="propostas" />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 20px 18px", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn claro mini" onClick={() => baixar(`comissao-${nomeCurto(c.nome).replace(/\s+/g, "-").toLowerCase()}.csv`, csvExtrato(lista, `Comissão por proposta · ${nomeCurto(c.nome)}`))}>Baixar planilha</button>
        <button type="button" className="btn" disabled={!pagaveis.length} onClick={() => setPagando(true)}>Registrar pagamento de {brl(totalSel)} ({pagaveis.length} proposta{pagaveis.length === 1 ? "" : "s"})</button>
      </div>
      </>}
      {pagando && <RegistrarPagamento colab={c} linhas={pagaveis} total={totalSel} gravar={gravar} aoFechar={() => setPagando(false)} />}
    </Card>
  );
}

/** Saldo da proposta: valor − OS geradas. Recorrente passa do valor. */
function Saldo({ l }) {
  const saldo = centavos(l.valorProposta - l.geradas);
  const pct = l.valorProposta > 0 ? Math.min(100, (l.geradas / l.valorProposta) * 100) : 100;
  return (
    <div style={{ minWidth: 96 }}>
      {saldo > 0 ? <b>{brl(saldo)}</b> : saldo === 0 ? <Chip tom="ok">usada toda</Chip> : <span className="peq" title="Já gerou mais OS do que o valor da proposta (proposta recorrente)">passou {brl(-saldo)}</span>}
      <div style={{ height: 5, borderRadius: 3, background: "var(--linha)", marginTop: 4, overflow: "hidden" }} title={`${Math.round(pct)}% da proposta já virou OS`}>
        <div style={{ width: `${pct}%`, height: "100%", background: saldo < 0 ? "var(--alerta)" : "var(--marca)" }} />
      </div>
    </div>
  );
}

function DetalheProposta({ l, nomeDe }) {
  // Abatimento: cada OS (não cancelada) desconta do valor da proposta, na ordem em que foi gerada.
  let resto = l.valorProposta;
  const saldoApos = new Map();
  for (const o of l.os) { if (!o.cancelada) resto = centavos(resto - o.valor); saldoApos.set(o.id, o.cancelada ? null : resto); }
  const comTotal = centavos(l.valorProposta * 0.01);
  const situacaoOS = (o) => o.cancelada ? <Chip tom="ruim">cancelada</Chip> : o.faturada ? <Chip tom="ok">faturada</Chip> : o.aFaturar ? <Chip tom="alerta">pronta para faturar</Chip> : <Chip>{String(o.fat || "—").toLowerCase()}</Chip>;
  return (
    <div style={{ padding: "12px 16px 16px", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: "10px 24px", flexWrap: "wrap", background: "#fff", borderRadius: 10, padding: "10px 14px" }}>
        <div><div className="suave peq">Situação</div><Chip tom={STATUS_PROPOSTA[statusProposta(l)].tom}>{STATUS_PROPOSTA[statusProposta(l)].rotulo}</Chip></div>
        <div><div className="suave peq">Valor da proposta</div><b className="tnum">{brl(l.valorProposta)}</b></div>
        <div><div className="suave peq">Já virou OS</div><b className="tnum">− {brl(l.geradas)}</b></div>
        <div><div className="suave peq">Saldo da proposta</div><Saldo l={l} /></div>
        <div style={{ borderLeft: "1px solid var(--linha)", paddingLeft: 24 }}><div className="suave peq">Comissão da proposta toda (1%)</div><b className="tnum">{brl(comTotal)}</b></div>
        <div><div className="suave peq">Liberada (OS com NF)</div><b className="tnum">{brl(l.gerada)}</b></div>
        <div><div className="suave peq">Já paga</div><b className="tnum">{brl(l.pago)}</b></div>
        <div><div className="suave peq">Falta pagar</div><b className="tnum" style={{ color: l.aPagar > 0 ? "var(--alerta-tx)" : undefined }}>{l.aPagar > 0 ? brl(l.aPagar) : l.adiantado > 0 ? `adiantado ${brl(l.adiantado)}` : "em dia"}</b></div>
        <div><div className="suave peq">Ainda vai liberar</div><b className="tnum">{brl(Math.max(0, centavos(comTotal - l.gerada)))}</b></div>
      </div>
      <div className="peq">
        <b>Como chegou nesta conta:</b> {l.osGeradas} OS geradas ({brl(l.geradas)}), {brl(l.faturado)} faturados → comissão {brl(l.gerada)} · já pago {brl(l.pago)} ·{" "}
        {l.aPagar > 0 ? <b>falta pagar {brl(l.aPagar)}</b> : l.adiantado > 0 ? <>pago adiantado {brl(l.adiantado)} (é descontado das próximas OS)</> : "em dia"}
        {l.aceite ? <> · aceite em {dataCurta(l.aceite)}</> : null}
      </div>
      <div className="tabela-caixa" style={{ background: "#fff", borderRadius: 10 }}>
        <table>
          <thead><tr><th>OS</th><th>Gerada em</th><th style={D}>Valor da OS</th><th style={D}>Saldo da proposta</th><th>Situação</th><th>NF</th><th>Cliente</th><th style={D}>Comissão</th></tr></thead>
          <tbody>
            <tr style={{ background: "var(--marca-50)" }}><td colSpan={3} className="peq"><b>Valor da proposta</b>{l.aceite ? ` · aceite em ${dataCurta(l.aceite)}` : ""}</td><td className="tnum" style={{ ...D, fontWeight: 700 }}>{brl(l.valorProposta)}</td><td colSpan={4} /></tr>
            {l.os.length === 0 && <tr><td colSpan={8} className="suave">Nenhuma OS gerada ainda para esta proposta.</td></tr>}
            {l.os.map((o) => (
              <tr key={o.id} style={o.cancelada ? { opacity: 0.55 } : undefined}>
                <td className="tnum peq">{o.os}</td>
                <td className="tnum peq">{dataCurta(o.dataOs)}</td>
                <td className="tnum" style={D}>− {brl(o.valor)}</td>
                <td className="tnum" style={{ ...D, fontWeight: 600, color: saldoApos.get(o.id) < 0 ? "var(--alerta)" : undefined }}>{saldoApos.get(o.id) == null ? "não abate" : brl(saldoApos.get(o.id))}</td>
                <td>{situacaoOS(o)}</td>
                <td className="tnum peq">{o.faturada ? <>{o.nf ? `NF ${o.nf} · ` : ""}{dataCurta(o.emissao)}</> : "—"}</td>
                <td className="peq">{o.clientePagou ? <Chip tom="ok">pagou</Chip> : o.faturada ? String(o.pag || "").toLowerCase() : "—"}</td>
                <td className="tnum" style={D}>{o.faturada ? <>{brl(o.comissao)} <span className="suave peq">({pctTxt(o.pct)})</span></> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tabela-caixa" style={{ background: "#fff", borderRadius: 10 }}>
        <table>
          <thead><tr><th>Pago em</th><th>Mês da folha</th><th>Para</th><th>Origem</th><th style={D}>Valor</th></tr></thead>
          <tbody>
            {l.quitada && <tr><td colSpan={4} className="peq"><b>Quitada pela planilha de pagas</b>: toda a comissão desta proposta conta como paga.</td><td className="tnum" style={D}>{brl(l.pago)}</td></tr>}
            {!l.quitada && l.pagamentos.length === 0 && <tr><td colSpan={5} className="suave">Nenhuma comissão paga desta proposta ainda.</td></tr>}
            {l.pagamentos.map((p, i) => (
              <tr key={i}>
                <td className="tnum peq">{p.planilha && p.obs.includes("sem o mês") ? "sem data (planilha)" : dataCurta(p.pagoEm)}</td>
                <td className="peq">{rotMes(mesDoPagamentoItem(p))}</td>
                <td className="peq">{nomeDe(p.colaboradorId)}</td>
                <td className="peq">{p.planilha ? "planilha antiga" : "registrado no sistema"}</td>
                <td className="tnum" style={D}>{brl(p.valor)}</td>
              </tr>
            ))}
            <tr style={{ background: "var(--marca-50)" }}>
              <td colSpan={4} className="peq"><b>Comissão liberada {brl(l.gerada)}</b> · já pago {brl(l.pago)}</td>
              <td className="tnum" style={{ ...D, fontWeight: 700 }}>{l.aPagar > 0 ? `falta ${brl(l.aPagar)}` : l.adiantado > 0 ? `adiantado ${brl(l.adiantado)}` : "em dia"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {l.planilha.length > 0 && (
        <div className="suave peq">
          Na planilha: {l.planilha.map((x) => `${dataCurta(x.data)} · proposta ${brl(x.base)} · comissão ${brl(x.valor)} · ${x.pago ? "pago" : "não pago"}`).join("  |  ")}
        </div>
      )}
    </div>
  );
}

function RegistrarPagamento({ colab, linhas, total, gravar, aoFechar }) {
  const [pagoEm, setPagoEm] = useState(hojeBR());
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pagoEm)) return setErro("Informe a data do pagamento.");
    setSalvando(true); setErro("");
    try {
      await gravar("comissoes", { tipo: "pagamento", colaboradorId: colab.id, nome: colab.nome, pagoEm, obs: obs.trim(), itens: itensPagamentoPropostas(linhas), total });
      aoFechar();
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  return (
    <Modal titulo={`Pagamento · ${nomeCurto(colab.nome)}`} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="aviso marca">{linhas.length} proposta{linhas.length === 1 ? "" : "s"} · <b>{brl(total)}</b></div>
        <div className="campo"><label htmlFor="pg-data">Data do pagamento</label><input id="pg-data" type="date" className="entrada" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} /></div>
        <div className="campo"><label htmlFor="pg-obs">Observação</label><input id="pg-obs" className="entrada" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: pago na folha de novembro" /></div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" disabled={salvando} onClick={salvar}>{salvando ? "Registrando…" : "Registrar como pago"}</button>
        </div>
      </div>
    </Modal>
  );
}

const semMes = (p) => p.planilha && String(p.obs).includes("sem o mês");
const mesDoPagamento = (p) => (semMes(p) ? "sem" : String(p.pagoEm || "").slice(0, 7));

/** Pagamentos mês a mês (mês da folha): uma linha por mês, uma coluna por colaborador. */
function PagamentosPorMes({ pagamentos, nomeDe, aoVer }) {
  const pessoas = [...new Set(pagamentos.map((p) => p.colaboradorId))].sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR"));
  const meses = [...new Set(pagamentos.map(mesDoPagamento))].sort((a, b) => (a === "sem" ? 1 : b === "sem" ? -1 : b.localeCompare(a)));
  const celula = (m, id) => pagamentos.filter((p) => mesDoPagamento(p) === m && p.colaboradorId === id);
  const soma = (ps) => centavos(ps.reduce((s, p) => s + Number(p.total || 0), 0));
  const abrir = (m, id) => {
    const ps = celula(m, id);
    if (!ps.length) return;
    aoVer({ pagamento: { id: "mes", pagoEm: ps[0].pagoEm, planilha: ps.every((p) => p.planilha), obs: [...new Set(ps.map((p) => p.obs).filter(Boolean))].join(" · "), itens: ps.flatMap((p) => p.itens || []), total: soma(ps) }, quem: nomeDe(id), titulo: m === "sem" ? "sem mês da folha na planilha" : mesLongo(m) });
  };
  return (
    <Card semPad>
      <div className="card-cab"><h2>Pago por mês da folha</h2><span className="suave peq">clique no valor para ver as propostas pagas</span></div>
      <div className="tabela-caixa tabela-comissao">
        <table>
          <thead><tr><th>Mês</th>{pessoas.map((id) => <th key={id} style={D}>{nomeDe(id)}</th>)}<th style={D}>Total</th></tr></thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m}>
                <td>{m === "sem" ? <span className="suave">Sem mês na planilha</span> : mesLongo(m)}</td>
                {pessoas.map((id) => {
                  const ps = celula(m, id);
                  return <td key={id} className="tnum" style={D}>{ps.length ? <button type="button" className="btn-link" onClick={() => abrir(m, id)}>{brl(soma(ps))}</button> : <span className="suave">—</span>}</td>;
                })}
                <td className="tnum" style={{ ...D, fontWeight: 700 }}>{brl(soma(pagamentos.filter((p) => mesDoPagamento(p) === m)))}</td>
              </tr>
            ))}
            <tr>
              <td style={{ fontWeight: 700 }}>Total</td>
              {pessoas.map((id) => <td key={id} className="tnum" style={{ ...D, fontWeight: 700 }}>{brl(soma(pagamentos.filter((p) => p.colaboradorId === id)))}</td>)}
              <td className="tnum" style={{ ...D, fontWeight: 700 }}>{brl(soma(pagamentos))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Pagamentos({ pagamentos, nomeDe, aoVer, remover }) {
  const [modo, setModo] = useState("mes");
  const pag = usePaginacao(pagamentos, 15);
  if (!pagamentos.length) return <div className="vazio">Nenhum pagamento registrado ainda. Os pagos da planilha antiga aparecem aqui, mês a mês, depois de “Importar planilha antiga”.</div>;
  const troca = (
    <div className="pilulas" role="group" aria-label="Ver pagamentos">
      {[["mes", "Por mês"], ["lista", "Lista de pagamentos"]].map(([id, rot]) => <button key={id} type="button" className={`pilula${modo === id ? " ativa" : ""}`} aria-pressed={modo === id} onClick={() => setModo(id)}>{rot}</button>)}
    </div>
  );
  if (modo === "mes") return <>{troca}<PagamentosPorMes pagamentos={pagamentos} nomeDe={nomeDe} aoVer={aoVer} /></>;
  const desfazer = async (p) => {
    if (!window.confirm(`Desfazer o pagamento de ${brl(p.total)} para ${nomeDe(p.colaboradorId)}? O valor volta para "falta pagar".`)) return;
    try { await remover("comissoes", p.id); } catch (e) { window.alert(e.message); }
  };
  return (
    <>
    {troca}
    <Card semPad>
      <div className="tabela-caixa">
        <table>
          <thead><tr><th>Pago em</th><th>Colaborador</th><th style={D}>Propostas</th><th style={D}>Valor</th><th>Obs.</th><th /></tr></thead>
          <tbody>
            {pag.itens.map((p) => (
              <tr key={p.id}>
                <td className="tnum">{p.planilha && String(p.obs).includes("sem o mês") ? <span className="suave">sem data</span> : dataCurta(p.pagoEm)}</td>
                <td>{nomeDe(p.colaboradorId)}</td>
                <td className="tnum" style={D}>{new Set((p.itens || []).map((i) => i.proposta)).size}</td>
                <td className="tnum" style={{ ...D, fontWeight: 600 }}>{brl(p.total)}</td>
                <td className="peq suave">{p.obs}</td>
                <td style={{ ...D, whiteSpace: "nowrap" }}>
                  <button type="button" className="btn claro mini" onClick={() => aoVer({ pagamento: p, quem: nomeDe(p.colaboradorId) })}>Ver</button>{" "}
                  <button type="button" className="btn perigo mini" onClick={() => desfazer(p)}>Desfazer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacao pag={pag} rotulo="pagamentos" />
    </Card>
    </>
  );
}

function VerPagamento({ pagamento: p, quem, titulo, aoFechar }) {
  const itens = p.itens || [];
  return (
    <Modal titulo={`${titulo ? `Pago em ${titulo}` : `Pagamento de ${p.planilha && String(p.obs).includes("sem o mês") ? "data não informada" : dataCurta(p.pagoEm)}`} · ${quem}`} aoFechar={aoFechar} largo>
      {p.obs && <div className="suave peq" style={{ marginBottom: 8 }}>{p.obs}</div>}
      <div className="tabela-caixa">
        <table>
          <thead><tr><th>Proposta</th><th>Cliente</th><th style={D}>Base</th><th style={D}>Valor pago</th></tr></thead>
          <tbody>
            {itens.map((i, k) => (
              <tr key={k}><td className="tnum">{i.proposta}</td><td className="peq">{i.cliente}</td><td className="tnum" style={D}>{brl(i.base)}</td><td className="tnum" style={{ ...D, fontWeight: 600 }}>{brl(i.valor)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <b className="tnum">Total {brl(p.total)}</b>
        <button type="button" className="btn mini" onClick={aoFechar}>Fechar</button>
      </div>
    </Modal>
  );
}

function Colaboradores({ contas, pessoasCRM, aoEditar, remover, registros }) {
  const [erro, setErro] = useState("");
  if (!contas.length) return null;
  const excluir = async (c) => {
    setErro("");
    if (registros.some((r) => (r.tipo === "pagamento" || r.tipo === "planilha") && r.colaboradorId === c.id)) return setErro(`${nomeCurto(c.nome)} tem histórico (pagamentos ou planilha). Para não perder o histórico, desmarque “pega propostas novas” em Editar em vez de excluir.`);
    if (!window.confirm(`Excluir ${nomeCurto(c.nome)} da comissão?`)) return;
    try { await remover("comissoes", c.id); } catch (e) { setErro(e.message); }
  };
  const nomeCRM = (id) => pessoasCRM.find((p) => p.id === id)?.nome || (id ? "Usuário do CRM" : "sem usuário no CRM");
  return (
    <>
      {erro && <div className="aviso ruim">{erro}</div>}
      <div className="grade grade-2">
        {contas.map(({ c, ex }) => (
          <Card key={c.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
              <div><h2>{nomeCurto(c.nome)}</h2><div className="suave peq">No CRM: {nomeCRM(c.crmId)}</div></div>
              {c.ativo === false ? <Chip>só a planilha</Chip> : <Chip tom="ok">pega propostas novas</Chip>}{c.automatico && <Chip tom="neutro">automático (responsável no CRM)</Chip>}
            </div>
            <div className="peq" style={{ marginTop: 10, lineHeight: 1.7 }}>
              {c.ativo === false ? "Só as propostas da planilha antiga" : <>Propostas aprovadas a partir de <b>{dataCurta(c.desde)}</b></>} · {ex.totais.propostas} propostas · gerada {brl(ex.totais.gerada)} · pago {brl(ex.totais.pago)} · falta {brl(ex.totais.aPagar)}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {[...(c.taxas || [])].sort((a, b) => String(a.desde).localeCompare(String(b.desde))).map((t) => <Chip key={t.desde} tom="marca">{pctTxt(t.pct)} desde {dataCurta(t.desde)}</Chip>)}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button type="button" className="btn claro mini" onClick={() => aoEditar(c)}>Editar</button>
              {!c.automatico && <button type="button" className="btn perigo mini" onClick={() => excluir(c)}>Excluir</button>}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function EditarColaborador({ inicial, pessoasCRM, aoFechar, gravar, remover, temPagamento, colabs = [] }) {
  const novo = !!inicial.novo;
  const [f, setF] = useState(() => novo
    ? { nome: "", crmId: "", desde: hojeBR(), taxas: [{ desde: hojeBR(), pct: 1 }], ativo: true }
    : { ...inicial, taxas: [...(inicial.taxas || [])] });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const muda = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const mudaTaxa = (i, k, v) => setF((x) => ({ ...x, taxas: x.taxas.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const escolherCRM = (id) => setF((x) => ({ ...x, crmId: id, nome: x.nome || pessoasCRM.find((p) => p.id === id)?.nome || "" }));
  const salvar = async () => {
    const reg = { ...f, tipo: "colaborador", nome: String(f.nome).trim().toLocaleUpperCase("pt-BR"), taxas: f.taxas.map((t) => ({ desde: t.desde, pct: Number(String(t.pct).replace(",", ".")) })) };
    delete reg.novo;
    const e = validarColaborador(reg);
    if (e) return setErro(e);
    const igual = colabs.find((c) => c.id !== reg.id && c.crmId === reg.crmId);
    if (igual) return setErro(`${nomeCurto(igual.nome)} já está cadastrada na comissão (contagem desde ${dataCurta(igual.desde)}). Para mudar a data ou a taxa, use Editar no cadastro que já existe.`);
    setSalvando(true); setErro("");
    try { await gravar("comissoes", reg); aoFechar(); } catch (x) { setErro(x.message); setSalvando(false); }
  };
  const apagar = async () => {
    if (temPagamento(f.id)) return setErro("Este colaborador tem histórico (pagamentos ou planilha). Desmarque “pega propostas novas” em vez de excluir, para não perder o histórico.");
    if (!window.confirm("Excluir este cadastro de comissão?")) return;
    try { await remover("comissoes", f.id); aoFechar(); } catch (x) { setErro(x.message); }
  };
  return (
    <Modal titulo={novo ? "Novo colaborador na comissão" : `Editar · ${nomeCurto(f.nome)}`} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="campo">
          <label htmlFor="cm-crm">Usuário no CRM (responsável comercial das propostas)</label>
          <select id="cm-crm" className="entrada" value={f.crmId} onChange={(e) => escolherCRM(e.target.value)}>
            <option value="">Escolha…</option>
            {pessoasCRM.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.ativo ? "" : " (inativo)"}</option>)}
          </select>
        </div>
        <div className="campo"><label htmlFor="cm-nome">Nome</label><input id="cm-nome" className="entrada" value={f.nome} onChange={(e) => muda("nome", e.target.value)} /></div>
        <div className="campo">
          <label htmlFor="cm-desde">Data de contagem</label>
          <input id="cm-desde" type="date" className="entrada" value={f.desde} onChange={(e) => muda("desde", e.target.value)} />
          <span className="suave peq">Entram propostas aprovadas a partir desta data e só as OS geradas a partir dela.</span>
        </div>
        <div className="campo">
          <span className="rotulo">Taxa de comissão</span>
          {f.taxas.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="number" step="0.1" min="0" max="30" className="entrada" aria-label="Taxa em %" value={t.pct} onChange={(e) => mudaTaxa(i, "pct", e.target.value)} style={{ width: 90 }} />
              <span className="peq">% a partir de</span>
              <input type="date" className="entrada" aria-label="Vale a partir de" value={t.desde} onChange={(e) => mudaTaxa(i, "desde", e.target.value)} style={{ width: 170 }} />
              {f.taxas.length > 1 && <button type="button" className="btn perigo mini" onClick={() => setF((x) => ({ ...x, taxas: x.taxas.filter((_, j) => j !== i) }))}>Tirar</button>}
            </div>
          ))}
          <div><button type="button" className="btn claro mini" onClick={() => setF((x) => ({ ...x, taxas: [...x.taxas, { desde: hojeBR(), pct: x.taxas.at(-1)?.pct ?? 1 }] }))}>Mudar a taxa a partir de uma data</button></div>
          <span className="suave peq">Aumento vale para as notas emitidas a partir da data nova; o que já foi faturado antes continua com a taxa antiga.</span>
        </div>
        <label className="peq" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={f.ativo !== false} onChange={(e) => muda("ativo", e.target.checked)} /> Pega propostas novas (desmarque se deixou de receber; as propostas antigas continuam no extrato)
        </label>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          {!novo ? <button type="button" className="btn perigo" onClick={apagar}>Excluir</button> : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
            <button type="button" className="btn" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Importa a planilha antiga (uma linha por proposta, 1% do valor dela):
// "Pago" vira histórico de pagamento; todas as linhas dizem de quem é cada
// proposta antiga, que passa a seguir a regra nova descontando o já pago.
function ImportarPlanilha({ colabs, pessoasCRM, gravar, aoFechar }) {
  const [plano, setPlano] = useState(null);
  const [arquivo, setArquivo] = useState("");
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState("");
  const ler = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro(""); setPlano(null);
    try {
      const { linhas } = lerLinhasPlanilha(await lerXlsx(f));
      if (!linhas.length) throw new Error("A planilha não tem linhas de comissão.");
      setArquivo(f.name);
      setPlano({ ...planoImportacao(linhas, { colabs, pessoasCRM, arquivo: "planilha antiga" }), linhas: linhas.length });
    } catch (ex) { setErro(ex.message || "Não consegui ler a planilha."); }
  };
  const importar = async () => {
    try {
      const regs = [...plano.colaboradores, ...plano.pagamentos, ...plano.planilhas];
      let n = 0;
      for (const r of regs) { setGravando(`Gravando ${++n} de ${regs.length}…`); await gravar("comissoes", { ...r, importadoDe: arquivo }); }
      aoFechar();
    } catch (ex) { setErro(ex.message); setGravando(""); }
  };
  const repetidas = plano?.alertas.filter((a) => a.tipo === "repetida") || [];
  return (
    <Modal titulo="Importar a planilha antiga de comissões" aoFechar={() => !gravando && aoFechar()} largo>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="aviso marca peq">
          As linhas <b>Pago</b> entram no histórico de pagamentos (pelo mês da folha). Cada proposta da planilha passa a seguir a regra nova:
          1% de cada OS faturada, <b>descontando o que a planilha já pagou</b>. Quem não está cadastrado entra só com as propostas da planilha (não pega proposta nova). Importar de novo o mesmo arquivo não duplica.
        </div>
        <input type="file" accept=".xlsx" className="entrada" onChange={ler} disabled={!!gravando} aria-label="Escolher a planilha" />
        {erro && <div className="aviso ruim">{erro}</div>}
        {plano && (
          <>
            <div className="tabela-caixa">
              <table>
                <thead><tr><th>Colaborador</th><th style={{ textAlign: "right" }}>Linhas pagas</th><th style={{ textAlign: "right" }}>Pago</th><th style={{ textAlign: "right" }}>Não pagas na planilha</th><th style={{ textAlign: "right" }}>Valor não pago</th><th /></tr></thead>
                <tbody>
                  {plano.resumo.map((x) => (
                    <tr key={x.nome}>
                      <td>{nomeCurto(x.nome)}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{x.pagas}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{brl(x.pago)}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{x.abertas}</td>
                      <td className="tnum" style={{ textAlign: "right", fontWeight: 600 }}>{brl(x.aPagar)}</td>
                      <td>{x.novo ? <Chip>entra só com a planilha</Chip> : <Chip tom="ok">já cadastrada</Chip>}{x.semCRM && <Chip tom="alerta">sem usuário no CRM</Chip>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {plano.alertas.length > 0 && (
              <div className="aviso alerta peq">
                <b>Conferência da planilha.</b>
                {repetidas.length > 0 && <> {repetidas.length} proposta(s) aparecem pagas duas vezes com o mesmo valor e data: {brl(repetidas.reduce((s, a) => s + a.valor, 0))} possivelmente pagos em dobro.</>}
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, maxHeight: 180, overflow: "auto" }}>
                  {plano.alertas.map((a) => <li key={a.proposta + a.tipo}>{a.proposta}: {a.texto}{a.valor ? ` (${brl(a.valor)} a mais)` : ""}</li>)}
                </ul>
                <div style={{ marginTop: 6 }}>O pago em dobro aparece depois como “adiantado” na proposta e é descontado das próximas OS dela.</div>
              </div>
            )}
          </>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          {gravando && <span className="suave peq">{gravando}</span>}
          <button type="button" className="btn claro" disabled={!!gravando} onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" disabled={!plano || !!gravando} onClick={importar}>Importar {plano ? `${plano.linhas} linhas` : ""}</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- todas as OS
const FILTROS_OS = [["todas", "Todas"], ["faltaNF", "Falta emitir NF"], ["aguardando", "Aguardando"], ["nf", "NF emitida"], ["cancelada", "Canceladas"]];

function ListaOS({ ex, nome }) {
  const todas = useMemo(() => osDoExtrato(ex), [ex]);
  const [f, setF] = useState("todas");
  const [busca, setBusca] = useState("");
  const q = busca.trim().toLowerCase();
  const lista = todas.filter((o) => (f === "todas" || o.sit.id === f) && (!q || String(o.proposta).includes(q) || String(o.os).toLowerCase().includes(q) || String(o.cliente).toLowerCase().includes(q)));
  const pag = usePaginacao(lista, 25, `${f}|${q}`);
  const soma = (xs, k) => centavos(xs.reduce((s, o) => s + (Number(o[k]) || 0), 0));
  const csv = () => {
    const n = (v) => Number(v || 0).toFixed(2).replace(".", ",");
    const t = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [["OS", "Gerada em", "Proposta", "Cliente", "Valor", "Situação", "NF", "Emissão", "Pagamento do cliente", "Comissão liberada", "Comissão prevista"].join(";"),
      ...lista.map((o) => [t(o.os), t(dataCurta(o.dataOs)), t(o.proposta), t(o.cliente), n(o.valor), t(o.sit.rotulo), t(o.nf), t(dataCurta(o.emissao)), t(String(o.pag || "").toLowerCase()), n(o.comissao), n(o.prevista)].join(";"))];
    baixar(`os-${nome.replace(/\s+/g, "-").toLowerCase()}.csv`, "\uFEFF" + linhas.join("\r\n"));
  };
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "12px 20px" }}>
        <div className="pilulas" role="group" aria-label="Situação da OS">
          {FILTROS_OS.map(([id, rot]) => {
            const xs = id === "todas" ? todas : todas.filter((o) => o.sit.id === id);
            return <button key={id} type="button" className={`pilula${f === id ? " ativa" : ""}`} aria-pressed={f === id} onClick={() => setF(id)}>{rot} ({xs.length})</button>;
          })}
        </div>
        <input className="entrada" style={{ flex: "1 1 200px", minHeight: 36 }} placeholder="Buscar OS, proposta ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar OS, proposta ou cliente" />
      </div>
      <div className="suave peq" style={{ padding: "0 20px 8px" }}>
        {lista.length} OS · {brl(soma(lista, "valor"))} · comissão liberada {brl(soma(lista, "comissao"))} · prevista (quando emitir a NF) {brl(soma(lista, "prevista"))}
      </div>
      {lista.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma OS nesta situação.</div> : (
        <div className="tabela-caixa tabela-comissao">
          <table>
            <thead><tr><th>OS</th><th>Gerada em</th><th>Proposta</th><th style={D}>Valor</th><th>Situação</th><th>NF</th><th>Cliente</th><th style={D}>Comissão</th></tr></thead>
            <tbody>
              {pag.itens.map((o) => (
                <tr key={o.id} style={o.sit.id === "cancelada" ? { opacity: 0.55 } : undefined}>
                  <td className="tnum">{o.os}</td>
                  <td className="tnum">{dataCurta(o.dataOs)}</td>
                  <td><span className="tnum">{o.proposta}</span><div className="suave peq" title={o.cliente} style={{ maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.cliente}</div></td>
                  <td className="tnum" style={D}>{brl(o.valor)}</td>
                  <td><Chip tom={o.sit.tom}>{o.sit.rotulo}</Chip>{o.sit.id === "aguardando" && o.pag ? <div className="suave peq">{String(o.pag).toLowerCase()}</div> : null}</td>
                  <td className="tnum">{o.faturada ? <>{o.nf ? `NF ${o.nf}` : "emitida"}<div className="suave peq">{dataCurta(o.emissao)}</div></> : "—"}</td>
                  <td>{o.clientePagou ? <Chip tom="ok">pagou</Chip> : o.faturada ? <span className="peq">{String(o.pag || "").toLowerCase()}</span> : <span className="suave">—</span>}</td>
                  <td className="tnum" style={D}>{o.faturada ? <b>{brl(o.comissao)}</b> : o.prevista ? <span className="suave" title="Vira comissão quando a NF for emitida">prevista {brl(o.prevista)}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Paginacao pag={pag} rotulo="OS" />
      <div style={{ padding: "8px 20px 18px" }}><button type="button" className="btn claro mini" onClick={csv}>Baixar planilha das OS</button></div>
    </>
  );
}

// ---------------------------------------------------------------- resumo (gráfico)
const COR_GERADA = "#7cc9bf";
const COR_PAGA = "#0f766e";

function GraficoComissao({ serie, media }) {
  const [foco, setFoco] = useState(null);
  const W = 760, H = 240, ml = 56, mr = 12, mt = 14, mb = 28;
  const max = Math.max(1, media, ...serie.flatMap((x) => [x.gerada, x.paga])) * 1.1;
  const y = (v) => mt + (H - mt - mb) * (1 - v / max);
  const passo = (W - ml - mr) / Math.max(1, serie.length);
  const bw = Math.max(4, Math.min(18, passo / 2 - 4));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => max * k);
  const x0 = (i) => ml + passo * i + passo / 2;
  const f = foco != null ? serie[foco] : null;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Comissão gerada e paga por mês" style={{ display: "block" }} onMouseLeave={() => setFoco(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke="var(--linha)" strokeWidth="1" />
            <text x={ml - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--suave)">{t >= 1000 ? `${(t / 1000).toFixed(1).replace(".", ",")} mil` : Math.round(t)}</text>
          </g>
        ))}
        {serie.map((s, i) => (
          <g key={s.mes} onMouseEnter={() => setFoco(i)}>
            <rect x={ml + passo * i} y={mt} width={passo} height={H - mt - mb} fill={foco === i ? "var(--marca-50)" : "transparent"} />
            <rect x={x0(i) - bw - 1} y={y(s.gerada)} width={bw} height={Math.max(0, y(0) - y(s.gerada))} rx="3" fill={COR_GERADA} />
            <rect x={x0(i) + 1} y={y(s.paga)} width={bw} height={Math.max(0, y(0) - y(s.paga))} rx="3" fill={COR_PAGA} />
            <text x={x0(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--suave)">{mesLongo(s.mes).slice(0, 3)}/{s.mes.slice(2, 4)}</text>
          </g>
        ))}
        {media > 0 && (
          <g pointerEvents="none">
            <line x1={ml} x2={W - mr} y1={y(media)} y2={y(media)} stroke="var(--alerta)" strokeWidth="2" strokeDasharray="6 4" />
            <rect x={ml + 4} y={y(media) - 20} width="150" height="16" rx="4" fill="#fff" opacity=".9" />
            <text x={ml + 8} y={y(media) - 8} fontSize="11" fontWeight="600" fill="var(--alerta-tx)">média paga {brl(media)}</text>
          </g>
        )}
      </svg>
      {f && (
        <div className="peq" style={{ position: "absolute", top: 4, left: `${Math.min(70, (x0(foco) / W) * 100)}%`, background: "#fff", border: "1px solid var(--linha)", borderRadius: 8, padding: "6px 10px", boxShadow: "0 4px 14px rgba(0,0,0,.08)", pointerEvents: "none" }}>
          <b>{mesLongo(f.mes)}</b><div>Gerada: {brl(f.gerada)}</div><div>Paga: {brl(f.paga)}</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6 }} className="peq">
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: COR_GERADA, marginRight: 6 }} />Gerada (1% das NF emitidas no mês)</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: COR_PAGA, marginRight: 6 }} />Paga (mês do pagamento / folha)</span>
        <span><span style={{ display: "inline-block", width: 14, borderTop: "2px dashed var(--alerta)", marginRight: 6, verticalAlign: "middle" }} />Média paga por mês</span>
      </div>
    </div>
  );
}

function Resumo({ contas, pagamentos }) {
  const [quem, setQuem] = useState("");
  const mes = mesAtual();
  const sel = quem ? contas.filter((x) => x.c.id === quem) : contas;
  const pgs = quem ? pagamentos.filter((p) => p.colaboradorId === quem) : pagamentos;
  const s = serieMensal(sel.map((x) => x.ex), pgs, { ate: mes });
  const tot = (k) => centavos(sel.reduce((a, x) => a + x.ex.totais[k], 0));
  const todasOS = sel.flatMap((x) => osDoExtrato(x.ex));
  const porSit = (id) => todasOS.filter((o) => o.sit.id === id);
  const somaV = (xs, k = "valor") => centavos(xs.reduce((a, o) => a + (Number(o[k]) || 0), 0));
  const ultimos = s.serie.slice(-12);
  return (
    <>
      <div className="pilulas" role="group" aria-label="Colaborador">
        <button type="button" className={`pilula${!quem ? " ativa" : ""}`} aria-pressed={!quem} onClick={() => setQuem("")}>Todos</button>
        {contas.map((x) => <button key={x.c.id} type="button" className={`pilula${quem === x.c.id ? " ativa" : ""}`} aria-pressed={quem === x.c.id} onClick={() => setQuem(x.c.id)}>{nomeCurto(x.c.nome)}</button>)}
      </div>
      <Conferencia contas={sel} />
      <div className="grade grade-kpi">
        <Kpi rotulo="Média paga por mês" valor={brl(s.mediaPaga)} sub={`${s.mesesPagos} mês(es) com pagamento`} />
        <Kpi rotulo="Média gerada por mês" valor={brl(s.mediaGerada)} sub="1% das NF emitidas" />
        <Kpi rotulo="Falta pagar" valor={brl(tot("aPagar"))} sub={tot("adiantado") > 0 ? `${brl(tot("adiantado"))} pagos adiantado` : "comissão já liberada"} />
        <Kpi rotulo="Prevista (OS sem NF)" valor={brl(somaV([...porSit("faltaNF"), ...porSit("aguardando")], "prevista"))} sub={`${porSit("faltaNF").length + porSit("aguardando").length} OS ainda sem nota`} />
      </div>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <h2>Comissão por mês</h2>
          {s.pagoSemMes > 0 && <span className="suave peq">{brl(s.pagoSemMes)} pagos pela planilha sem mês da folha ficam fora do gráfico</span>}
        </div>
        {ultimos.length ? <GraficoComissao serie={ultimos} media={s.mediaPaga} /> : <div className="vazio">Ainda não há comissão gerada nem paga.</div>}
      </Card>
      <div className="grade grade-2" style={{ alignItems: "start" }}>
        <Card semPad>
          <div className="card-cab"><h2>Situação das OS</h2><span className="suave peq">{todasOS.length} OS das propostas com comissão</span></div>
          <div className="tabela-caixa tabela-comissao">
            <table>
              <thead><tr><th>Situação</th><th style={D}>OS</th><th style={D}>Valor</th><th style={D}>Comissão</th></tr></thead>
              <tbody>
                {[["nf", "NF emitida", "ok", "comissao", "liberada"], ["faltaNF", "Falta emitir NF (pronto para faturar)", "alerta", "prevista", "prevista"], ["aguardando", "Aguardando / outras", "neutro", "prevista", "prevista"], ["cancelada", "Canceladas", "ruim", null, ""]].map(([id, rot, tom, k, txt]) => {
                  const xs = porSit(id);
                  return <tr key={id}><td><Chip tom={tom}>{rot}</Chip></td><td className="tnum" style={D}>{xs.length}</td><td className="tnum" style={D}>{brl(somaV(xs))}</td><td className="tnum" style={D}>{k ? <>{brl(somaV(xs, k))} <span className="suave peq">{txt}</span></> : "—"}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card semPad>
          <div className="card-cab"><h2>Mês a mês</h2></div>
          <div className="tabela-caixa tabela-comissao" style={{ maxHeight: 340, overflowY: "auto" }}>
            <table>
              <thead><tr><th>Mês</th><th style={D}>Gerada</th><th style={D}>Paga</th></tr></thead>
              <tbody>
                {[...s.serie].reverse().map((x) => <tr key={x.mes}><td>{mesLongo(x.mes)}</td><td className="tnum" style={D}>{brl(x.gerada)}</td><td className="tnum" style={D}>{brl(x.paga)}</td></tr>)}
                {s.pagoSemMes > 0 && <tr><td className="suave">Pago sem mês (planilha)</td><td /><td className="tnum" style={D}>{brl(s.pagoSemMes)}</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card semPad>
        <div className="card-cab"><h2>Por colaborador</h2></div>
        <div className="tabela-caixa tabela-comissao">
          <table>
            <thead><tr><th>Colaborador</th><th style={D}>Propostas</th><th style={D}>Faturado</th><th style={D}>OS sem NF</th><th style={D}>Gerada</th><th style={D}>Paga</th><th style={D}>Falta pagar</th><th style={D}>Adiantado</th></tr></thead>
            <tbody>
              {contas.map(({ c, ex }) => (
                <tr key={c.id}>
                  <td>{nomeCurto(c.nome)}{c.ativo === false && <div className="suave peq">só a planilha</div>}</td>
                  <td className="tnum" style={D}>{ex.totais.propostas}</td>
                  <td className="tnum" style={D}>{brl(ex.totais.faturado)}</td>
                  <td className="tnum" style={D}>{brl(ex.totais.semNF)}</td>
                  <td className="tnum" style={D}>{brl(ex.totais.gerada)}</td>
                  <td className="tnum" style={D}>{brl(ex.totais.pago)}</td>
                  <td className="tnum" style={{ ...D, fontWeight: 700 }}>{brl(ex.totais.aPagar)}</td>
                  <td className="tnum" style={D}>{ex.totais.adiantado > 0 ? brl(ex.totais.adiantado) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- conferência
function Conferencia({ contas }) {
  const [aberto, setAberto] = useState("");
  const itens = useMemo(() => conferencia(contas, hojeBR()), [contas]);
  if (!itens.length) return <div className="aviso marca peq">Conferência: nenhuma falha nos dados do CRM e dos Serviços gerados que afete a comissão.</div>;
  const tipos = Object.keys(TIPOS_CONFERENCIA).filter((t) => itens.some((i) => i.tipo === t));
  return (
    <Card semPad>
      <div className="card-cab"><h2>O que corrigir</h2><span className="suave peq">{itens.length} ponto(s) nos dados que mexem na comissão · corrija na origem e clique em Atualizar</span></div>
      <div style={{ display: "grid" }}>
        {tipos.map((t) => {
          const xs = itens.filter((i) => i.tipo === t);
          return (
            <div key={t} style={{ borderTop: "1px solid var(--linha-fraca)" }}>
              <button type="button" onClick={() => setAberto(aberto === t ? "" : t)} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "12px 20px", background: "none", border: 0, cursor: "pointer", textAlign: "left", font: "inherit" }} aria-expanded={aberto === t}>
                <span><Chip tom={t === "crmStatus" || t === "semCadastro" ? "ruim" : "alerta"}>{xs.length}</Chip> <b style={{ fontWeight: 600, marginLeft: 6 }}>{TIPOS_CONFERENCIA[t]}</b></span>
                <span className="suave peq">{aberto === t ? "fechar ▴" : "ver ▾"}</span>
              </button>
              {aberto === t && (
                <div style={{ padding: "0 20px 14px" }}>
                  <div className="aviso marca peq" style={{ marginBottom: 8 }}><b>Como corrigir:</b> {xs[0].corrigir}</div>
                  <div className="tabela-caixa tabela-comissao">
                    <table>
                      <thead><tr><th>Proposta</th><th>Colaborador</th><th>O que está errado</th></tr></thead>
                      <tbody>
                        {xs.map((i) => (
                          <tr key={i.proposta + i.tipo}>
                            <td><span className="tnum">{i.proposta}</span><div className="suave peq" style={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.cliente}</div></td>
                            <td className="peq">{nomeCurto(i.colab.nome)}</td>
                            <td className="peq">{i.texto}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
