// Ata no modelo FM-LAB-001 (Word), gerada a partir da apresentação da
// reunião. Fica guardada junto da apresentação (campo ataDoc) e pode ser
// editada antes de baixar.
import { useMemo, useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Modal } from "./ui.jsx";
import { TIPOS_ATA, pautaDaApresentacao, nomeCurto, dataBR } from "../lib/ata.js";
import { baixarAta } from "../lib/ataDocx.js";
import { hojeBR } from "../lib/format.js";

/** Tipo de ata sugerido pela apresentação e pelo setor aberto. */
export function tipoSugerido(deck, setor) {
  if (deck.ataDoc?.tipo) return deck.ataDoc.tipo;
  if (deck.modelo === "comercial") return "comercial";
  if (deck.modelo === "laboratorio") return "laboratorio";
  if (deck.modelo === "mensal") return "geral";
  return setor === "laboratorio" ? "laboratorio" : "geral";
}

function useParticipantesPadrao() {
  const { elenco, equipe } = useBase();
  return (tipo) => {
    const lista = tipo === "geral" && elenco.length ? elenco : equipe;
    return [...new Set(lista.map(nomeCurto).filter(Boolean))];
  };
}

export function CartaoAta({ deck, ctx, aoMudar }) {
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState("");
  const [baixando, setBaixando] = useState(false);
  const a = deck.ataDoc;
  const baixar = async () => {
    setErro(""); setBaixando(true);
    try { await baixarAta(a); } catch (e) { setErro(e.message || "Não consegui gerar o arquivo."); }
    setBaixando(false);
  };
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h2>Ata no modelo MinasLab (FM-LAB-001)</h2>
          <div className="suave peq">A pauta sai dos slides desta apresentação. Você confere, completa e baixa em Word, no mesmo formato das atas impressas.</div>
        </div>
        {a ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="btn claro" onClick={() => setEditando(true)}>Editar a ata</button>
            <button type="button" className="btn" onClick={baixar} disabled={baixando}>{baixando ? "Gerando…" : "Baixar em Word"}</button>
          </div>
        ) : <button type="button" className="btn" onClick={() => setEditando(true)}>Gerar a ata desta reunião</button>}
      </div>
      {a && (
        <div className="peq" style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Chip tom="marca">{TIPOS_ATA[a.tipo]?.curto}</Chip>
          <span>{dataBR(a.data)}</span>
          <span className="suave">· {a.pauta?.length || 0} itens de pauta · {(a.participantes || []).length} participante(s)</span>
        </div>
      )}
      {erro && <div className="aviso ruim" style={{ marginTop: 8 }}>{erro}</div>}
      {editando && <EditorAta deck={deck} ctx={ctx} aoSalvar={(x) => { aoMudar(x); setEditando(false); }} aoFechar={() => setEditando(false)} />}
    </Card>
  );
}

export function EditorAta({ deck, ctx = {}, aoSalvar, aoFechar }) {
  const { dados, setor } = useBase();
  const padrao = useParticipantesPadrao();
  // Solicitante, cargo e local: os da última ata gerada; participantes: os da última ata do mesmo tipo.
  const outras = useMemo(() => dados.apresentacoes.filter((d) => d.ataDoc && d.id !== deck.id).sort((x, y) => String(y.ataDoc.salvaEm || "").localeCompare(String(x.ataDoc.salvaEm || ""))), [dados.apresentacoes, deck.id]);
  const inicial = () => {
    if (deck.ataDoc) return deck.ataDoc;
    const tipo = tipoSugerido(deck, setor);
    const ult = outras[0]?.ataDoc;
    const mesmoTipo = outras.find((d) => d.ataDoc.tipo === tipo)?.ataDoc;
    return {
      tipo, data: hojeBR(), local: ult?.local || "Minaslab", inicio: "", fim: "",
      solicitante: ult?.solicitante || "", cargo: ult?.cargo || "", assunto: TIPOS_ATA[tipo].assunto,
      participantes: mesmoTipo?.participantes?.length ? mesmoTipo.participantes : padrao(tipo),
      pauta: pautaDaApresentacao(deck.slides, ctx), obs: "",
    };
  };
  const [a, setA] = useState(inicial);
  const [erro, setErro] = useState("");
  const [baixando, setBaixando] = useState(false);
  const mudar = (campos) => setA((x) => ({ ...x, ...campos }));
  const mudarItem = (i, campos) => mudar({ pauta: a.pauta.map((x, k) => (k === i ? { ...x, ...campos } : x)) });
  const moverItem = (i, d) => { const p = [...a.pauta]; const j = i + d; if (j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; mudar({ pauta: p }); };
  const trocarTipo = (tipo) => mudar({ tipo, assunto: Object.values(TIPOS_ATA).some((t) => t.assunto === a.assunto) || !a.assunto ? TIPOS_ATA[tipo].assunto : a.assunto });
  const refazer = () => window.confirm("Refazer a pauta a partir dos slides? O que você editou na pauta será substituído.") && mudar({ pauta: pautaDaApresentacao(deck.slides, ctx) });
  const final = () => ({ ...a, participantes: a.participantes.map((s) => s.trim()).filter(Boolean), salvaEm: new Date().toISOString() });
  const baixar = async () => {
    setErro(""); setBaixando(true);
    try { const x = final(); aoSalvar(x); await baixarAta(x); } catch (e) { setErro(e.message || "Não consegui gerar o arquivo."); }
    setBaixando(false);
  };

  return (
    <Modal largo titulo="Ata de reunião" aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="campo">
          <span className="rotulo">Tipo de reunião</span>
          <div className="pilulas" role="radiogroup" aria-label="Tipo de reunião">
            {Object.entries(TIPOS_ATA).map(([id, t]) => <button key={id} type="button" role="radio" aria-checked={a.tipo === id} className={`pilula${a.tipo === id ? " ativa" : ""}`} onClick={() => trocarTipo(id)}>{t.nome}</button>)}
          </div>
        </div>
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div className="campo"><label htmlFor="at-data">Data</label><input id="at-data" type="date" className="entrada" value={a.data} onChange={(e) => mudar({ data: e.target.value })} /></div>
          <div className="campo"><label htmlFor="at-ini">Início</label><input id="at-ini" type="time" className="entrada" value={a.inicio} onChange={(e) => mudar({ inicio: e.target.value })} /></div>
          <div className="campo"><label htmlFor="at-fim">Fim</label><input id="at-fim" type="time" className="entrada" value={a.fim} onChange={(e) => mudar({ fim: e.target.value })} /></div>
          <div className="campo"><label htmlFor="at-local">Local</label><input id="at-local" className="entrada" value={a.local} onChange={(e) => mudar({ local: e.target.value })} /></div>
          <div className="campo"><label htmlFor="at-sol">Solicitante</label><input id="at-sol" className="entrada" value={a.solicitante} onChange={(e) => mudar({ solicitante: e.target.value })} /></div>
          <div className="campo"><label htmlFor="at-cargo">Cargo</label><input id="at-cargo" className="entrada" value={a.cargo} onChange={(e) => mudar({ cargo: e.target.value })} /></div>
        </div>
        <div className="campo"><label htmlFor="at-ass">Assunto</label><input id="at-ass" className="entrada" value={a.assunto} onChange={(e) => mudar({ assunto: e.target.value })} /></div>
        <div className="campo">
          <label htmlFor="at-part">Participantes (um por linha; a assinatura fica em branco para assinar no papel)</label>
          <textarea id="at-part" className="entrada" rows={6} value={a.participantes.join("\n")} onChange={(e) => mudar({ participantes: e.target.value.split("\n") })} />
          <span className="suave peq" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            Preencher com:
            <button type="button" className="btn claro mini" onClick={() => mudar({ participantes: padrao("geral") })}>todos do laboratório</button>
            <button type="button" className="btn claro mini" onClick={() => mudar({ participantes: padrao("setor") })}>equipe deste setor</button>
          </span>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Pauta</h3>
            {deck.slides?.length > 0 && <button type="button" className="btn claro mini" onClick={refazer}>Refazer pelos slides</button>}
          </div>
          <div className="suave peq" style={{ margin: "4px 0 8px" }}>Os números entram sozinhos. Escreva como foi falado na reunião: "- " no começo da linha vira marcador, "# " vira subtítulo em negrito.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {a.pauta.map((it, i) => (
              <div key={i} className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="suave peq" style={{ minWidth: 22 }}>{it.semNumero ? "" : `${a.pauta.slice(0, i + 1).filter((x) => !x.semNumero).length}.`}</span>
                  <input className="entrada" aria-label={`Título do item ${i + 1}`} value={it.titulo} onChange={(e) => mudarItem(i, { titulo: e.target.value })} style={{ fontWeight: 600 }} />
                  <button type="button" className="btn claro mini" onClick={() => moverItem(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                  <button type="button" className="btn claro mini" onClick={() => moverItem(i, 1)} disabled={i === a.pauta.length - 1} aria-label="Descer">↓</button>
                  <button type="button" className="btn perigo mini" onClick={() => mudar({ pauta: a.pauta.filter((_, k) => k !== i) })}>Tirar</button>
                </div>
                <textarea className="entrada" aria-label={`Texto do item ${i + 1}`} rows={Math.min(10, Math.max(2, String(it.corpo || "").split("\n").length + 1))} value={it.corpo} onChange={(e) => mudarItem(i, { corpo: e.target.value })} />
              </div>
            ))}
            <button type="button" className="btn claro mini" style={{ alignSelf: "flex-start" }} onClick={() => { const p = [...a.pauta]; const fimI = p.findIndex((x) => x.semNumero); p.splice(fimI < 0 ? p.length : fimI, 0, { titulo: "Novo assunto", corpo: "" }); mudar({ pauta: p }); }}>+ Item de pauta</button>
          </div>
        </div>

        <div className="campo"><label htmlFor="at-obs">Observações</label><textarea id="at-obs" className="entrada" rows={3} value={a.obs} onChange={(e) => mudar({ obs: e.target.value })} /></div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn claro" onClick={() => aoSalvar(final())}>Salvar</button>
          <button type="button" className="btn" onClick={baixar} disabled={baixando}>{baixando ? "Gerando…" : "Salvar e baixar em Word"}</button>
        </div>
      </div>
    </Modal>
  );
}
