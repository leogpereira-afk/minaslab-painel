// Comissões: % sobre o faturado das propostas aprovadas de cada colaborador.
// Lê o CRM (propostas aprovadas) e Serviços gerados (OS faturadas) pelo
// ml-comercial; o cadastro dos colaboradores e os pagamentos ficam na
// coleção rh_comercial_comissoes. Regra e cálculo: src/lib/comissoes.js.
import { useMemo, useState } from "react";
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Kpi, Cabecalho, Abas, Modal, Paginacao, usePaginacao } from "../components/ui.jsx";
import { comissoesCRM } from "../services/crm.js";
import { brl, dataCurta, hojeBR, mesLongo, mesAtual, nomeProprio } from "../lib/format.js";
import {
  calcularColaborador, situacao, porMes, itensDoPagamento, validarColaborador, taxaAtual, csvItens, centavos,
} from "../lib/comissoes.js";
import { lerXlsx } from "../lib/xlsxLeve.js";
import { lerLinhasPlanilha, planoImportacao } from "../lib/comissoesPlanilha.js";

const pctTxt = (p) => `${String(Number(p || 0)).replace(".", ",")}%`;
const nomeCurto = (n) => { const p = nomeProprio(n).split(" ").filter(Boolean); return p.length > 1 ? `${p[0]} ${p.at(-1)}` : p[0] || ""; };

function baixar(nome, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Comissoes() {
  const { dados, gravar, remover } = useBase();
  const [aba, setAba] = useState("pagar");
  const [editando, setEditando] = useState(null);
  const [vendo, setVendo] = useState(null);
  const [importando, setImportando] = useState(false);

  const registros = dados.comissoes || [];
  const colabs = useMemo(() => registros.filter((r) => r.tipo === "colaborador").sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [registros]);
  const pagamentos = useMemo(() => registros.filter((r) => r.tipo === "pagamento").sort((a, b) => String(b.pagoEm).localeCompare(String(a.pagoEm)) || String(b.criadoEm).localeCompare(String(a.criadoEm))), [registros]);
  const saldosDe = useMemo(() => {
    const m = new Map();
    for (const r of registros) if (r.tipo === "saldo") m.set(r.colaboradorId, [...(m.get(r.colaboradorId) || []), ...(r.itens || []).map((i) => ({ ...i, saldoId: r.id }))]);
    return m;
  }, [registros]);
  const ativos = colabs.filter((c) => c.ativo !== false);
  const ids = [...new Set(colabs.map((c) => c.crmId).filter(Boolean))].sort();
  const crm = useCRM(`comissoes:${ids.join(",")}`, () => comissoesCRM(ids));
  const pessoasCRM = crm.dados?.pessoas || [];

  const contas = useMemo(() => {
    if (!crm.dados) return [];
    const osPorId = new Map(crm.dados.os.map((o) => [o.id, o]));
    return colabs.map((c) => {
      const calc = calcularColaborador(c, crm.dados.propostas, crm.dados.os);
      const outros = new Set(pagamentos.filter((p) => p.colaboradorId !== c.id).flatMap((p) => (p.itens || []).map((i) => i.osId)));
      const saldos = saldosDe.get(c.id) || [];
      const sit = situacao(c, calc, pagamentos, outros, { saldos, osPorId });
      const meus = pagamentos.filter((p) => p.colaboradorId === c.id);
      return { c, calc, sit, saldos, meses: porMes(calc, meus, saldos), pagamentos: meus };
    });
  }, [crm.dados, colabs, pagamentos, saldosDe]);
  // Situação das OS de cada proposta (para as linhas antigas da planilha).
  const osDaProposta = useMemo(() => {
    const m = new Map();
    for (const o of crm.dados?.os || []) {
      const x = m.get(o.proposta) || { n: 0, faturadas: 0, pagas: 0 };
      x.n += 1;
      if (String(o.fat).toUpperCase() === "FATURADO" && String(o.pag).toUpperCase() !== "CANCELADO") x.faturadas += 1;
      if (String(o.pag).toUpperCase() === "PAGO") x.pagas += 1;
      m.set(o.proposta, x);
    }
    return m;
  }, [crm.dados]);
  const tirarSaldo = async (item) => {
    const reg = registros.find((r) => r.id === item.saldoId);
    if (!reg || !window.confirm(`Tirar da lista a comissão antiga da proposta ${item.proposta} (${brl(item.valor)})? Ela não será paga.`)) return;
    try { await gravar("comissoes", { ...reg, itens: reg.itens.filter((i) => i.id !== item.id), tirados: [...(reg.tirados || []), { ...reg.itens.find((i) => i.id === item.id), tiradoEm: new Date().toISOString() }] }); } catch (e) { window.alert(e.message); }
  };

  const total = (f) => centavos(contas.reduce((s, x) => s + f(x), 0));
  const mes = mesAtual();
  const doMes = total((x) => x.calc.itens.filter((i) => i.competencia === mes).reduce((s, i) => s + i.comissao, 0));
  const previsto = total((x) => x.calc.previsao.reduce((s, i) => s + i.comissao, 0));
  const ano = mes.slice(0, 4);
  const pagoAno = centavos(pagamentos.filter((p) => String(p.pagoEm).startsWith(ano)).reduce((s, p) => s + Number(p.total || 0), 0));

  return (
    <>
      <Cabecalho sobre="Comissões" titulo="Comissão sobre o faturado" sub="Propostas aprovadas no CRM × OS faturadas em Serviços gerados. A comissão sai no mês da emissão da nota, com a taxa vigente naquela data.">
        <button type="button" className="btn claro" onClick={crm.recarregar}>Atualizar</button>
        <button type="button" className="btn claro" disabled={!crm.dados} onClick={() => setImportando(true)}>Importar planilha antiga</button>
        <button type="button" className="btn" onClick={() => setEditando({ novo: true })}>Novo colaborador</button>
      </Cabecalho>
      {crm.erro && <div className="aviso ruim">{crm.erro}</div>}
      {crm.carregando && <div className="carregando">Lendo propostas e serviços gerados…</div>}
      {crm.dados && (
        <>
          <div className="grade grade-kpi">
            <Kpi rotulo="A pagar" valor={brl(total((x) => x.sit.totalAPagar))} sub={`${contas.filter((x) => x.sit.aPagar.length).length} colaborador(es) com saldo`} />
            <Kpi rotulo={`Comissão de ${mesLongo(mes).toLowerCase()}`} valor={brl(doMes)} sub="sobre as notas emitidas no mês" />
            <Kpi rotulo="Previsão" valor={brl(previsto)} sub="OS prontas para faturar" />
            <Kpi rotulo={`Pago em ${ano}`} valor={brl(pagoAno)} sub={`${pagamentos.filter((p) => String(p.pagoEm).startsWith(ano)).length} pagamento(s)`} />
          </div>
          <Abas valor={aba} aoMudar={setAba} abas={[
            ["pagar", "A pagar", contas.filter((x) => x.sit.aPagar.length).length || ""],
            ["meses", "Por mês"],
            ["pagamentos", "Pagamentos", pagamentos.length || ""],
            ["colaboradores", "Colaboradores", ativos.length || ""],
          ]} />
          {colabs.length === 0 && (
            <div className="aviso marca">Cadastre quem recebe comissão: o usuário do CRM (responsável comercial das propostas), a data de contagem e a taxa.</div>
          )}
          {aba === "pagar" && <APagar contas={contas.filter((x) => x.c.ativo !== false || x.sit.aPagar.length)} gravar={gravar} osDaProposta={osDaProposta} aoTirar={tirarSaldo} />}
          {aba === "meses" && <PorMes contas={contas} aoVer={setVendo} />}
          {aba === "pagamentos" && <Pagamentos pagamentos={pagamentos} colabs={colabs} aoVer={setVendo} remover={remover} />}
          {aba === "colaboradores" && <Colaboradores contas={contas} pessoasCRM={pessoasCRM} aoEditar={setEditando} remover={remover} pagamentos={pagamentos} />}
        </>
      )}
      {editando && <EditarColaborador inicial={editando} pessoasCRM={pessoasCRM} aoFechar={() => setEditando(null)} gravar={gravar} remover={remover} colabs={colabs} temPagamento={(id) => pagamentos.some((p) => p.colaboradorId === id)} />}
      {vendo && <VerItens {...vendo} aoFechar={() => setVendo(null)} />}
      {importando && <ImportarPlanilha colabs={colabs} pessoasCRM={pessoasCRM} gravar={gravar} aoFechar={() => setImportando(false)} />}
    </>
  );
}

function SituacaoProposta({ info }) {
  if (!info) return <div className="suave">sem OS em Serviços gerados</div>;
  if (info.pagas >= info.n) return <div className="suave">cliente já pagou</div>;
  if (info.faturadas) return <div className="suave">{info.faturadas} de {info.n} OS faturada(s)</div>;
  return <div className="suave">OS ainda não faturada</div>;
}

function TabelaItens({ itens, marcados, aoMarcar, mostrarStatus, osDaProposta, aoTirar }) {
  const pag = usePaginacao(itens, 15, itens.length);
  return (
    <>
      <div className="tabela-caixa">
        <table>
          <thead><tr>
            {aoMarcar && <th style={{ width: 32 }} />}
            <th>Competência</th><th>Proposta</th><th>OS</th><th>Cliente</th><th>Emissão NF</th><th style={{ textAlign: "right" }}>Faturado</th><th>%</th><th style={{ textAlign: "right" }}>Comissão</th>
            {mostrarStatus && <th>Situação</th>}
          </tr></thead>
          <tbody>
            {pag.itens.map((i) => (
              <tr key={i.id || i.osId}>
                {aoMarcar && <td><input type="checkbox" aria-label={`Pagar OS ${i.os}`} checked={marcados.has(i.id)} onChange={() => aoMarcar(i.id)} /></td>}
                <td className="tnum peq">{i.competencia ? mesLongo(i.competencia) : "—"}</td>
                <td className="tnum peq">{i.proposta}</td>
                <td className="tnum peq">{i.planilha ? <><Chip tom="neutro">planilha</Chip>{osDaProposta && <SituacaoProposta info={osDaProposta.get(i.proposta)} />}</> : <>{i.os}{i.nf ? <div className="suave">NF {i.nf}</div> : null}</>}</td>
                <td className="peq" style={{ maxWidth: 260 }}>{i.cliente}</td>
                <td className="tnum peq">{dataCurta(i.emissao)}</td>
                <td className="tnum" style={{ textAlign: "right" }}>{i.estorno ? "—" : brl(i.base)}</td>
                <td className="tnum peq">{pctTxt(i.pct)}</td>
                <td className="tnum" style={{ textAlign: "right", fontWeight: 600, color: Number(i.valor ?? i.comissao) < 0 ? "var(--ruim)" : undefined }}>
                  {brl(i.valor ?? i.comissao)}
                  {i.estorno ? <div><Chip tom="ruim">estorno: OS cancelada</Chip></div> : i.ajuste ? <div><Chip tom="alerta">ajuste (já pago {brl(i.pago)})</Chip></div> : null}
                  {aoTirar && i.planilha && i.saldoId && <div><button type="button" className="btn-link peq" onClick={() => aoTirar(i)}>tirar da lista</button></div>}
                </td>
                {mostrarStatus && <td>{i.situacao === "pago" ? <Chip tom="ok">Pago</Chip> : i.situacao === "outro" ? <Chip tom="neutro">Pago a outro</Chip> : <Chip tom="alerta">A pagar</Chip>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacao pag={pag} rotulo="OS" />
    </>
  );
}

function APagar({ contas, gravar, osDaProposta, aoTirar }) {
  const com = contas.filter((x) => x.sit.aPagar.length);
  if (!com.length) return <div className="vazio">Nada a pagar: todas as comissões calculadas já estão pagas.</div>;
  return <div className="grade" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>{com.map((x) => <CartaoAPagar key={x.c.id} conta={x} gravar={gravar} osDaProposta={osDaProposta} aoTirar={aoTirar} />)}</div>;
}

function CartaoAPagar({ conta, gravar, osDaProposta, aoTirar }) {
  const { c, sit, calc } = conta;
  const meses = [...new Set(sit.aPagar.map((i) => i.competencia).filter(Boolean))].sort();
  const [ate, setAte] = useState("");
  const visiveis = sit.aPagar.filter((i) => !ate || !i.competencia || i.competencia <= ate);
  const [desmarcados, setDesmarcados] = useState(() => new Set());
  const marcados = new Set(visiveis.map((i) => i.id).filter((id) => !desmarcados.has(id)));
  const sel = visiveis.filter((i) => marcados.has(i.id));
  const totalSel = centavos(sel.reduce((s, i) => s + i.valor, 0));
  const [pagando, setPagando] = useState(false);
  const alternar = (id) => setDesmarcados((d) => { const n = new Set(d); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const previsto = centavos(calc.previsao.reduce((s, i) => s + i.comissao, 0));
  return (
    <Card semPad>
      <div className="card-cab" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2>{nomeCurto(c.nome)}</h2>
          <div className="suave peq">{c.ativo === false ? "Fora do cálculo · " : ""}Desde {dataCurta(c.desde)} · taxa atual {pctTxt(taxaAtual(c, hojeBR()))}{previsto ? ` · previsão ${brl(previsto)} em ${calc.previsao.length} OS a faturar` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {meses.length > 1 && (
            <select className="entrada" aria-label="Pagar até a competência" value={ate} onChange={(e) => setAte(e.target.value)} style={{ minHeight: 36 }}>
              <option value="">Todas as competências</option>
              {meses.map((m) => <option key={m} value={m}>Até {mesLongo(m).toLowerCase()}</option>)}
            </select>
          )}
          <span className="tnum" style={{ fontWeight: 700 }}>{brl(sit.totalAPagar)}</span>
        </div>
      </div>
      <TabelaItens itens={visiveis} marcados={marcados} aoMarcar={alternar} osDaProposta={osDaProposta} aoTirar={aoTirar} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 20px 18px", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn claro mini" onClick={() => baixar(`comissao-${nomeCurto(c.nome).replace(/\s+/g, "-").toLowerCase()}-a-pagar.csv`, csvItens(sel, { titulo: `Comissão a pagar · ${nomeCurto(c.nome)}` }))}>Baixar planilha</button>
        <button type="button" className="btn" disabled={!sel.length} onClick={() => setPagando(true)}>Registrar pagamento de {brl(totalSel)}</button>
      </div>
      {pagando && <RegistrarPagamento colab={c} itens={sel} total={totalSel} gravar={gravar} aoFechar={() => setPagando(false)} />}
    </Card>
  );
}

function RegistrarPagamento({ colab, itens, total, gravar, aoFechar }) {
  const [pagoEm, setPagoEm] = useState(hojeBR());
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const competencias = [...new Set(itens.map((i) => i.competencia).filter(Boolean))].sort();
  const salvar = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pagoEm)) return setErro("Informe a data do pagamento.");
    setSalvando(true); setErro("");
    try {
      await gravar("comissoes", { tipo: "pagamento", colaboradorId: colab.id, nome: colab.nome, pagoEm, obs: obs.trim(), competencias, itens: itensDoPagamento(itens), total });
      aoFechar();
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  return (
    <Modal titulo={`Pagamento · ${nomeCurto(colab.nome)}`} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="aviso marca">{itens.length} OS · {competencias.map((m) => mesLongo(m).toLowerCase()).join(", ") || "ajustes"} · <b>{brl(total)}</b></div>
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

function PorMes({ contas, aoVer }) {
  const com = contas.filter((x) => x.meses.length);
  if (!com.length) return <div className="vazio">Nenhuma OS faturada ainda para os colaboradores cadastrados.</div>;
  return (
    <div className="grade" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
      {com.map(({ c, calc, sit, meses, saldos, pagamentos: meus }) => {
        const pagas = new Set(sit.aPagar.map((i) => i.id));
        const deOutro = new Set(sit.deOutro.map((i) => i.id));
        const ver = (m) => aoVer({
          titulo: `${nomeCurto(c.nome)} · ${mesLongo(m)}`,
          itens: [
            ...calc.itens.filter((i) => i.competencia === m).map((i) => ({ ...i, situacao: deOutro.has(i.id) ? "outro" : pagas.has(i.id) ? "aPagar" : "pago" })),
            ...meus.flatMap((p) => (p.itens || []).filter((i) => i.planilha && i.competencia === m).map((i) => ({ ...i, id: i.osId, situacao: "pago" }))),
            ...saldos.filter((i) => i.competencia === m && pagas.has(i.id)).map((i) => ({ ...i, situacao: "aPagar" })),
          ],
          mostrarStatus: true,
        });
        return (
          <Card semPad key={c.id}>
            <div className="card-cab"><h2>{nomeCurto(c.nome)}</h2><span className="suave peq">comissão {brl(sit.totalComissao)} · pago {brl(sit.totalPago)}</span></div>
            <div className="tabela-caixa">
              <table>
                <thead><tr><th>Competência</th><th style={{ textAlign: "right" }}>OS faturadas</th><th style={{ textAlign: "right" }}>Faturado</th><th style={{ textAlign: "right" }}>Comissão</th><th style={{ textAlign: "right" }}>Pago</th><th style={{ textAlign: "right" }}>A pagar</th><th /></tr></thead>
                <tbody>
                  {meses.map((l) => (
                    <tr key={l.mes}>
                      <td>{mesLongo(l.mes)}{l.planilha && <div className="suave peq">inclui a planilha antiga</div>}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{l.os}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{brl(l.faturado)}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{brl(l.comissao)}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{brl(l.pago)}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{Math.abs(l.aPagar) >= 0.01 ? <Chip tom={l.aPagar > 0 ? "alerta" : "ruim"}>{brl(l.aPagar)}</Chip> : <Chip tom="ok">em dia</Chip>}</td>
                      <td style={{ textAlign: "right" }}>{(l.os > 0 || l.planilha) && <button type="button" className="btn claro mini" onClick={() => ver(l.mes)}>{l.os > 0 ? "Ver OS" : "Ver"}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Pagamentos({ pagamentos, colabs, aoVer, remover }) {
  const pag = usePaginacao(pagamentos, 12);
  const nome = (id) => nomeCurto(colabs.find((c) => c.id === id)?.nome || "") || "—";
  if (!pagamentos.length) return <div className="vazio">Nenhum pagamento registrado ainda.</div>;
  const desfazer = async (p) => {
    if (!window.confirm(`Desfazer o pagamento de ${brl(p.total)} para ${nome(p.colaboradorId)}? As OS voltam para "A pagar".`)) return;
    try { await remover("comissoes", p.id); } catch (e) { window.alert(e.message); }
  };
  return (
    <Card semPad>
      <div className="tabela-caixa">
        <table>
          <thead><tr><th>Pago em</th><th>Colaborador</th><th>Competências</th><th style={{ textAlign: "right" }}>OS</th><th style={{ textAlign: "right" }}>Valor</th><th>Obs.</th><th /></tr></thead>
          <tbody>
            {pag.itens.map((p) => (
              <tr key={p.id}>
                <td className="tnum">{dataCurta(p.pagoEm)}</td>
                <td>{nome(p.colaboradorId)}</td>
                <td className="peq">{(p.competencias || []).map((m) => mesLongo(m)).join(", ") || "ajustes"}</td>
                <td className="tnum" style={{ textAlign: "right" }}>{(p.itens || []).length}</td>
                <td className="tnum" style={{ textAlign: "right", fontWeight: 600 }}>{brl(p.total)}</td>
                <td className="peq suave">{p.obs}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button type="button" className="btn claro mini" onClick={() => aoVer({ titulo: `Pagamento de ${dataCurta(p.pagoEm)} · ${nome(p.colaboradorId)}`, itens: (p.itens || []).map((i) => ({ ...i, id: i.osId })), csv: `comissao-paga-${p.pagoEm}.csv` })}>Ver</button>{" "}
                  <button type="button" className="btn perigo mini" onClick={() => desfazer(p)}>Desfazer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacao pag={pag} rotulo="pagamentos" />
    </Card>
  );
}

function Colaboradores({ contas, pessoasCRM, aoEditar, remover, pagamentos }) {
  const [erro, setErro] = useState("");
  if (!contas.length) return null;
  const excluir = async (c) => {
    setErro("");
    if (pagamentos.some((p) => p.colaboradorId === c.id)) return setErro(`${nomeCurto(c.nome)} já tem pagamentos registrados. Desfaça os pagamentos antes ou marque “fora do cálculo” em Editar, para não perder o histórico.`);
    if (!window.confirm(`Excluir ${nomeCurto(c.nome)} (contagem desde ${dataCurta(c.desde)}) da comissão?`)) return;
    try { await remover("comissoes", c.id); } catch (e) { setErro(e.message); }
  };
  const nomeCRM = (id) => pessoasCRM.find((p) => p.id === id)?.nome || "Usuário do CRM";
  return (
    <>
    {erro && <div className="aviso ruim">{erro}</div>}
    <div className="grade grade-2">
      {contas.map(({ c, calc, sit }) => (
        <Card key={c.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
            <div>
              <h2>{nomeCurto(c.nome)}</h2>
              <div className="suave peq">No CRM: {nomeCRM(c.crmId)}</div>
            </div>
            {c.ativo === false ? <Chip>Fora do cálculo</Chip> : <Chip tom="ok">No cálculo</Chip>}
          </div>
          <div className="peq" style={{ marginTop: 10, lineHeight: 1.7 }}>
            Conta a partir de <b>{dataCurta(c.desde)}</b> · {calc.itens.length} OS faturadas · comissão {brl(sit.totalComissao)} · pago {brl(sit.totalPago)}
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
    if (temPagamento(f.id)) return setErro("Este colaborador já tem pagamentos registrados. Marque “fora do cálculo” em vez de apagar, para não perder o histórico.");
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
          <input type="checkbox" checked={f.ativo !== false} onChange={(e) => muda("ativo", e.target.checked)} /> No cálculo (desmarque se a pessoa deixou de receber comissão)
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

function VerItens({ titulo, itens, mostrarStatus, csv, aoFechar }) {
  const total = centavos(itens.reduce((s, i) => s + Number(i.valor ?? i.comissao ?? 0), 0));
  return (
    <Modal titulo={titulo} aoFechar={aoFechar} largo>
      <TabelaItens itens={itens} mostrarStatus={mostrarStatus} />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <b className="tnum">Total {brl(total)}</b>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn claro mini" onClick={() => baixar(csv || "comissao.csv", csvItens(itens, { titulo }))}>Baixar planilha</button>
          <button type="button" className="btn mini" onClick={aoFechar}>Fechar</button>
        </div>
      </div>
    </Modal>
  );
}

// Importa a planilha antiga (uma linha por proposta, 1% do valor dela):
// "Pago" vira histórico de pagamento, "Não pago" vira saldo a pagar.
function ImportarPlanilha({ colabs, pessoasCRM, gravar, aoFechar }) {
  const { dados } = useBase();
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
      const existentes = new Map((dados.comissoes || []).map((r) => [r.id, r]));
      const regs = [
        ...plano.colaboradores,
        ...plano.pagamentos,
        ...plano.saldos.map((s) => {
          const antes = existentes.get(s.id);
          const tirados = antes?.tirados || [];
          const fora = new Set(tirados.map((i) => i.id));
          return { ...s, itens: s.itens.filter((i) => !fora.has(i.id)), tirados, importadoDe: arquivo };
        }),
      ];
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
          Linhas <b>Pago</b> entram no histórico de pagamentos (agrupadas pelo mês da folha). Linhas <b>Não pago</b> entram em “A pagar” como comissão antiga.
          Quem não está cadastrado entra <b>fora do cálculo</b>: guarda o histórico, mas não gera comissão nova. Importar de novo o mesmo arquivo não duplica.
        </div>
        <input type="file" accept=".xlsx" className="entrada" onChange={ler} disabled={!!gravando} aria-label="Escolher a planilha" />
        {erro && <div className="aviso ruim">{erro}</div>}
        {plano && (
          <>
            <div className="tabela-caixa">
              <table>
                <thead><tr><th>Colaborador</th><th style={{ textAlign: "right" }}>Linhas pagas</th><th style={{ textAlign: "right" }}>Pago</th><th style={{ textAlign: "right" }}>Não pagas</th><th style={{ textAlign: "right" }}>A pagar</th><th /></tr></thead>
                <tbody>
                  {plano.resumo.map((x) => (
                    <tr key={x.nome}>
                      <td>{nomeCurto(x.nome)}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{x.pagas}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{brl(x.pago)}</td>
                      <td className="tnum" style={{ textAlign: "right" }}>{x.abertas}</td>
                      <td className="tnum" style={{ textAlign: "right", fontWeight: 600 }}>{brl(x.aPagar)}</td>
                      <td>{x.novo ? <Chip>entra fora do cálculo</Chip> : <Chip tom="ok">já cadastrada</Chip>}{x.semCRM && <Chip tom="alerta">sem usuário no CRM</Chip>}</td>
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
                <div style={{ marginTop: 6 }}>A importação grava como está na planilha; os acertos você faz depois.</div>
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
