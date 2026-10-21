// Treinamentos: apresentações, trilhas agrupadas por tema (com editar,
// arquivar, excluir e obrigatório), registro de quem participou com nota de
// 0 a 10 e certificado, plano (cargos, reciclagem, novos) e calendário.
import { useState } from "react";
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Abas, Modal } from "../components/ui.jsx";
import { Estudio } from "../components/Estudio.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { Slides } from "../components/Slides.jsx";
import { Apresentador } from "../components/Deck.jsx";
import { BotaoCertificado } from "../components/CertificadoTreinamento.jsx";
import { slidesDoModelo, modeloPorId } from "../lib/modelosApresentacao.js";
import { npsCRM, licitacoesCRM } from "../services/crm.js";
import { TEMAS } from "../lib/trilhas.js";
import { catalogo, porTema, ID_CATALOGO, trilhaEmQualquerLugar } from "../lib/catalogo.js";
import { pessoasParaTreinamento, fmtNota, mediaNotas, aprovado, NOTA_MINIMA } from "../lib/treinamentosPessoa.js";
import { matrizReciclagem, OPCOES_PERIODO, OPCOES_PRAZO_NOVO, ID_CONFIG, planoEmVigor, agenda } from "../lib/reciclagem.js";
import { hojeBR, dataCurta, mesAtual, somarMeses, mesDeData, mesNome, pct, nomeProprio } from "../lib/format.js";
import { totaisMes, realizado, metasDe } from "../lib/calculos.js";

const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const nomeTema = (id) => TEMAS.find((t) => t.id === id)?.nome || "Outros";

/** Catálogo do setor e como gravar mudanças nele. */
export function useCatalogo() {
  const { dados, gravar, setor } = useBase();
  const cat = catalogo(dados.treinamentos, setor);
  const salvarCat = (parte) => gravar("treinamentos", { id: ID_CATALOGO, tipo: "catalogo", ...cat.cfg, ...parte });
  return { cat, salvarCat };
}

/** Por que cada trilha está sugerida agora (ou null). */
function motivos({ resumo, equipe, dados, nps, lics, trilhas, setor }) {
  const m = mesAtual();
  const ant = somarMeses(m, -1);
  const out = {};
  if (setor === "comercial" && resumo) {
    const t = totaisMes(resumo, ant);
    const tAtual = totaisMes(resumo, m);
    const pctSem = Math.max(t.pctSemResponsavel || 0, tAtual.pctSemResponsavel || 0);
    if (pctSem > 5) out["crm-sem-furos"] = `${pct(pctSem)} das propostas sem responsável (meta: abaixo de 5%).`;
    const abaixo = equipe.filter((p) => { const me = metasDe(p); const r = realizado(resumo, p, ant); return me.aprovacao && r.taxa != null && r.taxa < me.aprovacao; });
    if (abaixo.length) out["follow-up"] = `Aprovação abaixo da meta em ${mesNome(ant)}: ${abaixo.map((p) => p.nome.split(" ")[0]).join(", ")}.`;
  }
  const desde = somarMeses(m, -2);
  for (const tr of trilhas.filter((x) => String(x.gatilho).startsWith("ocorrencia:"))) {
    const tipo = tr.gatilho.split(":")[1];
    const n = dados.ocorrencias.filter((o) => o.tipo === tipo && o.mes >= desde).length;
    if (n) out[tr.id] = `${n} ocorrência(s) de “${tipo}” nos últimos 3 meses.`;
  }
  const det = [...(nps || []), ...dados.nps].filter((r) => Number(r.nota) <= 6).length;
  if (det) for (const tr of trilhas.filter((x) => x.gatilho === "nps")) out[tr.id] = out[tr.id] ? `${out[tr.id]} ${det} cliente(s) com nota de 0 a 6.` : `${det} cliente(s) com nota de 0 a 6.`;
  const perdidas = (lics || []).filter((l) => String(l.status).toUpperCase() === "PERDIDA").length;
  if (perdidas && setor === "comercial" && trilhas.some((t) => t.id === "licitacoes")) out.licitacoes = `${perdidas} licitação(ões) perdida(s).`;
  const rec = matrizReciclagem({ trilhas: trilhas.filter((t) => t.obrigatorio), registros: dados.treinamentos, pessoas: equipe, hoje: hojeBR() });
  for (const t of rec.periodicas) {
    const venc = rec.pendencias.filter((x) => x.trilha.id === t.id && ["vencido", "vence", "refazer"].includes(x.status));
    const nunca = rec.pendencias.filter((x) => x.trilha.id === t.id && ["nunca", "pendente"].includes(x.status));
    const partes = [venc.length && `reciclagem vencida, vencendo ou a refazer: ${venc.map((x) => x.pessoa.nome.split(" ")[0]).join(", ")}`, nunca.length && `nunca fizeram: ${nunca.map((x) => x.pessoa.nome.split(" ")[0]).join(", ")}`].filter(Boolean);
    if (partes.length) { const txt = partes.join("; ") + "."; const cap = txt.charAt(0).toUpperCase() + txt.slice(1); out[t.id] = out[t.id] ? `${out[t.id]} ${cap}` : cap; }
  }
  const semFb = equipe.filter((p) => !dados.feedbacks.some((f) => f.pessoaId === p.id && f.mes >= ant));
  if (semFb.length && setor === "comercial" && trilhas.some((t) => t.id === "gestora")) out.gestora = `Sem conversa individual registrada desde ${mesNome(ant)}: ${semFb.map((p) => p.nome.split(" ")[0]).join(", ")}.`;
  return out;
}

/** O indicador da trilha antes e depois da aplicação (quando dá para medir). */
function eficacia(trilha, aplicacao, { resumo, dados }) {
  const mesApl = mesDeData(new Date(`${aplicacao.data}T15:00:00Z`));
  const antes = somarMeses(mesApl, -1);
  const depois = somarMeses(mesApl, 1);
  if (depois > mesAtual()) return { texto: `O efeito aparece em ${mesNome(depois)}.` };
  if (trilha.gatilho === "semResponsavel" && resumo) return { antes: pct(totaisMes(resumo, antes).pctSemResponsavel), depois: pct(totaisMes(resumo, depois).pctSemResponsavel), rotulo: "sem responsável" };
  if (trilha.gatilho === "aprovacao" && resumo) return { antes: pct(totaisMes(resumo, antes).taxa), depois: pct(totaisMes(resumo, depois).taxa), rotulo: "aprovação da equipe" };
  if (String(trilha.gatilho).startsWith("ocorrencia:")) {
    const tipo = trilha.gatilho.split(":")[1];
    const n = (m) => dados.ocorrencias.filter((o) => o.tipo === tipo && o.mes === m).length;
    return { antes: String(n(antes)), depois: String(n(depois)), rotulo: `ocorrências de ${tipo.toLowerCase()}` };
  }
  return { texto: "Acompanhe pelo indicador do treinamento." };
}

export default function Treinamentos() {
  const [aba, setAba] = useState("apresentacoes");
  return (
    <>
      <Abas valor={aba} aoMudar={setAba} abas={[["apresentacoes", "Apresentações de treinamento"], ["trilhas", "Trilhas de treinamento"], ["reciclagem", "Plano e calendário"]]} />
      {aba === "reciclagem" ? <Reciclagem irParaTrilha={() => setAba("trilhas")} /> : aba === "trilhas" ? <Trilhas /> : (
        <>
          <Cabecalho sobre="Treinamentos" titulo="Apresentações de treinamento" sub="Todas as apresentações de treinamento, dos dois setores, no estilo colorido com quiz. Crie a sua a partir de um modelo para editar, baixar em PowerPoint e gerar a ata." />
          <Estudio categoria="treinamento" />
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------ trilhas por tema
function Trilhas() {
  const { resumo, equipeAtual: equipe, dados, setor, nomeSetor } = useBase();
  const { cat, salvarCat } = useCatalogo();
  const com = setor === "comercial";
  const nps = useCRM(com ? "nps" : "nps-nenhum", com ? npsCRM : async () => null);
  const lic = useCRM(com ? "licitacoes" : "licitacoes-nenhum", com ? licitacoesCRM : async () => null);
  const sug = motivos({ resumo, equipe, dados, nps: nps.dados?.respostas, lics: lic.dados?.licitacoes, trilhas: cat.ativos, setor });
  const [tema, setTema] = useState(null);
  const [sel, setSel] = useState(null);
  const [busca, setBusca] = useState("");
  const [editar, setEditar] = useState(null); // trilha ou {} para novo
  const [guardados, setGuardados] = useState(false);
  const [todosSug, setTodosSug] = useState(false);
  const grupos = porTema(cat.ativos);
  const aplicados = (id) => dados.treinamentos.filter((a) => a.trilhaId === id && a.tipo !== "agenda").length;
  const abrir = (t) => { setTema(t.tema || "proprios"); setSel(t.id); };
  const achados = busca.trim() ? cat.ativos.filter((t) => norm(`${t.nome} ${t.publico} ${t.documento || ""} ${nomeTema(t.tema)}`).includes(norm(busca))) : [];
  const sugeridos = cat.ativos.filter((t) => sug[t.id]);

  const barra = (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="campo" style={{ flex: "1 1 240px" }}><label htmlFor="tr-busca">Buscar treinamento</label><input id="tr-busca" className="entrada" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, documento (ex.: PG 010) ou tema" /></div>
      <button type="button" className="btn" onClick={() => setEditar({})}>Novo treinamento</button>
      <button type="button" className="btn claro" onClick={() => setGuardados(true)}>Arquivados e excluídos ({cat.arquivados.length + cat.excluidos.length})</button>
    </div>
  );

  let corpo;
  if (busca.trim()) {
    corpo = (
      <Card semPad>
        <div className="card-cab"><h2>Resultado da busca</h2><span className="suave peq">{achados.length}</span></div>
        {achados.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhum treinamento com “{busca}”.</div> : (
          <div className="lista-trilhas" style={{ padding: "0 20px 20px" }}>{achados.map((t) => <CartaoTrilha key={t.id} t={t} sug={sug[t.id]} n={aplicados(t.id)} onClick={() => { setBusca(""); abrir(t); }} />)}</div>
        )}
      </Card>
    );
  } else if (!tema) {
    corpo = (
      <>
        {sugeridos.length > 0 && (
          <Card>
            <h2 style={{ fontSize: 17 }}>Sugeridos agora pelos números</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {(todosSug ? sugeridos : sugeridos.slice(0, 8)).map((t) => <button key={t.id} type="button" className="pilula" onClick={() => abrir(t)} title={sug[t.id]}>{t.nome}</button>)}
              {sugeridos.length > 8 && <button type="button" className="btn claro mini" onClick={() => setTodosSug((v) => !v)}>{todosSug ? "Mostrar menos" : `Ver mais ${sugeridos.length - 8}`}</button>}
            </div>
          </Card>
        )}
        <div className="temas-grade">
          {grupos.map((g) => {
            const ns = g.trilhas.filter((t) => sug[t.id]).length;
            const feitos = g.trilhas.filter((t) => aplicados(t.id)).length;
            return (
              <button key={g.id} type="button" className={`tema-cartao tema-${g.id}`} onClick={() => { setTema(g.id); setSel(g.trilhas[0]?.id); }}>
                <span className="tema-faixa" aria-hidden="true" />
                <b>{g.nome}</b>
                <span className="suave peq">{g.desc}</span>
                <span className="tema-rodape">
                  <span className="peq">{g.trilhas.length} treinamento(s)</span>
                  {ns > 0 && <Chip tom="marca">{ns} sugerido(s)</Chip>}
                  {feitos > 0 && <Chip tom="ok">{feitos} já aplicado(s)</Chip>}
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  } else {
    const g = grupos.find((x) => x.id === tema);
    const lista = g?.trilhas || [];
    const t = lista.find((x) => x.id === sel) || lista[0];
    corpo = (
      <>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn claro mini" onClick={() => { setTema(null); setSel(null); }}>← Todos os temas</button>
          <b>{nomeTema(tema)}</b><span className="suave peq">{lista.length} treinamento(s)</span>
        </div>
        {!t ? <Card><div className="vazio">Nenhum treinamento ativo neste tema.</div></Card> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
            <div className="lista-trilhas" style={{ flex: "1 1 260px" }}>
              {lista.map((x) => <CartaoTrilha key={x.id} t={x} sug={sug[x.id]} n={aplicados(x.id)} ativo={x.id === t.id} onClick={() => setSel(x.id)} />)}
            </div>
            <div style={{ flex: "3 1 520px", minWidth: 0 }}>
              <DetalheTrilha key={t.id} t={t} sug={sug[t.id]} aoEditar={() => setEditar(t)} cat={cat} salvarCat={salvarCat} aoSair={() => setSel(null)} />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <Cabecalho sobre="Treinamentos" titulo="Trilhas de treinamento" sub={`Escolha um tema e depois o treinamento. Cada um tem apresentação, roteiro, exercício, teste e registro de quem participou. Setor: ${nomeSetor}.`} />
      <Orientacao tela="treinamentos" />
      {barra}
      {corpo}
      {editar && <EditorTrilha t={editar} cat={cat} salvarCat={salvarCat} aoFechar={() => setEditar(null)} aoCriar={(nova) => abrir(nova)} />}
      {guardados && <Guardados cat={cat} salvarCat={salvarCat} aoFechar={() => setGuardados(false)} />}
    </>
  );
}

function CartaoTrilha({ t, sug, n, ativo, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`card cartao-trilha${ativo ? " ativo" : ""}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontWeight: 600 }}>{t.nome}</b>{sug ? <Chip tom="marca">Sugerido</Chip> : n ? <Chip tom="ok">Aplicado {n}×</Chip> : null}</div>
      <div className="suave peq">{t.publico || "—"} · {t.minutos} min{t.obrigatorio ? "" : " · opcional"}</div>
      {sug && <div className="peq" style={{ color: "var(--marca-900)", marginTop: 4 }}>{sug}</div>}
    </button>
  );
}

function DetalheTrilha({ t, sug, aoEditar, cat, salvarCat }) {
  const { resumo, equipeAtual: equipe, dados, remover } = useBase();
  const [modo, setModo] = useState("guia");
  const [msg, setMsg] = useState("");
  const aplicacoes = dados.treinamentos.filter((x) => x.trilhaId === t.id && x.tipo !== "agenda").sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const mudar = async (parte, aviso) => { setMsg(""); try { await salvarCat(parte); if (aviso) setMsg(aviso); } catch (e) { setMsg(e.message); } };
  const alternarObrigatorio = () => mudar({ obrigatorio: { ...cat.cfg.obrigatorio, [t.id]: !t.obrigatorio } }, t.obrigatorio ? "Agora é opcional: sai do plano de reciclagem." : "Agora é obrigatório: entra no plano.");
  const arquivar = () => window.confirm(`Arquivar “${t.nome}”? Ele sai das trilhas e do plano, mas o histórico de aplicações continua. Você pode restaurar depois.`) && mudar({ arquivadas: [...new Set([...cat.cfg.arquivadas, t.id])] });
  const excluir = () => {
    if (!window.confirm(`Excluir “${t.nome}”? O histórico de quem já fez continua no perfil das pessoas.${t.propria ? "" : " Por ser um treinamento pronto do sistema, ele pode ser restaurado em Arquivados e excluídos."}`)) return;
    if (t.propria) mudar({ proprias: cat.cfg.proprias.filter((p) => p.id !== t.id) });
    else mudar({ excluidas: [...new Set([...cat.cfg.excluidas, t.id])] });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {sug && <Chip tom="marca">Sugerido pelos dados</Chip>}
              <Chip tom={t.obrigatorio ? "ok" : "neutro"}>{t.obrigatorio ? "Obrigatório" : "Opcional"}</Chip>
              {t.documento && <Chip tom="neutro">{t.documento}</Chip>}
              {t.propria && <Chip tom="neutro">Criado por você</Chip>}
            </div>
            <h2 style={{ fontSize: 22, marginTop: 6 }}>{t.nome}</h2>
            <div className="suave">{t.objetivo}</div>
          </div>
          <div className="pilulas" style={{ alignSelf: "flex-start" }}>
            {[["guia", "Guia"], ["slides", "Slides"], ["registro", "Registrar aplicação"]].map(([id, nome]) => <button key={id} type="button" className={`pilula${modo === id ? " ativa" : ""}`} onClick={() => setModo(id)}>{nome}</button>)}
          </div>
        </div>
        {sug && <div className="aviso marca" style={{ marginTop: 12 }}><b>Por que agora:</b> {sug}</div>}
        <div className="peq suave" style={{ marginTop: 10 }}>{t.indicador ? <>Indicador que deve melhorar: <b>{t.indicador}</b> · </> : null}Para: {t.publico || "—"} · {t.minutos} min</div>
        <ResumoPlano trilhaId={t.id} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <button type="button" className="btn claro mini" onClick={aoEditar}>Editar</button>
          <label className="peq" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={t.obrigatorio} onChange={alternarObrigatorio} />Obrigatório</label>
          <button type="button" className="btn claro mini" onClick={arquivar}>Arquivar</button>
          <button type="button" className="btn perigo mini" onClick={excluir}>Excluir</button>
          {msg && <span className="peq suave">{msg}</span>}
        </div>
      </Card>

      {modo === "guia" && (
        <div className="grade grade-2" style={{ alignItems: "start" }}>
          <Card>
            {t.roteiro?.length > 0 && <><h3>Roteiro</h3>
              <table style={{ marginTop: 6 }}><tbody>{t.roteiro.map((r) => <tr key={r.min}><td className="tnum suave" style={{ width: 64 }}>{r.min}</td><td className="peq">{r.passo}</td></tr>)}</tbody></table></>}
            <h3 style={{ marginTop: t.roteiro?.length ? 16 : 0 }}>Exercício</h3>
            <p className="peq" style={{ marginBottom: 0 }}>{t.exercicio || "—"}</p>
            {t.fontes?.length > 0 && <><h3 style={{ marginTop: 16 }}>Fontes</h3><ul className="peq suave" style={{ margin: 0, paddingLeft: 18 }}>{t.fontes.map((f) => <li key={f}>{f}</li>)}</ul></>}
          </Card>
          <Card>
            <h3>Teste rápido</h3>
            {t.perguntas?.length ? t.perguntas.map((q, k) => <Pergunta key={`${t.id}-${k}`} q={q} n={k + 1} />) : <p className="peq suave">Sem perguntas. Use os quizzes da apresentação vinculada.</p>}
            <p className="peq suave" style={{ marginTop: 12, marginBottom: 0 }}>Nota de 0 a 10. Abaixo de {NOTA_MINIMA}, a pessoa aparece como “refazer” no plano e não recebe certificado.</p>
          </Card>
        </div>
      )}

      {modo === "slides" && <SlidesDaTrilha t={t} />}
      {modo === "registro" && <Registro trilha={t} />}

      <Card semPad>
        <div className="card-cab"><h3>Aplicações</h3><span className="suave peq">{aplicacoes.length}</span></div>
        {aplicacoes.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Ainda não aplicado.</div> : (
          <div className="tabela-caixa"><table>
            <thead><tr><th>Data</th><th>Participantes e certificados</th><th>Nota média</th><th>Efeito no indicador</th><th /></tr></thead>
            <tbody>{aplicacoes.map((a) => {
              const ef = eficacia(t, a, { resumo, dados });
              const media = mediaNotas(a.participantes);
              return (
                <tr key={a.id}>
                  <td className="tnum">{dataCurta(a.data)}{a.instrutor && <div className="suave peq">{a.instrutor}</div>}</td>
                  <td className="peq">
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {(a.participantes || []).filter((p) => p.presente !== false).map((p) => {
                        const nome = nomeProprio(p.nome || equipe.find((m) => m.id === p.pessoaId)?.nome || "—");
                        return (
                          <div key={p.pessoaId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span>{nome}</span><span className="suave tnum">{p.nota != null ? `nota ${fmtNota(p.nota)}` : "sem nota"}</span>
                            {aprovado(p) ? <BotaoCertificado dados={{ nome, treinamento: t.nome, documento: t.documento, data: a.data, minutos: t.minutos, nota: p.nota, instrutor: a.instrutor }} /> : <Chip tom="alerta">Refazer</Chip>}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="tnum">{media == null ? "—" : fmtNota(media)}</td>
                  <td className="peq">{ef.texto || `${ef.rotulo}: ${ef.antes} → ${ef.depois}`}</td>
                  <td><button type="button" className="btn perigo mini" onClick={() => window.confirm("Apagar este registro de aplicação? Ele sai também do perfil dos participantes.") && remover("treinamentos", a.id)}>Apagar</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}

/** Apresentação do treinamento: a vinculada (criada no estúdio), a do modelo pronto ou os tópicos. */
function SlidesDaTrilha({ t }) {
  const { dados } = useBase();
  const deck = t.apresentacaoId ? dados.apresentacoes.find((d) => d.id === t.apresentacaoId) : null;
  if (deck?.slides?.length) return <SlidesDeck slides={deck.slides} tema={deck.tema} rodape={`Apresentação vinculada: “${deck.titulo}”. Para mudar os slides, edite-a em Apresentações de treinamento.`} />;
  if (t.modelo) return <SlidesDoModelo key={t.modelo} modelo={t.modelo} />;
  if (t.slides?.length) {
    return (
      <Slides titulo={`Treinamento · ${t.nome}`} slides={[
        { titulo: t.nome, corpo: <div><div style={{ fontSize: "1.3em" }}>{t.objetivo}</div><div className="suave" style={{ marginTop: 12 }}>{t.publico} · {t.minutos} minutos</div></div>, minutos: 2 },
        ...t.slides.map((x, k) => ({ titulo: `${k + 1}. ${x.split(":")[0].split(".")[0].slice(0, 60)}`, corpo: <div style={{ fontSize: "1.3em", lineHeight: 1.5 }}>{x}</div>, minutos: 3 })),
      ]} />
    );
  }
  return <Card><div className="vazio">Sem apresentação. Crie uma em Apresentações de treinamento e vincule aqui em <b>Editar</b>.</div></Card>;
}

function SlidesDeck({ slides, tema, rodape }) {
  const [i, setI] = useState(0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Apresentador slides={slides} ctx={{ tema, valores: { mes: "", ano: "" } }} i={i} setI={setI} />
      <div className="suave peq">{rodape}</div>
    </div>
  );
}

function SlidesDoModelo({ modelo }) {
  const [slides] = useState(() => slidesDoModelo(modelo));
  const m = modeloPorId(modelo);
  return <SlidesDeck slides={slides} tema={m?.tema} rodape={<>Para editar os slides, baixar em PowerPoint ou gerar a ata, crie a apresentação pela aba <b>Apresentações de treinamento</b> com o modelo “{m?.nome}”.</>} />;
}

/** Editar um treinamento (pronto ou criado por você) ou criar um novo. */
function EditorTrilha({ t, cat, salvarCat, aoFechar, aoCriar }) {
  const { dados } = useBase();
  const novo = !t.id;
  const [f, setF] = useState({ nome: t.nome || "", tema: t.tema || "proprios", publico: t.publico || "", objetivo: t.objetivo || "", minutos: t.minutos || 30, documento: t.documento || "", indicador: t.indicador || "", exercicio: t.exercicio || "", apresentacaoId: t.apresentacaoId || "" });
  const [obrig, setObrig] = useState(novo ? true : t.obrigatorio);
  const [msg, setMsg] = useState("");
  const decks = dados.apresentacoes.filter((d) => d.categoria === "treinamento" && !d.ataImportada);
  const campo = (k, rot, props = {}) => <div className="campo"><label htmlFor={`ed-${k}`}>{rot}</label><input id={`ed-${k}`} className="entrada" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></div>;
  const salvar = async () => {
    if (!f.nome.trim()) { setMsg("Dê um nome ao treinamento."); return; }
    const dadosT = { ...f, nome: f.nome.trim(), minutos: Number(f.minutos) || 30 };
    try {
      if (novo) {
        const id = `pr-${Date.now().toString(36)}`;
        await salvarCat({ proprias: [...cat.cfg.proprias, { id, ...dadosT }], obrigatorio: { ...cat.cfg.obrigatorio, [id]: obrig } });
        aoFechar(); aoCriar({ id, tema: dadosT.tema });
      } else if (t.propria) {
        await salvarCat({ proprias: cat.cfg.proprias.map((p) => (p.id === t.id ? { ...p, ...dadosT } : p)), obrigatorio: { ...cat.cfg.obrigatorio, [t.id]: obrig } });
        aoFechar();
      } else {
        await salvarCat({ edicoes: { ...cat.cfg.edicoes, [t.id]: dadosT }, obrigatorio: { ...cat.cfg.obrigatorio, [t.id]: obrig } });
        aoFechar();
      }
    } catch (e) { setMsg(e.message); }
  };
  const restaurar = async () => {
    if (!window.confirm("Voltar ao texto original deste treinamento?")) return;
    const { [t.id]: _fora, ...resto } = cat.cfg.edicoes;
    try { await salvarCat({ edicoes: resto }); aoFechar(); } catch (e) { setMsg(e.message); }
  };
  return (
    <Modal titulo={novo ? "Novo treinamento" : `Editar · ${t.nome}`} aoFechar={aoFechar} largo>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {campo("nome", "Nome")}
          <div className="campo"><label htmlFor="ed-tema">Tema</label><select id="ed-tema" className="entrada" value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })}>{TEMAS.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></div>
          {campo("publico", "Para quem (público)")}
          {campo("minutos", "Duração (minutos)", { type: "number", min: 5, step: 5 })}
          {campo("documento", "Documento de referência (ex.: PG 010 rev. 02)")}
          {campo("indicador", "Indicador que deve melhorar")}
        </div>
        <div className="campo"><label htmlFor="ed-obj">Objetivo</label><textarea id="ed-obj" className="entrada" rows={2} value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })} /></div>
        <div className="campo"><label htmlFor="ed-ex">Exercício</label><textarea id="ed-ex" className="entrada" rows={2} value={f.exercicio} onChange={(e) => setF({ ...f, exercicio: e.target.value })} /></div>
        <div className="campo"><label htmlFor="ed-ap">Apresentação vinculada</label>
          <select id="ed-ap" className="entrada" value={f.apresentacaoId} onChange={(e) => setF({ ...f, apresentacaoId: e.target.value })}>
            <option value="">{t.modelo ? "A apresentação pronta do sistema" : "Nenhuma"}</option>
            {decks.map((d) => <option key={d.id} value={d.id}>{d.titulo}</option>)}
          </select>
          <span className="suave peq">Crie ou copie uma apresentação em Apresentações de treinamento e escolha aqui para usar a sua versão.</span>
        </div>
        <label className="peq" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={obrig} onChange={(e) => setObrig(e.target.checked)} />Treinamento obrigatório (entra no plano de reciclagem)</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn" onClick={salvar}>{novo ? "Criar treinamento" : "Salvar"}</button>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          {!novo && !t.propria && cat.cfg.edicoes[t.id] && <button type="button" className="btn claro" onClick={restaurar}>Voltar ao original</button>}
          {msg && <span className="peq">{msg}</span>}
        </div>
      </div>
    </Modal>
  );
}

function Guardados({ cat, salvarCat, aoFechar }) {
  const [msg, setMsg] = useState("");
  const restaurar = async (t) => {
    try {
      await salvarCat({ arquivadas: cat.cfg.arquivadas.filter((x) => x !== t.id), excluidas: cat.cfg.excluidas.filter((x) => x !== t.id) });
      setMsg(`“${t.nome}” voltou para as trilhas.`);
    } catch (e) { setMsg(e.message); }
  };
  const bloco = (titulo, lista, vazio) => (
    <div>
      <h3>{titulo}</h3>
      {lista.length === 0 ? <p className="peq suave">{vazio}</p> : (
        <table style={{ marginTop: 6 }}><tbody>{lista.map((t) => <tr key={t.id}><td>{t.nome}<div className="suave peq">{nomeTema(t.tema)}</div></td><td style={{ textAlign: "right" }}><button type="button" className="btn claro mini" onClick={() => restaurar(t)}>Restaurar</button></td></tr>)}</tbody></table>
      )}
    </div>
  );
  return (
    <Modal titulo="Arquivados e excluídos" aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {bloco("Arquivados", cat.arquivados, "Nenhum treinamento arquivado.")}
        {bloco("Excluídos (prontos do sistema)", cat.excluidos, "Nenhum treinamento pronto excluído.")}
        <p className="peq suave" style={{ margin: 0 }}>O histórico de quem já fez cada treinamento nunca é apagado.</p>
        {msg && <span className="peq">{msg}</span>}
      </div>
    </Modal>
  );
}

/** Cargos, reciclagem, prazo para novos e próxima data de uma trilha. */
function ResumoPlano({ trilhaId }) {
  const { dados } = useBase();
  const plano = planoEmVigor(dados.treinamentos);
  const cargos = (plano.cargos[trilhaId] || []).map((id) => dados.funcoes.find((f) => f.id === id)?.nome).filter(Boolean);
  const per = plano.periodos[trilhaId] || 0;
  const novo = plano.prazoNovo[trilhaId] || 0;
  const prox = agenda(dados.treinamentos, { desde: hojeBR(), soAbertas: true }).find((a) => a.trilhaId === trilhaId);
  return (
    <div className="peq" style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
      <Chip tom="neutro">Cargos: {cargos.length ? cargos.join(", ") : "toda a equipe"}</Chip>
      <Chip tom="neutro">{per ? `Reciclagem: ${OPCOES_PERIODO.find(([v]) => v === per)?.[1].toLowerCase() || `a cada ${per} meses`}` : "Sem reciclagem"}</Chip>
      {novo > 0 && <Chip tom="neutro">Novos: até {novo} dias após a entrada</Chip>}
      {prox && <Chip tom="marca">Próxima aplicação: {dataCurta(prox.data)}{prox.hora ? ` às ${prox.hora}` : ""}</Chip>}
    </div>
  );
}

// ------------------------------------------------------------ plano e calendário
const ROT = { "em-dia": ["ok", "Em dia"], vence: ["alerta", "Vence em breve"], vencido: ["ruim", "Vencido"], refazer: ["ruim", "Refazer (nota baixa)"], nunca: ["neutro", "Nunca fez"], pendente: ["alerta", "Novo: fazer"], "nao-se-aplica": ["neutro", "Não se aplica"] };
function Reciclagem({ irParaTrilha }) {
  const { equipeAtual: equipe, dados, gravar } = useBase();
  const { cat, salvarCat } = useCatalogo();
  const trilhas = cat.ativos;
  const [msg, setMsg] = useState("");
  const [abrirCargos, setAbrirCargos] = useState(null);
  const hoje = hojeBR();
  const plano = planoEmVigor(dados.treinamentos);
  const m = matrizReciclagem({ trilhas: trilhas.filter((t) => t.obrigatorio), registros: dados.treinamentos, pessoas: equipe, hoje });
  const funcoes = dados.funcoes || [];
  const salvar = async (parte) => {
    setMsg("");
    try { await gravar("treinamentos", { id: ID_CONFIG, tipo: "periodicidade", periodos: plano.periodos, cargos: plano.cargos, prazoNovo: plano.prazoNovo, ...parte }); setMsg("Plano salvo."); }
    catch (e) { setMsg(e.message); }
  };
  const mudarObrig = async (t) => { setMsg(""); try { await salvarCat({ obrigatorio: { ...cat.cfg.obrigatorio, [t.id]: !t.obrigatorio } }); setMsg("Plano salvo."); } catch (e) { setMsg(e.message); } };
  const mudarCargo = (tid, fid) => {
    const atual = plano.cargos[tid] || [];
    salvar({ cargos: { ...plano.cargos, [tid]: atual.includes(fid) ? atual.filter((x) => x !== fid) : [...atual, fid] } });
  };
  const celula = (c) => {
    if (!c) return null;
    const [tom, rot] = ROT[c.status] || ["neutro", ""];
    if (c.status === "nao-se-aplica") return <span className="suave peq">—</span>;
    return <div><Chip tom={tom}>{rot}</Chip>{c.vence && c.status !== "refazer" && <div className="suave peq" style={{ marginTop: 2 }}>{c.status === "vencido" ? "venceu" : "até"} {dataCurta(c.vence)}</div>}</div>;
  };
  const semFuncao = equipe.filter((p) => !p.funcaoId).length;
  return (
    <>
      <Cabecalho sobre="Treinamentos" titulo="Plano e calendário de treinamentos" sub="Para cada treinamento: se é obrigatório, quais cargos precisam fazer, de quanto em quanto tempo reciclar, o prazo para quem acabou de entrar e as datas de aplicação. O sistema avisa 30 dias antes de vencer." />
      <div className="grade grade-kpi">
        <Card><div className="suave peq">Vencidas ou a refazer</div><div style={{ fontSize: 28, fontWeight: 700, color: m.totais.vencido ? "var(--ruim)" : undefined }}>{m.totais.vencido}</div></Card>
        <Card><div className="suave peq">Vencem nos próximos 30 dias</div><div style={{ fontSize: 28, fontWeight: 700, color: m.totais.vence ? "var(--alerta)" : undefined }}>{m.totais.vence}</div></Card>
        <Card><div className="suave peq">Obrigatórios ainda não feitos</div><div style={{ fontSize: 28, fontWeight: 700 }}>{m.totais.nunca}</div></Card>
        <Card><div className="suave peq">Aplicações agendadas</div><div style={{ fontSize: 28, fontWeight: 700 }}>{agenda(dados.treinamentos, { desde: hoje, soAbertas: true }).length}</div></Card>
      </div>

      <Card semPad>
        <div className="card-cab"><h2>Plano de cada treinamento</h2>{msg && <span className="peq suave">{msg}</span>}</div>
        <div className="tabela-caixa"><table>
          <thead><tr><th>Treinamento</th><th>Obrigatório</th><th>Cargos que precisam fazer</th><th>Reciclagem</th><th>Quem acabou de entrar</th></tr></thead>
          <tbody>{trilhas.map((t) => {
            const cs = plano.cargos[t.id] || [];
            return (
              <tr key={t.id} style={t.obrigatorio ? undefined : { opacity: 0.6 }}>
                <td>{t.nome}<div className="peq suave">{nomeTema(t.tema)}{t.publico ? ` · ${t.publico}` : ""}</div></td>
                <td><input type="checkbox" aria-label={`${t.nome} é obrigatório`} checked={t.obrigatorio} onChange={() => mudarObrig(t)} style={{ width: 18, height: 18 }} /></td>
                <td style={{ minWidth: 220 }}>
                  <div className="peq">{cs.length ? cs.map((id) => funcoes.find((f) => f.id === id)?.nome || "função apagada").join(", ") : <span className="suave">Toda a equipe do setor</span>}</div>
                  <button type="button" className="btn claro mini" style={{ marginTop: 4 }} onClick={() => setAbrirCargos(abrirCargos === t.id ? null : t.id)} aria-expanded={abrirCargos === t.id}>{abrirCargos === t.id ? "Fechar" : "Escolher cargos"}</button>
                  {abrirCargos === t.id && (
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                      {funcoes.length === 0 && <span className="suave peq">Cadastre as funções em Funções e cargos.</span>}
                      {funcoes.map((f) => <label key={f.id} className="peq" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={cs.includes(f.id)} onChange={() => mudarCargo(t.id, f.id)} />{f.nome}</label>)}
                    </div>
                  )}
                </td>
                <td><select className="entrada" style={{ minWidth: 190 }} aria-label={`Reciclagem de ${t.nome}`} value={plano.periodos[t.id] ?? 0} onChange={(e) => salvar({ periodos: { ...plano.periodos, [t.id]: Number(e.target.value) } })}>
                  {OPCOES_PERIODO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select></td>
                <td><select className="entrada" style={{ minWidth: 150 }} aria-label={`Prazo para novos em ${t.nome}`} value={plano.prazoNovo[t.id] ?? 0} onChange={(e) => salvar({ prazoNovo: { ...plano.prazoNovo, [t.id]: Number(e.target.value) } })}>
                  {OPCOES_PRAZO_NOVO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select></td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <div className="suave peq" style={{ padding: "0 20px 16px" }}>Só os obrigatórios entram na situação da equipe. Sem cargo marcado, o treinamento vale para toda a equipe do setor. O cargo de cada pessoa vem de Equipe e metas{semFuncao ? ` (${semFuncao} pessoa(s) ainda sem função)` : ""}. Nota abaixo de {NOTA_MINIMA} conta como “refazer”. A ISO/IEC 17025 (6.2) pede definir e monitorar a competência por função: este plano e os registros de aplicação são a evidência.</div>
      </Card>

      <Calendario trilhas={trilhas} />

      <Card semPad>
        <div className="card-cab"><h2>Situação da equipe</h2><span className="suave peq">{equipe.length} pessoa(s) · {m.periodicas.length} treinamento(s) no plano</span></div>
        {m.periodicas.length === 0 || equipe.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>{equipe.length ? "Defina o plano de algum treinamento acima." : "Cadastre a equipe do setor em Equipe e metas."}</div> : (
          <div className="tabela-caixa"><table>
            <thead><tr><th>Pessoa</th>{m.periodicas.map((t) => <th key={t.id} style={{ minWidth: 130 }}>{t.nome}</th>)}</tr></thead>
            <tbody>{m.linhas.map((l) => <tr key={l.pessoa.id}><td>{l.pessoa.nome}</td>{m.periodicas.map((t) => <td key={t.id}>{celula(l.celulas[t.id])}</td>)}</tr>)}</tbody>
          </table></div>
        )}
      </Card>

      {m.pendencias.length > 0 && (
        <Card semPad>
          <div className="card-cab"><h2>O que aplicar primeiro</h2><button type="button" className="btn claro mini" onClick={irParaTrilha}>Ir para as trilhas e registrar</button></div>
          <div className="tabela-caixa"><table>
            <thead><tr><th>Pessoa</th><th>Treinamento</th><th>Situação</th><th>Última aplicação</th><th>Agendado</th></tr></thead>
            <tbody>{m.pendencias.slice(0, 30).map((x) => <tr key={`${x.pessoa.id}-${x.trilha.id}`}><td>{x.pessoa.nome}</td><td>{x.trilha.nome}</td><td>{celula(x)}</td><td className="tnum">{x.ultima ? dataCurta(x.ultima) : "—"}</td><td className="tnum">{x.agendada ? dataCurta(x.agendada.data) : <span className="suave">não</span>}</td></tr>)}</tbody>
          </table></div>
        </Card>
      )}
    </>
  );
}

const ST_AGENDA = { agendado: ["neutro", "Agendado"], realizado: ["ok", "Realizado"], cancelado: ["ruim", "Cancelado"] };

/** Calendário de aplicação: agendar, dar baixa (registrar quem participou) e cancelar. */
export function Calendario({ trilhas }) {
  const { dados, gravar, remover } = useBase();
  const { cat } = useCatalogo();
  const hoje = hojeBR();
  const vazio = { trilhaId: trilhas[0]?.id || "", data: "", hora: "", local: "", responsavel: "", obs: "" };
  const [f, setF] = useState(vazio);
  const [msg, setMsg] = useState("");
  const [passadas, setPassadas] = useState(false);
  const [baixa, setBaixa] = useState(null);
  const pendentesBaixa = agenda(dados.treinamentos).filter((a) => (!a.status || a.status === "agendado") && a.data < hoje);
  const lista = agenda(dados.treinamentos, { desde: passadas ? "" : hoje });
  const visiveis = passadas ? lista : [...pendentesBaixa, ...lista.filter((a) => !pendentesBaixa.includes(a))];
  const porMes = visiveis.reduce((acc, a) => { const k = String(a.data).slice(0, 7); (acc[k] ||= []).push(a); return acc; }, {});
  const nomeT = (id, a) => trilhaEmQualquerLugar(cat, id)?.nome || a?.titulo || "Treinamento";
  const agendar = async (e) => {
    e.preventDefault();
    if (!f.data) { setMsg("Escolha a data."); return; }
    setMsg("");
    try {
      await gravar("treinamentos", { id: `ag-${Date.now().toString(36)}`, tipo: "agenda", status: "agendado", ...f, titulo: nomeT(f.trilhaId) });
      setF({ ...vazio, trilhaId: f.trilhaId }); setMsg("Aplicação agendada.");
    } catch (e2) { setMsg(e2.message); }
  };
  const cancelar = async (a) => { if (window.confirm("Marcar esta data como cancelada?")) { try { await gravar("treinamentos", { ...a, status: "cancelado" }); } catch (e) { setMsg(e.message); } } };
  const campo = (k, rot, props = {}) => <label className="campo" style={{ flex: props.flex || "1 1 140px" }}><span>{rot}</span><input className="entrada" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></label>;
  const trilhaBaixa = baixa ? trilhaEmQualquerLugar(cat, baixa.trilhaId) || { id: baixa.trilhaId, nome: baixa.titulo, minutos: 30 } : null;
  return (
    <Card semPad>
      <div className="card-cab"><h2>Calendário de aplicação</h2><label className="peq suave" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={passadas} onChange={(e) => setPassadas(e.target.checked)} />Mostrar todas as datas passadas</label></div>
      <form onSubmit={agendar} style={{ padding: "0 20px 12px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label className="campo" style={{ flex: "2 1 220px" }}><span>Treinamento</span><select className="entrada" value={f.trilhaId} onChange={(e) => setF({ ...f, trilhaId: e.target.value })}>{trilhas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
        {campo("data", "Data", { type: "date", flex: "1 1 150px" })}
        {campo("hora", "Hora", { type: "time", flex: "0 1 110px" })}
        {campo("local", "Local")}
        {campo("responsavel", "Quem aplica")}
        {campo("obs", "Observação", { flex: "2 1 200px" })}
        <button type="submit" className="btn">Agendar</button>
        {msg && <span className="peq suave">{msg}</span>}
      </form>
      {pendentesBaixa.length > 0 && <div className="aviso alerta" style={{ margin: "0 20px 12px" }}>{pendentesBaixa.length} data(s) já passaram e estão sem baixa. Clique em <b>Dar baixa</b> para registrar quem participou e a nota, ou em <b>Cancelar</b> se não aconteceu.</div>}
      {visiveis.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma aplicação agendada.</div> : (
        <div className="tabela-caixa"><table>
          <thead><tr><th>Data</th><th>Treinamento</th><th>Local</th><th>Quem aplica</th><th>Situação</th><th /></tr></thead>
          <tbody>{Object.entries(porMes).flatMap(([mes, itens]) => [
            <tr key={mes}><td colSpan={6} style={{ background: "var(--fundo-2, #f4f6f8)", fontWeight: 600 }}>{mesNome(mes)} {mes.slice(0, 4)}</td></tr>,
            ...itens.map((a) => {
              const st = a.status || "agendado";
              const atrasada = st === "agendado" && a.data < hoje;
              const [tom, rot] = atrasada ? ["alerta", "Sem baixa"] : ST_AGENDA[st] || ST_AGENDA.agendado;
              return (
                <tr key={a.id}>
                  <td className="tnum">{dataCurta(a.data)}{a.hora ? ` · ${a.hora}` : ""}</td>
                  <td>{nomeT(a.trilhaId, a)}{a.obs && <div className="suave peq">{a.obs}</div>}</td>
                  <td className="peq">{a.local || "—"}</td>
                  <td className="peq">{a.responsavel || "—"}</td>
                  <td><Chip tom={tom}>{rot}</Chip></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {st === "agendado" && <><button type="button" className="btn mini" onClick={() => setBaixa(a)}>Dar baixa</button> <button type="button" className="btn claro mini" onClick={() => cancelar(a)}>Cancelar</button> </>}
                    <button type="button" className="btn perigo mini" onClick={() => window.confirm("Tirar esta data do calendário?") && remover("treinamentos", a.id)}>Apagar</button>
                  </td>
                </tr>
              );
            }),
          ])}</tbody>
        </table></div>
      )}
      <div className="suave peq" style={{ padding: "0 20px 16px" }}>Dar baixa abre o registro de presença com o treinamento e a data já preenchidos. Ao salvar, a data fica como realizada, a aplicação conta para a reciclagem e aparece no perfil de cada pessoa.</div>
      {baixa && (
        <Modal titulo={`Dar baixa · ${trilhaBaixa.nome} · ${dataCurta(baixa.data)}`} aoFechar={() => setBaixa(null)} largo>
          <Registro trilha={trilhaBaixa} dataInicial={baixa.data} instrutorInicial={baixa.responsavel} aoSalvar={async (salvo) => { await gravar("treinamentos", { ...baixa, status: "realizado", aplicacaoId: salvo.id }); setBaixa(null); setMsg("Baixa registrada."); }} />
        </Modal>
      )}
    </Card>
  );
}

function Pergunta({ q, n }) {
  const [ver, setVer] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <div className="peq" style={{ fontWeight: 600 }}>{n}. {q.p}</div>
      <ol type="a" className="peq" style={{ margin: "4px 0 0", paddingLeft: 22 }}>
        {q.opcoes.map((o, k) => <li key={o} style={{ color: ver && k === q.certa ? "var(--ok)" : undefined, fontWeight: ver && k === q.certa ? 600 : 400 }}>{o}</li>)}
      </ol>
      <button type="button" className="btn claro mini" style={{ marginTop: 6 }} onClick={() => setVer((v) => !v)}>{ver ? "Esconder resposta" : "Ver resposta"}</button>
    </div>
  );
}

/** Registro de aplicação: todos os colaboradores para marcar, nota de 0 a 10. */
export function Registro({ trilha, dataInicial, instrutorInicial = "", aoSalvar }) {
  const { equipeAtual: equipe, elenco, gravar } = useBase();
  const pessoas = pessoasParaTreinamento(equipe, elenco);
  const [data, setData] = useState(dataInicial || hojeBR());
  const [instrutor, setInstrutor] = useState(instrutorInicial);
  const [sel, setSel] = useState({}); // id -> nota ("" = sem nota)
  const [busca, setBusca] = useState("");
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState("");
  const marcados = pessoas.filter((p) => p.id in sel);
  const visiveis = pessoas.filter((p) => !busca || norm(p.nome).includes(norm(busca)));
  const alternar = (id) => setSel((x) => { const n = { ...x }; if (id in n) delete n[id]; else n[id] = ""; return n; });
  const invalida = marcados.find((p) => sel[p.id] !== "" && (Number(sel[p.id]) < 0 || Number(sel[p.id]) > 10));
  const salvar = async () => {
    if (!marcados.length) { setMsg("Marque quem participou."); return; }
    if (invalida) { setMsg(`A nota de ${nomeProprio(invalida.nome)} precisa ser de 0 a 10.`); return; }
    try {
      const salvo = await gravar("treinamentos", {
        trilhaId: trilha.id, titulo: trilha.nome, data, obs, instrutor: instrutor.trim(),
        participantes: marcados.map((p) => ({ pessoaId: p.id, rhPessoaId: p.rhPessoaId || "", nome: p.nome, presente: true, nota: sel[p.id] === "" ? null : Number(String(sel[p.id]).replace(",", ".")) })),
      });
      setMsg(`Aplicação registrada para ${marcados.length} pessoa(s). Já aparece no perfil de cada uma.`); setObs(""); setSel({});
      if (aoSalvar) await aoSalvar(salvo);
    } catch (e) { setMsg(e.message); }
  };
  return (
    <Card>
      <h3>Registrar aplicação</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="campo" style={{ maxWidth: 180 }}><label htmlFor="t-data">Data</label><input id="t-data" type="date" className="entrada" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="campo" style={{ flex: "1 1 180px" }}><label htmlFor="t-instrutor">Quem aplicou</label><input id="t-instrutor" className="entrada" value={instrutor} onChange={(e) => setInstrutor(e.target.value)} placeholder="Vai na assinatura do certificado" /></div>
          <div className="campo" style={{ flex: "1 1 180px" }}><label htmlFor="t-busca">Buscar colaborador</label><input id="t-busca" className="entrada" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome" /></div>
          <button type="button" className="btn claro mini" onClick={() => setSel((x) => ({ ...Object.fromEntries(pessoas.filter((p) => p.daEquipe).map((p) => [p.id, ""])), ...x }))}>Marcar a equipe do setor</button>
          <button type="button" className="btn claro mini" onClick={() => setSel({})}>Limpar</button>
        </div>
        <div className="suave peq">{marcados.length} selecionado(s) de {pessoas.length}. Aparecem todos os colaboradores ativos da MinasLab; a equipe do setor vem primeiro.</div>
        <div className="tabela-caixa" style={{ maxHeight: 420, overflow: "auto" }}>
          <table><thead><tr><th style={{ width: 40 }} /><th>Colaborador</th><th>Nota do teste (0 a 10)</th></tr></thead><tbody>
            {visiveis.map((p) => (
              <tr key={p.id} style={p.id in sel ? { background: "var(--marca-50)" } : undefined}>
                <td><input type="checkbox" aria-label={`${p.nome} participou`} checked={p.id in sel} onChange={() => alternar(p.id)} style={{ width: 18, height: 18 }} /></td>
                <td onClick={() => alternar(p.id)} style={{ cursor: "pointer" }}>{nomeProprio(p.nome)}{p.daEquipe && <span className="suave peq"> · equipe do setor</span>}</td>
                <td>{p.id in sel && <input className="entrada num" type="number" min="0" max="10" step="0.5" style={{ width: 100 }} aria-label={`Nota de ${p.nome}`} value={sel[p.id]} onChange={(e) => setSel({ ...sel, [p.id]: e.target.value })} />}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <div className="campo"><label htmlFor="t-obs">Observações</label><textarea id="t-obs" className="entrada" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><button type="button" className="btn" onClick={salvar}>Salvar ({marcados.length})</button>{msg && <span className="peq">{msg}</span>}</div>
        <div className="suave peq">Nota de 0 a 10 (em branco se não houve teste). Com nota {NOTA_MINIMA} ou mais, o certificado fica liberado. Fica como registro de treinamento por pessoa (evidência de competência para a ISO/IEC 17025) em Pessoas e feedback › Treinamentos.</div>
      </div>
    </Card>
  );
}
