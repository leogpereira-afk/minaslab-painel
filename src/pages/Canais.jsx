// Canais MinasLab: o mural da empresa e os canais de cada setor.
// Mural geral: notícias, comunicados e eventos publicados pela gestão; parabéns
// automático no dia do aniversário; aniversariantes do mês e informativo de
// férias. Todo mundo com login no painel curte e comenta.
// Canais de setor: cada setor tem o seu, com responsáveis e membros; quem
// publica e quem vê é regra de cada canal, e o responsável pode pedir
// confirmação de leitura ("Li e entendi"). Quem pode o quê é decidido no
// servidor (ml-canais); a tela só mostra os botões.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { clsx } from "clsx";
import { Award, Cake, CheckCircle2, Hash, Heart, ImagePlus, Lock, MessageCircle, Newspaper, Palmtree, Pencil, Pin, Plus, RefreshCw, Send, Settings2, Trash2, Users } from "lucide-react";
import { PageTitle, Card, Modal, Empty, ErroModulo, Aviso, CarregandoModulo } from "../components/ui.jsx";
import Avatar from "../components/tarefas/Avatar.jsx";
import { nomeCurto } from "../lib/nomes.js";
import { TIPOS_POST, MESES, tempoRelativo, periodoFerias, fraseAniversario, visualDoPost, PALETA, ESTILOS } from "../lib/canais.js";
import ArtePost from "../components/canais/ArtePost.jsx";
import {
  canaisFeed, canaisPublicar, canaisApagarPost, canaisComentar, canaisApagarComentario, canaisCurtir, canaisConfig, canaisSalvarConfig,
  canaisDestaqueOpcoes, canaisSalvarDestaque, canaisConfirmarLeitura, canaisCanalFormulario, canaisSalvarCanal, canaisApagarCanal,
} from "../services/canais.js";

const FILTROS = [
  { id: "tudo", rotulo: "Tudo" },
  { id: "comunicado", rotulo: "Comunicados" },
  { id: "noticia", rotulo: "Notícias" },
  { id: "evento", rotulo: "Eventos" },
  { id: "aniversario", rotulo: "Aniversários" },
];

export default function Canais() {
  const [params, setParams] = useSearchParams();
  const canalId = params.get("canal") || "";
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
  const [filtro, setFiltro] = useState("tudo");
  const [editando, setEditando] = useState(null); // null | {} (novo) | post
  const [ajustes, setAjustes] = useState(false);
  const [editarDestaque, setEditarDestaque] = useState(false);
  const [previaAniv, setPreviaAniv] = useState(false);
  const [editarCanal, setEditarCanal] = useState(null); // null | "novo" | id do canal
  const rolou = useRef(false);

  const carregar = useCallback(async () => {
    try { setErro(""); setDados(await canaisFeed(canalId)); } catch (e) { setErro(e.message); }
  }, [canalId]);
  useEffect(() => { setDados(null); setFiltro("tudo"); carregar(); }, [carregar]);

  const irPara = (id) => setParams(id ? { canal: id } : {});

  const alvo = params.get("post");
  useEffect(() => {
    if (!dados || !alvo || rolou.current) return;
    rolou.current = true;
    requestAnimationFrame(() => document.getElementById(`post-${alvo}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [dados, alvo]);

  const posts = useMemo(() => (dados?.posts || []).filter((p) => filtro === "tudo" || p.tipo === filtro), [dados, filtro]);

  const mudarPost = (id, f) => setDados((d) => ({ ...d, posts: d.posts.map((p) => (String(p.id) === String(id) ? f(p) : p)) }));
  const falhou = (e) => setAviso({ tipo: "erro", texto: e.message });

  async function curtir(p) {
    const curti = !p.curti;
    mudarPost(p.id, (x) => ({ ...x, curti, curtidas: x.curtidas + (curti ? 1 : -1), quemCurtiu: curti ? [...x.quemCurtiu, dados.nome] : x.quemCurtiu.filter((n) => n !== dados.nome) }));
    try { await canaisCurtir(String(p.id)); } catch (e) { falhou(e); carregar(); }
  }
  async function comentar(p, texto) {
    try { await canaisComentar(String(p.id), texto); await carregar(); return true; } catch (e) { falhou(e); return false; }
  }
  async function apagarComentario(p, c) {
    if (!window.confirm("Apagar este comentário?")) return;
    mudarPost(p.id, (x) => ({ ...x, comentarios: x.comentarios.filter((y) => y.id !== c.id) }));
    try { await canaisApagarComentario(c.id); } catch (e) { falhou(e); carregar(); }
  }
  async function apagarPost(p) {
    if (!window.confirm(`Apagar a publicação "${p.titulo}"?`)) return;
    try { await canaisApagarPost(p.id); setAviso({ tipo: "ok", texto: "Publicação apagada." }); carregar(); } catch (e) { falhou(e); }
  }
  async function fixar(p) {
    try { await canaisPublicar({ ...p, fixado: !p.fixado, pedirLeitura: p.pedir_leitura }); carregar(); } catch (e) { falhou(e); }
  }
  async function confirmarLeitura(p) {
    mudarPost(p.id, (x) => ({ ...x, leitura: { ...x.leitura, li: true, precisoLer: false, lidos: x.leitura.lidos + 1 } }));
    try { await canaisConfirmarLeitura(p.id); carregar(); } catch (e) { falhou(e); carregar(); }
  }

  if (erro && !dados) return <ErroModulo mensagem={erro} aoTentar={carregar} />;
  if (!dados) return <CarregandoModulo />;

  const canal = dados.canal;
  const comLista = dados.canais.length > 0 || dados.gerirCanais;
  const filtros = canal ? FILTROS.filter((f) => f.id !== "aniversario") : FILTROS;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo={canal ? `# ${canal.nome}` : "Canais MinasLab"}
        descricao={canal ? canal.descricao || "Canal do setor." : "Notícias, comunicados, eventos, aniversariantes e férias da equipe. Curta e comente!"}
        acao={<div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={carregar} aria-label="Atualizar"><RefreshCw size={18} /></button>
          {!canal && dados.direcao && <button type="button" className="btn-outline" onClick={() => setAjustes(true)}><Settings2 size={16} /> Ajustes</button>}
          {canal?.podeEditar && <button type="button" className="btn-outline" onClick={() => setEditarCanal(canal.id)}><Settings2 size={16} /> Ajustar canal</button>}
          {dados.podePublicar && <button type="button" className="btn-primary" onClick={() => setEditando({})}><Plus size={16} /> Nova publicação</button>}
        </div>}
      />

      <div className={clsx("grid gap-5", comLista ? "lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_300px]" : "lg:grid-cols-[minmax(0,1fr)_320px]")}>
        {comLista && <ListaCanais canais={dados.canais} atual={canal?.id || ""} aoEscolher={irPara} aoNovo={dados.gerirCanais ? () => setEditarCanal("novo") : null} />}

        <div className="min-w-0 space-y-4">
          {canal && !dados.podeInteragir && (
            <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <Lock size={16} className="shrink-0" /> Você não é deste setor: pode ler, mas não curte nem comenta aqui.
            </p>
          )}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar publicações">
            {filtros.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)}
                className={clsx("rounded-full border px-3 py-1.5 text-sm font-medium transition", filtro === f.id ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300")}>
                {f.rotulo}
              </button>
            ))}
          </div>
          {posts.length === 0 && <Empty>{filtro !== "tudo" ? "Nada nesta categoria por enquanto." : canal ? "Nada publicado neste canal ainda." : "Nada publicado ainda."}</Empty>}
          {posts.map((p) => (
            <Post key={p.id} post={p} destaque={String(p.id) === alvo} eu={dados.eu} podeInteragir={dados.podeInteragir}
              aoCurtir={() => curtir(p)} aoComentar={(t) => comentar(p, t)} aoApagarComentario={(c) => apagarComentario(p, c)}
              aoEditar={() => setEditando(p)} aoApagar={() => apagarPost(p)} aoFixar={() => fixar(p)} aoConfirmarLeitura={() => confirmarLeitura(p)} />
          ))}
        </div>

        <aside className={clsx("space-y-4", comLista && "lg:col-start-2 xl:col-start-auto")}>
          {canal
            ? <InfoCanal canal={canal} />
            : <>
                <Destaque destaque={dados.destaque} podeEditar={dados.podePublicar} aoEditar={() => setEditarDestaque(true)} />
                <Aniversariantes lista={dados.aniversariantes} hoje={dados.hoje} aoVerPrevia={dados.direcao ? () => setPreviaAniv(true) : null} />
                <Ferias lista={dados.ferias} direcao={dados.direcao} />
              </>}
        </aside>
      </div>

      <Compositor post={editando} canal={canal} podeFixar={canal ? canal.podeEditar : dados.podePublicar} aoFechar={() => setEditando(null)}
        aoSalvar={async (p) => {
          await canaisPublicar(canal && !p.id ? { ...p, canal: canal.id } : p);
          setEditando(null);
          setAviso({ tipo: "ok", texto: p.id ? "Publicação atualizada." : canal ? "Publicado! As pessoas do canal foram avisadas no sino." : "Publicado! Todos foram avisados no sino." });
          carregar();
        }} />
      <Modal titulo="Prévia do parabéns automático" aberto={previaAniv} aoFechar={() => setPreviaAniv(false)} largura="max-w-2xl">
        <p className="mb-3 text-sm text-slate-600">É assim que o post aparece sozinho no mural, às 8h do dia do aniversário, com o nome que está no RH. Esta prévia não é publicada: ninguém mais vê.</p>
        <Post post={previaParabens(dados.nome, dados.hoje, dados.eu)} eu={dados.eu} podeInteragir aoCurtir={() => {}} aoComentar={async () => false} aoApagarComentario={() => {}} aoEditar={() => {}} aoApagar={() => {}} aoFixar={() => {}} aoConfirmarLeitura={() => {}} />
      </Modal>
      <EditarDestaque aberto={editarDestaque} aoFechar={() => setEditarDestaque(false)} aoSalvo={(postou) => { setEditarDestaque(false); setAviso({ tipo: "ok", texto: postou ? "Destaque salvo e publicado no mural. Todos foram avisados." : "Destaque do mês atualizado." }); carregar(); }} />
      <Ajustes aberto={ajustes} aoFechar={() => setAjustes(false)} aoSalvo={() => { setAjustes(false); setAviso({ tipo: "ok", texto: "Ajustes salvos." }); carregar(); }} />
      <EditarCanal alvo={editarCanal} aoFechar={() => setEditarCanal(null)}
        aoSalvo={(id, novo) => { setEditarCanal(null); setAviso({ tipo: "ok", texto: novo ? "Canal criado. As pessoas do canal foram avisadas no sino." : "Canal atualizado." }); if (id !== canalId) irPara(id); else carregar(); }}
        aoApagado={() => { setEditarCanal(null); setAviso({ tipo: "ok", texto: "Canal apagado." }); irPara(""); }} />
    </div>
  );
}

const TituloLista = ({ children }) => <p className="hidden px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:block">{children}</p>;

/* Lista de canais: coluna à esquerda no computador, faixa rolável no celular. */
function ListaCanais({ canais, atual, aoEscolher, aoNovo }) {
  const caixa = useRef(null);
  // No celular a lista é uma faixa rolável: traz o canal aberto para a vista.
  useEffect(() => { caixa.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [atual]);
  const meus = canais.filter((k) => k.meu), outros = canais.filter((k) => !k.meu);
  const item = (ativo) => clsx("flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition lg:w-full",
    ativo ? "bg-brand-50 font-semibold text-brand-800" : "bg-white text-slate-700 hover:bg-slate-50 lg:bg-transparent");
  return (
    <nav aria-label="Canais" className="min-w-0 lg:self-start">
      <Card className="!p-2">
        <div ref={caixa} className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
          <button type="button" className={item(!atual)} aria-current={!atual ? "page" : undefined} onClick={() => aoEscolher("")}>
            <Newspaper size={16} className="shrink-0" aria-hidden="true" /> <span className="flex-1">Mural geral</span>
          </button>
          {meus.length > 0 && <TituloLista>Meus setores</TituloLista>}
          {meus.map((k) => (
            <button key={k.id} type="button" className={item(atual === k.id)} aria-current={atual === k.id ? "page" : undefined} onClick={() => aoEscolher(k.id)}>
              <Hash size={16} className="shrink-0" aria-hidden="true" /> <span className="flex-1 truncate" title={k.nome}>{k.nome}</span>
              {k.pendentes > 0 && <span className="rounded-full bg-orange-600 px-1.5 py-0.5 text-xs font-bold text-white" title={`${k.pendentes} aviso(s) para confirmar leitura`}>{k.pendentes}<span className="sr-only"> aviso(s) para confirmar</span></span>}
            </button>
          ))}
          {outros.length > 0 && <TituloLista>Outros setores</TituloLista>}
          {outros.map((k) => (
            <button key={k.id} type="button" className={item(atual === k.id)} aria-current={atual === k.id ? "page" : undefined} onClick={() => aoEscolher(k.id)}>
              <Lock size={15} className="shrink-0 text-slate-400" aria-hidden="true" /> <span className="flex-1 truncate" title={k.nome}>{k.nome}</span>
            </button>
          ))}
          {aoNovo && (
            <button type="button" onClick={aoNovo} className="flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 lg:mt-2 lg:w-full lg:border-t lg:border-slate-100">
              <Plus size={16} aria-hidden="true" /> Novo canal
            </button>
          )}
        </div>
      </Card>
    </nav>
  );
}

const REGRA_PUBLICACAO = { responsaveis: "Só os responsáveis publicam", todos: "Todos do setor publicam" };
const REGRA_VISIBILIDADE = { setor: "Visível só para o setor", empresa: "Toda a empresa lê" };

function PessoaCanal({ p }) {
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <Avatar usuario={p.usuario} nome={p.nome} tamanho={28} />
      <span className="truncate text-sm text-slate-700">{nomeCurto(p.nome) || p.usuario}</span>
    </li>
  );
}

function InfoCanal({ canal }) {
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 bg-gradient-to-r from-teal-50 to-sky-50 px-4 py-3">
        <Users size={18} className="text-teal-700" />
        <h2 className="font-display font-bold text-slate-800">Sobre o canal</h2>
      </div>
      <div className="space-y-4 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">{REGRA_PUBLICACAO[canal.publicacao]}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{REGRA_VISIBILIDADE[canal.visibilidade]}</span>
        </div>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{canal.responsaveis.length > 1 ? "Responsáveis" : "Responsável"}</h3>
          <ul>{canal.responsaveis.map((p) => <PessoaCanal key={p.usuario} p={p} />)}</ul>
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Equipe · {canal.membros.length}</h3>
          {canal.membros.length === 0 && <p className="py-1.5 text-sm text-slate-500">Ninguém além dos responsáveis.</p>}
          <ul className="max-h-72 overflow-auto">{canal.membros.map((p) => <PessoaCanal key={p.usuario} p={p} />)}</ul>
        </section>
      </div>
    </Card>
  );
}

function EditarCanal({ alvo, aoFechar, aoSalvo, aoApagado }) {
  const [op, setOp] = useState(null);
  const [f, setF] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!alvo) return;
    setOp(null); setF(null); setErro("");
    canaisCanalFormulario(alvo === "novo" ? "" : alvo).then((r) => {
      setOp(r);
      const k = r.canal;
      setF(k
        ? { id: k.id, nome: k.nome, descricao: k.descricao, responsaveis: k.responsaveis, membros: k.membros.filter((u) => !k.responsaveis.includes(u)), publicacao: k.publicacao, visibilidade: k.visibilidade }
        : { nome: "", descricao: "", responsaveis: [], membros: [], publicacao: "responsaveis", visibilidade: "setor" });
    }).catch((e) => setErro(e.message));
  }, [alvo]);
  const alternar = (campo, u) => setF((x) => ({ ...x, [campo]: x[campo].includes(u) ? x[campo].filter((y) => y !== u) : [...x[campo], u] }));
  async function salvar(e) {
    e.preventDefault();
    setSalvando(true); setErro("");
    try { const r = await canaisSalvarCanal(f); aoSalvo(r.id, !f.id); } catch (er) { setErro(er.message); }
    setSalvando(false);
  }
  async function apagar() {
    if (!window.confirm(`Apagar o canal "${f.nome}"? As publicações dele deixam de aparecer para todos.`)) return;
    setSalvando(true); setErro("");
    try { await canaisApagarCanal(f.id); aoApagado(); } catch (er) { setErro(er.message); }
    setSalvando(false);
  }
  const opcao = (campo, valor, titulo, dica) => (
    <label key={valor} className={clsx("flex cursor-pointer items-start gap-2.5 rounded-xl border p-3", f[campo] === valor ? "border-brand bg-brand-50/50" : "border-slate-200")}>
      <input type="radio" name={campo} className="mt-1" checked={f[campo] === valor} onChange={() => setF((x) => ({ ...x, [campo]: valor }))} />
      <span><span className="block text-sm font-semibold text-slate-800">{titulo}</span><span className="block text-xs text-slate-500">{dica}</span></span>
    </label>
  );
  return (
    <Modal titulo={alvo === "novo" ? "Novo canal de setor" : "Ajustar canal"} aberto={!!alvo} aoFechar={aoFechar} largura="max-w-2xl">
      {!f && !erro && <p className="text-sm text-slate-500">Carregando…</p>}
      {erro && <p className="mb-3 text-sm text-bad-700" role="alert">{erro}</p>}
      {f && op && (
        <form onSubmit={salvar} className="space-y-4">
          <label className="block"><span className="label">Nome do canal</span>
            <input className="input w-full" value={f.nome} maxLength={60} required autoFocus placeholder="Ex.: Microbiologia" onChange={(e) => setF((x) => ({ ...x, nome: e.target.value }))} /></label>
          <label className="block"><span className="label">Descrição (opcional)</span>
            <input className="input w-full" value={f.descricao} maxLength={300} placeholder="Para que serve este canal" onChange={(e) => setF((x) => ({ ...x, descricao: e.target.value }))} /></label>
          <fieldset>
            <legend className="label">Responsáveis</legend>
            <p className="mb-2 text-xs text-slate-500">{op.trocarResponsaveis ? "Publicam, fixam avisos, pedem confirmação de leitura e moderam os comentários." : "Só a direção troca os responsáveis."}</p>
            <div className="grid max-h-48 gap-1 overflow-auto sm:grid-cols-2">
              {op.contas.map((c) => (
                <label key={c.usuario} className={clsx("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm", op.trocarResponsaveis ? "hover:bg-slate-50" : "opacity-70")}>
                  <input type="checkbox" disabled={!op.trocarResponsaveis} checked={f.responsaveis.includes(c.usuario)} onChange={() => alternar("responsaveis", c.usuario)} /> {nomeCurto(c.nome) || c.usuario}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Equipe do setor</legend>
            <p className="mb-2 text-xs text-slate-500">Quem entra recebe um aviso no sino.</p>
            <div className="grid max-h-48 gap-1 overflow-auto sm:grid-cols-2">
              {op.contas.filter((c) => !f.responsaveis.includes(c.usuario)).map((c) => (
                <label key={c.usuario} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={f.membros.includes(c.usuario)} onChange={() => alternar("membros", c.usuario)} /> {nomeCurto(c.nome) || c.usuario}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="label">Quem pode publicar</legend>
            {opcao("publicacao", "responsaveis", "Só os responsáveis", "Mural de avisos: a equipe lê, curte, comenta e confirma leitura.")}
            {opcao("publicacao", "todos", "Todos do setor", "Qualquer pessoa da equipe pode publicar.")}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="label">Quem pode ver</legend>
            {opcao("visibilidade", "setor", "Só o setor", "O canal não aparece para os outros setores.")}
            {opcao("visibilidade", "empresa", "Toda a empresa, só leitura", "Outros setores leem, mas não curtem nem comentam.")}
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2">
            {op.apagar && <button type="button" className="btn-ghost mr-auto text-bad-600" disabled={salvando} onClick={apagar}><Trash2 size={16} /> Apagar canal</button>}
            <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Salvando…" : f.id ? "Salvar" : "Criar canal"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Post({ post: p, destaque, eu, podeInteragir, aoCurtir, aoComentar, aoApagarComentario, aoEditar, aoApagar, aoFixar, aoConfirmarLeitura }) {
  const tipo = TIPOS_POST[p.tipo] || TIPOS_POST.noticia;
  const aniv = p.tipo === "aniversario";
  const [abrirComentarios, setAbrirComentarios] = useState(p.comentarios.length > 0 && p.comentarios.length <= 3);
  const visual = aniv ? null : visualDoPost(p);
  const comArte = visual && visual.estilo !== "simples";
  return (
    <Card id={`post-${p.id}`} className={clsx("scroll-mt-20 overflow-hidden !p-0", destaque && "ring-2 ring-brand-400", aniv && "border-pink-200")}>
      {aniv && (
        <div className="flex items-center gap-4 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 px-5 py-6 text-white">
          <FotoAniversariante post={p} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">{p.hoje ? "Aniversário hoje" : `Aniversário em ${String(p.dia).padStart(2, "0")}/${String(p.mes).padStart(2, "0")}`}</p>
            <h2 className="font-display text-xl font-bold leading-tight">{p.titulo}</h2>
          </div>
        </div>
      )}
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {aniv
            ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand"><Cake size={18} /></span>
            : <Avatar usuario={p.autor} nome={p.autor_nome} tamanho={36} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800">{aniv ? "Canais MinasLab" : nomeCurto(p.autor_nome) || p.autor}</span>
              <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", tipo.cor)}>{tipo.rotulo}</span>
              {p.fixado && <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><Pin size={12} /> Fixado</span>}
            </div>
            <p className="text-xs text-slate-500">{tempoRelativo(p.criado_em)}{p.editado_em ? " · editado" : ""}</p>
          </div>
          {p.podeMexer && !aniv && (
            <div className="flex shrink-0 gap-1">
              {p.podeModerar && <button type="button" className="btn-ghost h-9 w-9 p-0" title={p.fixado ? "Desafixar" : "Fixar no topo"} aria-label={p.fixado ? "Desafixar" : "Fixar no topo"} onClick={aoFixar}><Pin size={16} className={p.fixado ? "text-brand" : ""} /></button>}
              <button type="button" className="btn-ghost h-9 w-9 p-0" title="Editar" aria-label="Editar" onClick={aoEditar}><Pencil size={16} /></button>
              <button type="button" className="btn-ghost h-9 w-9 p-0 text-bad-600" title="Apagar" aria-label="Apagar" onClick={aoApagar}><Trash2 size={16} /></button>
            </div>
          )}
        </div>
        {comArte && <div className="-mx-4 overflow-hidden sm:-mx-5"><ArtePost titulo={p.titulo} tipo={p.tipo} visual={visual} /></div>}
        {!aniv && !comArte && <h2 className="font-display text-lg font-bold leading-snug text-slate-900">{p.titulo}</h2>}
        {p.texto && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">{p.texto}</p>}
        {p.imagemUrl && (
          // A imagem aparece INTEIRA (cartaz A4 em pé, foto deitada ou quadrada), sem corte; clicar abre no tamanho real.
          <a href={p.imagemUrl} target="_blank" rel="noopener noreferrer" className="block" aria-label="Abrir a imagem em tamanho real">
            <img src={p.imagemUrl} alt="" loading="lazy" className="mx-auto max-h-[85vh] w-auto max-w-full rounded-xl border border-slate-100 object-contain" referrerPolicy="no-referrer" />
          </a>
        )}
        {p.leitura && <Leitura l={p.leitura} podeConfirmar={podeInteragir && p.leitura.precisoLer} aoConfirmar={aoConfirmarLeitura} />}

        <div className="flex items-center gap-1 border-t border-slate-100 pt-2">
          <button type="button" onClick={aoCurtir} aria-pressed={p.curti} disabled={!podeInteragir}
            className={clsx("inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-default disabled:hover:bg-transparent", p.curti ? "text-pink-600" : "text-slate-600 hover:bg-slate-50")}>
            <Heart size={18} className={p.curti ? "fill-pink-500 text-pink-500" : ""} /> {aniv ? "Parabéns" : "Curtir"}{p.curtidas ? ` · ${p.curtidas}` : ""}
          </button>
          <button type="button" onClick={() => setAbrirComentarios((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <MessageCircle size={18} /> Comentar{p.comentarios.length ? ` · ${p.comentarios.length}` : ""}
          </button>
        </div>
        {p.curtidas > 0 && <p className="-mt-1 text-xs text-slate-500" title={p.quemCurtiu.join(", ")}>❤️ {resumoCurtidas(p.quemCurtiu)}</p>}

        {abrirComentarios && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3">
            {p.comentarios.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar usuario={c.usuario} nome={c.nome} tamanho={28} />
                <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 shadow-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800">{nomeCurto(c.nome) || c.usuario}</span>
                    <span className="shrink-0 text-xs text-slate-400">{tempoRelativo(c.criado_em)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{c.texto}</p>
                  {(c.usuario === eu || p.podeModerar) && <button type="button" onClick={() => aoApagarComentario(c)} className="mt-1 text-xs text-slate-400 hover:text-bad-600">apagar</button>}
                </div>
              </div>
            ))}
            {podeInteragir && <NovoComentario aoEnviar={aoComentar} placeholder={aniv ? "Deixe seu recado de parabéns…" : "Escreva um comentário…"} />}
            {!podeInteragir && p.comentarios.length === 0 && <p className="text-sm text-slate-500">Nenhum comentário.</p>}
          </div>
        )}
      </div>
    </Card>
  );
}

/* Confirmação de leitura de um aviso do canal: barra, botão "Li e entendi" e, para quem modera, quem falta. */
function Leitura({ l, podeConfirmar, aoConfirmar }) {
  const pct = l.total ? Math.round((l.lidos / l.total) * 100) : 0;
  return (
    <div className="space-y-2 rounded-xl bg-teal-50/70 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-teal-100" role="progressbar" aria-valuemin={0} aria-valuemax={l.total} aria-valuenow={l.lidos} aria-label="Confirmações de leitura">
          <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-semibold text-teal-900">{l.lidos} de {l.total} confirmaram a leitura</span>
        {podeConfirmar && <button type="button" className="btn-primary" onClick={aoConfirmar}><CheckCircle2 size={16} /> Li e entendi</button>}
        {l.li && <span className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><CheckCircle2 size={16} /> Você confirmou</span>}
      </div>
      {l.faltam && l.faltam.length > 0 && (
        <details className="text-sm text-slate-700">
          <summary className="cursor-pointer font-medium text-teal-800">Falta{l.faltam.length > 1 ? "m" : ""} {l.faltam.length}</summary>
          <p className="mt-1">{l.faltam.map((n) => nomeCurto(n) || n).join(", ")}</p>
        </details>
      )}
    </div>
  );
}

function previaParabens(nome, hoje, eu) {
  const n = nomeCurto(nome) || "Colaborador";
  return {
    id: "previa", tipo: "aniversario", titulo: `Feliz aniversário, ${n}! 🎂`,
    texto: `Hoje é dia de comemorar! A família MinasLab deseja a você, ${n}, um novo ano cheio de saúde, alegria e conquistas. Deixe aqui o seu recado de parabéns 🎉`,
    hoje: true, dia: Number(hoje.slice(8, 10)), mes: Number(hoje.slice(5, 7)), criado_em: `${hoje}T08:00:00-03:00`,
    curtidas: 0, curti: false, quemCurtiu: [], comentarios: [], nome: n, usuario: eu,
  };
}

function FotoAniversariante({ post: p }) {
  if (p.foto) return <img src={p.foto} alt={p.nome || ""} className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-white/70 shadow-lg" />;
  if (p.usuario) return <span className="shrink-0 rounded-full ring-4 ring-white/70 shadow-lg"><Avatar usuario={p.usuario} nome={p.nome} tamanho={80} /></span>;
  return <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-white/20 text-4xl" aria-hidden="true">🎂</span>;
}

function resumoCurtidas(nomes) {
  if (nomes.length <= 2) return nomes.join(" e ");
  return `${nomes.slice(0, 2).join(", ")} e mais ${nomes.length - 2}`;
}

function NovoComentario({ aoEnviar, placeholder }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    if (await aoEnviar(texto)) setTexto("");
    setEnviando(false);
  }
  return (
    <form onSubmit={enviar} className="flex gap-2">
      <input className="input flex-1" value={texto} maxLength={1000} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} aria-label="Comentário" />
      <button type="submit" className="btn-primary px-3" disabled={!texto.trim() || enviando} aria-label="Enviar comentário"><Send size={16} /></button>
    </form>
  );
}

// Foto de quem faz aniversário na lista do mês; sem foto (ou foto quebrada), as iniciais. Hoje ganha um anel rosa.
function FotoDaLista({ a, hoje, passou }) {
  const [quebrada, setQuebrada] = useState(false);
  useEffect(() => { setQuebrada(false); }, [a.foto]);
  const comFoto = a.foto && !quebrada;
  return (
    <span className={clsx("grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full font-display text-sm font-bold", hoje ? "bg-pink-100 text-pink-700 ring-2 ring-pink-400 ring-offset-2" : passou ? "bg-slate-100 text-slate-400" : "bg-amber-100 text-amber-800")} aria-hidden="true">
      {comFoto ? <img src={a.foto} alt="" width={44} height={44} loading="lazy" className={clsx("h-full w-full object-cover", passou && "opacity-80")} onError={() => setQuebrada(true)} /> : iniciaisNome(a.nome)}
    </span>
  );
}

function Aniversariantes({ lista, hoje, aoVerPrevia }) {
  const mes = Number(hoje.slice(5, 7)), dia = Number(hoje.slice(8, 10));
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 bg-gradient-to-r from-pink-50 to-amber-50 px-4 py-3">
        <Cake size={18} className="text-pink-600" />
        <h2 className="flex-1 font-display font-bold text-slate-800">Aniversariantes de {MESES[mes - 1]}</h2>
        {aoVerPrevia && <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={aoVerPrevia}>Prévia</button>}
      </div>
      <ul className="divide-y divide-slate-100">
        {lista.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Nenhum aniversariante cadastrado neste mês.</li>}
        {lista.map((a) => (
          <li key={a.pessoaId} className={clsx("flex items-center gap-3 px-4 py-2.5", a.dia === dia && "bg-pink-50/60")}>
            <FotoDaLista a={a} hoje={a.dia === dia} passou={a.dia < dia} />
            <div className="min-w-0 flex-1">
              <p className={clsx("truncate text-sm font-semibold", a.dia < dia ? "text-slate-500" : "text-slate-800")}>{a.nome}</p>
              <p className={clsx("text-xs", a.dia === dia ? "font-semibold text-pink-600" : "text-slate-500")}>{fraseAniversario(a, dia)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const nomeMes = (mes) => (mes ? `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}` : "");
const iniciaisNome = (n) => String(n || "?").trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p)).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const tituloNome = nomeCurto;

function Destaque({ destaque: d, podeEditar, aoEditar }) {
  if (!d && !podeEditar) return null;
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3">
        <Award size={18} className="text-amber-600" />
        <h2 className="flex-1 font-display font-bold text-slate-800">Destaque do mês</h2>
        {podeEditar && <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={aoEditar}>{d ? "Trocar" : "Escolher"}</button>}
      </div>
      {!d && <p className="px-4 py-3 text-sm text-slate-500">Escolha o funcionário do mês para aparecer aqui.</p>}
      {d && (
        <div className="px-4 py-4 text-center">
          <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-amber-100 font-display text-2xl font-bold text-amber-700 ring-4 ring-amber-300 ring-offset-2">
            {d.foto ? <img src={d.foto} alt="" className="h-full w-full object-cover" /> : iniciaisNome(d.nome)}
          </div>
          <p className="mt-3 font-display text-lg font-bold leading-tight text-slate-900">{tituloNome(d.nome)}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">🏆 {nomeMes(d.mes)}</p>
          {d.itens?.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-left">
              {d.itens.map((it, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700"><span className="text-amber-500">★</span><span>{it.rotulo && <b className="font-semibold text-slate-800">{it.rotulo}: </b>}{it.texto}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function mesAnterior() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function EditarDestaque({ aberto, aoFechar, aoSalvo }) {
  const [op, setOp] = useState(null);
  const [f, setF] = useState({ nome: "", fotoId: "", mes: mesAnterior(), itens: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setOp(null); setErro("");
    canaisDestaqueOpcoes().then((r) => {
      setOp(r);
      const a = r.atual;
      setF(a ? { nome: a.nome, fotoId: a.fotoId || "", mes: a.mes, itens: (a.itens || []).map((i) => (i.rotulo ? `${i.rotulo}: ${i.texto}` : i.texto)).join("\n") } : { nome: "", fotoId: "", mes: mesAnterior(), itens: "" });
    }).catch((e) => setErro(e.message));
  }, [aberto]);
  async function salvar(corpo) {
    setSalvando(true); setErro("");
    try { const r = await canaisSalvarDestaque(corpo); aoSalvo(!!r?.postId); } catch (e) { setErro(e.message); }
    setSalvando(false);
  }
  const postar = () => {
    if (!f.nome || !f.mes) { setErro("Escolha quem é o destaque e o mês."); return; }
    if (window.confirm("Salvar e publicar no mural? Todos recebem um aviso no sino e no grupo MinasLab.")) salvar({ ...f, postar: true });
  };
  return (
    <Modal titulo="Destaque do mês" aberto={aberto} aoFechar={aoFechar}>
      {!op && !erro && <p className="text-sm text-slate-500">Carregando…</p>}
      {erro && <p className="mb-3 text-sm text-bad-700" role="alert">{erro}</p>}
      {op && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); salvar(f); }}>
          <label className="block"><span className="label">Quem</span>
            <select className="input w-full" value={f.nome} required onChange={(e) => { const p = op.pessoas.find((x) => x.nome === e.target.value); setF((x) => ({ ...x, nome: e.target.value, fotoId: p?.fotoId || "" })); }}>
              <option value="">Escolha…</option>
              {op.pessoas.map((p) => <option key={p.nome} value={p.nome}>{tituloNome(p.nome)}{p.fotoId ? " 📷" : ""}</option>)}
            </select>
          </label>
          <label className="block"><span className="label">Mês</span>
            <input className="input w-full" type="month" value={f.mes} required onChange={(e) => setF((x) => ({ ...x, mes: e.target.value }))} /></label>
          <label className="block"><span className="label">Por que (uma linha por qualidade, até 4)</span>
            <textarea className="input min-h-[110px] w-full" value={f.itens} placeholder={"Laboratório: excelência nos processos\nDesempenho: prontidão e agilidade"} onChange={(e) => setF((x) => ({ ...x, itens: e.target.value }))} /></label>
          <p className="text-xs text-slate-500">A foto vem de Gestão › Destaque do mês › Fotos (📷 = tem foto). Use foto só com autorização da pessoa.</p>
          <div className="flex flex-wrap justify-end gap-2">
            {op.atual && <button type="button" className="btn-ghost mr-auto text-bad-600" disabled={salvando} onClick={() => window.confirm("Tirar o destaque do mural?") && salvar({ limpar: true })}>Tirar do mural</button>}
            <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
            <button type="submit" className="btn-outline" disabled={salvando}>Só salvar</button>
            <button type="button" className="btn-primary" disabled={salvando} onClick={postar}><Send size={16} /> {salvando ? "Salvando…" : "Salvar e postar no mural"}</button>
          </div>
          <p className="text-xs text-slate-500">“Só salvar” atualiza o quadro da lateral. “Salvar e postar” também cria uma publicação no mural, com a foto e as qualidades, para todos curtirem e comentarem.</p>
        </form>
      )}
    </Modal>
  );
}

function Ferias({ lista, direcao }) {
  const agora = lista.filter((f) => f.emCurso), proximas = lista.filter((f) => !f.emCurso);
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 bg-gradient-to-r from-sky-50 to-emerald-50 px-4 py-3">
        <Palmtree size={18} className="text-sky-600" />
        <h2 className="font-display font-bold text-slate-800">Informativo de férias</h2>
      </div>
      {lista.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Ninguém de férias agora nem nos próximos 30 dias.</p>}
      {agora.length > 0 && <>
        <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-sky-700">De férias agora</p>
        <ul className="divide-y divide-slate-100">{agora.map((f, i) => <Linha key={i} f={f} />)}</ul>
      </>}
      {proximas.length > 0 && <>
        <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-emerald-700">Próximos 30 dias</p>
        <ul className="divide-y divide-slate-100">{proximas.map((f, i) => <Linha key={i} f={f} />)}</ul>
      </>}
      {direcao && <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">Vem do RH. <Link to="/rh?aba=ferias" className="font-semibold text-brand-700 hover:underline">Lançar férias no RH</Link></p>}
    </Card>
  );
}

function Linha({ f }) {
  return (
    <li className="px-4 py-2.5">
      <p className="text-sm font-medium text-slate-800">{f.nome}</p>
      <p className="text-xs text-slate-500">{periodoFerias(f)}</p>
    </li>
  );
}

const VAZIO = { tipo: "noticia", titulo: "", texto: "", imagem: "", fixado: false, visual: {}, pedirLeitura: false };

/* Reduz a foto no navegador antes de enviar: até 1600 px no lado maior, JPEG. */
function reduzirFoto(arquivo, max = 1600) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      ok(cv.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("Não consegui abrir essa imagem.")); };
    img.src = url;
  });
}

/* Escolha do visual: estilo, cor da paleta e prévia ao vivo do cartão. */
function EscolhaVisual({ f, temFoto, aoMudar }) {
  const v = f.visual || {};
  const efetivo = visualDoPost({ ...f, id: f.id || f.titulo || "novo", imagem: temFoto ? "x" : "", visual: v });
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div>
        <span className="label">Visual do cartão</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Estilo">
          {ESTILOS.map((e) => (
            <button key={e.id} type="button" role="radio" aria-checked={(v.estilo || "auto") === e.id} title={e.dica} onClick={() => aoMudar({ estilo: e.id })}
              className={clsx("rounded-full border px-3 py-1 text-xs font-semibold", (v.estilo || "auto") === e.id ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600 hover:border-brand-300")}>
              {e.rotulo}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">Cor:</span>
        <button type="button" onClick={() => aoMudar({ cor: "auto" })} className={clsx("rounded-full border px-2.5 py-0.5 text-xs", (v.cor || "auto") === "auto" ? "border-brand font-semibold text-brand-700" : "border-slate-200 text-slate-500")}>Variar</button>
        {Object.values(PALETA).map((c) => (
          <button key={c.nome} type="button" title={c.rotulo} aria-label={`Cor ${c.rotulo}`} aria-pressed={v.cor === c.nome} onClick={() => aoMudar({ cor: c.nome })}
            className={clsx("h-7 w-7 rounded-full border-2 transition", v.cor === c.nome ? "scale-110 border-slate-900" : "border-white shadow")} style={{ background: c.base }} />
        ))}
      </div>
      {efetivo.estilo === "numero" && <label className="block"><span className="label">Número em destaque</span><input className="input w-full" maxLength={40} value={v.destaque || ""} onChange={(e) => aoMudar({ destaque: e.target.value })} placeholder="Ex.: 471 ou 20%" /></label>}
      {efetivo.estilo === "evento" && <label className="block"><span className="label">Data do evento</span><input className="input w-full" type="date" value={v.data || ""} onChange={(e) => aoMudar({ data: e.target.value })} /></label>}
      {efetivo.estilo !== "simples" && f.titulo && (
        <div>
          <span className="label">Prévia</span>
          <div className="overflow-hidden rounded-xl border border-slate-200"><ArtePost titulo={f.titulo} tipo={f.tipo} visual={efetivo} /></div>
        </div>
      )}
      {efetivo.estilo === "simples" && temFoto && (v.estilo || "auto") === "auto" && <p className="text-xs text-slate-500">Com foto, o automático mostra só a foto. Escolha um estilo para ter a arte também.</p>}
    </div>
  );
}

function Compositor({ post, canal, podeFixar, aoFechar, aoSalvar }) {
  const [f, setF] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [foto, setFoto] = useState(null);
  const [previaAntiga, setPreviaAntiga] = useState("");
  useEffect(() => {
    if (post) {
      setF({ ...VAZIO, ...(post.id ? { id: post.id, tipo: post.tipo, titulo: post.titulo, texto: post.texto, imagem: post.imagem, fixado: post.fixado, visual: post.visual || {}, pedirLeitura: !!post.pedir_leitura } : {}) });
      setFoto(null); setPreviaAntiga(post.id ? post.imagemUrl || "" : ""); setErro("");
    }
  }, [post]);
  const ehLink = f.imagem.startsWith("https://");
  const previa = foto || (ehLink ? f.imagem : f.imagem ? previaAntiga : "");
  async function anexar(e) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    try { setErro(""); setFoto(await reduzirFoto(arq)); } catch (er) { setErro(er.message); }
  }
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  async function salvar(e) {
    e.preventDefault();
    setSalvando(true); setErro("");
    try { await aoSalvar(foto ? { ...f, foto } : f); } catch (er) { setErro(er.message); }
    setSalvando(false);
  }
  return (
    <Modal titulo={f.id ? "Editar publicação" : "Nova publicação"} aberto={!!post} aoFechar={aoFechar} largura="max-w-2xl">
      <form onSubmit={salvar} className="space-y-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo">
          {["comunicado", "noticia", "evento"].map((t) => (
            <button key={t} type="button" role="radio" aria-checked={f.tipo === t} onClick={() => setF((x) => ({ ...x, tipo: t }))}
              className={clsx("rounded-full border px-3 py-1.5 text-sm font-medium", f.tipo === t ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600")}>
              {TIPOS_POST[t].rotulo}
            </button>
          ))}
        </div>
        <label className="block"><span className="label">Título</span>
          <input className="input w-full" value={f.titulo} onChange={set("titulo")} maxLength={160} required autoFocus /></label>
        <label className="block"><span className="label">Texto</span>
          <textarea className="input min-h-[160px] w-full" value={f.texto} onChange={set("texto")} maxLength={6000} /></label>
        <div>
          <span className="label">Foto (opcional)</span>
          {previa
            ? <div className="relative inline-block">
                <img src={previa} alt="Prévia da foto" className="max-h-56 rounded-xl border object-contain" referrerPolicy="no-referrer" />
                <button type="button" className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-bad-700 shadow" onClick={() => { setFoto(null); setF((x) => ({ ...x, imagem: "" })); }}>Tirar foto</button>
              </div>
            : <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 hover:border-brand-300 hover:bg-brand-50/40">
                <ImagePlus size={24} className="text-brand-600" />
                <span className="font-semibold text-brand-700">Anexar foto</span>
                <span className="text-xs">JPG, PNG ou WEBP · do computador ou do celular</span>
                <input type="file" accept="image/*" className="sr-only" onChange={anexar} />
              </label>}
          {!previa && <input className="input mt-2 w-full" type="url" value={f.imagem} onChange={set("imagem")} placeholder="ou cole o link de uma imagem (https://…)" aria-label="Link de uma imagem" />}
        </div>
        <EscolhaVisual f={f} temFoto={!!previa} aoMudar={(v) => setF((x) => ({ ...x, visual: { ...x.visual, ...v } }))} />
        {podeFixar && <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.fixado} onChange={set("fixado")} /> {canal ? "Fixar no topo do canal" : "Fixar no topo do mural"}
        </label>}
        {canal && <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5" checked={f.pedirLeitura} onChange={set("pedirLeitura")} />
          <span>Pedir confirmação de leitura<span className="block text-xs text-slate-500">Cada pessoa do canal clica em “Li e entendi” e você acompanha quem falta.</span></span>
        </label>}
        {!f.id && <p className="text-xs text-slate-500">{canal ? `Ao publicar, as pessoas do canal ${canal.nome} recebem um aviso no sino.` : "Ao publicar, todos com login no painel recebem um aviso no sino."}</p>}
        {erro && <p className="text-sm text-bad-700" role="alert">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Salvando…" : f.id ? "Salvar" : "Publicar"}</button>
        </div>
      </form>
    </Modal>
  );
}

function Ajustes({ aberto, aoFechar, aoSalvo }) {
  const [cfg, setCfg] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setCfg(null); setErro("");
    canaisConfig().then(setCfg).catch((e) => setErro(e.message));
  }, [aberto]);
  const alternar = (campo, v) => setCfg((c) => ({ ...c, [campo]: c[campo].includes(v) ? c[campo].filter((x) => x !== v) : [...c[campo], v] }));
  async function salvar() {
    setSalvando(true);
    try { await canaisSalvarConfig({ publicadores: cfg.publicadores, ocultos: cfg.ocultos }); aoSalvo(); } catch (e) { setErro(e.message); }
    setSalvando(false);
  }
  return (
    <Modal titulo="Ajustes do Canais" aberto={aberto} aoFechar={aoFechar} largura="max-w-2xl">
      {!cfg && !erro && <p className="text-sm text-slate-500">Carregando…</p>}
      {erro && <p className="text-sm text-bad-700" role="alert">{erro}</p>}
      {cfg && (
        <div className="space-y-5">
          <section>
            <h3 className="font-display font-semibold text-slate-800">Quem pode publicar</h3>
            <p className="mb-2 text-xs text-slate-500">A direção sempre pode. Marque outras pessoas da gestão.</p>
            <div className="grid max-h-56 gap-1 overflow-auto sm:grid-cols-2">
              {cfg.contas.map((c) => (
                <label key={c.usuario} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={cfg.publicadores.includes(c.usuario)} onChange={() => alternar("publicadores", c.usuario)} /> {c.nome}
                </label>
              ))}
            </div>
          </section>
          <section>
            <h3 className="font-display font-semibold text-slate-800">Fora dos aniversários</h3>
            <p className="mb-2 text-xs text-slate-500">Para quem pediu para não ter o aniversário divulgado. A data vem da ficha do RH (só dia e mês aparecem).</p>
            <div className="grid max-h-56 gap-1 overflow-auto sm:grid-cols-2">
              {cfg.pessoas.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={cfg.ocultos.includes(p.id)} onChange={() => alternar("ocultos", p.id)} /> {p.nome}
                  {!p.temData && <span className="text-xs text-warn-700">(sem data na ficha)</span>}
                </label>
              ))}
            </div>
          </section>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
