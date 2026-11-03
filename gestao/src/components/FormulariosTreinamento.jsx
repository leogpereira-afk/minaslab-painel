// Formulários do PT 001 prontos para imprimir e assinar (A4 em pé):
// REQT, RT e AVET, com o cabeçalho MinasLab (código, origem, emissão,
// revisão e folha). "Imprimir" manda só o documento para a impressora (ou
// para salvar em PDF).
import { createPortal } from "react-dom";
import { Modal } from "./ui.jsx";
import logoMinasLab from "../assets/logo-minaslab.webp";
import { dataCurta, nomeProprio } from "../lib/format.js";
import { fmtNota } from "../lib/treinamentosPessoa.js";
import {
  FORMULARIOS, ORIGEM, TIPOS_TREINAMENTO, EXPECTATIVAS, AVET_QUESTOES, COMO_AVALIADO, resultadoEficacia, folhasRT, textoCarga,
} from "../lib/formulariosTreinamento.js";

const X = ({ on }) => <span className="fm-x">{on ? "X" : ""}</span>;
const periodo = (a, b) => (b && b !== a ? `${dataCurta(a)} a ${dataCurta(b)}` : dataCurta(a));

function Cabecalho({ form, folha, total }) {
  const f = FORMULARIOS[form];
  return (
    <table className="fm-cab">
      <tbody>
        <tr>
          <td rowSpan={4} className="fm-logo"><img src={logoMinasLab} alt="MinasLab" /></td>
          <td rowSpan={4} className="fm-titulo">{f.titulo}</td>
          <td className="fm-cod"><b>{f.codigo}</b></td>
          <td className="fm-cod"><b>Documento de Origem: {ORIGEM}</b></td>
        </tr>
        <tr><td colSpan={2} className="fm-cod"><b>Emissão: {f.emissao}</b></td></tr>
        <tr><td colSpan={2} className="fm-cod"><b>{f.rev}</b></td></tr>
        <tr><td colSpan={2} className="fm-cod"><b>Folha {folha} de {total}</b></td></tr>
      </tbody>
    </table>
  );
}

const Folha = ({ form, folha = 1, total = 1, children }) => <div className="fm-folha"><Cabecalho form={form} folha={folha} total={total} />{children}</div>;
const Rot = ({ children, ...r }) => <th {...r}>{children}</th>;
const Assinatura = ({ rotulo, nome, data }) => (
  <div className="fm-assin"><div className="fm-linha" /><div><b>{rotulo}</b>{nome ? ` · ${nome}` : ""}</div>{data !== undefined && <div>Data: {data ? dataCurta(data) : "____/____/______"}</div>}</div>
);
const Tipos = ({ valor }) => (
  <span className="fm-tipos">{TIPOS_TREINAMENTO.map(([id, nome]) => <span key={id}>( {valor === id ? "X" : " "} ) {nome}</span>)}</span>
);
const Escala = ({ valor, esquerda, direita }) => (
  <div className="fm-escala"><span>{esquerda}</span>{[1, 2, 3, 4, 5].map((n) => <span key={n} className="fm-esc-cel"><small>{n}</small><X on={Number(valor) === n} /></span>)}<span>{direita}</span></div>
);

// ---------------------------------------------------------------- REQT
export function DocREQT({ req }) {
  const pessoas = req.pessoas || [];
  return (
    <Folha form="REQT">
      <table className="fm-tab"><tbody>
        <tr><Rot>Área</Rot><td>{req.area}</td><Rot>Responsável</Rot><td>{req.responsavel}</td><Rot>Data</Rot><td>{dataCurta(req.data)}</td></tr>
      </tbody></table>
      <table className="fm-tab"><tbody>
        <tr><Rot style={{ width: "26%" }}>Treinamento necessário</Rot><td>{req.titulo}</td></tr>
        <tr><Rot>Tipo</Rot><td><Tipos valor={req.tipoTreinamento} /></td></tr>
        <tr><Rot>Funcionários / Função</Rot><td>{pessoas.length ? pessoas.map((p) => <div key={p.pessoaId}>{nomeProprio(p.nome)}{p.funcao ? ` / ${p.funcao}` : ""}</div>) : "—"}</td></tr>
      </tbody></table>
      <table className="fm-tab"><tbody>
        <tr><Rot colSpan={3} className="fm-sec">Objetivos do Treinamento</Rot></tr>
        <tr><Rot colSpan={3}>I) Qual a expectativa com relação ao grau de conhecimento que os participantes deveriam ter após a conclusão do treinamento? (marque uma)</Rot></tr>
        {EXPECTATIVAS.map((t, i) => <tr key={i}><td className="fm-num">{i + 1}</td><td>{t}</td><td className="fm-marca"><X on={Number(req.expectativa) === i + 1} /></td></tr>)}
        <tr><Rot colSpan={3}>II) Qual o nível de aplicação dos conceitos ou metodologias deste treinamento nas atividades rotineiras dos participantes?</Rot></tr>
        <tr><td colSpan={3}><Escala valor={req.nivelAplicacao} esquerda="Pouco frequente" direita="Muito frequente" /></td></tr>
        <tr><Rot colSpan={3}>Descreva a situação atual que originou a necessidade deste treinamento</Rot></tr>
        <tr><td colSpan={3} className="fm-texto">{req.situacao || " "}</td></tr>
      </tbody></table>
      <table className="fm-tab"><tbody>
        <tr><Rot colSpan={4} className="fm-sec">Planejamento</Rot></tr>
        <tr><Rot>Título do treinamento</Rot><td>{req.titulo}</td><Rot>Carga horária</Rot><td>{textoCarga(req.cargaHoraria)}</td></tr>
        <tr><Rot>Data prevista para o treinamento</Rot><td>{periodo(req.inicio, req.fim)}</td><Rot>Instrutor</Rot><td>{req.instrutor}</td></tr>
        <tr><Rot>Local</Rot><td>{req.local}</td><Rot>Data prevista para avaliação da eficácia</Rot><td>{dataCurta(req.eficaciaPrevista)}</td></tr>
      </tbody></table>
      <table className="fm-tab"><tbody>
        <tr><Rot colSpan={4} className="fm-sec">Aprovação</Rot></tr>
        <tr><Rot style={{ width: "18%" }}>Gerente</Rot><td style={{ height: 44 }}>{req.aprovador || ""}</td><Rot style={{ width: "10%" }}>Data</Rot><td style={{ width: "22%" }}>{req.aprovadoEm ? dataCurta(req.aprovadoEm) : ""}</td></tr>
      </tbody></table>
      <p className="fm-nota">A aprovação deve ser feita antes da data do treinamento.</p>
    </Folha>
  );
}

// ---------------------------------------------------------------- RT
export function DocRT({ reg, trilha }) {
  const presentes = (reg.participantes || []).filter((p) => p.presente !== false);
  const folhas = folhasRT(presentes);
  const objetivo = reg.objetivo ?? trilha?.objetivo ?? "";
  const material = reg.material ?? trilha?.documento ?? "";
  return folhas.map((lista, k) => (
    <Folha key={k} form="RT" folha={k + 1} total={folhas.length}>
      <table className="fm-tab"><tbody>
        <tr><Rot style={{ width: "30%" }}>Responsável pelo treinamento e capacitação</Rot><td colSpan={5}>{reg.instrutor}</td></tr>
        <tr><Rot>Data</Rot><td>{periodo(reg.data, reg.dataFim)}</td><Rot>Carga horária</Rot><td>{textoCarga(reg.cargaHoraria) || (trilha?.minutos ? textoCarga(trilha.minutos / 60) : "")}</td><Rot>Local</Rot><td>{reg.local}</td></tr>
      </tbody></table>
      <table className="fm-tab"><tbody>
        <tr><Rot style={{ width: "20%" }}>Treinamento</Rot><td>{reg.titulo || trilha?.nome}</td></tr>
        <tr><Rot>Tipo</Rot><td><Tipos valor={reg.tipoTreinamento} /></td></tr>
        <tr><Rot>Objetivo</Rot><td>{objetivo}</td></tr>
        <tr><Rot>Material / procedimento</Rot><td>{material || " "}</td></tr>
      </tbody></table>
      <table className="fm-tab fm-presenca"><thead>
        <tr><th style={{ width: "36%" }}>Participantes</th><th style={{ width: "24%" }}>Função</th><th style={{ width: "10%" }}>Nota</th><th>Assinatura</th></tr>
      </thead><tbody>
        {lista.map((p) => <tr key={p.pessoaId}><td>{nomeProprio(p.nome)}</td><td>{p.funcao || ""}</td><td className="fm-num">{p.nota != null ? fmtNota(p.nota) : ""}</td><td /></tr>)}
      </tbody></table>
      {k === folhas.length - 1 && <>
        <table className="fm-tab"><tbody>
          <tr><Rot className="fm-sec">Observações</Rot></tr>
          <tr><td className="fm-texto">{reg.obs || " "}</td></tr>
          <tr><Rot>Avaliação da eficácia prevista para: {reg.eficaciaPrevista ? dataCurta(reg.eficaciaPrevista) : "____/____/______"}</Rot></tr>
        </tbody></table>
        <div className="fm-assins"><Assinatura rotulo="Instrutor" nome={reg.instrutor} data={reg.dataFim || reg.data} /></div>
      </>}
    </Folha>
  ));
}

// ---------------------------------------------------------------- AVET
export function DocAVET({ reg, participante: p, av = {}, trilha }) {
  const res = resultadoEficacia(av);
  const plano = av.plano || {};
  const naoEficaz = res === "nao-eficaz";
  const total = naoEficaz ? 2 : 1;
  const linhas = (xs, n = 3) => [...(xs || []), ...Array(Math.max(0, n - (xs || []).length)).fill({})].slice(0, Math.max(n, (xs || []).length));
  return (
    <>
      <Folha form="AVET" folha={1} total={total}>
        <table className="fm-tab"><tbody>
          <tr><Rot style={{ width: "14%" }}>Nome</Rot><td>{nomeProprio(p.nome)}</td><Rot style={{ width: "12%" }}>Função</Rot><td style={{ width: "26%" }}>{av.funcao || p.funcao || ""}</td></tr>
          <tr><Rot>Treinamento</Rot><td>{reg.titulo || trilha?.nome}</td><Rot>Realizado em</Rot><td>{periodo(reg.data, reg.dataFim)}</td></tr>
          <tr><Rot>Registro (RT)</Rot><td>Instrutor: {reg.instrutor || "—"}</td><Rot>Data da avaliação</Rot><td>{av.data ? dataCurta(av.data) : ""}</td></tr>
        </tbody></table>
        <table className="fm-tab"><tbody>
          <tr><Rot colSpan={2} className="fm-sec">Responsável pela avaliação</Rot></tr>
          <tr><Rot>Nome</Rot><Rot>Função</Rot></tr>
          <tr><td>{av.avaliador || ""}</td><td>{av.funcaoAvaliador || ""}</td></tr>
        </tbody></table>
        <table className="fm-tab"><tbody>
          <tr><Rot colSpan={3} className="fm-sec">Avaliação</Rot></tr>
          {AVET_QUESTOES.map((q) => [
            <tr key={q.id}><Rot colSpan={3}>{q.titulo}</Rot></tr>,
            ...q.opcoes.map((t, i) => <tr key={`${q.id}${i}`}><td className="fm-num">{i + 1}</td><td>{t}</td><td className="fm-marca"><X on={Number(av[q.id]) === i + 1} /></td></tr>),
          ])}
          <tr><Rot colSpan={3}>Descrever as melhorias obtidas</Rot></tr>
          <tr><td colSpan={3} className="fm-texto">{av.melhorias || " "}</td></tr>
          <tr><Rot colSpan={3}>Como foi avaliado</Rot></tr>
          <tr><td colSpan={3}><span className="fm-tipos">{COMO_AVALIADO.map(([id, nome]) => <span key={id}>( {(av.como || []).includes(id) ? "X" : " "} ) {nome}</span>)}</span>{av.evidencia ? <div style={{ marginTop: 4 }}>Evidência: {av.evidencia}</div> : null}</td></tr>
          <tr><Rot colSpan={3}>IV) De forma geral, como foi avaliada a eficácia do treinamento?</Rot></tr>
          <tr><td colSpan={3}><Escala valor={av.iv} esquerda="Pouco eficaz" direita="Muito eficaz" /></td></tr>
          <tr><Rot colSpan={3}>Resultado: <span className="fm-tipos" style={{ display: "inline-flex", marginLeft: 8 }}><span>( {res === "eficaz" ? "X" : " "} ) Eficaz</span><span>( {naoEficaz ? "X" : " "} ) Não eficaz</span></span></Rot></tr>
        </tbody></table>
        <p className="fm-nota">Critério: eficaz quando a avaliação geral (IV) é 4 ou 5 e nenhuma das respostas I, II e III fica abaixo de 3. Não eficaz: preencher o plano de ação (folha 2).</p>
        <table className="fm-tab"><tbody>
          <tr><Rot colSpan={4} className="fm-sec">Aprovação</Rot></tr>
          <tr><Rot style={{ width: "18%" }}>Gerente</Rot><td style={{ height: 40 }}>{av.aprovador || ""}</td><Rot style={{ width: "10%" }}>Data</Rot><td style={{ width: "22%" }}>{av.aprovadoEm ? dataCurta(av.aprovadoEm) : ""}</td></tr>
        </tbody></table>
      </Folha>
      {naoEficaz && (
        <Folha form="AVET" folha={2} total={2}>
          <table className="fm-tab"><tbody>
            <tr><Rot colSpan={2} className="fm-sec">Plano de ação para não eficácia do treinamento</Rot></tr>
            <tr><Rot style={{ width: "20%" }}>Treinamento</Rot><td>{reg.titulo || trilha?.nome} · {nomeProprio(p.nome)}</td></tr>
            <tr><Rot colSpan={2}>Descrição e causa da não eficácia</Rot></tr>
            <tr><td colSpan={2} className="fm-texto">{plano.causa || " "}</td></tr>
          </tbody></table>
          <table className="fm-tab"><thead><tr><th>Ação a ser tomada</th><th style={{ width: "26%" }}>Responsável</th><th style={{ width: "16%" }}>Data</th></tr></thead><tbody>
            {linhas(plano.acoes).map((x, i) => <tr key={i}><td>{x.acao || " "}</td><td>{x.responsavel || ""}</td><td>{x.data ? dataCurta(x.data) : ""}</td></tr>)}
          </tbody></table>
          <table className="fm-tab"><thead><tr><th>Verificação da eficácia da ação tomada</th><th style={{ width: "26%" }}>Responsável</th><th style={{ width: "16%" }}>Data</th></tr></thead><tbody>
            <tr><td>{plano.verificacao || " "}</td><td>{plano.verificacaoResponsavel || ""}</td><td>{plano.verificacaoData ? dataCurta(plano.verificacaoData) : ""}</td></tr>
            {[0, 1].map((i) => <tr key={i}><td> </td><td /><td /></tr>)}
          </tbody></table>
          <table className="fm-tab"><tbody>
            <tr><Rot colSpan={4} className="fm-sec">Aprovação da nova avaliação</Rot></tr>
            <tr><Rot style={{ width: "18%" }}>Gerente</Rot><td style={{ height: 40 }}>{plano.aprovador || ""}</td><Rot style={{ width: "10%" }}>Data</Rot><td style={{ width: "22%" }}>{plano.aprovadoEm ? dataCurta(plano.aprovadoEm) : ""}</td></tr>
          </tbody></table>
          {plano.novaAvaliacaoEm && <p className="fm-nota">Nova avaliação da eficácia prevista para {dataCurta(plano.novaAvaliacaoEm)}.</p>}
        </Folha>
      )}
    </>
  );
}

/** Prévia + impressão (A4 em pé). */
export function JanelaDocumento({ titulo, aoFechar, children }) {
  return (
    <Modal titulo={titulo} aoFechar={aoFechar} largo>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn" onClick={() => window.print()}>Imprimir ou salvar em PDF</button>
        <span className="suave peq">Imprima, colha as assinaturas e arquive. Na janela de impressão, “Salvar como PDF” guarda uma cópia.</span>
      </div>
      <div className="fm-previa">{children}</div>
      {createPortal(<><style>{"@media print { @page { size: A4 portrait; margin: 10mm; } }"}</style><div className="impressao cert-avulso fm-impressao" aria-hidden="true">{children}</div></>, document.body)}
    </Modal>
  );
}
