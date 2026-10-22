// Campo de escrever mensagem com formatação: barra (negrito, itálico, sublinhado,
// riscado, link, marcar pessoa), atalhos Ctrl+B / Ctrl+I / Ctrl+U / Ctrl+K e o
// "@" que sugere as pessoas da conversa. O texto vai simples, com marcações
// (*negrito* _itálico_ __sublinhado__ ~riscado~ [texto](link) @usuario).
import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Bold, Italic, Link2, Strikethrough, Underline } from "lucide-react";
import { clsx } from "clsx";
import Avatar from "../tarefas/Avatar.jsx";
import TextoRico from "./TextoRico.jsx";
import { MARCAS, completarMencao, envolver, enderecoValido, inserirLink, mencaoEmDigitacao, sugestoesMencao, temFormatacao } from "../../lib/textoRico.js";

export default function EditorMensagem({ campo, texto, setTexto, aoEnviar, aoColarArquivos, pessoas, grupo, nomeDe, ehUsuario, eu, desabilitado, aoCancelar, aoSetaCima, children }) {
  const [mencao, setMencao] = useState(null); // { inicio, busca }
  const [ativo, setAtivo] = useState(0);
  const [link, setLink] = useState(null); // { ini, fim, url }
  const linkRef = useRef(null);

  const sugestoes = useMemo(() => (mencao ? sugestoesMencao(pessoas, mencao.busca, { grupo }) : []), [mencao, pessoas, grupo]);
  useEffect(() => { setAtivo(0); }, [mencao?.busca]);
  useEffect(() => { if (link) linkRef.current?.focus(); }, [link]);

  const selecionar = (ini, fim = ini) => requestAnimationFrame(() => { const el = campo.current; if (el) { el.focus(); el.setSelectionRange(ini, fim); } });
  const olharMencao = (valor, cursor) => setMencao(mencaoEmDigitacao(valor, cursor));

  const formatar = (tipo) => {
    const el = campo.current;
    const r = envolver(texto, el?.selectionStart, el?.selectionEnd, MARCAS[tipo]);
    setTexto(r.texto);
    selecionar(r.ini, r.fim);
  };
  const abrirLink = () => {
    const el = campo.current;
    const ini = el?.selectionStart ?? texto.length, fim = el?.selectionEnd ?? ini;
    const sel = texto.slice(ini, fim).trim();
    setLink({ ini, fim, url: enderecoValido(sel) ? sel : "" });
  };
  const confirmarLink = () => {
    if (!link || !enderecoValido(link.url)) return;
    const r = inserirLink(texto, link.ini, link.fim, link.url);
    setTexto(r.texto);
    setLink(null);
    selecionar(r.cursor);
  };
  const marcar = () => {
    const el = campo.current;
    const pos = el?.selectionStart ?? texto.length;
    const antes = texto.slice(0, pos);
    const trecho = antes && !/\s$/.test(antes) ? " @" : "@";
    const novo = antes + trecho + texto.slice(el?.selectionEnd ?? pos);
    setTexto(novo);
    const cursor = pos + trecho.length;
    selecionar(cursor);
    setMencao({ inicio: cursor - 1, busca: "" });
  };
  const escolher = (p) => {
    const el = campo.current;
    const cursor = el?.selectionStart ?? texto.length;
    const r = completarMencao(texto, mencao.inicio, cursor, p.usuario);
    setTexto(r.texto);
    setMencao(null);
    selecionar(r.cursor);
  };

  const teclas = (e) => {
    if (mencao && sugestoes.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => (a + 1) % sugestoes.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => (a - 1 + sugestoes.length) % sugestoes.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); escolher(sugestoes[ativo]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMencao(null); return; }
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b" || k === "i" || k === "u") { e.preventDefault(); formatar(k); return; }
      if (k === "k") { e.preventDefault(); abrirLink(); return; }
    }
    if (e.key === "Escape" && aoCancelar) { e.preventDefault(); aoCancelar(); return; }
    // Seta para cima com o campo vazio: edita a última mensagem que você mandou.
    if (e.key === "ArrowUp" && !texto && aoSetaCima) { e.preventDefault(); aoSetaCima(); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); aoEnviar(); }
  };

  const botoes = [
    { k: "b", Icone: Bold, rotulo: "Negrito (Ctrl+B)", acao: () => formatar("b") },
    { k: "i", Icone: Italic, rotulo: "Itálico (Ctrl+I)", acao: () => formatar("i") },
    { k: "u", Icone: Underline, rotulo: "Sublinhado (Ctrl+U)", acao: () => formatar("u") },
    { k: "s", Icone: Strikethrough, rotulo: "Riscado", acao: () => formatar("s") },
    { k: "link", Icone: Link2, rotulo: "Link (Ctrl+K)", acao: abrirLink },
    { k: "mencao", Icone: AtSign, rotulo: "Marcar pessoa (@)", acao: marcar },
  ];
  const previa = texto.trim() && temFormatacao(texto, ehUsuario);

  return (
    <div className="relative min-w-0 flex-1">
      {mencao && sugestoes.length > 0 && (
        <ul role="listbox" aria-label="Marcar pessoa" className="absolute bottom-full left-0 z-40 mb-2 max-h-64 w-72 overflow-y-auto rounded-xl border bg-white p-1 shadow-xl" style={{ borderColor: "var(--hairline)" }}>
          {sugestoes.map((p, i) => (
            <li key={p.usuario} role="option" aria-selected={i === ativo}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(p)} onMouseEnter={() => setAtivo(i)}
                className={clsx("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", i === ativo ? "bg-sky-50 text-sky-900" : "text-slate-700")}>
                {p.todos ? <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-amber-800"><AtSign size={14} /></span> : <Avatar usuario={p.usuario} nome={p.nome} tamanho={28} />}
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.nome}</span><span className="block truncate text-[11px] text-slate-400">@{p.usuario}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {link && (
        <div className="absolute bottom-full left-0 z-40 mb-2 w-80 rounded-xl border bg-white p-3 shadow-xl" style={{ borderColor: "var(--hairline)" }} role="dialog" aria-label="Inserir link">
          <label className="block text-xs font-medium text-slate-600">Endereço do link
            <input ref={linkRef} className="input mt-1 h-9 w-full text-sm" placeholder="https://..." value={link.url}
              onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmarLink(); } if (e.key === "Escape") { e.preventDefault(); setLink(null); selecionar(link.ini, link.fim); } }} />
          </label>
          <p className="mt-1 text-[11px] text-slate-400">{link.fim > link.ini ? "O texto selecionado vira o link." : "Dica: selecione um texto antes para ele virar o link."}</p>
          {link.url && !enderecoValido(link.url) && <p className="mt-1 text-[11px] text-bad-700">Comece com https:// ou www.</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn-outline px-3 py-1 text-xs" onClick={() => { setLink(null); selecionar(link.ini, link.fim); }}>Cancelar</button>
            <button type="button" className="btn-primary px-3 py-1 text-xs" disabled={!enderecoValido(link.url)} onClick={confirmarLink}>Inserir</button>
          </div>
        </div>
      )}
      {previa && (
        <div className="mb-1.5 max-h-28 overflow-y-auto rounded-lg border border-dashed bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800" style={{ borderColor: "var(--hairline)" }} aria-label="Prévia da mensagem">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Prévia</span>
          <TextoRico texto={texto} nomeDe={nomeDe} ehUsuario={ehUsuario} eu={eu} />
        </div>
      )}
      <div className="mb-1 flex items-center gap-0.5" role="toolbar" aria-label="Formatação">
        {botoes.map(({ k, Icone, rotulo, acao }) => (
          <button key={k} type="button" onMouseDown={(e) => e.preventDefault()} onClick={acao} disabled={desabilitado} title={rotulo} aria-label={rotulo}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"><Icone size={15} /></button>
        ))}
        {children}
      </div>
      <textarea ref={campo} className="input max-h-32 min-h-[44px] w-full resize-none py-2.5 text-sm" rows={1} placeholder="Escreva uma mensagem (@ para marcar alguém)" aria-label="Escreva uma mensagem" value={texto} maxLength={5000}
        onChange={(e) => { setTexto(e.target.value); olharMencao(e.target.value, e.target.selectionStart); }}
        onClick={(e) => olharMencao(e.currentTarget.value, e.currentTarget.selectionStart)}
        onKeyUp={(e) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) olharMencao(e.currentTarget.value, e.currentTarget.selectionStart); }}
        onBlur={() => setTimeout(() => setMencao(null), 150)}
        onPaste={(e) => { const f = e.clipboardData?.files; if (f?.length) { e.preventDefault(); aoColarArquivos(f); } }}
        onKeyDown={teclas} />
    </div>
  );
}
