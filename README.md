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

## Segredos (Supabase → Edge Functions → Secrets)

- `ML_JWT_SECRET` — assina os crachás.
- `ML_SENHA_MESTRA` — senha inicial da direção; deixa de valer quando a conta
  `leo` é criada na tela de Acessos.
- `ML_TOKEN` — token de máquina (backup). Nunca vai ao navegador.

Nenhum segredo vive neste repositório — ele é público de propósito.
