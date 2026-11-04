import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { COR_STATUS } from "../lib/propostas.js";

/* Aviso rápido no canto (o "toast" do GerenciaLab). */
const AvisoCtx = createContext(() => {});
export function AvisoProvider({ children }) {
  const [aviso, setAviso] = useState(null);
  const t = useRef(0);
  const avisar = useCallback((texto, tipo = "") => {
    setAviso({ texto, tipo });
    clearTimeout(t.current);
    t.current = setTimeout(() => setAviso(null), 3800);
  }, []);
  return (
    <AvisoCtx.Provider value={avisar}>
      {children}
      <div aria-live="polite">{aviso && <div className={`toast ${aviso.tipo}`}>{aviso.texto}</div>}</div>
    </AvisoCtx.Provider>
  );
}
export const useAviso = () => useContext(AvisoCtx);

/* Janela modal. aoConfirmar devolve false para manter a janela aberta (erro). */
export function Modal({ titulo, onFechar, rotuloOk, aoConfirmar, largo, children, extra, ocupado }) {
  const caixa = useRef(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  // Foco no primeiro campo só ao abrir (senão cada tecla devolveria o foco).
  useEffect(() => {
    const kd = (e) => { if (e.key === "Escape") fechar.current(); };
    document.addEventListener("keydown", kd);
    caixa.current?.querySelector(".mb input,.mb textarea,.mb select,.mb button")?.focus();
    return () => document.removeEventListener("keydown", kd);
  }, []);
  // aoConfirmar pode ser assíncrono; devolver false mantém a janela aberta.
  const confirmar = async () => { if ((await aoConfirmar()) !== false) onFechar(); };
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className={`modal${largo ? " largo" : ""}`} role="dialog" aria-modal="true" aria-label={titulo} ref={caixa}>
        <header><h3>{titulo}</h3><button type="button" className="xbtn" onClick={onFechar} aria-label="Fechar">×</button></header>
        <div className="mb">{children}</div>
        <footer>
          {extra && <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>{extra}</div>}
          <button type="button" className="btn btn-default" onClick={onFechar}>Fechar</button>
          {rotuloOk && <button type="button" className="btn btn-primary" onClick={confirmar} disabled={ocupado}>{ocupado ? "Gravando…" : rotuloOk}</button>}
        </footer>
      </div>
    </div>
  );
}

export const RotuloStatus = ({ status }) => <span className={`lbl ${status === "Ativo" ? "ok" : "off"}`}>{status}</span>;
export const RotuloProposta = ({ status }) => <span className={`lbl ${COR_STATUS[status] || "default"}`}>{status}</span>;

export function Caixa({ titulo, cabecalho, children }) {
  return (
    <div className="box">
      {cabecalho ? <div className="box-hd">{cabecalho}</div> : titulo ? <h2 className="box-title">{titulo}</h2> : null}
      {children}
    </div>
  );
}

// Lista de <option> a partir de valores ou pares [valor, texto].
export const opcoes = (lista) => lista.map((o) => {
  const [v, t] = Array.isArray(o) ? o : [o, o];
  return <option key={String(v)} value={v}>{t}</option>;
});
