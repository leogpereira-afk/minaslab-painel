from pathlib import Path

# API endpoints
p=Path('src/lib/api.js'); s=p.read_text()
old='export const FINANCEIRO_SERVICOS_FATURAR=`${API}/ml-financeiro-servicos-faturar`; export const FINANCEIRO_NFSE='
new='export const FINANCEIRO_SERVICOS_FATURAR=`${API}/ml-financeiro-servicos-faturar`; export const FINANCEIRO_SERVICOS_SYNC=`${API}/ml-financeiro-servicos-sync-v2`; export const FINANCEIRO_SERVICOS_NFSE_VINCULAR=`${API}/ml-financeiro-servicos-nfse-vincular`; export const FINANCEIRO_NFSE='
if old not in s: raise SystemExit('api.js: ponto de endpoints nao encontrado')
p.write_text(s.replace(old,new,1))

# service layer
p=Path('src/services/servicosGerados.js'); s=p.read_text()
s=s.replace('FINANCEIRO_SERVICOS_FATURAR }', 'FINANCEIRO_SERVICOS_FATURAR, FINANCEIRO_SERVICOS_SYNC, FINANCEIRO_SERVICOS_NFSE_VINCULAR }',1)
s=s.replace('export const servicosGeradosSincronizar=()=>chamar("sincronizarPagamentos");','export const servicosGeradosSincronizar=()=>chamarUrl(FINANCEIRO_SERVICOS_SYNC,{});',1)
marker='export const servicoGeradoConcluirFaturamento=id=>chamarUrl(FINANCEIRO_SERVICOS_FATURAR,{id});'
if marker not in s: raise SystemExit('servicosGerados.js: marcador faturar ausente')
s=s.replace(marker,marker+'\nexport const servicoGeradoVincularNfse=(servicoId,notaFiscalId)=>chamarUrl(FINANCEIRO_SERVICOS_NFSE_VINCULAR,{servicoId,notaFiscalId});',1)
p.write_text(s)

# Serviços Gerados UI
p=Path('src/pages/ServicosGerados.jsx'); s=p.read_text()
s=s.replace('import { useEffect, useMemo, useRef, useState } from "react";','import { useEffect, useMemo, useRef, useState } from "react";\nimport { useNavigate } from "react-router-dom";',1)
s=s.replace('export default function ServicosGerados(){\n const arquivoRef=useRef(null);','export default function ServicosGerados(){\n const navigate=useNavigate();\n const arquivoRef=useRef(null);',1)
old=' const empresaEdit=useMemo(()=>opcoes.empresas.find(x=>x.id===edit?.empresa_id),[opcoes,edit?.empresa_id]);'
new=old+'\n const ehMlab=!!empresaEdit&&empresaEdit.nome?.toUpperCase().includes("M LAB")&&!empresaEdit.nome?.toUpperCase().includes("MINASLAB");'
if old not in s: raise SystemExit('ServicosGerados: empresaEdit ausente')
s=s.replace(old,new,1)
old=' function abrir(x){setSel(x);setEdit({...x});setLembrarEmpresa(false);setHist([]);servicoGeradoHistorico(x.id).then(setHist).catch(()=>{})}'
new=' function abrir(x){setSel(x);setEdit({...x});setLembrarEmpresa(!!x.empresa_preferida_id&&x.empresa_preferida_id===x.empresa_id);setHist([]);servicoGeradoHistorico(x.id).then(setHist).catch(()=>{})}\n function emitirNfseMlab(){if(!edit?.empresa_id){setErro("Defina a M Lab como empresa de emissão antes de emitir a NFS-e.");return}if(!edit?.data_vencimento){setErro("Informe o vencimento antes de abrir a emissão da NFS-e.");return}navigate("/financas/notas-fiscais/emitir",{state:{servicoGerado:{...edit}}})}'
if old not in s: raise SystemExit('ServicosGerados: abrir ausente')
s=s.replace(old,new,1)
old='<div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-white p-4"><button className="btn-secondary" onClick={()=>setSel(null)}>Cancelar</button><button className="btn-secondary" onClick={salvar}><Save size={16}/>Salvar</button>{sel.status_faturamento!=="FATURADO"&&<button className="btn-primary" onClick={concluirFaturamento} disabled={carregando}><ReceiptText size={16}/>Concluir faturamento</button>}</div>'
new='<div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-white p-4"><button className="btn-secondary" onClick={()=>setSel(null)}>Cancelar</button><button className="btn-secondary" onClick={salvar}><Save size={16}/>Salvar</button>{ehMlab&&sel.status_faturamento!=="FATURADO"&&<button className="btn-primary" onClick={emitirNfseMlab} disabled={carregando}><ReceiptText size={16}/>Emitir NFS-e M Lab</button>}{!ehMlab&&sel.status_faturamento!=="FATURADO"&&<button className="btn-primary" onClick={concluirFaturamento} disabled={carregando}><ReceiptText size={16}/>Concluir faturamento</button>}</div>'
if old not in s: raise SystemExit('ServicosGerados: rodape ausente')
s=s.replace(old,new,1)
p.write_text(s)

# Emitir NFS-e: receber dados da OS e vincular após autorização
p=Path('src/pages/EmitirNfse.jsx'); s=p.read_text()
s=s.replace('import { useNavigate } from "react-router-dom";','import { useLocation, useNavigate } from "react-router-dom";',1)
anchor='import { finClientesListar, finNfseEmitir, finNfseEmitirProducao, finNfseEstado, finNfseListar, finNfsePreparar, finNfseRascunhoSalvar, finNfseVerificarCertificado } from "../services/financeiro.js";'
if anchor not in s: raise SystemExit('EmitirNfse: import financeiro ausente')
s=s.replace(anchor,anchor+'\nimport { servicoGeradoVincularNfse } from "../services/servicosGerados.js";',1)
s=s.replace('export default function EmitirNfse(){\n  const navigate=useNavigate();','export default function EmitirNfse(){\n  const navigate=useNavigate();\n  const location=useLocation();\n  const origemServico=location.state?.servicoGerado||null;\n  const [origemAplicada,setOrigemAplicada]=useState(false);',1)
old='  useEffect(()=>{carregar()},[]);'
new='''  useEffect(()=>{carregar()},[]);
  useEffect(()=>{if(!origemServico||origemAplicada||!clientes.length)return;const dig=v=>String(v||"").replace(/\\D/g,"");const achado=clientes.find(c=>dig(c.cnpj_cpf)===dig(origemServico.cnpj_cpf));const valor=String(Number(origemServico.valor_faturar||origemServico.valor_original||0)||"");setForm(v=>({...v,cliente_id:achado?.id||"",data_vencimento:origemServico.data_vencimento||"",valor_unitario:valor,valor_total:valor,forma_pagamento:origemServico.forma_pagamento||v.forma_pagamento,servico_descricao:origemServico.servico||v.servico_descricao,observacao:[origemServico.observacao,`OS ${origemServico.os_numero}`].filter(Boolean).join(" · ")}));if(!achado){setNovoCliente(true);setCliente(c=>({...c,nome:origemServico.cliente||"",cnpj_cpf:origemServico.cnpj_cpf||""}))}setOrigemAplicada(true);setOk(`Dados carregados da OS ${origemServico.os_numero}. Confira cliente, serviço e tributação antes de emitir.`)},[clientes,origemServico,origemAplicada]);'''
if old not in s: raise SystemExit('EmitirNfse: useEffect carregar ausente')
s=s.replace(old,new,1)
old='const r=producao?await finNfseEmitirProducao(form.id):await finNfseEmitir(form.id);setOk(r.mensagem||(producao?"NFS-e de produção processada.":"NFS-e transmitida em homologação."));await carregar()'
new='const r=producao?await finNfseEmitirProducao(form.id):await finNfseEmitir(form.id);if(producao&&r.autorizada&&origemServico?.id){await servicoGeradoVincularNfse(origemServico.id,form.id);setOk(`NFS-e ${r.numeroNf||""} autorizada. A OS ${origemServico.os_numero} foi atualizada para Faturado e vinculada à Conta a Receber.`)}else setOk(r.mensagem||(producao?"NFS-e de produção processada.":"NFS-e transmitida em homologação."));await carregar()'
if old not in s: raise SystemExit('EmitirNfse: trecho emitir ausente')
s=s.replace(old,new,1)
p.write_text(s)
