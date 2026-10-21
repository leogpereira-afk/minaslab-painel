// Soma das propostas do CRM por mês e por responsável. Função pura: roda na
// Edge Function (Deno) e nos testes (node), sem banco nenhum.
//
// Regras (as mesmas da especificação):
//  - entram só propostas ativas, não excluídas, fora de RASCUNHO e CANCELADA;
//  - o mês da proposta é o do ENVIO (data_envio; sem ela, created_at), em Brasília;
//  - aprovadas/recusadas/abertas contam no mês do envio (coorte);
//  - valor aprovado conta no mês do ACEITE (data_aceite; sem ela, o do envio);
//  - responsável vazio vai para a chave "_sem".

const FORA = new Set(["RASCUNHO", "CANCELADA"]);

export function mesBR(iso) {
  if (!iso) return null;
  const txt = String(iso);
  // Só data (importação de planilha) ou meia-noite UTC em ponto: é uma DATA,
  // não um instante. Sem isto, o dia 1º caía no mês anterior ao tirar 3 h.
  const soData = txt.match(/^(\d{4})-(\d{2})-\d{2}(?:$|[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-]00(?::?00)?)?$)/);
  if (soData) return `${soData[1]}-${soData[2]}`;
  const t = Date.parse(txt);
  if (!isFinite(t)) return null;
  const br = new Date(t - 3 * 3600 * 1000); // Brasília: UTC-3 o ano todo desde 2019
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}`;
}

const vazio = () => ({ enviadas: 0, aprovadas: 0, recusadas: 0, abertas: 0, valorAprovado: 0 });

export function agregarPropostas(propostas, { desde } = {}) {
  const porMes = {};
  const garantir = (mes, pid) => {
    porMes[mes] ??= { total: vazio(), porPessoa: {} };
    porMes[mes].porPessoa[pid] ??= vazio();
    return [porMes[mes].total, porMes[mes].porPessoa[pid]];
  };

  for (const p of propostas) {
    if (p.ativo === false || p.deleted_at) continue;
    const status = String(p.status || "").toUpperCase();
    if (FORA.has(status)) continue;
    const pid = p.responsavel_comercial_id || "_sem";

    const mesEnvio = mesBR(p.data_envio || p.created_at);
    if (mesEnvio && (!desde || mesEnvio >= desde)) {
      const [t, x] = garantir(mesEnvio, pid);
      for (const alvo of [t, x]) {
        alvo.enviadas += 1;
        if (status === "APROVADA") alvo.aprovadas += 1;
        else if (status === "RECUSADA") alvo.recusadas += 1;
        else alvo.abertas += 1;
      }
    }

    if (status === "APROVADA") {
      const mesAceite = mesBR(p.data_aceite || p.data_envio || p.created_at);
      if (mesAceite && (!desde || mesAceite >= desde)) {
        const v = Number(p.valor) || 0;
        const [t, x] = garantir(mesAceite, pid);
        t.valorAprovado += v;
        x.valorAprovado += v;
      }
    }
  }

  for (const m of Object.values(porMes)) {
    m.total.valorAprovado = Math.round(m.total.valorAprovado * 100) / 100;
    for (const x of Object.values(m.porPessoa)) x.valorAprovado = Math.round(x.valorAprovado * 100) / 100;
  }
  return porMes;
}

// ------------------------------------------------------------------ previsão
const DIA = 86400000;
export const FAIXAS_IDADE = [
  { de: 0, ate: 7, rotulo: "até 7 dias" },
  { de: 7, ate: 15, rotulo: "8 a 15 dias" },
  { de: 15, ate: 30, rotulo: "16 a 30 dias" },
  { de: 30, ate: 60, rotulo: "31 a 60 dias" },
  { de: 60, ate: Infinity, rotulo: "mais de 60 dias" },
];
const diasEntre = (a, b) => Math.floor((Date.parse(b) - Date.parse(a)) / DIA);

/**
 * Chance de uma proposta ainda aberta ser aprovada, conforme a idade dela.
 * Para cada faixa: das propostas (dos últimos 12 meses) que chegaram àquela
 * idade SEM decisão, quantas acabaram aprovadas. Decisão = data de aceite ou
 * de recusa; aprovada sem data de aceite conta como decidida no envio.
 * Faixa com menos de 8 casos herda a chance da faixa anterior.
 */
export function probabilidadesPorIdade(propostas, hojeIso) {
  const limite = Date.parse(hojeIso) - 365 * DIA;
  const base = [];
  for (const p of propostas) {
    if (p.ativo === false || p.deleted_at) continue;
    const st = String(p.status || "").toUpperCase();
    if (FORA.has(st)) continue;
    const envio = p.data_envio || p.created_at;
    if (!envio || Date.parse(envio) < limite) continue;
    let decisao = null;
    if (st === "APROVADA") decisao = p.data_aceite ? diasEntre(envio, p.data_aceite) : 0;
    else if (st === "RECUSADA") decisao = p.data_recusa ? diasEntre(envio, p.data_recusa) : 0;
    base.push({ idade: diasEntre(envio, hojeIso), decisao, aprovada: st === "APROVADA" });
  }
  let anterior = null;
  return FAIXAS_IDADE.map((f) => {
    // chegaram à idade f.de sem decisão antes dela
    const pop = base.filter((x) => x.idade >= f.de && (x.decisao == null || x.decisao >= f.de));
    const decididas = pop.filter((x) => x.decisao != null);
    let p = decididas.length ? decididas.filter((x) => x.aprovada).length / pop.length : 0;
    if (pop.length < 8 && anterior != null) p = anterior;
    anterior = p;
    return { ...f, ate: f.ate === Infinity ? null : f.ate, casos: pop.length, chance: Math.round(p * 1000) / 1000 };
  });
}

export function chanceDaIdade(faixas, idade) {
  const f = faixas.find((x) => idade >= x.de && (x.ate == null || idade < x.ate)) || faixas.at(-1);
  return f ? f.chance : 0;
}

// ------------------------------------------------------------------ carteira
/**
 * Clientes pelo que aprovaram nos últimos 12 meses: valor, quantidade, última
 * aprovação, intervalo médio entre aprovações, curva ABC (80/15/5 do valor) e
 * risco (sem aprovar há mais de 1,5× o próprio intervalo; precisa de 2+ aprovações).
 */
export function carteiraClientes(propostas, hojeIso) {
  const limite = Date.parse(hojeIso) - 365 * DIA;
  const porCliente = new Map();
  for (const p of propostas) {
    if (p.ativo === false || p.deleted_at || !p.cliente_id) continue;
    if (String(p.status || "").toUpperCase() !== "APROVADA") continue;
    const quando = p.data_aceite || p.data_envio || p.created_at;
    if (!quando) continue;
    const c = porCliente.get(p.cliente_id) ?? { clienteId: p.cliente_id, datas: [], valor12m: 0, aprovadas12m: 0 };
    c.datas.push(quando.slice(0, 10));
    if (Date.parse(quando) >= limite) { c.valor12m += Number(p.valor) || 0; c.aprovadas12m += 1; }
    porCliente.set(p.cliente_id, c);
  }
  const lista = [...porCliente.values()].map((c) => {
    const datas = [...new Set(c.datas)].sort();
    const ultima = datas.at(-1);
    let intervalo = null;
    if (datas.length >= 2) intervalo = Math.round(diasEntre(datas[0], ultima) / (datas.length - 1));
    const semAprovar = diasEntre(ultima, hojeIso);
    const emRisco = intervalo != null && intervalo > 0 && semAprovar > intervalo * 1.5;
    return { clienteId: c.clienteId, valor12m: Math.round(c.valor12m * 100) / 100, aprovadas12m: c.aprovadas12m, totalAprovadas: datas.length, ultima, intervaloMedio: intervalo, diasSemAprovar: semAprovar, emRisco };
  }).filter((c) => c.aprovadas12m > 0 || c.emRisco);
  lista.sort((a, b) => b.valor12m - a.valor12m);
  const total = lista.reduce((s, c) => s + c.valor12m, 0);
  let acum = 0;
  for (const c of lista) {
    acum += c.valor12m;
    const pct = total ? acum / total : 1;
    c.curva = pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C";
  }
  return lista;
}
