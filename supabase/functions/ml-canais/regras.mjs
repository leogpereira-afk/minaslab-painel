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

/* ------------------------------------------------------------------ canais por setor
   Além do mural geral (canal_id nulo), cada setor pode ter o seu canal.
   publicacao: "responsaveis" (mural de avisos) | "todos" (qualquer membro publica)
   visibilidade: "setor" (só membros veem) | "empresa" (todos leem, só membros interagem)
   A direção vê e administra todos os canais. */
export const PUBLICACAO = ["responsaveis", "todos"];
export const VISIBILIDADE = ["setor", "empresa"];

/** Quem está no canal: responsáveis e membros, sem repetir. */
export const pessoasDoCanal = (canal) => [...new Set([...(canal?.responsaveis || []), ...(canal?.membros || [])])];

/** O que `eu` pode fazer no canal. `direcao` = papel "direcao" do painel. */
export function papelNoCanal(canal, eu, direcao = false) {
  const responsavel = !!eu && (canal?.responsaveis || []).includes(eu);
  const membro = responsavel || (!!eu && (canal?.membros || []).includes(eu));
  const gerir = !!direcao || responsavel;
  return {
    responsavel,
    membro,
    ver: !!direcao || membro || canal?.visibilidade === "empresa",
    interagir: !!direcao || membro, // curtir, comentar, confirmar leitura
    publicar: gerir || (membro && canal?.publicacao === "todos"),
    moderar: gerir, // fixar, editar e apagar qualquer publicação ou comentário
    editarCanal: gerir,
    trocarResponsaveis: !!direcao,
    apagarCanal: !!direcao,
  };
}

/** Pode editar/apagar esta publicação? Quem modera, ou o próprio autor se ainda pode publicar no canal. */
export const podeMexerNoPost = (papel, post, eu) => !!papel?.moderar || (!!papel?.publicar && post?.autor === eu);

/**
 * Confere e limpa o canal vindo da tela. `contas`: usuários ativos do painel
 * (Set ou lista). Responsáveis também contam como membros; ninguém aparece duas vezes.
 */
export function validarCanal(b, contas) {
  const ativas = contas instanceof Set ? contas : new Set(contas || []);
  const nome = String(b?.nome ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!nome) return { ok: false, erro: "Dê um nome para o canal." };
  const descricao = String(b?.descricao ?? "").trim().slice(0, 300);
  const lista = (x) => (Array.isArray(x) ? [...new Set(x.map((u) => String(u ?? "").trim()).filter((u) => ativas.has(u)))].slice(0, 200) : []);
  const responsaveis = lista(b?.responsaveis);
  if (!responsaveis.length) return { ok: false, erro: "Escolha pelo menos um responsável." };
  const membros = lista(b?.membros).filter((u) => !responsaveis.includes(u));
  const publicacao = PUBLICACAO.includes(b?.publicacao) ? b.publicacao : "responsaveis";
  const visibilidade = VISIBILIDADE.includes(b?.visibilidade) ? b.visibilidade : "setor";
  return { ok: true, canal: { nome, descricao, responsaveis, membros, publicacao, visibilidade } };
}

/**
 * Confirmação de leitura de um aviso: quem precisa ler são as pessoas do canal,
 * menos o autor. `leituras`: [{ usuario, nome }]. Lista de quem leu/falta só para quem modera.
 */
export function resumoLeitura(post, canal, leituras, eu, { moderar = false, nomes = new Map() } = {}) {
  const precisam = pessoasDoCanal(canal).filter((u) => u !== post?.autor);
  const leram = new Set((leituras || []).map((l) => l.usuario));
  const lidos = precisam.filter((u) => leram.has(u));
  const out = { total: precisam.length, lidos: lidos.length, li: leram.has(eu), precisoLer: precisam.includes(eu) && !leram.has(eu) };
  if (moderar) {
    out.quemLeu = lidos.map((u) => nomes.get(u) || u);
    out.faltam = precisam.filter((u) => !leram.has(u)).map((u) => nomes.get(u) || u);
  }
  return out;
}

/* Publicação do Destaque do mês no mural (botão "Salvar e postar no mural").
   Com foto, a foto é a arte; sem foto, capa amarela. */
const MESES_NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function postDoDestaque(d, temFoto = false) {
  const nome = primeiroEUltimo(d?.nome) || String(d?.nome ?? "").trim();
  const mes = MESES_NOME[Number(String(d?.mes ?? "").slice(5, 7)) - 1] || "";
  const linhas = (d?.itens || []).map((i) => `• ${i.rotulo ? `${i.rotulo}: ` : ""}${i.texto}`);
  const texto = [`Parabéns, ${nome}! Você é o destaque${mes ? ` de ${mes}` : " do mês"} da MinasLab. Obrigado pela dedicação!`, linhas.length ? linhas.join("\n") : "", "Deixe aqui o seu recado de parabéns!"].filter(Boolean).join("\n\n");
  return {
    tipo: "noticia",
    titulo: `Destaque do mês${mes ? ` de ${mes}` : ""}: ${nome}`.slice(0, 160),
    texto,
    fixado: false,
    visual: temFoto ? { cor: "amarelo" } : { estilo: "capa", cor: "amarelo", destaque: "Destaque do mês" },
  };
}
