import { FINANCEIRO_SERVICOS, FINANCEIRO_SERVICOS_LISTAR, FINANCEIRO_SERVICOS_IMPORT, FINANCEIRO_SERVICOS_EMPRESA, FINANCEIRO_SERVICOS_FATURAR, FINANCEIRO_SERVICOS_SYNC, FINANCEIRO_SERVICOS_NFSE_VINCULAR } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

function erroTexto(v){if(v==null)return"";if(typeof v==="string")return v.trim();if(v instanceof Error)return v.message||String(v);if(typeof v==="object"){for(const k of["erro","message","mensagem","details"]){const s=erroTexto(v[k]);if(s)return s}}return String(v)}
async function chamarUrl(url,corpo={}){const resp=await comCracha(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(corpo)});const body=await resp.json().catch(()=>null);if(!resp.ok)throw new Error(erroTexto(body)||mensagemDoStatus(resp.status));return body||{}}
const chamar=(action,corpo={})=>chamarUrl(FINANCEIRO_SERVICOS,{action,...corpo});
export const servicosGeradosListar=(filtros={})=>chamarUrl(FINANCEIRO_SERVICOS_LISTAR,{filtros});
export const servicoGeradoSalvar=registro=>chamar("salvar",{registro}).then(r=>r.item);
export const servicoParticularidadeSalvar=registro=>chamar("particularidadeSalvar",{registro}).then(r=>r.item);
export const servicosGeradosSincronizar=()=>chamarUrl(FINANCEIRO_SERVICOS_SYNC,{});
export const servicoGeradoHistorico=id=>chamar("historico",{id}).then(r=>r.itens||[]);
export const servicoGeradoEmpresa=(id,empresaId,lembrar=false)=>chamarUrl(FINANCEIRO_SERVICOS_EMPRESA,{id,empresaId:empresaId||null,lembrar}).then(r=>r.item);
export const servicoGeradoConcluirFaturamento=id=>chamarUrl(FINANCEIRO_SERVICOS_FATURAR,{id});
export const servicoGeradoVincularNfse=(servicoId,notaFiscalId)=>chamarUrl(FINANCEIRO_SERVICOS_NFSE_VINCULAR,{servicoId,notaFiscalId});
export async function servicosGeradosImportar(arquivo){const base64=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||"").split(",")[1]||"");fr.onerror=()=>reject(new Error("Não foi possível ler o arquivo."));fr.readAsDataURL(arquivo)});return chamarUrl(FINANCEIRO_SERVICOS_IMPORT,{arquivoNome:arquivo.name,base64});}
