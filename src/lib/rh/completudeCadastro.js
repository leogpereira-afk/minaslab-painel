// Portado de rh/src/lib/completudeCadastro.ts (Impresilk) em 27/08/2026 — regras idênticas, campos adaptados à MinasLab.
// ============================================================================
// QUANTO DA FICHA ESTÁ PREENCHIDO.
//
// Pedido da direção: "nos cadastros de tudo do RH eu quero % de quanto está
// preenchido o cadastro". O motivo é prático — ficha pela metade só aparece
// quando ela é necessária: na hora do eSocial, do exame, do contato de
// emergência, da rescisão. Aí já é tarde.
//
// O QUE ESTA CONTA NÃO FAZ: tratar todo campo como igual. CPF ausente trava a
// admissão; um campo complementar ausente não trava nada. Uma média simples
// daria % alta para quem está sem CPF e sem contato de emergência, e a
// direção leria isso como "quase pronto".
//
// Por isso os campos têm PESO, e a tela mostra o que falta — não só o número.
// ============================================================================

/**
 * @typedef {"essencial"|"importante"|"complementar"} Peso
 * @typedef {{ chave: string, rotulo: string, peso: Peso, soSe?: (c: Object) => boolean }} CampoFicha
 *   `soSe`: quando o campo só faz sentido para parte das pessoas — campo
 *   condicional só é cobrado de quem declarou. (Na ficha MinasLab de hoje
 *   nenhum campo usa `soSe`; o mecanismo fica porque a regra vale: na origem
 *   ele cobrava "filhos" só de quem declarou ter.)
 */

/* O peso é o custo de NÃO ter o campo:
   - essencial: trava obrigação legal ou pagamento (admissão, eSocial, folha);
   - importante: trava um processo do RH (exame, contato em emergência, crachá);
   - complementar: enriquece a gestão de pessoas, não trava nada.

   Campos da origem sem equivalente na ficha MinasLab ficaram FORA (anotado):
   dataNascimento, matriculaEsocial, endereço (rua/bairro/CEP), área, gestor,
   e-mail, nível, perfil comportamental, estilo de aprendizagem, pontos
   fortes/melhoria, foto, início no cargo, cônjuge e filhos (o condicional). */
/** @type {CampoFicha[]} */
export const CAMPOS_FICHA = [
  { chave: "nome", rotulo: "Nome completo", peso: "essencial" },
  { chave: "cpf", rotulo: "CPF", peso: "essencial" },
  { chave: "admissao", rotulo: "Data de admissão", peso: "essencial" },
  { chave: "cargo", rotulo: "Cargo", peso: "essencial" },
  { chave: "salario", rotulo: "Salário", peso: "essencial" },

  { chave: "telefone", rotulo: "Telefone", peso: "importante" },
  { chave: "contatoEmergencia", rotulo: "Contato de emergência", peso: "importante" },
  { chave: "apelido", rotulo: "Login (apelido)", peso: "importante" },

  { chave: "cnh", rotulo: "CNH", peso: "complementar" },
];

const PESO_VALOR = { essencial: 5, importante: 3, complementar: 1 };

/** Está preenchido? Zero e string vazia contam como VAZIO; `false` não —
 *  "não tem CNH" é uma resposta, não uma lacuna. */
export function preenchido(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return Number.isFinite(v) && v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v).some(preenchido);
  return true; // boolean, inclusive false
}

/**
 * @typedef {Object} Completude
 * @property {number} pct 0 a 100, com peso.
 * @property {{ chave: string, rotulo: string, peso: Peso }[]} faltam
 * @property {number} faltamEssenciais
 * @property {boolean} essenciaisOk Pronto para as obrigações: nenhum essencial faltando.
 * @property {number} contados
 */

/**
 * Quanto da ficha está preenchido, com peso.
 *
 * A porcentagem sozinha engana: por isso `faltamEssenciais` sai separado, e a
 * tela mostra o que falta. 90% com o CPF faltando não é uma ficha quase pronta
 * — é uma ficha que não admite ninguém.
 *
 * @param {Object} pessoa
 * @returns {Completude}
 */
export function completudeDaFicha(pessoa) {
  const aplicaveis = CAMPOS_FICHA.filter((c) => !c.soSe || c.soSe(pessoa));
  let total = 0, feito = 0;
  const faltam = [];
  for (const campo of aplicaveis) {
    const p = PESO_VALOR[campo.peso];
    total += p;
    if (preenchido(pessoa[campo.chave])) feito += p;
    else faltam.push({ chave: campo.chave, rotulo: campo.rotulo, peso: campo.peso });
  }
  const faltamEssenciais = faltam.filter((f) => f.peso === "essencial").length;
  return {
    pct: total ? Math.round((feito / total) * 100) : 100,
    faltam,
    faltamEssenciais,
    essenciaisOk: faltamEssenciais === 0,
    contados: aplicaveis.length,
  };
}

/** A cor do indicador. Essencial faltando é sempre vermelho, mesmo com 90%.
 *  @param {Completude} c
 *  @returns {"bom"|"atencao"|"ruim"} */
export function tomDaCompletude(c) {
  if (c.faltamEssenciais > 0) return "ruim";
  if (c.pct >= 90) return "bom";
  return "atencao";
}
