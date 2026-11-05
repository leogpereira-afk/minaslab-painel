// Escopo de acreditação (Cgcre CRL 1943, ABNT NBR ISO/IEC 17025). O ensaio só
// sai como acreditado no relatório quando: o parâmetro está marcado como
// acreditado, o método dele está no escopo e a matriz da amostra está entre as
// matrizes daquele item do escopo. Ensaios de campo (in loco) usam os itens
// de campo do escopo; os de laboratório, os demais.

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

// "SMWW, 24ª Edição, Método 4500 Cl- B" → "4500CLB"; "POP-LAB-016" → "POPLAB016".
export function chaveMetodo(texto) {
  let t = semAcento(texto).toUpperCase();
  const pop = t.match(/POP-?\s*(LAB|AM)-?\s*(\d+)/);
  if (pop) return `POP${pop[1]}${pop[2].padStart(3, "0")}`;
  const fb = t.match(/FARMACOPEIA.*?(\d+\.\d+\.\d+\.\d+)/);
  if (fb) return `FB${fb[1].replace(/\./g, "")}`;
  t = t.replace(/:\s*\d{4}/g, "").replace(/^.*?METODO\s*/, "").replace(/^(SMSM24|SMWW|SMEWW|SM\d{0,2}|STANDARD METHODS)[\s,.-]*(\d{1,2}\s*[ªA°O]?\s*EDICAO)?[\s,.-]*/, "");
  const m = t.match(/\d{4}[^,;/]*/);
  return m ? m[0].replace(/\bE\b/g, "E").replace(/[^A-Z0-9+]/g, "") : t.replace(/[^A-Z0-9+]/g, "");
}

export function edicaoMetodo(texto) {
  const t = semAcento(texto).toUpperCase();
  const m = t.match(/(\d{2})\s*[ªA°O]?\s*EDICAO/) || t.match(/\bSM(?:SM)?(\d{2})\b/);
  return m ? m[1] : "";
}

const GRUPOS = [
  ["agua bruta", /bruta|manancia|nascente|rio\b|represa|lago/], ["agua tratada", /tratad|eta\b/], ["agua para consumo humano", /consumo humano|potavel|bebedouro|torneira/],
  ["agua salina", /salina/], ["agua salobra", /salobra/], ["agua subterranea", /subterr|poco|piezom/], ["agua residual", /residual|efluente|esgoto/],
  ["dialisato", /dialisato/], ["agua de hemodialise", /hemodialise/], ["agua purificada", /purificada/], ["agua para injetavel", /injetavel/], ["agua p/ uso farmaceutico", /farmac/],
];
// Grupos de matriz do escopo em que a matriz da amostra se encaixa.
export function gruposDaMatriz(matriz) {
  const t = semAcento(matriz).toLowerCase();
  return GRUPOS.filter(([, re]) => re.test(t)).map(([g]) => g);
}

const ehCampo = (p) => p?.inloco === "Sim" || /in[\s-]*situ/i.test(`${p?.parametro || ""} ${p?.nome || ""}`);

// Itens do escopo que cobrem o método do parâmetro (sem olhar a matriz).
export function itensDoMetodo(escopo, metodoTexto, campo = false) {
  const k = chaveMetodo(metodoTexto);
  if (!k) return [];
  return (escopo || []).filter((e) => e.status !== "Inativo" && chaveMetodo(e.metodo) === k && (!!e.campo === !!campo || e.classe === "Ensaios biológicos"));
}

// O ensaio sai como acreditado neste relatório?
export function acreditadoNoEscopo(escopo, { parametro, metodoTexto, matriz }) {
  if (!parametro || parametro.acreditado !== "Sim") return false;
  if (!(escopo || []).length) return true; // sem escopo cadastrado vale o cadastro do parâmetro
  const itens = itensDoMetodo(escopo, metodoTexto, ehCampo(parametro));
  if (!itens.length) return false;
  const grupos = gruposDaMatriz(matriz);
  if (!grupos.length) return false;
  return itens.some((e) => (e.matrizes || []).some((m) => grupos.includes(semAcento(m).toLowerCase())));
}

// Conferência do cadastro de parâmetros contra o escopo.
export function conferirParametros(escopo, parametros, nomeMetodo) {
  const out = [];
  for (const p of parametros) {
    if (p.status === "Inativo") continue;
    const met = nomeMetodo(p.metodo) || p.metodo || "";
    const itens = itensDoMetodo(escopo, met, ehCampo(p));
    const noEscopo = itens.length > 0;
    const ed = edicaoMetodo(met), edEsc = itens[0] ? edicaoMetodo(itens[0].metodo) : "";
    let situacao = "";
    if (p.acreditado === "Sim" && !noEscopo) situacao = "Marcado acreditado, método fora do escopo";
    else if (p.acreditado !== "Sim" && noEscopo) situacao = "Método do escopo, mas não marcado acreditado";
    else if (p.acreditado === "Sim" && ed && edEsc && ed !== edEsc) situacao = `Edição do método diferente do escopo (${ed}ª × ${edEsc}ª)`;
    else if (p.acreditado === "Sim") situacao = "Conforme o escopo";
    if (situacao) out.push({ id: p.id, p, metodo: met, item: itens[0] || null, situacao });
  }
  return out;
}
