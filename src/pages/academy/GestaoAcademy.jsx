// Gestão Academy: lista de treinamentos, grupos e vínculos conta↔colaborador.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { PageTitle, Card, Empty, CarregandoModulo, ErroModulo, Aviso, Modal, Segmented } from "../../components/ui.jsx";
import { academyContexto, treinamentosListar, treinamentoCriar, grupoSalvar, vinculosListar, vinculoSalvar } from "../../services/academy.js";
import { STATUS_TREINAMENTO, TOM_STATUS } from "../../lib/academy/regras.js";
import { capacidadesAcademy } from "../../lib/sessao.js";

export const Etiqueta = ({ status, children }) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TOM_STATUS[status] || "bg-slate-100 text-slate-600"}`}>{children}</span>
);

function ListaTreinamentos({ ctx, caps, aviso }) {
  const navigate = useNavigate();
  const [itens, setItens] = useState(null), [erro, setErro] = useState("");
  const [busca, setBusca] = useState(""), [cat, setCat] = useState(""), [status, setStatus] = useState("");
  const [novo, setNovo] = useState(false), [titulo, setTitulo] = useState(""), [categoria, setCategoria] = useState(""), [gravando, setGravando] = useState(false);
  const carregar = useCallback(() => treinamentosListar().then(setItens).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  const nomeCat = useMemo(() => Object.fromEntries(ctx.categorias.map((c) => [c.id, c.nome])), [ctx]);
  const nomePessoa = useMemo(() => Object.fromEntries(ctx.pessoas.map((p) => [p.id, p.nome])), [ctx]);
  if (erro) return <ErroModulo mensagem={erro} aoTentar={() => { setErro(""); carregar(); }} />;
  if (!itens) return <CarregandoModulo />;
  const q = busca.trim().toLowerCase();
  const lista = itens.filter((t) => (!q || t.titulo.toLowerCase().includes(q)) && (!cat || t.categoria_id === cat) && (!status || t.status === status));
  const criar = async (e) => {
    e.preventDefault(); setGravando(true);
    try { const id = await treinamentoCriar(titulo, categoria); navigate(`/academy/gestao/${id}`); }
    catch (ex) { aviso({ tipo: "erro", texto: ex.message }); setGravando(false); }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_220px_160px_auto]">
        <label className="relative"><span className="sr-only">Buscar</span><Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar treinamento" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <select className="select" aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas as categorias</option>{ctx.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        <select className="select" aria-label="Situação" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todas as situações</option>{Object.entries(STATUS_TREINAMENTO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
        {caps.gestao && <button type="button" className="btn-primary" onClick={() => { setTitulo(""); setCategoria(ctx.categorias[0]?.id || ""); setNovo(true); }}><Plus size={16} />Novo treinamento</button>}
      </div>
      {lista.length === 0 ? <Empty>{itens.length === 0 ? "Nenhum treinamento cadastrado ainda." : "Nenhum treinamento com estes filtros."}</Empty> : (
        <Card className="divide-y p-0" style={{ borderColor: "var(--hairline)" }}>
          {lista.map((t) => {
            const atual = t.versoes.find((v) => v.status === "publicada"), rasc = t.versoes.find((v) => v.status === "rascunho");
            return (
              <Link key={t.id} to={`/academy/gestao/${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-brand-50">
                <span className="min-w-0 flex-1 basis-60">
                  <span className="block truncate font-display text-sm font-semibold text-slate-900">{t.titulo}</span>
                  <span className="block truncate text-xs text-slate-500">{nomeCat[t.categoria_id] || t.categoria_id} · Responsável: {nomePessoa[t.responsavel_pessoa_id] || "não definido"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <Etiqueta status={t.status}>{STATUS_TREINAMENTO[t.status]}</Etiqueta>
                  {atual && <span>Versão {atual.numero} publicada</span>}
                  {rasc && <span>Versão {rasc.numero} em rascunho</span>}
                </span>
              </Link>
            );
          })}
        </Card>
      )}
      <Modal titulo="Novo treinamento" aberto={novo} aoFechar={() => setNovo(false)} largura="max-w-md">
        <form onSubmit={criar} className="space-y-4">
          <div><label className="label" htmlFor="nt-titulo">Título</label><input id="nt-titulo" className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus maxLength={200} /></div>
          <div><label className="label" htmlFor="nt-cat">Categoria</label><select id="nt-cat" className="select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>{ctx.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
          <p className="text-xs text-slate-500">O treinamento nasce como rascunho (versão 1). Nada fica visível aos colaboradores até ser publicado.</p>
          <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={() => setNovo(false)}>Cancelar</button><button className="btn-primary" disabled={gravando || titulo.trim().length < 3}>{gravando ? "Criando..." : "Criar rascunho"}</button></div>
        </form>
      </Modal>
    </div>
  );
}

function Grupos({ ctx, recarregar, aviso }) {
  const [edit, setEdit] = useState(null), [gravando, setGravando] = useState(false);
  const salvar = async (e) => {
    e.preventDefault(); setGravando(true);
    try { await grupoSalvar(edit); setEdit(null); await recarregar(); aviso({ tipo: "ok", texto: "Grupo salvo." }); }
    catch (ex) { aviso({ tipo: "erro", texto: ex.message }); } finally { setGravando(false); }
  };
  const alternar = (id) => setEdit((g) => ({ ...g, membros: g.membros.includes(id) ? g.membros.filter((x) => x !== id) : [...g.membros, id] }));
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setEdit({ id: null, nome: "", descricao: "", ativo: true, membros: [] })}><Plus size={16} />Novo grupo</button></div>
      {ctx.grupos.length === 0 ? <Empty>Nenhum grupo criado. Grupos permitem atribuir treinamentos a um conjunto de pessoas.</Empty> : (
        <Card className="divide-y p-0">{ctx.grupos.map((g) => (
          <button key={g.id} type="button" onClick={() => setEdit({ ...g })} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-brand-50">
            <span><span className="block font-display text-sm font-semibold">{g.nome}</span><span className="text-xs text-slate-500">{g.membros.length} pessoa(s){g.ativo ? "" : " · inativo"}</span></span>
          </button>))}</Card>)}
      <Modal titulo={edit?.id ? "Editar grupo" : "Novo grupo"} aberto={!!edit} aoFechar={() => setEdit(null)} largura="max-w-lg">
        {edit && <form onSubmit={salvar} className="space-y-4">
          <div><label className="label" htmlFor="g-nome">Nome</label><input id="g-nome" className="input" value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} maxLength={100} /></div>
          <div><label className="label" htmlFor="g-desc">Descrição</label><input id="g-desc" className="input" value={edit.descricao} onChange={(e) => setEdit({ ...edit, descricao: e.target.value })} maxLength={500} /></div>
          <fieldset><legend className="label">Membros</legend>
            <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border p-2" style={{ borderColor: "var(--hairline)" }}>{ctx.pessoas.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-700" checked={edit.membros.includes(p.id)} onChange={() => alternar(p.id)} />{p.nome}<span className="text-xs text-slate-400">{[p.cargo, p.setor].filter(Boolean).join(" · ")}</span></label>))}</div></fieldset>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-teal-700" checked={edit.ativo} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} />Grupo ativo</label>
          <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary" disabled={gravando || edit.nome.trim().length < 2}>{gravando ? "Salvando..." : "Salvar"}</button></div>
        </form>}
      </Modal>
    </div>
  );
}

function Vinculos({ aviso }) {
  const [dados, setDados] = useState(null), [erro, setErro] = useState(""), [salvando, setSalvando] = useState("");
  const carregar = useCallback(() => vinculosListar().then(setDados).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  if (erro) return <ErroModulo mensagem={erro} aoTentar={() => { setErro(""); carregar(); }} />;
  if (!dados) return <CarregandoModulo />;
  const usadas = new Set(dados.contas.map((c) => c.pessoaId).filter(Boolean));
  const mudar = async (usuario, pessoaId) => {
    setSalvando(usuario);
    try { await vinculoSalvar(usuario, pessoaId); await carregar(); aviso({ tipo: "ok", texto: "Vínculo salvo." }); }
    catch (ex) { aviso({ tipo: "erro", texto: ex.message }); } finally { setSalvando(""); }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Liga cada conta de acesso ao colaborador do RH. Sem o vínculo, a pessoa não vê treinamentos próprios. Cada colaborador pode ter uma conta.</p>
      <Card className="divide-y p-0">{dados.contas.map((c) => (
        <div key={c.usuario} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1 basis-48"><span className="block truncate font-display text-sm font-semibold">{c.nome}</span><span className="text-xs text-slate-500">{c.usuario}{c.ativo ? "" : " · inativa"}</span></span>
          <select className="select max-w-xs flex-1 basis-56" aria-label={`Colaborador de ${c.nome}`} value={c.pessoaId} disabled={salvando === c.usuario} onChange={(e) => mudar(c.usuario, e.target.value)}>
            <option value="">— sem vínculo —</option>
            {dados.pessoas.map((p) => <option key={p.id} value={p.id} disabled={usadas.has(p.id) && c.pessoaId !== p.id}>{p.nome}{usadas.has(p.id) && c.pessoaId !== p.id ? " (já vinculado)" : ""}</option>)}
          </select>
        </div>))}</Card>
    </div>
  );
}

export default function GestaoAcademy() {
  const caps = capacidadesAcademy();
  const [ctx, setCtx] = useState(null), [erro, setErro] = useState(""), [aba, setAba] = useState("treinamentos"), [aviso, setAviso] = useState(null);
  const carregar = useCallback(() => academyContexto().then(setCtx).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  if (erro) return <ErroModulo mensagem={erro} aoTentar={() => { setErro(""); carregar(); }} />;
  if (!ctx) return <CarregandoModulo />;
  const abas = [{ valor: "treinamentos", rotulo: "Treinamentos" }, ...(caps.gestao ? [{ valor: "grupos", rotulo: "Grupos" }] : []), ...(ctx.direcao ? [{ valor: "vinculos", rotulo: "Contas e colaboradores" }] : [])];
  return (
    <div className="space-y-4">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle titulo="Gestão Academy" descricao="Cadastre, versione e publique treinamentos sem programação." />
      {abas.length > 1 && <Segmented opcoes={abas} valor={aba} onChange={setAba} />}
      {aba === "treinamentos" && <ListaTreinamentos ctx={ctx} caps={caps} aviso={setAviso} />}
      {aba === "grupos" && <Grupos ctx={ctx} recarregar={carregar} aviso={setAviso} />}
      {aba === "vinculos" && <Vinculos aviso={setAviso} />}
    </div>
  );
}
