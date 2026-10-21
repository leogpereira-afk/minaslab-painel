// Certificado de reconhecimento do Destaque do mês, no modelo MinasLab.
// Gerado com o 1º lugar do ranking; a gestão confere o nome e imprime
// (ou salva em PDF) direto do navegador, em A4 deitado.
import { useEffect, useState } from "react";
import { Card } from "./ui.jsx";
import { mesLongo, mesNome, nomeProprio } from "../lib/format.js";

const mesDoTexto = (mes) => { const n = mesNome(mes); return `${n.charAt(0).toUpperCase()}${n.slice(1)} de ${mes.slice(0, 4)}`; };

const LOGO = "modelos/logo-minaslab.png";

function Trofeu() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="cert-trofeu"><path fill="currentColor" d="M7 2h10v2h4v3a5 5 0 0 1-4.6 5A5 5 0 0 1 13 14.9V18h3v2H8v-2h3v-3.1A5 5 0 0 1 7.6 12 5 5 0 0 1 3 7V4h4V2Zm0 4H5v1a3 3 0 0 0 2 2.8V6Zm10 0v3.8A3 3 0 0 0 19 7V6h-2Z" /></svg>
  );
}

export function Certificado({ nome, mes, selo = "Funcionário destaque", assinatura = "Diretoria Executiva", titulo = "Certificado de Reconhecimento", texto = null, icone = <Trofeu />, apresentado = "Este certificado é orgulhosamente apresentado a" }) {
  return (
    <div className="cert">
      <div className="cert-folha">
        <span className="cert-canto a" /><span className="cert-canto b" />
        <img className="cert-logo" src={LOGO} alt="MinasLab" />
        <div className="cert-sublogo">Laboratório de Controle de Qualidade</div>
        <div className="cert-titulo">{titulo}</div>
        <div className="cert-selo">{icone}{selo}</div>
        <div className="cert-apresentado">{apresentado}</div>
        <div className="cert-nome">{nome || "Nome do colaborador"}</div>
        <div className="cert-texto">
          {texto || <>Em reconhecimento ao seu excelente desempenho, comprometimento intransigente com a qualidade e postura profissional exemplar demonstrados ao longo do mês de <b>{mesDoTexto(mes)}</b>, contribuindo ativamente para a melhoria contínua e o sucesso do MinasLab.</>}
        </div>
        <div className="cert-assinatura"><span /><b>{assinatura}</b><em>MinasLab</em></div>
      </div>
    </div>
  );
}

/** Cartão no Ranking: escolhe a pessoa (padrão: 1º lugar), confere o nome e imprime. */
export function CartaoCertificado({ mes, candidatos }) {
  const primeiro = candidatos[0];
  const [pessoaId, setPessoaId] = useState(primeiro?.id || "");
  const [nome, setNome] = useState(nomeProprio(primeiro?.nome));
  const [selo, setSelo] = useState("Funcionário destaque");
  useEffect(() => { setPessoaId(primeiro?.id || ""); setNome(nomeProprio(primeiro?.nome)); }, [mes, primeiro?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const escolher = (id) => { setPessoaId(id); setNome(nomeProprio(candidatos.find((c) => c.id === id)?.nome)); };
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h2>Certificado de reconhecimento · {mesLongo(mes)}</h2>
          <div className="suave peq">{primeiro ? "Já vem com o 1º lugar do ranking. Confira o nome completo e imprima (ou salve em PDF)." : "Aparece quando o ranking do mês tiver o 1º lugar. Você também pode escrever o nome."}</div>
        </div>
        <button type="button" className="btn" onClick={() => window.print()} disabled={!nome.trim()}>Imprimir certificado</button>
      </div>
      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, margin: "12px 0" }}>
        {candidatos.length > 0 && (
          <div className="campo"><label htmlFor="ct-pessoa">Pessoa</label>
            <select id="ct-pessoa" className="entrada" value={pessoaId} onChange={(e) => escolher(e.target.value)}>
              {candidatos.map((c, i) => <option key={c.id} value={c.id}>{i < 3 ? `${i + 1}º · ` : ""}{nomeProprio(c.nome)}</option>)}
            </select>
          </div>
        )}
        <div className="campo"><label htmlFor="ct-nome">Nome no certificado</label><input id="ct-nome" className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="campo"><label htmlFor="ct-selo">Selo</label>
          <select id="ct-selo" className="entrada" value={selo} onChange={(e) => setSelo(e.target.value)}>
            {["Funcionário destaque", "Funcionária destaque", "Colaborador destaque", "Colaboradora destaque"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="cert-previa"><Certificado nome={nome} mes={mes} selo={selo} /></div>
      {/* página sem margem só enquanto esta tela está aberta (as apresentações usam margem) */}
      <style>{"@media print { @page { size: A4 landscape; margin: 0; } }"}</style>
      <div className="impressao" aria-hidden="true"><div className="cert-pagina"><Certificado nome={nome} mes={mes} selo={selo} /></div></div>
    </Card>
  );
}
