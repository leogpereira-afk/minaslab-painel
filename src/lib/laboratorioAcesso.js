// Quais seções do Laboratório uma pessoa abre. A direção e quem tem a página inteira ("laboratorio") abrem todas;
// os demais, só as marcadas em Acessos ("laboratorio/entradas", "laboratorio/qualidade"...).
// Recorte de TELA: os dados das Entradas de amostras são protegidos no servidor (ml-laboratorio).
export function secoesLiberadas(sessao, todas) {
  if (!sessao || sessao.papel === "direcao") return todas;
  const p = sessao.paginas_consulta || [];
  if (!p.includes("__matriz_v1") || p.includes("laboratorio")) return todas;
  return todas.filter((s) => p.includes(`laboratorio/${s.valor}`));
}
