// FINANÇAS — espaço reservado de propósito. O Léo decidiu (27/08/2026) que
// este módulo ele desenha depois, junto. Não construir nada aqui sem essa
// conversa: botão que promete o que a tela não faz é pior que botão nenhum.

import { Wallet } from "lucide-react";
import { PageTitle, Empty } from "../components/ui.jsx";

export default function Financas() {
  return (
    <div>
      <PageTitle titulo="Finanças" descricao="O acompanhamento financeiro da MinasLab." />
      <Empty className="py-16">
        <span className="flex flex-col items-center gap-3">
          <Wallet size={32} className="text-slate-300" />
          <span className="font-display text-base font-semibold text-slate-600">Espaço reservado</span>
          <span className="max-w-sm">
            Este módulo vai ser desenhado junto com a direção. O lugar dele já está
            garantido aqui no painel.
          </span>
        </span>
      </Empty>
    </div>
  );
}
