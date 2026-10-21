// Licitações: em andamento, prazos, taxa de vitória e motivos de perda (CRM).
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Kpi, Cabecalho, Paginacao, usePaginacao } from "../components/ui.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { licitacoesCRM } from "../services/crm.js";
import { brl, pct, dataCurta } from "../lib/format.js";

const ANDAMENTO = ["ANALISE", "MONITORAMENTO", "PROPOSTA_ENVIADA", "HABILITACAO", "RECURSO", "SESSAO"];
const TOM = { GANHA: "ok", PERDIDA: "ruim", CANCELADA: "neutro" };
const rotulo = (s) => String(s || "—").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default function Licitacoes() {
  const l = useCRM("licitacoes", licitacoesCRM);
  const { nomeCRM } = useBase();
  const lics = l.dados?.licitacoes || [];
  const st = (x) => String(x.status || "").toUpperCase();
  const ganhas = lics.filter((x) => st(x) === "GANHA");
  const perdidas = lics.filter((x) => st(x) === "PERDIDA");
  const andamento = lics.filter((x) => ANDAMENTO.includes(st(x)) || !["GANHA", "PERDIDA", "CANCELADA"].includes(st(x)));
  const taxa = ganhas.length + perdidas.length ? (ganhas.length / (ganhas.length + perdidas.length)) * 100 : null;
  const hoje = new Date().toISOString().slice(0, 10);
  const prazos = (l.dados?.prazos || []).filter((p) => String(p.prazo).slice(0, 10) >= hoje);
  const motivos = perdidas.map((x) => x.motivo_perda).filter(Boolean);
  const numero = (id) => lics.find((x) => x.id === id);
  const ordenadas = [...lics].sort((a, b) => String(b.data_sessao || "").localeCompare(String(a.data_sessao || "")));
  const pagLic = usePaginacao(ordenadas, 10);
  const pagPrazo = usePaginacao(prazos, 6);
  const pagMot = usePaginacao(motivos, 6);

  return (
    <>
      <Cabecalho sobre="Licitações" titulo="Disputar menos, ganhar mais" sub="Dados do módulo de Licitações do CRM.">
        <button type="button" className="btn claro" onClick={l.recarregar}>Atualizar</button>
      </Cabecalho>
      <Orientacao tela="licitacoes" />
      {l.erro && <div className="aviso ruim">{l.erro}</div>}
      {l.carregando && <div className="carregando">Lendo as licitações no CRM…</div>}
      {l.dados && (
        <>
          <div className="grade grade-kpi">
            <Kpi rotulo="Em andamento" valor={andamento.length} sub="análise, monitoramento ou proposta enviada" />
            <Kpi rotulo="Taxa de vitória" valor={pct(taxa)} sub={`${ganhas.length} ganhas · ${perdidas.length} perdidas`} />
            <Kpi rotulo="Valor homologado ganho" valor={brl(ganhas.reduce((s, x) => s + (Number(x.valor_homologado) || 0), 0), true)} sub="licitações ganhas" />
            <Kpi rotulo="Prazos à frente" valor={prazos.length} sub="sessões, esclarecimentos, recursos" />
          </div>
          <div className="grade grade-2" style={{ alignItems: "start" }}>
            <Card semPad>
              <div className="card-cab"><h2>Próximos prazos</h2></div>
              {prazos.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhum prazo futuro registrado no CRM.</div> : (
                <div className="tabela-caixa"><table><tbody>
                  {pagPrazo.itens.map((p) => (
                    <tr key={p.id}><td className="tnum" style={{ width: 100 }}>{dataCurta(p.prazo)}</td><td><b style={{ fontWeight: 600 }}>{p.titulo || rotulo(p.tipo)}</b><div className="suave peq">{numero(p.licitacao_id)?.orgao} · {numero(p.licitacao_id)?.numero}</div></td></tr>
                  ))}
                </tbody></table></div>
              )}
              <Paginacao pag={pagPrazo} rotulo="prazos" />
            </Card>
            <Card>
              <h2>Por que perdemos</h2>
              {motivos.length === 0 ? <div className="vazio">Nenhum motivo de perda registrado. Registre no CRM a cada resultado: é o que melhora a próxima disputa.</div> : (
                <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>{pagMot.itens.map((m, i) => <li key={i} className="peq" style={{ marginTop: 4 }}>{m}</li>)}</ul>
              )}
              <Paginacao pag={pagMot} rotulo="motivos" />
            </Card>
          </div>
          <Card semPad>
            <div className="card-cab"><h2>Todas as licitações</h2><span className="suave peq">{lics.length}</span></div>
            <div className="tabela-caixa">
              <table>
                <thead><tr><th>Órgão</th><th>Objeto</th><th>Sessão</th><th>Estimado</th><th>Nossa proposta</th><th>Responsável</th><th>Situação</th></tr></thead>
                <tbody>
                  {pagLic.itens.map((x) => (
                    <tr key={x.id}>
                      <td>{x.orgao || "—"}<div className="suave peq">{x.numero} · {x.modalidade}</div></td>
                      <td className="peq" style={{ maxWidth: 320 }}>{x.objeto}</td>
                      <td className="tnum peq">{x.data_sessao ? dataCurta(x.data_sessao) : "—"}</td>
                      <td className="tnum">{x.valor_estimado ? brl(x.valor_estimado, true) : "—"}</td>
                      <td className="tnum">{x.valor_proposta ? brl(x.valor_proposta, true) : "—"}</td>
                      <td className="peq">{x.responsavel_id ? nomeCRM(x.responsavel_id) : "—"}</td>
                      <td><Chip tom={TOM[st(x)] || "alerta"}>{rotulo(x.status)}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pag={pagLic} rotulo="licitações" />
          </Card>
        </>
      )}
    </>
  );
}
