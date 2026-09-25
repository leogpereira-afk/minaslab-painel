import { useState } from "react";
import {
  BarChart3, Boxes, ClipboardList, FileText, PackagePlus, PackageMinus,
  Settings, Tags, Truck, Warehouse,
} from "lucide-react";
import { PageTitle, Card } from "../components/ui.jsx";

const SECOES = [
  ["dashboard", "Dashboard", BarChart3],
  ["cadastro-insumo", "Cadastro de Insumos", Boxes],
  ["entrada-lote", "Entrada de Estoque", PackagePlus],
  ["retirada-baixa", "Saída / Baixa", PackageMinus],
  ["fornecedores", "Fornecedores", Truck],
  ["etiquetas", "Etiquetas", Tags],
  ["relatorios", "Relatórios", FileText],
  ["configuracoes", "Configurações", Settings],
  ["pedido-compra", "Pedido de Compra", ClipboardList],
];

export default function GestaoEstoque() {
  const [secao, setSecao] = useState("dashboard");
  const atual = SECOES.find(([id]) => id === secao) || SECOES[0];
  const IconeAtual = atual[2];

  return (
    <div>
      <PageTitle
        titulo="Gestão de Estoque"
        descricao="Controle de insumos, lotes, entradas, saídas, fornecedores, compras, inspeções, etiquetas e relatórios."
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {SECOES.map(([id, nome, Icone]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSecao(id)}
            className={secao === id ? "btn-primary shrink-0" : "btn-outline shrink-0"}
          >
            <Icone size={15} /> {nome}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <IconeAtual size={20} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">{atual[1]}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Módulo em implantação a partir do sistema de estoque legado. A página Compras atual permanece independente e não será alterada nesta migração.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
