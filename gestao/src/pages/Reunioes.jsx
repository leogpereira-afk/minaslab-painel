// Reuniões prontas: a apresentação de cada ritual é montada com os números do
// período, com roteiro de fala e ata. O que foi combinado volta como primeiro
// slide da reunião seguinte do mesmo tipo.
import { useState } from "react";
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Cabecalho, Chip, Abas } from "../components/ui.jsx";
import { Estudio } from "../components/Estudio.jsx";
import { ListaAtas } from "../components/ListaAtas.jsx";
import { SeletorMes } from "../components/Layout.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { Slides, BarrasSlide } from "../components/Slides.jsx";
import { cockpitCRM, carteiraCRM } from "../services/crm.js";
import { brl, pct, mesLongo, mesNome, mesAtual, hojeBR, dataCurta, novoId, mesCurto, somarMeses, mesesAte } from "../lib/format.js";
import { totaisMes, realizado, metasDe, pontos, roteiroFeedback, avaliar, criteriosDaFuncao, serie, situacao } from "../lib/calculos.js";
import { TIPOS_OCORRENCIA } from "../lib/calculos.js";

const TIPOS = [
  { id: "rapida", nome: "Reunião rápida da semana", dur: "15 min" },
  { id: "1a1", nome: "Conversa individual (1:1)", dur: "30 min" },
  { id: "fechamento", nome: "Fechamento do mês", dur: "1 h" },
  { id: "trimestral", nome: "Revisão trimestral", dur: "meio período" },
];

function segundaDaSemana(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  const dia = d.getUTCDay() || 7;
  return new Date(d.getTime() - (dia - 1) * 864e5).toISOString().slice(0, 10);
}
const trimestreDe = (mes) => { const [a, m] = mes.split("-").map(Number); return `${a}-T${Math.ceil(m / 3)}`; };

export default function Reunioes() {
  const [aba, setAba] = useState("geral");
  const com = useBase().setor === "comercial";
  return (
    <>
      <Cabecalho sobre="Reuniões e apresentações" titulo={aba === "geral" ? "Reunião mensal e apresentações" : aba === "atas" ? "Atas de reunião" : "Rituais do comercial"} sub={aba === "atas" ? "Atas no modelo FM-LAB-001, geradas a partir das apresentações. Baixe em Word para imprimir e colher as assinaturas." : aba === "geral" ? "Modelos no estilo MinasLab: os números do CRM, o ranking e o destaque entram sozinhos. Você completa o que mudou e apresenta." : "Montadas com os números do período, com roteiro de fala e ata."}>
        {aba === "rituais" && <SeletorMes />}
      </Cabecalho>
      <Abas valor={aba} aoMudar={setAba} abas={[["geral", "Apresentações de reunião"], ["atas", "Atas"], ...(com ? [["rituais", "Rituais do comercial"]] : [])]} />
      {aba === "geral" ? <Estudio categoria="reuniao" /> : aba === "atas" ? <ListaAtas /> : <Rituais />}
    </>
  );
}

function Rituais() {
  const base = useBase();
  const { equipe, mes, dados } = base;
  const [tipo, setTipo] = useState("rapida");
  const [pessoaId, setPessoaId] = useState(equipe[0]?.id || "");
  // No Laboratório não há números comerciais do CRM (o servidor recusa).
  const com = base.setor === "comercial";
  const ck = useCRM(com ? "cockpit" : "sem-cockpit", com ? cockpitCRM : async () => null);
  const cart = useCRM(com ? "carteira" : "sem-carteira", com ? carteiraCRM : async () => null);
  const pessoa = equipe.find((p) => p.id === pessoaId) || equipe[0];

  const ref = tipo === "rapida" ? segundaDaSemana(hojeBR()) : tipo === "1a1" ? `${pessoa?.id}_${mes}` : tipo === "fechamento" ? mes : trimestreDe(mes);
  const id = `${tipo}_${ref}`;
  const anteriores = dados.reunioes
    .filter((r) => r.tipo === tipo && r.id !== id && (tipo !== "1a1" || r.pessoaId === pessoa?.id) && String(r.ref) < String(ref))
    .sort((a, b) => String(b.ref).localeCompare(String(a.ref)));
  const anterior = anteriores[0];

  const slides = montar({ tipo, base, pessoa, anterior, ck: ck.dados, cart: cart.dados });
  const titulo = tipo === "rapida" ? `Reunião rápida · semana de ${dataCurta(ref)}` : tipo === "1a1" ? `1:1 · ${pessoa?.nome || ""} · ${mesNome(mes)}` : tipo === "fechamento" ? `Fechamento · ${mesLongo(mes)}` : `Revisão trimestral · ${ref.replace("-T", " · T")}`;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><h2>{titulo}</h2><Orientacao tela="reunioes" /></div>
      <div className="pilulas" role="tablist">
        {TIPOS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tipo === t.id} className={`pilula${tipo === t.id ? " ativa" : ""}`} onClick={() => setTipo(t.id)}>{t.nome} · {t.dur}</button>)}
      </div>
      {tipo === "1a1" && (
        <div className="pilulas" role="group" aria-label="Pessoa">
          {equipe.map((p) => <button key={p.id} type="button" className={`pilula${p.id === pessoa?.id ? " ativa" : ""}`} onClick={() => setPessoaId(p.id)}>{p.nome}</button>)}
        </div>
      )}
      {tipo === "1a1" && !pessoa ? <Card>Cadastre a equipe em Equipe e metas.</Card> : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 20 }}>
          <Slides titulo={titulo} slides={slides} />
          <Ata key={id} id={id} tipo={tipo} ref_={ref} pessoaId={tipo === "1a1" ? pessoa?.id : ""} />
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ slides
function montar({ tipo, base, pessoa, anterior, ck, cart }) {
  const { resumo, equipe, mes, dados, config, ocorrenciasDe, funcaoDe } = base;
  const s = [];
  const combinados = (anterior?.itens || []);
  s.push({
    titulo: "O que combinamos da última vez",
    minutos: 3,
    roteiro: combinados.length ? "Passe item por item: feito, não feito e por quê. Não reabra a discussão; o que não foi feito ganha nova data." : "Primeira reunião deste tipo no sistema: combine que tudo o que for decidido hoje entra na ata.",
    corpo: combinados.length ? (
      <ul>{combinados.map((c) => <li key={c.id}>{c.feito ? "✓ " : "○ "}{c.texto}{c.dono ? ` — ${c.dono}` : ""}{c.prazo ? ` (até ${dataCurta(c.prazo)})` : ""}</li>)}</ul>
    ) : <div className="suave">Nenhum combinado registrado antes.</div>,
  });

  if (tipo === "rapida") {
    const m = mesAtual();
    const [a, mm, d] = hojeBR().split("-").map(Number);
    const fr = d / new Date(Date.UTC(a, mm, 0)).getUTCDate();
    const itens = equipe.map((p) => {
      const r = realizado(resumo, p, m);
      const meta = metasDe(p).propostas;
      return { nome: p.nome.split(" ")[0], valor: r.enviadas, meta: meta ? Math.round(meta * fr) : null, rotulo: meta ? `${r.enviadas} / ${Math.round(meta * fr)}` : `${r.enviadas}`, cor: meta && r.enviadas < meta * fr * 0.8 ? "#dc2626" : "var(--marca)" };
    });
    s.push({ titulo: `Placar de ${mesNome(m)} até hoje`, minutos: 4, roteiro: "Mostre quem está acima e abaixo do ritmo da meta (linha tracejada = onde deveria estar hoje). Sem discutir causas aqui: isso vai para a 1:1.", corpo: itens.length ? <BarrasSlide itens={itens} /> : <div className="suave">Cadastre a equipe e as metas.</div>, fonte: "CRM · propostas enviadas no mês" });
    const esfr = (ck?.abertas || []).filter((x) => x.idade > 7 && x.idade <= 60).sort((x, y) => y.valor - x.valor).slice(0, 7);
    s.push({ titulo: "Propostas esfriando: quem liga esta semana?", minutos: 4, roteiro: "Para cada proposta, defina quem faz o contato e até quando. Anote na ata como compromisso.", corpo: esfr.length ? <ul>{esfr.map((x) => <li key={x.id}>{x.cliente || x.numero} — {brl(x.valor)} · {x.idade} dias · chance {pct(x.chance * 100)}</li>)}</ul> : <div className="suave">Nenhuma proposta esfriando. Ótimo.</div>, fonte: "CRM · propostas enviadas sem decisão" });
    const melhor = [...equipe].map((p) => { const r = realizado(resumo, p, m); const meta = metasDe(p).propostas; return { p, nota: meta ? r.enviadas / meta : r.aprovadas }; }).sort((x, y) => y.nota - x.nota)[0];
    s.push({ titulo: "Reconhecimento da semana", minutos: 2, roteiro: "Elogio específico, com o fato e o número. Pergunte o que funcionou para a equipe aprender.", corpo: melhor ? <div className="slide-num">{melhor.p.nome}</div> : <div className="suave">—</div> });
    s.push({ titulo: "Compromisso de cada um para a semana", minutos: 2, roteiro: "Cada pessoa diz UM compromisso ligado à meta (ex.: 15 propostas, follow-up das 5 paradas). Registre na ata com dono e prazo.", corpo: <ul>{equipe.map((p) => <li key={p.id}>{p.nome}: ________________________________</li>)}</ul> });
  }

  if (tipo === "1a1" && pessoa) {
    const r = realizado(resumo, pessoa, mes);
    const metas = metasDe(pessoa);
    const lista = pontos(resumo, pessoa, mes, ocorrenciasDe(pessoa.id).length);
    const rot = roteiroFeedback(lista, pessoa);
    const ultFb = dados.feedbacks.filter((f) => f.pessoaId === pessoa.id).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
    if (ultFb?.combinados) s[0] = { ...s[0], corpo: <div><div className="suave peq">Última conversa ({dataCurta(ultFb.data)})</div><div style={{ fontSize: "1.2em", marginTop: 8 }}>{ultFb.combinados}{ultFb.prazo ? ` · até ${dataCurta(ultFb.prazo)}` : ""}</div></div> };
    s.push({ titulo: `Seus números de ${mesNome(mes)}`, minutos: 5, roteiro: "Mostre os números sem julgar. Pergunte: o que você vê aqui?", corpo: (
      <div style={{ display: "flex", gap: "3em", flexWrap: "wrap" }}>
        <div><div className="suave peq">Propostas</div><div className="slide-num">{metas.propostas ? `${r.enviadas}/${metas.propostas}` : r.enviadas}</div></div>
        <div><div className="suave peq">Aprovação</div><div className="slide-num">{pct(r.taxa)}</div></div>
        <div><div className="suave peq">Valor aprovado</div><div className="slide-num">{brl(r.valorAprovado, true)}</div></div>
      </div>
    ), fonte: "CRM" });
    s.push({ titulo: "O que foi bem", minutos: 4, roteiro: "Elogio específico: o fato, o número e o impacto para a equipe.", corpo: <ul>{rot.bom.map((x) => <li key={x}>{x}</li>)}</ul> });
    s.push({ titulo: "Onde dá para melhorar", minutos: 7, roteiro: "Um ou dois pontos no máximo. Fato e impacto, depois pergunte: o que está atrapalhando?", corpo: <ul>{rot.melhorar.slice(0, 3).map((x) => <li key={x}>{x}</li>)}</ul> });
    s.push({ titulo: "Sua vez", minutos: 6, roteiro: "Ouça mais do que fala. Anote o que for pedido a você como compromisso seu na ata.", corpo: <ul><li>O que está atrapalhando?</li><li>O que você precisa de mim?</li><li>O que você quer aprender este trimestre?</li></ul> });
    const pdi = dados.pdi.filter((x) => x.pessoaId === pessoa.id && x.status !== "concluido");
    s.push({ titulo: "Combinados e desenvolvimento", minutos: 5, roteiro: "Feche com 1 a 3 combinados com número e prazo. Registre na ata e em Pessoas e feedback.", corpo: <div><ul>{rot.combinar.slice(0, 3).map((x) => <li key={x}>{x}</li>)}</ul>{pdi.length > 0 && <div className="suave peq" style={{ marginTop: 10 }}>PDI em andamento: {pdi.map((x) => x.competencia).join(" · ")}</div>}</div> });
  }

  if (tipo === "fechamento") {
    const t = totaisMes(resumo, mes);
    const ant = totaisMes(resumo, somarMeses(mes, -1));
    const meta = Number(config.metaValorMensal) || 0;
    s.push({ titulo: `Resultado de ${mesNome(mes)}`, minutos: 6, roteiro: `Abra com o número da equipe. ${meta ? (t.valorAprovado >= meta ? "Meta batida: reconheça a equipe." : "Meta não batida: explique o desvio com os números dos próximos slides.") : ""}`, corpo: (
      <div style={{ display: "flex", gap: "3em", flexWrap: "wrap" }}>
        <div><div className="suave peq">Valor aprovado</div><div className="slide-num">{brl(t.valorAprovado, true)}</div><div className="suave peq">{meta ? `meta ${brl(meta, true)}` : `mês anterior ${brl(ant.valorAprovado, true)}`}</div></div>
        <div><div className="suave peq">Propostas</div><div className="slide-num">{t.enviadas}</div><div className="suave peq">mês anterior {ant.enviadas}</div></div>
        <div><div className="suave peq">Aprovação</div><div className="slide-num">{pct(t.taxa)}</div></div>
        <div><div className="suave peq">Sem responsável</div><div className="slide-num">{pct(t.pctSemResponsavel)}</div></div>
      </div>
    ), fonte: "CRM" });
    s.push({ titulo: "Meta × realizado por pessoa", minutos: 8, roteiro: "Uma linha por pessoa. Quem ficou abaixo: o motivo é tratado na 1:1, não aqui.", corpo: <BarrasSlide itens={equipe.map((p) => { const r = realizado(resumo, p, mes); const m = metasDe(p); const st = situacao(r, m); return { nome: p.nome.split(" ")[0], valor: r.enviadas, meta: m.propostas, rotulo: m.propostas ? `${r.enviadas} / ${m.propostas}` : `${r.enviadas}`, cor: st.tom === "ruim" ? "#dc2626" : st.tom === "alerta" ? "#d97706" : "var(--marca)" }; })} />, fonte: "CRM" });
    const ser = serie(resumo, "equipe", mes, 6);
    s.push({ titulo: "Valor aprovado nos últimos 6 meses", minutos: 5, roteiro: "Tendência: estamos subindo ou caindo? O que mudou nos meses de queda?", corpo: <BarrasSlide itens={ser.map((x) => ({ nome: mesCurto(x.mes), valor: x.valorAprovado, rotulo: brl(x.valorAprovado, true), cor: x.mes === mes ? "var(--marca)" : "#9fb7b7" }))} />, fonte: "CRM · valor pelo mês do aceite" });
    const faixas = ck?.faixas || [];
    const ab = ck?.abertas || [];
    s.push({ titulo: "Propostas em aberto pela idade", minutos: 6, roteiro: "Quanto mais velha, menor a chance. Decidam o que fazer com as acima de 30 dias: follow-up final ou encerrar.", corpo: faixas.length ? <BarrasSlide itens={faixas.map((f) => { const xs = ab.filter((a) => a.idade >= f.de && (f.ate == null || a.idade < f.ate)); return { nome: f.rotulo, valor: xs.length, rotulo: `${xs.length} · ${brl(xs.reduce((q, a) => q + a.valor, 0), true)} · chance ${pct(f.chance * 100)}` }; })} /> : <div className="suave">Carregando o CRM…</div>, fonte: "CRM" });
    const risco = (cart?.clientes || []).filter((c) => c.emRisco && c.curva !== "C").slice(0, 6);
    s.push({ titulo: "Clientes para ligar no próximo mês", minutos: 6, roteiro: "Clientes A e B que passaram do próprio intervalo de compra e contratos vencendo. Distribua entre a equipe.", corpo: <div><ul>{risco.map((c) => <li key={c.cliente}>{c.cliente} — {c.diasSemAprovar} dias sem aprovar (costuma a cada {c.intervaloMedio})</li>)}</ul>{(cart?.contratosVencendo || []).length > 0 && <div className="suave peq" style={{ marginTop: 8 }}>{cart.contratosVencendo.length} contrato(s) vencendo nos próximos 90 dias.</div>}{!risco.length && !cart && <div className="suave">Carregando o CRM…</div>}</div>, fonte: "CRM · carteira" });
    const oc = dados.ocorrencias.filter((o) => o.mes === mes);
    s.push({ titulo: "Ocorrências do mês", minutos: 5, roteiro: "Fale do processo, não das pessoas. O que se repete vira ação no plano.", corpo: oc.length ? <BarrasSlide itens={TIPOS_OCORRENCIA.map((t2) => ({ nome: t2, valor: oc.filter((o) => o.tipo === t2).length })).filter((x) => x.valor)} /> : <div className="suave">Nenhuma ocorrência registrada.</div> });
    const avs = equipe.map((p) => { const sv = dados.avaliacoes.find((a) => a.id === `${p.id}_${mes}`); return { p, a: avaliar({ resumo, membro: p, mes, notas: sv?.notas || {}, nOcorrencias: ocorrenciasDe(p.id, mes).length, config, criteriosTecnicos: criteriosDaFuncao(funcaoDe(p)) }), fechada: !!sv?.fechada }; });
    s.push({ titulo: "Avaliações e bônus", minutos: 5, roteiro: "Só para a gestão/direção: não projete para a equipe. Confirme as avaliações abertas antes de fechar o mês.", corpo: <ul>{avs.map(({ p, a, fechada }) => <li key={p.id}>{p.nome}: nota {a.final == null ? "—" : a.final.toFixed(1).replace(".", ",")} · {a.bonus == null ? "pendente" : a.bonus ? brl(a.bonus) : "sem bônus"}{fechada ? " (fechada)" : ""}</li>)}</ul> });
    s.push({ titulo: `Metas e foco de ${mesNome(somarMeses(mes, 1))}`, minutos: 10, roteiro: "Defina a meta de valor, confirme as metas por pessoa e escolha UMA prioridade da equipe. Registre como decisão na ata.", corpo: <ul><li>Meta de valor aprovado: ____________</li><li>Prioridade da equipe: ____________</li><li>Treinamento do mês: ____________</li></ul> });
  }

  if (tipo === "trimestral") {
    const ms = mesesAte(mes, 3);
    s.push({ titulo: "Os últimos 3 meses", minutos: 15, roteiro: "Tendência do trimestre: volume, aprovação e valor. Compare com o trimestre anterior.", corpo: (
      <table style={{ fontSize: "1.1em" }}><thead><tr><th>Mês</th><th>Propostas</th><th>Aprovação</th><th>Valor aprovado</th></tr></thead><tbody>
        {ms.map((m) => { const t = totaisMes(resumo, m); return <tr key={m}><td>{mesLongo(m)}</td><td className="tnum">{t.enviadas}</td><td className="tnum">{pct(t.taxa)}</td><td className="tnum">{brl(t.valorAprovado, true)}</td></tr>; })}
      </tbody></table>
    ), fonte: "CRM" });
    const objs = dados.objetivos.filter((o) => o.trimestre === trimestreDe(mes));
    s.push({ titulo: "Objetivos do trimestre", minutos: 20, roteiro: "Para cada resultado-chave: onde estamos de 0 a 100%? O que aprendemos?", corpo: objs.length ? <ul>{objs.map((o) => <li key={o.id}><b>{o.titulo}</b>{(o.krs || []).map((k, i) => <div key={i} className="peq">· {k.texto}: {k.atual ?? "—"} de {k.alvo ?? "—"}</div>)}</li>)}</ul> : <div className="suave">Nenhum objetivo cadastrado para este trimestre (Estratégias).</div> });
    const est = dados.estrategias;
    s.push({ titulo: "Plano de ação", minutos: 15, roteiro: "O que foi feito, o que travou e o que sai do plano.", corpo: <ul>{est.slice(0, 8).map((e) => <li key={e.id}>{e.status === "feito" ? "✓" : e.status === "andamento" ? "◐" : "○"} {e.titulo}</li>)}</ul> });
    const dec = dados.decisoes.filter((d) => d.revisao && d.revisao <= hojeBR() && !d.revisada);
    s.push({ titulo: "Decisões a revisar", minutos: 15, roteiro: "Com o que sabíamos, decidiríamos igual? O que o número mostrou?", corpo: dec.length ? <ul>{dec.map((d) => <li key={d.id}>{d.titulo} (decidida em {dataCurta(d.data)})</li>)}</ul> : <div className="suave">Nenhuma decisão com revisão vencida.</div> });
    s.push({ titulo: "Próximo trimestre", minutos: 30, roteiro: "Até 3 objetivos, cada um com 3 a 5 resultados-chave com número. Registre como decisão na ata e cadastre em Estratégias.", corpo: <ul><li>Objetivo 1: ____________</li><li>Objetivo 2: ____________</li><li>Investimentos e pedidos à direção: ____________</li></ul> });
  }
  return s;
}

// ------------------------------------------------------------------ ata
function Ata({ id, tipo, ref_, pessoaId }) {
  const { dados, gravar } = useBase();
  const reg = dados.reunioes.find((r) => r.id === id) || { id, tipo, ref: ref_, pessoaId, data: hojeBR(), itens: [] };
  const [f, setF] = useState({ tipo: "compromisso", texto: "", dono: "", prazo: "" });
  const [erro, setErro] = useState("");
  const salvar = (itens) => gravar("reunioes", { ...reg, data: hojeBR(), itens }).catch((e) => setErro(e.message));
  const add = () => {
    if (!f.texto.trim()) return;
    salvar([...reg.itens, { id: novoId("i"), ...f, texto: f.texto.trim(), feito: false }]);
    setF({ ...f, texto: "", dono: "", prazo: "" });
  };
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><h2>Ata</h2><span className="suave peq">{reg.itens.length} item(ns) · volta como 1º slide da próxima</span></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "flex-end" }}>
        <div className="campo"><label htmlFor="a-tipo">Tipo</label><select id="a-tipo" className="entrada" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="compromisso">Compromisso</option><option value="decisao">Decisão</option></select></div>
        <div className="campo" style={{ flex: "2 1 260px" }}><label htmlFor="a-txt">O quê</label><input id="a-txt" className="entrada" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} /></div>
        <div className="campo" style={{ flex: "1 1 140px" }}><label htmlFor="a-dono">Quem</label><input id="a-dono" className="entrada" value={f.dono} onChange={(e) => setF({ ...f, dono: e.target.value })} /></div>
        <div className="campo"><label htmlFor="a-prazo">Até</label><input id="a-prazo" type="date" className="entrada" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></div>
        <button type="button" className="btn" onClick={add}>Adicionar</button>
      </div>
      {erro && <div className="aviso ruim" style={{ marginTop: 8 }}>{erro}</div>}
      <div style={{ marginTop: 12 }}>
        {reg.itens.map((i) => (
          <div key={i.id} className="ponto" style={{ alignItems: "center" }}>
            <input type="checkbox" aria-label="Feito" checked={i.feito} style={{ width: 18, height: 18 }} onChange={() => salvar(reg.itens.map((x) => (x.id === i.id ? { ...x, feito: !x.feito } : x)))} />
            <Chip tom={i.tipo === "decisao" ? "marca" : "neutro"}>{i.tipo === "decisao" ? "Decisão" : "Compromisso"}</Chip>
            <div style={{ flex: 1, textDecoration: i.feito ? "line-through" : "none" }}>{i.texto}<span className="suave peq">{i.dono ? ` · ${i.dono}` : ""}{i.prazo ? ` · até ${dataCurta(i.prazo)}` : ""}</span></div>
            <button type="button" className="btn perigo mini" onClick={() => salvar(reg.itens.filter((x) => x.id !== i.id))}>Tirar</button>
          </div>
        ))}
      </div>
    </Card>
  );
}
