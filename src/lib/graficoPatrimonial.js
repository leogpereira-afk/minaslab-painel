// A matemática do gráfico de evolução e dos atalhos de período de Aplicações e
// Sócios, fora do React para ter teste. A tela só desenha o que sai daqui.
import { MESES, MESES_LONGOS } from "./format.js";

// "2026-03" vira "mar/26" no eixo e "março de 2026" na leitura do mês.
export function mesCurto(mes) {
  const [a, m] = String(mes ?? "").split("-");
  const nome = MESES[Number(m) - 1];
  return nome && a ? `${nome}/${a.slice(2)}` : String(mes ?? "");
}
export function mesLongo(mes) {
  const [a, m] = String(mes ?? "").split("-");
  const nome = MESES_LONGOS[Number(m) - 1];
  return nome && a ? `${nome} de ${a}` : String(mes ?? "");
}

// Valor abreviado para eixo e cartão estreito: "R$ 150 mil", "R$ 1,2 mi". O
// número exato fica na leitura do mês e na tabela, nunca só aqui.
export function moedaCurta(v) {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  const sinal = n < 0 && Math.round(abs * 100) > 0 ? "-" : ""; // -0,001 não vira "-R$ 0"
  if (abs >= 1e6) return `${sinal}R$ ${(abs / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e3) return `${sinal}R$ ${(abs / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: abs >= 1e4 ? 0 : 1 })} mil`;
  // Abaixo de mil com centavos (marcas de R$ 0,50 num eixo pequeno): arredondar para o
  // real inteiro escreveria "R$ 1" em duas marcas diferentes.
  if (!Number.isInteger(Math.round(abs * 100) / 100)) return `${sinal}R$ ${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${sinal}R$ ${Math.round(abs).toLocaleString("pt-BR")}`;
}

/* Eixo com marcas redondas (0, 50 mil, 100 mil...) que cobre min e max e sempre
   passa pelo zero: é a linha de base das barras. Cerca de `alvo` intervalos. */
export function escalaEixo(min, max, alvo = 3) {
  let a = Math.min(0, Number(min)), b = Math.max(0, Number(max));
  if (!Number.isFinite(a) || !Number.isFinite(b)) { a = 0; b = 1; }
  if (a === b) b = a + 1;
  const bruto = (b - a) / alvo;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  // Nunca menos de um centavo por marca: abaixo disso o arredondamento repetia marcas.
  const passo = Math.max(0.01, [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => p >= bruto * (1 - 1e-9)));
  // "+ 0" desfaz o -0 (Math.ceil de um negativo mínimo), que o Intl escreveria "-R$ 0".
  const ini = Math.floor(a / passo + 1e-9) * passo + 0;
  const fim = Math.ceil(b / passo - 1e-9) * passo + 0;
  const marcas = [];
  for (let i = 0; ini + i * passo <= fim + passo / 2; i++) marcas.push(Math.round((ini + i * passo) * 100) / 100 + 0);
  return { min: ini, max: fim, marcas };
}

/* Barra com a ponta de dados arredondada (4px) e a base reta, crescendo para
   cima ou para baixo a partir de `yBase`. Menos de meio pixel não vira barra:
   devolve null, e a tela não desenha nada (o valor continua na tabela). */
export function caminhoBarra(x, largura, yBase, yPonta, arredondar = true) {
  const altura = Math.abs(yPonta - yBase);
  if (!(altura >= 0.5) || !(largura > 0)) return null;
  const r = arredondar ? Math.min(4, largura / 2, altura) : 0;
  const f = (n) => Math.round(n * 100) / 100;
  const sobe = yPonta < yBase;
  const canto = sobe ? yPonta + r : yPonta - r;
  return `M${f(x)},${f(yBase)} V${f(canto)} Q${f(x)},${f(yPonta)} ${f(x + r)},${f(yPonta)} H${f(x + largura - r)} Q${f(x + largura)},${f(yPonta)} ${f(x + largura)},${f(canto)} V${f(yBase)} Z`;
}

/* Quais meses ganham rótulo no eixo sem se atropelar: pelo menos `minimo` px
   entre dois rótulos, contando de trás para frente para o mês mais recente
   sempre ter o seu. */
export function indicesDeRotulo(n, passo, minimo = 46) {
  const saida = new Set();
  if (!(n > 0)) return saida;
  const k = Math.max(1, Math.ceil(minimo / Math.max(passo, 1)));
  for (let i = n - 1; i >= 0; i -= k) saida.add(i);
  return saida;
}

const dois = (n) => String(n).padStart(2, "0");

/* Os atalhos de período. `hoje` é "AAAA-MM-DD" do dia local; `inicio` é o
   primeiro dia com movimento na base (o "Tudo"). Sem início conhecido, o atalho
   "Tudo" não aparece: não se inventa uma data. */
export function periodosRapidos(hoje, inicio) {
  const [a, m] = String(hoje).split("-").map(Number);
  if (!a || !m) return [];
  const [aAnt, mAnt] = m === 1 ? [a - 1, 12] : [a, m - 1];
  const ultimoAnt = new Date(aAnt, mAnt, 0).getDate();
  const doze = new Date(a, m - 12, 1);
  const lista = [
    { valor: "mes", rotulo: "Este mês", de: `${a}-${dois(m)}-01`, ate: hoje },
    { valor: "mes-anterior", rotulo: "Mês passado", de: `${aAnt}-${dois(mAnt)}-01`, ate: `${aAnt}-${dois(mAnt)}-${dois(ultimoAnt)}` },
    { valor: "ano", rotulo: "Ano até hoje", de: `${a}-01-01`, ate: hoje },
    { valor: "12m", rotulo: "12 meses", de: `${doze.getFullYear()}-${dois(doze.getMonth() + 1)}-01`, ate: hoje },
  ];
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(inicio || "")) && inicio <= hoje) lista.push({ valor: "tudo", rotulo: "Tudo", de: inicio, ate: hoje });
  return lista;
}
export const periodoAtivo = (lista, de, ate) => (lista || []).find((p) => p.de === de && p.ate === ate)?.valor ?? "";

/* Somas do histórico inteiro para os cartões "hoje". Recebe a `evolucao` de
   montarPatrimonial (histórico completo do recorte, sem o período). Sem mês
   nenhum, tudo sai null: não se afirma zero sobre um histórico que não existe. */
export function somasDoHistorico(tipo, evolucao, meses = 12) {
  const lista = Array.isArray(evolucao) ? evolucao : [];
  if (!lista.length) return null;
  const soma = (campo, itens = lista) => Math.round(itens.reduce((t, e) => t + Math.round((Number(e[campo]) || 0) * 100), 0)) / 100;
  const registros = lista.reduce((t, e) => t + (Number(e.registros) || 0), 0);
  const ultimos = lista.slice(-meses);
  if (tipo === "aplicacoes") {
    return { aportes: soma("aportes"), resgates: soma("resgates"), rendimentos: soma("rendimentos"), impostos: soma("impostos"), registros, desde: lista[0].mes };
  }
  const saidasRecentes = soma("saidas", ultimos);
  return {
    saidas: soma("saidas"),
    entradas: soma("entradas"),
    liquido: lista[lista.length - 1].acumulado ?? null,
    registros,
    desde: lista[0].mes,
    mediaSaidas: Math.round((saidasRecentes / ultimos.length) * 100) / 100,
    mesesDaMedia: ultimos.length,
  };
}
