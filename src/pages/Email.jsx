// E-MAIL — as caixas de cada pessoa (Hostinger e Gmail) dentro do painel, no estilo Gmail/Outlook.
// Tudo acontece direto na caixa (ml-email → IMAP/SMTP): o que se lê, envia, move ou exclui aqui
// aparece igual no webmail e no celular. Cada um só vê as próprias caixas. A assinatura padrão
// MinasLab entra sozinha (nome do login, cargo do RH, e-mail da caixa, telefone, logo e selo CRL 1943).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import {
  Archive, ArrowLeft, Bold, ChevronLeft, ChevronRight, Columns2, Download, FileText, Folder, Forward, Inbox, Italic, Link2, List, Loader2, Mail,
  MailOpen, Paperclip, Pencil, Plus, RefreshCw, Reply, ReplyAll, Rows3, Search, Send, Settings2, ShieldAlert, Star, Trash2, Underline, X,
} from "lucide-react";
import { Aviso, CarregandoModulo, ErroModulo, Modal } from "../components/ui.jsx";
import {
  iniciarEmail, salvarCaixa, removerCaixa, lerPastas, listarEmails, abrirEmail, conversaEmail, baixarAnexoEmail, agirEmail, enviarEmail,
} from "../services/email.js";
import { assinaturaHtml, citacaoHtml } from "../lib/emailAssinatura.js";
import { emailMudou } from "../lib/emailContador.js";
import { assuntoBase, assuntoResposta, lerEnderecos } from "../../supabase/functions/_shared/email-texto.mjs";

const BASE = import.meta.env.BASE_URL || "/";
const CORES_CAIXA = ["#0f766e", "#d97706", "#4f6fd8", "#be123c", "#7c3aed", "#0e7490"];
const ICONE_PASTA = { entrada: Inbox, enviados: Send, rascunhos: FileText, lixeira: Trash2, spam: ShieldAlert, estrela: Star, arquivo: Archive, todos: Mail };
const LIMITE_ANEXOS = 18 * 1024 * 1024;
const LEMBRAR = "ml-email-caixa";
const LEMBRAR_LAYOUT = "ml-email-layout";

const lerLocal = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };
const tamanho = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
function quando(iso) {
  if (!iso) return "";
  const d = new Date(iso), hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", ...(d.getFullYear() !== hoje.getFullYear() ? { year: "2-digit" } : {}) }).replace(".", "");
}
const nomeOuEmail = (e) => e?.nome || e?.email || "(sem remetente)";
const inicial = (e) => (nomeOuEmail(e).match(/[A-Za-zÀ-ú0-9]/) || ["?"])[0].toUpperCase();
const listaTexto = (v) => (v || []).map((e) => (e.nome ? `${e.nome} <${e.email}>` : e.email)).join(", ");
function arquivoParaBase64(f) {
  return new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = () => falha(new Error(`Não consegui ler ${f.name}.`));
    r.readAsDataURL(f);
  });
}
function baixarBase64(nome, tipo, b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([u], { type: tipo || "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url; a.download = nome || "anexo"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function Email() {
  const [ini, setIni] = useState(null);
  const [erroIni, setErroIni] = useState("");
  const [aviso, setAviso] = useState(null);
  const [contaId, setContaId] = useState(() => lerLocal(LEMBRAR));
  // Layout como no webmail da Hostinger: "coluna" (lista ao lado da mensagem) ou "linha"
  // (lista na largura toda; a mensagem abre no lugar da lista).
  const [layout, setLayoutEstado] = useState(() => (lerLocal(LEMBRAR_LAYOUT) === "linha" ? "linha" : "coluna"));
  const setLayout = (v) => { setLayoutEstado(v); gravarLocal(LEMBRAR_LAYOUT, v); };
  const emLinha = layout === "linha";
  const [pastas, setPastas] = useState([]);
  const [erroPastas, setErroPastas] = useState("");
  const [pastaId, setPastaId] = useState("INBOX");
  const [filtro, setFiltro] = useState({ busca: "", naoLidas: false, comAnexo: false });
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState(null);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erroLista, setErroLista] = useState("");
  const [sel, setSel] = useState(null);
  const [aberta, setAberta] = useState(null);
  const [carregandoMsg, setCarregandoMsg] = useState(false);
  const [marcados, setMarcados] = useState(() => new Set());
  const [escrita, setEscrita] = useState(null);
  const [caixaForm, setCaixaForm] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const versaoLista = useRef(0);

  const contas = useMemo(() => ini?.contas || [], [ini]);
  const conta = contas.find((c) => c.id === contaId) || contas[0] || null;
  const corDe = (id) => CORES_CAIXA[Math.max(0, contas.findIndex((c) => c.id === id)) % CORES_CAIXA.length];
  const pasta = pastas.find((p) => p.id === pastaId) || null;
  const erroMsg = (e) => setAviso({ tipo: "erro", texto: e?.message || String(e) });

  const carregarInicio = useCallback(async () => {
    setErroIni("");
    try { setIni(await iniciarEmail()); } catch (e) { setErroIni(e.message); }
  }, []);
  useEffect(() => { carregarInicio(); }, [carregarInicio]);

  const carregarPastas = useCallback(async (silencioso = false) => {
    if (!conta) return;
    if (!silencioso) { setErroPastas(""); setPastas([]); }
    try { setPastas(await lerPastas(conta.id)); setErroPastas(""); emailMudou(500); } catch (e) { if (!silencioso) setErroPastas(e.message); }
  }, [conta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!conta) return;
    gravarLocal(LEMBRAR, conta.id);
    setPastaId("INBOX"); setPagina(1); setSel(null); setAberta(null); setMarcados(new Set()); setLista(null);
    carregarPastas();
  }, [conta?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregarLista = useCallback(async (silencioso = false) => {
    if (!conta || !pastaId) return;
    const v = ++versaoLista.current;
    if (!silencioso) { setCarregandoLista(true); setErroLista(""); }
    try {
      const r = await listarEmails(conta.id, pastaId, pagina, filtro);
      if (v !== versaoLista.current) return;
      setLista(r); setErroLista("");
    } catch (e) {
      if (v === versaoLista.current && !silencioso) setErroLista(e.message);
    } finally { if (v === versaoLista.current) setCarregandoLista(false); }
  }, [conta?.id, pastaId, pagina, filtro]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { carregarLista(); }, [carregarLista]);

  // Confere novidades a cada minuto, só com a aba visível.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible" && !escrita) { carregarLista(true); carregarPastas(true); } }, 60000);
    return () => clearInterval(t);
  }, [carregarLista, carregarPastas, escrita]);

  const atualizarTudo = () => { carregarLista(); carregarPastas(true); };

  async function abrir(m) {
    setSel(m.uid); setAberta(null); setCarregandoMsg(true);
    try {
      const msg = await abrirEmail(conta.id, pastaId, m.uid);
      setAberta(msg);
      if (!m.lida) {
        setLista((l) => l && { ...l, mensagens: l.mensagens.map((x) => (x.uid === m.uid ? { ...x, lida: true } : x)) });
        setPastas((ps) => ps.map((p) => (p.id === pastaId && p.naoLidas ? { ...p, naoLidas: p.naoLidas - 1 } : p)));
        emailMudou();
      }
    } catch (e) { erroMsg(e); setSel(null); } finally { setCarregandoMsg(false); }
  }

  async function agir(uids, tipo, destino) {
    if (!uids.length) return;
    if (tipo === "excluir" && (pasta?.tipo === "lixeira" || !pastas.some((p) => p.tipo === "lixeira"))) {
      if (!window.confirm(`Excluir ${uids.length > 1 ? `${uids.length} mensagens` : "esta mensagem"} DE VEZ? Não dá para desfazer.`)) return;
    }
    setOcupado(true);
    try {
      await agirEmail(conta.id, pastaId, uids, tipo, destino);
      const sai = ["mover", "excluir", "arquivar", "spam"].includes(tipo);
      if (sai) {
        if (uids.includes(sel)) { setSel(null); setAberta(null); }
        setMarcados(new Set());
        const textos = { excluir: "Excluída", arquivar: "Arquivada", spam: "Marcada como spam", mover: "Movida" };
        setAviso({ tipo: "ok", texto: `${textos[tipo]}${uids.length > 1 ? `s ${uids.length} mensagens` : ""}.` });
      } else {
        const muda = { lido: { lida: true }, naoLido: { lida: false }, estrela: { estrela: true }, semEstrela: { estrela: false } }[tipo];
        setLista((l) => l && { ...l, mensagens: l.mensagens.map((x) => (uids.includes(x.uid) ? { ...x, ...muda } : x)) });
        if (aberta && uids.includes(aberta.uid)) setAberta((a) => ({ ...a, ...muda }));
        if (tipo === "naoLido" && uids.includes(sel)) { setSel(null); setAberta(null); }
      }
      atualizarTudo();
      emailMudou();
    } catch (e) { erroMsg(e); } finally { setOcupado(false); }
  }

  function novaEscrita(modo, base) {
    if (!conta) return;
    if (modo === "novo") return setEscrita({ modo, contaId: conta.id, para: "", cc: "", assunto: "" });
    const eu = new Set(contas.map((c) => c.email.toLowerCase()));
    const responderA = base.responderPara?.length ? base.responderPara : [base.de];
    let para = responderA, cc = [];
    if (modo === "responderTodos") {
      const ja = new Set(para.map((e) => e.email));
      cc = [...base.para, ...base.cc].filter((e) => !eu.has(e.email) && !ja.has(e.email) && (ja.add(e.email), true));
    }
    if (modo === "encaminhar") { para = []; cc = []; }
    setEscrita({
      modo, base, contaId: conta.id, origemPasta: pastaId,
      para: listaTexto(para.filter((e) => !eu.has(e.email) || modo !== "responderTodos")), cc: listaTexto(cc),
      assunto: assuntoResposta(base.assunto, modo === "encaminhar" ? "encaminhar" : "responder"),
    });
  }

  if (erroIni) return <div className="p-4"><ErroModulo mensagem={erroIni} aoTentar={carregarInicio} /></div>;
  if (!ini) return <CarregandoModulo />;

  const assinaturaDe = (c) => ({ nome: c?.nomeExibicao || ini.nome, cargo: c?.cargoAssinatura || ini.cargo, email: c?.email || "" });

  if (!contas.length) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
        <div className="card p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700"><Mail size={24} aria-hidden="true" /></span>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">Seu e-mail dentro do painel</h1>
              <p className="text-sm text-slate-500">Conecte sua caixa da Hostinger ou do Gmail. Só você vê as suas caixas.</p>
            </div>
          </div>
          <ul className="mb-5 space-y-1.5 text-sm text-slate-600">
            <li>• Tudo que você fizer aqui aparece igual no webmail e no celular — é a mesma caixa.</li>
            <li>• Os e-mails enviados saem com a assinatura padrão MinasLab e ficam em “Enviados”.</li>
            <li>• Pode conectar mais de uma caixa (a sua e a do setor, por exemplo).</li>
          </ul>
          <button type="button" className="btn-primary" onClick={() => setCaixaForm({})}><Plus size={16} aria-hidden="true" /> Conectar minha caixa</button>
        </div>
        <FormCaixa aberto={!!caixaForm} inicial={caixaForm} ini={ini} aoFechar={() => setCaixaForm(null)}
          aoSalvar={(c) => { setCaixaForm(null); setContaId(c.id); setAviso({ tipo: "ok", texto: "Caixa conectada." }); carregarInicio(); }}
          aoRemover={() => {}} />
      </div>
    );
  }

  const msgs = lista?.mensagens || [];
  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.porPagina)) : 1;
  const todosMarcados = msgs.length > 0 && msgs.every((m) => marcados.has(m.uid));
  const marcadosArr = [...marcados];
  const pastasMover = pastas.filter((p) => p.id !== pastaId && !["estrela", "todos", "rascunhos"].includes(p.tipo));

  return (
    <div className="email-app flex h-[calc(100dvh-6rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-5.25rem)]">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      {/* Topo: título, busca e caixa atual */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 sm:gap-3 sm:px-4">
        <h1 className="font-display text-lg font-semibold text-brand-ink">E-mail</h1>
        <form className="order-3 flex w-full min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:order-none sm:w-auto sm:max-w-xl"
          onSubmit={(e) => { e.preventDefault(); setPagina(1); setSel(null); setAberta(null); setFiltro((f) => ({ ...f, busca: buscaDigitada.trim() })); }}>
          <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input className="h-9 w-full min-w-0 bg-transparent text-sm outline-none" placeholder="Pesquisar e-mails, remetentes, assunto…" aria-label="Pesquisar e-mails"
            value={buscaDigitada} onChange={(e) => setBuscaDigitada(e.target.value)} />
          {filtro.busca && <button type="button" className="text-slate-400 hover:text-slate-600" aria-label="Limpar pesquisa" onClick={() => { setBuscaDigitada(""); setPagina(1); setFiltro((f) => ({ ...f, busca: "" })); }}><X size={16} /></button>}
        </form>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center rounded-lg border border-slate-200 p-0.5 md:flex" role="group" aria-label="Layout">
            {[["coluna", "Coluna", Columns2], ["linha", "Linha", Rows3]].map(([v, rot, Ic]) => (
              <button key={v} type="button" onClick={() => setLayout(v)} aria-pressed={layout === v} title={`Layout em ${rot.toLowerCase()}`}
                className={clsx("flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold", layout === v ? "bg-brand-ink text-white" : "text-slate-500 hover:bg-slate-100")}>
                <Ic size={15} aria-hidden="true" /><span className="hidden xl:inline">{rot}</span>
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="email-caixa">Caixa de e-mail</label>
          <select id="email-caixa" className="input h-9 max-w-[15rem] py-0 text-sm" value={conta.id} onChange={(e) => setContaId(e.target.value)}>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.email}</option>)}
          </select>
          <button type="button" className="btn-ghost h-9 w-9 p-0" title="Configurar esta caixa" aria-label="Configurar esta caixa" onClick={() => setCaixaForm(conta)}><Settings2 size={18} /></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Pastas */}
        <nav className="hidden w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-slate-200 bg-slate-50/60 p-3 lg:flex" aria-label="Pastas">
          <button type="button" className="btn-primary mb-3 h-11 w-full justify-center rounded-xl" onClick={() => novaEscrita("novo")}><Pencil size={16} aria-hidden="true" /> Escrever</button>
          {erroPastas && <p className="rounded-lg bg-bad-50 p-2 text-xs text-bad-700">{erroPastas} <button type="button" className="underline" onClick={() => carregarPastas()}>tentar de novo</button></p>}
          {!pastas.length && !erroPastas && <p className="flex items-center gap-2 p-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Abrindo a caixa…</p>}
          {pastas.map((p, i) => {
            const Ic = ICONE_PASTA[p.tipo] || Folder;
            const primeiraSua = !p.tipo && (i === 0 || pastas[i - 1].tipo);
            return (
              <div key={p.id}>
                {primeiraSua && <p className="mb-1 mt-3 px-2 text-[10px] font-semibold tracking-[0.16em] text-slate-400">PASTAS</p>}
                <button type="button" onClick={() => { setPastaId(p.id); setPagina(1); setSel(null); setAberta(null); setMarcados(new Set()); }}
                  className={clsx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm", p.id === pastaId ? "bg-brand-50 font-semibold text-brand-800" : "text-slate-600 hover:bg-white")}>
                  <Ic size={16} className="shrink-0 opacity-70" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{p.rotulo}</span>
                  {p.naoLidas > 0 && p.tipo !== "enviados" && p.tipo !== "lixeira" && (
                    <span className={clsx("rounded-full px-1.5 text-[11px] font-semibold", p.tipo === "entrada" ? "bg-brand-600 text-white" : "text-slate-500")}>{p.naoLidas}</span>
                  )}
                </button>
              </div>
            );
          })}
          <p className="mb-1 mt-4 px-2 text-[10px] font-semibold tracking-[0.16em] text-slate-400">MINHAS CAIXAS</p>
          {contas.map((c) => (
            <button key={c.id} type="button" onClick={() => setContaId(c.id)} title={c.email}
              className={clsx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px]", c.id === conta.id ? "font-semibold text-slate-800" : "text-slate-600 hover:bg-white")}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corDe(c.id) }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{c.email}</span>
              {c.ultimoErro && <ShieldAlert size={14} className="text-bad-600" aria-label="Problema de acesso" />}
            </button>
          ))}
          <button type="button" className="mt-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-brand-700 hover:bg-white" onClick={() => setCaixaForm({})}>
            <Plus size={15} aria-hidden="true" /> Adicionar caixa
          </button>
        </nav>

        {/* Lista */}
        <section className={clsx("flex min-w-0 flex-col",
          emLinha ? (sel ? "hidden" : "flex flex-1")
            : clsx("border-r border-slate-200 md:w-[22rem] md:shrink-0 xl:w-[25rem] 2xl:w-[30rem]", sel ? "hidden md:flex" : "flex flex-1 md:flex-none"))} aria-label="Mensagens">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" aria-label="Marcar todas desta página" checked={todosMarcados}
              onChange={() => setMarcados(todosMarcados ? new Set() : new Set(msgs.map((m) => m.uid)))} />
            {marcados.size ? (
              <div className="flex flex-1 items-center gap-1">
                <span className="mr-1 text-xs text-slate-500">{marcados.size} marcada{marcados.size > 1 ? "s" : ""}</span>
                <BotaoIcone titulo="Marcar como lidas" icone={MailOpen} onClick={() => agir(marcadosArr, "lido")} desativado={ocupado} />
                <BotaoIcone titulo="Marcar como não lidas" icone={Mail} onClick={() => agir(marcadosArr, "naoLido")} desativado={ocupado} />
                <BotaoIcone titulo="Excluir" icone={Trash2} onClick={() => agir(marcadosArr, "excluir")} desativado={ocupado} perigo />
                <SeletorMover pastas={pastasMover} aoEscolher={(d) => agir(marcadosArr, "mover", d)} desativado={ocupado} />
              </div>
            ) : (
              <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
                <button type="button" className="btn-primary h-8 shrink-0 px-2.5 text-xs lg:hidden" onClick={() => novaEscrita("novo")}><Pencil size={14} aria-hidden="true" /> Escrever</button>
                <select className="input h-8 min-w-[8rem] py-0 text-xs lg:hidden" aria-label="Pasta" value={pastaId} onChange={(e) => { setPastaId(e.target.value); setPagina(1); }}>
                  {pastas.map((p) => <option key={p.id} value={p.id}>{p.rotulo}{p.naoLidas ? ` (${p.naoLidas})` : ""}</option>)}
                </select>
                {[["naoLidas", "Não lidas"], ["comAnexo", "Com anexo"]].map(([k, r]) => (
                  <button key={k} type="button" onClick={() => { setPagina(1); setFiltro((f) => ({ ...f, [k]: !f[k] })); }}
                    className={clsx("shrink-0 rounded-full border px-2.5 py-1 text-xs", filtro[k] ? "border-brand-ink bg-brand-ink text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>{r}</button>
                ))}
              </div>
            )}
            <BotaoIcone titulo="Atualizar" icone={RefreshCw} onClick={atualizarTudo} girando={carregandoLista} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {erroLista && <div className="m-3 rounded-lg bg-bad-50 p-3 text-sm text-bad-700">{erroLista} <button type="button" className="underline" onClick={() => carregarLista()}>Tentar de novo</button></div>}
            {!lista && !erroLista && <ListaCarregando />}
            {lista && !msgs.length && !erroLista && (
              <p className="p-8 text-center text-sm text-slate-500">{filtro.busca || filtro.naoLidas || filtro.comAnexo ? "Nada encontrado com esse filtro." : "Nenhuma mensagem nesta pasta."}</p>
            )}
            {msgs.map((m) => (
              <LinhaMensagem key={m.uid} m={m} larga={emLinha} ativa={m.uid === sel} marcada={marcados.has(m.uid)} enviados={pasta?.tipo === "enviados" || pasta?.tipo === "rascunhos"}
                aoAbrir={() => abrir(m)} aoMarcar={() => setMarcados((s) => { const n = new Set(s); n.has(m.uid) ? n.delete(m.uid) : n.add(m.uid); return n; })}
                aoEstrela={() => agir([m.uid], m.estrela ? "semEstrela" : "estrela")} />
            ))}
          </div>
          {lista && lista.total > lista.porPagina && (
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">
              <span>{(pagina - 1) * lista.porPagina + 1}–{Math.min(pagina * lista.porPagina, lista.total)} de {lista.total.toLocaleString("pt-BR")}</span>
              <BotaoIcone titulo="Página anterior" icone={ChevronLeft} onClick={() => setPagina((p) => Math.max(1, p - 1))} desativado={pagina <= 1} />
              <BotaoIcone titulo="Próxima página" icone={ChevronRight} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} desativado={pagina >= totalPaginas} />
            </div>
          )}
        </section>

        {/* Leitura */}
        <section className={clsx("min-w-0 flex-1 flex-col", sel ? "flex" : emLinha ? "hidden" : "hidden md:flex")} aria-label="Mensagem aberta">
          {!sel && <div className="grid flex-1 place-items-center p-8 text-center text-sm text-slate-400"><div><MailOpen size={40} className="mx-auto mb-2 opacity-40" aria-hidden="true" />Escolha uma mensagem para ler.</div></div>}
          {sel && carregandoMsg && <div className="grid flex-1 place-items-center text-sm text-slate-500"><Loader2 className="animate-spin" aria-label="Abrindo a mensagem" /></div>}
          {sel && aberta && (
            <Leitura key={`${pastaId}|${aberta.uid}`} m={aberta} contaId={conta.id} pastaId={pastaId} emLinha={emLinha} pasta={pasta} pastasMover={pastasMover} ocupado={ocupado} temArquivo={pastas.some((p) => p.tipo === "arquivo")} temSpam={pastas.some((p) => p.tipo === "spam")}
              aoVoltar={() => { setSel(null); setAberta(null); }}
              aoResponder={(modo) => novaEscrita(modo, aberta)}
              aoAgir={(tipo, destino) => agir([aberta.uid], tipo, destino)}
              aoBaixar={async (a, origem = { pasta: pastaId, uid: aberta.uid }) => {
                try { const r = await baixarAnexoEmail(conta.id, origem.pasta, origem.uid, a.indice); baixarBase64(r.nome, r.tipo, r.base64); } catch (e) { erroMsg(e); }
              }} />
          )}
        </section>
      </div>

      <Escrever estado={escrita} contas={contas} assinaturaDe={assinaturaDe} aoFechar={() => setEscrita(null)}
        aoEnviado={() => { setEscrita(null); setAviso({ tipo: "ok", texto: "E-mail enviado. A cópia fica em Enviados." }); atualizarTudo(); }} />
      <FormCaixa aberto={!!caixaForm} inicial={caixaForm} ini={ini} aoFechar={() => setCaixaForm(null)}
        aoSalvar={(c) => { setCaixaForm(null); setContaId(c.id); setAviso({ tipo: "ok", texto: "Caixa salva." }); carregarInicio(); if (c.id === conta.id) carregarPastas(); }}
        aoRemover={async (c) => {
          try { await removerCaixa(c.id); setCaixaForm(null); setContaId(null); setAviso({ tipo: "ok", texto: "Caixa desconectada do painel. Os e-mails continuam na caixa." }); carregarInicio(); emailMudou(300); } catch (e) { erroMsg(e); }
        }} />
    </div>
  );
}

function BotaoIcone({ titulo, icone: Ic, onClick, desativado, perigo, girando }) {
  return (
    <button type="button" title={titulo} aria-label={titulo} onClick={onClick} disabled={desativado}
      className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40", perigo && "hover:text-bad-700")}>
      <Ic size={16} className={girando ? "animate-spin" : ""} aria-hidden="true" />
    </button>
  );
}

function SeletorMover({ pastas, aoEscolher, desativado, rotulo = false }) {
  return (
    <label className={clsx("relative inline-flex items-center", rotulo ? "btn-outline h-9 gap-1.5 px-3 text-sm" : "h-8 w-8 justify-center rounded-lg text-slate-500 hover:bg-slate-100")} title="Mover para…">
      <Folder size={16} aria-hidden="true" />{rotulo && <span>Mover para…</span>}
      <select className="absolute inset-0 cursor-pointer opacity-0" aria-label="Mover para a pasta" value="" disabled={desativado} onChange={(e) => e.target.value && aoEscolher(e.target.value)}>
        <option value="">Mover para…</option>
        {pastas.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
      </select>
    </label>
  );
}

function ListaCarregando() {
  return <div className="space-y-px">{Array.from({ length: 8 }, (_, i) => <div key={i} className="flex gap-3 px-4 py-3"><div className="h-4 w-4 rounded bg-slate-100" /><div className="flex-1 space-y-2"><div className="h-3 w-1/2 rounded bg-slate-100" /><div className="h-3 w-4/5 rounded bg-slate-100" /></div></div>)}</div>;
}

function LinhaMensagem({ m, larga, ativa, marcada, enviados, aoAbrir, aoMarcar, aoEstrela }) {
  const quem = enviados ? `Para: ${m.para.map(nomeOuEmail).join(", ") || "—"}` : nomeOuEmail(m.de);
  if (larga) {
    return (
      <div className={clsx("group relative flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-2", ativa ? "bg-brand-50/70" : marcada ? "bg-amber-50/50" : m.lida ? "hover:bg-slate-50" : "bg-white hover:bg-slate-50")} onClick={aoAbrir}>
        {!m.lida && <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-600" aria-hidden="true" />}
        <input type="checkbox" className="h-4 w-4 shrink-0 accent-brand-600" aria-label={`Marcar mensagem de ${quem}`} checked={marcada} onClick={(e) => e.stopPropagation()} onChange={aoMarcar} />
        <button type="button" className={clsx("shrink-0", m.estrela ? "text-amber-500" : "text-slate-300 hover:text-slate-500")} aria-label={m.estrela ? "Tirar estrela" : "Pôr estrela"} onClick={(e) => { e.stopPropagation(); aoEstrela(); }}>
          <Star size={16} fill={m.estrela ? "currentColor" : "none"} />
        </button>
        <span className={clsx("w-36 shrink-0 truncate text-[13.5px] sm:w-56", m.lida ? "text-slate-600" : "font-bold text-slate-900")}>{quem}</span>
        {m.respondida && <Reply size={12} className="shrink-0 text-slate-400" aria-label="Respondida" />}
        <span className={clsx("min-w-0 flex-1 truncate text-[13.5px]", m.lida ? "text-slate-600" : "font-semibold text-slate-800")}>{m.assunto || "(sem assunto)"}</span>
        {m.temAnexo && <Paperclip size={14} className="shrink-0 text-slate-400" aria-label="Com anexo" />}
        <span className={clsx("w-16 shrink-0 text-right text-xs", m.lida ? "text-slate-400" : "font-bold text-brand-700")}>{quando(m.data)}</span>
      </div>
    );
  }
  return (
    <div className={clsx("group relative flex cursor-pointer items-start gap-2.5 border-b border-slate-100 px-3 py-2.5", ativa ? "bg-brand-50/70" : marcada ? "bg-amber-50/50" : "hover:bg-slate-50")} onClick={aoAbrir}>
      {ativa && <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-600" aria-hidden="true" />}
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-brand-600" aria-label={`Marcar mensagem de ${quem}`} checked={marcada} onClick={(e) => e.stopPropagation()} onChange={aoMarcar} />
      <button type="button" className={clsx("mt-0.5 shrink-0", m.estrela ? "text-amber-500" : "text-slate-300 hover:text-slate-500")} aria-label={m.estrela ? "Tirar estrela" : "Pôr estrela"} onClick={(e) => { e.stopPropagation(); aoEstrela(); }}>
        <Star size={16} fill={m.estrela ? "currentColor" : "none"} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={clsx("min-w-0 flex-1 truncate text-[13.5px]", m.lida ? "text-slate-600" : "font-bold text-slate-900")}>{quem}</span>
          <span className={clsx("shrink-0 text-[11px]", m.lida ? "text-slate-400" : "font-bold text-brand-700")}>{quando(m.data)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {m.respondida && <Reply size={12} className="shrink-0 text-slate-400" aria-label="Respondida" />}
          <span className={clsx("min-w-0 flex-1 truncate text-[13px]", m.lida ? "text-slate-500" : "font-semibold text-slate-800")}>{m.assunto || "(sem assunto)"}</span>
          {m.temAnexo && <Paperclip size={13} className="shrink-0 text-slate-400" aria-label="Com anexo" />}
        </div>
      </div>
    </div>
  );
}

// Corpo da mensagem num iframe sem scripts: o HTML de quem mandou não roda nada no painel.
function CorpoMensagem({ html }) {
  const ref = useRef(null);
  const [altura, setAltura] = useState(120);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline' https:; font-src https: data:"><base target="_blank"><style>html,body{margin:0;padding:0}body{font-family:Inter,'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.55;color:#33474c;overflow-wrap:anywhere}img{max-width:100%;height:auto}blockquote{margin:6px 0 0 6px;padding-left:10px;border-left:2px solid #c9d6d3;color:#4b6066}table{max-width:100%}</style></head><body>${html}</body></html>`;
  const medir = () => {
    try { const b = ref.current?.contentDocument?.body; if (b) setAltura(Math.max(80, Math.ceil(b.getBoundingClientRect().height) + 24)); } catch { /* sem acesso */ }
  };
  return <iframe ref={ref} title="Conteúdo da mensagem" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} onLoad={() => { medir(); setTimeout(medir, 400); setTimeout(medir, 1500); }} className="w-full border-0" style={{ height: altura }} />;
}

// Leitura em conversa (como no webmail): as mensagens com o mesmo assunto (sem Re:/Enc:) — da
// pasta aberta, da Caixa de entrada e de Enviados — em cartões, da mais antiga para a mais nova.
// A que foi clicada já vem aberta; as outras mostram só quem, quando e uma prévia, e abrem no clique.
function Leitura({ m, contaId, pastaId, emLinha, pasta, pastasMover, ocupado, temArquivo, temSpam, aoVoltar, aoResponder, aoAgir, aoBaixar }) {
  const chaveDe = (x) => `${x.pasta}|${x.uid}`;
  const minha = chaveDe({ pasta: pastaId, uid: m.uid });
  const [conversa, setConversa] = useState(null);
  const [abertas, setAbertas] = useState(() => new Set([minha]));
  const [corpos, setCorpos] = useState({});
  const [carregando, setCarregando] = useState(null);
  const [erro, setErro] = useState("");
  const minhaRef = useRef(null);

  useEffect(() => {
    let vivo = true;
    conversaEmail(contaId, pastaId, m.assunto).then((l) => vivo && setConversa(l || [])).catch(() => vivo && setConversa([]));
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lista final: a conversa achada no servidor, sempre com a mensagem aberta dentro.
  const itens = useMemo(() => {
    const l = (conversa || []).filter((x) => !(x.messageId && m.messageId && x.messageId === m.messageId && chaveDe(x) !== minha));
    const temMinha = l.some((x) => chaveDe(x) === minha);
    const todos = temMinha ? l : [...l, { ...m, pasta: pastaId }];
    return todos.sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
  }, [conversa]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (itens.length > 1) minhaRef.current?.scrollIntoView({ block: "start" }); }, [itens.length]);

  async function alternar(x) {
    const k = chaveDe(x);
    if (abertas.has(k)) { setAbertas((a) => { const n = new Set(a); n.delete(k); return n; }); return; }
    setAbertas((a) => new Set([...a, k]));
    if (corpos[k]) return;
    setCarregando(k); setErro("");
    try { const c = await abrirEmail(contaId, x.pasta, x.uid); setCorpos((cs) => ({ ...cs, [k]: c })); }
    catch (e) { setErro(e.message); setAbertas((a) => { const n = new Set(a); n.delete(k); return n; }); }
    finally { setCarregando(null); }
  }

  const varias = itens.length > 1;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-2 sm:px-5">
        <button type="button" className={clsx("btn-ghost h-9 w-9 p-0", !emLinha && "md:hidden")} title="Voltar para a lista" aria-label="Voltar para a lista" onClick={aoVoltar}><ArrowLeft size={18} /></button>
        <button type="button" className="btn-primary h-9 px-3 text-sm" onClick={() => aoResponder("responder")}><Reply size={15} aria-hidden="true" /> Responder</button>
        <button type="button" className="btn-outline hidden h-9 px-3 text-sm sm:inline-flex" onClick={() => aoResponder("responderTodos")}><ReplyAll size={15} aria-hidden="true" /> Responder a todos</button>
        <button type="button" className="btn-outline h-9 px-3 text-sm" onClick={() => aoResponder("encaminhar")}><Forward size={15} aria-hidden="true" /> <span className="hidden sm:inline">Encaminhar</span></button>
        <div className="ml-auto flex items-center gap-1">
          <BotaoIcone titulo={m.estrela ? "Tirar estrela" : "Pôr estrela"} icone={Star} onClick={() => aoAgir(m.estrela ? "semEstrela" : "estrela")} desativado={ocupado} />
          <BotaoIcone titulo="Marcar como não lida" icone={Mail} onClick={() => aoAgir("naoLido")} desativado={ocupado} />
          <SeletorMover pastas={pastasMover} aoEscolher={(d) => aoAgir("mover", d)} desativado={ocupado} />
          {temArquivo && pasta?.tipo !== "arquivo" && <BotaoIcone titulo="Arquivar" icone={Archive} onClick={() => aoAgir("arquivar")} desativado={ocupado} />}
          {temSpam && pasta?.tipo !== "spam" && <BotaoIcone titulo="Marcar como spam" icone={ShieldAlert} onClick={() => aoAgir("spam")} desativado={ocupado} />}
          <BotaoIcone titulo={pasta?.tipo === "lixeira" ? "Excluir de vez" : "Excluir"} icone={Trash2} onClick={() => aoAgir("excluir")} desativado={ocupado} perigo />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-7">
        <h2 className="font-display text-xl font-semibold text-slate-900">{assuntoBase(m.assunto) || m.assunto || "(sem assunto)"}</h2>
        <p className="mb-3 mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          {conversa === null ? <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Buscando a conversa…</> : `${itens.length} ${itens.length > 1 ? "mensagens" : "mensagem"}`}
        </p>
        {erro && <p className="mb-2 rounded-lg bg-bad-50 p-2 text-xs text-bad-700">{erro}</p>}
        {!varias ? (
          <CorpoCompleto m={m} aoBaixar={(a) => aoBaixar(a)} />
        ) : (
          <div className="flex flex-col gap-3">
            {itens.map((x) => {
              const k = chaveDe(x), aberto = abertas.has(k), c = k === minha ? m : corpos[k];
              return (
                <article key={k} ref={k === minha ? minhaRef : undefined} className={clsx("scroll-mt-2 rounded-xl border bg-white", aberto ? "border-slate-200 shadow-sm" : "border-slate-200 hover:bg-slate-50")}>
                  {aberto && c ? (
                    <div className="px-4 pb-3 pt-3">
                      <CorpoCompleto m={c} aoRecolher={() => alternar(x)} aoBaixar={(a) => aoBaixar(a, { pasta: x.pasta, uid: x.uid })} />
                    </div>
                  ) : (
                    <button type="button" onClick={() => alternar(x)} className="block w-full px-4 py-3 text-left" aria-expanded={aberto}>
                      <span className="flex items-center gap-2">
                        <b className={clsx("min-w-0 flex-1 truncate text-sm", x.lida === false ? "text-slate-900" : "text-slate-700")}>{nomeOuEmail(x.de)}</b>
                        {x.temAnexo && <Paperclip size={13} className="shrink-0 text-slate-400" aria-label="Com anexo" />}
                        <span className="shrink-0 text-xs text-slate-400">{quando(x.data)}</span>
                        {carregando === k && <Loader2 size={14} className="shrink-0 animate-spin text-slate-400" aria-label="Abrindo" />}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-slate-500">{x.previa || (x.para?.length ? `Para: ${listaTexto(x.para)}` : "")}</span>
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Uma mensagem por inteiro: quem mandou, para quem, quando, corpo e anexos.
function CorpoCompleto({ m, aoBaixar, aoRecolher }) {
  const [baixando, setBaixando] = useState(null);
  const data = m.data ? new Date(m.data).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <>
      <div className={clsx("flex items-start gap-3 border-b border-slate-100 pb-3", aoRecolher && "cursor-pointer")} onClick={aoRecolher} title={aoRecolher ? "Recolher" : undefined}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-ink font-semibold text-white">{inicial(m.de)}</span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="truncate"><b className="text-slate-800">{nomeOuEmail(m.de)}</b> {m.de?.nome && <span className="text-slate-400">&lt;{m.de.email}&gt;</span>}</div>
          <div className="truncate text-xs text-slate-500">Para: {listaTexto(m.para) || "—"}{m.cc?.length ? ` · Cc: ${listaTexto(m.cc)}` : ""}</div>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{data}</span>
      </div>
      <div className="py-3"><CorpoMensagem html={m.html} /></div>
      {m.anexos?.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {m.anexos.map((a) => (
            <button key={a.indice} type="button" disabled={baixando === a.indice} onClick={async () => { setBaixando(a.indice); await aoBaixar(a); setBaixando(null); }}
              className="flex w-64 items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50">
              <span className="grid h-9 w-8 shrink-0 place-items-center rounded bg-slate-600 text-[9px] font-bold uppercase text-white">{(a.nome.split(".").pop() || "arq").slice(0, 4)}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{a.nome}</span><span className="text-xs text-slate-500">{tamanho(a.tamanho)} · Baixar</span></span>
              {baixando === a.indice ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <Download size={16} className="text-slate-400" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- escrever / responder / encaminhar
function Escrever({ estado, contas, assinaturaDe, aoFechar, aoEnviado }) {
  return <Modal titulo={!estado ? "" : estado.modo === "novo" ? "Nova mensagem" : estado.modo === "encaminhar" ? "Encaminhar" : "Responder"} aberto={!!estado} aoFechar={aoFechar} largura="max-w-3xl">
    {estado && <FormEscrever key={`${estado.modo}-${estado.base?.uid || "novo"}`} estado={estado} contas={contas} assinaturaDe={assinaturaDe} aoFechar={aoFechar} aoEnviado={aoEnviado} />}
  </Modal>;
}

function FormEscrever({ estado, contas, assinaturaDe, aoFechar, aoEnviado }) {
  const [contaId, setContaId] = useState(estado.contaId);
  const [para, setPara] = useState(estado.para || "");
  const [cc, setCc] = useState(estado.cc || "");
  const [cco, setCco] = useState("");
  const [verCopias, setVerCopias] = useState(!!estado.cc);
  const [assunto, setAssunto] = useState(estado.assunto || "");
  const [anexos, setAnexos] = useState([]);
  const [comOriginal, setComOriginal] = useState(true);
  const [anexosOriginais, setAnexosOriginais] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const editor = useRef(null);
  const arquivos = useRef(null);
  const conta = contas.find((c) => c.id === contaId) || contas[0];
  const assinatura = conta?.assinaturaAtiva !== false;
  const previaAssinatura = useMemo(() => assinaturaHtml(assinaturaDe(conta), { previa: true, base: BASE }), [conta]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalAnexos = anexos.reduce((s, a) => s + a.tamanho, 0);

  useEffect(() => { editor.current?.focus(); }, []);

  const formatar = (cmd, valor) => { editor.current?.focus(); document.execCommand(cmd, false, valor); };
  async function adicionar(files) {
    const novos = [];
    for (const f of files) {
      if (totalAnexos + novos.reduce((s, a) => s + a.tamanho, 0) + f.size > LIMITE_ANEXOS) { setErro("Os anexos passam de 18 MB. Para arquivos grandes, mande o link do Google Drive."); break; }
      novos.push({ nome: f.name, tipo: f.type || "application/octet-stream", tamanho: f.size, base64: await arquivoParaBase64(f) });
    }
    setAnexos((a) => [...a, ...novos]);
  }

  async function enviar() {
    setErro("");
    const corpo = editor.current?.innerHTML || "";
    const vazioTexto = !(editor.current?.innerText || "").trim();
    const destinos = lerEnderecos(para);
    if (!destinos.length) return setErro("Coloque pelo menos um destinatário em \"Para\".");
    if (!assunto.trim() && !window.confirm("Enviar sem assunto?")) return;
    if (vazioTexto && !anexos.length && estado.modo === "novo" && !window.confirm("A mensagem está vazia. Enviar assim mesmo?")) return;
    let html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f3338">${corpo}</div>`;
    if (assinatura) html += `<br>${assinaturaHtml(assinaturaDe(conta))}`;
    if (estado.base && comOriginal) html += citacaoHtml(estado.base, estado.modo === "encaminhar" ? "encaminhar" : "responder");
    setEnviando(true);
    try {
      await enviarEmail({
        conta: conta.id, para, cc: verCopias ? cc : "", cco: verCopias ? cco : "", assunto: assunto.trim(), html,
        anexos: anexos.map(({ nome, tipo, base64 }) => ({ nome, tipo, base64 })),
        inReplyTo: estado.base && estado.modo !== "encaminhar" ? estado.base.messageId : undefined,
        referencias: estado.base && estado.modo !== "encaminhar" ? estado.base.referencias : undefined,
        origem: estado.base ? { pasta: estado.origemPasta, uid: estado.base.uid, modo: estado.modo === "encaminhar" ? "encaminhar" : "responder" } : undefined,
        anexosOriginais: estado.modo === "encaminhar" && anexosOriginais,
      });
      aoEnviado();
    } catch (e) { setErro(e.message); } finally { setEnviando(false); }
  }

  const campo = "h-9 w-full min-w-0 bg-transparent text-sm outline-none";
  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 border-b border-slate-100 py-1.5">
        <span className="w-14 shrink-0 text-sm text-slate-500">De</span>
        <select className="h-9 w-full bg-transparent text-sm outline-none" value={conta.id} onChange={(e) => setContaId(e.target.value)} aria-label="Enviar pela caixa">
          {contas.map((c) => <option key={c.id} value={c.id}>{(c.nomeExibicao || assinaturaDe(c).nome)} &lt;{c.email}&gt;</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 border-b border-slate-100 py-1.5">
        <label htmlFor="em-para" className="w-14 shrink-0 text-sm text-slate-500">Para</label>
        <input id="em-para" className={campo} value={para} onChange={(e) => setPara(e.target.value)} placeholder="nome@empresa.com.br, outro@…" autoComplete="email" />
        {!verCopias && <button type="button" className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => setVerCopias(true)}>Cc/Cco</button>}
      </div>
      {verCopias && <>
        <div className="flex items-center gap-2 border-b border-slate-100 py-1.5"><label htmlFor="em-cc" className="w-14 shrink-0 text-sm text-slate-500">Cc</label><input id="em-cc" className={campo} value={cc} onChange={(e) => setCc(e.target.value)} /></div>
        <div className="flex items-center gap-2 border-b border-slate-100 py-1.5"><label htmlFor="em-cco" className="w-14 shrink-0 text-sm text-slate-500" title="Cópia oculta">Cco</label><input id="em-cco" className={campo} value={cco} onChange={(e) => setCco(e.target.value)} placeholder="ninguém vê quem está aqui" /></div>
      </>}
      <div className="flex items-center gap-2 border-b border-slate-100 py-1.5">
        <label htmlFor="em-assunto" className="w-14 shrink-0 text-sm text-slate-500">Assunto</label>
        <input id="em-assunto" className={campo} value={assunto} onChange={(e) => setAssunto(e.target.value)} />
      </div>
      <div className="flex items-center gap-0.5 border-b border-slate-100 py-1">
        <BotaoIcone titulo="Negrito" icone={Bold} onClick={() => formatar("bold")} />
        <BotaoIcone titulo="Itálico" icone={Italic} onClick={() => formatar("italic")} />
        <BotaoIcone titulo="Sublinhado" icone={Underline} onClick={() => formatar("underline")} />
        <BotaoIcone titulo="Lista" icone={List} onClick={() => formatar("insertUnorderedList")} />
        <BotaoIcone titulo="Link" icone={Link2} onClick={() => { const u = window.prompt("Endereço do link (https://…)"); if (u && /^(https?:|mailto:)/i.test(u.trim())) formatar("createLink", u.trim()); }} />
        <BotaoIcone titulo="Anexar arquivo" icone={Paperclip} onClick={() => arquivos.current?.click()} />
        <input ref={arquivos} type="file" multiple className="hidden" onChange={(e) => { adicionar([...e.target.files]); e.target.value = ""; }} />
      </div>
      <div ref={editor} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Texto da mensagem"
        className="min-h-[180px] rounded-lg px-2 py-3 text-[14px] leading-relaxed text-slate-800 outline-none [&_a]:text-brand-700 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6"
        onPaste={(e) => { if (e.clipboardData.files?.length) { e.preventDefault(); adicionar([...e.clipboardData.files]); } }} />
      {assinatura ? (
        <div className="border-t border-dashed border-slate-200 pt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Assinatura (automática)</p>
          <div className="overflow-x-auto"><div className="pointer-events-none w-max" dangerouslySetInnerHTML={{ __html: previaAssinatura }} /></div>
        </div>
      ) : <p className="text-xs text-slate-400">Esta caixa está sem assinatura (ligue na configuração da caixa).</p>}
      {estado.base && (
        <div className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-600" checked={comOriginal} onChange={(e) => setComOriginal(e.target.checked)} /> Incluir a mensagem original ({nomeOuEmail(estado.base.de)}, “{estado.base.assunto}”)</label>
          {estado.modo === "encaminhar" && estado.base.anexos?.length > 0 && (
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand-600" checked={anexosOriginais} onChange={(e) => setAnexosOriginais(e.target.checked)} /> Levar os {estado.base.anexos.length} anexo(s) da mensagem original</label>
          )}
        </div>
      )}
      {anexos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {anexos.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs">
              <Paperclip size={12} aria-hidden="true" /><span className="max-w-[14rem] truncate">{a.nome}</span><span className="text-slate-400">{tamanho(a.tamanho)}</span>
              <button type="button" aria-label={`Tirar ${a.nome}`} onClick={() => setAnexos((x) => x.filter((_, j) => j !== i))}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      {erro && <p className="mt-2 rounded-lg bg-bad-50 px-3 py-2 text-sm text-bad-700" role="alert">{erro}</p>}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <button type="button" className="btn-ghost text-sm" onClick={aoFechar} disabled={enviando}>Descartar</button>
        <button type="button" className="btn-primary px-5" onClick={enviar} disabled={enviando}>
          {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />} {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- conectar / configurar caixa
function FormCaixa({ aberto, inicial, ini, aoFechar, aoSalvar, aoRemover }) {
  return <Modal titulo={inicial?.id ? "Configurar caixa" : "Conectar caixa de e-mail"} aberto={aberto} aoFechar={aoFechar} largura="max-w-xl">
    {aberto && <CamposCaixa key={inicial?.id || "nova"} inicial={inicial || {}} ini={ini} aoFechar={aoFechar} aoSalvar={aoSalvar} aoRemover={aoRemover} />}
  </Modal>;
}

function CamposCaixa({ inicial, ini, aoFechar, aoSalvar, aoRemover }) {
  const editando = !!inicial.id;
  const [email, setEmail] = useState(inicial.email || "");
  const [provedor, setProvedor] = useState(inicial.provedor || "");
  const [senha, setSenha] = useState("");
  const [nomeExibicao, setNomeExibicao] = useState(inicial.nomeExibicao || "");
  const [cargo, setCargo] = useState(inicial.cargoAssinatura || "");
  const [assinaturaAtiva, setAssinaturaAtiva] = useState(inicial.assinaturaAtiva !== false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const prov = provedor || (/@(gmail|googlemail)\.com$/i.test(email.trim()) ? "gmail" : "hostinger");
  const previa = useMemo(() => assinaturaHtml({ nome: nomeExibicao.trim() || ini.nome, cargo: cargo.trim() || ini.cargo, email: email.trim() || "seu@email" }, { previa: true, base: BASE }), [nomeExibicao, cargo, email, ini]);

  async function salvar(e) {
    e.preventDefault();
    setErro(""); setSalvando(true);
    try {
      const c = await salvarCaixa({ id: inicial.id, email: email.trim(), provedor: prov, senha, nomeExibicao: nomeExibicao.trim(), cargoAssinatura: cargo.trim(), assinaturaAtiva });
      aoSalvar(c);
    } catch (err) { setErro(err.message); } finally { setSalvando(false); }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      {inicial.ultimoErro && <p className="rounded-lg bg-bad-50 px-3 py-2 text-sm text-bad-700">Último problema: {inicial.ultimoErro} Digite a senha de novo para reconectar.</p>}
      <div>
        <label className="label" htmlFor="cx-email">Endereço de e-mail</label>
        <input id="cx-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seunome@minaslab.online" autoComplete="email" autoFocus={!editando} />
      </div>
      <div>
        <span className="label">Onde fica esta caixa</span>
        <div className="flex gap-2">
          {[["hostinger", "Hostinger (@minaslab…)"], ["gmail", "Gmail"]].map(([v, r]) => (
            <button key={v} type="button" onClick={() => setProvedor(v)} className={clsx("flex-1 rounded-xl border px-3 py-2 text-sm", prov === v ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-slate-200 text-slate-600")}>{r}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="cx-senha">{prov === "gmail" ? "Senha de app do Google" : "Senha do e-mail"}{editando && <span className="font-normal text-slate-400"> (deixe vazio para manter)</span>}</label>
        <input id="cx-senha" className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required={!editando} placeholder={prov === "gmail" ? "16 letras, ex.: abcd efgh ijkl mnop" : ""} />
        {prov === "gmail" ? (
          <div className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">
            O Gmail não aceita a senha normal em outros programas. Para gerar a senha de app:
            <ol className="ml-4 mt-1 list-decimal">
              <li>Ligue a <b>Verificação em duas etapas</b> na sua Conta Google (se ainda não estiver).</li>
              <li>Abra <a className="font-semibold underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">myaccount.google.com/apppasswords</a>, dê o nome “Painel MinasLab” e clique em Criar.</li>
              <li>Copie as 16 letras e cole aqui.</li>
            </ol>
          </div>
        ) : <p className="mt-1 text-xs text-slate-500">A mesma senha que você usa no webmail da Hostinger. Fica guardada cifrada; ninguém consegue ver.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cx-nome">Nome no “De:” e na assinatura</label>
          <input id="cx-nome" className="input" value={nomeExibicao} onChange={(e) => setNomeExibicao(e.target.value)} placeholder={ini.nome} />
        </div>
        <div>
          <label className="label" htmlFor="cx-cargo">Cargo na assinatura</label>
          <input id="cx-cargo" className="input" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder={ini.cargo || "cargo do RH"} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={assinaturaAtiva} onChange={(e) => setAssinaturaAtiva(e.target.checked)} /> Colocar a assinatura MinasLab nos e-mails desta caixa</label>
      {assinaturaAtiva && <div className="overflow-x-auto rounded-xl border border-slate-200 p-3"><div className="pointer-events-none origin-top-left scale-[0.8]" dangerouslySetInnerHTML={{ __html: previa }} /></div>}
      {erro && <p className="rounded-lg bg-bad-50 px-3 py-2 text-sm text-bad-700" role="alert">{erro}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {editando ? <button type="button" className="btn-ghost text-sm text-bad-700" onClick={() => { if (window.confirm(`Desconectar ${inicial.email} do painel? Os e-mails continuam na caixa.`)) aoRemover(inicial); }}><Trash2 size={15} aria-hidden="true" /> Desconectar</button> : <span />}
        <div className="flex gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Testando a conexão…</> : editando ? "Salvar" : "Conectar"}</button>
        </div>
      </div>
    </form>
  );
}
