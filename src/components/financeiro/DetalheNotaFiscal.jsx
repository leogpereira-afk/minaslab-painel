// Corpo da tela de dados de uma nota fiscal: o mesmo em Notas Fiscais e em NFS-e M Lab.
const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v) => {
  const p = String(v || "").slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : "—";
};
export function Campo({ rotulo, valor, mono = false }) {
  return (
    <div className="rounded-xl border bg-slate-50/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {rotulo}
      </div>
      <div
        className={`mt-1 break-words text-sm font-medium text-slate-800 ${mono ? "font-mono text-xs" : ""}`}
      >
        {valor || "—"}
      </div>
    </div>
  );
}
export function valorDado(x, ...chaves) {
  const d = x?.nfse_dados || {};
  for (const k of chaves) {
    if (x?.[k] !== undefined && x?.[k] !== null && x?.[k] !== "") return x[k];
    if (d?.[k] !== undefined && d?.[k] !== null && d?.[k] !== "") return d[k];
  }
  return null;
}
export default function DetalheNotaCorpo({ detalhe }) {
  return (
    <>
        <div className="flex flex-col gap-3 rounded-2xl border bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cliente / Destinatário
            </div>
            <div className="mt-1 text-lg font-bold text-slate-900">
              {detalhe.nome_destinatario || "—"}
            </div>
            <div className="text-sm text-slate-500">
              {detalhe.cnpj_destinatario || "Documento não informado"}
            </div>
          </div>
          <div className="sm:text-right">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${["CANCELADA", "REJEITADA"].includes(String(detalhe.status_fiscal || detalhe.status_omie).toUpperCase()) ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
            >
              {detalhe.status_fiscal || detalhe.status_omie || "SEM STATUS"}
            </span>
            <div className="mt-2 text-2xl font-bold">
              {moeda(detalhe.valor_total)}
            </div>
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-slate-900">
            Dados da Nota
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo rotulo="Número da NFS-e" valor={detalhe.numero_nf} />
            <Campo
              rotulo="Data de emissão"
              valor={dataBR(detalhe.data_emissao)}
            />
            <Campo
              rotulo="Vencimento"
              valor={dataBR(detalhe.data_vencimento)}
            />
            <Campo rotulo="Empresa" valor={detalhe.empresa?.nome} />
            <Campo rotulo="Emitente" valor={detalhe.nome_emitente} />
            <Campo
              rotulo="CNPJ/CPF emitente"
              valor={detalhe.cnpj_emitente}
            />
            <Campo
              rotulo="Destinatário"
              valor={detalhe.nome_destinatario}
            />
            <Campo
              rotulo="CNPJ/CPF destinatário"
              valor={detalhe.cnpj_destinatario}
            />
            <Campo rotulo="E-mail" valor={detalhe.email_destino} />
            <Campo rotulo="Origem" valor={detalhe.origem} />
            <Campo rotulo="Tipo" valor={detalhe.tipo} />
            <Campo rotulo="Ambiente NFS-e" valor={detalhe.nfse_ambiente} />
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-slate-900">Valores</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo
              rotulo="Valor do serviço"
              valor={moeda(
                valorDado(detalhe, "valor_servico", "valor_servicos") ??
                  detalhe.valor_total,
              )}
            />
            <Campo
              rotulo="Desconto"
              valor={moeda(
                valorDado(detalhe, "valor_desconto", "desconto") || 0,
              )}
            />
            <Campo
              rotulo="Impostos retidos"
              valor={moeda(
                valorDado(
                  detalhe,
                  "impostos_retidos",
                  "valor_impostos_retidos",
                ) || 0,
              )}
            />
            <Campo
              rotulo="Valor líquido"
              valor={moeda(
                valorDado(detalhe, "valor_liquido") ?? detalhe.valor_total,
              )}
            />
            <Campo
              rotulo="ISS"
              valor={moeda(valorDado(detalhe, "valor_iss", "iss") || 0)}
            />
            <Campo
              rotulo="Valor total"
              valor={moeda(detalhe.valor_total)}
            />
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-slate-900">
            Vínculos e documentos
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              rotulo="Chave de acesso"
              valor={detalhe.chave_acesso}
              mono
            />
            <Campo
              rotulo="Vínculo financeiro"
              valor={
                detalhe.recebimento_id
                  ? "Conta a Receber vinculada"
                  : detalhe.despesa_id
                    ? "Despesa vinculada"
                    : "Sem vínculo financeiro"
              }
            />
            <Campo
              rotulo="Observação"
              valor={
                detalhe.observacao ||
                valorDado(
                  detalhe,
                  "observacao",
                  "discriminacao",
                  "descricao_servico",
                )
              }
            />
            <Campo
              rotulo="Importação / origem"
              valor={detalhe.importacao_origem || detalhe.origem}
            />
          </div>
        </div>
    </>
  );
}
