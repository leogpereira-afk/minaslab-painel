// Antes de excluir um recebimento/despesa manual (auditoria de 26/11/2026).
// - Conciliado com o banco: bloqueado. Excluir deixava o movimento do banco "conciliado" com uma nota que
//   some das listas. O servidor (ml-financeiro) faz a mesma checagem no banco.
// - Com baixa (pagamento sem banco, ex.: dinheiro): confirmação que diz o valor que deixa de contar.
const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function avaliarExclusaoTitulo(t, tipo) {
  const rec = tipo === "REC";
  const nome = (rec ? t?.cliente : t?.fornecedor) || "sem nome";
  const oQue = rec ? `o recebimento de ${nome}` : `a despesa de ${nome}`;
  const conciliado = Number(t?.valor_conciliado || 0);
  if (conciliado > 0.005 || (t?.conciliacoes || []).length)
    return { bloqueado: true, mensagem: `Não é possível excluir ${oQue}: a nota está conciliada com o banco (${moeda(conciliado)}). Desfaça a conciliação em Bancos antes de excluir.` };
  const pago = Number((rec ? t?.valor_recebido : t?.valor_pago) || 0);
  if (pago > 0.005)
    return { bloqueado: false, mensagem: `${rec ? "O recebimento" : "A despesa"} de ${nome} tem ${moeda(pago)} ${rec ? "recebido" : "pago"} registrado. Excluir mesmo assim? Esse valor deixa de contar nos relatórios.` };
  return { bloqueado: false, mensagem: `Excluir ${oQue}?` };
}
