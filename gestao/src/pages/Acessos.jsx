// Acessos: a administração marca, para cada login do painel, quais páginas de
// cada setor a pessoa vê. Quem tranca é o servidor (cada leitura e gravação
// confere a página); a lista fica assinada pelo servidor.
import { useEffect, useMemo, useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Modal } from "../components/ui.jsx";
import { listarAcessos, gravarAcesso } from "../services/dados.js";
import { DONOS } from "../../supabase/functions/ml-comercial/acessos.mjs";

const titulo = (s) => String(s || "").toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
const PAPEL = { direcao: "Direção", equipe: "Equipe", leitura: "Só leitura" };

export default function Acessos() {
  const { acesso } = useBase();
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState("");
  const carregar = () => listarAcessos().then(setD).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  const contas = useMemo(() => (d?.contas || [])
    .filter((c) => !busca || `${c.nome} ${c.usuario}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [d, busca]);

  if (!acesso?.admin) return <div className="aviso ruim">Só a administração edita os acessos.</div>;

  const resumo = (u) => {
    if (DONOS.includes(u)) return [<Chip key="adm" tom="ok">Administração: tudo</Chip>];
    const a = d?.acessos?.[u];
    if (a && !a.valido) return [<Chip key="inv" tom="ruim">Alterado por fora: sem acesso</Chip>];
    const s = a?.setores || {};
    const out = Object.entries(s).map(([setor, ps]) => <Chip key={setor} tom="marca">{d.setores[setor]?.nome}: {ps.length} página(s)</Chip>);
    return out.length ? out : [<span key="n" className="suave peq">sem acesso</span>];
  };

  return (
    <>
      <Cabecalho sobre="Administração" titulo="Acessos" sub="Marque o que cada pessoa vê. Ninguém entra sem liberação; o servidor confere a página em cada leitura e gravação." />
      {erro && <div className="aviso ruim">{erro}</div>}
      <div className="aviso marca peq">
        Quem é <b>direção</b> no painel MinasLab também consegue ler estes dados pela porta do próprio painel (é a regra de lá). Para quem é <b>equipe</b>, este sistema é o único caminho, e só para as páginas marcadas aqui.
      </div>
      <Card semPad>
        <div className="card-cab">
          <h2>Logins do painel</h2>
          <input className="entrada" style={{ maxWidth: 260 }} placeholder="Buscar nome ou login" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        </div>
        {!d ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Carregando…</div> : (
          <div className="tabela-caixa">
            <table>
              <thead><tr><th>Pessoa</th><th>Papel no painel</th><th>Acesso aqui</th><th /></tr></thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.usuario}>
                    <td><b style={{ fontWeight: 600 }}>{titulo(c.nome)}</b><div className="suave peq">{c.usuario}</div></td>
                    <td className="peq">{PAPEL[c.papel] || c.papel}</td>
                    <td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{resumo(c.usuario)}</div></td>
                    <td style={{ textAlign: "right" }}>{!DONOS.includes(c.usuario) && <button type="button" className="btn claro mini" onClick={() => setEditando(c)}>Editar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editando && <EditarAcesso conta={editando} d={d} aoFechar={(mudou) => { setEditando(null); if (mudou) carregar(); }} />}
    </>
  );
}

function EditarAcesso({ conta, d, aoFechar }) {
  const atual = d.acessos?.[conta.usuario]?.valido ? d.acessos[conta.usuario].setores : {};
  const [sel, setSel] = useState(() => Object.fromEntries(Object.keys(d.setores).map((s) => [s, new Set(atual[s] || [])])));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const alternar = (s, id) => setSel((x) => { const n = new Set(x[s]); n.has(id) ? n.delete(id) : n.add(id); return { ...x, [s]: n }; });
  const todos = (s, marcar) => setSel((x) => ({ ...x, [s]: new Set(marcar ? d.paginas[s].map((p) => p.id) : []) }));
  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      await gravarAcesso(conta.usuario, Object.fromEntries(Object.entries(sel).map(([s, ids]) => [s, [...ids]])));
      aoFechar(true);
    } catch (e) { setErro(e.message); setSalvando(false); }
  };
  return (
    <Modal largo titulo={`Acessos de ${titulo(conta.nome)}`} aoFechar={() => aoFechar(false)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {conta.papel === "direcao" && <div className="aviso alerta peq">Esta conta é direção no painel: pela porta do painel ela já lê os dados de RH. As marcações abaixo valem dentro deste sistema.</div>}
        <div className="grade grade-2">
          {Object.entries(d.paginas).map(([s, ps]) => {
            const grupos = [...new Set(ps.map((p) => p.grupo))];
            return (
              <div key={s} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h2 style={{ fontSize: 16 }}>{d.setores[s].nome}</h2>
                  <span style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="btn claro mini" onClick={() => todos(s, true)}>Tudo</button>
                    <button type="button" className="btn claro mini" onClick={() => todos(s, false)}>Nada</button>
                  </span>
                </div>
                {grupos.map((g) => (
                  <div key={g} style={{ marginBottom: 8 }}>
                    <div className="rotulo" style={{ marginBottom: 4 }}>{g}</div>
                    {ps.filter((p) => p.grupo === g).map((p) => (
                      <label key={p.id} className="peq" style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0" }}>
                        <input type="checkbox" checked={sel[s].has(p.id)} onChange={() => alternar(s, p.id)} /> {p.nome}
                        {["avaliacao", "pessoas"].includes(p.id) && <span className="suave">(dados de pessoas)</span>}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="suave peq">Nomes, metas e funções da equipe do setor ficam visíveis para qualquer página liberada naquele setor (as telas precisam deles). Avaliações, feedbacks, ocorrências e NCs só com a página correspondente.</div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={() => aoFechar(false)}>Cancelar</button>
          <button type="button" className="btn" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar acessos"}</button>
        </div>
      </div>
    </Modal>
  );
}
