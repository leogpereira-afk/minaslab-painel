// Plano de carreira: as trilhas e os níveis (lib/planoCarreira.js), a
// situação de cada pessoa com os critérios conferidos nos registros do
// sistema (avaliação, treinamentos e eficácia, PDI, ocorrências e estágio) e
// o histórico de promoções, com o RMC para assinar e o aviso do PCMSO.

import { useEffect, useMemo, useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Abas, Card, Chip, Cabecalho, Kpi, Modal, Paginacao, usePaginacao } from "../components/ui.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { JanelaDocumento } from "../components/FormulariosTreinamento.jsx";
import { DocPCC, DocRMC } from "../components/DocumentosCarreira.jsx";
import { carregarTudo, carreiraRH } from "../services/dados.js";
import { catalogo, trilhaEmQualquerLugar } from "../lib/catalogo.js";
import { treinamentosDaPessoa } from "../lib/treinamentosPessoa.js";
import { resultadoEficacia } from "../lib/formulariosTreinamento.js";
import { avaliar, criteriosDaFuncao, metasAvaliadas } from "../lib/calculos.js";
import { dataCurta, hojeBR, nomeProprio, numero } from "../lib/format.js";
import {
  NIVEIS, TRILHAS_CARREIRA, LATERAIS, GRUPOS_RISCO, REGRAS, TEXTO_PLANO, SITUACOES, TIPOS_MOV, FORA_DO_PLANO,
  nivelPorId, nivelDaFuncao, proximosPassos, exigenciaPCMSO, mesesEntre, proximoCiclo, prontidao, nomeTipoMov,
  faixaSalarial, formatarFaixa, lerReais, avisosFaixas, validarFaixa,
} from "../lib/planoCarreira.js";

const MARCA = { true: ["✓", "ok"], false: ["✕", "ruim"], null: ["?", "neutro"] };

/** Treinamentos dos outros setores liberados (o laboratório registra no comercial e vice-versa). */
function useTreinamentosDeTodos() {
  const { dados, setor, setoresPermitidos } = useBase();
  const [extras, setExtras] = useState([]);
  const outros = setoresPermitidos.filter((s) => s !== setor).join(",");
  useEffect(() => {
    let vivo = true;
    Promise.all(outros ? outros.split(",").map((s) => carregarTudo(s).then((d) => d.treinamentos).catch(() => [])) : [])
      .then((ls) => vivo && setExtras(ls.flat()));
    return () => { vivo = false; };
  }, [outros]);
  return useMemo(() => {
    const ids = new Set(dados.treinamentos.map((r) => r.id));
    return [...dados.treinamentos, ...extras.filter((r) => !ids.has(r.id))];
  }, [dados.treinamentos, extras]);
}

function useCarreira() {
  const base = useBase();
  const { dados, resumo, config, funcaoDe, ocorrenciasDe, setor } = base;
  const todos = useTreinamentosDeTodos();
  const hoje = hojeBR();
  const cat = useMemo(() => catalogo(todos, setor), [todos, setor]);
  const nomeTrilha = (id) => trilhaEmQualquerLugar(cat, id)?.nome || id;
  const regs = dados.carreira || [];
  const ajustes = Object.fromEntries(regs.filter((r) => r.tipo === "nivel").map((r) => [r.nivelId, r]));
  const tempoMinimo = (id) => numero(ajustes[id]?.tempoMinimo) ?? nivelPorId(id)?.tempoMinimo;

  const situacaoDe = (membro) => {
    const funcao = funcaoDe(membro);
    const nomeFuncao = funcao?.nome || membro.funcao || "";
    const enq = regs.find((r) => r.id === `enq_${membro.id}`);
    const nivel = nivelPorId(enq?.nivelId) || nivelDaFuncao(nomeFuncao);
    const desde = enq?.desde || membro.entrouEm || "";
    const treinos = treinamentosDaPessoa(todos, membro);
    const feitos = new Set(treinos.map((t) => t.trilhaId));
    const ids = new Set([membro.id, membro.rhPessoaId].filter(Boolean));
    let naoEficazes = 0;
    for (const r of todos) {
      for (const p of r.participantes || []) {
        if (p.presente === false || !(ids.has(p.pessoaId) || ids.has(p.rhPessoaId))) continue;
        const av = r.eficacia?.[p.pessoaId];
        if (av && resultadoEficacia(av) === "nao-eficaz" && !av.plano?.aprovadoEm) naoEficazes++;
      }
    }
    const notas = dados.avaliacoes.filter((a) => a.pessoaId === membro.id).map((a) => {
      const r = avaliar({ resumo, membro, mes: a.mes, notas: a.notas || {}, nOcorrencias: ocorrenciasDe(membro.id, a.mes).length, config, criteriosTecnicos: criteriosDaFuncao(funcao), metasFuncao: metasAvaliadas(funcao, membro) });
      return { mes: a.mes, final: a.resultado?.final ?? r.final };
    });
    const obrigatorios = (funcao?.trilhas || []).map((id) => ({ id, nome: nomeTrilha(id), feito: feitos.has(id) }));
    const pr = prontidao({
      nivel, tempoMinimo: nivel ? tempoMinimo(nivel.id) : null, desde, hoje, notas,
      ocorrencias: dados.ocorrencias.filter((o) => o.pessoaId === membro.id),
      pdi: dados.pdi.filter((p) => p.pessoaId === membro.id),
      obrigatorios, naoEficazes, estagio: membro.estagio || "",
    });
    const passos = nivel ? proximosPassos(nivel.id) : [];
    const situacao = !nivel ? "sem" : !passos.length ? "topo" : pr.situacao;
    return { membro, funcao, nomeFuncao, nivel, desde, enq, pr, passos, situacao, feitos, meses: mesesEntre(desde, hoje) };
  };
  return { ...base, regs, ajustes, tempoMinimo, situacaoDe, nomeTrilha, hoje };
}

export default function Carreira() {
  const c = useCarreira();
  const { equipeAtual, regs } = c;
  const [aba, setAba] = useState("pessoas");
  const [imprimirPlano, setImprimirPlano] = useState(false);
  const movs = regs.filter((r) => r.tipo === "movimentacao").sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const pessoas = equipeAtual.map(c.situacaoDe);
  const prontas = pessoas.filter((p) => p.situacao === "pronta").length;
  const semNivel = pessoas.filter((p) => p.situacao === "sem").length;

  return (
    <>
      <Cabecalho sobre="Pessoas" titulo="Plano de carreira" sub="Como cada pessoa cresce na MinasLab: trilhas e cargos, critérios conferidos nos registros do sistema e o que o PCMSO pede em cada mudança.">
        <button type="button" className="btn claro" onClick={() => setImprimirPlano(true)}>Imprimir o plano (PCC)</button>
      </Cabecalho>
      <Orientacao tela="carreira" />
      <div className="grade grade-kpi" style={{ margin: "14px 0" }}>
        <Kpi rotulo="Pessoas no plano" valor={pessoas.length - semNivel} sub={semNivel ? `${semNivel} sem cargo no plano` : "todas enquadradas"} tomSub={semNivel ? "alerta-tx" : undefined} />
        <Kpi rotulo="Prontas para o próximo passo" valor={prontas} sub="todos os critérios atendidos" />
        <Kpi rotulo="Próxima análise" valor={dataCurta(proximoCiclo(c.hoje))} sub="ciclos em janeiro e julho" />
        <Kpi rotulo="Movimentações registradas" valor={movs.length} />
      </div>
      <Abas abas={[["pessoas", "Pessoas", pessoas.length], ["plano", "Trilhas e cargos"], ["historico", "Histórico", movs.length]]} valor={aba} aoMudar={setAba} />
      {aba === "pessoas" && <Pessoas lista={pessoas} c={c} />}
      {aba === "plano" && <Plano c={c} pessoas={pessoas} />}
      {aba === "historico" && <Historico movs={movs} c={c} />}
      {imprimirPlano && <JanelaDocumento titulo="Plano de cargos e carreira (PCC)" aoFechar={() => setImprimirPlano(false)}><DocPCC ajustes={c.ajustes} /></JanelaDocumento>}
    </>
  );
}

// ------------------------------------------------------------------ Pessoas
function Pessoas({ lista, c }) {
  const [aberta, setAberta] = useState(null);
  const [filtro, setFiltro] = useState("");
  const vis = lista.filter((p) => !filtro || p.situacao === filtro);
  const atual = aberta && lista.find((p) => p.membro.id === aberta);
  if (!lista.length) return <Card><div className="vazio">Ninguém na equipe deste setor. Monte a equipe em Equipe e metas.</div></Card>;
  return (
    <>
      <div className="carr-filtros">
        <button type="button" className={`chip ${filtro === "" ? "marca" : "neutro"}`} onClick={() => setFiltro("")}>Todas</button>
        {Object.entries(SITUACOES).filter(([id]) => lista.some((p) => p.situacao === id)).map(([id, s]) => (
          <button key={id} type="button" className={`chip ${filtro === id ? "marca" : "neutro"}`} onClick={() => setFiltro(id)}>{s.nome} · {lista.filter((p) => p.situacao === id).length}</button>
        ))}
      </div>
      <div className="carr-pessoas">
        {vis.map((p) => {
          const s = SITUACOES[p.situacao];
          const prox = p.passos.map((x) => nivelPorId(x.para)?.cargo).join(" ou ");
          return (
            <Card key={p.membro.id} className="carr-pessoa">
              <div className="carr-pessoa-topo">
                <div>
                  <div className="carr-nome">{nomeProprio(p.membro.nome)}</div>
                  <div className="suave peq">{p.nivel?.cargo || p.nomeFuncao || "Sem função"}</div>
                </div>
                <Chip tom={s.tom}>{s.nome}</Chip>
              </div>
              {p.nivel && (
                <div className="carr-linhas peq">
                  <div><span className="suave">No cargo:</span> {p.desde ? `desde ${dataCurta(p.desde)} (${p.meses} ${p.meses === 1 ? "mês" : "meses"})` : "data não informada"}</div>
                  <div><span className="suave">Próximo passo:</span> {prox || "topo da trilha"}</div>
                </div>
              )}
              {p.nivel && p.passos.length > 0 && (
                <div className="carr-barra" title={`${p.pr.prontos} de ${p.pr.total} critérios`}>
                  {p.pr.criterios.map((k) => <span key={k.id} className={`carr-seg ${MARCA[k.ok][1]}`} title={`${k.nome}: ${k.detalhe}`} />)}
                </div>
              )}
              {!p.nivel && <div className="aviso alerta peq">A função “{p.nomeFuncao || "sem função"}” não está no plano. {FORA_DO_PLANO.some((f) => p.nomeFuncao.startsWith(f)) ? "Cargo de confiança, fora do plano." : "Enquadre a pessoa em um cargo do plano."}</div>}
              <button type="button" className="btn claro mini" onClick={() => setAberta(p.membro.id)}>{p.nivel ? "Ver critérios" : "Enquadrar"}</button>
            </Card>
          );
        })}
      </div>
      {atual && <DetalhePessoa p={atual} c={c} aoFechar={() => setAberta(null)} />}
    </>
  );
}

function SeletorNivel({ id, valor, aoMudar }) {
  return (
    <select id={id} className="entrada" value={valor} onChange={(e) => aoMudar(e.target.value)}>
      <option value="">— escolha o cargo —</option>
      {TRILHAS_CARREIRA.map((t) => (
        <optgroup key={t.id} label={t.nome}>
          {t.niveis.map((n) => <option key={`${t.id}-${n}`} value={n}>{nivelPorId(n).cargo}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function DetalhePessoa({ p, c, aoFechar }) {
  const { gravar, dados } = c;
  const [enq, setEnq] = useState({ nivelId: p.nivel?.id || "", desde: p.desde || "" });
  const [msg, setMsg] = useState("");
  const [mov, setMov] = useState(null);
  const mudouEnq = enq.nivelId !== (p.nivel?.id || "") || enq.desde !== (p.desde || "");

  const salvarEnq = async () => {
    if (!enq.nivelId) { setMsg("Escolha o cargo."); return; }
    try {
      await gravar("carreira", { id: `enq_${p.membro.id}`, tipo: "enquadramento", pessoaId: p.membro.id, nome: p.membro.nome, nivelId: enq.nivelId, desde: enq.desde });
      setMsg("Enquadramento salvo.");
    } catch (e) { setMsg(e.message); }
  };
  const levarAoPDI = async (nomeTreino, cargo) => {
    try {
      const [a, m] = c.hoje.split("-").map(Number);
      await gravar("pdi", { pessoaId: p.membro.id, competencia: nomeTreino, acao: `Treinamento para ${cargo} (plano de carreira)`, evidencia: "Treinamento aplicado e eficácia avaliada", prazo: proximoCiclo(c.hoje), trimestre: `${a}-T${Math.ceil(m / 3)}`, status: "andamento" });
      setMsg(`“${nomeTreino}” entrou no PDI.`);
    } catch (e) { setMsg(e.message); }
  };
  const noPDI = (nome) => dados.pdi.some((x) => x.pessoaId === p.membro.id && x.competencia === nome && x.status !== "concluido");

  return (
    <Modal titulo={nomeProprio(p.membro.nome)} aoFechar={aoFechar} largo>
      <div className="carr-bloco">
        <h3>Cargo no plano</h3>
        <div className="carr-form">
          <div className="campo" style={{ flex: "2 1 260px" }}><label htmlFor="cr-niv">Cargo</label><SeletorNivel id="cr-niv" valor={enq.nivelId} aoMudar={(v) => setEnq({ ...enq, nivelId: v })} /></div>
          <div className="campo" style={{ flex: "1 1 150px" }}><label htmlFor="cr-desde">No cargo desde</label><input id="cr-desde" type="date" className="entrada" value={enq.desde} onChange={(e) => setEnq({ ...enq, desde: e.target.value })} /></div>
          <button type="button" className="btn" disabled={!mudouEnq} onClick={salvarEnq}>Salvar</button>
        </div>
        <div className="suave peq">{p.enq ? "Enquadramento registrado no plano." : `Sugerido pela função ${p.nomeFuncao ? `“${p.nomeFuncao}”` : ""} e pela data de entrada na equipe. Salve para confirmar.`}</div>
        {p.nivel?.alerta && <div className="aviso alerta peq" style={{ marginTop: 8 }}>{p.nivel.alerta}</div>}
      </div>

      {p.nivel && p.passos.length > 0 && (
        <div className="carr-bloco">
          <h3>Critérios para o próximo passo</h3>
          <ul className="carr-crit">
            {p.pr.criterios.map((k) => (
              <li key={k.id}><span className={`carr-marca ${MARCA[k.ok][1]}`}>{MARCA[k.ok][0]}</span><div><b>{k.nome}</b><div className="suave peq">{k.detalhe}</div></div></li>
            ))}
          </ul>
          <div className="suave peq">Também contam, conferidos na hora da promoção: os requisitos do cargo de destino e a vaga e o orçamento aprovados pela direção.</div>
        </div>
      )}

      {p.passos.map((x) => {
        const n = nivelPorId(x.para);
        const pc = exigenciaPCMSO(p.nivel?.id, x.para);
        return (
          <div key={x.para} className="carr-bloco">
            <div className="carr-passo-topo">
              <h3>{n.cargo}</h3>
              <Chip tom={x.tipo === "promocao" ? "marca" : "neutro"}>{x.tipo === "promocao" ? "Promoção" : "Movimento lateral"}</Chip>
              {n.novo && <Chip tom="alerta" title="Crie a função em Funções e cargos antes da promoção">Cargo novo</Chip>}
            </div>
            <div className="peq">{n.escopo}</div>
            <div className="peq" style={{ marginTop: 6 }}><b>Requisitos:</b> {n.requisitos.join("; ")}.</div>
            <div className={`aviso ${pc.aso ? "alerta" : "marca"} peq`} style={{ marginTop: 8 }}><b>PCMSO:</b> {pc.texto}</div>
            {n.treinamentos.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="peq" style={{ fontWeight: 600 }}>Treinamentos do cargo</div>
                <div className="carr-treinos">
                  {n.treinamentos.map((t) => {
                    const nome = c.nomeTrilha(t);
                    const feito = p.feitos.has(t);
                    return (
                      <span key={t} className="carr-treino">
                        <Chip tom={feito ? "ok" : "neutro"}>{feito ? "✓ " : ""}{nome}</Chip>
                        {!feito && (noPDI(nome) ? <span className="suave peq">no PDI</span> : <button type="button" className="btn claro mini" onClick={() => levarAoPDI(nome, n.cargo)}>Levar ao PDI</button>)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <button type="button" className="btn mini" style={{ marginTop: 10 }} onClick={() => setMov({ para: x.para, tipoMov: x.tipo })}>Registrar {x.tipo === "promocao" ? "promoção" : "movimento"}</button>
          </div>
        );
      })}
      {p.nivel && !p.passos.length && <div className="aviso marca peq">Este é o topo da trilha. Movimentos para cargos de confiança são decisão da direção.</div>}
      {msg && <div className="aviso marca peq" style={{ marginTop: 10 }}>{msg}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" className="btn claro" onClick={() => setMov({ para: "", tipoMov: "promocao" })}>Registrar outra movimentação</button>
        <button type="button" className="btn claro" onClick={aoFechar}>Fechar</button>
      </div>
      {mov && <RegistrarMovimentacao p={p} c={c} inicial={mov} aoFechar={() => setMov(null)} />}
    </Modal>
  );
}

function RegistrarMovimentacao({ p, c, inicial, aoFechar }) {
  const { gravar, dados } = c;
  const [f, setF] = useState({ tipoMov: inicial.tipoMov, para: inicial.para, data: c.hoje, salario: "", requisitosOk: false, vagaOk: false, asoEm: "", formularioOk: false, atualizarFuncao: true, obs: "" });
  const [rh, setRh] = useState(null);
  const temRH = !!p.membro.rhPessoaId;
  const fx = f.para ? faixaSalarial(f.para, c.ajustes) : null;
  const salNum = String(f.salario).trim() ? lerReais(f.salario) : null;
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(null);
  const para = nivelPorId(f.para);
  const pc = para ? exigenciaPCMSO(p.nivel?.id, f.para) : null;
  const funcaoDestino = para && dados.funcoes.find((x) => x.nome.toLowerCase() === para.funcao.toLowerCase());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const salvar = async () => {
    if (!f.para) { setErro("Escolha o novo cargo."); return; }
    if (!f.data) { setErro("Informe a data."); return; }
    if (temRH && f.data > c.hoje) { setErro("A data não pode ser futura: registre a mudança quando ela passar a valer (o RH muda junto)."); return; }
    if (String(f.salario).trim() && !(salNum > 0)) { setErro("Salário inválido: use números, ex.: 2.400 ou 2400,50."); return; }
    try {
      const reg = await gravar("carreira", {
        tipo: "movimentacao", pessoaId: p.membro.id, nome: p.membro.nome, de: p.nivel?.id || "", deTexto: p.nomeFuncao, para: f.para, tipoMov: f.tipoMov, data: f.data,
        criterios: f.tipoMov === "enquadramento" ? [] : p.pr.criterios, conferidoEm: c.hoje, requisitosOk: f.requisitosOk, vagaOk: f.vagaOk,
        aso: !!pc?.aso, asoEm: pc?.aso ? f.asoEm : "", formularioOk: pc?.aso ? false : f.formularioOk, obs: f.obs.trim(),
        ...(salNum ? { salario: salNum } : {}),
      });
      await gravar("carreira", { id: `enq_${p.membro.id}`, tipo: "enquadramento", pessoaId: p.membro.id, nome: p.membro.nome, nivelId: f.para, desde: f.data });
      if (f.atualizarFuncao && funcaoDestino && funcaoDestino.id !== p.membro.funcaoId) await gravar("equipe", { ...p.membro, funcaoId: funcaoDestino.id, funcao: funcaoDestino.nome });
      if (temRH) {
        try { setRh(await carreiraRH(c.setor, { membroId: p.membro.id, movId: reg.id })); }
        catch (e) { setRh({ erro: e.message }); }
      }
      setSalvo(reg);
    } catch (e) { setErro(e.message); }
  };

  if (salvo) {
    return (
      <JanelaDocumento titulo="Registro de movimentação de cargo (RMC)" aoFechar={aoFechar}>
        {rh && <div className={`aviso ${rh.erro ? "ruim" : "ok"} peq`} style={{ margin: "0 0 10px" }}>{rh.erro ? `A movimentação foi registrada, mas o RH não foi atualizado: ${rh.erro}` : rh.semRH ? "Esta pessoa não tem ficha no RH ligada; o RH não mudou." : !rh.marcos?.length ? "O RH já estava assim; nada mudou." : `${rh.fichaMudou ? `Ficha do RH atualizada (cargo “${rh.cargo}”)` : "Ficha do RH mantida, porque já tem uma mudança mais nova"}; histórico do RH: ${rh.marcos.join(" e ")}.`}</div>}
        <DocRMC mov={salvo} />
      </JanelaDocumento>
    );
  }
  return (
    <Modal titulo={`Movimentação · ${nomeProprio(p.membro.nome)}`} aoFechar={aoFechar} largo>
      <div className="carr-form">
        <div className="campo" style={{ flex: "1 1 220px" }}><label htmlFor="mv-tipo">Tipo</label>
          <select id="mv-tipo" className="entrada" value={f.tipoMov} onChange={set("tipoMov")}>{TIPOS_MOV.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        </div>
        <div className="campo" style={{ flex: "2 1 260px" }}><label htmlFor="mv-para">Novo cargo</label><SeletorNivel id="mv-para" valor={f.para} aoMudar={(v) => setF({ ...f, para: v })} /></div>
        <div className="campo" style={{ flex: "1 1 150px" }}><label htmlFor="mv-data">Vale a partir de</label><input id="mv-data" type="date" className="entrada" max={temRH ? c.hoje : undefined} value={f.data} onChange={set("data")} /></div>
        <div className="campo" style={{ flex: "1 1 160px" }}><label htmlFor="mv-sal">Novo salário (R$, opcional)</label><input id="mv-sal" className="entrada" inputMode="decimal" placeholder={fx ? String(fx.min) : ""} value={f.salario} onChange={set("salario")} /></div>
      </div>
      {fx && <div className="suave peq" style={{ marginTop: 4 }}>Faixa do novo cargo: {formatarFaixa(fx)}{salNum && (salNum < fx.min || salNum > fx.max) ? " — o salário informado está fora da faixa." : ""}</div>}
      {temRH && <div className="suave peq" style={{ marginTop: 4 }}>Ao registrar, o cargo{String(f.salario).trim() ? " e o salário" : ""} na ficha do RH e o histórico do RH são atualizados.</div>}
      <div className="suave peq" style={{ marginTop: 4 }}>Cargo atual: {p.nivel?.cargo || p.nomeFuncao || "—"}</div>

      {f.tipoMov !== "enquadramento" && (
        <div className="carr-bloco">
          <div className="peq" style={{ fontWeight: 600 }}>Critérios conferidos no sistema hoje ({p.pr.prontos} de {p.pr.total})</div>
          <ul className="carr-crit compacta">{p.pr.criterios.map((k) => <li key={k.id}><span className={`carr-marca ${MARCA[k.ok][1]}`}>{MARCA[k.ok][0]}</span><span>{k.nome} <span className="suave">· {k.detalhe}</span></span></li>)}</ul>
          <label className="carr-check"><input type="checkbox" checked={f.requisitosOk} onChange={set("requisitosOk")} /> Requisitos do novo cargo comprovados{para ? `: ${para.requisitos.join("; ")}` : ""}</label>
          <label className="carr-check"><input type="checkbox" checked={f.vagaOk} onChange={set("vagaOk")} /> Vaga e orçamento aprovados pela direção</label>
        </div>
      )}
      {pc && (
        <div className={`aviso ${pc.aso ? "alerta" : "marca"} peq`} style={{ marginTop: 12 }}>
          <b>PCMSO:</b> {pc.texto}
          {pc.aso
            ? <div className="carr-form" style={{ marginTop: 8 }}><div className="campo"><label htmlFor="mv-aso">ASO de mudança de risco feito em</label><input id="mv-aso" type="date" className="entrada" value={f.asoEm} onChange={set("asoEm")} /></div></div>
            : <label className="carr-check"><input type="checkbox" checked={f.formularioOk} onChange={set("formularioOk")} /> Formulário de alteração de cargo emitido</label>}
          {pc.aso && f.asoEm && f.data && f.asoEm > f.data && <div style={{ marginTop: 6 }}><b>Atenção:</b> o ASO está depois da data da mudança.</div>}
        </div>
      )}
      {para && (funcaoDestino
        ? <label className="carr-check"><input type="checkbox" checked={f.atualizarFuncao} onChange={set("atualizarFuncao")} /> Trocar a função da pessoa no sistema para “{funcaoDestino.nome}”</label>
        : <div className="suave peq" style={{ marginTop: 10 }}>A função “{para.funcao}” ainda não existe em Funções e cargos deste setor; a função da pessoa no sistema não muda.</div>)}
      <div className="campo" style={{ marginTop: 10 }}><label htmlFor="mv-obs">Observações</label><textarea id="mv-obs" className="entrada" rows={3} value={f.obs} onChange={set("obs")} /></div>
      {erro && <div className="aviso ruim">{erro}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
        <button type="button" className="btn" onClick={salvar}>Registrar e gerar o RMC</button>
      </div>
    </Modal>
  );
}

// -------------------------------------------------------------- Trilhas
function Plano({ c, pessoas }) {
  const [nivel, setNivel] = useState(null);
  const quem = (id) => pessoas.filter((p) => p.nivel?.id === id);
  const alertas = NIVEIS.filter((n) => n.alerta || !n.pcmso);
  const avisos = avisosFaixas(c.ajustes);
  return (
    <>
      {avisos.length > 0 && (
        <Card>
          <h3>Faixas salariais para conferir</h3>
          {avisos.map((a) => <div key={a.trilha + a.para + (a.de || "")} className="ponto"><div>{a.texto}</div></div>)}
        </Card>
      )}
      {TRILHAS_CARREIRA.map((t) => (
        <Card key={t.id} className="carr-trilha">
          <div className="carr-trilha-topo"><h3>{t.nome}</h3><span className="suave peq">{t.desc}</span></div>
          <div className="carr-escada">
            {t.niveis.map((id, i) => {
              const n = nivelPorId(id);
              const q = quem(id);
              return (
                <div key={id} className="carr-degrau-wrap">
                  {i > 0 && <span className="carr-seta" aria-hidden="true">→</span>}
                  <button type="button" className="carr-degrau" onClick={() => setNivel(id)}>
                    <span className="carr-degrau-num">{i + 1}</span>
                    <span className="carr-degrau-cargo">{n.cargo}</span>
                    <span className="carr-degrau-info">
                      <Chip tom={n.grupo === "administrativo" ? "neutro" : "alerta"}>{GRUPOS_RISCO[n.grupo].nome}</Chip>
                      {n.novo && <Chip tom="marca">novo</Chip>}
                    </span>
                    <span className="carr-degrau-salario">{formatarFaixa(faixaSalarial(id, c.ajustes))}</span>
                    <span className="suave peq">{q.length ? q.map((x) => nomeProprio(x.membro.nome).split(" ")[0]).join(", ") : "ninguém hoje"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      <div className="grade grade-2">
        <Card>
          <h3>Movimentos laterais</h3>
          {LATERAIS.map((l) => {
            const pc = exigenciaPCMSO(l.de, l.para);
            return (
              <div key={l.de + l.para} className="ponto">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{nivelPorId(l.de).cargo} → {nivelPorId(l.para).cargo}</div>
                  <div className="suave peq">{l.obs}</div>
                </div>
                <Chip tom={pc.aso ? "alerta" : "neutro"}>{pc.aso ? "ASO de mudança de risco" : "Sem ASO"}</Chip>
              </div>
            );
          })}
        </Card>
        <Card>
          <h3>Regras do plano</h3>
          <ul className="carr-regras">
            <li>Tempo mínimo no cargo: definido por cargo (clique no cargo para ver e ajustar).</li>
            <li>Avaliação: média {REGRAS.notaMinima} ou mais em pelo menos {REGRAS.minimoAvaliacoes} meses avaliados nos últimos {REGRAS.mesesAvaliacao}.</li>
            <li>Treinamentos da função feitos e nenhuma eficácia não eficaz em aberto.</li>
            <li>PDI com item concluído nos últimos 2 trimestres e nada vencido.</li>
            <li>Até {REGRAS.ocorrenciasMax} ocorrências em {REGRAS.mesesAvaliacao} meses; estágio autônomo na função.</li>
            <li>{TEXTO_PLANO.ciclo}</li>
            <li>{TEXTO_PLANO.salario}</li>
          </ul>
        </Card>
      </div>
      {alertas.length > 0 && (
        <Card>
          <h3>Pontos para conferir com a clínica (PCMSO)</h3>
          {alertas.map((n) => <div key={n.id} className="ponto"><div><b>{n.cargo}</b><div className="suave peq">{n.alerta || "Não consta no PCMSO 2026: incluir na próxima revisão se o cargo for criado."}</div></div></div>)}
        </Card>
      )}
      {nivel && <DetalheNivel id={nivel} c={c} quem={quem(nivel)} aoFechar={() => setNivel(null)} />}
    </>
  );
}

function DetalheNivel({ id, c, quem, aoFechar }) {
  const n = nivelPorId(id);
  const aj = c.ajustes[id] || {};
  const padrao = n.salario || {};
  const fx = faixaSalarial(id, c.ajustes);
  const [f, setF] = useState({ salarioMin: aj.salarioMin ?? "", salarioMax: aj.salarioMax ?? "", tempoMinimo: String(aj.tempoMinimo ?? n.tempoMinimo), obs: aj.obs || "" });
  const [msg, setMsg] = useState("");
  const g = GRUPOS_RISCO[n.grupo];
  const existe = c.dados.funcoes.some((x) => x.nome.toLowerCase() === n.funcao.toLowerCase());
  const salvar = async () => {
    const t = numero(f.tempoMinimo);
    if (t == null || t < 0) { setMsg("Tempo mínimo inválido."); return; }
    const vMin = String(f.salarioMin).trim() ? lerReais(f.salarioMin) : null;
    const vMax = String(f.salarioMax).trim() ? lerReais(f.salarioMax) : null;
    if ((String(f.salarioMin).trim() && vMin == null) || (String(f.salarioMax).trim() && vMax == null)) { setMsg("Salário inválido: use números, ex.: 2.400 ou 2400,50."); return; }
    const erroFaixa = validarFaixa(vMin ?? padrao.min, vMax ?? padrao.max);
    if (erroFaixa) { setMsg(erroFaixa); return; }
    try {
      await c.gravar("carreira", { id: `nivel_${id}`, tipo: "nivel", nivelId: id, salarioMin: vMin, salarioMax: vMax, faixa: aj.faixa || "", tempoMinimo: t, obs: f.obs.trim() });
      setMsg("Salvo.");
    } catch (e) { setMsg(e.message); }
  };
  return (
    <Modal titulo={n.cargo} aoFechar={aoFechar} largo>
      <div className="carr-passo-topo">
        <Chip tom={n.grupo === "administrativo" ? "neutro" : "alerta"}>Grupo {g.nome}</Chip>
        <Chip tom={existe ? "ok" : "marca"}>{existe ? "Função cadastrada neste setor" : "Função não cadastrada neste setor"}</Chip>
        <span className="suave peq">PCMSO: {n.pcmso || "não consta"}</span>
      </div>
      <p className="peq">{n.escopo}</p>
      <div className="peq"><b>Requisitos</b><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{n.requisitos.map((r) => <li key={r}>{r}</li>)}</ul></div>
      {n.treinamentos.length > 0 && <div className="peq" style={{ marginTop: 8 }}><b>Treinamentos do cargo:</b> {n.treinamentos.map(c.nomeTrilha).join(", ")}.</div>}
      <div className="peq" style={{ marginTop: 8 }}><b>Saúde ocupacional:</b> riscos {g.riscos.toLowerCase()}; exames: {g.exames.toLowerCase()}.</div>
      {n.alerta && <div className="aviso alerta peq" style={{ marginTop: 8 }}>{n.alerta}</div>}
      <div className="peq" style={{ marginTop: 8 }}><b>Hoje no cargo:</b> {quem.length ? quem.map((x) => nomeProprio(x.membro.nome)).join(", ") : "ninguém neste setor"}.</div>
      <div className="carr-bloco">
        <h3>Ajustes da direção</h3>
        <div className="carr-form">
          <div className="campo" style={{ flex: "1 1 150px" }}><label htmlFor="nv-smin">Salário mínimo (R$)</label><input id="nv-smin" className="entrada" inputMode="decimal" placeholder={String(padrao.min ?? "")} value={f.salarioMin} onChange={(e) => setF({ ...f, salarioMin: e.target.value })} /></div>
          <div className="campo" style={{ flex: "1 1 150px" }}><label htmlFor="nv-smax">Salário máximo (R$)</label><input id="nv-smax" className="entrada" inputMode="decimal" placeholder={String(padrao.max ?? "")} value={f.salarioMax} onChange={(e) => setF({ ...f, salarioMax: e.target.value })} /></div>
          <div className="campo" style={{ flex: "1 1 140px" }}><label htmlFor="nv-tempo">Tempo mínimo (meses)</label><input id="nv-tempo" className="entrada" inputMode="numeric" value={f.tempoMinimo} onChange={(e) => setF({ ...f, tempoMinimo: e.target.value })} /></div>
        </div>
        <div className="campo" style={{ marginTop: 8 }}><label htmlFor="nv-obs">Observações</label><input id="nv-obs" className="entrada" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></div>
        <div className="suave peq" style={{ marginTop: 6 }}>
          Faixa em vigor: <b>{formatarFaixa(fx)}</b>{fx?.obs ? ` (${fx.obs})` : ""}{fx?.ajustada ? " · ajustada pela direção" : " · padrão do plano"}.
          {" "}Deixe o salário em branco para usar o padrão ({formatarFaixa(padrao)}). O tempo mínimo vale para sair deste cargo para o próximo.
        </div>
        {(f.salarioMin !== "" || f.salarioMax !== "") && <button type="button" className="btn claro mini" style={{ marginTop: 6 }} onClick={() => setF({ ...f, salarioMin: "", salarioMax: "" })}>Voltar ao padrão do plano</button>}
        {msg && <div className="aviso marca peq" style={{ marginTop: 8 }}>{msg}</div>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button type="button" className="btn claro" onClick={aoFechar}>Fechar</button>
        <button type="button" className="btn" onClick={salvar}>Salvar ajustes</button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------ Histórico
function Historico({ movs, c }) {
  const pag = usePaginacao(movs, 10);
  const [doc, setDoc] = useState(null);
  if (!movs.length) return <Card><div className="vazio">Nenhuma movimentação registrada. Registre pela aba Pessoas.</div></Card>;
  return (
    <Card semPad>
      <div className="tabela-caixa">
        <table className="tabela-comissao">
          <thead><tr><th>Data</th><th>Pessoa</th><th>De → para</th><th>Tipo</th><th>PCMSO</th><th /></tr></thead>
          <tbody>
            {pag.itens.map((m) => (
              <tr key={m.id}>
                <td className="tnum">{dataCurta(m.data)}</td>
                <td>{nomeProprio(m.nome)}</td>
                <td>{nivelPorId(m.de)?.cargo || m.deTexto || "—"} → <b>{nivelPorId(m.para)?.cargo || "—"}</b></td>
                <td><Chip tom={m.tipoMov === "promocao" ? "marca" : "neutro"}>{nomeTipoMov(m.tipoMov).split(" (")[0]}</Chip></td>
                <td>{m.aso ? <Chip tom={m.asoEm ? "ok" : "alerta"}>{m.asoEm ? `ASO ${dataCurta(m.asoEm)}` : "ASO pendente"}</Chip> : <Chip tom={m.formularioOk ? "ok" : "neutro"}>{m.formularioOk ? "Formulário emitido" : "Formulário"}</Chip>}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button type="button" className="btn claro mini" onClick={() => setDoc(m)}>RMC</button>{" "}
                  <button type="button" className="btn claro mini" onClick={() => window.confirm("Apagar esta movimentação do histórico? O cargo atual da pessoa e a ficha do RH não mudam.") && c.remover("carreira", m.id)}>Apagar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "0 16px 12px" }}><Paginacao pag={pag} rotulo="movimentações" /></div>
      {doc && <JanelaDocumento titulo="Registro de movimentação de cargo (RMC)" aoFechar={() => setDoc(null)}><DocRMC mov={doc} /></JanelaDocumento>}
    </Card>
  );
}
