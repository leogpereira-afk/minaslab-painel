import { useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { agoraBR } from "../lib/formato.js";
import { Grade } from "../components/Grade.jsx";
import { Caixa, RotuloStatus, opcoes, useAviso } from "../components/ui.jsx";

const COLUNAS = [
  { t: "ID", v: (r) => r.id },
  { t: "Status", v: (r) => r.status, h: (r) => <RotuloStatus status={r.status} /> },
  { t: "Nome", v: (r) => r.nome },
  { t: "Cliente", v: (r) => r.cliente },
  { t: "E-mail", v: (r) => r.email },
  { t: "Telefone", v: (r) => r.tel },
  { t: "Criado", v: (r) => r.criado },
];

export default function Solicitantes() {
  const { dados, mudar } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [novo, setNovo] = useState(false);
  const ativos = dados.clientes.filter((c) => c.status === "Ativo");
  const [f, setF] = useState({ nome: "", cliente: ativos[0]?.razao || "", email: "", tel: "" });
  const exp = () => avisar("Exportar fica disponível quando o LIMS estiver ligado ao servidor, na próxima etapa.");
  const salvar = (e) => {
    e.preventDefault();
    if (!f.nome.trim()) { avisar("Informe o nome.", "err"); document.getElementById("sNome")?.focus(); return; }
    mudar((d) => { d.solicitantes.push({ id: Math.max(0, ...d.solicitantes.map((s) => s.id)) + 1, status: "Ativo", ...f, nome: f.nome.trim(), criado: agoraBR() }); return d; });
    avisar("Solicitante cadastrado.", "ok");
    setF({ ...f, nome: "", email: "", tel: "" });
    setNovo(false);
  };
  return (
    <>
      <Caixa titulo="Solicitantes">
        <Grade id="sol" linhas={dados.solicitantes} colunas={COLUNAS} selecao={sel} aoSelecionar={setSel} multipla
          botoes={[
            { rotulo: "Selecionar todos", acao: () => setSel(new Set(dados.solicitantes.map((s) => s.id))) },
            { rotulo: "Deselecionar todos", acao: () => setSel(new Set()), desativado: !sel.size },
            { rotulo: "Criar Excel", acao: exp }, { rotulo: "Criar PDF", acao: exp }, { rotulo: "Imprimir", acao: exp },
            { rotulo: "Novo Solicitante", acao: () => setNovo(true) },
            { rotulo: "Status", desativado: !sel.size, acao: () => { mudar((d) => { d.solicitantes.forEach((s) => { if (sel.has(s.id)) s.status = s.status === "Ativo" ? "Inativo" : "Ativo"; }); return d; }); avisar(`Status alterado em ${sel.size} registro(s).`, "ok"); } },
          ]} />
      </Caixa>
      {novo && (
        <Caixa titulo="Adicionar Solicitante">
          <form className="frm" onSubmit={salvar} noValidate>
            <div className="fg s5"><label htmlFor="sNome">Nome</label><input id="sNome" autoFocus value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Nome" /></div>
            <div className="fg s5"><label htmlFor="sCli">Cliente</label><select id="sCli" value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })}>{opcoes(ativos.map((c) => c.razao))}</select></div>
            <div className="fg s5"><label htmlFor="sEmail">E-mail</label><input id="sEmail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="E-mail" /></div>
            <div className="fg s5"><label htmlFor="sTel">Telefone</label><input id="sTel" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} placeholder="Telefone" /></div>
            <div className="s12 acoes"><button className="btn btn-primary" type="submit">Salvar</button><button className="btn btn-default" type="button" onClick={() => setNovo(false)}>Cancelar</button></div>
          </form>
        </Caixa>
      )}
    </>
  );
}
