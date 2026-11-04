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
  `SO_DIRECAO`). A equipe é liberada quando a porta do servidor existir.

## Etapa atual: dados de demonstração

Os dados desta etapa são **fictícios e ficam só no navegador** de quem usa
(`localStorage`, chave `lims_demo_v1`). Nada vai para o servidor. O selo
"Dados de demonstração" no topo explica isso e permite restaurar os exemplos.

As telas falam só com `src/lib/dados.jsx`. Na próxima etapa esse arquivo passa
a ler e gravar pela porta própria do LIMS no Supabase (coleções `lims_*` em
`ml_registros`), sem mexer nas telas.

## Construção, menu por menu

| Menu | Situação |
| --- | --- |
| Cadastro (Cliente / Fornecedor, Solicitantes) | pronto |
| Propostas (Criar, Listar, Serviços, Visualizar) | pronto |
| Configurações | próximo, já gravando no Supabase |
| Contratos, Ordem serviços, Coletas, Laboratório, Revisão, Financeiro, Relatórios | depois |
| Gestão da qualidade | por último |

Em Configurações ficam de fora, de propósito: Configuração Estoque (o painel
já tem a Gestão de Estoque), CQ – Configuração e CQ – Não Conformidades.

Depois do LIMS completo: cadastro único de clientes/fornecedores com o CRM,
proposta alimentando o CRM e o financeiro alimentando as Finanças do painel.

## Onde fica cada coisa

- `src/lib/menu.js` — o menu (lista única; tela nova entra aqui e em `TELAS` do `App.jsx`).
- `src/lib/propostas.js`, `clientes.js`, `grade.js` — regras puras, com testes `*.test.mjs`.
- `src/components/Grade.jsx` — a grade estilo DataTables usada em todas as listas.
- `src/pages/` — uma tela por arquivo.

## Rodar

```
npm install
npm run dev     # http://localhost:5177
npm test        # regras de propostas, clientes e grade
npm run build
```

O `deploy.yml` da raiz roda os testes e o build do LIMS antes de publicar;
se falharem, o site no ar não muda.
