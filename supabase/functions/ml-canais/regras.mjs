// Regras puras do Canais MinasLab (sem banco, sem rede): usadas pela Edge
// Function ml-canais e testadas em src/lib/canais.test.mjs.
//
// O que sai do RH é o MÍNIMO para a comemoração e o aviso de férias:
// nome (ou apelido), dia e mês do aniversário (nunca o ano, nunca a idade) e o
// período de férias. Nada da ficha além disso.

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const pad = (n) => String(n).padStart(2, "0");

export const ehBissexto = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

/** "AAAA-MM-DD" de hoje no fuso de Brasília. */
export function hojeSP(agora = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return p.slice(0, 10);
}

export function somarDias(iso, n) {
  const [a, m, d] = iso.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

/** Está na casa? (mesma regra do RH: ativo !== false e sem desligadoEm) */
export const naCasa = (p) => !!p && p.ativo !== false && !String(p.desligadoEm ?? "").trim();

export const nomeCurto = (p) => String(p?.apelido || p?.nome || "").trim();

/** Dia e mês do aniversário no ano pedido (29/02 cai em 28/02 nos anos comuns). */
export function aniversarioNoAno(dataNascimento, ano) {
  const m = ISO.exec(String(dataNascimento ?? ""));
  if (!m) return null;
  let mes = Number(m[2]), dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  if (mes === 2 && dia === 29 && !ehBissexto(ano)) dia = 28;
  return { dia, mes, data: `${ano}-${pad(mes)}-${pad(dia)}` };
}

/**
 * pessoas: [{ id, nome, apelido, dataNascimento, ativo, desligadoEm }]
 * Devolve só { pessoaId, nome, dia, mes } de quem está na casa e não pediu para ficar de fora.
 */
export function aniversariantesDoMes(pessoas, ano, mes, ocultos = []) {
  return (pessoas || [])
    .filter((p) => naCasa(p) && !ocultos.includes(p.id) && nomeCurto(p))
    .map((p) => ({ p, a: aniversarioNoAno(p.dataNascimento, ano) }))
    .filter(({ a }) => a && a.mes === mes)
    .map(({ p, a }) => ({ pessoaId: p.id, nome: nomeCurto(p), dia: a.dia, mes: a.mes }))
    .sort((x, y) => x.dia - y.dia || x.nome.localeCompare(y.nome, "pt-BR"));
}

export const refAniversario = (ano, pessoaId) => `aniv-${ano}-${pessoaId}`;
export const ehRefAniversario = (ref) => /^aniv-\d{4}-[\w.-]{1,80}$/.test(String(ref ?? ""));

/**
 * Posts automáticos de parabéns: de hoje e dos últimos `dias` dias (para
 * a conversa continuar no dia seguinte). Calculados na hora; não ficam no banco.
 */
export function parabensRecentes(pessoas, hoje, { dias = 7, ocultos = [] } = {}) {
  const out = [];
  for (let i = 0; i < dias; i++) {
    const dia = somarDias(hoje, -i);
    const ano = Number(dia.slice(0, 4));
    for (const p of pessoas || []) {
      if (!naCasa(p) || ocultos.includes(p.id) || !nomeCurto(p)) continue;
      const a = aniversarioNoAno(p.dataNascimento, ano);
      if (!a || a.data !== dia) continue;
      const nome = nomeCurto(p);
      out.push({
        id: refAniversario(ano, p.id),
        tipo: "aniversario",
        titulo: `Feliz aniversário, ${nome}! 🎂`,
        texto: `Hoje é dia de comemorar! A família MinasLab deseja a você, ${nome}, um novo ano cheio de saúde, alegria e conquistas. Deixe aqui o seu recado de parabéns 🎉`,
        pessoaId: p.id,
        nome,
        dia: a.dia,
        mes: a.mes,
        hoje: i === 0,
        criado_em: `${dia}T08:00:00-03:00`,
        automatico: true,
      });
    }
  }
  return out;
}

const dataDe = (v) => { const m = ISO.exec(String(v ?? "")); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

/**
 * Informativo de férias: quem está de férias hoje e quem sai nos próximos
 * `janela` dias. Só nome e período.
 * ferias: [{ pessoaId, inicio, retorno, status }]
 */
export function informativoFerias(ferias, pessoas, hoje, janela = 30) {
  const porId = new Map((pessoas || []).map((p) => [p.id, p]));
  const limite = somarDias(hoje, janela);
  return (ferias || [])
    .filter((f) => f && f.status !== "cancelada" && f.status !== "concluida")
    .map((f) => ({ f, p: porId.get(f.pessoaId), inicio: dataDe(f.inicio), retorno: dataDe(f.retorno) }))
    .filter(({ p, inicio, retorno }) => naCasa(p) && nomeCurto(p) && inicio && retorno && retorno > hoje && inicio <= limite)
    .map(({ p, inicio, retorno }) => ({ nome: nomeCurto(p), inicio, retorno, emCurso: inicio <= hoje }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export const TIPOS = ["noticia", "comunicado", "evento"];

/** Confere e limpa o que vem da tela para um post. Devolve { ok, erro, post }. */
export function validarPost(b) {
  const tipo = TIPOS.includes(b?.tipo) ? b.tipo : "noticia";
  const titulo = String(b?.titulo ?? "").trim().slice(0, 160);
  const texto = String(b?.texto ?? "").trim().slice(0, 6000);
  let imagem = String(b?.imagem ?? "").trim();
  if (!titulo) return { ok: false, erro: "Dê um título para a publicação." };
  if (imagem && !/^https:\/\/[^\s"'<>]+$/i.test(imagem)) return { ok: false, erro: "O link da imagem precisa começar com https://" };
  imagem = imagem.slice(0, 1000);
  return { ok: true, post: { tipo, titulo, texto, imagem, fixado: !!b?.fixado } };
}

export function validarComentario(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return { ok: false, erro: "Escreva o comentário." };
  if (t.length > 1000) return { ok: false, erro: "Comentário muito longo (até 1000 caracteres)." };
  return { ok: true, texto: t };
}
