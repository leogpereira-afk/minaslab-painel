// Página PÚBLICA de votação do Destaque do Mês (#/votar/<votação>[/<código>]).
// Não pede login. Só as notas vão ao servidor, que soma nos totais.
// Votação com código: "Sou eu" fica só neste aparelho. Votação sem código
// (link aberto): a pessoa escolhe o próprio nome, que sai da lista; o
// servidor só guarda que ela já votou (para travar o segundo voto), nunca
// junto com as notas.
import { useEffect, useMemo, useState } from "react";
import { abrirVoto, enviarVoto } from "../services/pesquisa.js";
import { mesLongo } from "../lib/format.js";

const LIMITE = 500;

export default function Votar({ param }) {
  const [pid, codUrl = ""] = String(param || "").split("/");
  const [codigo, setCodigo] = useState(codUrl.toUpperCase());
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [pedeCodigo, setPedeCodigo] = useState(!!codUrl);

  useEffect(() => { document.title = "Votação · Destaque do Mês · MinasLab"; }, []);

  const abrir = async (e, silencioso = false) => {
    e?.preventDefault();
    setErro("");
    setCarregando(true);
    try { setDados(await abrirVoto(pid, codigo)); } catch (ex) {
      if (ex.precisaCodigo) setPedeCodigo(true);
      if (!(silencioso && ex.precisaCodigo)) setErro(ex.message);
    } finally { setCarregando(false); }
  };

  // Abre direto: votação sem código entra sem pedir nada; com código, mostra o campo.
  useEffect(() => { if (pid) abrir(null, !codUrl); /* eslint-disable-next-line */ }, []);

  return (
    <div className="votar">
      <header className="votar-topo">
        <div className="votar-marca">Minas<b>Lab</b></div>
        <div className="votar-sub">Destaque do Mês · votação anônima</div>
      </header>
      <main className="votar-miolo">
        {enviado ? <Obrigado /> : dados ? <Formulario pid={pid} codigo={codigo} dados={dados} aoEnviar={() => setEnviado(true)} /> : !pedeCodigo ? (
          <div className="card votar-cartao">{erro ? <div className="aviso ruim">{erro}</div> : !pid ? <div className="aviso ruim">Link incompleto. Peça o link da votação à gestão.</div> : <div className="vazio">Abrindo a votação…</div>}</div>
        ) : (
          <form className="card votar-cartao" onSubmit={abrir}>
            <h1 style={{ fontSize: 24 }}>Sua opinião, sem seu nome</h1>
            <p className="peq" style={{ lineHeight: 1.6 }}>Você vai avaliar os colegas e a liderança. <b>Ninguém fica sabendo o que você respondeu</b>: não tem login e o sistema não guarda as respostas uma a uma. Só as médias de cada pessoa são vistas, e apenas quando um número mínimo de colegas avaliou.</p>
            {!pid ? <div className="aviso ruim">Link incompleto. Peça o link da votação à gestão.</div> : (
              <>
                <div className="campo">
                  <label htmlFor="v-cod">Seu código de votação</label>
                  <input id="v-cod" className="entrada votar-codigo" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ex.: K7MP4QXA" />
                  <span className="suave peq">Está no papel que você sorteou. Cada código vale um voto.</span>
                </div>
                {erro && <div className="aviso ruim">{erro}</div>}
                <button type="submit" className="btn" disabled={carregando || codigo.replace(/[^A-Z0-9]/gi, "").length < 8}>{carregando ? "Abrindo…" : "Começar"}</button>
              </>
            )}
          </form>
        )}
      </main>
    </div>
  );
}

function Obrigado() {
  return (
    <div className="card votar-cartao" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 44 }} aria-hidden="true">✓</div>
      <h1 style={{ fontSize: 24 }}>Voto registrado. Obrigado por participar!</h1>
      <p className="suave">Suas respostas foram somadas às dos colegas, sem seu nome. Pode fechar esta página.</p>
    </div>
  );
}

function Formulario({ pid, codigo, dados, aoEnviar }) {
  const { perguntasEquipe, perguntasGestao } = dados;
  const aberto = dados.modo === "aberto";
  const [eu, setEu] = useState("");
  const avaliados = useMemo(() => dados.avaliados.filter((p) => p.id !== eu), [dados.avaliados, eu]);
  const lideresVisiveis = useMemo(() => dados.lideres.filter((p) => p.id !== eu), [dados.lideres, eu]);
  const votantes = dados.votantes || dados.avaliados;
  const passos = useMemo(() => [
    ...(aberto ? [{ tipo: "quem" }] : []),
    { tipo: "intro" },
    ...avaliados.map((p) => ({ tipo: "colega", p })),
    ...lideresVisiveis.map((p) => ({ tipo: "lider", p })),
    { tipo: "sugestao" },
    { tipo: "revisar" },
  ], [avaliados, lideresVisiveis, aberto]);
  const [i, setI] = useState(0);
  const [notas, setNotas] = useState({});      // id -> [5]
  const [pular, setPular] = useState({});      // id -> "eu" | "nao"
  const [coment, setComent] = useState({});
  const [sugestao, setSugestao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const passo = passos[i];
  const perguntas = passo.tipo === "lider" ? perguntasGestao : perguntasEquipe;
  const id = passo.p?.id;
  const respondidas = id ? (notas[id] || []).filter((n) => n != null).length : 0;
  const podeSeguir = passo.tipo === "quem" ? !!eu : !id || pular[id] || respondidas === perguntas.length;

  const setNota = (k, v) => setNotas((x) => { const a = [...(x[id] || perguntas.map(() => null))]; a[k] = v; return { ...x, [id]: a }; });
  const marcarPular = (motivo) => { setPular((x) => ({ ...x, [id]: x[id] === motivo ? undefined : motivo })); };
  const ir = (n) => { setI(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const completos = (ids) => ids.filter((k) => !pular[k] && (notas[k] || []).filter((n) => n != null).length === 5);
  const colegasOk = completos(avaliados.map((p) => p.id));
  const lideresOk = completos(lideresVisiveis.map((p) => p.id));

  const enviar = async () => {
    setErro("");
    setEnviando(true);
    const voto = {
      equipe: Object.fromEntries(colegasOk.map((k) => [k, notas[k]])),
      comentarios: Object.fromEntries(colegasOk.filter((k) => coment[k]?.trim()).map((k) => [k, coment[k].trim()])),
      gestao: Object.fromEntries(lideresOk.map((k) => [k, notas[k]])),
      sugestao: sugestao.trim(),
    };
    try { await enviarVoto(pid, codigo, voto, aberto ? eu : ""); aoEnviar(); } catch (e) { setErro(e.message); } finally { setEnviando(false); }
  };

  return (
    <div className="card votar-cartao">
      <div className="votar-progresso" aria-hidden="true"><div style={{ width: `${(i / (passos.length - 1)) * 100}%` }} /></div>
      <div className="suave peq">{dados.titulo} · etapa {i + 1} de {passos.length}</div>

      {passo.tipo === "quem" && (
        <>
          <h1 style={{ fontSize: 22 }}>Quem é você?</h1>
          <p className="peq" style={{ margin: 0, lineHeight: 1.6 }}>Serve só para tirar o seu nome da lista (ninguém vota em si mesmo) e para cada pessoa votar uma vez. <b>Seu nome não fica junto das suas notas</b>: o sistema guarda apenas que você já votou.</p>
          <div className="campo">
            <label htmlFor="v-eu">Seu nome</label>
            <select id="v-eu" className="entrada" value={eu} onChange={(e) => { setEu(e.target.value); setNotas({}); setPular({}); setComent({}); }}>
              <option value="">Escolha…</option>
              {[...votantes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </>
      )}

      {passo.tipo === "intro" && (
        <>
          <h1 style={{ fontSize: 22 }}>Como funciona</h1>
          <ul className="peq" style={{ lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
            <li>Você verá <b>{avaliados.length} colega(s)</b>{lideresVisiveis.length ? <> e <b>{lideresVisiveis.length} pessoa(s) da liderança</b></> : null}, uma de cada vez.</li>
            <li>Notas de <b>0 a 10</b>: 0 = muito abaixo do esperado, 10 = excelente.</li>
            <li>{aberto ? null : <>Quando chegar no <b>seu nome</b>, toque em “Sou eu”. </>}Se <b>não conviveu</b> o suficiente com alguém, toque em “Não sei avaliar”. Isso é melhor que dar nota baixa.</li>
            <li>O comentário é opcional. Escreva sobre o trabalho, sem detalhes que mostrem quem escreveu.</li>
          </ul>
        </>
      )}

      {(passo.tipo === "colega" || passo.tipo === "lider") && (
        <>
          <div>
            <div className="sobretitulo">{passo.tipo === "lider" ? "Liderança" : "Colega"}</div>
            <h1 style={{ fontSize: 24, marginTop: 4 }}>{passo.p.nome}</h1>
          </div>
          <div className="votar-pular">
            {passo.tipo === "colega" && !aberto && <button type="button" className={`pilula${pular[id] === "eu" ? " ativa" : ""}`} aria-pressed={pular[id] === "eu"} onClick={() => marcarPular("eu")}>Sou eu</button>}
            <button type="button" className={`pilula${pular[id] === "nao" ? " ativa" : ""}`} aria-pressed={pular[id] === "nao"} onClick={() => marcarPular("nao")}>Não sei avaliar</button>
          </div>
          {!pular[id] && perguntas.map((q, k) => (
            <fieldset key={q.id} className="votar-pergunta">
              <legend><b>{q.texto}</b><span className="suave peq">{q.ajuda}</span></legend>
              <Escala valor={notas[id]?.[k]} aoMudar={(v) => setNota(k, v)} rotulo={q.texto} />
            </fieldset>
          ))}
          {!pular[id] && passo.tipo === "colega" && (
            <div className="campo">
              <label htmlFor="v-com">Comentário sobre o trabalho (opcional)</label>
              <textarea id="v-com" className="entrada" rows={2} maxLength={LIMITE} value={coment[id] || ""} onChange={(e) => setComent({ ...coment, [id]: e.target.value })} />
            </div>
          )}
          {pular[id] && <div className="aviso marca peq">{pular[id] === "eu" ? "Ok, você não se avalia." : "Ok, sem nota para esta pessoa."} Toque em “Próximo”.</div>}
        </>
      )}

      {passo.tipo === "sugestao" && (
        <>
          <h1 style={{ fontSize: 22 }}>Para a liderança</h1>
          <div className="campo">
            <label htmlFor="v-sug">O que a liderança deveria começar, continuar ou parar de fazer? (opcional)</label>
            <textarea id="v-sug" className="entrada" rows={4} maxLength={800} value={sugestao} onChange={(e) => setSugestao(e.target.value)} />
          </div>
        </>
      )}

      {passo.tipo === "revisar" && (
        <>
          <h1 style={{ fontSize: 22 }}>Tudo certo?</h1>
          <p className="peq" style={{ margin: 0 }}>Você avaliou <b>{colegasOk.length}</b> colega(s){lideresVisiveis.length ? <> e <b>{lideresOk.length}</b> da liderança</> : null}. Depois de enviar, não dá para mudar.</p>
          {colegasOk.length + lideresOk.length === 0 && <div className="aviso alerta">Você não avaliou ninguém ainda. Volte e dê as notas.</div>}
          {erro && <div className="aviso ruim">{erro}</div>}
        </>
      )}

      <div className="votar-nav">
        {i > 0 ? <button type="button" className="btn claro" onClick={() => ir(i - 1)}>Voltar</button> : <span />}
        {passo.tipo === "revisar"
          ? <button type="button" className="btn" disabled={enviando || colegasOk.length + lideresOk.length === 0} onClick={enviar}>{enviando ? "Enviando…" : "Enviar voto"}</button>
          : <button type="button" className="btn" disabled={!podeSeguir} onClick={() => ir(i + 1)}>{podeSeguir ? "Próximo" : `Faltam ${perguntas.length - respondidas}`}</button>}
      </div>
    </div>
  );
}

function Escala({ valor, aoMudar, rotulo }) {
  return (
    <div className="escala" role="radiogroup" aria-label={rotulo}>
      {Array.from({ length: 11 }, (_, n) => (
        <button key={n} type="button" role="radio" aria-checked={valor === n} className={`escala-n${valor === n ? " ativa" : ""}${n <= 4 ? " baixa" : n >= 9 ? " alta" : ""}`} onClick={() => aoMudar(n)}>{n}</button>
      ))}
    </div>
  );
}
