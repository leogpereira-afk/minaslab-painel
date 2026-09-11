import { FINANCEIRO_SERVICOS } from "../lib/api.js";
import { comCracha, mensagemDoStatus } from "../lib/sessao.js";

function erroTexto(v){if(v==null)return"";if(typeof v==="string")return v.trim();if(v instanceof Error)return v.message||String(v);if(typeof v==="object"){for(const k of["erro","message","mensagem","details"]){const s=erroTexto(v[k]);if(s)return s}}return String(v)}
async function chamar(action,corpo={}){const resp=await comCracha(FINANCEIRO_SERVICOS,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...corpo})});const body=await resp.json().catch(()=>null);if(!resp.ok)throw new Error(erroTexto(body)||mensagemDoStatus(resp.status));return body||{}}
export const servicosGeradosListar=(filtros={})=>chamar("listar",{filtros});
export const servicoGeradoSalvar=registro=>chamar("salvar",{registro}).then(r=>r.item);
export const servicoParticularidadeSalvar=registro=>chamar("particularidadeSalvar",{registro}).then(r=>r.item);
export const servicosGeradosSincronizar=()=>chamar("sincronizarPagamentos");
export const servicoGeradoHistorico=id=>chamar("historico",{id}).then(r=>r.itens||[]);
export async function servicosGeradosImportar(empresaId,arquivo){const base64=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||"").split(",")[1]||"");fr.onerror=()=>reject(new Error("Não foi possível ler o arquivo."));fr.readAsDataURL(arquivo)});return chamar("importar",{empresaId,arquivoNome:arquivo.name,base64});}
