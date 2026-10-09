// Serviços Gerados × Notas emitidas (M Lab): toda OS faturada tem a NF na página de notas? Toda nota tem OS, recebimento e valor certo?
// Só calcula e lista; não altera nada. Mesmo formato dos itens do fechamento (montarFechamento).
const arred = (n) => Math.round(Number(n || 0) * 100) / 100;
const norm = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const numeroNF = (v) => {
  const d = String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return d ? Number(d) : null;
};
const cancelada = (n) => ["CANCELADA", "CANCELADO"].includes(String(n?.status_fiscal ?? n?.status_omie ?? "").toUpperCase()) || n?.apagado;
const ehSaida = (n) => String(n?.tipo || "").toUpperCase() === "SAIDA";
const dataBR = (v) => String(v || "").slice(0, 10).split("-").reverse().join("/");

function item(id, titulo, severidade, lista, valor = 0, extra = {}) {
  return { id, titulo, severidade: lista.length ? severidade : "ok", quantidade: lista.length, valor: arred(valor), lista, ...extra };
}

export function conferirOsNotas({ servicos = [], notas = [], recebimentos = [], empresaId, nomeOutras = {} }) {
  const os = servicos.filter((s) => !s.apagado && (!empresaId || s.empresa_id === empresaId));
  const minhas = notas.filter((n) => !n.apagado && n.empresa_id === empresaId);
  const saidas = minhas.filter(ehSaida);
  const doutras = notas.filter((n) => !n.apagado && n.empresa_id !== empresaId && ehSaida(n) && !cancelada(n));

  const porNumero = new Map();
  for (const n of saidas) {
    const k = numeroNF(n.numero_nf);
    if (k !== null) porNumero.set(k, [...(porNumero.get(k) || []), n]);
  }
  const ativas = (k) => (porNumero.get(k) || []).filter((n) => !cancelada(n));
  const outrasPorNumero = new Map();
  for (const n of doutras) {
    const k = numeroNF(n.numero_nf);
    if (k !== null) outrasPorNumero.set(k, [...(outrasPorNumero.get(k) || []), n]);
  }

  const osFaturadas = os.filter((s) => numeroNF(s.numero_nf) !== null);
  const linhaOs = (s, extra = "") => ({ texto: `${s.os_numero} · NF ${s.numero_nf} · ${s.cliente || "Sem cliente"}${extra}`, valor: arred(s.valor_faturar) });

  const semNota = [], emOutra = [], emCancelada = [];
  for (const s of osFaturadas) {
    const k = numeroNF(s.numero_nf);
    if (ativas(k).length) continue;
    if ((porNumero.get(k) || []).length) { emCancelada.push(linhaOs(s, " · a nota está cancelada")); continue; }
    const o = outrasPorNumero.get(k);
    if (o?.length) emOutra.push(linhaOs(s, ` · NF emitida por ${nomeOutras[o[0].empresa_id] || "outra empresa"}`));
    else semNota.push(linhaOs(s));
  }
  const semNumero = os.filter((s) => String(s.status_faturamento || "").toUpperCase() === "FATURADO" && numeroNF(s.numero_nf) === null).map((s) => linhaOs(s, " · faturada sem número de NF"));

  // Nota de saída sem OS (repasse da MinasLab é esperado: não conta).
  const numerosComOs = new Set(osFaturadas.map((s) => numeroNF(s.numero_nf)));
  const semOs = saidas.filter((n) => !cancelada(n) && !numerosComOs.has(numeroNF(n.numero_nf)) && !norm(n.nome_destinatario).includes("minaslab"))
    .map((n) => ({ texto: `NF ${n.numero_nf} · ${n.nome_destinatario || "Sem destinatário"} · emitida em ${dataBR(n.data_emissao)}`, valor: arred(n.valor_total) }));

  // Valor da nota × soma das OS que citam a mesma NF.
  const somaOs = new Map();
  for (const s of osFaturadas) { const k = numeroNF(s.numero_nf); somaOs.set(k, arred((somaOs.get(k) || 0) + Number(s.valor_faturar || 0))); }
  const valorDifere = [];
  for (const [k, soma] of somaOs) {
    const n = ativas(k)[0];
    if (!n) continue;
    const dif = arred(Number(n.valor_total || 0) - soma);
    if (Math.abs(dif) > 0.01) valorDifere.push({ texto: `NF ${n.numero_nf} · ${n.nome_destinatario || ""} · nota ${arred(n.valor_total).toFixed(2).replace(".", ",")} × OS ${soma.toFixed(2).replace(".", ",")}`, valor: Math.abs(dif) });
  }

  // Nota da própria M Lab lançada como ENTRADA por engano.
  const entradaErrada = minhas.filter((n) => String(n.tipo || "").toUpperCase() === "ENTRADA" && norm(n.nome_emitente).replace(/[^a-z]/g, "").startsWith("mlab"))
    .map((n) => ({ texto: `NF ${n.numero_nf} · emitida pela M Lab para ${n.nome_destinatario || "—"}, lançada como entrada`, valor: arred(n.valor_total) }));

  // Buracos na numeração da série da M Lab.
  const numeros = new Set(saidas.map((n) => numeroNF(n.numero_nf)).filter((x) => x !== null));
  const maior = Math.max(0, ...numeros);
  const buracos = [];
  for (let i = 1; i <= maior; i++) if (!numeros.has(i)) buracos.push({ texto: `NF ${i}`, valor: 0 });

  // Nota autorizada sem recebimento com o mesmo número.
  const recPorNumero = new Set(recebimentos.filter((r) => !r.apagado && !["CANCELADO", "CANCELADA"].includes(String(r.status || "").toUpperCase())).map((r) => numeroNF(r.numero_nf)).filter((x) => x !== null));
  const semRecebimento = saidas.filter((n) => !cancelada(n) && numeroNF(n.numero_nf) !== null && !recPorNumero.has(numeroNF(n.numero_nf)))
    .map((n) => ({ texto: `NF ${n.numero_nf} · ${n.nome_destinatario || "Sem destinatário"} · emitida em ${dataBR(n.data_emissao)}`, valor: arred(n.valor_total) }));

  const soma = (l) => l.reduce((s, x) => s + (x.valor || 0), 0);
  const itens = [
    item("os-sem-nota", "OS faturadas sem a nota na página de Notas emitidas", "erro", semNota, soma(semNota), { dica: "A OS diz que foi faturada, mas não há nota com esse número na M Lab. Importe o XML pela tela Importar histórico NFS-e ou corrija o número na OS." }),
    item("os-sem-numero", "OS faturadas sem número de NF", "erro", semNumero, soma(semNumero)),
    item("os-nota-cancelada", "OS que apontam para nota cancelada", "erro", emCancelada, soma(emCancelada), { dica: "A nota foi cancelada: a OS precisa de uma nota nova ou voltar para a fila de faturamento." }),
    item("os-nota-outra-empresa", "OS da M Lab com nota emitida por outra empresa", "atencao", emOutra, soma(emOutra), { dica: "Não é erro se foi faturada de propósito pela outra empresa (ex.: Omie/MinasLab)." }),
    item("nota-sem-os", "Notas emitidas sem OS (fora os repasses da MinasLab)", "atencao", semOs, soma(semOs), { dica: "Nota sem OS ligada pelo número. Confira se é um serviço avulso." }),
    item("nota-valor-difere", "Valor da nota diferente da soma das OS", "atencao", valorDifere, soma(valorDifere), { dica: "Confira qual está certo: a OS ou a nota (desconto, acréscimo, OS agrupadas)." }),
    item("nota-entrada-errada", "Notas da M Lab lançadas como entrada", "erro", entradaErrada, soma(entradaErrada), { dica: "Uma nota emitida pela M Lab deve ser de saída." }),
    item("nota-sem-recebimento", "Notas emitidas sem recebimento correspondente", "atencao", semRecebimento, soma(semRecebimento), { dica: "Não achei título a receber com o mesmo número da NF." }),
    item("numeracao", "Buracos na numeração das notas da M Lab", "atencao", buracos, 0, { dica: "Número que não aparece entre as notas: pode ser cancelada, inutilizada ou emitida e não importada. Confira no portal." }),
  ];
  return {
    totalOs: os.length,
    osFaturadas: osFaturadas.length,
    osComNota: osFaturadas.length - semNota.length - emOutra.length - emCancelada.length,
    notasSaida: saidas.filter((n) => !cancelada(n)).length,
    itens,
    erros: itens.filter((i) => i.severidade === "erro").length,
    atencoes: itens.filter((i) => i.severidade === "atencao").length,
  };
}
