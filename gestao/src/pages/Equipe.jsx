import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Modal, iniciais, Abas } from "../components/ui.jsx";
import { getSessao } from "../lib/sessao.js";
import { mesAtual, mesesAte, somarMeses, numero, brl, hojeBR, dataCurta } from "../lib/format.js";
import { Orientacao } from "../components/Orientacao.jsx";
import { MetasFuncao } from "./Funcoes.jsx";
import { navegar } from "../lib/rota.js";
import { mediaAnterior, realizado } from "../lib/calculos.js";

const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export default function Equipe() {
  const { equipeAtual: equipe, dados, resumo, gravar, config, elenco, funcaoDe } = useBase();
  const [editando, setEditando] = useState(null);
  const [desligando, setDesligando] = useState(null);
  const ativosRH = new Set(elenco.map((p) => p.id));
  const saiuDoRH = (m) => m.rhPessoaId && elenco.length > 0 && !ativosRH.has(m.rhPessoaId);
  const [msg, setMsg] = useState("");
  const inativos = dados.equipe.filter((m) => m.ativo === false);
  const [aba, setAba] = useState("ativos");

  // Quem teve propostas no CRM nos últimos 3 meses e ainda não está na equipe.
  const vinculados = new Set(dados.equipe.map((m) => m.crmProfileId).filter(Boolean));
  const eu = norm(getSessao()?.nome);
  const candidatos = Object.entries(resumo?.pessoas || {})
    .filter(([id, p]) => !vinculados.has(id) && p.ativo && norm(p.nome) !== eu)
    .map(([id, p]) => ({ id, nome: p.nome, n: mesesAte(somarMeses(mesAtual(), -1), 3).reduce((s, m) => s + realizado(resumo, { crmProfileId: id }, m).enviadas, 0) }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);

  const adicionarCandidatos = async () => {
    setMsg("");
    try {
      let ordem = equipe.length;
      for (const c of candidatos) {
        const metas = {};
        // Vínculo com o RH pelo primeiro e último nome; na dúvida, fica sem.
        const [pri, ...resto] = norm(c.nome).split(" ");
        const ult = resto.at(-1);
        const rh = elenco.filter((p) => { const n = norm(p.nome).split(" "); return n[0] === pri && (!ult || n.includes(ult)); });
        await gravar("equipe", { nome: c.nome, crmProfileId: c.id, rhPessoaId: rh.length === 1 ? rh[0].id : "", funcaoId: "", metas, ativo: true, ordem: ordem++ });
      }
      setMsg(`${candidatos.length} pessoa(s) adicionada(s). Confira funções e metas.`);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <Cabecalho sobre="Equipe e metas" titulo="Quem é avaliado e com quais metas" sub="Cada pessoa é ligada ao seu usuário do CRM (de onde vêm os números) e ao cadastro do RH.">
        <button type="button" className="btn" onClick={() => setEditando({ ativo: true, metas: {} })}>Adicionar pessoa</button>
      </Cabecalho>
      <Orientacao tela="equipe" />
      {dados.funcoes.length === 0 && (
        <div className="aviso alerta">Nenhuma função cadastrada. Cadastre as funções (cargos) para cada pessoa ter metas padrão, critérios e rotina da sua função. <button type="button" className="btn mini claro" onClick={() => navegar("funcoes")}>Ir para Funções</button></div>
      )}
      {equipe.filter(saiuDoRH).map((m) => (
        <div key={m.id} className="aviso ruim">{m.nome} não aparece mais como ativa no RH. Se foi desligada, registre o desligamento aqui. <button type="button" className="btn mini perigo" onClick={() => setDesligando(m)}>Desligar</button></div>
      ))}

      {candidatos.length > 0 && (
        <div className="aviso marca" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <span>Com propostas no CRM nos últimos 3 meses e fora da equipe: <b>{candidatos.map((c) => `${c.nome} (${c.n})`).join(", ")}</b>.</span>
          <button type="button" className="btn mini" onClick={adicionarCandidatos}>Adicionar à equipe</button>
        </div>
      )}
      {msg && <div className="aviso marca">{msg}</div>}

      <Abas valor={aba} aoMudar={setAba} abas={[["ativos", "Equipe ativa", equipe.length], ["desligados", "Desligados", inativos.length], ["regras", "Meta do setor e regras"]]} />

      {aba === "ativos" && <Card semPad>
        <div className="tabela-caixa">
          <table>
            <thead><tr><th>Pessoa</th><th>Vínculos</th><th>Propostas/mês</th><th>Aprovação mín.</th><th>Ligações/dia</th><th /></tr></thead>
            <tbody>
              {equipe.length === 0 && <tr><td colSpan={6} className="suave">Ninguém na equipe ainda.</td></tr>}
              {equipe.map((m) => (
                <tr key={m.id}>
                  <td><div style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="avatar">{iniciais(m.nome)}</span><span><b style={{ display: "block", fontWeight: 600 }}>{m.nome}</b><span className="suave peq">{funcaoDe(m)?.nome || m.funcao || "Sem função"}</span></span></div></td>
                  <td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Chip tom={m.crmProfileId ? "ok" : "alerta"}>{m.crmProfileId ? "CRM" : "Sem CRM"}</Chip><Chip tom={saiuDoRH(m) ? "ruim" : m.rhPessoaId ? "ok" : "neutro"}>{saiuDoRH(m) ? "Inativa no RH" : m.rhPessoaId ? "RH" : "Sem RH"}</Chip>{!m.funcaoId && <Chip tom="alerta">Sem função</Chip>}</div></td>
                  <td className="tnum">{m.metas?.propostas || "—"}</td>
                  <td className="tnum">{m.metas?.aprovacao ? `${m.metas.aprovacao}%` : "—"}</td>
                  <td className="tnum">{m.metas?.ligacoes || "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}><button type="button" className="btn claro mini" onClick={() => setEditando(m)}>Editar</button> <button type="button" className="btn perigo mini" onClick={() => setDesligando(m)}>Desligar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>}
      {aba === "desligados" && inativos.length === 0 && <div className="vazio">Ninguém desligado.</div>}
      {aba === "desligados" && inativos.length > 0 && (
        <Card semPad>
          <div className="card-cab"><h2>Desligados e fora da equipe</h2><span className="suave peq">O histórico (avaliações, feedbacks, ocorrências) continua guardado.</span></div>
          <div className="tabela-caixa">
            <table>
              <tbody>
                {inativos.map((m) => (
                  <tr key={m.id}>
                    <td><b style={{ fontWeight: 600 }}>{m.nome}</b><div className="suave peq">{funcaoDe(m)?.nome || m.funcao}</div></td>
                    <td className="peq">{m.desligadoEm ? `Saiu em ${dataCurta(m.desligadoEm)}` : "Fora da equipe"}{m.tipoSaida ? ` · ${m.tipoSaida}` : ""}</td>
                    <td style={{ textAlign: "right" }}><button type="button" className="btn claro mini" onClick={() => window.confirm(`Reativar ${m.nome} na equipe?`) && gravar("equipe", { ...m, ativo: true, desligadoEm: "", tipoSaida: "" })}>Reativar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {desligando && <Desligar membro={desligando} aoFechar={() => setDesligando(null)} />}

      {aba === "regras" && <Regras config={config} />}
      {editando && <EditorPessoa inicial={editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}

function EditorPessoa({ inicial, aoFechar }) {
  const { resumo, elenco, gravar, dados, setor } = useBase();
  const com = setor === "comercial";
  const [m, setM] = useState({ nome: "", funcao: "", funcaoId: "", crmProfileId: "", rhPessoaId: "", ...inicial, metas: { ...(inicial.metas || {}) } });
  const funcoes = [...dados.funcoes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const escolherFuncao = (id) => {
    const f = dados.funcoes.find((x) => x.id === id);
    setM((x) => {
      const vazias = !numero(x.metas.propostas) && !numero(x.metas.aprovacao) && !numero(x.metas.ligacoes);
      return { ...x, funcaoId: id, funcao: f?.nome || x.funcao, metas: f && vazias ? { ...f.metasPadrao } : x.metas };
    });
  };
  const [erro, setErro] = useState("");
  const perfis = Object.entries(resumo?.pessoas || {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const sugestao = m.crmProfileId ? mediaAnterior(resumo, { crmProfileId: m.crmProfileId }, mesAtual()) : null;
  const setMeta = (k) => (e) => setM((x) => ({ ...x, metas: { ...x.metas, [k]: e.target.value } }));

  const salvar = async () => {
    if (!m.nome.trim()) { setErro("Informe o nome."); return; }
    if (m.crmProfileId && dados.equipe.some((o) => o.id !== m.id && o.crmProfileId === m.crmProfileId && o.ativo !== false)) {
      setErro("Este usuário do CRM já está ligado a outra pessoa da equipe."); return;
    }
    const metas = { propostas: numero(m.metas.propostas), aprovacao: numero(m.metas.aprovacao), ligacoes: numero(m.metas.ligacoes) };
    try { await gravar("equipe", { ...m, nome: m.nome.trim(), metas }); aoFechar(); } catch (e) { setErro(e.message); }
  };

  return (
    <Modal titulo={inicial.id ? `Editar ${inicial.nome}` : "Adicionar pessoa"} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="campo"><label htmlFor="p-nome">Nome</label><input id="p-nome" className="entrada" value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} /></div>
        <div className="campo">
          <label htmlFor="p-func">Função (cargo)</label>
          <select id="p-func" className="entrada" value={m.funcaoId || ""} onChange={(e) => escolherFuncao(e.target.value)}>
            <option value="">— sem função —</option>
            {funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          {funcoes.length === 0 && <span className="suave peq">Cadastre as funções em Gestão › Funções e cargos.</span>}
        </div>
        {com && <div className="campo">
          <label htmlFor="p-crm">Usuário no CRM (de onde vêm os números)</label>
          <select id="p-crm" className="entrada" value={m.crmProfileId || ""} onChange={(e) => {
            const id = e.target.value;
            setM((x) => ({ ...x, crmProfileId: id, nome: x.nome || resumo?.pessoas?.[id]?.nome || "" }));
          }}>
            <option value="">— sem vínculo —</option>
            {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.ativo ? "" : " (inativo)"}</option>)}
          </select>
        </div>}
        <div className="campo">
          <label htmlFor="p-rh">Cadastro no RH</label>
          <select id="p-rh" className="entrada" value={m.rhPessoaId || ""} onChange={(e) => setM({ ...m, rhPessoaId: e.target.value })}>
            <option value="">— sem vínculo —</option>
            {elenco.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="p-entrou">Entrou na equipe em (admissão)</label>
          <input id="p-entrou" className="entrada" type="date" style={{ maxWidth: 200 }} value={m.entrouEm || ""} onChange={(e) => setM({ ...m, entrouEm: e.target.value })} />
          <span className="suave peq">Em branco = aparece em todos os meses. A saída é registrada no botão Desligar; a pessoa deixa de aparecer a partir do mês do desligamento.</span>
        </div>
        {m.funcaoId && dados.funcoes.find((x) => x.id === m.funcaoId) && <MetasFuncao f={dados.funcoes.find((x) => x.id === m.funcaoId)} titulo="Metas da função (vêm da descrição de cargo)" />}
        {com && <>
        <div className="rotulo" style={{ marginTop: 4 }}>Metas medidas pelo CRM (só para quem envia propostas; deixe em branco o que não se aplica)</div>
        {sugestao != null && <div className="suave peq">Média dos últimos 6 meses: {Math.round(sugestao)} propostas. Sugestão de meta (+10%): {Math.round(sugestao * 1.1)}.</div>}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="campo"><label htmlFor="p-m1">Propostas/mês</label><input id="p-m1" className="entrada num" type="number" min="0" value={m.metas.propostas ?? ""} onChange={setMeta("propostas")} /></div>
          <div className="campo"><label htmlFor="p-m2">Aprovação mín. (%)</label><input id="p-m2" className="entrada num" type="number" min="0" max="100" value={m.metas.aprovacao ?? ""} onChange={setMeta("aprovacao")} /></div>
          <div className="campo"><label htmlFor="p-m3">Ligações/dia</label><input id="p-m3" className="entrada num" type="number" min="0" value={m.metas.ligacoes ?? ""} onChange={setMeta("ligacoes")} /></div>
        </div>
        </>}
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" onClick={salvar}>Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

function Regras({ config }) {
  const { gravar } = useBase();
  const [c, setC] = useState(config);
  const [msg, setMsg] = useState("");
  const set = (grupo, k) => (e) => setC((x) => ({ ...x, [grupo]: { ...x[grupo], [k]: e.target.value } }));
  const somaPesos = ["metas", "tec", "comp"].reduce((s, k) => s + (numero(c.pesos[k]) || 0), 0);
  const salvar = async () => {
    if (somaPesos !== 100) { setMsg("Os pesos precisam somar 100%."); return; }
    const n = (v) => numero(v) ?? 0;
    try {
      await gravar("config", {
        id: "geral",
        bonus: { f1: n(c.bonus.f1), v1: n(c.bonus.v1), f2: n(c.bonus.f2), v2: n(c.bonus.v2) },
        pesos: { metas: n(c.pesos.metas), tec: n(c.pesos.tec), comp: n(c.pesos.comp) },
        desconto: n(c.desconto), descontoMax: n(c.descontoMax), metaValorMensal: numero(c.metaValorMensal),
      });
      setMsg("Regras salvas.");
    } catch (e) { setMsg(e.message); }
  };
  const Num = ({ id, rot, valor, onChange, step = "1" }) => (
    <div className="campo"><label htmlFor={id}>{rot}</label><input id={id} className="entrada num" type="number" step={step} value={valor} onChange={onChange} /></div>
  );
  return (
    <Card>
      <h2>Meta do setor e regras de avaliação</h2>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
        <div className="campo"><label htmlFor="r-meta">Meta de valor aprovado no mês (R$)</label><input id="r-meta" className="entrada" style={{ width: 180 }} type="number" min="0" value={c.metaValorMensal ?? ""} onChange={(e) => setC({ ...c, metaValorMensal: e.target.value })} /><span className="suave peq">Usada na previsão do Cockpit.</span></div>
      </div>
      <div className="suave peq" style={{ marginTop: 4 }}>Valem para todos. Por envolver remuneração, valide com a contabilidade antes de comunicar à equipe.</div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 16 }}>
        {Num({ id: "r-f1", rot: "Faixa 1: nota ≥", valor: c.bonus.f1, onChange: set("bonus", "f1"), step: "0.5" })}
        {Num({ id: "r-v1", rot: `Valor (${brl(numero(c.bonus.v1))})`, valor: c.bonus.v1, onChange: set("bonus", "v1") })}
        {Num({ id: "r-f2", rot: "Faixa 2: nota ≥", valor: c.bonus.f2, onChange: set("bonus", "f2"), step: "0.5" })}
        {Num({ id: "r-v2", rot: `Valor (${brl(numero(c.bonus.v2))})`, valor: c.bonus.v2, onChange: set("bonus", "v2") })}
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 16 }}>
        {Num({ id: "r-pm", rot: "Peso metas (%)", valor: c.pesos.metas, onChange: set("pesos", "metas") })}
        {Num({ id: "r-pt", rot: "Peso técnicos (%)", valor: c.pesos.tec, onChange: set("pesos", "tec") })}
        {Num({ id: "r-pc", rot: "Peso comportamentais (%)", valor: c.pesos.comp, onChange: set("pesos", "comp") })}
        {Num({ id: "r-d", rot: "Desconto por ocorrência", valor: c.desconto, onChange: (e) => setC({ ...c, desconto: e.target.value }), step: "0.5" })}
        {Num({ id: "r-dm", rot: "Desconto máximo", valor: c.descontoMax, onChange: (e) => setC({ ...c, descontoMax: e.target.value }), step: "0.5" })}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
        <button type="button" className="btn" onClick={salvar}>Salvar regras</button>
        <span className="peq" style={{ color: somaPesos === 100 ? "var(--suave)" : "var(--ruim)" }}>Pesos somam {somaPesos}%</span>
        {msg && <span className="peq">{msg}</span>}
      </div>
    </Card>
  );
}

function Desligar({ membro, aoFechar }) {
  const { gravar } = useBase();
  const [data, setData] = useState(hojeBR());
  const [tipo, setTipo] = useState("Desligamento");
  const [erro, setErro] = useState("");
  const confirmar = async () => {
    try {
      await gravar("equipe", { ...membro, ativo: false, desligadoEm: data, tipoSaida: tipo });
      aoFechar();
    } catch (e) { setErro(e.message); }
  };
  return (
    <Modal titulo={`Desligar ${membro.nome}`} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p className="peq" style={{ margin: 0 }}>A pessoa sai da equipe, das metas, da avaliação e das reuniões a partir de agora. Avaliações, feedbacks e ocorrências antigos continuam guardados. O cadastro no RH e no CRM não muda: o desligamento oficial é feito no RH do painel e o usuário do CRM é desativado no próprio CRM.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="campo"><label htmlFor="d-data">Data de saída</label><input id="d-data" type="date" className="entrada" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="campo" style={{ flex: "1 1 200px" }}>
            <label htmlFor="d-tipo">Tipo</label>
            <select id="d-tipo" className="entrada" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option>Desligamento</option><option>Pedido de demissão</option><option>Mudança de setor</option><option>Fim de contrato</option><option>Outro</option>
            </select>
          </div>
        </div>
        <div className="suave peq">Por ser dado pessoal, o motivo detalhado não é registrado aqui.</div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn perigo" onClick={confirmar}>Confirmar desligamento</button>
        </div>
      </div>
    </Modal>
  );
}
