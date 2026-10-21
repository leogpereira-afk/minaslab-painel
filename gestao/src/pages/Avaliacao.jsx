import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho } from "../components/ui.jsx";
import { SeletorMes } from "../components/Layout.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { SeletorPessoa } from "./Pessoas.jsx";
import { navegar } from "../lib/rota.js";
import { brl, nota, mesLongo, mesNome } from "../lib/format.js";
import { avaliar, criteriosDaFuncao } from "../lib/calculos.js";

export default function Avaliacao({ param }) {
  const { equipe, mes } = useBase();
  const membro = equipe.find((m) => m.id === param) || equipe[0];
  return (
    <>
      <Cabecalho sobre="Avaliação e bônus" titulo={mesLongo(mes)} sub="Metas vêm do CRM; os demais critérios você dá de 0 a 10.">
        <SeletorMes />
      </Cabecalho>
      <Orientacao tela="avaliacao" />
      {!membro ? (
        <Card><button type="button" className="btn" onClick={() => navegar("equipe")}>Montar a equipe e as metas</button></Card>
      ) : (
        <>
          <SeletorPessoa atual={membro.id} tela="avaliacao" />
          <Ficha key={`${membro.id}_${mes}`} membro={membro} />
          <ResumoEquipe />
        </>
      )}
    </>
  );
}

function Ficha({ membro }) {
  const { resumo, mes, config, dados, gravar, ocorrenciasDe, funcaoDe } = useBase();
  const funcao = funcaoDe(membro);
  const id = `${membro.id}_${mes}`;
  const salva = dados.avaliacoes.find((a) => a.id === id);
  const [notas, setNotas] = useState(() => ({ ...(salva?.notas || {}) }));
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const fechada = !!salva?.fechada;
  const nOc = ocorrenciasDe(membro.id).length;
  const a = avaliar({ resumo, membro, mes, notas, nOcorrencias: nOc, config, criteriosTecnicos: criteriosDaFuncao(funcao) });
  const mudou = JSON.stringify(notas) !== JSON.stringify(salva?.notas || {});

  const guardar = async (fechar) => {
    setSalvando(true);
    setMsg("");
    try {
      const reg = { id, pessoaId: membro.id, mes, notas, fechada: fechar };
      if (fechar) reg.resultado = { base: a.base, final: a.final, bonus: a.bonus, faixa: a.faixa.rotulo, nOcorrencias: nOc, fechadaEm: new Date().toISOString() };
      await gravar("avaliacoes", reg);
      setMsg(fechar ? "Avaliação fechada." : "Notas salvas.");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const linha = (c) => (
    <tr key={c.id}>
      <td><label htmlFor={`n-${c.id}`} style={{ fontWeight: 600 }}>{c.nome}</label>{c.desc && <div className="suave peq">{c.desc}</div>}</td>
      <td style={{ textAlign: "right" }}>
        <input id={`n-${c.id}`} className="entrada num" type="number" min="0" max="10" step="0.5" disabled={fechada}
          value={notas[c.id] ?? ""} placeholder="—" onChange={(e) => setNotas((n) => ({ ...n, [c.id]: e.target.value }))} />
      </td>
    </tr>
  );

  return (
    <div className="grade grade-2" style={{ alignItems: "start" }}>
      <Card semPad>
        <div className="card-cab"><h2>Critérios de {membro.nome.split(" ")[0]}</h2>{fechada && <Chip tom="ok">Fechada</Chip>}</div>
        <table>
          <tbody>
            <tr className="linha-grupo"><td colSpan={2}>Metas (automático · peso {config.pesos.metas}%)</td></tr>
            {a.auto.map((c) => (
              <tr key={c.id}><td><b style={{ fontWeight: 600 }}>{c.nome}</b><div className="suave peq">{c.desc}</div></td><td className="tnum" style={{ textAlign: "right", font: "600 18px Poppins, sans-serif" }}>{nota(c.nota)}</td></tr>
            ))}
            <tr className="linha-grupo"><td colSpan={2}>Técnicos{funcao ? ` da função ${funcao.nome}` : ""} (peso {config.pesos.tec}%)</td></tr>
            {a.tec.map(linha)}
            <tr className="linha-grupo"><td colSpan={2}>Comportamentais (peso {config.pesos.comp}%)</td></tr>
            {a.comp.map(linha)}
          </tbody>
        </table>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Card>
          <h2>Resultado de {mesNome(mes)}</h2>
          <div className="grade" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 14 }}>
            <Valor rot="Média ponderada" val={nota(a.base)} />
            <Valor rot={`Ocorrências (${a.nOcorrencias} × ${String(config.desconto).replace(".", ",")})`} val={a.desconto ? `−${nota(a.desconto)}` : "0"} cor="var(--ruim)" />
            <Valor rot="Nota final" val={nota(a.final)} />
            <Valor rot="Bonificação" val={a.bonus == null ? "—" : a.bonus ? brl(a.bonus) : "Sem bônus"} cor={a.bonus ? "var(--ok)" : undefined} />
          </div>
          <div style={{ marginTop: 14 }}><Chip tom={a.faixa.tom}>{a.faixa.rotulo}</Chip></div>
          {a.pendencias.length > 0 && <div className="suave peq" style={{ marginTop: 10 }}>Falta: {a.pendencias.join(" · ")}.</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            {!fechada && <button type="button" className="btn claro" disabled={salvando || !mudou} onClick={() => guardar(false)}>Salvar notas</button>}
            {!fechada && <button type="button" className="btn" disabled={salvando || !a.completa} onClick={() => guardar(true)} title={a.completa ? "" : "Preencha todos os critérios para fechar"}>Fechar avaliação</button>}
            {fechada && <button type="button" className="btn claro" disabled={salvando} onClick={() => guardar(false)}>Reabrir</button>}
          </div>
          {msg && <div className="peq" style={{ marginTop: 8 }}>{msg}</div>}
        </Card>
        <Card>
          <h3>A regra, igual para todos</h3>
          <ul className="peq" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Nota final = média ponderada dos critérios − {String(config.desconto).replace(".", ",")} por ocorrência do mês (máximo −{String(config.descontoMax).replace(".", ",")}).</li>
            <li>Nota ≥ {config.bonus.f1}: {brl(config.bonus.v1)} · nota ≥ {config.bonus.f2}: {brl(config.bonus.v2)} · abaixo: sem bônus.</li>
            <li>O bônus sai da <b>nota final</b>, depois das ocorrências.</li>
            <li>Atestado médico, férias e faltas justificadas não entram na avaliação.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ResumoEquipe() {
  const { equipe, resumo, mes, config, dados, ocorrenciasDe, funcaoDe } = useBase();
  const linhas = equipe.map((m) => {
    const salva = dados.avaliacoes.find((a) => a.id === `${m.id}_${mes}`);
    const a = avaliar({ resumo, membro: m, mes, notas: salva?.notas || {}, nOcorrencias: ocorrenciasDe(m.id).length, config, criteriosTecnicos: criteriosDaFuncao(funcaoDe(m)) });
    return { m, a, fechada: !!salva?.fechada };
  });
  const total = linhas.reduce((s, l) => s + (l.fechada ? l.a.bonus || 0 : 0), 0);
  return (
    <Card semPad>
      <div className="card-cab"><h2>Equipe em {mesNome(mes)}</h2><span className="suave peq">Bônus das avaliações fechadas: <b>{brl(total)}</b></span></div>
      <div className="tabela-caixa">
        <table>
          <thead><tr><th>Pessoa</th><th>Nota final</th><th>Faixa</th><th>Bônus</th><th>Situação</th></tr></thead>
          <tbody>
            {linhas.map(({ m, a, fechada }) => (
              <tr key={m.id}>
                <td><button type="button" className="btn claro mini" onClick={() => navegar("avaliacao", m.id)}>{m.nome}</button></td>
                <td className="tnum">{nota(a.final)}</td>
                <td><Chip tom={a.faixa.tom}>{a.faixa.rotulo}</Chip></td>
                <td className="tnum">{a.bonus == null ? "—" : brl(a.bonus)}</td>
                <td>{fechada ? <Chip tom="ok">Fechada</Chip> : <Chip>Aberta</Chip>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Valor({ rot, val, cor }) {
  return (
    <div>
      <div className="suave peq">{rot}</div>
      <div className="kpi-val tnum" style={cor ? { color: cor } : undefined}>{val}</div>
    </div>
  );
}
