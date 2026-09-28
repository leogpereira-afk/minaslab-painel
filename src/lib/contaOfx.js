// O extrato (OFX ou CSV do C6) contra a conta escolhida na tela, antes de importar.
//
// A trava do servidor (ml-financeiro, movimentosImportar) recusa com 409 quando banco, agência
// ou conta do arquivo diferem da conta escolhida, mas só roda se a tela mandar os dados do arquivo.
// As telas de hoje não mandavam: o arquivo de um banco entrava calado na conta de outro.
//
// A régua é a mesma do servidor (só dígitos, sem zeros à esquerda, só compara o que os dois lados
// têm), com duas folgas que o servidor não tem, porque um arquivo legítimo não pode ficar travado:
// campo com letra e menos de 3 dígitos fica fora ("C6" no CSV vira "6", que não identifica banco),
// e agência ou conta com e sem o dígito verificador (12345678 × 123456789) é "parecida", não
// "diferente". Letra no cadastro ("CC 12345-6", dígito "X") não tira o campo da conta: vale o
// número que sobra, como no servidor.

const CAMPOS = [
  ["banco", "banco"],
  ["agencia", "agência"],
  ["conta", "conta"],
];

const comparavel = (v) => {
  const texto = String(v ?? "").trim();
  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return false;
  return /^[\d\s./-]+$/.test(texto) || digitos.length >= 3;
};
const cod = (v) => String(v ?? "").replace(/\D/g, "").replace(/^0+/, "") || "0";

function soDigitoVerificador(a, b) {
  const [curta, longa] = a.length < b.length ? [a, b] : [b, a];
  return curta.length >= 4 && longa.length === curta.length + 1 && longa.startsWith(curta);
}

// estado: "igual" (pode ir para a trava do servidor), "parecida" (só o dígito verificador difere),
// "diferente" (pedir confirmação) ou "sem_dados" (nada para comparar).
// meta: só os campos que bateram (o "parecido" fica fora), para o servidor conferir de novo
// sem tropeçar no "C6" nem no dígito. Vai também no "diferente" confirmado pela pessoa.
export function compararContaOfx(metaArquivo, conta) {
  const diferencas = [];
  const meta = {};
  let comparados = 0;
  let parecida = false;
  for (const [k, rotulo] of CAMPOS) {
    const doArquivo = metaArquivo?.[k];
    const daConta = conta?.[k];
    if (!comparavel(doArquivo) || !comparavel(daConta)) continue;
    comparados++;
    const a = cod(doArquivo);
    const b = cod(daConta);
    if (a === b) {
      meta[k] = String(doArquivo).trim();
      continue;
    }
    if (k !== "banco" && soDigitoVerificador(a, b)) {
      parecida = true;
      continue;
    }
    diferencas.push(`${rotulo}: no arquivo ${String(doArquivo).trim()}, na conta ${String(daConta).trim()}`);
  }
  if (diferencas.length) return { estado: "diferente", diferencas, meta };
  if (!comparados) return { estado: "sem_dados", diferencas, meta: {} };
  return { estado: parecida ? "parecida" : "igual", diferencas, meta };
}

export function perguntaContaOfx(nomeConta, diferencas) {
  return `Este arquivo não parece ser da conta ${nomeConta}:\n\n${diferencas.join("\n")}\n\nImportar mesmo assim nesta conta?`;
}
