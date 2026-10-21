import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Kpi, Cabecalho, Pontos, GraficoMeses, iniciais } from "../components/ui.jsx";
import { SeletorMes } from "../components/Layout.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { navegar } from "../lib/rota.js";
import { brl, pct, mesLongo, mesCurto, mesAtual, somarMeses } from "../lib/format.js";
import { realizado, totaisMes, metasDe, situacao, pontos, serie } from "../lib/calculos.js";

const COR = { ok: "#16a34a", alerta: "#d97706", ruim: "#dc2626", neutro: "#94a3b8" };

export default function VisaoMes() {
  const { resumo, equipe, mes, ocorrenciasDe, dados } = useBase();
  const t = totaisMes(resumo, mes);
  const anterior = totaisMes(resumo, somarMeses(mes, -1));
  const ocMes = dados.ocorrencias.filter((o) => o.mes === mes);

  const linhas = equipe.map((m) => {
    const r = realizado(resumo, m, mes);
    const metas = metasDe(m);
    const s = situacao(r, metas);
    const prop = metas.propostas ? r.enviadas / metas.propostas : null;
    return { m, r, metas, s, prop };
  });

  const atencao = [];
  if (t.enviadas && t.pctSemResponsavel > 5) {
    atencao.push({ tom: t.pctSemResponsavel > 15 ? "ruim" : "alerta", titulo: `${t.semResponsavel} propostas sem responsável (${pct(t.pctSemResponsavel)} do mês)`, texto: "Distorce a meta de cada pessoa. Veja a lista em Qualidade do dado." });
  }
  for (const m of equipe) {
    for (const p of pontos(resumo, m, mes, ocorrenciasDe(m.id).length)) {
      if (p.tom !== "ok") atencao.push({ ...p, titulo: `${m.nome.split(" ")[0]}: ${p.titulo}` });
    }
  }
  const ocEquipe = ocorrenciasDe("equipe").length;
  if (ocEquipe) atencao.push({ tom: "alerta", titulo: `${ocEquipe} ocorrência${ocEquipe > 1 ? "s" : ""} coletiva${ocEquipe > 1 ? "s" : ""}`, texto: "Registradas para a equipe toda, em Ocorrências." });

  const emAndamento = mes === mesAtual();

  return (
    <>
      <Cabecalho sobre="Visão do mês" titulo={mesLongo(mes)} sub={emAndamento ? "Mês em andamento: números até hoje." : "Mês fechado."}>
        <SeletorMes />
      </Cabecalho>
      <Orientacao tela="visao" />

      <div className="grade grade-kpi">
        <Kpi rotulo="Propostas da equipe" valor={t.enviadas} sub={`mês anterior: ${anterior.enviadas}`} />
        <Kpi rotulo="Aprovadas" valor={t.aprovadas} sub={t.enviadas ? `${pct(t.taxa)} das enviadas · ${t.abertas} sem resposta` : "sem propostas"} />
        <Kpi rotulo="Valor aprovado" valor={brl(t.valorAprovado, true)} sub={`mês anterior: ${brl(anterior.valorAprovado, true)}`} tomSub={t.valorAprovado < anterior.valorAprovado * 0.7 ? "ruim" : undefined} />
        <Kpi rotulo="Sem responsável no CRM" valor={t.semResponsavel} sub={t.enviadas ? `${pct(t.pctSemResponsavel)} do mês` : "—"} tomSub={t.pctSemResponsavel > 5 ? "ruim" : undefined} />
      </div>

      <Card semPad>
        <div className="card-cab">
          <h2>Metas × realizado por pessoa</h2>
          <span className="suave peq">Fonte: CRM › Propostas (responsável e data de envio)</span>
        </div>
        {equipe.length === 0 ? (
          <div style={{ padding: "8px 20px 20px" }}>
            <p className="suave" style={{ marginTop: 0 }}>Ninguém cadastrado na equipe ainda.</p>
            <button type="button" className="btn" onClick={() => navegar("equipe")}>Montar a equipe e as metas</button>
          </div>
        ) : (
          <div className="tabela-caixa">
            <table>
              <thead><tr><th>Pessoa</th><th>Propostas</th><th>Aprovação</th><th>Valor aprovado</th><th>Ocorrências</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {linhas.map(({ m, r, metas, s, prop }) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span className="avatar">{iniciais(m.nome)}</span>
                        <span><b style={{ display: "block", fontWeight: 600 }}>{m.nome}</b><span className="suave peq">{m.funcao}</span></span>
                      </div>
                    </td>
                    <td>
                      <div className="tnum" style={{ fontWeight: 600 }}>{metas.propostas ? `${r.enviadas} / ${metas.propostas}` : r.enviadas}</div>
                      <div className="barra" style={{ marginTop: 6 }}>
                        <div style={{ width: `${prop == null ? (r.enviadas ? 100 : 0) : Math.min(100, prop * 100)}%`, background: COR[s.tom] }} />
                      </div>
                    </td>
                    <td className="tnum"><b style={{ fontWeight: 600 }}>{pct(r.taxa)}</b><div className="suave peq">{metas.aprovacao ? `meta ${metas.aprovacao}%` : "sem meta"}</div></td>
                    <td className="tnum">{brl(r.valorAprovado, true)}</td>
                    <td className="tnum">{ocorrenciasDe(m.id).length}</td>
                    <td><Chip tom={s.tom}>{s.rotulo}</Chip></td>
                    <td style={{ textAlign: "right" }}><button type="button" className="btn claro mini" onClick={() => navegar("pessoas", m.id)}>Abrir ficha</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grade grade-2">
        <Card>
          <h2>Pontos de atenção</h2>
          <div className="suave peq" style={{ marginTop: 4 }}>Gerados pelos números do mês e pelas metas cadastradas.</div>
          <div style={{ marginTop: 6 }}>
            <Pontos lista={atencao.length ? atencao : [{ tom: "ok", titulo: "Nada fora do esperado", texto: equipe.length ? "As metas cadastradas estão em dia." : "" }]} />
          </div>
          {ocMes.length > 0 && <div className="suave peq" style={{ marginTop: 8 }}>{ocMes.length} ocorrência(s) registradas no mês.</div>}
        </Card>
        <Card>
          <h2>Propostas da equipe por mês</h2>
          <div className="suave peq" style={{ marginTop: 4 }}>Barra inteira: enviadas · parte escura: aprovadas</div>
          <GraficoMeses serie={serie(resumo, "equipe", mes, 9)} mesDestaque={mes} rotuloMes={mesCurto} />
        </Card>
      </div>
    </>
  );
}
