// Página PÚBLICA da avaliação da liderança por link (#/liderar/<convite>).
// Quem recebeu o link (uma pessoa da liderança) avalia os colaboradores do mês
// sem entrar no Comercial. Vê só os nomes e as PRÓPRIAS notas; as notas entram
// no ranking do Destaque do Mês no nome dela. O link vence e pode ser revogado.
import { useEffect, useState } from "react";
import { abrirLideranca, salvarLideranca } from "../services/pesquisa.js";
import { mesLongo } from "../lib/format.js";

const nota1 = (x) => x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const iniciais = (n) => String(n || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

function mediaDe(av, criterios) {
  const ns = criterios.map((c) => av?.notas?.[c.id]).filter((n) => n != null);
  return ns.length === criterios.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
}

export default function Liderar({ param }) {
  const convite = String(param || "");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [ficha, setFicha] = useState(null);

  const abrir = async () => {
    try { setDados(await abrirLideranca(convite)); setErro(""); } catch (ex) { setErro(ex.message); }
  };
  useEffect(() => { document.title = "Avaliação da liderança · MinasLab"; abrir(); /* eslint-disable-next-line */ }, []);

  const feitas = dados ? dados.pessoas.filter((p) => dados.minhas[p.id]).length : 0;

  return (
    <div className="votar">
      <header className="votar-topo">
        <div className="votar-marca">Minas<b>Lab</b></div>
        <div className="votar-sub">Destaque do Mês · avaliação da liderança</div>
      </header>
      <main className="votar-miolo">
        {!dados ? (
          <div className="card votar-cartao">{erro ? <div className="aviso ruim">{erro}</div> : <div className="vazio">Abrindo…</div>}</div>
        ) : ficha ? (
          <Ficha convite={convite} dados={dados} pessoa={ficha} aoFechar={async (salvou) => { setFicha(null); if (salvou) await abrir(); }} />
        ) : (
          <div className="card votar-cartao">
            <div>
              <h1 style={{ fontSize: 22 }}>Olá, {dados.avaliadorNome}</h1>
              <p className="peq" style={{ lineHeight: 1.6, margin: "6px 0 0" }}>
                Avalie cada pessoa em <b>{mesLongo(dados.mes)}</b>: 10 critérios de 0 a 5, a mesma régua da planilha.
                Suas notas entram no ranking do Destaque do Mês junto com as da gestão. Dá para voltar e corrigir enquanto o link valer
                {dados.validoAte ? ` (até ${new Date(dados.validoAte).toLocaleDateString("pt-BR")})` : ""}.
              </p>
            </div>
            <div className="votar-progresso" aria-label={`${feitas} de ${dados.pessoas.length} avaliadas`}><div style={{ width: `${(feitas / Math.max(1, dados.pessoas.length)) * 100}%` }} /></div>
            <div className="suave peq">{feitas} de {dados.pessoas.length} avaliada(s)</div>
            <ul className="liderar-lista">
              {dados.pessoas.map((p) => {
                const minha = dados.minhas[p.id];
                const m = minha ? mediaDe(minha, dados.criterios) : null;
                return (
                  <li key={p.id}>
                    <button type="button" className="liderar-pessoa" onClick={() => setFicha(p)}>
                      <span className="avatar">{iniciais(p.nome)}</span>
                      <span className="liderar-nome">{p.nome}</span>
                      <span className={`chip ${minha ? "ok" : "alerta"}`}>{minha ? (minha.eliminatorio ? "não concorre" : m == null ? "feita" : `${nota1(m)} de 5`) : "avaliar"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {feitas === dados.pessoas.length && <div className="aviso ok">Tudo avaliado. Obrigada! Pode fechar esta página.</div>}
          </div>
        )}
      </main>
    </div>
  );
}

function Ficha({ convite, dados, pessoa, aoFechar }) {
  const atual = dados.minhas[pessoa.id];
  const [notas, setNotas] = useState({ ...(atual?.notas || {}) });
  const [elim, setElim] = useState(atual?.eliminatorio || "");
  const [obs, setObs] = useState(atual?.obs || "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const faltam = dados.criterios.filter((c) => notas[c.id] == null).length;
  const media = mediaDe({ notas }, dados.criterios);

  const salvar = async () => {
    if (faltam && !elim) { setErro(`Faltam ${faltam} critério(s).`); return; }
    setSalvando(true); setErro("");
    try { await salvarLideranca(convite, { pessoaId: pessoa.id, notas, eliminatorio: elim, obs }); aoFechar(true); }
    catch (ex) { setErro(ex.message); setSalvando(false); }
  };

  return (
    <div className="card votar-cartao">
      <div>
        <div className="suave peq">{mesLongo(dados.mes)}</div>
        <h1 style={{ fontSize: 20 }}>{pessoa.nome}</h1>
      </div>
      {dados.criterios.map((c) => (
        <div key={c.id} className="linha-criterio">
          <div><b style={{ fontWeight: 600 }}>{c.nome}</b><div className="suave peq">{c.desc}</div></div>
          <div className="escala escala-5" role="radiogroup" aria-label={c.nome}>
            {[0, 1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={notas[c.id] === n} className={`escala-n${notas[c.id] === n ? " ativa" : ""}${n <= 2 ? " baixa" : ""}`} onClick={() => { setNotas({ ...notas, [c.id]: n }); setErro(""); }}>{n}</button>)}
          </div>
        </div>
      ))}
      <div className="campo">
        <label htmlFor="li-el">Critério eliminatório</label>
        <select id="li-el" className="entrada" value={elim} onChange={(e) => setElim(e.target.value)}>
          <option value="">Nenhum: concorre ao destaque</option>
          {dados.motivos.map((m) => <option key={m}>{m}</option>)}
        </select>
        <span className="suave peq">Atestado médico entregue no prazo não é eliminatório. Não escreva detalhes de saúde.</span>
      </div>
      <div className="campo"><label htmlFor="li-obs">Observação (só a gestão vê)</label><textarea id="li-obs" className="entrada" rows={2} maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
      {erro && <div className="aviso ruim">{erro}</div>}
      <div className="votar-nav" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <span className="suave peq">Média: {media == null ? "—" : `${nota1(media)} de 5`}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn claro" onClick={() => aoFechar(false)}>Voltar</button>
          <button type="button" className="btn" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}
