// Identidade sempre por ID; registros antigos sem ficha conservam o nome carimbado.
// Apenas apresentação: nunca reescreve históricos no banco.
export function nomesAtuais(registros, pessoas, idCampo = 'pessoaId', nomeCampo = 'pessoaNome') {
  const porId = new Map((pessoas || []).map(p => [p.id, p]));
  return (registros || []).map(r => {
    const nome = porId.get(r[idCampo])?.nome;
    return nome ? { ...r, [nomeCampo]: nome } : r;
  });
}
