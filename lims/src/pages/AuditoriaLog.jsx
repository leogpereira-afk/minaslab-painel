// Configurações → Auditoria LOG: a trilha do servidor (ml_lims_auditoria),
// que só aceita inclusão. Quem, quando, em qual cadastro e o que mudou.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { CADASTROS } from "../lib/cadastros.js";
import { Caixa, opcoes, useAviso } from "../components/ui.jsx";

const NOMES = {
  ...Object.fromEntries(Object.values(CADASTROS).flatMap((d) => d.secoes.map((s) => [s.colecao, s.titulo || d.titulo]))),
  config: "Configuração do sistema", permissoes: "Permissões de acesso", clientes: "Clientes / Fornecedores", solicitantes: "Solicitantes", propostas: "Propostas", alertas: "Alertas",
};

export default function AuditoriaLog() {
  const { auditoria } = useDados();
  const avisar = useAviso();
  const [itens, setItens] = useState([]);
  const [colecao, setColecao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [fim, setFim] = useState(false);
  const buscar = useCallback(async (antesDe = 0, somar = false) => {
    setCarregando(true);
    try {
      const novos = await auditoria({ colecao, limite: 100, antesDe });
      setItens((x) => (somar ? [...x, ...novos] : novos));
      setFim(novos.length < 100);
    } catch (e) { avisar(e.message, "err"); } finally { setCarregando(false); }
  }, [auditoria, colecao, avisar]);
  useEffect(() => { buscar(); }, [buscar]);
  const lista = useMemo(() => Object.entries(NOMES).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), []);
  return (
    <Caixa titulo="Auditoria LOG">
      <p className="suave" style={{ marginTop: -6 }}>Toda inclusão, alteração e exclusão feita no LIMS fica registrada aqui e não pode ser alterada nem apagada.</p>
      <div className="dt-top">
        <div className="dt-search"><label htmlFor="audCol">Cadastro</label><select id="audCol" value={colecao} onChange={(e) => setColecao(e.target.value)} style={{ border: "1px solid var(--btn-line)", borderRadius: 4, padding: "6px 8px" }}>{opcoes([["", "Todos"], ...lista])}</select></div>
        <button type="button" className="dbtn" onClick={() => buscar()}>Atualizar</button>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>ID</th><th>Data</th><th>Usuário</th><th>Cadastro</th><th>Registro</th><th>Log</th></tr></thead>
          <tbody>{itens.length ? itens.map((a) => (
            <tr key={a.id}><td>{a.id}</td><td>{new Date(a.em).toLocaleString("pt-BR")}</td><td>{a.usuario}</td><td>{NOMES[a.colecao] || a.colecao}</td>
              <td>{a.depois?.cod ?? a.antes?.cod ?? ""} {a.depois?.nome || a.depois?.parametro || a.depois?.descricao || a.depois?.titulo || a.antes?.nome || ""}</td><td className="quebra">{a.acao}</td></tr>
          )) : <tr><td colSpan={6} className="vazio">{carregando ? "Carregando…" : "Nenhum registro."}</td></tr>}</tbody>
        </table>
      </div>
      {!fim && itens.length > 0 && <div style={{ marginTop: 10 }}><button type="button" className="btn btn-default" disabled={carregando} onClick={() => buscar(itens.at(-1).id, true)}>{carregando ? "Carregando…" : "Carregar mais"}</button></div>}
    </Caixa>
  );
}
