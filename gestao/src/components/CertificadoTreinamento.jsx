// Certificado de treinamento: quem esteve presente e atingiu a nota mínima.
// Abre uma prévia; "Imprimir" manda só o certificado para a impressora
// (ou para salvar em PDF), em A4 deitado.
import { useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "./ui.jsx";
import { Certificado } from "./Certificado.jsx";
import { dataCurta, nomeProprio } from "../lib/format.js";
import { fmtNota, notaDe } from "../lib/treinamentosPessoa.js";

function Selo() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="cert-trofeu"><path fill="currentColor" d="M12 2 3 6v2h18V6l-9-4Zm-7 8v7h3v-7H5Zm5 0v7h4v-7h-4Zm6 0v7h3v-7h-3ZM3 19v3h18v-3H3Z" /></svg>;
}

const horas = (min) => { const m = Number(min) || 0; if (!m) return ""; const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? String(r).padStart(2, "0") : ""}` : `${r} minutos`; };

export function TextoCertificado({ treinamento, documento, data, minutos, nota }) {
  const n = notaDe(nota);
  // "Inspeção de recebimento (PG 010)" + documento "PG 010 rev. 02": não repetir o código.
  const nome = documento ? String(treinamento).replace(/\s*\([^)]*\)\s*$/, "") : treinamento;
  return (
    <>participou do treinamento <b>{nome}</b>{documento ? <> ({documento})</> : null}, realizado em <b>{dataCurta(data)}</b>{minutos ? <>, com carga horária de <b>{horas(minutos)}</b></> : null}{n != null ? <>, obtendo nota <b>{fmtNota(n)}</b> no teste de verificação</> : null}, como parte do programa de capacitação da MinasLab, conforme a ABNT NBR ISO/IEC 17025.</>
  );
}

/** Botão + prévia + impressão. `dados`: { nome, treinamento, documento, data, minutos, nota, instrutor } */
export function BotaoCertificado({ dados, rotulo = "Certificado", classe = "btn claro mini" }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(nomeProprio(dados.nome));
  const [assina, setAssina] = useState(dados.instrutor || "Gestão MinasLab");
  const cert = <Certificado nome={nome} titulo="Certificado de Treinamento" selo="Capacitação concluída" icone={<Selo />} apresentado="Certificamos que" assinatura={assina} texto={<TextoCertificado {...dados} />} />;
  const imprimir = () => { window.print(); };
  return (
    <>
      <button type="button" className={classe} onClick={() => setAberto(true)}>{rotulo}</button>
      {aberto && (
        <Modal titulo="Certificado de treinamento" aoFechar={() => setAberto(false)} largo>
          <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div className="campo"><label htmlFor="ctt-nome">Nome no certificado</label><input id="ctt-nome" className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="campo"><label htmlFor="ctt-assina">Assinatura</label><input id="ctt-assina" className="entrada" value={assina} onChange={(e) => setAssina(e.target.value)} /></div>
          </div>
          <div className="cert-previa">{cert}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="btn" onClick={imprimir} disabled={!nome.trim()}>Imprimir ou salvar em PDF</button>
            <span className="suave peq">Na janela de impressão, escolha “Salvar como PDF” para arquivar na pasta do colaborador.</span>
          </div>
          {createPortal(<><style>{"@media print { @page { size: A4 landscape; margin: 0; } }"}</style><div className="impressao cert-avulso" aria-hidden="true"><div className="cert-pagina">{cert}</div></div></>, document.body)}
        </Modal>
      )}
    </>
  );
}
