// Funções (cargos): a descrição do cargo vira estratégia, metas padrão,
// critérios técnicos da avaliação, rotina semanal, competências do PDI e
// trilhas de treinamento. Cada pessoa da equipe é ligada a uma função.

import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Modal } from "../components/ui.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { TRILHAS, trilhaPorId } from "../lib/trilhas.js";
import { numero, dataCurta, hojeBR } from "../lib/format.js";
import { metasDaFuncao } from "../lib/calculos.js";
import { CARGOS_MINASLAB } from "../lib/cargosMinasLab.js";

const linhas = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
const slug = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// Modelos: as descrições de cargo da MinasLab, revisadas (lib/cargosMinasLab.js).
const MODELOS = CARGOS_MINASLAB.map((c) => ({ ...c, criteriosTexto: c.criterios.map((x) => (x.desc ? `${x.nome} — ${x.desc}` : x.nome)).join("\n") }));

export function paraRegistro(f) {
  const criterios = linhas(f.criteriosTexto).map((l) => {
    const [nome, ...desc] = l.split(/\s+[—–-]\s+/);
    return { id: slug(nome) || "crit", nome: nome.trim(), desc: desc.join(" — ").trim() };
  });
  return {
    id: f.id, nome: f.nome.trim(), descricao: f.descricao || "", missao: f.missao || "",
    identificacao: { setor: f.identificacao?.setor || "", vinculo: f.identificacao?.vinculo || "", colabora: f.identificacao?.colabora || "" },
    autonomia: f.autonomia || "", requisitos: f.requisitos || "", kpis: f.kpis || "", condicoes: f.condicoes || "",
    revisadoEm: hojeBR(),
    responsabilidades: f.responsabilidades || "", outrasMetas: f.outrasMetas || "",
    metasPadrao: { propostas: numero(f.metasPadrao?.propostas), aprovacao: numero(f.metasPadrao?.aprovacao), ligacoes: numero(f.metasPadrao?.ligacoes) },
    criterios, competencias: f.competencias || "", rotina: f.rotina || "", estrategia: f.estrategia || "", trilhas: f.trilhas || [],
  };
}

const paraForm = (r) => ({ ...r, identificacao: { ...(r.identificacao || {}) }, metasPadrao: { ...(r.metasPadrao || {}) }, trilhas: r.trilhas || [], criteriosTexto: (r.criterios || []).map((c) => (c.desc ? `${c.nome} — ${c.desc}` : c.nome)).join("\n") });

export default function Funcoes() {
  const { dados, equipeAtual: equipe, gravar, remover } = useBase();
  const [editando, setEditando] = useState(null);
  const [vendo, setVendo] = useState(null);
  const [msg, setMsg] = useState("");
  const funcoes = [...dados.funcoes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const faltam = MODELOS.filter((m) => !dados.funcoes.some((f) => f.nome === m.nome));
  const carregarCargos = async () => {
    try {
      for (const m of faltam) await gravar("funcoes", { ...paraRegistro(m), ...(m.versao ? { modeloVersao: m.versao } : {}) });
      setMsg(`${faltam.length} descrição(ões) de cargo carregada(s). Revise metas e indicadores de cada uma.`);
    } catch (e) { setMsg(e.message); }
  };

  const aplicarMetas = async (f) => {
    const pessoas = equipe.filter((m) => m.funcaoId === f.id);
    if (!pessoas.length) { setMsg("Ninguém ligado a esta função ainda (Equipe e metas)."); return; }
    if (!window.confirm(`Aplicar as metas padrão de “${f.nome}” a ${pessoas.length} pessoa(s)? As metas atuais delas serão trocadas.`)) return;
    for (const m of pessoas) await gravar("equipe", { ...m, metas: { ...f.metasPadrao } });
    setMsg(`Metas aplicadas a ${pessoas.map((m) => m.nome).join(", ")}.`);
  };

  // Descrição nova enviada para um cargo que já está no sistema: troca o texto
  // pelo do documento e mantém as metas e os treinamentos já escolhidos.
  const novaVersao = (f) => { const m = MODELOS.find((x) => x.nome === f.nome); return m?.versao && f.modeloVersao !== m.versao ? m : null; };
  const atualizarDescricao = async (f, m) => {
    if (!window.confirm(`Trocar a descrição de “${f.nome}” pela versão de ${m.versao.split("-").reverse().join("/")}? Missão, responsabilidades, competências, indicadores, critérios, rotina e requisitos passam a ser os do documento novo. As metas e os treinamentos atuais ficam como estão.`)) return;
    try {
      const reg = paraRegistro({ ...paraForm(f), ...m, id: f.id, metasPadrao: f.metasPadrao, trilhas: [...new Set([...(f.trilhas || []), ...(m.trilhas || [])])] });
      await gravar("funcoes", { ...reg, modeloVersao: m.versao, criadoEm: f.criadoEm });
      setMsg(`Descrição de “${f.nome}” atualizada. Confira em Descrição de cargo.`);
    } catch (e) { setMsg(e.message); }
  };

  return (
    <>
      <Cabecalho sobre="Funções e cargos" titulo="Estratégia por função" sub="Cole a descrição do cargo e transforme em metas, critérios de avaliação, rotina, competências e treinamentos.">
        <button type="button" className="btn" onClick={() => setEditando({ nome: "", metasPadrao: {}, trilhas: [] })}>Nova função</button>
      </Cabecalho>
      <Orientacao tela="funcoes" />
      {msg && <div className="aviso marca">{msg}</div>}

      {faltam.length > 0 && (
        <Card>
          <h2>Descrições de cargo da MinasLab</h2>
          <p className="suave peq">As 4 descrições enviadas, revisadas: indicadores com forma de medir e meta, requisitos de competência (ISO/IEC 17025, 6.2.2), autonomia e dono de cada tarefa compartilhada.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="btn" onClick={carregarCargos}>Carregar {faltam.length === MODELOS.length ? "as 4 descrições" : `as ${faltam.length} que faltam`}</button>
            <span className="suave peq">{faltam.map((m) => m.nome).join(" · ")}</span>
          </div>
        </Card>
      )}

      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        {funcoes.map((f) => {
          const pessoas = equipe.filter((m) => m.funcaoId === f.id);
          const mp = f.metasPadrao || {};
          return (
            <Card key={f.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <h2>{f.nome}</h2>
                <Chip tom={pessoas.length ? "marca" : "neutro"}>{pessoas.length} pessoa(s)</Chip>
              </div>
              {novaVersao(f) && (
                <div className="aviso alerta peq" style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <span>Há uma versão nova desta descrição de cargo ({novaVersao(f).versao.split("-").reverse().join("/")}).</span>
                  <button type="button" className="btn mini" onClick={() => atualizarDescricao(f, novaVersao(f))}>Atualizar descrição</button>
                </div>
              )}
              {f.missao && <div className="peq"><b>Missão:</b> {f.missao}</div>}
              {f.estrategia && <div className="aviso marca peq">{f.estrategia}</div>}
              <MetasFuncao f={f} />
              {(mp.propostas || mp.aprovacao || mp.ligacoes) ? <div className="peq suave"><b>Medidas pelo CRM:</b> {[mp.propostas && `${mp.propostas} propostas/mês`, mp.aprovacao && `${mp.aprovacao}% de aprovação`, mp.ligacoes && `${mp.ligacoes} ligações/dia`].filter(Boolean).join(" · ")}</div> : null}
              {linhas(f.outrasMetas).length > 0 && <div className="peq"><b>Outras metas:</b> {linhas(f.outrasMetas).join(" · ")}</div>}
              <div className="peq"><b>Critérios técnicos:</b> {(f.criterios || []).map((c) => c.nome).join(", ") || "padrão"}</div>
              {linhas(f.rotina).length > 0 && (
                <div className="peq"><b>Rotina:</b><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{linhas(f.rotina).map((r) => <li key={r}>{r}</li>)}</ul></div>
              )}
              {(f.trilhas || []).length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{f.trilhas.map((t) => <Chip key={t}>{trilhaPorId(t)?.nome || t}</Chip>)}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
                <button type="button" className="btn mini" onClick={() => setVendo(f)}>Descrição de cargo</button>
                <button type="button" className="btn claro mini" onClick={() => setEditando(paraForm(f))}>Editar</button>
                <button type="button" className="btn claro mini" onClick={() => aplicarMetas(f)}>Aplicar metas às pessoas</button>
                <button type="button" className="btn perigo mini" onClick={() => window.confirm(pessoas.length ? `${pessoas.length} pessoa(s) estão nesta função e voltarão aos critérios padrão. Apagar?` : "Apagar esta função?") && remover("funcoes", f.id)}>Apagar</button>
              </div>
            </Card>
          );
        })}
      </div>
      {editando && <Editor inicial={editando} aoFechar={() => setEditando(null)} />}
      {vendo && <VerDescricao f={vendo} aoFechar={() => setVendo(null)} />}
    </>
  );
}

function Editor({ inicial, aoFechar }) {
  const { gravar } = useBase();
  const [f, setF] = useState({ criteriosTexto: "", ...inicial });
  const [erro, setErro] = useState("");
  const [crm, setCrm] = useState(() => !!(numero(inicial.metasPadrao?.propostas) || numero(inicial.metasPadrao?.aprovacao) || numero(inicial.metasPadrao?.ligacoes)));
  const campo = (k) => ({ value: f[k] || "", onChange: (e) => setF((x) => ({ ...x, [k]: e.target.value })) });
  const meta = (k) => ({ value: f.metasPadrao?.[k] ?? "", onChange: (e) => setF((x) => ({ ...x, metasPadrao: { ...x.metasPadrao, [k]: e.target.value } })) });
  const alternar = (id) => setF((x) => ({ ...x, trilhas: x.trilhas?.includes(id) ? x.trilhas.filter((t) => t !== id) : [...(x.trilhas || []), id] }));
  const salvar = async () => {
    if (!f.nome?.trim()) { setErro("Dê um nome à função."); return; }
    try { await gravar("funcoes", paraRegistro(f)); aoFechar(); } catch (e) { setErro(e.message); }
  };
  const area = (id, rot, k, rows = 3, dica) => (
    <div className="campo"><label htmlFor={id}>{rot}</label>{dica && <span className="suave peq">{dica}</span>}<textarea id={id} className="entrada" rows={rows} {...campo(k)} /></div>
  );
  return (
    <Modal titulo={inicial.id ? `Editar ${inicial.nome}` : "Nova função"} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="campo"><label htmlFor="f-nome">Nome da função</label><input id="f-nome" className="entrada" {...campo("nome")} /></div>
        <div className="rotulo">Identificação</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="entrada" style={{ flex: "1 1 180px" }} aria-label="Setor" placeholder="Setor" value={f.identificacao?.setor || ""} onChange={(e) => setF((x) => ({ ...x, identificacao: { ...x.identificacao, setor: e.target.value } }))} />
          <input className="entrada" style={{ flex: "1 1 180px" }} aria-label="Vínculo hierárquico" placeholder="Vínculo hierárquico" value={f.identificacao?.vinculo || ""} onChange={(e) => setF((x) => ({ ...x, identificacao: { ...x.identificacao, vinculo: e.target.value } }))} />
        </div>
        <input className="entrada" aria-label="Colabora com" placeholder="Colabora com" value={f.identificacao?.colabora || ""} onChange={(e) => setF((x) => ({ ...x, identificacao: { ...x.identificacao, colabora: e.target.value } }))} />
        {area("f-missao", "Missão do cargo", "missao", 3)}
        {area("f-resp", "Responsabilidades principais", "responsabilidades", 8, "Uma por linha. Linha começando com “# ” vira título de grupo.")}
        {area("f-aut", "Autonomia (o que decide sozinho e o que precisa de aprovação)", "autonomia", 3, "Uma por linha.")}
        {area("f-req", "Requisitos de competência (formação, experiência, treinamentos obrigatórios)", "requisitos", 4, "Uma por linha. A ISO/IEC 17025 pede esses requisitos documentados por função.")}
        {area("f-cond", "Condições de trabalho", "condicoes", 2, "Uma por linha.")}
        <EditorMetas kpis={f.kpis} aoMudar={(kpis) => setF((x) => ({ ...x, kpis }))} />
        <div className="campo">
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
            <input type="checkbox" checked={crm} onChange={(e) => { setCrm(e.target.checked); if (!e.target.checked) setF((x) => ({ ...x, metasPadrao: {} })); }} />
            Esta função envia propostas no CRM (metas medidas automaticamente)
          </label>
        </div>
        {crm && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="campo"><label htmlFor="f-m1">Propostas/mês</label><input id="f-m1" className="entrada num" type="number" min="0" {...meta("propostas")} /></div>
            <div className="campo"><label htmlFor="f-m2">Aprovação mín. (%)</label><input id="f-m2" className="entrada num" type="number" min="0" max="100" {...meta("aprovacao")} /></div>
            <div className="campo"><label htmlFor="f-m3">Ligações/dia</label><input id="f-m3" className="entrada num" type="number" min="0" {...meta("ligacoes")} /><span className="suave peq">Ainda não registradas no CRM</span></div>
          </div>
        )}
        {area("f-outras", "Outras metas de atividade", "outrasMetas", 3, "Uma por linha (ex.: checklist semanal cumprido).")}
        {area("f-crit", "Critérios técnicos da avaliação", "criteriosTexto", 4, "Um por linha, no formato “Nome — descrição”. Substituem os quatro critérios padrão para quem tem esta função.")}
        {area("f-comp", "Competências necessárias (base do PDI)", "competencias", 3, "Uma por linha.")}
        {area("f-desc", "Observações", "descricao", 2)}
        {area("f-rot", "Rotina semanal", "rotina", 3, "Uma por linha.")}
        {area("f-est", "Estratégia da função", "estrategia", 3, "Como esta função ganha o jogo: foco do trimestre e o que não fazer.")}
        <div className="rotulo">Treinamentos recomendados</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TRILHAS.map((t) => (
            <button key={t.id} type="button" className={`pilula${f.trilhas?.includes(t.id) ? " ativa" : ""}`} aria-pressed={!!f.trilhas?.includes(t.id)} onClick={() => alternar(t.id)}>{t.nome}</button>
          ))}
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

// Ficha de descrição de cargo no formato dos documentos da MinasLab; imprime em A4.
export function DocumentoCargo({ f }) {
  const id = f.identificacao || {};
  const grupos = [];
  for (const l of linhas(f.responsabilidades)) {
    if (l.startsWith("# ")) grupos.push({ titulo: l.slice(2), itens: [] });
    else { if (!grupos.length) grupos.push({ titulo: "", itens: [] }); grupos.at(-1).itens.push(l); }
  }
  const kpis = linhas(f.kpis).map((l) => l.split(/\s+—\s+/));
  const lista = (t) => <ul>{linhas(t).map((x) => <li key={x}>{x}</li>)}</ul>;
  let n = 0;
  const sec = (titulo) => <h3 className="doc-sec">{++n}. {titulo}</h3>;
  return (
    <div className="doc-cargo">
      <div className="doc-topo"><span>Minas<b>Lab</b></span><span>Descrição de cargo{f.revisadoEm ? ` · revisada em ${dataCurta(f.revisadoEm)}` : ""}</span></div>
      <h2 className="doc-titulo">{f.nome}</h2>
      {sec("Identificação do cargo")}
      <table className="doc-tab"><tbody>
        <tr><th>Cargo</th><td>{f.nome}</td></tr>
        {id.setor && <tr><th>Setor</th><td>{id.setor}</td></tr>}
        {id.vinculo && <tr><th>Vínculo hierárquico</th><td>{id.vinculo}</td></tr>}
        {id.colabora && <tr><th>Colabora com</th><td>{id.colabora}</td></tr>}
      </tbody></table>
      {f.missao && <>{sec("Missão do cargo")}<p>{f.missao}</p></>}
      {grupos.length > 0 && <>{sec("Responsabilidades principais")}{grupos.map((g, k) => <div key={k}>{g.titulo && <h4>{n}.{k + 1}. {g.titulo}</h4>}<ul>{g.itens.map((x) => <li key={x}>{x}</li>)}</ul></div>)}</>}
      {linhas(f.autonomia).length > 0 && <>{sec("Autonomia")}{lista(f.autonomia)}</>}
      {linhas(f.requisitos).length > 0 && <>{sec("Requisitos de competência")}{lista(f.requisitos)}</>}
      {linhas(f.competencias).length > 0 && <>{sec("Competências necessárias")}{lista(f.competencias)}</>}
      {kpis.length > 0 && <>{sec("Indicadores de desempenho")}
        <table className="doc-tab"><thead><tr><th>Indicador</th><th>Como medir</th><th>Meta</th></tr></thead><tbody>
          {kpis.map((k, i) => <tr key={i}><td>{k[0]}</td><td>{k[1] || ""}</td><td>{k[2] || ""}</td></tr>)}
        </tbody></table></>}
      {linhas(f.condicoes).length > 0 && <>{sec("Condições de trabalho")}{lista(f.condicoes)}</>}
      <div className="doc-assin"><span>Colaborador(a): ______________________________</span><span>Gestão: ______________________________</span><span>Data: ____/____/______</span></div>
    </div>
  );
}

function VerDescricao({ f, aoFechar }) {
  return (
    <Modal titulo="Descrição de cargo" aoFechar={aoFechar}>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 12 }}>
        <button type="button" className="btn claro" onClick={aoFechar}>Fechar</button>
        <button type="button" className="btn" onClick={() => window.print()}>Imprimir / salvar PDF</button>
      </div>
      <DocumentoCargo f={f} />
      <div className="impressao" aria-hidden="true"><DocumentoCargo f={f} /></div>
    </Modal>
  );
}

/** As metas próprias da função (dos indicadores da descrição de cargo). */
export function MetasFuncao({ f, titulo = "Metas da função" }) {
  const ms = metasDaFuncao(f);
  if (!ms.length) return <div className="peq suave">Sem indicadores na descrição: inclua em Editar › Indicadores de desempenho.</div>;
  return (
    <div className="peq">
      <b>{titulo}:</b>
      <ul className="metas-funcao">
        {ms.map((m) => <li key={m.indicador}><span>{m.indicador}</span>{metaComNumero(m, f.metasPadrao) && <b>{metaComNumero(m, f.metasPadrao)}</b>}</li>)}
      </ul>
    </div>
  );
}

// "meta mensal da pessoa" vira o número das metas do CRM quando houver.
function metaComNumero(m, mp = {}) {
  if (!/da pessoa/i.test(m.meta)) return m.meta;
  if (/propostas/i.test(m.indicador) && mp.propostas) return `${mp.propostas} por mês`;
  if (/aprova/i.test(m.indicador) && mp.aprovacao) return `${mp.aprovacao}% ou mais`;
  if (/prospec|contatos/i.test(m.indicador) && mp.ligacoes) return `${mp.ligacoes} por dia`;
  return m.meta;
}

/** Metas da função, uma por linha da tabela (guardadas como “Indicador — como medir — meta”). */
function EditorMetas({ kpis, aoMudar }) {
  const ler = () => String(kpis || "").split("\n").filter((l) => l.trim()).map((l) => { const [a = "", b = "", c = ""] = l.split(/\s+[—–]\s+/); return [a.trim(), b.trim(), c.trim()]; });
  const [linhasM, setLinhasM] = useState(ler);
  const mudar = (ls) => { setLinhasM(ls); aoMudar(ls.filter((l) => l[0].trim()).map(([a, b, c]) => { a = a.trim(); b = b.trim(); c = c.trim(); return c ? `${a} — ${b || "conferência no mês"} — ${c}` : b ? `${a} — ${b}` : a; }).join("\n")); };
  const set = (i, k, v) => mudar(linhasM.map((l, j) => (j === i ? l.map((x, q) => (q === k ? v : x)) : l)));
  return (
    <div className="campo">
      <label>Metas da função</label>
      <span className="suave peq">Cada função tem as suas. Indicador, como medir e a meta (ex.: “95% ou mais”, “zero”, “no mesmo dia”).</span>
      <div className="editor-metas">
        <div className="editor-metas-cab"><span>Indicador</span><span>Como medir</span><span>Meta</span><span /></div>
        {linhasM.map((l, i) => (
          <div key={i} className="editor-metas-linha">
            <input className="entrada" aria-label="Indicador" value={l[0]} onChange={(e) => set(i, 0, e.target.value)} />
            <input className="entrada" aria-label="Como medir" value={l[1]} onChange={(e) => set(i, 1, e.target.value)} />
            <input className="entrada" aria-label="Meta" value={l[2]} onChange={(e) => set(i, 2, e.target.value)} />
            <button type="button" className="btn perigo mini" aria-label="Tirar meta" onClick={() => mudar(linhasM.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
      </div>
      <div><button type="button" className="btn claro mini" onClick={() => mudar([...linhasM, ["", "", ""]])}>+ meta</button></div>
    </div>
  );
}
