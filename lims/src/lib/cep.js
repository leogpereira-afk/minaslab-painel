// Busca de endereço pelo CEP (ViaCEP, o mesmo serviço que o GerenciaLab usa).
export async function buscarCep(cep) {
  const d = String(cep || "").replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j.erro) return null;
    return { end: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: j.uf || "", comp: j.complemento || "" };
  } catch { return null; }
}
