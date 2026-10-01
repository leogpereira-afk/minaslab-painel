// Catálogo: treinamentos publicados disponíveis para o meu perfil, por categoria.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search } from "lucide-react";
import { PageTitle, Card, Empty, CarregandoModulo, ErroModulo, Aviso } from "../../components/ui.jsx";
import { catalogo, catalogoMatricular } from "../../services/academy.js";
import { MODALIDADES } from "../../lib/academy/regras.js";
import { SemVinculo } from "./MinhaAcademy.jsx";

export default function Catalogo() {
  const navigate = useNavigate();
  const [itens, setItens] = useState(null), [erro, setErro] = useState(""), [busca, setBusca] = useState(""), [cat, setCat] = useState(""), [aviso, setAviso] = useState(null), [ocupado, setOcupado] = useState("");
  const carregar = useCallback(() => catalogo().then(setItens).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  const categorias = useMemo(() => [...new Set((itens || []).map((t) => t.categoria).filter(Boolean))].sort(), [itens]);
  if (erro) return /vinculada/.test(erro) ? <div className="space-y-4"><PageTitle titulo="Catálogo de Treinamentos" /><SemVinculo /></div> : <ErroModulo mensagem={erro} aoTentar={() => { setErro(""); carregar(); }} />;
  if (!itens) return <CarregandoModulo />;
  const q = busca.trim().toLowerCase();
  const lista = itens.filter((t) => (!q || t.titulo.toLowerCase().includes(q)) && (!cat || t.categoria === cat));
  const abrir = async (t) => {
    if (t.atribuicaoId) return navigate(`/academy/treinamento/${t.atribuicaoId}`);
    setOcupado(t.treinamentoId);
    try { navigate(`/academy/treinamento/${await catalogoMatricular(t.treinamentoId)}`); }
    catch (e) { setAviso({ tipo: "erro", texto: e.message }); setOcupado(""); }
  };
  return (
    <div className="space-y-4">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle titulo="Catálogo de Treinamentos" descricao="Conteúdos disponíveis para o seu perfil." />
      <div className="grid gap-2 sm:grid-cols-[1fr_260px]">
        <label className="relative"><span className="sr-only">Buscar</span><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><input className="input pl-9" placeholder="Buscar treinamento" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <select className="select" aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas as categorias</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      {lista.length === 0 ? <Empty>{itens.length === 0 ? "Nenhum treinamento publicado para o seu perfil ainda." : "Nenhum treinamento com estes filtros."}</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{lista.map((t) => (
          <Card key={t.treinamentoId} className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t.categoria}</span>
            <h2 className="font-display text-sm font-semibold text-slate-900">{t.titulo}</h2>
            <p className="line-clamp-3 flex-1 text-sm text-slate-600">{t.descricao}</p>
            <p className="text-xs text-slate-500">{t.obrigatorio ? "Obrigatório · " : ""}{MODALIDADES.find((m) => m.valor === t.modalidade)?.valor === "automatica" ? "Com prova" : "Sem prova"}{t.validadeMeses ? ` · válido por ${t.validadeMeses} meses` : ""}</p>
            <button type="button" className="btn-primary" disabled={ocupado === t.treinamentoId} onClick={() => abrir(t)}>{t.atribuicaoId ? "Abrir" : "Iniciar"}</button>
          </Card>))}</div>)}
      <p className="text-xs text-slate-500"><Link to="/academy/minha" className="text-brand-700 underline">Voltar para Minha Academy</Link></p>
    </div>
  );
}
