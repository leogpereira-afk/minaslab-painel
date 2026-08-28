import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Pencil,
  CheckCircle2,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";

const DADOS_EXEMPLO = [
  {
    id: "1",
    empresa: "MinasLab",
    cliente: "Cliente Exemplo",
    documento: "00.000.000/0001-00",
    descricao: "Análises laboratoriais",
    valorPrevisto: 3500,
    valorRecebido: 1500,
    valorPendente: 2000,
    vencimento: "05/09/2026",
    pagamento: "",
    status: "Parcial",
    categoria: "Serviços",
    conta: "Conta Principal",
    nf: "12345",
    origem: "OMIE"
  }
];

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function StatusBadge({ status }) {
  const estilos = {
    Pago: "bg-emerald-50 text-emerald-700",
    Parcial: "bg-amber-50 text-amber-700",
    "A Receber": "bg-sky-50 text-sky-700",
    Vencido: "bg-red-50 text-red-700",
    Cancelado: "bg-slate-100 text-slate-600"
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        estilos[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

export default function Recebimentos() {
  const navigate = useNavigate();

  const [busca, setBusca] = useState("");
  const [empresa, setEmpresa] = useState("Todas");
  const [status, setStatus] = useState("Todos");

  const dados = DADOS_EXEMPLO;

  const filtrados = useMemo(() => {
    return dados.filter((item) => {
      const texto = `${item.cliente} ${item.documento} ${item.descricao} ${item.nf}`.toLowerCase();

      const bateBusca =
        !busca || texto.includes(busca.toLowerCase());

      const bateEmpresa =
        empresa === "Todas" || item.empresa === empresa;

      const bateStatus =
        status === "Todos" || item.status === status;

      return bateBusca && bateEmpresa && bateStatus;
    });
  }, [dados, busca, empresa, status]);

  const totais = useMemo(() => {
    return dados.reduce(
      (acc, item) => {
        acc.previsto += Number(item.valorPrevisto || 0);
        acc.recebido += Number(item.valorRecebido || 0);
        acc.pendente += Number(item.valorPendente || 0);
        return acc;
      },
      {
        previsto: 0,
        recebido: 0,
        pendente: 0
      }
    );
  }, [dados]);

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/financas")}
        className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-teal-700"
      >
        <ArrowLeft size={16} />
        Voltar para Finanças
      </button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageTitle
          titulo="Recebimentos"
          descricao="Controle de contas a receber da MinasLab e M Lab."
        />

        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          <Plus size={18} />
          Novo recebimento
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Valor previsto</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {moeda(totais.previsto)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Recebido</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {moeda(totais.recebido)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">A receber</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            {moeda(totais.pendente)}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, CNPJ/CPF, descrição ou NF..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
              <Filter size={16} className="text-slate-400" />

              <select
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="bg-transparent py-2.5 text-sm outline-none"
              >
                <option>Todas</option>
                <option>MinasLab</option>
                <option>M Lab</option>
              </select>
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            >
              <option>Todos</option>
              <option>Pago</option>
              <option>Parcial</option>
              <option>A Receber</option>
              <option>Vencido</option>
              <option>Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1400px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">CNPJ / CPF</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Previsto</th>
                <th className="px-4 py-3">Recebido</th>
                <th className="px-4 py-3">A receber</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Conta</th>
                <th className="px-4 py-3">NF</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filtrados.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">{item.empresa}</td>
                  <td className="px-4 py-4 font-medium text-slate-900">
                    {item.cliente}
                  </td>
                  <td className="px-4 py-4">{item.documento}</td>
                  <td className="px-4 py-4">{item.descricao}</td>
                  <td className="px-4 py-4">{moeda(item.valorPrevisto)}</td>
                  <td className="px-4 py-4 text-emerald-700">
                    {moeda(item.valorRecebido)}
                  </td>
                  <td className="px-4 py-4 text-amber-700">
                    {moeda(item.valorPendente)}
                  </td>
                  <td className="px-4 py-4">{item.vencimento}</td>
                  <td className="px-4 py-4">{item.pagamento || "—"}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-4">{item.categoria}</td>
                  <td className="px-4 py-4">{item.conta}</td>
                  <td className="px-4 py-4">{item.nf || "—"}</td>
                  <td className="px-4 py-4">{item.origem}</td>

                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        type="button"
                        className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                        title="Dar baixa"
                      >
                        <CheckCircle2 size={16} />
                      </button>

                      <button
                        type="button"
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtrados.length === 0 && (
                <tr>
                  <td
                    colSpan="15"
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Nenhum recebimento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
