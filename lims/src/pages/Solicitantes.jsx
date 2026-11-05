// Cadastro → Solicitantes, fiel ao GerenciaLab:
//  - Lista: ID, Status, Nome responsável, Razão social, CNPJ, E-mail, Criado,
//    Modificado; botões Selecionar/Deselecionar todos, Visualizar, Novo
//    Solicitante e Status (filtra Todos / Ativo / Inativo).
//  - Adicionar Solicitante: Pessoa Jurídica/Física, responsável, telefones,
//    razão social, CNPJ/CPF, inscrições, endereço (busca pelo CEP) e e-mail.
//  - Ficha do solicitante: resumo (contratos, OS, faturas), dados editáveis
//    (com senha de acesso, inadimplência e ativo) e Endereços por tipo
//    (Nota Fiscal, Resultados, Principal).

import { useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { link, navegar } from "../lib/rota.js";
import { brl } from "../lib/formato.js";
import { UFS } from "../lib/clientes.js";
import { erroSolicitante, normalizarSolicitante, enderecoDoCadastro, TIPOS_ENDERECO } from "../lib/solicitantes.js";
import { useForm, completarCep, Pessoa, TabelaEnderecos } from "../components/Enderecos.jsx";
import { Grade } from "../components/Grade.jsx";
import { Caixa, RotuloStatus, opcoes, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";

const quando = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");

const COLUNAS = [
  { t: "ID", v: (r) => Number(r.cod) || 0 },
  { t: "Status", v: (r) => r.status, h: (r) => <RotuloStatus status={r.status} /> },
  { t: "Nome responsável", v: (r) => r.nome || "" },
  { t: "Razão social", v: (r) => r.razao || r.cliente || "" },
  { t: "CNPJ", v: (r) => r.doc || "" },
  { t: "E-mail", v: (r) => r.email || "" },
  { t: "Criado", v: (r) => r.criadoEm || "", h: (r) => quando(r.criadoEm), fv: (r) => quando(r.criadoEm) },
  { t: "Modificado", v: (r) => r.atualizadoEm || "", h: (r) => quando(r.atualizadoEm), fv: (r) => quando(r.atualizadoEm) },
];

export default function ListaSolicitantes() {
  const { dados } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [status, setStatus] = useState("Todos");
  const linhas = status === "Todos" ? dados.solicitantes : dados.solicitantes.filter((s) => (s.status || "Ativo") === status);
  const selecionados = linhas.filter((s) => sel.has(s.id));
  return (
    <Caixa titulo="Solicitantes">
      <Grade id="sol" exportar="solicitantes" linhas={linhas} colunas={COLUNAS} selecao={sel} aoSelecionar={setSel} multipla ordemInicial={[0, "asc"]}
        aoAbrir={(r) => navegar("solicitante", r.id)}
        botoes={[
          { rotulo: "Selecionar todos", acao: () => setSel(new Set(linhas.map((s) => s.id))) },
          { rotulo: "Deselecionar todos", acao: () => setSel(new Set()), desativado: !sel.size },
          { rotulo: "Visualizar", acao: () => (selecionados.length === 1 ? navegar("solicitante", selecionados[0].id) : avisar("Selecione um solicitante.", "err")) },
          { rotulo: "Novo Solicitante", acao: () => navegar("adicionar-solicitante") },
          { rotulo: "Status", menu: ["Todos", "Ativo", "Inativo"].map((o) => ({ rotulo: o, marcado: status === o, padrao: o === "Todos", acao: () => { setStatus(o); setSel(new Set()); } })) },
        ]} />
    </Caixa>
  );
}

/* ---------- Adicionar Solicitante ---------- */

const VAZIO = { pessoa: "PJ", nome: "", tel: "", cel: "", razao: "", doc: "", im: "", ie: "", cep: "", end: "", num: "", comp: "", bairro: "", cidade: "", uf: "", email: "" };

export function FormSolicitante() {
  const { salvar } = useDados();
  const avisar = useAviso();
  const { f, setF, set, campo } = useForm(VAZIO);
  const [ocupado, setOcupado] = useState(false);
  const pf = f.pessoa === "PF";
  const gravar = async (e) => {
    e.preventDefault();
    const erro = erroSolicitante(f);
    if (erro) { avisar(erro[1], "err"); document.getElementById(erro[0])?.focus(); return; }
    setOcupado(true);
    try {
      const n = normalizarSolicitante(f);
      const r = await salvar("solicitantes", { ...n, status: "Ativo", inadimplente: "Não", enderecos: [enderecoDoCadastro(n)] }, { numerar: true });
      avisar("Solicitante cadastrado.", "ok");
      navegar("solicitante", r.id);
    } catch (ex) { avisar(ex.message, "err"); } finally { setOcupado(false); }
  };
  return (
    <Caixa titulo="Solicitantes">
      <form className="frm" onSubmit={gravar} noValidate>
        <Pessoa f={f} set={set} />
        {campo("sNome", "nome", "Nome do Responsável")}{campo("sTel", "tel", "Telefone", "s4", { ph: "(xx)xxxx-xxxxx" })}{campo("sCel", "cel", "Celular", "s4", { ph: "(xx)xxxx-xxxxx" })}
        {!pf && campo("sRazao", "razao", "Razão Social")}
        {campo("sDoc", "doc", pf ? "CPF" : "CNPJ", "s4", { ph: pf ? "000.000.000-00" : "00.000.000/0000-00" })}
        {!pf && <>{campo("sIm", "im", "Inscrição Municipal")}{campo("sIe", "ie", "Inscrição Estadual")}</>}
        {campo("sCep", "cep", "CEP", "s4", { onBlur: () => completarCep(f, setF) })}{campo("sEnd", "end", "Endereço", "s4", { ph: "Endereço completo" })}
        {campo("sNum", "num", "Número")}{campo("sComp", "comp", "Complemento")}{campo("sBairro", "bairro", "Bairro")}{campo("sCidade", "cidade", "Cidade")}
        <div className="fg s4"><label htmlFor="sUf">Estado</label><select id="sUf" value={f.uf} onChange={(e) => set("uf", e.target.value)}>{opcoes([["", "Estado"], ...UFS])}</select></div>
        {campo("sEmail", "email", "E-mail", "s4", { tipo: "email" })}
        <div className="s12 acoes" style={{ marginTop: 8 }}><button type="submit" className="btn btn-primary" disabled={ocupado}>{ocupado ? "Salvando…" : "Adicionar"}</button><a className="btn btn-default" href={link("solicitantes")}>Voltar</a></div>
      </form>
    </Caixa>
  );
}

/* ---------- Ficha do solicitante ---------- */

export function VerSolicitante({ param }) {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const s = dados.solicitantes.find((x) => x.id === param);
  const { f, set, campo } = useForm(() => ({ pessoa: "PJ", fantasia: "", inadimplente: "Não", ...(s || {}), razao: s?.razao || s?.cliente || "", senhaPortal: "" }));
  const [ocupado, setOcupado] = useState(false);
  if (!s) return <NaoAchou />;
  const pf = f.pessoa === "PF";
  const contratos = dados.contratos.filter((c) => c.solicitanteId === s.id);
  const ordens = dados.ordens.filter((o) => o.solicitanteId === s.id);
  const idsContrato = new Set(contratos.map((c) => c.id));
  const faturas = dados.contas_receber.filter((r) => idsContrato.has(r.contratoId) && r.status !== "Cancelado");
  const enderecos = s.enderecos || [];
  const atualizar = async (e) => {
    e.preventDefault();
    const erro = erroSolicitante(f);
    if (erro) { avisar(erro[1], "err"); document.getElementById(erro[0])?.focus(); return; }
    setOcupado(true);
    try {
      const { senhaPortal, ...resto } = normalizarSolicitante(f);
      await salvar("solicitantes", { ...s, ...resto, status: f.status, enderecos: s.enderecos || [], ...(senhaPortal ? { senhaPortal } : {}) }, { motivo: "Cadastro atualizado" });
      set("senhaPortal", "");
      avisar("Solicitante atualizado.", "ok");
    } catch (ex) { avisar(ex.message, "err"); } finally { setOcupado(false); }
  };
  const gravarEnderecos = async (lista, motivo) => {
    try { await salvar("solicitantes", { ...s, enderecos: lista }, { motivo }); avisar("Endereços atualizados.", "ok"); }
    catch (ex) { avisar(ex.message, "err"); return false; }
  };
  return (
    <div className="ficha">
      <aside className="box ficha-resumo">
        <div className="ficha-topo"><span>SOLICITANTE</span><b>{s.razao || s.nome}</b><small>{s.doc}</small></div>
        <ul className="ficha-lista">
          <li><span>Contratos</span><b>{contratos.length}</b></li>
          <li><span>Ordem de serviços</span><b>{ordens.length}</b></li>
          <li><span>Faturas</span><b>{brl(faturas.reduce((t, r) => t + (Number(r.valor) || 0), 0))}</b></li>
        </ul>
        <button type="button" className="btn btn-primary btn-block" onClick={() => document.getElementById("sNome")?.focus()}>Editar Solicitante</button>
      </aside>
      <div className="ficha-corpo">
        <Caixa titulo="Solicitantes">
          <form className="frm" onSubmit={atualizar} noValidate>
            <Pessoa f={f} set={set} />
            {campo("sNome", "nome", "Responsável")}{campo("sTel", "tel", "Telefone")}{campo("sCel", "cel", "Celular")}
            {!pf && <>{campo("sRazao", "razao", "Razão Social")}{campo("sFant", "fantasia", "Nome Fantasia")}</>}
            {campo("sDoc", "doc", pf ? "CPF" : "CNPJ")}
            {!pf && <>{campo("sIm", "im", "Inscrição Municipal")}{campo("sIe", "ie", "Inscrição Estadual")}</>}
            {campo("sEmail", "email", "E-mail", "s4", { tipo: "email" })}
            <div className="fg s4"><label htmlFor="sSenha">Senha</label><input id="sSenha" type="password" autoComplete="new-password" placeholder={s.senhaPortalDefinida ? "•••••• (definida — deixe em branco para manter)" : "Senha"} value={f.senhaPortal} onChange={(e) => set("senhaPortal", e.target.value)} /></div>
            <div className="fg s4"><label htmlFor="sInad">Inadimplência financeira</label><select id="sInad" value={f.inadimplente || "Não"} onChange={(e) => set("inadimplente", e.target.value)}>{opcoes(["Não", "Sim"])}</select></div>
            <div className="fg s4"><label htmlFor="sAtivo">Ativo</label><select id="sAtivo" value={f.status === "Inativo" ? "Não" : "Sim"} onChange={(e) => set("status", e.target.value === "Sim" ? "Ativo" : "Inativo")}>{opcoes(["Sim", "Não"])}</select></div>
            <p className="s12 suave" style={{ margin: 0 }}>A senha é para o acesso do solicitante ao portal do cliente (etapa futura). Fica guardada só no servidor.</p>
            <div className="s12 acoes"><button type="submit" className="btn btn-primary" disabled={ocupado}>{ocupado ? "Salvando…" : "Atualizar"}</button><a className="btn btn-default" href={link("solicitantes")}>Voltar</a></div>
          </form>
        </Caixa>
        <Caixa titulo="Endereços">
          <TabelaEnderecos enderecos={enderecos} tipos={TIPOS_ENDERECO} base={{ responsavel: s.nome || "", email: s.email || "", tel: s.tel || "", cel: s.cel || "" }} aoGravar={gravarEnderecos} />
        </Caixa>
      </div>
    </div>
  );
}
