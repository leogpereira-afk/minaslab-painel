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
  mesDaFolha, folhaSugerida, fechamentoDoMes, fimDoMes,
} from "../lib/comissoesProposta.js";

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
  const [fechando, setFechando] = useState(false);
  const [quem, setQuem] = useState("");

  const todosRegistros = dados.comissoes || [];
  // Quem foi tirado das comissões (registro tipo "excluido" por usuário do CRM): some de tudo, mas o histórico fica guardado.
  const excluidos = useMemo(() => todosRegistros.filter((r) => r.tipo === "excluido"), [todosRegistros]);
  const foraIds = useMemo(() => {
    const crm = new Set(excluidos.map((r) => r.crmId));
    return new Set([...[...crm].map((id) => `auto_${id}`), ...todosRegistros.filter((r) => r.tipo === "colaborador" && crm.has(r.crmId)).map((r) => r.id)]);
  }, [excluidos, todosRegistros]);
  const registros = useMemo(() => todosRegistros.filter((r) => r.tipo !== "excluido" && !foraIds.has(r.tipo === "colaborador" ? r.id : r.colaboradorId)), [todosRegistros, foraIds]);
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
    const todos = colaboradoresComAutomaticos(gravados, pessoasCRM, crm.dados?.propostas || []).filter((c) => !foraIds.has(c.id));
    // Dono de proposta da planilha sem cadastro (ex.: id auto_ de quem não tem proposta nova).
    for (const r of registros) if (r.tipo === "planilha" && !todos.some((c) => c.id === r.colaboradorId)) {
      const crmId = String(r.colaboradorId).replace(/^auto_/, "");
      todos.push({ id: r.colaboradorId, tipo: "colaborador", nome: String(r.nome || pessoasCRM.find((p) => p.id === crmId)?.nome || "Colaborador").toLocaleUpperCase("pt-BR"), crmId, desde: DESDE_PADRAO, taxas: [{ desde: DESDE_PADRAO, pct: 1 }], ativo: false, automatico: true });
    }
    // Desligamento: o que você marcar aqui vale; se não marcou, vale a data da ficha do RH (vem só a data).
    const comRH = todos.map((c) => {
      const pe = pessoasCRM.find((p) => p.id === c.crmId);
      const manual = c.desligadoEm || "";
      return { ...c, desligadoManual: manual, desligadoRH: pe?.desligadoEm || "", situacaoRH: pe?.rh || "", desligadoEm: manual || pe?.desligadoEm || "" };
    });
    return comRH.sort((a, b) => (a.ativo === false) - (b.ativo === false) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }, [gravados, pessoasCRM, crm.dados, registros, foraIds]);

  const contas = useMemo(() => {
    if (!crm.dados) return [];
    const osPorProposta = new Map();
    for (const o of crm.dados.os) osPorProposta.set(o.proposta, [...(osPorProposta.get(o.proposta) || []), o]);
    const base = {
      dono: donosDasPropostas(colabs, registros, crm.dados.propostas),
      propsPorNumero: new Map(crm.dados.propostas.map((p) => [p.numero, p])),
      osPorProposta, pagos: pagosPorProposta(pagamentos),
    };
    // Quem não tem nenhuma proposta (nem pagamento) não aparece.
    return colabs.map((c) => ({ c, ex: extratoColaborador(c, { ...base, planilha: linhasPlanilha(registros, c.id) }) }))
      .filter((x) => x.ex.linhas.length || pagamentos.some((p) => p.colaboradorId === x.c.id) || gravados.some((g) => g.id === x.c.id));
  }, [crm.dados, colabs, registros, pagamentos, gravados]);
  const recarregar = () => { lista.recarregar(); crmDados.recarregar(); };

  const soma = (f) => centavos(contas.reduce((s, x) => s + f(x), 0));
  const mes = mesAtual();
  const ano = mes.slice(0, 4);
  const pagoAno = centavos(pagamentos.filter((p) => String(p.pagoEm).startsWith(ano)).reduce((s, p) => s + Number(p.total || 0), 0));
  const atual = contas.find((x) => x.c.id === quem) || contas.find((x) => x.ex.totais.aPagar > 0) || contas[0];
  const nomeDe = (id) => nomeCurto(colabs.find((c) => c.id === id)?.nome || "") || "—";

  return (
    <>
      <Cabecalho sobre="Comissões" titulo="Comissões" sub={`1% de cada OS com nota emitida, das propostas aprovadas no CRM desde ${dataCurta(DESDE_PADRAO)} (por responsável comercial). OS sem nota aparece como prevista. Propostas já pagas antes do sistema ficam quitadas (histórico).`}>
        <button type="button" className="btn claro" onClick={recarregar}>Atualizar</button>
        <button type="button" className="btn claro" onClick={() => setEditando({ novo: true })}>Novo colaborador</button>
        <button type="button" className="btn" disabled={!crm.dados} onClick={() => setFechando(true)}>Fechar mês</button>
      </Cabecalho>
      {crm.erro && <div className="aviso ruim">{crm.erro}</div>}
      {crm.carregando && <div className="carregando">Lendo propostas e serviços gerados…</div>}
      {crm.dados && (
        <>
          {aba !== "resumo" && <div className="grade grade-kpi">
            <Kpi rotulo="Falta pagar" valor={brl(soma((x) => x.ex.totais.aPagar))} sub={`${contas.filter((x) => x.ex.totais.aPagar > 0).length} colaborador(es)`} />
            <Kpi rotulo={`Gerada em ${mesLongo(mes).toLowerCase()}`} valor={brl(soma((x) => geradaNoMes(x.ex, mes)))} sub="1% das notas emitidas no mês" />
            <Kpi rotulo="Vem por aí" valor={brl(soma((x) => x.ex.totais.previsao))} sub="OS prontas para faturar" />
            <Kpi rotulo={`Pago em ${ano}`} valor={brl(pagoAno)} sub="histórico e sistema" />
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
          {aba === "colaboradores" && <Colaboradores contas={contas} pessoasCRM={pessoasCRM} aoEditar={setEditando} gravar={gravar} remover={remover} registros={registros} excluidos={excluidos} />}
        </>
      )}
      {fechando && <FecharMes contas={contas} gravar={gravar} aoFechar={() => setFechando(false)} />}
      {editando && <EditarColaborador inicial={editando} pessoasCRM={pessoasCRM} aoFechar={() => setEditando(null)} gravar={gravar} remover={remover} colabs={colabs} temPagamento={(id) => registros.some((r) => (r.tipo === "pagamento" || r.tipo === "planilha") && r.colaboradorId === id)} />}
      {vendo && <VerPagamento {...vendo} aoFechar={() => setVendo(null)} />}
    </>
  );
}

const FILTROS = [
  ["todas", "Todas", () => true],
  ["aPagar", "Liberado para pagar", (l) => l.aPagar > 0],
  ["aguardando", "Aguardando faturar", (l) => !l.quitada && !l.encerrada && l.semNF > 0],
  ["pago", "Pago", (l) => l.aPagar === 0 && l.pago > 0],
  ["semOS", "Sem OS ainda", (l) => l.osGeradas === 0 && statusProposta(l) !== "cancelada"],
  ["adiantado", "Pago adiantado", (l) => l.adiantado > 0],
];
const STATUS_ORDEM = ["pendente", "andamento", "finalizada", "cancelada", "encerrada"];
const rotMes = (m) => (m === "sem" ? "Sem mês (histórico)" : mesLongo(m));

/** Situação do PAGAMENTO da comissão da proposta, em uma palavra (o que importa para pagar). */
function situacaoPagamento(l) {
  if (l.encerrada) return { tom: "neutro", rotulo: "Encerrada (desligamento)", sub: l.naoPago > 0 ? `${brl(l.naoPago)} não conta` : "" };
  if (l.quitada) return { tom: "ok", rotulo: "Paga (histórico)", sub: "" };
  if (l.aPagar > 0) return { tom: "marca", rotulo: `Liberado ${brl(l.aPagar)}`, sub: l.semNF > 0 ? `+ ${brl(l.previsao)} quando faturar o resto` : "OS faturada, pode pagar" };
  if (statusProposta(l) === "cancelada") return { tom: "ruim", rotulo: "Cancelada", sub: "" };
  if (l.osGeradas === 0) return { tom: "neutro", rotulo: "Sem OS ainda", sub: "nada a pagar por enquanto" };
  if (l.semNF > 0) return { tom: "alerta", rotulo: "Aguardando faturar", sub: `${brl(l.previsao)} libera com a NF` };
  if (l.adiantado > 0) return { tom: "neutro", rotulo: `Pago adiantado ${brl(l.adiantado)}`, sub: "" };
  if (l.pago > 0) return { tom: "ok", rotulo: "Pago", sub: "" };
  return { tom: "neutro", rotulo: "—", sub: "" };
}

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
  const linhaAberta = ex.linhas.find((l) => l.numero === aberta);
  const Bloco = ({ rot, v, sub, tom }) => (
    <div style={{ flex: "1 1 180px", borderRadius: 12, padding: "12px 14px", background: tom === "marca" ? "var(--marca-50)" : tom === "alerta" ? "#fffbeb" : "#f8fafa", border: `1px solid ${tom === "marca" ? "var(--marca-200)" : tom === "alerta" ? "#fde68a" : "var(--linha)"}` }}>
      <div className="peq" style={{ fontWeight: 600 }}>{rot}</div>
      <div className="tnum" style={{ fontWeight: 700, fontSize: 20, marginTop: 2 }}>{v}</div>
      <div className="suave peq">{sub}</div>
    </div>
  );
  return (
    <Card semPad>
      <div style={{ padding: "18px 20px 6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <h2>{nomeCurto(c.nome)}</h2>
          <span className="suave peq">
            {c.ativo === false ? "Só o histórico de pagas" : `Propostas aprovadas desde ${dataCurta(c.desde)}`} · taxa {pctTxt(taxaAtual(c, hojeBR()))}
          </span>
        </div>
        {c.desligadoEm && <div className="aviso marca" style={{ marginTop: 10 }}>Desligada em <b>{dataCurta(c.desligadoEm)}</b>{c.desligadoManual ? "" : " (data da ficha do RH)"}: a comissão está encerrada. Nada fica pendente nem previsto{t.naoPago > 0 ? <> ({brl(t.naoPago)} gerados e não pagos não contam)</> : null}; propostas aceitas depois do desligamento não entram.</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <Bloco tom="marca" rot="Liberado para pagar" v={brl(t.aPagar)} sub={`${ex.linhas.filter((l) => l.aPagar > 0).length} proposta(s) com OS faturada (NF emitida)`} />
          <Bloco tom="alerta" rot="Aguardando faturar" v={brl(t.previsao)} sub="libera quando a NF for emitida" />
          <Bloco rot="Já pago" v={brl(t.pago)} sub={t.adiantado > 0 ? `${brl(t.adiantado)} pago adiantado` : "histórico e sistema"} />
          <Bloco rot="Propostas" v={t.propostas} sub={`${brl(t.valorProposta)} · ${brl(t.faturado)} já faturado`} />
        </div>
        <p className="suave peq" style={{ margin: "10px 0 0" }}>A comissão ({pctTxt(taxaAtual(c, hojeBR()))}) só é liberada quando a OS fica <b>faturada, com NF emitida</b>, em Serviços gerados. Clique numa proposta para ver as OS dela.</p>
      </div>
      <div style={{ padding: "8px 20px 0" }}>
        <Abas valor={ver} aoMudar={setVer} abas={[["propostas", "Propostas", ex.linhas.length], ["os", "Todas as OS", ex.linhas.reduce((n, l) => n + l.os.length, 0)]]} />
      </div>
      {ver === "os" ? <ListaOS ex={ex} nome={nomeCurto(c.nome)} /> : <>
      <div style={{ display: "grid", gap: 8, padding: "12px 20px" }}>
        <div className="pilulas" role="group" aria-label="Situação do pagamento">
          {FILTROS.filter(([id, , fx]) => id !== "adiantado" || ex.linhas.some(fx)).map(([id, rot, fx]) => <button key={id} type="button" className={`pilula${filtro === id ? " ativa" : ""}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{rot} ({ex.linhas.filter(fx).length})</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select className="entrada" style={{ minHeight: 36, flex: "0 1 210px" }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação da proposta">
            <option value="">Proposta: todas as situações</option>
            {STATUS_ORDEM.filter((id) => id !== "encerrada" || c.desligadoEm).map((id) => <option key={id} value={id}>{STATUS_PROPOSTA[id].rotulo} ({ex.linhas.filter((l) => statusProposta(l) === id).length})</option>)}
          </select>
          <select className="entrada" style={{ minHeight: 36, flex: "0 1 210px" }} value={mesPago} onChange={(e) => { setMesPago(e.target.value); if (e.target.value) setFiltro("todas"); }} aria-label="Pago no mês">
            <option value="">Pago em: qualquer mês</option>
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
              <th>Proposta</th><th style={D}>Valor</th><th style={D}>OS faturadas</th><th style={D}>Comissão liberada</th><th style={D}>{mesPago ? "Pago no mês" : "Já pago"}</th><th>Pagamento</th>
            </tr></thead>
            <tbody>
              {pag.itens.map((l) => {
                const s = situacaoPagamento(l);
                const vivas = l.os.filter((o) => !o.cancelada), fat = vivas.filter((o) => o.faturada).length;
                return (
                  <tr key={l.numero} style={{ cursor: "pointer" }} onClick={() => setAberta(l.numero)} title="Ver as OS e os pagamentos desta proposta">
                    <td onClick={(e) => e.stopPropagation()}>{l.aPagar > 0 && <input type="checkbox" aria-label={`Pagar a proposta ${l.numero}`} checked={!desmarcadas.has(l.numero)} onChange={() => alternar(l.numero)} />}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <b className="tnum" style={{ fontWeight: 600, color: "var(--marca)" }}>{l.numero}</b>
                        <span className="suave peq">{STATUS_PROPOSTA[statusProposta(l)].rotulo.toLowerCase()}</span>
                        {l.status && l.status !== "APROVADA" && <Chip tom="ruim">{l.status.toLowerCase()} no CRM</Chip>}
                      </div>
                      <div className="suave peq" title={l.cliente} style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.cliente || "—"}</div>
                    </td>
                    <td className="tnum" style={D}>{brl(l.valorProposta)}</td>
                    <td className="tnum" style={D}>{vivas.length ? <>{fat} de {vivas.length}<div className="suave peq">{brl(l.faturado)}</div></> : <span className="suave">—</span>}</td>
                    <td className="tnum" style={D}>{brl(l.gerada)}</td>
                    <td className="tnum" style={D}>{mesPago ? <>{brl(pagoNoMes(l))}<div className="suave peq">total {brl(l.pago)}</div></> : brl(l.pago)}</td>
                    <td><Chip tom={s.tom}>{s.rotulo}</Chip>{s.sub && <div className="suave peq" style={{ marginTop: 2 }}>{s.sub}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Paginacao pag={pag} rotulo="propostas" />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 20px 18px", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn claro mini" onClick={() => baixar(`comissao-${nomeCurto(c.nome).replace(/\s+/g, "-").toLowerCase()}.csv`, csvExtrato(lista, `Comissão por proposta · ${nomeCurto(c.nome)}`))}>Baixar Excel</button>
        <button type="button" className="btn" disabled={!pagaveis.length} onClick={() => setPagando(true)}>Registrar pagamento de {brl(totalSel)} ({pagaveis.length} proposta{pagaveis.length === 1 ? "" : "s"})</button>
      </div>
      </>}
      {linhaAberta && <DetalheProposta l={linhaAberta} nomeDe={nomeDe} aoFechar={() => setAberta("")} />}
      {pagando && <RegistrarPagamento colab={c} linhas={pagaveis} total={totalSel} gravar={gravar} aoFechar={() => setPagando(false)} />}
    </Card>
  );
}

/** Janela da proposta: pode pagar? quanto? por quê? (OS por OS e os pagamentos). */
function DetalheProposta({ l, nomeDe, aoFechar }) {
  const s = situacaoPagamento(l);
  // O que já foi pago cobre as OS faturadas na ordem da nota (a mais antiga primeiro).
  let resto = l.quitada ? Infinity : l.pago;
  const pagamentoOS = new Map();
  for (const o of [...l.os].filter((o) => o.faturada).sort((a, b) => String(a.emissao).localeCompare(String(b.emissao)))) {
    if (resto >= o.comissao - 0.005) { pagamentoOS.set(o.id, "paga"); resto -= o.comissao; }
    else if (resto > 0.005) { pagamentoOS.set(o.id, "parte"); resto = 0; }
    else pagamentoOS.set(o.id, l.encerrada ? "encerrada" : "apagar");
  }
  const vivas = l.os.filter((o) => !o.cancelada);
  const resposta = l.encerrada ? { tom: "neutro", txt: <>Comissão <b>encerrada</b> pelo desligamento{l.naoPago > 0 ? <>: {brl(l.naoPago)} não pagos não contam</> : null}.</> }
    : l.quitada ? { tom: "ok", txt: <>Proposta <b>já paga</b> antes do sistema (histórico). Nada a pagar.</> }
    : l.aPagar > 0 ? { tom: "marca", txt: <><b>Pode liberar o pagamento: {brl(l.aPagar)}.</b> {[...pagamentoOS.values()].filter((x) => x !== "paga").length} OS faturada(s), com NF emitida, ainda sem comissão paga.{l.semNF > 0 ? <> Outras OS ainda aguardam faturar ({brl(l.previsao)} quando a NF sair).</> : null}</> }
    : l.osGeradas === 0 ? { tom: "neutro", txt: <>Ainda <b>não tem OS</b> gerada para esta proposta. A comissão só começa quando a OS for gerada e faturada.</> }
    : l.semNF > 0 ? { tom: "alerta", txt: <><b>Ainda não.</b> As OS desta proposta estão aguardando faturar. Quando a NF for emitida, {brl(l.previsao)} fica liberado.</> }
    : l.adiantado > 0 ? { tom: "neutro", txt: <>Foi pago {brl(l.adiantado)} a mais (adiantado); é descontado das próximas OS.</> }
    : { tom: "ok", txt: <><b>Em dia:</b> toda a comissão liberada desta proposta já foi paga.</> };
  const fundo = { marca: ["var(--marca-50)", "var(--marca-200)"], alerta: ["#fffbeb", "#fde68a"], ok: ["#f0fdf4", "#bbf7d0"], neutro: ["#f8fafa", "var(--linha)"] }[resposta.tom];
  const Num = ({ rot, v, sub }) => <div style={{ minWidth: 130 }}><div className="suave peq">{rot}</div><div className="tnum" style={{ fontWeight: 700 }}>{v}</div>{sub && <div className="suave peq">{sub}</div>}</div>;
  const faturamento = (o) => o.cancelada ? <Chip tom="ruim">Cancelada</Chip>
    : o.faturada ? <><Chip tom="ok">Faturada</Chip><div className="suave peq">{o.nf ? `NF ${o.nf} · ` : ""}{dataCurta(o.emissao)}</div></>
    : o.aFaturar ? <Chip tom="alerta">Pronta para faturar</Chip> : <Chip tom="neutro">{String(o.fat || "aguardando").toLowerCase()}</Chip>;
  const pagamento = (o) => {
    if (o.cancelada) return <span className="suave">—</span>;
    if (!o.faturada) return <span className="suave peq">{l.quitada ? "paga (histórico)" : l.encerrada ? "encerrada" : "libera com a NF"}</span>;
    const x = pagamentoOS.get(o.id);
    return x === "paga" ? <Chip tom="ok">paga</Chip> : x === "parte" ? <Chip tom="alerta">parte paga</Chip> : x === "encerrada" ? <Chip tom="neutro">encerrada</Chip> : <Chip tom="marca">liberada · a pagar</Chip>;
  };
  return (
    <Modal titulo={`Proposta ${l.numero}`} aoFechar={aoFechar} largo>
      <div style={{ display: "grid", gap: 14 }}>
        <div className="peq" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <b>{l.cliente || "—"}</b>
          <Chip tom={STATUS_PROPOSTA[statusProposta(l)].tom}>{STATUS_PROPOSTA[statusProposta(l)].rotulo}</Chip>
          {l.aceite && <span className="suave">aceite em {dataCurta(l.aceite)}</span>}
          {l.status && l.status !== "APROVADA" && <Chip tom="ruim">{l.status.toLowerCase()} no CRM · corrigir</Chip>}
        </div>
        <div style={{ background: fundo[0], border: `1px solid ${fundo[1]}`, borderRadius: 12, padding: "12px 14px", lineHeight: 1.5 }}>{resposta.txt}</div>
        <div style={{ display: "flex", gap: "12px 28px", flexWrap: "wrap" }}>
          <Num rot="Valor da proposta" v={brl(l.valorProposta)} sub={l.faltaGerar > 0 ? `${brl(l.faltaGerar)} ainda não virou OS` : "toda já virou OS"} />
          <Num rot="Virou OS" v={brl(l.geradas)} sub={`${vivas.length} OS`} />
          <Num rot="Faturado (NF emitida)" v={brl(l.faturado)} sub={l.semNF > 0 ? `${brl(l.semNF)} aguardando faturar` : ""} />
          <Num rot="Comissão liberada" v={brl(l.gerada)} sub={`já paga ${brl(l.pago)}`} />
          <Num rot="Situação" v={<Chip tom={s.tom}>{s.rotulo}</Chip>} />
        </div>
        <div className="tabela-caixa tabela-comissao" style={{ border: "1px solid var(--linha)", borderRadius: 10 }}>
          <table>
            <thead><tr><th>OS</th><th>Gerada em</th><th style={D}>Valor</th><th>Faturamento</th><th style={D}>Comissão</th><th>Pagamento</th></tr></thead>
            <tbody>
              {l.os.length === 0 && <tr><td colSpan={6} className="suave">Nenhuma OS gerada ainda para esta proposta.</td></tr>}
              {l.os.map((o) => (
                <tr key={o.id} style={o.cancelada ? { opacity: 0.55 } : undefined}>
                  <td className="tnum">{o.os}<div className="suave peq" style={{ maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={o.servico}>{o.servico}</div></td>
                  <td className="tnum peq">{dataCurta(o.dataOs)}</td>
                  <td className="tnum" style={D}>{brl(o.valor)}</td>
                  <td>{faturamento(o)}</td>
                  <td className="tnum" style={D}>{o.faturada ? brl(o.comissao) : o.cancelada ? "—" : <span className="suave">{brl(centavos((o.valor * (o.pct || 0)) / 100))} prevista</span>}</td>
                  <td>{pagamento(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="peq" style={{ fontWeight: 600, marginBottom: 6 }}>Pagamentos desta proposta</div>
          {l.quitada ? <div className="suave peq">Quitada antes do sistema (histórico): toda a comissão desta proposta conta como paga ({brl(l.pago)}).</div>
            : l.pagamentos.length === 0 ? <div className="suave peq">Nenhuma comissão paga desta proposta ainda.</div>
            : <div className="tabela-caixa tabela-comissao" style={{ border: "1px solid var(--linha)", borderRadius: 10 }}>
              <table>
                <thead><tr><th>Mês da folha</th><th>Pago em</th><th>Para</th><th style={D}>Valor</th></tr></thead>
                <tbody>
                  {l.pagamentos.map((p, i) => (
                    <tr key={i}><td className="peq">{rotMes(mesDoPagamentoItem(p))}</td><td className="tnum peq">{p.planilha && p.obs.includes("sem o mês") ? "sem data" : dataCurta(p.pagoEm)}{p.planilha ? <span className="suave"> · histórico</span> : null}</td><td className="peq">{nomeDe(p.colaboradorId)}</td><td className="tnum" style={D}>{brl(p.valor)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn" onClick={aoFechar}>Fechar</button></div>
      </div>
    </Modal>
  );
}

function RegistrarPagamento({ colab, linhas, total, gravar, aoFechar }) {
  const [folha, setFolha] = useState(folhaSugerida(hojeBR()));
  const [pagoEm, setPagoEm] = useState(fimDoMes(folhaSugerida(hojeBR())));
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pagoEm)) return setErro("Informe a data do pagamento.");
    if (!/^\d{4}-\d{2}$/.test(folha)) return setErro("Informe o mês da folha.");
    setSalvando(true); setErro("");
    try {
      await gravar("comissoes", { tipo: "pagamento", colaboradorId: colab.id, nome: colab.nome, folha, pagoEm, obs: obs.trim(), itens: itensPagamentoPropostas(linhas), total });
      aoFechar();
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  return (
    <Modal titulo={`Pagamento · ${nomeCurto(colab.nome)}`} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="aviso marca">{linhas.length} proposta{linhas.length === 1 ? "" : "s"} · <b>{brl(total)}</b></div>
        <div className="campo"><label htmlFor="pg-folha">Mês da folha</label><input id="pg-folha" type="month" className="entrada" value={folha} onChange={(e) => { setFolha(e.target.value); if (/^\d{4}-\d{2}$/.test(e.target.value)) setPagoEm(fimDoMes(e.target.value)); }} /></div>
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
const mesDoPagamento = (p) => (semMes(p) ? "sem" : mesDaFolha(p));

/** Fechar o mês: registra de uma vez o pagamento de tudo que está liberado (nota emitida), por colaborador. */
function FecharMes({ contas, gravar, aoFechar }) {
  const [folha, setFolha] = useState(folhaSugerida(hojeBR()));
  const [pagoEm, setPagoEm] = useState(fimDoMes(folhaSugerida(hojeBR())));
  const corte = /^\d{4}-\d{2}$/.test(folha) ? fimDoMes(folha) : "";
  const grupos = useMemo(() => fechamentoDoMes(contas, corte), [contas, corte]);
  const depois = useMemo(() => centavos(fechamentoDoMes(contas).reduce((s, g) => s + g.total, 0) - grupos.reduce((s, g) => s + g.total, 0)), [contas, grupos]);
  const [fora, setFora] = useState(() => new Set()); // colaborador fora deste fechamento
  const [foraProp, setForaProp] = useState(() => new Set()); // "colab|proposta" fora deste fechamento
  const [abertos, setAbertos] = useState(() => new Set());
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [feitos, setFeitos] = useState(null);
  const chave = (g, l) => `${g.c.id}|${l.numero}`;
  const comEscolha = grupos.map((g) => {
    const linhas = fora.has(g.c.id) ? [] : g.linhas.filter((l) => !foraProp.has(chave(g, l)));
    return { ...g, linhas, total: centavos(linhas.reduce((s, l) => s + l.aPagar, 0)) };
  });
  const marcados = comEscolha.filter((g) => g.linhas.length && g.total > 0);
  const total = centavos(marcados.reduce((s, g) => s + g.total, 0));
  const troca = (set) => (k) => set((f) => { const x = new Set(f); x.has(k) ? x.delete(k) : x.add(k); return x; });
  const alternar = troca(setFora), alternarProp = troca(setForaProp), abrir = troca(setAbertos);
  const salvar = async () => {
    if (!/^\d{4}-\d{2}$/.test(folha)) return setErro("Informe o mês da folha.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pagoEm)) return setErro("Informe a data do pagamento.");
    setSalvando(true); setErro("");
    const ok = [];
    try {
      for (const g of marcados) {
        await gravar("comissoes", { tipo: "pagamento", colaboradorId: g.c.id, nome: g.c.nome, folha, pagoEm, obs: `Fechamento da folha de ${mesLongo(folha).toLowerCase()}`, itens: itensPagamentoPropostas(g.linhas), total: g.total });
        ok.push(g);
      }
      setFeitos(ok);
    } catch (e) {
      setErro(`${ok.length ? `Registrei ${ok.map((g) => nomeCurto(g.c.nome)).join(", ")}; ` : ""}parou em um erro: ${e.message}`);
      setSalvando(false);
    }
  };
  if (feitos) return (
    <Modal titulo="Mês fechado" aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="aviso marca">Registrei {feitos.length} pagamento{feitos.length === 1 ? "" : "s"} da folha de {mesLongo(folha).toLowerCase()} ({brl(centavos(feitos.reduce((s, g) => s + g.total, 0)))}). As propostas ficaram quitadas até aqui.</div>
        <div className="aviso marca">Para o recibo: no Painel, abra <b>Finanças › Recibos › Recibo de pagamento</b> e clique em <b>Trazer comissão do Gestão</b>. Nome, CPF, competência e o valor da comissão entram sozinhos.</div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn" onClick={aoFechar}>Pronto</button></div>
      </div>
    </Modal>
  );
  return (
    <Modal titulo="Fechar mês" aoFechar={aoFechar} largo>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p className="suave peq" style={{ margin: 0 }}>O fechamento é no último dia do mês: entra o que teve nota emitida até {corte ? dataCurta(corte) : "o fim do mês"} e ainda não foi pago. OS sem nota (prevista) e notas emitidas depois ficam para o próximo fechamento{depois > 0 ? ` (${brl(depois)} já emitidos depois de ${corte ? dataCurta(corte) : "o fim do mês"})` : ""}. Clique em “ver propostas” para conferir e desmarcar alguma. Desligados não entram.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="campo" style={{ flex: 1, minWidth: 150 }}><label htmlFor="fm-folha">Mês da folha</label><input id="fm-folha" type="month" className="entrada" value={folha} onChange={(e) => { setFolha(e.target.value); if (/^\d{4}-\d{2}$/.test(e.target.value)) setPagoEm(fimDoMes(e.target.value)); }} /></div>
          <div className="campo" style={{ flex: 1, minWidth: 150 }}><label htmlFor="fm-data">Data do pagamento</label><input id="fm-data" type="date" className="entrada" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} /></div>
        </div>
        {!grupos.length ? <div className="aviso marca">Nada liberado para pagar até {corte ? dataCurta(corte) : "o fim do mês"}: nenhuma OS com nota emitida está sem comissão paga.</div> : <>
          <div className="tabela-caixa tabela-comissao">
            <table>
              <thead><tr><th></th><th>Colaborador</th><th style={D}>Propostas</th><th style={D}>A pagar</th></tr></thead>
              <tbody>
                {grupos.map((g, i) => {
                  const esc = comEscolha[i], aberto = abertos.has(g.c.id);
                  return (
                    <Fragment key={g.c.id}>
                      <tr>
                        <td><input type="checkbox" aria-label={`Incluir ${nomeCurto(g.c.nome)}`} checked={!fora.has(g.c.id)} onChange={() => alternar(g.c.id)} /></td>
                        <td><b>{nomeCurto(g.c.nome)}</b> <button type="button" className="btn claro mini" style={{ marginLeft: 6 }} aria-expanded={aberto} onClick={() => abrir(g.c.id)}>{aberto ? "esconder propostas ▴" : "ver propostas ▾"}</button></td>
                        <td className="tnum" style={D}>{esc.linhas.length}{esc.linhas.length !== g.linhas.length ? <span className="suave peq"> de {g.linhas.length}</span> : null}</td>
                        <td className="tnum" style={{ ...D, fontWeight: 700 }}>{brl(esc.total)}</td>
                      </tr>
                      {aberto && g.linhas.map((l) => (
                        <tr key={l.numero} style={{ background: "#fafcfc", opacity: fora.has(g.c.id) || foraProp.has(chave(g, l)) ? 0.5 : 1 }}>
                          <td />
                          <td className="peq">
                            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                              <input type="checkbox" disabled={fora.has(g.c.id)} checked={!foraProp.has(chave(g, l))} onChange={() => alternarProp(chave(g, l))} />
                              <span><b>Proposta {l.numero}</b> · {l.cliente || "—"}<br /><span className="suave">faturado {brl(l.faturado)} · comissão {brl(l.gerada)}{l.pago > 0 ? ` · já pago ${brl(l.pago)}` : ""}</span></span>
                            </label>
                          </td>
                          <td className="tnum peq" style={D}>{l.os.filter((o) => o.faturada).length} OS c/ NF</td>
                          <td className="tnum" style={D}>{brl(l.aPagar)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                <tr style={{ background: "var(--marca-50)" }}><td></td><td><b>Total</b></td><td className="tnum" style={D}>{marcados.reduce((s, g) => s + g.linhas.length, 0)}</td><td className="tnum" style={{ ...D, fontWeight: 700 }}>{brl(total)}</td></tr>
              </tbody>
            </table>
          </div>
        </>}
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          {grupos.length > 0 && <button type="button" className="btn" disabled={salvando || !marcados.length} onClick={salvar}>{salvando ? "Registrando…" : `Registrar ${marcados.length} pagamento${marcados.length === 1 ? "" : "s"} · ${brl(total)}`}</button>}
        </div>
      </div>
    </Modal>
  );
}

/** Pagamentos mês a mês (mês da folha): uma linha por mês, uma coluna por colaborador. */
function PagamentosPorMes({ pagamentos, nomeDe, aoVer }) {
  const pessoas = [...new Set(pagamentos.map((p) => p.colaboradorId))].sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), "pt-BR"));
  const meses = [...new Set(pagamentos.map(mesDoPagamento))].sort((a, b) => (a === "sem" ? 1 : b === "sem" ? -1 : b.localeCompare(a)));
  const celula = (m, id) => pagamentos.filter((p) => mesDoPagamento(p) === m && p.colaboradorId === id);
  const soma = (ps) => centavos(ps.reduce((s, p) => s + Number(p.total || 0), 0));
  const abrir = (m, id) => {
    const ps = celula(m, id);
    if (!ps.length) return;
    aoVer({ pagamento: { id: "mes", pagoEm: ps[0].pagoEm, planilha: ps.every((p) => p.planilha), obs: [...new Set(ps.map((p) => p.obs).filter(Boolean))].join(" · "), itens: ps.flatMap((p) => p.itens || []), total: soma(ps) }, quem: nomeDe(id), titulo: m === "sem" ? "sem mês da folha no histórico" : mesLongo(m) });
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
                <td>{m === "sem" ? <span className="suave">Sem mês no histórico</span> : mesLongo(m)}</td>
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
  if (!pagamentos.length) return <div className="vazio">Nenhum pagamento registrado ainda. Use “Fechar mês” para registrar.</div>;
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

function Colaboradores({ contas, pessoasCRM, aoEditar, gravar, remover, registros, excluidos }) {
  const [erro, setErro] = useState("");
  const tirar = async (c) => {
    setErro("");
    if (!c.crmId) return setErro("Este colaborador não tem usuário no CRM; use Excluir.");
    if (!window.confirm(`Tirar ${nomeCurto(c.nome)} das comissões? Some das listas e do fechamento; o histórico fica guardado e dá para voltar depois.`)) return;
    try { await gravar("comissoes", { id: `fora_${c.crmId}`, tipo: "excluido", crmId: c.crmId, nome: c.nome }); } catch (e) { setErro(e.message); }
  };
  const voltar = async (r) => { setErro(""); try { await remover("comissoes", r.id); } catch (e) { setErro(e.message); } };
  const excluir = async (c) => {
    setErro("");
    if (registros.some((r) => (r.tipo === "pagamento" || r.tipo === "planilha") && r.colaboradorId === c.id)) return setErro(`${nomeCurto(c.nome)} tem histórico de pagamentos. Para não perder o histórico, desmarque “pega propostas novas” em Editar em vez de excluir.`);
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
            <h2 style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.nome}>{nomeCurto(c.nome)}</h2>
            <div className="suave peq" style={{ marginTop: 2 }}>No CRM: {nomeCRM(c.crmId)}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {c.desligadoEm ? <Chip tom="neutro">desligada em {dataCurta(c.desligadoEm)}{c.desligadoManual ? "" : " (RH)"}</Chip> : c.ativo === false ? <Chip>só histórico</Chip> : <Chip tom="ok">pega propostas novas</Chip>}{c.automatico && <Chip tom="neutro">automático pelo CRM</Chip>}
              {!c.desligadoEm && c.situacaoRH === "ambiguo" && <Chip tom="alerta" title="Há dois cadastros parecidos no RH. Se saiu, marque o desligamento em Editar.">dois nomes parecidos no RH</Chip>}
              {!c.desligadoEm && c.situacaoRH === "nao_encontrado" && <Chip tom="alerta" title="O nome no RH está diferente do CRM. Corrija na ficha do RH para o desligamento ser automático.">nome diferente no RH</Chip>}
              {!c.desligadoEm && c.situacaoRH !== "nao_encontrado" && c.situacaoRH !== "ambiguo" && pessoasCRM.find((p) => p.id === c.crmId)?.ativo === false && <Chip tom="alerta" title="Se saiu, marque o desligamento na ficha do RH.">inativa no CRM</Chip>}
            </div>
            <div className="suave peq" style={{ marginTop: 10 }}>
              {c.ativo === false ? "Só o histórico de pagas" : <>Propostas aprovadas a partir de <b>{dataCurta(c.desde)}</b></>} · taxa {[...(c.taxas || [])].sort((x, y) => String(x.desde).localeCompare(String(y.desde))).map((t) => `${pctTxt(t.pct)} desde ${dataCurta(t.desde)}`).join(", ")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
              {[["Propostas", ex.totais.propostas], ["Gerada", brl(ex.totais.gerada)], ["Pago", brl(ex.totais.pago)], ["Falta pagar", brl(ex.totais.aPagar)]].map(([r, v]) => (
                <div key={r} style={{ background: "#f6faf9", border: "1px solid var(--linha)", borderRadius: 10, padding: "8px 10px", minWidth: 0 }}>
                  <div className="suave" style={{ fontSize: 11 }}>{r}</div>
                  <div className="tnum" style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button type="button" className="btn claro mini" onClick={() => aoEditar(c)}>Editar</button>
              {c.crmId && <button type="button" className="btn claro mini" onClick={() => tirar(c)}>Tirar das comissões</button>}
              {!c.automatico && <button type="button" className="btn perigo mini" onClick={() => excluir(c)}>Excluir</button>}
            </div>
          </Card>
        ))}
      </div>
      {excluidos.length > 0 && (
        <Card>
          <h2>Fora das comissões</h2>
          <div className="suave peq" style={{ marginBottom: 8 }}>Não aparecem nas listas nem no fechamento. O histórico continua guardado.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {excluidos.map((r) => <span key={r.id} className="pilula" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>{nomeCurto(r.nome)} <button type="button" className="btn claro mini" onClick={() => voltar(r)}>Voltar</button></span>)}
          </div>
        </Card>
      )}
    </>
  );
}

function EditarColaborador({ inicial, pessoasCRM, aoFechar, gravar, remover, temPagamento, colabs = [] }) {
  const novo = !!inicial.novo;
  const [f, setF] = useState(() => novo
    ? { nome: "", crmId: "", desde: hojeBR(), taxas: [{ desde: hojeBR(), pct: 1 }], ativo: true }
    : { ...inicial, desligadoEm: inicial.desligadoManual ?? inicial.desligadoEm ?? "", taxas: [...(inicial.taxas || [])] });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const muda = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const mudaTaxa = (i, k, v) => setF((x) => ({ ...x, taxas: x.taxas.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const escolherCRM = (id) => setF((x) => ({ ...x, crmId: id, nome: x.nome || pessoasCRM.find((p) => p.id === id)?.nome || "" }));
  const salvar = async () => {
    const reg = { ...f, desligadoEm: f.desligadoEm || "", tipo: "colaborador", nome: String(f.nome).trim().toLocaleUpperCase("pt-BR"), taxas: f.taxas.map((t) => ({ desde: t.desde, pct: Number(String(t.pct).replace(",", ".")) })) };
    delete reg.novo; delete reg.desligadoManual; delete reg.desligadoRH; delete reg.situacaoRH;
    const e = validarColaborador(reg);
    if (e) return setErro(e);
    const igual = colabs.find((c) => c.id !== reg.id && c.crmId === reg.crmId);
    if (igual) return setErro(`${nomeCurto(igual.nome)} já está cadastrada na comissão (contagem desde ${dataCurta(igual.desde)}). Para mudar a data ou a taxa, use Editar no cadastro que já existe.`);
    setSalvando(true); setErro("");
    try { await gravar("comissoes", reg); aoFechar(); } catch (x) { setErro(x.message); setSalvando(false); }
  };
  const apagar = async () => {
    if (temPagamento(f.id)) return setErro("Este colaborador tem histórico de pagamentos. Desmarque “pega propostas novas” em vez de excluir, para não perder o histórico.");
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
        <div className="campo">
          <label htmlFor="cm-deslig">Desligado em (deixe vazio para usar a data da ficha do RH)</label>
          {inicial.desligadoRH && <span className="suave peq">No RH: desligada em <b>{dataCurta(inicial.desligadoRH)}</b>. A comissão já encerra nessa data; só preencha aqui para usar outra data.</span>}
          <div style={{ display: "flex", gap: 8 }}>
            <input id="cm-deslig" type="date" className="entrada" value={f.desligadoEm || ""} onChange={(e) => muda("desligadoEm", e.target.value)} />
            {f.desligadoEm && <button type="button" className="btn claro mini" onClick={() => muda("desligadoEm", "")}>Limpar</button>}
          </div>
          <span className="suave peq">Com a data, a comissão encerra: o que não foi pago deixa de ficar pendente e de ser previsto, e propostas aceitas depois dela não entram. Se for pagar algo na rescisão, registre o pagamento antes de marcar o desligamento.</span>
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


// ---------------------------------------------------------------- todas as OS
const FILTROS_OS = [["todas", "Todas"], ["faltaNF", "Falta emitir NF"], ["aguardando", "Aguardando"], ["nf", "NF emitida"], ["quitada", "Paga (histórico)"], ["encerrada", "Encerrada"], ["cancelada", "Canceladas"]];

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
      <div style={{ padding: "8px 20px 18px" }}><button type="button" className="btn claro mini" onClick={csv}>Baixar Excel das OS</button></div>
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
  const [todosMeses, setTodosMeses] = useState(false);
  const mes = mesAtual();
  const sel = quem ? contas.filter((x) => x.c.id === quem) : contas;
  const pgs = quem ? pagamentos.filter((p) => p.colaboradorId === quem) : pagamentos;
  const s = serieMensal(sel.map((x) => x.ex), pgs, { ate: mes });
  const tot = (k) => centavos(sel.reduce((a, x) => a + x.ex.totais[k], 0));
  const todasOS = sel.flatMap((x) => osDoExtrato(x.ex));
  const porSit = (id) => todasOS.filter((o) => o.sit.id === id);
  const somaV = (xs, k = "valor") => centavos(xs.reduce((a, o) => a + (Number(o[k]) || 0), 0));
  const ultimos = s.serie.slice(-12);
  const meses = [...s.serie].reverse();
  const mesesVistos = todosMeses ? meses : meses.slice(0, 6);
  const temAdiantado = sel.some((x) => x.ex.totais.adiantado > 0);
  const SITUACOES = [
    ["nf", "NF emitida", "ok", "comissao", "liberada"],
    ["faltaNF", "Pronta para faturar", "alerta", "prevista", "prevista"],
    ["aguardando", "Aguardando", "neutro", "prevista", "prevista"],
    ["quitada", "Paga (histórico)", "ok", null, "já paga"],
    ["encerrada", "Encerrada (desligamento)", "neutro", null, "não conta"],
    ["cancelada", "Cancelada", "ruim", null, "sem comissão"],
  ].map(([id, rot, tom, k, txt]) => ({ id, rot, tom, k, txt, xs: porSit(id) })).filter((x) => x.xs.length);
  return (
    <>
      <div className="pilulas" role="group" aria-label="Colaborador">
        <button type="button" className={`pilula${!quem ? " ativa" : ""}`} aria-pressed={!quem} onClick={() => setQuem("")}>Todos</button>
        {contas.map((x) => <button key={x.c.id} type="button" className={`pilula${quem === x.c.id ? " ativa" : ""}`} aria-pressed={quem === x.c.id} onClick={() => setQuem(x.c.id)}>{nomeCurto(x.c.nome)}</button>)}
      </div>
      <Conferencia contas={sel} />
      <div className="grade grade-kpi">
        <Kpi rotulo="Liberado para pagar" valor={brl(tot("aPagar"))} sub={tot("adiantado") > 0 ? `${brl(tot("adiantado"))} pagos adiantado` : "OS faturadas, com NF emitida"} />
        <Kpi rotulo="Aguardando faturar" valor={brl(somaV([...porSit("faltaNF"), ...porSit("aguardando")], "prevista"))} sub={`${porSit("faltaNF").length + porSit("aguardando").length} OS ainda sem nota`} />
        <Kpi rotulo="Média paga por mês" valor={brl(s.mediaPaga)} sub={`${s.mesesPagos} mês(es) com pagamento`} />
        <Kpi rotulo="Média gerada por mês" valor={brl(s.mediaGerada)} sub="1% das NF emitidas" />
      </div>
      {!quem && (
        <Card semPad>
          <div className="card-cab"><h2>Por colaborador</h2><span className="suave peq">clique no nome para ver só a pessoa</span></div>
          <div className="tabela-caixa tabela-comissao">
            <table>
              <thead><tr><th>Colaborador</th><th style={D}>Propostas</th><th style={D}>Liberado para pagar</th><th style={D}>Aguardando faturar</th><th style={D}>Já pago</th><th style={D}>Comissão gerada</th>{temAdiantado && <th style={D}>Adiantado</th>}</tr></thead>
              <tbody>
                {contas.map(({ c, ex }) => (
                  <tr key={c.id}>
                    <td><button type="button" className="link-nome" onClick={() => setQuem(c.id)}>{nomeCurto(c.nome)}</button>{c.desligadoEm ? <div className="suave peq">desligada em {dataCurta(c.desligadoEm)}</div> : c.ativo === false && <div className="suave peq">só histórico</div>}</td>
                    <td className="tnum" style={D}>{ex.totais.propostas}</td>
                    <td className="tnum" style={{ ...D, fontWeight: 700, color: ex.totais.aPagar > 0 ? "var(--marca-900)" : undefined }}>{brl(ex.totais.aPagar)}</td>
                    <td className="tnum" style={D}>{brl(ex.totais.previsao)}</td>
                    <td className="tnum" style={D}>{brl(ex.totais.pago)}</td>
                    <td className="tnum" style={D}>{brl(ex.totais.gerada)}</td>
                    {temAdiantado && <td className="tnum" style={D}>{ex.totais.adiantado > 0 ? brl(ex.totais.adiantado) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <h2>Comissão por mês</h2>
          {s.pagoSemMes > 0 && <span className="suave peq">{brl(s.pagoSemMes)} pagos no histórico sem mês da folha ficam fora do gráfico</span>}
        </div>
        {ultimos.length ? <GraficoComissao serie={ultimos} media={s.mediaPaga} /> : <div className="vazio">Ainda não há comissão gerada nem paga.</div>}
      </Card>
      <div className="grade grade-2" style={{ alignItems: "stretch" }}>
        <Card semPad>
          <div className="card-cab"><h2>Situação das OS</h2><span className="suave peq">{todasOS.length} OS</span></div>
          <div style={{ padding: "4px 20px 16px" }}>
            {SITUACOES.map((x) => (
              <div key={x.id} className="linha-situacao">
                <Chip tom={x.tom}>{x.rot}</Chip>
                <span className="tnum suave peq">{x.xs.length} OS · {brl(somaV(x.xs))}</span>
                <span className="tnum" style={{ textAlign: "right" }}>{x.k ? <b>{brl(somaV(x.xs, x.k))}</b> : null}<div className="suave" style={{ fontSize: 11 }}>{x.txt}</div></span>
              </div>
            ))}
          </div>
        </Card>
        <Card semPad>
          <div className="card-cab"><h2>Mês a mês</h2><span className="suave peq">comissão gerada e paga</span></div>
          <div className="tabela-caixa tabela-comissao">
            <table>
              <thead><tr><th>Mês</th><th style={D}>Gerada</th><th style={D}>Paga</th></tr></thead>
              <tbody>
                {mesesVistos.map((x) => <tr key={x.mes}><td>{mesLongo(x.mes)}</td><td className="tnum" style={D}>{brl(x.gerada)}</td><td className="tnum" style={D}>{brl(x.paga)}</td></tr>)}
                {todosMeses && s.pagoSemMes > 0 && <tr><td className="suave">Pago sem mês (histórico)</td><td /><td className="tnum" style={D}>{brl(s.pagoSemMes)}</td></tr>}
              </tbody>
            </table>
          </div>
          {meses.length > 6 && <div style={{ padding: "8px 20px 14px" }}><button type="button" className="btn claro mini" onClick={() => setTodosMeses((v) => !v)}>{todosMeses ? "Ver só os últimos 6 meses" : `Ver todos os meses (${meses.length})`}</button></div>}
        </Card>
      </div>
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
