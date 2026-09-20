# Patrimônio MinasLab

Implementação portada do Patrimônio da Impresilk (base 2b5f901), sem importar seus registros, fotos ou setores reais. Nova rota `/patrimonio`, com menu, proteção de acesso e identificação MinasLab no inventário e etiquetas. Setores sugeridos são cadastrados somente quando o usuário escolhe a ação.

## Recursos preservados
Inventário em cartões e lista; pesquisa por etiqueta, nome, série, nota e responsável; filtros combináveis por setor, tipo, situação e pendência; ordenação e paginação; seleção por página; ficha e edição; setores; fotos com redução antes do envio e capas carregadas sob demanda; pendências; valores de aquisição; bens baixados; relatório e etiquetas do recorte/seleção.

## Dados e acesso
`ml-patrimonio` usa a sessão existente validada por `ml-sync` e restringe acesso à direção, no servidor e na rota. Os cadastros ficam na tabela exclusiva `ml_patrimonio` com RLS e acesso apenas pelo serviço. Fotos ficam no bucket privado `ml-patrimonio`, com URLs temporárias. Remoções são lógicas; fotos removidas continuam privadas para recuperação administrativa. Sem alteração de outras tabelas, regras de ponto ou dados da Impresilk.

O banco gera códigos `ML-SETOR-000001`, imutáveis após cadastro, sob bloqueio transacional. A sequência é global e não reutiliza etiquetas; pode conter intervalos após tentativas abortadas. Setores com bens ativos ou baixados não podem ser removidos ou ter a sigla alterada. Setores iniciais não sobrescrevem setores existentes. Nenhum bem é criado automaticamente.

## Ativação e publicação
1. Aplicar `supabase/migrations/20260920_ml_patrimonio.sql` somente no projeto MinasLab/Projetos Léo (`reoghclxripktzpdwhiy`).
2. Publicar `supabase/functions/ml-patrimonio/index.ts` com `verify_jwt=false` (a função exige e valida a sessão MinasLab internamente). Reutiliza os segredos existentes; não criar credenciais novas.
3. Validar recusa sem sessão e acesso autorizado. Gravações reais de teste dependem de autorização; nunca cadastrar ativos fictícios em produção.
4. Publicar o frontend, excluindo `.review` e `node_modules`; verificar a rota oficial após o Pages concluir.

## Verificação
Build de produção e lint dos arquivos alterados. Suíte do MinasLab acrescida de testes herdados de inventário e resumo. `scripts/testar-patrimonio-porta.mjs` testa autenticação e papéis com serviços simulados. `scripts/testar-patrimonio-sql.mjs` executa a migração e regras em PostgreSQL isolado via PGlite (`PGLITE_ENTRY` aponta para dist/index.js do pacote), incluindo unicidade, edição de etiqueta, setor ocupado, baixas, exclusão lógica, datas e privilégios.

Prévia local: `http://127.0.0.1:5284/.review/patrimonio.html#/patrimonio`. Usa dados fictícios e serviços substituídos; não valida upload real ou persistência no Supabase. A migração foi aplicada no projeto MinasLab e a função ml-patrimonio v1 foi ativada em 19/09/2026, após autorização do usuário. O frontend segue pelo fluxo de publicação do GitHub Pages.
