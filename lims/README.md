# MinasLab LIMS

Sistema de gestão do laboratório (propostas, amostras, análises, laudos),
construído **fiel ao GerenciaLab** — mesmo menu, mesmas telas, mesmos botões e
campos — com a logo e a paleta do painel MinasLab. As melhorias da ISO/IEC
17025 entram depois que o sistema estiver completo.

## Como funciona

- **Front:** React 19 + Vite, CSS próprio (`src/estilo.css`), sem framework de UI.
- **Link próprio:** publicado junto com o painel em `/minaslab-painel/lims/`.
  O item "MinasLab LIMS" do menu do painel abre esse link em nova aba.
- **Login:** o mesmo do painel (Edge Function `ml-sync`, ação `entrar`). Quem já
  entrou no painel entra direto (mesmo crachá de 12 h). Sair do LIMS sai do painel.
- **Rotas por `#`**, com os mesmos nomes de caminho do GerenciaLab
  (`#/customers`, `#/proposedlist`, `#/proposta/941`...). Cada tela tem link próprio.
- **Piloto:** só a direção abre o LIMS (no app e no menu do painel, via
  `SO_DIRECAO`). A equipe será liberada em Configurações → Permissões de acesso.

## Dados (Supabase "Projetos Léo")

Tudo passa pela Edge Function **`ml-lims`** (`supabase/functions/ml-lims`),
que confere o crachá e a conta em toda chamada. Tabelas próprias, criadas pela
migração `supabase/migrations/20261104150000_lims_registros_auditoria.sql`:

- **`ml_lims_registros`** — os dados por coleção (catálogo, cadastros,
  propostas). Fora de `ml_registros` de propósito: o `ml-sync` deixa equipe sem
  matriz ler e gravar qualquer coleção de lá. RLS ligado, sem política: só o
  `service_role` da função acessa.
- **`ml_lims_auditoria`** — trilha de auditoria (quem, quando, o quê, antes e
  depois). Só inserção: um gatilho bloqueia alterar e apagar. Aparece em
  Configurações → Auditoria LOG e no "Histórico" de cada cadastro.
- **`ml_lims_contadores`** + função `ml_lims_proximo` — numeração atômica
  (proposta por ano, código sequencial de cada cadastro).

Regras do servidor: exclusão é lápide (o registro some das listas e fica na
trilha, com o motivo); campos `senha*` são só de escrita (nunca voltam para a
tela); a numeração da proposta pode continuar a do GerenciaLab (Configuração do
sistema → Proposta → "Numeração da proposta começa em").

As telas falam só com `src/lib/dados.jsx`.

Publicar a função:

```
supabase functions deploy ml-lims --project-ref reoghclxripktzpdwhiy --no-verify-jwt
```

## Construção, menu por menu

| Menu | Situação |
| --- | --- |
| Cadastro (Cliente / Fornecedor, Solicitantes) | pronto |
| Propostas (Criar, Listar, Serviços, Visualizar) | pronto |
| Configurações (todos os grupos, menos Estoque e CQ) | pronto |
| Contratos, Ordem serviços, Coletas, Laboratório, Revisão, Financeiro, Relatórios | depois |
| Gestão da qualidade | por último |

Em Configurações ficam de fora, de propósito: Configuração Estoque (o painel
já tem a Gestão de Estoque), CQ – Configuração e CQ – Não Conformidades.

Depois do LIMS completo: cadastro único de clientes/fornecedores com o CRM,
proposta alimentando o CRM e o financeiro alimentando as Finanças do painel.

## Onde fica cada coisa

- `src/lib/menu.js` — o menu (lista única; tela nova entra aqui e em `TELAS` do `App.jsx`).
- `src/lib/cadastros.js` — os cadastros de Configurações (35 telas, 37 cadastros; campos, colunas, referências),
  desenhados pelo motor `src/components/Cadastro.jsx`. `src/lib/configSistema.js` — as 10 abas.
- `src/lib/propostas.js`, `clientes.js`, `grade.js` — regras puras, com testes `*.test.mjs`.
- `src/components/Grade.jsx` — a grade estilo DataTables usada em todas as listas.
- `src/pages/` — uma tela por arquivo.

## Rodar

```
npm install
npm run dev     # http://localhost:5177
npm test        # regras de propostas, clientes, grade e cadastros
npm run build
```

O `deploy.yml` da raiz roda os testes e o build do LIMS antes de publicar;
se falharem, o site no ar não muda.
