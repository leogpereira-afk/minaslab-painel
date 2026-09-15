# Patch E1235

Implantado diretamente no Edge Function de produção `ml-financeiro-nfse-producao`, versão 10.

A serialização fiscal agora normaliza todo texto passado por `esc()`: remove caracteres de controle incompatíveis com XML, consolida sequências de whitespace e aplica `trim()` antes do escape XML. Isso corrige casos como `<xLgr>Fazenda Teixeira </xLgr>` sem alterar o cadastro original do cliente.

A fonte integral do Edge Function deve ser sincronizada do Supabase antes da próxima alteração, pois a versão ativa contém evoluções posteriores à cópia histórica do repositório.
