import { useEffect, useState } from "react";
import { clsx } from "../lib/clsx.js";

/**
 * Paginação de listas. `reset` volta para a página 1 quando um filtro muda.
 *   const pag = usePaginacao(lista, 10, filtro);  pag.itens.map(...)  <Paginacao pag={pag} />
 */
export function usePaginacao(lista, porPagina = 10, reset) {
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [reset]);
  const n = lista?.length || 0;
  const total = Math.max(1, Math.ceil(n / porPagina));
  const p = Math.min(pagina, total);
  return { itens: (lista || []).slice((p - 1) * porPagina, p * porPagina), pagina: p, total, n, porPagina, ir: setPagina };
}

export function Paginacao({ pag, rotulo = "itens" }) {
  if (!pag || pag.total <= 1) return null;
  const { pagina, total, n, porPagina, ir } = pag;
  // Números visíveis: 1, a atual e vizinhas, a última; "…" no meio.
  const nums = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - pagina) <= 1) nums.push(i);
    else if (nums.at(-1) !== "…") nums.push("…");
  }
  const de = (pagina - 1) * porPagina + 1;
  const ate = Math.min(n, pagina * porPagina);
  return (
    <nav className="paginacao" aria-label="Paginação">
      <span className="suave peq tnum">{de}–{ate} de {n} {rotulo}</span>
      <div className="paginacao-botoes">
        <button type="button" className="pag-btn" disabled={pagina === 1} onClick={() => ir(pagina - 1)} aria-label="Página anterior">‹</button>
        {nums.map((x, i) => x === "…"
          ? <span key={`r${i}`} className="suave peq">…</span>
          : <button key={x} type="button" className={clsx("pag-btn", x === pagina && "ativa")} aria-current={x === pagina ? "page" : undefined} onClick={() => ir(x)}>{x}</button>)}
        <button type="button" className="pag-btn" disabled={pagina === total} onClick={() => ir(pagina + 1)} aria-label="Próxima página">›</button>
      </div>
    </nav>
  );
}

/** Abas para quebrar telas longas em partes. abas: [[id, rótulo, contador?]] */
export function Abas({ abas, valor, aoMudar }) {
  return (
    <div className="abas" role="tablist">
      {abas.filter(Boolean).map(([id, nome, cont]) => (
        <button key={id} type="button" role="tab" aria-selected={valor === id} className={clsx("aba", valor === id && "ativa")} onClick={() => aoMudar(id)}>
          {nome}{cont != null && cont !== "" && <span className="aba-cont tnum">{cont}</span>}
        </button>
      ))}
    </div>
  );
}

export function Card({ className, semPad, children, ...r }) {
  return <section className={clsx("card", semPad && "sem-pad", className)} {...r}>{children}</section>;
}

export function Chip({ tom = "neutro", children }) {
  return <span className={`chip ${tom}`}>{children}</span>;
}

export function Kpi({ rotulo, valor, sub, tomSub }) {
  return (
    <Card style={{ padding: 18 }}>
      <div className="kpi-rot">{rotulo}</div>
      <div className="kpi-val tnum">{valor}</div>
      {sub && <div className="kpi-sub" style={tomSub ? { color: `var(--${tomSub})` } : undefined}>{sub}</div>}
    </Card>
  );
}

export function Cabecalho({ sobre, titulo, sub, children }) {
  return (
    <header className="cabecalho">
      <div>
        {sobre && <div className="sobretitulo">{sobre}</div>}
        <h1 style={{ marginTop: 4 }}>{titulo}</h1>
        {sub && <div className="suave peq" style={{ marginTop: 4 }}>{sub}</div>}
      </div>
      {children && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{children}</div>}
    </header>
  );
}

export function Pontos({ lista }) {
  if (!lista?.length) return <div className="vazio">Nada fora do esperado.</div>;
  return (
    <div>
      {lista.map((p, i) => (
        <div className="ponto" key={i}>
          <span className={`bolinha ${p.tom}`} />
          <div>
            <div style={{ fontWeight: 600 }}>{p.titulo}</div>
            {p.texto && <div className="suave peq" style={{ marginTop: 2 }}>{p.texto}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Barras por mês: enviadas (barra clara) com a parte aprovada (escura).
 * O mês escolhido ganha a cor de destaque; a meta, se houver, vira linha tracejada.
 */
export function GraficoMeses({ serie, mesDestaque, meta, rotuloMes }) {
  const max = Math.max(1, meta || 0, ...serie.map((s) => s.enviadas));
  const altura = 140;
  return (
    <div>
      <div className="graf" role="img" aria-label="Propostas enviadas e aprovadas por mês">
        {meta ? <div className="graf-meta" style={{ bottom: (meta / max) * altura + 1 }} title={`Meta: ${meta}`} /> : null}
        {serie.map((s) => {
          const destaque = s.mes === mesDestaque;
          return (
            <div className="graf-col" key={s.mes} title={`${rotuloMes(s.mes)}: ${s.enviadas} enviadas, ${s.aprovadas} aprovadas`}>
              <span className="graf-val">{s.enviadas}</span>
              <div className="graf-barra" style={{ height: (s.enviadas / max) * altura, background: destaque ? "var(--marca-200)" : "#e3ecec" }}>
                <div style={{ width: "100%", height: s.enviadas ? `${(s.aprovadas / s.enviadas) * 100}%` : 0, background: destaque ? "var(--marca)" : "#8aa5a5" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="graf-rotulos">{serie.map((s) => <span key={s.mes}>{rotuloMes(s.mes)}</span>)}</div>
    </div>
  );
}

export function Modal({ titulo, aoFechar, children, largo = false }) {
  useEffect(() => {
    const f = (e) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [aoFechar]);
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={largo ? "modal largo" : "modal"} role="dialog" aria-modal="true" aria-label={titulo}>
        <h2>{titulo}</h2>
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  );
}

export function iniciais(nome) {
  const p = String(nome || "?").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p.length > 1 ? p.at(-1)[0] : "")).toUpperCase();
}
