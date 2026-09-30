# MinasLab · Painel de Gestão

O painel da MinasLab (laboratório de controle de qualidade / análises
ambientais): **um sistema só**, tudo dentro de um site — agenda, compromissos,
coletas de campo, licitações, marketing, compras, manutenções, RH e acessos.
Ele complementa o que o ERP (Omie) não faz.

## Como funciona

- **Front**: React + Vite + Tailwind, publicado no GitHub Pages.
- **Dados**: Supabase (projeto "Projetos Léo"), tabelas com prefixo `ml_`.
  O navegador **nunca** fala com o banco: tudo passa pela Edge Function
  `ml-sync`, que confere o crachá (JWT de 12h) e o papel em cada chamada.
- **Papéis**: `direcao` (tudo), `equipe` (operacional, sem RH), `leitura`.
- **Login**: usuário + senha (PBKDF2, 120 mil iterações), com freio atômico de
  tentativas no banco (`ml_freio`).

## Rodar local

```
npm install
npm run dev
```

## Publicar

Push na `main` publica sozinho (`.github/workflows/deploy.yml`).

## CRM MinasLab (`crm/`)

O CRM é um app à parte (React 19 + TypeScript + supabase-js), com
`package.json` próprio, publicado **junto** com o painel em
`/minaslab-painel/crm/`. O item "CRM" do menu aponta para lá.

- **Dados**: mesmo projeto Supabase ("Projetos Léo"), mas o CRM fala com o
  banco pelo supabase-js (Auth + RLS) e usa as Edge Functions `admin-users` e
  `chatpro-webhook`. URL do projeto e *publishable key* vão no workflow — são
  públicas por design.
- **Build**: o `deploy.yml` roda `npm ci` + `typecheck` + `build` em `crm/`
  com `CRM_BASE_PATH=/minaslab-painel/crm/` e copia `crm/dist` para
  `dist/crm`. O `build-check.yml` faz o mesmo em todo PR.
- **Refresh em subpágina do CRM**: o Pages só tem um `404.html`, na raiz.
  `scripts/crm-404.mjs` gera esse arquivo a partir do index do painel, com um
  desvio: caminho `/crm/...` vai para `/crm/?__rota=...`, e o `index.html` do
  CRM restaura a rota antes do React Router montar.
- **Rodar local**: `cd crm && npm install && npm run dev` (precisa de
  `crm/.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
- **Auth**: em Supabase → Authentication → URL Configuration, a URL
  `https://leogpereira-afk.github.io/minaslab-painel/crm/reset-password`
  precisa estar nas Redirect URLs para a redefinição de senha funcionar.

## Segredos (Supabase → Edge Functions → Secrets)

- `ML_JWT_SECRET` — assina os crachás.
- `ML_SENHA_MESTRA` — senha inicial da direção; deixa de valer quando a conta
  `leo` é criada na tela de Acessos.
- `ML_TOKEN` — token de máquina (backup). Nunca vai ao navegador.

Nenhum segredo vive neste repositório — ele é público de propósito.
