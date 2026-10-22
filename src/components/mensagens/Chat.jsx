// Uma conversa aberta: mensagens, envio, tique de "visualizado" e participantes do grupo.
// Atualiza sozinha a cada poucos segundos (só as mensagens novas, pela posição `seq`).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, Loader2, Mic, PanelRight, Paperclip, Pencil, Send, Smile, Trash2, UserPlus, X } from "lucide-react";
import { clsx } from "clsx";
import Avatar from "../tarefas/Avatar.jsx";
import SobreConversa from "./SobreConversa.jsx";
import FotoGrupo from "./FotoGrupo.jsx";
import AnexoMensagem from "./AnexoMensagem.jsx";
import GravadorAudio from "./GravadorAudio.jsx";
import SeletorEmoji from "./SeletorEmoji.jsx";
import ReacoesMensagem, { BotaoReagir } from "./ReacoesMensagem.jsx";
import EditorMensagem from "./EditorMensagem.jsx";
import TextoRico from "./TextoRico.jsx";
import { mencionaUsuario } from "../../lib/textoRico.js";
import { inserirNoTexto } from "../../lib/emojis.js";
import { ACEITAR_NO_INPUT_MENSAGEM, EXTENSOES_MENSAGEM, lerArquivoParaEnvio, problemaDoArquivo } from "../../lib/anexos.js";
import { corDoAvatar, horaLocal } from "../../lib/tarefas.js";
import { alternarReacaoLocal, aplicarAlteradas, comSeparadores, ehAudioMensagem, mesclarMensagens, quemViu, situacaoDaMensagem, ultimaEditavel } from "../../lib/mensagens.js";
import { avisarContador, conversaApagarMensagem, conversaEditarMensagem, conversaEnviar, conversaEnviarArquivo, conversaEnviarAudio, conversaObter, conversaReagir, conversaSilenciar } from "../../services/mensagens.js";

const INTERVALO = 4000;
let contadorLocal = 0;

export default function Chat({ id, usuarios, aoVoltar, aoMudou, aoSairDoGrupo }) {
  const [dados, setDados] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [maisAntigas, setMaisAntigas] = useState(false);
  const [erro, setErro] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [carregandoAntigas, setCarregandoAntigas] = useState(false);
  const [painel, setPainel] = useState(false);
  const [agora, setAgora] = useState(() => new Date());
  const rolagem = useRef(null);
  const campo = useRef(null);
  const entradaArquivo = useRef(null);
  const [arrastando, setArrastando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [emojiAberto, setEmojiAberto] = useState(false);
  const colarNoFim = useRef(true);
  const ultimaSeq = useRef(0);
  const ultimaSync = useRef(""); // hora do servidor na última consulta: traz as editadas/apagadas desde então
  const [editando, setEditando] = useState(null); // mensagem minha sendo editada

  const aplicar = useCallback((r, { substituir }) => {
    if (r.agora) ultimaSync.current = r.agora;
    setDados((d) => ({ ...(d || {}), ...r, mensagens: undefined, alteradas: undefined }));
    setMensagens((atuais) => {
      const novas = r.mensagens.map((m) => ({ ...m }));
      const lista = aplicarAlteradas(substituir ? novas : mesclarMensagens(atuais, novas), (r.alteradas || []).map((m) => ({ ...m })));
      ultimaSeq.current = lista.reduce((n, m) => Math.max(n, m.seq || 0), 0);
      return lista;
    });
  }, []);

  const carregar = useCallback(async ({ inicial = false } = {}) => {
    try {
      const r = await conversaObter(id, inicial || !ultimaSeq.current ? {} : { apos: ultimaSeq.current, desde: ultimaSync.current });
      if (inicial) setMaisAntigas(r.maisAntigas);
      aplicar(r, { substituir: inicial });
      setAgora(new Date());
      setErro("");
      if (inicial || r.mensagens.length) avisarContador();
      if (r.mensagens.length || r.alteradas?.length) aoMudou?.();
    } catch (ex) { if (inicial) setErro(ex.message); }
  }, [id, aplicar, aoMudou]);

  useEffect(() => {
    setDados(null); setMensagens([]); setTexto(""); setErro(""); setEditando(null); ultimaSeq.current = 0; ultimaSync.current = ""; colarNoFim.current = true;
    void carregar({ inicial: true });
    const t = setInterval(() => { if (!document.hidden) void carregar(); }, INTERVALO);
    const volta = () => { if (!document.hidden) void carregar(); };
    document.addEventListener("visibilitychange", volta);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", volta); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = rolagem.current;
    if (el && colarNoFim.current) el.scrollTop = el.scrollHeight;
  }, [mensagens, dados?.conversa?.id]);

  const aoRolar = () => {
    const el = rolagem.current;
    if (el) colarNoFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const eu = dados?.eu;
  const grupo = dados?.conversa?.tipo === "grupo";
  const nomeDe = (u) => dados?.nomes?.[u] || usuarios.find((x) => x.usuario === u)?.nome || u;
  const itens = useMemo(() => comSeparadores(mensagens, agora), [mensagens, agora]);
  // Quem existe (para o @ virar marcação) e quem dá para marcar nesta conversa.
  const logins = useMemo(() => new Set([...usuarios.map((u) => String(u.usuario).toLowerCase()), ...Object.keys(dados?.nomes || {}).map((u) => u.toLowerCase())]), [usuarios, dados?.nomes]);
  const ehUsuario = useCallback((u) => logins.has(u), [logins]);
  const pessoas = useMemo(() => (dados?.membros || []).filter((m) => m.usuario !== eu).map((m) => ({ usuario: m.usuario, nome: dados?.nomes?.[m.usuario] || usuarios.find((x) => x.usuario === m.usuario)?.nome || m.usuario })), [dados?.membros, dados?.nomes, usuarios, eu]);

  const comecarEdicao = (m) => {
    if (!m) return;
    setEditando(m);
    setTexto(m.texto || "");
    requestAnimationFrame(() => { const el = campo.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  };
  const cancelarEdicao = () => { setEditando(null); setTexto(""); campo.current?.focus(); };
  const salvarEdicao = async () => {
    const m = editando;
    const t = texto.trim();
    if (!m || enviando || (!t && !m.anexo)) return;
    if (t === (m.texto || "").trim()) { cancelarEdicao(); return; }
    const antes = m;
    setMensagens((l) => l.map((x) => (x.id === m.id ? { ...x, texto: t, editadaEm: new Date().toISOString() } : x)));
    setEditando(null); setTexto(""); setEnviando(true);
    try {
      const r = await conversaEditarMensagem(id, m.id, t);
      setMensagens((l) => l.map((x) => (x.id === m.id ? { ...x, ...r.mensagem } : x)));
      aoMudou?.();
    } catch (ex) {
      setMensagens((l) => l.map((x) => (x.id === antes.id ? antes : x)));
      setEditando(antes); setTexto(t);
      setErro(ex.message);
    } finally { setEnviando(false); campo.current?.focus(); }
  };

  const enviar = async () => {
    if (editando) { await salvarEdicao(); return; }
    const t = texto.trim();
    if (!t || enviando || !dados) return;
    const provisoria = { id: `local-${++contadorLocal}`, seq: null, autor: eu, tipo: "mensagem", texto: t, apagada: false, criadoEm: new Date().toISOString() };
    colarNoFim.current = true;
    setMensagens((l) => [...l, provisoria]);
    setTexto("");
    setEnviando(true);
    try {
      const r = await conversaEnviar(id, t);
      setMensagens((l) => mesclarMensagens(l.filter((m) => m.id !== provisoria.id), [r.mensagem]));
      ultimaSeq.current = Math.max(ultimaSeq.current, r.mensagem.seq);
      aoMudou?.();
    } catch (ex) {
      setMensagens((l) => l.filter((m) => m.id !== provisoria.id));
      setTexto(t);
      setErro(ex.message);
    } finally { setEnviando(false); campo.current?.focus(); }
  };

  // Arquivos e imagens: pelo clipe, arrastando para a conversa ou colando (Ctrl+V) um print. A legenda é o texto que estiver digitado.
  const enviarArquivos = async (lista) => {
    const arquivos = [...lista];
    if (!arquivos.length || !dados) return;
    const recusados = arquivos.map((a) => problemaDoArquivo(a, EXTENSOES_MENSAGEM)).filter(Boolean);
    const validos = arquivos.filter((a) => !problemaDoArquivo(a, EXTENSOES_MENSAGEM));
    setErro(recusados.join(" "));
    let legenda = texto.trim();
    setEnviando(true);
    for (const arq of validos) {
      const provisoria = { id: `local-${++contadorLocal}`, seq: null, autor: eu, tipo: "mensagem", texto: legenda, anexo: { nome: arq.name, tamanho: arq.size }, apagada: false, criadoEm: new Date().toISOString() };
      colarNoFim.current = true;
      setMensagens((l) => [...l, provisoria]);
      try {
        const { nome, base64 } = await lerArquivoParaEnvio(arq);
        const r = await conversaEnviarArquivo(id, nome, base64, legenda);
        setMensagens((l) => mesclarMensagens(l.filter((m) => m.id !== provisoria.id), [r.mensagem]));
        ultimaSeq.current = Math.max(ultimaSeq.current, r.mensagem.seq);
        if (legenda) { setTexto(""); legenda = ""; }
        aoMudou?.();
      } catch (ex) {
        setMensagens((l) => l.filter((m) => m.id !== provisoria.id));
        setErro(ex.message);
        break;
      }
    }
    setEnviando(false);
    campo.current?.focus();
  };

  // Mensagem de voz gravada na tela: vai como arquivo de áudio com a duração.
  const enviarAudio = async (blob, ext, duracao) => {
    setGravando(false);
    if (!dados) return;
    const nome = `audio-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}.${ext}`;
    const provisoria = { id: `local-${++contadorLocal}`, seq: null, autor: eu, tipo: "mensagem", texto: "", anexo: { nome, tipo: blob.type || "audio/webm", tamanho: blob.size, duracao }, apagada: false, criadoEm: new Date().toISOString() };
    colarNoFim.current = true;
    setMensagens((l) => [...l, provisoria]);
    setEnviando(true);
    try {
      const { base64 } = await lerArquivoParaEnvio(new File([blob], nome, { type: blob.type }));
      const r = await conversaEnviarAudio(id, nome, base64, duracao);
      setMensagens((l) => mesclarMensagens(l.filter((m) => m.id !== provisoria.id), [r.mensagem]));
      ultimaSeq.current = Math.max(ultimaSeq.current, r.mensagem.seq);
      aoMudou?.();
    } catch (ex) {
      setMensagens((l) => l.filter((m) => m.id !== provisoria.id));
      setErro(ex.message);
    } finally { setEnviando(false); }
  };

  // Reação: aparece na hora; o servidor confirma e devolve o conjunto certo.
  const reagir = async (m, emoji) => {
    if (m.seq == null) return;
    setDados((d) => (d ? { ...d, reacoes: alternarReacaoLocal(d.reacoes, m.id, emoji, d.eu) } : d));
    try { const r = await conversaReagir(id, m.id, emoji); setDados((d) => (d ? { ...d, reacoes: r.reacoes } : d)); }
    catch (ex) { setErro(ex.message); await carregar(); }
  };
  const poremEmoji = (emoji) => {
    const el = campo.current;
    const r = inserirNoTexto(texto, el?.selectionStart, el?.selectionEnd, emoji);
    setTexto(r.texto);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(r.cursor, r.cursor); } });
  };

  const maisAntigasPedir = async () => {
    const primeira = mensagens.find((m) => m.seq != null);
    if (!primeira || carregandoAntigas) return;
    setCarregandoAntigas(true);
    const el = rolagem.current, alturaAntes = el?.scrollHeight || 0;
    try {
      const r = await conversaObter(id, { antes: primeira.seq });
      colarNoFim.current = false;
      setMensagens((l) => mesclarMensagens(l, r.mensagens));
      setMaisAntigas(r.maisAntigas);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - alturaAntes; });
    } catch (ex) { setErro(ex.message); } finally { setCarregandoAntigas(false); }
  };

  const apagar = async (m) => {
    if (!window.confirm("Apagar esta mensagem para todos?")) return;
    try { await conversaApagarMensagem(id, m.id); setMensagens((l) => l.map((x) => (x.id === m.id ? { ...x, apagada: true, texto: "" } : x))); aoMudou?.(); } catch (ex) { setErro(ex.message); }
  };
  const alternarSilencio = async () => {
    const novo = !dados.conversa.silenciado;
    try { await conversaSilenciar(id, novo); setDados((d) => ({ ...d, conversa: { ...d.conversa, silenciado: novo } })); aoMudou?.(); avisarContador(); } catch (ex) { setErro(ex.message); }
  };

  if (erro && !dados) return <div className="grid h-full place-items-center p-6"><div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{erro}</div></div>;
  if (!dados) return <div className="grid h-full place-items-center text-sm text-slate-500"><Loader2 className="animate-spin" size={20} aria-label="Carregando" /></div>;

  const c = dados.conversa;
  return (
    <div className="relative flex h-full min-h-0">
    <section className={clsx("flex h-full min-h-0 min-w-0 flex-1 flex-col", arrastando && "ring-2 ring-inset ring-sky-400")} aria-label={`Conversa com ${c.titulo}`} onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setArrastando(true); } }} onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastando(false); }} onDrop={(e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); setArrastando(false); void enviarArquivos(e.dataTransfer.files); } }}>
      <header className="flex items-center gap-3 border-b px-3 py-2.5" style={{ borderColor: "var(--hairline)" }}>
        <button type="button" className="btn-ghost h-9 w-9 shrink-0 p-0 lg:hidden" onClick={aoVoltar} aria-label="Voltar para as conversas"><ArrowLeft size={18} /></button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setPainel(true)} aria-label={grupo ? "Ver sobre o grupo" : "Ver sobre a conversa"}>
          {grupo ? <FotoGrupo foto={c.foto} tamanho={40} /> : <Avatar usuario={c.outro} nome={c.titulo} tamanho={40} />}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-base font-semibold text-slate-900">{c.titulo}</span>
            {grupo && <span className="block truncate text-xs text-slate-500">{dados.membros.length} participantes</span>}
          </span>
        </button>
        {grupo && dados.pode.gerir && <button type="button" className="btn-ghost h-9 w-9 p-0" onClick={() => setPainel(true)} aria-label="Adicionar pessoas ao grupo" title="Adicionar pessoas"><UserPlus size={17} /></button>}
        <button type="button" className={clsx("btn-ghost h-9 w-9 p-0", painel && "bg-sky-50 text-sky-700")} onClick={() => setPainel((v) => !v)} aria-pressed={painel} aria-label={grupo ? "Sobre o grupo" : "Sobre a conversa"} title={grupo ? "Sobre o grupo" : "Sobre a conversa"}><PanelRight size={17} /></button>
      </header>

      <div ref={rolagem} onScroll={aoRolar} className="fundo-laboratorio min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3" role="log" aria-live="polite" aria-label="Mensagens">
        {maisAntigas && <div className="pb-2 text-center"><button type="button" className="rounded-full bg-white/85 px-3 py-0.5 text-xs font-medium text-sky-700 underline shadow-sm" onClick={maisAntigasPedir} disabled={carregandoAntigas}>{carregandoAntigas ? "Carregando..." : "Ver mensagens mais antigas"}</button></div>}
        {itens.length === 0 && <p className="py-10 text-center"><span className="rounded-full bg-white/85 px-3 py-1 text-sm text-slate-600 shadow-sm">Nenhuma mensagem ainda. Diga um oi!</span></p>}
        {itens.map((it, i) => {
          if (it.tipo === "dia") return <div key={it.chave} className="py-2 text-center"><span className="rounded-full bg-white px-3 py-0.5 text-xs font-medium text-slate-500 shadow-sm">{it.rotulo}</span></div>;
          const m = it.mensagem;
          if (m.tipo === "sistema") return <p key={it.chave} className="py-1 text-center"><span className="inline-block rounded-full bg-white/85 px-3 py-0.5 text-xs text-slate-600 shadow-sm">{m.texto}</span></p>;
          const minha = m.autor === eu;
          const anterior = itens[i - 1]?.mensagem;
          const mesmoAutor = anterior && anterior.tipo === "mensagem" && anterior.autor === m.autor && itens[i - 1].tipo === "msg";
          const situacao = minha ? situacaoDaMensagem(m, dados.membros, eu) : null;
          const viram = grupo && minha && situacao ? quemViu(m, dados.membros, eu) : [];
          return (
            <div key={it.chave} className={clsx("group flex items-end gap-1.5", minha ? "justify-end" : "justify-start", !mesmoAutor && "pt-1.5")}>
              {!minha && grupo && (mesmoAutor ? <span className="w-7 shrink-0" /> : <Avatar usuario={m.autor} nome={nomeDe(m.autor)} tamanho={28} />)}
              {minha && !m.apagada && m.seq != null && <BotaoReagir aoReagir={(e) => reagir(m, e)} lado="esquerda" />}
              {minha && !m.apagada && m.seq != null && !ehAudioMensagem(m) && <button type="button" className="mb-1 hidden rounded p-1 text-slate-400 hover:bg-sky-50 hover:text-sky-600 group-hover:block group-focus-within:block [@media(hover:none)]:block" onClick={() => comecarEdicao(m)} aria-label="Editar mensagem" title="Editar mensagem"><Pencil size={13} /></button>}
              {minha && !m.apagada && m.seq != null && <button type="button" className="mb-1 hidden rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 group-hover:block group-focus-within:block" onClick={() => apagar(m)} aria-label="Apagar mensagem" title="Apagar mensagem"><Trash2 size={13} /></button>}
              <div onDoubleClick={() => { if (!m.apagada && m.seq != null) { window.getSelection?.()?.removeAllRanges?.(); void reagir(m, "👍"); } }} title={!m.apagada && m.seq != null ? "Dois cliques para curtir 👍" : undefined}
                className={clsx("max-w-[78%] rounded-2xl px-3 py-1.5 text-sm shadow-sm", minha ? "rounded-br-md bg-sky-100 text-slate-900" : "rounded-bl-md bg-white text-slate-900", !minha && !m.apagada && mencionaUsuario(m.texto, eu, ehUsuario) && "bg-amber-50 ring-2 ring-amber-300", editando?.id === m.id && "ring-2 ring-sky-400")}>
                {!minha && grupo && !mesmoAutor && <p className="text-xs font-semibold" style={{ color: corDoAvatar(m.autor) }}>{nomeDe(m.autor)}</p>}
                {m.apagada ? <p className="italic text-slate-400">Mensagem apagada</p> : <>{m.anexo && <AnexoMensagem conversaId={id} mensagem={m} minha={minha} />}{m.texto && <TextoRico texto={m.texto} nomeDe={nomeDe} ehUsuario={ehUsuario} eu={eu} className={m.anexo ? "mt-1.5" : undefined} />}</>}
                {!m.apagada && <ReacoesMensagem reacoes={dados.reacoes?.[m.id]} eu={eu} nomes={dados.nomes || {}} aoAlternar={(e) => reagir(m, e)} minha={minha} />}
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-slate-400">
                  {m.editadaEm && !m.apagada && <span className="italic" title={`Editada às ${horaLocal(m.editadaEm)}`}>editada</span>}
                  {horaLocal(m.criadoEm)}
                  {minha && !m.apagada && (situacao === "enviando" ? <Loader2 size={12} className="animate-spin" aria-label="Enviando" /> : situacao === "visualizada" ? <CheckCheck size={14} className="text-sky-600" aria-label="Visualizada" /> : <Check size={14} aria-label="Enviada" />)}
                </p>
                {viram.length > 0 && !grupoTodosViram(viram, dados.membros, eu) && <p className="text-right text-[10px] text-slate-400">Visto por {viram.map((u) => nomeDe(u).split(" ")[0]).join(", ")}</p>}
              </div>
              {!minha && !m.apagada && m.seq != null && <BotaoReagir aoReagir={(e) => reagir(m, e)} lado="direita" />}
            </div>
          );
        })}
      </div>

      {erro && <div role="alert" className="border-t bg-red-50 px-3 py-2 text-sm text-red-700" style={{ borderColor: "var(--hairline)" }}>{erro}</div>}
      {editando && (
        <div className="flex items-center gap-2 border-t bg-sky-50 px-3 py-1.5 text-xs text-sky-900" style={{ borderColor: "var(--hairline)" }} role="status">
          <Pencil size={13} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate"><b>Editando mensagem</b> · Enter salva, Esc cancela</span>
          <button type="button" className="rounded p-1 hover:bg-sky-100" onClick={cancelarEdicao} aria-label="Cancelar edição" title="Cancelar edição"><X size={14} /></button>
        </div>
      )}
      <form className="relative flex items-end gap-2 border-t bg-white p-2.5" style={{ borderColor: "var(--hairline)" }} onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        {gravando ? <GravadorAudio aoEnviar={enviarAudio} aoCancelar={() => setGravando(false)} aoErro={setErro} /> : (
          <>
            <input ref={entradaArquivo} type="file" multiple accept={ACEITAR_NO_INPUT_MENSAGEM} className="sr-only" aria-label="Escolher arquivos para enviar" onChange={(e) => { const l = [...e.target.files]; e.target.value = ""; void enviarArquivos(l); }} />
            <button type="button" className="btn-ghost h-11 w-11 shrink-0 p-0 text-slate-500" onClick={() => entradaArquivo.current?.click()} disabled={enviando || !!editando} aria-label="Anexar arquivo" title="Anexar arquivo ou imagem"><Paperclip size={19} /></button>
            <span className="relative">
              <button type="button" className="btn-ghost h-11 w-11 shrink-0 p-0 text-slate-500" onClick={() => setEmojiAberto((v) => !v)} aria-expanded={emojiAberto} aria-label="Escolher emoji" title="Emojis"><Smile size={19} /></button>
              {emojiAberto && <SeletorEmoji aoEscolher={poremEmoji} aoFechar={() => setEmojiAberto(false)} className="absolute bottom-full left-0 mb-2" />}
            </span>
            <EditorMensagem campo={campo} texto={texto} setTexto={setTexto} aoEnviar={() => void enviar()} aoColarArquivos={(f) => void enviarArquivos(f)}
              pessoas={pessoas} grupo={grupo} nomeDe={nomeDe} ehUsuario={ehUsuario} eu={eu} desabilitado={enviando}
              aoCancelar={editando ? cancelarEdicao : null} aoSetaCima={() => comecarEdicao(ultimaEditavel(mensagens, eu))} />
            {editando
              ? <button type="submit" className="btn-primary h-11 w-11 shrink-0 p-0" disabled={enviando || (!texto.trim() && !editando.anexo)} aria-label="Salvar edição" title="Salvar edição (Enter)"><Check size={18} /></button>
              : texto.trim()
              ? <button type="submit" className="btn-primary h-11 w-11 shrink-0 p-0" disabled={enviando} aria-label="Enviar mensagem" title="Enviar (Enter)"><Send size={18} /></button>
              : <button type="button" className="btn-primary h-11 w-11 shrink-0 p-0" onClick={() => { setErro(""); setGravando(true); }} disabled={enviando} aria-label="Gravar mensagem de voz" title="Gravar mensagem de voz"><Mic size={18} /></button>}
          </>
        )}
      </form>

    </section>
    {painel && (
      <div className="absolute inset-0 z-10 bg-white lg:static lg:inset-auto lg:w-80 lg:shrink-0 lg:border-l" style={{ borderColor: "var(--hairline)" }}>
        <SobreConversa dados={dados} usuarios={usuarios} eu={eu} aoFechar={() => setPainel(false)} aoMudou={async () => { await carregar({ inicial: true }); aoMudou?.(); }} aoSair={() => { setPainel(false); aoSairDoGrupo?.(); }} aoSilenciar={alternarSilencio} />
      </div>
    )}
    </div>
  );
}

// Em grupo, "Visto por ..." só aparece enquanto nem todos viram (todos viram = tique azul duplo basta).
function grupoTodosViram(viram, membros, eu) {
  return viram.length === membros.filter((m) => m.usuario !== eu).length;
}
