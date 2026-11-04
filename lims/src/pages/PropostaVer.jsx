// Propostas → Visualizar: o documento que vai para o cliente, respeitando a
// "Exibição de preços", com o Aceitar proposta e o histórico de revisões.

import { useEffect, useState } from "react";
import { useDados } from "../lib/dados.jsx";
import { link } from "../lib/rota.js";
import { brl, dataBR, isoDia } from "../lib/formato.js";
import { numeroProposta, parametro, servico, precoUnitario, totalItem, exibicao, aceitarProposta, podeEditar } from "../lib/propostas.js";
import { Modal, RotuloProposta, useAviso } from "../components/ui.jsx";
import { NaoAchou } from "./Clientes.jsx";
import logoMinasLab from "../assets/logo-minaslab.webp";

export default function PropostaVer({ param }) {
  const { dados, mudar } = useDados();
  const avisar = useAviso();
  const p = dados.propostas.find((x) => x.id === Number(param));
  const [aceite, setAceite] = useState(null);
  // Conta a abertura (coluna "Visualização" da lista), uma vez por visita.
  useEffect(() => {
    if (!p) return;
    mudar((d) => { const x = d.propostas.find((y) => y.id === p.id); if (x) x.views = (x.views || 0) + 1; return d; });
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <NaoAchou />;
  const c = dados.clientes.find((x) => x.id === p.clienteId) || {};
  const sol = dados.solicitantes.find((s) => s.id === p.solicitanteId);
  const ex = exibicao(p);

  return (
    <>
      <div className="doc-acoes">
        <a className="btn btn-default" href={link("proposedlist")}>Voltar</a>
        <div className="acoes" style={{ alignItems: "center" }}>
          <RotuloProposta status={p.status} />
          {podeEditar(p) && <a className="btn btn-default" href={link("criar-proposta", p.id)}>Editar Proposta</a>}
          {p.status !== "Aceito" && <button type="button" className="btn btn-success" onClick={() => setAceite({ data: isoDia(0), nome: c.resp || "", obs: "" })}>Aceitar proposta</button>}
        </div>
      </div>
      <article className="doc">
        <div className="hd">
          <div><img src={logoMinasLab} alt="MinasLab, Laboratório de Controle de Qualidade" width="200" height="60" /><div className="suave">Montes Claros · MG</div></div>
          <div style={{ textAlign: "right" }}><b>PROPOSTA COMERCIAL</b><br />Nº {numeroProposta(p)}<br />Identificação {p.ident}</div>
        </div>
        <h4>Dados do cliente</h4>
        <dl className="detail">
          <div><dt>Razão social</dt><dd>{c.razao}</dd></div><div><dt>CNPJ</dt><dd>{c.doc}</dd></div>
          <div><dt>Responsável</dt><dd>{c.resp}</dd></div><div><dt>E-mail</dt><dd>{p.emailCliProp || c.email}</dd></div>
          {sol && <div><dt>Solicitante</dt><dd>{sol.nome}</dd></div>}<div><dt>Telefone</dt><dd>{c.tel}</dd></div>
        </dl>
        <h4>Serviços propostos</h4>
        <div className="tw"><table>
          <thead><tr><th>Serviço / Matriz</th><th>Parâmetros</th><th>Qtd.</th>{ex.valores && <><th>Valor unit.</th><th>Total</th></>}</tr></thead>
          <tbody>
            {p.itens.map((it, i) => { const sv = servico(it.sid); return (
              <tr key={i}>
                <td><b>{sv.nome}</b><br />{sv.matriz} · {sv.la}</td>
                <td className="quebra">{it.params.map((cd) => { const x = parametro(cd); return `${x.nome}${x.acred ? " *" : ""}${ex.porParametro ? ` (${brl(x.preco)})` : ""}`; }).join("; ")}</td>
                <td>{it.qtd}</td>{ex.valores && <><td>{brl(precoUnitario(it))}</td><td>{brl(totalItem(it))}</td></>}
              </tr>
            ); })}
            {ex.outros && Number(p.outros) > 0 && <tr><td colSpan={4}>Outros custos (coleta, frete)</td><td>{brl(p.outros)}</td></tr>}
          </tbody>
        </table></div>
        {ex.valores && <div className="tot"><span>Total: <b>{brl(ex.total)}</b></span></div>}
        <p className="suave" style={{ marginTop: 8 }}>* Ensaio do escopo acreditado.</p>
        <h4>Condições comerciais</h4>
        <dl className="detail">
          <div><dt>Ciclo de pagamento</dt><dd>{p.ciclo}{p.ciclo === "Parcelado" ? ` em ${p.parcelas}x` : ""}</dd></div><div><dt>Condições</dt><dd>{p.condicoes || "A combinar"}</dd></div>
          <div><dt>Cobrança na</dt><dd>{p.cobrancaNa}</dd></div><div><dt>Tipo de contrato</dt><dd>{p.tipoContrato || "—"}</dd></div>
          <div><dt>Data da proposta</dt><dd>{dataBR(p.criacao)}</dd></div><div><dt>Validade</dt><dd>{dataBR(p.validade)}</dd></div>
        </dl>
        {p.obs && <><h4>Observações</h4><p style={{ whiteSpace: "pre-wrap" }}>{p.obs}</p></>}
        {p.aceite ? <><h4>Aceite</h4><p>Proposta aceita por <b>{p.aceite.nome}</b> em {dataBR(p.aceite.data)}.{p.aceite.obs ? ` ${p.aceite.obs}` : ""}</p></>
          : <div className="sign"><div>MinasLab</div><div>De acordo — {c.razao}</div></div>}
        {p.revs?.length > 0 && <>
          <h4>Histórico de revisões</h4>
          <div className="tw"><table><thead><tr><th>Versão</th><th>Data</th><th>Por</th><th>Motivo da revisão</th></tr></thead>
            <tbody>{p.revs.map((r, i) => <tr key={i}><td>{r.ver}</td><td>{dataBR(r.em)}</td><td>{r.por}</td><td className="quebra">{r.motivo}</td></tr>)}</tbody></table></div>
        </>}
      </article>
      {aceite && (
        <Modal titulo="Aceitar proposta" onFechar={() => setAceite(null)} rotuloOk="Aceitar" aoConfirmar={() => {
          try { const np = aceitarProposta(p, aceite); mudar((d) => { d.propostas = d.propostas.map((x) => (x.id === p.id ? np : x)); return d; }); avisar("Proposta aceita.", "ok"); }
          catch (e) { avisar(e.message, "err"); return false; }
        }}>
          <div className="fg"><label htmlFor="mAcD">Data do aceite</label><input id="mAcD" type="date" value={aceite.data} onChange={(e) => setAceite({ ...aceite, data: e.target.value })} /></div>
          <div className="fg"><label htmlFor="mAcN">Aceito por</label><input id="mAcN" value={aceite.nome} onChange={(e) => setAceite({ ...aceite, nome: e.target.value })} /></div>
          <div className="fg"><label htmlFor="mAcO">Observação</label><textarea id="mAcO" rows={2} value={aceite.obs} onChange={(e) => setAceite({ ...aceite, obs: e.target.value })} /></div>
        </Modal>
      )}
    </>
  );
}
