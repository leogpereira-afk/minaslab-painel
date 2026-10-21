import { useState } from "react";
import { navegar } from "../lib/rota.js";
import { sair, getSessao } from "../lib/sessao.js";
import { useBase } from "../hooks/base.jsx";
import { mesAtual, mesCurto } from "../lib/format.js";
import {
  IcGrafico, IcLupa, IcBussola, IcFunil, IcPessoas, IcMedalha, IcAviso, IcAlvo, IcEngrenagem,
  IcCarteira, IcEstrela, IcMartelo, IcApresentacao, IcLivro, IcMenu, IcBalanca, IcPasta, IcTrofeu,
  IcFrasco, IcCadeado, IcPulso, IcCalendario,
} from "./icones.jsx";

// Ícone de cada página. O menu sai das páginas LIBERADAS para o usuário no
// setor escolhido (acessos.mjs), na ordem e nos grupos de lá.
export const ICONES = {
  cockpit: IcBussola, visao: IcGrafico, funil: IcFunil, dado: IcLupa,
  pessoas: IcPessoas, avaliacao: IcMedalha, destaque: IcTrofeu, ocorrencias: IcAviso,
  carteira: IcCarteira, satisfacao: IcEstrela, licitacoes: IcMartelo,
  estrategias: IcAlvo, decisoes: IcBalanca, funcoes: IcPasta, equipe: IcEngrenagem,
  agenda: IcCalendario, reunioes: IcApresentacao, treinamentos: IcLivro,
  lab: IcFrasco, ncs: IcAviso, produtividade: IcPulso, acessos: IcCadeado,
};

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

export default function Layout({ tela, children }) {
  const [aberto, setAberto] = useState(false);
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

  return (
    <div className="casca">
      <div className="topo-movel">
        <button type="button" aria-label="Abrir menu" onClick={() => setAberto(true)}><IcMenu size={22} /></button>
        <b style={{ fontFamily: "Poppins" }}>{nomeSetor || "Gestão"}</b>
      </div>
      {aberto && <div className="modal-fundo" style={{ zIndex: 25, background: "rgba(0,0,0,.3)" }} onClick={() => setAberto(false)} />}
      <nav className={`menu${aberto ? " aberto" : ""}`} aria-label={nomeSetor || "Gestão"}>
        <div className="logo">
          <span className="marca-icone">{setor === "laboratorio" ? <IcFrasco size={20} /> : <IcGrafico size={20} />}</span>
          <span><b>{nomeSetor || "Gestão"}</b><span>MinasLab · Gestão do setor</span></span>
        </div>
        {setoresPermitidos.length > 1 && (
          <div className="menu-setores" role="group" aria-label="Setor">
            {setoresPermitidos.map((s) => (
              <button key={s} type="button" className={s === setor ? "ativo" : ""} aria-pressed={s === setor} onClick={() => { setSetor(s); setAberto(false); }}>
                {s === "laboratorio" ? "Laboratório" : "Comercial"}
              </button>
            ))}
          </div>
        )}
        {grupos.map((g) => (
          <div key={g.grupo}>
            <div className="menu-grupo">{g.grupo}</div>
            {g.itens.map(({ id, nome }) => {
              const Ic = ICONES[id] || IcPasta;
              return (
                <button key={id} type="button" className={`menu-item${tela === id ? " ativo" : ""}`} aria-current={tela === id ? "page" : undefined} onClick={() => ir(id)}>
                  <Ic /> {nome}
                </button>
              );
            })}
          </div>
        ))}
        <div className="menu-rodape">
          <span>{sessao?.nome || sessao?.usuario}</span>
          <button type="button" onClick={() => sair()}>Sair</button>
        </div>
      </nav>
      <main className="conteudo">
        <div className="miolo">
          {erroCRM && <div className="aviso alerta">{erroCRM}</div>}
          {children}
        </div>
      </main>
    </div>
  );
}
