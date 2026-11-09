// SENHAS E ACESSOS — logins dos sites e sistemas que a MinasLab usa (substitui a planilha
// "Senhas e Acessos MinasLab.xlsx"). A senha fica cifrada no servidor (ml-senhas) e só aparece
// quando alguém com permissão clica em mostrar/copiar — e isso fica no histórico. Cada acesso diz
// quem vê (setores e/ou pessoas); a direção vê tudo e define. Alterar a senha guarda a anterior.
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Eye, EyeOff, ExternalLink, History, KeyRound, Lock, Pencil, Plus, Search, Shield, Trash2, Upload, Users } from "lucide-react";
import { Aviso, CarregandoModulo, ErroModulo, Modal, PageTitle, StatCard } from "../components/ui.jsx";
import { Paginacao } from "../components/laboratorio/qualidade/comum.jsx";
import { baixarPlanilha } from "../lib/planilha.js";
import { lerXlsx } from "../lib/laboratorioImportacao.js";
import {
  lerSenhas, revelarSenha, historicoSenha, verSenhaAnterior, salvarAcesso, alterarSenha,
  definirQuemVe, salvarSetor, apagarSetor, importarSenhas, apagarAcesso,
} from "../services/senhas.js";

const CATEGORIAS = [
  ["BANCOS", "Bancos"], ["FISCAL", "Fiscal e governo"], ["FORNECEDORES", "Fornecedores"], ["CLIENTES", "Portais de clientes"],
  ["SISTEMAS", "Sistemas"], ["EMAIL", "E-mail"], ["REDES", "Redes sociais"], ["OUTROS", "Outros"],
];
const NOME_CAT = Object.fromEntries(CATEGORIAS);
const CORES = ["#0b6e4f", "#1e40af", "#b45309", "#7c3aed", "#0e7490", "#be123c", "#15803d", "#db2777", "#475569", "#a16207"];
const POR_PAGINA = 25;
const DIAS_ANTIGA = 180;
const ACOES = {
  CRIOU: "cadastrou o acesso", IMPORTOU: "importou da planilha", REVELOU: "revelou a senha", COPIOU: "copiou a senha",
  ALTEROU_SENHA: "alterou a senha", ALTEROU_DADOS: "alterou os dados", PERMISSAO: "mudou quem vê", VIU_ANTERIOR: "viu uma senha anterior", APAGOU: "apagou o acesso",
};

const fmtData = (v) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const fmtHora = (v) => (v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const diasDesde = (v) => (v ? Math.floor((Date.now() - new Date(v).getTime()) / 86400000) : null);
const sigla = (n) => (String(n || "?").replace(/^https?:\/\/(www\.)?/, "").match(/[A-Za-zÀ-ú0-9]/g) || ["?"]).slice(0, 2).join("").toUpperCase();
const cor = (n) => CORES[[...String(n || "")].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES.length];
const linkDe = (u) => (!u ? null : /^https?:\/\//i.test(u) ? u : `https://${u}`);
const semDono = (i) => !(i.setores?.length || i.pessoas?.length);

function gerarSenha(n = 16) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?";
  const r = crypto.getRandomValues(new Uint32Array(n));
  return [...r].map((x) => a[x % a.length]).join("");
}

export default function Senhas() {
  const [d, setD] = useState(null); const [erro, setErro] = useState(""); const [aviso, setAviso] = useState(null);
  const [busca, setBusca] = useState(""); const [cat, setCat] = useState("TODOS"); const [filtro, setFiltro] = useState(null); const [pagina, setPagina] = useState(1);
  const [selId, setSelId] = useState(null); const [marcados, setMarcados] = useState([]);
  const [form, setForm] = useState(null); const [troca, setTroca] = useState(null); const [quem, setQuem] = useState(null);
  const [setoresAberto, setSetoresAberto] = useState(false); const [importacao, setImportacao] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef(null);

  async function carregar() {
    try { setD(await lerSenhas()); setErro(""); } catch (e) { setErro(e.message); }
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPagina(1); }, [busca, cat, filtro]);

  const itens = d?.itens || [];
  const nomeDe = (u) => d?.contas?.find((c) => c.usuario === u)?.nome || u;
  const FILTROS = {
    SEMDONO: ["Sem quem vê definido", semDono],
    ANTIGA: [`Senha antiga ou sem data de troca`, (i) => i.temSenha && (diasDesde(i.senha_trocada_em) ?? 9999) > DIAS_ANTIGA],
    SEM2FA: ["Sem verificação em 2 etapas anotada", (i) => !i.dois_fatores],
  };
  const base = itens.filter((i) => (!filtro || FILTROS[filtro][1](i))
    && (!busca || `${i.nome} ${i.url || ""} ${i.usuario_login || ""} ${i.observacao || ""}`.toLowerCase().includes(busca.toLowerCase())));
  const lista = base.filter((i) => cat === "TODOS" || i.categoria === cat);
  const paginaLista = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const sel = itens.find((i) => i.id === selId) || null;
  const alternar = (f) => setFiltro((a) => (a === f ? null : f));
  const avisar = (a) => setAviso(a);

  if (erro && !d) return <ErroModulo mensagem={erro} aoTentar={carregar} />;
  if (!d) return <CarregandoModulo />;

  const semDonoN = itens.filter(semDono).length;
  const antigasN = itens.filter(FILTROS.ANTIGA[1]).length;
  const sem2faN = itens.filter(FILTROS.SEM2FA[1]).length;

  function exportar() {
    baixarPlanilha({
      nome: "acessos-sem-senhas", titulo: "Senhas e acessos — lista sem senhas",
      colunas: [{ chave: "nome", rotulo: "Site / sistema" }, { chave: "url", rotulo: "Link" }, { chave: "usuario", rotulo: "Usuário" }, { chave: "cat", rotulo: "Categoria" }, { chave: "quem", rotulo: "Quem vê" }, { chave: "troca", rotulo: "Senha trocada em" }, { chave: "fa", rotulo: "Verificação em 2 etapas" }],
      linhas: lista.map((i) => ({ nome: i.nome, url: i.url || "", usuario: i.usuario_login || "", cat: NOME_CAT[i.categoria] || i.categoria, quem: [...(i.setores || []), ...(i.pessoas || []).map(nomeDe)].join(", ") || "Só direção", troca: fmtData(i.senha_trocada_em), fa: i.dois_fatores || "" })),
    });
  }

  async function escolherPlanilha(e) {
    const arq = e.target.files?.[0]; e.target.value = "";
    if (!arq) return;
    try {
      const linhas = lerXlsx(new Uint8Array(await arq.arrayBuffer()));
      const cab = (linhas[0]?.valores || []).map((v) => String(v ?? "").trim().toLowerCase());
      const col = (re) => cab.findIndex((h) => re.test(h));
      const c = { nome: col(/nome|site|acesso|sistema/), url: col(/link|url|endere/), usuario: col(/usu|login|e-?mail/), senha: col(/senha|pass/), obs: col(/obs/) };
      if (c.senha < 0 || (c.nome < 0 && c.url < 0)) throw new Error("Não achei as colunas da planilha. Ela precisa ter Nome (ou Link) e Senha na primeira linha.");
      const v = (r, i) => (i < 0 || r.valores[i] == null ? "" : String(r.valores[i]).trim());
      const regs = linhas.slice(1).map((r) => ({ nome: v(r, c.nome), url: v(r, c.url), usuario_login: v(r, c.usuario), senha: v(r, c.senha), observacao: v(r, c.obs) }))
        .filter((r) => r.nome || r.url);
      setImportacao({ arquivo: arq.name, regs });
    } catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }
  async function confirmarImportacao() {
    setSalvando(true);
    try {
      const r = await importarSenhas(importacao.regs, importacao.arquivo);
      setImportacao(null); await carregar(); setFiltro("SEMDONO");
      avisar({ tipo: "ok", texto: `${r.novos} acesso(s) importado(s)${r.repetidos ? `, ${r.repetidos} já existiam` : ""}. Agora defina quem vê cada um.` });
    } catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
  }

  const todosMarcados = paginaLista.length > 0 && paginaLista.every((i) => marcados.includes(i.id));
  return (
    <div className="space-y-4">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <PageTitle titulo="Senhas e acessos" descricao="Logins dos sites e sistemas que a MinasLab usa. Cada acesso diz quem pode ver; toda vez que alguém revela, copia ou altera uma senha, fica registrado."
        acao={<div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportar} className="btn-outline inline-flex items-center gap-1.5"><Download className="h-4 w-4" aria-hidden /> Exportar (sem senhas)</button>
          {d.direcao && <button type="button" onClick={() => setSetoresAberto(true)} className="btn-outline inline-flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden /> Setores</button>}
          {d.direcao && <><input ref={arquivo} type="file" accept=".xlsx" className="hidden" onChange={escolherPlanilha} /><button type="button" onClick={() => arquivo.current?.click()} className="btn-outline inline-flex items-center gap-1.5"><Upload className="h-4 w-4" aria-hidden /> Importar planilha</button></>}
          {d.podeEscrever && <button type="button" onClick={() => setForm({ categoria: "OUTROS", senha: "" })} className="btn-primary inline-flex items-center gap-1.5"><Plus className="h-4 w-4" aria-hidden /> Novo acesso</button>}
        </div>} />

      {d.direcao && d.total === 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        <span><b>Comece importando a planilha atual</b> (“Senhas e Acessos MinasLab.xlsx”). As senhas vão do seu computador direto para o servidor, já cifradas. Todos os acessos começam visíveis só para a direção; depois você define quem vê, um a um ou vários de uma vez.</span>
        <button type="button" onClick={() => arquivo.current?.click()} className="btn-primary">Importar planilha</button></div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Acessos que eu vejo" valor={itens.length} sub={d.direcao ? `de ${d.total} cadastrados` : "liberados para você"} onClick={() => setFiltro(null)} ativo={!filtro} />
        {d.direcao && <StatCard rotulo="Sem quem vê definido" valor={semDonoN} tom={semDonoN ? "warn" : "neutral"} sub="hoje só a direção vê" onClick={() => alternar("SEMDONO")} ativo={filtro === "SEMDONO"} />}
        <StatCard rotulo={`Senha antiga (+${DIAS_ANTIGA / 30} meses) ou sem data`} valor={antigasN} tom={antigasN ? "warn" : "neutral"} sub="trocar quando puder" onClick={() => alternar("ANTIGA")} ativo={filtro === "ANTIGA"} />
        <StatCard rotulo="Sem verificação em 2 etapas" valor={sem2faN} sub={`revelados na semana: ${d.revelados.vezes} por ${d.revelados.pessoas} pessoa(s)`} onClick={() => alternar("SEM2FA")} ativo={filtro === "SEM2FA"} />
      </div>
      {filtro && <div className="flex items-center gap-2 text-sm text-slate-600">Mostrando: <b>{FILTROS[filtro][0]}</b><button type="button" onClick={() => setFiltro(null)} className="text-brand-700 underline">limpar</button></div>}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden /><input className="input pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar site, usuário…" /></div>
            {[["TODOS", "Todos"], ...CATEGORIAS].map(([v, l]) => { const n = v === "TODOS" ? base.length : base.filter((i) => i.categoria === v).length; return (v === "TODOS" || n > 0) && <button key={v} type="button" onClick={() => setCat(v)} className={`rounded-full border px-3 py-1 text-xs ${cat === v ? "border-brand-300 bg-brand-50 font-semibold text-brand-700" : "text-slate-600"}`}>{l} <span className="text-slate-400">{n}</span></button>; })}
          </div>
          {d.direcao && marcados.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b bg-brand-50 px-3 py-2 text-sm text-brand-800">
            <b>{marcados.length} selecionado(s)</b>
            <button type="button" onClick={() => setQuem({ ids: marcados, setores: [], pessoas: [], modo: "adicionar" })} className="btn-primary px-3 py-1 text-xs">Definir quem vê</button>
            <button type="button" onClick={() => setMarcados([])} className="text-xs underline">limpar seleção</button></div>}
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
              {d.direcao && <th className="w-8 px-3 py-2.5"><input type="checkbox" aria-label="Selecionar a página" checked={todosMarcados} onChange={() => setMarcados(todosMarcados ? marcados.filter((x) => !paginaLista.some((i) => i.id === x)) : [...new Set([...marcados, ...paginaLista.map((i) => i.id)])])} /></th>}
              <th className="px-3 py-2.5">Site / sistema</th><th className="px-3 py-2.5">Usuário</th><th className="px-3 py-2.5">Quem vê</th><th className="px-3 py-2.5">Trocada em</th></tr></thead>
            <tbody>{paginaLista.map((i) => { const dias = diasDesde(i.senha_trocada_em); return (
              <tr key={i.id} onClick={() => setSelId(i.id)} className={`cursor-pointer border-t hover:bg-slate-50 ${selId === i.id ? "bg-brand-50/60" : ""}`}>
                {d.direcao && <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${i.nome}`} checked={marcados.includes(i.id)} onChange={() => setMarcados(marcados.includes(i.id) ? marcados.filter((x) => x !== i.id) : [...marcados, i.id])} /></td>}
                <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: cor(i.nome) }}>{sigla(i.nome)}</span><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{i.nome}</span><span className="text-xs text-slate-400">{NOME_CAT[i.categoria] || i.categoria}</span></span></div></td>
                <td className="max-w-[200px] truncate px-3 py-2.5 font-mono text-xs text-slate-600">{i.usuario_login || "—"}</td>
                <td className="px-3 py-2.5">{semDono(i) ? <span className="rounded-full bg-warn-50 px-2 py-0.5 text-[11px] font-semibold text-warn-700">só direção</span> : <QuemVe i={i} nomeDe={nomeDe} />}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{!i.temSenha ? <span className="text-xs text-slate-400">sem senha</span> : i.senha_trocada_em ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${dias > DIAS_ANTIGA ? "bg-warn-50 text-warn-700" : "bg-ok-50 text-ok-700"}`}>{fmtData(i.senha_trocada_em)}</span> : <span className="text-xs text-slate-400">não informada</span>}</td>
              </tr>); })}</tbody>
          </table>{lista.length === 0 && <p className="p-10 text-center text-sm text-slate-500">{itens.length ? "Nenhum acesso com esse filtro." : d.direcao ? "Nenhum acesso ainda. Importe a planilha ou cadastre em “Novo acesso”." : "Nenhum acesso liberado para você ainda. Peça à direção."}</p>}</div>
          <Paginacao total={lista.length} pagina={pagina} setPagina={setPagina} porPagina={POR_PAGINA} />
        </div>

        {sel ? <Detalhe key={sel.id} i={sel} d={d} nomeDe={nomeDe} avisar={avisar} recarregar={carregar}
          editar={() => setForm({ ...sel })} trocar={() => setTroca({ id: sel.id, nome: sel.nome, senha: "", confirma: "", motivo: "" })}
          quemVe={() => setQuem({ ids: [sel.id], setores: sel.setores || [], pessoas: sel.pessoas || [], modo: "definir" })} />
          : <div className="card p-6 text-center text-sm text-slate-500"><Lock className="mx-auto mb-2 h-6 w-6 text-slate-300" aria-hidden />Clique num acesso para ver o usuário, mostrar ou copiar a senha, alterar a senha e ver o histórico.</div>}
      </div>

      <FormAcesso form={form} setForm={setForm} salvando={salvando} aoSalvar={async (e) => {
        e.preventDefault(); setSalvando(true);
        try { const r = await salvarAcesso(form); setForm(null); setSelId(r.id); await carregar(); avisar({ tipo: "ok", texto: "Acesso salvo." }); }
        catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
      }} />
      <TrocaSenha troca={troca} setTroca={setTroca} salvando={salvando} aoSalvar={async (e) => {
        e.preventDefault();
        if (troca.senha !== troca.confirma) { avisar({ tipo: "erro", texto: "As duas senhas não são iguais." }); return; }
        setSalvando(true);
        try { await alterarSenha(troca.id, troca.senha, troca.motivo); setTroca(null); await carregar(); avisar({ tipo: "ok", texto: "Senha alterada. A anterior ficou guardada no histórico." }); }
        catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
      }} />
      <QuemVeModal quem={quem} setQuem={setQuem} d={d} salvando={salvando} aoSalvar={async () => {
        setSalvando(true);
        try { const r = await definirQuemVe(quem.ids, quem.setores, quem.pessoas, quem.modo); setQuem(null); setMarcados([]); await carregar(); avisar({ tipo: "ok", texto: `Quem vê atualizado em ${r.alterados} acesso(s).` }); }
        catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
      }} />
      <SetoresModal aberto={setoresAberto} fechar={() => setSetoresAberto(false)} d={d} avisar={avisar} recarregar={carregar} />
      <Modal titulo="Importar planilha de senhas" aberto={!!importacao} aoFechar={() => setImportacao(null)}>
        {importacao && <div className="space-y-3 text-sm">
          <p>Encontrei <b>{importacao.regs.length} acessos</b> em “{importacao.arquivo}” ({importacao.regs.filter((r) => r.senha).length} com senha).</p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            <li>As senhas vão direto para o servidor e são guardadas cifradas.</li>
            <li>A categoria é sugerida pelo site; você ajusta depois.</li>
            <li>Todos começam visíveis <b>só para a direção</b>. Depois use “Sem quem vê definido” para liberar por setor ou pessoa.</li>
            <li>Acesso repetido (mesmo site e usuário) não é importado de novo.</li>
          </ul>
          <p className="rounded-xl bg-warn-50 p-3 text-xs text-warn-800">Depois de conferir no sistema, apague a planilha do computador e do Drive: nela as senhas estão abertas.</p>
          <button type="button" disabled={salvando} onClick={confirmarImportacao} className="btn-primary w-full">{salvando ? "Importando..." : `Importar ${importacao.regs.length} acessos`}</button>
        </div>}
      </Modal>
    </div>
  );
}

function QuemVe({ i, nomeDe }) {
  return <span className="flex flex-wrap gap-1">{(i.setores || []).map((s) => <span key={s} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{s}</span>)}{(i.pessoas || []).map((p) => <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{nomeDe(p)}</span>)}</span>;
}

function Detalhe({ i, d, nomeDe, avisar, recarregar, editar, trocar, quemVe }) {
  const [senha, setSenha] = useState(null); const [hist, setHist] = useState(null); const [anteriores, setAnteriores] = useState({});
  const timer = useRef(null);
  useEffect(() => { historicoSenha(i.id).then(setHist).catch(() => setHist([])); return () => clearTimeout(timer.current); }, [i.id, i.atualizado_em]);
  async function revelar(modo) {
    try {
      const s = await revelarSenha(i.id, modo);
      if (modo === "copiar") { await navigator.clipboard.writeText(s); avisar({ tipo: "ok", texto: "Senha copiada." }); }
      else { setSenha(s); clearTimeout(timer.current); timer.current = setTimeout(() => setSenha(null), 30000); }
      historicoSenha(i.id).then(setHist).catch(() => {});
    } catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }
  async function copiarUsuario() { try { await navigator.clipboard.writeText(i.usuario_login || ""); avisar({ tipo: "ok", texto: "Usuário copiado." }); } catch { avisar({ tipo: "erro", texto: "Não consegui copiar." }); } }
  async function anterior(h) {
    try { const s = await verSenhaAnterior(h.id); setAnteriores({ ...anteriores, [h.id]: s }); } catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }
  async function apagar() {
    if (!window.confirm(`Apagar o acesso “${i.nome}”? O histórico fica guardado.`)) return;
    try { await apagarAcesso(i.id); await recarregar(); avisar({ tipo: "ok", texto: "Acesso apagado." }); } catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }
  const dias = diasDesde(i.senha_trocada_em);
  const link = linkDe(i.url);
  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="font-display text-base font-semibold text-slate-900">{i.nome}</h3>
          {link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs text-brand-700 hover:underline">{i.url}<ExternalLink className="h-3 w-3 shrink-0" aria-hidden /></a>}</div>
        {d.podeEscrever && <button type="button" onClick={editar} className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Pencil className="h-3.5 w-3.5" aria-hidden /> Editar</button>}
      </div>
      <div><span className="label">Usuário</span><div className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2"><span className="truncate font-mono text-sm">{i.usuario_login || "—"}</span>{i.usuario_login && <button type="button" onClick={copiarUsuario} className="text-xs font-semibold text-brand-700">copiar</button>}</div></div>
      <div><span className="label">Senha</span>
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2">
          <span className="truncate font-mono text-sm">{!i.temSenha ? <span className="text-slate-400">sem senha cadastrada</span> : senha ?? "••••••••••••"}</span>
          {i.temSenha && <span className="flex shrink-0 gap-3">
            <button type="button" onClick={() => (senha ? setSenha(null) : revelar("mostrar"))} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">{senha ? <><EyeOff className="h-3.5 w-3.5" aria-hidden /> esconder</> : <><Eye className="h-3.5 w-3.5" aria-hidden /> mostrar</>}</button>
            <button type="button" onClick={() => revelar("copiar")} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><Copy className="h-3.5 w-3.5" aria-hidden /> copiar</button></span>}
        </div>
        {d.podeEscrever && <div className="mt-2 flex items-center gap-2"><button type="button" onClick={trocar} className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><KeyRound className="h-3.5 w-3.5" aria-hidden /> Alterar senha</button><span className="text-xs text-slate-500">a anterior fica guardada no histórico</span></div>}
      </div>
      {i.temSenha && dias > DIAS_ANTIGA && <div className="rounded-xl border border-warn-200 bg-warn-50 p-3 text-xs text-warn-800">Senha trocada há {dias} dias. Vale trocar.</div>}
      {i.temSenha && !i.senha_trocada_em && <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Data da última troca não informada (veio da planilha). Ela passa a contar na próxima alteração.</div>}
      <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-slate-500">Categoria</dt><dd>{NOME_CAT[i.categoria] || i.categoria}</dd>
        <dt className="text-slate-500">2 etapas</dt><dd>{i.dois_fatores || <span className="text-slate-400">não anotada</span>}</dd>
        {i.observacao && <><dt className="text-slate-500">Observação</dt><dd className="whitespace-pre-wrap">{i.observacao}</dd></>}
        <dt className="text-slate-500">Quem vê</dt><dd>{semDono(i) ? <span className="text-warn-700">só a direção</span> : <QuemVe i={i} nomeDe={nomeDe} />}{d.direcao && <button type="button" onClick={quemVe} className="ml-2 text-xs font-semibold text-brand-700 underline">definir</button>}</dd>
      </dl>
      <div><span className="label inline-flex items-center gap-1"><History className="h-3.5 w-3.5" aria-hidden /> Histórico</span>
        {hist === null ? <p className="text-xs text-slate-400">Carregando…</p> : hist.length === 0 ? <p className="text-xs text-slate-400">Sem registros.</p> :
          <ul className="max-h-72 divide-y overflow-auto text-sm">{hist.map((h) => <li key={h.id} className="py-1.5">
            <div className="flex justify-between gap-2"><span>{h.acao === "ALTEROU_SENHA" && "🔑 "}<b>{nomeDe(h.usuario)}</b> {ACOES[h.acao] || h.acao}</span><span className="shrink-0 text-xs text-slate-400">{fmtHora(h.em)}</span></div>
            {h.detalhe && <p className="text-xs text-slate-500">{h.acao === "ALTEROU_SENHA" ? `motivo: ${h.detalhe}` : h.detalhe}</p>}
            {h.temAnterior && d.direcao && <p className="text-xs text-slate-500">senha anterior: {anteriores[h.id] ? <span className="font-mono text-slate-800">{anteriores[h.id]}</span> : <button type="button" onClick={() => anterior(h)} className="font-semibold text-brand-700 underline">ver (só direção)</button>}</p>}
          </li>)}</ul>}
      </div>
      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Shield className="h-3.5 w-3.5" aria-hidden /> Guardada cifrada no servidor.</span>
        {d.direcao && <button type="button" onClick={apagar} className="btn-ghost inline-flex items-center gap-1 text-xs text-bad-700"><Trash2 className="h-3.5 w-3.5" aria-hidden /> Apagar</button>}
      </div>
    </div>
  );
}

function FormAcesso({ form, setForm, salvando, aoSalvar }) {
  const [ver, setVer] = useState(false);
  return (
    <Modal titulo={form?.id ? `Editar ${form?.nome}` : "Novo acesso"} aberto={!!form} aoFechar={() => setForm(null)} largura="max-w-xl">
      {form && <form onSubmit={aoSalvar} className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="label">Site ou sistema *</span><input className="input" required value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Prefeitura · NFS-e" /></label>
        <label className="sm:col-span-2"><span className="label">Link de acesso</span><input className="input" value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></label>
        <label><span className="label">Usuário</span><input className="input" autoComplete="off" value={form.usuario_login || ""} onChange={(e) => setForm({ ...form, usuario_login: e.target.value })} /></label>
        <label><span className="label">Categoria</span><select className="input" value={form.categoria || "OUTROS"} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        {!form.id && <label className="sm:col-span-2"><span className="label">Senha</span><div className="flex gap-2"><input className="input font-mono" type={ver ? "text" : "password"} autoComplete="new-password" value={form.senha || ""} onChange={(e) => setForm({ ...form, senha: e.target.value })} /><button type="button" onClick={() => setVer(!ver)} className="btn-outline px-3" aria-label={ver ? "Esconder senha" : "Mostrar senha"}>{ver ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}</button><button type="button" onClick={() => { setForm({ ...form, senha: gerarSenha() }); setVer(true); }} className="btn-outline whitespace-nowrap px-3 text-xs">Gerar</button></div></label>}
        {form.id && <p className="text-xs text-slate-500 sm:col-span-2">Para trocar a senha use “Alterar senha” na ficha — assim a anterior fica no histórico.</p>}
        <label className="sm:col-span-2"><span className="label">Verificação em 2 etapas</span><input className="input" value={form.dois_fatores || ""} onChange={(e) => setForm({ ...form, dois_fatores: e.target.value })} placeholder="Código por SMS no celular do financeiro" /></label>
        <label className="sm:col-span-2"><span className="label">Observação</span><textarea className="input" rows={3} value={form.observacao || ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></label>
        <button disabled={salvando} className="btn-primary sm:col-span-2">{salvando ? "Salvando..." : "Salvar"}</button>
      </form>}
    </Modal>
  );
}

function TrocaSenha({ troca, setTroca, salvando, aoSalvar }) {
  const [ver, setVer] = useState(false);
  return (
    <Modal titulo={`Alterar senha · ${troca?.nome || ""}`} aberto={!!troca} aoFechar={() => setTroca(null)}>
      {troca && <form onSubmit={aoSalvar} className="space-y-3">
        <label className="block"><span className="label">Nova senha *</span><div className="flex gap-2"><input className="input font-mono" required type={ver ? "text" : "password"} autoComplete="new-password" value={troca.senha} onChange={(e) => setTroca({ ...troca, senha: e.target.value })} /><button type="button" onClick={() => setVer(!ver)} className="btn-outline px-3" aria-label={ver ? "Esconder senha" : "Mostrar senha"}>{ver ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}</button><button type="button" onClick={() => { const s = gerarSenha(); setTroca({ ...troca, senha: s, confirma: s }); setVer(true); }} className="btn-outline whitespace-nowrap px-3 text-xs">Gerar</button></div></label>
        <label className="block"><span className="label">Confirme a nova senha *</span><input className="input font-mono" required type={ver ? "text" : "password"} autoComplete="new-password" value={troca.confirma} onChange={(e) => setTroca({ ...troca, confirma: e.target.value })} /></label>
        <label className="block"><span className="label">Motivo (opcional)</span><input className="input" value={troca.motivo} onChange={(e) => setTroca({ ...troca, motivo: e.target.value })} placeholder="Troca obrigatória do portal, saída de colaborador…" /></label>
        <p className="text-xs text-slate-500">Troque primeiro no site, depois registre aqui. Fica no histórico quem alterou e quando; a senha anterior fica guardada (só a direção vê).</p>
        <button disabled={salvando} className="btn-primary w-full">{salvando ? "Salvando..." : "Salvar nova senha"}</button>
      </form>}
    </Modal>
  );
}

function QuemVeModal({ quem, setQuem, d, salvando, aoSalvar }) {
  const alternar = (campo, v) => setQuem({ ...quem, [campo]: quem[campo].includes(v) ? quem[campo].filter((x) => x !== v) : [...quem[campo], v] });
  return (
    <Modal titulo={quem?.ids.length > 1 ? `Quem vê · ${quem.ids.length} acessos` : "Quem vê este acesso"} aberto={!!quem} aoFechar={() => setQuem(null)} largura="max-w-xl">
      {quem && <div className="space-y-4 text-sm">
        {quem.ids.length > 1 && <div className="flex gap-2">{[["adicionar", "Adicionar a quem já vê"], ["definir", "Substituir quem vê"]].map(([v, l]) => <button key={v} type="button" onClick={() => setQuem({ ...quem, modo: v })} className={`rounded-full border px-3 py-1 text-xs ${quem.modo === v ? "border-brand-300 bg-brand-50 font-semibold text-brand-700" : "text-slate-600"}`}>{l}</button>)}</div>}
        <div><span className="label">Setores</span>
          {d.setores.length === 0 ? <p className="text-xs text-slate-500">Nenhum setor ainda. Crie em “Setores” (ex.: Financeiro, Qualidade, Compras) e diga quem faz parte.</p> :
            <div className="flex flex-wrap gap-2">{d.setores.map((s) => <label key={s.nome} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${quem.setores.includes(s.nome) ? "border-brand-300 bg-brand-50 font-semibold text-brand-700" : "text-slate-600"}`}><input type="checkbox" className="hidden" checked={quem.setores.includes(s.nome)} onChange={() => alternar("setores", s.nome)} />{s.nome} <span className="text-slate-400">{s.membros.length}</span></label>)}</div>}
        </div>
        <div><span className="label">Pessoas (além dos setores)</span>
          <div className="grid max-h-56 grid-cols-2 gap-1 overflow-auto">{d.contas.map((c) => <label key={c.usuario} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50"><input type="checkbox" checked={quem.pessoas.includes(c.usuario)} onChange={() => alternar("pessoas", c.usuario)} />{c.nome}</label>)}</div>
        </div>
        <p className="text-xs text-slate-500">A direção sempre vê tudo. Sem setor e sem pessoa marcados, só a direção vê.</p>
        <button type="button" disabled={salvando} onClick={aoSalvar} className="btn-primary w-full">{salvando ? "Salvando..." : "Salvar"}</button>
      </div>}
    </Modal>
  );
}

function SetoresModal({ aberto, fechar, d, avisar, recarregar }) {
  const [ed, setEd] = useState(null); const [salvando, setSalvando] = useState(false);
  const membrosDe = useMemo(() => Object.fromEntries(d.setores.map((s) => [s.nome, s.membros])), [d.setores]);
  async function salvar() {
    setSalvando(true);
    try { await salvarSetor(ed.nome, ed.membros, ed.nomeAntigo); setEd(null); await recarregar(); avisar({ tipo: "ok", texto: "Setor salvo." }); }
    catch (er) { avisar({ tipo: "erro", texto: er.message }); } finally { setSalvando(false); }
  }
  async function apagar(nome) {
    if (!window.confirm(`Apagar o setor “${nome}”? Os acessos deixam de ser vistos por ele.`)) return;
    try { await apagarSetor(nome); await recarregar(); } catch (er) { avisar({ tipo: "erro", texto: er.message }); }
  }
  return (
    <Modal titulo="Setores" aberto={aberto} aoFechar={() => { setEd(null); fechar(); }} largura="max-w-xl">
      {ed ? <div className="space-y-3 text-sm">
        <label className="block"><span className="label">Nome do setor</span><input className="input" value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} placeholder="Financeiro" /></label>
        <div><span className="label">Quem faz parte</span><div className="grid max-h-64 grid-cols-2 gap-1 overflow-auto">{d.contas.map((c) => <label key={c.usuario} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50"><input type="checkbox" checked={ed.membros.includes(c.usuario)} onChange={() => setEd({ ...ed, membros: ed.membros.includes(c.usuario) ? ed.membros.filter((x) => x !== c.usuario) : [...ed.membros, c.usuario] })} />{c.nome}</label>)}</div></div>
        <div className="flex gap-2"><button type="button" onClick={() => setEd(null)} className="btn-outline flex-1">Voltar</button><button type="button" disabled={salvando || !ed.nome.trim()} onClick={salvar} className="btn-primary flex-1">{salvando ? "Salvando..." : "Salvar setor"}</button></div>
      </div> : <div className="space-y-3 text-sm">
        <p className="text-slate-500">Setor é um grupo de pessoas. Libere um acesso para o setor e todos dele passam a ver; quem sair do setor deixa de ver.</p>
        {d.setores.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Nenhum setor ainda.</p>}
        <ul className="divide-y">{d.setores.map((s) => <li key={s.nome} className="flex items-center justify-between gap-2 py-2"><span><b>{s.nome}</b><span className="block text-xs text-slate-500">{(membrosDe[s.nome] || []).map((u) => d.contas.find((c) => c.usuario === u)?.nome || u).join(", ") || "sem pessoas"}</span></span><span className="flex gap-1"><button type="button" onClick={() => setEd({ nome: s.nome, nomeAntigo: s.nome, membros: [...s.membros] })} className="btn-ghost p-1.5" aria-label={`Editar ${s.nome}`}><Pencil className="h-4 w-4" aria-hidden /></button><button type="button" onClick={() => apagar(s.nome)} className="btn-ghost p-1.5 text-bad-700" aria-label={`Apagar ${s.nome}`}><Trash2 className="h-4 w-4" aria-hidden /></button></span></li>)}</ul>
        <button type="button" onClick={() => setEd({ nome: "", membros: [] })} className="btn-primary inline-flex w-full items-center justify-center gap-1.5"><Plus className="h-4 w-4" aria-hidden /> Novo setor</button>
      </div>}
    </Modal>
  );
}
