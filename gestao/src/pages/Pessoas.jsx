import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Cabecalho, Pontos, GraficoMeses, iniciais, Chip, Abas, Paginacao, usePaginacao } from "../components/ui.jsx";
import { SeletorMes } from "../components/Layout.jsx";
import { navegar } from "../lib/rota.js";
import { pct, mesLongo, mesNome, mesCurto, dataCurta, hojeBR, brl } from "../lib/format.js";
import { realizado, metasDe, mediaAnterior, pontos, roteiroFeedback, serie } from "../lib/calculos.js";
import { treinamentosDaPessoa, fmtNota, aprovado } from "../lib/treinamentosPessoa.js";
import { catalogo, trilhaEmQualquerLugar } from "../lib/catalogo.js";
import { BotaoCertificado } from "../components/CertificadoTreinamento.jsx";
import { matrizReciclagem } from "../lib/reciclagem.js";
import { Desenvolvimento } from "../components/Desenvolvimento.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { MetasFuncao } from "./Funcoes.jsx";

export function SeletorPessoa({ atual, tela }) {
  const { equipe } = useBase();
  return (
    <div className="pilulas" role="group" aria-label="Pessoa">
      {equipe.map((m) => (
        <button key={m.id} type="button" className={`pilula${m.id === atual ? " ativa" : ""}`} aria-pressed={m.id === atual} onClick={() => navegar(tela, m.id)}>
          {m.nome}
        </button>
      ))}
    </div>
  );
}

export default function Pessoas({ param }) {
  const { equipe, resumo, mes, ocorrenciasDe, dados, gravar, remover, funcaoDe, setor } = useBase();
  const membro = equipe.find((m) => m.id === param) || equipe[0];
  const [texto, setTexto] = useState("");
  const [comb, setComb] = useState("");
  const [prazo, setPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("resultado");
  const fbs = membro ? dados.feedbacks.filter((f) => f.pessoaId === membro.id).sort((a, b) => String(b.data).localeCompare(String(a.data))) : [];
  const pagFb = usePaginacao(fbs, 5, membro?.id);
  const treinos = treinamentosDaPessoa(dados.treinamentos, membro);
  const cat = catalogo(dados.treinamentos, setor);
  const recic = matrizReciclagem({ trilhas: cat.ativos.filter((t) => t.obrigatorio), registros: dados.treinamentos, pessoas: membro ? [membro] : [], hoje: hojeBR() });

  if (!membro) {
    return (
      <>
        <Cabecalho sobre="Pessoas e feedback" titulo="Ninguém na equipe ainda" />
        <Card><button type="button" className="btn" onClick={() => navegar("equipe")}>Montar a equipe e as metas</button></Card>
      </>
    );
  }

  const metas = metasDe(membro);
  const r = realizado(resumo, membro, mes);
  const avg = mediaAnterior(resumo, membro, mes);
  const nOc = ocorrenciasDe(membro.id).length;
  const lista = pontos(resumo, membro, mes, nOc);
  const rot = roteiroFeedback(lista, membro);
  const ultimo = fbs[0];

  const salvarFb = async () => {
    if (!texto.trim()) { setErro("Escreva o resumo da conversa."); return; }
    setSalvando(true);
    setErro("");
    try {
      await gravar("feedbacks", { pessoaId: membro.id, mes, data: hojeBR(), texto: texto.trim(), combinados: comb.trim(), prazo });
      setTexto(""); setComb(""); setPrazo("");
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Cabecalho sobre="Pessoas e feedback" titulo={mesLongo(mes)}>
        <SeletorMes />
      </Cabecalho>
      <Orientacao tela="pessoas" />
      <SeletorPessoa atual={membro.id} tela="pessoas" />

      <Card style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span className="avatar grande">{iniciais(membro.nome)}</span>
          <div><h2 style={{ fontSize: 22 }}>{membro.nome}</h2><div className="suave peq">{funcaoDe(membro)?.nome || membro.funcao || "Sem função"}</div></div>
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <Mini rot="Propostas" val={metas.propostas ? `${r.enviadas} / ${metas.propostas}` : r.enviadas} sub={avg != null ? `média anterior ${Math.round(avg)}` : "sem histórico"} />
          <Mini rot="Aprovação" val={pct(r.taxa)} sub={metas.aprovacao ? `meta ${metas.aprovacao}%` : "sem meta"} />
          <Mini rot="Valor aprovado" val={brl(r.valorAprovado, true)} sub="pelo mês do aceite" />
          <Mini rot="Ocorrências" val={nOc} sub="no mês" />
        </div>
      </Card>

      <Abas valor={aba} aoMudar={setAba} abas={[["resultado", "Resultado do mês", lista.length || ""], ["feedback", "Feedback 1:1"], ["historico", "Histórico de conversas", fbs.length], ["treinamentos", "Treinamentos", treinos.length || ""], ["desenvolvimento", "Desenvolvimento e PDI"]]} />

      {aba === "resultado" && <div className="grade grade-2">
        <Card>
          <h3>Pontos a melhorar e destaques</h3>
          <div style={{ marginTop: 6 }}><Pontos lista={lista} /></div>
          {funcaoDe(membro) && <div style={{ marginTop: 14 }}><MetasFuncao f={funcaoDe(membro)} titulo={`Metas de ${funcaoDe(membro).nome} (conferir no mês)`} /></div>}
        </Card>
        {setor === "comercial" && <Card>
          <h3>Evolução de propostas</h3>
          <div className="suave peq" style={{ marginTop: 4 }}>{metas.propostas ? `Linha tracejada: meta de ${metas.propostas} por mês` : "Sem meta definida"}</div>
          <GraficoMeses serie={serie(resumo, membro, mes, 9)} mesDestaque={mes} meta={metas.propostas} rotuloMes={mesCurto} />
        </Card>}
      </div>}

      {aba === "feedback" && <div className="grade grade-2">
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
            <h3>Roteiro do feedback de {mesNome(mes)}</h3>
            <Chip tom="marca">montado pelos números</Chip>
          </div>
          {ultimo?.combinados && (
            <div className="aviso marca" style={{ marginTop: 14 }}>
              <b>Comece pelos combinados da última conversa ({dataCurta(ultimo.data)}):</b> {ultimo.combinados}{ultimo.prazo ? ` · prazo ${dataCurta(ultimo.prazo)}` : ""}
            </div>
          )}
          <Roteiro titulo="1. O que foi bem" cor="var(--ok)" itens={rot.bom} />
          <Roteiro titulo="2. Pontos a melhorar, com o número" cor="var(--alerta)" itens={rot.melhorar} />
          <Roteiro titulo="3. Pergunte" cor="var(--tinta)" itens={["O que está atrapalhando?", "O que você precisa de mim para chegar na meta?"]} />
          <Roteiro titulo="4. Combinados sugeridos" cor="var(--tinta)" itens={rot.combinar} />
        </Card>

        <Card>
          <h3>Registrar a conversa</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <div className="campo">
              <label htmlFor="fb-texto">O que foi conversado</label>
              <textarea id="fb-texto" className="entrada" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Resumo da conversa, com os fatos" />
            </div>
            <div className="campo">
              <label htmlFor="fb-comb">Combinados</label>
              <input id="fb-comb" className="entrada" value={comb} onChange={(e) => setComb(e.target.value)} placeholder={rot.combinar[0]} />
            </div>
            <div className="campo" style={{ maxWidth: 200 }}>
              <label htmlFor="fb-prazo">Prazo</label>
              <input id="fb-prazo" type="date" className="entrada" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            {erro && <div className="aviso ruim">{erro}</div>}
            <div><button type="button" className="btn" disabled={salvando} onClick={salvarFb}>{salvando ? "Salvando…" : "Salvar feedback"}</button></div>
          </div>
          {fbs.length > 0 && <button type="button" className="btn claro mini" style={{ marginTop: 16 }} onClick={() => setAba("historico")}>Ver as {fbs.length} conversas anteriores</button>}
        </Card>
      </div>}

      {aba === "historico" && <Card>
          <h3>Conversas com {membro.nome}</h3>
          {fbs.length === 0 ? (
            <div className="vazio peq">Nenhuma conversa registrada ainda.</div>
          ) : pagFb.itens.map((f) => (
            <div key={f.id} style={{ borderTop: "1px solid var(--linha-fraca)", paddingTop: 10, marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span className="suave peq">{dataCurta(f.data)}</span>
                <button type="button" className="btn perigo mini" onClick={() => window.confirm("Apagar este registro de feedback?") && remover("feedbacks", f.id)}>Apagar</button>
              </div>
              <div style={{ marginTop: 2 }}>{f.texto}</div>
              {f.combinados && <div className="peq" style={{ marginTop: 4, color: "var(--tinta)" }}><b>Combinado:</b> {f.combinados}{f.prazo ? ` · até ${dataCurta(f.prazo)}` : ""}</div>}
            </div>
          ))}
          <Paginacao pag={pagFb} rotulo="conversas" />
        </Card>}
      {aba === "treinamentos" && recic.periodicas.length > 0 && <Card semPad>
          <div className="card-cab"><h3>Treinamentos obrigatórios do cargo</h3><span className="suave peq">pelo plano de treinamentos</span></div>
          <div className="tabela-caixa"><table>
            <thead><tr><th>Treinamento</th><th>Última vez</th><th>Próxima até</th><th>Situação</th><th>Agendado</th></tr></thead>
            <tbody>{recic.periodicas.filter((t) => recic.linhas[0].celulas[t.id].status !== "nao-se-aplica").map((t) => { const c = recic.linhas[0].celulas[t.id]; const tom = { "em-dia": "ok", vence: "alerta", vencido: "ruim", refazer: "ruim", nunca: "neutro", pendente: "alerta" }[c.status]; const rot = { "em-dia": "Em dia", vence: "Vence em breve", vencido: "Vencido", refazer: "Refazer (nota baixa)", nunca: "Nunca fez", pendente: "Novo: fazer" }[c.status]; const ag = recic.proxima[t.id]; return (
              <tr key={t.id}><td>{t.nome}</td><td className="tnum">{c.ultima ? dataCurta(c.ultima) : "—"}</td><td className="tnum">{c.vence ? dataCurta(c.vence) : "—"}</td><td><Chip tom={tom}>{rot}</Chip></td><td className="tnum">{ag ? dataCurta(ag.data) : "—"}</td></tr>
            ); })}</tbody>
          </table></div>
        </Card>}
      {aba === "treinamentos" && <Card semPad>
          <div className="card-cab"><h3>Treinamentos de {membro.nome}</h3><span className="suave peq">{treinos.length} registro(s)</span></div>
          {treinos.length === 0 ? <div className="vazio peq" style={{ padding: "0 20px 20px" }}>Nenhum treinamento registrado ainda. Registre em Treinamentos › Trilhas › Registrar aplicação.</div> : (
            <div className="tabela-caixa"><table>
              <thead><tr><th>Data</th><th>Treinamento</th><th>Nota do teste (0 a 10)</th><th>Observações</th><th>Certificado</th></tr></thead>
              <tbody>{treinos.map((t) => {
                const tr = trilhaEmQualquerLugar(cat, t.trilhaId);
                const nome = tr?.nome || t.titulo || "Treinamento";
                return (
                  <tr key={t.id}>
                    <td className="tnum">{dataCurta(t.data)}</td>
                    <td>{nome}</td>
                    <td className="tnum">{fmtNota(t.nota)}</td>
                    <td className="peq suave">{t.obs}</td>
                    <td>{aprovado({ presente: true, nota: t.nota }) ? <BotaoCertificado dados={{ nome: membro.nome, treinamento: nome, documento: tr?.documento, data: t.data, minutos: tr?.minutos, nota: t.nota, instrutor: t.instrutor }} /> : <Chip tom="alerta">Refazer</Chip>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </Card>}
      {aba === "desenvolvimento" && <Desenvolvimento membro={membro} />}
    </>
  );
}

function Mini({ rot, val, sub }) {
  return (
    <div>
      <div className="suave peq">{rot}</div>
      <div className="tnum" style={{ font: "600 22px Poppins, sans-serif" }}>{val}</div>
      <div className="suave peq">{sub}</div>
    </div>
  );
}

function Roteiro({ titulo, cor, itens }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 600, color: cor }}>{titulo}</div>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {itens.map((x, i) => <li key={i} className="peq" style={{ marginTop: 3 }}>{x}</li>)}
      </ul>
    </div>
  );
}
