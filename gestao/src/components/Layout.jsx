import { useEffect, useState } from "react";
import { navegar } from "../lib/rota.js";
import { sair, getSessao } from "../lib/sessao.js";
import { useBase } from "../hooks/base.jsx";
import { mesAtual, mesCurto } from "../lib/format.js";
import {
  IcGrafico, IcLupa, IcBussola, IcFunil, IcPessoas, IcMedalha, IcAviso, IcAlvo, IcEngrenagem,
  IcCarteira, IcEstrela, IcMartelo, IcApresentacao, IcLivro, IcMenu, IcBalanca, IcPasta, IcTrofeu,
  IcFrasco, IcCadeado, IcPulso, IcCalendario, IcMoeda, IcSair, IcRecolher, IcExpandir, IcCasa, IcX,
} from "./icones.jsx";
import logoMinasLab from "../assets/logo-minaslab.webp";

// Ícone de cada página. O menu sai das páginas LIBERADAS para o usuário no
// setor escolhido (acessos.mjs), na ordem e nos grupos de lá.
export const ICONES = {
  cockpit: IcBussola, visao: IcGrafico, funil: IcFunil, dado: IcLupa,
  pessoas: IcPessoas, avaliacao: IcMedalha, comissoes: IcMoeda, destaque: IcTrofeu, ocorrencias: IcAviso,
  carteira: IcCarteira, satisfacao: IcEstrela, licitacoes: IcMartelo,
  estrategias: IcAlvo, decisoes: IcBalanca, funcoes: IcPasta, equipe: IcEngrenagem,
  agenda: IcCalendario, reunioes: IcApresentacao, treinamentos: IcLivro,
  lab: IcFrasco, ncs: IcAviso, produtividade: IcPulso, acessos: IcCadeado,
};

// Cor de cada página no menu (mesmo estilo de ladrilho do painel MinasLab).
const CORES = {
  cockpit: ["#0f766e", "#d9f4ef"], visao: ["#2563eb", "#e5edff"], funil: ["#7c3aed", "#eee7ff"], dado: ["#0891b2", "#dcf5fc"],
  pessoas: ["#7c3aed", "#eee7ff"], avaliacao: ["#b45309", "#fff0cf"], comissoes: ["#15803d", "#dcf5e4"], destaque: ["#c2410c", "#ffeadc"], ocorrencias: ["#b91c1c", "#fde4e4"],
  carteira: ["#0369a1", "#e0f2fe"], satisfacao: ["#db2777", "#fce5f1"], licitacoes: ["#b45309", "#fff0cf"],
  estrategias: ["#0f766e", "#d9f4ef"], decisoes: ["#4f46e5", "#e9e7ff"], funcoes: ["#475569", "#e6edf5"], equipe: ["#0e7490", "#cffafe"],
  agenda: ["#2563eb", "#e5edff"], reunioes: ["#db2777", "#fce5f1"], treinamentos: ["#16803d", "#dcf5e4"],
  lab: ["#0891b2", "#dcf5fc"], ncs: ["#b91c1c", "#fde4e4"], produtividade: ["#0f766e", "#d9f4ef"], acessos: ["#a16207", "#fef3cd"],
};
const iniciais = (n) => { const p = String(n || "?").trim().split(/\s+/); return ((p[0]?.[0] || "") + (p.length > 1 ? p.at(-1)[0] : "")).toUpperCase(); };
const PAPEL = { direcao: "Direção", equipe: "Equipe", leitura: "Leitura" };

// Mês a mês, ano a ano: o mês atual sai da data de hoje, então novembro,
// dezembro e os anos seguintes aparecem sozinhos. Meses futuros ficam apagados.
export function SeletorMes() {
  const { mes, setMes } = useBase();
  const atual = mesAtual();
  const ano = Number(mes.slice(0, 4));
  const anoAtual = Number(atual.slice(0, 4));
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
  const irAno = (a) => {
    const alvo = `${a}-${mes.slice(5)}`;
    setMes(alvo > atual ? atual : alvo);
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <div className="pilulas" role="group" aria-label="Ano">
        <button type="button" className="pilula" aria-label="Ano anterior" onClick={() => irAno(ano - 1)} disabled={ano <= 2024}>‹</button>
        <span className="pilula ativa" style={{ cursor: "default" }}>{ano}</span>
        <button type="button" className="pilula" aria-label="Próximo ano" onClick={() => irAno(ano + 1)} disabled={ano >= anoAtual}>›</button>
      </div>
      <div className="pilulas" role="group" aria-label="Mês">
        {meses.map((m) => (
          <button key={m} type="button" className={`pilula${m === mes ? " ativa" : ""}`} aria-pressed={m === mes} disabled={m > atual} onClick={() => setMes(m)}>
            {mesCurto(m)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Marca({ recolhido, aoAlternar, nomeSetor }) {
  return (
    <div className="ml-brand">
      <img src={logoMinasLab} alt="MinasLab, Laboratório de Controle de Qualidade" width="178" height="52" />
      <span className="ml-brand-caption">GESTÃO · {String(nomeSetor || "do setor").toUpperCase()}</span>
      {aoAlternar && (
        <button type="button" className="ml-menu-toggle" onClick={aoAlternar} aria-pressed={!!recolhido} aria-label={recolhido ? "Expandir o menu" : "Recolher o menu (só os ícones)"} title={recolhido ? "Expandir o menu" : "Recolher o menu (só os ícones)"}>
          {recolhido ? <IcExpandir size={17} /> : <IcRecolher size={17} />}
        </button>
      )}
    </div>
  );
}

function ItensMenu({ tela, grupos, aoIr, setor, setoresPermitidos, setSetor }) {
  const [busca, setBusca] = useState("");
  const norm = (v) => String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(busca.trim());
  const filtrados = grupos.map((g) => ({ ...g, itens: g.itens.filter((p) => !q || norm(p.nome).includes(q)) })).filter((g) => g.itens.length);
  return (
    <div className="ml-navigation">
      {setoresPermitidos.length > 1 && (
        <div className="ml-setores" role="group" aria-label="Setor">
          {setoresPermitidos.map((s) => (
            <button key={s} type="button" className={s === setor ? "ativo" : ""} aria-pressed={s === setor} onClick={() => setSetor(s)}>
              {s === "laboratorio" ? "Laboratório" : "Comercial"}
            </button>
          ))}
        </div>
      )}
      <div className="ml-menu-search">
        <IcLupa size={15} />
        <input aria-label="Buscar página" type="search" placeholder="Encontrar página..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        {busca && <button type="button" aria-label="Limpar busca" onClick={() => setBusca("")}><IcX size={14} /></button>}
      </div>
      <nav aria-label="Páginas da gestão" className="ml-menu-scroll">
        {filtrados.map((g) => (
          <section key={g.grupo} className="ml-menu-group" aria-label={g.grupo}>
            <h2 className="ml-menu-label">{g.grupo}</h2>
            {g.itens.map(({ id, nome }) => {
              const Ic = ICONES[id] || IcPasta;
              const [cor, fundo] = CORES[id] || ["#0f766e", "#d9f4ef"];
              return (
                <button key={id} type="button" title={nome} className={`ml-menu-link${tela === id ? " ml-menu-link-active" : ""}`} aria-current={tela === id ? "page" : undefined} onClick={() => aoIr(id)}>
                  <span className="ml-emoji-tile" aria-hidden="true" style={{ "--tile-color": cor, "--tile-bg": fundo }}><Ic size={17} /></span>
                  <span className="ml-menu-text">{nome}</span>
                </button>
              );
            })}
          </section>
        ))}
        {!filtrados.length && <p className="ml-menu-empty" role="status">Nenhuma página encontrada.</p>}
      </nav>
    </div>
  );
}

function RodapeSessao({ sessao }) {
  const painel = new URL("../", window.location.href).href;
  return (
    <div className="ml-session">
      <div className="ml-session-linha">
        <span className="ml-avatar" aria-hidden="true">{iniciais(sessao?.nome || sessao?.usuario)}</span>
        <span className="ml-session-nome">
          <b title={sessao?.nome || ""}>{String(sessao?.nome || sessao?.usuario || "").split(/\s+/).slice(0, 2).join(" ")}</b>
          <span>{PAPEL[sessao?.papel] || "Gestão"}</span>
        </span>
        <span className="ml-session-acoes">
          <a href={painel} title="Voltar ao painel MinasLab" aria-label="Voltar ao painel MinasLab"><IcCasa size={16} /></a>
          <button type="button" onClick={() => sair()} title="Sair" aria-label="Sair"><IcSair size={16} /></button>
        </span>
      </div>
    </div>
  );
}

export default function Layout({ tela, children }) {
  const [aberto, setAberto] = useState(false);
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem("ml_gestao_menu_recolhido") === "1"; } catch { return false; } });
  const alternar = () => setRecolhido((v) => { const n = !v; try { localStorage.setItem("ml_gestao_menu_recolhido", n ? "1" : "0"); } catch { /* sem armazenamento local não lembra */ } return n; });
  const sessao = getSessao();
  const { erroCRM, paginas, acesso, setor, setSetor, setoresPermitidos, nomeSetor } = useBase();
  const ir = (id) => { setAberto(false); navegar(id); };
  const grupos = [];
  for (const p of paginas) {
    let g = grupos.find((x) => x.grupo === p.grupo);
    if (!g) grupos.push((g = { grupo: p.grupo, itens: [] }));
    g.itens.push(p);
  }
  if (acesso?.admin) grupos.push({ grupo: "Administração", itens: [{ id: "acessos", nome: "Acessos" }] });
  const atual = grupos.flatMap((g) => g.itens).find((p) => p.id === tela);
  const IcAtual = ICONES[tela] || IcPasta;
  useEffect(() => { document.title = `${atual?.nome || "Gestão"} · ${nomeSetor || "Gestão"} · MinasLab`; }, [atual?.nome, nomeSetor]);
  const menu = <ItensMenu tela={tela} grupos={grupos} aoIr={ir} setor={setor} setoresPermitidos={setoresPermitidos} setSetor={(s) => { setSetor(s); setAberto(false); }} />;

  return (
    <div className="casca ml-shell">
      <aside className={`ml-sidebar${recolhido ? " ml-sidebar-recolhido" : ""}`}>
        <Marca recolhido={recolhido} aoAlternar={alternar} nomeSetor={nomeSetor} />
        {menu}
        <RodapeSessao sessao={sessao} />
      </aside>
      {aberto && <div className="ml-gaveta-fundo" onClick={() => setAberto(false)} />}
      <aside className={`ml-gaveta${aberto ? " aberta" : ""}`} aria-hidden={!aberto} inert={!aberto}>
        <Marca nomeSetor={nomeSetor} />
        {menu}
        <RodapeSessao sessao={sessao} />
      </aside>
      <div className="ml-coluna">
        <div className="ml-desktop-context">
          <span>Gestão · {nomeSetor || "setor"} <span aria-hidden="true">/</span> <strong><IcAtual size={14} /> {atual?.nome || "Início"}</strong></span>
          <span className="ml-context-label">MinasLab · Controle de qualidade</span>
        </div>
        <header className="ml-topo-movel">
          <button type="button" aria-label="Abrir menu" aria-expanded={aberto} onClick={() => setAberto(true)}><IcMenu size={20} /></button>
          <b><IcAtual size={15} /> {atual?.nome || nomeSetor || "Gestão"}</b>
          <span>MinasLab</span>
        </header>
        <main className="conteudo">
          <div className="miolo">
            {erroCRM && <div className="aviso alerta">{erroCRM}</div>}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
