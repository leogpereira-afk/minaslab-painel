// Slides no estilo das apresentações da MinasLab (faixa verde-água no topo,
// título em caixa alta, logo no rodapé, cartões claros e escuros). Tudo é
// medido em cqw (largura do slide), então a mesma peça serve de miniatura,
// de slide no editor, de tela cheia e de página impressa.
import { useEffect, useRef, useState } from "react";
import { LAYOUTS, linhas, blocos, pares, preencher } from "../lib/modelosApresentacao.js";
import { brl, pct, mesCurto, dataCurta, mesLongo } from "../lib/format.js";
import { mesesComNomes, semanasUteis } from "../lib/escala.js";
import { lerDados, fmtNum } from "../lib/grafico.js";

const CORES = ["#0f766e", "#5eead4", "#1f3a4d", "#f59e0b", "#94a3b8", "#be185d"];

function Grafico({ tipo, dados }) {
  const { series, rotulos, valores } = dados;
  if (!rotulos.length) return <Aguardando texto="Escreva os dados no editor: uma linha por item, “Rótulo | valor”." />;
  const max = Math.max(1, ...valores.flat());
  const legenda = series.length > 1 && <div className="dk-legenda" style={{ marginTop: ".8cqw" }}>{series.map((n, k) => <span key={n}><i style={{ background: CORES[k % CORES.length] }} /> {n}</span>)}</div>;
  if (tipo === "barras") {
    return (
      <div className="dk-gr-barras">
        {rotulos.map((r, i) => (
          <div key={i} className="dk-gr-bl">
            <span className="dk-gr-rot">{r}</span>
            <div className="dk-gr-bs">{valores[i].map((v, k) => <div key={k} className="dk-gr-b" style={{ width: `${(v / max) * 100}%`, background: CORES[k % CORES.length] }}><em>{fmtNum(v)}</em></div>)}</div>
          </div>
        ))}
        {legenda}
      </div>
    );
  }
  if (tipo === "pizza") {
    const vs = valores.map((v) => v[0] || 0);
    const tot = vs.reduce((a, b) => a + b, 0) || 1;
    let ac = 0;
    const arco = (ini, fim) => {
      const p = (f) => [50 + 40 * Math.sin(2 * Math.PI * f), 50 - 40 * Math.cos(2 * Math.PI * f)];
      const [x1, y1] = p(ini), [x2, y2] = p(Math.min(fim, ini + 0.9999));
      return `M ${x1} ${y1} A 40 40 0 ${fim - ini > 0.5 ? 1 : 0} 1 ${x2} ${y2}`;
    };
    return (
      <div className="dk-gr-pizza">
        <svg viewBox="0 0 100 100" role="img" aria-label="Gráfico de pizza">
          {vs.map((v, i) => { const ini = ac / tot; ac += v; return <path key={i} d={arco(ini, ac / tot)} stroke={CORES[i % CORES.length]} strokeWidth="18" fill="none" />; })}
        </svg>
        <div className="dk-gr-pizza-leg">{rotulos.map((r, i) => <div key={i}><i style={{ background: CORES[i % CORES.length] }} /><span>{r}</span><b>{fmtNum(vs[i])}</b><em>{Math.round((vs[i] / tot) * 100)}%</em></div>)}</div>
      </div>
    );
  }
  if (tipo === "linha") {
    const W = 100, H = 46, n = rotulos.length;
    const x = (i) => (n === 1 ? W / 2 : 4 + (i * (W - 8)) / (n - 1));
    const y = (v) => H - 4 - (v / max) * (H - 10);
    return (
      <div className="dk-gr-linha">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Gráfico de linha">
          {series.map((_, k) => <polyline key={k} points={valores.map((v, i) => `${x(i)},${y(v[k])}`).join(" ")} fill="none" stroke={CORES[k % CORES.length]} strokeWidth=".7" vectorEffect="non-scaling-stroke" />)}
        </svg>
        <div className="dk-gr-linha-pts">
          {series.map((_, k) => valores.map((v, i) => <span key={`${k}-${i}`} style={{ left: `${x(i)}%`, top: `${(y(v[k]) / H) * 100}%`, borderColor: CORES[k % CORES.length] }}><em>{fmtNum(v[k])}</em></span>))}
        </div>
        <div className="dk-gr-linha-rot">{rotulos.map((r, i) => <span key={i} style={{ left: `${x(i)}%` }}>{r}</span>)}</div>
        {legenda}
      </div>
    );
  }
  // colunas (padrão)
  return (
    <div className="dk-gr-colunas-caixa">
      <div className="dk-gr-colunas">
        {rotulos.map((r, i) => (
          <div key={i} className="dk-gr-col">
            <div className="dk-gr-cs">{valores[i].map((v, k) => <div key={k} className="dk-gr-c" style={{ height: `${(v / max) * 100}%`, background: CORES[k % CORES.length] }}><em>{fmtNum(v)}</em></div>)}</div>
            <span className="dk-gr-rot">{r}</span>
          </div>
        ))}
      </div>
      {legenda}
    </div>
  );
}
import { iniciais } from "./ui.jsx";

export function Logo({ claro }) {
  return (
    <div className={`dk-logo${claro ? " claro" : ""}`}>
      <span className="dk-logo-nome">Minas<b>Lab</b></span>
      <span className="dk-logo-sub">Laboratório de Controle de Qualidade</span>
    </div>
  );
}

const T = (txt, ctx) => preencher(txt, ctx.valores);

function Lista({ texto, ctx }) {
  const ls = linhas(T(texto, ctx));
  if (!ls.length) return null;
  const grupos = [];
  for (const l of ls) {
    if (l.startsWith("# ")) grupos.push({ sub: l.slice(2), itens: [] });
    else { if (!grupos.length) grupos.push({ sub: "", itens: [] }); grupos.at(-1).itens.push(l.replace(/^[-•]\s*/, "")); }
  }
  return (
    <div className="dk-lista">
      {grupos.map((g, i) => (
        <div key={i}>
          {g.sub && <div className="dk-sub">{g.sub}</div>}
          {g.itens.length > 0 && <ul>{g.itens.map((x, k) => <li key={k}>{x}</li>)}</ul>}
        </div>
      ))}
    </div>
  );
}

function Destaque({ texto, ctx, escuro }) {
  const t = T(texto, ctx).trim();
  if (!t) return null;
  return <div className={`dk-callout${escuro ? " escuro" : ""}`}>{t}</div>;
}

/** Pílulas coloridas da capa no estilo colorido ("Tema 1 · Tema 2 · …"). */
function Pilulas({ texto, ctx }) {
  const ps = T(texto || "", ctx).split("·").map((x) => x.trim()).filter(Boolean);
  if (!ps.length) return <div className="dk-pilulas">{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="vazia" />)}</div>;
  return <div className="dk-pilulas">{ps.map((x, i) => <span key={i}>{x}</span>)}</div>;
}

function Moldura({ s, ctx, n, total, children, classe = "" }) {
  return (
    <div className={`dk-slide ${classe}`}>
      <div className="dk-faixa" />
      {s.titulo && <div className="dk-tit">{T(s.titulo, ctx)}</div>}
      <div className="dk-corpo">{children}</div>
      <div className="dk-rodape"><span /><Logo /><span className="dk-num">{n ? `${n}/${total}` : ""}</span></div>
    </div>
  );
}

/**
 * Link de vídeo → como mostrar. YouTube e Vimeo viram o player deles;
 * Google Drive usa a prévia do arquivo compartilhado; .mp4/.webm toca direto.
 */
export function videoDe(link) {
  const u = String(link || "").trim();
  if (!u) return null;
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return { tipo: "youtube", url: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0` };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { tipo: "vimeo", url: `https://player.vimeo.com/video/${m[1]}` };
  m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/);
  if (m) return { tipo: "drive", url: `https://drive.google.com/file/d/${m[1]}/preview` };
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(u)) return { tipo: "arquivo", url: u };
  if (/^https?:\/\//i.test(u)) return { tipo: "pagina", url: u };
  return null;
}

// ------------------------------------------------------------- layouts
const RENDER = {
  capa: ({ s, ctx }) => {
    const miolo = (
      <>
        <Logo claro={ctx?.tema !== "colorido"} />
        <div className="dk-capa-tit">{T(s.titulo, ctx)}</div>
        {s.subtitulo && <div className="dk-capa-sub">{T(s.subtitulo, ctx)}</div>}
        {s.texto && <div className="dk-capa-txt">{T(s.texto, ctx)}</div>}
        {ctx?.tema === "colorido" && <Pilulas texto={s.destaque} ctx={ctx} />}
      </>
    );
    if (!s.imagem) return <div className="dk-slide dk-escuro dk-capa">{miolo}</div>;
    return (
      <div className="dk-slide dk-escuro dk-capa com-imagem">
        <div className="dk-capa-lado">{miolo}</div>
        <img className="dk-capa-img" src={s.imagem} alt="" />
      </div>
    );
  },
  encerramento: ({ s, ctx }) => (
    <div className="dk-slide dk-escuro dk-capa">
      <div className="dk-capa-tit grande">{T(s.titulo, ctx)}</div>
      {s.subtitulo && <div className="dk-capa-sub">{T(s.subtitulo, ctx)}</div>}
      {s.texto && <div className="dk-capa-txt">{T(s.texto, ctx)}</div>}
      {ctx?.tema === "colorido" && <Pilulas texto={s.destaque} ctx={ctx} />}
      <div style={{ marginTop: "3cqw" }}><Logo claro={ctx?.tema !== "colorido"} /></div>
    </div>
  ),
  agenda: (p) => {
    const its = pares(T(p.s.itens, p.ctx));
    return (
      <Moldura {...p}>
        <div className="dk-agenda" style={{ gridTemplateColumns: `repeat(${Math.min(its.length, 5) || 1}, 1fr)` }}>
          {its.map((x, i) => <div key={i} className="dk-cartao centro"><span className="dk-bola">{i + 1}</span><b>{x.titulo}</b><span>{x.texto}</span></div>)}
        </div>
      </Moldura>
    );
  },
  topicos: (p) => (
    <Moldura {...p}>
      <div className="dk-col"><Lista texto={p.s.texto} ctx={p.ctx} /><Destaque texto={p.s.destaque} ctx={p.ctx} /></div>
    </Moldura>
  ),
  colunas: (p) => {
    const bs = blocos(T(p.s.itens, p.ctx));
    const cols = bs.length <= 3 ? bs.length : bs.length === 4 ? 4 : 3;
    return (
      <Moldura {...p}>
        <div className="dk-col">
          <div className="dk-grade" style={{ gridTemplateColumns: `repeat(${cols || 1}, 1fr)` }}>
            {bs.map((b, i) => (
              <div key={i} className={`dk-cartao${bs.length === 2 && i === 1 ? " escuro" : ""}`}>
                {b.titulo && <b className="dk-cartao-tit">{b.titulo}</b>}
                {b.linhas.some((l) => l.startsWith("- "))
                  ? <>{b.linhas.filter((l) => !l.startsWith("- ")).map((l, k) => <span key={k}>{l}</span>)}<ul>{b.linhas.filter((l) => l.startsWith("- ")).map((l, k) => <li key={k}>{l.slice(2)}</li>)}</ul></>
                  : b.linhas.map((l, k) => <span key={k}>{l}</span>)}
              </div>
            ))}
          </div>
          <Destaque texto={p.s.destaque} ctx={p.ctx} />
        </div>
      </Moldura>
    );
  },
  numero: (p) => (
    <Moldura {...p}>
      <div className="dk-numero">
        <div className="dk-numero-esq"><div className="dk-grande">{T(p.s.numero, p.ctx)}</div>{p.s.rotulo && <div className="dk-rot">{T(p.s.rotulo, p.ctx)}</div>}</div>
        <div className="dk-col"><Lista texto={p.s.texto} ctx={p.ctx} /><Destaque texto={p.s.destaque} ctx={p.ctx} escuro /></div>
      </div>
    </Moldura>
  ),
  fluxo: (p) => {
    const its = pares(T(p.s.itens, p.ctx));
    return (
      <Moldura {...p}>
        <div className="dk-col" style={{ justifyContent: "center" }}>
          <div className="dk-fluxo" style={{ gridTemplateColumns: `repeat(${its.length || 1}, 1fr)` }}>
            {its.map((x, i) => {
              const alerta = x.titulo.endsWith("!") || x.texto.endsWith("!");
              return <div key={i} className={`dk-etapa${alerta ? " alerta" : ""}`}><span className="dk-ponto" /><b>{x.titulo.replace(/!$/, "")}</b><span>{x.texto.replace(/!$/, "")}</span></div>;
            })}
          </div>
          <Destaque texto={p.s.destaque} ctx={p.ctx} />
        </div>
      </Moldura>
    );
  },
  tabela: (p) => {
    const ls = linhas(T(p.s.itens, p.ctx)).map((l) => l.split("|").map((c) => c.trim()));
    const [cab = [], ...corpo] = ls;
    return (
      <Moldura {...p}>
        <div className="dk-col">
          <table className="dk-tabela"><thead><tr>{cab.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{corpo.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody></table>
          <Destaque texto={p.s.destaque} ctx={p.ctx} />
        </div>
      </Moldura>
    );
  },
  aviso: ({ s, ctx }) => (
    <div className="dk-slide dk-escuro dk-aviso">
      <div className="dk-aviso-tit">{T(s.titulo, ctx)}</div>
      <div className="dk-aviso-caixa">
        <div>{T(s.texto, ctx)}</div>
        {s.destaque && <div className="dk-aviso-menor">{T(s.destaque, ctx)}</div>}
      </div>
      <Logo claro={ctx?.tema !== "colorido"} />
    </div>
  ),
  frase: (p) => (
    <Moldura {...p}>
      <div className="dk-frase">
        <div className="dk-icone" aria-hidden="true">⚗</div>
        <div className="dk-frase-txt">{T(p.s.frase, p.ctx)}</div>
        {p.s.texto && <div className="dk-frase-sub">{T(p.s.texto, p.ctx)}</div>}
      </div>
    </Moldura>
  ),
  indicadores: (p) => {
    const ind = p.ctx.indicadores;
    if (!ind) return <Moldura {...p}><Aguardando texto="Lendo os números do CRM…" /></Moldura>;
    const linha = (rot, t, amostras, escuro) => (
      <div className="dk-ind-linha">
        <div className="dk-ind-mes">{rot}</div>
        <Tile v={t.enviadas} r="Propostas enviadas" escuro={escuro} />
        <Tile v={t.aprovadas} r="Aprovadas (das enviadas)" />
        <Tile v={t.recusadas} r="Recusadas" escuro={escuro} vermelho />
        {amostras !== "" && amostras != null && <Tile v={amostras} r="Amostras analisadas" escuro={escuro} />}
      </div>
    );
    const conv = ind.t.taxa;
    const delta = ind.ant.enviadas ? ((ind.t.enviadas - ind.ant.enviadas) / ind.ant.enviadas) * 100 : null;
    return (
      <Moldura {...p}>
        <div className="dk-col">
          {linha(ind.rotulo, ind.t, p.s.amostras || p.ctx.setores?.porMes?.[p.ctx.mes]?.total || "", true)}
          {linha(ind.rotuloAnt, ind.ant, p.s.amostrasAnterior || (Array.isArray(p.ctx.setores?.meses) ? p.ctx.setores?.porMes?.[p.ctx.setores.meses[0]]?.total : "") || "", true)}
          <div className="dk-ind-rodape">
            <div className="dk-ind-barra"><span>Aprovação</span><div><div style={{ width: `${Math.min(100, conv || 0)}%` }}>{pct(conv)}</div></div></div>
            {delta != null && <div className={`dk-delta ${delta >= 0 ? "sobe" : "desce"}`}>{delta >= 0 ? "▲" : "▼"} {pct(Math.abs(delta))} nas propostas enviadas frente a {ind.rotuloAnt.toLowerCase()}</div>}
          </div>
          {p.s.texto && <div className="dk-citacao">“{T(p.s.texto, p.ctx)}”</div>}
        </div>
      </Moldura>
    );
  },
  tendencia: (p) => {
    const ser = p.ctx.serie;
    if (!ser) return <Moldura {...p}><Aguardando texto="Lendo os números do CRM…" /></Moldura>;
    const max = Math.max(1, ...ser.map((x) => x.enviadas));
    return (
      <Moldura {...p}>
        <div className="dk-col">
          <div className="dk-barras">
            {ser.map((x) => (
              <div key={x.mes} className={`dk-barra-col${x.mes === p.ctx.mes ? " atual" : ""}`}>
                <span className="dk-barra-val">{brl(x.valorAprovado, true)}</span>
                <div className="dk-barra" style={{ height: `${(x.enviadas / max) * 100}%` }}><div style={{ height: x.enviadas ? `${(x.aprovadas / x.enviadas) * 100}%` : 0 }} /><em>{x.enviadas}</em></div>
                <span className="dk-barra-mes">{mesCurto(x.mes)}</span>
              </div>
            ))}
          </div>
          <div className="dk-legenda"><span><i className="claro" /> propostas enviadas</span><span><i /> aprovadas</span><span>valor aprovado no topo</span></div>
          {p.s.texto && <Destaque texto={p.s.texto} ctx={p.ctx} />}
        </div>
      </Moldura>
    );
  },
  setores: (p) => {
    const st = p.ctx.setores;
    if (!st?.porMes || !Array.isArray(st.meses)) return <Moldura {...p}><Aguardando texto={p.ctx.erroSetores || "Lendo as amostras do CRM…"} /></Moldura>;
    const [mAnt, mAt] = st.meses;
    const at = st.porMes[mAt] || { total: 0, porSetor: {}, porMatriz: {} };
    const an = st.porMes[mAnt] || { total: 0, porSetor: {} };
    const nomes = ["Microbiologia", "Físico-química", "Campo", "Parceiros"];
    const rot = { Microbiologia: "Microbiologia", "Físico-química": "Físico-química", Campo: "Campo (in situ)", Parceiros: "Laboratórios parceiros" };
    const max = Math.max(1, ...nomes.flatMap((n) => [at.porSetor[n]?.amostras || 0, an.porSetor[n]?.amostras || 0]));
    const matrizes = Object.entries(at.porMatriz || {}).sort((a, b) => b[1] - a[1]);
    const var_ = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
    return (
      <Moldura {...p}>
        <div className="dk-setores">
          <div className="dk-setores-esq">
            <Tile v={at.total} r={`Amostras recebidas em ${mesCurto(mAt)}`} escuro />
            <Tile v={an.total} r={`Em ${mesCurto(mAnt)}`} />
            {var_(at.total, an.total) != null && <div className={`dk-delta ${at.total >= an.total ? "sobe" : "desce"}`}>{at.total >= an.total ? "▲" : "▼"} {Math.abs(var_(at.total, an.total))}% no total</div>}
          </div>
          <div className="dk-col">
            {nomes.map((n) => {
              const a = at.porSetor[n] || { amostras: 0, ensaios: 0 };
              const b = an.porSetor[n] || { amostras: 0, ensaios: 0 };
              const v = var_(a.amostras, b.amostras);
              return (
                <div key={n} className="dk-setor">
                  <div className="dk-setor-nome"><b>{rot[n]}</b><span>{a.ensaios} ensaios</span></div>
                  <div className="dk-setor-barras">
                    <div className="dk-setor-barra atual" style={{ width: `${(a.amostras / max) * 100}%` }}><em>{a.amostras}</em></div>
                    <div className="dk-setor-barra" style={{ width: `${(b.amostras / max) * 100}%` }}><em>{b.amostras}</em></div>
                  </div>
                  <div className={`dk-setor-var ${v == null ? "" : v >= 0 ? "sobe" : "desce"}`}>{v == null ? "—" : `${v >= 0 ? "▲" : "▼"} ${Math.abs(v)}%`}</div>
                </div>
              );
            })}
            <div className="dk-legenda"><span><i /> {mesCurto(mAt)}</span><span><i className="claro" /> {mesCurto(mAnt)}</span><span>amostras com ao menos um ensaio do setor</span></div>
            {matrizes.length > 0 && <div className="dk-setor-matrizes">{matrizes.map(([k, n]) => <span key={k}><b>{n}</b> {k}</span>)}</div>}
            {p.s.texto && <Destaque texto={p.s.texto} ctx={p.ctx} />}
          </div>
        </div>
      </Moldura>
    );
  },
  grafico: (p) => (
    <Moldura {...p}>
      <div className="dk-col">
        {p.s.texto && <div className="dk-gr-sub">{T(p.s.texto, p.ctx)}</div>}
        <Grafico tipo={p.s.tipoGrafico || "colunas"} dados={lerDados(T(p.s.itens, p.ctx))} />
        <Destaque texto={p.s.destaque} ctx={p.ctx} />
      </div>
    </Moldura>
  ),
  imagem: (p) => (
    <Moldura {...p}>
      <div className="dk-col" style={{ alignItems: "center", justifyContent: "center", gap: "1.2cqw" }}>
        {p.s.imagem ? <img className={`dk-imagem${p.s.destaque ? "" : " grande"}`} src={p.s.imagem} alt={p.s.texto || ""} /> : <Aguardando texto="Escolha a imagem no editor (print de gráfico, foto, tabela…)." />}
        {p.s.texto && <div className="dk-imagem-leg">{T(p.s.texto, p.ctx)}</div>}
        <Destaque texto={p.s.destaque} ctx={p.ctx} />
      </div>
    </Moldura>
  ),
  imagemLado: (p) => (
    <Moldura {...p}>
      <div className="dk-img-lado">
        <div className="dk-img-lado-foto">{p.s.imagem ? <img src={p.s.imagem} alt="" /> : <Aguardando texto="Escolha a imagem no editor." />}</div>
        <div className="dk-col" style={{ minWidth: 0 }}><Lista texto={p.s.texto} ctx={p.ctx} /><Destaque texto={p.s.destaque} ctx={p.ctx} /></div>
      </div>
    </Moldura>
  ),
  video: (p) => {
    const v = videoDe(p.s.video);
    return (
      <Moldura {...p}>
        <div className="dk-col" style={{ alignItems: "center", gap: "1.2cqw" }}>
          {!v ? <Aguardando texto="Cole o link do vídeo no editor (YouTube, Vimeo, Google Drive ou arquivo .mp4)." />
            : p.interativo ? (
              <div className="dk-video">
                {v.tipo === "arquivo" ? <video src={v.url} controls preload="metadata" /> : <iframe src={v.url} title={p.s.titulo || "Vídeo"} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />}
              </div>
            ) : (
              <div className="dk-video dk-video-capa"><span className="dk-video-play" aria-hidden="true">▶</span><span>Vídeo: {p.s.video}</span></div>
            )}
          {p.s.texto && <div className="dk-imagem-leg">{T(p.s.texto, p.ctx)}</div>}
          <Destaque texto={p.s.destaque} ctx={p.ctx} />
        </div>
      </Moldura>
    );
  },
  ranking: (p) => {
    const top = p.ctx.podio;
    return (
      <Moldura {...p}>
        <div className="dk-col" style={{ alignItems: "center", justifyContent: "center" }}>
          {p.s.texto && <div className="dk-etiqueta">{T(p.s.texto, p.ctx)}</div>}
          {top?.length ? (
            <div className="dk-ranking">
              <b className="dk-ranking-tit">Os 3 melhores</b>
              {top.map((x, i) => (
                <div key={x.id} className="dk-ranking-l"><span className="dk-ranking-pos">{i + 1}º</span><span className="dk-ranking-nome"><span className="dk-ranking-foto">{p.ctx.fotos?.[x.id] ? <img src={p.ctx.fotos[x.id]} alt="" /> : iniciais(x.nome)}</span>{x.nome}</span><span className="dk-ranking-nota">{String(x.total).replace(".", ",")}</span><span className="dk-ranking-det">equipe {String(x.equipe).replace(".", ",")} · liderança {String(x.lideranca).replace(".", ",")}</span></div>
              ))}
            </div>
          ) : <Aguardando texto="O ranking aparece quando a votação do mês for encerrada e a liderança avaliar (menu Destaque do mês)." />}
        </div>
      </Moldura>
    );
  },
  destaque: (p) => {
    const auto = !p.s.nome?.trim();
    const nome = p.s.nome?.trim() || p.ctx.podio?.[0]?.nome || "";
    // Foto: a do slide; sem ela, a foto cadastrada do 1º lugar (Destaque do mês › Fotos).
    const foto = p.s.foto || (auto && p.ctx.fotos?.[p.ctx.podio?.[0]?.id]) || "";
    const its = linhas(T(p.s.itens, p.ctx));
    const icones = ["★", "⚡", "◎", "✓", "♦"];
    return (
      <Moldura {...p} classe="dk-tit-centro">
        <div className="dk-destaque">
          <div className="dk-foto">{foto ? <img src={foto} alt="" /> : <span>{nome ? iniciais(nome) : "?"}</span>}</div>
          <div className="dk-col" style={{ justifyContent: "center", gap: "1.2cqw" }}>
            {p.s.setor && <span className="dk-etiqueta verde">{T(p.s.setor, p.ctx)}</span>}
            <div className="dk-destaque-nome">{nome || "Defina o nome ou encerre a votação"}</div>
            <div className="dk-destaque-mes">{p.ctx.valores.mes}</div>
            <div className="dk-destaque-itens">{its.map((x, i) => { const [a, ...b] = x.split(":"); return <div key={i}><span className="dk-ic">{icones[i % icones.length]}</span>{b.length ? <><b>{a}:</b>{b.join(":")}</> : x}</div>; })}</div>
          </div>
        </div>
      </Moldura>
    );
  },
  escala: (p) => {
    const e = p.s.escala;
    const meses = mesesComNomes(e);
    const [a, m] = String(p.ctx.mes || "").split("-").map(Number);
    const seguinte = a ? `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}` : "";
    const alvo = p.s.mesEscala || seguinte; // padrão: o mês em que a reunião acontece
    const mes = meses.includes(alvo) ? alvo : meses.find((x) => x >= alvo) || meses.at(-1);
    if (!mes) return <Moldura {...p}><Aguardando texto="Importe a planilha da escala no editor deste slide." /></Moldura>;
    const { dias, feriados } = e.meses[mes];
    const tarefas = linhas(T(p.s.texto, p.ctx));
    return (
      <Moldura {...p}>
        <div className="dk-col">
          <div className="dk-escala-cab"><span className="dk-etiqueta verde">{mesLongo(mes)}</span></div>
          <div className="dk-escala">
            {["Segunda", "Terça", "Quarta", "Quinta", "Sexta"].map((d) => <div key={d} className="dk-escala-dia">{d}</div>)}
            {semanasUteis(mes).flat().map((d, i) => {
              if (!d) return <div key={i} className="dk-escala-cel vazia" />;
              const fer = feriados[d];
              return (
                <div key={i} className={`dk-escala-cel${fer ? " feriado" : ""}${!fer && !dias[d] ? " livre" : ""}`}>
                  <span className="dk-escala-n">{Number(d.slice(8))}</span>
                  <b>{fer ? "Feriado" : dias[d] || "—"}</b>
                  {fer && <em>{fer}</em>}
                </div>
              );
            })}
          </div>
          {tarefas.length > 0 && <div className="dk-escala-tarefas">{tarefas.map((t, i) => <span key={i}><i>✓</i>{t}</span>)}</div>}
          <Destaque texto={p.s.destaque} ctx={p.ctx} />
        </div>
      </Moldura>
    );
  },
  labPrazos: (p) => {
    const d = p.ctx.lab;
    if (!d?.os) return <Moldura {...p}><Aguardando texto={p.ctx.erroLab || "Lendo as ordens de serviço do CRM…"} /></Moldura>;
    const m = d.porMes?.[p.ctx.mes] || { recebidas: 0, concluidas: 0 };
    const lista = (d.os.lista || []).slice(0, 6);
    return (
      <Moldura {...p}>
        <div className="dk-col">
          <div className="dk-lab-tiles">
            <Tile v={d.os.andamento} r="OS em andamento" escuro />
            <Tile v={d.os.atrasadas} r="Atrasadas (vencimento passou)" escuro vermelho />
            <Tile v={d.os.vencendo} r="Vencem nos próximos 3 dias" />
            <Tile v={`${m.concluidas}/${m.recebidas}`} r={`Concluídas / recebidas em ${mesCurto(p.ctx.mes)}`} />
          </div>
          <div className="dk-lab-duas">
            <div>
              <b className="dk-lab-sub">OS mais atrasadas</b>
              {lista.length ? lista.map((o, i) => <div key={i} className="dk-lab-linha"><span>{o.numero}{o.cliente ? ` · ${o.cliente}` : ""}</span><em className="desce">{o.dias} {o.dias === 1 ? "dia" : "dias"}</em></div>) : <div className="dk-lab-linha"><span>Nenhuma OS atrasada.</span></div>}
            </div>
            <div>
              <b className="dk-lab-sub">Ritmo de {mesCurto(p.ctx.mes)}</b>
              <div className="dk-lab-linha"><span>OS recebidas</span><em>{m.recebidas}</em></div>
              <div className="dk-lab-linha"><span>OS concluídas</span><em>{m.concluidas}</em></div>
              <div className="dk-lab-linha"><span>OS canceladas</span><em>{m.canceladas ?? 0}</em></div>
              <div className="dk-lab-linha"><span>Em andamento sem vencimento</span><em>{d.os.semVencimento ?? 0}</em></div>
            </div>
          </div>
          {p.s.texto ? <Destaque texto={p.s.texto} ctx={p.ctx} /> : <div className="dk-lab-nota">Situação no dia da reunião · prazo interno pelo vencimento da OS no CRM</div>}
        </div>
      </Moldura>
    );
  },
  labNcs: (p) => {
    const r = p.ctx.ncs;
    if (!r) return <Moldura {...p}><Aguardando texto="Carregando as não conformidades…" /></Moldura>;
    const max = Math.max(1, ...r.porTipo.map((x) => x.n));
    return (
      <Moldura {...p}>
        <div className="dk-setores">
          <div className="dk-setores-esq">
            <Tile v={r.total} r={`NCs em ${mesCurto(p.ctx.mes)}`} escuro />
            <Tile v={r.retrabalho} r="Com retrabalho" vermelho />
            <Tile v={r.abertas} r="Ainda em aberto" />
          </div>
          <div className="dk-col">
            {r.porTipo.length ? r.porTipo.slice(0, 6).map((x) => (
              <div key={x.nome} className="dk-setor">
                <div className="dk-setor-nome"><b>{x.nome}</b></div>
                <div className="dk-setor-barras"><div className="dk-setor-barra atual" style={{ width: `${(x.n / max) * 100}%` }}><em>{x.n}</em></div></div>
                <div className="dk-setor-var" />
              </div>
            )) : <Aguardando texto="Nenhuma não conformidade registrada neste mês." />}
            {r.porSetor.length > 0 && <div className="dk-setor-matrizes">{r.porSetor.map((x) => <span key={x.nome}><b>{x.n}</b> {x.nome}</span>)}</div>}
            {p.s.texto && <Destaque texto={p.s.texto} ctx={p.ctx} />}
          </div>
        </div>
      </Moldura>
    );
  },
  labProdutividade: (p) => {
    const r = p.ctx.produtividade;
    if (!r?.pessoas?.length) return <Moldura {...p}><Aguardando texto="Lance os números do mês na página Produtividade." /></Moldura>;
    const max = Math.max(1, ...r.pessoas.map((x) => x.ensaios));
    return (
      <Moldura {...p}>
        <div className="dk-setores">
          <div className="dk-setores-esq">
            <Tile v={r.ensaios} r="Ensaios no mês" escuro />
            <Tile v={r.laudos} r="Laudos ou relatórios" />
            <Tile v={r.pctRetrabalho == null ? "—" : `${String(r.pctRetrabalho).replace(".", ",")}%`} r="Ensaios repetidos" vermelho={!!r.retrabalhos} />
          </div>
          <div className="dk-col">
            {r.pessoas.slice(0, 8).map((x) => (
              <div key={x.id || x.nome} className="dk-setor">
                <div className="dk-setor-nome"><b>{x.nome}</b><span>{x.laudos} laudo(s){x.retrabalhos ? ` · ${x.retrabalhos} repetido(s)` : ""}</span></div>
                <div className="dk-setor-barras"><div className="dk-setor-barra atual" style={{ width: `${(x.ensaios / max) * 100}%` }}><em>{x.ensaios}</em></div></div>
                <div className="dk-setor-var" />
              </div>
            ))}
            {p.s.texto && <Destaque texto={p.s.texto} ctx={p.ctx} />}
          </div>
        </div>
      </Moldura>
    );
  },
  quiz: (p) => {
    const alts = linhas(T(p.s.itens, p.ctx)).map((l) => ({ certa: l.startsWith("*"), texto: l.replace(/^\*\s*/, "") }));
    const rev = !!p.revelado;
    return (
      <Moldura {...p} classe={`dk-quiz-slide${p.s.imagem ? " com-imagem" : ""}`}>
        <div className={p.s.imagem ? "dk-quiz-com-img" : "dk-col"} style={p.s.imagem ? undefined : { gap: "1.6cqw" }}>
          {p.s.imagem && <div className="dk-quiz-img"><img src={p.s.imagem} alt="" /></div>}
          <div className="dk-col" style={{ gap: "1.6cqw", minWidth: 0 }}>
          <div className="dk-quiz-perg"><span className="dk-quiz-selo">?</span><span>{T(p.s.texto, p.ctx)}</span></div>
          {alts.length > 0 && (
            <div className={`dk-quiz-alts${alts.length > 2 ? " duas" : ""}`}>
              {alts.map((a, i) => (
                <div key={i} className={`dk-quiz-alt${rev ? (a.certa ? " certa" : " errada") : ""}`}>
                  <b>{rev && a.certa ? "✓" : String.fromCharCode(65 + i)}</b><span>{a.texto}</span>
                </div>
              ))}
            </div>
          )}
          {rev ? <Destaque texto={p.s.destaque} ctx={p.ctx} /> : <div className="dk-quiz-dica">{p.interativo ? "Clique no slide ou aperte → para mostrar a resposta" : "Discuta em grupo antes de ver a resposta"}</div>}
          </div>
        </div>
      </Moldura>
    );
  },
  combinados: (p) => {
    const its = p.ctx.anterior || [];
    return (
      <Moldura {...p}>
        {its.length ? (
          <div className="dk-ata">{its.map((x) => <div key={x.id} className={x.feito ? "feito" : ""}><span className="dk-check">{x.feito ? "✓" : "○"}</span><span>{x.texto}</span><em>{[x.dono, x.prazo && `até ${dataCurta(x.prazo)}`].filter(Boolean).join(" · ")}</em></div>)}</div>
        ) : <Aguardando texto="Primeira reunião registrada: o que for combinado hoje abre a próxima." />}
      </Moldura>
    );
  },
  compromissos: (p) => {
    const its = p.ctx.ata || [];
    return (
      <Moldura {...p}>
        {its.length ? (
          <div className="dk-ata">{its.map((x) => <div key={x.id}><span className="dk-check">{x.tipo === "decisao" ? "◆" : "→"}</span><span>{x.texto}</span><em>{[x.dono, x.prazo && `até ${dataCurta(x.prazo)}`].filter(Boolean).join(" · ")}</em></div>)}</div>
        ) : <div className="dk-ata vazia">{[1, 2, 3].map((i) => <div key={i}><span className="dk-check">→</span><span>______________________________</span><em>quem · até quando</em></div>)}</div>}
      </Moldura>
    );
  },
};

function Tile({ v, r, escuro, vermelho, valor }) {
  return <div className={`dk-tile${escuro ? " escuro" : ""}${valor ? " valor" : ""}`}><b style={vermelho && v ? { color: "#f87171" } : undefined}>{v ?? "—"}</b><span>{r}</span></div>;
}

function Aguardando({ texto }) {
  return <div className="dk-aguardando">{texto}</div>;
}

/** Um slide. `ctx` traz os valores dos marcadores e os dados automáticos. */
export function SlideML({ s, ctx, n, total, revelado = false, interativo = false }) {
  const R = RENDER[s.layout] || RENDER.topicos;
  return <div className={`dk${ctx?.tema === "colorido" ? " dk-cor" : ""}`}><R s={s} ctx={ctx} n={n} total={total} revelado={revelado} interativo={interativo} /></div>;
}

/** Páginas de impressão/PowerPoint: o quiz sai duas vezes (pergunta e depois a resposta). */
export function paginasDoDeck(slides) {
  return slides.flatMap((s) => (s.layout === "quiz" ? [{ s, revelado: false }, { s, revelado: true }] : [{ s, revelado: false }]));
}

/** Visualizador: slide grande, setas, tela cheia e impressão (um slide por página). */
export function Apresentador({ slides, ctx, i, setI, notas = true }) {
  const palco = useRef(null);
  const [cheia, setCheia] = useState(false);
  const vis = slides;
  const atual = vis[Math.min(i, vis.length - 1)];
  const [revelados, setRevelados] = useState({});
  // No quiz, o primeiro "avançar" mostra a resposta; o segundo vai para o próximo slide.
  const avancar = () => {
    if (atual?.layout === "quiz" && !revelados[atual.id]) { setRevelados((r) => ({ ...r, [atual.id]: true })); return; }
    setI((x) => Math.min(x + 1, vis.length - 1));
  };
  useEffect(() => {
    const f = () => setCheia(document.fullscreenElement === palco.current);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  useEffect(() => {
    const f = (e) => {
      if (!document.fullscreenElement) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); avancar(); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  if (!atual) return <div className="vazio">Nenhum slide visível.</div>;
  return (
    <>
      <div ref={palco} className={`dk-palco${cheia ? " cheia" : ""}`} onClick={(e) => { if ((cheia || atual.layout === "quiz") && !e.target.closest("button, video, iframe, a")) avancar(); }}>
        <SlideML s={atual} ctx={ctx} n={i + 1} total={vis.length} revelado={!!revelados[atual.id]} interativo />
        <div className="palco-nav">
          <button type="button" aria-label="Slide anterior" onClick={() => setI((x) => Math.max(x - 1, 0))} disabled={i === 0}>‹</button>
          <button type="button" aria-label="Próximo slide" onClick={avancar} disabled={i >= vis.length - 1 && (atual.layout !== "quiz" || revelados[atual.id])}>›</button>
          {!cheia && <button type="button" aria-label="Tela cheia" title="Apresentar em tela cheia" onClick={() => palco.current?.requestFullscreen?.().catch(() => {})}>⛶</button>}
        </div>
      </div>
      {notas && atual.notas && <div className="aviso marca peq"><b>Roteiro de fala:</b> {atual.notas}</div>}
    </>
  );
}

/** Cópia para impressão/PDF: todos os slides, um por página (só aparece ao imprimir). */
export function ImpressaoDeck({ slides, ctx, refEl }) {
  return (
    <div className="impressao" aria-hidden="true" ref={refEl}>
      {paginasDoDeck(slides).map(({ s, revelado }, k) => <div key={`${s.id || k}-${revelado}`} className="slide-impresso dk-impresso"><SlideML s={s} ctx={ctx} n={slides.indexOf(s) + 1} total={slides.length} revelado={revelado} /></div>)}
    </div>
  );
}

export const nomeLayout = (l) => LAYOUTS[l]?.nome || l;
