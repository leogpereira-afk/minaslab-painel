// Fase 0 do roteiro: arrumar o dado. Sem responsável nas propostas, nenhuma
// meta individual fecha certo. Esta tela mostra o tamanho do problema e a
// lista do que precisa ser atribuído no CRM.

import { useEffect, useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Kpi, Cabecalho, Paginacao, usePaginacao } from "../components/ui.jsx";
import { SeletorMes } from "../components/Layout.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { propostasSemResponsavel } from "../services/crm.js";
import { brl, pct, mesLongo, mesCurto, mesesAte, dataCurta } from "../lib/format.js";
import { totaisMes } from "../lib/calculos.js";

export default function QualidadeDado() {
  const { resumo, mes, erroCRM } = useBase();
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (erroCRM) return;
    let vivo = true;
    setLista(null);
    setErro("");
    propostasSemResponsavel(mes)
      .then((r) => vivo && setLista(r.itens || []))
      .catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [mes, erroCRM]);

  const t = totaisMes(resumo, mes);
  const historico = mesesAte(mes, 6).map((m) => ({ m, ...totaisMes(resumo, m) }));
  const meta = 5;
  const pag = usePaginacao(lista || [], 10, mes);

  return (
    <>
      <Cabecalho sobre="Qualidade do dado · Fase 0" titulo={`Propostas sem responsável em ${mesLongo(mes).toLowerCase()}`} sub="Meta da Fase 0: menos de 5% das propostas do mês sem responsável.">
        <SeletorMes />
      </Cabecalho>
      <Orientacao tela="dado" />

      <div className="grade grade-kpi">
        <Kpi rotulo="Sem responsável" valor={t.semResponsavel} sub={`de ${t.enviadas} propostas no mês`} />
        <Kpi rotulo="Percentual do mês" valor={pct(t.pctSemResponsavel)} sub={t.pctSemResponsavel <= meta ? "dentro da meta" : `meta: abaixo de ${meta}%`} tomSub={t.pctSemResponsavel <= meta ? "ok" : "ruim"} />
      </div>

      <div className="grade grade-2">
        <Card semPad>
          <div className="card-cab"><h2>Para atribuir no CRM</h2><span className="suave peq">{lista ? `${lista.length} proposta(s)` : ""}</span></div>
          {erroCRM ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Disponível quando a função do CRM estiver publicada.</div>
            : erro ? <div className="aviso ruim" style={{ margin: "0 20px 20px" }}>{erro}</div>
            : !lista ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Carregando…</div>
            : lista.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma proposta sem responsável neste mês.</div>
            : (
              <div className="tabela-caixa">
                <table>
                  <thead><tr><th>Data</th><th>Proposta</th><th>Cliente</th><th>Valor</th><th>Situação</th></tr></thead>
                  <tbody>
                    {pag.itens.map((p) => (
                      <tr key={p.id}>
                        <td className="tnum">{dataCurta(p.data)}</td>
                        <td className="tnum">{p.numero || "—"}</td>
                        <td>{p.cliente || "—"}</td>
                        <td className="tnum">{p.valor ? brl(p.valor) : "—"}</td>
                        <td><Chip tom={p.status === "APROVADA" ? "ok" : p.status === "RECUSADA" ? "ruim" : "neutro"}>{p.status}</Chip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Paginacao pag={pag} rotulo="propostas" />
              </div>
            )}
        </Card>
        <Card>
          <h2>Evolução nos últimos 6 meses</h2>
          <div className="suave peq" style={{ marginTop: 4 }}>% das propostas do mês sem responsável · linha: meta de 5%</div>
          <div className="graf" style={{ height: 170 }}>
            <div className="graf-meta" style={{ bottom: (meta / 100) * 130 + 1, borderColor: "var(--ok)" }} />
            {historico.map((h) => (
              <div className="graf-col" key={h.m}>
                <span className="graf-val">{pct(h.pctSemResponsavel)}</span>
                <div className="graf-barra" style={{ height: (h.pctSemResponsavel / 100) * 130, background: h.m === mes ? "var(--marca)" : "#b9caca" }} />
              </div>
            ))}
          </div>
          <div className="graf-rotulos">{historico.map((h) => <span key={h.m}>{mesCurto(h.m)}</span>)}</div>
          <div className="aviso marca" style={{ marginTop: 16 }}>
            Como resolver de vez: combinar com a equipe que toda proposta nasce com responsável e aplicar o treinamento “CRM sem furos”.
          </div>
        </Card>
      </div>
    </>
  );
}
