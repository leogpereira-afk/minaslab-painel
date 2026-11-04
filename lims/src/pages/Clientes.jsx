// Cadastro → Cliente / Fornecedor: lista, Adicionar, Editar e Visualizar,
// com os mesmos botões, colunas e campos do GerenciaLab.

import { useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";

import { erroCliente, normalizarCliente, TIPOS_CADASTRO, UFS } from "../lib/clientes.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, RotuloStatus, opcoes, useAviso } from "../components/ui.jsx";

const AVISO_EXPORTAR = "A exportação em Excel, PDF e impressão entra numa próxima etapa.";
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
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const alternarStatus = async () => {
    try {
      for (const c of dados.clientes.filter((x) => sel.has(x.id))) await salvar("clientes", { ...c, status: c.status === "Ativo" ? "Inativo" : "Ativo" });
      avisar(`Status alterado em ${sel.size} registro(s).`, "ok");
    } catch (e) { avisar(e.message, "err"); }
  };
  return (
    <Caixa titulo="Clientes e Fornecedores">
      <Grade id="cli" linhas={dados.clientes} colunas={COLUNAS} selecao={sel} aoSelecionar={setSel} multipla
        aoAbrir={(l) => navegar("cliente", l.id)}
        botoes={[
          { rotulo: "Selecionar todos", acao: () => setSel(new Set(dados.clientes.map((c) => c.id))) },
          { rotulo: "Deselecionar todos", acao: () => setSel(new Set()), desativado: !sel.size },
          { rotulo: "Criar Excel", acao: () => avisar(AVISO_EXPORTAR) },
          { rotulo: "Criar PDF", acao: () => avisar(AVISO_EXPORTAR) },
          { rotulo: "Imprimir", acao: () => avisar(AVISO_EXPORTAR) },
          { rotulo: "Visualizar", acao: () => navegar("cliente", [...sel][0]), desativado: sel.size !== 1 },
          { rotulo: "Novo Cliente", acao: () => navegar("customer-register") },
          { rotulo: "Status", acao: alternarStatus, desativado: !sel.size },
        ]} />
    </Caixa>
  );
}

const VAZIO = { pessoa: "PJ", tipo: "Cliente", resp: "", tel: "", cel: "", doc: "", razao: "", fantasia: "", ie: "", im: "", cep: "", end: "", num: "", comp: "", bairro: "", cidade: "", uf: "MG", email: "" };

export function FormCliente({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const existente = param ? dados.clientes.find((c) => c.id === param) : null;
  const [ocupado, setOcupado] = useState(false);
  const [f, setF] = useState(() => ({ ...VAZIO, ...(existente || {}) }));
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
      const r = await salvar("clientes", { ...normalizarCliente(f), status: existente?.status || "Ativo", obs: existente?.obs || "" }, { numerar: !existente });
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
        {Campo("cep", "CEP", "s4")}{Campo("end", "Endereço", "s4")}{Campo("num", "Número", "s2")}{Campo("comp", "Complemento", "s2")}
        {Campo("bairro", "Bairro", "s4")}{Campo("cidade", "Cidade", "s4")}
        <div className="fg s2"><label htmlFor="uf">Estado</label><select id="uf" value={f.uf} onChange={muda("uf")}>{opcoes(UFS)}</select></div>
        <div className="quebra-linha" />
        {Campo("email", "E-mail", "s5", "email")}
        <div className="fg s5"><span className="rot">Enviar email de boas vindas?</span><label className="radios"><input type="checkbox" checked={boasVindas} onChange={(e) => setBoasVindas(e.target.checked)} /> Sim</label></div>
        <div className="s12 acoes" style={{ marginTop: 8 }}><button type="submit" className="btn btn-primary" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</button><a className="btn btn-default" href={existente ? link("cliente", existente.id) : link("customers")}>Voltar</a></div>
      </form>
    </Caixa>
  );
}

export function VerCliente({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const c = dados.clientes.find((x) => x.id === param);
  if (!c) return <NaoAchou />;
  const campos = [["ID", c.cod], ["Status", <RotuloStatus key="s" status={c.status} />], ["Tipo de cadastro", c.tipo], ["Pessoa", c.pessoa === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"],
    ["Nome do Responsável", c.resp], [c.pessoa === "PJ" ? "CNPJ" : "CPF", c.doc], ["Razão Social", c.razao], ["Nome Fantasia", c.fantasia || "—"], ["Telefone", c.tel], ["Celular", c.cel],
    ["E-mail", c.email], ["CEP", c.cep], ["Endereço", `${c.end}, ${c.num}${c.comp ? ` - ${c.comp}` : ""}`], ["Bairro", c.bairro], ["Cidade / Estado", `${c.cidade} / ${c.uf}`],
    ["Criado", `${quando(c.criadoEm)} por ${c.criadoPor || ""}`], ["Modificado", `${quando(c.atualizadoEm)} por ${c.atualizadoPor || ""}`], ["Observações", c.obs || "—"]];
  const solic = dados.solicitantes.filter((s) => s.cliente === c.razao);
  const propostas = dados.propostas.filter((p) => p.clienteId === c.id);
  const alternar = async () => {
    try { await salvar("clientes", { ...c, status: c.status === "Ativo" ? "Inativo" : "Ativo" }); avisar(c.status === "Ativo" ? "Cliente inativado." : "Cliente ativado.", "ok"); }
    catch (e) { avisar(e.message, "err"); }
  };
  return (
    <>
      <div className="box">
        <div className="box-head-row"><h2 className="box-title">{c.razao}</h2>
          <div className="acoes"><a className="btn btn-primary" href={link("cliente-editar", c.id)}>Editar</a><button type="button" className="btn btn-default" onClick={alternar}>{c.status === "Ativo" ? "Inativar" : "Ativar"}</button><a className="btn btn-default" href={link("customers")}>Voltar</a></div>
        </div>
        <dl className="detail">{campos.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </div>
      <Caixa titulo="Solicitantes vinculados">
        {solic.length ? <div className="tw"><table><thead><tr><th>ID</th><th>Nome</th><th>E-mail</th><th>Telefone</th></tr></thead><tbody>{solic.map((s) => <tr key={s.id}><td>{s.id}</td><td>{s.nome}</td><td>{s.email}</td><td>{s.tel}</td></tr>)}</tbody></table></div>
          : <p className="suave" style={{ margin: 0 }}>Nenhum solicitante vinculado. <a href={link("solicitantes")}>Cadastrar solicitante</a></p>}
      </Caixa>
      <Caixa titulo="Propostas do cliente">
        {propostas.length ? <p style={{ margin: 0 }}>{propostas.length} proposta(s). <a href={link("proposedlist")}>Abrir Listar Propostas</a></p> : <p className="suave" style={{ margin: 0 }}>Nenhuma proposta. <a href={link("criar-proposta")}>Criar proposta</a></p>}
      </Caixa>
    </>
  );
}

export function NaoAchou() {
  return <Caixa titulo="Registro não encontrado"><p style={{ margin: 0 }}>Este registro não existe ou foi removido. <a href={link("dashboard")}>Voltar ao Dashboard</a></p></Caixa>;
}
