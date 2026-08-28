import { ArrowLeft, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";

export default function Recebimentos() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-5">
        <button
          type="button"
          onClick={() => navigate("/financas")}
          className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-teal-700"
        >
          <ArrowLeft size={16} />
          Voltar para Finanças
        </button>

        <div className="flex items-start justify-between gap-4">
          <PageTitle
            titulo="Recebimentos"
            descricao="Controle de contas a receber da MinasLab e M Lab."
          />

          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white"
          >
            <Plus size={18} />
            Novo recebimento
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">
          Os recebimentos serão carregados do Supabase nesta área.
        </p>
      </div>
    </div>
  );
}
