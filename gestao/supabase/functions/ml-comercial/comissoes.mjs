// Comissões × RH: liga cada responsável do CRM à pessoa da ficha do RH pelo
// nome e devolve SÓ a data de desligamento (nada mais da ficha sai daqui).
// Na dúvida (dois cadastros parecidos, nome não achado) não adivinha: avisa.

const LIGA = new Set(["da", "de", "do", "das", "dos", "e"]);
export const normalizarNome = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
const palavras = (v) => normalizarNome(v).split(" ").filter((w) => w && !LIGA.has(w));
const dataValida = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "").slice(0, 10)) ? String(v).slice(0, 10) : "");

/**
 * nomeCRM: nome do usuário no CRM; rh: registros de rh_pessoas ({ nome, ativo, desligadoEm }).
 * Devolve { rh: "ativo"|"desligado"|"nao_encontrado"|"ambiguo", desligadoEm }.
 */
export function situacaoNoRH(nomeCRM, rh) {
  const alvo = normalizarNome(nomeCRM);
  if (!alvo) return { rh: "nao_encontrado", desligadoEm: "" };
  let achadas = rh.filter((p) => normalizarNome(p.nome) === alvo);
  if (!achadas.length) {
    const ws = palavras(nomeCRM);
    if (ws.length >= 2) achadas = rh.filter((p) => { const n = new Set(palavras(p.nome)); return ws.every((w) => n.has(w)); });
  }
  if (!achadas.length) return { rh: "nao_encontrado", desligadoEm: "" };
  // Mesma pessoa cadastrada mais de uma vez (ex.: readmissão): vale o vínculo ativo, se houver.
  const nomes = new Set(achadas.map((p) => normalizarNome(p.nome)));
  if (nomes.size > 1) return { rh: "ambiguo", desligadoEm: "" };
  const ativa = achadas.find((p) => p.ativo !== false && !dataValida(p.desligadoEm));
  if (ativa) return { rh: "ativo", desligadoEm: "" };
  const datas = achadas.map((p) => dataValida(p.desligadoEm)).filter(Boolean).sort();
  return { rh: "desligado", desligadoEm: datas.at(-1) || "" };
}
