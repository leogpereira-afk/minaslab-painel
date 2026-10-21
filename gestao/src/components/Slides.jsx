// Visualizador de apresentações: slide atual 16:9, miniaturas, roteiro de
// fala, tela cheia (setas do teclado) e impressão/PDF (um slide por página).
import { useEffect, useRef, useState } from "react";

export function Slides({ titulo, slides }) {
  const [i, setI] = useState(0);
  const palco = useRef(null);
  const atual = slides[Math.min(i, slides.length - 1)];

  useEffect(() => { setI(0); }, [titulo]);
  useEffect(() => {
    const f = (e) => {
      if (!document.fullscreenElement) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(x + 1, slides.length - 1)); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [slides.length]);

  const telaCheia = () => palco.current?.requestFullscreen?.().catch(() => {});
  if (!slides.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div className="suave peq">{slides.length} slides · cerca de {slides.reduce((s, x) => s + (x.minutos || 0), 0)} min</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn claro" onClick={() => window.print()}>Imprimir / salvar PDF</button>
          <button type="button" className="btn" onClick={telaCheia}>Apresentar</button>
        </div>
      </div>

      <div ref={palco} className="palco">
        <Slide titulo={titulo} s={atual} n={i + 1} total={slides.length} />
        <div className="palco-nav">
          <button type="button" aria-label="Slide anterior" onClick={() => setI((x) => Math.max(x - 1, 0))} disabled={i === 0}>‹</button>
          <button type="button" aria-label="Próximo slide" onClick={() => setI((x) => Math.min(x + 1, slides.length - 1))} disabled={i >= slides.length - 1}>›</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {slides.map((s, k) => (
          <button key={k} type="button" className={`miniatura${k === i ? " ativa" : ""}`} onClick={() => setI(k)} aria-label={`Slide ${k + 1}: ${s.titulo}`}>
            <b>{k + 1}</b> {s.titulo}
          </button>
        ))}
      </div>

      {atual.roteiro && (
        <div className="aviso marca">
          <div style={{ fontWeight: 600 }}>Roteiro de fala{atual.minutos ? ` · ${atual.minutos} min` : ""}</div>
          <div className="peq" style={{ marginTop: 4, whiteSpace: "pre-line" }}>{atual.roteiro}</div>
        </div>
      )}

      {/* Versão para impressão: todos os slides, um por página. */}
      <div className="impressao" aria-hidden="true">
        {slides.map((s, k) => <div key={k} className="slide-impresso"><Slide titulo={titulo} s={s} n={k + 1} total={slides.length} /></div>)}
      </div>
    </div>
  );
}

function Slide({ titulo, s, n, total }) {
  return (
    <div className="slide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span className="slide-sobre">{titulo}</span>
        <span className="suave peq">{n} / {total}</span>
      </div>
      <div className="slide-titulo">{s.titulo}</div>
      <div className="slide-corpo">{s.corpo}</div>
      <div className="slide-rodape"><span>Minas<b style={{ color: "var(--marca)" }}>Lab</b> · Comercial</span>{s.fonte && <span>{s.fonte}</span>}</div>
    </div>
  );
}

/** Linhas de barra simples para usar dentro de slides. */
export function BarrasSlide({ itens, max, formato = (v) => v }) {
  const m = max || Math.max(1, ...itens.map((x) => x.valor));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {itens.map((x) => (
        <div key={x.nome} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 160px) minmax(0, 1fr) minmax(70px, 120px)", gap: 12, alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>{x.nome}</span>
          <div style={{ height: 22, background: "var(--fundo)", borderRadius: 6, overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (x.valor / m) * 100)}%`, background: x.cor || "var(--marca)", borderRadius: 6 }} />
            {x.meta ? <div style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(100, (x.meta / m) * 100)}%`, borderLeft: "2px dashed var(--tinta)" }} /> : null}
          </div>
          <span className="tnum" style={{ fontWeight: 600 }}>{x.rotulo ?? formato(x.valor)}</span>
        </div>
      ))}
    </div>
  );
}
