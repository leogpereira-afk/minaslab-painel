// Desenvolvimento da pessoa: estágio (e o estilo de liderança que pede) e
// PDI do trimestre — competência, ação de aprendizado, evidência e prazo.
import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip } from "./ui.jsx";
import { ESTAGIOS } from "../lib/calculos.js";
import { trilhaPorId } from "../lib/trilhas.js";
import { mesAtual, dataCurta } from "../lib/format.js";

const trimestre = () => { const [a, m] = mesAtual().split("-").map(Number); return `${a}-T${Math.ceil(m / 3)}`; };
const linhas = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);

export function Desenvolvimento({ membro }) {
  const { dados, gravar, funcaoDe } = useBase();
  const funcao = funcaoDe(membro);
  const est = ESTAGIOS.find((e) => e.id === membro.estagio);
  const itens = dados.pdi.filter((p) => p.pessoaId === membro.id).sort((a, b) => String(b.trimestre).localeCompare(String(a.trimestre)));
  const [f, setF] = useState({ competencia: "", acao: "", evidencia: "", prazo: "" });
  const [erro, setErro] = useState("");
  const sugestoes = [...linhas(funcao?.competencias), ...(funcao?.trilhas || []).map((t) => trilhaPorId(t)?.nome).filter(Boolean)].filter((s) => !itens.some((i) => i.competencia === s));

  const add = async () => {
    if (!f.competencia.trim()) { setErro("Informe a competência."); return; }
    try { await gravar("pdi", { ...f, competencia: f.competencia.trim(), pessoaId: membro.id, trimestre: trimestre(), status: "andamento" }); setF({ competencia: "", acao: "", evidencia: "", prazo: "" }); setErro(""); } catch (e) { setErro(e.message); }
  };

  return (
    <Card>
      <h3>Desenvolvimento</h3>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, alignItems: "flex-start" }}>
        <div className="campo" style={{ minWidth: 200 }}>
          <label htmlFor="d-est">Estágio na função</label>
          <select id="d-est" className="entrada" value={membro.estagio || ""} onChange={(e) => gravar("equipe", { ...membro, estagio: e.target.value })}>
            <option value="">— avaliar —</option>
            {ESTAGIOS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        {est && <div className="aviso marca peq" style={{ flex: "1 1 260px" }}><b>Estilo sugerido: {est.estilo}.</b> {est.texto}</div>}
      </div>

      <div style={{ fontWeight: 600, marginTop: 18 }}>PDI · {trimestre().replace("-T", " · T")}</div>
      {itens.length === 0 && <div className="vazio peq">Nenhum item de desenvolvimento ainda.</div>}
      {itens.map((p) => (
        <div key={p.id} className="ponto" style={{ alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{p.competencia} <span className="suave peq">({p.trimestre.replace("-T", " T")})</span></div>
            <div className="suave peq">{p.acao}{p.evidencia ? ` · evidência: ${p.evidencia}` : ""}{p.prazo ? ` · até ${dataCurta(p.prazo)}` : ""}</div>
          </div>
          <button type="button" className={`chip ${p.status === "concluido" ? "ok" : "alerta"}`} style={{ border: 0, cursor: "pointer", minHeight: 30 }} onClick={() => gravar("pdi", { ...p, status: p.status === "concluido" ? "andamento" : "concluido" })}>{p.status === "concluido" ? "Concluído" : "Em andamento"}</button>
        </div>
      ))}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {sugestoes.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{sugestoes.slice(0, 5).map((s) => <button key={s} type="button" className="btn claro mini" onClick={() => setF({ ...f, competencia: s })}>+ {s}</button>)}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="entrada" style={{ flex: "1 1 180px" }} aria-label="Competência" placeholder="Competência" value={f.competencia} onChange={(e) => setF({ ...f, competencia: e.target.value })} />
          <input className="entrada" style={{ flex: "2 1 220px" }} aria-label="Ação de aprendizado" placeholder="Ação (curso, trilha, acompanhar alguém…)" value={f.acao} onChange={(e) => setF({ ...f, acao: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="entrada" style={{ flex: "2 1 220px" }} aria-label="Evidência" placeholder="Como saber que melhorou (o número)" value={f.evidencia} onChange={(e) => setF({ ...f, evidencia: e.target.value })} />
          <input type="date" className="entrada" style={{ flex: "0 1 170px" }} aria-label="Prazo" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} />
          <button type="button" className="btn" onClick={add}>Incluir</button>
        </div>
        {erro && <div className="aviso ruim">{erro}</div>}
        {funcao && <div className="suave peq">Sugestões tiradas da função {funcao.nome}. <Chip>{funcao.nome}</Chip></div>}
      </div>
    </Card>
  );
}
