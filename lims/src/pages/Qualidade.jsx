// Gestão da qualidade → Carta controle (ISO/IEC 17025 7.7.1): resultados das
// amostras de controle (Amostras Controle de Qualidade) num gráfico com média,
// limites de alerta (±2 DP) e de controle (±3 DP) e as regras de Westgard.
// Os demais itens do menu usam o motor de cadastros (lib/cadastros.js).

import { useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { agoraLocal } from "../lib/formato.js";
import { estatistica, violacoes, numero } from "../lib/laboratorio.js";
import { Caixa, opcoes, useAviso } from "../components/ui.jsx";
import { quandoBR } from "./Coletas.jsx";

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "—");

export function CartaControle() {
  const { dados, salvar, eu } = useDados();
  const avisar = useAviso();
  const [cqId, setCqId] = useState(() => dados.amostras_cq[0]?.id || "");
  const [novo, setNovo] = useState({ data: agoraLocal(), valor: "", obs: "" });
  const cq = dados.amostras_cq.find((c) => c.id === cqId);
  const pontos = useMemo(() => dados.cq_resultados.filter((r) => r.cqId === cqId).sort((a, b) => a.data.localeCompare(b.data)), [dados.cq_resultados, cqId]);
  const valores = pontos.map((p) => numero(p.valor));
  const est = estatistica(valores);
  const media = numero(cq?.valorReferencia) ?? est.media;
  const dp = numero(cq?.desvioReferencia) ?? est.dp;
  const viol = violacoes(valores, media, dp);
  const violIdx = new Map(viol.map((v) => [v.i, v.regra]));
  const param = dados.parametros.find((p) => p.id === cq?.parametro);
  const lancar = async () => {
    if (!cq) { avisar("Cadastre uma amostra em Amostras Controle de Qualidade.", "err"); return; }
    if (numero(novo.valor) === null) { avisar("Informe um resultado numérico.", "err"); return; }
    if (cq.maxAmostras && pontos.length >= Number(cq.maxAmostras)) { avisar("Limite de análises desta amostra CQ atingido.", "err"); return; }
    if (cq.expiracao && novo.data.slice(0, 10) > cq.expiracao) { avisar("Amostra CQ vencida nesta data.", "err"); return; }
    try { await salvar("cq_resultados", { cqId, data: novo.data, valor: novo.valor, analista: eu?.usuario || "", obs: novo.obs }, { numerar: true }); setNovo({ data: agoraLocal(), valor: "", obs: "" }); avisar("Resultado lançado.", "ok"); }
    catch (e) { avisar(e.message, "err"); }
  };
  // Gráfico
  const W = 760, H = 260, P = 46;
  const lim = dp ? [media - 3 * dp, media + 3 * dp] : [Math.min(...valores, media) - 1, Math.max(...valores, media) + 1];
  const yMin = Math.min(lim[0], ...valores.filter(Number.isFinite)), yMax = Math.max(lim[1], ...valores.filter(Number.isFinite));
  const y = (v) => H - 24 - ((v - yMin) / (yMax - yMin || 1)) * (H - 44);
  const x = (i) => P + (pontos.length > 1 ? (i * (W - 2 * P)) / (pontos.length - 1) : (W - 2 * P) / 2);
  const linhas = dp ? [[media, "Média", "#0f766e", ""], [media + 2 * dp, "+2DP", "#d97706", "4 3"], [media - 2 * dp, "−2DP", "#d97706", "4 3"], [media + 3 * dp, "+3DP", "#dc2626", "6 3"], [media - 3 * dp, "−3DP", "#dc2626", "6 3"]] : [[media, "Média", "#0f766e", ""]];
  return (
    <>
      <Caixa titulo="Carta controle">
        <div className="frm">
          <div className="fg s6"><label htmlFor="ccq">Amostra de controle</label><select id="ccq" value={cqId} onChange={(e) => setCqId(e.target.value)}>{opcoes([["", "Selecione"], ...dados.amostras_cq.map((c) => [c.id, `${c.identificacao}${c.uniqueId ? ` · ${c.uniqueId}` : ""}`])])}</select></div>
          <div className="fg s6"><label>Parâmetro</label><div style={{ paddingTop: 6 }}>{param ? `${param.parametro}${param.lq ? ` · LQ ${param.lq}` : ""}` : "—"}</div></div>
        </div>
        {!dados.amostras_cq.length && <p className="aviso alerta">Cadastre primeiro a amostra em Gestão da qualidade → Amostras Controle de Qualidade.</p>}
        {cq && (
          <>
            <div className="kpis" style={{ marginTop: 12 }}>
              <div className="kpi"><span>Pontos</span><b>{pontos.length}{cq.maxAmostras ? ` / ${cq.maxAmostras}` : ""}</b></div>
              <div className="kpi"><span>Média {numero(cq.valorReferencia) !== null ? "(referência)" : "(calculada)"}</span><b>{fmt(media)}</b></div>
              <div className="kpi"><span>Desvio padrão {numero(cq.desvioReferencia) !== null ? "(referência)" : "(calculado)"}</span><b>{fmt(dp)}</b></div>
              <div className={`kpi ${viol.length ? "ruim" : "bom"}`}><span>Violações Westgard</span><b>{viol.length}</b></div>
            </div>
            <div className="tw">
              <svg className="ch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Carta controle" style={{ minWidth: 520 }}>
                {linhas.map(([v, t, c, d]) => <g key={t}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke={c} strokeDasharray={d} /><text x={P - 4} y={y(v) + 3} textAnchor="end" fill={c}>{t}</text><text x={W - P + 4} y={y(v) + 3} fill={c}>{fmt(v)}</text></g>)}
                {pontos.length > 1 && <polyline points={pontos.map((p, i) => `${x(i)},${y(numero(p.valor))}`).join(" ")} fill="none" stroke="#24444f" strokeWidth="1.5" />}
                {pontos.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(numero(p.valor))} r={violIdx.has(i) ? 5 : 3.5} fill={violIdx.has(i) ? "#dc2626" : "#24444f"}><title>{`${quandoBR(p.data)} · ${p.valor}${violIdx.has(i) ? ` · ${violIdx.get(i)}` : ""}`}</title></circle>)}
              </svg>
            </div>
            <p className="suave">Regras: 1-3s (ponto além de ±3 DP) rejeita a corrida; 2-2s (dois seguidos além de ±2 DP do mesmo lado) indica erro sistemático. Ponto em vermelho: abra uma Ocorrência.</p>
          </>
        )}
      </Caixa>
      {cq && (
        <Caixa titulo="Lançar resultado de controle">
          <div className="frm">
            <div className="fg s3"><label htmlFor="cqData">Data e hora</label><input id="cqData" type="datetime-local" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} /></div>
            <div className="fg s3"><label htmlFor="cqValor">Resultado</label><input id="cqValor" inputMode="decimal" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} /></div>
            <div className="fg s4"><label htmlFor="cqObs">Observação</label><input id="cqObs" value={novo.obs} onChange={(e) => setNovo({ ...novo, obs: e.target.value })} /></div>
            <div className="fg s2" style={{ alignSelf: "end" }}><button type="button" className="btn btn-primary" onClick={lancar}>Lançar</button></div>
          </div>
          <div className="tw" style={{ marginTop: 12 }}><table><thead><tr><th>#</th><th>Data</th><th>Resultado</th><th>Analista</th><th>Regra</th><th>Observação</th></tr></thead>
            <tbody>{pontos.length ? pontos.map((p, i) => <tr key={p.id}><td>{i + 1}</td><td>{quandoBR(p.data)}</td><td>{p.valor}</td><td>{p.analista}</td><td className={violIdx.has(i) ? "nc" : ""}>{violIdx.get(i) || ""}</td><td>{p.obs}</td></tr>) : <tr><td colSpan={6} className="vazio">Nenhum resultado.</td></tr>}</tbody></table></div>
        </Caixa>
      )}
    </>
  );
}
