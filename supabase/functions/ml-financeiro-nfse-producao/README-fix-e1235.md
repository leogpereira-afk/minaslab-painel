# Correção E1235 — TSLogradouro

Na geração da DPS de produção, campos textuais do endereço do tomador devem ser normalizados antes da serialização XML: remover espaços nas extremidades, converter sequências de whitespace em um único espaço e remover caracteres de controle XML. A correção é aplicada no Edge Function ativo `ml-financeiro-nfse-producao` sem alterar o cadastro original do cliente.
