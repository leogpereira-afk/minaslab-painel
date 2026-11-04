import { useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { Grade } from "../components/Grade.jsx";
import { Caixa, RotuloStatus, opcoes, useAviso } from "../components/ui.jsx";

const COLUNAS = [
  { t: "ID", v: (r) => Number(r.cod) || 0 },
  { t: "Status", v: (r) => r.status, h: (r) => <RotuloStatus status={r.status} /> },
  { t: "Nome", v: (r) => r.nome },
  { t: "Cliente", v: (r) => r.cliente },
  { t: "E-mail", v: (r) => r.email },
  { t: "Telefone", v: (r) => r.tel },
  { t: "Criado", v: (r) => r.criadoEm || "", h: (r) => (r.criadoEm ? new Date(r.criadoEm).toLocaleDateString("pt-BR") : "") },
];

export default function Solicitantes() {
  const { dados, salvar } = useDados();
  const avisar = useAviso();
  const [sel, setSel] = useState(new Set());
  const [novo, setNovo] = useState(false);
  const ativos = dados.clientes.filter((c) => c.status === "Ativo");
  const [f, setF] = useState({ nome: "", cliente: ativos[0]?.razao || "", email: "", tel: "" });
  const exp = () => avisar("A exportação em Excel, PDF e impressão entra numa próxima etapa.");
  const [ocupado, setOcupado] = useState(false);
  const gravar = async (e) => {
    e.preventDefault();
    if (!f.nome.trim()) { avisar("Informe o nome.", "err"); document.getElementById("sNome")?.focus(); return; }
    setOcupado(true);
    try {
      await salvar("solicitantes", { status: "Ativo", ...f, nome: f.nome.trim() }, { numerar: true });
      avisar("Solicitante cadastrado.", "ok");
      setF({ ...f, nome: "", email: "", tel: "" });
      setNovo(false);
    } catch (ex) { avisar(ex.message, "err"); } finally { setOcupado(false); }
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
            { rotulo: "Status", desativado: !sel.size, acao: async () => { try { for (const s of dados.solicitantes.filter((x) => sel.has(x.id))) await salvar("solicitantes", { ...s, status: s.status === "Ativo" ? "Inativo" : "Ativo" }); avisar(`Status alterado em ${sel.size} registro(s).`, "ok"); } catch (e) { avisar(e.message, "err"); } } },
          ]} />
      </Caixa>
      {novo && (
        <Caixa titulo="Adicionar Solicitante">
          <form className="frm" onSubmit={gravar} noValidate>
            <div className="fg s5"><label htmlFor="sNome">Nome</label><input id="sNome" autoFocus value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Nome" /></div>
            <div className="fg s5"><label htmlFor="sCli">Cliente</label><select id="sCli" value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })}>{opcoes(ativos.map((c) => c.razao))}</select></div>
            <div className="fg s5"><label htmlFor="sEmail">E-mail</label><input id="sEmail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="E-mail" /></div>
            <div className="fg s5"><label htmlFor="sTel">Telefone</label><input id="sTel" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} placeholder="Telefone" /></div>
            <div className="s12 acoes"><button className="btn btn-primary" type="submit" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</button><button className="btn btn-default" type="button" onClick={() => setNovo(false)}>Cancelar</button></div>
          </form>
        </Caixa>
      )}
    </>
  );
}
