import { useDados } from "../lib/dados.jsx";
import { link } from "../lib/rota.js";
import { totalProposta } from "../lib/propostas.js";
import { brl } from "../lib/formato.js";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function GraficoMensal({ propostas }) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const porMes = (a) => MESES.map((_, m) => propostas.filter((p) => p.criacao.startsWith(`${a}-${String(m + 1).padStart(2, "0")}`)).length);
  const atual = porMes(ano).slice(0, hoje.getMonth() + 1);
  const anterior = porMes(ano - 1);
  const max = Math.max(4, ...atual, ...anterior);
  const passo = Math.max(1, Math.ceil(max / 4));
  const topo = passo * 4;
  const W = 1000, H = 200, P = 34;
  const x = (i) => P + (i * (W - 2 * P)) / 11;
  const y = (v) => H - 24 - (v / topo) * (H - 44);
  const linha = (arr) => arr.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <div className="chartbox">
      <div className="card" style={{ border: 0, padding: 0 }}><div className="ct"><span>Total Mensal de Propostas Emitidas (últimos 2 anos)</span><span>···</span></div></div>
      <div className="legend"><span><i style={{ background: "#16a897" }} />{ano}</span><span><i style={{ background: "#24444f" }} />{ano - 1}</span></div>
      <svg className="ch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Propostas emitidas por mês">
        {[0, 1, 2, 3, 4].map((k) => <g key={k}><line x1={P} x2={W - P} y1={y(k * passo)} y2={y(k * passo)} stroke="#e8eeee" /><text x={P - 6} y={y(k * passo) + 3} textAnchor="end">{k * passo}</text></g>)}
        {MESES.map((m, i) => <text key={m} x={x(i)} y={H - 6} textAnchor="middle">{m}</text>)}
        <polyline points={linha(anterior)} fill="none" stroke="#24444f" strokeWidth="2" />
        <polyline points={linha(atual)} fill="none" stroke="#16a897" strokeWidth="2" />
        {atual.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === atual.length - 1 ? 4 : 2.5} fill="#16a897" />)}
      </svg>
    </div>
  );
}

const Cartao = ({ titulo, valor, href }) => {
  const corpo = <><div className="ct"><span>{titulo}</span><span>···</span></div><div className="cv">{valor}</div></>;
  return href ? <a className="card" href={href}>{corpo}</a> : <div className="card">{corpo}</div>;
};

export default function Dashboard() {
  const { dados } = useDados();
  const { propostas, clientes, solicitantes } = dados;
  const aceitas = propostas.filter((p) => p.status === "Aceito");
  const recusadas = propostas.filter((p) => ["Recusado", "Cancelado", "A.C recursada"].includes(p.status)).length;
  const revisadas = propostas.filter((p) => p.revs?.length).length;
  const ativos = clientes.filter((c) => c.status === "Ativo").length;
  return (
    <>
      <div className="callout">
        <p><b>Transforme seus dados em decisões.</b></p>
        <p>Os indicadores abaixo são calculados em tempo real a partir das propostas e cadastros do LIMS.</p>
      </div>
      <div className="sec-title">Comercial</div>
      <div className="cards">
        <Cartao titulo="Total de Propostas" valor={propostas.length} href={link("proposedlist")} />
        <Cartao titulo="Total de Propostas Aceitas" valor={aceitas.length} href={link("proposedlist")} />
        <Cartao titulo="Total de Propostas Recusadas/Canceladas" valor={recusadas} href={link("proposedlist")} />
        <Cartao titulo="Total de Propostas Revisadas" valor={revisadas} href={link("proposedlist")} />
      </div>
      <GraficoMensal propostas={propostas} />
      <div className="sec-title">Cadastro</div>
      <div className="cards">
        <Cartao titulo="Clientes ativos" valor={ativos} href={link("customers")} />
        <Cartao titulo="Clientes inativos" valor={clientes.length - ativos} href={link("customers")} />
        <Cartao titulo="Solicitantes" valor={solicitantes.length} href={link("solicitantes")} />
        <Cartao titulo="Valor aceito" valor={<span style={{ fontSize: 26 }}>{brl(aceitas.reduce((s, p) => s + totalProposta(p), 0))}</span>} />
      </div>
    </>
  );
}
