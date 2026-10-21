import { nomesAtuais } from "./referenciasPessoa.js";
// Quem a direção informou expressamente que fica FORA do quadro (nome normalizado, em maiúsculas).
// Não inferir propriedade por cargo, salário ausente ou dispensa de ponto.
// Em 21/10/2026 a direção pediu que a Lidyane Alves Oliveira passasse a aparecer no RH (ela estava aqui desde 19/09/2026).
// Uma ficha também sai do quadro se vier com `ehDirecao: true`.
const PROPRIETARIOS_CONFIRMADOS = new Set([]);
const nomeNormalizado = valor => String(valor || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase();

export function ehProprietario(pessoa) {
  return pessoa?.ehDirecao === true || PROPRIETARIOS_CONFIRMADOS.has(nomeNormalizado(pessoa?.nome));
}

// Recorte de leitura apenas. Cadastro, histórico e vínculos ficam no servidor.
// Filtrar os registros relacionados evita gerar pendências órfãs artificiais.
export function escopoEquipe(dados) {
  const fora = new Set((dados.pessoas || []).filter(ehProprietario).map(p => p.id));
  return {
    ...dados,
    // Direção pode continuar como gestora, embora fique fora da equipe.
    gestoresForaDoQuadro: [...fora],
    pessoas: (dados.pessoas || []).filter(p => !fora.has(p.id)),
    ...Object.fromEntries(['ferias', 'feedbacks', 'exames', 'vencimentos', 'historico'].map(colecao => [
      colecao, (colecao === "historico" ? dados[colecao] || [] : nomesAtuais(dados[colecao], dados.pessoas)).filter(r => !fora.has(r.pessoaId)),
    ])),
  };
}
