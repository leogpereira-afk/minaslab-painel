// LABORATÓRIO DE ANÁLISES AMBIENTAIS — espaço reservado de propósito.
// O Léo decidiu (27/08/2026) desenhar este módulo depois, junto: é o coração
// do negócio e merece a conversa. Não construir nada aqui antes dela.

import { FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
import { PageTitle, Empty } from "../components/ui.jsx";

export default function Laboratorio() {
  return (
    <div>
      <PageTitle
        titulo="Laboratório"
        descricao="Análises ambientais: amostras, ensaios e laudos."
      />
      <Empty className="px-4 py-12 sm:py-16">
        <span className="flex flex-col items-center gap-3">
          <FlaskConical size={32} aria-hidden="true" className="text-slate-500" />
          <span className="font-display text-base font-semibold text-slate-700">Módulo em planejamento</span>
          <span className="max-w-sm">
            O acompanhamento de amostras e laudos vai ser desenhado junto com a
            direção. O lugar dele já está garantido aqui no painel.
          </span>
          <Link to="/calendario" className="btn-outline mt-2 min-h-11">Abrir calendário</Link>
        </span>
      </Empty>
    </div>
  );
}
