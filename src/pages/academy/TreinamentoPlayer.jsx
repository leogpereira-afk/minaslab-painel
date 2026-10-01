// Player do treinamento: aulas em sequência, progresso salvo no servidor, retomada
// da última aula e prova automática (nota calculada no servidor).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, Award, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Empty, CarregandoModulo, ErroModulo, Aviso } from "../../components/ui.jsx";
import { treinamentoAbrirColab, aulaRegistrar, tentativaIniciar, tentativaEnviar } from "../../services/academy.js";
import { tipoAula, textoPrazo, dataBR } from "../../lib/academy/regras.js";

const ROTULO_LINK = { video: "Abrir vídeo", pdf: "Abrir PDF", apresentacao: "Abrir apresentação", link: "Abrir link", imagem: "Abrir imagem" };

function ConteudoAula({ aula, resposta, setResposta, bloqueado }) {
  const c = aula.conteudo || {};
  const t = tipoAula(aula.tipo);
  if (t.campo === "texto") return <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-800">{c.texto}</p>;
  if (t.campo === "url") return (
    <div className="space-y-3">
      {aula.tipo === "imagem" && c.url && <img src={c.url} alt={aula.titulo} referrerPolicy="no-referrer" className="max-h-[60vh] max-w-full rounded-xl border" style={{ borderColor: "var(--hairline)" }} />}
      <a href={c.url} target="_blank" rel="noopener noreferrer" className="btn-outline inline-flex"><ExternalLink size={16} />{ROTULO_LINK[aula.tipo]}</a>
    </div>);
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-800">{c.enunciado}</p>
      {c.orientacoes && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{c.orientacoes}</p>}
      <label className="block"><span className="label">Sua resposta / registro</span>
        <textarea className="input min-h-32" disabled={bloqueado} maxLength={10000} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Escreva aqui. Ficará salvo no seu histórico." /></label>
      {aula.tipo === "pratica" && <p className="text-xs text-slate-500">Concluir esta atividade não comprova competência prática por si só; a validação, quando exigida, é feita pelo gestor.</p>}
    </div>);
}

function Prova({ atribuicaoId, prova, aoTerminar, aviso }) {
  const [t, setT] = useState(null), [resp, setResp] = useState({}), [i, setI] = useState(0), [res, setRes] = useState(null), [ocupado, setOcupado] = useState(false);
  const iniciar = async () => {
    setOcupado(true);
    try { setT(await tentativaIniciar(atribuicaoId)); setResp({}); setI(0); setRes(null); } catch (e) { aviso({ tipo: "erro", texto: e.message }); } finally { setOcupado(false); }
  };
  const escolher = (q, opId, marcada) => setResp((r) => {
    const atual = new Set(r[q.id] || []);
    if (q.tipo === "multiplas") { if (marcada) atual.add(opId); else atual.delete(opId); return { ...r, [q.id]: [...atual] }; }
    return { ...r, [q.id]: [opId] };
  });
  const enviar = async () => {
    const faltam = t.questoes.filter((q) => !(resp[q.id] || []).length).length;
    if (faltam && !window.confirm(`${faltam} questão(ões) sem resposta contam como erro. Enviar mesmo assim?`)) return;
    if (!faltam && !window.confirm("Enviar a prova? Depois de enviada não dá para alterar.")) return;
    setOcupado(true);
    try {
      const r = await tentativaEnviar(t.tentativaId, t.questoes.map((q) => ({ questaoId: q.id, opcoes: resp[q.id] || [] })));
      setRes({ ...r, questoes: t.questoes }); setT(null); aoTerminar(r);
    } catch (e) { aviso({ tipo: "erro", texto: e.message }); } finally { setOcupado(false); }
  };
  const restantes = prova.maxTentativas - prova.usadas;
  if (res) return (
    <Card className="space-y-3">
      <h3 className="font-display text-lg font-semibold">{res.aprovado ? "Aprovado!" : "Não foi desta vez"}</h3>
      <p className="text-sm text-slate-700">Nota <b>{res.nota}</b> (mínima {res.notaMinima}) · {res.acertos} de {res.total} questões corretas.{!res.aprovado && (res.tentativasRestantes > 0 ? ` Você ainda tem ${res.tentativasRestantes} tentativa(s).` : " Suas tentativas acabaram; procure o RH.")}</p>
      <ul className="space-y-2">{res.detalhes.map((d) => (<li key={d.questaoId} className="rounded-xl bg-slate-50 p-3 text-sm"><span className={`font-semibold ${d.correta ? "text-ok-700" : "text-bad-700"}`}>Questão {d.ordem}: {d.correta ? "correta" : "incorreta"}</span>{d.feedback && <span className="mt-1 block text-slate-600">{d.feedback}</span>}</li>))}</ul>
      {!res.aprovado && res.tentativasRestantes > 0 && <button type="button" className="btn-primary" onClick={iniciar} disabled={ocupado}>Tentar novamente</button>}
    </Card>);
  if (t) {
    const q = t.questoes[i], feitas = t.questoes.filter((x) => (resp[x.id] || []).length).length;
    return (
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-lg font-semibold">Prova · tentativa {t.numero}</h3><span className="text-xs text-slate-500">{feitas} de {t.questoes.length} respondidas</span></div>
        <fieldset className="space-y-3"><legend className="text-[15px] font-semibold text-slate-900">{i + 1}. {q.enunciado}</legend>
          <p className="text-xs text-slate-500">{q.tipo === "multiplas" ? "Marque todas as corretas." : "Escolha uma opção."}</p>
          {q.opcoes.map((o) => { const marcada = (resp[q.id] || []).includes(o.id); return (
            <label key={o.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${marcada ? "border-brand bg-brand-50" : "bg-white"}`} style={marcada ? undefined : { borderColor: "var(--hairline)" }}>
              <input type={q.tipo === "multiplas" ? "checkbox" : "radio"} name={q.id} className="h-4 w-4 accent-teal-700" checked={marcada} onChange={(e) => escolher(q, o.id, e.target.checked)} />{o.texto}</label>); })}
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="btn-outline" onClick={() => setI(i - 1)} disabled={i === 0}><ChevronLeft size={16} />Anterior</button>
          {i < t.questoes.length - 1 ? <button type="button" className="btn-outline" onClick={() => setI(i + 1)}>Próxima<ChevronRight size={16} /></button> : <button type="button" className="btn-primary" onClick={enviar} disabled={ocupado}>{ocupado ? "Enviando..." : "Enviar prova"}</button>}
        </div>
      </Card>);
  }
  return (
    <Card className="space-y-3">
      <h3 className="font-display text-lg font-semibold">Prova</h3>
      <p className="text-sm text-slate-700">Nota mínima {prova.notaMinima} · {prova.questoes} questões · {prova.usadas} de {prova.maxTentativas} tentativas usadas.</p>
      {prova.historico.length > 0 && <ul className="text-sm text-slate-600">{prova.historico.map((h) => <li key={h.numero}>Tentativa {h.numero}: nota {h.nota} {h.aprovado ? "(aprovado)" : "(não aprovado)"} em {dataBR(String(h.enviada_em).slice(0, 10))}</li>)}</ul>}
      {prova.aprovado ? <p className="text-sm font-semibold text-ok-700">Você foi aprovado nesta prova.</p>
        : restantes <= 0 ? <p className="text-sm font-semibold text-bad-700">Tentativas esgotadas. Procure o RH para uma nova chance.</p>
        : <button type="button" className="btn-primary" onClick={iniciar} disabled={ocupado}>{prova.aberta ? "Retomar prova" : prova.usadas ? "Nova tentativa" : "Iniciar prova"}</button>}
    </Card>);
}

export default function TreinamentoPlayer() {
  const { atribuicaoId } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null), [erro, setErro] = useState(""), [sel, setSel] = useState(null), [resposta, setResposta] = useState(""), [aviso, setAviso] = useState(null), [ocupado, setOcupado] = useState(false), [verProva, setVerProva] = useState(false);
  const carregar = useCallback(async (manterAula) => {
    try {
      const r = await treinamentoAbrirColab(atribuicaoId);
      setD(r);
      const todas = r.modulos.flatMap((m) => m.aulas);
      setSel((atual) => (manterAula && atual && todas.some((a) => a.id === atual) ? atual
        : (todas.find((a) => a.id === r.atribuicao.ultimaAulaId) || todas.find((a) => !a.concluida) || todas[0])?.id));
    } catch (e) { setErro(e.message); }
  }, [atribuicaoId]);
  useEffect(() => { carregar(false); }, [carregar]);

  const todas = useMemo(() => (d ? d.modulos.flatMap((m) => m.aulas) : []), [d]);
  const aula = todas.find((a) => a.id === sel);
  useEffect(() => { setResposta(aula?.resposta || ""); setVerProva(false); }, [aula?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Registra a abertura da aula: é o que permite retomar de onde parou, mesmo em outro computador.
  useEffect(() => { if (d && aula && d.atribuicao.status !== "concluida") aulaRegistrar(atribuicaoId, aula.id, false).catch(() => {}); }, [aula?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (erro) return <ErroModulo mensagem={erro} aoTentar={() => { setErro(""); carregar(false); }} />;
  if (!d) return <CarregandoModulo />;
  const feitas = todas.filter((a) => a.concluida).length, pct = todas.length ? Math.round((100 * feitas) / todas.length) : 0;
  const fechado = d.atribuicao.status === "concluida";
  const idx = todas.findIndex((a) => a.id === sel);
  const concluir = async () => {
    setOcupado(true);
    try {
      const r = await aulaRegistrar(atribuicaoId, aula.id, true, aula.tipo === "caso" || aula.tipo === "pratica" ? resposta : undefined);
      await carregar(true);
      if (r.status === "concluida") setAviso({ tipo: "ok", texto: "Treinamento concluído! Seu certificado está em Meus Certificados." });
      else if (idx < todas.length - 1) setSel(todas[idx + 1].id);
      else if (d.prova.existe) setVerProva(true);
    } catch (e) { setAviso({ tipo: "erro", texto: e.message }); } finally { setOcupado(false); }
  };
  const todasFeitas = feitas === todas.length;
  const mostrarProva = d.prova.existe && (verProva || (todasFeitas && !aula));
  return (
    <div className="space-y-4">
      <Aviso aviso={aviso} aoFechar={() => setAviso(null)} />
      <Link to="/academy/minha" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft size={15} />Minha Academy</Link>
      <div><h1 className="font-display text-2xl font-bold text-slate-900">{d.versao.titulo}</h1>
        <p className="mt-1 text-sm text-slate-500">Versão {d.versao.numero} · {fechado ? `Concluído em ${dataBR(String(d.atribuicao.concluidaEm).slice(0, 10))}` : textoPrazo(d.atribuicao.prazoEm, new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }))}</p>
        <div className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
        <p className="mt-1 text-xs text-slate-500">{feitas} de {todas.length} aulas concluídas ({pct}%)</p></div>
      {d.certificado && <Card className="flex flex-wrap items-center justify-between gap-2 bg-ok-50"><span className="flex items-center gap-2 text-sm font-semibold text-ok-800"><Award size={18} />Certificado emitido · {d.certificado.codigo}</span><Link to="/academy/certificados" className="btn-outline">Ver certificados</Link></Card>}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <nav aria-label="Aulas" className="card space-y-3 self-start p-3">
          {d.modulos.map((m, mi) => (<div key={m.id}><p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{mi + 1}. {m.titulo}</p>
            <ul className="mt-1 space-y-0.5">{m.aulas.map((a) => (<li key={a.id}><button type="button" onClick={() => { setSel(a.id); setVerProva(false); }} aria-current={a.id === sel && !mostrarProva ? "true" : undefined}
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${a.id === sel && !mostrarProva ? "bg-brand-50 font-semibold text-brand-900" : "text-slate-700 hover:bg-slate-50"}`}>
              {a.concluida ? <CheckCircle2 size={16} className="shrink-0 text-ok-600" /> : <Circle size={16} className="shrink-0 text-slate-300" />}<span className="min-w-0">{a.titulo}</span></button></li>))}</ul></div>))}
          {d.prova.existe && <button type="button" onClick={() => setVerProva(true)} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold ${mostrarProva ? "bg-brand-50 text-brand-900" : "text-slate-700 hover:bg-slate-50"}`}>
            {d.prova.aprovado ? <CheckCircle2 size={16} className="text-ok-600" /> : <Circle size={16} className="text-slate-300" />}Prova</button>}
          {d.materiais.length > 0 && <div><p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Materiais</p><ul className="mt-1 space-y-0.5">{d.materiais.map((m, i) => <li key={i}><a href={m.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-brand-700 hover:bg-slate-50"><ExternalLink size={14} />{m.titulo || m.url}</a></li>)}</ul></div>}
        </nav>
        <div className="min-w-0 space-y-3">
          {mostrarProva ? <Prova atribuicaoId={atribuicaoId} prova={d.prova} aviso={setAviso} aoTerminar={() => carregar(true)} />
            : !aula ? <Empty>Este treinamento não tem aulas.</Empty> : (
            <Card className="space-y-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aula {idx + 1} de {todas.length}{aula.duracaoMin ? ` · ${aula.duracaoMin} min` : ""}</p><h2 className="font-display text-xl font-semibold text-slate-900">{aula.titulo}</h2></div>
              <ConteudoAula aula={aula} resposta={resposta} setResposta={setResposta} bloqueado={fechado} />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
                <button type="button" className="btn-outline" onClick={() => setSel(todas[idx - 1].id)} disabled={idx === 0}><ChevronLeft size={16} />Anterior</button>
                {fechado || aula.concluida ? <button type="button" className="btn-outline" onClick={() => (idx < todas.length - 1 ? setSel(todas[idx + 1].id) : d.prova.existe ? setVerProva(true) : navigate("/academy/minha"))}>{idx < todas.length - 1 ? "Próxima" : d.prova.existe ? "Ir para a prova" : "Concluir leitura"}<ChevronRight size={16} /></button>
                  : <button type="button" className="btn-primary" onClick={concluir} disabled={ocupado}><CheckCircle2 size={16} />{ocupado ? "Salvando..." : idx < todas.length - 1 ? "Concluir e avançar" : "Concluir aula"}</button>}
              </div>
            </Card>)}
        </div>
      </div>
    </div>
  );
}
