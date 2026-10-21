// Produtividade por analista: lançamento mensal (o CRM ainda não registra
// quem executou cada ensaio). Um registro por pessoa e mês.
import { useEffect, useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Cabecalho, Kpi } from "../components/ui.jsx";
import { SeletorMes } from "../components/Layout.jsx";
import { mesLongo, mesNome, numero, somarMeses } from "../lib/format.js";

const CAMPOS = [
  ["ensaios", "Ensaios realizados"],
  ["laudos", "Laudos ou relatórios emitidos"],
  ["retrabalhos", "Ensaios repetidos"],
];

export default function Produtividade() {
  const { equipe, mes, dados, gravar } = useBase();
  const doMes = (m) => Object.fromEntries(dados.produtividade.filter((x) => x.mes === m).map((x) => [x.pessoaId, x]));
  const atual = doMes(mes);
  const anterior = doMes(somarMeses(mes, -1));
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState("");
  useEffect(() => {
    setForm(Object.fromEntries(equipe.map((m) => [m.id, Object.fromEntries(CAMPOS.map(([k]) => [k, atual[m.id]?.[k] ?? ""]))])));
    setMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, dados.produtividade, equipe.length]);

  const total = (lista, k) => lista.reduce((s, x) => s + (numero(x?.[k]) || 0), 0);
  const tAtual = total(Object.values(atual), "ensaios");
  const tAnt = total(Object.values(anterior), "ensaios");
  const max = Math.max(1, ...equipe.map((m) => numero(form[m.id]?.ensaios) || 0));

  const salvar = async () => {
    setMsg("");
    try {
      for (const m of equipe) {
        const v = form[m.id] || {};
        if (CAMPOS.every(([k]) => v[k] === "" || v[k] == null) && !atual[m.id]) continue;
        const reg = { id: `${mes}_${m.id}`, mes, pessoaId: m.id, nome: m.nome, ...Object.fromEntries(CAMPOS.map(([k]) => [k, numero(v[k])])) };
        await gravar("produtividade", reg);
      }
      setMsg("Salvo.");
    } catch (e) { setMsg(e.message); }
  };

  return (
    <>
      <Cabecalho sobre="Produtividade" titulo={mesLongo(mes)} sub="Lançamento mensal por pessoa. Quando o GerenciaLab passar a registrar quem executou cada ensaio, estes números passam a vir sozinhos.">
        <SeletorMes />
      </Cabecalho>
      <div className="grade grade-kpi">
        <Kpi rotulo={`Ensaios em ${mesNome(mes)}`} valor={tAtual} sub={tAnt ? `${tAnt} no mês anterior` : "—"} />
        <Kpi rotulo="Laudos ou relatórios" valor={total(Object.values(atual), "laudos")} />
        <Kpi rotulo="Ensaios repetidos" valor={total(Object.values(atual), "retrabalhos")} sub={tAtual ? `${Math.round((total(Object.values(atual), "retrabalhos") / tAtual) * 1000) / 10}% dos ensaios` : ""} />
      </div>
      <Card semPad>
        <div className="card-cab"><h2>Lançamentos de {mesNome(mes)}</h2><span className="suave peq">{equipe.length} pessoa(s) na equipe do laboratório</span></div>
        {equipe.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Cadastre a equipe do laboratório em Gestão › Equipe e metas.</div> : (
          <div className="tabela-caixa">
            <table>
              <thead><tr><th>Pessoa</th>{CAMPOS.map(([k, r]) => <th key={k}>{r}</th>)}<th style={{ width: "28%" }}>Ensaios</th></tr></thead>
              <tbody>
                {equipe.map((m) => (
                  <tr key={m.id}>
                    <td>{m.nome}</td>
                    {CAMPOS.map(([k, r]) => (
                      <td key={k}><input className="entrada num" type="number" min="0" aria-label={`${r} de ${m.nome}`} style={{ width: 110 }} value={form[m.id]?.[k] ?? ""} onChange={(e) => setForm({ ...form, [m.id]: { ...form[m.id], [k]: e.target.value } })} /></td>
                    ))}
                    <td><div className="barra-linha"><div style={{ width: `${((numero(form[m.id]?.ensaios) || 0) / max) * 100}%` }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 16 }}>
          <button type="button" className="btn" onClick={salvar} disabled={!equipe.length}>Salvar o mês</button>
          {msg && <span className={msg === "Salvo." ? "suave peq" : "peq"} style={msg === "Salvo." ? undefined : { color: "var(--ruim)" }}>{msg}</span>}
        </div>
      </Card>
    </>
  );
}
