# MinasLab NFSe Gateway

Microserviço dedicado para a comunicação mTLS entre o Financeiro MinasLab e a SEFIN Nacional.

## Segurança

- O certificado A1 e a senha entram somente por variáveis de ambiente do provedor de hospedagem.
- Nunca grave `.pfx`, senha, Base64 ou token no GitHub.
- O endpoint de teste exige `Authorization: Bearer <NFSE_GATEWAY_TOKEN>`.
- A rota de emissão permanece bloqueada nesta versão.

## Variáveis

Use como referência `.env.example`:

- `NFSE_GATEWAY_TOKEN`
- `MLAB_NFSE_AMBIENTE=HOMOLOGACAO`
- `MLAB_NFSE_CERT_PFX_B64`
- `MLAB_NFSE_CERT_PASSWORD`
- `PORT` (normalmente fornecido pelo provedor)

## Rotas

### `GET /health`

Confere apenas se o processo recebeu a configuração necessária. Não expõe certificado, senha ou token.

### `POST /v1/testar-conexao`

Corpo:

```json
{"idDps":"DPS..."}
```

Executa `HEAD /dps/{id}` na SEFIN Produção Restrita usando Node `https.Agent`, certificado A1 e ALPN fixo em HTTP/1.1. Não transmite DPS e não emite NFS-e.

### `POST /v1/emitir`

Bloqueada nesta versão (`HTTP 423`). Só será liberada depois do teste mTLS e da homologação do XML/DPS.

## Docker

O diretório já contém `Dockerfile`. Configure o diretório raiz do serviço como `nfse-gateway` e exponha a porta informada em `PORT`.
