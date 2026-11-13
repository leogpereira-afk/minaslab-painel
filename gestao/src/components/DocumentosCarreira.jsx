// Documentos do plano de carreira, no mesmo padrão dos formulários do PT 001
// (A4 em pé, cabeçalho MinasLab): o PCC (o plano) e o RMC (registro de
// movimentação de cargo, para assinar).
import logoMinasLab from "../assets/logo-minaslab.webp";
import { dataCurta, nomeProprio } from "../lib/format.js";
import {
  DOC_PCC, DOC_RMC, GRUPOS_RISCO, NIVEIS, TRILHAS_CARREIRA, LATERAIS, REGRAS, TEXTO_PLANO, FORA_DO_PLANO, nivelPorId, exigenciaPCMSO, nomeTipoMov, faixaSalarial, formatarFaixa, CULTURA,
} from "../lib/planoCarreira.js";

function Cab({ doc, folha, total }) {
  return (
    <table className="fm-cab">
      <tbody>
        <tr>
          <td rowSpan={4} className="fm-logo"><img src={logoMinasLab} alt="MinasLab" /></td>
          <td rowSpan={4} className="fm-titulo">{doc.titulo}</td>
          <td className="fm-cod"><b>{doc.codigo}</b></td>
          <td className="fm-cod"><b>Documento de Origem: {doc.origem}</b></td>
        </tr>
        <tr><td colSpan={2} className="fm-cod"><b>Emissão: {doc.emissao}</b></td></tr>
        <tr><td colSpan={2} className="fm-cod"><b>{doc.rev}</b></td></tr>
        <tr><td colSpan={2} className="fm-cod"><b>Folha {folha} de {total}</b></td></tr>
      </tbody>
    </table>
  );
}
const Folha = ({ doc, folha, total, children }) => <div className="fm-folha"><Cab doc={doc} folha={folha} total={total} />{children}</div>;
const Sec = ({ children, cols = 1 }) => <tr><th colSpan={cols} className="fm-sec">{children}</th></tr>;
const Assin = ({ rotulo, largura }) => <div className="fm-assin" style={largura ? { width: largura } : undefined}><div className="fm-linha" /><div><b>{rotulo}</b></div><div>Data: ____/____/______</div></div>;

/** O plano completo: regras na folha 1, uma tabela por trilha nas seguintes. */
export function DocPCC({ ajustes = {} }) {
  const faixa = (id) => { const f = faixaSalarial(id, ajustes); return f ? formatarFaixa(f) + (f.obs ? ` (${f.obs})` : "") : ""; };
  const tempo = (id) => ajustes[id]?.tempoMinimo ?? nivelPorId(id)?.tempoMinimo;
  const grupos = [TRILHAS_CARREIRA.slice(0, 2), TRILHAS_CARREIRA.slice(2, 4), TRILHAS_CARREIRA.slice(4)];
  const total = 1 + grupos.length + 1;
  return (
    <>
      <Folha doc={DOC_PCC} folha={1} total={total}>
        <table className="fm-tab"><tbody>
          <Sec>1. Objetivo</Sec><tr><td>{TEXTO_PLANO.objetivo}</td></tr>
          <Sec>2. Princípios</Sec><tr><td>{TEXTO_PLANO.principios.map((p) => <div key={p}>• {p}</div>)}</td></tr>
          <Sec>2.1 Cultura MinasLab (requisito de todos os cargos)</Sec>
          <tr><td>
            <div><b>Missão:</b> {CULTURA.missao}</div>
            <div><b>Visão:</b> {CULTURA.visao}</div>
            <div><b>Valores:</b> {CULTURA.valores.map((v) => `${v.nome} (${v.desc.replace(/\.$/, "").toLowerCase()})`).join("; ")}.</div>
          </td></tr>
          <Sec>3. Tipos de movimentação</Sec><tr><td>{TEXTO_PLANO.movimentos.map((p) => <div key={p}>• {p}</div>)}</td></tr>
          <Sec>4. Critérios para o próximo passo (conferidos no sistema de gestão)</Sec>
          <tr><td>
            <div>a) Tempo mínimo no cargo atual, definido para cada nível (tabelas a seguir).</div>
            <div>b) Avaliação de desempenho: média mínima {REGRAS.notaMinima} (de 0 a 10) em pelo menos {REGRAS.minimoAvaliacoes} meses avaliados nos últimos {REGRAS.mesesAvaliacao} meses.</div>
            <div>c) Treinamentos obrigatórios da função concluídos, sem avaliação de eficácia (AVET) não eficaz em aberto.</div>
            <div>d) PDI: ao menos um item concluído nos últimos dois trimestres e nenhum vencido em aberto.</div>
            <div>e) No máximo {REGRAS.ocorrenciasMax} ocorrências registradas nos últimos {REGRAS.mesesAvaliacao} meses.</div>
            <div>f) Estágio na função: autônomo.</div>
            <div>g) Cultura MinasLab: os {CULTURA.valores.length} valores da empresa conferidos pela liderança nos últimos {REGRAS.mesesAvaliacao} meses.</div>
            <div>h) Requisitos do cargo de destino (formação, autorizações e habilitações) comprovados.</div>
            <div>i) Necessidade da vaga e orçamento aprovados pela direção.</div>
          </td></tr>
          <Sec>5. Ciclo e registro</Sec><tr><td>{TEXTO_PLANO.ciclo}</td></tr>
          <Sec>6. Saúde ocupacional (PCMSO 2026)</Sec>
          <tr><td>
            <div>Toda mudança de cargo segue o PCMSO. Quando a mudança troca o grupo de risco, o ASO de mudança de risco é feito antes de começar na função nova; quando não troca, emite-se o formulário de alteração de cargo, sem ASO.</div>
            {Object.values(GRUPOS_RISCO).map((g) => <div key={g.nome}>• <b>{g.nome}</b>: {g.riscos}.</div>)}
          </td></tr>
          <Sec>7. Remuneração</Sec><tr><td>{TEXTO_PLANO.salario}</td></tr>
          <Sec>8. Base legal e revisão</Sec><tr><td>{TEXTO_PLANO.legal} {TEXTO_PLANO.revisao} Cargos fora do plano (de confiança, nomeados pela direção): {FORA_DO_PLANO.join(" e ")}.</td></tr>
        </tbody></table>
      </Folha>
      {grupos.map((ts, gi) => (
        <Folha key={gi} doc={DOC_PCC} folha={gi + 2} total={total}>
          {ts.map((t) => (
            <table key={t.id} className="fm-tab"><tbody>
              <Sec cols={5}>Trilha: {t.nome}</Sec>
              <tr><th style={{ width: "18%" }}>Cargo</th><th style={{ width: "10%" }}>Grupo de risco (PCMSO)</th><th>O que faz</th><th style={{ width: "28%" }}>Requisitos</th><th style={{ width: "11%" }}>Tempo mínimo · faixa</th></tr>
              {t.niveis.map((id) => {
                const n = nivelPorId(id);
                return (
                  <tr key={id}>
                    <td><b>{n.cargo}</b>{n.pcmso && n.pcmso !== n.cargo ? <div>PCMSO: {n.pcmso}</div> : null}</td>
                    <td>{GRUPOS_RISCO[n.grupo].nome}</td>
                    <td>{n.escopo}</td>
                    <td>{n.requisitos.map((r) => <div key={r}>• {r}</div>)}</td>
                    <td>{tempo(id)} meses{faixa(id) ? <div>{faixa(id)}</div> : null}</td>
                  </tr>
                );
              })}
            </tbody></table>
          ))}
        </Folha>
      ))}
      <Folha doc={DOC_PCC} folha={total} total={total}>
        <table className="fm-tab"><tbody>
          <Sec cols={3}>Movimentos laterais previstos</Sec>
          <tr><th>De</th><th>Para</th><th>Observação e PCMSO</th></tr>
          {LATERAIS.map((l) => (
            <tr key={l.de + l.para}><td>{nivelPorId(l.de).cargo}</td><td>{nivelPorId(l.para).cargo}</td><td>{l.obs} {exigenciaPCMSO(l.de, l.para).aso ? "Exige ASO de mudança de risco." : "Sem ASO (formulário de alteração de cargo)."}</td></tr>
          ))}
        </tbody></table>
        <table className="fm-tab"><tbody>
          <Sec cols={2}>Correspondência com o PCMSO 2026</Sec>
          <tr><th>Cargo no plano</th><th>Função no PCMSO</th></tr>
          {NIVEIS.map((n) => <tr key={n.id}><td>{n.cargo}</td><td>{n.pcmso || "Não consta: incluir na próxima revisão do PCMSO"}</td></tr>)}
        </tbody></table>
        <div className="fm-assins" style={{ justifyContent: "space-between" }}><Assin rotulo="Elaborado por" /><Assin rotulo="Aprovado pela direção" /></div>
      </Folha>
    </>
  );
}

/** Registro de movimentação de cargo (para assinar). */
export function DocRMC({ mov }) {
  const de = nivelPorId(mov.de), para = nivelPorId(mov.para);
  const pc = exigenciaPCMSO(mov.de, mov.para);
  const crit = mov.criterios || [];
  const sim = (v) => (v === true ? "Atende" : v === false ? "Não atende" : "Não conferido");
  return (
    <Folha doc={DOC_RMC} folha={1} total={1}>
      <table className="fm-tab"><tbody>
        <tr><th style={{ width: "22%" }}>Colaborador(a)</th><td colSpan={3}>{nomeProprio(mov.nome)}</td></tr>
        <tr><th>Tipo</th><td>{nomeTipoMov(mov.tipoMov)}</td><th style={{ width: "18%" }}>Vale a partir de</th><td>{dataCurta(mov.data)}</td></tr>
        <tr><th>Cargo atual</th><td>{de?.cargo || mov.deTexto || "—"}</td><th>Novo cargo</th><td><b>{para?.cargo || "—"}</b></td></tr>
        <tr><th>Grupo de risco</th><td>{de ? GRUPOS_RISCO[de.grupo].nome : "—"}</td><th>Novo grupo</th><td>{para ? GRUPOS_RISCO[para.grupo].nome : "—"}</td></tr>
      </tbody></table>
      {crit.length > 0 && (
        <table className="fm-tab"><tbody>
          <Sec cols={3}>Critérios do plano (conferidos no sistema em {dataCurta(mov.conferidoEm || mov.data)})</Sec>
          <tr><th style={{ width: "30%" }}>Critério</th><th style={{ width: "16%" }}>Situação</th><th>Detalhe</th></tr>
          {crit.map((c) => <tr key={c.id}><td>{c.nome}</td><td>{sim(c.ok)}</td><td>{c.detalhe}</td></tr>)}
          <tr><td>Requisitos do novo cargo</td><td>{sim(mov.requisitosOk)}</td><td>{para?.requisitos.join("; ")}</td></tr>
          <tr><td>Vaga e orçamento</td><td>{mov.vagaOk ? "Aprovados" : "Não conferido"}</td><td>Aprovação da direção</td></tr>
        </tbody></table>
      )}
      <table className="fm-tab"><tbody>
        <Sec cols={2}>Saúde ocupacional (PCMSO)</Sec>
        <tr><td colSpan={2}>{pc?.texto}</td></tr>
        {pc?.aso ? <tr><th style={{ width: "30%" }}>ASO de mudança de risco em</th><td>{mov.asoEm ? dataCurta(mov.asoEm) : "____/____/______"}</td></tr> : <tr><th style={{ width: "30%" }}>Formulário de alteração de cargo</th><td>( {mov.formularioOk ? "X" : " "} ) emitido e enviado à clínica</td></tr>}
        <tr><th>Cargo atualizado no eSocial</th><td>( ) sim, pela contabilidade em ____/____/______</td></tr>
      </tbody></table>
      <table className="fm-tab"><tbody>
        <Sec>Observações</Sec><tr><td className="fm-texto">{mov.obs}</td></tr>
      </tbody></table>
      <div className="fm-assins" style={{ justifyContent: "space-between", gap: "8mm" }}><Assin rotulo="Colaborador(a)" largura="56mm" /><Assin rotulo="Liderança direta" largura="56mm" /><Assin rotulo="Direção" largura="56mm" /></div>
    </Folha>
  );
}
