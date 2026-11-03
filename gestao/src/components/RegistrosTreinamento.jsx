// Treinamentos › Requisição, registro e eficácia: o caminho do PT 001.
//  1. REQT: planejar e pedir a aprovação (antes);
//  2. RT: registrar a aplicação e imprimir a lista para assinatura (no dia);
//  3. AVET: avaliar a eficácia de cada participante (30 dias depois), com
//     plano de ação quando não for eficaz.
import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Modal } from "./ui.jsx";
import { JanelaDocumento, DocREQT, DocRT, DocAVET } from "./FormulariosTreinamento.jsx";
import { Registro } from "../pages/Treinamentos.jsx";
import { useUsuariosTarefas, criarTarefaDaAplicacao, concluirSeTodosAvaliados } from "./TarefaEficacia.jsx";
import { catalogo } from "../lib/catalogo.js";
import { pessoasParaTreinamento } from "../lib/treinamentosPessoa.js";
import { dataCurta, hojeBR, nomeProprio } from "../lib/format.js";
import {
  TIPOS_TREINAMENTO, nomeTipo, EXPECTATIVAS, AVET_QUESTOES, COMO_AVALIADO, DIAS_EFICACIA, somarDias,
  resultadoEficacia, requisicoes, avaliacoesEficacia, ehAplicacao, FORMULARIOS,
} from "../lib/formulariosTreinamento.js";

const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const periodo = (a, b) => (b && b !== a ? `${dataCurta(a)} a ${dataCurta(b)}` : dataCurta(a));
const SITUACAO = {
  atrasada: ["ruim", "Atrasada"], plano: ["alerta", "Não eficaz · plano de ação"], proxima: ["alerta", "Nos próximos 7 dias"],
  agendada: ["neutro", "Agendada"], reavaliada: ["neutro", "Plano aprovado"], eficaz: ["ok", "Eficaz"],
};

export function RegistrosTreinamento() {
  const { dados, setor, gravar } = useBase();
  const cat = catalogo(dados.treinamentos, setor);
  const hoje = hojeBR();
  const reqs = requisicoes(dados.treinamentos);
  const avs = avaliacoesEficacia(dados.treinamentos, hoje);
  const aplicacoes = (dados.treinamentos || []).filter(ehAplicacao).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const trilhaDe = (id) => cat.ativos.find((t) => t.id === id) || null;
  const [editando, setEditando] = useState(null); // requisição (nova = {})
  const [aplicando, setAplicando] = useState(null); // requisição a registrar
  const [doc, setDoc] = useState(null); // { tipo, ... }
  const [avaliando, setAvaliando] = useState(null); // linha de avaliação
  const [verTodas, setVerTodas] = useState(false);
  const [verRegistros, setVerRegistros] = useState(10);
  const abertas = avs.filter((x) => ["atrasada", "plano", "proxima"].includes(x.situacao));
  const contas = useUsuariosTarefas();
  const [respTarefa, setRespTarefa] = useState("");
  const [criando, setCriando] = useState("");
  const [msgTarefa, setMsgTarefa] = useState("");
  const nomeConta = (u) => contas.usuarios.find((x) => x.usuario === u)?.nome || "";
  const todosAvaliados2 = (a) => (a.participantes || []).filter((p) => p.presente !== false).every((p) => resultadoEficacia(a.eficacia?.[p.pessoaId] || {}));
  const criarTarefa = async (a) => {
    setCriando(a.id); setMsgTarefa("");
    try { await criarTarefaDaAplicacao(a, respTarefa || contas.eu, gravar); setMsgTarefa(`Tarefa criada no painel: “${a.titulo}”.`); }
    catch (e) { setMsgTarefa(`Não consegui criar a tarefa: ${e.message}`); }
    setCriando("");
  };
  const listaAv = verTodas ? avs : avs.filter((x) => x.situacao !== "eficaz" && x.situacao !== "reavaliada");

  return (
    <>
      <Cabecalho sobre="Treinamentos" titulo="Requisição, registro e eficácia" sub={`Os formulários do PT 001 gerados pelo sistema: a REQT antes do treinamento, o RT com a lista para assinatura no dia e a AVET de cada participante ${DIAS_EFICACIA} dias depois. Ao registrar, a avaliação vira tarefa no painel, com aviso no sino e lembrete 1 dia antes.`}>
        <button type="button" className="btn" onClick={() => setEditando({})}>Nova requisição (REQT)</button>
      </Cabecalho>

      <div className="grade grade-kpi">
        <Card style={{ padding: 18 }}><div className="kpi-rot">Avaliações da eficácia para fazer</div><div className="kpi-val tnum">{abertas.length}</div><div className="kpi-sub">{avs.filter((x) => x.situacao === "atrasada").length} atrasada(s)</div></Card>
        <Card style={{ padding: 18 }}><div className="kpi-rot">Requisições abertas</div><div className="kpi-val tnum">{reqs.filter((r) => r.status !== "realizada").length}</div><div className="kpi-sub">aguardando o treinamento</div></Card>
        <Card style={{ padding: 18 }}><div className="kpi-rot">Treinamentos registrados</div><div className="kpi-val tnum">{aplicacoes.length}</div><div className="kpi-sub">com RT para imprimir</div></Card>
        <Card style={{ padding: 18 }}><div className="kpi-rot">Eficácia</div><div className="kpi-val tnum">{avs.filter((x) => x.situacao === "eficaz").length}/{avs.filter((x) => x.resultado).length}</div><div className="kpi-sub">avaliações eficazes</div></Card>
      </div>

      <Card semPad>
        <div className="card-cab"><h2>Avaliação da eficácia (AVET)</h2>
          <label className="peq" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} /> mostrar as já avaliadas</label>
        </div>
        {listaAv.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma avaliação pendente. Elas aparecem aqui {DIAS_EFICACIA} dias depois de cada treinamento registrado.</div> : (
          <div className="tabela-caixa tabela-comissao"><table>
            <thead><tr><th>Participante</th><th>Treinamento</th><th>Realizado em</th><th>Avaliar até</th><th>Situação</th><th /></tr></thead>
            <tbody>{listaAv.map((x) => {
              const [tom, rot] = SITUACAO[x.situacao];
              return (
                <tr key={`${x.aplicacao.id}-${x.participante.pessoaId}`}>
                  <td><b>{nomeProprio(x.participante.nome)}</b>{x.participante.funcao && <div className="suave peq">{x.participante.funcao}</div>}</td>
                  <td className="peq">{x.aplicacao.titulo || trilhaDe(x.aplicacao.trilhaId)?.nome || "—"}</td>
                  <td className="tnum peq">{periodo(x.aplicacao.data, x.aplicacao.dataFim)}</td>
                  <td className="tnum peq">{dataCurta(x.prevista)}</td>
                  <td><Chip tom={tom}>{rot}</Chip></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className={x.avaliacao ? "btn claro mini" : "btn mini"} onClick={() => setAvaliando(x)}>{x.avaliacao ? "Editar" : "Avaliar"}</button>{" "}
                    {x.avaliacao && <button type="button" className="btn claro mini" onClick={() => setDoc({ tipo: "AVET", x })}>AVET</button>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>

      <Card semPad>
        <div className="card-cab"><h2>Requisições (REQT)</h2><span className="suave peq">planejamento e aprovação antes do treinamento</span></div>
        {reqs.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma requisição ainda. Use “Nova requisição” para planejar um treinamento e imprimir para a aprovação do gerente.</div> : (
          <div className="tabela-caixa tabela-comissao"><table>
            <thead><tr><th>Treinamento</th><th>Tipo</th><th>Participantes</th><th>Previsto para</th><th>Situação</th><th /></tr></thead>
            <tbody>{reqs.map((r) => (
              <tr key={r.id}>
                <td><b>{r.titulo}</b><div className="suave peq">pedida em {dataCurta(r.data)} · {r.responsavel || "—"}</div></td>
                <td className="peq">{nomeTipo(r.tipoTreinamento) || "—"}</td>
                <td className="peq">{(r.pessoas || []).map((p) => nomeProprio(p.nome)).join(", ") || "—"}</td>
                <td className="tnum peq">{periodo(r.inicio, r.fim)}</td>
                <td>{r.status === "realizada" ? <Chip tom="ok">Realizada</Chip> : r.aprovadoEm ? <Chip tom="marca">Aprovada</Chip> : <Chip tom="alerta">Aguardando aprovação</Chip>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="btn claro mini" onClick={() => setDoc({ tipo: "REQT", req: r })}>REQT</button>{" "}
                  <button type="button" className="btn claro mini" onClick={() => setEditando(r)}>Editar</button>{" "}
                  {r.status !== "realizada" && <button type="button" className="btn mini" onClick={() => setAplicando(r)}>Registrar aplicação</button>}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Card semPad>
        <div className="card-cab"><h2>Registros de treinamento (RT)</h2>
          <span className="suave peq" style={{ display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>tarefas para
            <select className="entrada" style={{ minHeight: 30, maxWidth: 200, padding: "2px 8px" }} value={respTarefa || contas.eu} onChange={(e) => setRespTarefa(e.target.value)} aria-label="Responsável das tarefas">
              {!contas.usuarios.length && <option value="">(eu)</option>}
              {contas.usuarios.map((u) => <option key={u.usuario} value={u.usuario}>{u.nome}</option>)}
            </select>
          </span>
        </div>
        {msgTarefa && <div className="aviso marca peq" style={{ margin: "0 20px 10px" }}>{msgTarefa}</div>}
        {aplicacoes.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhum treinamento registrado ainda.</div> : (
          <>
            <div className="tabela-caixa tabela-comissao"><table>
              <thead><tr><th>Data</th><th>Treinamento</th><th>Instrutor</th><th>Participantes</th><th>Tarefa da eficácia</th><th /></tr></thead>
              <tbody>{aplicacoes.slice(0, verRegistros).map((a) => (
                <tr key={a.id}>
                  <td className="tnum peq">{periodo(a.data, a.dataFim)}</td>
                  <td><b>{a.titulo || trilhaDe(a.trilhaId)?.nome || "—"}</b>{a.tipoTreinamento && <div className="suave peq">{nomeTipo(a.tipoTreinamento)}</div>}</td>
                  <td className="peq">{a.instrutor || "—"}</td>
                  <td className="peq">{(a.participantes || []).filter((p) => p.presente !== false).length}</td>
                  <td>{a.tarefaEficacia?.id ? <Chip tom="ok">criada{nomeConta(a.tarefaEficacia.responsavel) ? ` · ${nomeConta(a.tarefaEficacia.responsavel)}` : ""}</Chip> : todosAvaliados2(a) ? <span className="suave peq">avaliado</span> : <button type="button" className="btn claro mini" disabled={criando === a.id} onClick={() => criarTarefa(a)}>{criando === a.id ? "Criando…" : "Criar tarefa"}</button>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn claro mini" onClick={() => setDoc({ tipo: "RT", reg: a })}>RT</button>{" "}
                    <button type="button" className="btn claro mini" onClick={() => setDoc({ tipo: "dadosRT", reg: a })}>Completar dados</button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
            {aplicacoes.length > verRegistros && <div style={{ padding: "8px 20px 14px" }}><button type="button" className="btn claro mini" onClick={() => setVerRegistros((n) => n + 20)}>Ver mais</button></div>}
          </>
        )}
      </Card>

      <div className="suave peq">Revisões em vigor: REQT {FORMULARIOS.REQT.rev} · RT {FORMULARIOS.RT.rev} · AVET {FORMULARIOS.AVET.rev} (emissão {FORMULARIOS.RT.emissao}). Documento de origem: PT 001.</div>

      {editando && <EditarRequisicao inicial={editando} trilhas={cat.ativos} aoFechar={() => setEditando(null)} aoSalvo={(r) => { setEditando(null); setDoc({ tipo: "REQT", req: r }); }} />}
      {aplicando && (
        <Modal titulo={`Registrar aplicação · ${aplicando.titulo}`} aoFechar={() => setAplicando(null)} largo>
          <Registro trilha={trilhaDe(aplicando.trilhaRef) || { id: "", nome: aplicando.titulo, objetivo: aplicando.objetivo || "" }} requisicao={aplicando}
            aoSalvar={async (salvo) => { await gravar("treinamentos", { ...aplicando, status: "realizada", aplicacaoId: salvo.id }); }} />
        </Modal>
      )}
      {avaliando && <AvaliarEficacia linha={avaliando} aoFechar={() => setAvaliando(null)} aoSalvo={(x) => { setAvaliando(null); setDoc({ tipo: "AVET", x }); }} />}
      {doc?.tipo === "REQT" && <JanelaDocumento titulo="REQT · Requisição de treinamento" aoFechar={() => setDoc(null)}><DocREQT req={doc.req} /></JanelaDocumento>}
      {doc?.tipo === "RT" && <JanelaDocumento titulo="RT · Registro de treinamento" aoFechar={() => setDoc(null)}><DocRT reg={doc.reg} trilha={trilhaDe(doc.reg.trilhaId)} /></JanelaDocumento>}
      {doc?.tipo === "AVET" && <JanelaDocumento titulo={`AVET · ${nomeProprio(doc.x.participante.nome)}`} aoFechar={() => setDoc(null)}><DocAVET reg={doc.x.aplicacao} participante={doc.x.participante} av={doc.x.avaliacao || {}} trilha={trilhaDe(doc.x.aplicacao.trilhaId)} /></JanelaDocumento>}
      {doc?.tipo === "dadosRT" && <DadosRT reg={doc.reg} trilha={trilhaDe(doc.reg.trilhaId)} aoFechar={() => setDoc(null)} aoSalvo={(r) => setDoc({ tipo: "RT", reg: r })} />}
    </>
  );
}

// ---------------------------------------------------------------- REQT
function EditarRequisicao({ inicial, trilhas, aoFechar, aoSalvo }) {
  const { gravar, equipeAtual: equipe, elenco, funcaoDe, nomeSetor } = useBase();
  const pessoas = pessoasParaTreinamento(equipe, elenco);
  const funcaoInicial = (id) => funcaoDe(equipe.find((x) => x.id === id || (x.rhPessoaId && x.rhPessoaId === id)))?.nome || "";
  const [f, setF] = useState(() => ({
    area: "Qualidade", responsavel: "", data: hojeBR(), tipoTreinamento: "", trilhaRef: "", titulo: "", pessoas: [], expectativa: "", nivelAplicacao: "",
    situacao: "", cargaHoraria: "", inicio: "", fim: "", instrutor: "", local: "MinasLab", eficaciaPrevista: "", aprovador: "", aprovadoEm: "", objetivo: "",
    ...inicial,
  }));
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const muda = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const escolherTrilha = (id) => {
    const t = trilhas.find((x) => x.id === id);
    setF((x) => ({ ...x, trilhaRef: id, titulo: t ? t.nome : x.titulo, objetivo: t?.objetivo || x.objetivo, cargaHoraria: x.cargaHoraria || (t?.minutos ? String(Math.round((t.minutos / 60) * 100) / 100).replace(".", ",") : "") }));
  };
  const marcado = (id) => f.pessoas.some((p) => p.pessoaId === id);
  const alternar = (p) => setF((x) => ({ ...x, pessoas: marcado(p.id) ? x.pessoas.filter((y) => y.pessoaId !== p.id) : [...x.pessoas, { pessoaId: p.id, rhPessoaId: p.rhPessoaId || "", nome: p.nome, funcao: funcaoInicial(p.id) }] }));
  const mudaFuncao = (id, funcao) => setF((x) => ({ ...x, pessoas: x.pessoas.map((p) => (p.pessoaId === id ? { ...p, funcao } : p)) }));
  const eficacia = f.eficaciaPrevista || (f.inicio ? somarDias(f.fim || f.inicio, DIAS_EFICACIA) : "");
  const visiveis = pessoas.filter((p) => !busca || norm(p.nome).includes(norm(busca))).slice(0, 60);
  const salvar = async () => {
    if (!String(f.titulo).trim()) return setErro("Informe o treinamento.");
    if (!f.pessoas.length) return setErro("Escolha ao menos um participante.");
    if (!f.inicio) return setErro("Informe a data prevista do treinamento.");
    if (f.fim && f.fim < f.inicio) return setErro("A data final é antes da inicial.");
    if (f.aprovadoEm && f.aprovadoEm > f.inicio) return setErro("A aprovação deve ser antes (ou no máximo no dia) do treinamento.");
    setSalvando(true); setErro("");
    try {
      const r = await gravar("treinamentos", { ...f, tipo: "requisicao", titulo: String(f.titulo).trim(), eficaciaPrevista: eficacia, status: f.status || "aberta" });
      aoSalvo(r);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  const Escolha = ({ valor, aoMudar, rotulos }) => (
    <div className="pilulas">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={`pilula${Number(valor) === n ? " ativa" : ""}`} title={rotulos?.[n - 1]} onClick={() => aoMudar(n)}>{n}</button>)}</div>
  );
  return (
    <Modal titulo={inicial.id ? "Editar requisição de treinamento" : "Nova requisição de treinamento (REQT)"} aoFechar={aoFechar} largo>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <div className="campo"><label htmlFor="rq-area">Área</label><input id="rq-area" className="entrada" value={f.area} onChange={(e) => muda("area", e.target.value)} placeholder={nomeSetor} /></div>
          <div className="campo"><label htmlFor="rq-resp">Responsável</label><input id="rq-resp" className="entrada" value={f.responsavel} onChange={(e) => muda("responsavel", e.target.value)} /></div>
          <div className="campo"><label htmlFor="rq-data">Data da requisição</label><input id="rq-data" type="date" className="entrada" value={f.data} onChange={(e) => muda("data", e.target.value)} /></div>
          <div className="campo"><label htmlFor="rq-tipo">Tipo</label><select id="rq-tipo" className="entrada" value={f.tipoTreinamento} onChange={(e) => muda("tipoTreinamento", e.target.value)}><option value="">Escolha…</option>{TIPOS_TREINAMENTO.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
        </div>
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <div className="campo"><label htmlFor="rq-trilha">Treinamento do catálogo</label><select id="rq-trilha" className="entrada" value={f.trilhaRef} onChange={(e) => escolherTrilha(e.target.value)}><option value="">Outro (digitar o nome)</option>{trilhas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
          <div className="campo"><label htmlFor="rq-tit">Título do treinamento</label><input id="rq-tit" className="entrada" value={f.titulo} onChange={(e) => muda("titulo", e.target.value)} placeholder="Ex.: ISO/IEC 17025 – Interpretação e aplicação dos requisitos" /></div>
        </div>

        <div className="campo">
          <span className="rotulo">Participantes e função ({f.pessoas.length})</span>
          {f.pessoas.length > 0 && <div style={{ display: "grid", gap: 6 }}>{f.pessoas.map((p) => (
            <div key={p.pessoaId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ minWidth: 200 }}>{nomeProprio(p.nome)}</b>
              <input className="entrada" style={{ flex: "1 1 200px" }} aria-label={`Função de ${p.nome}`} value={p.funcao} onChange={(e) => mudaFuncao(p.pessoaId, e.target.value)} placeholder="Função" />
              <button type="button" className="btn claro mini" onClick={() => alternar({ id: p.pessoaId })}>Tirar</button>
            </div>
          ))}</div>}
          <input className="entrada" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar colaborador para incluir" aria-label="Buscar colaborador" />
          <div className="pilulas" style={{ maxHeight: 130, overflow: "auto" }}>{visiveis.filter((p) => !marcado(p.id)).map((p) => <button key={p.id} type="button" className="pilula" onClick={() => alternar(p)}>+ {nomeProprio(p.nome)}</button>)}</div>
        </div>

        <div className="campo">
          <span className="rotulo">I) Expectativa de conhecimento ao final (escolha uma)</span>
          {EXPECTATIVAS.map((t, i) => <label key={i} className="peq" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="radio" name="rq-exp" checked={Number(f.expectativa) === i + 1} onChange={() => muda("expectativa", i + 1)} /> <span><b>{i + 1}.</b> {t}</span></label>)}
        </div>
        <div className="campo"><span className="rotulo">II) Nível de aplicação nas atividades rotineiras (1 = pouco frequente, 5 = muito frequente)</span><Escolha valor={f.nivelAplicacao} aoMudar={(n) => muda("nivelAplicacao", n)} /></div>
        <div className="campo"><label htmlFor="rq-sit">Situação atual que originou a necessidade</label><textarea id="rq-sit" className="entrada" rows={2} value={f.situacao} onChange={(e) => muda("situacao", e.target.value)} placeholder="Ex.: mudança de função para supervisora de qualidade." /></div>

        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div className="campo"><label htmlFor="rq-ini">Data prevista (início)</label><input id="rq-ini" type="date" className="entrada" value={f.inicio} onChange={(e) => muda("inicio", e.target.value)} /></div>
          <div className="campo"><label htmlFor="rq-fim">Até (opcional)</label><input id="rq-fim" type="date" className="entrada" value={f.fim} onChange={(e) => muda("fim", e.target.value)} /></div>
          <div className="campo"><label htmlFor="rq-carga">Carga horária (horas)</label><input id="rq-carga" className="entrada" inputMode="decimal" value={f.cargaHoraria} onChange={(e) => muda("cargaHoraria", e.target.value)} /></div>
          <div className="campo"><label htmlFor="rq-inst">Instrutor</label><input id="rq-inst" className="entrada" value={f.instrutor} onChange={(e) => muda("instrutor", e.target.value)} /></div>
          <div className="campo"><label htmlFor="rq-local">Local</label><input id="rq-local" className="entrada" value={f.local} onChange={(e) => muda("local", e.target.value)} /></div>
          <div className="campo"><label htmlFor="rq-efic">Avaliação da eficácia em</label><input id="rq-efic" type="date" className="entrada" value={eficacia} onChange={(e) => muda("eficaciaPrevista", e.target.value)} /></div>
        </div>
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div className="campo"><label htmlFor="rq-aprov">Aprovado por (gerente)</label><input id="rq-aprov" className="entrada" value={f.aprovador} onChange={(e) => muda("aprovador", e.target.value)} placeholder="Em branco: assina no papel" /></div>
          <div className="campo"><label htmlFor="rq-aprovdata">Data da aprovação</label><input id="rq-aprovdata" type="date" className="entrada" value={f.aprovadoEm} onChange={(e) => muda("aprovadoEm", e.target.value)} /></div>
        </div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar e ver a REQT"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- AVET
function AvaliarEficacia({ linha, aoFechar, aoSalvo }) {
  const { gravar } = useBase();
  const a = linha.aplicacao, p = linha.participante;
  const [av, setAv] = useState(() => ({ data: hojeBR(), avaliador: "", funcaoAvaliador: "Gerente", funcao: p.funcao || "", i: "", ii: "", iii: "", iv: "", melhorias: "", como: [], evidencia: "", aprovador: "", aprovadoEm: "", plano: { causa: "", acoes: [{ acao: "", responsavel: "", data: "" }], verificacao: "", verificacaoResponsavel: "", verificacaoData: "", novaAvaliacaoEm: "", aprovador: "", aprovadoEm: "" }, ...(linha.avaliacao || {}) }));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const muda = (k, v) => setAv((x) => ({ ...x, [k]: v }));
  const mudaPlano = (k, v) => setAv((x) => ({ ...x, plano: { ...x.plano, [k]: v } }));
  const res = resultadoEficacia(av);
  const salvar = async () => {
    if (!res) return setErro("Responda I, II, III e IV.");
    if (!av.avaliador.trim()) return setErro("Informe quem avaliou.");
    if (!av.como.length) return setErro("Marque como foi avaliado.");
    setSalvando(true); setErro("");
    try {
      const limpo = res === "nao-eficaz" ? av : { ...av, plano: undefined };
      const salvo = await gravar("treinamentos", { ...a, eficacia: { ...(a.eficacia || {}), [p.pessoaId]: limpo } });
      await concluirSeTodosAvaliados(salvo);
      aoSalvo({ ...linha, aplicacao: salvo, avaliacao: limpo, resultado: res });
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  const Escolha = ({ k, rotulos }) => (
    <div style={{ display: "grid", gap: 4 }}>{rotulos.map((t, i) => <label key={i} className="peq" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="radio" name={`av-${k}`} checked={Number(av[k]) === i + 1} onChange={() => muda(k, i + 1)} /> <span><b>{i + 1}.</b> {t}</span></label>)}</div>
  );
  return (
    <Modal titulo={`Avaliação da eficácia · ${nomeProprio(p.nome)}`} aoFechar={aoFechar} largo>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="aviso marca peq"><b>{a.titulo}</b> · realizado em {periodo(a.data, a.dataFim)}{a.instrutor ? ` · instrutor ${a.instrutor}` : ""}</div>
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <div className="campo"><label htmlFor="av-data">Data da avaliação</label><input id="av-data" type="date" className="entrada" value={av.data} onChange={(e) => muda("data", e.target.value)} /></div>
          <div className="campo"><label htmlFor="av-func">Função do participante</label><input id="av-func" className="entrada" value={av.funcao} onChange={(e) => muda("funcao", e.target.value)} /></div>
          <div className="campo"><label htmlFor="av-avaliador">Quem avaliou</label><input id="av-avaliador" className="entrada" value={av.avaliador} onChange={(e) => muda("avaliador", e.target.value)} /></div>
          <div className="campo"><label htmlFor="av-funcav">Função de quem avaliou</label><input id="av-funcav" className="entrada" value={av.funcaoAvaliador} onChange={(e) => muda("funcaoAvaliador", e.target.value)} /></div>
        </div>
        {AVET_QUESTOES.map((q) => <div key={q.id} className="campo"><span className="rotulo">{q.titulo}</span><Escolha k={q.id} rotulos={q.opcoes} /></div>)}
        <div className="campo"><label htmlFor="av-melh">Melhorias obtidas</label><textarea id="av-melh" className="entrada" rows={2} value={av.melhorias} onChange={(e) => muda("melhorias", e.target.value)} /></div>
        <div className="campo">
          <span className="rotulo">Como foi avaliado</span>
          <div className="pilulas">{COMO_AVALIADO.map(([id, n]) => { const on = av.como.includes(id); return <button key={id} type="button" className={`pilula${on ? " ativa" : ""}`} aria-pressed={on} onClick={() => muda("como", on ? av.como.filter((x) => x !== id) : [...av.como, id])}>{n}</button>; })}</div>
          <input className="entrada" value={av.evidencia} onChange={(e) => muda("evidencia", e.target.value)} placeholder="Evidência (ex.: conferência dos registros de outubro, sem desvios)" aria-label="Evidência" />
        </div>
        <div className="campo"><span className="rotulo">IV) De forma geral, a eficácia do treinamento (1 = pouco eficaz, 5 = muito eficaz)</span>
          <div className="pilulas">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={`pilula${Number(av.iv) === n ? " ativa" : ""}`} onClick={() => muda("iv", n)}>{n}</button>)}</div>
        </div>
        {res && <div className={`aviso ${res === "eficaz" ? "marca" : "alerta"}`}>Resultado: <b>{res === "eficaz" ? "Eficaz" : "Não eficaz"}</b>. Critério: IV com 4 ou 5 e nenhuma resposta de I a III abaixo de 3.</div>}
        {res === "nao-eficaz" && (
          <Card>
            <h3>Plano de ação para não eficácia</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              <div className="campo"><label htmlFor="pl-causa">Descrição e causa da não eficácia</label><textarea id="pl-causa" className="entrada" rows={2} value={av.plano.causa} onChange={(e) => mudaPlano("causa", e.target.value)} /></div>
              {av.plano.acoes.map((x, i) => (
                <div key={i} className="grade" style={{ gridTemplateColumns: "2fr 1fr 150px auto", gap: 8, alignItems: "end" }}>
                  <div className="campo"><label>Ação</label><input className="entrada" value={x.acao} onChange={(e) => mudaPlano("acoes", av.plano.acoes.map((y, k) => (k === i ? { ...y, acao: e.target.value } : y)))} /></div>
                  <div className="campo"><label>Responsável</label><input className="entrada" value={x.responsavel} onChange={(e) => mudaPlano("acoes", av.plano.acoes.map((y, k) => (k === i ? { ...y, responsavel: e.target.value } : y)))} /></div>
                  <div className="campo"><label>Data</label><input type="date" className="entrada" value={x.data} onChange={(e) => mudaPlano("acoes", av.plano.acoes.map((y, k) => (k === i ? { ...y, data: e.target.value } : y)))} /></div>
                  {av.plano.acoes.length > 1 ? <button type="button" className="btn perigo mini" onClick={() => mudaPlano("acoes", av.plano.acoes.filter((_, k) => k !== i))}>Tirar</button> : <span />}
                </div>
              ))}
              <div><button type="button" className="btn claro mini" onClick={() => mudaPlano("acoes", [...av.plano.acoes, { acao: "", responsavel: "", data: "" }])}>+ Ação</button></div>
              <div className="grade" style={{ gridTemplateColumns: "2fr 1fr 150px", gap: 8 }}>
                <div className="campo"><label>Verificação da eficácia da ação</label><input className="entrada" value={av.plano.verificacao} onChange={(e) => mudaPlano("verificacao", e.target.value)} /></div>
                <div className="campo"><label>Responsável</label><input className="entrada" value={av.plano.verificacaoResponsavel} onChange={(e) => mudaPlano("verificacaoResponsavel", e.target.value)} /></div>
                <div className="campo"><label>Data</label><input type="date" className="entrada" value={av.plano.verificacaoData} onChange={(e) => mudaPlano("verificacaoData", e.target.value)} /></div>
              </div>
              <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
                <div className="campo"><label>Nova avaliação em</label><input type="date" className="entrada" value={av.plano.novaAvaliacaoEm} onChange={(e) => mudaPlano("novaAvaliacaoEm", e.target.value)} /></div>
                <div className="campo"><label>Nova avaliação aprovada por</label><input className="entrada" value={av.plano.aprovador} onChange={(e) => mudaPlano("aprovador", e.target.value)} /></div>
                <div className="campo"><label>Data da aprovação</label><input type="date" className="entrada" value={av.plano.aprovadoEm} onChange={(e) => mudaPlano("aprovadoEm", e.target.value)} /></div>
              </div>
            </div>
          </Card>
        )}
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div className="campo"><label htmlFor="av-aprov">Aprovado por (gerente)</label><input id="av-aprov" className="entrada" value={av.aprovador} onChange={(e) => muda("aprovador", e.target.value)} placeholder="Em branco: assina no papel" /></div>
          <div className="campo"><label htmlFor="av-aprovdata">Data da aprovação</label><input id="av-aprovdata" type="date" className="entrada" value={av.aprovadoEm} onChange={(e) => muda("aprovadoEm", e.target.value)} /></div>
        </div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar e ver a AVET"}</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- completar RT (registros antigos)
function DadosRT({ reg, trilha, aoFechar, aoSalvo }) {
  const { gravar } = useBase();
  const [f, setF] = useState({
    dataFim: reg.dataFim || "", cargaHoraria: reg.cargaHoraria || (trilha?.minutos ? String(Math.round((trilha.minutos / 60) * 100) / 100).replace(".", ",") : ""),
    local: reg.local || "MinasLab", tipoTreinamento: reg.tipoTreinamento || "", objetivo: reg.objetivo ?? trilha?.objetivo ?? "", material: reg.material ?? trilha?.documento ?? "",
    eficaciaPrevista: reg.eficaciaPrevista || somarDias(reg.dataFim || reg.data, DIAS_EFICACIA), instrutor: reg.instrutor || "", obs: reg.obs || "",
    participantes: (reg.participantes || []).map((p) => ({ ...p })),
  });
  const [erro, setErro] = useState("");
  const muda = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const salvar = async () => {
    try { const r = await gravar("treinamentos", { ...reg, ...f }); aoSalvo(r); } catch (e) { setErro(e.message); }
  };
  return (
    <Modal titulo={`Dados do RT · ${reg.titulo || trilha?.nome || ""}`} aoFechar={aoFechar} largo>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <div className="campo"><label>Data</label><input className="entrada" value={dataCurta(reg.data)} disabled /></div>
          <div className="campo"><label htmlFor="d-fim">Até</label><input id="d-fim" type="date" className="entrada" value={f.dataFim} onChange={(e) => muda("dataFim", e.target.value)} /></div>
          <div className="campo"><label htmlFor="d-inst">Instrutor</label><input id="d-inst" className="entrada" value={f.instrutor} onChange={(e) => muda("instrutor", e.target.value)} /></div>
          <div className="campo"><label htmlFor="d-carga">Carga horária (horas)</label><input id="d-carga" className="entrada" value={f.cargaHoraria} onChange={(e) => muda("cargaHoraria", e.target.value)} /></div>
          <div className="campo"><label htmlFor="d-local">Local</label><input id="d-local" className="entrada" value={f.local} onChange={(e) => muda("local", e.target.value)} /></div>
          <div className="campo"><label htmlFor="d-tipo">Tipo</label><select id="d-tipo" className="entrada" value={f.tipoTreinamento} onChange={(e) => muda("tipoTreinamento", e.target.value)}><option value="">Escolha…</option>{TIPOS_TREINAMENTO.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
          <div className="campo"><label htmlFor="d-mat">Material / procedimento</label><input id="d-mat" className="entrada" value={f.material} onChange={(e) => muda("material", e.target.value)} /></div>
          <div className="campo"><label htmlFor="d-efic">Avaliação da eficácia em</label><input id="d-efic" type="date" className="entrada" value={f.eficaciaPrevista} onChange={(e) => muda("eficaciaPrevista", e.target.value)} /></div>
        </div>
        <div className="campo"><label htmlFor="d-obj">Objetivo</label><textarea id="d-obj" className="entrada" rows={2} value={f.objetivo} onChange={(e) => muda("objetivo", e.target.value)} /></div>
        <div className="campo"><span className="rotulo">Função de cada participante</span>
          {f.participantes.filter((p) => p.presente !== false).map((p) => (
            <div key={p.pessoaId} style={{ display: "flex", gap: 8, alignItems: "center" }}><b style={{ minWidth: 200 }}>{nomeProprio(p.nome)}</b><input className="entrada" aria-label={`Função de ${p.nome}`} value={p.funcao || ""} onChange={(e) => muda("participantes", f.participantes.map((y) => (y.pessoaId === p.pessoaId ? { ...y, funcao: e.target.value } : y)))} /></div>
          ))}
        </div>
        <div className="campo"><label htmlFor="d-obs">Observações</label><textarea id="d-obs" className="entrada" rows={2} value={f.obs} onChange={(e) => muda("obs", e.target.value)} /></div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button><button type="button" className="btn" onClick={salvar}>Salvar e ver o RT</button></div>
      </div>
    </Modal>
  );
}
