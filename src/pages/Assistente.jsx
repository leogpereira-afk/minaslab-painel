// Assistente IA — o Claude dentro do painel, para toda a equipe (função ml-assistente).
// Etapa 1: conversa livre (escrever, tirar dúvidas, se organizar) com pesquisa na internet e fontes.
// Cada pessoa vê só as próprias conversas; limites e chave ficam no servidor.

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Check, Copy, Globe, MessageSquarePlus, Pencil, Send, Sparkles, Trash2, History, X } from "lucide-react";
import {
  assistenteEstado, assistenteConversas, assistenteAbrir, assistenteEnviar, assistenteRenomear, assistenteApagar,
} from "../services/assistente.js";
import { blocosMarkdown, trechosInline } from "../lib/markdownSimples.js";
import { PageTitle, Card, Aviso, Segmented, CarregandoModulo } from "../components/ui.jsx";

const SUGESTOES = [
  "Escreva um e-mail cordial cobrando um cliente com boleto vencido há 10 dias.",
  "Quais são os parâmetros de potabilidade da água segundo a portaria vigente do Ministério da Saúde?",
  "Me ajude a organizar minha semana: tenho 3 coletas, 2 propostas e uma reunião.",
  "Resuma em tópicos o que é a ISO/IEC 17025 e o que um laboratório precisa para ser acreditado.",
];

function Inline({ texto }) {
  return trechosInline(texto).map((p, i) => {
    if (p.tipo === "negrito") return <strong key={i}>{p.texto}</strong>;
    if (p.tipo === "italico") return <em key={i}>{p.texto}</em>;
    if (p.tipo === "codigo") return <code key={i} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">{p.texto}</code>;
    if (p.tipo === "link") return <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline">{p.texto}</a>;
    return <Fragment key={i}>{p.texto}</Fragment>;
  });
}

function Markdown({ texto }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-800">
      {blocosMarkdown(texto).map((b, i) => {
        if (b.tipo === "titulo") return <p key={i} className={clsx("font-display font-semibold text-slate-900", b.nivel <= 2 ? "text-base" : "text-sm")}><Inline texto={b.texto} /></p>;
        if (b.tipo === "lista") return <ul key={i} className="ml-5 list-disc space-y-1">{b.itens.map((t, j) => <li key={j}><Inline texto={t} /></li>)}</ul>;
        if (b.tipo === "numerada") return <ol key={i} className="ml-5 list-decimal space-y-1">{b.itens.map((t, j) => <li key={j}><Inline texto={t} /></li>)}</ol>;
        if (b.tipo === "codigo") return <pre key={i} className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100"><code>{b.texto}</code></pre>;
        if (b.tipo === "citacao") return <blockquote key={i} className="border-l-4 border-slate-300 pl-3 text-slate-600"><Inline texto={b.texto} /></blockquote>;
        if (b.tipo === "linha") return <hr key={i} className="border-slate-200" />;
        if (b.tipo === "tabela") return (
          <div key={i} className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead><tr>{b.cabecalho.map((c, j) => <th key={j} className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold"><Inline texto={c} /></th>)}</tr></thead>
              <tbody>{b.linhas.map((l, j) => <tr key={j}>{l.map((c, k) => <td key={k} className="border border-slate-200 px-2 py-1 align-top"><Inline texto={c} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        );
        return <p key={i}><Inline texto={b.texto} /></p>;
      })}
    </div>
  );
}

function BotaoCopiar({ texto }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* sem área de transferência */ } }}
    >
      {ok ? <Check size={14} /> : <Copy size={14} />} {ok ? "Copiado" : "Copiar"}
    </button>
  );
}

function Mensagem({ m }) {
  if (m.papel === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-white">{m.texto}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-700"><Sparkles size={16} /></span>
      <div className="min-w-0 flex-1">
        <Markdown texto={m.texto} />
        {m.fontes?.length > 0 && (
          <div className="mt-3 rounded-xl border bg-slate-50 p-2.5" style={{ borderColor: "var(--hairline)" }}>
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600"><Globe size={13} /> Fontes</p>
            <ol className="ml-4 list-decimal space-y-0.5 text-xs">
              {m.fontes.map((f) => (
                <li key={f.url} className="break-words"><a href={f.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">{f.titulo}</a></li>
              ))}
            </ol>
          </div>
        )}
        <div className="mt-1 flex items-center gap-2">
          <BotaoCopiar texto={m.texto} />
          {m.modelo?.includes("sonnet") && <span className="text-[11px] text-slate-400">modo Avançado</span>}
        </div>
      </div>
    </div>
  );
}

function ListaConversas({ conversas, atual, aoAbrir, aoNova, aoRenomear, aoApagar }) {
  return (
    <div className="flex h-full flex-col">
      <button type="button" className="btn-primary mb-3 w-full" onClick={aoNova}><MessageSquarePlus size={16} /> Nova conversa</button>
      {conversas.length === 0 ? (
        <p className="text-xs text-slate-500">Suas conversas aparecem aqui. Só você vê as suas.</p>
      ) : (
        <ul className="-mx-1 space-y-0.5 overflow-y-auto">
          {conversas.map((c) => (
            <li key={c.id} className={clsx("group flex items-center gap-1 rounded-lg px-1", c.id === atual && "bg-slate-100")}>
              <button type="button" onClick={() => aoAbrir(c.id)} className="min-h-10 min-w-0 flex-1 truncate px-1 text-left text-sm text-slate-700" title={c.titulo}>{c.titulo}</button>
              <button type="button" onClick={() => aoRenomear(c)} className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:text-slate-700" aria-label={`Renomear ${c.titulo}`}><Pencil size={13} /></button>
              <button type="button" onClick={() => aoApagar(c)} className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:text-bad-700" aria-label={`Apagar ${c.titulo}`}><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Assistente() {
  const [estado, setEstado] = useState(null);
  const [conversas, setConversas] = useState([]);
  const [atual, setAtual] = useState(null); // id da conversa aberta
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState("rapido");
  const [pesquisar, setPesquisar] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [verLista, setVerLista] = useState(false); // celular
  const fim = useRef(null);
  const campo = useRef(null);

  const recarregarLista = useCallback(() => assistenteConversas().then((r) => setConversas(r.conversas || [])).catch(() => {}), []);
  const recarregarEstado = useCallback(() => assistenteEstado().then(setEstado).catch((e) => setEstado({ erro: e.message })), []);

  useEffect(() => { void recarregarEstado(); void recarregarLista(); }, [recarregarEstado, recarregarLista]);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensagens, enviando]);

  const abrir = async (id) => {
    setVerLista(false);
    try {
      const r = await assistenteAbrir(id);
      setAtual(id);
      setMensagens(r.mensagens || []);
    } catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
  };
  const nova = () => { setAtual(null); setMensagens([]); setVerLista(false); setTimeout(() => campo.current?.focus(), 50); };

  const enviar = async (conteudo = texto) => {
    const t = conteudo.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setTexto("");
    const provisoria = { id: `tmp-${Date.now()}`, papel: "user", texto: t };
    setMensagens((ms) => [...ms, provisoria]);
    try {
      const r = await assistenteEnviar({ conversaId: atual, texto: t, modo, pesquisar });
      setAtual(r.conversa.id);
      setMensagens((ms) => [...ms, r.mensagem]);
      void recarregarLista();
      void recarregarEstado();
    } catch (e) {
      setMensagens((ms) => ms.filter((m) => m.id !== provisoria.id));
      setTexto(t);
      setAviso({ tipo: "erro", texto: e.message });
    } finally {
      setEnviando(false);
    }
  };

  const renomear = async (c) => {
    const titulo = window.prompt("Novo nome da conversa:", c.titulo);
    if (!titulo?.trim()) return;
    try { await assistenteRenomear(c.id, titulo.trim()); void recarregarLista(); } catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
  };
  const apagar = async (c) => {
    if (!window.confirm(`Apagar a conversa "${c.titulo}"? Não dá para desfazer.`)) return;
    try {
      await assistenteApagar(c.id);
      if (c.id === atual) nova();
      void recarregarLista();
    } catch (e) { setAviso({ tipo: "erro", texto: e.message }); }
  };

  if (!estado) return <CarregandoModulo />;

  const lista = <ListaConversas conversas={conversas} atual={atual} aoAbrir={abrir} aoNova={nova} aoRenomear={renomear} aoApagar={apagar} />;
  const lim = estado.limites, uso = estado.uso;

  return (
    <div>
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle
        titulo="Assistente IA"
        descricao="O Claude dentro do painel: escreve, tira dúvidas, pesquisa na internet e ajuda a organizar. Só você vê as suas conversas."
        acao={<button type="button" className="btn-outline lg:hidden" onClick={() => setVerLista(true)}><History size={16} /> Conversas</button>}
      />

      {estado.erro && <p role="alert" className="mb-3 rounded-xl border border-bad-200 bg-bad-50 p-3 text-sm text-bad-800">{estado.erro}</p>}
      {estado.ligado === false && (
        <p role="status" className="mb-3 rounded-xl border border-warn-200 bg-warn-50 p-3 text-sm text-warn-800">
          O Assistente ainda está sendo ligado pela direção. Assim que a chave da IA for cadastrada no servidor, ele passa a responder aqui.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="hidden max-h-[70vh] lg:block">{lista}</Card>

        <Card className="flex min-h-[60vh] flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto pb-2">
            {mensagens.length === 0 && !enviando && (
              <div className="py-6 text-center">
                <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-orange-100 text-orange-700"><Sparkles size={22} /></span>
                <p className="font-display text-lg font-semibold text-slate-900">Olá{estado.nome ? `, ${String(estado.nome).split(" ")[0]}` : ""}! Como posso ajudar?</p>
                <div className="mx-auto mt-4 grid max-w-2xl gap-2 sm:grid-cols-2">
                  {SUGESTOES.map((s) => (
                    <button key={s} type="button" onClick={() => enviar(s)} disabled={enviando || estado.ligado === false} className="rounded-xl border p-3 text-left text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60" style={{ borderColor: "var(--hairline)" }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {mensagens.map((m) => <Mensagem key={m.id} m={m} />)}
            {enviando && (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-100 text-orange-700"><Sparkles size={16} className="animate-pulse" /></span>
                {pesquisar ? "Pensando e pesquisando… pode levar alguns segundos." : "Pensando…"}
              </div>
            )}
            <div ref={fim} />
          </div>

          <form
            className="mt-2 border-t pt-3"
            style={{ borderColor: "var(--hairline)" }}
            onSubmit={(e) => { e.preventDefault(); void enviar(); }}
          >
            <label htmlFor="ia-texto" className="sr-only">Sua mensagem</label>
            <textarea
              id="ia-texto"
              ref={campo}
              className="input min-h-[72px] w-full resize-y"
              placeholder="Escreva sua pergunta… (Enter envia, Shift+Enter quebra linha)"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(); } }}
              disabled={enviando}
              maxLength={12000}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                  opcoes={[{ valor: "rapido", rotulo: "Rápido" }, { valor: "avancado", rotulo: "Avançado" }]}
                  valor={modo}
                  onChange={setModo}
                />
                <label className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" checked={pesquisar} onChange={(e) => setPesquisar(e.target.checked)} />
                  <Globe size={14} /> Pesquisar na internet
                </label>
              </div>
              <button type="submit" className="btn-primary" disabled={enviando || !texto.trim() || estado.ligado === false}>
                <Send size={16} /> Enviar
              </button>
            </div>
            {lim && uso && (
              <p className="mt-1 text-[11px] text-slate-400">
                Hoje: {uso.perguntas} de {lim.perguntas} perguntas · {uso.avancado} de {lim.avancado} no modo Avançado · {uso.buscas} de {lim.buscas} pesquisas.
                {" "}A IA pode errar: confira informações importantes.
              </p>
            )}
          </form>
        </Card>
      </div>

      {verLista && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Conversas">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Fechar" onClick={() => setVerLista(false)} />
          <div className="relative z-10 h-full w-[85%] max-w-xs bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display font-semibold">Conversas</span>
              <button type="button" className="grid h-10 w-10 place-items-center" onClick={() => setVerLista(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
            {lista}
          </div>
        </div>
      )}
    </div>
  );
}
