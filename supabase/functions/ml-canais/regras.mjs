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

/* Nome para o mural: primeiro e último nome, sem caixa alta ("ANA CLAUDIA
   GONÇALVES PESSOA" → "Ana Pessoa"). Mesma regra de src/lib/nomes.js. */
const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du"]);
const capitalizar = (w) => w.toLocaleLowerCase("pt-BR").replace(/(^|[-'])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase("pt-BR"));
export function primeiroEUltimo(nome) {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  const uteis = partes.filter((w) => !PARTICULAS.has(w.toLocaleLowerCase("pt-BR")));
  return (uteis.length >= 2 ? [uteis[0], uteis[uteis.length - 1]] : [partes[0]]).map(capitalizar).join(" ");
}
export const nomeCurto = (p) => primeiroEUltimo(p?.nome || p?.apelido);

/* Ficha duplicada no RH (mesma pessoa cadastrada duas vezes) não pode virar
   dois parabéns: fica uma por nome + data de nascimento. */
const chaveNome = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
export function semDuplicadas(pessoas) {
  const vistos = new Set();
  return (pessoas || []).filter((p) => {
    const k = `${chaveNome(p?.nome)}|${String(p?.dataNascimento ?? "").slice(5, 10)}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

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
  return semDuplicadas((pessoas || []).filter((p) => naCasa(p) && !ocultos.includes(p.id) && nomeCurto(p)))
    .map((p) => ({ p, a: aniversarioNoAno(p.dataNascimento, ano) }))
    .filter(({ a }) => a && a.mes === mes)
    .map(({ p, a }) => ({ pessoaId: p.id, nome: nomeCurto(p), dia: a.dia, mes: a.mes, foto: fotoValida(p.foto) }))
    .sort((x, y) => x.dia - y.dia || x.nome.localeCompare(y.nome, "pt-BR"));
}

/* Foto do colaborador (ficha do RH ou Gestão › Fotos): só imagem embutida, nunca link externo. */
export const fotoValida = (f) => (typeof f === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(f) && f.length < 400000 ? f : "");

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
    for (const p of semDuplicadas((pessoas || []).filter((x) => naCasa(x) && !ocultos.includes(x.id) && nomeCurto(x)))) {
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
        foto: fotoValida(p.foto),
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

/* Foto anexada: fica no bucket privado ml-arquivos, pasta canais/; o post guarda só o caminho. */
export const ehFotoGuardada = (v) => /^canais\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(String(v ?? ""));
const TIPOS_FOTO = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_FOTO_BYTES = 4 * 1024 * 1024;
/** Lê a foto enviada pela tela (data URL). Devolve { ok, erro, ext, mime, base64 }. */
export function lerFoto(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ""));
  if (!m) return { ok: false, erro: "A foto precisa ser JPG, PNG ou WEBP." };
  if (Math.floor(m[2].length * 3 / 4) > MAX_FOTO_BYTES) return { ok: false, erro: "Foto grande demais (até 4 MB)." };
  return { ok: true, mime: m[1], ext: TIPOS_FOTO[m[1]], base64: m[2] };
}

/** Confere e limpa o que vem da tela para um post. Devolve { ok, erro, post }. */
export function validarPost(b) {
  const tipo = TIPOS.includes(b?.tipo) ? b.tipo : "noticia";
  const titulo = String(b?.titulo ?? "").trim().slice(0, 160);
  const texto = String(b?.texto ?? "").trim().slice(0, 6000);
  let imagem = String(b?.imagem ?? "").trim();
  if (!titulo) return { ok: false, erro: "Dê um título para a publicação." };
  if (imagem && !/^https:\/\/[^\s"'<>]+$/i.test(imagem) && !ehFotoGuardada(imagem)) return { ok: false, erro: "O link da imagem precisa começar com https://" };
  imagem = imagem.slice(0, 1000);
  return { ok: true, post: { tipo, titulo, texto, imagem, fixado: !!b?.fixado, visual: validarVisual(b?.visual) } };
}

/* Visual do cartão no mural (estilo + cor da paleta). Valores fora da lista viram automático. */
export const ESTILOS_POST = ["auto", "simples", "capa", "citacao", "aviso", "evento", "numero"];
export const CORES_POST = ["auto", "amarelo", "verde", "vermelho", "laranja", "azul", "roxo"];
export function validarVisual(v) {
  const estilo = ESTILOS_POST.includes(v?.estilo) ? v.estilo : "auto";
  const cor = CORES_POST.includes(v?.cor) ? v.cor : "auto";
  const destaque = String(v?.destaque ?? "").trim().slice(0, 40);
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(v?.data ?? "")) ? v.data : "";
  const out = {};
  if (estilo !== "auto") out.estilo = estilo;
  if (cor !== "auto") out.cor = cor;
  if (destaque) out.destaque = destaque;
  if (data) out.data = data;
  return out;
}

export function validarComentario(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return { ok: false, erro: "Escreva o comentário." };
  if (t.length > 1000) return { ok: false, erro: "Comentário muito longo (até 1000 caracteres)." };
  return { ok: true, texto: t };
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
export const normNome = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

/**
 * Destaque do mês (funcionário do mês) que a gestão escolhe para o Canais.
 * itens: até 4 qualidades "Rótulo: texto". fotoId: id da foto em Gestão › Destaque do mês › Fotos.
 */
export function validarDestaque(b) {
  if (!b || b.limpar) return { ok: true, destaque: null };
  const nome = String(b.nome ?? "").trim().slice(0, 120);
  const mes = String(b.mes ?? "").trim();
  if (!nome) return { ok: false, erro: "Escolha quem é o destaque." };
  if (!MES.test(mes)) return { ok: false, erro: "Escolha o mês do destaque." };
  const itens = (Array.isArray(b.itens) ? b.itens : String(b.itens ?? "").split("\n"))
    .map((l) => (typeof l === "string" ? l : `${l?.rotulo ?? ""}: ${l?.texto ?? ""}`))
    .map((l) => String(l).trim()).filter(Boolean).slice(0, 4)
    .map((l) => { const i = l.indexOf(":"); return i > 0 ? { rotulo: l.slice(0, i).trim().slice(0, 40), texto: l.slice(i + 1).trim().slice(0, 140) } : { rotulo: "", texto: l.slice(0, 140) }; });
  const fotoId = String(b.fotoId ?? "").trim().slice(0, 80);
  return { ok: true, destaque: { nome, mes, itens, fotoId } };
}
