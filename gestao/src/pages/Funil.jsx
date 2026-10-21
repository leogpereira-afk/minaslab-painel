// Funil: onde o resultado se perde. Etapas, conversão entre elas, o gargalo
// e a idade das propostas em aberto (com a chance real de cada faixa).
import { useState } from "react";
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Kpi, Cabecalho, Abas, Paginacao, usePaginacao } from "../components/ui.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { funilCRM, cockpitCRM } from "../services/crm.js";
import { brl, pct, mesCurto } from "../lib/format.js";

export default function Funil() {
  const [meses, setMeses] = useState(6);
  const [aba, setAba] = useState("funil");
  const f = useCRM(`funil-${meses}`, () => funilCRM(meses));
  const ck = useCRM("cockpit", cockpitCRM);
  const { nomeCRM } = useBase();
  const d = f.dados;

  const etapas = d ? [
    { nome: "Leads", n: d.leads.total, obs: `${d.leads.convertidos} convertidos em cliente` },
    { nome: "Oportunidades", n: d.oportunidades.total, obs: `${d.oportunidades.ganhas} ganhas · ${d.oportunidades.perdidas} perdidas` },
    { nome: "Propostas enviadas", n: d.propostas.enviadas, obs: `${d.propostas.abertas} ainda sem resposta` },
    { nome: "Aprovadas", n: d.propostas.aprovadas, obs: `${d.propostas.recusadas} recusadas` },
  ] : [];
  const max = Math.max(1, ...etapas.map((e) => e.n));
  // Gargalo: a passagem com menor conversão entre propostas e aprovadas e as anteriores com volume.
  const conv = etapas.slice(1).map((e, i) => ({ de: etapas[i].nome, para: e.nome, taxa: etapas[i].n ? (e.n / etapas[i].n) * 100 : null }));
  const gargalo = conv.filter((c) => c.taxa != null && c.taxa <= 100 && c.de !== "Leads").sort((a, b) => a.taxa - b.taxa)[0];

  const faixas = ck.dados?.faixas || [];
  const abertas = ck.dados?.abertas || [];
  const porFaixa = faixas.map((fx) => {
    const xs = abertas.filter((a) => a.idade >= fx.de && (fx.ate == null || a.idade < fx.ate));
    return { ...fx, n: xs.length, valor: xs.reduce((s, a) => s + a.valor, 0) };
  });
  const paradas = abertas.filter((a) => a.idade >= 15);
  const pag = usePaginacao(paradas, 10);

  return (
    <>
      <Cabecalho sobre="Funil" titulo={`Últimos ${meses} meses`} sub="Leads, oportunidades e propostas criados no período (CRM).">
        <div className="pilulas" role="group" aria-label="Período">
          {[3, 6, 12].map((n) => <button key={n} type="button" className={`pilula${n === meses ? " ativa" : ""}`} aria-pressed={n === meses} onClick={() => setMeses(n)}>{n} meses</button>)}
        </div>
      </Cabecalho>
      <Orientacao tela="funil" />
      {f.erro && <div className="aviso ruim">{f.erro}</div>}
      {f.carregando && <div className="carregando">Lendo o funil no CRM…</div>}

      <Abas valor={aba} aoMudar={setAba} abas={[["funil", "Etapas do funil"], ["idade", "Idade das propostas"], ["paradas", "Paradas há 15+ dias", paradas.length || ""]]} />

      {aba === "funil" && d && (
        <>
          <div className="grade grade-2" style={{ alignItems: "start" }}>
            <Card>
              <h2>Do lead à proposta aprovada</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
                {etapas.map((e, i) => (
                  <div key={e.nome}>
                    {i > 0 && (
                      <div className="peq" style={{ margin: "0 0 6px 4px", color: gargalo && conv[i - 1].para === gargalo.para ? "var(--ruim)" : "var(--suave)", fontWeight: gargalo && conv[i - 1].para === gargalo.para ? 600 : 400 }}>
                        ↓ {conv[i - 1].taxa == null ? "—" : conv[i - 1].taxa > 100 ? "muitas propostas são feitas sem oportunidade registrada" : `${pct(conv[i - 1].taxa)} seguem`}{gargalo && conv[i - 1].para === gargalo.para ? " · gargalo" : ""}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: `${Math.max(6, (e.n / max) * 100)}%`, minWidth: 40, height: 40, borderRadius: 10, background: i === etapas.length - 1 ? "var(--marca)" : "var(--marca-200)", display: "flex", alignItems: "center", paddingLeft: 12, color: i === etapas.length - 1 ? "#fff" : "var(--marca-900)", font: "600 15px Poppins, sans-serif" }}>{e.n}</div>
                    </div>
                    <div className="peq" style={{ marginTop: 4 }}><b>{e.nome}</b> <span className="suave">· {e.obs}</span></div>
                  </div>
                ))}
              </div>
              <div className="suave peq" style={{ marginTop: 14 }}>Nem todo lead vira oportunidade registrada no CRM: se a passagem de leads para oportunidades parecer baixa, pode ser falta de registro, não de venda.</div>
            </Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="grade grade-kpi">
                <Kpi rotulo="Leads parados há 30+ dias" valor={d.leads.paradosMais30d} sub="“Em atendimento” sem andar" tomSub={d.leads.paradosMais30d > 20 ? "ruim" : undefined} />
                <Kpi rotulo="Conversão proposta → aprovada" valor={pct(d.propostas.enviadas ? (d.propostas.aprovadas / d.propostas.enviadas) * 100 : null)} sub={`${d.propostas.aprovadas} de ${d.propostas.enviadas}`} />
              </div>
              <Card>
                <h3>Leads por origem</h3>
                {Object.entries(d.leads.porOrigem).sort((a, b) => b[1] - a[1]).map(([o, n]) => (
                  <div key={o} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <span className="peq" style={{ width: 110 }}>{o}</span>
                    <div className="barra" style={{ flex: 1 }}><div style={{ width: `${(n / d.leads.total) * 100}%`, background: "var(--marca)" }} /></div>
                    <span className="peq tnum" style={{ width: 36, textAlign: "right" }}>{n}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14 }} className="peq suave">Leads por mês: {Object.entries(d.serieLeads).sort().map(([m, v]) => `${mesCurto(m)} ${v.leads}`).join(" · ")}</div>
              </Card>
            </div>
          </div>
        </>
      )}

      {aba === "idade" && <Card semPad>
        <div className="card-cab"><h2>Propostas em aberto pela idade</h2><span className="suave peq">Chance calculada pelo histórico dos últimos 12 meses</span></div>
        {ck.carregando ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Carregando…</div> : (
          <div className="tabela-caixa">
            <table>
              <thead><tr><th>Idade</th><th>Propostas</th><th>Valor em aberto</th><th>Chance de aprovar</th><th>Casos no histórico</th></tr></thead>
              <tbody>
                {porFaixa.map((fx) => (
                  <tr key={fx.rotulo}>
                    <td>{fx.rotulo}</td>
                    <td className="tnum">{fx.n}</td>
                    <td className="tnum">{brl(fx.valor, true)}</td>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="barra" style={{ width: 120 }}><div style={{ width: `${fx.chance * 100}%`, background: fx.chance >= 0.5 ? "var(--ok)" : fx.chance >= 0.25 ? "#d97706" : "var(--ruim)" }} /></div><span className="tnum peq">{pct(fx.chance * 100)}</span></div></td>
                    <td className="tnum suave">{fx.casos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>}

      {aba === "paradas" && paradas.length === 0 && <div className="vazio">{ck.carregando ? "Carregando…" : "Nenhuma proposta parada há 15 dias ou mais."}</div>}
      {aba === "paradas" && paradas.length > 0 && (
        <Card semPad>
          <div className="card-cab"><h2>Paradas há 15 dias ou mais</h2><span className="suave peq">maiores valores primeiro</span></div>
          <div className="tabela-caixa">
            <table>
              <thead><tr><th>Cliente</th><th>Responsável</th><th>Valor</th><th>Enviada</th><th>Última interação</th><th>Chance</th></tr></thead>
              <tbody>
                {pag.itens.map((p) => (
                  <tr key={p.id}>
                    <td>{p.cliente || "—"}<div className="suave peq">{p.numero}</div></td>
                    <td className="peq">{nomeCRM(p.responsavelId)}</td>
                    <td className="tnum">{brl(p.valor)}</td>
                    <td className="tnum peq">{p.idade} dias</td>
                    <td className="peq">{p.ultimaInteracao ? p.ultimaInteracao.split("-").reverse().join("/") : <Chip tom="alerta">nenhuma</Chip>}</td>
                    <td className="tnum">{pct(p.chance * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacao pag={pag} rotulo="propostas" />
        </Card>
      )}
    </>
  );
}
