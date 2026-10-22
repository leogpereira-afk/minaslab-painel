// Formatação das mensagens (Mensagens do painel). O texto é guardado simples,
// com marcações parecidas com as do WhatsApp, e a tela mostra formatado:
//   *negrito*   _itálico_   __sublinhado__   ~riscado~
//   [texto do link](https://endereco)   ou o endereço solto (https://… / www.…)
//   @usuario  → marca a pessoa (o login dela); em grupo, @todos marca todo mundo
// Nada de HTML: a tela monta os elementos, então texto colado não vira código.

const MENCAO_TODOS = "todos";

// Ordem de preferência quando dois padrões começam no mesmo lugar.
const PADROES = [
  { tipo: "link", re: /\[([^\]\n]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/ },
  { tipo: "url", re: /(?:https?:\/\/|www\.)[^\s<]*[^\s<.,;:!?)\]'"]/ },
  { tipo: "mencao", re: /(^|[\s(])@([a-z0-9][a-z0-9._-]{0,39})/i },
  { tipo: "u", re: /__(?=\S)([^\n]*?\S)__/ },
  { tipo: "b", re: /\*(?=\S)([^*\n]*?\S)\*/ },
  { tipo: "i", re: /(^|[^\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/u },
  { tipo: "s", re: /~(?=\S)([^~\n]*?\S)~/ },
];

const hrefDe = (u) => (/^www\./i.test(u) ? `https://${u}` : u);

/**
 * Lê o texto e devolve a árvore: [{ t: "texto", v } | { t: "b"|"i"|"u"|"s", filhos }
 * | { t: "link", href, filhos } | { t: "mencao", usuario } | { t: "quebra" }].
 * `ehUsuario(login)` diz se o @ é de alguém que existe (senão fica como texto: e-mail, @ solto…).
 */
export function lerTextoRico(texto, ehUsuario = () => true, { semLinks = false } = {}) {
  const out = [];
  String(texto ?? "").split("\n").forEach((linha, i) => {
    if (i) out.push({ t: "quebra" });
    out.push(...lerLinha(linha, ehUsuario, semLinks));
  });
  return juntarTextos(out);
}

function lerLinha(s, ehUsuario, semLinks) {
  const out = [];
  let resto = s;
  while (resto) {
    let melhor = null;
    for (const p of PADROES) {
      if (semLinks && (p.tipo === "link" || p.tipo === "url")) continue;
      const m = buscar(p, resto, ehUsuario);
      if (m && (!melhor || m.inicio < melhor.inicio)) melhor = m;
    }
    if (!melhor) { out.push({ t: "texto", v: resto }); break; }
    if (melhor.inicio) out.push({ t: "texto", v: resto.slice(0, melhor.inicio) });
    out.push(melhor.no(semLinks));
    resto = resto.slice(melhor.fim);
  }
  return out;
}

// Acha a primeira ocorrência válida do padrão (pula @ de quem não existe).
function buscar(p, s, ehUsuario) {
  let desloc = 0;
  while (desloc < s.length) {
    const m = p.re.exec(s.slice(desloc));
    if (!m) return null;
    const ini = desloc + m.index;
    if (p.tipo === "mencao") {
      const usuario = m[2].toLowerCase().replace(/[._-]+$/, "");
      const inicio = ini + m[1].length;
      if (usuario && (usuario === MENCAO_TODOS || ehUsuario(usuario))) {
        return { inicio, fim: inicio + 1 + usuario.length, no: () => ({ t: "mencao", usuario }) };
      }
      desloc = inicio + 1;
      continue;
    }
    if (p.tipo === "i") {
      const inicio = ini + m[1].length;
      return { inicio, fim: ini + m[0].length, no: (sl) => ({ t: "i", filhos: lerLinha(m[2], ehUsuario, sl) }) };
    }
    if (p.tipo === "link") return { inicio: ini, fim: ini + m[0].length, no: () => ({ t: "link", href: hrefDe(m[2]), filhos: lerLinha(m[1], () => false, true) }) };
    if (p.tipo === "url") return { inicio: ini, fim: ini + m[0].length, no: () => ({ t: "link", href: hrefDe(m[0]), filhos: [{ t: "texto", v: m[0] }] }) };
    return { inicio: ini, fim: ini + m[0].length, no: (sl) => ({ t: p.tipo, filhos: lerLinha(m[1], ehUsuario, sl) }) };
  }
  return null;
}

function juntarTextos(nos) {
  const out = [];
  for (const n of nos) {
    const ult = out[out.length - 1];
    if (n.t === "texto" && ult?.t === "texto") ult.v += n.v; else out.push(n);
  }
  return out;
}

/** Texto sem as marcações, para a prévia na lista de conversas e no aviso do navegador. */
export function textoSimples(texto, nomeDe = (u) => u) {
  const plano = (nos) => nos.map((n) => {
    if (n.t === "texto") return n.v;
    if (n.t === "quebra") return " ";
    if (n.t === "mencao") return `@${n.usuario === MENCAO_TODOS ? "todos" : String(nomeDe(n.usuario) || n.usuario).split(" ")[0]}`;
    return plano(n.filhos || []);
  }).join("");
  return plano(lerTextoRico(texto));
}

/** A mensagem marca esta pessoa (ou @todos)? */
export function mencionaUsuario(texto, usuario, ehUsuario = () => true) {
  if (!usuario || !String(texto || "").includes("@")) return false;
  const alvo = String(usuario).toLowerCase();
  const achar = (nos) => nos.some((n) => (n.t === "mencao" && (n.usuario === alvo || n.usuario === MENCAO_TODOS)) || (n.filhos && achar(n.filhos)));
  return achar(lerTextoRico(texto, ehUsuario));
}

/** A mensagem tem alguma formatação (para mostrar a prévia enquanto a pessoa escreve)? */
export function temFormatacao(texto, ehUsuario = () => true) {
  return lerTextoRico(texto, ehUsuario).some((n) => !["texto", "quebra"].includes(n.t));
}

/* ---------------------------------------------------------- edição
   Botões de formatação: envolvem o trecho selecionado com as marcações
   (ou deixam o cursor entre elas, se nada estiver selecionado). */
export const MARCAS = { b: "*", i: "_", u: "__", s: "~" };

export function envolver(texto, ini, fim, marca) {
  const t = String(texto ?? "");
  let a = Math.max(0, Math.min(ini ?? t.length, t.length)), z = Math.max(a, Math.min(fim ?? a, t.length));
  // Marcação não pode começar/terminar em espaço: tira os espaços da ponta da seleção.
  while (a < z && /\s/.test(t[a])) a += 1;
  while (z > a && /\s/.test(t[z - 1])) z -= 1;
  const sel = t.slice(a, z);
  // Já formatado com a mesma marca? Tira (botão liga/desliga).
  if (sel && t.slice(a - marca.length, a) === marca && t.slice(z, z + marca.length) === marca) {
    const novo = t.slice(0, a - marca.length) + sel + t.slice(z + marca.length);
    return { texto: novo, ini: a - marca.length, fim: z - marca.length };
  }
  const novo = t.slice(0, a) + marca + sel + marca + t.slice(z);
  return { texto: novo, ini: a + marca.length, fim: z + marca.length };
}

export function inserirLink(texto, ini, fim, endereco) {
  const t = String(texto ?? "");
  const url = String(endereco ?? "").trim();
  const a = Math.max(0, Math.min(ini ?? t.length, t.length)), z = Math.max(a, Math.min(fim ?? a, t.length));
  const rotulo = t.slice(a, z).trim();
  const trecho = rotulo && rotulo !== url ? `[${rotulo.replace(/[[\]]/g, "")}](${url})` : url;
  const novo = t.slice(0, a) + trecho + t.slice(z);
  return { texto: novo, cursor: a + trecho.length };
}

export const enderecoValido = (u) => /^(https?:\/\/|www\.)[^\s]+\.[^\s]+$/i.test(String(u ?? "").trim()) || /^https?:\/\/[^\s]+$/i.test(String(u ?? "").trim());

/* ---------------------------------------------------------- marcar (@)
   Enquanto a pessoa digita "@jo", sugere quem combina. */
export function mencaoEmDigitacao(texto, cursor) {
  const antes = String(texto ?? "").slice(0, cursor ?? 0);
  const m = antes.match(/(^|[\s(])@([\p{L}\p{N}._-]{0,40})$/u);
  return m ? { inicio: antes.length - m[2].length - 1, busca: m[2] } : null;
}

export function completarMencao(texto, inicio, cursor, usuario) {
  const t = String(texto ?? "");
  const trecho = `@${usuario} `;
  const novo = t.slice(0, inicio) + trecho + t.slice(cursor).replace(/^ /, "");
  return { texto: novo, cursor: inicio + trecho.length };
}

const semAcento = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
/** Quem aparece na lista do @: busca no nome e no login, sem acento. */
export function sugestoesMencao(pessoas, busca, { grupo = false } = {}) {
  const q = semAcento(busca);
  const lista = (pessoas || []).filter((p) => !q || semAcento(p.nome).split(/\s+/).some((n) => n.startsWith(q)) || semAcento(p.nome).includes(q) || semAcento(p.usuario).startsWith(q));
  const todos = grupo && (!q || "todos".startsWith(q)) ? [{ usuario: MENCAO_TODOS, nome: "Todos do grupo", todos: true }] : [];
  return [...todos, ...lista].slice(0, 8);
}
