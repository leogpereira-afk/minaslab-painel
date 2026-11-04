// Configurações → Permissões de acesso: quem vê e quem edita cada menu do
// LIMS, por conta do painel. Grava na coleção "permissoes" (id = usuário).
// A direção tem acesso total. As liberações passam a valer no servidor quando
// o piloto for aberto para a equipe.

import { useEffect, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { MENU } from "../lib/menu.js";
import { Caixa, useAviso } from "../components/ui.jsx";

const MENUS = MENU.map(([m]) => m);
const idDe = (usuario) => `u-${String(usuario).replace(/[^\w.-]/g, "_")}`.slice(0, 80);

export default function Permissoes() {
  const { dados, salvar, contas } = useDados();
  const avisar = useAviso();
  const [lista, setLista] = useState(null);
  const [usuario, setUsuario] = useState("");
  const [menus, setMenus] = useState({});
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { contas().then((c) => setLista(c.filter((x) => x.ativo))).catch((e) => { avisar(e.message, "err"); setLista([]); }); }, [contas, avisar]);
  const conta = lista?.find((c) => c.usuario === usuario);
  const carregar = (u) => {
    setUsuario(u);
    setMenus({ ...(dados.permissoes.find((p) => p.usuario === u)?.menus || {}) });
  };
  const gravar = async () => {
    setOcupado(true);
    try { await salvar("permissoes", { id: idDe(usuario), usuario, nome: conta?.nome || usuario, menus }); avisar("Permissões salvas.", "ok"); }
    catch (e) { avisar(e.message, "err"); } finally { setOcupado(false); }
  };
  const nivel = (m) => menus[m] || "";
  return (
    <Caixa titulo="Permissões de acesso">
      <p className="suave" style={{ marginTop: -6 }}>Defina, por pessoa, o que ela vê e o que pode editar no LIMS. A direção tem acesso total. Enquanto o LIMS estiver em piloto, só a direção entra; estas liberações passam a valer quando ele for aberto para a equipe.</p>
      <div className="frm">
        <div className="fg s6">
          <label htmlFor="pUsuario">Usuário do painel</label>
          <select id="pUsuario" value={usuario} onChange={(e) => carregar(e.target.value)}>
            <option value="">{lista ? "Selecione" : "Carregando…"}</option>
            {(lista || []).map((c) => <option key={c.usuario} value={c.usuario}>{c.nome || c.usuario} ({c.usuario}){c.papel === "direcao" ? " · direção" : ""}</option>)}
          </select>
        </div>
        <div className="fg s6" style={{ justifyContent: "flex-end" }}><button type="button" className="btn btn-default" disabled={!lista} onClick={() => { contas().then(setLista); }}>Carregar</button></div>
      </div>
      {usuario && (conta?.papel === "direcao" ? <p className="aviso alerta" style={{ marginTop: 16 }}>{conta.nome} é da direção e tem acesso total ao LIMS.</p> : (
        <>
          <div className="tw" style={{ marginTop: 16 }}>
            <table>
              <thead><tr><th>Menu</th><th>Sem acesso</th><th>Ver</th><th>Ver e editar</th></tr></thead>
              <tbody>{MENUS.map((m) => (
                <tr key={m}><td>{m}</td>
                  {["", "ver", "editar"].map((n) => <td key={n} className="chk"><input type="radio" name={`perm-${m}`} aria-label={`${m}: ${n || "sem acesso"}`} checked={nivel(m) === n} onChange={() => setMenus((x) => ({ ...x, [m]: n }))} /></td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="acoes" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-default" onClick={() => setMenus(Object.fromEntries(MENUS.map((m) => [m, "ver"])))}>Ver tudo</button>
            <button type="button" className="btn btn-success" disabled={ocupado} onClick={gravar}>{ocupado ? "Salvando…" : "Salvar permissões"}</button>
          </div>
        </>
      ))}
    </Caixa>
  );
}
