# CRM MinasLab 2.0

Código-fonte oficial do CRM MinasLab 2.0.

Base técnica: React + TypeScript + Vite + Tailwind + Supabase.

## Ambiente local
Crie `.env.local` na raiz:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
```

Nunca use `service_role` no frontend.

## Comandos
```bash
npm install
npm run dev
npm run build
```

## Estado atual
- Desenvolvimento principal consolidado a partir da FULL BUILD RC13.
- GitHub é a fonte oficial do código.
- Dados históricos reais ainda não foram migrados.
- Produção ainda não foi publicada.
- Build e bateria final de homologação são o próximo gate.
- GerenciaLab → Propostas possui modelo solicitado, mas o arquivo real ainda deve ser auditado quando estiver disponível.
- `.xlsx`, CSV e TXT estão preparados no importador; `.xls` legado permanece bloqueado com orientação de conversão.

## Segurança
Não versionar `.env`, `.env.local`, credenciais, chaves privadas ou `service_role`.
