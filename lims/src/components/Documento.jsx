// Moldura dos documentos impressos do LIMS no padrão da MinasLab (como sai do
// GerenciaLab): logo à esquerda, título e número ao centro, linha verde,
// blocos com faixa cinza de título e rodapé com endereço, código do modelo
// e paginação. Usado por Relatório de Ensaio, Ficha de Coleta e Ficha de análise.

import { configSistema } from "../lib/dados.jsx";
import logoMinasLab from "../assets/logo-minaslab.webp";

export function Documento({ dados, titulo, subtitulo, linhas = [], codigoModelo = "", children, className = "" }) {
  const cfg = configSistema(dados);
  const rodape = String(cfg.rodapeDocumentos || "").split(/\r?\n/).filter(Boolean);
  return (
    <div className={`docml ${className}`}>
      <div className="docml-topo">
        <img src={logoMinasLab} alt="MinasLab" />
        <div className="docml-titulo"><div className="t">{titulo}</div>{subtitulo && <div className="n">{subtitulo}</div>}{linhas.map((l) => <div key={l} className="n">{l}</div>)}</div>
        <div />
      </div>
      <div className="docml-corpo">{children}</div>
      <div className="docml-rodape">
        <span>{codigoModelo}</span>
        <span className="c">{rodape.map((l) => <div key={l}>{l}</div>)}</span>
        <span />
      </div>
    </div>
  );
}

// Bloco com faixa cinza de título; linhas em duas colunas "Rótulo: valor".
export function Bloco({ titulo, pares, children }) {
  return (
    <div className="docml-bloco">
      {titulo && <div className="docml-bloco-t">{titulo}</div>}
      {pares && <div className="docml-pares">{pares.filter(Boolean).map(([r, v], i) => <div key={i} className={r.startsWith("!") ? "larga" : ""}><b>{r.replace(/^!/, "")}:</b> {v === "" || v == null ? "-" : v}</div>)}</div>}
      {children}
    </div>
  );
}

// Data por extenso: "Montes Claros, 27 de Agosto de 2026".
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export function dataExtenso(iso, cidade = "") {
  const d = iso ? new Date(String(iso).length > 10 ? iso : `${iso}T12:00:00`) : new Date();
  return `${cidade ? `${cidade}, ` : ""}${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// Código de validação do documento: resumo (FNV-1a 64 bits em hex, duas
// passadas) do conteúdo congelado + número. Muda se qualquer dado mudar.
export function codigoValidacao(obj, sufixo = "") {
  const s = JSON.stringify(obj);
  const h = (seed) => { let x = BigInt(seed); for (let i = 0; i < s.length; i++) { x ^= BigInt(s.charCodeAt(i)); x = (x * 0x100000001b3n) & 0xffffffffffffffffn; } return x.toString(16).toUpperCase().padStart(16, "0"); };
  return `${h(0xcbf29ce484222325n)}${h(0x84222325cbf29ce4n)}${sufixo ? `|${sufixo}` : ""}`;
}
