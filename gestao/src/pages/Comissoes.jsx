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
  const [aba, setAba] = useState("propostas");
  const [editando, setEditando] = useState(null);
  const [vendo, setVendo] = useState(null);
  const [importando, setImportando] = useState(false);
  const [quem, setQuem] = useState("");

  const registros = dados.comissoes || [];
  const colabs = useMemo(() => registros.filter((r) => r.tipo === "colaborador").sort((a, b) => (a.ativo === false) - (b.ativo === false) || String(a.nome).localeCompare(String(b.nome), "pt-BR")), [registros]);
  const pagamentos = useMemo(() => registros.filter((r) => r.tipo === "pagamento").sort((a, b) => String(b.pagoEm).localeCompare(String(a.pagoEm)) || String(b.criadoEm).localeCompare(String(a.criadoEm))), [registros]);
  const ids = [...new Set(colabs.map((c) => c.crmId).filter(Boolean))].sort();
  const numeros = useMemo(() => [...new Set(registros.filter((r) => r.tipo === "planilha").flatMap((r) => (r.linhas || []).map((l) => l.proposta)))].sort(), [registros]);
  const crm = useCRM(`comissoes:${ids.join(",")}:${numeros.length}`, () => comissoesCRM(ids, numeros));
  const pessoasCRM = crm.dados?.pessoas || [];

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

  const soma = (f) => centavos(contas.reduce((s, x) => s + f(x), 0));
  const mes = mesAtual();
  const ano = mes.slice(0, 4);
  const pagoAno = centavos(pagamentos.filter((p) => String(p.pagoEm).startsWith(ano)).reduce((s, p) => s + Number(p.total || 0), 0));
  const atual = contas.find((x) => x.c.id === quem) || contas.find((x) => x.ex.totais.aPagar > 0) || contas[0];
  const nomeDe = (id) => nomeCurto(colabs.find((c) => c.id === id)?.nome || "") || "—";

  return (
    <>
      <Cabecalho sobre="Comissões" titulo="Comissão por proposta" sub="Cada proposta: quanto vale, quanto já virou OS, quanto foi faturado, quanto gerou de comissão (1% das OS faturadas), quanto já foi pago e quanto falta pagar.">
        <button type="button" className="btn claro" onClick={crm.recarregar}>Atualizar</button>
        <button type="button" className="btn claro" disabled={!crm.dados} onClick={() => setImportando(true)}>Importar planilha antiga</button>
        <button type="button" className="btn" onClick={() => setEditando({ novo: true })}>Novo colaborador</button>
      </Cabecalho>
      {crm.erro && <div className="aviso ruim">{crm.erro}</div>}
      {crm.carregando && <div className="carregando">Lendo propostas e serviços gerados…</div>}
      {crm.dados && (
        <>
          <div className="grade grade-kpi">
            <Kpi rotulo="Falta pagar" valor={brl(soma((x) => x.ex.totais.aPagar))} sub={`${contas.filter((x) => x.ex.totais.aPagar > 0).length} colaborador(es)`} />
            <Kpi rotulo={`Gerada em ${mesLongo(mes).toLowerCase()}`} valor={brl(soma((x) => geradaNoMes(x.ex, mes)))} sub="1% das notas emitidas no mês" />
            <Kpi rotulo="Vem por aí" valor={brl(soma((x) => x.ex.totais.previsao))} sub="OS prontas para faturar" />
            <Kpi rotulo={`Pago em ${ano}`} valor={brl(pagoAno)} sub="planilha e sistema" />
          </div>
          <Abas valor={aba} aoMudar={setAba} abas={[
            ["propostas", "Por proposta"],
            ["pagamentos", "Pagamentos", pagamentos.length || ""],
            ["colaboradores", "Colaboradores", colabs.length || ""],
          ]} />
          {colabs.length === 0 && <div className="aviso marca">Cadastre quem recebe comissão em “Novo colaborador”, ou traga o histórico em “Importar planilha antiga”.</div>}
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
  ["aPagar", "Falta pagar", (l) => l.aPagar > 0],
  ["todas", "Todas", () => true],
  ["faltaGerar", "Falta gerar OS", (l) => l.faltaGerar > 0],
  ["adiantado", "Pago adiantado", (l) => l.adiantado > 0],
];

function Extrato({ conta, gravar, nomeDe }) {
  const { c, ex } = conta;
  const t = ex.totais;
  const [filtro, setFiltro] = useState(t.aPagar > 0 ? "aPagar" : "todas");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState("");
  const [desmarcadas, setDesmarcadas] = useState(() => new Set());
  const [pagando, setPagando] = useState(false);
  const q = busca.trim().toLowerCase();
  const f = FILTROS.find((x) => x[0] === filtro)[2];
  const lista = ex.linhas.filter((l) => f(l) && (!q || l.numero.includes(q) || l.cliente.toLowerCase().includes(q)));
  const pag = usePaginacao(lista, 20, `${filtro}|${q}`);
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
          <Num rot="Cliente pagou" v={brl(t.pagoCliente)} />
          <Num rot="Comissão gerada" v={brl(t.gerada)} />
          <Num rot="Já pago" v={brl(t.pago)} />
          <Num rot="Falta pagar" v={brl(t.aPagar)} forte tom={t.aPagar > 0 ? "alerta-tx" : undefined} />
          {t.adiantado > 0 && <Num rot="Pago adiantado" v={brl(t.adiantado)} />}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "12px 20px" }}>
        <div className="pilulas" role="group" aria-label="Filtro">
          {FILTROS.map(([id, rot, fx]) => {
            const n = ex.linhas.filter(fx).length;
            return <button key={id} type="button" className={`pilula${filtro === id ? " ativa" : ""}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{rot} ({n})</button>;
          })}
        </div>
        <input className="entrada" style={{ flex: "1 1 200px", minHeight: 36 }} placeholder="Buscar proposta ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar proposta ou cliente" />
      </div>
      {lista.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma proposta neste filtro.</div> : (
        <div className="tabela-caixa tabela-comissao">
          <table>
            <thead><tr>
              <th style={{ width: 32 }} />
              <th>Proposta</th><th style={D}>Valor</th><th style={D}>OS geradas</th><th style={D}>Faturado</th><th style={D}>Cliente pagou</th><th style={D}>Comissão</th><th style={D}>Pago</th><th style={D}>Falta pagar</th>
            </tr></thead>
            <tbody>
              {pag.itens.map((l) => (
                <Fragment key={l.numero}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setAberta(aberta === l.numero ? "" : l.numero)}>
                    <td onClick={(e) => e.stopPropagation()}>{l.aPagar > 0 && <input type="checkbox" aria-label={`Pagar a proposta ${l.numero}`} checked={!desmarcadas.has(l.numero)} onChange={() => alternar(l.numero)} />}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <b className="tnum" style={{ fontWeight: 600 }}>{l.numero}</b>
                        {l.origem === "planilha" && <Chip tom="neutro">planilha</Chip>}
                        {l.status && l.status !== "APROVADA" && <Chip tom="ruim">{l.status.toLowerCase()} no CRM</Chip>}
                        <span className="suave peq">{aberta === l.numero ? "▾" : "▸"}</span>
                      </div>
                      <div className="suave peq" title={l.cliente} style={{ maxWidth: 230, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.cliente || "—"}</div>
                    </td>
                    <td className="tnum" style={D}>{brl(l.valorProposta)}</td>
                    <td className="tnum" style={D}>{brl(l.geradas)}<div className="suave peq">{l.osGeradas} OS{l.faltaGerar > 0 ? ` · falta ${brl(l.faltaGerar)}` : ""}</div></td>
                    <td className="tnum" style={D}>{brl(l.faturado)}</td>
                    <td className="tnum" style={D}>{brl(l.pagoCliente)}</td>
                    <td className="tnum" style={D}>{brl(l.gerada)}</td>
                    <td className="tnum" style={D}>{brl(l.pago)}</td>
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
      {pagando && <RegistrarPagamento colab={c} linhas={pagaveis} total={totalSel} gravar={gravar} aoFechar={() => setPagando(false)} />}
    </Card>
  );
}

function DetalheProposta({ l, nomeDe }) {
  const situacaoOS = (o) => o.cancelada ? <Chip tom="ruim">cancelada</Chip> : o.faturada ? <Chip tom="ok">faturada</Chip> : o.aFaturar ? <Chip tom="alerta">pronta para faturar</Chip> : <Chip>{String(o.fat || "—").toLowerCase()}</Chip>;
  return (
    <div style={{ padding: "12px 16px 16px", display: "grid", gap: 12 }}>
      <div className="peq">
        <b>Como chegou nesta conta:</b> {l.osGeradas} OS geradas ({brl(l.geradas)}), {brl(l.faturado)} faturados → comissão {brl(l.gerada)} · já pago {brl(l.pago)} ·{" "}
        {l.aPagar > 0 ? <b>falta pagar {brl(l.aPagar)}</b> : l.adiantado > 0 ? <>pago adiantado {brl(l.adiantado)} (é descontado das próximas OS)</> : "em dia"}
        {l.aceite ? <> · aceite em {dataCurta(l.aceite)}</> : null}
      </div>
      <div className="tabela-caixa" style={{ background: "#fff", borderRadius: 10 }}>
        <table>
          <thead><tr><th>OS</th><th>Gerada em</th><th style={D}>Valor</th><th>Situação</th><th>NF</th><th>Cliente</th><th style={D}>Comissão</th></tr></thead>
          <tbody>
            {l.os.length === 0 && <tr><td colSpan={7} className="suave">Nenhuma OS gerada ainda para esta proposta.</td></tr>}
            {l.os.map((o) => (
              <tr key={o.id} style={o.cancelada ? { opacity: 0.55 } : undefined}>
                <td className="tnum peq">{o.os}</td>
                <td className="tnum peq">{dataCurta(o.dataOs)}</td>
                <td className="tnum" style={D}>{brl(o.valor)}</td>
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
          <thead><tr><th>Pagamento</th><th>Para</th><th>Origem</th><th style={D}>Valor</th></tr></thead>
          <tbody>
            {l.pagamentos.length === 0 && <tr><td colSpan={4} className="suave">Nenhuma comissão paga desta proposta ainda.</td></tr>}
            {l.pagamentos.map((p, i) => (
              <tr key={i}>
                <td className="tnum peq">{p.planilha && p.obs.includes("sem o mês") ? "sem data (planilha)" : dataCurta(p.pagoEm)}</td>
                <td className="peq">{nomeDe(p.colaboradorId)}</td>
                <td className="peq">{p.planilha ? "planilha antiga" : "registrado no sistema"}</td>
                <td className="tnum" style={D}>{brl(p.valor)}</td>
              </tr>
            ))}
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
              {c.ativo === false ? <Chip>só a planilha</Chip> : <Chip tom="ok">pega propostas novas</Chip>}
            </div>
            <div className="peq" style={{ marginTop: 10, lineHeight: 1.7 }}>
              {c.ativo === false ? "Só as propostas da planilha antiga" : <>Propostas aprovadas a partir de <b>{dataCurta(c.desde)}</b></>} · {ex.totais.propostas} propostas · gerada {brl(ex.totais.gerada)} · pago {brl(ex.totais.pago)} · falta {brl(ex.totais.aPagar)}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {[...(c.taxas || [])].sort((a, b) => String(a.desde).localeCompare(String(b.desde))).map((t) => <Chip key={t.desde} tom="marca">{pctTxt(t.pct)} desde {dataCurta(t.desde)}</Chip>)}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button type="button" className="btn claro mini" onClick={() => aoEditar(c)}>Editar</button>
              <button type="button" className="btn perigo mini" onClick={() => excluir(c)}>Excluir</button>
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
