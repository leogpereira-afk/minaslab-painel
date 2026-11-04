// Grade no estilo DataTables do GerenciaLab: barra de botões, pesquisa,
// ordenação por coluna, filtro por coluna (opcional), seleção de linhas,
// rodapé "Mostrando de X até Y de Z registros" e paginação.
// As regras ficam em lib/grade.js (testadas); aqui é só a tela.

import { useMemo, useState } from "react";
import { filtrarColunas, ordenar, paginar, paraCSV, pesquisar } from "../lib/grade.js";
import { baixar } from "../lib/arquivo.js";
import { isoDia } from "../lib/formato.js";

export function Grade({ id, linhas, colunas, botoes, ordemInicial = [0, "desc"], filtrosColuna = false, opcoesFiltro = {}, selecao, aoSelecionar, aoAbrir, multipla = false, porPaginaInicial = 25, rotuloPorPagina, exportar }) {
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState({});
  const [[si, sd], setOrdem] = useState(ordemInicial);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(porPaginaInicial);

  const visiveis = useMemo(() => {
    let r = filtrosColuna ? filtrarColunas(linhas, colunas, filtros) : pesquisar(linhas, colunas, q);
    return ordenar(r, colunas[si], sd);
  }, [linhas, colunas, filtros, filtrosColuna, q, si, sd]);
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
          {exportar && <><button type="button" className="dbtn" onClick={() => baixar(`${exportar}-${isoDia(0)}.csv`, paraCSV(visiveis, colunas))}>Criar Excel</button><button type="button" className="dbtn" onClick={() => window.print()}>Imprimir</button></>}
          {botoes.map((b) => <button key={b.rotulo} type="button" className="dbtn" disabled={b.desativado} onClick={b.acao}>{b.rotulo}</button>)}
        </div>
        {!filtrosColuna && (
          <div className="dt-search"><label htmlFor={`q-${id}`}>Pesquisar</label><input id={`q-${id}`} type="search" value={q} onChange={(e) => { setQ(e.target.value); setPagina(0); }} /></div>
        )}
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              {colunas.map((c, i) => (
                <th key={c.t} className={`sortable${filtrosColuna ? " fh" : ""}${i === si ? ` ${sd}` : ""}`} onClick={(e) => { if (!e.target.closest("input,select")) ordenarPor(i); }} aria-sort={i === si ? (sd === "asc" ? "ascending" : "descending") : "none"}>
                  <div>{c.t}</div>
                  {filtrosColuna && c.filtro === "lista" && (
                    <select aria-label={`Filtrar por ${c.t}`} value={filtros[i] || "Todos"} onChange={(e) => filtrar(i, e.target.value)}>
                      <option>Todos</option>{(opcoesFiltro[i] || []).map((o) => <option key={o}>{o}</option>)}
                    </select>
                  )}
                  {filtrosColuna && c.filtro === true && <input type="text" aria-label={`Filtrar por ${c.t}`} value={filtros[i] || ""} onChange={(e) => filtrar(i, e.target.value)} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fatia.length ? fatia.map((l) => (
              <tr key={l.id} className={`clicavel${selecao?.has(l.id) ? " sel" : ""}`} aria-selected={selecao?.has(l.id) || false}
                onClick={() => marcar(l)} onDoubleClick={() => aoAbrir?.(l)}>
                {colunas.map((c) => <td key={c.t} title={String((c.fv || c.v)(l) ?? "")}>{c.h ? c.h(l) : (c.v(l) ?? "")}</td>)}
              </tr>
            )) : <tr><td colSpan={colunas.length} className="vazio">Nenhum registro encontrado</td></tr>}
          </tbody>
          <tfoot><tr>{colunas.map((c) => <th key={c.t}>{c.t}</th>)}</tr></tfoot>
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
