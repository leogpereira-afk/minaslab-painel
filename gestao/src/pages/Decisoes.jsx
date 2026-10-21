// Diário de decisões: registrar o problema, as opções, o número que sustentou
// a escolha e a data de revisão. Na data, comparar o esperado com o que houve.
import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Modal, Abas, Paginacao, usePaginacao } from "../components/ui.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { hojeBR, dataCurta } from "../lib/format.js";

export default function Decisoes() {
  const { dados } = useBase();
  const [editando, setEditando] = useState(null);
  const [revisando, setRevisando] = useState(null);
  const hoje = hojeBR();
  const lista = [...dados.decisoes].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const aRevisar = lista.filter((d) => d.revisao && d.revisao <= hoje && !d.revisada);
  const [aba, setAba] = useState("abertas");
  const grupos = { abertas: lista.filter((d) => !d.revisada), revisar: aRevisar, revisadas: lista.filter((d) => d.revisada), todas: lista };
  const pag = usePaginacao(grupos[aba], 6, aba);

  return (
    <>
      <Cabecalho sobre="Decisões" titulo="Diário de decisões" sub="Decisões maiores (meta, preço, contratação, novo segmento) com o porquê e a data de revisão.">
        <button type="button" className="btn" onClick={() => setEditando({ data: hoje })}>Registrar decisão</button>
      </Cabecalho>
      <Orientacao tela="decisoes" />
      {aRevisar.length > 0 && <div className="aviso alerta">{aRevisar.length} decisão(ões) chegaram na data de revisão.</div>}
      {lista.length > 0 && <Abas valor={aba} aoMudar={setAba} abas={[["abertas", "Em aberto", grupos.abertas.length], ["revisar", "Para revisar", aRevisar.length], ["revisadas", "Revisadas", grupos.revisadas.length], ["todas", "Todas", lista.length]]} />}
      {lista.length > 0 && pag.n === 0 && <div className="vazio">Nada nesta lista.</div>}
      {lista.length === 0 && <Card><p className="suave" style={{ margin: 0 }}>Nenhuma decisão registrada. Use para escolhas que mudam o resultado do setor — e volte nelas na data marcada.</p></Card>}
      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        {pag.itens.map((d) => {
          const vencida = d.revisao && d.revisao <= hoje && !d.revisada;
          return (
            <Card key={d.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <h3>{d.titulo}</h3>
                {d.revisada ? <Chip tom="ok">Revisada</Chip> : vencida ? <Chip tom="alerta">Revisar</Chip> : d.revisao ? <Chip>Revisão {dataCurta(d.revisao)}</Chip> : null}
              </div>
              <div className="suave peq">Decidida em {dataCurta(d.data)}</div>
              {d.problema && <div className="peq"><b>Problema:</b> {d.problema}</div>}
              {d.opcoes && <div className="peq"><b>Opções:</b> {d.opcoes}</div>}
              {d.escolha && <div className="peq"><b>Escolha:</b> {d.escolha}</div>}
              {d.numero && <div className="peq"><b>O número que sustentou:</b> {d.numero}</div>}
              {d.esperado && <div className="peq"><b>O que esperamos:</b> {d.esperado}</div>}
              {d.revisada && <div className="aviso marca peq"><b>O que aconteceu:</b> {d.resultado}<br /><b>Decidiria igual?</b> {d.decidiriaIgual}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <button type="button" className="btn claro mini" onClick={() => setEditando(d)}>Editar</button>
                {!d.revisada && <button type="button" className="btn mini" onClick={() => setRevisando(d)}>Revisar agora</button>}
              </div>
            </Card>
          );
        })}
      </div>
      <Paginacao pag={pag} rotulo="decisões" />
      {editando && <Editor inicial={editando} aoFechar={() => setEditando(null)} />}
      {revisando && <Revisao d={revisando} aoFechar={() => setRevisando(null)} />}
    </>
  );
}

function Editor({ inicial, aoFechar }) {
  const { gravar, remover } = useBase();
  const [d, setD] = useState({ titulo: "", problema: "", opcoes: "", escolha: "", numero: "", esperado: "", revisao: "", ...inicial });
  const [erro, setErro] = useState("");
  const campo = (k) => ({ value: d[k] || "", onChange: (e) => setD((x) => ({ ...x, [k]: e.target.value })) });
  const salvar = async () => {
    if (!d.titulo.trim()) { setErro("Dê um título à decisão."); return; }
    try { await gravar("decisoes", { ...d, titulo: d.titulo.trim() }); aoFechar(); } catch (e) { setErro(e.message); }
  };
  return (
    <Modal titulo={inicial.id ? "Editar decisão" : "Registrar decisão"} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="campo"><label htmlFor="d-tit">Decisão</label><input id="d-tit" className="entrada" {...campo("titulo")} placeholder="Ex.: Meta de propostas da equipe sobe para 120 em novembro" /></div>
        <div className="campo"><label htmlFor="d-prob">Problema, em uma frase</label><input id="d-prob" className="entrada" {...campo("problema")} /></div>
        <div className="campo"><label htmlFor="d-op">Opções consideradas</label><textarea id="d-op" className="entrada" rows={2} {...campo("opcoes")} /></div>
        <div className="campo"><label htmlFor="d-esc">O que foi escolhido</label><input id="d-esc" className="entrada" {...campo("escolha")} /></div>
        <div className="campo"><label htmlFor="d-num">O número que sustentou a escolha</label><input id="d-num" className="entrada" {...campo("numero")} /></div>
        <div className="campo"><label htmlFor="d-esp">O que esperamos que aconteça</label><input id="d-esp" className="entrada" {...campo("esperado")} /></div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="campo"><label htmlFor="d-data">Data</label><input id="d-data" type="date" className="entrada" {...campo("data")} /></div>
          <div className="campo"><label htmlFor="d-rev">Revisar em</label><input id="d-rev" type="date" className="entrada" {...campo("revisao")} /></div>
        </div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          {inicial.id ? <button type="button" className="btn perigo" onClick={() => window.confirm("Apagar esta decisão?") && remover("decisoes", inicial.id).then(aoFechar)}>Apagar</button> : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
            <button type="button" className="btn" onClick={salvar}>Salvar</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Revisao({ d, aoFechar }) {
  const { gravar } = useBase();
  const [resultado, setResultado] = useState("");
  const [igual, setIgual] = useState("Sim");
  const salvar = async () => { await gravar("decisoes", { ...d, revisada: true, resultado, decidiriaIgual: igual, revisadaEm: hojeBR() }); aoFechar(); };
  return (
    <Modal titulo={`Revisar: ${d.titulo}`} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {d.esperado && <div className="aviso marca peq"><b>Esperávamos:</b> {d.esperado}</div>}
        <div className="campo"><label htmlFor="r-res">O que aconteceu (com o número)</label><textarea id="r-res" className="entrada" rows={3} value={resultado} onChange={(e) => setResultado(e.target.value)} /></div>
        <div className="campo"><label htmlFor="r-ig">Com o que sabíamos na época, decidiríamos igual?</label><select id="r-ig" className="entrada" value={igual} onChange={(e) => setIgual(e.target.value)}><option>Sim</option><option>Sim, mas executaríamos diferente</option><option>Não</option></select></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" onClick={salvar}>Salvar revisão</button>
        </div>
      </div>
    </Modal>
  );
}
