const limpar=(v)=>String(v||"").replace(/\s+/g," ").trim();
const semDocumento=(v)=>limpar(v).replace(/\s*\(?\d{2,3}[.\s-]?\d{3}[.\s-]?\d{3}[-/]?\d{2,4}\)?\s*/g," ").trim();

export function nomeMovimento(m){
  const d=limpar(m?.descricao||m?.documento||"");
  if(!d)return "Movimento bancário";
  const partes=d.split(/\s*[·|]\s*/).map(limpar).filter(Boolean);
  const candidatos=[...partes].reverse();
  for(const p of candidatos){
    const para=p.match(/(?:para|de):?\s*([^|]+?)(?:\s*\(|$)/i);
    if(para?.[1])return semDocumento(para[1]).slice(0,70);
  }
  const primeiro=semDocumento(partes[0]||d)
    .replace(/^gerado automaticamente pelo omie\.cash[.:\s-]*/i,"")
    .replace(/^pix\s+(?:enviado|recebido)\s+(?:para|de)\s*/i,"")
    .trim();
  return (primeiro||"Movimento bancário").slice(0,70);
}
