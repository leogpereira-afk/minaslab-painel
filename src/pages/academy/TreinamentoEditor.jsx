// Editor de treinamento: dados e critérios, conteúdo (módulos/aulas), público e publicação.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Save, Send, Archive, ShieldCheck, GitBranch, CheckCircle2, AlertTriangle, Upload } from "lucide-react";
import { Card, Empty, CarregandoModulo, ErroModulo, Aviso, Segmented } from "../../components/ui.jsx";
import { Etiqueta } from "./GestaoAcademy.jsx";
import {
  academyContexto, treinamentoObter, treinamentoMeta, versaoSalvar, versaoValidarQualidade, versaoPublicar, novaVersao, treinamentoArquivar, publicoSalvar, publicoAplicar,
} from "../../services/academy.js";
import { TIPOS_AULA, tipoAula, MODALIDADES, STATUS_TREINAMENTO, STATUS_VERSAO, EVENTOS, novaAula, novoModulo, mover, formularioDaVersao, formularioDeModelo, duracaoTotalMin, TIPOS_QUESTAO, novaQuestao, trocarTipoQuestao } from "../../lib/academy/regras.js";
import { capacidadesAcademy } from "../../lib/sessao.js";

const Campo = ({ id, rotulo, dica, children }) => (<div><label className="label" htmlFor={id}>{rotulo}</label>{children}{dica && <p className="mt-1 text-xs text-slate-500">{dica}</p>}</div>);
const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

function Dados({ f, set, meta, setMeta, ctx, ed }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Campo id="e-titulo" rotulo="Título"><input id="e-titulo" className="input" disabled={!ed} maxLength={200} value={f.titulo} onChange={(e) => set({ titulo: e.target.value })} /></Campo></div>
      <div className="sm:col-span-2"><Campo id="e-desc" rotulo="Descrição"><textarea id="e-desc" className="input min-h-24" disabled={!ed} maxLength={5000} value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} /></Campo></div>
      <Campo id="e-cat" rotulo="Categoria"><select id="e-cat" className="select" disabled={!ed} value={meta.categoriaId} onChange={(e) => setMeta({ ...meta, categoriaId: e.target.value })}>{ctx.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
      <Campo id="e-resp" rotulo="Responsável pelo conteúdo"><select id="e-resp" className="select" disabled={!ed} value={meta.responsavelPessoaId} onChange={(e) => setMeta({ ...meta, responsavelPessoaId: e.target.value })}><option value="">— definir —</option>{ctx.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
      <Campo id="e-mod" rotulo="Critério de conclusão" dica="Provas e avaliação do gestor serão liberadas nas próximas etapas."><select id="e-mod" className="select" disabled={!ed} value={f.modalidade} onChange={(e) => set({ modalidade: e.target.value })}>{MODALIDADES.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}</select></Campo>
      <Campo id="e-obr" rotulo="Obrigatoriedade"><select id="e-obr" className="select" disabled={!ed} value={f.obrigatorio ? "1" : "0"} onChange={(e) => set({ obrigatorio: e.target.value === "1" })}><option value="0">Opcional</option><option value="1">Obrigatório</option></select></Campo>
      <Campo id="e-prazo" rotulo="Prazo para concluir (dias)" dica="Contado a partir da atribuição."><input id="e-prazo" type="number" min="1" className="input" disabled={!ed} value={f.prazoDias} onChange={(e) => set({ prazoDias: e.target.value })} /></Campo>
      <Campo id="e-val" rotulo="Validade / reciclagem (meses)" dica="Vazio = não vence."><input id="e-val" type="number" min="1" className="input" disabled={!ed} value={f.validadeMeses} onChange={(e) => set({ validadeMeses: e.target.value })} /></Campo>
      <Campo id="e-ch" rotulo="Carga horária (minutos)" dica={`Só consta no certificado se a Qualidade validar. Soma das aulas informadas: ${duracaoTotalMin(f.modulos)} min.`}><input id="e-ch" type="number" min="1" className="input" disabled={!ed} value={f.cargaHorariaMin} onChange={(e) => set({ cargaHorariaMin: e.target.value })} /></Campo>
      <Campo id="e-q" rotulo="Validação da Qualidade"><select id="e-q" className="select" disabled={!ed} value={f.exigeQualidade ? "1" : "0"} onChange={(e) => set({ exigeQualidade: e.target.value === "1" })}><option value="0">Não exigida</option><option value="1">Exigida antes de publicar</option></select></Campo>
      <div className="sm:col-span-2"><Campo id="e-notas" rotulo="Notas desta versão" dica="O que mudou em relação à versão anterior."><textarea id="e-notas" className="input min-h-16" disabled={!ed} maxLength={2000} value={f.notasVersao} onChange={(e) => set({ notasVersao: e.target.value })} /></Campo></div>
    </div>
  );
}

function CampoAula({ a, ed, mudar }) {
  const t = tipoAula(a.tipo), c = a.conteudo || {};
  const setC = (k, v) => mudar({ conteudo: { ...c, [k]: v } });
  if (t.campo === "texto") return <textarea className="input min-h-28" disabled={!ed} aria-label="Texto da aula" placeholder="Texto da aula" maxLength={50000} value={c.texto || ""} onChange={(e) => setC("texto", e.target.value)} />;
  if (t.campo === "url") return <input className="input" disabled={!ed} aria-label="Link" placeholder="https://..." value={c.url || ""} onChange={(e) => setC("url", e.target.value)} />;
  return (<div className="space-y-2">
    <textarea className="input min-h-20" disabled={!ed} aria-label="Enunciado" placeholder={a.tipo === "caso" ? "Descreva o caso e as perguntas" : "Descreva a atividade prática"} maxLength={10000} value={c.enunciado || ""} onChange={(e) => setC("enunciado", e.target.value)} />
    <textarea className="input min-h-16" disabled={!ed} aria-label="Orientações" placeholder="Orientações (opcional)" maxLength={10000} value={c.orientacoes || ""} onChange={(e) => setC("orientacoes", e.target.value)} />
    {a.tipo === "pratica" && <p className="text-xs text-slate-500">Atividade prática só comprova competência quando validada pelo gestor (próxima etapa); abrir ou concluir a aula não comprova.</p>}
  </div>);
}

const Botoes = ({ ed, n, i, mv, rm }) => ed && (<span className="flex shrink-0 gap-1">
    <button type="button" className="btn-ghost h-9 w-9 p-0" aria-label="Subir" disabled={i === 0} onClick={() => mv(i, i - 1)}><ArrowUp size={15} /></button>
    <button type="button" className="btn-ghost h-9 w-9 p-0" aria-label="Descer" disabled={i === n - 1} onClick={() => mv(i, i + 1)}><ArrowDown size={15} /></button>
    <button type="button" className="btn-ghost h-9 w-9 p-0 text-bad-700" aria-label="Remover" onClick={rm}><Trash2 size={15} /></button></span>);

function Conteudo({ f, set, ed }) {
  const setMod = (i, patch) => set({ modulos: f.modulos.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
  const setAula = (i, j, patch) => setMod(i, { aulas: f.modulos[i].aulas.map((a, k) => (k === j ? { ...a, ...patch } : a)) });
  return (
    <div className="space-y-4">
      {f.modulos.length === 0 && <Empty>Nenhum módulo ainda.</Empty>}
      {f.modulos.map((m, i) => (
        <Card key={i} className="space-y-3">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 font-display text-sm font-bold text-brand-800">{i + 1}</span>
            <input className="input flex-1" disabled={!ed} aria-label={`Título do módulo ${i + 1}`} placeholder="Título do módulo" maxLength={200} value={m.titulo} onChange={(e) => setMod(i, { titulo: e.target.value })} />
            <Botoes ed={ed} n={f.modulos.length} i={i} mv={(a, b) => set({ modulos: mover(f.modulos, a, b) })} rm={() => window.confirm("Remover este módulo e suas aulas?") && set({ modulos: f.modulos.filter((_, k) => k !== i) })} /></div>
          <div className="space-y-3 border-l-2 pl-3" style={{ borderColor: "var(--hairline)" }}>
            {m.aulas.map((a, j) => (
              <div key={j} className="space-y-2 rounded-xl bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-slate-500">Aula {i + 1}.{j + 1}</span>
                  <input className="input min-w-0 flex-1 basis-48" disabled={!ed} aria-label={`Título da aula ${i + 1}.${j + 1}`} placeholder="Título da aula" maxLength={200} value={a.titulo} onChange={(e) => setAula(i, j, { titulo: e.target.value })} />
                  <select className="select w-44" disabled={!ed} aria-label="Tipo de aula" value={a.tipo} onChange={(e) => setAula(i, j, { tipo: e.target.value, conteudo: {} })}>{TIPOS_AULA.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}</select>
                  <input type="number" min="0" className="input w-24" disabled={!ed} aria-label="Duração em minutos" placeholder="min" value={a.duracaoMin} onChange={(e) => setAula(i, j, { duracaoMin: e.target.value })} />
                  <Botoes ed={ed} n={m.aulas.length} i={j} mv={(x, y) => setMod(i, { aulas: mover(m.aulas, x, y) })} rm={() => setMod(i, { aulas: m.aulas.filter((_, k) => k !== j) })} /></div>
                <CampoAula a={a} ed={ed} mudar={(p) => setAula(i, j, p)} />
              </div>))}
            {ed && <button type="button" className="btn-outline" onClick={() => setMod(i, { aulas: [...m.aulas, novaAula()] })}><Plus size={15} />Aula</button>}
          </div>
        </Card>))}
      {ed && <button type="button" className="btn-outline" onClick={() => set({ modulos: [...f.modulos, novoModulo()] })}><Plus size={15} />Módulo</button>}
      <Card className="space-y-3"><h3 className="font-display text-sm font-semibold">Materiais complementares (links)</h3>
        {f.materiais.map((m, i) => (<div key={i} className="flex flex-wrap items-center gap-2">
          <input className="input min-w-0 flex-1 basis-40" disabled={!ed} aria-label="Título do material" placeholder="Título" value={m.titulo} onChange={(e) => set({ materiais: f.materiais.map((x, k) => (k === i ? { ...x, titulo: e.target.value } : x)) })} />
          <input className="input min-w-0 flex-[2] basis-56" disabled={!ed} aria-label="Link do material" placeholder="https://..." value={m.url} onChange={(e) => set({ materiais: f.materiais.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)) })} />
          {ed && <button type="button" className="btn-ghost h-9 w-9 p-0 text-bad-700" aria-label="Remover material" onClick={() => set({ materiais: f.materiais.filter((_, k) => k !== i) })}><Trash2 size={15} /></button>}</div>))}
        {ed && <button type="button" className="btn-outline" onClick={() => set({ materiais: [...f.materiais, { titulo: "", url: "" }] })}><Plus size={15} />Material</button>}
        <p className="text-xs text-slate-500">Por enquanto os arquivos (PDF, vídeo, apresentação) entram por link, por exemplo do Google Drive com acesso restrito à MinasLab.</p></Card>
    </div>
  );
}

function Avaliacao({ f, set, ed }) {
  const setQ = (i, patch) => set({ questoes: f.questoes.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const setOp = (i, j, patch) => setQ(i, { opcoes: f.questoes[i].opcoes.map((o, k) => (k === j ? { ...o, ...patch } : o)) });
  const marcar = (i, j, marcada) => {
    const q = f.questoes[i];
    setQ(i, { opcoes: q.opcoes.map((o, k) => (q.tipo === "multiplas" ? (k === j ? { ...o, correta: marcada } : o) : { ...o, correta: k === j })) });
  };
  if (f.modalidade !== "automatica") return <Card><p className="text-sm text-slate-700">Este treinamento está com o critério “{f.modalidade === "nenhuma" ? "Somente conclusão das aulas" : f.modalidade}”. Para ter prova com nota, escolha <b>Prova automática</b> em “Dados e critérios”.{f.questoes.length > 0 && ` Há ${f.questoes.length} questão(ões) cadastrada(s) que só valem com a prova automática.`}</p></Card>;
  return (
    <div className="space-y-4">
      <Card><div className="grid gap-4 sm:grid-cols-2">
        <Campo id="av-nota" rotulo="Nota mínima para aprovação (0 a 100)" dica="A nota é calculada no servidor: acertos ÷ total de questões."><input id="av-nota" type="number" min="0" max="100" className="input" disabled={!ed} value={f.notaMinima} onChange={(e) => set({ notaMinima: e.target.value })} /></Campo>
        <Campo id="av-tent" rotulo="Limite de tentativas" dica="Depois do limite, só o RH pode liberar nova chance."><input id="av-tent" type="number" min="1" className="input" disabled={!ed} value={f.maxTentativas} onChange={(e) => set({ maxTentativas: e.target.value })} /></Campo>
      </div></Card>
      {f.questoes.length === 0 && <Empty>Nenhuma questão ainda.</Empty>}
      {f.questoes.map((q, i) => (
        <Card key={i} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 font-display text-sm font-bold text-brand-800">{i + 1}</span>
            <select className="select min-w-0 flex-1 basis-52" disabled={!ed} aria-label={`Tipo da questão ${i + 1}`} value={q.tipo} onChange={(e) => setQ(i, trocarTipoQuestao(q, e.target.value))}>{TIPOS_QUESTAO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}</select>
            <Botoes ed={ed} n={f.questoes.length} i={i} mv={(a, b) => set({ questoes: mover(f.questoes, a, b) })} rm={() => set({ questoes: f.questoes.filter((_, k) => k !== i) })} /></div>
          <textarea className="input min-h-16" disabled={!ed} aria-label={`Enunciado da questão ${i + 1}`} placeholder="Enunciado" maxLength={3000} value={q.enunciado} onChange={(e) => setQ(i, { enunciado: e.target.value })} />
          <div className="space-y-2">{q.opcoes.map((o, j) => (
            <div key={j} className="flex items-center gap-2">
              <input type={q.tipo === "multiplas" ? "checkbox" : "radio"} name={`q${i}`} className="h-4 w-4 shrink-0 accent-teal-700" disabled={!ed} aria-label={`Opção ${j + 1} é correta`} checked={o.correta} onChange={(e) => marcar(i, j, e.target.checked)} />
              <input className="input min-w-0 flex-1" disabled={!ed || q.tipo === "vf"} aria-label={`Texto da opção ${j + 1}`} placeholder={`Opção ${j + 1}`} maxLength={500} value={o.texto} onChange={(e) => setOp(i, j, { texto: e.target.value })} />
              {ed && q.tipo !== "vf" && q.opcoes.length > 2 && <button type="button" className="btn-ghost h-9 w-9 p-0 text-bad-700" aria-label="Remover opção" onClick={() => setQ(i, { opcoes: q.opcoes.filter((_, k) => k !== j) })}><Trash2 size={15} /></button>}
            </div>))}
            {ed && q.tipo !== "vf" && q.opcoes.length < 10 && <button type="button" className="btn-outline" onClick={() => setQ(i, { opcoes: [...q.opcoes, { texto: "", correta: false }] })}><Plus size={15} />Opção</button>}
            <p className="text-xs text-slate-500">Marque a resposta correta{q.tipo === "multiplas" ? " (uma ou mais; acerta quem marcar exatamente as corretas)" : ""}. O colaborador nunca vê esta marcação.</p></div>
          <textarea className="input min-h-14" disabled={!ed} aria-label={`Feedback da questão ${i + 1}`} placeholder="Feedback mostrado após o envio (opcional)" maxLength={3000} value={q.feedback} onChange={(e) => setQ(i, { feedback: e.target.value })} />
        </Card>))}
      {ed && <button type="button" className="btn-outline" onClick={() => set({ questoes: [...f.questoes, novaQuestao()] })}><Plus size={15} />Questão</button>}
    </div>
  );
}

function Publico({ itens, setItens, ctx, podeEditar, salvar, sujo }) {
  const [tipo, setTipo] = useState("todos"), [valor, setValor] = useState("");
  const opcoes = { todos: [["todos", "Todos os colaboradores"]], colaborador: ctx.pessoas.map((p) => [p.id, p.nome]), cargo: ctx.cargos.map((c) => [c, c]), setor: ctx.setores.map((c) => [c, c]), grupo: ctx.grupos.filter((g) => g.ativo).map((g) => [g.id, g.nome]) };
  const rotulo = (it) => (opcoes[it.tipo].find(([v]) => v === it.valor) || [it.valor, `${it.valor} (indisponível)`])[1];
  const add = () => { if (valor && !itens.some((x) => x.tipo === tipo && x.valor === valor)) setItens([...itens, { tipo, valor }]); setValor(""); };
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Quem deve fazer este treinamento: todos os colaboradores, ou por colaborador, cargo, setor ou grupo. A atribuição individual com prazo é gerada na etapa de aprendizagem.</p>
      {itens.length === 0 ? <Empty>Público não definido.</Empty> : <ul className="flex flex-wrap gap-2">{itens.map((it, i) => (<li key={i} className="flex items-center gap-2 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-900"><span className="text-xs uppercase text-brand-700">{it.tipo}</span>{rotulo(it)}{podeEditar && <button type="button" className="grid h-6 w-6 place-items-center rounded-full hover:bg-brand-100" aria-label="Remover" onClick={() => setItens(itens.filter((_, k) => k !== i))}>×</button>}</li>))}</ul>}
      {podeEditar && <div className="flex flex-wrap items-end gap-2">
        <label><span className="label">Tipo</span><select className="select" value={tipo} onChange={(e) => { setTipo(e.target.value); setValor(""); }}><option value="todos">Todos</option><option value="setor">Setor</option><option value="cargo">Cargo</option><option value="colaborador">Colaborador</option><option value="grupo">Grupo</option></select></label>
        <label className="min-w-0 flex-1 basis-48"><span className="label">Valor</span><select className="select" value={valor} onChange={(e) => setValor(e.target.value)}><option value="">— escolher —</option>{opcoes[tipo].map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
        <button type="button" className="btn-outline" onClick={add} disabled={!valor}><Plus size={15} />Adicionar</button>
        <button type="button" className="btn-primary" onClick={salvar} disabled={!sujo}><Save size={15} />Salvar público</button></div>}
    </div>
  );
}

export default function TreinamentoEditor() {
  const { id } = useParams();
  const caps = capacidadesAcademy();
  const [ctx, setCtx] = useState(null), [d, setD] = useState(null), [f, setF] = useState(null), [base, setBase] = useState(""), [meta, setMeta] = useState(null), [metaBase, setMetaBase] = useState("");
  const [publico, setPublico] = useState([]), [publicoBase, setPublicoBase] = useState(""), [aba, setAba] = useState("dados"), [erro, setErro] = useState(""), [aviso, setAviso] = useState(null), [ocupado, setOcupado] = useState(false);

  const aplicar = useCallback((r) => {
    const form = formularioDaVersao(r.atual), m = { categoriaId: r.treinamento.categoria_id, responsavelPessoaId: r.treinamento.responsavel_pessoa_id || "" };
    setD(r); setF(form); setBase(JSON.stringify(form)); setMeta(m); setMetaBase(JSON.stringify(m)); setPublico(r.publico); setPublicoBase(JSON.stringify(r.publico));
  }, []);
  const carregar = useCallback((versaoId = "") => Promise.all([academyContexto(), treinamentoObter(id, versaoId)]).then(([c, r]) => { setCtx(c); aplicar(r); }).catch((e) => setErro(e.message)), [id, aplicar]);
  useEffect(() => { carregar(); }, [carregar]);

  const vsel = d?.atual?.versao;
  const ed = !!vsel && vsel.status === "rascunho" && caps.gestao;
  const sujoConteudo = f && JSON.stringify(f) !== base, sujoMeta = meta && JSON.stringify(meta) !== metaBase, sujoPublico = JSON.stringify(publico) !== publicoBase;
  const sujo = sujoConteudo || sujoMeta;
  const set = useCallback((patch) => setF((x) => ({ ...x, ...patch })), []);
  const aviso$ = (tipo, texto) => setAviso({ tipo, texto });
  const rodar = async (fn, ok) => { setOcupado(true); try { await fn(); if (ok) aviso$("ok", ok); } catch (e) { aviso$("erro", e.message); } finally { setOcupado(false); } };

  const salvar = () => rodar(async () => {
    if (sujoMeta) await treinamentoMeta(id, meta.categoriaId, meta.responsavelPessoaId);
    if (sujoConteudo) await versaoSalvar(vsel.id, f);
    aplicar(await treinamentoObter(id, vsel.id));
  }, "Rascunho salvo.");
  const salvarPublico = () => rodar(async () => {
    await publicoSalvar(id, publico);
    const r = d.treinamento.status === "publicado" ? await publicoAplicar(id) : null;
    aplicar(await treinamentoObter(id, vsel.id));
    if (r) aviso$("ok", r.atribuidas > 0 ? `Público salvo. ${r.atribuidas} colaborador(es) receberam o treinamento.` : "Público salvo. Ninguém novo para atribuir.");
  }, d.treinamento.status === "publicado" ? "" : "Público salvo.");
  const publicar = () => window.confirm("Publicar esta versão? Depois de publicada ela não pode ser editada — mudanças exigem uma nova versão.") && rodar(async () => { const r = await versaoPublicar(vsel.id); aplicar(await treinamentoObter(id, vsel.id)); aviso$("ok", `Versão publicada. ${r.atribuidas || 0} colaborador(es) receberam o treinamento.`); });
  const validar = (cargaValidada) => rodar(async () => { await versaoValidarQualidade(vsel.id, cargaValidada); aplicar(await treinamentoObter(id, vsel.id)); }, "Validação da Qualidade registrada.");
  const nova = () => rodar(async () => { const vid = await novaVersao(id); aplicar(await treinamentoObter(id, vid)); setAba("dados"); }, "Nova versão criada a partir da publicada.");
  const arquivar = () => window.confirm("Arquivar este treinamento? O histórico e as evidências são preservados.") && rodar(async () => { await treinamentoArquivar(id); aplicar(await treinamentoObter(id)); }, "Treinamento arquivado.");
  const trocarVersao = (vid) => { if (sujo && !window.confirm("Há alterações não salvas. Descartar?")) return; carregar(vid); };

  if (erro) return <ErroModulo mensagem={erro} aoTentar={() => { setErro(""); carregar(); }} />;
  if (!d || !ctx || !f) return <CarregandoModulo />;
  const t = d.treinamento, problemas = d.atual.problemas, rascunhoExiste = d.versoes.some((v) => v.status === "rascunho");
  const podeNova = caps.gestao && vsel.status === "publicada" && !rascunhoExiste && t.status !== "arquivado";

  return (
    <div className="space-y-4">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <Link to="/academy/gestao" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft size={15} />Gestão Academy</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="font-display text-2xl font-bold text-slate-900">{t.titulo}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500"><Etiqueta status={t.status}>{STATUS_TREINAMENTO[t.status]}</Etiqueta>
            <label className="flex items-center gap-1">Versão <select className="select h-9 min-h-0 py-0" aria-label="Versão" value={vsel.id} onChange={(e) => trocarVersao(e.target.value)}>{d.versoes.map((v) => <option key={v.id} value={v.id}>{v.numero} — {STATUS_VERSAO[v.status]}</option>)}</select></label></p></div>
        <div className="flex flex-wrap gap-2">
          {ed && <button type="button" className="btn-primary" onClick={salvar} disabled={ocupado || !sujo}><Save size={16} />{ocupado ? "Salvando..." : "Salvar rascunho"}</button>}
          {podeNova && <button type="button" className="btn-outline" onClick={nova} disabled={ocupado}><GitBranch size={16} />Nova versão</button>}
          {caps.gestao && t.status !== "arquivado" && <button type="button" className="btn-outline" onClick={arquivar} disabled={ocupado}><Archive size={16} />Arquivar</button>}
        </div></div>
      {!ed && vsel.status !== "rascunho" && <Aviso2>Esta versão está {STATUS_VERSAO[vsel.status].toLowerCase()} e não pode ser alterada: o histórico de quem a realizou fica preservado. {podeNova ? "Use “Nova versão” para fazer mudanças." : ""}</Aviso2>}
      {sujo && ed && <Aviso2 tom="warn">Há alterações não salvas.</Aviso2>}
      <Segmented opcoes={[{ valor: "dados", rotulo: "Dados e critérios" }, { valor: "conteudo", rotulo: "Conteúdo" }, { valor: "avaliacao", rotulo: "Avaliação" }, { valor: "publico", rotulo: "Público" }, { valor: "publicacao", rotulo: "Publicação" }, { valor: "historico", rotulo: "Histórico" }]} valor={aba} onChange={setAba} />
      {aba === "dados" && <Card><Dados f={f} set={set} meta={meta} setMeta={setMeta} ctx={ctx} ed={ed} /></Card>}
      {aba === "conteudo" && <>
        {ed && <ImportarModelo f={f} setF={setF} aviso={aviso$} />}
        <Conteudo f={f} set={set} ed={ed} /></>}
      {aba === "avaliacao" && <Avaliacao f={f} set={set} ed={ed} />}
      {aba === "publico" && <Card><Publico itens={publico} setItens={setPublico} ctx={ctx} podeEditar={caps.gestao && t.status !== "arquivado"} salvar={salvarPublico} sujo={sujoPublico} /></Card>}
      {aba === "publicacao" && (
        <Card className="space-y-4">
          {vsel.status === "rascunho" ? (<>
            <h3 className="font-display text-sm font-semibold">Pendências para publicar</h3>
            {sujo && <Aviso2 tom="warn">Salve o rascunho para atualizar a lista de pendências.</Aviso2>}
            {problemas.length === 0 ? <p className="flex items-center gap-2 text-sm text-ok-700"><CheckCircle2 size={16} />Nenhuma pendência. Pronto para publicar.</p>
              : <ul className="space-y-1 text-sm text-slate-700">{problemas.map((p, i) => <li key={i} className="flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn-600" />{p}</li>)}</ul>}
            <div className="flex flex-wrap gap-2">
              {caps.gestao && <button type="button" className="btn-primary" onClick={publicar} disabled={ocupado || sujo || problemas.length > 0}><Send size={16} />Publicar versão {vsel.numero}</button>}
              {caps.qualidade && <><button type="button" className="btn-outline" onClick={() => validar(false)} disabled={ocupado || sujo}><ShieldCheck size={16} />Validar conteúdo (Qualidade)</button>
                {vsel.carga_horaria_min && <button type="button" className="btn-outline" onClick={() => validar(true)} disabled={ocupado || sujo}><ShieldCheck size={16} />Validar conteúdo e carga horária</button>}</>}
            </div>
            <p className="text-xs text-slate-500">{vsel.validada_qualidade_por ? `Validada pela Qualidade por ${vsel.validada_qualidade_por} em ${dataHora(vsel.validada_qualidade_em)}.` : "Sem validação da Qualidade registrada."} Qualquer edição do rascunho anula a validação.</p>
          </>) : <p className="text-sm text-slate-700">Versão {vsel.numero} {STATUS_VERSAO[vsel.status].toLowerCase()}{vsel.publicada_em ? ` em ${dataHora(vsel.publicada_em)} por ${vsel.publicada_por}` : ""}. Validação da Qualidade: {vsel.validada_qualidade_por ? `${vsel.validada_qualidade_por}, ${dataHora(vsel.validada_qualidade_em)}` : "não registrada"}.</p>}
        </Card>)}
      {aba === "historico" && <Card>{d.eventos.length === 0 ? <Empty>Sem registros.</Empty> : <ul className="divide-y text-sm" style={{ borderColor: "var(--hairline)" }}>{d.eventos.map((e, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-2"><span>{EVENTOS[e.evento] || e.evento}</span><span className="text-xs text-slate-500">{e.usuario} · {dataHora(e.em)}</span></li>)}</ul>}</Card>}
    </div>
  );
}

function ImportarModelo({ f, setF, aviso }) {
  const ler = async (e) => {
    const arq = e.target.files?.[0]; e.target.value = "";
    if (!arq) return;
    if (!window.confirm("Importar o modelo substitui o conteúdo atual do rascunho (ainda não salvo). Continuar?")) return;
    try { setF(formularioDeModelo(JSON.parse(await arq.text()), f)); aviso("ok", "Modelo importado. Revise e clique em Salvar rascunho."); }
    catch (ex) { aviso("erro", ex instanceof SyntaxError ? "Arquivo inválido: não é um JSON." : ex.message); }
  };
  return <label className="btn-outline cursor-pointer self-start"><Upload size={15} />Importar modelo (.json)<input type="file" accept=".json,application/json" className="sr-only" onChange={ler} /></label>;
}

function Aviso2({ children, tom = "info" }) {
  return <p className={`rounded-xl px-3 py-2 text-sm ${tom === "warn" ? "bg-warn-50 text-warn-800" : "bg-brand-50 text-brand-900"}`}>{children}</p>;
}
