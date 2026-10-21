// Não conformidades e retrabalho do laboratório: registro na hora, com tipo,
// setor, OS/amostra, ação imediata e situação. Base para o indicador mensal.
import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Kpi, Paginacao, usePaginacao } from "../components/ui.jsx";
import { SeletorMes } from "../components/Layout.jsx";
import { mesLongo, mesNome, hojeBR, dataCurta, mesDeData } from "../lib/format.js";

export const TIPOS_NC = [
  "Recepção: temperatura",
  "Recepção: frasco inadequado",
  "Recepção: volume insuficiente",
  "Recepção: identificação ou rótulo",
  "Ensaio repetido (retrabalho)",
  "Desvio de método ou POP",
  "Equipamento ou calibração",
  "Registro ou documentação",
  "Prazo de entrega",
  "Reclamação de cliente",
  "Outro",
];
export const SETORES_LAB = ["Recepção", "Microbiologia", "Físico-química", "Campo", "Laboratório parceiro", "Qualidade"];
const SITUACOES = [["aberta", "Aberta", "ruim"], ["tratada", "Em tratamento", "alerta"], ["encerrada", "Encerrada", "ok"]];

export default function NaoConformidades() {
  const { mes, dados, gravar, remover } = useBase();
  const vazio = () => ({ data: hojeBR(), tipo: TIPOS_NC[0], setor: SETORES_LAB[0], referencia: "", texto: "", acao: "", retrabalho: false });
  const [f, setF] = useState(vazio);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState("");

  const doMes = dados.ncs.filter((n) => n.mes === mes).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const lista = filtro ? doMes.filter((n) => n.situacao === filtro) : doMes;
  const pag = usePaginacao(lista, 8, `${mes}-${filtro}`);
  const abertas = dados.ncs.filter((n) => n.situacao !== "encerrada");
  const retrabalhos = doMes.filter((n) => n.retrabalho || n.tipo === "Ensaio repetido (retrabalho)").length;
  const porTipo = TIPOS_NC.map((t) => ({ t, n: doMes.filter((x) => x.tipo === t).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const registrar = async () => {
    if (!f.texto.trim()) { setErro("Descreva a não conformidade."); return; }
    setSalvando(true); setErro("");
    try {
      await gravar("ncs", { ...f, referencia: f.referencia.trim(), texto: f.texto.trim(), acao: f.acao.trim(), mes: mesDeData(new Date(`${f.data}T15:00:00Z`)), situacao: "aberta" });
      setF(vazio());
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  };

  return (
    <>
      <Cabecalho sobre="Não conformidades" titulo={mesLongo(mes)} sub="Registre na hora: o que aconteceu, onde, a amostra ou OS e a ação imediata. O indicador do mês sai daqui.">
        <SeletorMes />
      </Cabecalho>
      <div className="grade grade-kpi">
        <Kpi rotulo={`NCs em ${mesNome(mes)}`} valor={doMes.length} />
        <Kpi rotulo="Retrabalho (ensaio repetido)" valor={retrabalhos} />
        <Kpi rotulo="Abertas (todos os meses)" valor={abertas.length} tomSub={abertas.length ? "ruim" : "ok"} sub={abertas.length ? "precisam de tratamento" : "nenhuma pendente"} />
        <Kpi rotulo="Tipo mais frequente" valor={porTipo[0]?.n || 0} sub={porTipo[0]?.t || "—"} />
      </div>
      <div className="grade grade-2" style={{ alignItems: "start" }}>
        <Card>
          <h2>Registrar não conformidade</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="campo" style={{ flex: "1 1 220px" }}><label htmlFor="nc-tipo">Tipo</label>
                <select id="nc-tipo" className="entrada" value={f.tipo} onChange={set("tipo")}>{TIPOS_NC.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="campo" style={{ flex: "0 1 170px" }}><label htmlFor="nc-data">Data</label><input id="nc-data" type="date" className="entrada" value={f.data} onChange={set("data")} /></div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="campo" style={{ flex: "1 1 180px" }}><label htmlFor="nc-setor">Setor</label>
                <select id="nc-setor" className="entrada" value={f.setor} onChange={set("setor")}>{SETORES_LAB.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="campo" style={{ flex: "1 1 180px" }}><label htmlFor="nc-ref">OS ou amostra</label><input id="nc-ref" className="entrada" value={f.referencia} onChange={set("referencia")} placeholder="Ex.: OS 1234 / amostra 5678" /></div>
            </div>
            <div className="campo"><label htmlFor="nc-texto">O que aconteceu</label><textarea id="nc-texto" className="entrada" rows={3} value={f.texto} onChange={set("texto")} placeholder="Ex.: amostra de água chegou a 9 °C" /></div>
            <div className="campo"><label htmlFor="nc-acao">Ação imediata</label><textarea id="nc-acao" className="entrada" rows={2} value={f.acao} onChange={set("acao")} placeholder="Ex.: cliente avisado; texto padrão no laudo" /></div>
            <label className="peq" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.retrabalho} onChange={set("retrabalho")} /> Gerou retrabalho (ensaio repetido, nova coleta ou novo laudo)</label>
            {erro && <div className="aviso ruim">{erro}</div>}
            <div><button type="button" className="btn" disabled={salvando} onClick={registrar}>{salvando ? "Registrando…" : "Registrar"}</button></div>
            <div className="aviso alerta peq">Sem nome de cliente nem dado de saúde aqui: use o número da OS ou da amostra.</div>
          </div>
        </Card>

        <Card semPad>
          <div className="card-cab">
            <h2>NCs de {mesNome(mes)}</h2>
            <div className="pilulas">
              <button type="button" className={`pilula${!filtro ? " ativa" : ""}`} onClick={() => setFiltro("")}>Todas</button>
              {SITUACOES.map(([id, nome]) => <button key={id} type="button" className={`pilula${filtro === id ? " ativa" : ""}`} onClick={() => setFiltro(id)}>{nome}</button>)}
            </div>
          </div>
          {lista.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma não conformidade {filtro ? "nessa situação " : ""}neste mês.</div> : (
            <div className="tabela-caixa">
              <table>
                <tbody>
                  {pag.itens.map((n) => {
                    const st = SITUACOES.find((x) => x[0] === n.situacao) || SITUACOES[0];
                    return (
                      <tr key={n.id}>
                        <td style={{ width: 90 }} className="tnum suave">{dataCurta(n.data)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontWeight: 600 }}>{n.tipo}</b><Chip>{n.setor}</Chip>{n.referencia && <span className="suave peq">{n.referencia}</span>}{n.retrabalho && <Chip tom="alerta">retrabalho</Chip>}</div>
                          <div className="peq" style={{ marginTop: 2 }}>{n.texto}</div>
                          {n.acao && <div className="suave peq">Ação: {n.acao}</div>}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <select className="entrada peq" aria-label="Situação" value={n.situacao || "aberta"} onChange={(e) => gravar("ncs", { ...n, situacao: e.target.value })} style={{ width: 140 }}>
                            {SITUACOES.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                          </select>
                          <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}><Chip tom={st[2]}>{st[1]}</Chip><button type="button" className="btn perigo mini" onClick={() => window.confirm("Apagar este registro?") && remover("ncs", n.id)}>Apagar</button></div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Paginacao pag={pag} rotulo="registros" />
        </Card>
      </div>
    </>
  );
}
