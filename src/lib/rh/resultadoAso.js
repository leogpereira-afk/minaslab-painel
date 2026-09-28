// Resultado do ASO lido da observação digitada ao enviar o documento ("periódico, apto, clínica...").
//
// Na dúvida, "aguardando": esse grupo tem quem olhe ("Aguardando laudo"). "apto" não gera alerta,
// nem o cartão de restrição, nem mudança de escala; errar para "apto" esconde um exame.
// Por isso a negação vem antes ("não-apto", "não está apto", "inapta"), e "não" só nega o apto
// quando o que está no meio é verbo de estado ("não foi considerado apto"), nunca outra frase
// ("não apresenta restrições. Apto" é apto).

const semAcento = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const APTO = /\bapt[oa]s?\b/;
const INAPTO = /\binapt[oa]s?\b/;
const NAO_APTO = /\bnao\b(?:[\s-]+(?:esta|e|foi|sera|ficou|se|encontra|considerad[oa]|julgad[oa]|declarad[oa])){0,3}[\s-]+apt[oa]s?\b/;
// Restrição logo depois do apto, cada uma olhada com o que vem antes dela: "sem restrição",
// "não possui restrições" e "nenhuma restrição" negam só aquela; "apto com restrição para
// altura, sem restrição para as demais" continua com restrição.
const TRECHO_DEPOIS_DO_APTO = /\bapt[oa]s?\b([^.;\n]{0,40})/g;
const NEGA_RESTRICAO = /\b(?:sem|nao|nenhuma?)\b[^.;,\n]{0,15}$/;

function temRestricao(s) {
  for (const apto of s.matchAll(TRECHO_DEPOIS_DO_APTO)) {
    const trecho = apto[1];
    for (const r of trecho.matchAll(/\brestri/g)) {
      if (!NEGA_RESTRICAO.test(trecho.slice(0, r.index))) return true;
    }
  }
  return false;
}

export function resultadoAso(obs) {
  const s = semAcento(String(obs || "").toLowerCase());
  if (INAPTO.test(s) || NAO_APTO.test(s)) return "inapto";
  if (!APTO.test(s)) return "aguardando";
  return temRestricao(s) ? "apto_com_restricao" : "apto";
}
