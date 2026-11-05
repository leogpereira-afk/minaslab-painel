// Cadastro → Cliente / Fornecedor, fiel ao GerenciaLab:
//  - Lista com os botões e colunas do GerenciaLab (Status filtra).
//  - Adicionar Cliente (endereço com busca pelo CEP; vira o endereço Principal).
//  - "Detalhes da Cliente": cabeçalho e abas Detalhes, Endereços, Contratos,
//    Ordem de serviços, Amostras, Unidades, Histórico, Financeiro e
//    Permissão de acesso.

import { useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { estaAtivo } from "../lib/cadastros.js";
import { numeroContrato, totalContrato } from "../lib/contratos.js";
import { numeroOS, statusDaOS, referenciaAmostra } from "../lib/ordens.js";
import { erroCliente, normalizarCliente, enderecoPrincipal, enderecosDoCliente, erroAcesso, tipoCadastro, TIPOS_CADASTRO, TIPOS_ENDERECO_CLIENTE, INADIMPLENCIA, PERMISSOES_ACESSO, UFS } from "../lib/clientes.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, Modal, RotuloStatus, opcoes, useAviso } from "../components/ui.jsx";
import { useForm, completarCep, TabelaEnderecos } from "../components/Enderecos.jsx";

const quando = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

const COLUNAS = [
  { t: "ID", v: (r) => Number(r.cod) || 0 },
  { t: "Status", v: (r) => r.status, h: (r) => <RotuloStatus status={r.status} /> },
  { t: "Nome responsável", v: (r) => r.resp },
  { t: "Razão social", v: (r) => r.razao },
  { t: "Nome fantasia", v: (r) => r.fantasia },
  { t: "CNPJ", v: (r) => r.doc },
  { t: "E-mail", v: (r) => r.email },
  { t: "Criado", v: (r) => r.criadoEm || "", h: (r) => quando(r.criadoEm), fv: (r) => quando(r.criadoEm) },
  { t: "Modificado", v: (r) => r.atualizadoEm || "", h: (r) => quando(r.atualizadoEm), fv: (r) => quando(r.atualizadoEm) },
  { t: "Observações", v: (r) => r.obs },
];

export function ListaClientes() {
  const { dados } = useDados();
  const [sel, setSel] = useState(new Set());
  const [status, setStatus] = useState("Todos");
  const linhas = status === "Todos" ? dados.clientes : dados.clientes.filter((c) => (c.status || "Ativo") === status);
  return (
    <Caixa titulo="Clientes e Fornecedores">
      <Grade id="cli" exportar="clientes" linhas={linhas} colunas={COLUNAS} selecao={sel} aoSelecionar={setSel} multipla
        aoAbrir={(l) => navegar("cliente", l.id)}
        botoes={[
          { rotulo: "Selecionar todos", acao: () => setSel(new Set(linhas.map((c) => c.id))) },
          { rotulo: "Deselecionar todos", acao: () => setSel(new Set()), desativado: !sel.size },
          { rotulo: "Visualizar", acao: () => navegar("cliente", [...sel][0]), desativado: sel.size !== 1 },
          { rotulo: "Novo Cliente", acao: () => navegar("customer-register") },
          { rotulo: "Status", menu: ["Todos", "Ativo", "Inativo"].map((o) => ({ rotulo: o, marcado: status === o, padrao: o === "Todos", acao: () => { setStatus(o); setSel(new Set()); } })) },
        ]} />
    </Caixa>
  );
}

const VAZIO = { pessoa: "PJ", tipo: "Cliente", resp: "", tel: "", cel: "", doc: "", razao: "", fantasia: "", ie: "", im: "", cep: "", end: "", num: "", comp: "", bairro: "", cidade: "", uf: "", email: "" };

export function FormCliente({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const existente = param ? dados.clientes.find((c) => c.id === param) : null;
  const [ocupado, setOcupado] = useState(false);
  const [f, setF] = useState(() => ({ ...VAZIO, ...(existente || {}), tipo: tipoCadastro(existente?.tipo) }));
  const [boasVindas, setBoasVindas] = useState(!existente);
  if (param && !existente) return <NaoAchou />;
  const pf = f.pessoa === "PF";
  const muda = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const Campo = (id, rotulo, cls, tipo = "text", ph) => (
    <div className={`fg ${cls}`}><label htmlFor={id}>{rotulo}</label><input id={id} type={tipo} placeholder={ph || rotulo} value={f[id] || ""} onChange={muda(id)} /></div>
  );
  const gravar = async (e) => {
    e.preventDefault();
    const erro = erroCliente(f);
    if (erro) { avisar(erro[1], "err"); document.getElementById(erro[0])?.focus(); return; }
    setOcupado(true);
    try {
      const n = normalizarCliente(f);
      const r = await salvar("clientes", { ...n, status: existente?.status || "Ativo", obs: existente?.obs || "", ...(existente ? {} : { enderecos: [enderecoPrincipal(n)] }) }, { numerar: !existente });
      avisar(existente ? "Cliente atualizado." : boasVindas ? "Cliente cadastrado. O e-mail de boas-vindas entra quando a Configuração Email estiver ligada." : "Cliente cadastrado.", "ok");
      navegar("cliente", r.id);
    } catch (ex) { avisar(ex.message, "err"); } finally { setOcupado(false); }
  };
  return (
    <Caixa titulo={existente ? "Editar Cliente" : "Adicionar Cliente"}>
      <form className="frm" onSubmit={gravar} noValidate>
        <div className="s12 radios" role="radiogroup" aria-label="Tipo de pessoa">
          <label><input type="radio" name="pessoa" checked={!pf} onChange={() => setF((x) => ({ ...x, pessoa: "PJ" }))} /> Pessoa Jurídica</label>
          <label><input type="radio" name="pessoa" checked={pf} onChange={() => setF((x) => ({ ...x, pessoa: "PF" }))} /> Pessoa Física</label>
        </div>
        <div className="fg s3"><label htmlFor="tipo">Tipo de cadastro</label><select id="tipo" value={f.tipo} onChange={muda("tipo")}>{opcoes(TIPOS_CADASTRO)}</select></div>
        <div className="quebra-linha" />
        {Campo("resp", "Nome do Responsável", "s5")}
        <div className="quebra-linha" />
        {Campo("tel", "Telefone", "s5")}{Campo("cel", "Celular", "s5")}
        <div className="quebra-linha" />
        {Campo("doc", pf ? "CPF" : "CNPJ", "s5", "text", pf ? "000.000.000-00" : "00.000.000/0000-00")}
        {!pf && <>{Campo("razao", "Razão Social", "s5")}{Campo("fantasia", "Nome Fantasia", "s5")}{Campo("ie", "Inscrição Estadual", "s3")}{Campo("im", "Inscrição Municipal", "s3")}</>}
        <div className="quebra-linha" />
        <div className="fg s4"><label htmlFor="cep">CEP</label><input id="cep" placeholder="CEP" value={f.cep || ""} onChange={muda("cep")} onBlur={() => completarCep(f, setF)} /></div>{Campo("end", "Endereço", "s4")}{Campo("num", "Número", "s2")}{Campo("comp", "Complemento", "s2")}
        {Campo("bairro", "Bairro", "s4")}{Campo("cidade", "Cidade", "s4")}
        <div className="fg s2"><label htmlFor="uf">Estado</label><select id="uf" value={f.uf} onChange={muda("uf")}>{opcoes([["", "Selecione"], ...UFS])}</select></div>
        <div className="quebra-linha" />
        {Campo("email", "E-mail", "s5", "email")}
        <div className="fg s5"><span className="rot">Enviar email de boas vindas?</span><label className="radios"><input type="checkbox" checked={boasVindas} onChange={(e) => setBoasVindas(e.target.checked)} /> Sim</label></div>
        <div className="s12 acoes" style={{ marginTop: 8 }}><button type="submit" className="btn btn-primary" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</button><a className="btn btn-default" href={existente ? link("cliente", existente.id) : link("customers")}>Voltar</a></div>
      </form>
    </Caixa>
  );
}

/* ---------- Detalhes da Cliente (ficha com abas, como no GerenciaLab) ---------- */

const ABAS = ["Detalhes", "Endereços", "Contratos", "Ordem de serviços", "Amostras", "Unidades", "Histórico", "Financeiro", "Permissão de acesso"];
const lerAba = (id) => { try { return sessionStorage.getItem(`lims:aba-cliente:${id}`) || "Detalhes"; } catch { return "Detalhes"; } };
const gravarAba = (id, a) => { try { sessionStorage.setItem(`lims:aba-cliente:${id}`, a); } catch { /* sem armazenamento */ } };

function AbaDetalhes({ c, gravar }) {
  const { dados } = useDados();
  const avisar = useAviso();
  const { f, set, campo, selecao } = useForm(() => ({ pessoa: "PJ", fantasia: "", ie: "", im: "", carteira: "Liberado", autorizarOS: "Sim", acessoParcial: "Não", inadimplencia: "Não", segmentacao: "Padrão", cnpjFaturamento: "", obs: "", ...c, tipo: tipoCadastro(c.tipo), status: c.status || "Ativo" }));
  const [ocupado, setOcupado] = useState(false);
  const pf = f.pessoa === "PF";
  const carteiras = ["Liberado", ...dados.funcionarios.filter(estaAtivo).map((x) => x.nome)];
  const empresas = [["", "Selecione"], ...dados.config_nfs.filter(estaAtivo).map((e) => [e.id, `${e.empresa}${e.cnpj ? ` - ${e.cnpj}` : ""}`])];
  const salvar = async (e) => {
    e.preventDefault();
    const erro = erroCliente(f);
    if (erro) { avisar(erro[1], "err"); document.getElementById(erro[0])?.focus(); return; }
    setOcupado(true);
    try { await gravar({ ...c, ...normalizarCliente(f), enderecos: c.enderecos, unidades: c.unidades, acessos: c.acessos, historico: c.historico }, "Dados cadastrais alterados"); avisar("Cliente atualizado.", "ok"); }
    catch { /* aviso já mostrado */ } finally { setOcupado(false); }
  };
  return (
    <form className="frm" onSubmit={salvar} noValidate>
      <h3 className="s12 sub-titulo">Dados cadastrais</h3>
      <div className="fg s12"><span className="rot">Tipo de Cadastro</span>
        <div className="radios" role="radiogroup"><label><input type="radio" name="pessoa" checked={pf} onChange={() => set("pessoa", "PF")} /> Pessoa Física</label><label><input type="radio" name="pessoa" checked={!pf} onChange={() => set("pessoa", "PJ")} /> Pessoa Jurídica</label></div></div>
      {selecao("tipo", "tipo", "Cadastro", TIPOS_CADASTRO)}{selecao("carteira", "carteira", "Carteira", carteiras)}
      {campo("resp", "resp", "Nome do Responsável")}
      {!pf && <>{campo("fantasia", "fantasia", "Nome Fantasia")}{campo("razao", "razao", "Razão Social")}</>}
      {campo("doc", "doc", pf ? "CPF" : "CNPJ")}
      {!pf && <>{campo("ie", "ie", "Inscrição Estadual")}{campo("im", "im", "Inscrição Municipal")}</>}
      {selecao("autorizarOS", "autorizarOS", "Autorizar ordem de serviço", ["Sim", "Não"])}{selecao("status", "status", "Ativo", ["Ativo", "Inativo"])}
      {selecao("acessoParcial", "acessoParcial", "Acesso parcial aos resultados", ["Sim", "Não"])}{selecao("inadimplencia", "inadimplencia", "Inadimplência financeira", INADIMPLENCIA)}
      {selecao("segmentacao", "segmentacao", "Segmentação", ["Padrão", "Indústria", "Saneamento", "Alimentos", "Agronegócio", "Órgão público", "Pessoa física"])}{selecao("cnpjFaturamento", "cnpjFaturamento", "CNPJ Faturamento", empresas)}
      <div className="fg s12"><label htmlFor="obs">Observações da Conta</label><textarea id="obs" rows={3} value={f.obs || ""} onChange={(e) => set("obs", e.target.value)} /></div>
      <div className="s12 acoes"><button type="submit" className="btn btn-primary" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar alteração"}</button><a className="btn btn-default" href={link("customers")}>Voltar</a></div>
    </form>
  );
}

function AbaUnidades({ c, gravar }) {
  const { dados } = useDados();
  const avisar = useAviso();
  const [janela, setJanela] = useState(null);
  const lista = c.unidades || [];
  const salvarUnidade = async (u) => {
    if (!String(u.nome || "").trim()) { avisar("Informe o nome da unidade.", "err"); return false; }
    const nova = u.id ? lista.map((x) => (x.id === u.id ? u : x)) : [...lista, { ...u, id: `u${Date.now().toString(36)}` }];
    try { await gravar({ ...c, unidades: nova }, u.id ? `Unidade alterada (${u.nome})` : `Unidade adicionada (${u.nome})`); avisar("Unidade salva.", "ok"); } catch { return false; }
  };
  return (
    <>
      <div className="acoes" style={{ marginBottom: 10 }}><button type="button" className="btn btn-info" onClick={() => setJanela({ nome: "", razao: c.razao || "", doc: "", tel: "", regiao: "", cep: "", end: "", num: "", comp: "", bairro: "", cidade: "", uf: "", email: "", status: "Ativo" })}>Adicionar unidade</button></div>
      <div className="tw"><table>
        <thead><tr><th>#</th><th>Unidade</th><th>Razão Social</th><th>CNPJ</th><th>Telefone</th><th>E-mail</th><th>Endereço</th><th>Status</th><th>ação</th></tr></thead>
        <tbody>{lista.length ? lista.map((u, i) => (
          <tr key={u.id}><td>{i + 1}</td><td>{u.nome}</td><td>{u.razao}</td><td>{u.doc}</td><td>{u.tel}</td><td>{u.email}</td>
            <td className="quebra">{[u.end && `${u.end}${u.num ? `, ${u.num}` : ""}`, u.bairro, u.cidade && `${u.cidade}/${u.uf}`].filter(Boolean).join(" · ")}</td>
            <td><span className={`lbl ${u.status === "Inativo" ? "off" : "ok"}`}>{u.status || "Ativo"}</span></td>
            <td><button type="button" className="btn btn-default btn-sm" onClick={() => setJanela({ ...u })}>Editar</button></td></tr>
        )) : <tr><td colSpan={9} className="vazio">Nenhuma unidade. Use “Adicionar unidade”.</td></tr>}</tbody>
      </table></div>
      {janela && <JanelaUnidade inicial={janela} regioes={dados.grupos_regionais} onFechar={() => setJanela(null)} aoSalvar={salvarUnidade} />}
    </>
  );
}

function JanelaUnidade({ inicial, regioes, onFechar, aoSalvar }) {
  const { f, setF, campo, selecao } = useForm(inicial);
  return (
    <Modal titulo={inicial.id ? "Editar unidade" : "Adicionar unidade"} largo onFechar={onFechar} rotuloOk="Salvar" aoConfirmar={() => aoSalvar(f)}>
      <div className="frm">
        {campo("uNome", "nome", "Nome da Unidade")}{campo("uRazao", "razao", "Razão Social")}{campo("uDoc", "doc", "CNPJ")}
        {campo("uTel", "tel", "Telefone")}{selecao("uReg", "regiao", "Grupo regional", [["", "—"], ...regioes.map((g) => [g.id, g.nome])])}{campo("uEmail", "email", "Email", "s4", { tipo: "email" })}
        {campo("uCep", "cep", "CEP", "s3", { onBlur: () => completarCep(f, setF) })}{campo("uEnd", "end", "Endereço", "s5")}{campo("uNum", "num", "Número", "s2")}{campo("uComp", "comp", "Complemento", "s2")}
        {campo("uBairro", "bairro", "Bairro")}{campo("uCidade", "cidade", "Cidade")}{selecao("uUf", "uf", "Estado", [["", "Selecione"], ...UFS], "s2")}{selecao("uStatus", "status", "Ativo", ["Ativo", "Inativo"], "s2")}
        <p className="s12 suave" style={{ margin: 0 }}>O acesso da unidade ao portal do cliente (usuário e senha) fica em “Permissão de acesso”.</p>
      </div>
    </Modal>
  );
}

function AbaHistorico({ c, gravar }) {
  const { eu } = useDados();
  const avisar = useAviso();
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const lista = [...(c.historico || [])].reverse();
  return (
    <>
      <div className="acoes" style={{ marginBottom: 10 }}><button type="button" className="btn btn-info" onClick={() => setAberto(true)}>Adicionar</button></div>
      <div className="tw"><table>
        <thead><tr><th>Data</th><th>Usuário</th><th>Histórico</th></tr></thead>
        <tbody>{lista.length ? lista.map((h, i) => <tr key={i}><td>{quando(h.em)}</td><td>{h.por}</td><td className="quebra">{h.texto}</td></tr>) : <tr><td colSpan={3} className="vazio">Nenhum histórico.</td></tr>}</tbody>
      </table></div>
      {aberto && (
        <Modal titulo="Adicionar Histórico" onFechar={() => setAberto(false)} rotuloOk="Salvar" aoConfirmar={async () => {
          if (!texto.trim()) { avisar("Escreva o histórico.", "err"); return false; }
          try { await gravar({ ...c, historico: [...(c.historico || []), { em: new Date().toISOString(), por: eu?.nome || eu?.usuario || "", texto: texto.trim() }] }, "Histórico adicionado"); setTexto(""); avisar("Histórico salvo.", "ok"); } catch { return false; }
        }}>
          <div className="fg"><label htmlFor="hTexto">Histórico</label><textarea id="hTexto" rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} /></div>
        </Modal>
      )}
    </>
  );
}

function AbaAcessos({ c, gravar }) {
  const avisar = useAviso();
  const [janela, setJanela] = useState(null);
  const lista = c.acessos || [];
  const unidades = (c.unidades || []).map((u) => u.nome);
  const salvarAcesso = async (a) => {
    const erro = erroAcesso(a);
    if (erro) { avisar(erro[1], "err"); document.getElementById(erro[0])?.focus(); return false; }
    const nova = a.id ? lista.map((x) => (x.id === a.id ? a : x)) : [...lista, { ...a, id: `a${Date.now().toString(36)}` }];
    try { await gravar({ ...c, acessos: nova }, a.id ? `Acesso alterado (${a.email})` : `Acesso adicionado (${a.email})`); avisar("Acesso salvo.", "ok"); } catch { return false; }
  };
  const sn = (a, p) => (a.permissoes || []).includes(p) ? "Sim" : "Não";
  return (
    <>
      <p className="suave" style={{ marginTop: 0 }}>Usuários do cliente para o portal (baixar resultados, ver propostas e contratos). O portal entra numa etapa seguinte; aqui já fica quem pode o quê.</p>
      <div className="acoes" style={{ marginBottom: 10 }}><button type="button" className="btn btn-info" onClick={() => setJanela({ nome: "", cel: "", email: "", permissoes: ["Download"], unidades: ["Todas"], ativo: "Sim" })}>Adicionar</button></div>
      <div className="tw"><table>
        <thead><tr><th>Id</th><th>Nome</th><th>E-mail</th><th>Celular</th><th>administrador</th><th>Permissão proposta</th><th>Permissão coleta</th><th>Permissão contrato</th><th>Permissão Download</th><th>Ativo</th><th /></tr></thead>
        <tbody>{lista.length ? lista.map((a, i) => (
          <tr key={a.id}><td>{i + 1}</td><td>{a.nome}</td><td>{a.email}</td><td>{a.cel}</td><td>{sn(a, "Administrador")}</td><td>{sn(a, "Proposta")}</td><td>{sn(a, "Coleta")}</td><td>{sn(a, "Contrato")}</td><td>{sn(a, "Download")}</td><td>{a.ativo || "Sim"}</td>
            <td><button type="button" className="btn btn-default btn-sm" onClick={() => setJanela({ ...a })}>Alterar</button></td></tr>
        )) : <tr><td colSpan={11} className="vazio">Nenhum usuário.</td></tr>}</tbody>
      </table></div>
      {janela && (
        <JanelaAcesso inicial={janela} unidades={unidades} onFechar={() => setJanela(null)} aoSalvar={salvarAcesso} />
      )}
    </>
  );
}

function JanelaAcesso({ inicial, unidades, onFechar, aoSalvar }) {
  const { f, set, campo, selecao } = useForm(inicial);
  const marcar = (k, v, on) => set(k, on ? [...new Set([...(f[k] || []), v])] : (f[k] || []).filter((x) => x !== v));
  return (
    <Modal titulo={inicial.id ? "Alterar Usuário" : "Adicionar Usuário"} onFechar={onFechar} rotuloOk="Salvar" aoConfirmar={() => aoSalvar(f)}>
      <div className="frm">
        {campo("aNome", "nome", "Nome completo", "s12")}{campo("aCel", "cel", "Celular", "s6")}{campo("aEmail", "email", "E-mail", "s6", { tipo: "email" })}
        <div className="fg s12"><span className="rot">Permissão</span><div className="radios" id="aPerm">{PERMISSOES_ACESSO.map((p) => <label key={p}><input type="checkbox" checked={(f.permissoes || []).includes(p)} onChange={(e) => marcar("permissoes", p, e.target.checked)} /> {p}</label>)}</div></div>
        <div className="fg s12"><span className="rot">Unidade</span><div className="radios">{["Todas", ...unidades].map((u) => <label key={u}><input type="checkbox" checked={(f.unidades || []).includes(u)} onChange={(e) => marcar("unidades", u, e.target.checked)} /> {u}</label>)}</div></div>
        {selecao("aAtivo", "ativo", "Ativo", ["Sim", "Não"], "s4")}
      </div>
    </Modal>
  );
}

export function VerCliente({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [aba, setAba] = useState(() => lerAba(param));
  const c = dados.clientes.find((x) => x.id === param);
  if (!c) return <NaoAchou />;
  const gravar = async (novo, motivo) => {
    try { return await salvar("clientes", novo, { motivo }); } catch (e) { avisar(e.message, "err"); throw e; }
  };
  const trocar = (a) => { setAba(a); gravarAba(c.id, a); };
  const contratos = dados.contratos.filter((x) => x.clienteId === c.id);
  const ordens = dados.ordens.filter((o) => o.clienteId === c.id);
  const amostras = dados.amostras.filter((a) => a.clienteId === c.id);
  const faturas = dados.contas_receber.filter((r) => r.clienteId === c.id);
  const cert = (a) => dados.certificados.find((x) => x.amostraId === a.id && !x.substituidoPor);
  const tabela = (cab, linhas, vazio) => (
    <div className="tw"><table><thead><tr>{cab.map((t) => <th key={t}>{t}</th>)}</tr></thead>
      <tbody>{linhas.length ? linhas : <tr><td colSpan={cab.length} className="vazio">{vazio}</td></tr>}</tbody></table></div>
  );
  return (
    <>
      <div className="box cliente-topo">
        <div><b>Razão Social:</b> {c.razao}</div>
        <div><b>{c.pessoa === "PF" ? "CPF" : "CNPJ"}:</b> {c.doc}</div>
        <div><b>Status:</b> <RotuloStatus status={c.status || "Ativo"} />{c.inadimplencia && c.inadimplencia !== "Não" && <span className="lbl crit" style={{ marginLeft: 6 }}>Inadimplência: {c.inadimplencia}</span>}</div>
      </div>
      <div className="box abas-box">
        <div className="abas-ficha" role="tablist">{ABAS.map((a) => <button key={a} type="button" role="tab" aria-selected={aba === a} className={aba === a ? "on" : ""} onClick={() => trocar(a)}>{a}{a === "Histórico" && <span className="badge-n">{(c.historico || []).length}</span>}</button>)}</div>
        <div className="abas-corpo">
          {aba === "Detalhes" && <AbaDetalhes key={c.atualizadoEm} c={c} gravar={gravar} />}
          {aba === "Endereços" && <TabelaEnderecos enderecos={enderecosDoCliente(c)} tipos={TIPOS_ENDERECO_CLIENTE} completo base={{ responsavel: c.resp || "", email: c.email || "", tel: c.tel || "", cel: c.cel || "" }}
            aoGravar={async (lista, motivo) => { try { await gravar({ ...c, enderecos: lista }, motivo); avisar("Endereços atualizados.", "ok"); } catch { return false; } }} />}
          {aba === "Contratos" && tabela(["Numero do Contrato", "Proposta", "Data de Inicio", "Data de Termino", "Valor do Contrato", "Status"],
            contratos.map((k) => <tr key={k.id} className="clicavel" onClick={() => navegar("contract", k.id)}><td>{numeroContrato(k)}</td><td>{k.proposta}</td><td>{dataBR(k.inicio)}</td><td>{dataBR(k.fim)}</td><td>{brl(totalContrato(k))}</td><td><span className={`lbl ${k.status === "Ativo" ? "ok" : "off"}`}>{k.status}</span></td></tr>), "Nenhum contrato.")}
          {aba === "Ordem de serviços" && tabela(["Ordem Serviço", "Contrato", "Status", "Amostras", "Data da coleta", "Criada"],
            ordens.map((o) => { const am = dados.amostras.filter((a) => a.osId === o.id); return <tr key={o.id} className="clicavel" onClick={() => navegar("ordem", o.id)}><td>{numeroOS(o)}</td><td>{o.contrato}</td><td>{statusDaOS(am)}</td><td>{am.length}</td><td>{quando(o.dataColeta)}</td><td>{quando(o.criadoEm)}</td></tr>; }), "Nenhuma ordem de serviço.")}
          {aba === "Amostras" && tabela(["Amostra ID", "Contrato", "Ordem Serviço", "Código barra", "Referência", "Descrição", "Data da coleta", "Data da assinatura", "Certificado"],
            amostras.map((a) => { const k = cert(a); return <tr key={a.id} className="clicavel" onClick={() => navegar(k ? "certificado" : "ordem", a.osId)}><td>{a.cod}</td><td>{dados.ordens.find((o) => o.id === a.osId)?.contrato}</td><td>{a.os}</td><td>{a.barra}</td><td>{referenciaAmostra(a)}</td><td>{a.identificacao || a.servico}</td><td>{quando(a.dataColeta)}</td><td>{quando(a.dataAssinatura)}</td><td>{k ? `${k.numero}${k.revisao ? ` rev. ${k.revisao}` : ""}` : "—"}</td></tr>; }), "Nenhuma amostra.")}
          {aba === "Unidades" && <AbaUnidades c={c} gravar={gravar} />}
          {aba === "Histórico" && <AbaHistorico c={c} gravar={gravar} />}
          {aba === "Financeiro" && tabela(["Fatura Id", "Contrato", "Data", "Descrição", "Total", "Status"],
            faturas.map((r) => <tr key={r.id} className="clicavel" onClick={() => navegar("bills-to-receive")}><td>{r.cod}</td><td>{r.contrato}</td><td>{dataBR(r.venc)}</td><td>{r.descricao}</td><td>{brl(r.valor)}</td><td>{r.status === "Em aberto" && r.venc < isoDia(0) ? "Vencido" : r.status}</td></tr>), "Nenhuma fatura.")}
          {aba === "Permissão de acesso" && <AbaAcessos c={c} gravar={gravar} />}
        </div>
      </div>
    </>
  );
}

export function NaoAchou() {
  return <Caixa titulo="Registro não encontrado"><p style={{ margin: 0 }}>Este registro não existe ou foi removido. <a href={link("dashboard")}>Voltar ao Dashboard</a></p></Caixa>;
}
