// Painel do laboratório: só o que a MinasLab executa. Amostras e ensaios por
// setor (CRM), OS em andamento atrasadas e vencendo, e NCs do mês. Ensaios
// enviados a laboratórios parceiros ficam de fora.
// O CRM não tem a data do laudo: o prazo interno sai do vencimento da OS.
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Kpi, Paginacao, usePaginacao } from "../components/ui.jsx";
import { SeletorMes } from "../components/Layout.jsx";
import { setoresCRM, labPainelCRM } from "../services/crm.js";
import { mesLongo, mesNome, dataCurta, somarMeses, mesAtual } from "../lib/format.js";

const SETORES = [["Microbiologia", "Microbiologia"], ["Físico-química", "Físico-química"], ["Campo", "Campo (in situ)"]];
const pctVar = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);

export default function Laboratorio() {
  const { mes, dados } = useBase();
  const st = useCRM(`setores-${mes}`, () => setoresCRM(mes));
  const lp = useCRM("labPainel", labPainelCRM);
  const ant = somarMeses(mes, -1);
  const at = st.dados?.porMes?.[mes] || { total: 0, ensaios: 0, porSetor: {}, porMatriz: {} };
  const an = st.dados?.porMes?.[ant] || { total: 0, ensaios: 0, porSetor: {} };
  const p = lp.dados;
  const osMes = p?.porMes?.[mes] || { recebidas: 0, concluidas: 0, canceladas: 0 };
  const ncsMes = dados.ncs.filter((n) => n.mes === mes);
  const pagOS = usePaginacao(p?.os?.lista || [], 8);
  // Ensaios feitos na casa: tira os que foram para laboratórios parceiros.
  const ensaiosCasa = (x) => Math.max(0, (x?.ensaios || 0) - (x?.porSetor?.Parceiros?.ensaios || 0));
  const max = Math.max(1, ...SETORES.flatMap(([k]) => [at.porSetor[k]?.amostras || 0, an.porSetor[k]?.amostras || 0]));
  // Mês em andamento: comparar com o mês anterior inteiro daria quedas falsas.
  const parcial = mes === mesAtual();
  // Amostras da MinasLab: com ao menos um ensaio feito aqui (as que só foram
  // para laboratórios parceiros ficam de fora; isso é assunto do Comercial).
  const casa = (x) => (x?.casa ?? x?.total ?? 0);
  const v = parcial ? null : pctVar(casa(at), casa(an));

  return (
    <>
      <Cabecalho sobre="Painel do laboratório" titulo={mesLongo(mes)} sub="Só o que é executado na MinasLab: amostras e ensaios por setor, prazos das OS e não conformidades. Números do CRM (vindos do GerenciaLab).">
        <SeletorMes />
      </Cabecalho>
      {(st.erro || lp.erro) && <div className="aviso alerta">{st.erro || lp.erro}</div>}
      <div className="grade grade-kpi">
        <Kpi rotulo={`Amostras analisadas na MinasLab em ${mesNome(mes)}`} valor={st.dados ? casa(at) : "…"} sub={parcial ? `mês em andamento · ${casa(an)} em ${mesNome(ant)}` : v == null ? "" : `${v >= 0 ? "▲" : "▼"} ${Math.abs(v)}% frente a ${mesNome(ant)}`} tomSub={v == null ? undefined : v >= 0 ? "ok" : "ruim"} />
        <Kpi rotulo="Ensaios na MinasLab no mês" valor={st.dados ? ensaiosCasa(at) : "…"} sub={ensaiosCasa(an) ? `${ensaiosCasa(an)} em ${mesNome(ant)}` : ""} />
        <Kpi rotulo="OS em andamento atrasadas" valor={p ? p.os.atrasadas : "…"} sub={p ? `de ${p.os.andamento} em andamento · ${p.os.vencendo} vencem em 3 dias` : ""} tomSub={p?.os.atrasadas ? "ruim" : "ok"} />
        <Kpi rotulo={`Não conformidades em ${mesNome(mes)}`} valor={ncsMes.length} sub={`${ncsMes.filter((n) => n.retrabalho || /retrabalho/i.test(n.tipo)).length} com retrabalho`} />
      </div>

      <Card>
          <h2>Amostras por setor</h2>
          <div className="suave peq" style={{ marginBottom: 12 }}>{mesNome(mes)} (barra cheia) × {mesNome(ant)} (barra clara). Uma amostra conta em cada setor onde teve ensaio.{parcial ? " Mês em andamento: sem comparação até o fechamento." : ""}</div>
          {!st.dados ? <div className="vazio">Lendo as amostras do CRM…</div> : SETORES.map(([k, rot]) => {
            const a = at.porSetor[k] || { amostras: 0, ensaios: 0 };
            const b = an.porSetor[k] || { amostras: 0 };
            const vv = parcial ? null : pctVar(a.amostras, b.amostras);
            return (
              <div key={k} className="lab-setor">
                <div><b>{rot}</b><span className="suave peq">{a.ensaios} ensaios</span></div>
                <div className="lab-barras">
                  <div className="atual" style={{ width: `${(a.amostras / max) * 100}%` }}><em>{a.amostras}</em></div>
                  <div style={{ width: `${(b.amostras / max) * 100}%` }}><em>{b.amostras}</em></div>
                </div>
                <span className={`peq ${vv == null ? "suave" : ""}`} style={{ color: vv == null ? undefined : vv >= 0 ? "var(--ok)" : "var(--ruim)", fontWeight: 600 }}>{vv == null ? "—" : `${vv >= 0 ? "▲" : "▼"} ${Math.abs(vv)}%`}</span>
              </div>
            );
          })}
          {st.dados && Object.keys(at.porMatriz || {}).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {Object.entries(at.porMatriz).sort((x, y) => y[1] - x[1]).map(([k, n]) => <Chip key={k}>{k}: {n}</Chip>)}
            </div>
          )}
          {p && <div className="suave peq" style={{ marginTop: 12 }}>OS recebidas em {mesNome(mes)}: {osMes.recebidas} · concluídas: {osMes.concluidas} · canceladas: {osMes.canceladas}</div>}
      </Card>

      <Card semPad>
        <div className="card-cab"><h2>OS em andamento com o vencimento passado</h2><span className="suave peq">Hoje, independente do mês escolhido. Sem vencimento: {p?.os.semVencimento ?? "…"}</span></div>
        {!p ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Lendo as OS do CRM…</div> : p.os.lista.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma OS atrasada.</div> : (
          <div className="tabela-caixa">
            <table>
              <thead><tr><th>OS</th><th>Cliente</th><th>Recebida</th><th>Vencimento</th><th>Atraso</th></tr></thead>
              <tbody>{pagOS.itens.map((o, i) => <tr key={i}><td className="tnum">{o.numero}</td><td>{o.cliente}</td><td className="tnum">{o.recepcao ? dataCurta(o.recepcao) : "—"}</td><td className="tnum">{dataCurta(o.vencimento)}</td><td><Chip tom={o.dias > 7 ? "ruim" : "alerta"}>{o.dias} dia(s)</Chip></td></tr>)}</tbody>
            </table>
          </div>
        )}
        <Paginacao pag={pagOS} rotulo="OS" />
      </Card>
      <div className="aviso marca peq">A taxa de "laudo no prazo" das análises internas depende da data de emissão do laudo, que o GerenciaLab ainda não envia ao CRM. Quando enviar, ela entra aqui.</div>
    </>
  );
}
