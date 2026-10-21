# Comercial · MinasLab

Painel de gestão do setor comercial: metas × realizado, pontos a melhorar,
feedback individual, ocorrências, avaliação e bônus, plano de ação. Lê o CRM e
o painel da MinasLab; só a direção entra.

## Como funciona

- **Front:** React + Vite, CSS próprio com as cores da MinasLab (sem framework de UI).
- **Login:** o mesmo do Painel de Gestão (Edge Function `ml-sync`, ação `entrar`).
  Só contas com papel `direcao` passam.
- **Dados próprios** (equipe, metas, ocorrências, avaliações, feedbacks,
  estratégias, regras): coleções `rh_comercial_*` em `ml_registros`, gravadas
  pela porta do painel (`ml-sync`). O prefixo `rh_` faz o servidor restringir
  leitura e escrita à direção. Nenhuma tabela nova.
- **Números do CRM:** Edge Function `ml-comercial` (pasta
  `supabase/functions/ml-comercial`), só leitura. Confere o mesmo crachá do
  painel e devolve propostas somadas por mês e responsável, e a lista de
  propostas sem responsável. Regras de soma em `agregar.mjs`, com testes.
- **Regras de avaliação:** `src/lib/calculos.js`, com testes. A tela só mostra.

Supabase: projeto **Projetos Léo** (compartilhado; tudo da MinasLab leva o prefixo `ml_`).

## Rodar

```
npm install
npm run dev     # http://localhost:5176
npm test        # regras e soma do CRM
npm run build
```

## Publicar o site

A Gestão mora dentro do painel MinasLab (pasta `gestao/` do repositório
minaslab-painel) e é publicada junto com ele, em `/minaslab-painel/gestao/`,
pelo `.github/workflows/deploy.yml` da raiz. Os testes da Gestão rodam antes;
se falharem, o site no ar não muda. O login é o do painel (login único).

## Publicar a função do CRM

```
supabase functions deploy ml-comercial --project-ref reoghclxripktzpdwhiy --no-verify-jwt
```

Usa o segredo `ML_JWT_SECRET`, que já existe no projeto (é o mesmo do painel).

## Telas

- **Resultado:** Cockpit do dia (previsão do mês, alertas, ações do dia), Visão do mês, Funil, Qualidade do dado.
- **Pessoas:** Pessoas e feedback (roteiro de 1:1, PDI, estágio e estilo de liderança), Avaliação e bônus, Ocorrências.
- **Clientes:** Carteira (curva ABC, clientes em risco, contratos e recorrências), Satisfação (NPS), Licitações.
- **Gestão:** Estratégias e objetivos do trimestre, Decisões (diário com revisão), Funções e cargos, Equipe e metas (inclui desligamento).
- **Pessoas:** também **Destaque do mês** (para toda a MinasLab): votação anônima por link, avaliação da liderança, ranking pelo modelo híbrido e como a equipe avalia a gestão.
- **Desenvolvimento:** Reuniões e apresentações (estúdio com modelos no estilo MinasLab: Reunião mensal de resultados com CRM, ranking e destaque automáticos; rituais do comercial com roteiro e ata), Treinamentos (Integração de novos colaboradores, modelo de novo treinamento, 9 trilhas, registro e eficácia).

Listas longas têm paginação e telas longas foram divididas em abas.

Função `ml-comercial`: leitura do CRM (`resumo`, `semResponsavel`, `cockpit`, `funil`, `carteira`, `licitacoes`, `nps`) e a votação do Destaque do Mês.

### Votação anônima (Destaque do Mês)

- Ações **públicas** (sem login): `votoAbrir` e `votoEnviar`, só em votação aberta. Dois modos: **link aberto** (a pessoa escolhe o próprio nome, que sai da lista; o servidor guarda só um HMAC de "já votou", separado das notas) ou **código** de uso único sorteado.
- Ações da direção (crachá): `pesquisaListar`, `pesquisaCriar`, `pesquisaCodigos`, `pesquisaStatus`, `pesquisaApagar`.
- Nada que identifique quem votou é gravado: o voto é somado direto nos totais (`pesquisa.mjs`), comentários entram em posição sorteada, e o código usado fica guardado como HMAC com segredo do servidor. Médias só aparecem depois de encerrar e para quem tem o mínimo de votos (padrão 3).
- Registro em `ml_registros`, coleção `rh_comercial_pesquisas` (direção). Gravação com controle de concorrência pela coluna `atualizado_em`.
- Página pública: `#/votar/<id>` (o app não pede login nessa rota).
