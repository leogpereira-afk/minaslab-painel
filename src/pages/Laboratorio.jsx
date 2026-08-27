// LABORATÓRIO DE ANÁLISES AMBIENTAIS — espaço reservado de propósito.
// O Léo decidiu (27/08/2026) desenhar este módulo depois, junto: é o coração
// do negócio e merece a conversa. Não construir nada aqui antes dela.

import { FlaskConical } from "lucide-react";
import { PageTitle, Empty } from "../components/ui.jsx";

export default function Laboratorio() {
  return (
    <div>
      <PageTitle
        titulo="Laboratório"
        descricao="Análises ambientais: amostras, ensaios e laudos."
      />
      <Empty className="py-16">
        <span className="flex flex-col items-center gap-3">
          <FlaskConical size={32} className="text-slate-300" />
          <span className="font-display text-base font-semibold text-slate-600">Espaço reservado</span>
          <span className="max-w-sm">
            O acompanhamento de amostras e laudos vai ser desenhado junto com a
            direção. O lugar dele já está garantido aqui no painel.
          </span>
        </span>
      </Empty>
    </div>
  );
}
