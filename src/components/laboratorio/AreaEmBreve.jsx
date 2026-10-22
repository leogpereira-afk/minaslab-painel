// Lugar reservado para as áreas que ainda vão ser desenvolvidas. Mostra o que
// está previsto, para a equipe validar antes de construir.

import { ArrowLeft, Hammer } from "lucide-react";

const PLANOS = {
  qualidade: {
    titulo: "Qualidade",
    itens: [
      "Documentos e POPs com versão, vigência e quem aprovou",
      "Equipamentos: calibração, verificação e manutenção com alerta de vencimento",
      "Não conformidades e ações corretivas, com responsável e prazo",
      "Auditorias internas e ensaios de proficiência",
      "Indicadores: prazo de liberação, retrabalho e reclamações",
    ],
  },
  microbiologia: {
    titulo: "Microbiologia",
    itens: [
      "Fila de amostras para MB, vinda direto das Entradas de amostras",
      "Lançamento de resultados (coliformes totais, E. coli, heterotróficas…)",
      "Finalização MB preenchida automaticamente na entrada da amostra",
      "Controle de meios de cultura: lote, validade e preparo",
      "Registro de temperatura de estufas, geladeiras e autoclave",
    ],
  },
  fisicoquimico: {
    titulo: "Físico-Químico",
    itens: [
      "Fila de amostras para FQ, vinda direto das Entradas de amostras",
      "Resultados por parâmetro (pH, turbidez, cor, cloro, ferro, manganês, fósforo…)",
      "Finalização FQ preenchida automaticamente na entrada da amostra",
      "Curvas de calibração e controle de reagentes e padrões",
      "Alerta de parâmetro imediato e de resultado fora do limite",
    ],
  },
};

export default function AreaEmBreve({ area, voltar }) {
  const p = PLANOS[area];
  if (!p) return null;
  return (
    <div className="card mx-auto max-w-2xl p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Hammer className="h-5 w-5" aria-hidden /></span>
        <div>
          <p className="font-display text-lg font-semibold text-slate-900">{p.titulo} — em desenvolvimento</p>
          <p className="text-sm text-slate-500">Esta tela ainda vai ser construída. O que está previsto:</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        {p.itens.map((t) => <li key={t} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />{t}</li>)}
      </ul>
      <p className="mt-4 text-xs text-slate-500">Quer mudar ou acrescentar algo? É só pedir — a lista vira o escopo da tela.</p>
      <button type="button" onClick={voltar} className="btn-outline mt-4 inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" aria-hidden /> Voltar ao início</button>
    </div>
  );
}
