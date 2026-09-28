// GRÁFICO DE EVOLUÇÃO de Aplicações e Sócios (pedido do Léo, 28/09/2026).
//
// SVG próprio, sem biblioteca, em DOIS PAINÉIS no mesmo eixo de meses: o
// acumulado em linha em cima e o movimento do mês em barras embaixo. Dois
// painéis, nunca dois eixos no mesmo desenho: escalas diferentes sobrepostas
// inventam correlação. A matemática (escala, barras, rótulos) mora em
// lib/graficoPatrimonial.js, com teste; aqui é só desenho e leitura.
//
// O desenho é feito na largura REAL do quadro (medida com ResizeObserver), não
// esticado por viewBox: assim o texto do eixo tem sempre 11px, no celular e na
// tela grande, e 1 unidade do SVG é 1 pixel para a leitura do mês com o dedo.
import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "clsx";
import { dataLonga, moedaCheia } from "../../lib/format.js";
import { caminhoBarra, escalaEixo, indicesDeRotulo, mesCurto, mesLongo, moedaCurta } from "../../lib/graficoPatrimonial.js";
import { Empty } from "../ui.jsx";

// Paleta conferida com o validador da orientação de visualização (28/09/2026):
// faixa de luminosidade, croma, separação para daltonismo e contraste passam.
const COR = { verde: "#0e9f8f", azul: "#2a78d6", laranja: "#eb6834", violeta: "#4a3aa7", cinza: "#64748b", tinta: "#0f172a" };
const SUPERFICIE = "#ffffff";
const GRADE = "#eef1f4";
const EIXO = "#cbd5e1";
const TEXTO = "#64748b";
const FAIXA = "#eef3f9";

// A cor segue a série, nunca a posição: esconder uma série sem valor não
// repinta as outras.
const SERIES = {
  aplicacoes: {
    linha: { chave: "capital", rotulo: "Capital aportado", cor: COR.verde },
    acima: [
      { chave: "aportes", rotulo: "Aportes", cor: COR.azul },
      { chave: "rendimentos", rotulo: "Rendimentos", cor: COR.violeta },
    ],
    abaixo: [
      { chave: "resgates", rotulo: "Resgates", cor: COR.laranja },
      { chave: "impostos", rotulo: "Impostos", cor: COR.cinza },
    ],
    tituloLinha: "Capital aportado acumulado",
    tituloBarras: "No mês: para cima o que aumenta a aplicação, para baixo o que sai dela",
  },
  socios: {
    linha: { chave: "acumulado", rotulo: "Líquido com os sócios", cor: COR.verde },
    acima: [{ chave: "saidas", rotulo: "Saídas para sócios", cor: COR.laranja }],
    abaixo: [{ chave: "entradas", rotulo: "Entradas dos sócios", cor: COR.azul }],
    tituloLinha: "Líquido acumulado (saídas menos entradas)",
    tituloBarras: "No mês: para cima o que foi para os sócios, para baixo o que voltou",
  },
};

const numero = (v) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const positivo = (v) => Math.max(0, numero(v) ?? 0);

/* A chave de cada série, na legenda e na leitura do mês: traço para linha,
   retângulo para barra, losango para o saldo informado, faixa para o período.
   A identidade vem da marca AO LADO do texto; o texto fica sempre em tinta. */
function Chave({ forma, cor }) {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true" className="shrink-0">
      {forma === "linha" && <line x1="1" y1="5" x2="15" y2="5" stroke={cor} strokeWidth="2.5" strokeLinecap="round" />}
      {forma === "barra" && <rect x="3" y="1" width="10" height="8" rx="2" fill={cor} />}
      {forma === "losango" && <rect x="4.5" y="1.5" width="7" height="7" transform="rotate(45 8 5)" fill={cor} />}
      {forma === "faixa" && <rect x="0.5" y="0.5" width="15" height="9" rx="2" fill={FAIXA} stroke={EIXO} />}
    </svg>
  );
}

function resumo(tipo, pontos, conf, saldos) {
  if (!pontos.length) return "";
  const primeiro = mesLongo(pontos[0].mes), ultimo = mesLongo(pontos[pontos.length - 1].mes);
  const final = numero(pontos[pontos.length - 1][conf.linha.chave]);
  const principal = conf.acima[0];
  let maior = null;
  for (const p of pontos) if (positivo(p[principal.chave]) > 0 && (!maior || positivo(p[principal.chave]) > positivo(maior[principal.chave]))) maior = p;
  const partes = [`Evolução de ${pontos.length} ${pontos.length === 1 ? "mês" : "meses"}, de ${primeiro} a ${ultimo}.`];
  partes.push(final === null ? `Sem ${tipo === "aplicacoes" ? "aportes nem resgates reconhecidos" : "movimento reconhecido"}.` : `${conf.linha.rotulo} termina em ${moedaCheia(final)}.`);
  if (maior) partes.push(`Maior valor de ${principal.rotulo.toLowerCase()} num mês: ${moedaCheia(maior[principal.chave])}, em ${mesLongo(maior.mes)}.`);
  if (saldos.length) partes.push(`${saldos.length} ${saldos.length === 1 ? "saldo informado" : "saldos informados"} no período desenhado.`);
  return partes.join(" ");
}

export default function GraficoPatrimonial({ tipo, evolucao, saldos = [], periodo }) {
  const conf = SERIES[tipo] || SERIES.socios;
  const caixa = useRef(null);
  const [largura, setLargura] = useState(0);
  const [mesFixo, setMesFixo] = useState(null);
  const [mesSobre, setMesSobre] = useState(null);
  const leituraId = useId();
  const pontos = Array.isArray(evolucao) ? evolucao : [];
  const n = pontos.length;
  // O quadro medido só existe quando há o que desenhar: a medição religa quando
  // ele aparece (dados que chegam depois), senão a largura ficaria no padrão.
  const visivel = n > 0;

  useEffect(() => {
    const el = caixa.current;
    if (!el) return undefined;
    const medir = () => setLargura(Math.round(el.getBoundingClientRect().width));
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visivel]);
  // O saldo que vale no mês é o último informado nele (lista vem em ordem de data).
  const saldoDoMes = new Map();
  for (const s of saldos || []) saldoDoMes.set(s.mes || String(s.data || "").slice(0, 7), s);
  const saldosVisiveis = pontos.filter((p) => saldoDoMes.has(p.mes)).map((p) => saldoDoMes.get(p.mes));

  const acima = conf.acima.filter((s) => pontos.some((p) => positivo(p[s.chave]) > 0));
  const abaixo = conf.abaixo.filter((s) => pontos.some((p) => positivo(p[s.chave]) > 0));
  const temLinha = pontos.some((p) => numero(p[conf.linha.chave]) !== null);
  const temEstorno = pontos.some((p) => [...conf.acima, ...conf.abaixo].some((s) => (numero(p[s.chave]) ?? 0) < 0));

  const mesVisto = mesSobre ?? (pontos.some((p) => p.mes === mesFixo) ? mesFixo : pontos[n - 1]?.mes);
  const idx = pontos.findIndex((p) => p.mes === mesVisto);
  const ponto = idx >= 0 ? pontos[idx] : null;
  const dentroDoPeriodo = (mes) => !!periodo && mes >= periodo.mesDe && mes <= periodo.mesAte;

  function mover(passo) {
    if (!n) return;
    const atual = idx >= 0 ? idx : n - 1;
    const novo = Math.max(0, Math.min(n - 1, passo === "inicio" ? 0 : passo === "fim" ? n - 1 : atual + passo));
    setMesSobre(null);
    setMesFixo(pontos[novo].mes);
  }
  function aoTeclar(e) {
    const mapa = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12, Home: "inicio", End: "fim" };
    if (!(e.key in mapa)) return;
    e.preventDefault();
    mover(mapa[e.key]);
  }

  if (!n) {
    return (
      <Empty>
        Sem movimento reconhecido para desenhar a evolução neste recorte. O gráfico aparece quando houver pelo menos um
        lançamento com categoria {tipo === "aplicacoes" ? "de aplicação" : "de sócio"}.
      </Empty>
    );
  }

  // ---- geometria (1 unidade = 1 pixel) -------------------------------------
  const L = Math.max(280, largura || 640);
  const compacto = L < 560;
  const esq = compacto ? 56 : 72;
  const dir = 10;
  const plotL = L - esq - dir;
  const passo = plotL / n;
  const larguraBarra = Math.max(2, Math.min(24, passo * 0.62));
  const topo1 = 26;
  const alto1 = compacto ? 132 : 172;
  const topo2 = topo1 + alto1 + 40;
  const alto2 = compacto ? 108 : 136;
  const baseX = topo2 + alto2;
  const H = baseX + 28;
  const xc = (i) => esq + passo * i + passo / 2;
  const ticks = compacto ? 2 : 3;

  const valoresLinha = pontos.map((p) => numero(p[conf.linha.chave])).filter((v) => v !== null);
  const valoresSaldo = saldosVisiveis.map((s) => numero(s.valor)).filter((v) => v !== null);
  const todos1 = [...valoresLinha, ...valoresSaldo];
  const e1 = escalaEixo(todos1.length ? Math.min(...todos1) : 0, todos1.length ? Math.max(...todos1) : 1, ticks);
  const y1 = (v) => topo1 + alto1 - ((v - e1.min) / (e1.max - e1.min)) * alto1;

  const somaLado = (p, lista) => lista.reduce((t, s) => t + positivo(p[s.chave]), 0);
  const maxAcima = Math.max(0, ...pontos.map((p) => somaLado(p, acima)));
  const maxAbaixo = Math.max(0, ...pontos.map((p) => somaLado(p, abaixo)));
  const e2 = escalaEixo(-maxAbaixo, maxAcima || (maxAbaixo ? 0 : 1), ticks);
  const y2 = (v) => topo2 + alto2 - ((v - e2.min) / (e2.max - e2.min)) * alto2;

  // Pilha de um lado da linha de base: 2px de superfície entre os segmentos e a
  // ponta arredondada só no segmento mais de fora.
  function pilha(p, i, lista, sentido) {
    const x = xc(i) - larguraBarra / 2;
    const validos = lista.map((s) => ({ s, v: positivo(p[s.chave]) })).filter((it) => it.v > 0);
    let acum = 0;
    return validos.map(({ s, v }, k) => {
      const yIni = y2(sentido * acum) + (k === 0 ? 0 : sentido > 0 ? -2 : 2);
      const yFim = y2(sentido * (acum + v));
      acum += v;
      if (sentido > 0 ? yIni <= yFim : yIni >= yFim) return null;
      const d = caminhoBarra(x, larguraBarra, yIni, yFim, k === validos.length - 1);
      return d ? <path key={`${p.mes}-${s.chave}`} d={d} fill={s.cor} /> : null;
    });
  }

  // Linha e área (lavagem de 10%) do acumulado.
  const trechos = [];
  let atual = [];
  pontos.forEach((p, i) => {
    const v = numero(p[conf.linha.chave]);
    if (v === null) { if (atual.length) trechos.push(atual); atual = []; return; }
    atual.push([xc(i), y1(v)]);
  });
  if (atual.length) trechos.push(atual);
  const zero1 = y1(0);
  const linhaD = trechos.map((t) => t.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")).join(" ");
  const areaD = trechos.map((t) => `M${t[0][0].toFixed(1)},${zero1.toFixed(1)} ${t.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} L${t[t.length - 1][0].toFixed(1)},${zero1.toFixed(1)} Z`).join(" ");
  const ultimoLinha = trechos.length ? trechos[trechos.length - 1][trechos[trechos.length - 1].length - 1] : null;

  const noPeriodo = pontos.map((p, i) => (dentroDoPeriodo(p.mes) ? i : -1)).filter((i) => i >= 0);
  const faixa = noPeriodo.length ? { x: esq + passo * noPeriodo[0], w: passo * (noPeriodo[noPeriodo.length - 1] - noPeriodo[0] + 1) } : null;
  /* Rótulos do eixo: o último encosta na borda direita (âncora no fim) quando o
     mês é estreito, e aí o vizinho de antes pode encostar nele. Caixa estimada de
     cada texto ("set/26" tem ~36px em 11px) e, de trás para frente, sai quem
     encostaria no que ficou. */
  const larguraRotulo = 38;
  const caixaRotulo = (i) => (i === n - 1 && passo < 44 ? [L - dir - larguraRotulo, L - dir] : [xc(i) - larguraRotulo / 2, xc(i) + larguraRotulo / 2]);
  const rotulos = new Set();
  let limiteEsquerdo = Infinity;
  for (const i of [...indicesDeRotulo(n, passo, compacto ? 40 : 46)].sort((a, b) => b - a)) {
    const [ini, fim] = caixaRotulo(i);
    if (fim + 4 > limiteEsquerdo) continue;
    rotulos.add(i);
    limiteEsquerdo = ini;
  }

  function indiceDoPonteiro(e) {
    const caixaSvg = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!caixaSvg) return -1;
    return Math.max(0, Math.min(n - 1, Math.floor((e.clientX - caixaSvg.left - esq) / passo)));
  }

  // Série cujo maior mês não chega a 1px na escala: está na legenda, mas não se vê.
  // Diz isso em vez de deixar a legenda prometer uma barra que não aparece.
  const pixelsPorReal = alto2 / (e2.max - e2.min);
  const invisivel = (s) => Math.max(...pontos.map((p) => positivo(p[s.chave]))) * pixelsPorReal < 1;
  const rotuloBarra = (s) => (invisivel(s) ? `${s.rotulo} (pequenos demais para a escala; veja a leitura do mês)` : s.rotulo);
  const legenda = [
    temLinha && { chave: conf.linha.chave, rotulo: conf.linha.rotulo, forma: "linha", cor: conf.linha.cor },
    tipo === "aplicacoes" && valoresSaldo.length > 0 && { chave: "saldo", rotulo: "Saldo informado (extrato)", forma: "losango", cor: COR.tinta },
    ...acima.map((s) => ({ ...s, rotulo: rotuloBarra(s), forma: "barra" })),
    ...abaixo.map((s) => ({ ...s, rotulo: rotuloBarra(s), forma: "barra" })),
    faixa && { chave: "faixa", rotulo: "Período escolhido", forma: "faixa" },
  ].filter(Boolean);

  const saldoAqui = ponto ? saldoDoMes.get(ponto.mes) : null;
  // O leitor de tela ouve o mês FIXADO (clique, toque ou teclado), não cada passo do ponteiro.
  const pontoFixo = pontos.find((p) => p.mes === mesFixo);
  const anuncio = pontoFixo
    ? [
        mesLongo(pontoFixo.mes),
        temLinha && numero(pontoFixo[conf.linha.chave]) !== null ? `${conf.linha.rotulo}: ${moedaCheia(pontoFixo[conf.linha.chave])}` : "",
        ...[...acima, ...abaixo].map((s) => `${s.rotulo}: ${moedaCheia(numero(pontoFixo[s.chave]) ?? 0)}`),
        `${pontoFixo.registros} ${pontoFixo.registros === 1 ? "lançamento" : "lançamentos"}`,
      ].filter(Boolean).join(". ")
    : "";
  const topoVazio = !temLinha && valoresSaldo.length === 0;

  return (
    <div className="space-y-3">
      {/* LEITURA DO MÊS: o que um tooltip mostraria, fixo e sempre visível. Vale
          no mouse, no toque e no teclado, e não esconde nada: os mesmos números
          estão na tabela abaixo. Valor em destaque, nome da série depois. */}
      {ponto && (
        <div id={leituraId} className="rounded-xl border bg-slate-50/70 px-3.5 py-2.5" style={{ borderColor: "var(--hairline)" }}>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
            {mesLongo(ponto.mes)}
            {dentroDoPeriodo(ponto.mes) && <span className="chip-brand">no período escolhido</span>}
            {!mesSobre && mesFixo === ponto.mes && <span className="chip">mês fixado</span>}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {temLinha && (
              <li className="flex items-center gap-1.5">
                <Chave forma="linha" cor={conf.linha.cor} />
                <strong className="tnum text-slate-900">{numero(ponto[conf.linha.chave]) === null ? "-" : moedaCheia(ponto[conf.linha.chave])}</strong>
                <span className="text-slate-500">{conf.linha.rotulo}</span>
              </li>
            )}
            {saldoAqui && (
              <li className="flex items-center gap-1.5">
                <Chave forma="losango" cor={COR.tinta} />
                <strong className="tnum text-slate-900">{moedaCheia(saldoAqui.valor)}</strong>
                <span className="text-slate-500">saldo do extrato de {dataLonga(saldoAqui.data)}</span>
              </li>
            )}
            {[...acima, ...abaixo].map((s) => (
              <li key={s.chave} className="flex items-center gap-1.5">
                <Chave forma="barra" cor={s.cor} />
                <strong className="tnum text-slate-900">{moedaCheia(numero(ponto[s.chave]) ?? 0)}</strong>
                <span className="text-slate-500">{s.rotulo}</span>
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <strong className="tnum text-slate-900">{ponto.registros}</strong>
              <span className="text-slate-500">{ponto.registros === 1 ? "lançamento" : "lançamentos"}</span>
            </li>
          </ul>
        </div>
      )}

      <p className="sr-only" aria-live="polite">{anuncio}</p>
      <div
        ref={caixa}
        tabIndex={0}
        role="group"
        aria-label="Gráfico de evolução. Use as setas para percorrer os meses."
        aria-describedby={ponto ? leituraId : undefined}
        onKeyDown={aoTeclar}
        className="patrimonial-grafico"
      >
        <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} role="img" aria-label={resumo(tipo, pontos, conf, saldosVisiveis)}>
          {faixa && <rect x={faixa.x} y={topo1 - 8} width={faixa.w} height={baseX - topo1 + 8} rx="6" fill={FAIXA} />}

          <text x="0" y={topo1 - 12} fontSize="12" fontWeight="600" fill="#475569">{conf.tituloLinha}</text>
          {topoVazio && (
            <text x={esq + plotL / 2} y={topo1 + alto1 / 2} fontSize="12" fill={TEXTO} textAnchor="middle">
              Sem aporte nem resgate com categoria para acumular neste recorte
            </text>
          )}
          {!topoVazio && e1.marcas.map((t) => (
            <g key={`g1-${t}`}>
              <line x1={esq} x2={L - dir} y1={y1(t)} y2={y1(t)} stroke={t === 0 ? EIXO : GRADE} strokeWidth="1" />
              <text x={esq - 8} y={y1(t)} fontSize="11" fill={TEXTO} textAnchor="end" dominantBaseline="middle">{moedaCurta(t)}</text>
            </g>
          ))}
          {temLinha && <path d={areaD} fill={conf.linha.cor} fillOpacity="0.1" />}
          {temLinha && <path d={linhaD} fill="none" stroke={conf.linha.cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {ultimoLinha && <circle cx={ultimoLinha[0]} cy={ultimoLinha[1]} r="4" fill={conf.linha.cor} stroke={SUPERFICIE} strokeWidth="2" />}
          {pontos.map((p, i) => {
            const s = saldoDoMes.get(p.mes);
            const v = s ? numero(s.valor) : null;
            if (v === null) return null;
            return (
              <rect key={`saldo-${p.mes}`} x={xc(i) - 4.5} y={y1(v) - 4.5} width="9" height="9" transform={`rotate(45 ${xc(i)} ${y1(v)})`} fill={COR.tinta} stroke={SUPERFICIE} strokeWidth="2">
                <title>{`Saldo do extrato de ${dataLonga(s.data)}: ${moedaCheia(v)}`}</title>
              </rect>
            );
          })}

          <text x="0" y={topo2 - 14} fontSize="12" fontWeight="600" fill="#475569">{compacto ? "No mês" : conf.tituloBarras}</text>
          {e2.marcas.map((t) => (
            <g key={`g2-${t}`}>
              <line x1={esq} x2={L - dir} y1={y2(t)} y2={y2(t)} stroke={t === 0 ? EIXO : GRADE} strokeWidth="1" />
              <text x={esq - 8} y={y2(t)} fontSize="11" fill={TEXTO} textAnchor="end" dominantBaseline="middle">{moedaCurta(Math.abs(t))}</text>
            </g>
          ))}
          {pontos.map((p, i) => (
            <g key={`b-${p.mes}`}>
              {pilha(p, i, acima, 1)}
              {pilha(p, i, abaixo, -1)}
            </g>
          ))}

          {pontos.map((p, i) => {
            if (!rotulos.has(i)) return null;
            const fim = i === n - 1 && passo < 44;
            return (
              <text key={`x-${p.mes}`} x={fim ? L - dir : xc(i)} y={baseX + 18} fontSize="11" fill={TEXTO} textAnchor={fim ? "end" : "middle"}>{mesCurto(p.mes)}</text>
            );
          })}

          {idx >= 0 && (
            <g pointerEvents="none">
              <line x1={xc(idx)} x2={xc(idx)} y1={topo1 - 8} y2={baseX} stroke="#94a3b8" strokeWidth="1" />
              {numero(pontos[idx][conf.linha.chave]) !== null && (
                <circle cx={xc(idx)} cy={y1(numero(pontos[idx][conf.linha.chave]))} r="4.5" fill={conf.linha.cor} stroke={SUPERFICIE} strokeWidth="2" />
              )}
            </g>
          )}

          {/* A área de toque é o painel inteiro: o ponteiro procura o MÊS, não a linha de 2px. */}
          <rect
            x={esq}
            y={topo1 - 8}
            width={plotL}
            height={baseX - topo1 + 8}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onPointerMove={(e) => { const i = indiceDoPonteiro(e); if (i >= 0) setMesSobre(pontos[i].mes); }}
            onPointerLeave={() => setMesSobre(null)}
            onClick={(e) => { const i = indiceDoPonteiro(e); if (i >= 0) { setMesFixo(pontos[i].mes); setMesSobre(null); } }}
          />
        </svg>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600" aria-label="Legenda do gráfico">
        {legenda.map((s) => (
          <li key={s.chave} className="flex items-center gap-1.5">
            <Chave forma={s.forma} cor={s.cor} />
            {s.rotulo}
          </li>
        ))}
      </ul>
      {temEstorno && (
        <p className="text-xs text-slate-500">
          Há estorno (valor no sentido contrário) em algum mês. A barra desenha só o que entrou no sentido normal; a leitura do mês e
          a tabela mostram o valor líquido, com sinal.
        </p>
      )}

      <details className={clsx("rounded-xl border px-3.5 py-2.5 text-sm")} style={{ borderColor: "var(--hairline)" }}>
        <summary className="min-h-10 cursor-pointer py-2 font-medium text-slate-700">Ver os números do gráfico ({n} {n === 1 ? "mês" : "meses"})</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="patrimonial-tabela">
            <thead>
              <tr>
                <th scope="col">Mês</th>
                {[...conf.acima, ...conf.abaixo].map((s) => <th key={s.chave} scope="col">{s.rotulo}</th>)}
                <th scope="col">{conf.linha.rotulo}</th>
                {tipo === "aplicacoes" && <th scope="col">Saldo informado</th>}
                <th scope="col">Lançamentos</th>
              </tr>
            </thead>
            <tbody>
              {pontos.map((p) => {
                const s = saldoDoMes.get(p.mes);
                return (
                  <tr key={p.mes} className={dentroDoPeriodo(p.mes) ? "bg-slate-50" : undefined}>
                    <th scope="row">{mesCurto(p.mes)}</th>
                    {[...conf.acima, ...conf.abaixo].map((c) => <td key={c.chave}>{moedaCheia(numero(p[c.chave]) ?? 0)}</td>)}
                    <td>{numero(p[conf.linha.chave]) === null ? "-" : moedaCheia(p[conf.linha.chave])}</td>
                    {tipo === "aplicacoes" && <td>{s ? `${moedaCheia(s.valor)} (${dataLonga(s.data)})` : "-"}</td>}
                    <td>{p.registros}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
