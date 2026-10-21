# Marketing no painel MinasLab

A página reúne Canais digitais e Ações. Visão geral, detalhes e conexões ficam dentro de Canais digitais. As ações continuam na coleção `mkt`, com os mesmos formulários, permissões, exportação e histórico.

## Fontes e acesso

A função nova `ml-marketing` pertence ao projeto Supabase `heveemylixartyijxewh`, onde já existem as conexões da MinasLab na Central do Léo. Ela usa exclusivamente as chaves `marketing_minaslab_direto_*` e `leo_marketing_minaslab_direto_*`. Não há migração de tokens nem novas tabelas.

O navegador envia o crachá já usado no painel. O servidor valida esse crachá no emissor fixo `ml-sync` do projeto `reoghclxripktzpdwhiy`, pela operação de leitura `contasListar`, e exige que a própria conta continue cadastrada, ativa e com papel `direcao`. A lista de contas nunca é devolvida à interface. Falha, conta apagada ou papel alterado recusam o acesso. Nenhuma chave de serviço é enviada ao navegador. Equipe e leitura permanecem com as permissões anteriores para Ações.

O gateway aceita somente `painel`, `listar`, `vincular` e `coletar`, para seis canais fixos. Não aceita empresa diferente de MinasLab nem endpoint fornecido pelo navegador. Os relatórios passam pela projeção que confere identidade e permite somente campos previstos. Não cria campanhas, posts ou mensagens.

A autorização/reconexão OAuth permanece no fluxo existente da Central do Léo. O botão Gerenciar autorização abre a empresa MinasLab em outra aba. Seleção de conta, coleta e leitura dos indicadores funcionam dentro do painel. Não se alteram callbacks ou permissões dos aplicativos Google/Meta.

## Semântica dos indicadores

- Atualizar leitura: lê a última coleta armazenada.
- Coletar indicadores: consulta o provedor para o canal escolhido e atualiza a leitura.
- Período e horário de coleta aparecem por canal. Não há soma entre plataformas.
- Zero confirmado continua zero; ausência aparece como travessão.
- Falhas conservam a última leitura, com aviso explícito.
- Cobertura informa campos ausentes, limites e amostragem do provedor.

## Publicação

1. Testar frontend (`npm ci`, `npm run lint`, `npm test`, `npm run build`).
2. Publicar **somente** `supabase/functions/ml-marketing` em `heveemylixartyijxewh`, com `verify_jwt=false`: a autenticação própria é obrigatória no handler.
3. Conferir rejeição sem sessão e leitura autenticada da direção; conferir sessão sem acesso.
4. Publicar a interface via workflow Pages do repositório. Não substituir ou republicar `ml-sync` ou `leo-sync`.
5. Validar as duas abas e a navegação interna em desktop e celular. Testes locais usam dados fictícios e não gravam registros reais.

Os adaptadores `marketing-direto*`, `marketing-marcas.mjs` e `marketing-fortemais.mjs` foram reaproveitados da Central (`vida-leo`, referência consultada em 21/10/2026). Qualquer atualização posterior deve preservar as verificações de vínculo e os contratos dos relatórios.


Navegação: Marketing possui somente as abas Canais digitais e Ações. Visão geral, detalhes de cada canal e conexões ficam dentro de Canais digitais. Os cards usam logomarcas coloridas locais; clicar na identidade ou em Detalhes abre o canal dentro do painel.
