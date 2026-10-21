// Satisfação: NPS (0 a 10, “recomendaria a MinasLab?”). Junta as respostas
// registradas no CRM com as que a gestora registra aqui.
import { useState } from "react";
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Kpi, Cabecalho, Paginacao, usePaginacao } from "../components/ui.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { npsCRM } from "../services/crm.js";
import { hojeBR, dataCurta } from "../lib/format.js";

export function calcularNps(respostas) {
  const n = respostas.length;
  if (!n) return null;
  const prom = respostas.filter((r) => Number(r.nota) >= 9).length;
  const det = respostas.filter((r) => Number(r.nota) <= 6).length;
  return { nps: Math.round(((prom - det) / n) * 100), prom, det, neutros: n - prom - det, n };
}

export default function Satisfacao() {
  const { dados, gravar, remover } = useBase();
  const crm = useCRM("nps", npsCRM);
  const [f, setF] = useState({ cliente: "", nota: "", comentario: "", canal: "Telefone", data: hojeBR() });
  const [erro, setErro] = useState("");
  const todas = [...(crm.dados?.respostas || []).map((r) => ({ ...r, origem: "CRM" })), ...dados.nps.map((r) => ({ ...r, origem: "Comercial" }))].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const desde = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const r90 = todas.filter((r) => r.data >= desde);
  const k = calcularNps(r90);
  const pag = usePaginacao(todas, 8);

  const registrar = async () => {
    const nota = Number(f.nota);
    if (!f.cliente.trim() || f.nota === "" || nota < 0 || nota > 10) { setErro("Informe o cliente e uma nota de 0 a 10."); return; }
    try { await gravar("nps", { ...f, cliente: f.cliente.trim(), nota }); setF({ ...f, cliente: "", nota: "", comentario: "" }); setErro(""); } catch (e) { setErro(e.message); }
  };

  return (
    <>
      <Cabecalho sobre="Satisfação" titulo="O cliente recomendaria a MinasLab?" sub="NPS dos últimos 90 dias: % de notas 9–10 menos % de notas 0–6." />
      <Orientacao tela="satisfacao" />
      {crm.erro && <div className="aviso alerta">Respostas do CRM indisponíveis: {crm.erro}</div>}
      <div className="grade grade-kpi">
        <Kpi rotulo="NPS (90 dias)" valor={k ? k.nps : "—"} sub={k ? `${k.n} respostas` : "nenhuma resposta ainda"} tomSub={k && k.nps < 30 ? "ruim" : undefined} />
        <Kpi rotulo="Promotores (9–10)" valor={k?.prom ?? 0} sub="peça indicação" />
        <Kpi rotulo="Detratores (0–6)" valor={k?.det ?? 0} sub="contato em até 48 horas" tomSub={k?.det ? "ruim" : undefined} />
      </div>
      <div className="grade grade-2" style={{ alignItems: "start" }}>
        <Card>
          <h2>Registrar resposta</h2>
          <div className="suave peq" style={{ marginTop: 4 }}>Pergunta: “De 0 a 10, quanto você recomendaria a MinasLab a um colega?” e “Por quê?”</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            <div className="campo"><label htmlFor="n-cli">Cliente</label><input id="n-cli" className="entrada" value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /></div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div className="campo"><label htmlFor="n-nota">Nota (0 a 10)</label><input id="n-nota" className="entrada num" type="number" min="0" max="10" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} /></div>
              <div className="campo"><label htmlFor="n-canal">Canal</label><select id="n-canal" className="entrada" value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}><option>Telefone</option><option>WhatsApp</option><option>E-mail</option><option>Visita</option></select></div>
              <div className="campo"><label htmlFor="n-data">Data</label><input id="n-data" type="date" className="entrada" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
            </div>
            <div className="campo"><label htmlFor="n-com">Por quê (palavras do cliente)</label><textarea id="n-com" className="entrada" rows={2} value={f.comentario} onChange={(e) => setF({ ...f, comentario: e.target.value })} /></div>
            {erro && <div className="aviso ruim">{erro}</div>}
            <div><button type="button" className="btn" onClick={registrar}>Registrar</button></div>
          </div>
        </Card>
        <Card semPad>
          <div className="card-cab"><h2>Respostas</h2><span className="suave peq">{todas.length} no total</span></div>
          {todas.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma pesquisa registrada ainda. Comece ligando para 3 clientes atendidos no mês.</div> : (
            <div className="tabela-caixa">
              <table>
                <tbody>
                  {pag.itens.map((r) => (
                    <tr key={`${r.origem}-${r.id}`}>
                      <td style={{ width: 60 }}><Chip tom={r.nota >= 9 ? "ok" : r.nota <= 6 ? "ruim" : "alerta"}>{r.nota}</Chip></td>
                      <td><b style={{ fontWeight: 600 }}>{r.cliente || "—"}</b><div className="suave peq">{r.comentario}</div></td>
                      <td className="peq suave">{dataCurta(r.data)}<div>{r.origem}{r.canal ? ` · ${r.canal}` : ""}</div></td>
                      <td>{r.origem === "Comercial" && <button type="button" className="btn perigo mini" onClick={() => window.confirm("Apagar esta resposta?") && remover("nps", r.id)}>Apagar</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacao pag={pag} rotulo="respostas" />
        </Card>
      </div>
    </>
  );
}
