// Avaliação da liderança por LINK (convite): regras puras, usadas pelo
// servidor (ml-comercial) e pela tela. Um convite vale para UMA pessoa da
// liderança, UM mês e uma lista fechada de colaboradores. Quem abre o link só
// vê os nomes e as próprias notas; nunca as notas de outra pessoa da liderança.

export const CRITERIOS_LIDERANCA = [
  { id: "p1", nome: "Prazos e metas", desc: "Cumpre prazos e metas combinados." },
  { id: "p2", nome: "Qualidade técnica", desc: "Qualidade das análises, propostas e OS; erro zero." },
  { id: "p3", nome: "Normas sanitárias", desc: "Segue as normas da Vigilância e da ISO/IEC 17025." },
  { id: "p4", nome: "Organização", desc: "Posto, materiais e registros organizados." },
  { id: "p5", nome: "Comunicação", desc: "Registra e repassa informação com clareza, sem retrabalho." },
  { id: "p6", nome: "Proatividade", desc: "Antecipa problemas e propõe soluções." },
  { id: "p7", nome: "Assiduidade e pontualidade", desc: "Presença e horários (faltas justificadas não contam)." },
  { id: "p8", nome: "Responsabilidade com materiais", desc: "Cuida de equipamentos, insumos e documentos." },
  { id: "p9", nome: "Ética", desc: "Imparcialidade, sigilo e respeito." },
  { id: "p10", nome: "Colaboração", desc: "Apoia os colegas e outros setores." },
];

export const MOTIVOS_ELIMINATORIOS = [
  "Recebeu advertência",
  "Descumpriu normas da Vigilância Sanitária",
  "Apresentou falta grave de organização",
  "Gerou retrabalho por falha de comunicação",
  "Atrasos recorrentes sem justificativa",
  "Não entregou documento no prazo",
  "Férias ou afastamento no mês",
  "Outro motivo",
];

export const DIAS_CONVITE = 45;

/** O convite ainda vale? (ativo e dentro da validade) */
export function conviteValido(conv, agora = new Date()) {
  return !!conv && conv.status === "ativo" && (!conv.validoAte || new Date(conv.validoAte) > agora);
}

/** Confere a ficha enviada pelo link. Devolve { erro } ou { limpo }. */
export function validarAvaliacao(conv, body) {
  const pessoaId = String(body?.pessoaId ?? "");
  const pessoa = (conv?.pessoas || []).find((p) => p.id === pessoaId);
  if (!pessoa) return { erro: "Essa pessoa não está neste link." };
  const eliminatorio = String(body?.eliminatorio ?? "");
  if (eliminatorio && !MOTIVOS_ELIMINATORIOS.includes(eliminatorio)) return { erro: "Motivo eliminatório inválido." };
  const bruto = body?.notas && typeof body.notas === "object" ? body.notas : {};
  const notas = {};
  for (const c of CRITERIOS_LIDERANCA) {
    const v = bruto[c.id];
    if (v === "" || v == null) continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 5) return { erro: `Nota inválida em “${c.nome}” (use de 0 a 5).` };
    notas[c.id] = n;
  }
  const completas = Object.keys(notas).length === CRITERIOS_LIDERANCA.length;
  if (!eliminatorio && !completas) return { erro: "Dê nota nos 10 critérios (ou marque um motivo eliminatório)." };
  const obs = String(body?.obs ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  return {
    limpo: {
      id: `${conv.mes}_${pessoa.id}_${conv.avaliador}`, mes: conv.mes, pessoaId: pessoa.id, nome: pessoa.nome,
      avaliador: conv.avaliador, avaliadorNome: conv.avaliadorNome, notas, eliminatorio, obs, viaLink: true,
    },
  };
}
