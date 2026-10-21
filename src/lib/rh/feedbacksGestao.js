// Conversas de feedback registradas na Gestão (Comercial e Laboratório)
// aparecem no RH, na ficha e na fila de feedback de cada pessoa.
//
// SÓ LEITURA: o registro continua sendo da Gestão (rh_comercial_feedbacks e
// rh_lab_feedbacks). Aqui ele é traduzido para o formato do RH e marcado com
// fonte "gestao"; editar ou apagar é lá. A pessoa da equipe da Gestão é ligada
// à ficha do RH pelo campo rhPessoaId; sem essa ligação, a conversa não sobe.
// Conversa 1:1 de trabalho conta para a cadência como qualquer outra.

const SETORES = [["comercial", "Comercial"], ["lab", "Laboratório"]];

/**
 * @param {{ comercial?: {feedbacks?: any[], equipe?: any[]}, lab?: {feedbacks?: any[], equipe?: any[]} }} gestao
 * @param {any[]} pessoas fichas do RH (rh_pessoas)
 */
export function feedbacksDaGestao(gestao, pessoas = []) {
  const fichas = new Map((pessoas || []).map((p) => [p.id, p]));
  const out = [];
  for (const [chave, nomeSetor] of SETORES) {
    const g = gestao?.[chave] || {};
    const rhDe = new Map((g.equipe || []).filter((m) => m?.rhPessoaId).map((m) => [m.id, m.rhPessoaId]));
    for (const f of g.feedbacks || []) {
      if (!f || f._apagado) continue;
      const pessoaId = rhDe.get(f.pessoaId);
      const ficha = pessoaId && fichas.get(pessoaId);
      const data = String(f.data || "").slice(0, 10);
      if (!ficha || !/^\d{4}-\d{2}-\d{2}$/.test(data)) continue;
      const combinado = [String(f.combinados || "").trim(), f.prazo ? `prazo ${String(f.prazo).split("-").reverse().join("/")}` : ""].filter(Boolean).join(" · ");
      out.push({
        id: `gestao:${chave}:${f.id}`,
        pessoaId,
        pessoaNome: ficha.nome,
        tipo: "individual",
        origem: "trabalho",
        preparadoEm: "",
        agendadaPara: "",
        ocorridoEm: data,
        roteiro: "",
        oQueAconteceu: String(f.texto || "").trim(),
        combinado,
        criadoEm: f.criadoEm || data,
        fonte: "gestao",
        setorGestao: nomeSetor,
        somenteLeitura: true,
      });
    }
  }
  return out;
}
