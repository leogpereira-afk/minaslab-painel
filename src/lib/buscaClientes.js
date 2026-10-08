// Busca por digitação nos clientes cadastrados (lançamento de despesa): nome, nome fantasia, CPF/CNPJ e ID Omie.
// Sem acento, sem diferença de maiúscula; todas as palavras precisam aparecer. Inativos e mesclados ficam de fora.
const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR").trim();
const digitos = (v) => String(v ?? "").replace(/\D/g, "");

export function buscarClientes(clientes = [], termo = "", limite = 8) {
  const ativos = clientes.filter((c) => c && c.ativo !== false && !c.mesclado_para && String(c.nome || "").trim());
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean);
  const numero = digitos(termo);
  const achados = !palavras.length
    ? ativos
    : ativos.filter((c) => {
        const texto = semAcento([c.nome, c.nome_fantasia, c.cnpj_cpf, c.id_omie].filter(Boolean).join(" "));
        const doc = digitos(c.cnpj_cpf);
        // Só trata como CPF/CNPJ quando o termo é (quase) só número; "3M 2024" continua busca por texto.
        if (numero.length >= 3 && numero.length >= String(termo).replace(/[\s.\-/]/g, "").length && doc.includes(numero)) return true;
        return palavras.every((p) => texto.includes(p));
      });
  return {
    itens: achados.slice(0, limite),
    total: achados.length,
  };
}
