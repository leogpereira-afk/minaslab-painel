from pathlib import Path
p=Path('src/pages/EmitirNfse.jsx')
s=p.read_text()
old='servico_descricao:origemServico.servico||v.servico_descricao,observacao:[origemServico.observacao,`OS ${origemServico.os_numero}`].filter(Boolean).join(" · ")'
new='servico_descricao:`Serviços Prestados pela M Lab : ${origemServico.contrato_proposta?`Contrato: ${origemServico.contrato_proposta} | `:""}OS: ${origemServico.os_numero}` ,observacao:[origemServico.observacao,`OS ${origemServico.os_numero}`].filter(Boolean).join(" · ")'
if old not in s:
    raise SystemExit('Trecho de preenchimento automatico nao encontrado')
p.write_text(s.replace(old,new,1))
