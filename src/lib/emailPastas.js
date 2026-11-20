// Árvore de pastas do E-mail (como no webmail): as pastas do usuário viram uma árvore pelo
// separador do IMAP ("." na Hostinger, "/" no Gmail), com setinha para abrir/fechar as que têm
// subpastas. As pastas do sistema (Entrada, Enviados…) continuam no topo, sem mudança.
//
// Entrada: a lista de lerPastas() (já ordenada: sistema primeiro). Saída: lista "achatada" na
// ordem da tela, cada item com { chave, nome, nivel, pai, temFilhos, naoLidasTotal, virtual }.
// "virtual" = pasta-mãe que não dá para abrir (\Noselect no IMAP) — só agrupa as filhas.

export function arvoreDePastas(pastas = []) {
  const sistema = pastas.filter((p) => p.tipo);
  const suas = pastas.filter((p) => !p.tipo);
  const nos = new Map(); // chave (caminho com "/") → nó

  const no = (partes) => {
    const chave = partes.join("/");
    if (!nos.has(chave)) {
      nos.set(chave, { chave, nome: partes[partes.length - 1], partes, pasta: null, filhos: [] });
      if (partes.length > 1) no(partes.slice(0, -1)).filhos.push(nos.get(chave));
    }
    return nos.get(chave);
  };
  for (const p of suas) {
    const partes = (p.delim ? p.rotulo.split(p.delim) : [p.rotulo]).filter((x) => x !== "");
    no(partes.length ? partes : [p.rotulo]).pasta = p;
  }

  // Mãe que é pasta do sistema (ex.: INBOX.Sent.2024) → aponta para a pasta do sistema.
  const sistemaPorNome = new Map();
  for (const p of sistema) {
    const nome = String(p.id).replace(/^INBOX[./]/i, "").replace(/^\[(Gmail|Google Mail)\][./]/i, "");
    sistemaPorNome.set(nome.split(p.delim || "\u0000").join("/").toLowerCase(), p);
  }

  const ordenar = (lista) => lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  const saida = [];
  const somar = (n) => n.filhos.reduce((s, f) => s + somar(f), n.pasta?.naoLidas || 0);
  const descer = (n, nivel, pai) => {
    const doSistema = !n.pasta ? sistemaPorNome.get(n.chave.toLowerCase()) : null;
    const base = n.pasta || doSistema || { id: null, rotulo: n.nome, tipo: null, delim: "" };
    saida.push({
      ...base,
      tipo: null, // na árvore todas usam o ícone de pasta
      chave: n.chave,
      nome: doSistema ? doSistema.rotulo : n.nome,
      caminho: n.partes.join(" › "),
      nivel,
      pai,
      temFilhos: n.filhos.length > 0,
      naoLidasTotal: somar(n),
      virtual: !n.pasta && !doSistema,
    });
    for (const f of ordenar(n.filhos)) descer(f, nivel + 1, n.chave);
  };
  for (const raiz of ordenar([...nos.values()].filter((n) => n.partes.length === 1))) descer(raiz, 0, null);

  return { sistema, arvore: saida };
}

// Some da tela quem tem algum ancestral fechado.
export function pastasVisiveis(arvore, abertas) {
  const fechada = new Set();
  return arvore.filter((p) => {
    if (p.pai && (fechada.has(p.pai) || !abertas.has(p.pai))) { fechada.add(p.chave); return false; }
    return true;
  });
}

// Chaves de todos os ancestrais de uma pasta (para abrir o caminho até a pasta atual).
export function ancestrais(arvore, id) {
  const porChave = new Map(arvore.map((p) => [p.chave, p]));
  let atual = arvore.find((p) => p.id === id);
  const lista = [];
  while (atual?.pai) { lista.push(atual.pai); atual = porChave.get(atual.pai); }
  return lista;
}
