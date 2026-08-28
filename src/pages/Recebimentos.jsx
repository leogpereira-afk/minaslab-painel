import { useEffect, useMemo, useState } from "react";
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
import { recebimentosListar } from "../services/dados.js";

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function dataBR(valor) {
  if (!valor) return "—";

  const partes = String(valor).split("-");

  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  return valor;
}

function normalizarStatus(status) {
  const valor = String(status || "").trim().toUpperCase();

  if (valor === "PAGO" || valor === "RECEBIDO" || valor === "LIQUIDADO") {
    return "Pago";
  }

  if (
    valor === "PARCIAL" ||
    valor === "PAGTOPARCIAL" ||
    valor === "PAGTO_PARCIAL"
  ) {
    return "Parcial";
  }

  if (
    valor === "A RECEBER" ||
    valor === "ARECEBER" ||
    valor === "A_RECEBER" ||
    valor === "EMABERTO" ||
    valor === "EM ABERTO" ||
    valor === "AVENCER" ||
    valor === "A VENCER"
  ) {
    return "A Receber";
  }

  if (valor === "VENCIDO" || valor === "ATRASADO") {
    return "Vencido";
  }

  if (valor === "CANCELADO" || valor === "CANCELADA") {
    return "Cancelado";
  }

  return status || "A Receber";
}

function StatusBadge({ status }) {
  const statusExibido = normalizarStatus(status);

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
        estilos[statusExibido] || "bg-slate-100 text-slate-600"
      }`}
    >
      {statusExibido}
    </span>
  );
}

export default function Recebimentos() {
  const navigate = useNavigate();

  const [busca, setBusca] = useState("");
  const [empresa, setEmpresa] = useState("Todas");
  const [status, setStatus] = useState("Todos");

  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarRecebimentos() {
      try {
        setCarregando(true);
        setErro("");

        const lista = await recebimentosListar();

        if (ativo) {
          setDados(Array.isArray(lista) ? lista : []);
        }
      } catch (e) {
        if (ativo) {
          setErro(
            e?.message ||
              "Não foi possível carregar os recebimentos."
          );
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    carregarRecebimentos();

    return () => {
      ativo = false;
    };
  }, []);

  const filtrados = useMemo(() => {
    return dados.filter((item) => {
      const nomeEmpresa = item.empresa?.nome || "";

      const texto = `
        ${item.cliente || ""}
        ${item.cnpj_cpf || ""}
        ${item.descricao || ""}
        ${item.numero_nf || ""}
      `.toLowerCase();

      const bateBusca =
        !busca || texto.includes(busca.toLowerCase());

      const bateEmpresa =
        empresa === "Todas" || nomeEmpresa === empresa;

      const statusItem = normalizarStatus(item.status);

      const bateStatus =
        status === "Todos" || statusItem === status;

      return bateBusca && bateEmpresa && bateStatus;
    });
  }, [dados, busca, empresa, status]);

  const totais = useMemo(() => {
    return filtrados.reduce(
      (acc, item) => {
        acc.previsto += Number(item.valor_previsto || 0);
        acc.recebido += Number(item.valor_recebido || 0);
        acc.pendente += Number(item.valor_pendente || 0);

        return acc;
      },
      {
        previsto: 0,
        recebido: 0,
        pendente: 0
      }
    );
  }, [filtrados]);

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
          <p className="text-sm text-slate-500">
            Valor previsto
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {moeda(totais.previsto)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Recebido
          </p>

          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {moeda(totais.recebido)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            A receber
          </p>

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
              <Filter
                size={16}
                className="text-slate-400"
              />

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

      {carregando && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Carregando recebimentos...
        </div>
      )}

      {erro && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erro}
        </div>
      )}

      {!carregando && !erro && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    Empresa
                  </th>

                  <th className="px-4 py-3">
                    Cliente
                  </th>

                  <th className="px-4 py-3">
                    CNPJ / CPF
                  </th>

                  <th className="px-4 py-3">
                    Descrição
                  </th>

                  <th className="px-4 py-3">
                    Previsto
                  </th>

                  <th className="px-4 py-3">
                    Recebido
                  </th>

                  <th className="px-4 py-3">
                    A receber
                  </th>

                  <th className="px-4 py-3">
                    Vencimento
                  </th>

                  <th className="px-4 py-3">
                    Pagamento
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                  <th className="px-4 py-3">
                    Categoria
                  </th>

                  <th className="px-4 py-3">
                    Conta
                  </th>

                  <th className="px-4 py-3">
                    NF
                  </th>

                  <th className="px-4 py-3">
                    Origem
                  </th>

                  <th className="px-4 py-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtrados.map((item) => {
                  const ehOmie =
                    String(item.origem || "").toUpperCase() ===
                    "OMIE";

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        {item.empresa?.nome || "—"}
                      </td>

                      <td className="px-4 py-4 font-medium text-slate-900">
                        {item.cliente || "—"}
                      </td>

                      <td className="px-4 py-4">
                        {item.cnpj_cpf || "—"}
                      </td>

                      <td className="px-4 py-4">
                        {item.descricao || "—"}
                      </td>

                      <td className="px-4 py-4">
                        {moeda(item.valor_previsto)}
                      </td>

                      <td className="px-4 py-4 text-emerald-700">
                        {moeda(item.valor_recebido)}
                      </td>

                      <td className="px-4 py-4 text-amber-700">
                        {moeda(item.valor_pendente)}
                      </td>

                      <td className="px-4 py-4">
                        {dataBR(item.data_vencimento)}
                      </td>

                      <td className="px-4 py-4">
                        {dataBR(item.data_pagamento)}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="px-4 py-4">
                        {item.categoria?.nome || "—"}
                      </td>

                      <td className="px-4 py-4">
                        {item.conta_bancaria?.nome || "—"}
                      </td>

                      <td className="px-4 py-4">
                        {item.numero_nf || "—"}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            ehOmie
                              ? "bg-violet-50 text-violet-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {ehOmie ? "OMIE" : "MANUAL"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={ehOmie}
                            className={`rounded-lg p-2 ${
                              ehOmie
                                ? "cursor-not-allowed text-slate-300"
                                : "text-slate-500 hover:bg-slate-100"
                            }`}
                            title={
                              ehOmie
                                ? "Registros da Omie não podem ser editados manualmente"
                                : "Editar"
                            }
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            disabled={ehOmie}
                            className={`rounded-lg p-2 ${
                              ehOmie
                                ? "cursor-not-allowed text-slate-300"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={
                              ehOmie
                                ? "Registros da Omie são atualizados pela integração"
                                : "Dar baixa"
                            }
                          >
                            <CheckCircle2 size={16} />
                          </button>

                          <button
                            type="button"
                            disabled={ehOmie}
                            className={`rounded-lg p-2 ${
                              ehOmie
                                ? "cursor-not-allowed text-slate-300"
                                : "text-red-500 hover:bg-red-50"
                            }`}
                            title={
                              ehOmie
                                ? "Registros da Omie não podem ser excluídos manualmente"
                                : "Excluir"
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

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
      )}
    </div>
  );
}
