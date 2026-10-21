import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Modal, Abas, Paginacao, usePaginacao } from "../components/ui.jsx";
import { dataCurta, hojeBR, mesAtual, numero } from "../lib/format.js";
import { Orientacao } from "../components/Orientacao.jsx";

const STATUS = [
  { id: "afazer", rotulo: "A fazer", tom: "neutro" },
  { id: "andamento", rotulo: "Em andamento", tom: "alerta" },
  { id: "feito", rotulo: "Feito", tom: "ok" },
];

// Sugestões ligadas aos problemas que o diagnóstico encontrou (especificação, seção Diagnóstico).
const SUGESTOES = [
  { titulo: "Responsável obrigatório em toda proposta", porque: "Proposta sem responsável no CRM distorce a meta de cada pessoa. Veja o tamanho do problema em Qualidade do dado.", medida: "Menos de 5% das propostas do mês sem responsável (tela Qualidade do dado).", dono: "Gestora" },
  { titulo: "Follow-up de toda proposta enviada em até 7 dias", porque: "Proposta sem retorno esfria e derruba a taxa de aprovação.", medida: "Taxa de aprovação do mês e propostas sem resposta há mais de 15 dias.", dono: "Cada responsável" },
  { titulo: "Registrar ligações no CRM", porque: "Meta de ligações sem registro no CRM não tem como ser medida.", medida: "Ligações registradas por pessoa por dia útil.", dono: "Equipe comercial" },
  { titulo: "Checklist de parâmetros antes de enviar proposta", porque: "Proposta enviada faltando parâmetros gera retrabalho e perda de confiança do cliente.", medida: "Ocorrências do tipo “Erro em proposta”.", dono: "Quem elabora" },
  { titulo: "Conversa individual mensal com cada pessoa", porque: "Feedback com número na mão todo mês, não só na avaliação.", medida: "Um feedback registrado por pessoa no mês (tela Pessoas e feedback).", dono: "Gestora" },
];

export default function Estrategias() {
  const { dados, gravar, remover } = useBase();
  const [editando, setEditando] = useState(null);
  const [aba, setAba] = useState("plano");
  const [filtro, setFiltro] = useState("abertas");
  const todas = [...dados.estrategias].sort((a, b) => STATUS.findIndex((s) => s.id === a.status) - STATUS.findIndex((s) => s.id === b.status) || String(a.prazo || "9").localeCompare(String(b.prazo || "9")));
  const lista = todas.filter((e) => filtro === "todas" || (filtro === "abertas" ? e.status !== "feito" : e.status === "feito"));
  const pag = usePaginacao(lista, 6, filtro);
  const titulos = new Set(todas.map((e) => e.titulo));
  const faltam = SUGESTOES.filter((s) => !titulos.has(s.titulo));

  const ciclar = (e) => {
    const i = STATUS.findIndex((s) => s.id === e.status);
    gravar("estrategias", { ...e, status: STATUS[(i + 1) % STATUS.length].id });
  };

  return (
    <>
      <Cabecalho sobre="Estratégias" titulo="Plano de ação do setor" sub="Cada ação com o porquê (o número), como medir, dono e prazo.">
        <button type="button" className="btn" onClick={() => setEditando({ status: "afazer" })}>Nova ação</button>
      </Cabecalho>
      <Orientacao tela="estrategias" />
      <Abas valor={aba} aoMudar={setAba} abas={[["plano", "Plano de ação", todas.filter((e) => e.status !== "feito").length], ["objetivos", "Objetivos do trimestre"], faltam.length > 0 && ["sugestoes", "Sugestões", faltam.length]]} />
      {aba === "objetivos" && <Objetivos />}

      {aba === "plano" && <>
      <div className="pilulas">
        {[["abertas", "Em aberto"], ["feitas", "Feitas"], ["todas", "Todas"]].map(([id, nome]) => <button key={id} type="button" className={`pilula${filtro === id ? " ativa" : ""}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{nome}</button>)}
      </div>
      {lista.length === 0 && <Card><p className="suave" style={{ margin: 0 }}>{todas.length ? "Nada nesta lista." : "Nenhuma ação cadastrada. Comece pelas sugestões, tiradas dos números do CRM."}</p></Card>}

      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {pag.itens.map((e) => {
          const s = STATUS.find((x) => x.id === e.status) || STATUS[0];
          const atrasada = e.prazo && e.status !== "feito" && e.prazo < hojeBR();
          return (
            <Card key={e.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <h3 style={{ lineHeight: 1.35 }}>{e.titulo}</h3>
                <button type="button" className={`chip ${s.tom}`} style={{ border: 0, cursor: "pointer", minHeight: 30 }} onClick={() => ciclar(e)} title="Clique para mudar a situação">{s.rotulo}</button>
              </div>
              {e.porque && <div className="suave peq">{e.porque}</div>}
              {e.medida && <div className="peq" style={{ background: "#f6f9f9", borderRadius: 10, padding: "10px 12px" }}><b>Como medir:</b> {e.medida}</div>}
              <div className="peq" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span className="suave">Dono: {e.dono || "—"}</span>
                {e.prazo && <Chip tom={atrasada ? "ruim" : "neutro"}>{atrasada ? "Atrasada · " : "Prazo "}{dataCurta(e.prazo)}</Chip>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <button type="button" className="btn claro mini" onClick={() => setEditando(e)}>Editar</button>
                <button type="button" className="btn perigo mini" onClick={() => window.confirm("Apagar esta ação?") && remover("estrategias", e.id)}>Apagar</button>
              </div>
            </Card>
          );
        })}
      </div>
      <Paginacao pag={pag} rotulo="ações" />
      </>}

      {aba === "sugestoes" && faltam.length > 0 && (
        <Card>
          <h2>Sugestões a partir dos dados</h2>
          {faltam.map((s) => (
            <div key={s.titulo} className="ponto" style={{ alignItems: "center" }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{s.titulo}</div><div className="suave peq">{s.porque}</div></div>
              <button type="button" className="btn claro mini" onClick={() => gravar("estrategias", { ...s, status: "afazer" })}>Adotar</button>
            </div>
          ))}
        </Card>
      )}

      {editando && <Editor inicial={editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}

function Editor({ inicial, aoFechar }) {
  const { gravar } = useBase();
  const [e, setE] = useState({ titulo: "", porque: "", medida: "", dono: "", prazo: "", status: "afazer", ...inicial });
  const [erro, setErro] = useState("");
  const campo = (k) => ({ value: e[k] || "", onChange: (ev) => setE((x) => ({ ...x, [k]: ev.target.value })) });
  const salvar = async () => {
    if (!e.titulo.trim()) { setErro("Dê um título para a ação."); return; }
    try { await gravar("estrategias", { ...e, titulo: e.titulo.trim() }); aoFechar(); } catch (ex) { setErro(ex.message); }
  };
  return (
    <Modal titulo={inicial.id ? "Editar ação" : "Nova ação"} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="campo"><label htmlFor="e-tit">Ação</label><input id="e-tit" className="entrada" {...campo("titulo")} /></div>
        <div className="campo"><label htmlFor="e-pq">Por quê (o número que motiva)</label><textarea id="e-pq" className="entrada" rows={2} {...campo("porque")} /></div>
        <div className="campo"><label htmlFor="e-med">Como medir</label><input id="e-med" className="entrada" {...campo("medida")} /></div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="campo" style={{ flex: "1 1 200px" }}><label htmlFor="e-dono">Dono</label><input id="e-dono" className="entrada" {...campo("dono")} /></div>
          <div className="campo" style={{ flex: "0 1 170px" }}><label htmlFor="e-prazo">Prazo</label><input id="e-prazo" type="date" className="entrada" {...campo("prazo")} /></div>
        </div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" onClick={salvar}>Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

const trimestreAtual = () => { const [a, m] = mesAtual().split("-").map(Number); return `${a}-T${Math.ceil(m / 3)}`; };

// Objetivos do trimestre (OKR): até 3 objetivos, cada um com resultados-chave numéricos.
function Objetivos() {
  const { dados, gravar, remover } = useBase();
  const tri = trimestreAtual();
  const [edit, setEdit] = useState(null);
  const lista = dados.objetivos.filter((o) => o.trimestre === tri);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <h2>Objetivos do trimestre · {tri.replace("-T", " · T")}</h2>
        {lista.length < 3 && <button type="button" className="btn claro mini" onClick={() => setEdit({ trimestre: tri, titulo: "", krs: [{ texto: "", alvo: "", atual: "" }] })}>Novo objetivo</button>}
      </div>
      {lista.length === 0 && <div className="vazio peq">Defina até 3 objetivos para o trimestre, cada um com 3 a 5 resultados-chave com número.</div>}
      {lista.map((o) => (
        <div key={o.id} style={{ borderTop: "1px solid var(--linha-fraca)", paddingTop: 12, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontWeight: 600 }}>{o.titulo}</b>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn claro mini" onClick={() => setEdit(o)}>Editar</button>
              <button type="button" className="btn perigo mini" onClick={() => window.confirm("Apagar este objetivo?") && remover("objetivos", o.id)}>Apagar</button>
            </span>
          </div>
          {(o.krs || []).map((k, i) => {
            const alvo = numero(k.alvo), atual = numero(k.atual);
            const p = alvo ? Math.max(0, Math.min(1, (atual || 0) / alvo)) : 0;
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px 70px", gap: 10, alignItems: "center", marginTop: 8 }}>
                <span className="peq">{k.texto}</span>
                <div className="barra"><div style={{ width: `${p * 100}%`, background: p >= 0.7 ? "var(--ok)" : p >= 0.4 ? "#d97706" : "var(--ruim)" }} /></div>
                <span className="peq tnum">{atual ?? "—"} / {alvo ?? "—"}</span>
              </div>
            );
          })}
        </div>
      ))}
      {edit && <EditorObjetivo inicial={edit} aoFechar={() => setEdit(null)} gravar={gravar} />}
    </Card>
  );
}

function EditorObjetivo({ inicial, aoFechar, gravar }) {
  const [o, setO] = useState({ ...inicial, krs: (inicial.krs || []).map((k) => ({ ...k })) });
  const setKr = (i, k, v) => setO((x) => ({ ...x, krs: x.krs.map((kr, j) => (j === i ? { ...kr, [k]: v } : kr)) }));
  const salvar = async () => {
    if (!o.titulo.trim()) return;
    await gravar("objetivos", { ...o, titulo: o.titulo.trim(), krs: o.krs.filter((k) => k.texto.trim()) });
    aoFechar();
  };
  return (
    <Modal titulo={inicial.id ? "Editar objetivo" : "Novo objetivo"} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="campo"><label htmlFor="o-tit">Objetivo (qualitativo, inspirador)</label><input id="o-tit" className="entrada" value={o.titulo} onChange={(e) => setO({ ...o, titulo: e.target.value })} placeholder="Ex.: Ser o laboratório que responde mais rápido na região" /></div>
        <div className="rotulo">Resultados-chave (com número)</div>
        {o.krs.map((k, i) => (
          <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="entrada" style={{ flex: "3 1 220px" }} aria-label={`Resultado-chave ${i + 1}`} placeholder="Ex.: Propostas respondidas em até 24 h" value={k.texto} onChange={(e) => setKr(i, "texto", e.target.value)} />
            <input className="entrada num" aria-label="Atual" placeholder="atual" value={k.atual ?? ""} onChange={(e) => setKr(i, "atual", e.target.value)} />
            <input className="entrada num" aria-label="Alvo" placeholder="alvo" value={k.alvo ?? ""} onChange={(e) => setKr(i, "alvo", e.target.value)} />
          </div>
        ))}
        {o.krs.length < 5 && <div><button type="button" className="btn claro mini" onClick={() => setO({ ...o, krs: [...o.krs, { texto: "", alvo: "", atual: "" }] })}>+ resultado-chave</button></div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" onClick={salvar}>Salvar</button>
        </div>
      </div>
    </Modal>
  );
}
