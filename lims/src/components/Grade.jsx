// Grade no estilo DataTables do GerenciaLab: barra de botões, pesquisa,
// ordenação por coluna, filtro por coluna (opcional), seleção de linhas,
// rodapé "Mostrando de X até Y de Z registros" e paginação. O botão
// "Colunas" esconde/mostra colunas (como na Entrada de amostras do painel);
// a escolha fica só no navegador de quem escolheu.
// As regras ficam em lib/grade.js (testadas); aqui é só a tela.

import { useEffect, useMemo, useRef, useState } from "react";
import { getSessao } from "../lib/sessao.js";
import { filtrarColunas, ordenar, paginar, paraCSV, pesquisar } from "../lib/grade.js";
import { baixar } from "../lib/arquivo.js";
import { isoDia } from "../lib/formato.js";

const chaveColunas = (id) => `lims:colunas-ocultas:${getSessao()?.usuario || "anonimo"}:${id}`;
function lerOcultas(id, padrao) {
  try { const v = JSON.parse(localStorage.getItem(chaveColunas(id)) ?? "null"); return Array.isArray(v) ? v : padrao; } catch { return padrao; }
}
function gravarOcultas(id, v) {
  try { localStorage.setItem(chaveColunas(id), JSON.stringify(v)); } catch { /* sem armazenamento: vale só nesta visita */ }
}

// Botão "Colunas" com a lista para marcar/desmarcar. A primeira coluna fica sempre.
function EscolherColunas({ colunas, ocultas, setOcultas }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fechar); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  const alternar = (t) => setOcultas(ocultas.includes(t) ? ocultas.filter((x) => x !== t) : [...ocultas, t]);
  const n = ocultas.filter((t) => colunas.some((c) => c.t === t)).length;
  return (
    <div className="colunas-sel" ref={ref}>
      <button type="button" className={`dbtn${n ? " on" : ""}`} aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></svg>
        Colunas{n ? ` (${n} ocultas)` : ""}
      </button>
      {aberto && (
        <div className="colunas-pop">
          <div className="colunas-topo"><b>Mostrar colunas</b><button type="button" className="link" disabled={!n} onClick={() => setOcultas([])}>Mostrar todas</button></div>
          <p>Vale só para você, neste navegador.</p>
          {colunas.map((c, i) => c.t && (
            <label key={c.t} className={i === 0 ? "fixa" : ""}>
              <input type="checkbox" disabled={i === 0} checked={i === 0 || !ocultas.includes(c.t)} onChange={() => alternar(c.t)} />{c.t}{i === 0 && " (sempre)"}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Botão com lista de opções (ex.: "Status" → Todos / Ativo / Inativo, como no GerenciaLab).
function MenuBotao({ b }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fechar); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  const atual = b.menu.find((o) => o.marcado);
  return (
    <div className="colunas-sel" ref={ref}>
      <button type="button" className={`dbtn${atual && !atual.padrao ? " on" : ""}`} aria-expanded={aberto} aria-haspopup="menu" onClick={() => setAberto((v) => !v)}>{b.rotulo}{atual && !atual.padrao ? `: ${atual.rotulo}` : ""}</button>
      {aberto && (
        <div className="menu-pop" role="menu">
          {b.menu.map((o) => <button key={o.rotulo} type="button" role="menuitemradio" aria-checked={!!o.marcado} className={o.marcado ? "on" : ""} onClick={() => { o.acao(); setAberto(false); }}>{o.rotulo}</button>)}
        </div>
      )}
    </div>
  );
}

export function Grade({ id, linhas, colunas, botoes, ordemInicial = [0, "desc"], filtrosColuna = false, opcoesFiltro = {}, selecao, aoSelecionar, aoAbrir, multipla = false, porPaginaInicial = 25, rotuloPorPagina, exportar, ocultasPadrao = [] }) {
  const [ocultas, setOcultasEstado] = useState(() => lerOcultas(id, ocultasPadrao));
  const setOcultas = (v) => { setOcultasEstado(v); gravarOcultas(id, v); };
  // Colunas na tela, com o índice original (filtros e ordem usam o original).
  const mostradas = useMemo(() => colunas.map((c, i) => ({ c, i })).filter(({ c, i }) => i === 0 || !ocultas.includes(c.t)), [colunas, ocultas]);
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState({});
  const [[si, sd], setOrdem] = useState(ordemInicial);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(porPaginaInicial);

  const visiveis = useMemo(() => {
    const ativos = Object.fromEntries(Object.entries(filtros).filter(([i]) => mostradas.some((m) => String(m.i) === i)));
    let r = filtrosColuna ? filtrarColunas(linhas, colunas, ativos) : pesquisar(linhas, colunas, q);
    return ordenar(r, colunas[si], sd);
  }, [linhas, colunas, filtros, filtrosColuna, q, si, sd, mostradas]);
  const pg = paginar(visiveis.length, pagina, porPagina);
  const fatia = visiveis.slice(pg.inicio, pg.fim);

  const ordenarPor = (i) => setOrdem(([a, s]) => [i, a === i && s === "asc" ? "desc" : "asc"]);
  const marcar = (linha) => {
    if (!aoSelecionar) return;
    const s = new Set(selecao);
    if (multipla) s.has(linha.id) ? s.delete(linha.id) : s.add(linha.id);
    else { const tinha = s.has(linha.id); s.clear(); if (!tinha) s.add(linha.id); }
    aoSelecionar(s);
  };
  const filtrar = (i, v) => { setFiltros((f) => ({ ...f, [i]: v })); setPagina(0); };

  return (
    <>
      <div className="dt-top">
        <div className="dt-btns">
          {exportar && <><button type="button" className="dbtn" onClick={() => baixar(`${exportar}-${isoDia(0)}.csv`, paraCSV(visiveis, mostradas.map((m) => m.c)))}>Criar Excel</button><button type="button" className="dbtn" onClick={() => window.print()}>Imprimir</button></>}
          <EscolherColunas colunas={colunas} ocultas={ocultas} setOcultas={setOcultas} />
          {botoes.map((b) => (b.menu ? <MenuBotao key={b.rotulo} b={b} /> : <button key={b.rotulo} type="button" className="dbtn" disabled={b.desativado} onClick={b.acao}>{b.rotulo}</button>))}
        </div>
        {!filtrosColuna && (
          <div className="dt-search"><label htmlFor={`q-${id}`}>Pesquisar</label><input id={`q-${id}`} type="search" value={q} onChange={(e) => { setQ(e.target.value); setPagina(0); }} /></div>
        )}
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              {mostradas.map(({ c, i }) => (
                <th key={c.t} className={`sortable${i === si ? ` ${sd}` : ""}`} onClick={() => ordenarPor(i)} aria-sort={i === si ? (sd === "asc" ? "ascending" : "descending") : "none"}>{c.t}</th>
              ))}
            </tr>
            {filtrosColuna && (
              <tr className="filtros">
                {mostradas.map(({ c, i }) => (
                  <th key={c.t}>
                    {c.filtro === "lista" && (
                      <select aria-label={`Filtrar por ${c.t}`} value={filtros[i] || "Todos"} onChange={(e) => filtrar(i, e.target.value)}>
                        <option>Todos</option>{(opcoesFiltro[i] || []).map((o) => <option key={o}>{o}</option>)}
                      </select>
                    )}
                    {c.filtro === true && <input type="text" className="com-funil" placeholder={c.t} aria-label={`Filtrar por ${c.t}`} value={filtros[i] || ""} onChange={(e) => filtrar(i, e.target.value)} />}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {fatia.length ? fatia.map((l) => (
              <tr key={l.id} className={`clicavel${selecao?.has(l.id) ? " sel" : ""}`} aria-selected={selecao?.has(l.id) || false}
                onClick={() => marcar(l)} onDoubleClick={() => aoAbrir?.(l)}>
                {mostradas.map(({ c }) => <td key={c.t} title={String((c.fv || c.v)(l) ?? "")}>{c.h ? c.h(l) : (c.v(l) ?? "")}</td>)}
              </tr>
            )) : <tr><td colSpan={mostradas.length} className="vazio">Nenhum registro encontrado</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="dt-bottom">
        <div className="dt-len">
          <span>Mostrando de {pg.de} até {pg.ate} de {visiveis.length.toLocaleString("pt-BR")} registros{visiveis.length !== linhas.length ? ` (filtrados de ${linhas.length})` : ""}</span>
          <label htmlFor={`len-${id}`} style={{ marginLeft: 12 }}>{rotuloPorPagina || "Exibir"}</label>
          <select id={`len-${id}`} value={porPagina} onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(0); }}>
            {[10, 20, 25, 50, 100, 200].map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div className="pager">
          <button type="button" disabled={pg.atual === 0} onClick={() => setPagina(pg.atual - 1)}>Anterior</button>
          {pg.botoes.map((p, i) => p === "…" ? <button key={`r${i}`} type="button" disabled>…</button> :
            <button key={p} type="button" className={p === pg.atual ? "on" : ""} aria-current={p === pg.atual ? "page" : undefined} onClick={() => setPagina(p)}>{p + 1}</button>)}
          <button type="button" disabled={pg.atual >= pg.paginas - 1} onClick={() => setPagina(pg.atual + 1)}>Próximo</button>
        </div>
      </div>
    </>
  );
}
