import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Paginacao, usePaginacao } from "../components/ui.jsx";
import { SeletorMes } from "../components/Layout.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { mesLongo, mesNome, hojeBR, dataCurta, mesDeData } from "../lib/format.js";
import { TIPOS_OCORRENCIA } from "../lib/calculos.js";

export default function Ocorrencias() {
  const { equipe, mes, dados, gravar, remover, config } = useBase();
  const [pessoaId, setPessoaId] = useState(equipe[0]?.id || "equipe");
  const [tipo, setTipo] = useState(TIPOS_OCORRENCIA[0]);
  const [data, setData] = useState(hojeBR());
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const nome = (id) => (id === "equipe" ? "Equipe (coletiva)" : equipe.find((m) => m.id === id)?.nome || "Pessoa removida");
  const doMes = dados.ocorrencias.filter((o) => o.mes === mes).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const pag = usePaginacao(doMes, 8, mes);
  const porTipo = TIPOS_OCORRENCIA.map((t) => ({ t, n: doMes.filter((o) => o.tipo === t).length })).filter((x) => x.n);

  const registrar = async () => {
    if (!texto.trim()) { setErro("Descreva o que aconteceu."); return; }
    setSalvando(true);
    setErro("");
    try {
      // O mês da ocorrência é o da data do fato, em Brasília.
      const mesFato = mesDeData(new Date(`${data}T15:00:00Z`));
      await gravar("ocorrencias", { pessoaId, tipo, data, mes: mesFato, texto: texto.trim() });
      setTexto("");
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Cabecalho sobre="Ocorrências" titulo={mesLongo(mes)} sub={`Registre o fato na hora. Cada ocorrência individual desconta ${String(config.desconto).replace(".", ",")} da nota do mês.`}>
        <SeletorMes />
      </Cabecalho>
      <Orientacao tela="ocorrencias" />
      <div className="grade grade-2" style={{ alignItems: "start" }}>
        <Card>
          <h2>Registrar ocorrência</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            <div className="campo">
              <label htmlFor="oc-pessoa">Quem</label>
              <select id="oc-pessoa" className="entrada" value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
                {equipe.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                <option value="equipe">Equipe (coletiva, não desconta de ninguém)</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="campo" style={{ flex: "1 1 200px" }}>
                <label htmlFor="oc-tipo">Tipo</label>
                <select id="oc-tipo" className="entrada" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPOS_OCORRENCIA.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="campo" style={{ flex: "0 1 170px" }}>
                <label htmlFor="oc-data">Data do fato</label>
                <input id="oc-data" type="date" className="entrada" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="oc-texto">O que aconteceu</label>
              <textarea id="oc-texto" className="entrada" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: proposta enviada sem os parâmetros pedidos pelo cliente" />
            </div>
            {erro && <div className="aviso ruim">{erro}</div>}
            <div><button type="button" className="btn" disabled={salvando} onClick={registrar}>{salvando ? "Registrando…" : "Registrar"}</button></div>
            <div className="aviso alerta peq">Atestado médico não é ocorrência: é falta justificada e dado de saúde. Ausências ficam no Ponto do painel.</div>
          </div>
        </Card>

        <Card semPad>
          <div className="card-cab">
            <h2>Ocorrências de {mesNome(mes)}</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{porTipo.map((x) => <Chip key={x.t}>{x.t}: {x.n}</Chip>)}</div>
          </div>
          {doMes.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma ocorrência registrada neste mês.</div> : (
            <div className="tabela-caixa">
              <table>
                <tbody>
                  {pag.itens.map((o) => (
                    <tr key={o.id}>
                      <td style={{ width: 90 }} className="tnum suave">{dataCurta(o.data)}</td>
                      <td><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontWeight: 600 }}>{nome(o.pessoaId)}</b><Chip tom="alerta">{o.tipo}</Chip></div><div className="suave peq" style={{ marginTop: 2 }}>{o.texto}</div></td>
                      <td style={{ textAlign: "right" }}><button type="button" className="btn perigo mini" onClick={() => window.confirm("Apagar esta ocorrência?") && remover("ocorrencias", o.id)}>Apagar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacao pag={pag} rotulo="ocorrências" />
        </Card>
      </div>
    </>
  );
}
