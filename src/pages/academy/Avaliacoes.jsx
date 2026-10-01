// Avaliações: provas liberadas, em andamento e resultados.
import { Link } from "react-router-dom";
import { PageTitle, Card, Empty, CarregandoModulo, ErroModulo } from "../../components/ui.jsx";
import { useMinha, Situacao, SemVinculo } from "./MinhaAcademy.jsx";

function estado(a) {
  if (a.aprovado) return { rotulo: `Aprovado (nota ${a.ultimaNota})`, tom: "text-ok-700", acao: "Ver resultado" };
  if (a.aulasFeitas < a.aulasTotal) return { rotulo: "Aguardando a conclusão das aulas", tom: "text-slate-600", acao: "Continuar aulas" };
  if (a.tentativasUsadas >= a.maxTentativas) return { rotulo: `Tentativas esgotadas (última nota ${a.ultimaNota})`, tom: "text-bad-700", acao: "Ver resultado" };
  return { rotulo: a.tentativasUsadas ? `Liberada · ${a.maxTentativas - a.tentativasUsadas} tentativa(s) restante(s)` : "Liberada", tom: "text-brand-700", acao: "Fazer prova" };
}

export default function Avaliacoes() {
  const { dados, erro, recarregar } = useMinha();
  if (erro) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!dados) return <CarregandoModulo />;
  if (dados.semVinculo) return <div className="space-y-4"><PageTitle titulo="Avaliações" /><SemVinculo /></div>;
  const lista = dados.atribuicoes.filter((a) => a.modalidade === "automatica");
  return (
    <div className="space-y-4">
      <PageTitle titulo="Avaliações" descricao="Provas dos seus treinamentos. A nota é calculada pelo sistema." />
      {lista.length === 0 ? <Empty>Nenhum dos seus treinamentos tem prova.</Empty> : (
        <Card className="divide-y p-0">{lista.map((a) => { const e = estado(a); return (
          <Link key={a.id} to={`/academy/treinamento/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-brand-50">
            <span className="min-w-0 flex-1 basis-56"><span className="block truncate font-display text-sm font-semibold text-slate-900">{a.titulo}</span><span className={`block text-xs ${e.tom}`}>{e.rotulo}</span></span>
            <Situacao situacao={a.situacao} /><span className="text-sm font-semibold text-brand-700">{e.acao} →</span>
          </Link>); })}</Card>)}
    </div>
  );
}
