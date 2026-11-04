// Moldura do LIMS no formato do GerenciaLab: barra superior com a logo,
// menu horizontal com dropdowns e faixa de breadcrumb.

import { useEffect, useRef, useState } from "react";
import logoBranca from "../assets/logo-branca.png";
import { MENU, ITEM_DA_TELA, ehGrupo } from "../lib/menu.js";
import { link } from "../lib/rota.js";
import { sair } from "../lib/sessao.js";
import { useDados } from "../lib/dados.jsx";
import { useAviso, Modal } from "./ui.jsx";
import { dataBR } from "../lib/formato.js";
import { numeroProposta } from "../lib/propostas.js";

export function Migalhas({ itens }) {
  return (
    <>
      <a href={link("dashboard")}>Home</a>
      {itens.map(([t, h], i) => (
        <span key={i} style={{ display: "contents" }}>
          <span className="sep">/</span>
          {h ? <a href={h}>{t}</a> : <span>{t}</span>}
        </span>
      ))}
    </>
  );
}

function Menu({ tela }) {
  const [aberto, setAberto] = useState(null);
  const [mobile, setMobile] = useState(false);
  const raiz = useRef(null);
  useEffect(() => {
    const fora = (e) => { if (!raiz.current?.contains(e.target)) setAberto(null); };
    const esc = (e) => { if (e.key === "Escape") setAberto(null); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, []);
  useEffect(() => { setAberto(null); setMobile(false); }, [tela]);
  const menuAtivo = ITEM_DA_TELA[tela]?.menu;
  return (
    <nav className="menubar wrap" aria-label="Menu principal" ref={raiz}>
      <div className="inner">
        <button type="button" className="toggle" aria-expanded={mobile} onClick={() => setMobile((v) => !v)}>☰ Menu</button>
        <ul className={`menu${mobile ? " show" : ""}`}>
          {MENU.map(([nome, itens], i) => (
            <li key={nome} className={`${aberto === i ? "open" : ""}${menuAtivo === nome ? " ativo" : ""}`}>
              <button type="button" aria-haspopup="true" aria-expanded={aberto === i} onClick={() => setAberto((a) => (a === i ? null : i))}>{nome}<span className="caret" /></button>
              {aberto === i && (
                <ul className={`dd${itens.length > 12 ? " cols" : ""}`}>
                  {itens.map((item) => ehGrupo(item)
                    ? <li key={item[0]} className="dd-grupo">{item[0].slice(3)}</li>
                    : <li key={item[1]}><a href={link(item[1])} className={item[2] ? "" : "soon"}>{item[0]}</a></li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export default function Layout({ sessao, tela, migalhas, children }) {
  const { dados } = useDados();
  const avisar = useAviso();
  const [verAlertas, setVerAlertas] = useState(false);
  const alertas = dados.alertas || [];
  return (
    <>
      <header className="brandbar wrap">
        <div className="inner">
          <a className="logo" href={link("dashboard")}><img src={logoBranca} alt="MinasLab, Laboratório de Controle de Qualidade" width="117" height="35" /></a>
          <div className="topright">
            <button type="button" className="ico" aria-label="Mensagens" onClick={() => avisar("Nenhuma mensagem nova.")}>
              <svg width="15" height="12" viewBox="0 0 15 12" fill="none" aria-hidden="true"><rect x=".75" y=".75" width="13.5" height="10.5" rx="1" stroke="#fff" strokeWidth="1.3" /><path d="M1 1.5l6.5 5 6.5-5" stroke="#fff" strokeWidth="1.3" /></svg><span className="badge">0</span>
            </button>
            <button type="button" className="ico" aria-label="Alertas" onClick={() => (alertas.length ? setVerAlertas(true) : avisar("Nenhuma notificação."))}>
              <svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden="true"><path d="M6.5 1.2a4 4 0 0 0-4 4v3l-1.3 2h10.6l-1.3-2v-3a4 4 0 0 0-4-4z" stroke="#fff" strokeWidth="1.3" /><path d="M5 12.3a1.6 1.6 0 0 0 3 0" stroke="#fff" strokeWidth="1.3" /></svg><span className="badge">{alertas.length}</span>
            </button>
            <span className="usuario">{sessao.nome || sessao.usuario}</span>
            <button type="button" className="linkbranco" onClick={() => sair()}>Sair</button>
          </div>
        </div>
      </header>
      <Menu tela={tela} />
      <div className="crumbbar wrap"><div className="inner crumbs"><Migalhas itens={migalhas} /></div></div>
      <main className="wrap"><div className="inner">{children}</div></main>
      {verAlertas && (
        <Modal titulo="Alertas" onFechar={() => setVerAlertas(false)}>
          <div className="tw"><table><thead><tr><th>Data</th><th>Proposta</th><th>Descrição</th></tr></thead><tbody>
            {alertas.map((a, i) => {
              const p = dados.propostas.find((x) => x.id === a.pid);
              return <tr key={i}><td>{dataBR(a.data)}</td><td>{p ? <a href={link("proposta", p.id)} onClick={() => setVerAlertas(false)}>{numeroProposta(p)}</a> : "—"}</td><td className="quebra">{a.desc}</td></tr>;
            })}
          </tbody></table></div>
        </Modal>
      )}
    </>
  );
}
