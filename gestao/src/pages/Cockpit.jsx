// Cockpit do dia: vamos bater a meta? onde está o problema? o que fazer hoje?
import { useState } from "react";
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Kpi, Cabecalho, Paginacao, usePaginacao } from "../components/ui.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { cockpitCRM, carteiraCRM, npsCRM } from "../services/crm.js";
import { navegar } from "../lib/rota.js";
import { brl, pct, mesAtual, hojeBR, dataCurta, mesNome, somarMeses, novoId } from "../lib/format.js";
import { totaisMes, realizado, mediaAnterior, previsaoMes } from "../lib/calculos.js";

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default function Cockpit() {
  const { resumo, equipeAtual: equipe, config, dados, nomeCRM } = useBase();
  const ck = useCRM("cockpit", cockpitCRM);
  const cart = useCRM("carteira", carteiraCRM);
  const nps = useCRM("nps", npsCRM);
  const hoje = hojeBR();
  const mes = mesAtual();
  const t = totaisMes(resumo, mes);
  const [a, m, d] = hoje.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const fracao = d / diasNoMes;
  const meta = Number(config.metaValorMensal) || 0;

  // Previsão: só propostas abertas há até 60 dias entram no mês.
  const abertas = (ck.dados?.abertas || []).filter((x) => x.idade <= 60);
  const prev = ck.dados ? previsaoMes({ aprovado: t.valorAprovado, abertas }) : null;

  // ---------------- alertas
  const alertas = [];
  const add = (tom, titulo, texto, tela) => alertas.push({ tom, titulo, texto, tela });
  if (prev && meta && prev.base < meta * 0.9) add("ruim", `Meta em risco: previsão de ${brl(prev.base, true)} para meta de ${brl(meta, true)}`, "Mutirão de follow-up nas propostas abertas de maior valor.", "funil");
  const esfriando = (ck.dados?.abertas || []).filter((x) => x.idade > 7 && (!x.ultimaInteracao || (Date.parse(hoje) - Date.parse(x.ultimaInteracao)) / 864e5 > 7));
  if (esfriando.length) add("alerta", `${esfriando.length} propostas esfriando (${brl(esfriando.reduce((s, x) => s + x.valor, 0), true)})`, "Enviadas há mais de 7 dias sem interação registrada. Follow-up hoje.", "funil");
  if (t.semResponsavel) add(t.pctSemResponsavel > 5 ? "ruim" : "alerta", `${t.semResponsavel} propostas do mês sem responsável`, "Atribuir no CRM ainda hoje.", "dado");
  for (const p of equipe) {
    const avg = mediaAnterior(resumo, p, mes);
    const r = realizado(resumo, p, mes);
    if (avg != null && avg >= 5 && d >= 7 && r.enviadas < avg * fracao * 0.7) add("alerta", `${p.nome.split(" ")[0]}: ritmo abaixo do normal`, `${r.enviadas} propostas até hoje; no ritmo da média seriam ${Math.round(avg * fracao)}. Conversa rápida: carga, demanda ou bloqueio?`, "pessoas");
  }
  const riscoA = (cart.dados?.clientes || []).filter((c) => c.curva === "A" && c.emRisco);
  if (riscoA.length) add("alerta", `${riscoA.length} cliente(s) da curva A sem aprovar há mais que o normal`, riscoA.slice(0, 3).map((c) => c.cliente).join(", ") + (riscoA.length > 3 ? "…" : ""), "carteira");
  const venc = (cart.dados?.contratosVencendo || []).filter((c) => c.dataFim <= somarDias(hoje, 30));
  if (venc.length) add("alerta", `${venc.length} contrato(s) vencendo em até 30 dias`, "Proposta de renovação.", "carteira");
  if (cart.dados?.recorrencias?.atrasadas) add("alerta", `${cart.dados.recorrencias.atrasadas} recorrência(s) com coleta atrasada`, "Contato com o cliente para reagendar.", "carteira");
  const detratores = [...(nps.dados?.respostas || []), ...dados.nps].filter((n) => Number(n.nota) <= 6 && n.data >= somarDias(hoje, -30));
  if (detratores.length) add("ruim", `${detratores.length} cliente(s) insatisfeito(s) nos últimos 30 dias`, "Contato em até 48 horas.", "satisfacao");
  const combinadosVencidos = equipe.filter((p) => {
    const ult = dados.feedbacks.filter((f) => f.pessoaId === p.id).sort((x, y) => String(y.data).localeCompare(String(x.data)))[0];
    return ult?.prazo && ult.prazo < hoje;
  });
  if (combinadosVencidos.length) add("alerta", `Combinados de feedback vencidos: ${combinadosVencidos.map((p) => p.nome.split(" ")[0]).join(", ")}`, "Conferir na próxima conversa.", "pessoas");
  const semFb = equipe.filter((p) => !dados.feedbacks.some((f) => f.pessoaId === p.id && f.mes === mes));
  if (d >= 20 && semFb.length) add("neutro", `Sem conversa individual em ${mesNome(mes)}: ${semFb.map((p) => p.nome.split(" ")[0]).join(", ")}`, "Agende a 1:1 do mês.", "pessoas");
  const estrAtrasadas = dados.estrategias.filter((e) => e.prazo && e.status !== "feito" && e.prazo < hoje);
  if (estrAtrasadas.length) add("alerta", `${estrAtrasadas.length} ação(ões) do plano atrasada(s)`, estrAtrasadas.map((e) => e.titulo).slice(0, 2).join(" · "), "estrategias");
  const revisar = dados.decisoes.filter((x) => x.revisao && x.revisao <= hoje && !x.revisada);
  if (revisar.length) add("neutro", `${revisar.length} decisão(ões) com revisão marcada`, "Compare o que esperava com o que aconteceu.", "decisoes");

  // Onde agir: maior valor esperado (valor × chance).
  const ondeAgir = [...abertas].sort((x, y) => y.valor * y.chance - x.valor * x.chance).slice(0, 20);
  const pagAl = usePaginacao(alertas, 5);
  const pagAg = usePaginacao(ondeAgir, 5);
  const ritmo = Math.round(t.enviadas / Math.max(fracao, 0.01));
  const anterior = totaisMes(resumo, somarMeses(mes, -1));

  return (
    <>
      <Cabecalho sobre="Cockpit do dia" titulo={`${cap(DIAS_SEMANA[new Date(`${hoje}T12:00:00Z`).getUTCDay()])}, ${dataCurta(hoje)}`} sub={`Dia ${d} de ${diasNoMes} do mês · CRM lido às ${ck.dados ? new Date(ck.dados.geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "…"}`}>
        <button type="button" className="btn claro" onClick={() => { ck.recarregar(); cart.recarregar(); nps.recarregar(); }}>Atualizar</button>
      </Cabecalho>
      <Orientacao tela="cockpit" />
      {ck.erro && <div className="aviso ruim">{ck.erro}</div>}

      <Card style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }}>
        <div style={{ flex: "1 1 280px" }}>
          <div className="kpi-rot">Vamos bater a meta de {mesNome(mes)}?</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <span className="kpi-val" style={{ fontSize: 34 }}>{brl(t.valorAprovado, true)}</span>
            <span className="suave">aprovados até hoje</span>
          </div>
          {prev && meta ? (
            <div style={{ marginTop: 8 }}><Chip tom={prev.base >= meta ? "ok" : prev.otimista >= meta ? "alerta" : "ruim"}>{prev.base >= meta ? "No caminho da meta" : prev.otimista >= meta ? "Meta possível com esforço" : "Meta fora da faixa prevista"}</Chip></div>
          ) : !meta ? (
            <div className="peq suave" style={{ marginTop: 8 }}>Defina a meta de valor aprovado do mês em Equipe e metas › Regras. <button type="button" className="btn mini claro" onClick={() => navegar("equipe")}>Definir</button></div>
          ) : null}
        </div>
        <div style={{ flex: "2 1 380px" }}>
          <div className="kpi-rot" style={{ marginBottom: 8 }}>Previsão de fechamento: pessimista · base · otimista</div>
          {prev ? <FaixaPrevisao prev={prev} meta={meta} aprovado={t.valorAprovado} /> : <div className="suave peq">{ck.carregando ? "Calculando…" : "Sem dados do CRM."}</div>}
        </div>
      </Card>

      <div className="grade grade-kpi">
        <Kpi rotulo="Propostas enviadas no mês" valor={t.enviadas} sub={`ritmo para o mês: ${ritmo} · mês anterior ${anterior.enviadas}`} />
        <Kpi rotulo="Aprovação do mês" valor={pct(t.taxa)} sub={`${t.aprovadas} aprovadas`} />
        <Kpi rotulo="Em aberto (até 60 dias)" valor={brl(prev?.emAberto || 0, true)} sub={`${abertas.length} propostas`} />
        <Kpi rotulo="Sem responsável" valor={t.semResponsavel} sub={t.enviadas ? `${pct(t.pctSemResponsavel)} do mês` : "—"} tomSub={t.pctSemResponsavel > 5 ? "ruim" : undefined} />
      </div>

      <div className="grade grade-2" style={{ alignItems: "start" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><h2>Alertas</h2><span className="suave peq">{alertas.length} aberto(s)</span></div>
          {alertas.length === 0 ? <div className="vazio">Nenhum alerta. Bom dia para prospectar.</div> : pagAl.itens.map((x, i) => (
            <div className="ponto" key={i}>
              <span className={`bolinha ${x.tom}`} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{x.titulo}</div><div className="suave peq" style={{ marginTop: 2 }}>{x.texto}</div></div>
              <button type="button" className="btn claro mini" onClick={() => navegar(x.tela)}>Ver</button>
            </div>
          ))}
          <Paginacao pag={pagAl} rotulo="alertas" />
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <AcoesDoDia sugestoes={alertas.slice(0, 5).map((x) => x.titulo)} />
          <Card semPad>
            <div className="card-cab"><h2>Onde agir primeiro</h2><span className="suave peq">valor × chance de aprovar</span></div>
            {ondeAgir.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Sem propostas abertas recentes.</div> : (
              <div className="tabela-caixa">
                <table>
                  <thead><tr><th>Cliente</th><th>Responsável</th><th>Valor</th><th>Idade</th><th>Chance</th></tr></thead>
                  <tbody>
                    {pagAg.itens.map((p) => (
                      <tr key={p.id}>
                        <td>{p.cliente || "—"}<div className="suave peq">{p.numero}</div></td>
                        <td className="peq">{nomeCRM(p.responsavelId)}</td>
                        <td className="tnum">{brl(p.valor)}</td>
                        <td className="tnum">{p.idade} d</td>
                        <td className="tnum">{pct(p.chance * 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Paginacao pag={pagAg} rotulo="propostas" />
          </Card>
        </div>
      </div>
    </>
  );
}

function FaixaPrevisao({ prev, meta, aprovado }) {
  const max = Math.max(prev.otimista, meta || 0, 1) * 1.08;
  const x = (v) => `${(v / max) * 100}%`;
  return (
    <div>
      <div style={{ position: "relative", height: 56, background: "var(--fundo)", borderRadius: 12 }} role="img" aria-label={`Previsão entre ${brl(prev.pessimista)} e ${brl(prev.otimista)}, base ${brl(prev.base)}`}>
        <div style={{ position: "absolute", left: 0, width: x(aprovado), top: 22, height: 12, background: "#b9caca", borderRadius: 6 }} title={`Aprovado: ${brl(aprovado)}`} />
        <div style={{ position: "absolute", left: x(prev.pessimista), width: `calc(${x(prev.otimista)} - ${x(prev.pessimista)})`, top: 14, height: 28, background: "var(--marca-100)", border: "1px solid var(--marca-400)", borderRadius: 8 }} />
        <div style={{ position: "absolute", left: x(prev.base), top: 8, width: 3, height: 40, background: "var(--marca)", borderRadius: 2 }} />
        {meta ? <div style={{ position: "absolute", left: x(meta), top: 4, bottom: 4, borderLeft: "2px dashed var(--tinta)" }} title={`Meta: ${brl(meta)}`} /> : null}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 12, flexWrap: "wrap" }}>
        <span className="suave">Pessimista {brl(prev.pessimista, true)}</span>
        <span style={{ color: "var(--marca-900)", fontWeight: 600 }}>Base {brl(prev.base, true)}</span>
        <span className="suave">Otimista {brl(prev.otimista, true)}</span>
        {meta ? <span style={{ color: "var(--tinta)", fontWeight: 600 }}>Meta {brl(meta, true)}</span> : null}
      </div>
    </div>
  );
}

function AcoesDoDia({ sugestoes }) {
  const { dados, gravar } = useBase();
  const hoje = hojeBR();
  const reg = dados.acoes.find((x) => x.id === `dia_${hoje}`) || { id: `dia_${hoje}`, data: hoje, itens: [] };
  const [texto, setTexto] = useState("");
  const salvar = (itens) => gravar("acoes", { ...reg, itens });
  const adicionar = (t) => { if (t.trim() && reg.itens.length < 8) { salvar([...reg.itens, { id: novoId("a"), texto: t.trim(), feito: false }]); setTexto(""); } };
  const pendentes = sugestoes.filter((s) => !reg.itens.some((i) => i.texto === s));
  return (
    <Card>
      <h2>Suas ações de hoje</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {reg.itens.length === 0 && <div className="suave peq">Escolha até 3 ações a partir dos alertas, ou escreva a sua.</div>}
        {reg.itens.map((i) => (
          <label key={i.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, textDecoration: i.feito ? "line-through" : "none", color: i.feito ? "var(--suave)" : undefined }}>
            <input type="checkbox" checked={i.feito} style={{ width: 18, height: 18, marginTop: 2 }} onChange={() => salvar(reg.itens.map((x) => (x.id === i.id ? { ...x, feito: !x.feito } : x)))} /> {i.texto}
          </label>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input className="entrada" aria-label="Nova ação" placeholder="Nova ação para hoje" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar(texto)} />
          <button type="button" className="btn" onClick={() => adicionar(texto)}>Incluir</button>
        </div>
        {pendentes.length > 0 && reg.itens.length < 3 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pendentes.slice(0, 3).map((s) => <button key={s} type="button" className="btn claro mini" onClick={() => adicionar(s)}>+ {s.length > 48 ? `${s.slice(0, 46)}…` : s}</button>)}
          </div>
        )}
      </div>
    </Card>
  );
}

function somarDias(iso, n) {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
