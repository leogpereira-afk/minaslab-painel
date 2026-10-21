// Lista das atas geradas (guardadas junto de cada apresentação de reunião).
import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip } from "./ui.jsx";
import { TIPOS_ATA, dataBR } from "../lib/ata.js";
import { baixarAta } from "../lib/ataDocx.js";
import { EditorAta } from "./AtaDocumento.jsx";

export function ListaAtas() {
  const { dados, gravar } = useBase();
  const [filtro, setFiltro] = useState("");
  const [editando, setEditando] = useState(null);
  const [erro, setErro] = useState("");
  const atas = dados.apresentacoes
    .filter((d) => d.ataDoc && (!filtro || d.ataDoc.tipo === filtro))
    .sort((a, b) => String(b.ataDoc.data).localeCompare(String(a.ataDoc.data)));
  const baixar = (a) => { setErro(""); baixarAta(a).catch((e) => setErro(e.message)); };
  return (
    <Card semPad>
      <div className="card-cab">
        <h2>Atas</h2>
        <div className="pilulas" role="tablist" aria-label="Tipo">
          {[["", "Todas"], ...Object.entries(TIPOS_ATA).map(([id, t]) => [id, t.curto])].map(([id, n]) => <button key={id || "todas"} type="button" role="tab" aria-selected={filtro === id} className={`pilula${filtro === id ? " ativa" : ""}`} onClick={() => setFiltro(id)}>{n}</button>)}
        </div>
      </div>
      {erro && <div className="aviso ruim" style={{ margin: "0 20px 12px" }}>{erro}</div>}
      {atas.length === 0 ? (
        <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma ata ainda. Abra a apresentação da reunião (aba Apresentações de reunião) e clique em <b>Gerar a ata desta reunião</b>, no fim da página.</div>
      ) : (
        <div className="tabela-caixa">
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Assunto</th><th>Apresentação</th><th /></tr></thead>
            <tbody>
              {atas.map((d) => (
                <tr key={d.id}>
                  <td className="tnum">{dataBR(d.ataDoc.data)}</td>
                  <td><Chip tom="marca">{TIPOS_ATA[d.ataDoc.tipo]?.curto}</Chip></td>
                  <td>{d.ataDoc.assunto}<div className="suave peq">{d.ataDoc.pauta?.length || 0} itens · {(d.ataDoc.participantes || []).length} participante(s)</div></td>
                  <td className="peq">{d.ataImportada ? <span className="suave">Ata antiga importada</span> : d.titulo}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button type="button" className="btn claro mini" onClick={() => setEditando(d)}>Editar</button>{" "}
                    <button type="button" className="btn mini" onClick={() => baixar(d.ataDoc)}>Baixar em Word</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <EditorAta deck={editando} aoFechar={() => setEditando(null)}
          aoSalvar={(ataDoc) => { gravar("apresentacoes", { ...editando, ataDoc, atualizadoEm: new Date().toISOString() }).catch((e) => setErro(e.message)); setEditando(null); }} />
      )}
    </Card>
  );
}
