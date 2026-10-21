// Carteira: quem sustenta o resultado (curva ABC), quem está sumindo,
// contratos e recorrências que viram a venda mais fácil do mês.
import { useState } from "react";
import { useCRM } from "../hooks/base.jsx";
import { Card, Chip, Kpi, Cabecalho, Abas, Paginacao, usePaginacao } from "../components/ui.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { carteiraCRM } from "../services/crm.js";
import { brl, pct, dataCurta } from "../lib/format.js";

export default function Carteira() {
  const c = useCRM("carteira", carteiraCRM);
  const [aba, setAba] = useState("clientes");
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const d = c.dados;
  const clientes = d?.clientes || [];
  const total = clientes.reduce((s, x) => s + x.valor12m, 0);
  const curvaA = clientes.filter((x) => x.curva === "A");
  const risco = clientes.filter((x) => x.emRisco && x.curva !== "C");
  const lista = clientes
    .filter((x) => filtro === "todos" || (filtro === "risco" ? x.emRisco : x.curva === filtro))
    .filter((x) => !busca || x.cliente.toLowerCase().includes(busca.toLowerCase()));
  const pagCli = usePaginacao(lista, 12, filtro + busca);
  const pagCon = usePaginacao(d?.contratosVencendo || [], 12);
  const pagRec = usePaginacao(d?.recorrencias?.lista || [], 12);

  return (
    <>
      <Cabecalho sobre="Carteira" titulo="Clientes, contratos e recorrências" sub="Pelo valor de propostas aprovadas nos últimos 12 meses (CRM).">
        <button type="button" className="btn claro" onClick={c.recarregar}>Atualizar</button>
      </Cabecalho>
      <Orientacao tela="carteira" />
      {c.erro && <div className="aviso ruim">{c.erro}</div>}
      {c.carregando && <div className="carregando">Lendo a carteira no CRM…</div>}
      {d && (
        <>
          <div className="grade grade-kpi">
            <Kpi rotulo="Clientes com aprovação em 12 meses" valor={clientes.filter((x) => x.aprovadas12m > 0).length} sub={`${brl(total, true)} aprovados`} />
            <Kpi rotulo="Curva A" valor={curvaA.length} sub={`${pct(total ? (curvaA.reduce((s, x) => s + x.valor12m, 0) / total) * 100 : null)} do valor`} />
            <Kpi rotulo="Clientes A e B em risco" valor={risco.length} sub="sem aprovar há mais que o normal" tomSub={risco.length ? "ruim" : undefined} />
            <Kpi rotulo="Contratos vencendo" valor={d.contratosVencendo.length} sub="de 30 dias atrás a 90 à frente" />
            <Kpi rotulo="Recorrências" valor={d.recorrencias.atrasadas} sub={`atrasadas · ${d.recorrencias.proximos30d} nos próximos 30 dias`} tomSub={d.recorrencias.atrasadas ? "ruim" : undefined} />
          </div>

          <Abas valor={aba} aoMudar={setAba} abas={[["clientes", "Clientes", clientes.length], ["contratos", "Contratos vencendo", d.contratosVencendo.length], ["recorrencias", "Recorrências", d.recorrencias.lista.length]]} />

          {aba === "clientes" && (
            <Card semPad>
              <div className="card-cab" style={{ alignItems: "center" }}>
                <div className="pilulas">
                  {[["todos", "Todos"], ["A", "Curva A"], ["B", "Curva B"], ["C", "Curva C"], ["risco", "Em risco"]].map(([id, nome]) => (
                    <button key={id} type="button" className={`pilula${filtro === id ? " ativa" : ""}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{nome}</button>
                  ))}
                </div>
                <input className="entrada" style={{ maxWidth: 260 }} aria-label="Buscar cliente" placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <div className="tabela-caixa">
                <table>
                  <thead><tr><th>Cliente</th><th>Curva</th><th>Aprovado 12 meses</th><th>Aprovações</th><th>Última</th><th>Costuma comprar a cada</th><th>Situação</th></tr></thead>
                  <tbody>
                    {pagCli.itens.map((x) => (
                      <tr key={x.cliente + x.ultima}>
                        <td>{x.cliente || "—"}</td>
                        <td><Chip tom={x.curva === "A" ? "marca" : "neutro"}>{x.curva}</Chip></td>
                        <td className="tnum">{brl(x.valor12m)}</td>
                        <td className="tnum">{x.aprovadas12m}</td>
                        <td className="tnum peq">{dataCurta(x.ultima)}</td>
                        <td className="tnum peq">{x.intervaloMedio ? `${x.intervaloMedio} dias` : "—"}</td>
                        <td>{x.emRisco ? <Chip tom="ruim">{x.diasSemAprovar} dias sem aprovar</Chip> : <Chip tom="ok">Em dia</Chip>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacao pag={pagCli} rotulo="clientes" />
            </Card>
          )}

          {aba === "contratos" && (
            <Card semPad>
              <div className="tabela-caixa">
                <table>
                  <thead><tr><th>Cliente</th><th>Contrato</th><th>Periodicidade</th><th>Vence em</th></tr></thead>
                  <tbody>
                    {d.contratosVencendo.length === 0 && <tr><td colSpan={4} className="suave">Nenhum contrato vencendo no período.</td></tr>}
                    {pagCon.itens.map((x) => (
                      <tr key={x.id}><td>{x.cliente || "—"}</td><td className="tnum">{x.numero || "—"}</td><td className="peq">{x.periodicidade}</td><td className="tnum">{dataCurta(x.dataFim)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacao pag={pagCon} rotulo="contratos" />
            </Card>
          )}

          {aba === "recorrencias" && (
            <Card semPad>
              <div className="card-cab"><span className="suave peq">{d.recorrencias.ativas} recorrências ativas no CRM · mostrando atrasadas e próximas 30 dias</span></div>
              <div className="tabela-caixa">
                <table>
                  <thead><tr><th>Cliente</th><th>Periodicidade</th><th>Última execução</th><th>Próxima prevista</th><th /></tr></thead>
                  <tbody>
                    {pagRec.itens.map((x) => (
                      <tr key={x.id}><td>{x.cliente || "—"}</td><td className="peq">{x.periodicidade}</td><td className="tnum peq">{x.ultima ? dataCurta(x.ultima) : "—"}</td><td className="tnum">{dataCurta(x.proxima)}</td><td>{x.atrasada ? <Chip tom="ruim">Atrasada</Chip> : <Chip>Próxima</Chip>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginacao pag={pagRec} rotulo="recorrências" />
            </Card>
          )}
        </>
      )}
    </>
  );
}
