// Minha Academy: o que preciso fazer, o que está em andamento, prazos, reciclagens e certificados.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Clock, AlertTriangle, CheckCircle2, Award, RotateCcw } from "lucide-react";
import { PageTitle, Card, StatCard, Empty, CarregandoModulo, ErroModulo } from "../../components/ui.jsx";
import { minhaAcademy } from "../../services/academy.js";
import { SITUACAO, textoPrazo, dataBR } from "../../lib/academy/regras.js";

export const Situacao = ({ situacao }) => {
  const s = SITUACAO[situacao] || SITUACAO.pendente;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${s.tom}`}>{s.rotulo}</span>;
};

export function SemVinculo() {
  return <Card><p className="text-sm text-slate-700">Sua conta ainda não está ligada a um colaborador do RH, por isso não há treinamentos para mostrar. Peça à direção para fazer o vínculo em <b>Gestão Academy → Contas e colaboradores</b>.</p></Card>;
}

export function useMinha() {
  const [dados, setDados] = useState(null), [erro, setErro] = useState("");
  const carregar = useCallback(() => minhaAcademy().then(setDados).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  return { dados, erro, recarregar: () => { setErro(""); setDados(null); carregar(); } };
}

export function CartaoTreinamento({ a, hoje }) {
  const pct = a.aulasTotal ? Math.round((100 * a.aulasFeitas) / a.aulasTotal) : 0;
  const acao = a.status === "concluida" ? "Rever" : a.status === "pendente" ? "Começar" : "Continuar";
  return (
    <Link to={`/academy/treinamento/${a.id}`} className="card card-hover block space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0 font-display text-sm font-semibold text-slate-900">{a.titulo}</span>
        <Situacao situacao={a.situacao} />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso das aulas"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
      <p className="flex flex-wrap justify-between gap-x-3 text-xs text-slate-500"><span>{a.aulasFeitas} de {a.aulasTotal} aulas{a.obrigatorio ? " · obrigatório" : ""}</span>
        <span>{a.status === "concluida" ? (a.validaAte ? `Válido até ${dataBR(a.validaAte)}` : "Sem validade") : textoPrazo(a.prazoEm, hoje)}</span></p>
      {a.modalidade === "automatica" && <p className="text-xs text-slate-500">Prova: {a.aprovado ? `aprovado (nota ${a.ultimaNota})` : `${a.tentativasUsadas} de ${a.maxTentativas} tentativas${a.ultimaNota != null ? ` · última nota ${a.ultimaNota}` : ""}`}</p>}
      <span className="inline-block text-sm font-semibold text-brand-700">{acao} →</span>
    </Link>
  );
}

function Grupo({ titulo, itens, vazio, hoje }) {
  return (<section className="space-y-2"><h2 className="font-display text-lg font-semibold text-slate-900">{titulo}</h2>
    {itens.length === 0 ? <Empty>{vazio}</Empty> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{itens.map((a) => <CartaoTreinamento key={a.id} a={a} hoje={hoje} />)}</div>}</section>);
}

export default function MinhaAcademy() {
  const { dados, erro, recarregar } = useMinha();
  if (erro) return <ErroModulo mensagem={erro} aoTentar={recarregar} />;
  if (!dados) return <CarregandoModulo />;
  if (dados.semVinculo) return <div className="space-y-4"><PageTitle titulo="Minha Academy" /><SemVinculo /></div>;
  const l = dados.atribuicoes, h = dados.hoje;
  const abertas = l.filter((a) => a.status !== "concluida");
  const obrig = abertas.filter((a) => a.obrigatorio);
  const andamento = abertas.filter((a) => a.status === "em_andamento");
  const atrasadas = l.filter((a) => a.situacao === "atrasada");
  const reciclar = l.filter((a) => a.situacao === "validade_vencida");
  const feitas = l.filter((a) => a.status === "concluida");
  const provas = abertas.filter((a) => a.modalidade === "automatica" && a.aulasFeitas === a.aulasTotal && !a.aprovado && a.tentativasUsadas < a.maxTentativas);
  return (
    <div className="space-y-5">
      <PageTitle titulo={`Olá, ${dados.pessoa.nome.split(" ")[0].toLowerCase().replace(/^./, (c) => c.toUpperCase())}`} descricao="Seus treinamentos, prazos e certificados." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Obrigatórios pendentes" valor={String(obrig.length)} icone={BookOpen} tom={obrig.length ? "warn" : "ok"} />
        <StatCard rotulo="Em andamento" valor={String(andamento.length)} icone={Clock} tom="brand" />
        <StatCard rotulo="Prazo vencido" valor={String(atrasadas.length)} icone={AlertTriangle} tom={atrasadas.length ? "bad" : "ok"} />
        <StatCard rotulo="Concluídos" valor={String(feitas.length)} icone={CheckCircle2} tom="ok" />
      </div>
      {reciclar.length > 0 && <Card className="border-bad-200 bg-bad-50"><p className="flex items-center gap-2 text-sm font-semibold text-bad-800"><RotateCcw size={16} />Reciclagem necessária: {reciclar.map((a) => a.titulo).join(", ")}</p></Card>}
      {provas.length > 0 && <Card className="bg-brand-50"><p className="text-sm text-brand-900">Avaliação disponível: {provas.map((a) => a.titulo).join(", ")}. <Link className="font-semibold underline" to="/academy/avaliacoes">Ver avaliações</Link></p></Card>}
      <Grupo hoje={h} titulo="Obrigatórios e pendentes" itens={abertas} vazio="Nada pendente. Veja o Catálogo para outros treinamentos." />
      <Grupo hoje={h} titulo="Concluídos" itens={feitas} vazio="Você ainda não concluiu nenhum treinamento." />
      {feitas.some((a) => a.certificadoId) && <p className="text-sm"><Link to="/academy/certificados" className="inline-flex items-center gap-1 font-semibold text-brand-700"><Award size={15} />Ver meus certificados</Link></p>}
    </div>
  );
}
