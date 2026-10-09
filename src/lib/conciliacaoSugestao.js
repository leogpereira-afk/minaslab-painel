// Sugestões de conciliação (manual da M Lab): para cada movimento pendente do banco, os títulos mais prováveis.
// Pontua pelo número da NF na descrição, pelo valor, pelo nome do cliente e pela data. Quem decide é sempre a pessoa:
// aqui só se calcula e se ordena.
const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
const centavos = (v) => Math.round(Number(v || 0) * 100);
const DIA = 86400000;

// "NF 130", "NF130", "DOC. NF 122 FAT. 16691011", "NF: 74/2026"
export function numerosNF(descricao = "") {
  const achados = new Set();
  const re = /\bNF[\s.:-]*(?:N[ºo°.]*\s*)?(\d{1,9})/gi;
  let m;
  while ((m = re.exec(String(descricao)))) achados.add(String(Number(m[1])));
  return [...achados];
}

const PALAVRAS_FRACAS = new Set(["ltda", "me", "eireli", "epp", "sa", "de", "da", "do", "dos", "das", "e", "condominio", "edificio", "residencial", "pix", "recebido", "boleto", "transf", "enviada", "ref", "liq", "comp", "externo", "doc", "fat"]);
const palavras = (txt) => semAcento(txt).split(/[^a-z0-9]+/).filter((p) => p.length >= 4 && !PALAVRAS_FRACAS.has(p));

export const restanteTituloConc = (t, tipo) => {
  const total = Number(tipo === "CREDITO" ? t?.valor_previsto : t?.valor_original) || 0;
  return Math.max(0, Math.round((total - Number(t?.valor_conciliado || 0)) * 100) / 100);
};
export const restanteMovimento = (m) => {
  const ja = (m?.conciliacoes || []).reduce((s, c) => s + Number(c?.valor_movimento ?? c?.valor_conciliado ?? 0), 0);
  return Math.max(0, Math.round((Math.abs(Number(m?.valor || 0)) - ja) * 100) / 100);
};

function diasEntre(a, b) {
  const da = Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`), db = Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(da) && Number.isFinite(db) ? Math.abs(da - db) / DIA : null;
}

// Até 3 títulos candidatos para um movimento. diferenca > 0: o banco veio a mais (juros/multa); < 0: a menos (desconto).
export function sugerirTitulos(movimento, titulos = [], { limite = 3 } = {}) {
  const tipoMov = movimento?.tipo === "DEBITO" ? "DEBITO" : "CREDITO";
  const valorMov = restanteMovimento(movimento);
  if (valorMov <= 0.005) return [];
  const nfs = numerosNF(movimento?.descricao);
  const palavrasMov = new Set(palavras(movimento?.descricao));
  const lista = [];
  for (const t of titulos) {
    if (["CANCELADO", "CANCELADA"].includes(String(t?.status || "").toUpperCase()) || t?.apagado) continue;
    const restante = restanteTituloConc(t, tipoMov);
    if (restante <= 0.005) continue;
    let pontos = 0;
    const motivos = [];
    const doc = String(t?.numero_nf ?? t?.documento ?? "").replace(/\D/g, "").replace(/^0+/, "");
    if (doc && nfs.includes(doc)) { pontos += 50; motivos.push(`NF ${doc} na descrição`); }
    const diferenca = Math.round((valorMov - restante) * 100) / 100;
    if (Math.abs(diferenca) <= 0.01) { pontos += 40; motivos.push("valor igual"); }
    else if (diferenca > 0 && diferenca <= restante * 0.1) { pontos += 12; motivos.push("banco um pouco acima (juros/multa?)"); }
    else if (diferenca < 0 && -diferenca <= restante * 0.1) { pontos += 8; motivos.push("banco um pouco abaixo (desconto?)"); }
    const nome = t?.cliente ?? t?.fornecedor ?? "";
    const comuns = palavras(nome).filter((p) => palavrasMov.has(p));
    if (comuns.length) { pontos += 12; motivos.push("nome parecido"); }
    const dias = t?.data_vencimento ? diasEntre(movimento?.data_movimento, t.data_vencimento) : null;
    if (dias !== null && dias <= 10) { pontos += 5; motivos.push("vencimento próximo"); }
    // Sem NF, sem valor próximo e sem nome: não é sugestão, é ruído.
    if (pontos < 12) continue;
    lista.push({ titulo: t, restante, diferenca, pontos, motivos, exato: Math.abs(diferenca) <= 0.01 });
  }
  return lista.sort((a, b) => b.pontos - a.pontos || Math.abs(a.diferenca) - Math.abs(b.diferenca)).slice(0, limite);
}

// Quem pagou, quando a descrição do banco traz: "Pix recebido de FULANO LTDA", "Pix recebido c6 de FULANO".
export function pagadorDe(descricao = "") {
  const m = /pix\s+recebido(?:\s+c6)?\s+de\s+(.+)$/i.exec(String(descricao).trim());
  return m ? semAcento(m[1]).replace(/\s+/g, " ").trim() : null;
}

// Movimentos pendentes de um mesmo pagador que, somados, fecham exatamente o restante de um título
// (ex.: 5.000,00 + 800,00 para uma NF de 5.800,00 emitida no fim do mês). Só entra o que não tem um movimento
// exato sozinho para o título. Agrupa por pagador para não juntar valores de pessoas diferentes.
export function sugerirLotes(movimentos = [], titulos = [], tipoMov = "CREDITO", { maxItens = 14 } = {}) {
  const grupos = new Map();
  for (const m of movimentos) {
    if (m.tipo !== tipoMov || restanteMovimento(m) <= 0.005) continue;
    const quem = pagadorDe(m.descricao);
    if (!quem) continue;
    grupos.set(quem, [...(grupos.get(quem) || []), m]);
  }
  const todosPend = movimentos.filter((m) => m.tipo === tipoMov && restanteMovimento(m) > 0.005);
  const usados = new Set();
  const lotes = [];
  for (const t of titulos) {
    if (["CANCELADO", "CANCELADA"].includes(String(t?.status || "").toUpperCase()) || t?.apagado) continue;
    const alvo = centavos(restanteTituloConc(t, tipoMov));
    if (alvo <= 0) continue;
    if (todosPend.some((m) => centavos(restanteMovimento(m)) === alvo)) continue; // um movimento sozinho já fecha
    for (const grupo of grupos.values()) {
      const livres = grupo.filter((m) => !usados.has(m.id)).slice(0, maxItens);
      if (livres.length < 2) continue;
      const valores = livres.map((m) => centavos(restanteMovimento(m)));
      let achado = null;
      // Soma de subconjuntos (até 2^14): primeiro o menor número de movimentos.
      for (let tam = 2; tam <= livres.length && !achado; tam++) {
        const busca = (ini, falta, soma, escolhidos) => {
          if (achado) return;
          if (escolhidos.length === tam) { if (soma === alvo) achado = escolhidos.slice(); return; }
          for (let k = ini; k < livres.length; k++) {
            if (soma + valores[k] > alvo) continue;
            escolhidos.push(k);
            busca(k + 1, falta - 1, soma + valores[k], escolhidos);
            escolhidos.pop();
            if (achado) return;
          }
        };
        busca(0, tam, 0, []);
      }
      if (achado) {
        const ms = achado.map((k) => livres[k]);
        lotes.push({ titulo: t, movimentos: ms, valor: alvo / 100 });
        ms.forEach((m) => usados.add(m.id));
        break;
      }
    }
  }
  return lotes;
}

// Repasses por mês: movimentos pendentes cujo pagador contém o trecho informado (ex.: "minaslab"), agrupados por mês
// da data do banco. Serve para emitir a NF do mês com o total repassado e depois conciliar tudo de uma vez.
export function repassesPorMes(movimentos = [], trecho = "minaslab") {
  const alvo = semAcento(trecho);
  const meses = new Map();
  for (const m of movimentos) {
    if (m.tipo !== "CREDITO" || restanteMovimento(m) <= 0.005) continue;
    const quem = pagadorDe(m.descricao);
    if (!quem || !quem.includes(alvo)) continue;
    const mes = String(m.data_movimento).slice(0, 7);
    const g = meses.get(mes) || { mes, movimentos: [], total: 0 };
    g.movimentos.push(m);
    g.total = (centavos(g.total) + centavos(restanteMovimento(m))) / 100;
    meses.set(mes, g);
  }
  return [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

// Sugestões de todos os pendentes de uma vez. Título que um movimento já cita pelo número da NF fica reservado
// para ele e não é oferecido aos outros (evita duas pessoas/linhas disputando a mesma NF).
export function sugerirTodos(movimentos = [], receber = [], pagar = []) {
  const porMov = new Map(movimentos.map((m) => [m.id, sugerirTitulos(m, m.tipo === "DEBITO" ? pagar : receber, { limite: 5 })]));
  const dono = new Map(); // titulo.id -> movimento.id que o cita por NF
  for (const [mid, lista] of porMov) for (const s of lista) if (s.motivos.some((x) => x.includes("na descrição"))) dono.set(s.titulo.id, mid);
  const r = new Map();
  for (const [mid, lista] of porMov) r.set(mid, lista.filter((s) => !dono.has(s.titulo.id) || dono.get(s.titulo.id) === mid).slice(0, 3));
  return r;
}
