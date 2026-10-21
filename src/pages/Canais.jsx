// Canais MinasLab: o mural da empresa. Notícias, comunicados e eventos
// publicados pela gestão; parabéns automático no dia do aniversário;
// aniversariantes do mês e informativo de férias. Todo mundo com login no
// painel curte e comenta. Quem pode o quê é decidido no servidor (ml-canais).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { clsx } from "clsx";
import { Award, Cake, Heart, ImagePlus, MessageCircle, Palmtree, Pencil, Pin, Plus, RefreshCw, Send, Settings2, Trash2 } from "lucide-react";
import { PageTitle, Card, Modal, Empty, ErroModulo, Aviso, CarregandoModulo } from "../components/ui.jsx";
import Avatar from "../components/tarefas/Avatar.jsx";
import { TIPOS_POST, MESES, tempoRelativo, periodoFerias } from "../lib/canais.js";
import {
  canaisFeed, canaisPublicar, canaisApagarPost, canaisComentar, canaisApagarComentario, canaisCurtir, canaisConfig, canaisSalvarConfig,
  canaisDestaqueOpcoes, canaisSalvarDestaque,
} from "../services/canais.js";

const FILTROS = [
  { id: "tudo", rotulo: "Tudo" },
  { id: "comunicado", rotulo: "Comunicados" },
  { id: "noticia", rotulo: "Notícias" },
  { id: "evento", rotulo: "Eventos" },
  { id: "aniversario", rotulo: "Aniversários" },
];

export default function Canais() {
  const [params] = useSearchParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null);
  const [filtro, setFiltro] = useState("tudo");
  const [editando, setEditando] = useState(null); // null | {} (novo) | post
  const [ajustes, setAjustes] = useState(false);
  const [editarDestaque, setEditarDestaque] = useState(false);
  const rolou = useRef(false);

  const carregar = useCallback(async () => {
    try { setErro(""); setDados(await canaisFeed()); } catch (e) { setErro(e.message); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

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
    try { await canaisPublicar({ ...p, fixado: !p.fixado }); carregar(); } catch (e) { falhou(e); }
  }

  if (erro && !dados) return <ErroModulo mensagem={erro} aoTentar={carregar} />;
  if (!dados) return <CarregandoModulo />;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="Canais MinasLab"
        descricao="Notícias, comunicados, eventos, aniversariantes e férias da equipe. Curta e comente!"
        acao={<div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={carregar} aria-label="Atualizar"><RefreshCw size={18} /></button>
          {dados.direcao && <button type="button" className="btn-outline" onClick={() => setAjustes(true)}><Settings2 size={16} /> Ajustes</button>}
          {dados.podePublicar && <button type="button" className="btn-primary" onClick={() => setEditando({})}><Plus size={16} /> Nova publicação</button>}
        </div>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar publicações">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)}
                className={clsx("rounded-full border px-3 py-1.5 text-sm font-medium transition", filtro === f.id ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300")}>
                {f.rotulo}
              </button>
            ))}
          </div>
          {posts.length === 0 && <Empty>{filtro === "tudo" ? "Nada publicado ainda." : "Nada nesta categoria por enquanto."}</Empty>}
          {posts.map((p) => (
            <Post key={p.id} post={p} destaque={String(p.id) === alvo} eu={dados.eu} podePublicar={dados.podePublicar}
              aoCurtir={() => curtir(p)} aoComentar={(t) => comentar(p, t)} aoApagarComentario={(c) => apagarComentario(p, c)}
              aoEditar={() => setEditando(p)} aoApagar={() => apagarPost(p)} aoFixar={() => fixar(p)} />
          ))}
        </div>

        <aside className="space-y-4">
          <Destaque destaque={dados.destaque} podeEditar={dados.podePublicar} aoEditar={() => setEditarDestaque(true)} />
          <Aniversariantes lista={dados.aniversariantes} hoje={dados.hoje} />
          <Ferias lista={dados.ferias} direcao={dados.direcao} />
        </aside>
      </div>

      <Compositor post={editando} aoFechar={() => setEditando(null)}
        aoSalvar={async (p) => { await canaisPublicar(p); setEditando(null); setAviso({ tipo: "ok", texto: p.id ? "Publicação atualizada." : "Publicado! Todos foram avisados no sino." }); carregar(); }} />
      <EditarDestaque aberto={editarDestaque} aoFechar={() => setEditarDestaque(false)} aoSalvo={() => { setEditarDestaque(false); setAviso({ tipo: "ok", texto: "Destaque do mês atualizado." }); carregar(); }} />
      <Ajustes aberto={ajustes} aoFechar={() => setAjustes(false)} aoSalvo={() => { setAjustes(false); setAviso({ tipo: "ok", texto: "Ajustes salvos." }); carregar(); }} />
    </div>
  );
}

function Post({ post: p, destaque, eu, podePublicar, aoCurtir, aoComentar, aoApagarComentario, aoEditar, aoApagar, aoFixar }) {
  const tipo = TIPOS_POST[p.tipo] || TIPOS_POST.noticia;
  const aniv = p.tipo === "aniversario";
  const [abrirComentarios, setAbrirComentarios] = useState(p.comentarios.length > 0 && p.comentarios.length <= 3);
  return (
    <Card id={`post-${p.id}`} className={clsx("scroll-mt-20 overflow-hidden !p-0", destaque && "ring-2 ring-brand-400", aniv && "border-pink-200")}>
      {aniv && (
        <div className="flex items-center gap-4 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-amber-400 px-5 py-6 text-white">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20 text-3xl" aria-hidden="true">🎂</span>
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
              <span className="font-semibold text-slate-800">{aniv ? "Canais MinasLab" : p.autor_nome || p.autor}</span>
              <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", tipo.cor)}>{tipo.rotulo}</span>
              {p.fixado && <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><Pin size={12} /> Fixado</span>}
            </div>
            <p className="text-xs text-slate-500">{tempoRelativo(p.criado_em)}{p.editado_em ? " · editado" : ""}</p>
          </div>
          {podePublicar && !aniv && (
            <div className="flex shrink-0 gap-1">
              <button type="button" className="btn-ghost h-9 w-9 p-0" title={p.fixado ? "Desafixar" : "Fixar no topo"} aria-label={p.fixado ? "Desafixar" : "Fixar no topo"} onClick={aoFixar}><Pin size={16} className={p.fixado ? "text-brand" : ""} /></button>
              <button type="button" className="btn-ghost h-9 w-9 p-0" title="Editar" aria-label="Editar" onClick={aoEditar}><Pencil size={16} /></button>
              <button type="button" className="btn-ghost h-9 w-9 p-0 text-bad-600" title="Apagar" aria-label="Apagar" onClick={aoApagar}><Trash2 size={16} /></button>
            </div>
          )}
        </div>
        {!aniv && <h2 className="font-display text-lg font-bold leading-snug text-slate-900">{p.titulo}</h2>}
        {p.texto && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700">{p.texto}</p>}
        {p.imagemUrl && <img src={p.imagemUrl} alt="" loading="lazy" className="max-h-[480px] w-full rounded-xl border border-slate-100 object-cover" referrerPolicy="no-referrer" />}

        <div className="flex items-center gap-1 border-t border-slate-100 pt-2">
          <button type="button" onClick={aoCurtir} aria-pressed={p.curti}
            className={clsx("inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition", p.curti ? "text-pink-600" : "text-slate-600 hover:bg-slate-50")}>
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
                    <span className="text-sm font-semibold text-slate-800">{c.nome || c.usuario}</span>
                    <span className="shrink-0 text-xs text-slate-400">{tempoRelativo(c.criado_em)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{c.texto}</p>
                  {(c.usuario === eu || podePublicar) && <button type="button" onClick={() => aoApagarComentario(c)} className="mt-1 text-xs text-slate-400 hover:text-bad-600">apagar</button>}
                </div>
              </div>
            ))}
            <NovoComentario aoEnviar={aoComentar} placeholder={aniv ? "Deixe seu recado de parabéns…" : "Escreva um comentário…"} />
          </div>
        )}
      </div>
    </Card>
  );
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

function Aniversariantes({ lista, hoje }) {
  const mes = Number(hoje.slice(5, 7)), dia = Number(hoje.slice(8, 10));
  return (
    <Card className="overflow-hidden !p-0">
      <div className="flex items-center gap-2 bg-gradient-to-r from-pink-50 to-amber-50 px-4 py-3">
        <Cake size={18} className="text-pink-600" />
        <h2 className="font-display font-bold text-slate-800">Aniversariantes de {MESES[mes - 1]}</h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {lista.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Nenhum aniversariante cadastrado neste mês.</li>}
        {lista.map((a) => (
          <li key={a.pessoaId} className={clsx("flex items-center gap-3 px-4 py-2.5", a.dia === dia && "bg-pink-50/60")}>
            <span className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-xl text-center font-display text-sm font-bold leading-none", a.dia === dia ? "bg-pink-500 text-white" : a.dia < dia ? "bg-slate-100 text-slate-400" : "bg-amber-100 text-amber-800")}>
              {String(a.dia).padStart(2, "0")}
            </span>
            <span className={clsx("min-w-0 flex-1 truncate text-sm font-medium", a.dia < dia ? "text-slate-500" : "text-slate-800")}>{a.nome}</span>
            {a.dia === dia && <span className="text-xs font-semibold text-pink-600">hoje 🎉</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const nomeMes = (mes) => (mes ? `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}` : "");
const iniciaisNome = (n) => String(n || "?").trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÀ-Ú]/.test(p)).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const tituloNome = (n) => String(n || "").toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\s(Da|De|Do|Das|Dos|E)\s/g, (m) => m.toLowerCase());

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
    try { await canaisSalvarDestaque(corpo); aoSalvo(); } catch (e) { setErro(e.message); }
    setSalvando(false);
  }
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
            <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
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

const VAZIO = { tipo: "noticia", titulo: "", texto: "", imagem: "", fixado: false };

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

function Compositor({ post, aoFechar, aoSalvar }) {
  const [f, setF] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [foto, setFoto] = useState(null);
  const [previaAntiga, setPreviaAntiga] = useState("");
  useEffect(() => {
    if (post) {
      setF({ ...VAZIO, ...(post.id ? { id: post.id, tipo: post.tipo, titulo: post.titulo, texto: post.texto, imagem: post.imagem, fixado: post.fixado } : {}) });
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
                <img src={previa} alt="Prévia da foto" className="max-h-56 rounded-xl border object-cover" referrerPolicy="no-referrer" />
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
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.fixado} onChange={set("fixado")} /> Fixar no topo do mural
        </label>
        {!f.id && <p className="text-xs text-slate-500">Ao publicar, todos com login no painel recebem um aviso no sino.</p>}
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
